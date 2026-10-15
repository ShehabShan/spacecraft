/**
 * ============================================================================
 *  SPHERIFIED CUBE — PURE FLOAT64 CUBE-SPHERE MAPPING
 *  Milestone 1C · Spec 01.2 ("exact spherified cube math, not normalize()")
 * ============================================================================
 *  Forward map (component-wise, symmetric):
 *      x' = x·√(1 − y²/2 − z²/2 + y²z²/3)   (and cyclic for y', z')
 *
 *  Verified properties (see Milestone 1C analysis):
 *   - EXACT unit norm identity: x'²+y'²+z'² = 1 identically (cross terms
 *     cancel exactly), so no normalize() pass is ever needed.
 *   - Metric variation √2 (center 0.7071 / edge 1.0 / corner 0.7071 arc-rate
 *     per unit u) vs 2.12× for gnomonic normalize() — near-uniform grid
 *     density, which is what makes a single LOD split threshold correct
 *     everywhere on the face.
 *   - Corner consistency: at each cube corner all three adjacent faces
 *     evaluate bit-identical directions (√(1/3) per component).
 *
 *  INVERSE (closed form, derived): on a face with cube coords (α, β) along
 *  the two tangent world axes, the image satisfies
 *      P = d_t1² = α²(1/2 − β²/6),   Q = d_t2² = β²(1/2 − α²/6)
 *  Subtracting gives α² − β² = 2(P − Q); substituting yields the quadratic
 *      β⁴-terms: β²² + β²(2Δ − 3) + 6Q = 0,  Δ = P − Q
 *      β² = [ (3 − 2Δ) − √((3−2Δ)² − 24Q) ] / 2   (root in [0,1])
 *  Verified numerically at corners, edge midpoints and asymmetric interior
 *  points (e.g. cube (0.5, −0.25, 1) inverts exactly).
 *
 *  No renderer/physics imports. All arithmetic in Float64.
 */


/** Right-handed face basis: p = C + u·U + v·V, u,v ∈ [−1,1]; U×V = C for all
 *  6 faces (verified), so a single winding rule yields outward triangles. */
export const FACE_C = new Float64Array([
  1, 0, 0,  -1, 0, 0,  0, 1, 0,  0, -1, 0,  0, 0, 1,  0, 0, -1,
]);
export const FACE_U = new Float64Array([
  0, 0, -1,  0, 0, 1,  1, 0, 0,  1, 0, 0,   1, 0, 0,  -1, 0, 0,
]);
export const FACE_V = new Float64Array([
  0, 1, 0,   0, 1, 0,  0, 0, -1, 0, 0, 1,   0, 1, 0,  0, 1, 0,
]);


/** sphereToCube face metadata: normal axis, tangent axes, sign mapping
 *  (u = us·α, v = vs·β). Derived from the face tables; each entry verified
 *  against the forward map. */
const FM_N  = new Int8Array([0, 0, 1, 1, 2, 2]);
const FM_T1 = new Int8Array([2, 2, 0, 0, 0, 0]);
const FM_T2 = new Int8Array([1, 1, 2, 2, 1, 1]);
const FM_US = new Int8Array([-1, 1, 1, 1, 1, -1]);
const FM_VS = new Int8Array([1, 1, -1, 1, 1, 1]);


export interface Vec3Out { x: number; y: number; z: number; }
export interface CubeCoord { face: number; u: number; v: number; }


/** Cube point on a face from face coordinates u,v ∈ [−1,1]. */
export function faceCubePointInto(face: number, u: number, v: number, out: Vec3Out): Vec3Out {
  const f3 = face * 3;
  out.x = FACE_C[f3] + u * FACE_U[f3] + v * FACE_V[f3];
  out.y = FACE_C[f3 + 1] + u * FACE_U[f3 + 1] + v * FACE_V[f3 + 1];
  out.z = FACE_C[f3 + 2] + u * FACE_U[f3 + 2] + v * FACE_V[f3 + 2];
  return out;
}


/**
 * THE spherified-cube forward map. Writes the (exactly unit) direction into
 * `out`. Pure function of the cube point — identical inputs yield identical
 * bits everywhere (main thread, every worker).
 */
export function spherifyInto(cx: number, cy: number, cz: number, out: Vec3Out): Vec3Out {
  const x2 = cx * cx, y2 = cy * cy, z2 = cz * cz;
  out.x = cx * Math.sqrt(1 - y2 * 0.5 - z2 * 0.5 + (y2 * z2) / 3);
  out.y = cy * Math.sqrt(1 - z2 * 0.5 - x2 * 0.5 + (z2 * x2) / 3);
  out.z = cz * Math.sqrt(1 - x2 * 0.5 - y2 * 0.5 + (x2 * y2) / 3);
  return out;
}


/** Inverse map: unit direction → (face, u, v). Utility path (chunk lookup),
 *  not on the mesh hot loop. Input is normalized defensively. */
export function sphereToCubeInto(dx: number, dy: number, dz: number, out: CubeCoord): CubeCoord {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const x = len > 0 ? dx / len : 0;
  const y = len > 0 ? dy / len : 0;
  const z = len > 0 ? dz / len : 0;
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face: number;
  if (ax >= ay && ax >= az) face = x >= 0 ? 0 : 1;
  else if (ay >= az) face = y >= 0 ? 2 : 3;
  else face = z >= 0 ? 4 : 5;
  const t1 = FM_T1[face], t2 = FM_T2[face];
  const d1 = t1 === 0 ? x : t1 === 1 ? y : z;
  const d2 = t2 === 0 ? x : t2 === 1 ? y : z;
  const P = d1 * d1, Q = d2 * d2, Dlt = P - Q;
  const b3 = 3 - 2 * Dlt;
  let disc = b3 * b3 - 24 * Q;
  if (disc < 0) disc = 0;
  let b2 = (b3 - Math.sqrt(disc)) * 0.5;          // β² (in-range root)
  if (b2 < 0) b2 = 0; else if (b2 > 1) b2 = 1;
  let a2 = b2 + 2 * Dlt;                           // α²
  if (a2 < 0) a2 = 0; else if (a2 > 1) a2 = 1;
  const alpha = (d1 >= 0 ? 1 : -1) * Math.sqrt(a2);
  const beta = (d2 >= 0 ? 1 : -1) * Math.sqrt(b2);
  out.face = face;
  out.u = FM_US[face] * alpha;
  out.v = FM_VS[face] * beta;
  return out;
}
