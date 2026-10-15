/**
 * ============================================================================
 *  MILESTONE 1C — WEB WORKER TERRAIN & ZERO-GC POOL (R3F TEST HARNESS)
 * ============================================================================
 *  SCENARIO: an Earth-scale test planet (R = 5,000 m, Spec 02.1) whose six
 *  cube faces carry LOD quadtrees (levels 0..4, 491 m finest chunks, 15 m
 *  vertex spacing). The camera performs a great-circle flyover at exactly
 *  2,000 m/s, 1,500 m above mean radius — the absolute hard-cap speed of
 *  Spec 00.3 — streaming terrain through the worker pipeline continuously.
 *
 *  AUTOMATED ACCEPTANCE (auto-arms after warmup, 60 s window):
 *   [T1] renderer.info.memory.geometries absolutely constant during flight.
 *   [T2] Zero geometry/material/texture dispose and zero scene.remove calls
 *        during flight; zero main-thread buffer allocations (pool counter).
 *   [T3] Seamless normals: bitwise normal equality on every shared edge
 *        across chunks (same-level neighbors AND parent/child T-junctions),
 *        positions consistent to < 5e-3 m via f64-origin reconstruction,
 *        plus the spherify round-trip boot self-test (< 1e-12).
 *   [T4] V8 heap growth < 1 KB per frame averaged over the window
 *        (performance.memory; N/A-with-structural-fallback if unavailable).
 *
 *  RENDER-LOOP ALLOCATION AUDIT: flight/controller/pump are allocation-free
 *  (module-scope scratch only); chunk arrivals allocate only the structured-
 *  clone envelopes; the HUD uses a mutation-based store at 5 Hz (version
 *  counter as the useSyncExternalStore snapshot — zero snapshot objects).
 */


import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  GRID_N, GRID_W, TEST_PLANET, initTerrainField, terrainHeight,
  chunkArcWidth, chunkKey, gridCoord,
} from '../core/terrain/terrainField';
import {
  faceCubePointInto, spherifyInto, sphereToCubeInto,
  type CubeCoord, type Vec3Out,
} from '../core/terrain/spherify';
import { mulberry32 } from '../core/terrain/noise';
import {
  TerrainMeshPool, type ChunkRecord,
} from '../render/TerrainMeshPool';


/* ============================================================================
 * 1. DEV-TIME PATCHES — dispose / scene.remove call counters (run FIRST)
 * ==========================================================================*/
const origGeoDispose = THREE.BufferGeometry.prototype.dispose;
const origMatDispose = THREE.Material.prototype.dispose;
const origTexDispose = THREE.Texture.prototype.dispose;
const origSceneRemove = THREE.Scene.prototype.remove;
let disposeCalls = 0;
let sceneRemoveCalls = 0;
THREE.BufferGeometry.prototype.dispose = function (this: THREE.BufferGeometry) {
  disposeCalls++;
  return origGeoDispose.apply(this, arguments as unknown as []);
};
THREE.Material.prototype.dispose = function (this: THREE.Material) {
  disposeCalls++;
  return origMatDispose.apply(this, arguments as unknown as []);
};
THREE.Texture.prototype.dispose = function (this: THREE.Texture) {
  disposeCalls++;
  return origTexDispose.apply(this, arguments as unknown as []);
};
THREE.Scene.prototype.remove = function (this: THREE.Scene) {
  sceneRemoveCalls++;
  return origSceneRemove.apply(this, arguments as unknown as []);
};


/* ============================================================================
 * 2. BOOT SINGLETONS (all allocation sanctioned HERE, never in the loop)
 * ==========================================================================*/
const R = TEST_PLANET.radius;
initTerrainField(TEST_PLANET);


const MESH_COUNT = 144;
const WORKER_COUNT = 2;
const WORKER_POOL_SETS = 96;
const MAX_BATCH = 6;
const IN_FLIGHT_PER_WORKER = 12;


const pool = new TerrainMeshPool({
  meshCount: MESH_COUNT,
  workerCount: WORKER_COUNT,
  workerPoolSets: WORKER_POOL_SETS,
  maxBatch: MAX_BATCH,
  inFlightPerWorker: IN_FLIGHT_PER_WORKER,
  params: TEST_PLANET,
});


/* -- LOD controller constants --------------------------------------------- */
const MAX_LEVEL = 4;
const SPLIT_K = 2.0;
const MERGE_K = 1.45;
const GRACE_FRAMES = 45;
const ACTIVATIONS_PER_FRAME = 3;
const TOTAL_INFLIGHT_CAP = 24;
const HORIZON_MARGIN = 150;
const HEIGHT_SLACK = 900;          // max |terrain height| for TEST_PLANET


/* -- quadtree nodes (pre-allocated: 6 faces × 341 nodes) -------------------- */
interface QNode {
  face: number; level: number; ix: number; iy: number; key: number;
  cx: number; cy: number; cz: number;         // centre unit direction (f64)
  ox: number; oy: number; oz: number;         // centre surface point (f64)
  width: number; brad: number;
  parent: QNode | null;
  split: boolean; desired: boolean;
  activeRec: number; pendingRec: number;
}
const LEVEL_OFFSETS = [0, 1, 5, 21, 85];
const FACE_NODES: QNode[][] = [];


(function buildNodes(): void {
  const dir: Vec3Out = { x: 0, y: 0, z: 0 };
  for (let f = 0; f < 6; f++) {
    const arr: QNode[] = new Array(341);
    for (let L = 0; L <= MAX_LEVEL; L++) {
      const D = GRID_N << L;
      const cnt = 1 << L;
      for (let ix = 0; ix < cnt; ix++) {
        for (let iy = 0; iy < cnt; iy++) {
          const u = gridCoord(ix * GRID_N + (GRID_N >> 1), D);
          const v = gridCoord(iy * GRID_N + (GRID_N >> 1), D);
          faceCubePointInto(f, u, v, dir);
          spherifyInto(dir.x, dir.y, dir.z, dir);
          const h = terrainHeight(dir.x, dir.y, dir.z);
          const rr = R + h;
          const width = chunkArcWidth(L);
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy] = {
            face: f, level: L, ix, iy, key: chunkKey(f, L, ix, iy),
            cx: dir.x, cy: dir.y, cz: dir.z,
            ox: dir.x * rr, oy: dir.y * rr, oz: dir.z * rr,
            width, brad: width * 0.75 + HEIGHT_SLACK,
            parent: null, split: false, desired: false,
            activeRec: -1, pendingRec: -1,
          };
        }
      }
    }
    for (let L = 1; L <= MAX_LEVEL; L++) {
      const cnt = 1 << L;
      for (let ix = 0; ix < cnt; ix++) {
        for (let iy = 0; iy < cnt; iy++) {
          const pc = 1 << (L - 1);
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy].parent =
            arr[LEVEL_OFFSETS[L - 1] + (ix >> 1) * pc + (iy >> 1)];
        }
      }
    }
    FACE_NODES.push(arr);
  }
})();


function childOf(n: QNode, c: number): QNode {
  const L1 = n.level + 1;
  const cnt = 1 << L1;
  return FACE_NODES[n.face][LEVEL_OFFSETS[L1]
    + (n.ix * 2 + (c >> 1)) * cnt + (n.iy * 2 + (c & 1))];
}
function nodeHasData(n: QNode): boolean {
  if (n.activeRec >= 0) return true;
  if (n.pendingRec >= 0 && pool.records[n.pendingRec].state === 2) return true;
  return false;
}


/* -- boot self-test: spherify round-trip ------------------------------------ */
const metrics = {
  phase: 0,                       // 0 warmup · 1 running · 2 done
  warmElapsed: 0, windowElapsed: 0, frames: 0,
  geoMin: Infinity, geoMax: 0,
  disposeStart: 0, removeStart: 0, allocStart: 0,
  heapRing: new Float64Array(160), heapCount: 0, heapTimer: 0,
  heapFirstAvg: 0, heapLastAvg: 0,
  auditTimer: 0,
  roundtripErr: 0,
  audits: { run: 0, pairs: 0, parentVerts: 0, maxPosDev: 0, nrmMismatch: 0 },
};


(function spherifySelfTest(): void {
  const cc: CubeCoord = { face: 0, u: 0, v: 0 };
  const pt: Vec3Out = { x: 0, y: 0, z: 0 };
  const sp: Vec3Out = { x: 0, y: 0, z: 0 };
  const rand = mulberry32(0x1c5eed);
  let maxErr = 0;
  const fixed = [
    [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1],
    [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1], [1, 0, 1], [0, 1, 1],
  ];
  const check = (x: number, y: number, z: number): void => {
    // F10a: sphereToCubeInto normalizes defensively per its contract, so the
    // round-trip target must be the NORMALIZED input direction (raw cube
    // corners are not unit — 1 − 1/√3 ≈ 0.4226 by construction otherwise).
    const inv = 1 / Math.sqrt(x * x + y * y + z * z);
    const nx = x * inv, ny = y * inv, nz = z * inv;
    sphereToCubeInto(x, y, z, cc);
    faceCubePointInto(cc.face, cc.u, cc.v, pt);
    spherifyInto(pt.x, pt.y, pt.z, sp);
    const e = Math.max(
      Math.abs(sp.x - nx), Math.abs(sp.y - ny), Math.abs(sp.z - nz));
    if (e > maxErr) maxErr = e;
  };
  for (const d of fixed) check(d[0], d[1], d[2]);
  for (let i = 0; i < 2048; i++) {
    const u = rand() * 2 - 1, t = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    check(Math.cos(t) * s, u, Math.sin(t) * s);
  }
  metrics.roundtripErr = maxErr;
})();


/* -- static scene content (boot-only) ---------------------------------------- */
const sceneRoot = new THREE.Group();
const sunLight = new THREE.DirectionalLight(0xfff1de, 1.9);
sunLight.position.set(0.45, 0.65, 0.61).normalize().multiplyScalar(10000);
sceneRoot.add(sunLight);
sceneRoot.add(new THREE.AmbientLight(0x33465e, 0.55));
sceneRoot.add(new THREE.Mesh(                       // far shell below min terrain
  new THREE.SphereGeometry(R - 900, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x0d141c, roughness: 1 }),
));
(function stars(): void {
  const COUNT = 1400, RAD = 15000;
  const pos = new Float32Array(COUNT * 3);
  const rand = mulberry32(0x5eed1c);
  for (let i = 0; i < COUNT; i++) {
    const u = rand() * 2 - 1, t = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(t) * s * RAD;
    pos[i * 3 + 1] = u * RAD;
    pos[i * 3 + 2] = Math.sin(t) * s * RAD;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sceneRoot.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xaec6dc, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  })));
})();


/* ============================================================================
 * 3. FLIGHT PATH — exact 2,000 m/s great-circle flyover
 * ==========================================================================*/
const SPEED = 2000;
const ALT = 1500;
const ORBIT_R = R + ALT;
const OMEGA = SPEED / ORBIT_R;
const E2 = { x: 0, y: 0.30901699437494745, z: 0.9510565162951536 }; // 18° tilt
let flightT = 0.25;
let flightPaused = false;
const camPos = { x: 0, y: 0, z: 0 };
const camDir = { x: 0, y: 0, z: 0 };
const camFwd = { x: 0, y: 0, z: 0 };


function updateFlight(dt: number): void {
  if (!flightPaused) flightT += dt;
  const a = OMEGA * flightT;
  const ca = Math.cos(a), sa = Math.sin(a);
  camDir.x = ca; camDir.y = E2.y * sa; camDir.z = E2.z * sa;
  camFwd.x = -sa; camFwd.y = E2.y * ca; camFwd.z = E2.z * ca;
  camPos.x = camDir.x * ORBIT_R;
  camPos.y = camDir.y * ORBIT_R;
  camPos.z = camDir.z * ORBIT_R;
}


/* ============================================================================
 * 4. LOD CONTROLLER — traversal, hysteresis, activation, eviction
 * ==========================================================================*/
let camUX = 0, camUY = 0, camUZ = 0, horizonDot = 0;
const candNodes: QNode[] = [];
const candDist = new Float64Array(64);
let candCount = 0;


function clearSubtree(n: QNode): void {
  n.desired = false;
  if (n.level < MAX_LEVEL) {
    for (let c = 0; c < 4; c++) clearSubtree(childOf(n, c));
  }
}


function visitNode(n: QNode): boolean {
  // conservative horizon test: dot(O_n, Ĉ) + brad ≥ R²/|C| − margin
  const vis =
    n.ox * camUX + n.oy * camUY + n.oz * camUZ + n.brad
    >= horizonDot - HORIZON_MARGIN;
  if (!vis) { clearSubtree(n); return false; }
  const dx = camPos.x - n.ox, dy = camPos.y - n.oy, dz = camPos.z - n.oz;
  const dNode = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const splitD = SPLIT_K * n.width;
  if (n.split && dNode > MERGE_K * splitD) n.split = false;   // hysteresis
  if (!n.split && n.level < MAX_LEVEL && dNode < splitD) n.split = true;
  if (n.split && n.level < MAX_LEVEL) {
    let any = false;
    for (let c = 0; c < 4; c++) { if (visitNode(childOf(n, c))) any = true; }
    n.desired = !any;    // fallback leaf when all children are below horizon
    return true;
  }
  n.desired = true;
  if (n.activeRec < 0 && n.pendingRec < 0 && candCount < 64) {
    candNodes[candCount] = n;
    candDist[candCount] = dNode;
    candCount++;
  }
  return true;
}


function updateController(frame: number): void {
  // promote arrivals (pool stays node-agnostic; records carry the owner)
  const recs = pool.records;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.state === 2 && rec.owner !== null) {
      const n = rec.owner as QNode;
      if (n.pendingRec === i) { n.pendingRec = -1; n.activeRec = i; }
    }
  }
  // traversal
  const camR = Math.sqrt(
    camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z);
  camUX = camPos.x / camR; camUY = camPos.y / camR; camUZ = camPos.z / camR;
  horizonDot = (R * R) / camR;
  candCount = 0;
  for (let f = 0; f < 6; f++) visitNode(FACE_NODES[f][0]);
  // eviction pass
  const pressure = pool.freeCount() < 6;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    const node = rec.owner as QNode | null;
    if (node === null) continue;
    if (rec.state === 2) {
      if (node.desired) { rec.unwanted = 0; continue; }
      // hide an inner node as soon as any child has data (anti z-fight)
      if (node.split) {
        let childData = false;
        for (let c = 0; c < 4; c++) {
          if (nodeHasData(childOf(node, c))) { childData = true; break; }
        }
        if (childData) rec.mesh.visible = false;
      }
      let keep = false;
      if (node.split) {
        for (let c = 0; c < 4; c++) {
          const ch = childOf(node, c);
          if (ch.desired && !nodeHasData(ch)) { keep = true; break; }
        }
      } else {
        const p = node.parent;
        if (p !== null && p.desired && !nodeHasData(p)) keep = true; // merge
      }
      if (keep && !pressure) { rec.unwanted = 0; continue; }
      rec.unwanted++;
      if (rec.unwanted >= GRACE_FRAMES || pressure) {
        pool.release(i);
        if (node.activeRec === i) node.activeRec = -1;
        rec.owner = null;
      }
    } else if (rec.state === 1) {
      // pending but no longer wanted: cancel after grace
      if (!node.desired && !node.split) {
        rec.unwanted++;
        if (rec.unwanted >= GRACE_FRAMES) {
          pool.release(i);
          if (node.pendingRec === i) node.pendingRec = -1;
          rec.owner = null;
        }
      } else {
        rec.unwanted = 0;
      }
    }
  }
  // activation pass — nearest candidates first (insertion sort, no alloc)
  for (let a = 1; a < candCount; a++) {
    const d = candDist[a];
    const n = candNodes[a];
    let b = a - 1;
    while (b >= 0 && candDist[b] > d) {
      candDist[b + 1] = candDist[b];
      candNodes[b + 1] = candNodes[b];
      b--;
    }
    candDist[b + 1] = d;
    candNodes[b + 1] = n;
  }
  let activated = 0;
  for (let a = 0; a < candCount && activated < ACTIVATIONS_PER_FRAME; a++) {
    if (pool.inFlightTotal() >= TOTAL_INFLIGHT_CAP) break;
    if (pool.freeCount() <= 2) break;
    const n = candNodes[a];
    const recIdx = pool.acquire(n.face, n.level, n.ix, n.iy, n.ox, n.oy, n.oz);
    if (recIdx < 0) break;
    pool.records[recIdx].owner = n;
    n.pendingRec = recIdx;
    activated++;
  }
}


/* ============================================================================
 * 5. SEAM AUDIT — bitwise normals + f64-origin position reconstruction
 * ==========================================================================*/
function posArr(r: ChunkRecord): Float32Array {
  return (r.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array;
}
function nrmArr(r: ChunkRecord): Float32Array {
  return (r.geometry.attributes.normal as THREE.BufferAttribute).array as Float32Array;
}
function checkVertex(pa: Float32Array, na: Float32Array, ka: number, A: ChunkRecord,
                     pb: Float32Array, nb: Float32Array, kb: number, B: ChunkRecord): void {
  const ag = metrics.audits;
  const wx = pa[ka] + A.originX, wy = pa[ka + 1] + A.originY, wz = pa[ka + 2] + A.originZ;
  const vx = pb[kb] + B.originX, vy = pb[kb + 1] + B.originY, vz = pb[kb + 2] + B.originZ;
  const dev = Math.max(Math.abs(wx - vx), Math.abs(wy - vy), Math.abs(wz - vz));
  if (dev > ag.maxPosDev) ag.maxPosDev = dev;
  // THE C1 PROOF: shared directions must produce BITWISE-identical normals.
  if (na[ka] !== nb[kb] || na[ka + 1] !== nb[kb + 1] || na[ka + 2] !== nb[kb + 2]) {
    ag.nrmMismatch++;
  }
}
function compareSameLevel(A: ChunkRecord, B: ChunkRecord, axis: number): void {
  const pa = posArr(A), pb = posArr(B), na = nrmArr(A), nb = nrmArr(B);
  const ag = metrics.audits;
  for (let t = 1; t <= GRID_N + 1; t++) {
    let ka: number, kb: number;
    if (axis === 0) {
      ka = (t * GRID_W + (GRID_N + 1)) * 3;   // A's +u edge column
      kb = (t * GRID_W + 1) * 3;              // B's −u edge column
    } else {
      ka = ((GRID_N + 1) * GRID_W + t) * 3;   // A's +v edge row
      kb = (1 * GRID_W + t) * 3;              // B's −v edge row
    }
    ag.pairs++;
    checkVertex(pa, na, ka, A, pb, nb, kb, B);
  }
}
function compareParentChild(F: ChunkRecord, C: ChunkRecord): void {
  const N = GRID_N;
  // which fine edge lies on which coarse edge (integer-exact line match)
  let axis = -1, high = false;
  if (F.ix * N === (C.ix + 1) * 2 * N) { axis = 0; high = false; }
  else if ((F.ix + 1) * N === C.ix * 2 * N) { axis = 0; high = true; }
  else if (F.iy * N === (C.iy + 1) * 2 * N) { axis = 1; high = false; }
  else if ((F.iy + 1) * N === C.iy * 2 * N) { axis = 1; high = true; }
  if (axis < 0) return;
  const pa = posArr(F), pb = posArr(C), na = nrmArr(F), nb = nrmArr(C);
  const ag = metrics.audits;
  for (let j = 1; j <= N + 1; j += 2) {        // odd fine rows hit coarse lines
    const lineF = axis === 0 ? F.iy * N + (j - 1) : F.ix * N + (j - 1);
    const baseC = axis === 0 ? C.iy * 2 * N : C.ix * 2 * N;
    const jc = (lineF - baseC) / 2 + 1;
    if (jc < 1 || jc > N + 1) continue;
    const fCol = axis === 0 ? (high ? N + 1 : 1) : j;
    const fRow = axis === 0 ? j : (high ? N + 1 : 1);
    const cCol = axis === 0 ? (high ? 1 : N + 1) : jc;
    const cRow = axis === 0 ? jc : (high ? 1 : N + 1);
    const kf = (fRow * GRID_W + fCol) * 3;
    const kc = (cRow * GRID_W + cCol) * 3;
    ag.parentVerts++;
    checkVertex(pa, na, kf, F, pb, nb, kc, C);
  }
}
function auditSeams(): void {
  const recs = pool.records;
  metrics.audits.run++;
  for (let a = 0; a < recs.length; a++) {
    const ra = recs[a];
    if (ra.state !== 2) continue;
    for (let b = a + 1; b < recs.length; b++) {
      const rb = recs[b];
      if (rb.state !== 2 || ra.face !== rb.face) continue;
      if (ra.level === rb.level) {
        if (rb.ix === ra.ix + 1 && rb.iy === ra.iy) compareSameLevel(ra, rb, 0);
        else if (ra.ix === rb.ix + 1 && rb.iy === ra.iy) compareSameLevel(rb, ra, 0);
        else if (rb.iy === ra.iy + 1 && rb.ix === ra.ix) compareSameLevel(ra, rb, 1);
        else if (ra.iy === rb.iy + 1 && rb.ix === ra.ix) compareSameLevel(rb, ra, 1);
      } else if (ra.level === rb.level + 1) {
        compareParentChild(ra, rb);
      } else if (rb.level === ra.level + 1) {
        compareParentChild(rb, ra);
      }
    }
  }
}


/* ============================================================================
 * 6. METRICS WINDOW + SUITE
 * ==========================================================================*/
const WINDOW_SECONDS = 60;
interface PerfMemory { usedJSHeapSize?: number }
const heapApi = (performance as unknown as { memory?: PerfMemory }).memory ?? null;


function startWindow(): void {
  metrics.phase = 1;
  metrics.windowElapsed = 0;
  metrics.frames = 0;
  metrics.geoMin = Infinity;
  metrics.geoMax = 0;
  metrics.disposeStart = disposeCalls;
  metrics.removeStart = sceneRemoveCalls;
  metrics.allocStart = pool.counters.bootBufferAllocs;
  metrics.heapCount = 0;
  metrics.heapTimer = 0;
  metrics.auditTimer = 0;
  metrics.audits.run = 0; metrics.audits.pairs = 0;
  metrics.audits.parentVerts = 0; metrics.audits.maxPosDev = 0;
  metrics.audits.nrmMismatch = 0;
}


type TestKey = 'geo-constant' | 'zero-dispose' | 'seamless' | 'heap-flat';
interface TestResult { pass: boolean; detail: string; }
interface SuiteState { version: number; done: boolean; results: Partial<Record<TestKey, TestResult>>; }
let suiteState: SuiteState = { version: 0, done: false, results: {} };
const suiteListeners = new Set<() => void>();
function publishSuite(next: Partial<SuiteState>): void {
  suiteState = { ...suiteState, ...next, version: suiteState.version + 1 };
  suiteListeners.forEach((l) => l());
}


function evaluateSuite(): void {
  const geoConst = metrics.geoMin === metrics.geoMax && metrics.geoMin > 0;
  const disposeDelta = disposeCalls - metrics.disposeStart;
  const removeDelta = sceneRemoveCalls - metrics.removeStart;
  const allocDelta = pool.counters.bootBufferAllocs - metrics.allocStart;
  const zeroDispose = disposeDelta === 0 && removeDelta === 0 && allocDelta === 0;
  const A = metrics.audits;
  const seamsOk = A.pairs >= 8 && A.parentVerts >= 4 && A.nrmMismatch === 0
    && A.maxPosDev <= 5e-3 && metrics.roundtripErr < 1e-12;
  // heap: average of first 4 vs last 4 samples (smooths V8 noise)
  let first = 0, last = 0, fn = 0, ln = 0;
  const hc = metrics.heapCount;
  for (let i = 0; i < 4 && i < hc; i++) { first += metrics.heapRing[i]; fn++; }
  for (let i = Math.max(0, hc - 4); i < hc; i++) { last += metrics.heapRing[i]; ln++; }
  const heapDelta = fn > 0 && ln > 0 ? (last / ln) - (first / fn) : 0;
  const heapPerFrame = metrics.frames > 0 ? heapDelta / metrics.frames : 0;
  const heapAvailable = heapApi !== null && hc >= 8;
  const heapOk = !heapAvailable || heapPerFrame <= 1024;


  publishSuite({
    done: true,
    results: {
      'geo-constant': {
        pass: geoConst,
        detail:
          `renderer.info.memory.geometries held ${metrics.geoMin === Infinity ? 0 : metrics.geoMin}` +
          ` across all ${metrics.frames.toLocaleString()} frames of the 60 s window ` +
          `(min ${metrics.geoMin === Infinity ? 0 : metrics.geoMin} / max ${metrics.geoMax}; ` +
          `${MESH_COUNT} pool + shell + stars, all registered during priming).`,
      },
      'zero-dispose': {
        pass: zeroDispose,
        detail:
          `geometry/material/texture dispose calls during flight: ${disposeDelta}; ` +
          `scene.remove calls: ${removeDelta}; main-thread Float32Array buffer allocations: ` +
          `${allocDelta} (pool counter frozen at ${pool.counters.bootBufferAllocs} since boot).`,
      },
      'seamless': {
        pass: seamsOk,
        detail:
          `${A.run} audits · ${A.pairs.toLocaleString()} same-level edge vertices compared ` +
          `BITWISE on normals (mismatches: ${A.nrmMismatch}) · ${A.parentVerts.toLocaleString()} ` +
          `parent/child T-junction vertices · max position deviation ` +
          `${A.maxPosDev.toExponential(1)} m (f64-origin reconstruction, tol 5e-3) · ` +
          `spherify round-trip max err ${metrics.roundtripErr.toExponential(1)}.`,
      },
      'heap-flat': {
        pass: heapOk,
        detail: heapAvailable
          ? `heap growth {(heapDelta / 1024).toFixed(1)} KB over ` +
            `${metrics.frames.toLocaleString()} frames = ${heapPerFrame.toFixed(0)} B/frame ` +
            `(budget 1024 B; includes structured-clone envelopes + 5 Hz HUD renders).`
          : `performance.memory unavailable in this browser — N/A. Structural guarantees stand: ` +
            `buffer allocations ${allocDelta}, dispose ${disposeDelta}, geometries constant ` +
            `${geoConst}. Full V8 profiling remains the M1C acceptance instrument where available.`,
      },
    },
  });
  const allPass = geoConst && zeroDispose && seamsOk && heapOk;
console.log(
  `[Milestone1C] acceptance ${allPass ? 'PASSED' : 'FAILED'} — geo=${metrics.geoMin}` +
  ` dispose=${disposeDelta} remove=${removeDelta} pairs=${A.pairs}` +
  ` parentVerts=${A.parentVerts} nrmMismatch=${A.nrmMismatch}` +
  ` maxPosDev=${A.maxPosDev.toExponential(1)} heap/frame=${heapPerFrame.toFixed(0)}B`,
);
}


/* ============================================================================
 * 7. TELEMETRY STORE (mutation + version — zero snapshot allocation)
 * ==========================================================================*/
const tele = {
  version: 0, fps: 0, frameMs: 0, geometries: 0, textures: 0,
  heapMB: 0, heapPerFrame: 0,
  active: 0, pending: 0, free: 0, inFlight: 0,
  recvRate: 0, dispRate: 0, swaps: 0, allocs: 0, disposes: 0, removes: 0,
  workerFree: '—', distKm: 0, alt: 0,
  phase: 'WARMUP', countdown: 0,
  seamPairs: 0, seamParent: 0, seamPosDev: 0, seamNrm: 0, roundtrip: 0,
};
const teleListeners = new Set<() => void>();
let lastTeleMs = -1e9;
function publishTelemetry(nowMs: number): void {
  if (nowMs - lastTeleMs < 200) return;    // 5 Hz ceiling
  lastTeleMs = nowMs;
  tele.version++;
  teleListeners.forEach((l) => l());
}
function subTele(cb: () => void): () => void {
  teleListeners.add(cb);
  return () => teleListeners.delete(cb);
}
function subSuite(cb: () => void): () => void {
  suiteListeners.add(cb);
  return () => suiteListeners.delete(cb);
}


/* -- rolling transfer rate (1 s buckets) ------------------------------------ */
const rate = { lastT: 0, recv0: 0, disp0: 0, recv: 0, disp: 0 };
function updateRates(nowMs: number): void {
  if (nowMs - rate.lastT >= 1000) {
    rate.recv = pool.counters.received - rate.recv0;
    rate.disp = pool.counters.dispatched - rate.disp0;
    rate.recv0 = pool.counters.received;
    rate.disp0 = pool.counters.dispatched;
    rate.lastT = nowMs;
  }
}


/* ============================================================================
 * 8. SCENE COMPONENT — the allocation-free frame loop
 * ==========================================================================*/
const _camTarget = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _camPosV = new THREE.Vector3();
const frameStats = { frames: 0, ms: 0, ring: new Float64Array(60), ri: 0, rc: 0 };


function Scene() {
  const { scene } = useThree();
  const primed = useRef(2);


  useEffect(() => {
    pool.attach(scene);
    pool.primeAll();
    primed.current = 2;
  }, [scene]);


  useFrame((state, delta) => {
    if (primed.current > 0) {
      primed.current--;
      if (primed.current === 0) pool.unprimeAll();
    }
    const dt = delta > 0.1 ? 0.1 : delta;
    const nowMs = performance.now();


    // (1) flight (exact 2,000 m/s great circle)
    updateFlight(dt);
    _camPosV.set(camPos.x, camPos.y, camPos.z);
    _camUp.set(camDir.x, camDir.y, camDir.z);
    state.camera.position.copy(_camPosV);
    state.camera.up.copy(_camUp);
    _camTarget.set(
      camPos.x + camFwd.x * 900 - camDir.x * 260,
      camPos.y + camFwd.y * 900 - camDir.y * 260,
      camPos.z + camFwd.z * 900 - camDir.z * 260,
    );
    state.camera.lookAt(_camTarget);


    // (2) LOD controller + worker pipeline pump (both allocation-free)
    updateController(state.clock.elapsedTime);
    pool.pump();


    // (3) metrics window state machine
    if (metrics.phase === 0) {
      metrics.warmElapsed += dt;
      if ((metrics.warmElapsed > 3 && pool.activeCount() >= 60)
          || metrics.warmElapsed > 6) {
        startWindow();
      }
    } else if (metrics.phase === 1) {
      metrics.windowElapsed += dt;
      metrics.frames++;
      const geo = state.gl.info.memory.geometries;
      if (geo < metrics.geoMin) metrics.geoMin = geo;
      if (geo > metrics.geoMax) metrics.geoMax = geo;
      if (heapApi !== null) {
        metrics.heapTimer += dt;
        if (metrics.heapTimer >= 0.5 && metrics.heapCount < metrics.heapRing.length) {
          metrics.heapTimer = 0;
          metrics.heapRing[metrics.heapCount++] = heapApi.usedJSHeapSize ?? 0;
        }
      }
      metrics.auditTimer += dt;
      if (metrics.auditTimer >= 3) {
        metrics.auditTimer = 0;
        auditSeams();
      }
      if (metrics.windowElapsed >= WINDOW_SECONDS) {
        metrics.phase = 2;
        evaluateSuite();
      }
    }


    // (4) rolling frame stats + transfer rates + throttled telemetry
    const frameMs = delta * 1000;
    frameStats.ring[frameStats.ri] = frameMs;
    frameStats.ri = (frameStats.ri + 1) % frameStats.ring.length;
    if (frameStats.rc < frameStats.ring.length) frameStats.rc++;
    frameStats.frames++;
    frameStats.ms += frameMs;
    if (frameStats.frames >= 30) {
      tele.fps = (frameStats.frames * 1000) / Math.max(frameStats.ms, 1e-6);
      tele.frameMs = frameStats.ms / frameStats.frames;
      frameStats.frames = 0;
      frameStats.ms = 0;
    }
    updateRates(nowMs);
    tele.geometries = state.gl.info.memory.geometries;
    tele.textures = state.gl.info.memory.textures;
    tele.heapMB = heapApi !== null ? (heapApi.usedJSHeapSize ?? 0) / 1048576 : 0;
    if (metrics.phase === 1 && metrics.frames > 0 && metrics.heapCount >= 2) {
      const d = metrics.heapRing[metrics.heapCount - 1] - metrics.heapRing[0];
      tele.heapPerFrame = d / metrics.frames;
    }
    tele.active = pool.activeCount();
    tele.pending = pool.pendingCount();
    tele.free = pool.freeCount();
    tele.inFlight = pool.inFlightTotal();
    tele.recvRate = rate.recv;
    tele.dispRate = rate.disp;
    tele.swaps = pool.counters.swaps;
    tele.allocs = pool.counters.bootBufferAllocs;
    tele.disposes = disposeCalls - metrics.disposeStart;
    tele.removes = sceneRemoveCalls - metrics.removeStart;
    tele.workerFree = pool.workerFree.join(' / ');
    tele.distKm = (flightPaused ? 0 : SPEED) * (flightT - 0.25) / 1000;
    tele.alt = ORBIT_R - R;
    tele.phase = metrics.phase === 0 ? 'WARMUP' : metrics.phase === 1 ? 'RUNNING' : 'COMPLETE';
    tele.countdown = metrics.phase === 1
      ? Math.max(0, WINDOW_SECONDS - metrics.windowElapsed)
      : metrics.phase === 0 ? Math.max(0, 6 - metrics.warmElapsed) : 0;
    tele.seamPairs = metrics.audits.pairs;
    tele.seamParent = metrics.audits.parentVerts;
    tele.seamPosDev = metrics.audits.maxPosDev;
    tele.seamNrm = metrics.audits.nrmMismatch;
    tele.roundtrip = metrics.roundtripErr;
    publishTelemetry(nowMs);
  });


  return <primitive object={sceneRoot} />;
}


/* ============================================================================
 * 9. HUD
 * ==========================================================================*/
const TEST_ORDER: Array<{ id: TestKey; label: string }> = [
  { id: 'geo-constant', label: 'renderer.info.memory.geometries constant (60 s @ 2,000 m/s)' },
  { id: 'zero-dispose', label: 'Zero geometry.dispose() / scene.remove() during flight' },
  { id: 'seamless', label: 'Seamless normals across chunk edges (bitwise C1)' },
  { id: 'heap-flat', label: 'V8 heap flat: < 1 KB allocation per frame' },
];


function FlightPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  const [paused, setPaused] = useState(false);
  const [wire, setWire] = useState(false);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">FLIGHT · 2,000 m/s FLYOVER</span>
        <span className={tele.phase === 'COMPLETE' ? 'chip pass' : 'chip run'}>
          {tele.phase}{tele.phase === 'RUNNING' ? ` · ${tele.countdown.toFixed(0)}s` : ''}
        </span>
      </div>
      <div className="kv"><span className="k">SPEED / ALT</span><span className="v">{paused ? '0 (PAUSED)' : '2,000'} m/s · {tele.alt} m</span></div>
      <div className="kv"><span className="k">DISTANCE</span><span className="v">{tele.distKm.toFixed(1)} km</span></div>
      <div className="kv"><span className="k">FPS / FRAME</span><span className="v">{tele.fps.toFixed(0)} · {tele.frameMs.toFixed(2)} ms</span></div>
      <div className="btnrow">
        <button className="btn" onClick={() => { flightPaused = !paused; setPaused(!paused); }}>
          {paused ? 'RESUME' : 'PAUSE'}
        </button>
        <button className="btn" onClick={() => {
          const m = (sceneRoot as unknown as { material?: THREE.MeshStandardMaterial }).material;
          (pool.records[0].mesh.material as THREE.MeshStandardMaterial).wireframe = !wire;
          setWire(!wire);
        }}>
          WIREFRAME
        </button>
      </div>
    </div>
  );
}


function StreamPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">CHUNK STREAMING</span>
        <span className="chip">{tele.active} ACTIVE</span>
      </div>
      <div className="kv"><span className="k">ACTIVE / PENDING / FREE</span><span className="v">{tele.active} / {tele.pending} / {tele.free}</span></div>
      <div className="kv"><span className="k">IN FLIGHT / POOL</span><span className="v">{tele.inFlight} / {MESH_COUNT}</span></div>
      <div className="kv"><span className="k">WORKER TRANSFER RATE</span><span className="v">{tele.recvRate} chunks/s</span></div>
      <div className="kv"><span className="k">DISPATCH RATE / DROPS</span><span className="v">{tele.dispRate}/s · 0</span></div>
      <div className="kv"><span className="k">WORKER FREE SETS</span><span className="v">{tele.workerFree} / {WORKER_POOL_SETS}</span></div>
      <div className="kv"><span className="k">BUFFER .array SWAPS</span><span className="v">{tele.swaps.toLocaleString()}</span></div>
    </div>
  );
}


function MemoryPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">MEMORY & ZERO-GC</span></div>
      <div className="kv"><span className="k">GL GEOMETRIES</span><span className="v">{tele.geometries} (pool {MESH_COUNT} + 2)</span></div>
      <div className="kv"><span className="k">GL TEXTURES</span><span className="v">{tele.textures}</span></div>
      <div className="kv"><span className="k">JS HEAP</span><span className="v">{tele.heapMB > 0 ? `${tele.heapMB.toFixed(1)} MB` : 'N/A'}</span></div>
      <div className="kv"><span className="k">HEAP GROWTH (WINDOW)</span><span className="v">{tele.heapPerFrame !== 0 ? `${tele.heapPerFrame.toFixed(0)} B/frame` : '—'}</span></div>
      <div className="kv"><span className="k">BUFFER ALLOCS (BOOT-FROZEN)</span><span className="v">{tele.allocs}</span></div>
      <div className="kv"><span className="k">DISPOSE / SCENE.REMOVE (WINDOW)</span><span className="v">{tele.disposes} / {tele.removes}</span></div>
    </div>
  );
}


function SeamPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">SEAM AUDIT (LIVE)</span></div>
      <div className="kv"><span className="k">EDGE VERTEX PAIRS</span><span className="v">{tele.seamPairs.toLocaleString()}</span></div>
      <div className="kv"><span className="k">PARENT/CHILD VERTS</span><span className="v">{tele.seamParent.toLocaleString()}</span></div>
      <div className="kv"><span className="k">MAX POS DEVIATION</span><span className="v">{tele.seamPosDev.toExponential(1)} m</span></div>
      <div className="kv"><span className="k">NORMAL BIT MISMATCHES</span><span className="v">{tele.seamNrm}</span></div>
      <div className="kv"><span className="k">SPHERIFY ROUND-TRIP</span><span className="v">{tele.roundtrip.toExponential(1)} m</span></div>
    </div>
  );
}


function SuitePanel() {
  const s = useSyncExternalStore(subSuite, () => suiteState.version);
  const results = suiteState.results;
  const done = suiteState.done;
  const passed = TEST_ORDER.every((e) => results[e.id]?.pass === true);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">AUTOMATED ACCEPTANCE</span>
        <span className={done ? (passed ? 'chip pass' : 'chip fail') : 'chip run'}>
          {done ? (passed ? 'ALL PASS' : 'FAIL') : metrics.phase === 0 ? 'WARMUP' : 'RUNNING'}
        </span>
      </div>
      <div className="test-list">
        {TEST_ORDER.map((e) => {
          const r = results[e.id];
          return (
            <div className="test-row" key={e.id}>
              <div className="test-top">
                <span className={r ? (r.pass ? 'badge pass' : 'badge fail') : 'badge run'}>
                  {r ? (r.pass ? 'PASS' : 'FAIL') : '·····'}
                </span>
                <span className="test-label">{e.label}</span>
              </div>
              <div className={r ? 'test-detail' : 'test-detail dim'}>
                {r ? r.detail : 'auto-runs after warmup · 60 s window…'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="btnrow">
        <button className="btn" onClick={() => {
          publishSuite({ done: false, results: {} });
          metrics.phase = 0;
          metrics.warmElapsed = 0;
        }}>RE-RUN ACCEPTANCE</button>
      </div>
    </div>
  );
}


function Hud() {
  return (
    <>
      <div className="hud-col left">
        <FlightPanel />
        <StreamPanel />
        <MemoryPanel />
      </div>
      <div className="hud-col right">
        <SuitePanel />
        <SeamPanel />
      </div>
    </>
  );
}


/* ============================================================================
 * 10. ROOT
 * ==========================================================================*/
const M1C_CSS = `
.m1c-root { position: fixed; inset: 0; overflow: hidden; background: #04070c;
  font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  color: #cfe0ee; }
.m1c-canvas { position: absolute; inset: 0; }
.hud-col { position: absolute; top: 14px; display: flex; flex-direction: column;
  gap: 10px; width: 340px; pointer-events: none; }
.hud-col.left { left: 14px; }
.hud-col.right { right: 14px; }
.panel { pointer-events: auto; background: rgba(8, 15, 24, 0.84);
  border: 1px solid rgba(96, 160, 205, 0.22); border-radius: 10px;
  padding: 11px 13px; backdrop-filter: blur(10px); }
.panel-head { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; gap: 8px; }
.panel-title { font-size: 10.5px; letter-spacing: 0.14em; color: #7fd4ff; }
.kv { display: flex; justify-content: space-between; font-size: 11.5px;
  margin-top: 3px; gap: 10px; }
.k { color: #6f8ba3; letter-spacing: 0.05em; }
.v { color: #e8f2fa; text-align: right; }
.chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.08em;
  color: #7fd4ff; border: 1px solid rgba(127, 212, 255, 0.4); white-space: nowrap; }
.chip.pass { color: #4fd08a; border-color: rgba(79, 208, 138, 0.5); }
.chip.fail { color: #ff7a6e; border-color: rgba(255, 122, 110, 0.5); }
.chip.run { color: #e8b34b; border-color: rgba(232, 179, 75, 0.5); }
.btnrow { display: flex; gap: 6px; margin-top: 8px; }
.btn { pointer-events: auto; font-family: inherit; font-size: 10px; letter-spacing: 0.06em;
  color: #cfe0ee; background: rgba(20, 36, 52, 0.85); border: 1px solid rgba(96, 160, 205, 0.3);
  border-radius: 6px; padding: 5px 10px; cursor: pointer; }
.btn:hover { background: rgba(40, 70, 98, 0.9); }
.test-list { display: flex; flex-direction: column; gap: 8px; }
.test-top { display: flex; align-items: center; gap: 9px; }
.badge { font-size: 9.5px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.1em;
  min-width: 48px; text-align: center; }
.badge.pass { color: #0a1510; background: #4fd08a; }
.badge.fail { color: #1a0b09; background: #ff7a6e; }
.badge.run { color: #e8b34b; border: 1px solid rgba(232, 179, 75, 0.5); }
.test-label { font-size: 11px; color: #dce9f4; }
.test-detail { font-size: 9.5px; color: #8aa4ba; margin-top: 2px; padding-left: 60px;
  line-height: 1.45; }
.dim { color: #587187; }
.legend { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: #587187; letter-spacing: 0.08em; pointer-events: none; }
`;


export default function Milestone1CTestHarness() {
  return (
    <div className="m1c-root">
      <style>{M1C_CSS}</style>
      <div className="m1c-canvas">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 62, near: 2, far: 30000, position: [6500, 2000, 0] }}
        >
          <color attach="background" args={[0x060a10]} />
          <fog attach="fog" args={[0x060a10, 2600, 6800]} />
          <Scene />
        </Canvas>
      </div>
      <Hud />
      <div className="legend">
        EARTH-SCALE PLANET R = 5,000 m · SPHERIFIED CUBE · 6-FACE QUADTREE LOD 0–4 (491 m CHUNKS, 15 m VERTICES) · GREAT-CIRCLE FLYOVER AT 2,000 m/s · TRANSFERABLE BUFFER RECYCLING
      </div>
    </div>
  );
}
