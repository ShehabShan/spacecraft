// T1 third-person camera (plan §9.4, B4b subset): reset + the STATIC pose only
// (heading, pitch, boom with the harness 4-sample terrain clamp). Orbit input,
// spring-arm regrowth, follow smoothing and FP land in B7. All math runs in the
// PLANET frame (§4.4, K1); the spin is composed once at extraction (playFrame).
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import {
  quatFromFrameInto, rotateByQuatConjInto, spinQuatInto, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { terrainHeight } from '../../core/terrain/terrainField';
import { MAX_TERRAIN_H, MOON_R, PLAY_TUNING } from '../world/moonConfig';

const _qS: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _p: Vec3 = { x: 0, y: 0, z: 0 };

export class ThirdPersonCamera {
  /** Planet-frame unit tangent the camera looks along (§9.4 orbit). */
  readonly heading: Vec3 = { x: 1, y: 0, z: 0 };
  pitch: number = PLAY_TUNING.camPitchDefault;
  dist: number = PLAY_TUNING.camDistance;
  /** Boom length after the terrain clamp, last poseInto. */
  boomLen: number = PLAY_TUNING.camDistance;
  /** Outputs of poseInto (planet frame): camera − character feet, and the camera quat. */
  readonly offsetPlanet: Vec3 = { x: 0, y: 0, z: 0 };
  readonly quatPlanet: Quat = { x: 0, y: 0, z: 0, w: 1 };

  /** WHY: takes the look-toward direction (plan said `reset(kcc)`): the static
   *  pose faces the Earth tangent, and the Earth direction lives in the world. */
  reset(kcc: AstronautKCC, toward: Vec3): void {
    const u = kcc.up;
    let hx = toward.x, hy = toward.y, hz = toward.z;
    const d = hx * u.x + hy * u.y + hz * u.z;
    hx -= u.x * d; hy -= u.y * d; hz -= u.z * d;
    let l = Math.hypot(hx, hy, hz);
    if (l < 1e-6) { hx = kcc.fwd.x; hy = kcc.fwd.y; hz = kcc.fwd.z; l = Math.hypot(hx, hy, hz) || 1; }
    this.heading.x = hx / l; this.heading.y = hy / l; this.heading.z = hz / l;
    this.pitch = PLAY_TUNING.camPitchDefault;
    this.dist = PLAY_TUNING.camDistance;
    this.boomLen = this.dist;
  }

  /** Static TP pose → offsetPlanet / quatPlanet. Zero allocation. */
  poseInto(kcc: AstronautKCC): void {
    const T = PLAY_TUNING;
    spinQuatInto(kcc.spinPhase, _qS);
    rotateByQuatConjInto(_qS, kcc.absPos.x, kcc.absPos.y, kcc.absPos.z, _p); // inertial → planet
    const u = kcc.up, h = this.heading;
    // parallel transport: re-project heading onto the current up plane
    const hd = h.x * u.x + h.y * u.y + h.z * u.z;
    let hx = h.x - u.x * hd, hy = h.y - u.y * hd, hz = h.z - u.z * hd;
    const hl = Math.hypot(hx, hy, hz) || 1;
    hx /= hl; hy /= hl; hz /= hl; h.x = hx; h.y = hy; h.z = hz;
    const Px = _p.x + u.x * T.pivotHeight, Py = _p.y + u.y * T.pivotHeight, Pz = _p.z + u.z * T.pivotHeight;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const bx = -hx * cp + u.x * sp, by = -hy * cp + u.y * sp, bz = -hz * cp + u.z * sp;
    // harness 4-sample terrain clamp (F6 pattern), planet frame
    let dist = this.dist;
    for (let s = 1; s <= 4; s++) {
      const f = (s / 4) * this.dist;
      const qx = Px + bx * f, qy = Py + by * f, qz = Pz + bz * f;
      const rr = Math.hypot(qx, qy, qz);
      if (rr < MOON_R + MAX_TERRAIN_H + 80 &&
          rr - (MOON_R + terrainHeight(qx / rr, qy / rr, qz / rr)) < T.camClearance) {
        dist = Math.min(dist, f - T.camClearance); break;
      }
    }
    if (dist < T.camDistMin) dist = T.camDistMin;
    this.boomLen = dist;
    let Cx = Px + bx * dist, Cy = Py + by * dist, Cz = Pz + bz * dist;
    // camera height clamp: terrain(C) + clearance
    const cr = Math.hypot(Cx, Cy, Cz);
    const floor = MOON_R + terrainHeight(Cx / cr, Cy / cr, Cz / cr) + T.camClearance;
    if (cr < floor) { const k = floor / cr; Cx *= k; Cy *= k; Cz *= k; }
    this.offsetPlanet.x = Cx - _p.x; this.offsetPlanet.y = Cy - _p.y; this.offsetPlanet.z = Cz - _p.z;
    lookAtQuatInto(Cx, Cy, Cz, Px, Py, Pz, u.x, u.y, u.z, this.quatPlanet);
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