/**
 * Shared straddle-pose builder for M1F R5 (F-03 + F-04).
 * Render-local = moon-centred − O, spinGroup rotation = R(θ) about +Y.
 *   T = R·SAT_B − O   (rendered target, moon-centred -> render-local)
 *   S = R·spawnPos − O
 *   dir = normalize(T−S), pose = T − dir·2400, up = normalize(O+pose)
 * Zero allocation when scratch args supplied.
 */
import { spinQuatInto, rotateByQuatInto } from '../core/physics/sphericalFrame';
import type { Quat, Vec3 } from '../core/physics/sphericalFrame';

export function straddlePoseInto(
  spawn: Vec3, satB: Vec3, theta: number, origin: Vec3,
  outPose: Vec3, outTarget: Vec3, outUp: Vec3,
  qScratch: Quat, vA: Vec3, vB: Vec3,
): void {
  spinQuatInto(theta, qScratch);
  rotateByQuatInto(qScratch, satB.x, satB.y, satB.z, vA);
  const Tx = vA.x - origin.x, Ty = vA.y - origin.y, Tz = vA.z - origin.z;
  rotateByQuatInto(qScratch, spawn.x, spawn.y, spawn.z, vB);
  const Sx = vB.x - origin.x, Sy = vB.y - origin.y, Sz = vB.z - origin.z;
  const ddx = Tx - Sx, ddy = Ty - Sy, ddz = Tz - Sz;
  const len = Math.hypot(ddx, ddy, ddz) || 1;
  const ndx = ddx / len, ndy = ddy / len, ndz = ddz / len;
  outPose.x = Tx - ndx * 2400; outPose.y = Ty - ndy * 2400; outPose.z = Tz - ndz * 2400;
  outTarget.x = Tx; outTarget.y = Ty; outTarget.z = Tz;
  const upL = Math.hypot(outPose.x + origin.x, outPose.y + origin.y, outPose.z + origin.z) || 1;
  outUp.x = (outPose.x + origin.x) / upL;
  outUp.y = (outPose.y + origin.y) / upL;
  outUp.z = (outPose.z + origin.z) / upL;
}
