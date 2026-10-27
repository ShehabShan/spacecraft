// F3abbbba (ADR-015): choose ONE radius law, ONE distance law and ONE time scale for the catalog.
// Independent of the engine: real inputs are pinned literals (copied from realBodyData.ts / spinLaw.ts,
// which cite IAU PCK, JPL Table 1, JPL SSD sep.html, NSSDC). Prints the derived table and asserts the
// look-and-feel constraints of the 2026-10-22 ledger rulings plus geometric sanity. Exit 0 = law set valid.
// `--control` runs the same constraints on the OLD hand-tuned catalog and must exit 1 (known defects).
const AU = 149597870.7, GM_SUN = 1.32712440041279e11, DAY = 86400
const R = { sun: 695700, mercury: 2439.773, venus: 6051.8, earth: 6371.0084, moon: 1737.4, mars: 3389.527, phobos: 11.1667,
  jupiter: 69946, io: 1821.5, saturn: 58300, titan: 2574.8, uranus: 25363.67, titania: 788.9, neptune: 24623, triton: 1352.6,
  pluto: 1188.3, charon: 605 }
const AAU = { mercury: 0.38709927, venus: 0.72333566, earth: 1.00000261, mars: 1.52371034, jupiter: 5.202887, saturn: 9.53667594,
  uranus: 19.18916464, neptune: 30.06992276, pluto: 39.48168677 }
const AKM = { moon: 384400, phobos: 9375, io: 421800, titan: 1221900, titania: 436298, triton: 354800, charon: 19600 }
const ECC = { mercury: 0.20563593, venus: 0.00677672, earth: 0.01671123, mars: 0.0933941, jupiter: 0.04838624, saturn: 0.05386179,
  uranus: 0.04725744, neptune: 0.00859048, pluto: 0.24880766, moon: 0.0554, phobos: 0.015, io: 0.004, titan: 0.029, titania: 0.002,
  triton: 0, charon: 0 }
const PARENT = { moon: 'earth', phobos: 'mars', io: 'jupiter', titan: 'saturn', titania: 'uranus', triton: 'neptune', charon: 'pluto' }
const MOON_DAYS = { moon: 27.322, phobos: 0.319, io: 1.769, titan: 15.945, titania: 8.706, triton: 5.877, charon: 6.387 }
const EARTH_SPIN_S = (360 / 360.9856235) * DAY
const aKm = (id) => AKM[id] ?? AAU[id] * AU
const Treal = (id) => (MOON_DAYS[id] ? MOON_DAYS[id] * DAY : 2 * Math.PI * Math.sqrt(aKm(id) ** 3 / GM_SUN))

// ---- THE LAWS (ADR-015). Anchors are ledger rulings, not fits. ----
const MOON_R_GAME = 1364.5            // ruling: keep the small play Moon
const EARTH_A_GAME = 600000           // keep Earth's heliocentric distance (orbit gate, play scale)
const EARTH_ANGLE_DEG = 14.7          // ruling: keep the big Earth in the Moon sky (current 2·atan(5000/38850))
const RC_KM = 20000                   // radius saturation: small bodies ~linear, giants compressed
const S = 360                         // one time scale: T_game = T_real / S for every orbit and spin
const radiusLaw = (rKm) => { const k = (MOON_R_GAME * (1 + R.moon / RC_KM)) / R.moon; return (k * rKm) / (1 + rKm / RC_KM) }
const earthAngle = 2 * Math.atan(5000 / 38850)
const aMoonGame = radiusLaw(R.earth) / Math.tan(earthAngle / 2)
const Q = Math.log(aMoonGame / EARTH_A_GAME) / Math.log(AKM.moon / aKm('earth'))
const distLaw = (km) => EARTH_A_GAME * (km / aKm('earth')) ** Q

const control = process.argv.includes('--control')
const OLD = { r: { sun: 20000, mercury: 3105.7, mars: 2649.3, moon: 1364.5, charon: 1690.4, titania: 2182.2, jupiter: 16640.2, earth: 5000 },
  dayS: 604, yearS: 294 }   // A1-U10-2/-6 defects: Mars < Mercury, Charon/Titania > Moon, day > year
const rows = []
for (const id of Object.keys(R)) {
  const rg = radiusLaw(R[id])
  const ag = id === 'sun' ? 0 : distLaw(aKm(id))
  const T = id === 'sun' ? null : Treal(id) / S
  const v = T ? (2 * Math.PI * ag) / T : 0
  rows.push({ id, rKm: R[id], rGame: +rg.toFixed(1), aGame: +ag.toFixed(0), Tgame_s: T && +T.toFixed(1), v1x_ms: +v.toFixed(1) })
}
console.table(rows)
const g = Object.fromEntries(rows.map((r) => [r.id, r]))
const rr = control ? { ...Object.fromEntries(rows.map((r) => [r.id, r.rGame])), ...OLD.r } : Object.fromEntries(rows.map((r) => [r.id, r.rGame]))
const checks = []
const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail })
chk('moon-radius-kept', Math.abs(radiusLaw(R.moon) - MOON_R_GAME) < 1e-9, radiusLaw(R.moon))
chk('earth-angle-kept', Math.abs((2 * Math.atan(radiusLaw(R.earth) / aMoonGame) * 180) / Math.PI - EARTH_ANGLE_DEG) < 0.05,
  ((2 * Math.atan(radiusLaw(R.earth) / aMoonGame) * 180) / Math.PI).toFixed(3) + '°')
chk('radius-order-preserved', Object.keys(R).every((a) => Object.keys(R).every((b) => !(R[a] > R[b]) || rr[a] > rr[b])),
  `Mars ${rr.mars} vs Mercury ${rr.mercury}; Charon ${rr.charon}, Titania ${rr.titania} vs Moon ${rr.moon}`)
chk('sun-largest', Object.keys(R).every((id) => id === 'sun' || rr.sun > rr[id]), `Sun ${rr.sun} vs Jupiter ${rr.jupiter}`)
let minClear = Infinity, who = ''
for (const m of Object.keys(PARENT)) { const c = (g[m].aGame * (1 - ECC[m])) / g[PARENT[m]].rGame; if (c < minClear) { minClear = c; who = m } }
chk('moons-outside-parent', minClear > 2, `min periapsis/R_parent ${minClear.toFixed(2)} (${who})`)
chk('mercury-clear-of-sun', (g.mercury.aGame * (1 - ECC.mercury)) / g.sun.rGame > 10, ((g.mercury.aGame * (1 - ECC.mercury)) / g.sun.rGame).toFixed(1))
const dayS = control ? OLD.dayS : EARTH_SPIN_S / S, yearS = control ? OLD.yearS : g.earth.Tgame_s
chk('day-much-shorter-than-year', yearS / dayS > 300, `Earth day ${dayS.toFixed(1)} s, year ${yearS} s (ratio ${(yearS / dayS).toFixed(1)})`)
const vmax = Math.max(...rows.map((r) => r.v1x_ms))
chk('bodies-catchable-at-1x', vmax <= 600, `fastest orbital speed at 1x ${vmax} m/s vs ship cap 2000 m/s`)
for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name} — ${c.detail}`)
console.log(`laws: R_game = k·R/(1+R/${RC_KM} km), k=${((MOON_R_GAME * (1 + R.moon / RC_KM)) / R.moon).toFixed(6)} m/km; a_game = ${EARTH_A_GAME}·(a/a_earth)^${Q.toFixed(6)}; T_game = T_real/${S}`)
const fails = checks.filter((c) => !c.ok).length
console.log(`${control ? 'CONTROL (old catalog)' : 'LAWS'}: ${checks.length - fails}/${checks.length} PASS`)
process.exit(fails ? 1 : 0)