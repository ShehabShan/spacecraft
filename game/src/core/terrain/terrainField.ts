/**
 * ============================================================================
 *  TERRAIN FIELD — PURE FLOAT64 HEIGHT h(d) & SEAMLESS NORMALS n(d)
 *  Milestone 1C · Spec 01.2 (exact spherified cube, seamless normals, skirts)
 * ============================================================================
 *  THE BIT-EXACT GRID-LINE INVARIANT (the foundation of zero-communication
 *  seams — do not "simplify"):
 *    Vertices are parameterized by GLOBAL grid line g (integer) via
 *        u = gridCoord(g, D) = 2g/D − 1,   D = GRID_N·2^L (a power of two).
 *    Division by a power of two is a pure exponent adjustment — EXACT for
 *    every integer g. Hence:
 *      - same-level neighbors sharing edge line g compute identical u bits;
 *      - parent/child edges satisfy gridCoord(g, D) === gridCoord(2g, 2D)
 *        bitwise (both exact evaluations of the same real number);
 *      - the face cube point (C + uU + vV, table entries in {−1,0,1}) and
 *        the spherified direction are then pure functions of identical
 *        inputs → identical direction bits in every worker.
 *    The normal below is a pure function of the direction alone (canonical
 *    tangent frame, fixed angular epsilon, seeded noise). Identical d bits →
 *    IDENTICAL NORMAL BITS across chunks and LOD levels. Workers never
 *    communicate because nothing is chunk-local.
 *
 *  ZERO-GC: all scratch is module-level, allocated once per thread. The
 *  height/normal functions perform zero allocation.
 */


import { FACE_C, FACE_U, FACE_V, spherifyInto, type Vec3Out } from './spherify';
import { fbm3, initNoise, ridged3 } from './noise';


/* -- Chunk grid constants (fixed pool geometry — every chunk identical) --- */
export const GRID_N = 32;                             // quads per chunk side
export const GRID_W = GRID_N + 3;                     // padded side (35): 1 skirt ring
export const CHUNK_VERTS = GRID_W * GRID_W;           // 1225
export const CHUNK_POS_FLOATS = CHUNK_VERTS * 3;      // 3675
export const CHUNK_NRM_FLOATS = CHUNK_VERTS * 3;
export const CHUNK_UV_FLOATS = CHUNK_VERTS * 2;       // 2450
export const CHUNK_QUADS = (GRID_N + 2) * (GRID_N + 2); // 1156 (incl. skirt quads)
export const CHUNK_INDEX_COUNT = CHUNK_QUADS * 6;     // 6936 (Uint16)


/* -- Terrain parameters (deterministic; cloned to workers verbatim) ------- */
export interface TerrainParams {
  name: string;
  radius: number;        // metres (Earth-scale test planet: 5000)
  seed: number;
  continentFreq: number;
  continentAmp: number;  // metres
  maskFreq: number;
  mountainFreq: number;
  mountainAmp: number;   // metres
  detailFreq: number;
  detailAmp: number;     // metres
}


export const TEST_PLANET: TerrainParams = {
  name: 'M1C Test Planet (Earth-scale)',
  radius: 5000,
  seed: 20240117,
  continentFreq: 1.7,
  continentAmp: 520,
  maskFreq: 3.1,
  mountainFreq: 5.3,
  mountainAmp: 460,
  detailFreq: 16,
  detailAmp: 42,
};


let P: TerrainParams = TEST_PLANET;


/** Boot-time initialization (main thread AND every worker — identical). */
export function initTerrainField(params: TerrainParams): void {
  P = params;
  initNoise(params.seed);
}


export function activeTerrainParams(): TerrainParams {
  return P;
}


/* -- Chunk identity & lattice math ---------------------------------------- */


/** Dense, exactly-representable chunk key (f64-safe). */
export function chunkKey(face: number, level: number, ix: number, iy: number): number {
  return face * 0x100000 + level * 0x10000 + ix * 0x100 + iy;
}


/**
 * Global grid line → face coordinate. THE exactness invariant (see header).
 * D must be GRID_N << level (a power of two).
 */
export function gridCoord(g: number, D: number): number {
  return (2 * g) / D - 1;
}


/** Conservative arc width of a level-L chunk (face-centre arc; the split
 *  metric's hysteresis absorbs edge variation). */
export function chunkArcWidth(level: number): number {
  return (P.radius * 1.5707963267948966) / Math.pow(2, level);
}


/** Skirt depth: conservative per-LOD constant (Spec 01.2) — clamped fraction
 *  of the chunk width, i.e. sized to the geometric error one LOD below. */
export function skirtDepthFor(level: number): number {
  const s = 0.25 * chunkArcWidth(level);
  return s < 30 ? 30 : s > 800 ? 800 : s;
}


/* -- The height field h(d) ------------------------------------------------- */


/**
 * Terrain height at unit direction d. Pure function of d (seeded noise).
 * Continents (fBm) + ridged mountains masked by a low-frequency field +
 * fine detail. Max amplitude ~±900 m for TEST_PLANET.
 */
export function terrainHeight(dx: number, dy: number, dz: number): number {
  const c = fbm3(dx * P.continentFreq, dy * P.continentFreq, dz * P.continentFreq, 4, 2, 0.5);
  const m = fbm3(
    dx * P.maskFreq + 17.31, dy * P.maskFreq - 9.17, dz * P.maskFreq + 4.73, 3, 2, 0.5,
  );
  const r = ridged3(dx * P.mountainFreq, dy * P.mountainFreq, dz * P.mountainFreq, 4);
  let mask = (m + 0.05) / 0.5;                       // smoothstep(−0.05, 0.45, m)
  mask = mask < 0 ? 0 : mask > 1 ? 1 : mask;
  mask = mask * mask * (3 - 2 * mask);
  const d = fbm3(dx * P.detailFreq, dy * P.detailFreq, dz * P.detailFreq, 3, 2, 0.5);
  return c * P.continentAmp + r * mask * P.mountainAmp + d * P.detailAmp;
}


/* -- Seamless analytic normals (central differences on the sphere) --------- */


const NORMAL_EPS = 0.002; // radians (~10 m arc at R=5000; fixed constant!)


const _sp: Vec3Out = { x: 0, y: 0, z: 0 };
const _sm: Vec3Out = { x: 0, y: 0, z: 0 };


/** Surface point S(d̂) = (R + h(d̂))·d̂ for a (re-normalized) direction. */
function sampleSurfaceInto(dx: number, dy: number, dz: number, out: Vec3Out): void {
  const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
  const ux = dx * inv, uy = dy * inv, uz = dz * inv;
  const r = P.radius + terrainHeight(ux, uy, uz);
  out.x = ux * r;
  out.y = uy * r;
  out.z = uz * r;
}


/**
 * Exact central-difference surface normal at unit direction d, evaluated in
 * a canonical tangent frame INVARIANT to the vertex direction (Spec 01.2):
 *   ref = world axis least aligned with d (deterministic tie-break x→y→z)
 *   t1  = normalize(d × ref),  t2 = d × t1      (t1 × t2 = d → outward)
 *   T1  = S(rot(d,t1,+ε)) − S(rot(d,t1,−ε)),  T2 likewise about t2
 *   n   = normalize(T1 × T2)                    (outward, since t1×t2 = d)
 * Pure function of d → bitwise-identical on shared vertices in ANY chunk,
 * ANY LOD, ANY worker. Zero allocation.
 */
export function terrainNormalInto(dx: number, dy: number, dz: number, out: Vec3Out): Vec3Out {
  // canonical reference axis (least |component|, fixed tie order)
  let rx = 1, ry = 0, rz = 0;
  let m = Math.abs(dx);
  if (Math.abs(dy) < m) { m = Math.abs(dy); rx = 0; ry = 1; rz = 0; }
  if (Math.abs(dz) < m) { rx = 0; ry = 0; rz = 1; }
  // t1 = normalize(cross(d, ref))
  let t1x = dy * rz - dz * ry, t1y = dz * rx - dx * rz, t1z = dx * ry - dy * rx;
  const inv1 = 1 / Math.sqrt(t1x * t1x + t1y * t1y + t1z * t1z);
  t1x *= inv1; t1y *= inv1; t1z *= inv1;
  // t2 = cross(d, t1)  (unit: d ⊥ t1)
  const t2x = dy * t1z - dz * t1y, t2y = dz * t1x - dx * t1z, t2z = dx * t1y - dy * t1x;
  const c = Math.cos(NORMAL_EPS), s = Math.sin(NORMAL_EPS);
  // rotation of d about t1 by ±ε: d± = d·c ± (t1 × d)·s
  const c1x = t1y * dz - t1z * dy, c1y = t1z * dx - t1x * dz, c1z = t1x * dy - t1y * dx;
  sampleSurfaceInto(dx * c + c1x * s, dy * c + c1y * s, dz * c + c1z * s, _sp);
  sampleSurfaceInto(dx * c - c1x * s, dy * c - c1y * s, dz * c - c1z * s, _sm);
  const ax = _sp.x - _sm.x, ay = _sp.y - _sm.y, az = _sp.z - _sm.z;
  // rotation of d about t2 by ±ε
  const c2x = t2y * dz - t2z * dy, c2y = t2z * dx - t2x * dz, c2z = t2x * dy - t2y * dx;
  sampleSurfaceInto(dx * c + c2x * s, dy * c + c2y * s, dz * c + c2z * s, _sp);
  sampleSurfaceInto(dx * c - c2x * s, dy * c - c2y * s, dz * c - c2z * s, _sm);
  const bx = _sp.x - _sm.x, by = _sp.y - _sm.y, bz = _sp.z - _sm.z;
  // outward normal
  let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
  const invn = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
  out.x = nx * invn;
  out.y = ny * invn;
  out.z = nz * invn;
  return out;
}


/* -- Chunk anchor (Float64, deterministic on every thread) ----------------- */


const _cd: Vec3Out = { x: 0, y: 0, z: 0 };


/**
 * Chunk origin: the surface point at the chunk's centre grid lines
 * (g = ix·N + N/2 — integer since N is even). Computed identically by the
 * worker (for the f32 chunk-local export) and the main thread (for
 * mesh.position) — bit-identical results by construction.
 */
export function chunkOriginInto(face: number, level: number, ix: number, iy: number, out: Vec3Out): Vec3Out {
  const D = GRID_N << level;
  const u = gridCoord(ix * GRID_N + (GRID_N >> 1), D);
  const v = gridCoord(iy * GRID_N + (GRID_N >> 1), D);
  const f3 = face * 3;
  const cx = FACE_C[f3] + u * FACE_U[f3] + v * FACE_V[f3];
  const cy = FACE_C[f3 + 1] + u * FACE_U[f3 + 1] + v * FACE_V[f3 + 1];
  const cz = FACE_C[f3 + 2] + u * FACE_U[f3 + 2] + v * FACE_V[f3 + 2];
  spherifyInto(cx, cy, cz, _cd);
  const r = P.radius + terrainHeight(_cd.x, _cd.y, _cd.z);
  out.x = _cd.x * r;
  out.y = _cd.y * r;
  out.z = _cd.z * r;
  return out;
}
