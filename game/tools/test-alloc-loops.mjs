// F1bb allocation gate for the HEADLESS harness loops (ADR-003): the exact burn programs
// of the m1b T4 (SimulationCore.tick), m1d T4 (FlightController.integrateFlight) and
// m1e zero-gc (AstronautKCC.integrateTick) rows, measured with the ADR-002 instrument.
// WHY: those rows read usedJSHeapSize deltas (blind to transient churn, A1-U03-4/U04-5/
// U05-3/U07-3). Budgets as ADR-002: sampled ≤ 64 B/tick AND retained ≤ 8 B/tick.
//
// Run from game/:
//   node --expose-gc tools/test-alloc-loops.mjs [--out <NEW dir>]   gate (exit 0 PASS, 1 FAIL, 2 instrument broken)
//   node --expose-gc tools/test-alloc-loops.mjs --self-test [--deliberate]   mutant sensitivity per loop
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createInstrument, withMutant, ALLOC_BUDGET_B_PER_FRAME as AB, RETAIN_BUDGET_B_PER_FRAME as RB } from './alloc-lib.mjs'

const args = process.argv.slice(2)
const flag = (k) => args.includes(k)
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }
const SELF = flag('--self-test'), DELIB = flag('--deliberate'), OUT = opt('--out')
if (OUT && fs.existsSync(OUT)) { console.error(`--out ${OUT} exists; give a NEW path`); process.exit(2) }
if (typeof globalThis.gc !== 'function') { console.error('run with node --expose-gc'); process.exit(2) }

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'f1bb-alloc-loops.bundle.mjs')
await build({
  stdin: {
    contents: `export { SimulationCore } from './core/simulation/SimulationCore';
      export * from './core/physics/flightController';
      export * from './core/physics/astronautKCC';
      export * from './core/physics/sphericalFrame';
      export { initTerrainField, TEST_PLANET } from './core/terrain/terrainField';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
})
const bundleUrl = pathToFileURL(out).href
const marks = []
fs.readFileSync(out, 'utf8').split('\n').forEach((l, i) => { const m = /^\/\/ (\S+\.tsx?)$/.exec(l); if (m) marks.push([i, m[1]]) })
const modOf = (line) => { let r = '?'; for (const [i, m] of marks) { if (i <= line) r = m; else break } return r }
const M = await import(bundleUrl)
const p = (k, v) => console.log(`${k}=${v}`)
const I = await createInstrument({ bundleUrl, modOf })
const cal = await I.calibrate()
p('cal.noop_B_per_iter', cal.noop.toFixed(2)); p('cal.obj3_B_per_iter', cal.obj3.toFixed(1)); p('cal.f64x16_B_per_iter', cal.f64x16.toFixed(1)); p('cal.ok', cal.ok)
if (!cal.ok) { console.error('instrument calibration failed'); process.exit(2) }

const R = M.TEST_PLANET.radius
M.initTerrainField(M.TEST_PLANET)

// ---- loop 1: m1b T4 — SimulationCore.tick (30x default time scale, 20,000 ticks)
const core = new M.SimulationCore()
const coreStep = () => core.tick()

// ---- loop 2: m1d T4 — FlightController.integrateFlight(1/60), deterministic input program
const ctrl = new M.FlightController(M.EARTHSCALE_FLIGHT)
const _q = { x: 0, y: 0, z: 0, w: 1 }
M.quatFromBasisInto(0, 0, -1, 0, 1, 0, _q)
ctrl.teleport(0, R + 600, 0, 260, 0, 0, _q)
let fk = 0
function flightStep() {
  const k = fk++, f = ctrl.input
  f.pitch = 0.25 * Math.sin(0.0007 * k); f.roll = 0.3 * Math.sin(0.00043 * k + 1)
  f.yaw = 0.1 * Math.cos(0.00031 * k); f.throttle = 0.55 + 0.35 * Math.sin(0.0002 * k)
  ctrl.integrateFlight(1 / 60)
}

// ---- loop 3: m1e zero-gc — AstronautKCC.integrateTick, surface walk / zero-G RCS / sphere sweep program
const kcc = new M.AstronautKCC(M.EARTHSCALE_ASTRONAUT)
kcc.teleportSurface(0, 1, 0)
let kk = 0
function kccStep() {
  const i = kk++ % 30000, inp = kcc.input
  if (i < 10000) {
    if (i === 0) kcc.teleportSurface(0, 1, 0)
    inp.moveF = Math.sin(0.001 * i); inp.moveR = Math.cos(0.0013 * i); inp.sprint = i % 2000 < 1000
    inp.turnRate = 0.3 * Math.sin(0.0007 * i); if (i % 2500 === 100) inp.jump = true
    inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0
  } else if (i < 20000) {
    if (i === 10000) { const q = kcc.pLocal, l = Math.hypot(q.x, q.y, q.z); kcc.teleportAbs(q.x / l * 31000, q.y / l * 31000, q.z / l * 31000, 0, 0, 0) }
    inp.moveF = 0; inp.moveR = 0; inp.jump = false
    inp.rcsF = Math.sin(0.002 * i); inp.rcsU = Math.cos(0.0017 * i); inp.rcsR = Math.sin(0.0011 * i)
    inp.turnRate = 0.4 * Math.sin(0.0009 * i)
  } else {
    if (i === 20000) { const q = kcc.pLocal, l = Math.hypot(q.x, q.y, q.z); kcc.teleportAbs(q.x / l * 5800, q.y / l * 5800, q.z / l * 5800, -40 * q.x / l, -40 * q.y / l, -40 * q.z / l) }
    inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0; inp.jump = false
    inp.moveF = Math.sin(0.0015 * i); inp.moveR = Math.sin(0.0009 * i + 1)
    inp.sprint = i % 3000 < 1500; inp.turnRate = 0.2 * Math.sin(0.0006 * i)
  }
  kcc.integrateTick(1 / 60)
}

const LOOPS = { 'm1b.core.tick': coreStep, 'm1d.integrateFlight': flightStep, 'm1e.integrateTick': kccStep }
const N = 30000 // one full m1e program cycle; 1.5x the m1b/m1d burn
const OPT = { N, warm: 3000, rounds: 3 }
const show = (tag, r) => { p(`${tag}.alloc_B_per_tick`, r.allocB.toFixed(1)); p(`${tag}.retained_B_per_tick`, r.retainedB.toFixed(2)); p(`${tag}.verdict`, r.verdict) }
const summary = { budgets: { alloc: AB, retained: RB }, ticks: N, cal, runs: {}, checks: [] }

if (!SELF) {
  let pass = true
  for (const [name, step] of Object.entries(LOOPS)) {
    const r = await I.measure(step, OPT); show(name, r); r.top.forEach((l, i) => p(`${name}.top[${i}]`, l))
    summary.runs[name] = r; if (r.verdict !== 'PASS') pass = false
  }
  p('GATE', pass ? 'PASS' : 'FAIL')
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2)) }
  process.exit(pass ? 0 : 1)
}

let ok = 0, n = 0
const check = (name, cond, detail) => { n++; if (cond) ok++; summary.checks.push({ name, cond, detail }); p(`check.${name}`, `${cond ? 'ok' : 'MISMATCH'} (${detail})`) }
for (const [name, step] of Object.entries(LOOPS)) {
  const base = await I.measure(step, OPT), ch = await I.measure(withMutant(step, 'churn'), OPT), lk = await I.measure(withMutant(step, 'leak'), OPT)
  show(name, base); show(`${name}+churn`, ch); show(`${name}+leak`, lk)
  summary.runs[name] = { base, ch, lk }
  const dc = ch.allocB - base.allocB, dl = lk.retainedB - base.retainedB
  // WHY: a churn delta is only measurable on a clean baseline. m1d/m1e are already over the
  // allocation budget (585 / 5,483 B/tick) and wobble ±150..1,100 B between runs (JIT/boxing),
  // which swamps a ~400 B delta, so there the churn clause is recorded, not asserted; the leak
  // clause (retained) is unaffected by the wobble and stays asserted on every loop.
  if (base.verdict === 'PASS') {
    check(`${name}.churn_adds_300_500B`, dc >= 300 && dc <= 500, `+${dc.toFixed(1)} B/tick`)
    check(`${name}.churn_FAIL_on_alloc`, ch.verdict === 'FAIL' && ch.allocB > AB, `alloc ${ch.allocB.toFixed(1)}`)
  } else {
    p(`note.${name}.churn`, `baseline already over budget (${base.allocB.toFixed(1)} B/tick): churn delta ${dc.toFixed(1)} B/tick recorded, not asserted; churn sensitivity is shown on the clean m1b loop`)
  }
  check(`${name}.leak_FAIL_on_retained`, lk.verdict === 'FAIL' && dl >= 20, `+${dl.toFixed(2)} B/tick retained`)
  check(`${name}.baseline_finite`, Number.isFinite(base.allocB) && Number.isFinite(base.retainedB), `alloc ${base.allocB.toFixed(1)} retained ${base.retainedB.toFixed(2)} verdict ${base.verdict} (recorded, not asserted)`)
}
if (DELIB) check('DELIBERATE_core_tick_expected_FAIL_on_clean', summary.runs['m1b.core.tick'].base.verdict === 'FAIL', 'deliberately wrong expectation')
p('self_test', `${ok}/${n}`)
if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2)) }
process.exit(ok === n ? 0 : 1)