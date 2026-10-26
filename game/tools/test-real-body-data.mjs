// F3aa real-reference-data gate (ADR-011): checks `src/core/orbit/realBodyData.ts` against
// facts pinned here from INDEPENDENT sources (NSSDC fact sheets, IAU sidereal periods), so a
// transcription slip (sign, digit, unit) in the PCK/JPL table turns red.
// WHY: F3ab derives the scaled catalog from this table; an unchecked table would make every
// later spin/orbit gate inherit its errors (A1 lesson: gates must not read the thing they test).
//
// Run from game/:
//   node tools/test-real-body-data.mjs                gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-real-body-data.mjs --self-test    every mutant must turn the gate red (exit 0)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const SELF = process.argv.includes('--self-test')
const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'f3aa-real-data.bundle.mjs')
try {
  await build({ stdin: { contents: "export * from './src/core/orbit/realBodyData.ts'; export { CELESTIAL_CONFIGS } from './src/core/orbit/celestialData.ts'", resolveDir: game, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent' })
} catch (e) { console.error('BROKEN: bundle failed', e.message); process.exit(2) }
const { REAL_BODY_DATA, CELESTIAL_CONFIGS } = await import(pathToFileURL(out).href)

// ---- pinned independent facts (NSSDC fact sheets; change only with an ADR) ----------------
// Sidereal spin period, hours (negative = retrograde), and sidereal orbit period, days.
const SPIN_H = { sun: 609.12, mercury: 1407.6, venus: -5832.6, earth: 23.9345, moon: 655.72, mars: 24.6229,
  jupiter: 9.9250, saturn: 10.656, uranus: -17.24, neptune: 16.11, pluto: -153.2928 }
const ORBIT_D = { mercury: 87.969, venus: 224.701, earth: 365.256, mars: 686.980, jupiter: 4332.589,
  saturn: 10759.22, uranus: 30685.4, neptune: 60189, pluto: 90560 }
// Real GM (km³/s²) of the hosts, for Kepler-3 on the raw elements.
const GM = { sun: 1.32712440018e11, earth: 398600.435, mars: 42828.37, jupiter: 126686534, saturn: 37931187,
  uranus: 5793939, neptune: 6836529, pluto: 869.6 }
const MOON_D = { moon: 27.3217, phobos: 0.31891, io: 1.769138, titan: 15.945, titania: 8.706, triton: -5.877, charon: 6.3872 }
const PARENT = { moon: 'earth', phobos: 'mars', io: 'jupiter', titan: 'saturn', titania: 'uranus', triton: 'neptune', charon: 'pluto' }
const RADIUS_KM = { sun: 695700, mercury: 2439.7, venus: 6051.8, earth: 6371.0, moon: 1737.4, mars: 3389.5,
  jupiter: 69911, saturn: 58232, uranus: 25362, neptune: 24622, pluto: 1188 }

function check(data) {
  const fails = []
  const rows = []
  const ok = (name, cond, detail) => { rows.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${detail}`); if (!cond) fails.push(name) }
  const ids = CELESTIAL_CONFIGS.map((c) => c.id)
  ok('ids', ids.length === 17 && ids.every((id) => data[id]) && Object.keys(data).length === 17, `${Object.keys(data).length}/17`)
  for (const id of ids) {
    const d = data[id]; if (!d) continue
    const o = d.orientation
    ok(`range:${id}`, o.poleDec >= -90 && o.poleDec <= 90 && o.poleRA >= 0 && o.poleRA < 360 && d.radiusKm > 0 &&
      (d.orbit === null) === (id === 'sun') && (!d.orbit || (d.orbit.e >= 0 && d.orbit.e < 1 && d.orbit.aKm > 0)), '')
    if (SPIN_H[id] !== undefined) {
      const h = 360 / o.pmRate * 24
      // WHY: Pluto's PCK pole is the IAU *positive* (right-hand) pole, so its rate is > 0 while
      // NSSDC quotes −153.29 h about the north pole; compare magnitude for Pluto only.
      const want = id === 'pluto' ? -SPIN_H[id] : SPIN_H[id]
      // WHY: Neptune's IAU rate (15.966 h) and the Voyager radio period (16.11 h) differ by 0.9 %;
      // the IAU value is the model we use, so Neptune gets a 1.2 % band instead of 0.2 %.
      const tol = id === 'neptune' ? 1.2e-2 : 2e-3
      ok(`spin:${id}`, Math.abs(h - want) / Math.abs(want) < tol, `${h.toFixed(4)} h vs ${want}`)
    }
    if (RADIUS_KM[id] !== undefined) ok(`radius:${id}`, Math.abs(d.radiusKm - RADIUS_KM[id]) / RADIUS_KM[id] < 2e-3, `${d.radiusKm}`)
    if (ORBIT_D[id] !== undefined && d.orbit) {
      const T = 2 * Math.PI * Math.sqrt(d.orbit.aKm ** 3 / GM.sun) / 86400
      ok(`kepler:${id}`, Math.abs(T - ORBIT_D[id]) / ORBIT_D[id] < 3e-3, `${T.toFixed(3)} d vs ${ORBIT_D[id]}`)
    }
    if (MOON_D[id] !== undefined && d.orbit) {
      // pluto–charon is a binary: use the total GM (Charon ≈ 12 % of Pluto).
      const gm = GM[PARENT[id]] + (id === 'charon' ? 105.9 : 0)
      const T = 2 * Math.PI * Math.sqrt(d.orbit.aKm ** 3 / gm) / 86400
      const retro = d.orbit.i > 90
      ok(`moon:${id}`, Math.abs(T - Math.abs(MOON_D[id])) / Math.abs(MOON_D[id]) < 5e-3 && retro === (MOON_D[id] < 0),
        `${T.toFixed(4)} d vs ${MOON_D[id]} i=${d.orbit.i}`)
    }
  }
  // Tidal locks the frame tree must reproduce: Moon, Io, Titan, Titania, Triton, Charon spin = orbit.
  for (const id of ['moon', 'io', 'titan', 'titania', 'triton', 'charon']) {
    const spinD = 360 / data[id].orientation.pmRate
    // WHY: moon elements are in the parent's Laplace (≈ equatorial) plane, so a locked moon spins
    // in its parent's sense, reversed for a retrograde orbit (Titania inherits Uranus's sign).
    const want = Math.sign(data[PARENT[id]].orientation.pmRate) * Math.sign(MOON_D[id])
    ok(`lock:${id}`, Math.abs(Math.abs(spinD) - Math.abs(MOON_D[id])) / Math.abs(MOON_D[id]) < 2e-3 &&
      Math.sign(spinD) === want, `${spinD.toFixed(4)} d`)
  }
  ok('lock:pluto-charon', data.pluto.orientation.pmRate === data.charon.orientation.pmRate, '')
  return { fails, rows }
}

const clone = () => JSON.parse(JSON.stringify(REAL_BODY_DATA))
if (!SELF) {
  const { fails, rows } = check(REAL_BODY_DATA)
  console.log(rows.join('\n'))
  console.log(`${fails.length === 0 ? 'PASSED' : 'FAILED'} ${rows.length - fails.length}/${rows.length}`)
  process.exit(fails.length === 0 ? 0 : 1)
}
const MUTANTS = {
  'venus spin sign flipped': (d) => { d.venus.orientation.pmRate *= -1 },
  'earth spin ×1.01': (d) => { d.earth.orientation.pmRate *= 1.01 },
  'uranus retrograde lost': (d) => { d.uranus.orientation.pmRate = Math.abs(d.uranus.orientation.pmRate) },
  'triton prograde (i 157.3 → 22.7)': (d) => { d.triton.orbit.i = 22.7 },
  'mars a in au as km': (d) => { d.mars.orbit.aKm = 1.52371034 },
  'moon a ×1.01': (d) => { d.moon.orbit.aKm *= 1.01 },
  'jupiter radius polar only': (d) => { d.jupiter.radiusKm = 66854 },
  'mercury e ≥ 1': (d) => { d.mercury.orbit.e = 1.2 },
  'pole dec out of range': (d) => { d.neptune.orientation.poleDec = 133.46 },
  'charon dropped': (d) => { delete d.charon },
}
let bad = 0
for (const [name, m] of Object.entries(MUTANTS)) {
  const d = clone(); m(d)
  let red; try { red = check(d).fails.length > 0 } catch { red = true }
  console.log(`${red ? 'RED  ' : 'GREEN'} ${name}`); if (!red) bad++
}
const base = check(REAL_BODY_DATA).fails.length === 0
console.log(`baseline ${base ? 'green' : 'RED'}; mutants red ${Object.keys(MUTANTS).length - bad}/${Object.keys(MUTANTS).length}`)
process.exit(base && bad === 0 ? 0 : 1)