/**
 * ============================================================================
 *  PRECISION MATH — FLOAT64 VECTOR UTILITIES & ORIGIN LATTICE
 *  Milestone 1A · Spec 00.3 (Origin Rebasing), Phase-2 rules 2 & 3
 * ============================================================================
 *  This module is part of the pure core: no renderer or physics imports.
 *
 *  ALLOCATION CONTRACT: every function that can produce a vector accepts an
 *  optional `out` parameter. When `out` is omitted the default-parameter
 *  expression allocates — that path is for SETUP code only. Every hot-path
 *  call site (inside SimulationCore.tick / the frame loop) passes `out`.
 */


import type { Vec3f64 } from '../types';


/**
 * Origin lattice quantum: 2^8 = 256 m (Spec 00.3).
 * Powers of two make origin shifts bit-exact across the f64 -> f32 boundary.
 */
export const ORIGIN_LATTICE = 256;


/**
 * Rebase trigger: fire when the focus entity's largest local-axis magnitude
 * exceeds this value (strict inequality). 1024 = 2^10 = exactly 4 lattice
 * cells, which is why axis-aligned flight produces clean Δ = 1024 shifts.
 */
export const REBASE_THRESHOLD = 1024;


/** Setup-path allocator for the optional-`out` convenience variants. */
function fresh(): Vec3f64 {
  return { x: 0, y: 0, z: 0 };
}


/* ---------------------------------------------------------------------------
 * Float64 vector utilities
 * ------------------------------------------------------------------------- */


export function add(a: Vec3f64, b: Vec3f64, out: Vec3f64 = fresh()): Vec3f64 {
  out.x = a.x + b.x;
  out.y = a.y + b.y;
  out.z = a.z + b.z;
  return out;
}


export function sub(a: Vec3f64, b: Vec3f64, out: Vec3f64 = fresh()): Vec3f64 {
  out.x = a.x - b.x;
  out.y = a.y - b.y;
  out.z = a.z - b.z;
  return out;
}


export function scale(a: Vec3f64, s: number, out: Vec3f64 = fresh()): Vec3f64 {
  out.x = a.x * s;
  out.y = a.y * s;
  out.z = a.z * s;
  return out;
}


export function dot(a: Vec3f64, b: Vec3f64): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}


export function cross(a: Vec3f64, b: Vec3f64, out: Vec3f64 = fresh()): Vec3f64 {
  const ax = a.x, ay = a.y, az = a.z;
  const bx = b.x, by = b.y, bz = b.z;
  out.x = ay * bz - az * by;
  out.y = az * bx - ax * bz;
  out.z = ax * by - ay * bx;
  return out;
}


export function lengthSq(a: Vec3f64): number {
  return a.x * a.x + a.y * a.y + a.z * a.z;
}


export function length(a: Vec3f64): number {
  return Math.sqrt(lengthSq(a));
}


export function clone(a: Vec3f64): Vec3f64 {
  return { x: a.x, y: a.y, z: a.z };
}


/** memcpy-style field copy: dst <- src. Hot-path safe when dst is reused. */
export function copy(dst: Vec3f64, src: Vec3f64): Vec3f64 {
  dst.x = src.x;
  dst.y = src.y;
  dst.z = src.z;
  return dst;
}


export function set(dst: Vec3f64, x: number, y: number, z: number): Vec3f64 {
  dst.x = x;
  dst.y = y;
  dst.z = z;
  return dst;
}


/** Largest absolute component — the trigger metric. */
export function maxAxisAbs(v: Vec3f64): number {
  return Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
}


/* ---------------------------------------------------------------------------
 * THE ORIGIN LATTICE
 *
 * WHY 256 = 2^8 GUARANTEES LOSSLESS f64 -> f32 ORIGIN SHIFTS
 *
 * 1. Dividing by 256 shifts the exponent only: p/256 is EXACT in IEEE 754
 *    for any normal double (no significand rounding).
 * 2. floor(p/256 + 0.5) returns an exact integer k (all |k| < 2^53 are
 *    exact in f64), and multiplying by 256 is an exponent shift — so
 *    O = 256·k is an EXACT multiple of 256 in Float64, regardless of which
 *    side of a half-lattice boundary the rounding lands on.
 * 3. Δ = O_new − O_old = 256·(k_new − k_old). Both operands are exact, the
 *    true difference is representable, so IEEE subtraction returns it with
 *    ZERO error (catastrophic cancellation cannot occur when the exact
 *    result fits).
 * 4. Within one rebase |Δ| spans at most a few trigger distances, so
 *    |k_new − k_old| < 2^16 and Δ = m·2^8 needs at most a 17-bit
 *    significand — inside Float32's 24-bit significand. Hence
 *    Math.fround(Δ) === Δ: translating 32-bit physics/render state by Δ
 *    injects no rounding error and therefore no phantom momentum (Spec 00.3).
 * 5. Cancellation is avoided by ORDER, not magnitude: locals are computed
 *    as f64(P − O) and only THEN narrowed to f32. At Pluto's rail distance
 *    (~3.77e6 m) the f32 ulp is 0.25 m — subtracting in f32 would jitter by
 *    metres; in f64 the same subtraction is exact to ~5e-10 m.
 *
 * Round-to-nearest (+0.5) keeps the focus local coordinate symmetric in
 * [−128, +128] after every shift.
 * ------------------------------------------------------------------------- */


/**
 * Snap a world position to the nearest 256 m lattice point, per axis.
 * Phase-2 rule 2: O = 256 * floor(P / 256 + 0.5).
 */
export function calculateOrigin(p: Vec3f64, out: Vec3f64 = fresh()): Vec3f64 {
  out.x = ORIGIN_LATTICE * Math.floor(p.x / ORIGIN_LATTICE + 0.5);
  out.y = ORIGIN_LATTICE * Math.floor(p.y / ORIGIN_LATTICE + 0.5);
  out.z = ORIGIN_LATTICE * Math.floor(p.z / ORIGIN_LATTICE + 0.5);
  return out;
}


/**
 * Phase-2 rule 3 — rebase trigger. STRICT inequality: a tick that does not
 * fire ends with max-axis local <= 1024, which is exactly the structural
 * bound the acceptance test observes post-tick.
 */
export function shouldRebase(pLocal: Vec3f64): boolean {
  return maxAxisAbs(pLocal) > REBASE_THRESHOLD;
}
