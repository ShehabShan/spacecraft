// A1-U07 — m1b harness validity probe (read-only; new file under game/tools/audit/).
// Runs the REAL SimulationCore + KeplerRail in Node and the harness's runSuite()
// sliced VERBATIM from src/test/Milestone1B_TestHarness.tsx (esbuild type-strip),
// then: (1) baseline verdict, (2) controls that MUST fail, (3) mutations of the
// rail state that a correct gate should catch, (4) independent physics truth
// (periods from T = 2π√(a³/μ), finite-difference speed + spin sense, solver grid,
// Hill radii, T5 rebase lattice + celestial locals).
// Usage: cd game && node tools/audit/u07-m1b-validity.mjs ; exit 0 = every probe ran
// and every CONTROL behaved; the CONFIRMED/NOT-CONFIRMED lines are the evidence.
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../src')
const esbuild = await import('esbuild')
const SC = await import(pathToFileURL(join(src, 'core/simulation/SimulationCore.ts')).href)
const KR = await import(pathToFileURL(join(src, 'core/orbit/KeplerRail.ts')).href)
const CD = await import(pathToFileURL(join(src, 'core/orbit/celestialData.ts')).href)

const out = []
const check = (id, cond, msg) => { out.push([id, !!cond]); console.log(`[u07] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }
let controlsOk = true

/* ---- verbatim harness slice -------------------------------------------------- */
const H = readFileSync(join(src, 'test/Milestone1B_TestHarness.tsx'), 'utf8')
const start = H.indexOf('function referencePosition(')
const endMarker = 'publishSuite({ started: true, results, done: true });\n}'
const end = H.indexOf(endMarker, start) + endMarker.length
if (start < 0 || end < endMarker.length) throw new Error('harness slice markers not found')
const slice = H.slice(start, end)
console.log(`[u07] slice: harness chars ${start}..${end} (lines ${H.slice(0, start).split('\n').length}..${H.slice(0, end).split('\n').length})`)
const modTs = `
let core: any, RAIL: any, BODIES: any, wrapAngle: any, solveKeplerE: any;
const DAY_SECONDS = 86400; const JUMP_DAYS = 60;
const suiteState = { started: false, done: false };
let __out: any = null;
let __log: string[] = [];
function publishSuite(p: any) { __out = p; }
${slice}
export function run(c: any) {
  core = c; RAIL = c.rail; BODIES = RAIL.states;
  wrapAngle = W_; solveKeplerE = S_;
  suiteState.started = false; suiteState.done = false; __out = null;
  const ol = console.log; __log = []; console.log = (s: string) => { __log.push(s); };
  try { runSuite(); } finally { console.log = ol; }
  return { results: __out.results, line: __log.join('\\n') };
}
`
const js = 'import { wrapAngle as W_, solveKeplerE as S_ } from ' + JSON.stringify(pathToFileURL(join(src, 'core/orbit/KeplerRail.ts')).href) + ';\n' +
  esbuild.transformSync(modTs, { loader: 'ts', format: 'esm' }).code
writeFileSync('/tmp/u07-suite.mjs', js)
const SUITE = await import(pathToFileURL('/tmp/u07-suite.mjs').href)

const ROWS = ['closed-form', 'reversibility', 'parenting', 'zero-gc', 'm1a-regression']
function verdict(r) { return ROWS.map((k) => `${k}=${r.results[k].pass ? 'P' : 'F'}`).join(' ') }
function runWith(label, { pre, post, restore } = {}) {
  if (pre) pre()
  const core = new SC.SimulationCore()
  if (post) post(core)
  let r
  try { r = SUITE.run(core) } finally { if (restore) restore() }
  console.log(`[u07] run ${label}: ${verdict(r)}`)
  return r
}
const cfg = (id) => CD.CELESTIAL_CONFIGS.find((c) => c.id === id)
const st = (core, id) => core.rail.getState(id)

/* ---- (1) baseline ------------------------------------------------------------ */
const base = runWith('BASELINE')
check('baseline-all-pass', ROWS.every((k) => base.results[k].pass), 'unmodified engine: all 5 rows PASS in Node')
console.log(`[u07] baseline console line: ${base.line}`)
console.log(`[u07] parenting detail: ${base.results['parenting'].detail.slice(0, 120)}`)
check('log-labels-wrong', /maxPosErr=\{/.test(base.line) && /heapDelta=\{/.test(base.line) && /restore=\{/.test(base.line),
  'acceptance console line prints literal `{…}` (missing $) — maxPosErr/heapDelta values never logged')
check('moon-names-literal', base.results['parenting'].detail.startsWith('{moonNames}'), 'T3 detail prints literal `{moonNames}`')
console.log(`[u07] zero-gc detail (Node, no performance.memory): ${base.results['zero-gc'].detail}`)

/* ---- (2) controls (must FAIL the named row) --------------------------------- */
const c1 = runWith('CONTROL earth.absPos.x += 1 m after evaluate', {
  post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail), e = st(core, 'earth'); rail.evaluate = (t) => { o(t); e.absPos.x += 1 } },
})
if (c1.results['closed-form'].pass) controlsOk = false
check('control-pos', !c1.results['closed-form'].pass, 'a 1 m position error after evaluate fails closed-form')
const c2 = runWith('CONTROL moon basisP ×1.001', { post: (core) => { const p = st(core, 'moon').basisP; p.x *= 1.001; p.y *= 1.001; p.z *= 1.001 } })
if (c2.results['parenting'].pass) controlsOk = false
check('control-moon-radius', !c2.results['parenting'].pass && c2.results['closed-form'].pass,
  `moon orbit radius +0.1 % (38.9 m): parenting FAILS, closed-form still PASSES (=${c2.results['closed-form'].pass ? 'P' : 'F'}) — T1 reuses the rail's basis`)
let calls = 0
const c3 = runWith('CONTROL stateful evaluate (1 mm per call drift)', {
  post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail), e = st(core, 'mars'); rail.evaluate = (t) => { o(t); e.absPos.x += 1e-3 * (++calls) } },
})
if (c3.results['reversibility'].pass) controlsOk = false
check('control-stateful', !c3.results['reversibility'].pass, 'a history-dependent evaluate fails reversibility (T2 has teeth for impurity)')

/* ---- (3) mutations a correct gate should catch ------------------------------ */
let saved
const mN1 = runWith('M-N1 earth n ×1.01 (T unchanged)', {
  pre: () => { saved = cfg('earth').orbit.n; cfg('earth').orbit.n *= 1.01 }, restore: () => { cfg('earth').orbit.n = saved },
})
check('blind-mean-motion-one', ROWS.every((k) => mN1.results[k].pass), 'Earth moves 1 % too fast (n·T = 2π·1.01): ALL rows PASS')
let savedAll
const mN2 = runWith('M-N2 every n ×2 (T unchanged)', {
  pre: () => { savedAll = CD.CELESTIAL_CONFIGS.map((c) => c.orbit && c.orbit.n); CD.CELESTIAL_CONFIGS.forEach((c) => { if (c.orbit) c.orbit.n *= 2 }) },
  restore: () => CD.CELESTIAL_CONFIGS.forEach((c, i) => { if (c.orbit) c.orbit.n = savedAll[i] }),
})
check('blind-mean-motion-all', ROWS.every((k) => mN2.results[k].pass), 'every body orbits at 2× the Kepler rate: ALL rows PASS')
const mR = runWith('M-RETRO negate basisQ for every body', {
  post: (core) => core.rail.states.forEach((s) => { s.basisQ.x = -s.basisQ.x; s.basisQ.y = -s.basisQ.y; s.basisQ.z = -s.basisQ.z }),
})
check('blind-handedness', ROWS.every((k) => mR.results[k].pass), 'every orbit reversed (Triton prograde, all others retrograde): ALL rows PASS — the "retrograde Triton" claim is unverified')
const mB = runWith('M-SHAPE planets semiMinor ×0.8', {
  post: (core) => core.rail.states.forEach((s) => { if (s.config.orbit && s.config.parentId === null) s.semiMinor *= 0.8 }),
})
check('shape-caught-by-t3-only', !mB.results['parenting'].pass && mB.results['closed-form'].pass,
  'planet paths squashed to b = 0.8a: closed-form PASSES (reuses rail semiMinor); only the T3 host-chord clause catches it')
const mV = runWith('M-SPEED orbitalSpeed ×1.1 (moons only)', {
  post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail); rail.evaluate = (t) => { o(t); rail.states.forEach((s) => { if (s.config.parentId !== null && s.config.orbit) s.orbitalSpeed *= 1.1 }) } },
})
check('blind-moon-speed', ROWS.every((k) => mV.results[k].pass), 'moon telemetry speed 10 % wrong: ALL rows PASS (vis-viva loop skips moons)')
const garbage = []
const mA = runWith('M-ALLOC 64 KB garbage per evaluate (Node: no performance.memory)', {
  post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail); rail.evaluate = (t) => { o(t); garbage[0] = new Float64Array(8192) } },
})
check('blind-alloc-na', mA.results['zero-gc'].pass, `1.3 GB of per-tick allocation passes zero-gc when performance.memory is absent: ${mA.results['zero-gc'].detail.slice(0, 90)}`)
// Live getter (Chrome's performance.memory is read twice through ONE cached object).
const memObj = {}; Object.defineProperty(memObj, 'usedJSHeapSize', { get: () => process.memoryUsage().heapUsed })
Object.defineProperty(performance, 'memory', { configurable: true, get: () => memObj })
const verdicts = []
for (let k = 0; k < 3; k++) {
  const r = runWith(`M-ALLOC with heapUsed-backed performance.memory #${k + 1}`, {
    post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail); rail.evaluate = (t) => { o(t); garbage[0] = new Array(2048).fill(1.5) } },
  })
  verdicts.push(`${r.results['zero-gc'].pass ? 'P' : 'F'}(${r.results['zero-gc'].detail.match(/heap Δ ([^ ]+ ?B?)/)?.[1]})`)
}
check('blind-alloc-gc', verdicts.some((v) => v.startsWith('P')), `same 1.3 GB churn with a heap API: verdicts ${verdicts.join(' ')} — negative Δ passes`)
const leak = []
const rL = runWith('CONTROL-HEAP retained leak 8 KB per evaluate', {
  post: (core) => { const rail = core.rail, o = rail.evaluate.bind(rail); rail.evaluate = (t) => { o(t); leak.push(new Array(1024).fill(2.5)) } },
})
leak.length = 0
console.log(`[u07] retained-leak zero-gc: ${rL.results['zero-gc'].pass ? 'P' : 'F'} ${rL.results['zero-gc'].detail.match(/heap Δ ([^ ]+ ?B?)/)?.[1]}`)
check('heap-catches-retained', !rL.results['zero-gc'].pass, '160 MB retained leak fails zero-gc when a heap API exists')
delete performance.memory

/* ---- (4) independent truth ---------------------------------------------------- */
const TWO_PI = 2 * Math.PI
const MU_SUN = 274 * 20000 * 20000
const DOC = { mercury: 4381, venus: 6963, earth: 8821, mars: 12122, jupiter: 30392, saturn: 48139, uranus: 81144, neptune: 113254, pluto: 138927, moon: 3072, phobos: 575, io: 634, titan: 2351, titania: 1806, triton: 1395, charon: 3206 }
let maxTrel = 0, maxNT = 0, maxDoc = 0, docWorst = ''
const retro = []
for (const c of CD.CELESTIAL_CONFIGS) {
  if (!c.orbit) continue
  const host = c.parentId ? cfg(c.parentId) : null
  const mu = host ? host.surfaceGravity * host.radiusGame * host.radiusGame : MU_SUN
  const T = TWO_PI * Math.sqrt(c.orbit.a ** 3 / mu)
  maxTrel = Math.max(maxTrel, Math.abs(c.orbit.T - T) / T)
  maxNT = Math.max(maxNT, Math.abs(Math.abs(c.orbit.n) * T - TWO_PI))
  const dd = Math.abs(Math.round(T) - DOC[c.id]); if (dd > 1) docWorst += `${c.id} ${T.toFixed(1)} vs ${DOC[c.id]}; `; if (dd > maxDoc) maxDoc = dd
  if (c.orbit.n < 0) retro.push(c.id)
}
check('truth-periods', maxTrel < 1e-14 && maxNT < 1e-12, `config T and |n| match independent 2π√(a³/μ) (max rel ${maxTrel.toExponential(1)}, |n·T−2π| ${maxNT.toExponential(1)})`)
check('doc-table-stale', maxDoc > 1, `celestialData banner period table vs truth: off by up to ${maxDoc} s — ${docWorst || 'none'}`)
check('truth-retro-set', retro.length === 1 && retro[0] === 'triton', `retrograde set = [${retro}] (real-world: Triton is the only retrograde major moon)`)

// Finite-difference speed + spin sense against the real rail.
const core = new SC.SimulationCore()
const states = core.rail.states
const rel = (t) => { core.setSimTime(t); return states.map((s) => { const p = s.parentIndex >= 0 ? states[s.parentIndex].absPos : { x: 0, y: 0, z: 0 }; return [s.absPos.x - p.x, s.absPos.y - p.y, s.absPos.z - p.z, s.orbitalSpeed] }) }
const t0 = 123456.789, h = 0.5
const A0 = rel(t0 - h), A1 = rel(t0), A2 = rel(t0 + h)
let maxVrel = 0, spinOk = true, spinLog = []
states.forEach((s, i) => {
  if (!s.config.orbit) return
  const v = [0, 1, 2].map((k) => (A2[i][k] - A0[i][k]) / (2 * h))
  const vm = Math.hypot(...v)
  maxVrel = Math.max(maxVrel, Math.abs(vm - A1[i][3]) / A1[i][3])
  const r = A1[i]
  const Ly = r[2] * v[0] - r[0] * v[2] // (r × v)·ŷ
  const pro = Ly > 0
  if (pro === (s.config.orbit.n < 0)) spinOk = false
  spinLog.push(`${s.config.id}${pro ? '+' : '−'}`)
})
check('truth-fd-speed', maxVrel < 1e-4, `finite-difference speed vs rail vis-viva, all 16 orbiters: max rel dev ${maxVrel.toExponential(1)}`)
check('truth-spin-sense', spinOk, `(r×v)·ŷ > 0 (CCW from +Y = prograde) for all but Triton: ${spinLog.join(' ')}`)

// Kepler solver: dense grid inside the documented domain e ∈ [0, 0.95].
let maxRes = 0, worst = ''
for (let ie = 0; ie <= 95; ie++) {
  const e = ie / 100
  for (let im = 0; im <= 4000; im++) {
    const M = -Math.PI + (TWO_PI * im) / 4000 + 1e-12
    const E = KR.solveKeplerE(M, e)
    const r = Math.abs(E - e * Math.sin(E) - M)
    if (r > maxRes) { maxRes = r; worst = `e=${e} M=${M.toFixed(4)}` }
  }
}
check('truth-solver-grid', maxRes <= 1e-12, `solveKeplerE residual over 96×4001 grid e∈[0,0.95]: max ${maxRes.toExponential(1)} @ ${worst}`)

// Hill radii (independent: r_H = a_p·(μ_p/3μ_sun)^(1/3)); prograde-stable ≲ 0.5 r_H.
const hill = []
for (const c of CD.CELESTIAL_CONFIGS) {
  if (!c.orbit || !c.parentId) continue
  const p = cfg(c.parentId)
  const rH = p.orbit.a * Math.cbrt((p.surfaceGravity * p.radiusGame ** 2) / (3 * MU_SUN))
  hill.push([c.id, c.orbit.a / rH])
}
console.log(`[u07] hill a_moon/r_H: ${hill.map(([id, f]) => `${id} ${f.toFixed(2)}`).join(' · ')}`)
check('note-hill', hill.some(([, f]) => f > 0.5), `moons beyond 0.5 r_H: ${hill.filter(([, f]) => f > 0.5).map(([id, f]) => `${id} ${f.toFixed(2)}`).join(', ') || 'none'} (real Moon 0.26)`)

// T5 replica: rebase deltas and celestial locals during the 2,000 m/s flight.
const c5 = new SC.SimulationCore()
c5.setSimTime(0)
c5.registerEntity('ship', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: 2000, y: 0, z: 0 }, dynamic: true })
c5.setFocusEntity('ship')
let prevO = c5.getOrigin().x, deltas = [], maxLocErr = 0
const f32 = new Float32Array(1)
for (let k = 0; k < 400 && c5.getAbsPosition('ship').x < 10000; k++) {
  c5.tick()
  const o = c5.getOrigin()
  if (o.x !== prevO) { deltas.push(o.x - prevO); prevO = o.x }
  for (const s of c5.rail.states) for (const [ax, j] of [['x', 0], ['y', 1], ['z', 2]]) {
    f32[0] = s.absPos[ax] - o[ax]; maxLocErr = Math.max(maxLocErr, Math.abs(s.localPosF32[j] - f32[0]))
  }
}
check('truth-t5-deltas', deltas.length === 9 && deltas.every((d) => d === 1024), `T5 flight origin shifts: ${deltas.length} × [${[...new Set(deltas)]}] m (T5 detail asserts "4×256 exact" but never checks it)`)
check('truth-celestial-locals', maxLocErr === 0, `celestial localPosF32 === f32(abs − origin) every tick through 9 rebases (max err ${maxLocErr})`)

const confirmedAll = out.every(([, ok]) => ok)
console.log(`[u07] ${out.filter(([, ok]) => ok).length}/${out.length} confirmed; controls ${controlsOk ? 'OK' : 'BROKEN'}`)
process.exit(controlsOk ? 0 : 1)