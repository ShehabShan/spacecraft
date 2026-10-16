/**
 * ============================================================================
 *  SPHERICAL FRAME — PARALLEL TRANSPORT & SURFACE FRAME MATH (PURE FLOAT64)
 *  Milestone 1E · Spec 01.4 (quaternion parallel transport, no Euler angles)
 * ============================================================================
 *  Pure core: no renderer/physics imports. All functions zero-allocation
 *  (out-param style); all arithmetic in 64-bit doubles.
 *
 *  THE FRAME: a character orientation is the pair (up, fwd) — tangent-bundle
 *  state, NEVER a yaw/pitch accumulator (Spec 01.4: Euler prohibited to
 *  prevent gimbal lock and pole snapping). Transport is Gram-Schmidt
 *  reprojection of fwd against the new up; the render quaternion is built
 *  directly from the transported basis (X=fwd, Y=up, Z=fwd×up).
 *
 *  NO SINGULARITIES (see M1E analysis §1.1):
 *   - Degeneracy (fwd ∥ newUp) is unreachable under continuous motion;
 *     teleports fall back to the canonical least-aligned-axis tangent,
 *     which is provably never degenerate (|u×ref| >= 0.816).
 *   - Poles/cube-face boundaries are invisible: up derives from the C1
 *     analytic normal field n(d) (M1C seam proof); no global yaw exists.
 *
 *  SPIN CONVENTION: planet spin is +Y, phase theta (radians, wrapped mod
 *  2pi; quaternion consumers are sign-invariant under the wrap because
 *  rotation-by-quaternion is quadratic in q). Planet frame <-> world frame:
 *      world = R(theta) . planet,   R = rotation about +Y by theta.
 *  The planet is origin-centered in M1E, and spin-about-Y leaves radial
 *  directions eigenvectors — gravity is IDENTICAL in both frames.
 */


export interface Vec3 { x: number; y: number; z: number; }
export interface Quat { x: number; y: number; z: number; w: number; }


export const TWO_PI = Math.PI * 2;


export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


/** Spec 02.3 gravity-range fade: 1 to 75% of range, C1 smoothstep to 0. */
export function rangeFade(rOverRange: number): number {
  if (rOverRange <= 0.75) return 1;
  if (rOverRange >= 1) return 0;
  const t = (rOverRange - 0.75) / 0.25;
  return 1 - t * t * (3 - 2 * t);
}


/**
 * Canonical tangent at up (least-aligned world axis, fixed tie order
 * x -> y -> z). |up . ref| <= 1/sqrt(3) => |up x ref| >= 0.816: NEVER
 * degenerate. Used as the transport fallback and for deterministic spawns.
 */
export function canonicalTangentInto(ux: number, uy: number, uz: number, out: Vec3): Vec3 {
  let rx = 1, ry = 0, rz = 0;
  let m = Math.abs(ux);
  if (Math.abs(uy) < m) { m = Math.abs(uy); rx = 0; ry = 1; rz = 0; }
  if (Math.abs(uz) < m) { rx = 0; ry = 0; rz = 1; }
  let tx = uy * rz - uz * ry;
  let ty = uz * rx - ux * rz;
  let tz = ux * ry - uy * rx;
  const inv = 1 / Math.sqrt(tx * tx + ty * ty + tz * tz);
  out.x = tx * inv; out.y = ty * inv; out.z = tz * inv;
  return out;
}


/**
 * PARALLEL TRANSPORT (Spec 01.4): Gram-Schmidt reprojection of fwd onto the
 * tangent plane of the new up. Degenerate input (fwd nearly parallel to the
 * new up — teleports only) falls back to the canonical tangent.
 */
export function transportFrameInto(
  fx: number, fy: number, fz: number,
  ux: number, uy: number, uz: number,
  out: Vec3,
): Vec3 {
  const d = fx * ux + fy * uy + fz * uz;
  let tx = fx - d * ux, ty = fy - d * uy, tz = fz - d * uz;
  const m = Math.sqrt(tx * tx + ty * ty + tz * tz);
  if (m < 0.02) {
    return canonicalTangentInto(ux, uy, uz, out);
  }
  const inv = 1 / m;
  out.x = tx * inv; out.y = ty * inv; out.z = tz * inv;
  return out;
}


/** Rodrigues rotation of v about unit axis k by angle a. */
export function rotateAboutAxisInto(
  vx: number, vy: number, vz: number,
  kx: number, ky: number, kz: number,
  a: number,
  out: Vec3,
): Vec3 {
  const c = Math.cos(a), s = Math.sin(a), t = 1 - c;
  const dot = vx * kx + vy * ky + vz * kz;
  const cx = ky * vz - kz * vy;
  const cy = kz * vx - kx * vz;
  const cz = kx * vy - ky * vx;
  out.x = vx * c + cx * s + kx * dot * t;
  out.y = vy * c + cy * s + ky * dot * t;
  out.z = vz * c + cz * s + kz * dot * t;
  return out;
}


/** Quaternion from an orthonormal character basis: X=fwd, Y=up, Z=fwd×up. */
export function quatFromFrameInto(
  fx: number, fy: number, fz: number,
  ux: number, uy: number, uz: number,
  out: Quat,
): Quat {
  const zx = fy * uz - fz * uy;
  const zy = fz * ux - fx * uz;
  const zz = fx * uy - fy * ux;
  const m00 = fx, m10 = fy, m20 = fz;
  const m01 = ux, m11 = uy, m21 = uz;
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
  return out;
}


/** Planet spin quaternion: rotation about +Y by theta. */
export function spinQuatInto(theta: number, out: Quat): Quat {
  out.x = 0;
  out.y = Math.sin(theta * 0.5);
  out.z = 0;
  out.w = Math.cos(theta * 0.5);
  return out;
}


/** Rotate v by q. */
export function rotateByQuatInto(
  q: Quat, vx: number, vy: number, vz: number, out: Vec3,
): Vec3 {
  const tx = 2 * (q.y * vz - q.z * vy);
  const ty = 2 * (q.z * vx - q.x * vz);
  const tz = 2 * (q.x * vy - q.y * vx);
  out.x = vx + q.w * tx + (q.y * tz - q.z * ty);
  out.y = vy + q.w * ty + (q.z * tx - q.x * tz);
  out.z = vz + q.w * tz + (q.x * ty - q.y * tx);
  return out;
}


/** Rotate v by the conjugate of q (world -> planet under the spin). */
export function rotateByQuatConjInto(
  q: Quat, vx: number, vy: number, vz: number, out: Vec3,
): Vec3 {
  const qx = -q.x, qy = -q.y, qz = -q.z, qw = q.w;
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  out.x = vx + qw * tx + (qy * tz - qz * ty);
  out.y = vy + qw * ty + (qz * tx - qx * tz);
  out.z = vz + qw * tz + (qx * ty - qy * tx);
  return out;
}


/** Hamilton product a ⊗ b (used for world-frame orientation compose). */
export function quatMulInto(a: Quat, b: Quat, out: Quat): Quat {
  const ax = a.x, ay = a.y, az = a.z, aw = a.w;
  const bx = b.x, by = b.y, bz = b.z, bw = b.w;
  out.x = aw * bx + ax * bw + ay * bz - az * by;
  out.y = aw * by - ax * bz + ay * bw + az * bx;
  out.z = aw * bz + ax * by - ay * bx + az * bw;
  out.w = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}


/**
 * ANALYTIC TRANSPORT VELOCITY (Spec 01.4): v = Ω × p with Ω = (0, ω, 0).
 * Equator check: ω = 0.0104, p = (5000,0,0) -> |v| = 52 m/s exactly.
 * NEVER integrated, NEVER injected as physics-engine speed.
 */
export function transportVelocityInto(
  omega: number, px: number, py: number, pz: number, out: Vec3,
): Vec3 {
  out.x = omega * pz;
  out.y = 0;
  out.z = -omega * px;
  return out;
}


/**
 * Spec 02.3 gravity: inverse-square toward the (origin-centered) body with
 * the C1 range fade. Identical in planet and world frames (spin-about-Y
 * preserves radial directions).
 */
export function gravityInto(
  mu: number, range: number, px: number, py: number, pz: number, out: Vec3,
): Vec3 {
  const r2 = px * px + py * py + pz * pz;
  const r = Math.sqrt(r2);
  const g = -(mu / r2) * rangeFade(range > 0 ? r / range : 0);
  const inv = g / r;
  out.x = px * inv;
  out.y = py * inv;
  out.z = pz * inv;
  return out;
}


/** Signed angle from f to t about unit axis u (atan2 — safe near ±pi). */
export function signedAngleAbout(
  fx: number, fy: number, fz: number,
  tx: number, ty: number, tz: number,
  ux: number, uy: number, uz: number,
): number {
  const cx = fy * tz - fz * ty;
  const cy = fz * tx - fx * tz;
  const cz = fx * ty - fy * tx;
  return Math.atan2(cx * ux + cy * uy + cz * uz, fx * tx + fy * ty + fz * tz);
}
