// A1-U08 — m1a harness row-validity probe (read-only; new file under game/tools/audit/).
// Runs the REAL SimulationCore (and generated MUTANT copies of it in /tmp) in Node,
// driven by the harness's acceptance code sliced VERBATIM from
// src/test/Milestone1A_TestHarness.tsx: the TEST/test/onRebase/finalizeTest block and
// the per-frame capture block of useFrame. Frame deltas are synthetic streams, so T5
// can be tested at any frame rate. Each mutant runs twice: with the harness reading
// the (mutated) precisionMath constants exactly as shipped, and with the Milestone 1A
// spec constants (1,024 m bound, 256 m lattice) hard-wired.
// Usage: cd game && node tools/audit/u08-m1a-validity.mjs ; exit 0 = every probe ran and
// every CONTROL behaved; the CONFIRMED / NOT-CONFIRMED lines are the evidence.
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../src')
const esbuild = await import('esbuild')
const out = []
const check = (id, cond, msg) => { out.push([id, !!cond]); console.log(`[u08] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }
let controlsOk = true
const control = (id, cond, msg) => { if (!cond) controlsOk = false; console.log(`[u08] CONTROL ${cond ? 'OK' : 'BROKEN'} ${id}: ${msg}`) }

/* ---- verbatim harness slices -------------------------------------------- */
const H = readFileSync(join(src, 'test/Milestone1A_TestHarness.tsx'), 'utf8')
const lineOf = (i) => H.slice(0, i).split('\n').length
const aStart = H.indexOf('const TEST = {')
const aEnd = H.lastIndexOf('/*', H.indexOf(' * LIVE FRAME STATISTICS'))
const bStartMarker = '    if (!test.finished) {\n      if (test.warmup > 0) {'
const bStart = H.indexOf(bStartMarker)
const bEndMarker = '        finalizeTest();\n      }\n    }\n'
const bEnd = H.indexOf(bEndMarker, bStart) + bEndMarker.length
if (aStart < 0 || aEnd < aStart || bStart < 0 || bEnd < bEndMarker.length) throw new Error('harness slice markers not found')
console.log(`[u08] slice A (TEST/test/onRebase/finalizeTest): lines ${lineOf(aStart)}..${lineOf(aEnd)}; slice B (frame capture): lines ${lineOf(bStart)}..${lineOf(bEnd)}`)
const factoryTs = `
export function make(core: any, shipState: any, REBASE_THRESHOLD: number, ORIGIN_LATTICE: number, sink: any) {
  const TEST_DISTANCE_M = 10_000;
  const useGameStore = { getState: () => ({ completeTest: (r: any) => { sink.results = r; } }) };
${H.slice(aStart, aEnd)}
  return {
    test,
    frame(delta: number): boolean {
      const rebaseBefore = core.stats.rebaseCount;
      core.advance(delta);
      const rebasedThisFrame = core.stats.rebaseCount !== rebaseBefore;
      const frameMs = delta * 1000;
${H.slice(bStart, bEnd)}
      return test.finished;
    },
  };
}
`
writeFileSync('/tmp/u08-m1a-factory.mjs', esbuild.transformSync(factoryTs, { loader: 'ts', format: 'esm' }).code)
const F = await import(pathToFileURL('/tmp/u08-m1a-factory.mjs').href)

/* ---- mutant cores --------------------------------------------------------- */
const PM_SRC = readFileSync(join(src, 'core/math/precisionMath.ts'), 'utf8')
const SC_SRC = readFileSync(join(src, 'core/simulation/SimulationCore.ts'), 'utf8')
function absolutise(code, fromDir, redirect) {
  return code.replace(/from '(\.\.?\/[^']+)'/g, (m, p) => {
    if (redirect && p.endsWith('math/precisionMath')) return `from '${redirect}'`
    return `from '${pathToFileURL(resolve(fromDir, p)).href}.ts'`
  })
}
function edit(code, edits, label) {
  for (const [find, repl, all] of edits) {
    if (!code.includes(find)) throw new Error(`mutant ${label}: anchor not found: ${find}`)
    code = all ? code.split(find).join(repl) : code.replace(find, repl)
  }
  return code
}
const cache = new Map()
async function loadCore(name, pmEdits = [], scEdits = []) {
  if (cache.has(name)) return cache.get(name)
  const dir = `/tmp/u08m/${name}`
  mkdirSync(dir, { recursive: true })
  writeFileSync(`${dir}/precisionMath.ts`, absolutise(edit(PM_SRC, pmEdits, name), join(src, 'core/math')))
  writeFileSync(`${dir}/SimulationCore.ts`, absolutise(edit(SC_SRC, scEdits, name), join(src, 'core/simulation'), pathToFileURL(`${dir}/precisionMath.ts`).href))
  const SC = await import(pathToFileURL(`${dir}/SimulationCore.ts`).href)
  const PM = await import(pathToFileURL(`${dir}/precisionMath.ts`).href)
  const m = { SC, PM }
  cache.set(name, m)
  return m
}
const thr = (v) => [['export const REBASE_THRESHOLD = 1024;', `export const REBASE_THRESHOLD = ${v};`]]
const lat = (v) => [['export const ORIGIN_LATTICE = 256;', `export const ORIGIN_LATTICE = ${v};`]]
const F32_EXTRACT = [0, 1, 2].map((i) => {
  const ax = 'xyz'[i]
  return [`e.localPosF32[${i}] = e.absPos.${ax} - origin.${ax};`, `e.localPosF32[${i}] = Math.fround(e.absPos.${ax}) - Math.fround(origin.${ax});`]
})
const STATIC_STALE = [['e.localPosF32[0] = e.absPos.x - origin.x;', 'if (!e.dynamic) continue; e.localPosF32[0] = e.absPos.x - origin.x;']]

/* ---- one harness run ------------------------------------------------------ */
const BEACONS = [{ id: 'beacon-a', x: 2000, z: 220 }, { id: 'beacon-b', x: 5000, z: -220 }, { id: 'beacon-c', x: 8000, z: 220 }]
const SPEC_TICKS = [31, 62, 93, 123, 154, 185, 216, 246, 277]
const ROWS = ['abs-distance', 'local-bound', 'rebase-count', 'delta-lattice', 'frame-stability']
const at60 = () => 1 / 60
async function run(mod, { velocity = 2000, stream = at60, specConst = false } = {}) {
  const core = new mod.SC.SimulationCore()
  const ship = core.registerEntity('ship', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: velocity, y: 0, z: 0 }, dynamic: true })
  core.setFocusEntity('ship')
  const beacons = BEACONS.map((b) => core.registerEntity(b.id, { absPos: { x: b.x, y: 80, z: b.z }, dynamic: false }))
  const ticks = []; const deltas = []
  core.onRebase((ev) => { ticks.push(core.stats.tickCount + 1); deltas.push([ev.delta.x, ev.delta.y, ev.delta.z]) })
  const sink = {}
  const h = F.make(core, ship, specConst ? 1024 : mod.PM.REBASE_THRESHOLD, specConst ? 256 : mod.PM.ORIGIN_LATTICE, sink)
  const logs = []; const ol = console.log; console.log = (s) => logs.push(String(s))
  let ctx = { i: 0, rebasedLast: false }
  try {
    for (let i = 0; i < 20000; i++) {
      ctx.i = i
      const before = core.stats.rebaseCount
      if (h.frame(stream(ctx))) break
      ctx.rebasedLast = core.stats.rebaseCount !== before
    }
  } finally { console.log = ol }
  const o = core.getOrigin()
  let beaconErr = 0
  for (const b of beacons) {
    beaconErr = Math.max(beaconErr, Math.abs(b.localPosF32[0] - Math.fround(b.absPos.x - o.x)), Math.abs(b.localPosF32[2] - Math.fround(b.absPos.z - o.z)))
  }
  const r = sink.results
  const v = r ? ROWS.map((k) => (r[k].pass ? 'P' : 'F')).join('') : '-----'
  return { v, allPass: v === 'PPPPP', r, logs, ticks, deltas, beaconErr, frames: h.test.frameCount, rebaseFrames: h.test.rebaseFrameCount, maxLocal: core.stats.focusMaxLocalPostTick }
}
const fmt = (x) => `${x.v} (T1..T5) rebases=${x.ticks.length} maxLocal=${x.maxLocal.toFixed(2)}`

/* ---- 1. baseline + controls ----------------------------------------------- */
const real = await loadCore('real')
const base = await run(real)
control('C1 baseline', base.allPass, fmt(base))
check('M1A-TICKS', JSON.stringify(base.ticks) === JSON.stringify(SPEC_TICKS) && base.deltas.every((d) => d[0] === 1024 && d[1] === 0 && d[2] === 0),
  `rebase ticks ${JSON.stringify(base.ticks)} vs spec ${JSON.stringify(SPEC_TICKS)}; every Δ = (1024,0,0): ${base.deltas.every((d) => d[0] === 1024)} (engine matches Milestone 1A §88)`)
check('M1A-BEACON-OK', base.beaconErr < 1e-3, `real core: static beacon locals = f32(abs − O) after the last rebase, max err ${base.beaconErr.toExponential(2)} m`)
const slow = await run(real, { velocity: 1000 })
control('C2 v=1000 m/s', slow.v[0] === 'F' && slow.v[2] === 'F', fmt(slow))
const noRebase = await loadCore('thr1e9', thr(1e9))
const nr = await run(noRebase, { specConst: true })
control('C3 no rebase, spec constants', nr.v[1] === 'F' && nr.v[2] === 'F', fmt(nr))

/* ---- 2. text output (template literals) ----------------------------------- */
const line = base.logs.find((l) => l.includes('[Milestone1A] acceptance')) || ''
const lit = ['{ticks}', '{f2(avg)}']
const detLit = { 'abs-distance': '{simTime.toFixed(3)}', 'rebase-count': '{TEST.REBASE_MAX}', 'delta-lattice': '{rebaseCount}', 'frame-stability': '{avg > 0' }
check('M1A-TEXT-LINE', lit.every((s) => line.includes(s)) && !line.includes('10000.') ,
  `console verdict line prints literal braces and no position/maxLocal/avg values: "${line}"`)
check('M1A-TEXT-DETAIL', Object.entries(detLit).every(([k, s]) => base.r[k].detail.includes(s)),
  `4 of 5 row details print literal template text: ${Object.entries(detLit).map(([k, s]) => `${k} has "${s}"`).join('; ')}`)
console.log(`[u08]   detail abs-distance: ${base.r['abs-distance'].detail}`)
console.log(`[u08]   detail frame-stability: ${base.r['frame-stability'].detail}`)

/* ---- 3. threshold sweep --------------------------------------------------- */
const sweep = []
for (const t of [512, 900, 960, 1000, 1023, 1024, 1025, 1100, 1200, 1500, 2048]) {
  const m = await loadCore(`thr${t}`, thr(t))
  const a = await run(m); const s = await run(m, { specConst: true })
  sweep.push([t, a, s])
  console.log(`[u08]   threshold ${t}: as-shipped ${fmt(a)} | spec-const ${s.v} | ticks ${JSON.stringify(a.ticks)}`)
}
const passAs = sweep.filter(([, a]) => a.allPass).map(([t]) => t)
const passSpec = sweep.filter(([, , s]) => s.allPass).map(([t]) => t)
check('M1A-THR', passAs.some((t) => t !== 1024),
  `rebase thresholds that pass all 5 rows as shipped (bound read from the mutated constant): ${JSON.stringify(passAs)}; with the spec bound 1,024 hard-wired: ${JSON.stringify(passSpec)}`)
check('M1A-T2-STRUCT', sweep.every(([t, a]) => a.v[1] === 'P'),
  `T2 (local-bound) passes for EVERY threshold mutant as shipped — its bound is the same constant the engine triggers on, so T2 cannot fail unless rebasing breaks entirely`)
const nine = sweep.filter(([, a]) => a.allPass && a.ticks.length === 10).map(([t]) => t)
check('M1A-T3-WINDOW', nine.length > 0, `thresholds giving 10 rebases (spec: exactly 9) that still pass T3's 9–10 window: ${JSON.stringify(nine)}`)

/* ---- 4. lattice mutants ---------------------------------------------------- */
for (const L of [64, 128, 300, 512, 1000]) {
  const m = await loadCore(`lat${L}`, lat(L))
  const a = await run(m); const s = await run(m, { specConst: true })
  check(`M1A-LAT-${L}`, a.allPass, `lattice ${L} m (spec: 256): as-shipped ${fmt(a)}; spec-const ${s.v}; Δ set ${JSON.stringify([...new Set(a.deltas.map((d) => d[0]))])}`)
}
// Independent truth the harness never exercises: an off-lattice, off-axis focus.
{
  const truth = []
  for (const L of [128, 256, 512]) {
    const m = await loadCore(`lat${L}`, lat(L))
    const core = new m.SC.SimulationCore()
    core.registerEntity('p', { absPos: { x: 1100.3, y: -1300.7, z: 50 }, velocity: { x: 0, y: 0, z: 0 }, dynamic: true })
    core.setFocusEntity('p'); core.tick()
    const o = core.getOrigin(); truth.push(`L=${L}: O=(${o.x},${o.y},${o.z}) ${o.x % 256 === 0 && o.y % 256 === 0 ? 'on 256 lattice' : 'OFF 256 lattice'}`)
  }
  check('M1A-LAT-TRUTH', truth[0].includes('OFF') && truth[1].includes('on 256'), `one tick at P=(1100.3,−1300.7,50): ${truth.join('; ')} — a non-axis-aligned case exposes the lattice, the 2,000 m/s +x run does not`)
}

/* ---- 5. precision mutants -------------------------------------------------- */
{
  const f32 = await loadCore('f32extract', [], F32_EXTRACT)
  const a = await run(f32)
  check('M1A-F32', a.allPass, `local = fround(P) − fround(O) (narrow BEFORE subtract, violates the brief §3 invariant): ${fmt(a)}`)
  const far = []
  for (const [nm, m] of [['real', real], ['f32extract', f32]]) {
    const core = new m.SC.SimulationCore()
    const e = core.registerEntity('p', { absPos: { x: 1.496e11 + 1000.37, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, dynamic: true })
    core.setFocusEntity('p'); core.tick()
    const o = core.getOrigin(); const exact = e.absPos.x - o.x
    far.push([nm, Math.abs(e.localPosF32[0] - exact)])
  }
  check('M1A-F32-FAR', far[0][1] < 1e-3 && far[1][1] > 100, `same mutant 1 AU from the Sun: local error real ${far[0][1].toExponential(2)} m, mutant ${far[1][1].toFixed(0)} m — the 10 km run is ~7 orders too close to the origin to see it`)
  const st = await run(await loadCore('staticStale', [], STATIC_STALE))
  check('M1A-STATIC', st.allPass && st.beaconErr > 1000, `static entities never re-extracted after a rebase (beacons render ${st.beaconErr.toFixed(0)} m from their true local): ${fmt(st)}`)
}

/* ---- 6. T5 frame streams --------------------------------------------------- */
const streams = {
  '144Hz': () => 1 / 144,
  '50Hz': () => 1 / 50,
  '30Hz': () => 1 / 30,
  'stall200@rebase': (c) => (c.rebasedLast ? 0.2 : 1 / 60),
  'stall300@rebase': (c) => (c.rebasedLast ? 0.3 : 1 / 60),
  'stall40@rebase': (c) => (c.rebasedLast ? 0.04 : 1 / 60),
  'stall1000x3': (c) => (c.i === 60 || c.i === 120 || c.i === 180 ? 1.0 : 1 / 60),
}
const sr = {}
for (const [k, fn] of Object.entries(streams)) {
  sr[k] = await run(real, { stream: fn })
  console.log(`[u08]   stream ${k}: ${fmt(sr[k])} frames=${sr[k].frames} rebaseFrames=${sr[k].rebaseFrames} | ${sr[k].r['frame-stability'].detail}`)
}
control('C4 30 Hz fails T5', sr['30Hz'].v[4] === 'F', sr['30Hz'].v)
control('C5 200 ms stall per rebase fails T5', sr['stall200@rebase'].v[4] === 'F', sr['stall200@rebase'].v)
check('M1A-T5-STALL', sr['stall300@rebase'].allPass && sr['stall1000x3'].allPass,
  `a 300 ms stall on EVERY rebase (9 stalls) → ${sr['stall300@rebase'].v}; three 1 s freezes → ${sr['stall1000x3'].v}: frames ≥ 250 ms are dropped from the record, so the worst stutters are invisible to T5`)
const rw = sr['stall40@rebase'].r['frame-stability'].detail
check('M1A-T5-ATTRIB', sr['stall40@rebase'].allPass && /worst rebase-frame 16\.67 ms/.test(rw),
  `a 40 ms hitch on the frame after every rebase passes and the detail still reports "worst rebase-frame 16.67 ms": the frame flagged as the rebase frame is the one whose delta PRECEDES the rebase, and rebaseWorst is not in the verdict`)

const confirmed = out.filter(([, c]) => c).length
console.log(`[u08] SUMMARY ${confirmed}/${out.length} confirmed; controls ${controlsOk ? 'OK' : 'BROKEN'}`)
process.exit(controlsOk ? 0 : 1)