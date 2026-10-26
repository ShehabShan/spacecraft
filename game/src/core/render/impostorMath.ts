/**
 * ============================================================================
 *  IMPOSTOR MATH — PURE FLOAT64 CELESTIAL PROJECTION UTILITIES
 *  Milestone 1F · Spec 04.4 (Sky Impostor), this milestone's scaled-space law
 * ============================================================================
 *  Pure core: no three/react/rapier imports. Every function is allocation-
 *  free (out-params / scalars) and evaluated in 64-bit doubles.
 *
 *  THE SCALED BACKGROUND SPACE: the Background camera occupies [500, 10,000]
 *  metres and REPRESENTS the Spec-04.1 Far band [240 km, 10,000 km] by
 *  angular preservation. A body at any true distance (Pluto at 3.77e6 m, or
 *  the prompt's Jupiter at 8e11 m — the law is scale-free) is placed at a
 *  STAGED distance D ≤ 9,600 m along its true f64 direction, with quad
 *  half-size
 *        s = D · tan(θ_actual),      θ_actual = asin(R / d_true)
 *  so the impostor subtends EXACTLY 2θ on screen (see the tan-law derivation
 *  in the M1F analysis: a flat quad projects through tan; the naive
 *  s = D·sinθ undersizes by 1/cosθ — 34% at 45°).
 *
 *  PARALLAX: staged quads are re-anchored every frame from the CURRENT f64
 *  direction, so the rendered direction is the true apparent direction and
 *  the amplification (D/d_true) never reaches a pixel. Staggering by
 *  true-distance rank sorts mutual occlusion with ≥45 m gaps against ~1 cm
 *  of Background depth resolution.
 */


import { rotateByQuatConjInto, type Quat } from '../physics/sphericalFrame';


/** Background staged-space constants (documented, tuned once). */
export const BG_STAGE_D_MAX = 9600;
export const BG_STAGE_D_STEP = 45;
/** Margin added to θ for the quad: covers AA band + glow bleed. */
export const IMPOSTOR_EDGE_MARGIN = 0.0035;
export const IMPOSTOR_EDGE_SCALE = 1.06;


export interface SkyGeometry {
  /** Unit direction observer -> body, Float64. */
  dirX: number; dirY: number; dirZ: number;
  /** True distance, metres, Float64. */
  dist: number;
  /** True angular radius, radians, Float64. */
  theta: number;
}


/**
 * Full f64 geometry of one body from observer and body absolute positions.
 * This is the ONLY place true inter-body coordinates are handled — nothing
 * downstream ever sees a large f64 coordinate, only direction + angle.
 */
export function bodyGeometryInto(
  obsX: number, obsY: number, obsZ: number,
  bodyX: number, bodyY: number, bodyZ: number,
  radius: number,
  out: SkyGeometry,
): SkyGeometry {
  const dx = bodyX - obsX, dy = bodyY - obsY, dz = bodyZ - obsZ;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  out.dist = d;
  if (d < 1e-9) { out.dirX = 1; out.dirY = 0; out.dirZ = 0; out.theta = Math.PI / 2; return out; }
  const inv = 1 / d;
  out.dirX = dx * inv; out.dirY = dy * inv; out.dirZ = dz * inv;
  const s = radius * inv;
  out.theta = s >= 1 ? Math.PI / 2 : Math.asin(s);
  return out;
}


/** Quad edge angle with AA margin: θ_e = 1.06·θ + 0.0035 rad. */
export function thetaEdge(theta: number): number {
  return theta * IMPOSTOR_EDGE_SCALE + IMPOSTOR_EDGE_MARGIN;
}


/** THE LAW: s = D · tan(θ_e) (inscribes the disk of angular radius θ). */
export function quadHalfSize(stagedD: number, thetaE: number): number {
  return stagedD * Math.tan(thetaE);
}


/** Staged distance by occlusion rank (rank 0 = farthest body = largest D). */
export function stagedDistanceForRank(rank: number): number {
  return BG_STAGE_D_MAX - BG_STAGE_D_STEP * rank;
}


/**
 * Elevation of a sky direction above the local horizon plane (plane through
 * the observer ⊥ local up). Pure f64.
 */
export function elevationAngle(
  dirX: number, dirY: number, dirZ: number,
  upX: number, upY: number, upZ: number,
): number {
  const d = dirX * upX + dirY * upY + dirZ * upZ;
  return Math.asin(d >= 1 ? 1 : d <= -1 ? -1 : d);
}


/**
 * Fraction of a disk of angular radius θ above the horizon, given the
 * center elevation e (radians). Circular-segment formula; the flat-sky
 * approximation error is < θ²/8 (< 0.3% for θ < 8°).
 */
export function diskFractionAboveHorizon(elevation: number, theta: number): number {
  if (theta <= 1e-9) return elevation > 0 ? 1 : 0;
  if (elevation >= theta) return 1;
  if (elevation <= -theta) return 0;
  const s = -elevation / theta;                       // chord offset, center-relative
  const a = Math.acos(s);
  return (a - s * Math.sqrt(Math.max(0, 1 - s * s))) / Math.PI;
}


/**
 * Conservative below-horizon cull: the disk is fully below the geometric
 * horizon by more than the terrain roughness allowance.
 */
export function fullyBelowHorizon(
  elevation: number, theta: number, terrainRoughnessRad: number,
): boolean {
  return elevation < -(theta + terrainRoughnessRad);
}


/** Depth-buffer resolution δ(z) = (f−n)z²/(f·n·2^24), metres. Pure f64. */
export function depthResolution(z: number, near: number, far: number): number {
  return ((far - near) * z * z) / (far * near * 16777216);
}


/** Screen pixels per radian for a perspective camera. */
export function pixelsPerRadian(fovYRad: number, viewportHeightPx: number): number {
  return viewportHeightPx / (2 * Math.tan(fovYRad * 0.5));
}


export interface ScreenProjection { px: number; py: number; behind: boolean; }


/**
 * INDEPENDENT f64 projection of a world direction through a camera pose
 * (position-independent for directions). Used by the acceptance suite as a
 * ground-truth path that shares no code with the instance placement.
 * Camera convention: looks along −Z in view space; py is top-down pixels.
 */
export function projectDirectionInto(
  dirX: number, dirY: number, dirZ: number,
  q: Quat,
  fovYRad: number, aspect: number, widthPx: number, heightPx: number,
  out: ScreenProjection,
): ScreenProjection {
  // view-space direction = q* ⊗ d
  const vx = rotateByQuatConjInto(q, dirX, dirY, dirZ, _pv);
  const tanY = Math.tan(fovYRad * 0.5);
  const tanX = tanY * aspect;
  const fwd = -vx.z;
  if (fwd <= 1e-9) { out.behind = true; out.px = 0; out.py = 0; return out; }
  out.behind = false;
  const ndcX = (vx.x / fwd) / tanX;
  const ndcY = (vx.y / fwd) / tanY;
  out.px = (ndcX * 0.5 + 0.5) * widthPx;
  out.py = (0.5 - ndcY * 0.5) * heightPx;
  return out;
}


const _pv = { x: 0, y: 0, z: 0 };
