// F3abba spin-law gate (ADR-013): checks the `spin` field that `src/core/orbit/spinLaw.ts` adds to
// every CELESTIAL_CONFIGS body against facts pinned here from INDEPENDENT sources (NSSDC fact
// sheets), not against spinLaw's own constants.
// WHY: the frame tree (F3b) will rotate terrain by this field; a wrong sign, a missed lock or an
// unrotated axis would make every later surface gate inherit it (A1 lesson: gates must not read
// the thing they test).
//
// Run from game/:
//   node tools/test-spin-law.mjs                          gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-spin-law.mjs --self-test              every mutant must turn the gate red (exit 0)
//   node tools/test-spin-law.mjs --self-test --deliberate adds an identity mutant → self-test must FAIL (exit 1)
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const SELF = process.argv.includes('--self-test')
const DELIB = process.argv.includes('--deliberate')
const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const cache = path.join(game, 'node_modules', '.cache')

async function load(tag, edit) {
  const out = path.join(cache, `f3abba-spin-${tag}.bundle.mjs`)
  const plugin = { name: 'mutate-spinlaw', setup(b) {
    b.onLoad({ filter: /spinLaw\.ts$/ }, (args) => {
      const src = readFileSync(args.path, 'utf8')
      const m = edit ? edit(src) : src
      if (edit && m === src) throw new Error(`mutant '${tag}' did not apply`)
      return { contents: m, loader: 'ts' }
    })
  } }
  await build({ stdin: { contents: "export { CELESTIAL_CONFIGS } from './src/core/orbit/celestialData.ts'", resolveDir: game, loader: 'ts' },
    bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'silent', plugins: [plugin] })
  return (await import(pathToFileURL(out).href + `?t=${tag}`)).CELESTIAL_CONFIGS
}

// ---- pinned independent facts (NSSDC fact sheets; change only with an ADR) ----------------
// Sidereal spin period, hours (sign ignored here), and sidereal orbit period, days.
const SPIN_H = { mercury: 1407.6, venus: 5832.6, earth: 23.9345, mars: 24.6229, jupiter: 9.9250,
  saturn: 10.656, uranus: 17.24, neptune: 16.11 }
const ORBIT_D = { mercury: 87.969, venus: 224.701, earth: 365.256, mars: 686.980, jupiter: 4332.589,
  saturn: 10759.22, uranus: 30685.4, neptune: 60189 }
const SUN_SPIN_H = 609.12
const EARTH_OBLIQUITY_DEG = 23.4393   // Earth's orbit IS the ecliptic, so this is exact
const SUN_EQUATOR_TILT_DEG = 7.25     // Sun's equator to the ecliptic
const SIDEREAL_DAYS_PER_YEAR = 366.256
const SELF_LOCKED = ['moon', 'phobos', 'io', 'titan', 'titania', 'triton', 'charon']
// Spin axis more than 90° from ecliptic north (right-hand axis points south).
const RETRO = new Set(['venus', 'uranus', 'titania', 'triton', 'pluto', 'charon'])
const RATIO_TOL = 0.005
// WHY: IAU Neptune W-rate (541.1397757°/d → 15.966 h) and NSSDC (16.11 h) disagree by 0.9 %;
// test-real-body-data.mjs (ADR-011) already allows Neptune 1.2e-2 for the same reason.
const RATIO_TOL_BY_ID = { neptune: 1.2e-2 }

function check(C) {
  const fails = []
  const by = Object.fromEntries(C.map((c) => [c.id, c]))
  const ok = (cond, name, detail) => { if (!cond) fails.push(`${name}: ${detail}`) }
  const tilt = (c) => Math.acos(Math.max(-1, Math.min(1, c.spin.axis.y))) * 180 / Math.PI
  for (const c of C) {
    const s = c.spin
    ok(s && Number.isFinite(s.period) && s.period > 0, `${c.id} period`, s && s.period)
    const n = s ? Math.hypot(s.axis.x, s.axis.y, s.axis.z) : NaN
    ok(Math.abs(n - 1) < 1e-9, `${c.id} axis unit`, n)
    ok(s && Number.isFinite(s.W0), `${c.id} W0 finite`, s && s.W0)
    ok(s && s.retrograde === RETRO.has(c.id), `${c.id} retrograde`, s && `${s.retrograde} tilt ${tilt(c).toFixed(2)}°`)
  }
  ok(Math.abs(tilt(by.earth) - EARTH_OBLIQUITY_DEG) < 0.01, 'earth obliquity', `${tilt(by.earth).toFixed(4)}°`)
  ok(Math.abs(tilt(by.sun) - SUN_EQUATOR_TILT_DEG) < 0.05, 'sun tilt', `${tilt(by.sun).toFixed(4)}°`)
  for (const id of SELF_LOCKED) {
    const c = by[id]
    ok(c.spin.period === c.orbit.T && c.spin.lockedTo === id, `${id} tidal lock`, `${c.spin.period} vs T ${c.orbit.T} (${c.spin.lockedTo})`)
  }
  ok(by.pluto.spin.period === by.charon.orbit.T && by.pluto.spin.lockedTo === 'charon', 'pluto–charon mutual lock',
    `${by.pluto.spin.period} vs ${by.charon.orbit.T} (${by.pluto.spin.lockedTo})`)
  for (const id of Object.keys(SPIN_H)) {
    const c = by[id]
    const want = SPIN_H[id] / (ORBIT_D[id] * 24)
    const got = c.spin.period / c.orbit.T
    ok(Math.abs(got / want - 1) < (RATIO_TOL_BY_ID[id] ?? RATIO_TOL) && c.spin.lockedTo === null, `${id} spin/orbit ratio`, `${got.toExponential(5)} vs ${want.toExponential(5)}`)
  }
  const sunWant = SUN_SPIN_H / (ORBIT_D.earth * 24)
  const sunGot = by.sun.spin.period / by.earth.orbit.T
  ok(Math.abs(sunGot / sunWant - 1) < RATIO_TOL, 'sun spin / earth year', `${sunGot.toExponential(5)} vs ${sunWant.toExponential(5)}`)
  const dpy = by.earth.orbit.T / by.earth.spin.period
  ok(Math.abs(dpy - SIDEREAL_DAYS_PER_YEAR) < 0.5, 'earth sidereal days per year', dpy.toFixed(3))
  return { fails, rows: C.map((c) => `${c.id.padEnd(8)} T ${(c.orbit ? c.orbit.T : 0).toFixed(1).padStart(9)} s  spin ${c.spin.period.toFixed(3).padStart(10)} s  tilt ${tilt(c).toFixed(2).padStart(6)}°  retro ${c.spin.retrograde}  lock ${c.spin.lockedTo}`) }
}

const MUTANTS = [
  ['no-retrograde-flip', (s) => s.replace('real.orientation.pmRate < 0 ? -1 : 1', '1')],
  ['obliquity-not-applied', (s) => s.replace('OBLIQUITY_J2000_DEG * DEG', '0')],
  ['axis-map-unswapped', (s) => s.replace('return { x: xe, y: ze, z: -ye };', 'return { x: xe, y: ye, z: ze };')],
  ['tidal-lock-off', (s) => s.replace('LOCK_TOLERANCE = 0.01', 'LOCK_TOLERANCE = 0')],
  ['mutual-lock-off', (s) => s.replace('} else if (lockChild !== undefined) {', '} else if (false) {')],
  ['ratio-inverted', (s) => s.replace('b.T * (spinReal / orbitReal)', 'b.T * (orbitReal / spinReal)')],
  ['sun-uses-real-seconds', (s) => s.replace("period = earth.T * (spinReal / (realOrbitSeconds('earth') as number));", 'period = spinReal;')],
]
if (DELIB) MUTANTS.push(['deliberate-identity (must stay green → self-test FAIL)', (s) => s.replace('const DEG = Math.PI / 180;', 'const DEG = Math.PI / 180; ')])

let base
try { base = check(await load('base', null)) } catch (e) { console.error('BROKEN:', e.message); process.exit(2) }
if (!SELF) {
  for (const r of base.rows) console.log(r)
  for (const f of base.fails) console.log('FAIL', f)
  console.log(base.fails.length === 0 ? 'SPIN-LAW PASS' : `SPIN-LAW FAIL (${base.fails.length})`)
  process.exit(base.fails.length === 0 ? 0 : 1)
}
let bad = 0
for (const [name, edit] of MUTANTS) {
  let red
  try { red = check(await load(name.replace(/[^a-z0-9]+/gi, '_'), edit)).fails.length > 0 } catch (e) { console.error('BROKEN:', name, e.message); process.exit(2) }
  console.log(`${red ? 'RED  ' : 'GREEN'} ${name}`)
  if (!red) bad++
}
console.log(`baseline ${base.fails.length === 0 ? 'green' : 'RED'}; mutants red ${MUTANTS.length - bad}/${MUTANTS.length}`)
process.exit(base.fails.length === 0 && bad === 0 ? 0 : 1)