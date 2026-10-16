import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// Replicates the 1E headless rows (coriolis → state-machine → zero-gc burn →
// slope-step) VERBATIM against the real extracted core modules to print
// every pass criterion, including the ones the harness doesn't print.
const {
  initTerrainField, terrainHeight, terrainNormalInto, TEST_PLANET,
} = await import('../src/core/terrain/terrainField.ts')
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
const {
  AstronautKCC, EARTHSCALE_ASTRONAUT,
} = await import('../src/core/physics/astronautKCC.ts')
const {
  quatFromFrameInto, rotateByQuatConjInto, signedAngleAbout,
  transportVelocityInto,
} = await import('../src/core/physics/sphericalFrame.ts')

const R = TEST_PLANET.radius
initTerrainField(TEST_PLANET)
const kcc = new AstronautKCC(EARTHSCALE_ASTRONAUT)

const _scanN = { x: 0, y: 0, z: 0 }
const _scanT = { x: 0, y: 0, z: 0 }
function slopeDegAt(d) {
  terrainNormalInto(d.x, d.y, d.z, _scanN)
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}
// findFlatEquatorSite (verbatim)
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
console.log(`FLAT site: slope ${slopeDegAt(FLAT).toFixed(3)}°`)

/* ---------------- coriolis (verbatim structure + instrumentation) -------- */
kcc.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
kcc.autoTurnEnabled = true
const inp = kcc.input
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
  if (i < 3) {
    const pl = kcc.pLocal
    console.log(`  coriolis tick ${i + 1}: grounded=${kcc.grounded} pLocalΔwest≈` +
      `${(((pl.x - lx) * -rx + (pl.y - ly) * -ry + (pl.z - lz) * -rz)).toFixed(4)} m`)
  }
  if (kcc.grounded) break
  airTicks++
}
console.log(`coriolis: airTicks=${airTicks} (window 48–78)`)
const _vA = { x: 0, y: 0, z: 0 }, _vB = { x: 0, y: 0, z: 0 }
const _vC = { x: 0, y: 0, z: 0 }, _vD = { x: 0, y: 0, z: 0 }
const upd = upx * rx + upy * ry + upz * rz
const T = airTicks / 60
_vA.x = (upx - upd * rx) * 5 * T; _vA.y = (upy - upd * ry) * 5 * T; _vA.z = (upz - upd * rz) * 5 * T
_vB.x = kcc.pLocal.x - lx - _vA.x; _vB.y = kcc.pLocal.y - ly - _vA.y; _vB.z = kcc.pLocal.z - lz - _vA.z
transportVelocityInto(EARTHSCALE_ASTRONAUT.spinOmega, lx, ly, lz, _vC)
const tl = Math.hypot(_vC.x, _vC.y, _vC.z) || 1
_vD.x = -_vC.x / tl; _vD.y = -_vC.y / tl; _vD.z = -_vC.z / tl
const westDrift = _vB.x * _vD.x + _vB.y * _vD.y + _vB.z * _vD.z
_vA.x = _vB.x - westDrift * _vD.x; _vA.y = _vB.y - westDrift * _vD.y; _vA.z = _vB.z - westDrift * _vD.z
const perpDrift = Math.hypot(_vA.x, _vA.y, _vA.z)
const g = EARTHSCALE_ASTRONAUT.planetMu / (rl * rl)
console.log(`coriolis: westDrift=${(westDrift * 100).toFixed(2)} cm (0.6–6) perp=${(perpDrift * 100).toFixed(2)} cm (<1.2) theory=${((4 / 3) * EARTHSCALE_ASTRONAUT.spinOmega * 125 / (g * g) * 100).toFixed(2)} cm`)

/* ---------------- state-machine (verbatim + instrumentation) ------------- */
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
const v = Math.hypot(kcc.absVel.x, kcc.absVel.y, kcc.absVel.z)
const budgetUsed = b0 - kcc.telemetry.rcsBudget
inp.turnRate = 0.5
for (let i = 0; i < 60; i++) kcc.integrateTick(1 / 60)
inp.turnRate = 0
const yawAngle = Math.acos(Math.max(-1, Math.min(1,
  kcc.fwd.x * f0.x + kcc.fwd.y * f0.y + kcc.fwd.z * f0.z)))
const P0 = kcc.absPos
const pl0 = Math.hypot(P0.x, P0.y, P0.z)
kcc.teleportAbs(P0.x, P0.y, P0.z, (-30 * P0.x) / pl0, (-30 * P0.y) / pl0, (-30 * P0.z) / pl0)
let surfaceTick = -1, landed = false, lastMode = ''
for (let i = 0; i < 20_000; i++) {
  kcc.integrateTick(1 / 60)
  if (surfaceTick < 0 && kcc.mode === 'SURFACE') surfaceTick = i
  if (kcc.grounded) { landed = true; break; }
  if (i % 4000 === 0 || i === 19999) {
    const pr = Math.hypot(kcc.absPos.x, kcc.absPos.y, kcc.absPos.z)
    lastMode = `tick ${i}: r=${pr.toFixed(0)} mode=${kcc.mode} v=${Math.hypot(kcc.absVel.x, kcc.absVel.y, kcc.absVel.z).toFixed(0)}`
    console.log(`  deorbit ${lastMode}`)
  }
}
console.log(`state-machine: zeroOk=${zeroOk} rcsDv=${v.toFixed(4)} budgetUsed=${budgetUsed.toFixed(4)} yaw=${yawAngle.toFixed(4)} surfaceTick=${surfaceTick} landed=${landed} nan=${kcc.integrity.nanEvents}`)

/* ---------------- zero-gc burn (verbatim) -------------------------------- */
kcc.resetIntegrityStats()
const BURN = 30_000
let burnMinAGLtick = -1
for (let i = 0; i < BURN; i++) {
  if (i < 10_000) {
    if (i === 0) kcc.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
    inp.moveF = Math.sin(0.001 * i); inp.moveR = Math.cos(0.0013 * i)
    inp.sprint = i % 2000 < 1000; inp.turnRate = 0.3 * Math.sin(0.0007 * i)
    if (i % 2500 === 100) inp.jump = true
    inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0
  } else if (i < 20_000) {
    if (i === 10_000) {
      const p = kcc.pLocal
      const l = Math.hypot(p.x, p.y, p.z)
      kcc.teleportAbs(p.x / l * 31000, p.y / l * 31000, p.z / l * 31000, 0, 0, 0)
    }
    inp.moveF = 0; inp.moveR = 0; inp.jump = false
    inp.rcsF = Math.sin(0.002 * i); inp.rcsU = Math.cos(0.0017 * i); inp.rcsR = Math.sin(0.0011 * i)
    inp.turnRate = 0.4 * Math.sin(0.0009 * i)
  } else {
    if (i === 20_000) {
      const p = kcc.pLocal
      const l = Math.hypot(p.x, p.y, p.z)
      kcc.teleportAbs(p.x / l * 5800, p.y / l * 5800, p.z / l * 5800,
        -40 * p.x / l, -40 * p.y / l, -40 * p.z / l)
    }
    if (i === 20_001) burnMinAGLtick = i
    inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0; inp.jump = false
    inp.moveF = Math.sin(0.0015 * i); inp.moveR = Math.sin(0.0009 * i + 1)
    inp.sprint = i % 3000 < 1500; inp.turnRate = 0.2 * Math.sin(0.0006 * i)
  }
  kcc.integrateTick(1 / 60)
  if (burnMinAGLtick === i) console.log(`  burn deorbit start: minAGL so far ${kcc.integrity.minAGL}`)
}
console.log(`burn done: nan=${kcc.integrity.nanEvents} minAGL(end-of-burn)=${kcc.integrity.minAGL.toFixed(4)}`)

/* ---------------- slope-step (cliff AGL attribution) --------------------- */
const STEEP = {
  name: 'M1E engineered slopes', radius: 5000, seed: 777,
  continentFreq: 1.2, continentAmp: 40,
  maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200,
  detailFreq: 8, detailAmp: 3,
}
initTerrainField(STEEP)
// NOTE: vehicle section omitted (needs the platform drive; state-machine
// verified in browser run: vehicleErr 0.0e+0). Here: only the AGL attribution.
console.log(`slope-step field swapped; integrity.minAGL at entry = ${kcc.integrity.minAGL.toFixed(4)}`)

/* ---------------- vehicle section of the burn (verbatim) ------------------ */
const staticProv = {
  pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
  quat: { x: 0, y: 0, z: 0, w: 1 }, angVel: { x: 0, y: 0, z: 0 },
}
// reproduce the burn's final phase with the vehicle attach (minAGL watch)
initTerrainField(TEST_PLANET)
kcc.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
kcc.resetIntegrityStats()
for (let i = 20_000; i < 30_000; i++) {
  if (i === 20_000) {
    const p = kcc.pLocal
    const l = Math.hypot(p.x, p.y, p.z)
    kcc.teleportAbs(p.x / l * 5800, p.y / l * 5800, p.z / l * 5800,
      -40 * p.x / l, -40 * p.y / l, -40 * p.z / l)
  }
  if (i === 25_000) {
    kcc.teleportAbs(800, R + 1202, 0, 0, 0, 40)
    staticProv.pos.x = 800; staticProv.pos.y = R + 1200; staticProv.pos.z = 0
    staticProv.vel.x = 0; staticProv.vel.y = 0; staticProv.vel.z = 40
    quatFromFrameInto(0, 0, 1, 0, 1, 0, staticProv.quat)
    kcc.attachVehicle(staticProv)
  }
  if (i === 26_000) kcc.detachVehicle()
  inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0; inp.jump = false
  inp.moveF = Math.sin(0.0015 * i); inp.moveR = Math.sin(0.0009 * i + 1)
  inp.sprint = i % 3000 < 1500; inp.turnRate = 0.2 * Math.sin(0.0006 * i)
  kcc.integrateTick(1 / 60)
  if (i === 26_500 || i === 28_000) console.log(`  burn tail tick ${i}: minAGL=${kcc.integrity.minAGL.toFixed(4)}`)
}
console.log(`burn tail (WITH vehicle): minAGL=${kcc.integrity.minAGL.toFixed(4)}  (browser full-suite value: -0.206)`)

/* ---------------- DEFINITIVE: full sequence, minAGL step-log ------------- */
console.log('\n--- definitive full-sequence run ---')
initTerrainField(TEST_PLANET)
const kcc2 = new AstronautKCC(EARTHSCALE_ASTRONAUT)
const i2 = kcc2.input
// coriolis (exact)
kcc2.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
i2.moveF = 0; i2.moveR = 0; i2.sprint = false; i2.crouch = false
i2.turnRate = 0; i2.rcsF = 0; i2.rcsU = 0; i2.rcsR = 0
for (let i = 0; i < 5; i++) kcc2.integrateTick(1 / 60)
i2.jump = true
for (let i = 0; i < 240; i++) { kcc2.integrateTick(1 / 60); if (kcc2.grounded) break }
for (let i = 0; i < 32; i++) kcc2.integrateTick(1 / 60)
// state-machine (exact, incl. deorbit to the unlanded cap + platform)
const pp = kcc2.pLocal
const ll = Math.hypot(pp.x, pp.y, pp.z)
kcc2.teleportAbs(pp.x / ll * 31000, pp.y / ll * 31000, pp.z / ll * 31000, 0, 0, 0)
kcc2.integrateTick(1 / 60)
i2.rcsF = 1
for (let i = 0; i < 120; i++) kcc2.integrateTick(1 / 60)
i2.rcsF = 0
i2.turnRate = 0.5
for (let i = 0; i < 60; i++) kcc2.integrateTick(1 / 60)
i2.turnRate = 0
const PP = kcc2.absPos
const pl = Math.hypot(PP.x, PP.y, PP.z)
kcc2.teleportAbs(PP.x, PP.y, PP.z, (-30 * PP.x) / pl, (-30 * PP.y) / pl, (-30 * PP.z) / pl)
for (let i = 0; i < 20_000; i++) kcc2.integrateTick(1 / 60) // unlanded, as observed
const prov2 = {
  pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
  quat: { x: 0, y: 0, z: 0, w: 1 }, angVel: { x: 0, y: 0.05, z: 0 },
}
const W2 = 0.05, A2 = 800, ALT2 = R + 1200
const drive2 = (t) => {
  prov2.pos.x = A2 * Math.cos(W2 * t); prov2.pos.y = ALT2; prov2.pos.z = A2 * Math.sin(W2 * t)
  prov2.vel.x = -A2 * W2 * Math.sin(W2 * t); prov2.vel.y = 0; prov2.vel.z = A2 * W2 * Math.cos(W2 * t)
  const vl = Math.hypot(prov2.vel.x, prov2.vel.z)
  quatFromFrameInto(prov2.vel.x / vl, prov2.vel.y, prov2.vel.z / vl,
    prov2.pos.x / Math.hypot(A2, ALT2), prov2.pos.y / Math.hypot(A2, ALT2),
    prov2.pos.z / Math.hypot(A2, ALT2), prov2.quat)
}
drive2(0)
kcc2.teleportAbs(prov2.pos.x, prov2.pos.y + 2, prov2.pos.z, prov2.vel.x, prov2.vel.y, prov2.vel.z)
kcc2.attachVehicle(prov2)
for (let i = 1; i <= 600; i++) { drive2(i / 60); kcc2.integrateTick(1 / 60) }
drive2(10)
kcc2.detachVehicle()
// burn (exact, with vehicle section) + minAGL step log
const staticProv2 = {
  pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 },
  quat: { x: 0, y: 0, z: 0, w: 1 }, angVel: { x: 0, y: 0, z: 0 },
}
kcc2.resetIntegrityStats()
let lastMin = kcc2.integrity.minAGL
for (let i = 0; i < 30_000; i++) {
  if (i < 10_000) {
    if (i === 0) kcc2.teleportSurface(FLAT.x, FLAT.y, FLAT.z)
    i2.moveF = Math.sin(0.001 * i); i2.moveR = Math.cos(0.0013 * i)
    i2.sprint = i % 2000 < 1000; i2.turnRate = 0.3 * Math.sin(0.0007 * i)
    if (i % 2500 === 100) i2.jump = true
    i2.rcsF = 0; i2.rcsU = 0; i2.rcsR = 0
  } else if (i < 20_000) {
    if (i === 10_000) {
      const p = kcc2.pLocal
      const l = Math.hypot(p.x, p.y, p.z)
      kcc2.teleportAbs(p.x / l * 31000, p.y / l * 31000, p.z / l * 31000, 0, 0, 0)
    }
    i2.moveF = 0; i2.moveR = 0; i2.jump = false
    i2.rcsF = Math.sin(0.002 * i); i2.rcsU = Math.cos(0.0017 * i); i2.rcsR = Math.sin(0.0011 * i)
    i2.turnRate = 0.4 * Math.sin(0.0009 * i)
  } else {
    if (i === 20_000) {
      const p = kcc2.pLocal
      const l = Math.hypot(p.x, p.y, p.z)
      kcc2.teleportAbs(p.x / l * 5800, p.y / l * 5800, p.z / l * 5800,
        -40 * p.x / l, -40 * p.y / l, -40 * p.z / l)
    }
    if (i === 25_000) {
      kcc2.teleportAbs(800, R + 1202, 0, 0, 0, 40)
      staticProv2.pos.x = 800; staticProv2.pos.y = R + 1200; staticProv2.pos.z = 0
      staticProv2.vel.x = 0; staticProv2.vel.y = 0; staticProv2.vel.z = 40
      quatFromFrameInto(0, 0, 1, 0, 1, 0, staticProv2.quat)
      kcc2.attachVehicle(staticProv2)
    }
    if (i === 26_000) kcc2.detachVehicle()
    i2.rcsF = 0; i2.rcsU = 0; i2.rcsR = 0; i2.jump = false
    i2.moveF = Math.sin(0.0015 * i); i2.moveR = Math.sin(0.0009 * i + 1)
    i2.sprint = i % 3000 < 1500; i2.turnRate = 0.2 * Math.sin(0.0006 * i)
  }
  kcc2.integrateTick(1 / 60)
  if (kcc2.integrity.minAGL < lastMin - 1e-6) {
    console.log(`  minAGL drop @ burn tick ${i}: ${lastMin.toFixed(4)} -> ${kcc2.integrity.minAGL.toFixed(4)} (mode ${kcc2.telemetry.mode})`)
    lastMin = kcc2.integrity.minAGL
  }
}
console.log(`definitive burn-end minAGL = ${kcc2.integrity.minAGL.toFixed(4)} (browser: -0.206)`)

/* ---------------- slope-step (verbatim) on kcc2, minAGL log --------------- */
console.log('\n--- slope-step replication ---')
const STEEP2 = {
  name: 'M1E engineered slopes', radius: 5000, seed: 777,
  continentFreq: 1.2, continentAmp: 40,
  maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200,
  detailFreq: 8, detailAmp: 3,
}
initTerrainField(STEEP2)
const _d = { x: 0, y: 0, z: 0 }
function downhillAt(dir, out) {
  terrainNormalInto(dir.x, dir.y, dir.z, _scanN)
  _d.x = -9.81 * dir.x; _d.y = -9.81 * dir.y; _d.z = -9.81 * dir.z
  const dn = _d.x * _scanN.x + _d.y * _scanN.y + _d.z * _scanN.z
  out.x = _d.x - dn * _scanN.x; out.y = _d.y - dn * _scanN.y; out.z = _d.z - dn * _scanN.z
  const l = Math.hypot(out.x, out.y, out.z) || 1
  out.x /= l; out.y /= l; out.z /= l
}
// scans (verbatim + uniformity) on the new field
const _p8 = { x: 0, y: 0, z: 0 }
function uniformAround2(dir, nb) {
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
function scanFor2(pred, tries, rand, nb) {
  for (let i = 0; i < tries; i++) {
    const u = rand() * 2 - 1
    const th = rand() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    _scanT.x = Math.cos(th) * s; _scanT.y = u; _scanT.z = Math.sin(th) * s
    const slope = slopeDegAt(_scanT)
    if (pred(_scanT, slope) && uniformAround2(_scanT, nb)) return { ..._scanT, slopeDeg: slope }
  }
  return null
}
const srand = mulberry32(0x5109e5)
const moderate = scanFor2((_x, s) => s > 18 && s < 28, 20000, srand, (_x, s) => s < 35)
const steep = scanFor2((_x, s) => s > 52 && s < 68, 20000, srand, (_x, s) => s > 45)
const cliff = scanFor2((_x, s) => s > 70, 20000, srand, (_x, s) => s > 60)
console.log(`sites: moderate ${moderate.slopeDeg.toFixed(1)}° steep ${steep.slopeDeg.toFixed(1)}° cliff ${cliff.slopeDeg.toFixed(1)}°`)
const _b = { x: 0, y: 0, z: 0 }
let lastMin2 = kcc2.integrity.minAGL
const logDrop = (tag) => {
  if (kcc2.integrity.minAGL < lastMin2 - 1e-6) {
    console.log(`  minAGL drop ${tag}: ${lastMin2.toFixed(4)} -> ${kcc2.integrity.minAGL.toFixed(4)} grounded=${kcc2.grounded}`)
    lastMin2 = kcc2.integrity.minAGL
  }
}
// (a) moderate — verbatim
kcc2.teleportSurface(moderate.x, moderate.y, moderate.z)
downhillAt(moderate, _b)
kcc2.fwd.x = -_b.x; kcc2.fwd.y = -_b.y; kcc2.fwd.z = -_b.z
i2.moveF = 1; i2.moveR = 0; i2.sprint = false; i2.crouch = false; i2.turnRate = 0; i2.jump = false
const alt0 = Math.hypot(kcc2.pLocal.x, kcc2.pLocal.y, kcc2.pLocal.z) - 5000
let ga = true, ms = 0
for (let i = 0; i < 150; i++) {
  kcc2.integrateTick(1 / 60)
  if (!kcc2.grounded) ga = false
  if (kcc2.telemetry.slideSpeed > ms) ms = kcc2.telemetry.slideSpeed
  logDrop('(a) climb')
}
const climbGain = Math.hypot(kcc2.pLocal.x, kcc2.pLocal.y, kcc2.pLocal.z) - 5000 - alt0
i2.moveF = -1
let dg = true
for (let i = 0; i < 150; i++) { kcc2.integrateTick(1 / 60); if (!kcc2.grounded) dg = false; logDrop('(a) descent') }
console.log(`(a) climbGain=${climbGain.toFixed(2)} (expect ~${(4 * Math.sin(moderate.slopeDeg * Math.PI / 180) * 2.5).toFixed(2)}) slide=${ms.toFixed(3)} groundedUp=${ga} groundedDown=${dg}`)
// (b) steep — verbatim
kcc2.teleportSurface(steep.x, steep.y, steep.z)
i2.moveF = 0; i2.moveR = 0; i2.sprint = false; i2.turnRate = 0; i2.jump = false
let t30 = -1, vMid = 0
const sx = kcc2.pLocal.x, sy = kcc2.pLocal.y, sz = kcc2.pLocal.z
downhillAt(steep, _b)
let bGroundedBreak = null
for (let i = 0; i < 120; i++) {
  kcc2.integrateTick(1 / 60)
  if (!kcc2.grounded && bGroundedBreak === null) bGroundedBreak = i
  if (t30 < 0 && kcc2.telemetry.slideSpeed > 0.5) t30 = i
  if (i === 60) vMid = kcc2.telemetry.slideSpeed
  logDrop('(b) slide')
}
const vEnd = kcc2.telemetry.slideSpeed
const ddx = kcc2.pLocal.x - sx, ddy = kcc2.pLocal.y - sy, ddz = kcc2.pLocal.z - sz
const downDot = ddx * _b.x + ddy * _b.y + ddz * _b.z
console.log(`(b) t30=${t30} vMid=${vMid.toFixed(1)} vEnd=${vEnd.toFixed(1)} downRatio=${(downDot / (Math.hypot(ddx, ddy, ddz) || 1)).toFixed(2)} firstAirborneTick=${bGroundedBreak}`)
kcc2.teleportSurface(steep.x, steep.y, steep.z)
kcc2.fwd.x = -_b.x; kcc2.fwd.y = -_b.y; kcc2.fwd.z = -_b.z
i2.moveF = 1; i2.sprint = true
const ux0 = kcc2.pLocal.x, uy0 = kcc2.pLocal.y, uz0 = kcc2.pLocal.z
for (let i = 0; i < 90; i++) kcc2.integrateTick(1 / 60)
const uphillNet = -((kcc2.pLocal.x - ux0) * _b.x + (kcc2.pLocal.y - uy0) * _b.y + (kcc2.pLocal.z - uz0) * _b.z)
console.log(`(b) uphillNet=${uphillNet.toFixed(2)} (<0.3)`)
// (c) cliff — verbatim
kcc2.teleportSurface(cliff.x, cliff.y, cliff.z)
downhillAt(cliff, _b)
kcc2.fwd.x = -_b.x; kcc2.fwd.y = -_b.y; kcc2.fwd.z = -_b.z
i2.moveF = 1; i2.sprint = true
const cx0 = kcc2.pLocal.x, cy0 = kcc2.pLocal.y, cz0 = kcc2.pLocal.z
for (let i = 0; i < 90; i++) { kcc2.integrateTick(1 / 60); logDrop('(c) cliff sprint') }
const cliffNet = -((kcc2.pLocal.x - cx0) * _b.x + (kcc2.pLocal.y - cy0) * _b.y + (kcc2.pLocal.z - cz0) * _b.z)
console.log(`(c) cliffNet=${cliffNet.toFixed(2)} (<0.5)  integrity.minAGL=${kcc2.integrity.minAGL.toFixed(4)} (browser -0.206)`)
