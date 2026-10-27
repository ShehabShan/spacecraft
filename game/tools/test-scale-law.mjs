// F3abbbbba gate: the ADR-015 scale-law module (src/core/orbit/scaleLaw.ts) against an
// independent oracle built from PINNED real literals (IAU PCK radii, JPL Table 1 / sat elements,
// NSSDC — the same sources cited by realBodyData.ts; copied, never read from the engine).
//   node tools/test-scale-law.mjs                       baseline, exit 0 = all checks pass
//   node tools/test-scale-law.mjs --self-test [--deliberate]   every mutant must turn named checks red
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned independent facts (change only with an ADR in the same commit) ----
const AU = 149597870.7, GM_SUN = 1.32712440041279e11, DAY = 86400
const R = { sun: 695700, mercury: 2439.773, venus: 6051.8, earth: 6371.0084, moon: 1737.4, mars: 3389.527, phobos: 11.1667,
  jupiter: 69946, io: 1821.5, saturn: 58300, titan: 2574.8, uranus: 25363.67, titania: 788.9, neptune: 24623, triton: 1352.6,
  pluto: 1188.3, charon: 605 }
const AAU = { mercury: 0.38709927, venus: 0.72333566, earth: 1.00000261, mars: 1.52371034, jupiter: 5.202887, saturn: 9.53667594,
  uranus: 19.18916464, neptune: 30.06992276, pluto: 39.48168677 }
const AKM = { moon: 384400, phobos: 9375, io: 421800, titan: 1221900, titania: 436298, triton: 354800, charon: 19600 }
const MOON_DAYS = { moon: 27.322, phobos: 0.319, io: 1.769, titan: 15.945, titania: 8.706, triton: 5.877, charon: 6.387 }
const PARENT = { moon: 'earth', phobos: 'mars', io: 'jupiter', titan: 'saturn', titania: 'uranus', triton: 'neptune', charon: 'pluto' }
const ECC = { moon: 0.0554, phobos: 0.015, io: 0.004, titan: 0.029, titania: 0.002, triton: 0, charon: 0, mercury: 0.20563593 }
// ADR-015 law constants (pinned)
const MOON_RG = 1364.5, EARTH_AG = 600000, RC = 20000, S = 360, Q_PIN = 0.491234
const EARTH_ANGLE = 2 * Math.atan(5000 / 38850)

const aKm = (id) => AKM[id] ?? AAU[id] * AU
const kOr = (MOON_RG * (1 + R.moon / RC)) / R.moon
const rOr = (r) => (kOr * r) / (1 + r / RC)
const aMoonOr = rOr(R.earth) / Math.tan(EARTH_ANGLE / 2)
const qOr = Math.log(aMoonOr / EARTH_AG) / Math.log(AKM.moon / aKm('earth'))
const ORACLE = {}
for (const id of Object.keys(R)) {
  const star = id === 'sun'
  const a = star ? 0 : EARTH_AG * (aKm(id) / aKm('earth')) ** qOr
  const Treal = star ? null : MOON_DAYS[id] ? MOON_DAYS[id] * DAY : 2 * Math.PI * Math.sqrt(aKm(id) ** 3 / GM_SUN)
  ORACLE[id] = { r: rOr(R[id]), a, T: star ? null : Treal / S }
}
for (const id of Object.keys(R)) {
  if (id === 'sun') { ORACLE[id].gr = 0; ORACLE[id].pd = 80000; continue }
  const far = Math.max(0, ...Object.keys(PARENT).filter((m) => PARENT[m] === id).map((m) => ORACLE[m].a))
  ORACLE[id].gr = Math.max(6 * ORACLE[id].r, 1.3 * far)
  ORACLE[id].pd = Math.max(80000, 1.5 * ORACLE[id].gr)
}

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'f3a-scale-law.bundle.mjs')
await build({
  stdin: { contents: `export * from './core/orbit/scaleLaw';`, resolveDir: path.join(game, 'src'), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
})
const L = await import(pathToFileURL(out).href)
const INPUT = Object.keys(R).map((id) => ({ id, parentId: PARENT[id] ?? null, type: id === 'sun' ? 'star' : PARENT[id] ? 'moon' : 'planet' }))
const relOk = (x, y, tol) => (y === 0 ? Math.abs(x) <= tol : Math.abs(x / y - 1) <= tol)

function evaluate(tab, consts) {
  const res = {}
  const put = (id, ok, d) => { res[id] = { ok: !!ok, d } }
  const bad = (f) => Object.keys(R).filter((id) => !f(id, tab[id], ORACLE[id]))
  put('constants', relOk(consts.k, kOr, 1e-12) && relOk(consts.q, qOr, 1e-12) && Math.abs(consts.q - Q_PIN) < 1e-6 && consts.S === S,
    `k ${consts.k.toFixed(6)} m/km, q ${consts.q.toFixed(6)}, S ${consts.S}`)
  put('moon-radius-kept', Math.abs(tab.moon.radiusGame - MOON_RG) < 1e-9, tab.moon.radiusGame)
  const ang = 2 * Math.atan(tab.earth.radiusGame / tab.moon.a)
  put('earth-angle-kept', Math.abs(ang - EARTH_ANGLE) < 1e-12, `${(ang * 180 / Math.PI).toFixed(4)}°`)
  let b
  b = bad((id, t, o) => relOk(t.radiusGame, o.r, 1e-9)); put('radius-law', !b.length, b.join(' ') || '17/17')
  b = bad((id, t, o) => relOk(t.a, o.a, 1e-9)); put('distance-law', !b.length, b.join(' ') || '16/16 + Sun 0')
  b = bad((id, t, o) => (o.T === null ? t.T === null : relOk(t.T, o.T, 1e-9))); put('time-law', !b.length, b.join(' ') || '16/16 T_real/360')
  b = bad((id, t, o) => (o.T === null ? t.muHost === null : relOk(Math.sqrt(t.muHost / t.a ** 3), (2 * Math.PI) / o.T, 1e-12)))
  put('host-mu-kepler', !b.length, b.join(' ') || '16/16 √(μ/a³) = 2π/T')
  b = bad((id, t, o) => relOk(t.gravityRange, o.gr, 1e-9) && relOk(t.portalDist, o.pd, 1e-9))
  put('gravity-portal', !b.length, b.join(' ') || '17/17')
  const ids = Object.keys(R)
  const ord = ids.every((x) => ids.every((y) => !(R[x] > R[y]) || tab[x].radiusGame > tab[y].radiusGame))
  put('radius-order', ord, `Mars ${tab.mars.radiusGame.toFixed(1)} Mercury ${tab.mercury.radiusGame.toFixed(1)} Moon ${tab.moon.radiusGame.toFixed(1)} Titania ${tab.titania.radiusGame.toFixed(1)}`)
  let minC = Infinity, who = ''
  for (const m of Object.keys(PARENT)) { const c = (tab[m].a * (1 - ECC[m])) / tab[PARENT[m]].radiusGame; if (c < minC) { minC = c; who = m } }
  const merc = (tab.mercury.a * (1 - ECC.mercury)) / tab.sun.radiusGame
  put('clearances', minC > 2 && merc > 10, `moon periapsis/R_parent min ${minC.toFixed(2)} (${who}); Mercury/R_sun ${merc.toFixed(1)}`)
  const vmax = Math.max(...ids.filter((id) => tab[id].T).map((id) => (2 * Math.PI * tab[id].a) / tab[id].T))
  put('catchable-1x', vmax <= 600, `fastest orbital speed ${vmax.toFixed(1)} m/s at 1× (ship cap 2000)`)
  return res
}

const tab0 = L.deriveScaledBodies(INPUT)
const C0 = { k: L.RADIUS_K_M_PER_KM, q: L.DISTANCE_EXPONENT, S: L.TIME_SCALE }
const clone = () => structuredClone(tab0)
const MUT = [
  // T_real/30 instead of /360 would be T/12 with a self-consistent μ; ×12 here is the same size of error the other way
  ['time-scale-x12-consistent-mu', (t) => { for (const v of Object.values(t)) if (v.T) { v.T *= 12; v.muHost /= 144 } }, ['time-law']],
  ['radius-linear', (t) => { for (const v of Object.values(t)) v.radiusGame = (MOON_RG / R.moon) * R[v.id] }, ['radius-law']],
  ['distance-q-0.5', (t) => { for (const v of Object.values(t)) if (v.a) v.a = EARTH_AG * (aKm(v.id) / aKm('earth')) ** 0.5 }, ['distance-law']],
  ['mars-mercury-swapped', (t) => { const x = t.mars.radiusGame; t.mars.radiusGame = t.mercury.radiusGame; t.mercury.radiusGame = x }, ['radius-law', 'radius-order']],
  ['muHost-x1.01', (t) => { t.jupiter.muHost *= 1.01 }, ['host-mu-kepler']],
  ['gravityRange-5R', (t) => { t.mercury.gravityRange = 5 * t.mercury.radiusGame }, ['gravity-portal']],
  ['portal-floor-60000', (t) => { t.phobos.portalDist = Math.max(60000, 1.5 * t.phobos.gravityRange) }, ['gravity-portal']],
  ['io-inside-jupiter', (t) => { t.io.a = 1.5 * t.jupiter.radiusGame }, ['distance-law', 'clearances']],
  ['moon-orbit-x2', (t) => { t.moon.a *= 2 }, ['earth-angle-kept', 'distance-law']],
]
if (DELIB) MUT.push(['deliberate-identity', () => {}, ['radius-law']])
const MUT_C = [['q-0.5-constant', { ...C0, q: 0.5 }, ['constants']], ['S-30', { ...C0, S: 30 }, ['constants']]]

let exit = 0
try {
  const R0 = evaluate(tab0, C0)
  const ids = Object.keys(R0)
  if (!SELF) {
    for (const [id, r] of Object.entries(R0)) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${id} — ${r.d}`)
    const n = ids.filter((k) => R0[k].ok).length
    console.log(`SCALE-LAW GATE ${n === ids.length ? 'PASS' : 'FAIL'} ${n}/${ids.length}`)
    exit = n === ids.length ? 0 : 1
  } else {
    const rows = [['baseline-green', ids.every((k) => R0[k].ok), `${ids.filter((k) => R0[k].ok).length}/${ids.length}`]]
    for (const [label, f, must] of MUT) {
      const t = clone(); f(t); const r = evaluate(t, C0)
      rows.push([label, must.every((k) => !r[k].ok), `red: ${ids.filter((k) => !r[k].ok).join(',') || 'none'} (must: ${must})`])
    }
    for (const [label, c, must] of MUT_C) {
      const r = evaluate(clone(), c)
      rows.push([label, must.every((k) => !r[k].ok), `red: ${ids.filter((k) => !r[k].ok).join(',') || 'none'} (must: ${must})`])
    }
    for (const [l, ok, d] of rows) console.log(`${ok ? 'PASS' : 'FAIL'} ${l} ${d}`)
    const n = rows.filter((r) => r[1]).length
    console.log(`SELF-TEST ${n === rows.length ? 'PASS' : 'FAIL'} ${n}/${rows.length}`)
    exit = n === rows.length ? 0 : 1
  }
} catch (err) { console.error('SCALE-LAW GATE BROKEN', err?.stack ?? err); exit = 2 }
process.exit(exit)