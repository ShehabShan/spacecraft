/**
 * ============================================================================
 *  DETERMINISTIC FLOAT64 3D SIMPLEX NOISE + fBm
 *  Milestone 1C · Spec 01.2 (3D noise), 02 (pure f64 core)
 * ============================================================================
 *  Simplex noise (Gustavson/Eastman public-domain formulation), all state in
 *  Float64/Uint8 typed arrays. DETERMINISM CONTRACT: the permutation table is
 *  built from a seeded mulberry32 PRNG — every worker (and the main thread)
 *  that builds a SimplexNoise (or calls initNoise) with the same seed produces
 *  bit-identical noise. This is a hard prerequisite for the zero-communication seam proof:
 *  identical direction d -> identical height bits in every worker.
 *
 *  No renderer/physics imports. No allocation after construction (hot path is
 *  pure arithmetic on preallocated tables).
 */


const GRAD3 = new Float64Array([
  1, 1, 0,  -1, 1, 0,  1, -1, 0,  -1, -1, 0,
  1, 0, 1,  -1, 0, 1,  1, 0, -1,  -1, 0, -1,
  0, 1, 1,  0, -1, 1,  0, 1, -1,  0, -1, -1,
]);


/** Deterministic PRNG (also exported for harness use). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


/**
 * One seeded simplex-noise instance (T5 S1a, F5a): the permutation tables
 * belong to the instance, so two bodies with different seeds never share or
 * overwrite each other's tables. Tables are built once in the constructor
 * (boot); noise3/fbm3/ridged3 are pure, allocation-free reads.
 */
export class SimplexNoise {
  readonly seed: number;
  readonly perm: Uint8Array;
  readonly permMod12: Uint8Array;

  constructor(seed: number) {
    this.seed = seed;
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {           // Fisher–Yates
      const j = (rand() * (i + 1)) | 0;
      const t = p[i]; p[i] = p[j]; p[j] = t;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  /** 3D simplex noise, roughly [−1, 1]. Pure, allocation-free, deterministic. */
  noise3(xin: number, yin: number, zin: number): number {
    const perm = this.perm, permMod12 = this.permMod12;
    const F3 = 1 / 3, G3 = 1 / 6;
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    let i1: number, j1: number, k1: number, i2: number, j2: number, k2: number;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else               { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0)       { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0)  { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else               { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3,       y1 = y0 - j1 + G3,       z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3,   y2 = y0 - j2 + 2 * G3,   z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 3 * G3,    y3 = y0 - 1 + 3 * G3,    z3 = z0 - 1 + 3 * G3;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 > 0) {
      const gi = permMod12[ii + perm[jj + perm[kk]]] * 3;
      t0 *= t0;
      n0 = t0 * t0 * (GRAD3[gi] * x0 + GRAD3[gi + 1] * y0 + GRAD3[gi + 2] * z0);
    }
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 > 0) {
      const gi = permMod12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
      t1 *= t1;
      n1 = t1 * t1 * (GRAD3[gi] * x1 + GRAD3[gi + 1] * y1 + GRAD3[gi + 2] * z1);
    }
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 > 0) {
      const gi = permMod12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
      t2 *= t2;
      n2 = t2 * t2 * (GRAD3[gi] * x2 + GRAD3[gi + 1] * y2 + GRAD3[gi + 2] * z2);
    }
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 > 0) {
      const gi = permMod12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
      t3 *= t3;
      n3 = t3 * t3 * (GRAD3[gi] * x3 + GRAD3[gi + 1] * y3 + GRAD3[gi + 2] * z3);
    }
    return 32 * (n0 + n1 + n2 + n3);
  }


  /** Fractional Brownian motion, normalized to ~[−1, 1]. */
  fbm3(x: number, y: number, z: number, octaves: number, lacunarity: number, gain: number): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.noise3(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }


  /** Ridged multifractal, [0, 1] — sharp mountain crests. */
  ridged3(x: number, y: number, z: number, octaves: number): number {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const n = 1 - Math.abs(this.noise3(x * freq, y * freq, z * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }
}


/* -- Default instance + module wrappers (pre-S1a API, unchanged output) ---- */
// WHY (T5 S1a, F5a): the module functions keep their signatures and bits; they
// read a default instance that initNoise(seed) replaces. Per-body code holds its
// own SimplexNoise (terrainField.ts TerrainField) and never touches this one.
let _default: SimplexNoise | null = null;


/** Build the default instance's tables. Idempotent per seed. Boot-only. */
export function initNoise(seed: number): void {
  if (_default !== null && seed === _default.seed) return;
  _default = new SimplexNoise(seed);
}


export function noise3(xin: number, yin: number, zin: number): number {
  return (_default as SimplexNoise).noise3(xin, yin, zin);
}


export function fbm3(x: number, y: number, z: number, octaves: number, lacunarity: number, gain: number): number {
  return (_default as SimplexNoise).fbm3(x, y, z, octaves, lacunarity, gain);
}


export function ridged3(x: number, y: number, z: number, octaves: number): number {
  return (_default as SimplexNoise).ridged3(x, y, z, octaves);
}
