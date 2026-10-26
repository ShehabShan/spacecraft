/**
 * ============================================================================
 *  TERRAIN WORKER — CHUNK GENERATION WITH THE TRANSFERABLE RECYCLING LOOP
 *  Milestone 1C · Spec 01.2 (worker pipeline), 04.3 (Zero-GC mesh pooling)
 * ============================================================================
 *  PROTOCOL (all heavy data moves are zero-copy Transfers):
 *    main → worker  {t:'init', params, sets}                    (boot)
 *    main → worker  {t:'req',  a: Float64Array}   TRANSFER [a]  (batch of
 *                  [count, (key,face,level,ix,iy)×count])        requests)
 *    worker → main  {t:'chunk', key, p,n,u,i, free, a?} TRANSFER (per chunk;
 *                  `a` (the request array) rides the FIRST response)
 *    worker → main  {t:'drop', key, a?} TRANSFER                (defensive)
 *    main → worker  {t:'ret',  b: ArrayBuffer[]}  TRANSFER      (recycled
 *                                                                buffer sets)
 *
 *  OWNERSHIP: a buffer set exists in exactly one place at a time — worker
 *  pool → in flight → bound to a mesh → return queue → worker pool. The
 *  worker allocates its pool ONCE at init; thereafter it only fills and
 *  transfers. Worker-side envelope/view allocations live on the WORKER heap
 *  (independent GC — invisible to the main-thread Zero-GC mandate).
 *
 *  GENERATION (per chunk): every vertex is derived from GLOBAL grid lines
 *  (the bit-exact invariant in terrainField.ts), positions are exported as
 *  Float32 CHUNK-LOCAL coordinates relative to the chunk's Float64 origin
 *  (f64 subtraction first, single narrowing at the store), normals come
 *  from the pure field normal (bitwise-consistent across chunks), and the
 *  padded ring is a radial skirt dropped toward the planet core.
 */


import {
  GRID_N, GRID_W, CHUNK_INDEX_COUNT, CHUNK_POS_FLOATS, CHUNK_NRM_FLOATS,
  CHUNK_UV_FLOATS, chunkOriginInto, gridCoord, initTerrainField,
  skirtDepthFor, terrainHeight, terrainNormalInto,
  type TerrainParams,
} from '../core/terrain/terrainField';
import { FACE_C, FACE_U, FACE_V, type Vec3Out } from '../core/terrain/spherify';


/* -- worker-scope typing shim (module worker, DOM lib tsconfig) ------------ */
interface WorkerCtx {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent) => void) | null;
}
const ctx = self as unknown as WorkerCtx;


/* -- message shapes -------------------------------------------------------- */
interface InitMsg { t: 'init'; params: TerrainParams; sets: number; }
interface ReqMsg  { t: 'req'; a: Float64Array; }
interface RetMsg  { t: 'ret'; b: ArrayBuffer[]; }
type Inbound = InitMsg | ReqMsg | RetMsg;
interface ChunkOut { t: 'chunk'; key: number; p: Float32Array; n: Float32Array; u: Float32Array; i: Uint16Array; free: number; a?: Float64Array; }
interface DropOut  { t: 'drop'; key: number; a?: Float64Array; }


/* -- worker state ---------------------------------------------------------- */
interface BufferSet { pos: Float32Array; nrm: Float32Array; uv: Float32Array; idx: Uint16Array; }


const setPool: BufferSet[] = [];
let P: TerrainParams | null = null;
let MASTER_IDX: Uint16Array | null = null;
let ready = false;


/* Module scratch (allocated once per worker — zero per-chunk allocation). */
const _org: Vec3Out = { x: 0, y: 0, z: 0 };
const _nrm: Vec3Out = { x: 0, y: 0, z: 0 };
const _rho = new Float64Array(GRID_W * GRID_W);   // per-vertex radius (R+h)


/** Index buffer is identical for every chunk (same padded-grid topology):
 *  built once, memcpy'd into each transferred set. */
function buildMasterIndex(): Uint16Array {
  const idx = new Uint16Array(CHUNK_INDEX_COUNT);
  let q = 0;
  for (let j = 0; j < GRID_W - 1; j++) {
    for (let i = 0; i < GRID_W - 1; i++) {
      const a = j * GRID_W + i, b = a + 1, c = a + GRID_W + 1, d = a + GRID_W;
      // Outward CCW winding (U×V = C on every face — verified in spherify.ts)
      idx[q++] = a; idx[q++] = b; idx[q++] = c;
      idx[q++] = a; idx[q++] = c; idx[q++] = d;
    }
  }
  return idx;
}


/** Radial skirt drop: duplicate an edge vertex toward the planet core. */
function dropVertex(
  dst: number, src: number, skirt: number,
  ox: number, oy: number, oz: number,
  pos: Float32Array, nrm: Float32Array, uv: Float32Array,
): void {
  const rho = _rho[src];
  const s = (rho - skirt) / rho;
  const ks = src * 3, kd = dst * 3;
  const wx = pos[ks] + ox, wy = pos[ks + 1] + oy, wz = pos[ks + 2] + oz;
  pos[kd] = wx * s - ox;
  pos[kd + 1] = wy * s - oy;
  pos[kd + 2] = wz * s - oz;
  nrm[kd] = nrm[ks]; nrm[kd + 1] = nrm[ks + 1]; nrm[kd + 2] = nrm[ks + 2];
  const us = src * 2, ud = dst * 2;
  uv[ud] = uv[us]; uv[ud + 1] = uv[us + 1];
}


/**
 * THE CHUNK GENERATOR. Fills a pooled buffer set. Zero allocation.
 *
 * Interior: (N+1)² vertices from global grid lines; the spherified-cube
 * math is applied inline (exact component formula — never normalize()).
 * Ring: 4·(N+1) + 4 skirt vertices, edge duplicates dropped radially.
 */
function generateChunk(key: number, face: number, level: number, ix: number, iy: number, set: BufferSet): void {
  const N = GRID_N, W = GRID_W;
  const D = N << level;                 // power-of-two divisor — exact division
  const R = P!.radius;
  chunkOriginInto(face, level, ix, iy, _org);   // bit-identical to main thread
  const ox = _org.x, oy = _org.y, oz = _org.z;
  const pos = set.pos, nrm = set.nrm, uv = set.uv;
  const f3 = face * 3;
  const Cx = FACE_C[f3], Cy = FACE_C[f3 + 1], Cz = FACE_C[f3 + 2];
  const Ux = FACE_U[f3], Uy = FACE_U[f3 + 1], Uz = FACE_U[f3 + 2];
  const Vx = FACE_V[f3], Vy = FACE_V[f3 + 1], Vz = FACE_V[f3 + 2];


  // -- interior vertices (rows/cols 1..N+1) --------------------------------
  for (let j = 1; j <= N + 1; j++) {
    const jj = j - 1;
    const v = gridCoord(iy * N + jj, D);
    for (let i = 1; i <= N + 1; i++) {
      const ii = i - 1;
      const u = gridCoord(ix * N + ii, D);
      // cube point (exact: table entries in {−1,0,1})
      const cx = Cx + u * Ux + v * Vx;
      const cy = Cy + u * Uy + v * Vy;
      const cz = Cz + u * Uz + v * Vz;
      // spherified cube (exact component formula)
      const x2 = cx * cx, y2 = cy * cy, z2 = cz * cz;
      const dx = cx * Math.sqrt(1 - y2 * 0.5 - z2 * 0.5 + (y2 * z2) / 3);
      const dy = cy * Math.sqrt(1 - z2 * 0.5 - x2 * 0.5 + (z2 * x2) / 3);
      const dz = cz * Math.sqrt(1 - x2 * 0.5 - y2 * 0.5 + (x2 * y2) / 3);
      // height (pure f64 field) + chunk-local f32 export
      const h = terrainHeight(dx, dy, dz);
      const r = R + h;
      const k = (j * W + i) * 3;
      pos[k] = dx * r - ox;
      pos[k + 1] = dy * r - oy;
      pos[k + 2] = dz * r - oz;
      _rho[j * W + i] = r;
      // seamless field normal (bitwise-consistent across all chunks)
      terrainNormalInto(dx, dy, dz, _nrm);
      nrm[k] = _nrm.x; nrm[k + 1] = _nrm.y; nrm[k + 2] = _nrm.z;
      const k2 = (j * W + i) * 2;
      uv[k2] = ii / N;   // exact: N is a power of two
      uv[k2 + 1] = jj / N;
    }
  }


  // -- skirt ring (edge duplicates dropped radially toward the core) -------
  const skirt = skirtDepthFor(level);
  for (let i = 1; i <= N + 1; i++) {
    dropVertex(i, W + i, skirt, ox, oy, oz, pos, nrm, uv);              // j=0
    dropVertex((W - 1) * W + i, (W - 2) * W + i, skirt, ox, oy, oz, pos, nrm, uv); // j=W−1
  }
  for (let j = 1; j <= N + 1; j++) {
    dropVertex(j * W, j * W + 1, skirt, ox, oy, oz, pos, nrm, uv);      // i=0
    dropVertex(j * W + W - 1, j * W + W - 2, skirt, ox, oy, oz, pos, nrm, uv); // i=W−1
  }
  dropVertex(0, W + 1, skirt, ox, oy, oz, pos, nrm, uv);                          // corners
  dropVertex(W - 1, W + W - 2, skirt, ox, oy, oz, pos, nrm, uv);
  dropVertex((W - 1) * W, (W - 2) * W + 1, skirt, ox, oy, oz, pos, nrm, uv);
  dropVertex((W - 1) * W + W - 1, (W - 2) * W + W - 2, skirt, ox, oy, oz, pos, nrm, uv);


  // -- indices: identical topology for every chunk (memcpy) ----------------
  set.idx.set(MASTER_IDX!);
}


/* -- boot & message pump ---------------------------------------------------- */
function initSets(count: number): void {
  for (let i = 0; i < count; i++) {
    setPool.push({
      pos: new Float32Array(CHUNK_POS_FLOATS),   // the ONLY terrain-buffer
      nrm: new Float32Array(CHUNK_NRM_FLOATS),   // allocations in the whole
      uv: new Float32Array(CHUNK_UV_FLOATS),     // system — boot, once
      idx: new Uint16Array(CHUNK_INDEX_COUNT),
    });
  }
}


ctx.onmessage = (ev: MessageEvent) => {
  const m = ev.data as Inbound;
  if (m.t === 'init') {
    P = m.params;
    initTerrainField(m.params);      // same seed → same tables as main thread
    MASTER_IDX = buildMasterIndex();
    initSets(m.sets);
    ready = true;
    return;
  }
  if (!ready) return;
  if (m.t === 'ret') {
    // Recycled buffers re-enter the pool (view wrappers only — zero copy).
    const b = m.b;
    for (let i = 0; i + 3 < b.length; i += 4) {
      setPool.push({
        pos: new Float32Array(b[i]),
        nrm: new Float32Array(b[i + 1]),
        uv: new Float32Array(b[i + 2]),
        idx: new Uint16Array(b[i + 3]),
      });
    }
    return;
  }
  if (m.t === 'req') {
    const a = m.a;                    // ownership of this array is OURS now
    const n = a[0];
    for (let k = 0; k < n; k++) {
      const key = a[1 + k * 5], face = a[2 + k * 5], level = a[3 + k * 5];
      const ix = a[4 + k * 5], iy = a[5 + k * 5];
      // F10b: the request array rides the LAST response of the batch.
      // Transferring it on the first detached it mid-loop — every later
      // read returned undefined. All reads above happen while the array
      // is still worker-owned.
      const last = k === n - 1;
      const set = setPool.pop();
      if (set === undefined) {
        // Defensive: cannot happen while inFlightCap ≤ pool (enforced by
        // the main thread), but never leave a request unanswered.
        if (last) { ctx.postMessage({ t: 'drop', key, a } as DropOut, [a.buffer]); }
        else { ctx.postMessage({ t: 'drop', key } as DropOut); }
        continue;
      }
      generateChunk(key, face, level, ix, iy, set);
      const msg: ChunkOut = {
        t: 'chunk', key,
        p: set.pos, n: set.nrm, u: set.uv, i: set.idx,
        free: setPool.length,
      };
      if (last) {
        msg.a = a;                    // return the request array for reuse
        ctx.postMessage(msg, [set.pos.buffer, set.nrm.buffer, set.uv.buffer, set.idx.buffer, a.buffer]);
      } else {
        ctx.postMessage(msg, [set.pos.buffer, set.nrm.buffer, set.uv.buffer, set.idx.buffer]);
      }
    }
    // `a` is always returned: the last iteration always posts (chunk or
    // drop path), and n ≥ 1 (the main thread never dispatches empty batches).
  }
};
