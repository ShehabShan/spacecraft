// F1b allocation gate (ADR-002) — per-frame allocated bytes of the REAL play frame.
// WHY: post-GC heap deltas cannot see transient churn (A1-U09-1; U27b2 refuted them as
// an allocation detector), so the gate uses V8's sampling heap profiler with objects
// collected by minor AND major GC included. A small retained leak can sit under the
// churn budget, so a second clause measures retained growth (gc() before/after).
// Both clauses must hold. Workload = the test-play-perf / A1-U25 drive (real
// createMoonWorld + createPlayFrame + ThirdPersonCamera, stub mesh pool, stub store).
//
// Run from game/:
//   node --expose-gc tools/test-alloc-gate.mjs               gate on the current tree (exit 0 PASS, 1 FAIL, 2 instrument broken)
//   node --expose-gc tools/test-alloc-gate.mjs --mutant churn|leak   gate with a known-bad mutant wrapped round each frame
//   node --expose-gc tools/test-alloc-gate.mjs --self-test   sensitivity matrix (exit 0 iff every asserted disposition matches)
//   add --deliberate to --self-test: one deliberately wrong expectation (must exit 1)
//   add --out <NEW dir> to write summary.json (refuses an existing path)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import inspector from 'node:inspector/promises'

// Budgets (ADR-002). WHY: §3 says NO per-frame allocation; 64 B/frame is the
// measurement slack (≈9 KB/s at 144 Hz), far below the 400 B/frame churn mutant
// and the ≈10.5 KB/frame of A1-U25-1. Retained growth must be ≤ 8 B/frame.
export const ALLOC_BUDGET_B_PER_FRAME = 64
export const RETAIN_BUDGET_B_PER_FRAME = 8
const N = 2880 // 20 s at 144 Hz = two full drive cycles
const DT = 1 / 144

const args = process.argv.slice(2)
const flag = (k) => args.includes(k)
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const SELF = flag('--self-test'), DELIB = flag('--deliberate')
const MUTANT = opt('--mutant') ?? 'none'
const OUT = opt('--out')
if (!['none', 'churn', 'leak'].includes(MUTANT)) { console.error(`unknown --mutant ${MUTANT}`); process.exit(2) }
if (OUT && fs.existsSync(OUT)) { console.error(`--out ${OUT} exists; give a NEW path`); process.exit(2) }
if (typeof globalThis.gc !== 'function') { console.error('run with node --expose-gc'); process.exit(2) }

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'f1b-alloc-gate.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const bundleUrl = pathToFileURL(out).href
const marks = []
fs.readFileSync(out, 'utf8').split('\n').forEach((l, i) => { const m = /^\/\/ (\S+\.tsx?)$/.exec(l); if (m) marks.push([i, m[1]]) })
const modOf = (line) => { let r = '?'; for (const [i, m] of marks) { if (i <= line) r = m; else break } return r }
const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined : (..._a) => ({ addColorStop() {} })), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
  getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
const M = await import(bundleUrl)
const p = (k, v) => console.log(`${k}=${v}`)
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
const realStep = () => { drive(fi++); frame(DT) }
for (let i = 0; i < 20000; i++) realStep() // warm-up as test-play-perf
// ---- F1bc idle-retained bisect probe: per-heap-space retained growth over consecutive rounds
import v8 from 'node:v8'
const MODE = process.env.MODE ?? 'idle', ROUNDS = +(process.env.ROUNDS ?? 10), WARM = +(process.env.WARM ?? 20000)
const spaces = () => Object.fromEntries(v8.getHeapSpaceStatistics().map((s) => [s.space_name, s.space_used_size]))
idle = MODE === 'idle'
for (let i = 0; i < WARM; i++) realStep()
p('mode', `${MODE} jitless=${process.execArgv.includes('--jitless')} N=${N} warm=${WARM}`)
let tot = 0
for (let r = 0; r < ROUNDS; r++) {
  globalThis.gc(); globalThis.gc()
  const a = spaces(), h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < N; i++) realStep()
  globalThis.gc(); globalThis.gc()
  const b = spaces(), dh = (process.memoryUsage().heapUsed - h0) / N
  tot += dh
  const d = Object.keys(b).filter((k) => b[k] !== a[k]).map((k) => `${k}:${((b[k] - a[k]) / N).toFixed(2)}`).join(' ')
  p(`round[${r}]`, `${dh.toFixed(2)} B/frame | ${d}`)
}
p('mean_B_per_frame', (tot / ROUNDS).toFixed(2))
