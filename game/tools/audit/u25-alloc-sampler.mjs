// A1-U25 probe — per-frame allocation in the REAL shell playFrame, measured
// with V8's sampling heap profiler (node:inspector HeapProfiler.startSampling
// with includeObjectsCollectedByMinorGC/MajorGC), so TRANSIENT garbage is
// counted — test-play-perf reads heapUsed after gc() and cannot see it
// (A1-U09-1). Bytes are attributed to the deepest bundle frame (module from
// esbuild's `// src/...` markers) and to the playFrame stage on the stack.
// Workload = tools/test-play-perf.mjs (same bundle, stub pool, drive script).
// Also D: HUD lat/lon is computed from kcc.up — compared with the position radial.
// Run from game/:  node --expose-gc --max-semi-space-size=64 tools/audit/u25-alloc-sampler.mjs   (exit 0 = probe ran)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import inspector from 'node:inspector/promises'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..', '..')
const out = path.join(game, 'node_modules', '.cache', 'u25-audit.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';
      export * from './play/ui/hudPublisher'; export { makeHud, usePlayStore } from './play/ui/playStore';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
// line → source module map from esbuild's module markers
const bundleUrl = pathToFileURL(out).href
const marks = []
fs.readFileSync(out, 'utf8').split('\n').forEach((l, i) => { const m = /^\/\/ (\S+\.tsx?)$/.exec(l); if (m) marks.push([i, m[1]]) })
const modOf = (line) => { let r = '?'; for (const [i, m] of marks) { if (i <= line) r = m; else break } return r }

const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined
  : (..._a) => ({ addColorStop() {} })), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
  getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
const M = await import(bundleUrl)
const p = (k, v) => console.log(`${k}=${v}`)
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }

const session = new inspector.Session(); session.connect()
await session.post('HeapProfiler.enable')
async function sampled(fn, interval = 32) {
  await session.post('HeapProfiler.startSampling', { samplingInterval: interval,
    includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
  fn()
  const { profile } = await session.post('HeapProfiler.stopSampling')
  return profile
}
// walk: totals per bundle function (deepest bundle frame) and per playFrame stage
function attribute(profile) {
  const byFn = new Map(), byStage = new Map(); let total = 0
  const walk = (n, bundleFrame, stage, underFrame) => {
    const cf = n.callFrame
    let bf = bundleFrame, st = stage, uf = underFrame
    if (cf.url === bundleUrl) {
      const key = `${modOf(cf.lineNumber)}:${cf.functionName || '(anon)'}@${cf.lineNumber + 1}`
      bf = key
      if (uf && st === null) st = key
      if (cf.functionName === 'playFrame') { uf = true; st = null }
    }
    if (n.selfSize > 0) {
      total += n.selfSize
      const k = bf ?? `(non-bundle) ${cf.functionName || '(anon)'} ${path.basename(cf.url || '')}`
      byFn.set(k, (byFn.get(k) ?? 0) + n.selfSize)
      const s = uf ? (st ?? 'playFrame (own body)') : '(outside playFrame)'
      byStage.set(s, (byStage.get(s) ?? 0) + n.selfSize)
    }
    for (const c of n.children) walk(c, bf, st, uf)
  }
  walk(profile.head, null, null, false)
  return { total, byFn, byStage }
}
const top = (m, k, div) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => `${(v / div).toFixed(1)} B  ${n}`)

// ---- controls (known allocation rates)
const ring = new Array(16)
function ctlNoop(n) { let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i); return s }
function ctlObj(n) { for (let i = 0; i < n; i++) ring[i & 15] = { x: i, y: i, z: i } }
function ctlF64(n) { for (let i = 0; i < n; i++) ring[i & 15] = new Float64Array(16) }
for (let i = 0; i < 5; i++) { ctlNoop(1e5); ctlObj(1e5); ctlF64(1e4) }
{
  const pr = await sampled(() => { ctlNoop(2e5); ctlObj(2e5); ctlF64(2e4) })
  const want = (name) => { let s = 0; const w = (n) => { if (n.callFrame.functionName === name) s += n.selfSize; n.children.forEach(w) }; w(pr.head); return s }
  const bN = want('ctlNoop') / 2e5, bO = want('ctlObj') / 2e5, bF = want('ctlF64') / 2e4
  p('cal.noop_B_per_iter', bN.toFixed(2)); p('cal.obj3_B_per_iter', bO.toFixed(1)); p('cal.f64x16_B_per_iter', bF.toFixed(1))
  control('noop_reads_zero', bN < 0.5)
  control('obj3_reads_16_48B', bO >= 16 && bO <= 48)
  control('f64x16_reads_ge128B', bF >= 128)
}

// ---- world (as test-play-perf)
function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, level: 0,
    originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
  return {
    records,
    acquire(face, level, ix, iy, ox, oy, oz) {
      for (let i = 0; i < records.length; i++) { const r = records[i]
        if (r.state === 0) { r.state = 1; r.unwanted = 0; r.owner = null; r.level = level; r.originX = ox; r.originY = oy; r.originZ = oz; return i } }
      return -1
    },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 1) c++; return c },
    pump() { for (let i = 0; i < records.length; i++) { const r = records[i]; if (r.state === 1) { r.state = 2; r.mesh.visible = true } } },
    disposeAll() {},
  }
}
const st = { phase: 'PLAYING', hudVisible: true, dispatch() {}, toggleHud() {}, setLoad() {}, setHud() {} }
const inp = { moveX: 0, moveY: 0, sprint: false, crouch: false, jumpPressed: false,
  lookDX: 0, lookDY: 0, zoomDelta: 0, toggleCamEdge: false, respawnEdge: false,
  pauseEdge: false, toggleHudEdge: false, clearEdges() { this.toggleCamEdge = false;
    this.respawnEdge = false; this.pauseEdge = false; this.toggleHudEdge = false }, exitLock() {} }
const fp = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fp })
const cam = new M.ThirdPersonCamera(); cam.reset(w.kcc, w.earthDir)
const frame = M.createPlayFrame(w, cam, { input: inp, store: { getState: () => st }, now: () => 0 })
const DT = 1 / 144
let idle = false, fi = 0
function drive(i) {
  if (idle) { inp.moveY = 0; inp.moveX = 0; inp.sprint = false; inp.lookDX = 0; inp.jumpPressed = false; return }
  const c = i % 1440
  inp.moveY = c < 1150 ? 1 : 0
  inp.sprint = c >= 400 && c < 900
  inp.moveX = c >= 900 && c < 1100 ? 0.6 : 0
  inp.lookDX = c % 288 < 30 ? 3 : 0
  inp.jumpPressed = c >= 1000 && c < 1006
}
const run = (n) => { for (let i = 0; i < n; i++) { drive(fi++); frame(DT) } }
run(20000) // warm-up as test-play-perf

// ---- A0. profiler-OFF cross-check: heapUsed delta over 1,000-frame batches,
// no gc inside a batch (run with --max-semi-space-size=64 so no scavenge
// fires in a batch; batches where heapUsed fell = a GC ran → discarded).
for (const tag of ['walk', 'idle']) {
  idle = tag === 'idle'; run(2000); globalThis.gc()
  const perF = []; let gcs = 0
  for (let b = 0; b < 12; b++) {
    const h0 = process.memoryUsage().heapUsed; run(1000); const h1 = process.memoryUsage().heapUsed
    if (h1 < h0) gcs++; else perF.push((h1 - h0) / 1000)
  }
  perF.sort((a, b) => a - b)
  p(`A0.${tag}.heapUsed_B_per_frame_median`, (perF[perF.length >> 1] ?? NaN).toFixed(1))
  p(`A0.${tag}.heapUsed_B_per_frame_range`, `${perF[0]?.toFixed(1)}..${perF[perF.length - 1]?.toFixed(1)} (n=${perF.length}, gc batches ${gcs})`)
}
idle = false

for (const tag of ['walk', 'idle']) {
  idle = tag === 'idle'; run(2000)
  const N = 2880 // 20 s at 144 Hz, 1 full drive cycle ×2
  const ticks0 = w.kcc.telemetry ? 0 : 0
  const pr = await sampled(() => run(N))
  const a = attribute(pr)
  p(`A.${tag}.frames`, N)
  p(`A.${tag}.B_per_frame`, (a.total / N).toFixed(1))
  p(`A.${tag}.KB_per_s_at_144Hz`, (a.total / N * 144 / 1024).toFixed(1))
  top(a.byStage, 12, N).forEach((l, i) => p(`A.${tag}.stage[${i}]`, l))
  top(a.byFn, 15, N).forEach((l, i) => p(`A.${tag}.fn[${i}]`, l))
}
idle = false

// ---- C. real zustand setHud (the sanctioned UI boundary, ≤ 10 Hz)
{
  const store = M.usePlayStore, bufs = [M.makeHud(), M.makeHud()]
  const pub = () => { for (let i = 0; i < 20000; i++) store.getState().setHud(bufs[i & 1]) }
  pub()
  const a = attribute(await sampled(pub))
  p('C.zustand_setHud_B_per_publish', (a.total / 20000).toFixed(1))
}

// ---- D. HUD lat/lon from kcc.up vs from the position radial (spin frozen in play)
{
  const DEG = 180 / Math.PI
  let n = 0, nG = 0, maxA = 0, maxLat = 0, maxLon = 0; const angs = []
  p('D.kcc.spinPhase', w.kcc.spinPhase)
  for (let i = 0; i < 8000; i++) {
    drive(fi++); frame(DT)
    const k = w.kcc, a = k.absPos, r = Math.hypot(a.x, a.y, a.z), u = k.up
    const rx = a.x / r, ry = a.y / r, rz = a.z / r
    const ang = Math.acos(Math.min(1, Math.max(-1, u.x * rx + u.y * ry + u.z * rz))) * DEG
    const dLat = Math.abs(Math.asin(Math.max(-1, Math.min(1, u.y))) - Math.asin(ry)) * DEG
    let dLon = Math.abs(Math.atan2(u.x, u.z) - Math.atan2(rx, rz)) * DEG; if (dLon > 180) dLon = 360 - dLon
    n++; if (k.grounded) { nG++; angs.push(ang); if (ang > maxA) maxA = ang; if (dLat > maxLat) maxLat = dLat; if (dLon > maxLon) maxLon = dLon }
  }
  angs.sort((x, y) => x - y)
  const q = (f) => angs[Math.min(angs.length - 1, Math.floor(f * angs.length))]
  p('D.grounded_frames', `${nG}/${n}`)
  p('D.angle_up_vs_radial_deg_p50/p90/p99/max', `${q(0.5).toFixed(3)}/${q(0.9).toFixed(3)}/${q(0.99).toFixed(3)}/${maxA.toFixed(3)}`)
  p('D.hud_lat_error_deg_max', maxLat.toFixed(3)); p('D.hud_lon_error_deg_max', maxLon.toFixed(3))
  p('D.radius_m', Math.hypot(w.kcc.absPos.x, w.kcc.absPos.y, w.kcc.absPos.z).toFixed(1))
  p('D.km_per_deg', (2 * Math.PI * Math.hypot(w.kcc.absPos.x, w.kcc.absPos.y, w.kcc.absPos.z) / 360).toFixed(2))
}
p('controls', `${cOk}/${cN}`)
process.exit(0)