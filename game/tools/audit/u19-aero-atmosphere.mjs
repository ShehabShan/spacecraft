// A1-U19 probe — aerodynamics + atmosphere: hydrostatic consistency, header "<2%" claim,
// game-vs-real atmosphere thickness, stall curve, v_safe table, lift onset step, impact landing,
// and the T2 gap (per-body profiles). READ-ONLY audit. Imports the REAL modules; truth is
// computed HERE from hydrostatics (dP/dh = −ρg, P = ρ·Rs·T) and reference planetary data.
// Run from game/:  node tools/audit/u19-aero-atmosphere.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const ATM = await import('../../src/core/physics/atmosphere.ts')
const AERO = await import('../../src/core/physics/aerodynamics.ts')
const FC = await import('../../src/core/physics/flightController.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
let cOk = 0, cN = 0
const control = (n, c) => { cN++; if (c) cOk++; p(`control.${n}`, c ? 'ok' : 'FAIL') }
const A = ATM.EARTHSCALE_ATMOSPHERE, S = AERO.SHIP_AERO, F = FC.EARTHSCALE_FLIGHT
const gPlanet = F.planetMu / F.planetRadius ** 2

// controls: sound speed + wind from first principles
control('a0=340.3', Math.abs(ATM.speedOfSoundAt(A, 0) - Math.sqrt(1.4 * 287.05 * 288.15)) < 1e-9)
control('a8km=308', Math.abs(ATM.speedOfSoundAt(A, 8000) - 308.0) < 0.5)
const w = ATM.atmosphereVelocityInto(0.0104, 5000, 0, 0, { x: 0, y: 0, z: 0 })
control('wind_equator_52', Math.abs(Math.hypot(w.x, w.y, w.z) - 52) < 1e-9 && w.z < 0) // Ω=+Y, p=+X → Ω×p = −Z
control('gPlanet=9.81', Math.abs(gPlanet - 9.81) < 1e-9)

// ===== A. hydrostatics: H_s = Rs·T/g =====
const gImplied = A.rSpecific * A.tempSeaLevel / A.scaleHeight
p('A.g_implied_by_H', f(gImplied)); p('A.g_planet', f(gPlanet)); p('A.g_ratio', f(gImplied / gPlanet))
p('A.H_consistent_with_planet_g', f(A.rSpecific * A.tempSeaLevel / gPlanet))
for (const h of [500, 2000, 6000]) { // dP/dh of pressureAt vs −ρg
  const d = 1, dP = (ATM.pressureAt(A, h + d) - ATM.pressureAt(A, h - d)) / (2 * d)
  p(`A.dPdh_over_minus_rho_g@${h}`, f(dP / (-ATM.densityAt(A, h) * gPlanet)))
}
// header claim: lapse vs isothermal density differs "< 2 %". Exact polytropic density with the
// g that the SAME H implies (the only g that makes the claim well-posed), floor → isothermal.
function rhoExact(h, g) {
  const T0 = A.tempSeaLevel, L = A.lapseRate, Rs = A.rSpecific, Tf = A.tempFloor
  const hf = (T0 - Tf) / L, n = g / (Rs * L)
  if (h <= hf) return A.rho0 * Math.pow((T0 - L * h) / T0, n - 1)
  return A.rho0 * Math.pow(Tf / T0, n - 1) * Math.exp(-(h - hf) * g / (Rs * Tf))
}
let worst = 0
for (const h of [1000, 2000, 4000, 6000, 8000, 12000]) {
  const r = ATM.densityAt(A, h) / rhoExact(h, gImplied)
  worst = Math.max(worst, Math.abs(r - 1))
  p(`A.rho_iso_over_exact@${h}`, f(r))
}
p('A.worst_rel_diff', f(worst))

// ===== B. thickness relative to the body: game vs real =====
// real: [R km, scale height km] (NASA planetary fact sheets, rounded); game: catalog radiusGame
const bodies = {
  earth: [6371, 8.5, 5000, 8000], venus: [6052, 15.9, 4870.3, 6000], mars: [3390, 11.1, 2649.3, 2000],
  titan: [2575, 21, 3192.5, 2000], jupiter: [69911, 27, 16640.2, 12000], saturn: [58232, 59.5, 15120.4, 15000],
  uranus: [25362, 27.7, 9980.5, 8000], neptune: [24622, 19.7, 9835.4, 8000],
}
for (const [k, [Rr, Hr, Rg, atmH]] of Object.entries(bodies)) {
  p(`B.${k}.real_H_over_R`, f(Hr / Rr)); p(`B.${k}.game_atmH_over_R`, f(atmH / Rg))
}
p('B.earth.game_H_over_R', f(A.scaleHeight / 5000)); p('B.earth.thickness_factor', f((A.scaleHeight / 5000) / (8.5 / 6371)))

// ===== C. stall curve =====
let clMax = 0, aMax = 0, cont = 0
for (let a = 0; a <= 1.6; a += 1e-4) { const c = AERO.liftCoefficient(S, a); if (c > clMax) { clMax = c; aMax = a } }
const e = 1e-7, ac = S.alphaCrit
const sL = (AERO.liftCoefficient(S, ac) - AERO.liftCoefficient(S, ac - e)) / e
const sR = (AERO.liftCoefficient(S, ac + e) - AERO.liftCoefficient(S, ac)) / e
p('C.cl_at_alphaCrit', f(AERO.liftCoefficient(S, ac))); p('C.cl_max', f(clMax)); p('C.alpha_at_cl_max_deg', f(aMax * 180 / Math.PI))
p('C.slope_left_right_at_alphaCrit', `${f(sL)},${f(sR)}`); control('C.odd', AERO.liftCoefficient(S, -0.4) === -AERO.liftCoefficient(S, 0.4))
// lift onset step at the speedRel > 15 gate (sea level, α = alphaCrit)
p('C.lift_step_at_15ms_mps2', f(AERO.liftAccel(S, A.rho0, 15, AERO.liftCoefficient(S, ac))))
// max lift accel at sea level along the governor curve (not in the governor)
const vs0 = AERO.safeSpeedAt(S, A.rho0)
p('C.vSafe_sea', f(vs0)); p('C.max_lift_at_vSafe_sea_mps2', f(AERO.liftAccel(S, A.rho0, vs0, clMax))); p('C.aStruct', S.aStruct)

// ===== D. v_safe table vs Milestone 1D table; βL omitted from the curve =====
// The Milestone 1D table is a CLAIM, not a control: print the code value and the relative gap.
for (const [h, want, wantRho] of [[0, 151, 1.225], [1000, 230, 0.532], [2000, 430, 0.152], [4000, 802, 0.0437], [6000, 1845, 0.00826], [8000, 4253, 0.00156]]) {
  const rho = ATM.densityAt(A, h), v = AERO.safeSpeedAt(S, rho)
  p(`D.table@${h}`, `rho code ${f(rho)} vs table ${wantRho} (${f(rho / wantRho - 1)}); vSafe code ${f(v)} vs table ${want} (${f(v / want - 1)})`)
  control(`D.rho_matches_own_law@${h}`, Math.abs(rho - 1.225 * Math.exp(-h / 1200)) < 1e-12)
  p(`D.dragDecel_at_vSafe@${h}_over_aStruct`, f(AERO.dragDecel(S, rho, v) / S.aStruct))
}

// ===== E. impact landing: is there any touchdown-speed outcome? =====
TF.initTerrainField(TF.TEST_PLANET)
for (const vImp of [5, 60, 140]) {
  const c = new FC.FlightController(F)
  const h = TF.terrainHeight(0, 1, 0)
  c.teleport(0, F.planetRadius + h + 40, 0, 0, -vImp, 0, { x: 0, y: 0, z: 0, w: 1 })
  let first = -1, landed = -1, vAtContact = 0
  for (let i = 0; i < 1200; i++) {
    const vb = Math.hypot(c.vel.x, c.vel.y, c.vel.z)
    c.integrateFlight(FC.FLIGHT_DT)
    if (first < 0 && c.integrity.contacts > 0) { first = i; vAtContact = vb }
    if (landed < 0 && c.telemetry.grounded) landed = i
  }
  p(`E.v${vImp}.contact_tick`, first); p(`E.v${vImp}.speed_at_contact`, f(vAtContact)); p(`E.v${vImp}.landed_tick`, landed)
  p(`E.v${vImp}.mode`, c.telemetry.mode); p(`E.v${vImp}.nan`, c.integrity.nanEvents)
}
p('E.integrity_keys', Object.keys(new FC.FlightController(F).integrity).join('|'))
p('E.telemetry_keys', Object.keys(new FC.FlightController(F).telemetry).join('|'))

// ===== G. T2 what-if: the SAME code with only rho0 swapped to a real surface density =====
// (game H 1200 m kept; real rho0 rounded from NASA fact sheets; vertical dive from 8 km at
// 2,000 m/s, zero throttle). Question: does the governor still deliver a slow touchdown?
const realRho0 = { mars: 0.020, earth: 1.225, titan: 5.3, venus: 65, pluto: 8e-5 }
for (const [k, r0] of Object.entries(realRho0)) {
  const cfg = { ...F, atmosphere: { ...A, name: k, rho0: r0 } }
  const c = new FC.FlightController(cfg)
  c.teleport(0, F.planetRadius + 8000, 0, 0, -2000, 0, { x: 0, y: 0, z: 0, w: 1 })
  let vC = -1, peak = 0
  for (let i = 0; i < 6000 && vC < 0; i++) {
    const vb = Math.hypot(c.vel.x, c.vel.y, c.vel.z)
    c.integrateFlight(FC.FLIGHT_DT)
    peak = Math.max(peak, c.telemetry.dragDecel)
    if (c.integrity.contacts > 0) vC = vb
  }
  p(`G.${k}.rho0`, r0); p(`G.${k}.speed_at_contact`, f(vC)); p(`G.${k}.peak_drag_g`, f(peak / 9.80665)); p(`G.${k}.mode_after`, c.telemetry.mode)
}

// ===== F. T2 gap: profiles exported =====
const profiles = Object.entries(ATM).filter(([, v]) => v && typeof v === 'object' && 'rho0' in v).map(([k]) => k)
p('F.exported_profiles', profiles.join(',') || 'none'); p('F.profile_count', profiles.length)
p('F.flight_configs', Object.entries(FC).filter(([, v]) => v && typeof v === 'object' && 'atmosphere' in v).map(([k]) => k).join(','))
p('controls', `${cOk}/${cN}`)
process.exit(cOk === cN ? 0 : 1)