// F2a orbit gate (ADR-006): an INDEPENDENT raw-element oracle for orbital mean motion,
// direction, period and period ratio, checked against the real KeplerRail/SimulationCore.
// WHY: every m1b row reads the rail's own derived n/T/basis/semiMinor, so n×1.01, n×2 and
// reversed orbits pass all five rows (A1-U07-1/-2, recheck docs/audit/U27b3b2b2b2a-m1b-recheck.md).
// The oracle reads ONLY raw catalog inputs (a, e, i, Ω, ω, M0, parent g and R) plus three pinned
// facts below; it never reads orbit.n, orbit.T, orbit.muHost, orbit.retrograde, basisP/Q, semiMinor.
//
// Run from game/:
//   node tools/test-orbit-gate.mjs                       gate   (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-orbit-gate.mjs --self-test [--deliberate]   every mutant must turn the gate red
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned independent facts (change only with an ADR in the same commit) ----------------
// WHY (ADR-015): orbit rates are NOT derived from a parent g*R^2 any more. Every orbit
// period is T_game = T_real / S with S = 360 pinned here, T_real from pinned real literals
// (JPL Table 1 heliocentric a + GM_sun; NSSDC sidereal days for moons), and the host mu follows
// Kepler III from (a, T). Pinned independently of scaleLaw.ts so a wrong law cannot pass.
const S = 360, GM_SUN = 1.32712440041279e11, AU = 149597870.7
const AAU = { mercury: 0.38709927, venus: 0.72333566, earth: 1.00000261, mars: 1.52371034, jupiter: 5.202887, saturn: 9.53667594,
  uranus: 19.18916464, neptune: 30.06992276, pluto: 39.48168677 }
const MOON_DAYS = { moon: 27.322, phobos: 0.319, io: 1.769, titan: 15.945, titania: 8.706, triton: 5.877, charon: 6.387 }
const realPeriod = (id) => (MOON_DAYS[id] !== undefined ? MOON_DAYS[id] * 86400 : 2 * Math.PI * Math.sqrt((AAU[id] * AU) ** 3 / GM_SUN))
// WHY: direction must come from a fact OUTSIDE the engine. Comparing against sign(n) is useless:
// a sign bug changes n and the motion together (A1-U07-2 recheck). Real-world fact: Triton is
// the only retrograde orbit in this catalog.
const RETROGRADE = new Set(['triton'])
const DAY = 86400
const TAU = 2 * Math.PI

// ---- tolerances -------------------------------------------------------------------------
const POS_TOL_M = 1e-4      // 0.1 mm: trig reduction at 60 days; a 1 % rate error moves Earth ~38 km
const RATE_REL = 1e-7       // central difference h = T/1e5 → sinc error 6.6e-10
const META_REL = 1e-12      // derived tables must equal the physics to rounding
const RATIO_REL = 1e-7

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'f2a-orbit-gate.bundle.mjs')
await build({
  stdin: {
    contents: `export { SimulationCore } from './core/simulation/SimulationCore';
      export { KeplerRail } from './core/orbit/KeplerRail';
      export { CELESTIAL_CONFIGS } from './core/orbit/celestialData';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
})
const { SimulationCore, KeplerRail, CELESTIAL_CONFIGS } = await import(pathToFileURL(out).href)
const PRODUCTION = JSON.stringify(CELESTIAL_CONFIGS)

// ---- oracle truth from RAW inputs only ----------------------------------------------------
function truthFrom(cfgs) {
  const bodies = []
  for (const c of cfgs) {
    if (!c.orbit) continue
    const { a, e, i, Omega, omega, M0 } = c.orbit
    const dir = RETROGRADE.has(c.id) ? -1 : 1
    const Treal = realPeriod(c.id)
    const rate = (2 * Math.PI * S) / Treal       // |n| from the pinned real period and S alone
    const mu = 4 * Math.PI ** 2 * a ** 3 / (Treal / S) ** 2   // Kepler III host mu
    bodies.push({ id: c.id, parent: c.parentId, a, e, i, Omega, omega, M0, mu, dir, rate, period: TAU / rate, Treal })
  }
  return bodies
}

function makeCore(mut = {}) {
  const cfg = structuredClone(CELESTIAL_CONFIGS)
  mut.config?.(cfg)
  const rail = new KeplerRail(cfg)
  mut.state?.(rail)
  const core = new SimulationCore(rail)
  mut.core?.(core)
  return { core, cfg }
}
const rel = (core, t, b) => {
  core.setSimTime(t)
  const p = core.rail.getState(b.id).absPos
  const h = b.parent ? core.rail.getState(b.parent).absPos : { x: 0, y: 0, z: 0 }
  return [p.x - h.x, p.y - h.y, p.z - h.z]
}
const dist = (u, v) => Math.hypot(u[0] - v[0], u[1] - v[1], u[2] - v[2])

// Returns { checkId: { ok, detail } } for one engine instance.
function evaluateGate(core, cfg) {
  const T = truthFrom(CELESTIAL_CONFIGS)       // truth from PRODUCTION raw inputs, never the mutant
  const R = {}
  const put = (id, ok, detail) => { R[id] = { ok: !!ok, detail } }
  const bad = { domain: [], position: [], rate: [], direction: [], period: [], firstReturn: [], meta: [] }
  const measured = new Map()
  for (const b of T) {
    const circularFlat = b.e === 0 && b.i === 0 && b.Omega === 0 && b.omega === 0
    if (!circularFlat) bad.domain.push(b.id)
    // (1) exact position: circular, zero-inclination, documented Y-up convention (a cosθ, 0, −a sinθ)
    if (circularFlat) {
      let err = 0
      for (const t of [0, b.period / 8, b.period / 4, b.period / 2, 0.75 * b.period, b.period,
        1.37 * b.period, -0.2 * b.period, 60 * DAY]) {
        const th = b.M0 + b.dir * b.rate * t
        err = Math.max(err, dist(rel(core, t, b), [b.a * Math.cos(th), 0, -b.a * Math.sin(th)]))
      }
      if (!(err < POS_TOL_M)) bad.position.push(`${b.id}:${err.toExponential(2)}m`)
    }
    // (2) measured angular rate and (3) direction from h = r × v (any orbit shape)
    const t0 = 0.173 * b.period, h = b.period / 1e5
    const lo = rel(core, t0 - h, b), p = rel(core, t0, b), hi = rel(core, t0 + h, b)
    const v = hi.map((x, k) => (x - lo[k]) / (2 * h))
    const hx = p[1] * v[2] - p[2] * v[1], hy = p[2] * v[0] - p[0] * v[2], hz = p[0] * v[1] - p[1] * v[0]
    const r2 = p[0] ** 2 + p[1] ** 2 + p[2] ** 2
    const w = Math.hypot(hx, hy, hz) / r2
    measured.set(b.id, w)
    if (circularFlat && !(Math.abs(w / b.rate - 1) < RATE_REL)) bad.rate.push(`${b.id}:${(w / b.rate).toFixed(6)}x`)
    // WHY: +Y is the orbital pole of a prograde orbit in the catalog's reference plane; a retrograde
    // orbit (fact table above) has h·ŷ < 0. Valid for any i < 90° prograde body.
    if (Math.sign(hy) !== b.dir) bad.direction.push(b.id)
    // (4) period: back at the start after exactly one oracle period, and no earlier return
    const s0 = rel(core, t0, b)
    if (!(dist(rel(core, t0 + b.period, b), s0) < POS_TOL_M)) bad.period.push(b.id)
    const N = 720
    let minEarly = Infinity
    for (let k = 1; k < N; k++) minEarly = Math.min(minEarly, dist(rel(core, t0 + (k * b.period) / N, b), s0))
    if (!(minEarly > 1e-6 * b.a)) bad.firstReturn.push(b.id)
    // (5) derived tables consumed by harnesses/UI must equal the physics
    const o = cfg.find((c) => c.id === b.id).orbit
    if (!(Math.abs(Math.abs(o.n) / b.rate - 1) < META_REL && Math.sign(o.n) === b.dir &&
      Math.abs(o.T / b.period - 1) < META_REL && Math.abs(o.muHost / b.mu - 1) < META_REL &&
      o.retrograde === (b.dir < 0))) bad.meta.push(b.id)
  }
  put('oracle-domain', bad.domain.length === 0, bad.domain.length ? `outside circular/flat domain: ${bad.domain} — extend the position/rate oracle (F3a)` : 'all 16 circular, i=Ω=ω=0')
  put('position-exact', bad.position.length === 0, bad.position.join(' ') || `16/16 < ${POS_TOL_M} m`)
  put('mean-motion', bad.rate.length === 0, bad.rate.join(' ') || `16/16 within ${RATE_REL}`)
  put('direction', bad.direction.length === 0, bad.direction.join(' ') || 'prograde 15 + retrograde triton')
  put('period', bad.period.length === 0, bad.period.join(' ') || '16/16 return after one oracle period')
  put('first-return', bad.firstReturn.length === 0, bad.firstReturn.join(' ') || '16/16 no return before one period (720 samples)')
  put('derived-tables', bad.meta.length === 0, bad.meta.join(' ') || 'n, T, muHost, retrograde = physics')
  // (6) time-scale law on MEASURED rates, mu-independent: for two orbits sharing a host,
  // omega_i / omega_j = T_real_j / T_real_i (one time scale S for every body, ADR-015).
  const groups = new Map()
  for (const b of T) { const k = b.parent ?? 'sun'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b) }
  const ratioBad = []; let pairs = 0
  for (const g of groups.values()) for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) {
    pairs++
    const want = g[y].Treal / g[x].Treal, got = measured.get(g[x].id) / measured.get(g[y].id)
    if (!(Math.abs(got / want - 1) < RATIO_REL)) ratioBad.push(`${g[x].id}/${g[y].id}`)
  }
  put('period-ratio', ratioBad.length === 0 && pairs > 0, ratioBad.length ? `${ratioBad.length}/${pairs} pairs off: ${ratioBad.slice(0, 6).join(' ')}` : `${pairs}/${pairs} sibling pairs follow T_real ratios`)
  // (7) day clock: fastForward(d) = setSimTime(t + d · 86400)
  const e = T.find((b) => b.id === 'earth'), t0 = 1234.5
  core.setSimTime(t0); core.fastForward(60)
  const ff = rel(core, core.simTime, e), st = core.simTime
  const ref = rel(core, t0 + 60 * DAY, e)
  put('day-clock', Math.abs(st - (t0 + 60 * DAY)) < 1e-6 && dist(ff, ref) < POS_TOL_M, `simTime ${st} vs ${t0 + 60 * DAY}`)
  return R
}

// ---- mutants: each names the checks it must turn red --------------------------------------
const each = (cs, f) => cs.forEach((c) => c.orbit && f(c))
const MUTANTS = [
  ['earth-n-x1.01', { config: (cs) => { cs.find((c) => c.id === 'earth').orbit.n *= 1.01 } }, ['mean-motion', 'position-exact', 'period']],
  ['all-n-x2', { config: (cs) => each(cs, (c) => { c.orbit.n *= 2 }) }, ['mean-motion', 'first-return']],
  ['all-orbits-reversed-n', { config: (cs) => each(cs, (c) => { c.orbit.n *= -1 }) }, ['direction', 'position-exact']],
  ['all-orbits-reversed-basisQ', { state: (r) => r.states.forEach((s) => { for (const k of ['x', 'y', 'z']) s.basisQ[k] *= -1 }) }, ['direction', 'position-exact']],
  ['triton-sign-flipped', { config: (cs) => { cs.find((c) => c.id === 'triton').orbit.n *= -1 } }, ['direction', 'derived-tables']],
  ['common-mu-x4', { config: (cs) => each(cs, (c) => { c.orbit.muHost *= 4; c.orbit.n *= 2; c.orbit.T /= 2 }) }, ['mean-motion', 'derived-tables']],
  ['jupiter-n-x1.001', { config: (cs) => { cs.find((c) => c.id === 'jupiter').orbit.n *= 1.001 } }, ['period-ratio', 'mean-motion']],
  ['earth-T-x2-metadata', { config: (cs) => { cs.find((c) => c.id === 'earth').orbit.T *= 2 } }, ['derived-tables']],
  ['earth-position-plus1m', { core: (k) => { const ev = k.rail.evaluate.bind(k.rail); k.rail.evaluate = (t) => { ev(t); k.rail.getState('earth').absPos.x += 1 } } }, ['position-exact']],
  ['fastForward-days-x2', { core: (k) => { const f = k.fastForward.bind(k); k.fastForward = (d) => f(d * 2) } }, ['day-clock']],
]
if (DELIB) MUTANTS.push(['deliberate-identity', {}, ['mean-motion']])

let exit = 0
const show = (label, R) => { for (const [id, r] of Object.entries(R)) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${label} ${id} — ${r.detail}`) }
try {
  const base = makeCore()
  const R0 = evaluateGate(base.core, base.cfg)
  const ids = Object.keys(R0)
  if (!SELF) {
    show('baseline', R0)
    const pass = ids.filter((k) => R0[k].ok).length
    console.log(`ORBIT GATE ${pass === ids.length ? 'PASS' : 'FAIL'} ${pass}/${ids.length}`)
    exit = pass === ids.length ? 0 : 1
  } else {
    const rows = []
    const baseGreen = ids.every((k) => R0[k].ok)
    rows.push(['baseline-green', baseGreen, `${ids.filter((k) => R0[k].ok).length}/${ids.length}`])
    if (!baseGreen) show('baseline', R0)
    for (const [label, mut, must] of MUTANTS) {
      const m = makeCore(mut)
      const R = evaluateGate(m.core, m.cfg)
      const red = ids.filter((k) => !R[k].ok)
      const ok = must.every((k) => !R[k].ok)
      rows.push([label, ok, `red: ${red.join(',') || 'none'} (must: ${must.join(',')})`])
    }
    rows.push(['production-configs-unchanged', JSON.stringify(CELESTIAL_CONFIGS) === PRODUCTION, ''])
    for (const [l, ok, d] of rows) console.log(`${ok ? 'PASS' : 'FAIL'} ${l} ${d}`)
    const n = rows.filter((r) => r[1]).length
    console.log(`SELF-TEST ${n === rows.length ? 'PASS' : 'FAIL'} ${n}/${rows.length}`)
    exit = n === rows.length ? 0 : 1
  }
} catch (err) {
  console.error('ORBIT GATE BROKEN', err?.stack ?? err)
  exit = 2
}
process.exit(exit)