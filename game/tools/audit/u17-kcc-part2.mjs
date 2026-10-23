// A1-U17 probe — astronautKCC part 2: jump/landing, slide, airborne frame, vehicle frame, telemetry.
// READ-ONLY audit. Imports the REAL KCC + terrain. Truth is computed HERE: planet/world radials
// from the KCC's own positions, true AGL from the height field (U14: heights clean), ballistics
// from an independent RK4. Run from game/:  node tools/audit/u17-kcc-part2.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const K = await import('../../src/core/physics/astronautKCC.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const SF = await import('../../src/core/physics/sphericalFrame.ts')
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
const q = { x: 0, y: 0, z: 0, w: 1 }, tv = { x: 0, y: 0, z: 0 }
const spin = (th, v) => { SF.spinQuatInto(th, q); SF.rotateByQuatInto(q, v.x, v.y, v.z, tv); return { ...tv } }
const pct = (a, pp) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(pp * s.length))] : NaN }
const DT = 1 / 60
const tick = (k) => { const L = k.integrity.landings; k.update(DT); return k.integrity.landings > L }

// ============ A. airborne up re-alignment mixes frames (planet-frame up → WORLD radial) ============
// Claim (class doc): up/fwd are PLANET-frame. _flightTick blends up toward absPos/|absPos| (WORLD).
// Prediction: tilt off the planet radial during a jump ≈ blend·(angle between world & planet radial);
// 0 at θ = 0, ≈ 33° at θ = π/2 after a 1.02 s EARTHSCALE jump (b = 1 − e^(−1.02/2) = 0.40).
TF.initTerrainField(TF.TEST_PLANET)
const E = K.EARTHSCALE_ASTRONAUT
function airborneMix(theta0) {
  const k = new K.AstronautKCC(E); k._theta = theta0; k._thetaPrev = theta0
  k.teleportSurface(1, 0.002, 0.003)
  const a0 = ang(k.up, nrm(k.pLocal))
  k.input.jump = true
  let maxP = 0, ticks = 0, snap = NaN
  for (let i = 0; i < 600; i++) {
    const upB = { ...k.up }; const l = tick(k); ticks++
    if (l) { snap = ang(upB, k.up); break }
    maxP = Math.max(maxP, ang(k.up, nrm(k.pLocal)))
  }
  return { a0: deg(a0), maxTilt: deg(maxP), ticks, landSnap: deg(snap) }
}
const mix = {}
for (const th of [0, 0.1, 0.624, Math.PI / 2]) {
  const r = airborneMix(th); mix[th] = r
  p(`A.jump_theta${f(th)}`, `takeoffUpVsRadial=${f(r.a0)}deg maxAirborneUpVsPlanetRadial=${f(r.maxTilt)}deg flightTicks=${r.ticks} landingTickUpSnap=${f(r.landSnap)}deg`)
}
control('A_theta0_noTilt', mix[0].maxTilt <= mix[0].a0 + 0.01)
function zeroG(theta0, cfg = E) {
  const k = new K.AstronautKCC(cfg); k._theta = theta0; k._thetaPrev = theta0
  const d = nrm({ x: 1, y: 0.2, z: 0.1 }), P = spin(theta0, { x: d.x * 40000, y: d.y * 40000, z: d.z * 40000 })
  k.teleportAbs(P.x, P.y, P.z, 0, 0, 0)
  const a0 = ang(k.up, nrm(k.pLocal))
  for (let i = 0; i < 600; i++) tick(k)
  return { mode: k.mode, a0: deg(a0), planet: deg(ang(k.up, nrm(k.pLocal))), world: deg(ang(k.up, nrm(k.absPos))) }
}
for (const th of [0, Math.PI / 2]) {
  const z = zeroG(th)
  p(`A.zeroG10s_theta${f(th)}`, `mode=${z.mode} start=${f(z.a0)}deg upVsPlanetRadial=${f(z.planet)}deg upVsWorldRadial=${f(z.world)}deg`)
}
// Control (revised after run 1: with Ω ≠ 0 the spin advances 0.104 rad in 10 s, so θ0 = 0 is not a
// frame-coincident control). With Ω = 0 and θ0 = 0 planet and world frames coincide → tilt must be 0.
{ const z = zeroG(0, { ...E, spinOmega: 0 }); p('A.zeroG10s_om0_theta0', `upVsPlanetRadial=${f(z.planet)}deg`); control('A_zeroG_om0_noTilt', z.planet < 1e-6) }
p('A.spinAngle_10s_deg', f(deg(E.spinOmega * 10)))

// ============ G. vehicle frame: up/fwd written as quat·(parent-frame) = WORLD frame ============
// A vehicle parked on the spinning planet (rides the spin). The character's planet-frame up should
// stay put; prediction if frames mix: drift ≈ θ(t) = Ω·t (35.7° after 60 s at Ω 0.0104).
function parked(T, om) {
  const cfg = { ...E, spinOmega: om }
  const k = new K.AstronautKCC(cfg); k.teleportSurface(1, 0.002, 0.003)
  const P0 = { ...k.absPos }, up0 = ang(k.up, nrm(k.pLocal)), upPl0 = { ...k.up }
  const prov = { pos: { ...P0 }, quat: { x: 0, y: 0, z: 0, w: 1 }, vel: { x: om * P0.z, y: 0, z: -om * P0.x }, angVel: { x: 0, y: om, z: 0 } }
  k.attachVehicle(prov)
  for (let i = 0; i < T * 60; i++) {
    const th = (k._theta + om * DT) % (2 * Math.PI)
    const P = spin(th, P0); prov.pos.x = P.x; prov.pos.y = P.y; prov.pos.z = P.z
    SF.spinQuatInto(th, prov.quat); prov.vel.x = om * P.z; prov.vel.z = -om * P.x
    tick(k)
  }
  return { mode: k.mode, up0: deg(up0), upNow: deg(ang(k.up, nrm(k.pLocal))), upDrift: deg(ang(k.up, upPl0)), theta: deg(k._theta), pErr: len({ x: k.pLocal.x - P0.x, y: k.pLocal.y - P0.y, z: k.pLocal.z - P0.z }) }
}
for (const [T, om] of [[60, 0], [60, E.spinOmega], [151, E.spinOmega]]) {
  const g = parked(T, om)
  p(`G.parkedVehicle_T${T}_om${om}`, `mode=${g.mode} pLocalErr=${f(g.pErr)}m upVsRadial start=${f(g.up0)} now=${f(g.upNow)}deg planetFrameUpDrift=${f(g.upDrift)}deg theta=${f(g.theta)}deg`)
  if (om === 0) control('G_static_noDrift', g.upDrift < 1e-6 && g.pErr < 1e-6)
}

// ============ Moon (play config, Ω = 0) ============
TF.initTerrainField(MC.MOON_PARAMS)
const M = MC.MOON_ASTRONAUT, R = M.planetRadius, G0 = M.planetMu / (R * R)
const rnd = NZ.mulberry32(1717)
const randUnit = () => { for (;;) { const a = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }; const l = len(a); if (l > 0.1 && l <= 1) return nrm(a) } }
const H = (d) => TF.terrainHeight(d.x, d.y, d.z)
function site(minS, maxS, tries = 4000) {
  for (let t = 0; t < tries; t++) {
    const d = randUnit(), k = new K.AstronautKCC(M); k.teleportSurface(d.x, d.y, d.z)
    tick(k); const s = k.telemetry.slopeDeg
    if (k.grounded && s >= minS && s < maxS) return k
  }
  return null
}

// ---- B. landing snaps the up vector (airborne up decayed to radial; plant re-blends normal) ----
// Prediction: snap ≈ angle(blended up, radial) ≈ atan(0.65 sinθ / (0.35 + 0.65 cosθ)) at slope θ.
const snaps = [], airMax = [], snapBySlope = []
for (let n = 0; n < 120; n++) {
  const k = site(0, 40); if (!k) break
  const s0 = k.telemetry.slopeDeg
  k.input.jump = true
  let upPrev = { ...k.up }, mAir = 0
  for (let i = 0; i < 900; i++) {
    const l = tick(k); const d = deg(ang(upPrev, k.up))
    if (l) { snaps.push(d); snapBySlope.push([s0, d]); break }
    mAir = Math.max(mAir, d); upPrev = { ...k.up }
  }
  airMax.push(mAir)
}
p('B.jumps', snaps.length)
p('B.landingTickUpSnap_deg_p50_p90_max', `${f(pct(snaps, 0.5))} ${f(pct(snaps, 0.9))} ${f(Math.max(...snaps))}`)
p('B.maxAirborneTickUpChange_deg_max', f(Math.max(...airMax)))
p('B.fracSnapOver10deg', f(snaps.filter((x) => x > 10).length / snaps.length))
const steep = snapBySlope.filter(([s]) => s > 25)
p('B.slope25plus_takeoffSlope_vs_snap', steep.slice(0, 6).map(([s, d]) => `${f(s)}:${f(d)}`).join(' '))

// ---- F. ballistics vs independent RK4 (flat sites) ----
function rk4Flight(r0, u) {
  const g = { x: 0, y: 0, z: 0 }, acc = (r) => { SF.gravityInto(M.planetMu, M.gravityRange, r, 0, 0, g); return g.x }
  let r = r0, v = u, t = 0, h = 1e-4, apex = r0
  for (;;) {
    const k1v = acc(r), k1r = v, k2v = acc(r + k1r * h / 2), k2r = v + k1v * h / 2
    const k3v = acc(r + k2r * h / 2), k3r = v + k2v * h / 2, k4v = acc(r + k3r * h), k4r = v + k3v * h
    r += (k1r + 2 * k2r + 2 * k3r + k4r) * h / 6; v += (k1v + 2 * k2v + 2 * k3v + k4v) * h / 6; t += h
    apex = Math.max(apex, r); if (r < r0 && t > 0.1) return { t, apex: apex - r0 }
  }
}
const fl = []
for (let n = 0; n < 10; n++) {
  const k = site(0, 2); if (!k) break
  const r0 = len(k.pLocal); k.input.jump = true
  let ticks = 0, apex = 0
  for (let i = 0; i < 900; i++) { const l = tick(k); ticks++; apex = Math.max(apex, len(k.pLocal) - r0); if (l) break }
  const ref = rk4Flight(r0, M.jumpSpeed)
  fl.push({ dt: ticks * DT - ref.t, da: apex - ref.apex, T: ticks * DT, ref })
}
p('F.flight_T_s_vs_RK4', fl.slice(0, 3).map((x) => `${f(x.T)}/${f(x.ref.t)}`).join(' '))
p('F.apex_m_vs_RK4', fl.slice(0, 3).map((x) => `${f(x.ref.apex + x.da)}/${f(x.ref.apex)}`).join(' '))
p('F.maxAbs_dT_s_dApex_m', `${f(Math.max(...fl.map((x) => Math.abs(x.dt))))} ${f(Math.max(...fl.map((x) => Math.abs(x.da))))}`)
// Control (revised after run 1, the 2-tick flight-time bound was too tight on 0–2° sites): semi-implicit
// Euler (v first) lowers the apex by ≈ u·dt/2; require the apex deficit in [0, 1.5·u·dt/2].
p('F.predictedApexBias_m', f(M.jumpSpeed * DT / 2))
control('F_apexBias_symplecticEuler', fl.length > 0 && fl.every((x) => -x.da >= 0 && -x.da <= 1.5 * M.jumpSpeed * DT / 2))

// ---- C. slide: stops within ~0.2 s once slope < 45°, even where kinetic friction keeps it going ----
// Physics (Coulomb, μk = 0.6): a = g(sinθ − μk cosθ) along the fall line; > 0 for θ > atan 0.6 = 31°.
// Code: slope ≤ 45° → vSlide *= e^(−dt/0.06) (exponential grip, independent of g, μ, θ).
const trans = []; let maxSlide = 0, sites = 0
for (let n = 0; n < 60 && sites < 30; n++) {
  const k = site(46, 70, 3000); if (!k) break
  sites++
  const sl = [], vs = []
  for (let i = 0; i < 300; i++) { tick(k); if (!k.grounded) break; sl.push(k.telemetry.slopeDeg); vs.push(k.telemetry.slideSpeed) }
  maxSlide = Math.max(maxSlide, ...vs)
  for (let i = 1; i + 6 < sl.length; i++) {
    if (sl[i - 1] > 45 && sl[i] <= 45 && vs[i - 1] > 0.3 && sl.slice(i, i + 6).every((s) => s <= 45)) {
      const th = sl[i] * Math.PI / 180
      trans.push({ s: sl[i], v0: vs[i - 1], v6: vs[i + 5], dEff: (vs[i - 1] - vs[i + 5]) / (6 * DT), aPhys: G0 * (Math.sin(th) - M.kineticFriction * Math.cos(th)) })
    }
  }
}
p('C.slideSites', sites); p('C.maxSlideSpeed_mps', f(maxSlide)); p('C.transitions_below45', trans.length)
p('C.effDecel_mps2_p50_max', `${f(pct(trans.map((t) => t.dEff), 0.5))} ${f(Math.max(...trans.map((t) => t.dEff)))}`)
p('C.speedKept_after_0.1s_p50', f(pct(trans.map((t) => t.v6 / t.v0), 0.5)))
p('C.fracWherePhysicsStillAccelerates', f(trans.filter((t) => t.aPhys > 0).length / Math.max(1, trans.length)))
p('C.samples_slope:v0->v6:aPhys', trans.slice(0, 5).map((t) => `${f(t.s)}:${f(t.v0)}->${f(t.v6)}:${f(t.aPhys)}`).join(' '))
p('C.physicalMaxDecel_mps2_mu_g', f(M.kineticFriction * G0))

// ---- D. airborne altAGL uses the TAKE-OFF height (_hCur is not refreshed in flight) ----
const dErr = []; let fakeBelow = 0, jumpsD = 0
for (let n = 0; n < 60; n++) {
  const k = site(0, 30); if (!k) break
  k.input.moveF = 1; k.input.sprint = true
  for (let i = 0; i < 40; i++) tick(k)
  if (!k.grounded) continue
  k.input.jump = true; jumpsD++
  let mErr = 0
  for (let i = 0; i < 900; i++) {
    const l = tick(k); if (l) break
    const d = nrm(k.pLocal), tru = len(k.pLocal) - (R + H(d)) - M.groundClearance, rep = k.telemetry.altAGL
    mErr = Math.max(mErr, Math.abs(rep - tru)); if (rep < 0 && tru > 0.2) fakeBelow++
  }
  dErr.push(mErr)
}
p('D.sprintJumps', jumpsD)
p('D.maxAbsAGLerr_m_p50_p90_max', `${f(pct(dErr, 0.5))} ${f(pct(dErr, 0.9))} ${f(Math.max(...dErr))}`)
p('D.ticksReportedBelowGroundWhileTrueAbove0.2m', fakeBelow)

// ---- E. landing plants vCtl = fwd·inF·speed only — strafe (moveR) is dropped ----
function strafe(inF, inR, minS, maxS) {
  const k = site(minS, maxS); k.autoTurnEnabled = false
  k.input.moveF = inF; k.input.moveR = inR
  for (let i = 0; i < 90; i++) tick(k)
  const vB = k.telemetry.relSpeed; k.input.jump = true
  let vL = NaN, normalFrac = NaN, rec = 0, landed = false
  for (let i = 0; i < 900; i++) {
    const l = tick(k)
    if (l) { landed = true; vL = k.telemetry.relSpeed; const vc = k._vCtl; normalFrac = len(vc) > 1e-9 ? Math.abs(dot(nrm(vc), k.up)) : 0; break }
  }
  if (landed) for (let i = 0; i < 120; i++) { tick(k); rec++; if (k.telemetry.relSpeed >= 0.9 * vB) break }
  return { vB, vL, normalFrac, rec }
}
for (const [nm, F, Rr] of [['fwd', 1, 0], ['strafe', 0, 1], ['diag', 1, 1]]) {
  const e = strafe(F, Rr, 0, 3)
  p(`E.flat_${nm}`, `speedBefore=${f(e.vB)} relSpeedOnLandingTick=${f(e.vL)} ticksTo90pct=${e.rec}`)
  if (nm === 'fwd') control('E_fwd_keeps_speed', Math.abs(e.vL - e.vB) / e.vB < 0.05)
}
const es = strafe(1, 0, 20, 35)
p('E.slope20to35_fwd', `speedBefore=${f(es.vB)} landing=${f(es.vL)} |vCtl·up|/|vCtl|=${f(es.normalFrac)}`)
p('controls', `${cOk}/${cN}`)