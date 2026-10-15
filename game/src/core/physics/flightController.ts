/**
 * ============================================================================
 *  FLIGHT CONTROLLER — KINEMATIC SHIP DYNAMICS (FLOAT64, ZERO-GC)
 *  Milestone 1D · Spec 01.1 steps 5–7, 01.3 (kinematic flight + DDA),
 *  02.4 (drag map), 02.6 (fixed 1/60, <=5 substeps, shed-don't-dilate)
 * ============================================================================
 *  Pure core: no three/react/rapier imports.
 *
 *  THE TICK (integrateFlight, dt = 1/60 — Spec 02.6 fixed rate):
 *    A. Snapshot state (NaN guard) + tick-start velocity (integrity stats).
 *    B. Kinematics: r, altMSL, rho, v_atm = Ω×p, v_rel, q_dyn.
 *    C. ATTITUDE: rate command + EXACT exponential tracking (pole e^(−cΔt)
 *       ∈ (0,1) — no oscillatory mode at any q), quaternion integrate.
 *    D. DRAG (Spec 02.4, the law): k = betaQ·rho·|v_rel| + betaL·rho;
 *       v_rel *= exp(−k·dt); v = v_atm + v_rel.  [exact dissipative flow]
 *    E. KICK (semi-implicit Euler — symplectic on the conservative part):
 *       v += (thrust·capFade + lift + gravity)·dt.
 *       Thrust fades C¹ to zero on [capFadeStart, hardCap] — the 2,000 m/s
 *       absolute cap is a capability governor, never a velocity clamp.
 *    F. DRIFT: p += v·dt.
 *    G. DDA: analytic 2D face-lattice sweep p_prev -> p against the f64
 *       terrain field (worker-independent); bisection contact resolution.
 *    H. Telemetry, integrity stats, tick observer, NaN guard.
 *
 *  ENERGY (M1D analysis §1.4): drag flow monotone-dissipative; kick-drift
 *  symplectic (bounded O(dt²) oscillation, no secular drift); lift is
 *  perpendicular to v_rel (zero work by construction); thrust bounded.
 *
 *  ZERO-GC AUDIT: every vector/quaternion/segment value lives in
 *  module-level preallocated scratch; loops are index-based; the mode
 *  string field is assigned from interned literals. Allocation per tick: 0.
 *  (Module scratch is shared across instances — safe: integrateFlight is
 *  non-reentrant by construction, single-threaded, and observers only do
 *  scalar math.)
 */


import {
  EARTHSCALE_ATMOSPHERE, atmosphereVelocityInto, densityAt, dynamicPressure,
  machNumber, speedOfSoundAt, type AtmosphereProfile,
} from './atmosphere';
import {
  SHIP_AERO, controlDamping, dragDecel, exponentialDragFactor, liftAccel,
  liftCoefficient, safeSpeedAt, type AeroParams,
} from './aerodynamics';
import { terrainHeight } from '../terrain/terrainField';
import { sphereToCubeInto, type CubeCoord } from '../terrain/spherify';


export const FLIGHT_DT = 1 / 60;          // Spec 02.6 fixed logic tick
export const MAX_SUBSTEPS = 5;            // Spec 02.6 shed-don't-dilate
export const G0 = 9.81;


/* -- DDA sweep constants (see M1D analysis §1.5 for the no-clip proof) ---- */
const DDA_LATTICE = 2048;      // face cells per side (2.7–4.9 m arc)
const DDA_MAX_GAP = 4;         // max arc length between samples, m
const DDA_CLEARANCE = 3;       // contact stand-off, m
const DDA_LIPSCHITZ = 1.2;     // conservative terrain slope bound, m/m
const DDA_MAX_EVENTS = 96;
const DDA_BISECT = 20;
const DDA_BAND = 64;           // only evaluate terrain within this of max relief


export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }


export interface ShipInput {
  /** +1 = pull up (nose up). */
  pitch: number;
  /** +1 = roll right. */
  roll: number;
  /** +1 = yaw right. */
  yaw: number;
  /** [0, 1]. */
  throttle: number;
}


export type FlightMode = 'LANDED' | 'EXO-ATM' | 'HYPERSONIC' | 'SUPERSONIC' | 'SUBSONIC';


export interface FlightTelemetry {
  altMSL: number; altAGL: number; climbRate: number;
  rho: number; qDyn: number; pressure: number;
  mach: number; soundSpeed: number;
  airspeed: number; groundSpeed: number;
  dragDecel: number; dragForceN: number; liftAccel: number; thrustAccel: number;
  gLoad: number; peakG: number;
  vSafe: number; governorActive: boolean; inAtmosphere: boolean;
  grounded: boolean;
  mode: FlightMode;
}


export interface FlightIntegrity {
  ticks: number;
  /** Max |Δv| per AIRBORNE tick (contact ticks excluded — landing impacts are
   *  terrain resolution, not drag; the no-clamp assertion reads this). */
  maxDeltaVAirborne: number;
  /** Airborne ticks where velocity reversed direction (must be 0 — the
   *  exponential map cannot reverse). */
  reversals: number;
  minSampledAGL: number;
  minPostTickAGL: number;
  contacts: number;
  ddaSamples: number;
  nanEvents: number;
}


export interface FlightConfig {
  planetRadius: number;
  planetMu: number;
  /** Planet spin about +Y, rad/s (0 in the M1D harness: M1C terrain static). */
  planetSpin: number;
  /** Max terrain relief above the mean radius (DDA early-out band). */
  maxTerrainHeight: number;
  atmosphere: AtmosphereProfile;
  aero: AeroParams;
  maxThrustAccel: number;
  hardCapSpeed: number;
  capFadeStart: number;
  /** Unreachable-in-practice NaN-pathology guard (never a gameplay clamp). */
  safetyRescaleAbove: number;
  pitchRateMax: number;
  rollRateMax: number;
  yawRateMax: number;
}


/** Earth-scale flight dynamics over the M1C test planet. μ = 9.81·5000² (Spec 02.3). */
export const EARTHSCALE_FLIGHT: FlightConfig = {
  planetRadius: 5000,
  planetMu: 245_250_000,
  planetSpin: 0,
  maxTerrainHeight: 900,
  atmosphere: EARTHSCALE_ATMOSPHERE,
  aero: SHIP_AERO,
  maxThrustAccel: 45,
  hardCapSpeed: 2000,
  capFadeStart: 1880,
  safetyRescaleAbove: 2025,
  pitchRateMax: 0.9,
  rollRateMax: 1.8,
  yawRateMax: 0.5,
};


/* ===========================================================================
 * QUATERNION MATH (Float64, out-param style, zero allocation)
 * Body frame: +X forward, +Y up, +Z = X×Y (left) — right-handed.
 * ======================================================================== */


export function quatIntegrateInPlace(q: Quat, wx: number, wy: number, wz: number, dt: number): void {
  // q̇ = ½ · q ⊗ (0, ω)  (body-frame rates)
  const dw = -0.5 * dt * (q.x * wx + q.y * wy + q.z * wz);
  const dx = 0.5 * dt * (q.w * wx + q.y * wz - q.z * wy);
  const dy = 0.5 * dt * (q.w * wy + q.z * wx - q.x * wz);
  const dz = 0.5 * dt * (q.w * wz + q.x * wy - q.y * wx);
  q.x += dx; q.y += dy; q.z += dz; q.w += dw;
  const inv = 1 / Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  q.x *= inv; q.y *= inv; q.z *= inv; q.w *= inv;
}


/** Rotate body -> world: v' = q ⊗ v ⊗ q*. */
function rotBodyToWorldInto(q: Quat, vx: number, vy: number, vz: number, out: Vec3): Vec3 {
  const tx = 2 * (q.y * vz - q.z * vy);
  const ty = 2 * (q.z * vx - q.x * vz);
  const tz = 2 * (q.x * vy - q.y * vx);
  out.x = vx + q.w * tx + (q.y * tz - q.z * ty);
  out.y = vy + q.w * ty + (q.z * tx - q.x * tz);
  out.z = vz + q.w * tz + (q.x * ty - q.y * tx);
  return out;
}


/** Rotate world -> body (conjugate). */
function rotWorldToBodyInto(q: Quat, vx: number, vy: number, vz: number, out: Vec3): Vec3 {
  const qx = -q.x, qy = -q.y, qz = -q.z, qw = q.w;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out.x = vx + qw * tx + (qy * tz - qz * ty);
  out.y = vy + qw * ty + (qz * tx - qx * tz);
  out.z = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}


/** Quaternion from an orthonormal body basis (f = forward, u = up; z = f×u). */
export function quatFromBasisInto(
  fx: number, fy: number, fz: number,
  ux: number, uy: number, uz: number,
  out: Quat,
): Quat {
  const zx = fy * uz - fz * uy;
  const zy = fz * ux - fx * uz;
  const zz = fx * uy - fy * ux;
  const m00 = fx, m10 = fy, m20 = fz;   // column X = forward
  const m01 = ux, m11 = uy, m21 = uz;   // column Y = up
  const m02 = zx, m12 = zy, m22 = zz;   // column Z = f×u
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    out.w = 0.25 * s;
    out.x = (m21 - m12) / s;
    out.y = (m02 - m20) / s;
    out.z = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    out.w = (m21 - m12) / s;
    out.x = 0.25 * s;
    out.y = (m01 + m10) / s;
    out.z = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    out.w = (m02 - m20) / s;
    out.x = (m01 + m10) / s;
    out.y = 0.25 * s;
    out.z = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    out.w = (m10 - m01) / s;
    out.x = (m02 + m20) / s;
    out.y = (m12 + m21) / s;
    out.z = 0.25 * s;
  }
  return out;
}


/* ===========================================================================
 * MODULE SCRATCH — allocated once per thread, reused every tick.
 * ======================================================================== */
const _fwd: Vec3 = { x: 1, y: 0, z: 0 };
const _up: Vec3 = { x: 0, y: 1, z: 0 };
const _vAtm: Vec3 = { x: 0, y: 0, z: 0 };
const _vRel: Vec3 = { x: 0, y: 0, z: 0 };
const _vBody: Vec3 = { x: 0, y: 0, z: 0 };
const _liftDir: Vec3 = { x: 0, y: 0, z: 0 };
const _cc0: CubeCoord = { face: 0, u: 0, v: 0 };
const _cc1: CubeCoord = { face: 0, u: 0, v: 0 };
const _ccS: CubeCoord = { face: 0, u: 0, v: 0 };
// DDA segment state (set by _sweepTerrain before _resolveContact)
let segP0x = 0, segP0y = 0, segP0z = 0;
let segDx = 0, segDy = 0, segDz = 0, segLen = 1;


function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


/* ===========================================================================
 * FLIGHT CONTROLLER
 * ======================================================================== */


export class FlightController {
  // ---- flight state (owned; mutated only by this class) ------------------
  readonly pos: Vec3 = { x: 0, y: 0, z: 0 };
  readonly vel: Vec3 = { x: 0, y: 0, z: 0 };
  readonly quat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  /** Body-frame angular velocity: x = roll, y = yaw, z = pitch (rad/s). */
  readonly angVel: Vec3 = { x: 0, y: 0, z: 0 };
  readonly input: ShipInput = { pitch: 0, roll: 0, yaw: 0, throttle: 0 };
  readonly telemetry: FlightTelemetry = {
    altMSL: 0, altAGL: 0, climbRate: 0,
    rho: 0, qDyn: 0, pressure: 0,
    mach: 0, soundSpeed: 340, airspeed: 0, groundSpeed: 0,
    dragDecel: 0, dragForceN: 0, liftAccel: 0, thrustAccel: 0,
    gLoad: 0, peakG: 0, vSafe: Number.POSITIVE_INFINITY,
    governorActive: false, inAtmosphere: false, grounded: false,
    mode: 'SUBSONIC',
  };
  readonly integrity: FlightIntegrity = {
    ticks: 0, maxDeltaVAirborne: 0, reversals: 0,
    minSampledAGL: Number.POSITIVE_INFINITY, minPostTickAGL: Number.POSITIVE_INFINITY,
    contacts: 0, ddaSamples: 0, nanEvents: 0,
  };


  /**
   * Per-tick observer (harness trace capture). Assigned a MODULE FUNCTION
   * (never a closure) — called at the end of every integrateFlight with
   * valid, post-resolution state. Zero allocation.
   */
  tickObserver: ((c: FlightController) => void) | null = null;


  private readonly _cfg: FlightConfig;
  private readonly _prevPos: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly _snapPos: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly _snapVel: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly _snapQuat: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly _velStart: Vec3 = { x: 0, y: 0, z: 0 };
  // Optional write-through into an M1A EntityState (absPos / velocity).
  private _wtPos: Vec3 | null = null;
  private _wtVel: Vec3 | null = null;
  private _accumulator = 0;
  private _grounded = false;
  private _contactThisTick = false;


  constructor(cfg: FlightConfig) {
    this._cfg = cfg;
  }


  /** Bind the M1A entity storage for zero-copy write-through (setup path). */
  attachWriteThrough(absPos: Vec3, velocity: Vec3): void {
    this._wtPos = absPos;
    this._wtVel = velocity;
  }


  resetIntegrityStats(): void {
    this.integrity.ticks = 0;
    this.integrity.maxDeltaVAirborne = 0;
    this.integrity.reversals = 0;
    this.integrity.minSampledAGL = Number.POSITIVE_INFINITY;
    this.integrity.minPostTickAGL = Number.POSITIVE_INFINITY;
    this.integrity.contacts = 0;
    this.integrity.ddaSamples = 0;
    this.integrity.nanEvents = 0;
    this.telemetry.peakG = 0;
  }


  /** Scripted relocation (tests / respawn). Setup path. */
  teleport(
    px: number, py: number, pz: number,
    vx: number, vy: number, vz: number,
    q?: Quat,
  ): void {
    this.pos.x = px; this.pos.y = py; this.pos.z = pz;
    this.vel.x = vx; this.vel.y = vy; this.vel.z = vz;
    if (q !== undefined) {
      this.quat.x = q.x; this.quat.y = q.y; this.quat.z = q.z; this.quat.w = q.w;
    }
    this.angVel.x = 0; this.angVel.y = 0; this.angVel.z = 0;
    this._prevPos.x = px; this._prevPos.y = py; this._prevPos.z = pz;
    this._grounded = false;
  }


  /**
   * Fixed-step governor (Spec 02.6): accumulate wall time, run whole 1/60
   * ticks, cap substeps, SHED the backlog beyond — never dilate dt.
   */
  update(dtRealSeconds: number, maxSubsteps: number = MAX_SUBSTEPS): number {
    if (!Number.isFinite(dtRealSeconds) || dtRealSeconds <= 0) return 0;
    const dt = dtRealSeconds > 0.25 ? 0.25 : dtRealSeconds;
    this._accumulator += dt;
    let n = 0;
    while (this._accumulator >= FLIGHT_DT && n < maxSubsteps) {
      this.integrateFlight(FLIGHT_DT);
      this._accumulator -= FLIGHT_DT;
      n++;
    }
    if (this._accumulator >= FLIGHT_DT) this._accumulator = 0; // shed
    if (this._wtPos !== null) {
      this._wtPos.x = this.pos.x; this._wtPos.y = this.pos.y; this._wtPos.z = this.pos.z;
      this._wtVel.x = this.vel.x; this._wtVel.y = this.vel.y; this._wtVel.z = this.vel.z;
    }
    return n;
  }


  /* =======================================================================
   * THE FIXED TICK — dt = 1/60 s, allocation-free.
   * ===================================================================== */
  integrateFlight(dt: number): void {
    const cfg = this._cfg;
    const atm = cfg.atmosphere;
    const aero = cfg.aero;
    const R = cfg.planetRadius;


    // -- A. snapshots ------------------------------------------------------
    this._snapPos.x = this.pos.x; this._snapPos.y = this.pos.y; this._snapPos.z = this.pos.z;
    this._snapVel.x = this.vel.x; this._snapVel.y = this.vel.y; this._snapVel.z = this.vel.z;
    this._snapQuat.x = this.quat.x; this._snapQuat.y = this.quat.y;
    this._snapQuat.z = this.quat.z; this._snapQuat.w = this.quat.w;
    this._velStart.x = this.vel.x; this._velStart.y = this.vel.y; this._velStart.z = this.vel.z;
    this._contactThisTick = false;


    // -- B. kinematics ------------------------------------------------------
    let r = Math.sqrt(this.pos.x * this.pos.x + this.pos.y * this.pos.y + this.pos.z * this.pos.z);
    if (r < 1) r = 1; // degenerate guard
    const invR = 1 / r;
    const altMSL = r - R;
    const rho = densityAt(atm, altMSL);
    atmosphereVelocityInto(cfg.planetSpin, this.pos.x, this.pos.y, this.pos.z, _vAtm);
    _vRel.x = this.vel.x - _vAtm.x;
    _vRel.y = this.vel.y - _vAtm.y;
    _vRel.z = this.vel.z - _vAtm.z;
    let speedRel = Math.sqrt(_vRel.x * _vRel.x + _vRel.y * _vRel.y + _vRel.z * _vRel.z);
    const qDyn = 0.5 * rho * speedRel * speedRel;


    // -- C. ATTITUDE: rate command + exact exponential tracking ------------
    // Mapping (signs derived in M1D analysis §1.3):
    //   ω_x = −roll·rollMax (roll right), ω_y = +yaw·yawMax (nose right),
    //   ω_z = +pitch·pitchMax (nose up, rotation about body-left).
    const c = controlDamping(aero, qDyn);
    const decay = Math.exp(-c * dt);
    const inPitch = clamp(this.input.pitch, -1, 1);
    const inRoll = clamp(this.input.roll, -1, 1);
    const inYaw = clamp(this.input.yaw, -1, 1);
    const wx = -inRoll * cfg.rollRateMax;
    const wy = inYaw * cfg.yawRateMax;
    const wz = inPitch * cfg.pitchRateMax;
    this.angVel.x = wx + (this.angVel.x - wx) * decay;
    this.angVel.y = wy + (this.angVel.y - wy) * decay;
    this.angVel.z = wz + (this.angVel.z - wz) * decay;
    quatIntegrateInPlace(this.quat, this.angVel.x, this.angVel.y, this.angVel.z, dt);


    // -- D. DRAG: the exact exponential map (Spec 02.4) ---------------------
    let aDragMag = 0;
    if (rho > 0 && speedRel > 1e-9) {
      aDragMag = dragDecel(aero, rho, speedRel);   // per-second magnitude (G telemetry)
      const f = exponentialDragFactor(aero, rho, speedRel, dt);
      _vRel.x *= f; _vRel.y *= f; _vRel.z *= f;
      speedRel *= f;
      this.vel.x = _vAtm.x + _vRel.x;
      this.vel.y = _vAtm.y + _vRel.y;
      this.vel.z = _vAtm.z + _vRel.z;
    }


    // -- E. KICK (semi-implicit Euler): thrust + lift + gravity -------------
    rotBodyToWorldInto(this.quat, 1, 0, 0, _fwd);
    rotBodyToWorldInto(this.quat, 0, 1, 0, _up);
    let ax = 0, ay = 0, az = 0;               // control/conservative accel
    let sx = 0, sy = 0, sz = 0;               // sensed (non-gravitational) accel


    // Thrust with the C¹ hard-cap fade (capability governor, not a clamp).
    const speedAbs = Math.sqrt(
      this.vel.x * this.vel.x + this.vel.y * this.vel.y + this.vel.z * this.vel.z);
    const thr = this.input.throttle < 0 ? 0 : this.input.throttle > 1 ? 1 : this.input.throttle;
    let fade = 1;
    if (speedAbs > cfg.capFadeStart) {
      const t = clamp((speedAbs - cfg.capFadeStart) / (cfg.hardCapSpeed - cfg.capFadeStart), 0, 1);
      fade = 1 - t * t * (3 - 2 * t);
    }
    const thrustA = cfg.maxThrustAccel * thr * fade;
    if (thrustA > 0) {
      ax += _fwd.x * thrustA; ay += _fwd.y * thrustA; az += _fwd.z * thrustA;
      sx += _fwd.x * thrustA; sy += _fwd.y * thrustA; sz += _fwd.z * thrustA;
    }


    // Lift (work-free by construction — M1D analysis §1.2).
    let liftA = 0;
    if (rho > 0 && speedRel > 15) {
      rotWorldToBodyInto(this.quat, _vRel.x, _vRel.y, _vRel.z, _vBody);
      const invS = 1 / speedRel;
      const a = -Math.asin(clamp(_vBody.y * invS, -1, 1));   // AoA
      const cl = liftCoefficient(aero, a);
      if (cl !== 0) {
        liftA = liftAccel(aero, rho, speedRel, cl);
        const vhx = _vRel.x * invS, vhy = _vRel.y * invS, vhz = _vRel.z * invS;
        const dproj = _up.x * vhx + _up.y * vhy + _up.z * vhz;
        let nx = _up.x - dproj * vhx;
        let ny = _up.y - dproj * vhy;
        let nz = _up.z - dproj * vhz;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (nl > 1e-6) {
          nx /= nl; ny /= nl; nz /= nl;
          ax += nx * liftA; ay += ny * liftA; az += nz * liftA;
          sx += nx * liftA; sy += ny * liftA; sz += nz * liftA;
        } else {
          liftA = 0;
        }
      }
    }


    // Gravity (conservative; excluded from sensed G — astronaut convention).
    const g = -cfg.planetMu / (r * r);
    ax += this.pos.x * invR * g;
    ay += this.pos.y * invR * g;
    az += this.pos.z * invR * g;


    this.vel.x += ax * dt; this.vel.y += ay * dt; this.vel.z += az * dt;


    // -- F. DRIFT ------------------------------------------------------------
    this._prevPos.x = this.pos.x; this._prevPos.y = this.pos.y; this._prevPos.z = this.pos.z;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.pos.z += this.vel.z * dt;


    // -- G. DDA sweep & contact resolution -----------------------------------
    this._grounded = false;
    this._sweepTerrain(R, cfg);


    // Unreachable NaN-pathology guard only (thrust fade enforces the real cap).
    const v2 = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y + this.vel.z * this.vel.z);
    if (v2 > cfg.safetyRescaleAbove) {
      const s = cfg.hardCapSpeed / v2;
      this.vel.x *= s; this.vel.y *= s; this.vel.z *= s;
    }


    // -- H. telemetry, integrity, observer, NaN guard -------------------------
    const t = this.telemetry;
    r = Math.sqrt(this.pos.x * this.pos.x + this.pos.y * this.pos.y + this.pos.z * this.pos.z);
    const invR2 = 1 / (r > 1 ? r : 1);
    const alt2 = r - R;
    const rho2 = densityAt(atm, alt2);
    let agl: number;
    if (r < R + cfg.maxTerrainHeight + DDA_BAND) {
      const h = terrainHeight(this.pos.x * invR2, this.pos.y * invR2, this.pos.z * invR2);
      agl = r - (R + h);
      this.integrity.ddaSamples++;
    } else {
      agl = alt2 - cfg.maxTerrainHeight; // conservative lower bound
    }
    if (agl < this.integrity.minPostTickAGL) this.integrity.minPostTickAGL = agl;
    atmosphereVelocityInto(cfg.planetSpin, this.pos.x, this.pos.y, this.pos.z, _vAtm);
    const rx = this.vel.x - _vAtm.x, ry = this.vel.y - _vAtm.y, rz = this.vel.z - _vAtm.z;
    const air = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const gs = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y + this.vel.z * this.vel.z);
    t.altMSL = alt2;
    t.altAGL = agl;
    t.climbRate = this.vel.x * this.pos.x * invR2 + this.vel.y * this.pos.y * invR2 + this.vel.z * this.pos.z * invR2;
    t.rho = rho2;
    t.qDyn = 0.5 * rho2 * air * air;
    t.pressure = rho2 * atm.rSpecific * (atm.tempSeaLevel - atm.lapseRate * (alt2 > 0 ? alt2 : 0));
    t.soundSpeed = speedOfSoundAt(atm, alt2);
    t.mach = machNumber(atm, alt2, air);
    t.airspeed = air;
    t.groundSpeed = gs;
    t.dragDecel = aDragMag;
    t.dragForceN = aDragMag * aero.mass;
    t.liftAccel = liftA;
    t.thrustAccel = thrustA;
    const sensed = Math.sqrt(sx * sx + sy * sy + sz * sz);
    t.gLoad = sensed / G0;
    if (t.gLoad > t.peakG) t.peakG = t.gLoad;
    t.vSafe = safeSpeedAt(aero, rho2);
    t.governorActive = rho2 > 0 && air > t.vSafe;
    t.inAtmosphere = alt2 < atm.atmosphereHeight;
    t.grounded = this._grounded;
    t.mode = this._grounded ? 'LANDED'
      : alt2 >= atm.atmosphereHeight ? 'EXO-ATM'
      : t.mach >= 5 ? 'HYPERSONIC'
      : t.mach >= 1 ? 'SUPERSONIC'
      : 'SUBSONIC';


    // Integrity: airborne Δv / reversal (contact ticks excluded — landing
    // impacts are terrain resolution, not aerodynamic clamping).
    const dvx = this.vel.x - this._velStart.x;
    const dvy = this.vel.y - this._velStart.y;
    const dvz = this.vel.z - this._velStart.z;
    if (!this._contactThisTick) {
      const dv = Math.sqrt(dvx * dvx + dvy * dvy + dvz * dvz);
      if (dv > this.integrity.maxDeltaVAirborne) this.integrity.maxDeltaVAirborne = dv;
      if (this._velStart.x * this.vel.x + this._velStart.y * this.vel.y + this._velStart.z * this.vel.z < -1e-9) {
        this.integrity.reversals++;
      }
    }
    this.integrity.ticks++;


    this.tickObserver?.(this);


    // NaN guard (Spec 00.2): restore the last good snapshot, count, freeze.
    if (
      !Number.isFinite(this.pos.x) || !Number.isFinite(this.pos.y) || !Number.isFinite(this.pos.z) ||
      !Number.isFinite(this.vel.x) || !Number.isFinite(this.vel.y) || !Number.isFinite(this.vel.z) ||
      !Number.isFinite(this.quat.w)
    ) {
      this.pos.x = this._snapPos.x; this.pos.y = this._snapPos.y; this.pos.z = this._snapPos.z;
      this.vel.x = this._snapVel.x; this.vel.y = this._snapVel.y; this.vel.z = this._snapVel.z;
      this.quat.x = this._snapQuat.x; this.quat.y = this._snapQuat.y;
      this.quat.z = this._snapQuat.z; this.quat.w = this._snapQuat.w;
      this.integrity.nanEvents++;
    }
  }


  /* =======================================================================
   * ANALYTIC 2D DDA TERRAIN SWEEP (Spec 01.3 — worker-independent)
   *
   * Marches the tick's path across the face-plane lattice (2,048 cells per
   * cube side) using per-axis next-boundary stepping (Amanatides–Woo,
   * recomputed per sample so sphere-path curvature is handled exactly),
   * capped at a 4 m max gap. Every sample evaluates the SAME f64 noise
   * field the workers render — collision is exact regardless of chunk
   * streaming state. No-clip bound: gap·(Lipschitz+1) − clearance < 6 m of
   * transient mid-gap penetration, ALWAYS detected at the next sample;
   * every tick ENDS at or above the surface.
   * ===================================================================== */
  private _sweepTerrain(R: number, cfg: FlightConfig): void {
    const p0 = this._prevPos, p1 = this.pos;
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const seg = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (seg < 1e-9) return;


    // Early-out: the whole segment is outside the terrain shell.
    {
      const dd = dx * dx + dy * dy + dz * dz;
      let tt = -(p0.x * dx + p0.y * dy + p0.z * dz) / dd;
      tt = clamp(tt, 0, 1);
      const cx = p0.x + dx * tt, cy = p0.y + dy * tt, cz = p0.z + dz * tt;
      const rMin = Math.sqrt(cx * cx + cy * cy + cz * cz);
      if (rMin > R + cfg.maxTerrainHeight + DDA_CLEARANCE + DDA_LIPSCHITZ * DDA_MAX_GAP) return;
    }


    segP0x = p0.x; segP0y = p0.y; segP0z = p0.z;
    segDx = dx; segDy = dy; segDz = dz; segLen = seg;


    const r0 = Math.sqrt(p0.x * p0.x + p0.y * p0.y + p0.z * p0.z);
    const r1 = Math.sqrt(p1.x * p1.x + p1.y * p1.y + p1.z * p1.z);
    sphereToCubeInto(p0.x / r0, p0.y / r0, p0.z / r0, _cc0);
    sphereToCubeInto(p1.x / r1, p1.y / r1, p1.z / r1, _cc1);
    const sameFace = _cc0.face === _cc1.face;
    const duDs = sameFace ? (_cc1.u - _cc0.u) / seg : 0;
    const dvDs = sameFace ? (_cc1.v - _cc0.v) / seg : 0;
    const cell = 2 / DDA_LATTICE;


    let s = 0;
    let sPrev = 0;
    let events = 0;
    // sample s = 0
    if (this._sampleAt(0, R, cfg)) return;
    while (s < seg - 1e-6 && events++ < DDA_MAX_EVENTS) {
      let step = DDA_MAX_GAP;
      if (sameFace) {
        // Current (u, v) — recomputed per sample (exact under curvature).
        const t = s / seg;
        const px = segP0x + segDx * t, py = segP0y + segDy * t, pz = segP0z + segDz * t;
        const rr = Math.sqrt(px * px + py * py + pz * pz);
        if (rr < R + cfg.maxTerrainHeight + DDA_BAND) {
          sphereToCubeInto(px / rr, py / rr, pz / rr, _ccS);
          const iu = Math.floor((_ccS.u + 1) / cell);
          const iv = Math.floor((_ccS.v + 1) / cell);
          if (duDs > 1e-12) {
            const ub = -1 + (iu + 1) * cell;
            step = Math.min(step, (ub - _ccS.u) / duDs);
          } else if (duDs < -1e-12) {
            const ub = -1 + iu * cell;
            step = Math.min(step, (_ccS.u - ub) / -duDs);
          }
          if (dvDs > 1e-12) {
            const vb = -1 + (iv + 1) * cell;
            step = Math.min(step, (vb - _ccS.v) / dvDs);
          } else if (dvDs < -1e-12) {
            const vb = -1 + iv * cell;
            step = Math.min(step, (_ccS.v - vb) / -dvDs);
          }
        }
      }
      if (step < 0.01) step = 0.01;
      let sNext = s + step;
      if (sNext >= seg - 1e-6) sNext = seg;
      if (this._sampleAt(sNext, R, cfg)) return;
      sPrev = sNext;
      s = sNext;
    }
    // Exact endpoint sample if the loop overshoot past it.
    if (s < seg - 1e-6) {
      void sPrev;
      if (this._sampleAt(seg, R, cfg)) return;
    }
  }


  /** Sample the path at arc parameter s. Returns true if a contact was
   *  detected and resolved (sweep terminates). */
  private _sampleAt(s: number, R: number, cfg: FlightConfig): boolean {
    const t = s / segLen;
    const px = segP0x + segDx * t, py = segP0y + segDy * t, pz = segP0z + segDz * t;
    const r = Math.sqrt(px * px + py * py + pz * pz);
    if (r >= R + cfg.maxTerrainHeight + DDA_BAND) return false;
    const inv = 1 / r;
    const h = terrainHeight(px * inv, py * inv, pz * inv);
    const agl = r - (R + h);
    this.integrity.ddaSamples++;
    if (agl < this.integrity.minSampledAGL) this.integrity.minSampledAGL = agl;
    if (agl < DDA_CLEARANCE) {
      this._resolveContact(s, R, cfg);
      return true;
    }
    return false;
  }


  /** Bisection contact resolution: place at surface + clearance, kill the
   *  inward radial velocity, damp tangential, settle to LANDED when slow. */
  private _resolveContact(sUnsafe: number, R: number, cfg: FlightConfig): void {
    let lo = Math.max(0, sUnsafe - DDA_MAX_GAP * 1.5);
    let hi = sUnsafe;
    for (let k = 0; k < DDA_BISECT; k++) {
      const sm = 0.5 * (lo + hi);
      const t = sm / segLen;
      const px = segP0x + segDx * t, py = segP0y + segDy * t, pz = segP0z + segDz * t;
      const r = Math.sqrt(px * px + py * py + pz * pz);
      const inv = 1 / (r > 1 ? r : 1);
      const h = terrainHeight(px * inv, py * inv, pz * inv);
      if (r - (R + h) < DDA_CLEARANCE) hi = sm; else lo = sm;
    }
    const t = hi / segLen;
    let px = segP0x + segDx * t, py = segP0y + segDy * t, pz = segP0z + segDz * t;
    let r = Math.sqrt(px * px + py * py + pz * pz);
    if (r < 1) r = 1;
    const inv = 1 / r;
    const ddx = px * inv, ddy = py * inv, ddz = pz * inv;
    const h = terrainHeight(ddx, ddy, ddz);
    const rr = R + h + DDA_CLEARANCE;
    this.pos.x = ddx * rr; this.pos.y = ddy * rr; this.pos.z = ddz * rr;


    // Velocity resolve against the (conservative) radial contact normal.
    const vn = this.vel.x * ddx + this.vel.y * ddy + this.vel.z * ddz;
    if (vn < 0) {
      this.vel.x -= ddx * vn; this.vel.y -= ddy * vn; this.vel.z -= ddz * vn;
    }
    this.vel.x *= 0.985; this.vel.y *= 0.985; this.vel.z *= 0.985;


    atmosphereVelocityInto(cfg.planetSpin, this.pos.x, this.pos.y, this.pos.z, _vAtm);
    const rx = this.vel.x - _vAtm.x, ry = this.vel.y - _vAtm.y, rz = this.vel.z - _vAtm.z;
    if (rx * rx + ry * ry + rz * rz < 3.5 * 3.5) {
      this.vel.x = _vAtm.x; this.vel.y = _vAtm.y; this.vel.z = _vAtm.z;
      this._grounded = true;
    }
    this._contactThisTick = true;
    this.integrity.contacts++;
  }
}
