// A1-U20 probe — TerrainMeshPool + terrainWorker message protocol, set accounting,
// worker load balance, LOD/pool interaction (READ-ONLY audit). Imports the REAL pool,
// the REAL worker module (one module instance per fake Worker) and the REAL MoonLod.
// Messages cross a structuredClone(…, {transfer}) boundary, so detachment is real.
// Run from game/:  node tools/audit/u20-mesh-pool-worker.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
import { performance } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)

const p = (k, v) => console.log(`${k}=${v}`)
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }

// ---- fake worker contexts: each import of the worker module binds `self` at eval ----
const ctxs = []
async function loadCtx(id) {
  const ctx = { onmessage: null, out: [], postMessage(m, t) { this.out.push(structuredClone(m, { transfer: t ?? [] })) } }
  globalThis.self = ctx
  await import(`../../src/workers/terrainWorker.ts?inst=${id}`)
  if (typeof ctx.onmessage !== 'function') throw new Error('worker module did not bind onmessage')
  return ctx
}
for (let i = 0; i < 40; i++) ctxs.push(await loadCtx(i))
let nextCtx = 0, frame = 0, genMs = 0, genChunks = 0
class FakeWorker {
  constructor() { this.ctx = ctxs[nextCtx++]; this.inbox = []; this.onmessage = null; this.onerror = null }
  postMessage(m, t) { this.inbox.push({ frame, data: structuredClone(m, { transfer: t ?? [] }) }) }
  terminate() {}
}
globalThis.Worker = FakeWorker

const { TerrainMeshPool } = await import('../../src/render/TerrainMeshPool.ts')
const { MoonLod } = await import('../../src/play/world/MoonLod.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const SP = await import('../../src/core/terrain/spherify.ts')

// worker step: FIFO, a 'req' is processed only `lat` frames after it was posted
function stepWorkers(pool, lat) {
  for (const w of pool.workers) {
    let k = 0
    for (; k < w.inbox.length; k++) {
      const e = w.inbox[k]
      if (e.data.t === 'req' && frame - e.frame < lat) break
      const nReq = e.data.t === 'req' ? e.data.a[0] : 0   // read before the worker transfers `a` away
      const t0 = performance.now()
      w.ctx.onmessage({ data: e.data })
      if (e.data.t === 'req') { genMs += performance.now() - t0; genChunks += nReq }
    }
    w.inbox.splice(0, k)
  }
}
function deliver(pool) {
  for (const w of pool.workers) { const out = w.ctx.out.splice(0); for (const d of out) w.onmessage({ data: d }) }
}
function makePool(meshCount, sets, params) {
  return new TerrainMeshPool({ meshCount, workerCount: 2, workerPoolSets: sets, maxBatch: 6, inFlightPerWorker: 12, params })
}
function perWorker(pool) {
  const bound = [0, 0]
  for (const r of pool.records) if (r.state === 2) bound[r.workerIdx]++
  return bound
}

// ---- P1 direct: 120 distinct L4 chunks, 3 acquires/frame, never released ----
function p1(meshCount, sets, lat) {
  TF.initTerrainField(MC.MOON_PARAMS)
  const pool = makePool(meshCount, sets, MC.MOON_PARAMS)
  const owners = new Map()
  let asked = 0
  for (frame = 0; frame < 200; frame++) {
    deliver(pool)
    for (let k = 0; k < 3 && asked < 120; k++, asked++) {
      const ix = asked % 16, iy = (asked / 16) | 0
      const idx = pool.acquire(0, 4, ix, iy, 0, 0, 0)
      if (idx < 0) { asked--; break }
      pool.records[idx].owner = { ix, iy }; owners.set(idx, true)
    }
    pool.pump(); stepWorkers(pool, lat)
  }
  deliver(pool)
  let silentlyFreed = 0
  for (const r of pool.records) if (r.state === 0 && r.owner !== null) silentlyFreed++
  const bw = perWorker(pool)
  const tag = `p1.mesh${meshCount}.sets${sets}.lat${lat}`
  p(`${tag}.active`, pool.activeCount()); p(`${tag}.drops`, pool.counters.drops)
  p(`${tag}.freedWithOwnerStillSet`, silentlyFreed); p(`${tag}.boundPerWorker`, bw.join('/'))
  p(`${tag}.dispatched`, pool.counters.dispatched); p(`${tag}.received`, pool.counters.received)
  return { pool, silentlyFreed, bw }
}
const a = p1(144, 96, 0)
const b = p1(144, 144, 0)
const c = p1(144, 96, 3)
control('p1_noDropsWhenSetsCoverMeshes', b.pool.counters.drops === 0 && b.pool.activeCount() === 120)
control('p1_accountingClosed', a.pool.counters.received + a.pool.counters.drops === a.pool.counters.dispatched)

// ---- P3 LOD flight: real MoonLod driving the real pool ----
function flight(params, meshCount, sets, lat, label, vTrav) {
  TF.initTerrainField(params)
  const R = params.radius
  const pool = makePool(meshCount, sets, params)
  const lod = new MoonLod(pool, R)
  const d0 = { x: 0, y: 0, z: 0 }
  SP.faceCubePointInto(0, 0.1, 0.2, d0); SP.spherifyInto(d0.x, d0.y, d0.z, d0)
  // tangent for the traverse
  let tx = -d0.y, ty = d0.x, tz = 0; const tl = Math.hypot(tx, ty, tz); tx /= tl; ty /= tl; tz /= tl
  const FPS = 60, T_DESC = 40, T_TRAV = 60, T_HOP = 20
  const N = (T_DESC + T_TRAV + T_HOP) * FPS
  let maxBound = [0, 0], maxDrops = 0, maxOrphan = 0, maxLiar = 0, maxRing = 0, framesWithOrphanSelected = 0
  const share = [0, 0]; let lastDisp = [0, 0]
  for (frame = 0; frame < N; frame++) {
    deliver(pool)
    const t = frame / FPS
    let alt, ang = 0
    if (t < T_DESC) alt = 3 * R * Math.pow(1 - t / T_DESC, 3) + 2
    else if (t < T_DESC + T_TRAV) { alt = 2; ang = (vTrav * (t - T_DESC)) / R }
    else { const s = (t - T_DESC - T_TRAV) / T_HOP; alt = 2 + 600 * Math.sin(Math.PI * s); ang = (vTrav * T_TRAV) / R + (3 * vTrav * (t - T_DESC - T_TRAV)) / R }
    const ca = Math.cos(ang), sa = Math.sin(ang)
    const ux = d0.x * ca + tx * sa, uy = d0.y * ca + ty * sa, uz = d0.z * ca + tz * sa
    const h = TF.terrainHeight(ux, uy, uz)
    const rr = R + h + alt
    lod.update(ux * rr, uy * rr, uz * rr)
    for (const ring of pool.returnRings) maxRing = Math.max(maxRing, ring.count)
    const before = pool.counters.dispatched
    pool.pump()
    // attribute this frame's dispatches to workers via inFlight deltas is noisy; use records instead
    stepWorkers(pool, lat)
    const bw = perWorker(pool)
    maxBound = [Math.max(maxBound[0], bw[0]), Math.max(maxBound[1], bw[1])]
    // orphaned pending: node points at a record that is no longer its own pending/active request
    let orphan = 0, liar = 0, orphanSel = 0
    for (const face of lod.faces) for (const n of face) {
      if (n.pendingRec < 0) continue
      const r = pool.records[n.pendingRec]
      if (r.owner !== n || r.state === 0) {
        orphan++
        if (r.owner !== n && r.state === 2) liar++
        if (lod.isSelectedLeaf(n)) orphanSel++
      }
    }
    maxOrphan = Math.max(maxOrphan, orphan); maxLiar = Math.max(maxLiar, liar)
    if (orphanSel > 0) framesWithOrphanSelected++
    void before
  }
  for (const r of pool.records) if (r.state === 2) share[r.workerIdx]++
  const tag = `p3.${label}.mesh${meshCount}.sets${sets}.lat${lat}`
  p(`${tag}.drops`, pool.counters.drops); p(`${tag}.dispatched`, pool.counters.dispatched)
  p(`${tag}.maxBoundPerWorker`, maxBound.join('/')); p(`${tag}.maxOrphanNodes`, maxOrphan)
  p(`${tag}.maxNodesFakingData`, maxLiar); p(`${tag}.framesWithOrphanSelectedLeaf`, `${framesWithOrphanSelected}/${N}`)
  p(`${tag}.maxReturnRing`, maxRing)
  return { pool, maxOrphan, maxBound }
}
const RUNS = []
for (const [params, label, v] of [[MC.MOON_PARAMS, 'moon', 30], [TF.TEST_PLANET, 'test', 400]]) {
  for (const [m, s] of [[96, 96], [144, 96], [144, 144]]) for (const lat of [0, 2]) RUNS.push(flight(params, m, s, lat, label, v))
}
control('p3_96x96_noDrops', RUNS[0].pool.counters.drops === 0 && RUNS[1].pool.counters.drops === 0)
control('p3_144x144_noDrops', RUNS[4].pool.counters.drops === 0 && RUNS[5].pool.counters.drops === 0)
p('gen.msPerChunk', (genMs / Math.max(1, genChunks)).toFixed(3)); p('gen.chunks', genChunks)
p('controls', `${cOk}/${cN}`)