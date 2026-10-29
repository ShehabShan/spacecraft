// T1 third-person camera (plan §9.4, B7b): orbit (raw mouse), pitch clamp,
// zoom, spring arm (instant shrink, camBoomTau regrow), planet-frame pivot lag
// (camPosTau), first person (V) with enter/exit, reset. All math runs in the
// PLANET frame (§4.4, K1); the spin is composed once at extraction (playFrame).
// Stage 3 = preStep (input → heading/pitch/zoom/FP), stage 8 = poseInto(kcc, dt).
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import {
  hypot3, rotateAboutAxisInto, signedAngleAbout, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { activeTerrainField } from '../../core/terrain/terrainField';
import { MAX_TERRAIN_H, MOON_R, PLAY_TUNING } from '../world/moonConfig';
import { Vec3d, Quatd } from '../../core/physics/sphericalFrame'; // WHY (T5 S1bbbb): class-backed scratch, see Vec3d
import { DtCell, type DtSource } from '../../core/simulation/dtSource';

/** The InputState members the camera reads (stage 3). */
export interface CameraInput { lookDX: number; lookDY: number; zoomDelta: number; toggleCamEdge: boolean }
/** The controller flag the camera keeps in sync on FP enter/exit (§9.5 owner rule). */
export interface FirstPersonSink { firstPerson: boolean }

// WHY (B7b decision): a pivot jump larger than this in one frame is a teleport
// (respawn/spawn placement), not motion — snap the lag instead of easing 50 m.
const SNAP_M = 50;

const _t: Vec3 = new Vec3d(0, 0, 0);
// WHY (T5 S1bbb, F5a): lookAt inputs [eye, target, up] go through Float64Array slots;
// every double argument of a non-inlined call boxes a HeapNumber per frame.
const _la = new Float64Array(9);

export class ThirdPersonCamera {
  /** Planet-frame unit tangent the camera looks along (§9.4 orbit). */
  readonly heading: Vec3 = new Vec3d(1, 0, 0);
  pitch: number = PLAY_TUNING.camPitchDefault;
  /** Desired (zoom) boom length, clamped to [camDistMin, camDistMax]. */
  dist: number = PLAY_TUNING.camDistance;
  /** Spring-arm boom length after the terrain cut, last poseInto. */
  boomLen: number = PLAY_TUNING.camDistance;
  firstPerson = false;
  /** Smoothed pivot − true pivot (planet frame, §9.4 follow smoothing). */
  readonly lag: Vec3 = new Vec3d(0, 0, 0);
  /** Outputs of poseInto (planet frame): camera − character feet, and the camera quat. */
  readonly offsetPlanet: Vec3 = new Vec3d(0, 0, 0);
  readonly quatPlanet: Quat = new Quatd(0, 0, 0, 1);
  private readonly prevPivot: Vec3 = new Vec3d(0, 0, 0);
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

  /** WHY (ADR-017, Lead 2026-10-27): the spawn view must put `target` (the
   *  Earth) near the view axis. reset() keeps the harness 0.35 rad look-down,
   *  which left the Earth 31.9° off axis; here the pitch is chosen so the
   *  target sits camSpawnAimAbove above the axis. Zero allocation (respawn). */
  frameToward(kcc: AstronautKCC, target: Vec3, targetDist: number, ctrl?: FirstPersonSink): void {
    this.reset(kcc, target, ctrl);
    const T = PLAY_TUNING, u = kcc.up, p = kcc.pLocal;
    // WHY: target is a planet-centre direction; seen from the surface the Earth
    // sits ~2.3° lower (parallax R/D at 1,365 m / 33 km), so aim at the
    // topocentric vector target·dist − pLocal (planet frame, scalars only).
    const tx = target.x * targetDist - p.x, ty = target.y * targetDist - p.y, tz = target.z * targetDist - p.z;
    const l = hypot3(tx, ty, tz) || 1;
    const s = (tx * u.x + ty * u.y + tz * u.z) / l;
    const elev = Math.asin(s < -1 ? -1 : s > 1 ? 1 : s);
    // view elevation = −pitch, so target − axis = elev + pitch.
    const pt = T.camSpawnAimAbove - elev;
    this.pitch = pt < T.camPitchMin ? T.camPitchMin : pt > T.camPitchMax ? T.camPitchMax : pt;
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
      const l = hypot3(_t.x, _t.y, _t.z) || 1;
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
    if (dt === undefined) { this.poseFrom(kcc, null); return; }
    const c = this._dtCell; c.dt = dt; this.poseFrom(kcc, c);
  }

  private readonly _dtCell = new DtCell();

  /** poseInto() reading dt from `src` once; `null` = snap (poseInto without dt).
   *  WHY (T5 S1bbbbbbb, F5a): playFrame passes its PlayClock, so no double
   *  argument crosses this non-inlined call (it would box per frame). */
  poseFrom(kcc: AstronautKCC, src: DtSource | null): void {
    const dt = src === null ? 0 : src.dt;
    const T = PLAY_TUNING, tf = activeTerrainField(), tio = tf.io, la = _la;
    // inertial → planet: spinQuatInto + rotateByQuatConjInto inlined in the same
    // expression order (T5 S1bbb, F5a: no boxed double args; bit-identical).
    const th = kcc.spinPhase, a = kcc.absPos;
    const nqx = -0, nqy = -Math.sin(th * 0.5), nqz = -0, nqw = Math.cos(th * 0.5);
    const vx = a.x, vy = a.y, vz = a.z;
    const rtx = 2 * (nqy * vz - nqz * vy);
    const rty = 2 * (nqz * vx - nqx * vz);
    const rtz = 2 * (nqx * vy - nqy * vx);
    const px = vx + nqw * rtx + (nqy * rtz - nqz * rty);
    const py = vy + nqw * rty + (nqz * rtx - nqx * rtz);
    const pz = vz + nqw * rtz + (nqx * rty - nqy * rtx);
    const u = kcc.up, h = this.heading;
    if (this.firstPerson) {
      // §9.4 FP: heading tracks fwd once the enter yaw has been applied.
      if (kcc.lookYawDelta === 0) this.setHeadingFrom(kcc, kcc.fwd); else this.transport(u);
      const eh = kcc.telemetry.eyeHeight;
      const Ex = px + u.x * eh, Ey = py + u.y * eh, Ez = pz + u.z * eh;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      // pitch > 0 looks down (same sense as the TP orbit: mouse-down = look down)
      const fx = h.x * cp - u.x * sp, fy = h.y * cp - u.y * sp, fz = h.z * cp - u.z * sp;
      this.offsetPlanet.x = u.x * eh; this.offsetPlanet.y = u.y * eh; this.offsetPlanet.z = u.z * eh;
      la[0] = Ex; la[1] = Ey; la[2] = Ez; la[3] = Ex + fx; la[4] = Ey + fy; la[5] = Ez + fz;
      la[6] = u.x; la[7] = u.y; la[8] = u.z;
      lookAtQuatIo(la, this.quatPlanet);
      this.hasPrev = false;
      return;
    }
    this.transport(u);
    const hx = h.x, hy = h.y, hz = h.z;
    const Px = px + u.x * T.pivotHeight, Py = py + u.y * T.pivotHeight, Pz = pz + u.z * T.pivotHeight;
    // §9.4 follow smoothing as a planet-frame LAG OFFSET (K4: no render-local cache).
    const L = this.lag, pv = this.prevPivot;
    const mx = Px - pv.x, my = Py - pv.y, mz = Pz - pv.z;
    const snap = src === null || !this.hasPrev || mx * mx + my * my + mz * mz > SNAP_M * SNAP_M;
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
      const rr = hypot3(qx, qy, qz);
      if (rr < MOON_R + MAX_TERRAIN_H + 80) {
        tio[0] = qx / rr; tio[1] = qy / rr; tio[2] = qz / rr; tf.heightFromIo();
        if (rr - (MOON_R + tio[3]) < T.camClearance) {
          target = Math.min(target, f - T.camClearance); break;
        }
      }
    }
    if (target < T.camDistMin) target = T.camDistMin;
    // §9.4 spring arm: shrink instantly (never clips), regrow with camBoomTau.
    if (snap || target <= this.boomLen) this.boomLen = target;
    else if (dt > 0) this.boomLen += (target - this.boomLen) * (1 - Math.exp(-dt / T.camBoomTau));
    const bl = this.boomLen;
    let Cx = Sx + bx * bl, Cy = Sy + by * bl, Cz = Sz + bz * bl;
    // camera height clamp: terrain(C) + clearance
    const cr = hypot3(Cx, Cy, Cz);
    tio[0] = Cx / cr; tio[1] = Cy / cr; tio[2] = Cz / cr; tf.heightFromIo();
    const floor = MOON_R + tio[3] + T.camClearance;
    if (cr < floor) { const k = floor / cr; Cx *= k; Cy *= k; Cz *= k; }
    this.offsetPlanet.x = Cx - px; this.offsetPlanet.y = Cy - py; this.offsetPlanet.z = Cz - pz;
    la[0] = Cx; la[1] = Cy; la[2] = Cz; la[3] = Sx; la[4] = Sy; la[5] = Sz;
    la[6] = u.x; la[7] = u.y; la[8] = u.z;
    lookAtQuatIo(la, this.quatPlanet);
  }

  /** §4.2 parallel transport: re-project heading onto the current up plane. */
  private transport(u: Vec3): void {
    const h = this.heading, d = h.x * u.x + h.y * u.y + h.z * u.z;
    const hx = h.x - u.x * d, hy = h.y - u.y * d, hz = h.z - u.z * d;
    const l = hypot3(hx, hy, hz) || 1;
    h.x = hx / l; h.y = hy / l; h.z = hz / l;
  }

  private setHeadingFrom(kcc: AstronautKCC, v: Vec3): void {
    const u = kcc.up;
    let hx = v.x, hy = v.y, hz = v.z;
    const d = hx * u.x + hy * u.y + hz * u.z;
    hx -= u.x * d; hy -= u.y * d; hz -= u.z * d;
    let l = hypot3(hx, hy, hz);
    if (l < 1e-6) { hx = kcc.fwd.x; hy = kcc.fwd.y; hz = kcc.fwd.z; l = hypot3(hx, hy, hz) || 1; }
    this.heading.x = hx / l; this.heading.y = hy / l; this.heading.z = hz / l;
  }
}

// WHY: harness lookAtQuatInto (~775–789) verbatim (F27 camera basis).
export function lookAtQuatInto(
  ex: number, ey: number, ez: number, tx: number, ty: number, tz: number,
  ux: number, uy: number, uz: number, out: Quat,
): void {
  _la[0] = ex; _la[1] = ey; _la[2] = ez; _la[3] = tx; _la[4] = ty; _la[5] = tz;
  _la[6] = ux; _la[7] = uy; _la[8] = uz;
  lookAtQuatIo(_la, out);
}

// WHY (T5 S1bbb, F5a): lookAtQuatInto with its inputs in slots a[0..8] (eye, target,
// up) and quatFromFrameInto inlined in the same expression order, so no double
// crosses a non-inlined call (each boxed a HeapNumber). Bit-identical.
export function lookAtQuatIo(a: Float64Array, out: Quat): void {
  const ex = a[0], ey = a[1], ez = a[2], tx = a[3], ty = a[4], tz = a[5];
  const ux = a[6], uy = a[7], uz = a[8];
  let fx = tx - ex, fy = ty - ey, fz = tz - ez;
  const fl = hypot3(fx, fy, fz) || 1;
  fx /= fl; fy /= fl; fz /= fl;
  let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux;
  const rl = hypot3(rx, ry, rz) || 1;
  rx /= rl; ry /= rl; rz /= rl;
  const upx = ry * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - ry * fx;
  // three.js camera basis: X=right, Y=up, −Z=forward (F27)
  // quatFromFrameInto(rx, ry, rz, upx, upy, upz, out), inlined:
  const zx = ry * upz - rz * upy;
  const zy = rz * upx - rx * upz;
  const zz = rx * upy - ry * upx;
  const m00 = rx, m10 = ry, m20 = rz;
  const m01 = upx, m11 = upy, m21 = upz;
  const m02 = zx, m12 = zy, m22 = zz;
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
}