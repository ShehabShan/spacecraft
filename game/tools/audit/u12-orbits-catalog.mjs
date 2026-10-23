// A1-U12 probe — orbits + catalog (READ-ONLY audit). Imports the REAL
// core/orbit modules; parses Design_specs/03 as JSON. Writes nothing.
// Run from game/:  node tools/audit/u12-orbits-catalog.mjs   (exit 0 = probe ran)
// Output: one compact `key=value` line per check.
import { register } from 'node:module'
import { readFileSync } from 'node:fs'
register('../ts-resolve-loader.mjs', import.meta.url)
const { solveKeplerE, wrapAngle, KeplerRail } = await import('../../src/core/orbit/KeplerRail.ts')
const { CELESTIAL_CONFIGS } = await import('../../src/core/orbit/celestialData.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
let cOk = 0, cN = 0
const control = (name, ok) => { cN++; if (ok) cOk++; p(`CONTROL_${name}`, ok ? 'OK' : 'BROKEN') }

// ---- 1. Kepler solver vs an independent bisection root ----
// f(E) = E − e·sinE − M is strictly increasing for 0 ≤ e < 1 → unique root in [−π, π].
function refE(M, e) {
  let lo = -Math.PI, hi = Math.PI
  for (let k = 0; k < 200; k++) { const m = 0.5 * (lo + hi); if (m - e * Math.sin(m) - M > 0) hi = m; else lo = m }
  return 0.5 * (lo + hi)
}
// iterations Newton needs (same starter + exit as the solver, no cap)
function itersNeeded(M, e) {
  let E = e < 0.8 ? M + e * Math.sin(M) : (M >= 0 ? Math.PI : -Math.PI)
  for (let k = 0; k < 500; k++) { const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= d; if (d < 1e-15 && d > -1e-15) return k + 1 }
  return 999
}
const Ms = []
for (let j = 0; j <= 4000; j++) Ms.push(-Math.PI + (2 * Math.PI * j) / 4000)
for (const m of [1e-12, 1e-9, 1e-6, 1e-4, 1e-2]) Ms.push(m, -m, Math.PI - m, -Math.PI + m)
for (const e of [0, 0.2, 0.5, 0.72, 0.8, 0.9, 0.95, 0.99, 0.999, 0.9999, 0.99999, 0.999999]) {
  let mr = 0, md = 0, mi = 0, over24 = 0, nf = 0
  for (const M of Ms) {
    const E = solveKeplerE(M, e)
    if (!Number.isFinite(E)) { nf++; continue }
    mr = Math.max(mr, Math.abs(E - e * Math.sin(E) - M))
    md = Math.max(md, Math.abs(E - refE(M, e)))
    const n = itersNeeded(M, e); mi = Math.max(mi, n); if (n > 24) over24++
  }
  p(`S_e${e}`, `res${f(mr)}_dE${f(md)}_itNeed${mi}_over24:${over24}_nonfinite${nf}`)
}
p('S_points', Ms.length)
control('bisection_vs_solver_e0.2', Math.abs(solveKeplerE(1.0, 0.2) - refE(1.0, 0.2)) < 1e-14)

// ---- 2. element validation at rail boot ----
const sun = CELESTIAL_CONFIGS.find((c) => c.id === 'sun')
const earth = CELESTIAL_CONFIGS.find((c) => c.id === 'earth')
for (const [tag, o] of [['e1', { e: 1 }], ['e1p5', { e: 1.5 }], ['aneg', { a: -1e5 }], ['eNaN', { e: NaN }]]) {
  let threw = 0, v = 'na'
  try {
    const r = new KeplerRail([sun, { ...earth, id: 'x', orbit: { ...earth.orbit, ...o } }])
    r.evaluate(1234.5); const s = r.getState('x'); v = `x${f(s.absPos.x)}_speed${f(s.orbitalSpeed)}`
  } catch { threw = 1 }
  p(`V_${tag}`, `threw${threw}_${v}`)
}
control('rail_valid_earth_finite', (() => { const r = new KeplerRail([sun, earth]); r.evaluate(1234.5); return Number.isFinite(r.getState('earth').absPos.x) })())

// ---- 3. wrapAngle range ----
p('W_pi', f(wrapAngle(Math.PI))); p('W_negpi', f(wrapAngle(-Math.PI))); p('W_3pi', f(wrapAngle(3 * Math.PI)))

// ---- 4. catalog vs Design_specs/03 ----
const spec = JSON.parse(readFileSync(new URL('../../../Design_specs/03_DATA_AND_CELESTIALS.txt', import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
const ids = Object.keys(spec.bodies); const where = []
for (const id of ids) {
  const s = spec.bodies[id], c = CELESTIAL_CONFIGS.find((x) => x.id === id)
  if (!c) { where.push(id + ':missing'); continue }
  for (const k of ['type', 'radiusGame', 'surfaceGravity', 'gravityRange', 'portalDist', 'atmosphereHeight']) if (s[k] !== c[k]) where.push(id + ':' + k)
  const d = s.orbitRadiusGame ?? s.distanceFromSun
  if (d > 0 && c.orbit?.a !== d) where.push(id + ':a')
  const par = s.parent ?? s.parentId ?? null
  if (par !== null && par !== c.parentId) where.push(id + ':parent')
  if (JSON.stringify(s.facts ?? {}) !== JSON.stringify(c.facts)) where.push(id + ':facts')
}
for (const c of CELESTIAL_CONFIGS) if (!ids.includes(c.id)) where.push(c.id + ':notInSpec')
p('C_spec_bodies', ids.length); p('C_code_bodies', CELESTIAL_CONFIGS.length)
p('C_diffs', where.length); p('C_diff_where', where.join(',') || 'none')
p('C_spec_keys', [...new Set(ids.flatMap((i) => Object.keys(spec.bodies[i])))].join(','))
control('spec_parse_earth_R5000', spec.bodies.earth?.radiusGame === 5000)

// ---- 5. surfaceGravity vs G·mass_fact / R_mean² (IAU/NASA mean radii, km) ----
const R = { mercury: 2439.4, venus: 6051.8, earth: 6371.0, moon: 1737.4, mars: 3389.5, phobos: 11.08, jupiter: 69911, io: 1821.5, saturn: 58232, titan: 2574.7, uranus: 25362, titania: 788.9, neptune: 24622, triton: 1352.6, pluto: 1188.3, charon: 606.0 }
const off = []; let within = 0, tot = 0
for (const c of CELESTIAL_CONFIGS) if (R[c.id]) {
  tot++; const g = (6.6743e-11 * parseFloat(c.facts.mass)) / (R[c.id] * 1e3) ** 2; const d = (100 * (c.surfaceGravity - g)) / g
  if (Math.abs(d) <= 2) within++; else off.push(`${c.id}:cat${c.surfaceGravity}/fact${f(g)}/${f(d)}pct`)
}
p('G_within2pct', `${within}/${tot}`); p('G_off', off.join(',') || 'none')

// ---- 6. rotation: any spin field in catalog / orbit / runtime state? ----
const rail = new KeplerRail(CELESTIAL_CONFIGS); rail.evaluate(0)
const keys = [...new Set([...CELESTIAL_CONFIGS.flatMap((c) => Object.keys(c)), ...Object.keys(earth.orbit), ...Object.keys(rail.states[1])])]
p('R_all_keys', keys.join(','))
p('R_spin_like_keys', keys.filter((k) => /spin|rotat|sidereal|obliq|tilt|meridian|theta|pole/i.test(k)).join(',') || 'none')
p('R_spin_facts', CELESTIAL_CONFIGS.filter((c) => Object.entries(c.facts).some(([k, v]) => /rotat|spin/i.test(k) || /retro/i.test(v))).map((c) => c.id + ':' + JSON.stringify(c.facts).replace(/[",]/g, ' ')).join(';'))
p('R_circular_coplanar', CELESTIAL_CONFIGS.filter((c) => c.orbit && c.orbit.e === 0 && c.orbit.i === 0 && c.orbit.Omega === 0 && c.orbit.omega === 0).length + '/' + CELESTIAL_CONFIGS.filter((c) => c.orbit).length)
const moon = CELESTIAL_CONFIGS.find((c) => c.id === 'moon').orbit
p('R_moon_n', f(moon.n)); p('R_moon_T', f(moon.T))
p('R_m1f_spin_over_lock', f(0.0005 / moon.n)); p('R_kccDefault_spin_over_lock', f(0.0104 / moon.n))
for (const [file, re] of [['../../src/core/simulation/SimulationCore.ts', /spin|theta|rotation/gi], ['../../src/core/orbit/KeplerRail.ts', /spin|theta/gi], ['../../src/core/orbit/types.ts', /spin|theta|rotation/gi]]) {
  p(`R_grep_${file.split('/').pop()}`, (readFileSync(new URL(file, import.meta.url), 'utf8').match(re) ?? []).length)
}
p('CONTROLS', `${cOk}/${cN}`)