// T1 third-person camera (plan §9.4, B7b): orbit (raw mouse), pitch clamp,
// zoom, spring arm (instant shrink, camBoomTau regrow), planet-frame pivot lag
// (camPosTau), first person (V) with enter/exit, reset. All math runs in the
// PLANET frame (§4.4, K1); the spin is composed once at extraction (playFrame).
// Stage 3 = preStep (input → heading/pitch/zoom/FP), stage 8 = poseInto(kcc, dt).
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import {
  quatFromFrameInto, rotateAboutAxisInto, rotateByQuatConjInto, signedAngleAbout,
  spinQuatInto, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { terrainHeight } from '../../core/terrain/terrainField';
import { MAX_TERRAIN_H, MOON_R, PLAY_TUNING } from '../world/moonConfig';

/** The InputState members the camera reads (stage 3). */
export interface CameraInput { lookDX: number; lookDY: number; zoomDelta: number; toggleCamEdge: boolean }
/** The controller flag the camera keeps in sync on FP enter/exit (§9.5 owner rule). */
export interface FirstPersonSink { firstPerson: boolean }

// WHY (B7b decision): a pivot jump larger than this in one frame is a teleport
// (respawn/spawn placement), not motion — snap the lag instead of easing 50 m.
const SNAP_M = 50;

const _qS: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _p: Vec3 = { x: 0, y: 0, z: 0 };
const _t: Vec3 = { x: 0, y: 0, z: 0 };

export class ThirdPersonCamera {
  /** Planet-frame unit tangent the camera looks along (§9.4 orbit). */
  readonly heading: Vec3 = { x: 1, y: 0, z: 0 };
  pitch: number = PLAY_TUNING.camPitchDefault;
  /** Desired (zoom) boom length, clamped to [camDistMin, camDistMax]. */
  dist: number = PLAY_TUNING.camDistance;
  /** Spring-arm boom length after the terrain cut, last poseInto. */
  boomLen: number = PLAY_TUNING.camDistance;
  firstPerson = false;
  /** Smoothed pivot − true pivot (planet frame, §9.4 follow smoothing). */
  readonly lag: Vec3 = { x: 0, y: 0, z: 0 };
  /** Outputs of poseInto (planet frame): camera − character feet, and the camera quat. */
  readonly offsetPlanet: Vec3 = { x: 0, y: 0, z: 0 };
  readonly quatPlanet: Quat = { x: 0, y: 0, z: 0, w: 1 };
  private readonly prevPivot: Vec3 = { x: 0, y: 0, z: 0 };
  private hasPrev = false;

  /** WHY: takes the look-toward direction (plan said `reset(kcc)`): the static
   *  pose faces the Earth tangent, and the Earth direction lives in the world.
   *  B7b decision: respawn always returns to third person (ctrl synced). */
  reset(kcc: AstronautKCC, toward: Vec3, ctrl?: FirstPersonSink): void {
    if (this.firstPerson) { this.firstPerson = false; kcc.autoTurnEnabled = true; }
    if (ctrl) ctrl.firstPerson = false;
    this.setHeadingFrom(kcc, toward);
    this.pitch = PLAY_TUNING.camPitchDefault;
    this.dist = PLAY_TUNING.camDistance;
    this.boomLen = this.dist;
    this.lag.x = 0; this.lag.y = 0; this.lag.z = 0;
    this.hasPrev = false;
  }

  /** Stage 3: parallel transport + orbit / pitch / zoom / V toggle. Consumes
   *  lookDY / zoomDelta always and lookDX in TP (in FP the controller reads
   *  lookDX at stage 4 as body yaw). Zero allocation. */
  preStep(kcc: AstronautKCC, inp: CameraInput, ctrl?: FirstPersonSink): void {
    const T = PLAY_TUNING, u = kcc.up, h = this.heading;
    this.transport(u);
    if (inp.toggleCamEdge) {
      if (!this.firstPerson) {
        // §9.4 enter: the body turns once to where the camera looked.
        kcc.lookYawDelta += signedAngleAbout(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z, h.x, h.y, h.z, u.x, u.y, u.z);
        kcc.autoTurnEnabled = false;
        this.firstPerson = true;
      } else {
        this.firstPerson = false;
        kcc.autoTurnEnabled = true;
        this.setHeadingFrom(kcc, kcc.fwd); // §9.4 exit: heading = fwd
        this.hasPrev = false;              // re-seat lag + boom (snap)
      }
      if (ctrl) ctrl.firstPerson = this.firstPerson;
    }
    if (!this.firstPerson && inp.lookDX !== 0) {
      // §9.4: a = −dx·sens about up; dx > 0 turns heading toward heading × up.
      rotateAboutAxisInto(h.x, h.y, h.z, u.x, u.y, u.z, -inp.lookDX * T.lookSens, _t);
      const l = Math.hypot(_t.x, _t.y, _t.z) || 1;
      h.x = _t.x / l; h.y = _t.y / l; h.z = _t.z / l;
      inp.lookDX = 0;
    }
    if (inp.lookDY !== 0) {
      const p = this.pitch + inp.lookDY * T.lookSens;
      this.pitch = p < T.camPitchMin ? T.camPitchMin : p > T.camPitchMax ? T.camPitchMax : p;
      inp.lookDY = 0;
    }
    if (inp.zoomDelta !== 0) {
      // WHY (B7b decision): multiplicative zoom (camZoomSens per wheel unit), so
      // one notch is the same feel at 1.2 m and at 12 m.
      const d = this.dist * Math.exp(inp.zoomDelta * T.camZoomSens);
      this.dist = d < T.camDistMin ? T.camDistMin : d > T.camDistMax ? T.camDistMax : d;
      inp.zoomDelta = 0;
    }
  }

  /** Stage 8 → offsetPlanet / quatPlanet. dt omitted = snap (no lag, boom at
   *  its target): the B4b static path. dt = 0 (frozen) leaves the pose as is
   *  when the character is still. Zero allocation. */
  poseInto(kcc: AstronautKCC, dt?: number): void {
    const T = PLAY_TUNING;
    spinQuatInto(kcc.spinPhase, _qS);
    rotateByQuatConjInto(_qS, kcc.absPos.x, kcc.absPos.y, kcc.absPos.z, _p); // inertial → planet
    const u = kcc.up, h = this.heading;
    if (this.firstPerson) {
      // §9.4 FP: heading tracks fwd once the enter yaw has been applied.
      if (kcc.lookYawDelta === 0) this.setHeadingFrom(kcc, kcc.fwd); else this.transport(u);
      const eh = kcc.telemetry.eyeHeight;
      const Ex = _p.x + u.x * eh, Ey = _p.y + u.y * eh, Ez = _p.z + u.z * eh;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      // pitch > 0 looks down (same sense as the TP orbit: mouse-down = look down)
      const fx = h.x * cp - u.x * sp, fy = h.y * cp - u.y * sp, fz = h.z * cp - u.z * sp;
      this.offsetPlanet.x = u.x * eh; this.offsetPlanet.y = u.y * eh; this.offsetPlanet.z = u.z * eh;
      lookAtQuatInto(Ex, Ey, Ez, Ex + fx, Ey + fy, Ez + fz, u.x, u.y, u.z, this.quatPlanet);
      this.hasPrev = false;
      return;
    }
    this.transport(u);
    const hx = h.x, hy = h.y, hz = h.z;
    const Px = _p.x + u.x * T.pivotHeight, Py = _p.y + u.y * T.pivotHeight, Pz = _p.z + u.z * T.pivotHeight;
    // §9.4 follow smoothing as a planet-frame LAG OFFSET (K4: no render-local cache).
    const L = this.lag, pv = this.prevPivot;
    const mx = Px - pv.x, my = Py - pv.y, mz = Pz - pv.z;
    const snap = dt === undefined || !this.hasPrev || mx * mx + my * my + mz * mz > SNAP_M * SNAP_M;
    if (snap) { L.x = 0; L.y = 0; L.z = 0; } else {
      const keep = dt > 0 ? Math.exp(-dt / T.camPosTau) : 1; // 1 − k
      L.x = keep * (L.x - mx); L.y = keep * (L.y - my); L.z = keep * (L.z - mz);
    }
    pv.x = Px; pv.y = Py; pv.z = Pz; this.hasPrev = true;
    const Sx = Px + L.x, Sy = Py + L.y, Sz = Pz + L.z;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const bx = -hx * cp + u.x * sp, by = -hy * cp + u.y * sp, bz = -hz * cp + u.z * sp;
    // harness 4-sample terrain cut (F6 pattern) along the DESIRED boom, planet frame
    let target = this.dist;
    for (let s = 1; s <= 4; s++) {
      const f = (s / 4) * this.dist;
      const qx = Sx + bx * f, qy = Sy + by * f, qz = Sz + bz * f;
      const rr = Math.hypot(qx, qy, qz);
      if (rr < MOON_R + MAX_TERRAIN_H + 80 &&
          rr - (MOON_R + terrainHeight(qx / rr, qy / rr, qz / rr)) < T.camClearance) {
        target = Math.min(target, f - T.camClearance); break;
      }
    }
    if (target < T.camDistMin) target = T.camDistMin;
    // §9.4 spring arm: shrink instantly (never clips), regrow with camBoomTau.
    if (snap || target <= this.boomLen) this.boomLen = target;
    else if (dt! > 0) this.boomLen += (target - this.boomLen) * (1 - Math.exp(-dt! / T.camBoomTau));
    const bl = this.boomLen;
    let Cx = Sx + bx * bl, Cy = Sy + by * bl, Cz = Sz + bz * bl;
    // camera height clamp: terrain(C) + clearance
    const cr = Math.hypot(Cx, Cy, Cz);
    const floor = MOON_R + terrainHeight(Cx / cr, Cy / cr, Cz / cr) + T.camClearance;
    if (cr < floor) { const k = floor / cr; Cx *= k; Cy *= k; Cz *= k; }
    this.offsetPlanet.x = Cx - _p.x; this.offsetPlanet.y = Cy - _p.y; this.offsetPlanet.z = Cz - _p.z;
    lookAtQuatInto(Cx, Cy, Cz, Sx, Sy, Sz, u.x, u.y, u.z, this.quatPlanet);
  }

  /** §4.2 parallel transport: re-project heading onto the current up plane. */
  private transport(u: Vec3): void {
    const h = this.heading, d = h.x * u.x + h.y * u.y + h.z * u.z;
    const hx = h.x - u.x * d, hy = h.y - u.y * d, hz = h.z - u.z * d;
    const l = Math.hypot(hx, hy, hz) || 1;
    h.x = hx / l; h.y = hy / l; h.z = hz / l;
  }

  private setHeadingFrom(kcc: AstronautKCC, v: Vec3): void {
    const u = kcc.up;
    let hx = v.x, hy = v.y, hz = v.z;
    const d = hx * u.x + hy * u.y + hz * u.z;
    hx -= u.x * d; hy -= u.y * d; hz -= u.z * d;
    let l = Math.hypot(hx, hy, hz);
    if (l < 1e-6) { hx = kcc.fwd.x; hy = kcc.fwd.y; hz = kcc.fwd.z; l = Math.hypot(hx, hy, hz) || 1; }
    this.heading.x = hx / l; this.heading.y = hy / l; this.heading.z = hz / l;
  }
}

// WHY: harness lookAtQuatInto (~775–789) verbatim (F27 camera basis).
export function lookAtQuatInto(
  ex: number, ey: number, ez: number, tx: number, ty: number, tz: number,
  ux: number, uy: number, uz: number, out: Quat,
): void {
  let fx = tx - ex, fy = ty - ey, fz = tz - ez;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const upx = ry * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - ry * fx;
  // three.js camera basis: X=right, Y=up, −Z=forward (F27)
  quatFromFrameInto(rx, ry, rz, upx, upy, upz, out);
}