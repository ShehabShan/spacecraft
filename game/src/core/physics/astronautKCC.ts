/**
 * ============================================================================
 *  ASTRONAUT KCC — SPHERICAL KINEMATIC CHARACTER CONTROLLER (FLOAT64, ZERO-GC)
 *  Milestone 1E · Spec 01.1 step 3 (parented compose), 01.4 (spherical walk),
 *  02.3 (gravity + range fade), 00.4 (limited RCS, no damage systems)
 * ============================================================================
 *  Pure core: no three/react/rapier imports. Terrain collision is analytic
 *  against the M1C Float64 noise field (Spec 01.4: Rapier simulates only the
 *  RELATIVE walking displacement in the production Active state; the entity
 *  write-through is the seam — nothing here changes when heightfield
 *  colliders attach later).
 *
 *  CANONICAL STATE BY MODE:
 *   SURFACE (grounded): planet-frame pLocal + tangential vCtl/vSlide +
 *                       transported frame (up, fwd). Absolute is COMPOSED:
 *                           P = R(θ)·pLocal
 *                           V = Ω×P + R(θ)·(vCtl+vSlide)      [analytic
 *                             transport velocity — Spec 01.4 verbatim]
 *   SURFACE (airborne) / ZERO-G: absolute inertial (P, V) under central
 *                       range-faded gravity. The equator-jump Coriolis
 *                       drift (4/3)·Ω·u³/g² emerges from pure inertial
 *                       integration — no fictitious forces anywhere.
 *   VEHICLE: parent-local offset; P/V composed from the provider every tick.
 *
 *  MODE HYSTERESIS (range-faded gravity magnitude): SURFACE -> ZERO-G when
 *  g < 0.05 m/s², ZERO-G -> SURFACE when g > 0.15 m/s² (~28 km, test planet).
 *
 *  STEP RULE (derived, flagged): a move climbs iff Δh <= stepHeight AND
 *  Δh/arc <= tan(maxWalkSlope) — the ratio clause makes walkability a
 *  property of terrain, invariant to speed (see M1E analysis §1.2).
 *
 *  SWEEP: gap-limited (<= 0.25 m) analytic sampling of the tick segment
 *  with SPIN-INTERPOLATED sample transforms θ(s) = θ0 + Ω·dt·s (without it
 *  the rotating terrain is misplaced by up to r·Ω·dt = 0.87 m/tick at the
 *  equator), Lipschitz-bounded transients, embed check at tick start,
 *  sub-tick bisection landing. Post-tick AGL >= 0 structurally (grounded
 *  positions are anchored to probed surface points).
 *
 *  ZERO-GC AUDIT of integrateTick(): field writes on owned objects, math in
 *  module-level scratch, interned mode-string literals, indexed loops.
 *  Allocation per tick: 0. (update()'s pre-tick look-delta application and
 *  post-tick entity write-through are field writes only.)
 */


import {
  clamp, gravityInto, quatFromFrameInto, rotateAboutAxisInto,
  rotateByQuatConjInto, rotateByQuatInto, signedAngleAbout, spinQuatInto,
  transportFrameInto, transportVelocityInto,
  type Quat, type Vec3,
} from './sphericalFrame';
import { terrainHeight, terrainNormalInto } from '../terrain/terrainField';


export type AstronautMode = 'SURFACE' | 'ZERO-G' | 'VEHICLE';


export interface AstronautInput {
  /** Frame-relative movement axes, each in [-1, 1] (fwd / right). */
  moveF: number;
  moveR: number;
  sprint: boolean;
  crouch: boolean;
  /** Edge-triggered jump request; consumed by the tick. */
  jump: boolean;
  /** Continuous yaw rate, rad/s (finite rotation about up — never Euler). */
  turnRate: number;
  /** ZERO-G RCS translation axes (frame-relative), [-1, 1]. */
  rcsF: number; rcsU: number; rcsR: number;
}


export interface VehicleProvider {
  /** Parent position/velocity (absolute f64), orientation, angular velocity. */
  pos: Vec3; vel: Vec3; quat: Quat; angVel: Vec3;
}


export interface AstronautConfig {
  planetRadius: number;
  planetMu: number;
  /** Spec 02.2 sphere of influence (gravity fade range), metres. */
  gravityRange: number;
  /** Spin rate, rad/s. Spec example: 52 / 5000 = 0.0104 (52 m/s equator). */
  spinOmega: number;
  maxTerrainHeight: number;
  walkSpeed: number;
  sprintSpeed: number;
  crouchSpeed: number;
  jumpSpeed: number;
  /** Velocity response time constant (exact exponential), s. */
  accelTau: number;
  stepHeight: number;
  snapDistance: number;
  groundClearance: number;
  /** Slopes above this are blocked for climbing (ratio clause). Degrees. */
  maxWalkSlopeDeg: number;
  /** Slopes above this slide (mu_s = tan(slideAngle)). Degrees. */
  slideAngleDeg: number;
  kineticFriction: number;
  slideGripTau: number;
  eyeHeight: number;
  crouchEyeHeight: number;
  /** Terrain-normal vs radial blend for the character up vector. */
  upBlendWeight: number;
  /** Airborne up -> radial re-alignment time constant, s. */
  airborneUpTau: number;
  autoTurnRate: number;
  rcsAccel: number;
  rcsBudgetMax: number;
  rcsRegen: number;
  sweepGap: number;
}


/** Earth-scale test astronaut on the M1C planet (μ = 9.81·5000², Spec 02.3). */
export const EARTHSCALE_ASTRONAUT: AstronautConfig = {
  planetRadius: 5000,
  planetMu: 245_250_000,
  gravityRange: 30_000,          // max(6R, 1.3·D_moon) = 30,000 (no moons)
  spinOmega: 0.0104,             // 52 m/s at the equator — Spec 01.4 example
  maxTerrainHeight: 900,
  walkSpeed: 4,
  sprintSpeed: 8,
  crouchSpeed: 1.8,
  jumpSpeed: 5,
  accelTau: 0.12,
  stepHeight: 0.55,
  snapDistance: 0.45,
  groundClearance: 0.02,
  maxWalkSlopeDeg: 50,
  slideAngleDeg: 45,
  kineticFriction: 0.6,
  slideGripTau: 0.06,
  eyeHeight: 1.62,
  crouchEyeHeight: 0.95,
  upBlendWeight: 0.65,
  airborneUpTau: 2.0,
  autoTurnRate: 6,
  rcsAccel: 1.2,
  rcsBudgetMax: 25,
  rcsRegen: 0.5,
  sweepGap: 0.25,
};


export interface AstronautTelemetry {
  mode: AstronautMode;
  grounded: boolean;
  crouched: boolean;
  /** Tangential relative speed (grounded) / relative speed (airborne). */
  relSpeed: number;
  slideSpeed: number;
  transportSpeed: number;
  absSpeed: number;
  altMSL: number;
  altAGL: number;
  slopeDeg: number;
  upX: number; upY: number; upZ: number;      // planet frame
  fwdX: number; fwdY: number; fwdZ: number;   // planet frame
  gravX: number; gravY: number; gravZ: number;
  gravMag: number;
  spinPhase: number;
  dayFraction: number;
  rcsBudget: number;
  eyeHeight: number;
  turnApplied: number;
  currentFace: number;
}


export interface AstronautIntegrity {
  ticks: number;
  ticksGrounded: number;
  ticksAirborne: number;
  ticksZeroG: number;
  ticksVehicle: number;
  landings: number;
  lastLandingRelSpeed: number;
  minAGL: number;
  maxSlideSpeed: number;
  faceChanges: number;
  nanEvents: number;
}


/* ===========================================================================
 * MODULE SCRATCH — allocated once per thread; integrateTick is
 * non-reentrant (single-threaded, one active controller per tick).
 * ======================================================================== */
const _g: Vec3 = { x: 0, y: 0, z: 0 };
const _gt: Vec3 = { x: 0, y: 0, z: 0 };
const _nNew: Vec3 = { x: 0, y: 0, z: 0 };
const _upT: Vec3 = { x: 0, y: 0, z: 0 };
const _fwdT: Vec3 = { x: 0, y: 0, z: 0 };
const _right: Vec3 = { x: 0, y: 0, z: 0 };
const _vDes: Vec3 = { x: 0, y: 0, z: 0 };
const _vT: Vec3 = { x: 0, y: 0, z: 0 };
const _pTry: Vec3 = { x: 0, y: 0, z: 0 };
const _dTry: Vec3 = { x: 0, y: 0, z: 0 };
const _wall: Vec3 = { x: 0, y: 0, z: 0 };
const _dS: Vec3 = { x: 0, y: 0, z: 0 };
const _rel: Vec3 = { x: 0, y: 0, z: 0 };
const _tmp: Vec3 = { x: 0, y: 0, z: 0 };
const _tmp2: Vec3 = { x: 0, y: 0, z: 0 };
const _qSpin: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _qTmp: Quat = { x: 0, y: 0, z: 0, w: 1 };


const _nanSnap = {
  px: 0, py: 0, pz: 0, vx: 0, vy: 0, vz: 0,
  lx: 0, ly: 0, lz: 0, ux: 0, uy: 0, uz: 0, fx: 0, fy: 0, fz: 0,
};


export class AstronautKCC {
  /* ---- live state (owned; mutated only by this class) -------------------- */
  /** Absolute position/velocity, Float64 (canonical when not grounded). */
  readonly absPos: Vec3 = { x: 0, y: 0, z: 0 };
  readonly absVel: Vec3 = { x: 0, y: 0, z: 0 };
  /** Planet-frame position (canonical when grounded on the body). */
  readonly pLocal: Vec3 = { x: 0, y: 0, z: 0 };
  /** Transported character frame, PLANET frame (fwd ⊥ up, both unit). */
  readonly up: Vec3 = { x: 0, y: 1, z: 0 };
  readonly fwd: Vec3 = { x: 1, y: 0, z: 0 };
  readonly input: AstronautInput = {
    moveF: 0, moveR: 0, sprint: false, crouch: false, jump: false,
    turnRate: 0, rcsF: 0, rcsU: 0, rcsR: 0,
  };
  /** Look deltas (radians), applied exactly once per update() call. */
  lookYawDelta = 0;
  lookPitchDelta = 0;
  lookRollDelta = 0;
  /** Third-person auto-turn toward movement (disable in first person). */
  autoTurnEnabled = true;


  readonly telemetry: AstronautTelemetry = {
    mode: 'SURFACE', grounded: true, crouched: false,
    relSpeed: 0, slideSpeed: 0, transportSpeed: 0, absSpeed: 0,
    altMSL: 0, altAGL: 0, slopeDeg: 0,
    upX: 0, upY: 1, upZ: 0, fwdX: 1, fwdY: 0, fwdZ: 0,
    gravX: 0, gravY: -9.81, gravZ: 0, gravMag: 9.81,
    spinPhase: 0, dayFraction: 0, rcsBudget: 25, eyeHeight: 1.62,
    turnApplied: 0, currentFace: 0,
  };
  readonly integrity: AstronautIntegrity = {
    ticks: 0, ticksGrounded: 0, ticksAirborne: 0, ticksZeroG: 0,
    ticksVehicle: 0, landings: 0, lastLandingRelSpeed: 0,
    minAGL: Number.POSITIVE_INFINITY, maxSlideSpeed: 0,
    faceChanges: 0, nanEvents: 0,
  };


  private readonly cfg: AstronautConfig;
  private _mode: AstronautMode = 'SURFACE';
  private _grounded = true;
  private _theta = 0;                 // spin phase (wrapped mod 2π)
  private _thetaPrev = 0;
  private _vCtl: Vec3 = { x: 0, y: 0, z: 0 };   // tangential, planet frame
  private _vSlide: Vec3 = { x: 0, y: 0, z: 0 };
  private _rcsBudget: number;
  private _nCur: Vec3 = { x: 0, y: 1, z: 0 };   // cached analytic normal
  private _hCur = 0;                              // cached surface height
  private _face = -1;
  private _vehicle: VehicleProvider | null = null;
  private readonly _vehOffset: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly _vehUp: Vec3 = { x: 0, y: 1, z: 0 };
  private readonly _vehFwd: Vec3 = { x: 1, y: 0, z: 0 };
  private _accumulator = 0;
  // M1A entity write-through (setup path).
  private _wtPos: Vec3 | null = null;
  private _wtVel: Vec3 | null = null;


  constructor(cfg: AstronautConfig) {
    this.cfg = cfg;
    this._rcsBudget = cfg.rcsBudgetMax;
  }


  /* ---- setup-path API ----------------------------------------------------- */


  attachWriteThrough(absPos: Vec3, velocity: Vec3): void {
    this._wtPos = absPos;
    this._wtVel = velocity;
  }


  get mode(): AstronautMode { return this._mode; }
  get grounded(): boolean { return this._grounded; }
  get spinPhase(): number { return this._theta; }


  attachVehicle(provider: VehicleProvider): void {
    // Offset & frame captured in the PARENT frame at attach time.
    const p = provider.pos;
    rotateByQuatConjInto(provider.quat,
      this.absPos.x - p.x, this.absPos.y - p.y, this.absPos.z - p.z, _vehScratch);
    this._vehOffset.x = _vehScratch.x;
    this._vehOffset.y = _vehScratch.y;
    this._vehOffset.z = _vehScratch.z;
    rotateByQuatConjInto(provider.quat, this.up.x, this.up.y, this.up.z, _vehScratch);
    this._vehUp.x = _vehScratch.x; this._vehUp.y = _vehScratch.y; this._vehUp.z = _vehScratch.z;
    rotateByQuatConjInto(provider.quat, this.fwd.x, this.fwd.y, this.fwd.z, _vehScratch);
    this._vehFwd.x = _vehScratch.x; this._vehFwd.y = _vehScratch.y; this._vehFwd.z = _vehScratch.z;
    this._vehicle = provider;
    this._mode = 'VEHICLE';
    this._grounded = false;
  }


  detachVehicle(): void {
    if (this._vehicle === null) return;
    this._vehicle = null;
    gravityInto(this.cfg.planetMu, this.cfg.gravityRange,
      this.absPos.x, this.absPos.y, this.absPos.z, _g);
    const gm = Math.sqrt(_g.x * _g.x + _g.y * _g.y + _g.z * _g.z);
    this._mode = gm < 0.05 ? 'ZERO-G' : 'SURFACE';
    this._grounded = false;
  }


  /** Teleport to an absolute state (inertial). Setup path. */
  teleportAbs(px: number, py: number, pz: number, vx: number, vy: number, vz: number): void {
    this.absPos.x = px; this.absPos.y = py; this.absPos.z = pz;
    this.absVel.x = vx; this.absVel.y = vy; this.absVel.z = vz;
    this._grounded = false;
    this._vCtl.x = 0; this._vCtl.y = 0; this._vCtl.z = 0;
    this._vSlide.x = 0; this._vSlide.y = 0; this._vSlide.z = 0;
    // Planet-frame mirror + radial-aligned frame (continuous, deterministic).
    spinQuatInto(this._theta, _qSpin);
    const r = Math.sqrt(px * px + py * py + pz * pz) || 1;
    rotateByQuatConjInto(_qSpin, px / r, py / r, pz / r, _dS);
    this.pLocal.x = _dS.x * r; this.pLocal.y = _dS.y * r; this.pLocal.z = _dS.z * r;
    this.up.x = _dS.x; this.up.y = _dS.y; this.up.z = _dS.z;
    transportFrameInto(this.fwd.x, this.fwd.y, this.fwd.z, _dS.x, _dS.y, _dS.z, _fwdT);
    this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
    gravityInto(this.cfg.planetMu, this.cfg.gravityRange, px, py, pz, _g);
    const gm = Math.sqrt(_g.x * _g.x + _g.y * _g.y + _g.z * _g.z);
    this._mode = this._vehicle !== null ? 'VEHICLE' : gm < 0.05 ? 'ZERO-G' : 'SURFACE';
  }


  /** Teleport onto the surface at planet-frame direction d (unit-ish). */
  teleportSurface(dx: number, dy: number, dz: number): void {
    const cfg = this.cfg;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const h = terrainHeight(dx, dy, dz);
    this._hCur = h;
    const rr = cfg.planetRadius + h + cfg.groundClearance;
    this.pLocal.x = dx * rr; this.pLocal.y = dy * rr; this.pLocal.z = dz * rr;
    terrainNormalInto(dx, dy, dz, this._nCur);
    this._refreshUpFwd(dx, dy, dz);
    this._vCtl.x = 0; this._vCtl.y = 0; this._vCtl.z = 0;
    this._vSlide.x = 0; this._vSlide.y = 0; this._vSlide.z = 0;
    this._grounded = true;
    this._mode = 'SURFACE';
    this._vehicle = null;
    this._composeGrounded(0, 0, 0);
  }


  /** Render/planet-frame quaternion of the transported character frame. */
  frameQuatInto(out: Quat): Quat {
    return quatFromFrameInto(this.fwd.x, this.fwd.y, this.fwd.z,
      this.up.x, this.up.y, this.up.z, out);
  }


  resetIntegrityStats(): void {
    const i = this.integrity;
    i.ticks = 0; i.ticksGrounded = 0; i.ticksAirborne = 0;
    i.ticksZeroG = 0; i.ticksVehicle = 0;
    i.landings = 0; i.lastLandingRelSpeed = 0;
    i.minAGL = Number.POSITIVE_INFINITY; i.maxSlideSpeed = 0;
    i.faceChanges = 0; i.nanEvents = 0;
  }


  /* ---- fixed-step governor (Spec 02.6: <=5 substeps, shed don't dilute) -- */


  update(dtRealSeconds: number, maxSubsteps = 5): number {
    if (!Number.isFinite(dtRealSeconds) || dtRealSeconds <= 0) return 0;
    const dt = dtRealSeconds > 0.25 ? 0.25 : dtRealSeconds;
    // Exact once-per-frame look deltas (finite frame rotations — no Euler).
    if (this.lookYawDelta !== 0) {
      rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z,
        this.up.x, this.up.y, this.up.z, this.lookYawDelta, _fwdT);
      this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
      this.lookYawDelta = 0;
    }
    if (this._mode === 'ZERO-G') {
      if (this.lookPitchDelta !== 0 || this.lookRollDelta !== 0) {
        _right.x = this.fwd.y * this.up.z - this.fwd.z * this.up.y;
        _right.y = this.fwd.z * this.up.x - this.fwd.x * this.up.z;
        _right.z = this.fwd.x * this.up.y - this.fwd.y * this.up.x;
        if (this.lookPitchDelta !== 0) {
          rotateAboutAxisInto(this.up.x, this.up.y, this.up.z,
            _right.x, _right.y, _right.z, this.lookPitchDelta, _upT);
          this.up.x = _upT.x; this.up.y = _upT.y; this.up.z = _upT.z;
          rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z,
            _right.x, _right.y, _right.z, this.lookPitchDelta, _fwdT);
          this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
        }
        if (this.lookRollDelta !== 0) {
          rotateAboutAxisInto(this.up.x, this.up.y, this.up.z,
            this.fwd.x, this.fwd.y, this.fwd.z, this.lookRollDelta, _upT);
          this.up.x = _upT.x; this.up.y = _upT.y; this.up.z = _upT.z;
        }
        // Re-orthogonalize (shared rotations preserve ⊥; clean rounding).
        transportFrameInto(this.fwd.x, this.fwd.y, this.fwd.z,
          this.up.x, this.up.y, this.up.z, _fwdT);
        this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
      }
    }
    this.lookPitchDelta = 0;
    this.lookRollDelta = 0;
    this._accumulator += dt;
    let n = 0;
    while (this._accumulator >= 1 / 60 && n < maxSubsteps) {
      this.integrateTick(1 / 60);
      this._accumulator -= 1 / 60;
      n++;
    }
    if (this._accumulator >= 1 / 60) this._accumulator = 0; // shed
    if (this._wtPos !== null && this._wtVel !== null) {
      this._wtPos.x = this.absPos.x; this._wtPos.y = this.absPos.y; this._wtPos.z = this.absPos.z;
      this._wtVel.x = this.absVel.x; this._wtVel.y = this.absVel.y; this._wtVel.z = this.absVel.z;
    }
    return n;
  }


  /* =======================================================================
   * THE FIXED TICK (dt = 1/60), allocation-free.
   * ===================================================================== */
  integrateTick(dt: number): void {
    const cfg = this.cfg;
    const s = _nanSnap;
    s.px = this.absPos.x; s.py = this.absPos.y; s.pz = this.absPos.z;
    s.vx = this.absVel.x; s.vy = this.absVel.y; s.vz = this.absVel.z;
    s.lx = this.pLocal.x; s.ly = this.pLocal.y; s.lz = this.pLocal.z;
    s.ux = this.up.x; s.uy = this.up.y; s.uz = this.up.z;
    s.fx = this.fwd.x; s.fy = this.fwd.y; s.fz = this.fwd.z;


    // Spin phase (wrapped mod 2π; quaternion consumers are sign-invariant).
    this._thetaPrev = this._theta;
    this._theta = (this._theta + cfg.spinOmega * dt) % (Math.PI * 2);


    // Cube-face tracking (planet frame) — dominant-axis, zero alloc.
    const ax = Math.abs(this.pLocal.x), ay = Math.abs(this.pLocal.y),
      az = Math.abs(this.pLocal.z);
    let face: number;
    if (ax >= ay && ax >= az) face = this.pLocal.x >= 0 ? 0 : 1;
    else if (ay >= az) face = this.pLocal.y >= 0 ? 2 : 3;
    else face = this.pLocal.z >= 0 ? 4 : 5;
    if (this._face >= 0 && face !== this._face) this.integrity.faceChanges++;
    this._face = face;


    if (this._mode === 'VEHICLE') {
      this._vehicleTick(dt);
      this.integrity.ticksVehicle++;
    } else if (this._mode === 'SURFACE' && this._grounded) {
      this._groundedTick(dt);
      this.integrity.ticksGrounded++;
    } else {
      this._flightTick(dt);
      if (this._mode === 'ZERO-G') this.integrity.ticksZeroG++;
      else this.integrity.ticksAirborne++;
    }

    // F14 (Lead ruling 2026-10-16): consumed AFTER the tick acted — canon
    // cleared input.jump BEFORE _groundedTick read it, so no jump could
    // ever fire. Edge-trigger preserved: one fire per press, on the next
    // tick; airborne presses buffer to the landing tick (standard).
    this.input.jump = false;


    // Mode hysteresis on the range-faded gravity magnitude.
    if (this._mode !== 'VEHICLE') {
      gravityInto(cfg.planetMu, cfg.gravityRange,
        this.absPos.x, this.absPos.y, this.absPos.z, _g);
      const gm = Math.sqrt(_g.x * _g.x + _g.y * _g.y + _g.z * _g.z);
      if (this._mode === 'SURFACE' && !this._grounded && gm < 0.05) {
        this._mode = 'ZERO-G';
      } else if (this._mode === 'ZERO-G' && gm > 0.15) {
        this._mode = 'SURFACE';
      }
    }


    this._fillTelemetry();
    this.integrity.ticks++;


    // NaN guard (Spec 00.2: nothing may NaN).
    if (
      !Number.isFinite(this.absPos.x) || !Number.isFinite(this.absPos.y) ||
      !Number.isFinite(this.absPos.z) || !Number.isFinite(this.absVel.x) ||
      !Number.isFinite(this.absVel.y) || !Number.isFinite(this.absVel.z) ||
      !Number.isFinite(this.pLocal.x) || !Number.isFinite(this.pLocal.y) ||
      !Number.isFinite(this.pLocal.z)
    ) {
      this.absPos.x = s.px; this.absPos.y = s.py; this.absPos.z = s.pz;
      this.absVel.x = s.vx; this.absVel.y = s.vy; this.absVel.z = s.vz;
      this.pLocal.x = s.lx; this.pLocal.y = s.ly; this.pLocal.z = s.lz;
      this.up.x = s.ux; this.up.y = s.uy; this.up.z = s.uz;
      this.fwd.x = s.fx; this.fwd.y = s.fy; this.fwd.z = s.fz;
      this.integrity.nanEvents++;
    }
  }


  /* ---- grounded: the spherical walk --------------------------------------- */


  private _groundedTick(dt: number): void {
    const cfg = this.cfg;
    const R = cfg.planetRadius;
    let r = Math.sqrt(
      this.pLocal.x * this.pLocal.x + this.pLocal.y * this.pLocal.y +
      this.pLocal.z * this.pLocal.z);
    if (r < 1) r = 1;
    const rx = this.pLocal.x / r, ry = this.pLocal.y / r, rz = this.pLocal.z / r;
    const surfCur = R + this._hCur;
    const n = this._nCur;
    const cosSlope = clamp(n.x * rx + n.y * ry + n.z * rz, -1, 1);
    const slope = Math.acos(cosSlope);


    // Gravity (planet frame == world frame for radial fields).
    gravityInto(cfg.planetMu, cfg.gravityRange,
      this.pLocal.x, this.pLocal.y, this.pLocal.z, _g);
    const gN = -(_g.x * n.x + _g.y * n.y + _g.z * n.z);   // normal load (>=0)
    const gDotN = _g.x * n.x + _g.y * n.y + _g.z * n.z;
    _gt.x = _g.x - gDotN * n.x;                            // downhill (tangential)
    _gt.y = _g.y - gDotN * n.y;
    _gt.z = _g.z - gDotN * n.z;
    const gtMag = Math.sqrt(_gt.x * _gt.x + _gt.y * _gt.y + _gt.z * _gt.z);


    // Input -> desired velocity in the surface frame.
    const speed = this.input.crouch ? cfg.crouchSpeed
      : this.input.sprint ? cfg.sprintSpeed : cfg.walkSpeed;
    let inF = this.input.moveF, inR = this.input.moveR;
    const inLen = Math.sqrt(inF * inF + inR * inR);
    if (inLen > 1) { inF /= inLen; inR /= inLen; }
    _right.x = this.fwd.y * this.up.z - this.fwd.z * this.up.y;
    _right.y = this.fwd.z * this.up.x - this.fwd.x * this.up.z;
    _right.z = this.fwd.x * this.up.y - this.fwd.y * this.up.x;
    _vDes.x = (this.fwd.x * inF + _right.x * inR) * speed;
    _vDes.y = (this.fwd.y * inF + _right.y * inR) * speed;
    _vDes.z = (this.fwd.z * inF + _right.z * inR) * speed;


    // Control response (exact exponential — smooth, frame-rate independent).
    const k = Math.exp(-dt / cfg.accelTau);
    this._vCtl.x = _vDes.x + (this._vCtl.x - _vDes.x) * k;
    this._vCtl.y = _vDes.y + (this._vCtl.y - _vDes.y) * k;
    this._vCtl.z = _vDes.z + (this._vCtl.z - _vDes.z) * k;


    // Slope sliding: static threshold slope > slideAngle (mu_s = tan(angle)).
    if (slope > (cfg.slideAngleDeg * Math.PI) / 180 && gtMag > 1e-9) {
      let vx = this._vSlide.x, vy = this._vSlide.y, vz = this._vSlide.z;
      const vm = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (vm > 0.01) { vx /= vm; vy /= vm; vz /= vm; }
      else { vx = _gt.x / gtMag; vy = _gt.y / gtMag; vz = _gt.z / gtMag; }
      this._vSlide.x += (_gt.x - cfg.kineticFriction * gN * vx) * dt;
      this._vSlide.y += (_gt.y - cfg.kineticFriction * gN * vy) * dt;
      this._vSlide.z += (_gt.z - cfg.kineticFriction * gN * vz) * dt;
    } else {
      const grip = Math.exp(-dt / cfg.slideGripTau);
      this._vSlide.x *= grip; this._vSlide.y *= grip; this._vSlide.z *= grip;
    }
    const slideMag = Math.sqrt(
      this._vSlide.x * this._vSlide.x + this._vSlide.y * this._vSlide.y +
      this._vSlide.z * this._vSlide.z);
    if (slideMag > this.integrity.maxSlideSpeed) this.integrity.maxSlideSpeed = slideMag;


    // JUMP — along the surface normal; launch converts to inertial absolute.
    if (this.input.jump && !this.input.crouch) {
      const u = cfg.jumpSpeed;
      _vT.x = this._vCtl.x + this._vSlide.x + n.x * u;
      _vT.y = this._vCtl.y + this._vSlide.y + n.y * u;
      _vT.z = this._vCtl.z + this._vSlide.z + n.z * u;
      this._composeGrounded(this._vCtl.x, this._vCtl.y, this._vCtl.z,
        this._thetaPrev); // P only — F18: compose at tick-start spin
      // F18 (Lead ruling 2026-10-16): velocity rotation at θ_prev too —
      // composing at θ_new corresponded to no physical instant and
      // double-counted one tick of transport (the 0.87 m phantom).
      spinQuatInto(this._thetaPrev, _qSpin);
      rotateByQuatInto(_qSpin, _vT.x, _vT.y, _vT.z, _tmp);
      transportVelocityInto(cfg.spinOmega, this.absPos.x, this.absPos.y,
        this.absPos.z, _tmp2);
      this.absVel.x = _tmp2.x + _tmp.x;
      this.absVel.y = _tmp2.y + _tmp.y;
      this.absVel.z = _tmp2.z + _tmp.z;
      this._grounded = false;
      this._flightTick(dt, true);      // launch tick continues inertially
      return;
    }


    // ---- horizontal move with step / block / snap logic -------------------
    let dx = (this._vCtl.x + this._vSlide.x) * dt;
    let dy = (this._vCtl.y + this._vSlide.y) * dt;
    let dz = (this._vCtl.z + this._vSlide.z) * dt;
    let moved = false;
    let cliff = false;
    const arc = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (arc > 1e-9) {
      if (this._tryMove(dx, dy, dz, surfCur, r)) {
        moved = true;
      } else {
        // Blocked: wall-slide projection (one retry) using the target normal.
        this._wallDirFromTarget(dx, dy, dz);
        const dot = dx * _wall.x + dy * _wall.y + dz * _wall.z;
        if (dot < 0) {
          dx -= dot * _wall.x; dy -= dot * _wall.y; dz -= dot * _wall.z;
          if (this._tryMove(dx, dy, dz, surfCur, r)) moved = true;
        }
      }
      if (!moved) {
        // Fully blocked — but check whether the ORIGINAL move was a cliff
        // (downhill beyond snap): then it was already accepted inside _tryMove
        // via the cliff path (grounded=false). If still grounded here, hold.
        if (!this._grounded) cliff = true;
      }
    }


    if (this._grounded) {
      // Frame transport at the (possibly new) position.
      let r2 = Math.sqrt(this.pLocal.x * this.pLocal.x +
        this.pLocal.y * this.pLocal.y + this.pLocal.z * this.pLocal.z);
      if (r2 < 1) r2 = 1;
      const rdx = this.pLocal.x / r2, rdy = this.pLocal.y / r2, rdz = this.pLocal.z / r2;
      if (moved) {
        terrainNormalInto(rdx, rdy, rdz, _nNew);
        this._nCur.x = _nNew.x; this._nCur.y = _nNew.y; this._nCur.z = _nNew.z;
        this._hCur = terrainHeight(rdx, rdy, rdz);
      }
      this._refreshUpFwd(rdx, rdy, rdz);


      // Yaw input (finite rotation about up — never accumulated Euler).
      if (this.input.turnRate !== 0) {
        rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z,
          this.up.x, this.up.y, this.up.z, this.input.turnRate * dt, _fwdT);
        this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
      }
      // Auto-turn toward movement (third person). Reported for camera
      // orbit compensation (harness subtracts it from the camera offset).
      let turnApplied = 0;
      const ctlMag = Math.sqrt(this._vCtl.x * this._vCtl.x +
        this._vCtl.y * this._vCtl.y + this._vCtl.z * this._vCtl.z);
      if (this.autoTurnEnabled && ctlMag > 0.5) {
        const a = signedAngleAbout(this.fwd.x, this.fwd.y, this.fwd.z,
          this._vCtl.x / ctlMag, this._vCtl.y / ctlMag, this._vCtl.z / ctlMag,
          this.up.x, this.up.y, this.up.z);
        let step = a * (1 - Math.exp(-8 * dt));
        const maxStep = cfg.autoTurnRate * dt;
        if (step > maxStep) step = maxStep;
        else if (step < -maxStep) step = -maxStep;
        rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z,
          this.up.x, this.up.y, this.up.z, step, _fwdT);
        this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
        turnApplied = step;
      }
      this.telemetry.turnApplied = turnApplied;


      // Absolute compose: analytic transport + relative walk (Spec 01.4).
      this._composeGrounded(
        this._vCtl.x + this._vSlide.x,
        this._vCtl.y + this._vSlide.y,
        this._vCtl.z + this._vSlide.z);


      // RCS regen while planted.
      if (this._rcsBudget < cfg.rcsBudgetMax) {
        this._rcsBudget = Math.min(cfg.rcsBudgetMax,
          this._rcsBudget + cfg.rcsRegen * dt);
      }
    }
    void cliff;
  }


  /**
   * Attempt the tangent move (dx,dy,dz) from the current feet position.
   * Accepts climbs (step rule), snap-downs, and cliff transitions (sets
   * grounded=false and continues inertially). Returns true if the position
   * changed. Post-tick AGL >= 0 structurally: accepted positions anchor to
   * the probed surface.
   */
  private _tryMove(dx: number, dy: number, dz: number, surfCur: number, r: number): boolean {
    const cfg = this.cfg;
    _pTry.x = this.pLocal.x + dx;
    _pTry.y = this.pLocal.y + dy;
    _pTry.z = this.pLocal.z + dz;
    const l = Math.sqrt(_pTry.x * _pTry.x + _pTry.y * _pTry.y + _pTry.z * _pTry.z) || 1;
    _dTry.x = _pTry.x / l; _dTry.y = _pTry.y / l; _dTry.z = _pTry.z / l;
    const hT = terrainHeight(_dTry.x, _dTry.y, _dTry.z);
    const surfT = cfg.planetRadius + hT;
    const arc = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const dH = surfT - surfCur;
    if (dH <= 0.001) {
      if (-dH > cfg.snapDistance) {
        // Cliff: continue at the current radius, airborne from here.
        this.pLocal.x = _dTry.x * r;
        this.pLocal.y = _dTry.y * r;
        this.pLocal.z = _dTry.z * r;
        this._composeGrounded(
          this._vCtl.x + this._vSlide.x,
          this._vCtl.y + this._vSlide.y,
          this._vCtl.z + this._vSlide.z);
        this._grounded = false;
        return true;
      }
      // Snap-down / flat follow.
      const rr = surfT + cfg.groundClearance;
      this.pLocal.x = _dTry.x * rr;
      this.pLocal.y = _dTry.y * rr;
      this.pLocal.z = _dTry.z * rr;
      return true;
    }
    // Uphill: the derived dual step rule (absolute step AND slope ratio).
    const tanMax = Math.tan((cfg.maxWalkSlopeDeg * Math.PI) / 180);
    if (dH <= cfg.stepHeight && dH / arc <= tanMax) {
      const rr = surfT + cfg.groundClearance;
      this.pLocal.x = _dTry.x * rr;
      this.pLocal.y = _dTry.y * rr;
      this.pLocal.z = _dTry.z * rr;
      return true;
    }
    return false; // blocked
  }


  /** Wall direction from the TARGET normal's tangential component
   *  (points downhill = away from the steep face). Fallback: -moveDir. */
  private _wallDirFromTarget(dx: number, dy: number, dz: number): void {
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    _pTry.x = this.pLocal.x + dx;
    _pTry.y = this.pLocal.y + dy;
    _pTry.z = this.pLocal.z + dz;
    const ll = Math.sqrt(_pTry.x * _pTry.x + _pTry.y * _pTry.y + _pTry.z * _pTry.z) || 1;
    _dTry.x = _pTry.x / ll; _dTry.y = _pTry.y / ll; _dTry.z = _pTry.z / ll;
    terrainNormalInto(_dTry.x, _dTry.y, _dTry.z, _nNew);
    const d = _nNew.x * _dTry.x + _nNew.y * _dTry.y + _nNew.z * _dTry.z;
    let wx = _nNew.x - d * _dTry.x;
    let wy = _nNew.y - d * _dTry.y;
    let wz = _nNew.z - d * _dTry.z;
    const m = Math.sqrt(wx * wx + wy * wy + wz * wz);
    if (m < 1e-6) {
      _wall.x = -dx / l; _wall.y = -dy / l; _wall.z = -dz / l;
    } else {
      _wall.x = wx / m; _wall.y = wy / m; _wall.z = wz / m;
    }
  }


  /** Blend the cached normal with radial -> up; transport fwd. */
  private _refreshUpFwd(rx: number, ry: number, rz: number): void {
    const w = this.cfg.upBlendWeight;
    let ux = w * this._nCur.x + (1 - w) * rx;
    let uy = w * this._nCur.y + (1 - w) * ry;
    let uz = w * this._nCur.z + (1 - w) * rz;
    const m = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    ux /= m; uy /= m; uz /= m;
    this.up.x = ux; this.up.y = uy; this.up.z = uz;
    transportFrameInto(this.fwd.x, this.fwd.y, this.fwd.z, ux, uy, uz, _fwdT);
    this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
  }


  /** Grounded compose: P = R(θ)·pLocal; V = Ω×P + R(θ)·vRel.
   *  F18: optional explicit spin phase — the jump launch composes at
   *  θ_prev (tick start) so the sweep's θ_prev probes stay consistent. */
  private _composeGrounded(vx: number, vy: number, vz: number,
    theta: number = this._theta): void {
    spinQuatInto(theta, _qSpin);
    rotateByQuatInto(_qSpin, this.pLocal.x, this.pLocal.y, this.pLocal.z, _tmp);
    this.absPos.x = _tmp.x; this.absPos.y = _tmp.y; this.absPos.z = _tmp.z;
    rotateByQuatInto(_qSpin, vx, vy, vz, _tmp);
    transportVelocityInto(this.cfg.spinOmega, this.absPos.x, this.absPos.y,
      this.absPos.z, _tmp2);
    this.absVel.x = _tmp2.x + _tmp.x;
    this.absVel.y = _tmp2.y + _tmp.y;
    this.absVel.z = _tmp2.z + _tmp.z;
  }


  /* ---- airborne / zero-G: inertial integration ----------------------------- */


  private _flightTick(dt: number, launchTick = false): void {
    const cfg = this.cfg;
    const px = this.absPos.x, py = this.absPos.y, pz = this.absPos.z;


    // Central gravity (range-faded; ~0 in zero-G by construction).
    gravityInto(cfg.planetMu, cfg.gravityRange, px, py, pz, _g);
    this.absVel.x += _g.x * dt;
    this.absVel.y += _g.y * dt;
    this.absVel.z += _g.z * dt;


    // ZERO-G RCS pack (limited — Spec 00.4: zero-g recovery only).
    if (this._mode === 'ZERO-G' && this._rcsBudget > 0) {
      let ax = this.input.rcsF, ay = this.input.rcsU, az = this.input.rcsR;
      const al = Math.sqrt(ax * ax + ay * ay + az * az);
      if (al > 1) { ax /= al; ay /= al; az /= al; }
      if (al > 1e-6) {
        // Thrust along the character frame, rotated to world by the spin.
        _right.x = this.fwd.y * this.up.z - this.fwd.z * this.up.y;
        _right.y = this.fwd.z * this.up.x - this.fwd.x * this.up.z;
        _right.z = this.fwd.x * this.up.y - this.fwd.y * this.up.x;
        _vT.x = this.fwd.x * ax + this.up.x * ay + _right.x * az;
        _vT.y = this.fwd.y * ax + this.up.y * ay + _right.y * az;
        _vT.z = this.fwd.z * ax + this.up.z * ay + _right.z * az;
        spinQuatInto(this._theta, _qSpin);
        rotateByQuatInto(_qSpin, _vT.x, _vT.y, _vT.z, _tmp);
        const a = cfg.rcsAccel * dt;
        this.absVel.x += _tmp.x * a;
        this.absVel.y += _tmp.y * a;
        this.absVel.z += _tmp.z * a;
        this._rcsBudget = Math.max(0, this._rcsBudget - a * al);
      }
    }


    // Yaw (ZERO-G free attitude).
    if (this._mode === 'ZERO-G' && this.input.turnRate !== 0) {
      rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z,
        this.up.x, this.up.y, this.up.z, this.input.turnRate * dt, _fwdT);
      this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
    }


    // Frame: gentle re-alignment of up toward local radial (C0, no snaps).
    const r0 = Math.sqrt(px * px + py * py + pz * pz) || 1;
    const blend = 1 - Math.exp(-dt / cfg.airborneUpTau);
    let ux = this.up.x + (px / r0 - this.up.x) * blend;
    let uy = this.up.y + (py / r0 - this.up.y) * blend;
    let uz = this.up.z + (pz / r0 - this.up.z) * blend;
    const um = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1;
    this.up.x = ux / um; this.up.y = uy / um; this.up.z = uz / um;
    transportFrameInto(this.fwd.x, this.fwd.y, this.fwd.z,
      this.up.x, this.up.y, this.up.z, _fwdT);
    this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;


    // Inertial drift.
    const prevX = px, prevY = py, prevZ = pz;
    this.absPos.x += this.absVel.x * dt;
    this.absPos.y += this.absVel.y * dt;
    this.absPos.z += this.absVel.z * dt;


    // Terrain sweep (band-gated) + landing.
    this._sweep(prevX, prevY, prevZ, this.absPos.x, this.absPos.y,
      this.absPos.z, dt, launchTick);


    // Planet-frame mirror (face tracking / telemetry).
    spinQuatInto(this._theta, _qSpin);
    const r1 = Math.sqrt(this.absPos.x * this.absPos.x + this.absPos.y * this.absPos.y +
      this.absPos.z * this.absPos.z) || 1;
    rotateByQuatConjInto(_qSpin,
      this.absPos.x / r1, this.absPos.y / r1, this.absPos.z / r1, _dS);
    this.pLocal.x = _dS.x * r1; this.pLocal.y = _dS.y * r1; this.pLocal.z = _dS.z * r1;
  }


  /**
   * Gap-limited analytic sweep with SPIN-INTERPOLATED sample transforms:
   * the terrain occupies planet-frame directions; at sample fraction s the
   * planet has rotated to θ(s) = θ_prev + Ω·dt·s. Without the interpolation
   * the rotating ground is misplaced by up to r·Ω·dt = 0.87 m per tick at
   * the equator — with it the sweep is exact. Worker-independent by
   * construction (the same f64 field the workers mesh).
   */
  private _sweep(
    x0: number, y0: number, z0: number,
    x1: number, y1: number, z1: number,
    dt: number,
    launchTick = false,
  ): void {
    const cfg = this.cfg;
    const R = cfg.planetRadius;
    const band = R + cfg.maxTerrainHeight + cfg.sweepGap * 2;


    // Segment min-radius early-out.
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd < 1e-18) return;
    let t = -(x0 * dx + y0 * dy + z0 * dz) / dd;
    t = clamp(t, 0, 1);
    const cx = x0 + dx * t, cy = y0 + dy * t, cz = z0 + dz * t;
    if (Math.sqrt(cx * cx + cy * cy + cz * cz) > band) return;


    // Tick-start embed check (transient from a previous tick).
    // F18 (Lead ruling 2026-10-16): skipped on the launch tick — launch AGL
    // is EXACTLY groundClearance by construction, so `AGL < clearance`
    // would be decided by the compose/decompose round-trip error (~3e-14 m,
    // deterministic-but-unknown sign). The check exists for prior-tick
    // transients and is semantically inapplicable at launch. Mid-sweep
    // sampling is untouched (the launch segment ascends monotonically).
    const r0 = Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0);
    if (!launchTick && r0 < band) {
      spinQuatInto(this._thetaPrev, _qSpin);
      rotateByQuatConjInto(_qSpin, x0 / r0, y0 / r0, z0 / r0, _dS);
      if (r0 - (R + terrainHeight(_dS.x, _dS.y, _dS.z)) < cfg.groundClearance) {
        this._landAt(x0, y0, z0, this._thetaPrev);
        return;
      }
    }


    const seg = Math.sqrt(dd);
    const steps = Math.max(1, Math.ceil(seg / cfg.sweepGap));
    const dTheta = (this._theta - this._thetaPrev) / steps;
    let theta = this._thetaPrev + dTheta;
    for (let i = 1; i <= steps; i++) {
      const s = i / steps;
      const sx = x0 + dx * s, sy = y0 + dy * s, sz = z0 + dz * s;
      const r = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (r >= band) { theta += dTheta; continue; }
      spinQuatInto(theta, _qSpin);
      rotateByQuatConjInto(_qSpin, sx / r, sy / r, sz / r, _dS);
      const agl = r - (R + terrainHeight(_dS.x, _dS.y, _dS.z));
      if (agl < this.integrity.minAGL) this.integrity.minAGL = agl;
      if (agl < cfg.groundClearance) {
        // Sub-tick bisection with spin-interpolated θ.
        let lo = (i - 1) / steps, hi = s, thLo = theta - dTheta;
        for (let k = 0; k < 14; k++) {
          const m = 0.5 * (lo + hi);
          const mx = x0 + dx * m, my = y0 + dy * m, mz = z0 + dz * m;
          const mr = Math.sqrt(mx * mx + my * my + mz * mz);
          spinQuatInto(thLo + (theta - thLo) * ((m - lo) / (hi - lo || 1)), _qSpin);
          rotateByQuatConjInto(_qSpin, mx / mr, my / mr, mz / mr, _dS);
          const a2 = mr - (R + terrainHeight(_dS.x, _dS.y, _dS.z));
          if (a2 < cfg.groundClearance) hi = m; else lo = m;
        }
        const m = 0.5 * (lo + hi);
        this._landAt(x0 + dx * m, y0 + dy * m, z0 + dz * m,
          this._thetaPrev + cfg.spinOmega * dt * m);
        return;
      }
      theta += dTheta;
    }
  }


  /** Landing: decompose to relative, kill normal velocity, PLANT tangential
   *  (Spec M1E: "immediately settle into a 0 m/s relative walk state"). */
  private _landAt(px: number, py: number, pz: number, theta: number): void {
    const cfg = this.cfg;
    spinQuatInto(theta, _qSpin);
    const r = Math.sqrt(px * px + py * py + pz * pz) || 1;
    rotateByQuatConjInto(_qSpin, px / r, py / r, pz / r, _dS);
    const h = terrainHeight(_dS.x, _dS.y, _dS.z);
    const rr = cfg.planetRadius + h + cfg.groundClearance;
    this.pLocal.x = _dS.x * rr; this.pLocal.y = _dS.y * rr; this.pLocal.z = _dS.z * rr;
    this._hCur = h;
    terrainNormalInto(_dS.x, _dS.y, _dS.z, this._nCur);


    // Absolute state at the contact point.
    rotateByQuatInto(_qSpin, this.pLocal.x, this.pLocal.y, this.pLocal.z, _tmp);
    this.absPos.x = _tmp.x; this.absPos.y = _tmp.y; this.absPos.z = _tmp.z;


    // Relative velocity: v_rel = R⁻¹(V − Ω×P)  [the Coriolis handoff].
    transportVelocityInto(cfg.spinOmega, this.absPos.x, this.absPos.y,
      this.absPos.z, _tmp2);
    rotateByQuatConjInto(_qSpin,
      this.absVel.x - _tmp2.x, this.absVel.y - _tmp2.y, this.absVel.z - _tmp2.z, _rel);
    this.integrity.lastLandingRelSpeed = Math.sqrt(
      _rel.x * _rel.x + _rel.y * _rel.y + _rel.z * _rel.z);


    // Kill the normal component (no bounce), plant the tangential.
    const n = this._nCur;
    const vn = _rel.x * n.x + _rel.y * n.y + _rel.z * n.z;
    if (vn < 0) {
      _rel.x -= n.x * vn; _rel.y -= n.y * vn; _rel.z -= n.z * vn;
    }
    // PLANT: input takes over; no input -> 0 m/s relative (no skating).
    const speed = this.input.crouch ? cfg.crouchSpeed
      : this.input.sprint ? cfg.sprintSpeed : cfg.walkSpeed;
    let inF = this.input.moveF, inR = this.input.moveR;
    const inLen = Math.sqrt(inF * inF + inR * inR);
    if (inLen > 1) { inF /= inLen; inR /= inLen; }
    if (inLen > 0.01) {
      // Keep the landing tangential momentum only along the input intent.
      this._vCtl.x = this.fwd.x * inF * speed;
      this._vCtl.y = this.fwd.y * inF * speed;
      this._vCtl.z = this.fwd.z * inF * speed;
    } else {
      this._vCtl.x = 0; this._vCtl.y = 0; this._vCtl.z = 0;
    }
    this._vSlide.x = 0; this._vSlide.y = 0; this._vSlide.z = 0;
    this._grounded = true;
    this._mode = 'SURFACE';
    this.integrity.landings++;
    this._refreshUpFwd(_dS.x, _dS.y, _dS.z);
    this._composeGrounded(this._vCtl.x, this._vCtl.y, this._vCtl.z);
  }


  /* ---- vehicle: parented compose (Spec 01.1 step 3) ------------------------ */


  private _vehicleTick(_dt: number): void {
    const p = this._vehicle;
    if (p === null) { this._mode = 'SURFACE'; return; }
    rotateByQuatInto(p.quat, this._vehOffset.x, this._vehOffset.y, this._vehOffset.z, _tmp);
    this.absPos.x = p.pos.x + _tmp.x;
    this.absPos.y = p.pos.y + _tmp.y;
    this.absPos.z = p.pos.z + _tmp.z;
    rotateByQuatInto(p.quat, this._vehUp.x, this._vehUp.y, this._vehUp.z, _upT);
    this.up.x = _upT.x; this.up.y = _upT.y; this.up.z = _upT.z;
    rotateByQuatInto(p.quat, this._vehFwd.x, this._vehFwd.y, this._vehFwd.z, _fwdT);
    this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z;
    // V = parentVel + ω × (P − parentPos).
    const rx = this.absPos.x - p.pos.x;
    const ry = this.absPos.y - p.pos.y;
    const rz = this.absPos.z - p.pos.z;
    this.absVel.x = p.vel.x + (p.angVel.y * rz - p.angVel.z * ry);
    this.absVel.y = p.vel.y + (p.angVel.z * rx - p.angVel.x * rz);
    this.absVel.z = p.vel.z + (p.angVel.x * ry - p.angVel.y * rx);
    // Planet-frame mirror.
    spinQuatInto(this._theta, _qSpin);
    const r = Math.sqrt(this.absPos.x * this.absPos.x + this.absPos.y * this.absPos.y +
      this.absPos.z * this.absPos.z) || 1;
    rotateByQuatConjInto(_qSpin,
      this.absPos.x / r, this.absPos.y / r, this.absPos.z / r, _dS);
    this.pLocal.x = _dS.x * r; this.pLocal.y = _dS.y * r; this.pLocal.z = _dS.z * r;
  }


  /* ---- telemetry ------------------------------------------------------------ */


  private _fillTelemetry(): void {
    const cfg = this.cfg;
    const t = this.telemetry;
    const R = cfg.planetRadius;
    let r = Math.sqrt(this.pLocal.x * this.pLocal.x + this.pLocal.y * this.pLocal.y +
      this.pLocal.z * this.pLocal.z);
    if (r < 1) r = 1;
    const rx = this.pLocal.x / r, ry = this.pLocal.y / r, rz = this.pLocal.z / r;
    t.mode = this._mode;
    t.grounded = this._grounded;
    t.crouched = this.input.crouch;
    t.eyeHeight = this.input.crouch ? cfg.crouchEyeHeight : cfg.eyeHeight;
    if (this._grounded) {
      t.relSpeed = Math.sqrt(
        (this._vCtl.x + this._vSlide.x) ** 2 +
        (this._vCtl.y + this._vSlide.y) ** 2 +
        (this._vCtl.z + this._vSlide.z) ** 2);
      t.slideSpeed = Math.sqrt(
        this._vSlide.x ** 2 + this._vSlide.y ** 2 + this._vSlide.z ** 2);
    } else {
      transportVelocityInto(cfg.spinOmega, this.absPos.x, this.absPos.y,
        this.absPos.z, _tmp2);
      _rel.x = this.absVel.x - _tmp2.x;
      _rel.y = this.absVel.y - _tmp2.y;
      _rel.z = this.absVel.z - _tmp2.z;
      t.relSpeed = Math.sqrt(_rel.x ** 2 + _rel.y ** 2 + _rel.z ** 2);
      t.slideSpeed = 0;
    }
    t.transportSpeed = cfg.spinOmega *
      Math.sqrt(this.absPos.x ** 2 + this.absPos.z ** 2);
    t.absSpeed = Math.sqrt(this.absVel.x ** 2 + this.absVel.y ** 2 +
      this.absVel.z ** 2);
    t.altMSL = r - R;
    if (r < R + cfg.maxTerrainHeight + 64) {
      t.altAGL = r - (R + this._hCur) - cfg.groundClearance;
    } else {
      t.altAGL = t.altMSL - cfg.maxTerrainHeight;
    }
    const cosSlope = clamp(this._nCur.x * rx + this._nCur.y * ry +
      this._nCur.z * rz, -1, 1);
    t.slopeDeg = (Math.acos(cosSlope) * 180) / Math.PI;
    t.upX = this.up.x; t.upY = this.up.y; t.upZ = this.up.z;
    t.fwdX = this.fwd.x; t.fwdY = this.fwd.y; t.fwdZ = this.fwd.z;
    gravityInto(cfg.planetMu, cfg.gravityRange,
      this.absPos.x, this.absPos.y, this.absPos.z, _g);
    t.gravX = _g.x; t.gravY = _g.y; t.gravZ = _g.z;
    t.gravMag = Math.sqrt(_g.x ** 2 + _g.y ** 2 + _g.z ** 2);
    t.spinPhase = this._theta;
    t.dayFraction = (this._theta / (Math.PI * 2) + 1) % 1;
    t.rcsBudget = this._rcsBudget;
    t.currentFace = this._face;
  }
}


const _vehScratch: Vec3 = { x: 0, y: 0, z: 0 };
