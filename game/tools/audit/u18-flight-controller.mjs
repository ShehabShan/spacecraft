// A1-U18 probe — flightController: control signs, C¹ cap vs braking, cap exceedance, frame mix
// under planet spin, NaN latch, telemetry pressure, quaternion integrator accuracy.
// READ-ONLY audit. Imports the REAL FlightController + terrain. Truth is computed HERE: body axes
// from our own q⊗v⊗q* (checked against quatFromBasisInto), "right" = fwd × up (right-handed),
// expected thrust = maxThrustAccel. Run from game/:  node tools/audit/u18-flight-controller.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const FC = await import('../../src/core/physics/flightController.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const ATM = await import('../../src/core/physics/atmosphere.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
const deg = (r) => (r * 180) / Math.PI
let cOk = 0, cN = 0
const control = (n, c) => { cN++; if (c) cOk++; p(`control.${n}`, c ? 'ok' : 'FAIL') }
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const len = (a) => Math.hypot(a.x, a.y, a.z)
const nrm = (a) => { const l = len(a); return { x: a.x / l, y: a.y / l, z: a.z / l } }
const ang = (a, b) => Math.atan2(len(crs(a, b)), dot(a, b))
// independent rotation v' = q v q*
function rot(q, v) {
  const { x, y, z, w } = q
  const ix = w * v.x + y * v.z - z * v.y, iy = w * v.y + z * v.x - x * v.z
  const iz = w * v.z + x * v.y - y * v.x, iw = -x * v.x - y * v.y - z * v.z
  return { x: ix * w + iw * -x + iy * -z - iz * -y, y: iy * w + iw * -y + iz * -x - ix * -z, z: iz * w + iw * -z + ix * -y - iy * -x }
}
const FWD = (c) => rot(c.quat, { x: 1, y: 0, z: 0 }), UP = (c) => rot(c.quat, { x: 0, y: 1, z: 0 })
TF.initTerrainField(TF.TEST_PLANET)
const BASE = FC.EARTHSCALE_FLIGHT
const R = BASE.planetRadius
control('terrainRadius=flightRadius', Math.abs((TF.TEST_PLANET.radius ?? TF.TEST_PLANET.planetRadius ?? R) - R) < 1e-9)
const qb = { x: 0, y: 0, z: 0, w: 1 }
FC.quatFromBasisInto(0, 0, 1, 0, 1, 0, qb)
control('rot_matches_quatFromBasis', ang(rot(qb, { x: 1, y: 0, z: 0 }), { x: 0, y: 0, z: 1 }) < 1e-9 && ang(rot(qb, { x: 0, y: 1, z: 0 }), { x: 0, y: 1, z: 0 }) < 1e-9)
const sp = (v) => len(v)
const FAR = 1e8 // vacuum, g ≈ 2.5e-8 m/s²

// ===== A. control signs (header: +yaw = nose right, +roll = roll right, +pitch = nose up) =====
function signRun(axis) {
  const c = new FC.FlightController(BASE)
  c.teleport(FAR, 0, 0, 0, 0, 0, { x: 0, y: 0, z: 0, w: 1 })
  const f0 = FWD(c), u0 = UP(c), right0 = crs(f0, u0)
  c.input[axis] = 1
  for (let i = 0; i < 30; i++) c.integrateFlight(FC.FLIGHT_DT)
  const f1 = FWD(c), u1 = UP(c)
  return { noseRight: dot(f1, right0), noseUp: dot(f1, u0), upToRight: dot(u1, right0) }
}
const sy = signRun('yaw'), sr = signRun('roll'), spch = signRun('pitch')
p('A.right0', JSON.stringify(crs({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })) + ' (fwd×up; header calls body +Z "left")')
p('A.yaw+1.fwd·right0', f(sy.noseRight) + '  (>0 = nose right as claimed)')
p('A.roll+1.up·right0', f(sr.upToRight) + '  (>0 = right bank, right wing down, as claimed)')
p('A.pitch+1.fwd·up0', f(spch.noseUp) + '  (>0 = nose up as claimed)')
// bank-to-turn: roll +1 in atmosphere at 200 m/s, then hold level-ish; heading change sign vs right
{
  const c = new FC.FlightController(BASE)
  const r0 = R + 3000
  c.teleport(0, r0, 0, 200, 0, 0, { x: 0, y: 0, z: 0, w: 1 }) // fwd +X, up +Y (radial)
  const right0 = crs(FWD(c), UP(c))
  c.input.throttle = 0.6
  for (let i = 0; i < 25; i++) { c.input.roll = 1; c.integrateFlight(FC.FLIGHT_DT) }
  c.input.roll = 0
  for (let i = 0; i < 120; i++) c.integrateFlight(FC.FLIGHT_DT)
  p('A.bankTurn.vel·right0_after_2.4s', f(dot(nrm(c.vel), right0)) + '  (>0 = turned right)')
}

// ===== B. C¹ cap fades thrust by |v| regardless of thrust direction =====
function accelAt(v0, retro) {
  const c = new FC.FlightController(BASE)
  const q = { x: 0, y: 0, z: 0, w: 1 }
  if (retro) FC.quatFromBasisInto(-1, 0, 0, 0, 1, 0, q)
  c.teleport(FAR, 0, 0, 0, 0, v0, q) // velocity along +Z, nose ±X? -> use z for clarity below
  // nose along ∓velocity: velocity along +X instead
  c.teleport(FAR, 0, 0, v0, 0, 0, q)
  c.input.throttle = 1
  const a = sp(c.vel)
  c.integrateFlight(FC.FLIGHT_DT)
  return (sp(c.vel) - a) / FC.FLIGHT_DT
}
control('retro_at_1000_is_45', Math.abs(accelAt(1000, true) + BASE.maxThrustAccel) < 0.01)
for (const v of [1880, 1940, 1980, 1995, 2000, 2010]) {
  p(`B.retroDecel@${v}`, f(-accelAt(v, true)) + ` m/s²  prograde ${f(accelAt(v, false))}`)
}
// time to brake 2000 -> 1880 with full retro thrust (unfaded would be 120/45 = 2.67 s)
{
  const c = new FC.FlightController(BASE)
  const q = { x: 0, y: 0, z: 0, w: 1 }; FC.quatFromBasisInto(-1, 0, 0, 0, 1, 0, q)
  c.teleport(FAR, 0, 0, 1999.0, 0, 0, q); c.input.throttle = 1
  let t = 0; while (sp(c.vel) > 1880 && t < 3600) { c.integrateFlight(FC.FLIGHT_DT); t++ }
  p('B.brake1999to1880.seconds', f(t / 60) + ' (unfaded 2.64 s; cap at 3600 ticks = 60 s)')
}
// C¹ smoothness: one-sided slopes of the fade at both ends
{
  const fade = (s) => { if (s <= BASE.capFadeStart) return 1; const t = Math.min(1, (s - BASE.capFadeStart) / (BASE.hardCapSpeed - BASE.capFadeStart)); return 1 - t * t * (3 - 2 * t) }
  const h = 1e-4
  p('B.fadeSlope@1880(+)', f((fade(1880 + h) - fade(1880)) / h) + '  @2000(−) ' + f((fade(2000) - fade(2000 - h)) / h))
}

// ===== C. "2,000 m/s absolute cap": gravity dives exceed it =====
function dive(throttle) {
  const c = new FC.FlightController(BASE)
  const r0 = R + 60000
  const q = { x: 0, y: 0, z: 0, w: 1 }; FC.quatFromBasisInto(-1, 0, 0, 0, 1, 0, q) // nose down (−X radial)
  c.teleport(r0, 0, 0, -1990, 0, 0, q); c.input.throttle = throttle
  let vmax = 0, altAt = 0, resc = 0, prev = 0
  for (let i = 0; i < 4000 && !c.telemetry.grounded && c.integrity.contacts === 0; i++) {
    c.integrateFlight(FC.FLIGHT_DT)
    const s = sp(c.vel); if (s > vmax) { vmax = s; altAt = c.telemetry.altMSL }
    if (Math.abs(s - BASE.hardCapSpeed) < 1e-9 && prev > BASE.hardCapSpeed) resc++
    prev = s
  }
  return { vmax, altAt, resc }
}
for (const th of [0, 1]) { const d = dive(th); p(`C.dive.throttle${th}.vmax`, f(d.vmax) + ` m/s at alt ${f(d.altAt)} m; rescale events ${d.resc}`) }
p('C.vacuumBound', f(Math.sqrt(2000 * 2000 + 2 * BASE.planetMu / R)) + ' m/s (2000 m/s from infinity to r=R, no drag) vs safetyRescaleAbove ' + BASE.safetyRescaleAbove)

// ===== D. planet spin: atmosphere/landing rotate, terrain + gravity do not =====
function skate(omega) {
  const cfg = { ...BASE, planetSpin: omega }
  const c = new FC.FlightController(cfg)
  const d0 = nrm({ x: 1, y: 0, z: 0.0 })
  const h0 = TF.terrainHeight(d0.x, d0.y, d0.z)
  const r0 = R + h0 + 3.2
  const q = { x: 0, y: 0, z: 0, w: 1 }; FC.quatFromBasisInto(0, 0, -1, 1, 0, 0, q)
  c.teleport(d0.x * r0, d0.y * r0, d0.z * r0, 0, 0, -omega * r0, q) // v = Ω×p at rest w.r.t. air
  let grounded = 0
  for (let i = 0; i < 600; i++) { c.integrateFlight(FC.FLIGHT_DT); if (c.telemetry.grounded) grounded++ }
  const d1 = nrm(c.pos)
  // terrain is sampled at the INERTIAL direction (terrainHeight(pos/r)), so the arc between
  // d0 and d1 is distance travelled over the terrain the engine collides with.
  return { arc: ang(d0, d1) * R, grounded, agl: c.telemetry.altAGL, gs: c.telemetry.groundSpeed, air: c.telemetry.airspeed }
}
const s0 = skate(0), s1 = skate(0.0104)
control('noSpin_parked', s0.arc < 1)
p('D.Ω=0.arc_over_terrain_10s', f(s0.arc) + ' m, grounded ticks ' + s0.grounded + '/600')
p('D.Ω=0.0104.arc_over_terrain_10s', f(s1.arc) + ' m, grounded ticks ' + s1.grounded + '/600, airspeed ' + f(s1.air) + ', |v| ' + f(s1.gs) + ', AGL ' + f(s1.agl))
// cap frame: ship at rest on the ground at the equator has |v| = Ω r already
p('D.capHeadroom_pro_vs_retro', `${f(2000 - 0.0104 * R)} / ${f(2000 + 0.0104 * R)} m/s ground speed at Ω=0.0104 (cap measured on inertial |v|)`)

// ===== E. NaN guard: one NaN input latches angVel; observer sees NaN state =====
{
  const c = new FC.FlightController(BASE)
  c.teleport(FAR, 0, 0, 100, 0, 0, { x: 0, y: 0, z: 0, w: 1 })
  let obsNaN = 0
  c.tickObserver = (cc) => { if (!Number.isFinite(cc.pos.x) || !Number.isFinite(cc.quat.w)) obsNaN++ }
  c.input.yaw = NaN; c.integrateFlight(FC.FLIGHT_DT); c.input.yaw = 0
  const x1 = c.pos.x
  for (let i = 0; i < 300; i++) c.integrateFlight(FC.FLIGHT_DT)
  p('E.afterOneNaNyaw', `nanEvents ${c.integrity.nanEvents}/301, observer saw NaN ${obsNaN}, pos.x moved ${f(c.pos.x - x1)} m in 5 s at 100 m/s, angVel.y ${c.angVel.y}`)
  const c2 = new FC.FlightController(BASE)
  c2.teleport(FAR, 0, 0, 100, 0, 0, { x: 0, y: 0, z: 0, w: 1 })
  for (let i = 0; i < 300; i++) c2.integrateFlight(FC.FLIGHT_DT)
  control('noNaN_moves_500m', Math.abs(c2.pos.x - FAR - 500) < 1)
}

// ===== F. telemetry pressure ignores the temperature floor =====
{
  const c = new FC.FlightController(BASE)
  for (const alt of [10000, 20000, 50000]) {
    c.teleport(0, R + alt, 0, 100, 0, 0, { x: 0, y: 0, z: 0, w: 1 }); c.integrateFlight(FC.FLIGHT_DT)
    const a2 = c.telemetry.altMSL
    p(`F.pressure@${alt}`, `telemetry ${c.telemetry.pressure.toExponential(3)} vs pressureAt ${ATM.pressureAt(BASE.atmosphere, a2).toExponential(3)}`)
  }
}

// ===== G. attitude integrator + tracker accuracy (expected clean) =====
{
  const q = { x: 0, y: 0, z: 0, w: 1 }
  for (let i = 0; i < 600; i++) FC.quatIntegrateInPlace(q, 0, 1.8, 0, FC.FLIGHT_DT)
  const exact = 18 // rad about +Y
  const fw = rot(q, { x: 1, y: 0, z: 0 })
  const got = Math.atan2(-fw.z, fw.x) // rotation about +Y takes x→(cos, 0, −sin)
  const e = Math.atan2(Math.sin(got - exact), Math.cos(got - exact))
  p('G.quatIntegrate.yaw18rad.err_deg', f(deg(e)))
  const c = new FC.FlightController(BASE)
  c.teleport(FAR, 0, 0, 0, 0, 0, { x: 0, y: 0, z: 0, w: 1 }); c.input.pitch = 1; c.integrateFlight(FC.FLIGHT_DT)
  const cd = BASE.aero.baseDamping // q = 0 in vacuum
  p('G.tracker.oneTick', `${f(c.angVel.z)} vs exact ${f(BASE.pitchRateMax * (1 - Math.exp(-cd * FC.FLIGHT_DT)))}`)
}
p('controls', `${cOk}/${cN}`)
process.exitCode = cOk === cN ? 0 : 1