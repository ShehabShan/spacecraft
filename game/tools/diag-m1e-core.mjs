import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// Post-F18/F19/F20 Node verification (Lead ruling 4b): replicates the 1E
// rows verbatim against the real extracted modules and prints every number.
const {
  initTerrainField, terrainHeight, terrainNormalInto, TEST_PLANET,
} = await import('../src/core/terrain/terrainField.ts')
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
const {
  AstronautKCC, EARTHSCALE_ASTRONAUT,
} = await import('../src/core/physics/astronautKCC.ts')
const {
  quatFromFrameInto, rotateByQuatConjInto, transportVelocityInto,
} = await import('../src/core/physics/sphericalFrame.ts')

const R = TEST_PLANET.radius
initTerrainField(TEST_PLANET)
const kcc = new AstronautKCC(EARTHSCALE_ASTRONAUT)
const inp = kcc.input

const _scanN = { x: 0, y: 0, z: 0 }
const _scanT = { x: 0, y: 0, z: 0 }
function slopeDegAt(d) {
  terrainNormalInto(d.x, d.y, d.z, _scanN)
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}
const fran = mulberry32(0x5eed1e)
let FLAT = null
for (let i = 0; i < 40000 && FLAT === null; i++) {
  const th = fran() * Math.PI * 2
  const yy = (fran() * 2 - 1) * 0.05
  const s = Math.sqrt(1 - yy * yy)
  _scanT.x = Math.cos(th) * s; _scanT.y = yy; _scanT.z = Math.sin(th) * s
  if (slopeDegAt(_scanT) > 0.6) continue
  const h0 = terrainHeight(_scanT.x, _scanT.y, _scanT.z)
  let ok = true
  for (let kk = 0; kk < 4; kk++) {
    const a = kk * Math.PI * 0.5 + 0.4
    const ex = Math.cos(a) * 0.0004, ez = Math.sin(a) * 0.0004
    const l = Math.sqrt((_scanT.x + ex) ** 2 + _scanT.y ** 2 + (_scanT.z + ez) ** 2)
    const hx = terrainHeight((_scanT.x + ex) / l, _scanT.y / l, (_scanT.z + ez) / l)
    if (Math.abs(hx - h0) > 0.15) { ok = false; break }
  }
  if (ok) FLAT = { x: _scanT.x, y: _scanT.y, z: _scanT.z }
}
console.log(`FLAT site slope ${slopeDegAt(FLAT).toFixed(3)}°`)

/* ---------------- coriolis (verbatim, post-F18) --------------------------- */
kcc.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
kcc.autoTurnEnabled = true
inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.crouch = false
inp.turnRate = 0; inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0
for (let i = 0; i < 5; i++) kcc.integrateTick(1 / 60)
const lx = kcc.pLocal.x, ly = kcc.pLocal.y, lz = kcc.pLocal.z
const upx = kcc.up.x, upy = kcc.up.y, upz = kcc.up.z
const rl = Math.hypot(lx, ly, lz)
const rx = lx / rl, ry = ly / rl, rz = lz / rl
inp.jump = true
let airTicks = 0
for (let i = 0; i < 240; i++) {
  kcc.integrateTick(1 / 60)
  if (kcc.grounded) break
  airTicks++
}
const T = airTicks / 60
const upd = upx * rx + upy * ry + upz * rz
const _vA = { x: 0, y: 0, z: 0 }, _vB = { x: 0, y: 0, z: 0 }
const _vC = { x: 0, y: 0, z: 0 }, _vD = { x: 0, y: 0, z: 0 }
_vA.x = (upx - upd * rx) * 5 * T; _vA.y = (upy - upd * ry) * 5 * T; _vA.z = (upz - upd * rz) * 5 * T
_vB.x = kcc.pLocal.x - lx - _vA.x; _vB.y = kcc.pLocal.y - ly - _vA.y; _vB.z = kcc.pLocal.z - lz - _vA.z
transportVelocityInto(EARTHSCALE_ASTRONAUT.spinOmega, lx, ly, lz, _vC)
const tl = Math.hypot(_vC.x, _vC.y, _vC.z) || 1
_vD.x = -_vC.x / tl; _vD.y = -_vC.y / tl; _vD.z = -_vC.z / tl
const westDrift = _vB.x * _vD.x + _vB.y * _vD.y + _vB.z * _vD.z
_vA.x = _vB.x - westDrift * _vD.x; _vA.y = _vB.y - westDrift * _vD.y; _vA.z = _vB.z - westDrift * _vD.z
const perpDrift = Math.hypot(_vA.x, _vA.y, _vA.z)
const g = EARTHSCALE_ASTRONAUT.planetMu / (rl * rl)
const predicted = (4 / 3) * EARTHSCALE_ASTRONAUT.spinOmega * 125 / (g * g)
let settleTicks = -1, maxSettle = 0
for (let i = 0; i < 32; i++) {
  kcc.integrateTick(1 / 60)
  if (i >= 1) {
    if (settleTicks < 0 && kcc.telemetry.relSpeed < 0.02) settleTicks = i
    if (settleTicks >= 0 && kcc.telemetry.relSpeed > maxSettle)
      maxSettle = kcc.telemetry.relSpeed
  }
}
console.log(`coriolis: airTicks=${airTicks} (48–78; 2u/g≈61) west=${(westDrift * 100).toFixed(2)} cm (0.6–6) perp=${(perpDrift * 100).toFixed(2)} cm (<1.2) theory=${(predicted * 100).toFixed(2)} cm settle=${settleTicks} tick(s) (1–2) maxSettle=${maxSettle.toFixed(4)} (<0.02)`)

/* ---------------- state-machine (verbatim, post-F19) ---------------------- */
inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.crouch = false
inp.turnRate = 0; inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0
const p0 = kcc.pLocal
const l0 = Math.hypot(p0.x, p0.y, p0.z)
kcc.teleportAbs(p0.x / l0 * 31000, p0.y / l0 * 31000, p0.z / l0 * 31000, 0, 0, 0)
kcc.integrateTick(1 / 60)
const zeroOk = kcc.mode === 'ZERO-G'
const b0 = kcc.telemetry.rcsBudget
const f0 = { ...kcc.fwd }
inp.rcsF = 1
for (let i = 0; i < 120; i++) kcc.integrateTick(1 / 60)
inp.rcsF = 0
const rcsDv = Math.hypot(kcc.absVel.x, kcc.absVel.y, kcc.absVel.z)
const budgetUsed = b0 - kcc.telemetry.rcsBudget
inp.turnRate = 0.5
for (let i = 0; i < 60; i++) kcc.integrateTick(1 / 60)
inp.turnRate = 0
const yawAngle = Math.acos(Math.max(-1, Math.min(1,
  kcc.fwd.x * f0.x + kcc.fwd.y * f0.y + kcc.fwd.z * f0.z)))
const P0 = kcc.absPos
const pl0 = Math.hypot(P0.x, P0.y, P0.z)
kcc.teleportAbs(P0.x, P0.y, P0.z, (-30 * P0.x) / pl0, (-30 * P0.y) / pl0, (-30 * P0.z) / pl0)
let surfaceTick = -1, landed = false, landingTick = -1
for (let i = 0; i < 26_000; i++) {
  kcc.integrateTick(1 / 60)
  if (surfaceTick < 0 && kcc.mode === 'SURFACE') surfaceTick = i
  if (kcc.grounded) { landed = true; landingTick = i; break }
}
const prov = {
  pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
  quat: { x: 0, y: 0, z: 0, w: 1 }, angVel: { x: 0, y: 0.05, z: 0 },
}
const W = 0.05, A = 800, ALT = R + 1200
const drivePlatform = (t) => {
  prov.pos.x = A * Math.cos(W * t); prov.pos.y = ALT; prov.pos.z = A * Math.sin(W * t)
  prov.vel.x = -A * W * Math.sin(W * t); prov.vel.y = 0; prov.vel.z = A * W * Math.cos(W * t)
  const vl = Math.hypot(prov.vel.x, prov.vel.z)
  quatFromFrameInto(prov.vel.x / vl, prov.vel.y, prov.vel.z / vl,
    prov.pos.x / Math.hypot(A, ALT), prov.pos.y / Math.hypot(A, ALT),
    prov.pos.z / Math.hypot(A, ALT), prov.quat)
}
drivePlatform(0)
const offP = { x: 0, y: 0, z: 0 }
rotateByQuatConjInto(prov.quat, 0, 2, 0, offP)
kcc.teleportAbs(prov.pos.x, prov.pos.y + 2, prov.pos.z, prov.vel.x, prov.vel.y, prov.vel.z)
kcc.attachVehicle(prov)
let maxErr = 0
for (let i = 1; i <= 600; i++) {
  drivePlatform(i / 60)
  kcc.integrateTick(1 / 60)
  const q = prov.quat
  const ex = q.w * (2 * (q.y * offP.z - q.z * offP.y)) +
    (q.y * (2 * (q.x * offP.y - q.y * offP.x)) -
      q.z * (2 * (q.z * offP.x - q.x * offP.z))) + offP.x
  const ey = q.w * (2 * (q.z * offP.x - q.x * offP.z)) +
    (q.z * (2 * (q.y * offP.z - q.z * offP.y)) -
      q.x * (2 * (q.x * offP.y - q.y * offP.x))) + offP.y
  const ez = q.w * (2 * (q.x * offP.y - q.y * offP.x)) +
    (q.x * (2 * (q.z * offP.x - q.x * offP.z)) -
      q.y * (2 * (q.y * offP.z - q.z * offP.y))) + offP.z
  const err = Math.max(
    Math.abs(kcc.absPos.x - (prov.pos.x + ex)),
    Math.abs(kcc.absPos.y - (prov.pos.y + ey)),
    Math.abs(kcc.absPos.z - (prov.pos.z + ez)))
  if (err > maxErr) maxErr = err
}
drivePlatform(10)
const dvx = prov.vel.x + (prov.angVel.y * (kcc.absPos.z - prov.pos.z))
const dvy = prov.vel.y
const dvz = prov.vel.z - (prov.angVel.y * (kcc.absPos.x - prov.pos.x))
kcc.detachVehicle()
const detachDv = Math.hypot(kcc.absVel.x - dvx, kcc.absVel.y - dvy, kcc.absVel.z - dvz)
console.log(`state-machine: zeroOk=${zeroOk} rcsDv=${rcsDv.toFixed(4)} budgetUsed=${budgetUsed.toFixed(4)} yaw=${yawAngle.toFixed(4)} surfaceTick=${surfaceTick} landed=${landed} landingTick=${landingTick} (<26000) vehicleErr=${maxErr.toExponential(1)} (<1e-9) detachDv=${detachDv.toExponential(1)} (<1e-6) nan=${kcc.integrity.nanEvents}`)

/* ---------------- slope-step (verbatim, post-F20) ------------------------- */
kcc.resetIntegrityStats()   // F20: first statement of runSlopeStep
const STEEP = {
  name: 'M1E engineered slopes', radius: 5000, seed: 777,
  continentFreq: 1.2, continentAmp: 40,
  maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200,
  detailFreq: 8, detailAmp: 3,
}
initTerrainField(STEEP)
const _p8 = { x: 0, y: 0, z: 0 }
function uniformAround(dir, nb) {
  const eps = 3 / 5000
  let ux = 0, uy = 0, uz = 0
  if (Math.abs(dir.y) <= Math.abs(dir.x) && Math.abs(dir.y) <= Math.abs(dir.z)) uy = 1
  else if (Math.abs(dir.x) <= Math.abs(dir.z)) ux = 1
  else uz = 1
  let e1x = uy * dir.z - uz * dir.y, e1y = uz * dir.x - ux * dir.z, e1z = ux * dir.y - uy * dir.x
  const m = Math.hypot(e1x, e1y, e1z) || 1
  e1x /= m; e1y /= m; e1z /= m
  const e2x = dir.y * e1z - dir.z * e1y, e2y = dir.z * e1x - dir.x * e1z, e2z = dir.x * e1y - dir.y * e1x
  const c = Math.cos(eps), sn = Math.sin(eps)
  for (let kk = 0; kk < 8; kk++) {
    const a = (kk * Math.PI) / 4
    const bx = Math.cos(a) * e1x + Math.sin(a) * e2x
    const by = Math.cos(a) * e1y + Math.sin(a) * e2y
    const bz = Math.cos(a) * e1z + Math.sin(a) * e2z
    const l = Math.hypot(dir.x * c + bx * sn, dir.y * c + by * sn, dir.z * c + bz * sn) || 1
    _p8.x = (dir.x * c + bx * sn) / l; _p8.y = (dir.y * c + by * sn) / l; _p8.z = (dir.z * c + bz * sn) / l
    if (!nb(_p8, slopeDegAt(_p8))) return false
  }
  return true
}
function scanFor(pred, tries, rand, nb) {
  for (let i = 0; i < tries; i++) {
    const u = rand() * 2 - 1
    const th = rand() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    _scanT.x = Math.cos(th) * s; _scanT.y = u; _scanT.z = Math.sin(th) * s
    const slope = slopeDegAt(_scanT)
    if (pred(_scanT, slope) && uniformAround(_scanT, nb)) return { ..._scanT, slopeDeg: slope }
  }
  return null
}
const srand = mulberry32(0x5109e5)
const moderate = scanFor((_x, s) => s > 18 && s < 28, 20000, srand, (_x, s) => s < 35)
const steep = scanFor((_x, s) => s > 52 && s < 68, 20000, srand, (_x, s) => s > 45)
const cliff = scanFor((_x, s) => s > 70, 20000, srand, (_x, s) => s > 60)
const _n2 = { x: 0, y: 0, z: 0 }
const _vv = { x: 0, y: 0, z: 0 }
function downhillAt(dir, out) {
  terrainNormalInto(dir.x, dir.y, dir.z, _n2)
  _vv.x = -9.81 * dir.x; _vv.y = -9.81 * dir.y; _vv.z = -9.81 * dir.z
  const dn = _vv.x * _n2.x + _vv.y * _n2.y + _vv.z * _n2.z
  out.x = _vv.x - dn * _n2.x; out.y = _vv.y - dn * _n2.y; out.z = _vv.z - dn * _n2.z
  const l = Math.hypot(out.x, out.y, out.z) || 1
  out.x /= l; out.y /= l; out.z /= l
}
const _b = { x: 0, y: 0, z: 0 }
// (a)
kcc.teleportSurface(moderate.x, moderate.y, moderate.z)
downhillAt(moderate, _b)
kcc.fwd.x = -_b.x; kcc.fwd.y = -_b.y; kcc.fwd.z = -_b.z
inp.moveF = 1; inp.moveR = 0; inp.sprint = false; inp.crouch = false; inp.turnRate = 0; inp.jump = false
const alt0 = Math.hypot(kcc.pLocal.x, kcc.pLocal.y, kcc.pLocal.z) - 5000
let ga = true, ms = 0
for (let i = 0; i < 150; i++) {
  kcc.integrateTick(1 / 60)
  if (!kcc.grounded) ga = false
  if (kcc.telemetry.slideSpeed > ms) ms = kcc.telemetry.slideSpeed
}
const climbGain = Math.hypot(kcc.pLocal.x, kcc.pLocal.y, kcc.pLocal.z) - 5000 - alt0
inp.moveF = -1
let dg = true
for (let i = 0; i < 150; i++) { kcc.integrateTick(1 / 60); if (!kcc.grounded) dg = false }
console.log(`slope (a): ${moderate.slopeDeg.toFixed(0)}° climbGain=${climbGain.toFixed(2)} (expected ${(4 * Math.sin(moderate.slopeDeg * Math.PI / 180) * 2.5).toFixed(2)}, need >0.7×) slide=${ms.toFixed(3)} (<0.05) groundedUp=${ga} groundedDown=${dg}`)
// (b)
kcc.teleportSurface(steep.x, steep.y, steep.z)
inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.turnRate = 0; inp.jump = false
let t30 = -1, vMid = 0
const sx = kcc.pLocal.x, sy = kcc.pLocal.y, sz = kcc.pLocal.z
downhillAt(steep, _b)
for (let i = 0; i < 120; i++) {
  kcc.integrateTick(1 / 60)
  if (t30 < 0 && kcc.telemetry.slideSpeed > 0.5) t30 = i
  if (i === 60) vMid = kcc.telemetry.slideSpeed
}
const vEnd = kcc.telemetry.slideSpeed
const dx2 = kcc.pLocal.x - sx, dy2 = kcc.pLocal.y - sy, dz2 = kcc.pLocal.z - sz
const downRatio = (dx2 * _b.x + dy2 * _b.y + dz2 * _b.z) / (Math.hypot(dx2, dy2, dz2) || 1)
kcc.teleportSurface(steep.x, steep.y, steep.z)
kcc.fwd.x = -_b.x; kcc.fwd.y = -_b.y; kcc.fwd.z = -_b.z
inp.moveF = 1; inp.sprint = true
const ux0 = kcc.pLocal.x, uy0 = kcc.pLocal.y, uz0 = kcc.pLocal.z
for (let i = 0; i < 90; i++) kcc.integrateTick(1 / 60)
const uphillNet = -((kcc.pLocal.x - ux0) * _b.x + (kcc.pLocal.y - uy0) * _b.y + (kcc.pLocal.z - uz0) * _b.z)
console.log(`slope (b): ${steep.slopeDeg.toFixed(0)}° t30=${t30} (0–30) vMid=${vMid.toFixed(1)} vEnd=${vEnd.toFixed(1)} (accel) downRatio=${downRatio.toFixed(2)} (>0.9) uphillNet=${uphillNet.toFixed(2)} (<0.3)`)
// (c)
kcc.teleportSurface(cliff.x, cliff.y, cliff.z)
downhillAt(cliff, _b)
kcc.fwd.x = -_b.x; kcc.fwd.y = -_b.y; kcc.fwd.z = -_b.z
inp.moveF = 1; inp.sprint = true
const cx0 = kcc.pLocal.x, cy0 = kcc.pLocal.y, cz0 = kcc.pLocal.z
for (let i = 0; i < 90; i++) kcc.integrateTick(1 / 60)
const cliffNet = -((kcc.pLocal.x - cx0) * _b.x + (kcc.pLocal.y - cy0) * _b.y + (kcc.pLocal.z - cz0) * _b.z)
const minAGL = kcc.integrity.minAGL
console.log(`slope (c): ${cliff.slopeDeg.toFixed(0)}° cliffNet=${cliffNet.toFixed(2)} (<0.5) minAGL=${minAGL === Number.POSITIVE_INFINITY ? '+Infinity (n/a — never airborne)' : minAGL.toFixed(4)} (need > -0.05)`)
console.log(`slope-step final minAGL after reset+rows: ${minAGL === Number.POSITIVE_INFINITY ? '+Infinity' : minAGL.toFixed(4)}`)
