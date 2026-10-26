/**
 * ============================================================================
 *  TERRAIN MESH POOL — MAIN-THREAD ZERO-GC MANAGER
 *  Milestone 1C · Spec 01.2 (buffer swap protocol), 04.3 (mesh pooling)
 * ============================================================================
 *  THE POOL: a fixed set of Mesh/BufferGeometry objects created at boot with
 *  FULL-SIZE boot arrays. During flight, received worker buffers are bound by
 *  swapping attribute `.array` IN PLACE and setting `needsUpdate` — three.js
 *  then performs a same-size `bufferSubData` upload with no GPU reallocation
 *  and no JS allocation. Retiring a chunk parks `.array` back on the boot
 *  arrays and TRANSFERS the worker buffers home. `geometry.dispose()` and
 *  `scene.remove()` DO NOT EXIST in the flight path (the harness patches
 *  both to prove it). `disposeAll()` exists for page teardown only.
 *
 *  MESSAGING: request parameter arrays ping-pong (2 per worker, transferred
 *  both ways); buffer returns are batched per worker per frame; the per-worker
 *  in-flight cap (12) is far below the worker pool (96) so a free set always
 *  exists. All queues/rings are boot-allocated — pump() allocates only the
 *  tiny postMessage envelopes (the structured-clone boundary, quantified in
 *  the 1C analysis at < ~150 B/frame amortized).
 */


import * as THREE from 'three';
import {
  CHUNK_INDEX_COUNT, CHUNK_NRM_FLOATS, CHUNK_POS_FLOATS, CHUNK_UV_FLOATS,
  chunkKey, type TerrainParams,
} from '../core/terrain/terrainField';


export interface PoolCounters {
  /** Buffer allocations performed (boot only — asserted frozen in flight). */
  bootBufferAllocs: number;
  swaps: number;        // attribute .array swaps ×1 (4 per chunk bind)
  received: number;
  dispatched: number;
  drops: number;
  returned: number;     // buffer sets returned to workers
  queueDrops: number;
}


export interface ChunkRecord {
  index: number;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  key: number;
  face: number;
  level: number;
  ix: number;
  iy: number;
  originX: number; originY: number; originZ: number;  // f64 chunk anchor
  /** 0 free · 1 pending · 2 active · 3 canceling (pending, release requested) */
  state: 0 | 1 | 2 | 3;
  workerIdx: number;
  unwanted: number;
  /** Controller hook (quadtree node ref) — pool stays node-agnostic. */
  owner: unknown;
  // permanent parking arrays (never freed, never uploaded after park)
  bootPos: Float32Array; bootNrm: Float32Array;
  bootUv: Float32Array; bootIdx: Uint16Array;
  // currently bound worker views (returned to the worker on release)
  curPos: Float32Array | null; curNrm: Float32Array | null;
  curUv: Float32Array | null; curIdx: Uint16Array | null;
}


export interface TerrainMeshPoolOptions {
  meshCount: number;
  workerCount: number;
  workerPoolSets: number;
  maxBatch: number;
  inFlightPerWorker: number;
  params: TerrainParams;
  material?: THREE.Material;
}


interface QueueEntry { recIdx: number; key: number; }
interface ReturnEntry { pos: Float32Array | null; nrm: Float32Array | null; uv: Float32Array | null; idx: Uint16Array | null; }
interface ReturnRing { entries: ReturnEntry[]; count: number; }
interface ChunkMsg {
  t: 'chunk'; key: number; p: Float32Array; n: Float32Array; u: Float32Array;
  i: Uint16Array; free: number; a?: Float64Array;
}
interface DropMsg { t: 'drop'; key: number; a?: Float64Array; }


export class TerrainMeshPool {
  readonly records: ChunkRecord[] = [];
  readonly counters: PoolCounters = {
    bootBufferAllocs: 0, swaps: 0, received: 0, dispatched: 0,
    drops: 0, returned: 0, queueDrops: 0,
  };


  private readonly opts: TerrainMeshPoolOptions;
  private readonly material: THREE.Material;
  private scene: THREE.Scene | null = null;
  private attached = false;
  private readonly workers: Worker[] = [];
  private readonly reqPools: Float64Array[][] = [];
  private readonly inFlight: number[] = [];
  readonly workerFree: number[] = [];


  // dispatch queue (boot-allocated ring)
  private readonly queueEntries: QueueEntry[];
  private queueHead = 0;
  private queueCount = 0;
  private readonly queueCapacity: number;


  // per-worker buffer return rings
  private readonly returnRings: ReturnRing[] = [];
  private readonly returnCapacity = 48;


  constructor(opts: TerrainMeshPoolOptions) {
    this.opts = opts;
    this.queueCapacity = opts.meshCount;
    this.queueEntries = [];
    for (let i = 0; i < this.queueCapacity; i++) {
      this.queueEntries.push({ recIdx: -1, key: -1 });
    }
    this.material = opts.material ?? new THREE.MeshStandardMaterial({
      color: 0x7d8a6f, roughness: 1, metalness: 0, side: THREE.DoubleSide,
    });


    // -- pool meshes (boot allocation — the ONLY Float32Arrays on main) ---
    for (let i = 0; i < opts.meshCount; i++) {
      const bootPos = new Float32Array(CHUNK_POS_FLOATS);
      const bootNrm = new Float32Array(CHUNK_NRM_FLOATS);
      const bootUv = new Float32Array(CHUNK_UV_FLOATS);
      const bootIdx = new Uint16Array(CHUNK_INDEX_COUNT);
      this.counters.bootBufferAllocs += 4;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position',
        new THREE.BufferAttribute(bootPos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal',
        new THREE.BufferAttribute(bootNrm, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('uv',
        new THREE.BufferAttribute(bootUv, 2).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(bootIdx, 1).setUsage(THREE.DynamicDrawUsage));
      g.setDrawRange(0, 0);
      g.computeBoundingSphere();     // allocate the Sphere NOW (boot)
      const mesh = new THREE.Mesh(g, this.material);
      mesh.visible = false;
      mesh.frustumCulled = true;
      this.records.push({
        index: i, mesh, geometry: g, key: -1, face: 0, level: 0, ix: 0, iy: 0,
        originX: 0, originY: 0, originZ: 0, state: 0, workerIdx: -1, unwanted: 0,
        owner: null,
        bootPos, bootNrm, bootUv, bootIdx,
        curPos: null, curNrm: null, curUv: null, curIdx: null,
      });
    }


    // -- workers -----------------------------------------------------------
    for (let w = 0; w < opts.workerCount; w++) {
      const worker = new Worker(
        new URL('../workers/terrainWorker.ts', import.meta.url),
        { type: 'module' },
      );
      const pool: Float64Array[] = [
        new Float64Array(1 + opts.maxBatch * 5),
        new Float64Array(1 + opts.maxBatch * 5),
      ];
      this.reqPools.push(pool);
      this.inFlight.push(0);
      this.workerFree.push(opts.workerPoolSets);
      this.returnRings.push({
        entries: Array.from({ length: this.returnCapacity },
          () => ({ pos: null, nrm: null, uv: null, idx: null })),
        count: 0,
      });
      worker.onerror = (e) => console.error('[TerrainMeshPool] worker error', e.message);
      worker.onmessage = (ev: MessageEvent) => this.onWorkerMessage(w, ev);
      worker.postMessage({ t: 'init', params: opts.params, sets: opts.workerPoolSets });
      this.workers.push(worker);
    }
  }


  /* -- scene attach / priming --------------------------------------------- */


  attach(scene: THREE.Scene): void {
    if (this.attached) return;
    this.attached = true;
    this.scene = scene;
    for (let i = 0; i < this.records.length; i++) scene.add(this.records[i].mesh);
  }


  /**
   * Render every pool mesh once (degenerate, frustum-culling disabled) so
   * all pool geometries are registered by WebGLGeometries BEFORE the
   * acceptance window — renderer.info.memory.geometries is then structurally
   * frozen. Call unprimeAll() after a rendered frame.
   */
  primeAll(): void {
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      r.mesh.visible = true;
      r.mesh.frustumCulled = false;
      r.geometry.setDrawRange(0, CHUNK_INDEX_COUNT);
    }
  }


  unprimeAll(): void {
    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];
      if (r.state === 2) { r.mesh.frustumCulled = true; continue; }
      r.mesh.visible = false;
      r.mesh.frustumCulled = true;
      r.geometry.setDrawRange(0, 0);
    }
  }


  /* -- record lifecycle ---------------------------------------------------- */


  /** Find a free record, fill it, enqueue the dispatch. Returns −1 if full. */
  acquire(face: number, level: number, ix: number, iy: number,
          ox: number, oy: number, oz: number): number {
    const rs = this.records;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (r.state !== 0) continue;
      r.key = chunkKey(face, level, ix, iy);
      r.face = face; r.level = level; r.ix = ix; r.iy = iy;
      r.originX = ox; r.originY = oy; r.originZ = oz;
      r.state = 1; r.workerIdx = -1; r.unwanted = 0; r.owner = null;
      if (!this.enqueue(i, r.key)) {           // queue full: undo
        r.state = 0;
        return -1;
      }
      return i;
    }
    return -1;
  }


  /**
   * Release a record. Pending records transition to CANCELING (3): if the
   * request was already dispatched, the arrival path returns the buffers;
   * if it is still queued, the dispatch loop clears it. Active records are
   * parked (boot arrays) and their buffers queue for return to the worker.
   */
  release(recIdx: number): void {
    const r = this.records[recIdx];
    if (r.state === 1) { r.state = 3; return; }
    if (r.state !== 2) return;
    const g = r.geometry;
    (g.attributes.position as THREE.BufferAttribute).array = r.bootPos;
    (g.attributes.normal as THREE.BufferAttribute).array = r.bootNrm;
    (g.attributes.uv as THREE.BufferAttribute).array = r.bootUv;
    (g.index as THREE.BufferAttribute).array = r.bootIdx;
    // NOTE: no needsUpdate — invisible, drawRange 0 → no upload, no churn.
    g.setDrawRange(0, 0);
    r.mesh.visible = false;
    this.queueReturn(r.workerIdx, r.curPos!, r.curNrm!, r.curUv!, r.curIdx!);
    r.curPos = null; r.curNrm = null; r.curUv = null; r.curIdx = null;
    r.state = 0;
  }


  /* -- per-frame pump (call after controller update) ----------------------- */


  pump(): void {
    for (let w = 0; w < this.workers.length; w++) {
      this.flushReturns(w);
      this.dispatchBatch(w);
    }
  }


  /* -- telemetry ------------------------------------------------------------ */


  activeCount(): number { let n = 0; for (const r of this.records) if (r.state === 2) n++; return n; }
  pendingCount(): number { let n = 0; for (const r of this.records) if (r.state === 1 || r.state === 3) n++; return n; }
  freeCount(): number { let n = 0; for (const r of this.records) if (r.state === 0) n++; return n; }
  inFlightTotal(): number { let n = 0; for (const v of this.inFlight) n += v; return n; }


  /**
   * PAGE TEARDOWN ONLY — strictly forbidden during flight (Spec 04.3).
   * The acceptance harness patches dispose/remove and asserts zero calls
   * inside the measurement window.
   */
  disposeAll(): void {
    for (const w of this.workers) w.terminate();
    if (this.scene !== null) {
      for (const r of this.records) this.scene.remove(r.mesh);
    }
    for (const r of this.records) r.geometry.dispose();
    this.material.dispose();
  }


  /* -- internals ------------------------------------------------------------- */


  private enqueue(recIdx: number, key: number): boolean {
    if (this.queueCount >= this.queueCapacity) {
      this.counters.queueDrops++;
      return false;
    }
    const tail = (this.queueHead + this.queueCount) % this.queueCapacity;
    this.queueEntries[tail].recIdx = recIdx;
    this.queueEntries[tail].key = key;
    this.queueCount++;
    return true;
  }


  private findByKey(key: number): ChunkRecord | null {
    const rs = this.records;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i];
      if (r.key === key && (r.state === 1 || r.state === 3)) return r;
    }
    return null;
  }


  private onWorkerMessage(w: number, ev: MessageEvent): void {
    const m = ev.data as ChunkMsg | DropMsg;
    if (m.t === 'chunk') {
      if (m.a !== undefined) this.reqPools[w].push(m.a);   // request array home
      this.inFlight[w] = Math.max(0, this.inFlight[w] - 1);
      this.workerFree[w] = m.free;
      this.counters.received++;
      const r = this.findByKey(m.key);
      if (r !== null && r.state === 1) {
        this.bindRecord(r, m, w);
      } else {
        if (r !== null && r.state === 3) r.state = 0;      // canceled: recycle
        this.queueReturn(w, m.p, m.n, m.u, m.i);           // orphaned buffers
      }
    } else if (m.t === 'drop') {
      if (m.a !== undefined) this.reqPools[w].push(m.a);
      this.inFlight[w] = Math.max(0, this.inFlight[w] - 1);
      const r = this.findByKey(m.key);
      if (r !== null && (r.state === 1 || r.state === 3)) r.state = 0;
      this.counters.drops++;
    }
  }


  /** THE in-place bind: swap .array pointers, flag needsUpdate, same-size
   *  bufferSubData upload. Zero JS allocation, zero GPU reallocation. */
  private bindRecord(r: ChunkRecord, m: ChunkMsg, w: number): void {
    r.curPos = m.p; r.curNrm = m.n; r.curUv = m.u; r.curIdx = m.i;
    r.workerIdx = w;
    r.state = 2;
    const g = r.geometry;
    const pa = g.attributes.position as THREE.BufferAttribute;
    pa.array = m.p; pa.needsUpdate = true;
    const na = g.attributes.normal as THREE.BufferAttribute;
    na.array = m.n; na.needsUpdate = true;
    const ua = g.attributes.uv as THREE.BufferAttribute;
    ua.array = m.u; ua.needsUpdate = true;
    const ia = g.index as THREE.BufferAttribute;
    ia.array = m.i; ia.needsUpdate = true;
    g.setDrawRange(0, CHUNK_INDEX_COUNT);
    g.computeBoundingSphere();                 // allocation-free after boot
    r.mesh.position.set(r.originX, r.originY, r.originZ);
    r.mesh.visible = true;
    this.counters.swaps += 4;
  }


  private queueReturn(w: number, p: Float32Array, n: Float32Array,
                      u: Float32Array, i: Uint16Array): void {
    if (w < 0 || w >= this.returnRings.length) w = 0;
    const ring = this.returnRings[w];
    if (ring.count >= this.returnCapacity) {
      // Overflow (cannot happen at these rates): flush immediately.
      const list = [p.buffer, n.buffer, u.buffer, i.buffer];
      this.workers[w].postMessage({ t: 'ret', b: list }, list);
      this.counters.returned++;
      return;
    }
    const e = ring.entries[ring.count++];
    e.pos = p; e.nrm = n; e.uv = u; e.idx = i;
  }


  private flushReturns(w: number): void {
    const ring = this.returnRings[w];
    if (ring.count === 0) return;
    const list: ArrayBuffer[] = [];
    for (let i = 0; i < ring.count; i++) {
      const e = ring.entries[i];
      list.push(e.pos!.buffer, e.nrm!.buffer, e.uv!.buffer, e.idx!.buffer);
      e.pos = null; e.nrm = null; e.uv = null; e.idx = null;
    }
    this.counters.returned += ring.count;
    ring.count = 0;
    this.workers[w].postMessage({ t: 'ret', b: list }, list);
  }


  private dispatchBatch(w: number): void {
    if (this.queueCount === 0) return;
    const rp = this.reqPools[w];
    if (rp.length === 0) return;                       // both arrays in flight
    if (this.inFlight[w] >= this.opts.inFlightPerWorker) return;
    const a = rp[rp.length - 1];
    let n = 0;
    while (n < this.opts.maxBatch
        && this.inFlight[w] + n < this.opts.inFlightPerWorker
        && this.queueCount > 0) {
      const e = this.queueEntries[this.queueHead];
      const rec = this.records[e.recIdx];
      const valid = rec.state === 1 && rec.key === e.key;
      this.queueHead = (this.queueHead + 1) % this.queueCapacity;
      this.queueCount--;
      if (!valid) {
        // Stale entry: a cancel that never dispatched — retire it cleanly.
        if (rec.state === 3 && rec.key === e.key) rec.state = 0;
        continue;
      }
      const base = 1 + n * 5;
      a[base] = rec.key;
      a[base + 1] = rec.face;
      a[base + 2] = rec.level;
      a[base + 3] = rec.ix;
      a[base + 4] = rec.iy;
      n++;
      this.counters.dispatched++;
    }
    if (n === 0) return;
    a[0] = n;
    rp.pop();                                          // array leaves with msg
    this.inFlight[w] += n;
    this.workers[w].postMessage({ t: 'req', a }, [a.buffer]);
  }
}
