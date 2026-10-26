// A1-U05b probe — m1d harness validity (read-only audit; AGENT_BRIEF §11).
// Slices the T1 predicate verbatim from Milestone1D_TestHarness.tsx (types
// stripped by esbuild) and runs it, the T4 heap clause, the T5 offset clause
// and a Node replay of the dive (T2/T3) against the REAL flight core.
// Run: node --expose-gc tools/audit/u05-m1d-validity.mjs   (from game/)
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const esbuild = await import('esbuild')
const AT = await import('../../src/core/physics/atmosphere.ts')
const FC = await import('../../src/core/physics/flightController.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const SRC = readFileSync(join(here, '../../src/test/Milestone1D_TestHarness.tsx'), 'utf8')
const lineOf = (s) => SRC.slice(0, SRC.indexOf(s)).split('\n').length
const results = []
const check = (id, cond, msg) => { results.push([id, !!cond]); console.log(`[u05] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }

// ---- T1: verbatim predicate with injectable atmosphere functions ------------
const t1A = '    let monotone = true;', t1B = '    results[\'atmosphere\'] = {'
const t1Src = SRC.slice(SRC.indexOf(t1A), SRC.indexOf(t1B))
console.log(`[u05] T1 predicate sliced :${lineOf(t1A)}-:${lineOf(t1B) - 1}`)
const t1Js = esbuild.transformSync(t1Src, { loader: 'ts' }).code
const t1 = new Function('EARTHSCALE_ATMOSPHERE', 'densityAt', 'speedOfSoundAt', 'machNumber', 'atmosphereVelocityInto',
  t1Js + '\nreturn pass;')
const runT1 = (o = {}) => t1(AT.EARTHSCALE_ATMOSPHERE, o.densityAt ?? AT.densityAt, o.speedOfSoundAt ?? AT.speedOfSoundAt,
  o.machNumber ?? AT.machNumber, o.atmosphereVelocityInto ?? AT.atmosphereVelocityInto)
const base1 = runT1()
const mStep = runT1({ densityAt: (p, a) => AT.densityAt(p, a) * (a >= 4000 ? 0.5 : 1) })        // 50 % jump at 4 km
const mMach = runT1({ machNumber: (p, a, v) => v / AT.speedOfSoundAt(p, 0) })                   // Mach ignores altitude
const mWind = runT1({ atmosphereVelocityInto: (s, x, y, z, out) => { out.x = -s * z; out.y = 0; out.z = s * x; return out } }) // retrograde
const mSnd = runT1({ speedOfSoundAt: (p, a) => AT.speedOfSoundAt(p, 0) })                       // no lapse (control)
console.log(`[u05] T1 pass: baseline=${base1} densityStep@4km=${mStep} machIgnoresAlt=${mMach} windRetrograde=${mWind} noLapse(control)=${mSnd}`)
check('T1-1', base1 && mStep, 'T1 passes with a 50 % density discontinuity at 4 km (claims "C∞, no cutoff discontinuity")')
check('T1-2', mMach && mWind, 'T1 passes when Mach ignores altitude and when the atmosphere spins retrograde')
check('T1-ctl', !mSnd, 'control: removing the lapse rate IS caught (a8 < a0)')
check('T1-3', FC.EARTHSCALE_FLIGHT.planetSpin === 0, `flight config planetSpin = ${FC.EARTHSCALE_FLIGHT.planetSpin} → wind law never reaches a flight tick`)

// ---- T4: heap clause truth table + allocation sensitivity -------------------
const heapOk = (heap) => heap < 0 || heap <= 1_048_576   // :734 verbatim
const tt = [-1, -5_000_000, 0, 1_048_576, 1_048_577]
console.log(`[u05] T4 heapOk: ${tt.map((h) => `${h}→${heapOk(h)}`).join(' ')}`)
check('T4-1', heapOk(-1) && heapOk(-5_000_000), 'any negative heap delta (incl. the −1 "N/A" sentinel and a GC during the burn) passes')
TF.initTerrainField(TF.TEST_PLANET)
const R = TF.TEST_PLANET.radius
const q = { x: 0, y: 0, z: 0, w: 1 }
function burn(alloc) {
  const c = new FC.FlightController(FC.EARTHSCALE_FLIGHT)
  let sink = null
  if (alloc) c.tickObserver = () => { sink = { a: 1, b: 2, c: 3 } }   // ONE small object per tick
  FC.quatFromBasisInto(1, 0, 0, 0, 1, 0, q)
  c.teleport(0, R + 600, 0, 260, 0, 0, q)
  for (let k = 0; k < 2000; k++) c.integrateFlight(1 / 60) // warm-up (JIT)
  c.teleport(0, R + 600, 0, 260, 0, 0, q)
  globalThis.gc?.()
  const h0 = process.memoryUsage().heapUsed
  for (let k = 0; k < 20000; k++) {
    const f = c.input
    f.pitch = 0.25 * Math.sin(0.0007 * k); f.roll = 0.3 * Math.sin(0.00043 * k + 1)
    f.yaw = 0.1 * Math.cos(0.00031 * k); f.throttle = 0.55 + 0.35 * Math.sin(0.0002 * k)
    c.integrateFlight(1 / 60)
  }
  const d = process.memoryUsage().heapUsed - h0
  void sink
  return d
}
const clean = [], dirty = []
for (let i = 0; i < 3; i++) { clean.push(burn(false)); dirty.push(burn(true)) }
console.log(`[u05] T4 burn heap Δ clean=${clean.join(',')} B  alloc-1-obj/tick=${dirty.join(',')} B  (bound 1,048,576)`)
check('T4-2', dirty.every(heapOk), 'a burn that allocates one object EVERY tick still passes the 1 MB bound (3/3 runs)')

// ---- T5: offset clause (:867–871 verbatim shape) ----------------------------
const pos = { x: 0, y: 0, z: 0 }
let maxErr = 0
for (const o of [{ x: 256, y: -512, z: 1024 }, { x: 123.456789, y: 1e7 + 0.1, z: -3.3 }, { x: 98765.4321, y: 0.0001, z: 5e8 + 0.7 }]) {
  pos.x = -o.x; pos.y = -o.y; pos.z = -o.z
  const offErr = Math.abs(pos.x + o.x) + Math.abs(pos.y + o.y) + Math.abs(pos.z + o.z)
  if (offErr > maxErr) maxErr = offErr
}
check('T5-1', maxErr === 0, `offset error is exactly ${maxErr} for off-lattice, non-f32 origins → the clause cannot fail and never checks the "Δ f32-exact" lattice claim`)

// ---- T2/T3: dive replay on the real controller ------------------------------
function dive(o = {}) {
  const c = new FC.FlightController(FC.EARTHSCALE_FLIGHT)
  FC.quatFromBasisInto(0, -1, 0, 1, 0, 0, q)          // :514–516 verbatim values
  c.teleport(0, R + 10000, 0, 0, -2000, 0, q)
  c.resetIntegrityStats()
  const s = { prev: Infinity, v1000: -1, vmax: 0, minAGL: Infinity, sp: [] }
  c.tickObserver = (k) => {                              // replica of diveObserver :495–510
    const t = k.telemetry
    if (o.clamp && !t.grounded && t.governorActive) {    // MUTATION: hard velocity clamp to v_safe
      const sc = t.vSafe / Math.hypot(k.vel.x, k.vel.y, k.vel.z)
      if (sc < 1) { k.vel.x *= sc; k.vel.y *= sc; k.vel.z *= sc; t.groundSpeed *= sc }
    }
    if (t.grounded) return
    if (s.prev > 1000 && t.altMSL <= 1000 && s.v1000 < 0) s.v1000 = t.groundSpeed
    s.prev = t.altMSL
    if (t.groundSpeed > s.vmax) s.vmax = t.groundSpeed
    if (t.altMSL < 20000) s.sp.push(t.groundSpeed)
    if (t.altAGL < s.minAGL) s.minAGL = t.altAGL
  }
  const fps = o.fps ?? 60
  let sim = 0, physT = 0
  while (!c.telemetry.grounded && !(sim > 45)) {         // :834–836
    const dt = 1 / fps
    sim += dt * 4
    physT += c.update(dt * 4, 6) / 60
  }
  let crossOk = true
  for (let i = 1; i < s.sp.length; i++) { const a = s.sp[i - 1], b = s.sp[i]; if (a >= 400 && b < 400 && a - b > 8) { crossOk = false; break } }
  const I = c.integrity
  const t2 = s.v1000 > 150 && s.v1000 <= 400 && s.vmax >= 1980 && s.minAGL >= -1e-6 && c.telemetry.grounded && I.minPostTickAGL >= -1e-6
  const t3 = I.maxDeltaVAirborne <= 12 && I.reversals === 0 && crossOk && I.nanEvents === 0
  return { t2, t3, v1000: s.v1000, vmax: s.vmax, maxDv: I.maxDeltaVAirborne, rev: I.reversals, crossOk,
    grounded: c.telemetry.grounded, sim, physT, minPost: I.minPostTickAGL, contacts: I.contacts }
}
const fmt = (r) => `T2=${r.t2} T3=${r.t3} v1000=${r.v1000.toFixed(1)} vmax=${r.vmax.toFixed(0)} maxDv=${r.maxDv.toFixed(2)} rev=${r.rev} cross=${r.crossOk} grounded=${r.grounded} sim=${r.sim.toFixed(1)}s phys=${r.physT.toFixed(1)}s minPostAGL=${r.minPost.toFixed(3)} contacts=${r.contacts}`
const d60 = dive(), dClamp = dive({ clamp: true }), d30 = dive({ fps: 30 }), d15 = dive({ fps: 15 })
console.log(`[u05] dive 60fps:        ${fmt(d60)}`)
console.log(`[u05] dive clamp-mut:    ${fmt(dClamp)}`)
console.log(`[u05] dive 30fps:        ${fmt(d30)}`)
console.log(`[u05] dive 15fps:        ${fmt(d15)}`)
check('T2-ctl', d60.t2 && d60.t3, 'baseline: Node dive replay passes T2 and T3 at 60 fps')
check('T3-1', dClamp.t3, `T3 passes with a hard per-tick clamp to v_safe applied after the tick (maxDv ${dClamp.maxDv.toFixed(2)} — Δv is sampled inside integrateFlight only)`)
check('T3-2', d60.maxDv > 10.4 * 1.0, `baseline maxDv ${d60.maxDv.toFixed(2)} m/s vs bound 12 (margin ${(12 - d60.maxDv).toFixed(2)} m/s)`)
check('T2-1', !d15.t2 || d15.physT < d15.sim * 0.9, `at 15 fps the dive runs ${d15.physT.toFixed(1)} s of physics for ${d15.sim.toFixed(1)} s counted (shed), grounded=${d15.grounded}`)

const failed = results.filter(([, ok]) => !ok).map(([id]) => id)
console.log(`[u05] ${results.length - failed.length}/${results.length} checks CONFIRMED${failed.length ? ' — not confirmed: ' + failed.join(',') : ''}`)
process.exit(0)