// F2a orbit gate (ADR-006, extended to real ellipses and inclined planes by F3abbbbbc, ADR-016):
// an INDEPENDENT raw-element oracle for orbital position, mean motion, direction, period and period
// ratio, checked against the real KeplerRail/SimulationCore. The oracle solves Kepler's equation by
// bisection and rotates by true anomaly (Rz(Omega)Rx(i)Rz(omega)); it shares no code with the rail.
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
// ADR-016: direction is measured against the ECLIPTIC (h . y_world < 0). Triton orbits Neptune
// retrograde; Titania and Charon orbit prograde about parents whose spin pole is tilted past 90 deg
// to the ecliptic (Uranus 97.8 deg, Pluto 119 deg), so their orbit normal points below the ecliptic.
const RETROGRADE = new Set(['triton', 'titania', 'charon'])
const DEG = Math.PI / 180
// Independent pins (NSSDC fact sheets), tolerance covers JPL-vs-NSSDC mean-element differences.
const PIN_ECC = { mercury: 0.2056, venus: 0.0068, earth: 0.0167, moon: 0.0549, mars: 0.0934, phobos: 0.0151, jupiter: 0.0489, io: 0.0041,
  saturn: 0.0565, titan: 0.0288, uranus: 0.0457, titania: 0.0011, neptune: 0.0113, triton: 0.0, pluto: 0.2488, charon: 0.0002 }
const PIN_INC_ECLIPTIC = { mercury: 7.0, venus: 3.39, earth: 0.0, moon: 5.145, mars: 1.85, jupiter: 1.304, saturn: 2.485, uranus: 0.772,
  neptune: 1.769, pluto: 17.16 }
// Moon orbit-plane inclination to the PARENT equator (JPL SSD sep.html / NSSDC) and the parent's IAU pole (RA, Dec) and spin sign.
const PIN_MOON_INC = { phobos: 1.1, io: 0.0, titan: 0.3, titania: 0.1, triton: 157.3, charon: 0.0 }
const PIN_POLE = { mars: [317.269, 54.4325, 1], jupiter: [268.057, 64.495, 1], saturn: [40.589, 83.537, 1], uranus: [257.311, -15.175, -1],
  neptune: [299.36, 43.46, 1], pluto: [132.993, -6.163, 1] }
const OBLIQ = 23.4392911
// WHY: omega-in-plane tolerance 2e-4 rad: the node direction is amplified 1/sin(i) (52x for Phobos) by pole rounding to 4 decimals.
// WHY: Mars pole is the IAU 2015 value (317.269, 54.4325); the older 317.681/52.886 is 2.6 deg away (Phobos plane check caught it).
const E_TOL = 0.004, I_TOL_DEG = 0.06
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
      export { CELESTIAL_CONFIGS } from './core/orbit/celestialData';
      export { REAL_BODY_DATA } from './core/orbit/realBodyData';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
})
const { SimulationCore, KeplerRail, CELESTIAL_CONFIGS, REAL_BODY_DATA } = await import(pathToFileURL(out).href)
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

// ---- independent Kepler/rotation oracle (no shared code with the rail) --------------------
function keplerE(M, e) {                       // bisection on the monotone f(E) = E - e sin E - M
  let lo = M - 1, hi = M + 1
  for (let k = 0; k < 200; k++) {
    const mid = 0.5 * (lo + hi)
    if (mid - e * Math.sin(mid) - M < 0) lo = mid; else hi = mid
  }
  return 0.5 * (lo + hi)
}
function oraclePos(b, t) {
  let M = b.M0 + b.rate * t
  M -= TAU * Math.floor((M + Math.PI) / TAU)
  const E = keplerE(M, b.e)
  const r = b.a * (1 - b.e * Math.cos(E))
  const nu = 2 * Math.atan2(Math.sqrt(1 + b.e) * Math.sin(E / 2), Math.sqrt(1 - b.e) * Math.cos(E / 2))
  const x = r * Math.cos(nu), y = r * Math.sin(nu)
  const x1 = x * Math.cos(b.omega) - y * Math.sin(b.omega), y1 = x * Math.sin(b.omega) + y * Math.cos(b.omega)
  const y2 = y1 * Math.cos(b.i), z2 = y1 * Math.sin(b.i)
  const X = x1 * Math.cos(b.Omega) - y2 * Math.sin(b.Omega), Y = x1 * Math.sin(b.Omega) + y2 * Math.cos(b.Omega)
  return [X, z2, -Y]                            // Z-up ecliptic -> Y-up world: (x, z, -y)
}
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const vunit = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l) }
// Perifocal P and orbit normal h in the ecliptic Z-up frame from (i, Omega, omega) in radians.
function frameOf(i, O, w) {
  const P = [Math.cos(O) * Math.cos(w) - Math.sin(O) * Math.sin(w) * Math.cos(i), Math.sin(O) * Math.cos(w) + Math.cos(O) * Math.sin(w) * Math.cos(i), Math.sin(w) * Math.sin(i)]
  return { P, h: [Math.sin(O) * Math.sin(i), -Math.cos(O) * Math.sin(i), Math.cos(i)] }
}
const poleEcl = (id) => {                        // parent right-hand spin axis, ecliptic Z-up
  const [ra, dec, sg] = PIN_POLE[id], a = ra * DEG, d = dec * DEG, ce = Math.cos(OBLIQ * DEG), se = Math.sin(OBLIQ * DEG)
  const x = Math.cos(d) * Math.cos(a), y = Math.cos(d) * Math.sin(a), z = Math.sin(d)
  return [sg * x, sg * (y * ce + z * se), sg * (-y * se + z * ce)]
}
const wrapRad = (x) => x - TAU * Math.round(x / TAU)

// elements-real: the TESTED catalog's e, i, orientation, M0 against independent pins (replaces oracle-domain).
function elementsReal(cfg) {
  const bad = []
  for (const c of cfg) {
    if (!c.orbit) continue
    const o = c.orbit, id = c.id, real = REAL_BODY_DATA[id].orbit
    if (!(Math.abs(o.e - PIN_ECC[id]) < E_TOL)) bad.push(`${id}:e=${o.e.toFixed(4)}`)
    if (!(Math.abs(wrapRad(o.M0 - real.M0 * DEG)) < 1e-9)) bad.push(`${id}:M0`)
    const f = frameOf(o.i, o.Omega, o.omega)
    if (PIN_INC_ECLIPTIC[id] !== undefined) {
      if (!(Math.abs(Math.acos(f.h[2]) / DEG - PIN_INC_ECLIPTIC[id]) < I_TOL_DEG)) bad.push(`${id}:i=${(Math.acos(f.h[2]) / DEG).toFixed(2)}`)
      const g = frameOf(real.i * DEG, real.node * DEG, real.argPeri * DEG)   // sourced ecliptic elements
      if (!(Math.hypot(...f.P.map((x, k) => x - g.P[k])) < 1e-9 && Math.hypot(...f.h.map((x, k) => x - g.h[k])) < 1e-9)) bad.push(`${id}:orientation`)
    } else {
      const n = poleEcl(c.parentId)
      const ang = Math.acos(Math.max(-1, Math.min(1, vdot(f.h, n)))) / DEG
      if (!(Math.abs(ang - PIN_MOON_INC[id]) < I_TOL_DEG)) bad.push(`${id}:plane=${ang.toFixed(2)}`)
      if (PIN_MOON_INC[id] > 0.05) {             // argument of periapsis is measured from the node on the parent equator
        const node = vunit(vcross(n, f.h)), wcalc = Math.atan2(vdot(f.h, vcross(node, f.P)), vdot(node, f.P))
        if (!(Math.abs(wrapRad(wcalc - real.argPeri * DEG)) < 2e-4)) bad.push(`${id}:omega-in-plane`)
      }
    }
  }
  return bad
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
  const bad = { position: [], rate: [], direction: [], period: [], firstReturn: [], meta: [] }
  const measured = new Map()
  for (const b of T) {
    // (1) exact position on the real ellipse/inclination, oracle solver + true-anomaly rotation
    {
      let err = 0
      for (const t of [0, b.period / 8, b.period / 4, b.period / 2, 0.75 * b.period, b.period,
        1.37 * b.period, -0.2 * b.period, 60 * DAY]) err = Math.max(err, dist(rel(core, t, b), oraclePos(b, t)))
      if (!(err < POS_TOL_M)) bad.position.push(`${b.id}:${err.toExponential(2)}m`)
    }
    // (2) measured mean motion from the areal velocity |r x v| = a^2 n sqrt(1-e^2), (3) direction from h = r x v
    const t0 = 0.173 * b.period, h = b.period / 1e5
    const lo = rel(core, t0 - h, b), p = rel(core, t0, b), hi = rel(core, t0 + h, b)
    const v = hi.map((x, k) => (x - lo[k]) / (2 * h))
    const hx = p[1] * v[2] - p[2] * v[1], hy = p[2] * v[0] - p[0] * v[2], hz = p[0] * v[1] - p[1] * v[0]
    const w = Math.hypot(hx, hy, hz) / (b.a * b.a * Math.sqrt(1 - b.e * b.e))
    measured.set(b.id, w)
    if (!(Math.abs(w / b.rate - 1) < RATE_REL)) bad.rate.push(`${b.id}:${(w / b.rate).toFixed(6)}x`)
    // WHY: the sign of h . y_world is the sense of motion against the ecliptic; the retrograde set is a pinned
    // fact (see RETROGRADE), not a function of the engine's n or i.
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
    // ADR-016: n is the positive mean motion for every body; the sense of motion lives in i, and the flag matches the pinned set.
    if (!(Math.abs(o.n / b.rate - 1) < META_REL &&
      Math.abs(o.T / b.period - 1) < META_REL && Math.abs(o.muHost / b.mu - 1) < META_REL &&
      o.retrograde === (b.dir < 0))) bad.meta.push(b.id)
  }
  const er = elementsReal(cfg)
  put('elements-real', er.length === 0, er.join(' ') || '16/16: e, i, orientation, M0 match the independent pins')
  put('position-exact', bad.position.length === 0, bad.position.join(' ') || `16/16 < ${POS_TOL_M} m (ellipse + inclination)`)
  put('mean-motion', bad.rate.length === 0, bad.rate.join(' ') || `16/16 within ${RATE_REL}`)
  put('direction', bad.direction.length === 0, bad.direction.join(' ') || '13 prograde + retrograde triton, titania, charon vs the ecliptic')
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
const setEl = (id, f) => ({ config: (cs) => { f(cs.find((c) => c.id === id).orbit) } })
MUTANTS.push(
  ['mercury-e-zero', setEl('mercury', (o) => { o.e = 0 }), ['elements-real', 'position-exact']],
  ['pluto-e-x0.5', setEl('pluto', (o) => { o.e *= 0.5 }), ['elements-real', 'position-exact']],
  ['moon-i-zero', setEl('moon', (o) => { o.i = 0 }), ['elements-real', 'position-exact']],
  ['titan-plane-flat', setEl('titan', (o) => { o.i = 0 }), ['elements-real', 'position-exact']],
  ['pluto-Omega-plus30', setEl('pluto', (o) => { o.Omega += 30 * DEG }), ['elements-real', 'position-exact']],
  ['mercury-omega-plus10', setEl('mercury', (o) => { o.omega += 10 * DEG }), ['elements-real', 'position-exact']],
  ['venus-M0-plus20', setEl('venus', (o) => { o.M0 += 20 * DEG }), ['elements-real', 'position-exact']],
  ['titania-omega-in-plane', setEl('titania', (o) => { o.omega += 25 * DEG }), ['elements-real', 'position-exact']],
  ['io-e-from-circular', setEl('io', (o) => { o.e = 0.05 }), ['elements-real', 'position-exact']],
  ['rail-ignores-eccentricity', { state: (r) => r.states.forEach((s) => { if (s.config.orbit) s.config = { ...s.config, orbit: { ...s.config.orbit, e: 0 } } }) }, ['position-exact']],
)
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