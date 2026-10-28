// F2b precision gate (ADR-007): an INDEPENDENT check of the m1a floating-origin contract —
// exact origins, rebase trigger and 256 m lattice boundaries, the f64-subtract-then-narrow
// extract, and the wall-clock cost of a rebase — run against the real SimulationCore.
// WHY: m1a T2/T4 read the engine's own REBASE_THRESHOLD / ORIGIN_LATTICE, T3 counts but never
// times rebases, no row reads any localPosF32, and T5 drops every frame ≥ 250 ms and tags the
// wrong frame as the rebase frame (A1-U08-5/-6/-7; rechecks pre-t4:docs/audit/U27b3b2b2b2b1-m1a-recheck.md
// and pre-t4:docs/audit/U27b3b2b2b2b2a-m1a-timing-recheck.md). Truth here comes from PINNED SPEC LITERALS and the
// raw f64 inputs only; the gate never imports a constant from the engine.
//
// Run from game/:
//   node tools/test-precision-gate.mjs                         gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-precision-gate.mjs --self-test [--deliberate]   every mutant must turn the gate red
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned spec literals (Milestone 1A contract; change only with an ADR in the same commit) ----
const LATTICE = 256                 // O = 256·round(P/256), per axis
const TRIGGER = 1024                // rebase when max-axis |P − O| > 1024 (strict)
const DT = 1 / 60                   // fixed tick
const SPEC_TICKS = [31, 62, 93, 123, 154, 185, 216, 246, 277] // +x at 2,000 m/s, Milestone 1A
const SPEC_DELTA = [1024, 0, 0]
const HALF = LATTICE / 2            // |local| ≤ 128 straight after a shift
// ---- timing budgets: judge the COST of the work, never the display rate ----------------------
// WHY: one advance(1/60) runs one tick (16 rails + 4 entities) in ~0.05 ms. A 16 ms call would
// be a full 60 Hz frame of stall; a rebase window (the call that rebases + the next call, so cost
// that lands one frame late is still attributed — U08-7) gets 4 ms. Each statistic is the MIN over
// three runs, so a random GC pause must hit all three runs to redden the gate; an injected stall
// is deterministic and reddens every run. Nothing is dropped: calls ≥ 250 ms are counted.
const STALL_CEIL_MS = 16, REBASE_COST_MS = 4, LONG_MS = 250, TIMING_RUNS = 3

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const SRC = {
  pm: path.join(game, 'src/core/math/precisionMath.ts'),
  sc: path.join(game, 'src/core/simulation/SimulationCore.ts'),
}
const sha = () => Object.values(SRC).map((f) => createHash('sha256').update(readFileSync(f)).digest('hex')).join(':')
const PRODUCTION = sha()

// Bundles the REAL core; a mutant is a list of [fileKey, from, to] source rewrites applied in the
// bundle only (fresh module instance per mutant, production files never written).
let nBuild = 0
async function load(rewrites = []) {
  const hits = rewrites.map(() => 0)
  const out = path.join(game, 'node_modules', '.cache', `f2b-precision-${process.pid}-${nBuild++}.mjs`)
  await build({
    stdin: { contents: `export { SimulationCore } from './core/simulation/SimulationCore';`, resolveDir: path.join(game, 'src'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    plugins: [{ name: 'f2b-mutate', setup(b) {
      b.onLoad({ filter: /(precisionMath|SimulationCore)\.ts$/ }, (a) => {
        let src = readFileSync(a.path, 'utf8')
        rewrites.forEach(([k, from, to], i) => {
          if (a.path !== SRC[k]) return
          const parts = src.split(from); hits[i] += parts.length - 1; src = parts.join(to)
        })
        return { contents: src, loader: 'ts' }
      })
    } }],
  })
  const bad = rewrites.filter((_, i) => hits[i] === 0)
  if (bad.length) throw new Error(`mutant rewrite matched nothing: ${JSON.stringify(bad[0][1])}`)
  return (await import(pathToFileURL(out).href)).SimulationCore
}

// ---- oracle: the spec rule on raw f64 inputs ------------------------------------------------
const latticeOf = (p) => p.map((v) => LATTICE * Math.round(v / LATTICE))
const maxAbs = (v) => Math.max(...v.map(Math.abs))
const XYZ = ['x', 'y', 'z']
const vec = (o) => XYZ.map((k) => o[k])

// Drives a fresh core tick by tick next to the oracle; returns per-leg findings.
function leg(Core, { start, vel, statics = [], ticks }) {
  const core = new Core()
  core.registerEntity('ship', { absPos: { x: start[0], y: start[1], z: start[2] }, velocity: { x: vel[0], y: vel[1], z: vel[2] }, dynamic: true })
  core.setFocusEntity('ship')
  statics.forEach((s, i) => core.registerEntity(`s${i}`, { absPos: { x: s[0], y: s[1], z: s[2] }, dynamic: false }))
  let done = 0
  const events = []
  core.onRebase((ev) => events.push({ tick: done + 1, delta: vec(ev.delta), oldO: vec(ev.oldOrigin), newO: vec(ev.newOrigin) }))
  const P = [...start], O = [0, 0, 0], want = []
  const f = { origin: [], local: [], extract: [], abs: [], extractMaxErr: 0, worstMm: 0 }
  for (let t = 1; t <= ticks; t++) {
    for (let k = 0; k < 3; k++) P[k] += vel[k] * DT          // same f64 operation as the spec's P ← P + V·dt
    let shifted = false
    if (maxAbs(P.map((v, k) => v - O[k])) > TRIGGER) { const n = latticeOf(P); want.push({ tick: t, delta: n.map((v, k) => v - O[k]) }); O.splice(0, 3, ...n); shifted = true }
    core.tick(); done = t
    const eo = vec(core.getOrigin()), ship = core.getEntityState('ship')
    if (eo.some((v, k) => v !== O[k] || v % LATTICE !== 0)) f.origin.push(`t${t}:${eo}≠${O}`)
    if (vec(ship.absPos).some((v, k) => v !== P[k])) f.abs.push(`t${t}`)
    const loc = P.map((v, k) => v - O[k])
    if (maxAbs(loc) > (shifted ? HALF : TRIGGER)) f.local.push(`t${t}:${maxAbs(loc).toFixed(3)}${shifted ? '(post-shift)' : ''}`)
    // every entity and every celestial: localPosF32 must be exactly fround(f64(abs − O))
    const items = [['ship', P], ...statics.map((s, i) => [`s${i}`, s])].map(([id, a]) => [id, a, core.getEntityState(id).localPosF32])
    for (const c of core.getCelestialStates()) items.push([c.config.id, vec(c.absPos), c.localPosF32])
    for (const [id, a, lp] of items) for (let k = 0; k < 3; k++) {
      const exact = a[k] - O[k]
      const err = Math.abs(lp[k] - exact)
      if (lp[k] !== Math.fround(exact)) { f.extractMaxErr = Math.max(f.extractMaxErr, err); if (f.extract.length < 4) f.extract.push(`t${t}:${id}[${k}] err ${err.toPrecision(3)} m`) }
      if (id === 'ship') f.worstMm = Math.max(f.worstMm, err * 1000)
    }
  }
  return { core, events, want, f }
}

function evaluateGeometry(Core) {
  const R = {}
  const put = (id, ok, detail) => { R[id] = { ok: !!ok, detail } }
  // (1) the m1a scenario: +x 2,000 m/s from 0 with the three static beacons, to 10,000 m
  const A = leg(Core, { start: [0, 0, 0], vel: [2000, 0, 0], statics: [[2000, 80, 220], [5000, 80, -220], [8000, 80, 220]], ticks: 300 })
  const eT = A.events.map((e) => e.tick)
  const dOk = A.events.every((e) => e.delta.every((v, k) => v === SPEC_DELTA[k]) && e.newO.every((v, k) => v - e.oldO[k] === e.delta[k]))
  put('trigger-ticks', JSON.stringify(eT) === JSON.stringify(SPEC_TICKS) && JSON.stringify(A.want.map((w) => w.tick)) === JSON.stringify(SPEC_TICKS) && dOk && A.core.stats.rebaseCount === 9 && A.f.origin.length === 0,
    `engine ticks [${eT}] vs spec [${SPEC_TICKS}]; Δ all (1024,0,0): ${dOk}; origin mismatches ${A.f.origin.length}`)
  // (2) off-axis, off-lattice start: catches lattices 64–1000 and thresholds the +x leg cannot see
  const B = leg(Core, { start: [1100.3, -1300.7, 50.9], vel: [1400, -900, 600], statics: [[-777.7, 333.3, 1290.1], [12345.6, -4321.9, 99.9]], ticks: 900 })
  const bT = JSON.stringify(B.events.map((e) => [e.tick, e.delta])) === JSON.stringify(B.want.map((w) => [w.tick, w.delta]))
  put('offaxis-origins', bT && B.f.origin.length === 0 && B.f.local.length === 0 && B.f.abs.length === 0 && B.want.length >= 10,
    `${B.events.length} engine vs ${B.want.length} oracle shifts, same ticks/Δ: ${bT}; origin ${B.f.origin.slice(0, 2).join(' ') || 'exact'}; local ${B.f.local.slice(0, 2).join(' ') || `≤${HALF} post-shift, ≤${TRIGGER} else`}`)
  // (3) trigger boundary: strict > 1024 at the edge, on a static focus
  const cases = [[1024, 0], [-1024, 0], [1023.5, 0], [1024.0001, 1], [-1024.0001, 1], [1024.5, 1]]
  const bnd = cases.filter(([x, w]) => {
    const c = new Core(); c.registerEntity('f', { absPos: { x, y: 0, z: 0 }, dynamic: false }); c.setFocusEntity('f'); c.tick()
    return c.stats.rebaseCount !== w
  })
  put('boundary', bnd.length === 0, bnd.length ? `wrong at x = ${bnd.map((b) => b[0]).join(', ')}` : '1024/−1024/1023.5 hold; 1024.0001/−1024.0001/1024.5 shift')
  // (4) extract on both legs: entities (dynamic + static) and all celestials, bit-exact
  const ex = [...A.f.extract, ...B.f.extract]
  put('extract-exact', ex.length === 0 && A.f.abs.length === 0, ex.length ? `${ex.slice(0, 3).join('; ')} (max ${Math.max(A.f.extractMaxErr, B.f.extractMaxErr).toPrecision(3)} m)` : `1,200 ticks × (5–6 entities + ${A.core.getCelestialStates().length} celestials) = fround(f64(abs − O))`)
  // (5) far origin: 1 AU on x, Pluto-rail scale on y — the f32-before-subtract fault shows here
  const C = leg(Core, { start: [149597870700.3, 3770000.7, -1234567.89], vel: [1999, -700, 300], ticks: 400 })
  put('far-origin', C.f.extract.length === 0 && C.f.origin.length === 0 && C.f.worstMm < 1 && C.events.length > 0,
    `${C.events.length} shifts at 1.496e11 m; ship local error max ${C.f.worstMm.toPrecision(3)} mm (limit 1 mm); extract ${C.f.extract[0] ?? 'exact'}`)
  return R
}

// (6)/(7) cost of advance() on the m1a scenario, rebase attributed to its own call AND the next.
function timingRun(Core, calls) {
  const c = new Core()
  c.registerEntity('ship', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: 2000, y: 0, z: 0 }, dynamic: true })
  c.setFocusEntity('ship')
  for (const b of [[2000, 80, 220], [5000, 80, -220], [8000, 80, 220]]) c.registerEntity(`b${b[0]}`, { absPos: { x: b[0], y: b[1], z: b[2] }, dynamic: false })
  let worst = 0, rebaseWorst = 0, long = 0, rebaseCalls = 0, pending = false
  for (let i = 0; i < calls; i++) {
    const n0 = c.stats.rebaseCount, t0 = performance.now()
    c.advance(DT)
    const ms = performance.now() - t0
    worst = Math.max(worst, ms); if (ms >= LONG_MS) long++
    const reb = c.stats.rebaseCount !== n0
    if (reb || pending) rebaseWorst = Math.max(rebaseWorst, ms)
    if (reb) rebaseCalls++
    pending = reb
  }
  return { worst, rebaseWorst, long, rebaseCalls, ticks: c.stats.tickCount }
}
function evaluateTiming(Core) {
  timingRun(Core, 300)                                   // JIT warm-up on a throwaway instance
  const runs = Array.from({ length: TIMING_RUNS }, () => timingRun(Core, 300))
  const minOf = (k) => Math.min(...runs.map((r) => r[k]))
  const R = {}
  const okTicks = runs.every((r) => r.ticks === 300 && r.rebaseCalls === 9)
  R['stall-ceiling'] = { ok: minOf('worst') <= STALL_CEIL_MS && minOf('long') === 0 && okTicks,
    detail: `worst advance() ${minOf('worst').toFixed(3)} ms (limit ${STALL_CEIL_MS}); calls ≥ ${LONG_MS} ms counted, not dropped: ${runs.map((r) => r.long)}; 300 ticks/9 rebases per run: ${okTicks}` }
  R['rebase-cost'] = { ok: minOf('rebaseWorst') <= REBASE_COST_MS && okTicks,
    detail: `worst rebase window (rebasing call + next) ${minOf('rebaseWorst').toFixed(3)} ms (limit ${REBASE_COST_MS}); min over ${TIMING_RUNS} runs` }
  return R
}

// ---- mutants: [label, rewrites, checks that must turn red] ----------------------------------
const busy = (ms) => `{ const __t = performance.now(); while (performance.now() - __t < ${ms}) {} }`
const ADV = 'advance(dtRealSeconds: number): void {'
const f32 = (a) => [['sc', `e.localPosF32[${a}] = e.absPos.${XYZ[a]} - origin.${XYZ[a]};`, `e.localPosF32[${a}] = Math.fround(e.absPos.${XYZ[a]}) - Math.fround(origin.${XYZ[a]});`]]
const MUTANTS = [
  ['threshold-900', [['pm', 'export const REBASE_THRESHOLD = 1024;', 'export const REBASE_THRESHOLD = 900;']], ['trigger-ticks', 'offaxis-origins', 'boundary']],
  ['threshold-1023', [['pm', 'export const REBASE_THRESHOLD = 1024;', 'export const REBASE_THRESHOLD = 1023;']], ['boundary']],
  ['threshold-1025', [['pm', 'export const REBASE_THRESHOLD = 1024;', 'export const REBASE_THRESHOLD = 1025;']], ['boundary']],
  ['threshold-non-strict', [['pm', 'return maxAxisAbs(pLocal) > REBASE_THRESHOLD;', 'return maxAxisAbs(pLocal) >= REBASE_THRESHOLD;']], ['boundary']],
  ['lattice-128', [['pm', 'export const ORIGIN_LATTICE = 256;', 'export const ORIGIN_LATTICE = 128;']], ['offaxis-origins']],
  ['lattice-300', [['pm', 'export const ORIGIN_LATTICE = 256;', 'export const ORIGIN_LATTICE = 300;']], ['trigger-ticks', 'offaxis-origins']],
  ['lattice-512', [['pm', 'export const ORIGIN_LATTICE = 256;', 'export const ORIGIN_LATTICE = 512;']], ['offaxis-origins']],
  ['origin-floor-not-round', [['pm', '/ ORIGIN_LATTICE + 0.5)', '/ ORIGIN_LATTICE)']], ['offaxis-origins']],
  ['f32-before-subtract', [...f32(0), ...f32(1), ...f32(2)], ['extract-exact', 'far-origin']],
  ['static-locals-stale', [['sc', 'e.localPosF32[0] = e.absPos.x - origin.x;', 'if (!e.dynamic) continue; e.localPosF32[0] = e.absPos.x - origin.x;']], ['extract-exact']],
  ['celestial-locals-stale', [['sc', 'const celestials = this._rail.states;', 'const celestials = [];']], ['extract-exact']],
  ['stall-300ms-per-rebase', [['sc', 'this._emitRebase();', `this._emitRebase(); ${busy(300)}`]], ['stall-ceiling', 'rebase-cost']],
  ['freeze-1s-x3', [['sc', ADV, `${ADV} this.__n = (this.__n || 0) + 1; if (this.__n % 100 === 50) ${busy(1000)}`]], ['stall-ceiling']],
  ['hitch-40ms-on-rebase', [['sc', 'this._emitRebase();', `this._emitRebase(); ${busy(40)}`]], ['stall-ceiling', 'rebase-cost']],
  ['hitch-40ms-frame-after-rebase', [['sc', 'this._emitRebase();', 'this._emitRebase(); this.__h = 1;'], ['sc', ADV, `${ADV} if (this.__h) { this.__h = 0; ${busy(40)} }`]], ['stall-ceiling', 'rebase-cost']],
]
if (DELIB) MUTANTS.push(['deliberate-identity', [], ['trigger-ticks']])

const evaluate = (Core) => ({ ...evaluateGeometry(Core), ...evaluateTiming(Core) })
let exit = 0
try {
  const R0 = evaluate(await load())
  const ids = Object.keys(R0)
  if (!SELF) {
    for (const [id, r] of Object.entries(R0)) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${id} — ${r.detail}`)
    const pass = ids.filter((k) => R0[k].ok).length
    console.log(`PRECISION GATE ${pass === ids.length ? 'PASS' : 'FAIL'} ${pass}/${ids.length}`)
    exit = pass === ids.length ? 0 : 1
  } else {
    const rows = [['baseline-green', ids.every((k) => R0[k].ok), `${ids.filter((k) => R0[k].ok).length}/${ids.length}`]]
    if (!rows[0][1]) for (const [id, r] of Object.entries(R0)) if (!r.ok) console.log(`  FAIL baseline ${id} — ${r.detail}`)
    for (const [label, rw, must] of MUTANTS) {
      const R = evaluate(await load(rw))
      const red = ids.filter((k) => !R[k].ok)
      rows.push([label, must.every((k) => !R[k].ok), `red: ${red.join(',') || 'none'} (must: ${must.join(',')})`])
    }
    rows.push(['production-sources-unchanged', sha() === PRODUCTION, ''])
    for (const [l, ok, d] of rows) console.log(`${ok ? 'PASS' : 'FAIL'} ${l} ${d}`)
    const n = rows.filter((r) => r[1]).length
    console.log(`SELF-TEST ${n === rows.length ? 'PASS' : 'FAIL'} ${n}/${rows.length}`)
    exit = n === rows.length ? 0 : 1
  }
} catch (err) {
  console.error('PRECISION GATE BROKEN', err?.stack ?? err)
  exit = 2
}
process.exit(exit)