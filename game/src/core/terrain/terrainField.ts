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
 *  PER-BODY INSTANCE (T5 S1a, F5a): params, Moon tables, noise tables and
 *  scratch belong to a TerrainField instance (one per body, built at boot).
 *  The module functions are thin wrappers over a default instance that
 *  initTerrainField() replaces, so pre-S1a call sites keep their bits.
 *  ZERO-GC: scratch is allocated once per instance; the height/normal
 *  methods perform zero allocation.
 */


import { FACE_C, FACE_U, FACE_V, spherifyInto, type Vec3Out } from './spherify';
import { initNoise, SimplexNoise } from './noise';


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
  // WHY (T3, ADR-028): opt-in Moon profile. Absent → the pre-T3 field, bit-identical.
  moon?: MoonProfile;
}


/**
 * Moon profile (T3, ADR-028): mare basins (flat floors + rim rings) and
 * procedural craters over a softened highland field. Plain numbers / number
 * arrays only — params are structured-cloned to workers verbatim.
 */
export interface MoonProfile {
  basins: number[];      // flat [dx, dy, dz, angularRadius(rad)] × n, unit dirs
  shoreWidth: number;    // rad, smoothstep band inside the basin edge
  rimSigma: number;      // rad, Gaussian width of the rim ring
  rimOffset: number;     // rad, ring centre outside the basin edge
  rimAmp0: number;       // m, rim height at radius 0
  rimAmpPerRad: number;  // m per rad of basin radius
  floorHeight: number;   // m, mare floor level
  floorFreq: number;     // fBm frequency of floor undulation (low → flat)
  floorAmp: number;      // m
  mareCraterDamp: number; // craters × (1 − damp·mask) on mare
  craters: number[];     // flat [F, pOcc, rMin, rMax, depthK, rimK, seed] × layers
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


/* -- Chunk grid helpers that need no body state -------------------------- */


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


function hash01(ix: number, iy: number, iz: number, s: number): number {
  let h = Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(iz, 0xcb1ab31f) ^ s;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}


const NORMAL_EPS = 0.002; // radians (~10 m arc at R=5000; fixed constant!)


/* -- The per-body terrain field (T5 S1a, F5a) ------------------------------ */


/**
 * One body's terrain: h(d), n(d) and the chunk anchor, all pure in d. Built
 * once at boot per body (main thread AND every worker — identical bits for
 * identical params). Owns its noise tables, Moon tables and scratch, so a
 * second body never perturbs the first.
 */
export class TerrainField {
  readonly params: TerrainParams;
  readonly noise: SimplexNoise;
  // Opt-in Moon profile (T3, ADR-028): boot-time tables, evaluation pure in d.
  private _bas: Float64Array; // [dx, dy, dz, r, cosCull, rimAmp] × basins
  private _crt: Float64Array; // [F, pOcc, rMin, rMax, depthK, rimK, seed, reach²] × layers
  // WHY (T5 S1bb, F5a): hot-path I/O slots [dx, dy, dz, h, mask, rim, fieldH, craterH]
  // replace double args/returns of the inner calls (each boxed a HeapNumber per call).
  private readonly _io: Float64Array;
  private readonly _ss: Float64Array;
  private readonly _cd: Vec3Out;

  constructor(params: TerrainParams) {
    this.params = params;
    this.noise = new SimplexNoise(params.seed);
    this._bas = new Float64Array(0);
    this._crt = new Float64Array(0);
    this._io = new Float64Array(8);
    this._ss = new Float64Array(6);
    this._cd = { x: 0, y: 0, z: 0 };
    this.prepareMoon(params.moon);
  }

  /** Conservative arc width of a level-L chunk (face-centre arc; the split
   *  metric's hysteresis absorbs edge variation). */
  chunkArcWidth(level: number): number {
    return (this.params.radius * 1.5707963267948966) / Math.pow(2, level);
  }

  /** Skirt depth: conservative per-LOD constant (Spec 01.2) — clamped fraction
   *  of the chunk width, i.e. sized to the geometric error one LOD below. */
  skirtDepthFor(level: number): number {
    const s = 0.25 * this.chunkArcWidth(level);
    return s < 30 ? 30 : s > 800 ? 800 : s;
  }

  /**
   * Terrain height at unit direction d. Pure function of d (seeded noise).
   * Continents (fBm) + ridged mountains masked by a low-frequency field +
   * fine detail. Max amplitude ~±900 m for TEST_PLANET.
   */
  terrainHeight(dx: number, dy: number, dz: number): number {
    const io = this._io;
    io[0] = dx; io[1] = dy; io[2] = dz;
    this.heightIo();
    return io[3];
  }

  /** terrainHeight of _io[0..2] → _io[3]. Zero allocation. */
  private heightIo(): void {
    // WHY (T3, ADR-028): without params.moon the field below is evaluated exactly as
    // before T3 (default-path SHA-256 pins in tools/test-moon-profile.mjs).
    if (this.params.moon !== undefined) { this.moonHeightIo(); return; }
    this.fieldHeightIo();
    this._io[3] = this._io[6];
  }

  /** The pre-T3 field: continents + masked ridges + detail (unchanged) → _io[6]. */
  private fieldHeightIo(): void {
    const P = this.params, N = this.noise, nio = N.io, io = this._io;
    const dx = io[0], dy = io[1], dz = io[2];
    nio[0] = dx * P.continentFreq; nio[1] = dy * P.continentFreq; nio[2] = dz * P.continentFreq;
    N.fbm3Io(4, 2, 0.5);
    const c = nio[3];
    nio[0] = dx * P.maskFreq + 17.31; nio[1] = dy * P.maskFreq - 9.17; nio[2] = dz * P.maskFreq + 4.73;
    N.fbm3Io(3, 2, 0.5);
    const m = nio[3];
    nio[0] = dx * P.mountainFreq; nio[1] = dy * P.mountainFreq; nio[2] = dz * P.mountainFreq;
    N.ridged3Io(4);
    const r = nio[3];
    let mask = (m + 0.05) / 0.5;                       // smoothstep(−0.05, 0.45, m)
    mask = mask < 0 ? 0 : mask > 1 ? 1 : mask;
    mask = mask * mask * (3 - 2 * mask);
    nio[0] = dx * P.detailFreq; nio[1] = dy * P.detailFreq; nio[2] = dz * P.detailFreq;
    N.fbm3Io(3, 2, 0.5);
    const d = nio[3];
    io[6] = c * P.continentAmp + r * mask * P.mountainAmp + d * P.detailAmp;
  }

  private prepareMoon(m: MoonProfile | undefined): void {
    if (m === undefined) { this._bas = new Float64Array(0); this._crt = new Float64Array(0); return; }
    const nb = (m.basins.length / 4) | 0;
    const bas = new Float64Array(nb * 6);
    for (let i = 0; i < nb; i++) {
      const x = m.basins[i * 4], y = m.basins[i * 4 + 1], z = m.basins[i * 4 + 2];
      const r = m.basins[i * 4 + 3], inv = 1 / Math.sqrt(x * x + y * y + z * z);
      bas[i * 6] = x * inv; bas[i * 6 + 1] = y * inv; bas[i * 6 + 2] = z * inv;
      bas[i * 6 + 3] = r;
      // WHY: beyond r + offset + 3σ the mask is 0 and the rim < 1.3e-4·amp → skip acos.
      bas[i * 6 + 4] = Math.cos(r + m.rimOffset + 3 * m.rimSigma);
      bas[i * 6 + 5] = m.rimAmp0 + m.rimAmpPerRad * r;
    }
    const nl = (m.craters.length / 7) | 0;
    const crt = new Float64Array(nl * 8);
    for (let l = 0; l < nl; l++) {
      for (let k = 0; k < 7; k++) crt[l * 8 + k] = m.craters[l * 7 + k];
      // WHY: a crater influences ≤ 1.8·r (rim Gaussian < 0.6% there), in lattice units.
      const reach = (1.8 * m.craters[l * 7 + 3] / this.params.radius) * m.craters[l * 7];
      crt[l * 8 + 7] = reach * reach;
    }
    this._bas = bas; this._crt = crt;
  }

  /** Basin mask (max over basins, 1 = mare floor) and summed rim height of _io[0..2]
   *  → _io[4] / _io[5]. */
  private basinsIo(m: MoonProfile): void {
    const io = this._io, dx = io[0], dy = io[1], dz = io[2];
    const w = m.shoreWidth, sig = m.rimSigma, off = m.rimOffset, bas = this._bas;
    let mask = 0, rim = 0;
    for (let i = 0; i < bas.length; i += 6) {
      const ca = dx * bas[i] + dy * bas[i + 1] + dz * bas[i + 2];
      if (ca < bas[i + 4]) continue;
      const a = Math.acos(ca > 1 ? 1 : ca);
      const r = bas[i + 3];
      let t = (a - (r - w)) / w;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const mk = 1 - t * t * (3 - 2 * t);
      if (mk > mask) mask = mk;
      const g = (a - r - off) / sig;
      rim += bas[i + 5] * Math.exp(-g * g);
    }
    io[4] = mask; io[5] = rim;
  }

  /** One crater layer: 3D cell lattice of d (continuous across cube faces), 3×3×3
   *  neighbourhood with a cell-box prune; bowl (depthK·r) + Gaussian rim (rimK·r). */
  private craterLayerIo(i: number): void {
    const io = this._io, dx = io[0], dy = io[1], dz = io[2];
    const crt = this._crt;
    const F = crt[i], pOcc = crt[i + 1], rMin = crt[i + 2], rMax = crt[i + 3];
    const depthK = crt[i + 4], rimK = crt[i + 5], seed = crt[i + 6] | 0, r2 = crt[i + 7];
    const R = this.params.radius;
    const px = dx * F, py = dy * F, pz = dz * F;
    const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
    const fx = px - cx, fy = py - cy, fz = pz - cz;
    let h = 0;
    for (let a = -1; a <= 1; a++) {
      const gx = a < 0 ? fx : a > 0 ? 1 - fx : 0;
      if (gx * gx > r2) continue;
      for (let b = -1; b <= 1; b++) {
        const gy = b < 0 ? fy : b > 0 ? 1 - fy : 0;
        if (gx * gx + gy * gy > r2) continue;
        for (let c = -1; c <= 1; c++) {
          const gz = c < 0 ? fz : c > 0 ? 1 - fz : 0;
          if (gx * gx + gy * gy + gz * gz > r2) continue;
          const ix = cx + a, iy = cy + b, iz = cz + c;
          if (hash01(ix, iy, iz, seed) > pOcc) continue;
          const ox = (ix + hash01(ix, iy, iz, seed + 1)) / F;
          const oy = (iy + hash01(ix, iy, iz, seed + 2)) / F;
          const oz = (iz + hash01(ix, iy, iz, seed + 3)) / F;
          const ol = Math.sqrt(ox * ox + oy * oy + oz * oz);
          if (Math.abs(ol - 1) > 0.5 / F) continue; // centre must lie near the sphere
          const u = hash01(ix, iy, iz, seed + 4);
          const rm = rMin + (rMax - rMin) * u * u, rA = rm / R;
          // WHY: chord ≈ arc for rA ≤ 0.05 rad (error < 0.1%) — no acos per crater.
          const ex = dx - ox / ol, ey = dy - oy / ol, ez = dz - oz / ol;
          const x2 = (ex * ex + ey * ey + ez * ez) / (rA * rA);
          if (x2 > 3.24) continue;
          const x = Math.sqrt(x2);
          if (x < 1) h += rm * depthK * (x2 - 1);
          const g = (x - 1) / 0.35;
          h += rm * rimK * Math.exp(-g * g);
        }
      }
    }
    io[7] = h;
  }

  /** Moon height of _io[0..2] → _io[3]. Same expression order as before S1bb. */
  private moonHeightIo(): void {
    const m = this.params.moon as MoonProfile, io = this._io;
    const dx = io[0], dy = io[1], dz = io[2];
    this.basinsIo(m);
    const mask = io[4];
    let hh = 0;
    if (mask < 1) { this.fieldHeightIo(); hh = io[6]; }  // mare floor replaces it fully
    const ff = m.floorFreq;
    let fl = 0;
    if (mask > 0) {
      const N = this.noise, nio = N.io;
      nio[0] = dx * ff; nio[1] = dy * ff; nio[2] = dz * ff;
      N.fbm3Io(3, 2, 0.5);
      fl = m.floorHeight + nio[3] * m.floorAmp;
    }
    let cr = 0;
    const crt = this._crt;
    for (let i = 0; i < crt.length; i += 8) { this.craterLayerIo(i); cr += io[7]; }
    io[3] = hh * (1 - mask) + fl * mask + io[5] + (1 - m.mareCraterDamp * mask) * cr;
  }

  /** Mare mask at unit d (1 = basin floor, 0 = highland); 0 without a Moon profile. */
  moonMareMask(dx: number, dy: number, dz: number): number {
    const m = this.params.moon;
    if (m === undefined) return 0;
    const io = this._io;
    io[0] = dx; io[1] = dy; io[2] = dz;
    this.basinsIo(m);
    return io[4];
  }

  /** Surface point S(d̂) = (R + h(d̂))·d̂ for a (re-normalized) direction. */
  // WHY (T5 S1b): writes into the Float64Array scratch _ss at offset k (0 = S+, 3 = S-).
  // Double stores into a shared {x,y,z} scratch box a HeapNumber per field; typed-array
  // stores do not. Float64 slots hold the same doubles, so normals stay bit-identical.
  // S1bb: the direction comes in through _io[0..2] (no boxed double args).
  private sampleSurfaceIo(k: number): void {
    const io = this._io, dx = io[0], dy = io[1], dz = io[2];
    const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
    const ux = dx * inv, uy = dy * inv, uz = dz * inv;
    io[0] = ux; io[1] = uy; io[2] = uz;
    this.heightIo();
    const r = this.params.radius + io[3];
    const ss = this._ss;
    ss[k] = ux * r;
    ss[k + 1] = uy * r;
    ss[k + 2] = uz * r;
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
  terrainNormalInto(dx: number, dy: number, dz: number, out: Vec3Out): Vec3Out {
    const ss = this._ss, io = this._io;
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
    io[0] = dx * c + c1x * s; io[1] = dy * c + c1y * s; io[2] = dz * c + c1z * s; this.sampleSurfaceIo(0);
    io[0] = dx * c - c1x * s; io[1] = dy * c - c1y * s; io[2] = dz * c - c1z * s; this.sampleSurfaceIo(3);
    const ax = ss[0] - ss[3], ay = ss[1] - ss[4], az = ss[2] - ss[5];
    // rotation of d about t2 by ±ε
    const c2x = t2y * dz - t2z * dy, c2y = t2z * dx - t2x * dz, c2z = t2x * dy - t2y * dx;
    io[0] = dx * c + c2x * s; io[1] = dy * c + c2y * s; io[2] = dz * c + c2z * s; this.sampleSurfaceIo(0);
    io[0] = dx * c - c2x * s; io[1] = dy * c - c2y * s; io[2] = dz * c - c2z * s; this.sampleSurfaceIo(3);
    const bx = ss[0] - ss[3], by = ss[1] - ss[4], bz = ss[2] - ss[5];
    // outward normal
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const invn = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
    out.x = nx * invn;
    out.y = ny * invn;
    out.z = nz * invn;
    return out;
  }

  /**
   * Chunk origin: the surface point at the chunk's centre grid lines
   * (g = ix·N + N/2 — integer since N is even). Computed identically by the
   * worker (for the f32 chunk-local export) and the main thread (for
   * mesh.position) — bit-identical results by construction.
   */
  chunkOriginInto(face: number, level: number, ix: number, iy: number, out: Vec3Out): Vec3Out {
    const cd = this._cd;
    const D = GRID_N << level;
    const u = gridCoord(ix * GRID_N + (GRID_N >> 1), D);
    const v = gridCoord(iy * GRID_N + (GRID_N >> 1), D);
    const f3 = face * 3;
    const cx = FACE_C[f3] + u * FACE_U[f3] + v * FACE_V[f3];
    const cy = FACE_C[f3 + 1] + u * FACE_U[f3 + 1] + v * FACE_V[f3 + 1];
    const cz = FACE_C[f3 + 2] + u * FACE_U[f3 + 2] + v * FACE_V[f3 + 2];
    spherifyInto(cx, cy, cz, cd);
    const r = this.params.radius + this.terrainHeight(cd.x, cd.y, cd.z);
    out.x = cd.x * r;
    out.y = cd.y * r;
    out.z = cd.z * r;
    return out;
  }
}


/* -- Default instance + module wrappers (pre-S1a API, bit-identical) -------- */
// WHY (T5 S1a, F5a): the 35 pre-S1a call sites (src + tools) keep calling these
// module functions; they forward to the default instance that initTerrainField
// replaces. Consumers migrate off the wrappers in S1b; per-body code holds its
// own TerrainField and never touches the default.
let _tf: TerrainField = new TerrainField(TEST_PLANET);


/** Boot-time initialization (main thread AND every worker — identical).
 *  Replaces the default instance and returns it. */
export function initTerrainField(params: TerrainParams): TerrainField {
  initNoise(params.seed); // module noise3/fbm3/ridged3 keep their pre-S1a seeding
  _tf = new TerrainField(params);
  return _tf;
}


export function activeTerrainField(): TerrainField {
  return _tf;
}


export function activeTerrainParams(): TerrainParams {
  return _tf.params;
}


export function chunkArcWidth(level: number): number {
  return _tf.chunkArcWidth(level);
}


export function skirtDepthFor(level: number): number {
  return _tf.skirtDepthFor(level);
}


export function terrainHeight(dx: number, dy: number, dz: number): number {
  return _tf.terrainHeight(dx, dy, dz);
}


export function moonMareMask(dx: number, dy: number, dz: number): number {
  return _tf.moonMareMask(dx, dy, dz);
}


export function terrainNormalInto(dx: number, dy: number, dz: number, out: Vec3Out): Vec3Out {
  return _tf.terrainNormalInto(dx, dy, dz, out);
}


export function chunkOriginInto(face: number, level: number, ix: number, iy: number, out: Vec3Out): Vec3Out {
  return _tf.chunkOriginInto(face, level, ix, iy, out);
}
