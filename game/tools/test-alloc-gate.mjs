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
import { objectHeapUsed } from './alloc-lib.mjs' // F1bc/ADR-004: retained = JS-object heap

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

const session = new inspector.Session(); session.connect()
await session.post('HeapProfiler.enable')
async function sampled(fn) {
  await session.post('HeapProfiler.startSampling', { samplingInterval: 32,
    includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
  fn()
  const { profile } = await session.post('HeapProfiler.stopSampling')
  return profile
}
function attribute(profile) {
  const byFn = new Map(); let total = 0
  const walk = (n, bf) => {
    const cf = n.callFrame
    const b = cf.url === bundleUrl ? `${modOf(cf.lineNumber)}:${cf.functionName || '(anon)'}@${cf.lineNumber + 1}` : bf
    if (n.selfSize > 0) {
      total += n.selfSize
      const k = b ?? `(outside bundle) ${cf.functionName || '(anon)'}`
      byFn.set(k, (byFn.get(k) ?? 0) + n.selfSize)
    }
    for (const c of n.children) walk(c, b)
  }
  walk(profile.head, null)
  return { total, byFn }
}

// ---- mutants (known-bad frame wrappers)
const churnRing = new Array(8)
const leakBox = []
function withMutant(step, mutant) {
  // WHY: ~400 B/frame transient (U27c F1b row) as 4 short-lived 3-field literals.
  // Measured ≈97 B each inside this closure (literal slack), so 4 ≈ 390 B; the
  // self-test asserts the mutant really costs 300–500 B. A Float64Array(42) read
  // only ~200 B: its payload is an off-heap backing store the sampler misses.
  if (mutant === 'churn') return () => { step(); for (let k = 0; k < 4; k++) churnRing[k] = { x: k, y: k, z: k } }
  // WHY: one small retained object per frame — sized to sit near the churn budget so
  // only the retained clause has to catch it
  if (mutant === 'leak') return () => { step(); leakBox.push({ a: 0, b: 0 }) }
  return step
}

async function measure(step) {
  for (let i = 0; i < 2000; i++) step()
  const a = attribute(await sampled(() => { for (let i = 0; i < N; i++) step() }))
  const ret = []
  for (let r = 0; r < 3; r++) {
    globalThis.gc(); globalThis.gc()
    const h0 = objectHeapUsed()
    for (let i = 0; i < N; i++) step()
    globalThis.gc(); globalThis.gc()
    ret.push((objectHeapUsed() - h0) / N)
  }
  ret.sort((x, y) => x - y)
  const allocB = a.total / N, retainedB = ret[1]
  const verdict = allocB <= ALLOC_BUDGET_B_PER_FRAME && retainedB <= RETAIN_BUDGET_B_PER_FRAME ? 'PASS' : 'FAIL'
  const top = [...a.byFn.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${(v / N).toFixed(1)} B ${k}`)
  return { allocB, retainedB, retainedRounds: ret, verdict, top }
}
const show = (tag, r) => {
  p(`${tag}.alloc_B_per_frame`, r.allocB.toFixed(1)); p(`${tag}.retained_B_per_frame`, r.retainedB.toFixed(2))
  p(`${tag}.verdict`, r.verdict)
}

// ---- instrument calibration (known allocation rates)
const ring = new Array(16)
function ctlNoop(n) { let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i); return s }
function ctlObj(n) { for (let i = 0; i < n; i++) ring[i & 15] = { x: i, y: i, z: i } }
function ctlF64(n) { for (let i = 0; i < n; i++) ring[i & 15] = new Float64Array(16) }
for (let i = 0; i < 5; i++) { ctlNoop(1e5); ctlObj(1e5); ctlF64(1e4) }
const cal = {}
{
  const pr = await sampled(() => { ctlNoop(2e5); ctlObj(2e5); ctlF64(2e4) })
  const want = (name) => { let s = 0; const w = (n) => { if (n.callFrame.functionName === name) s += n.selfSize; n.children.forEach(w) }; w(pr.head); return s }
  cal.noop = want('ctlNoop') / 2e5; cal.obj3 = want('ctlObj') / 2e5; cal.f64x16 = want('ctlF64') / 2e4
  p('cal.noop_B_per_iter', cal.noop.toFixed(2)); p('cal.obj3_B_per_iter', cal.obj3.toFixed(1)); p('cal.f64x16_B_per_iter', cal.f64x16.toFixed(1))
}
// WHY: a 3-field object is 24 B with pointer compression, 48 B without (this Node);
// sampling noise reads ~±1 B, so the window is [16, 64].
const calOk = cal.noop < 0.5 && cal.obj3 >= 16 && cal.obj3 <= 64 && cal.f64x16 >= 128
p('cal.ok', calOk)
if (!calOk) { console.error('instrument calibration failed'); process.exit(2) }

// ---- synthetic zero-allocation frame (preallocated state, pure math)
const S = new Float64Array(64)
function synthStep() { for (let i = 0; i < 64; i++) S[i] = Math.sin(S[i] + i * DT) * 0.5 + S[(i + 7) & 63] * 0.25 }

// ---- real play world (as test-play-perf / A1-U25)
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

const summary = { budgets: { alloc: ALLOC_BUDGET_B_PER_FRAME, retained: RETAIN_BUDGET_B_PER_FRAME }, frames: N, cal, runs: {}, checks: [] }

if (!SELF) {
  let pass = true
  for (const tag of ['walk', 'idle']) {
    idle = tag === 'idle'
    const r = await measure(withMutant(realStep, MUTANT))
    show(`play.${tag}${MUTANT === 'none' ? '' : '+' + MUTANT}`, r)
    r.top.forEach((l, i) => p(`play.${tag}.top[${i}]`, l))
    summary.runs[tag] = r; if (r.verdict !== 'PASS') pass = false
  }
  p('GATE', pass ? 'PASS' : 'FAIL')
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2)) }
  process.exit(pass ? 0 : 1)
}

// ---- self-test: sensitivity matrix
let ok = 0, n = 0
const check = (name, cond, detail) => { n++; if (cond) ok++; summary.checks.push({ name, cond, detail }); p(`check.${name}`, `${cond ? 'ok' : 'MISMATCH'} (${detail})`) }
const R = {}
R.synth = await measure(synthStep); show('synth', R.synth)
R.synthChurn = await measure(withMutant(synthStep, 'churn')); show('synth+churn', R.synthChurn)
R.synthLeak = await measure(withMutant(synthStep, 'leak')); show('synth+leak', R.synthLeak)
idle = false
R.real = await measure(realStep); show('play.walk', R.real)
R.real.top.forEach((l, i) => p(`play.walk.top[${i}]`, l))
R.realChurn = await measure(withMutant(realStep, 'churn')); show('play.walk+churn', R.realChurn)
R.realLeak = await measure(withMutant(realStep, 'leak')); show('play.walk+leak', R.realLeak)
summary.runs = R
const churnCost = R.synthChurn.allocB - R.synth.allocB, leakRet = R.synthLeak.retainedB - R.synth.retainedB
check('synth_clean_PASS', R.synth.verdict === 'PASS', `alloc ${R.synth.allocB.toFixed(1)} retained ${R.synth.retainedB.toFixed(2)}`)
check('churn_mutant_is_300_500B', churnCost >= 300 && churnCost <= 500, `${churnCost.toFixed(1)} B/frame`)
check('synth_churn_FAIL_on_alloc', R.synthChurn.verdict === 'FAIL' && R.synthChurn.allocB > ALLOC_BUDGET_B_PER_FRAME, `alloc ${R.synthChurn.allocB.toFixed(1)}`)
check('synth_churn_retained_clean', R.synthChurn.retainedB <= RETAIN_BUDGET_B_PER_FRAME, `retained ${R.synthChurn.retainedB.toFixed(2)}`)
check('synth_leak_FAIL_on_retained', R.synthLeak.verdict === 'FAIL' && R.synthLeak.retainedB > RETAIN_BUDGET_B_PER_FRAME, `retained ${R.synthLeak.retainedB.toFixed(2)} alloc ${R.synthLeak.allocB.toFixed(1)}`)
check('real_measured_finite', Number.isFinite(R.real.allocB) && Number.isFinite(R.real.retainedB), `alloc ${R.real.allocB.toFixed(1)} verdict ${R.real.verdict} (expected FAIL until F5a; recorded, not asserted)`)
check('real_churn_detected', R.realChurn.verdict === 'FAIL' && R.realChurn.allocB - R.real.allocB >= 0.8 * churnCost, `+${(R.realChurn.allocB - R.real.allocB).toFixed(1)} B/frame`)
check('real_leak_detected', R.realLeak.verdict === 'FAIL' && R.realLeak.retainedB - R.real.retainedB >= 0.5 * leakRet, `+${(R.realLeak.retainedB - R.real.retainedB).toFixed(2)} B/frame retained`)
if (DELIB) check('DELIBERATE_synth_clean_expected_FAIL', R.synth.verdict === 'FAIL', 'deliberately wrong expectation')
p('self_test', `${ok}/${n}`)
if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2)) }
process.exit(ok === n ? 0 : 1)