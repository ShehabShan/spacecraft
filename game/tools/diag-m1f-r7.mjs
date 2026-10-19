// M1F round-7 Track A (Lead directive, re-issued): R5 spawn geometry —
// WALK-OUTCOME site search over the authorized 0.62 rad cap. Read-only Node
// analysis; NO harness edits in this file's phase. The <=40° corridor
// predicate is RETIRED (F30x falsified it); a site is acceptable iff the
// verbatim KCC walk replica walks it (>=2 lattice crossings in LIVE, locals
// <=1,024, no stall, positive net) AND straddle-ray LOS margin > 0
// (SAT_R = 26) AND Earth elevation in band (8-22 preferred, 5-25 fallback)
// AND Sun ACTIVE at both audit poses.
// Stages (state in /tmp/r7-*.json; every stage deterministic, resumable):
//   A lattice screen (>=2,400 sites over the cap) + old-stream top-up
//   B walk replicas of the ranked pool
//   C dense refinement (0.5° steps) around the best passer + the 8.20° known
//   D walk-viability calibration ladder (KCC slide bound descent)
//   E falsification: OLD spawn + base fallback + steepened site must FAIL
//   F selector feasibility + boot-cost measurement for §2(c)(i)/(ii)/(iii)
//   GATE winner vs the directive's node gate
import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)
import { readFileSync, writeFileSync } from 'node:fs'

const { initTerrainField, terrainHeight, terrainNormalInto } = await import(
  '../src/core/terrain/terrainField.ts'
)
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
const { rotateAboutAxisInto, signedAngleAbout } = await import('../src/core/physics/sphericalFrame.ts')
const { SimulationCore } = await import('../src/core/simulation/SimulationCore.ts')
const { AstronautKCC } = await import('../src/core/physics/astronautKCC.ts')

// ---- verbatim 1F harness constants (diag-m1f-core.mjs) --------------------
const MOON = {
  name: 'M1F Moon (catalog)', radius: 1364.5, seed: 20240119,
  continentFreq: 2.3, continentAmp: 95, maskFreq: 3.7,
  mountainFreq: 6.5, mountainAmp: 230, detailFreq: 22, detailAmp: 16,
}
const R = MOON.radius
const MOON_MU = 1.62 * R * R
const MAX_TERRAIN_H = 360
initTerrainField(MOON)

const core = new SimulationCore()
core.setTimeScale(0)
const ASTRO_ID = 'm1f-astronaut'
const astroState = core.registerEntity(ASTRO_ID, { absPos: { x: 0, y: 0, z: 0 }, dynamic: false })
core.setFocusEntity(ASTRO_ID)

const kcc = new AstronautKCC({
  planetRadius: R, planetMu: MOON_MU, gravityRange: 8187,
  spinOmega: 0.0005,
  maxTerrainHeight: MAX_TERRAIN_H,
  walkSpeed: 3.2, sprintSpeed: 6.5, crouchSpeed: 1.5, jumpSpeed: 4.2,
  accelTau: 0.15, stepHeight: 0.5, snapDistance: 0.4, groundClearance: 0.02,
  maxWalkSlopeDeg: 50, slideAngleDeg: 45, kineticFriction: 0.6, slideGripTau: 0.06,
  eyeHeight: 1.62, crouchEyeHeight: 0.95, upBlendWeight: 0.65, airborneUpTau: 2.0,
  autoTurnRate: 6, rcsAccel: 1.2, rcsBudgetMax: 20, rcsRegen: 0.5, sweepGap: 0.25,
})
kcc.attachWriteThrough(astroState.absPos, astroState.velocity)

const earthState = core.getCelestialState('earth')
const moonState = core.getCelestialState('moon')
if (earthState === null || moonState === null) throw new Error('rail states missing')
const earthVec = {
  x: earthState.absPos.x - moonState.absPos.x,
  y: earthState.absPos.y - moonState.absPos.y,
  z: earthState.absPos.z - moonState.absPos.z,
}
const earthDist = Math.hypot(earthVec.x, earthVec.y, earthVec.z)
const earthDir = { x: earthVec.x / earthDist, y: earthVec.y / earthDist, z: earthVec.z / earthDist }
const sunVec = { x: -moonState.absPos.x, y: -moonState.absPos.y, z: -moonState.absPos.z }
const sunDist = Math.hypot(sunVec.x, sunVec.y, sunVec.z)
const sunDir = { x: sunVec.x / sunDist, y: sunVec.y / sunDist, z: sunVec.z / sunDist }
const SUN_THETA = Math.asin(Math.min(1, 20000 / sunDist))
const SUN_CULL = -(SUN_THETA + 0.03)

// ---- shared helpers (verbatim math; corridorFor parameterized by nAz) -----
const _scanT = { x: 0, y: 0, z: 0 }
const _scanN = { x: 0, y: 0, z: 0 }
function slopeFromNormal(d) {
  terrainNormalInto(d.x, d.y, d.z, _scanN)
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}
function surfacePoint(dirX, dirY, dirZ, alt) {
  const h = terrainHeight(dirX, dirY, dirZ)
  const rr = R + h + alt
  return { x: dirX * rr, y: dirY * rr, z: dirZ * rr }
}
const SAT_R = 26

function corridorFor(dir, nAz = 24) {
  const _p = { x: 0, y: 0, z: 0 }
  let e1x = -dir.z, e1y = 0, e1z = dir.x
  const e1l = Math.hypot(e1x, e1y, e1z) || 1
  e1x /= e1l; e1y /= e1l; e1z /= e1l
  const e2x = dir.y * e1z - dir.z * e1y
  const e2y = dir.z * e1x - dir.x * e1z
  const e2z = dir.x * e1y - dir.y * e1x
  const ARCS = [25, 50, 100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600]
  let bx = 0, by = 0, bz = 0, bestScore = Infinity, bestDev = 0, bestK = -1
  for (let k = 0; k < nAz; k++) {
    const azim = (k * 2 * Math.PI) / nAz
    const c = Math.cos(azim), s = Math.sin(azim)
    const tx = e1x * c + e2x * s, ty = e1y * c + e2y * s, tz = e1z * c + e2z * s
    const ax = dir.y * tz - dir.z * ty
    const ay = dir.z * tx - dir.x * tz
    const az2 = dir.x * ty - dir.y * tx
    let maxSlope = 0, maxDev = 0
    let prevH = terrainHeight(dir.x, dir.y, dir.z)
    for (const arc of ARCS) {
      rotateAboutAxisInto(dir.x, dir.y, dir.z, ax, ay, az2, arc / R, _p)
      const h = terrainHeight(_p.x, _p.y, _p.z)
      maxDev = Math.max(maxDev, Math.abs(h - prevH)); prevH = h
      maxSlope = Math.max(maxSlope, slopeFromNormal(_p))
    }
    if (maxSlope < bestScore || (maxSlope === bestScore && maxDev < bestDev)) {
      bestScore = maxSlope; bestDev = maxDev; bx = tx; by = ty; bz = tz; bestK = k
    }
  }
  return { fwd: { x: bx, y: by, z: bz }, maxSlope: bestScore, az: bestK * (360 / nAz) }
}

// F-04: straddle-ray LOS — must use the same rendered pose as the harness (F-03).
// Shared helper lives in src/test/m1fStraddle.ts so diag and harness cannot drift.
// Screening uses theta=0,O=0 (pre-walk); clearance is evaluated in moon-fixed
// (un-rotated samples against terrainHeight).
const { straddlePoseInto: _straddlePoseInto } = await import('../src/test/m1fStraddle.ts')
const { rotateByQuatConjInto: _rotByQConj2, spinQuatInto: _spinQ2 } = await import('../src/core/physics/sphericalFrame.ts')
const _losQ2 = { x: 0, y: 0, z: 0, w: 1 }, _losTmp = { x: 0, y: 0, z: 0 }
const _poseW = { x: 0, y: 0, z: 0 }, _tgtW = { x: 0, y: 0, z: 0 }, _upW = { x: 0, y: 0, z: 0 }
const _qaW = { x: 0, y: 0, z: 0, w: 1 }, _vaW = { x: 0, y: 0, z: 0 }, _vbW = { x: 0, y: 0, z: 0 }
function losClear(dir, fwd) { return losClearAtTheta(dir, fwd, 0, { x: 0, y: 0, z: 0 }) }
function losClearAtTheta(dir, fwd, theta, origin) {
  const sp = surfacePoint(dir.x, dir.y, dir.z, 0)
  const sb = { x: sp.x + fwd.x * 2400 + dir.x * 400, y: sp.y + fwd.y * 2400 + dir.y * 400, z: sp.z + fwd.z * 2400 + dir.z * 400 }
  _straddlePoseInto(sp, sb, theta, origin, _poseW, _tgtW, _upW, _qaW, _vaW, _vbW)
  _spinQ2(theta, _losQ2)
  const segLen = Math.hypot(_tgtW.x - _poseW.x, _tgtW.y - _poseW.y, _tgtW.z - _poseW.z) || 1
  const N = Math.ceil(segLen / 10)
  let minMargin = Infinity, minF = -1
  let legacyMargin = Infinity, legacyMinF = -1
  {
    const bl0 = Math.hypot(sb.x - sp.x, sb.y - sp.y, sb.z - sp.z) || 1
    const ldx = (sb.x - sp.x) / bl0, ldy = (sb.y - sp.y) / bl0, ldz = (sb.z - sp.z) / bl0
    const lPoseX = sb.x - ldx * 2400, lPoseY = sb.y - ldy * 2400, lPoseZ = sb.z - ldz * 2400
    const lSeg = Math.hypot(sb.x - lPoseX, sb.y - lPoseY, sb.z - lPoseZ) || 1
    const lN = Math.ceil(lSeg / 10)
    for (let i = 0; i <= lN; i++) {
      const f = i / lN
      const qx = lPoseX + (sb.x - lPoseX) * f, qy = lPoseY + (sb.y - lPoseY) * f, qz = lPoseZ + (sb.z - lPoseZ) * f
      const ql = Math.hypot(qx, qy, qz)
      const clearance = ql - (R + terrainHeight(qx / ql, qy / ql, qz / ql))
      const margin = clearance - SAT_R * f
      if (margin < legacyMargin) { legacyMargin = margin; legacyMinF = f }
    }
  }
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const rx = _poseW.x + (_tgtW.x - _poseW.x) * f, ry = _poseW.y + (_tgtW.y - _poseW.y) * f, rz = _poseW.z + (_tgtW.z - _poseW.z) * f
    const ax = rx + origin.x, ay = ry + origin.y, az = rz + origin.z
    _rotByQConj2(_losQ2, ax, ay, az, _losTmp)
    const ql = Math.hypot(_losTmp.x, _losTmp.y, _losTmp.z)
    const clearance = ql - (R + terrainHeight(_losTmp.x / ql, _losTmp.y / ql, _losTmp.z / ql))
    const margin = clearance - SAT_R * f
    if (margin < minMargin) { minMargin = margin; minF = f }
    if (!(clearance > SAT_R * f)) return { ok: false, minMargin, minF, legacyMargin, legacyMinF }
  }
  return { ok: true, minMargin, minF, legacyMargin, legacyMinF }
}

function spawnBase() {
  let ax = earthDir.y * sunDir.z - earthDir.z * sunDir.y
  let ay = earthDir.z * sunDir.x - earthDir.x * sunDir.z
  let az = earthDir.x * sunDir.y - earthDir.y * sunDir.x
  const al = Math.hypot(ax, ay, az) || 1
  ax /= al; ay /= al; az /= al
  const c = Math.cos((75 * Math.PI) / 180), s = Math.sin((75 * Math.PI) / 180)
  const rx = earthDir.x * c + (ay * earthDir.z - az * earthDir.y) * s
  const ry = earthDir.y * c + (az * earthDir.x - ax * earthDir.z) * s
  const rz = earthDir.z * c + (ax * earthDir.y - ay * earthDir.x) * s
  const rl = Math.hypot(rx, ry, rz)
  return { x: rx / rl, y: ry / rl, z: rz / rl }
}
const BASE = spawnBase()

function candidateAt(rand, base, span) {
  const u = rand() * 2 - 1, th = rand() * Math.PI * 2
  const q = Math.sqrt(1 - u * u)
  const jitter = 0.02 + span * rand()
  const cx = base.x + Math.cos(th) * q * jitter
  const cy = base.y + u * jitter
  const cz = base.z + Math.sin(th) * q * jitter
  const cl = Math.hypot(cx, cy, cz)
  _scanT.x = cx / cl; _scanT.y = cy / cl; _scanT.z = cz / cl
}

const elevEarth = (dir) => Math.asin(Math.max(-1, Math.min(1,
  earthDir.x * dir.x + earthDir.y * dir.y + earthDir.z * dir.z))) * 180 / Math.PI
const angFromBase = (dir) => Math.acos(Math.max(-1, Math.min(1,
  dir.x * BASE.x + dir.y * BASE.y + dir.z * BASE.z))) * 180 / Math.PI
function sunElevAt(local) {
  const O = core.getOrigin()
  // observer absolute = moon rail + local; Sun absolute = frame origin
  const ox = moonState.absPos.x + local.x, oy = moonState.absPos.y + local.y, oz = moonState.absPos.z + local.z
  const ddx = -ox, ddy = -oy, ddz = -oz
  const d = Math.hypot(ddx, ddy, ddz)
  const ax = O.x + local.x, ay = O.y + local.y, az = O.z + local.z
  const al = Math.hypot(ax, ay, az) || 1
  return Math.asin(Math.max(-1, Math.min(1,
    (ddx / d) * (ax / al) + (ddy / d) * (ay / al) + (ddz / d) * (az / al))))
}

// ---- the walk replica (driver verbatim from diag-m1f-core.mjs) ------------
const DT = 1 / 60
function frame(ts) {
  kcc.update(DT * ts, 5)
  core.advance(DT * ts)
}
const WARM_S = 3.5
const WALL_SECONDS = 120

function walkReplica(dir, nAz = 24, label = '') {
  // F-06: reset spin phase that teleportSurface leaks across walks (tool-side)
  try { kcc._theta = 0; kcc._thetaPrev = 0; kcc.lookYawDelta = 0; } catch {}
  const corr = corridorFor(dir, nAz)
  const los = losClear(dir, corr.fwd)
  const spawnPos = surfacePoint(dir.x, dir.y, dir.z, 0)
  const SAT_B = {
    x: spawnPos.x + corr.fwd.x * 2400 + dir.x * 400,
    y: spawnPos.y + corr.fwd.y * 2400 + dir.y * 400,
    z: spawnPos.z + corr.fwd.z * 2400 + dir.z * 400,
  }
  kcc.teleportSurface(dir.x, dir.y, dir.z)
  kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false
  kcc.input.turnRate = 0.4
  for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)
  const rebases0 = core.stats.rebaseCount
  const sunWarm = sunElevAt({ x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2] })

  const _vA = { x: 0, y: 0, z: 0 }
  let simS = 0, maxLocalLive = 0, distWalked = 0, stallS = 0
  let prevAbs = { ...kcc.absPos }
  const crossings = []
  let vSum = 0, vN = 0, modeSlide = 0, modeAir = 0
  // F-08: progress-based stall (Δ net / Δt over 5 s window)
  const netHist = []
  let netAtT = 0
  let stallProgressS = 0
  let progressSum = 0, progressN = 0
  for (let f = 0; f < WALL_SECONDS / DT; f++) {
    const rebBefore = core.stats.rebaseCount
    const p = kcc.pLocal
    _vA.x = SAT_B.x - p.x; _vA.y = SAT_B.y - p.y; _vA.z = SAT_B.z - p.z
    const tl = Math.hypot(_vA.x, _vA.y, _vA.z) || 1
    const a = signedAngleAbout(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z,
      _vA.x / tl, _vA.y / tl, _vA.z / tl, kcc.up.x, kcc.up.y, kcc.up.z)
    kcc.input.moveF = 1; kcc.input.moveR = 0
    kcc.input.sprint = true; kcc.input.crouch = false
    kcc.input.turnRate = Math.max(-2, Math.min(2, a * 3))
    frame(6)
    simS += 5 * DT
    if (core.stats.rebaseCount !== rebBefore) {
      for (let n = 0; n < core.stats.rebaseCount - rebBefore; n++) crossings.push({ wallS: f * DT, simS })
    }
    const O = core.getOrigin()
    maxLocalLive = Math.max(maxLocalLive,
      Math.abs(kcc.absPos.x - O.x), Math.abs(kcc.absPos.y - O.y), Math.abs(kcc.absPos.z - O.z))
    distWalked += Math.hypot(kcc.absPos.x - prevAbs.x, kcc.absPos.y - prevAbs.y, kcc.absPos.z - prevAbs.z)
    prevAbs = { ...kcc.absPos }
    const v = Math.hypot(astroState.velocity.x, astroState.velocity.y, astroState.velocity.z)
    vSum += v; vN++
    if (v < 0.5) stallS += DT
    if (kcc.mode === 'SLIDE') modeSlide++
    if (kcc.mode === 'AIRBORNE' || kcc.mode === 'ZERO-G') modeAir++
    const curNet = Math.hypot(kcc.absPos.x - spawnPos.x, kcc.absPos.y - spawnPos.y, kcc.absPos.z - spawnPos.z)
    netHist.push({ t: f * DT, net: curNet })
    // 5 s window progress
    while (netHist.length > 1 && netHist[0].t < f * DT - 5) netHist.shift()
    if (netHist.length >= 2) {
      const progress = (curNet - netHist[0].net) / Math.max(1e-9, f * DT - netHist[0].t)
      progressSum += progress; progressN++
      if (progress < 0.5) stallProgressS += DT
    }
  }
  const sunSuite = sunElevAt({ x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2] })
  const net = Math.hypot(kcc.absPos.x - spawnPos.x, kcc.absPos.y - spawnPos.y, kcc.absPos.z - spawnPos.z)
  const t2 = crossings.length >= 2 ? crossings[1].wallS : Infinity
  const t1 = crossings.length >= 1 ? crossings[0].wallS : Infinity
  const avgProgress = progressN > 0 ? progressSum / progressN : 0
  const netOverSim = net / Math.max(simS, 1e-9)
  const rec = {
    label, dir: { x: +dir.x.toFixed(6), y: +dir.y.toFixed(6), z: +dir.z.toFixed(6) }, nAz,
    elevEarth: +elevEarth(dir).toFixed(2), angFromBase: +angFromBase(dir).toFixed(2),
    corrSlope: +corr.maxSlope.toFixed(1), corrAz: +corr.az.toFixed(1),
    losOk: los.ok, losMargin: +los.minMargin.toFixed(1), losF: +los.minF.toFixed(3),
    crossings: crossings.length, t1WallS: t1 === Infinity ? null : +t1.toFixed(1),
    t2WallS: t2 === Infinity ? null : +t2.toFixed(1),
    localsMax: +maxLocalLive.toFixed(1), dist: +distWalked.toFixed(1), net: +net.toFixed(1),
    avgV: +(vSum / vN).toFixed(2), stallS: +stallS.toFixed(1),
    avgProgress: +avgProgress.toFixed(2), stallProgressS: +stallProgressS.toFixed(1), netOverSim: +netOverSim.toFixed(2),
    modeSlideF: +(modeSlide / vN).toFixed(2),
    modeAirF: +(modeAir / vN).toFixed(2),
    sunWarmup: +((sunWarm * 180) / Math.PI).toFixed(1), sunWarmActive: sunWarm > SUN_CULL,
    sunSuite: +((sunSuite * 180) / Math.PI).toFixed(1), sunSuiteActive: sunSuite > SUN_CULL,
  }
  // stallS is WALL seconds with |v| < 0.5 (max 120); fail if over half the walk
  rec.walkOk = rec.crossings >= 2 && rec.localsMax <= 1024 && rec.net > 200 && rec.stallS < 60
  console.log(
    `WALK ${label || 'site'} ang=${rec.angFromBase}° earth=${rec.elevEarth}° corr=${rec.corrSlope}°@${rec.corrAz}° az-res=${nAz} ` +
    `LOS=${rec.losOk ? 'ok' : 'FAIL'}(${rec.losMargin}m@f${rec.losF}) crossings=${rec.crossings}` +
    `${rec.t2WallS !== null ? ` t2=${rec.t2WallS}s` : ''} locals=${rec.localsMax} dist=${rec.dist} net=${rec.net} ` +
    `avgV=${rec.avgV} avgProgress=${rec.avgProgress} net/sim=${rec.netOverSim} stall=${rec.stallS}s stallProg=${rec.stallProgressS}s slideF=${rec.modeSlideF} airF=${rec.modeAirF} ` +
    `sun(w/s)=${rec.sunWarmup}${rec.sunWarmActive ? 'A' : 'C'}/${rec.sunSuite}${rec.sunSuiteActive ? 'A' : 'C'} ` +
    `-> ${rec.walkOk ? 'WALK-PASS' : 'WALK-FAIL'}`)
  return rec
}
const walkId = (r) => `${r.dir.x},${r.dir.y},${r.dir.z},az${r.nAz}`
const STORE = process.env.R7_STORE ?? '/tmp/r7-walks.json'
function loadWalks() { try { return JSON.parse(readFileSync(STORE, 'utf-8')) } catch { return [] } }
function saveWalk(walks) { writeFileSync(STORE, JSON.stringify(walks, null, 1)) }

// ---- site generation -------------------------------------------------------
function latticeSites(rings, per, capRad) {
  const sites = []
  for (let i = 0; i <= rings; i++) {
    const polar = (i / rings) * capRad
    const cp = Math.cos(polar), sp = Math.sin(polar)
    const n = i === 0 ? 1 : per
    for (let j = 0; j < n; j++) {
      const az = (j / n) * Math.PI * 2
      // tangent frame about BASE
      const e1x = -BASE.z, e1y = 0, e1z = BASE.x
      const e1l = Math.hypot(e1x, e1y, e1z) || 1
      const u1x = e1x / e1l, u1y = e1y / e1l, u1z = e1z / e1l
      const u2x = BASE.y * u1z - BASE.z * u1y
      const u2y = BASE.z * u1x - BASE.x * u1z
      const u2z = BASE.x * u1y - BASE.y * u1x
      const tx = Math.cos(az) * u1x + Math.sin(az) * u2x
      const ty = Math.cos(az) * u1y + Math.sin(az) * u2y
      const tz = Math.cos(az) * u1z + Math.sin(az) * u2z
      const d = { x: BASE.x * cp + tx * sp, y: BASE.y * cp + ty * sp, z: BASE.z * cp + tz * sp }
      const dl = Math.hypot(d.x, d.y, d.z)
      d.x /= dl; d.y /= dl; d.z /= dl
      sites.push(d)
    }
  }
  return sites
}
function screenSite(dir, nAz = 24) {
  const elev = elevEarth(dir)
  const band = elev >= 8 && elev <= 22 ? 0 : elev >= 5 && elev <= 25 ? 1 : 2
  const c = corridorFor(dir, nAz)
  const los = losClear(dir, c.fwd)
  return { dir, elev, band, corr: c.maxSlope, az: c.az, losOk: los.ok, losMargin: los.minMargin }
}

const OLD_SPAWN = { x: 0.32059, y: -0.03683, z: 0.94650 }
const FALLBACK_BASE = BASE
const KNOWN_820 = null // filled in stage A from the lattice (closest to 8.20° from base)

const STAGE = process.argv[2] ?? 'A'
if (STAGE === 'A') {
  const t0 = performance.now()
  const sites = latticeSites(26, 92, 0.62)
  console.log(`stage A: lattice ${sites.length} sites over the 0.62 rad cap`)
  const screened = []
  for (let i = 0; i < sites.length; i++) {
    const s = screenSite(sites[i])
    s.idx = i
    screened.push(s)
    if (i % 400 === 399) console.log(`  screened ${i + 1}/${sites.length} (${((performance.now() - t0) / 1000).toFixed(0)} s)`)
  }
  // old-stream top-up: 24,000 old stream, in-band top 32 by old score
  const rand = mulberry32(0x7f1a)
  const streamTop = []
  for (let i = 0; i < 24000; i++) {
    candidateAt(rand, BASE, 0.1)
    const slope = slopeFromNormal(_scanT)
    if (slope < 0.01) continue
    const h0 = terrainHeight(_scanT.x, _scanT.y, _scanT.z)
    let dev = 0
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4
      const ex = Math.cos(a) * 0.0006, ez = Math.sin(a) * 0.0006
      const el = Math.hypot(_scanT.x + ex, _scanT.y, _scanT.z + ez)
      dev = Math.max(dev, Math.abs(
        terrainHeight((_scanT.x + ex) / el, _scanT.y / el, (_scanT.z + ez) / el) - h0))
    }
    const score = slope * 40 + dev
    const elev = elevEarth(_scanT)
    if (elev < 5 || elev > 25) continue
    streamTop.push({ i, score: +score.toFixed(2), dir: { x: +_scanT.x.toFixed(6), y: +_scanT.y.toFixed(6), z: +_scanT.z.toFixed(6) } })
  }
  streamTop.sort((a, b) => a.score - b.score || a.i - b.i)
  const streamSel = streamTop.slice(0, 32)
  console.log(`stage A: old stream in-band candidates ${streamTop.length}; top 32 by old score kept (best score ${streamSel[0]?.score})`)
  const streamScreened = []
  for (const s of streamSel) {
    const sc = screenSite(s.dir)
    sc.idx = 100000 + s.i
    streamScreened.push(sc)
  }
  const all = screened.concat(streamScreened)
  writeFileSync('/tmp/r7-screen.json', JSON.stringify({ lattice: screened, stream: streamScreened }, null, 1))
  const inBand = all.filter((s) => s.band < 2)
  const ranked = inBand
    .slice().sort((a, b) =>
      a.band - b.band || (a.losOk === b.losOk ? 0 : a.losOk ? -1 : 1) ||
      a.corr - b.corr || b.losMargin - a.losMargin || a.idx - b.idx)
  console.log(`stage A: in-band(5-25) sites ${inBand.length} (8-22: ${inBand.filter((s) => s.band === 0).length}); ` +
    `LOS-ok in-band ${inBand.filter((s) => s.losOk).length}; screen took ${((performance.now() - t0) / 1000).toFixed(0)} s`)
  console.log('stage A: top-16 ranked in-band LOS-ok sites (band, corridor°, LOS m, ang°, earth°):')
  for (const s of ranked.filter((s) => s.losOk).slice(0, 16)) {
    console.log(`  #${s.idx} band${s.band} corr=${s.corr.toFixed(1)} LOS=${s.losMargin.toFixed(1)} ang=${angFromBase(s.dir).toFixed(2)} earth=${s.elev.toFixed(2)}`)
  }
} else if (STAGE === 'B') {
  const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
  const all = lattice.concat(stream).filter((s) => s.band < 2 && s.losOk)
  all.sort((a, b) => a.band - b.band || a.corr - b.corr || b.losMargin - a.losMargin || a.idx - b.idx)
  const pool = all.slice(0, 24)
  console.log(`stage B: walking top-${pool.length} ranked in-band LOS-ok sites (24-az corridors)`)
  let walks = loadWalks()
  for (const s of pool) {
    const id = `${s.dir.x.toFixed(6)},${s.dir.y.toFixed(6)},${s.dir.z.toFixed(6)},az24`
    if (walks.some((w) => walkId(w) === id)) { console.log(`  skip (done) ${id}`); continue }
    const r = walkReplica(s.dir, 24, `#${s.idx} [corr ${s.corr.toFixed(1)}]`)
    walks.push(r); saveWalk(walks)
  }
} else if (STAGE === 'C') {
  // dense 0.5° refinement around the most promising WALKED sites (no passer
  // required: rank by crossings desc, then real path progress dist desc) —
  // walk outcome is direction-sensitive at <1° scale, so neighbours of a
  // 1-crossing site may sustain directed progress to 2.
  let walks = loadWalks()
  const ranked = walks.filter((w) => !w.label.startsWith('falsify:'))
    .sort((a, b) => b.crossings - a.crossings || b.dist - a.dist)
  const focuses = ranked.slice(0, 3)
  console.log('stage C: refinement around ' +
    focuses.map((w) => `${w.label} (x${w.crossings}, dist ${w.dist})`).join(' ; '))
  for (const f of focuses) {
    const dir = { x: f.dir.x, y: f.dir.y, z: f.dir.z }
    const e1x = -dir.z, e1y = 0, e1z = dir.x
    const e1l = Math.hypot(e1x, e1y, e1z) || 1
    const u1x = e1x / e1l, u1y = e1y / e1l, u1z = e1z / e1l
    const u2x = dir.y * u1z - dir.z * u1y
    const u2y = dir.z * u1x - dir.x * u1z
    const u2z = dir.x * u1y - dir.y * u1x
    const local = []
    for (let i = -3; i <= 3; i++) for (let j = 0; j < 24; j++) {
      const polar = Math.abs(i) * ((0.5 * Math.PI) / 180)
      const az = (j / 24) * Math.PI * 2
      const cp = Math.cos(polar), sp = Math.sin(polar)
      const tx = Math.cos(az) * u1x + Math.sin(az) * u2x
      const ty = Math.cos(az) * u1y + Math.sin(az) * u2y
      const tz = Math.cos(az) * u1z + Math.sin(az) * u2z
      const d = { x: dir.x * cp + tx * sp, y: dir.y * cp + ty * sp, z: dir.z * cp + tz * sp }
      const dl = Math.hypot(d.x, d.y, d.z)
      d.x /= dl; d.y /= dl; d.z /= dl
      local.push(d)
    }
    const scr = local.map((d) => screenSite(d)).filter((x) => x.band < 2 && x.losOk)
    scr.sort((a, b) => a.band - b.band || a.corr - b.corr)
    console.log(`  ${f.label}: ${local.length} grid -> ${scr.length} in-band LOS-ok; walking top 4 by band/corr`)
    let walked = 0
    for (const sc of scr) {
      if (walked >= 4) break
      const id = `${sc.dir.x.toFixed(6)},${sc.dir.y.toFixed(6)},${sc.dir.z.toFixed(6)},az24`
      if (walks.some((w) => walkId(w) === id)) continue
      const r = walkReplica(sc.dir, 24, `refine[${f.label.split(' ')[0]}] [corr ${sc.corr.toFixed(1)}]`)
      walks.push(r); saveWalk(walks)
      walked++
    }
  }
} else if (STAGE === 'D') {
  const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
  const all = lattice.concat(stream).filter((s) => s.band < 2)
  const RUNGS = [50, 47.5, 45, 42.5, 40, 37.5, 35]
  let walks = loadWalks()
  console.log('stage D: walk-viability calibration ladder (nearest in-band site per rung; margin = t2 <= 100 s)')
  for (const rung of RUNGS) {
    const near = all.slice().sort((a, b) =>
      Math.abs(a.corr - rung) - Math.abs(b.corr - rung) || a.idx - b.idx)[0]
    if (!near || Math.abs(near.corr - rung) > 1.6) { console.log(`  rung ${rung}°: no in-band site within 1.6° (closest ${near ? near.corr.toFixed(1) : 'n/a'}) — skipped`); continue }
    const id = `${near.dir.x.toFixed(6)},${near.dir.y.toFixed(6)},${near.dir.z.toFixed(6)},az24`
    if (walks.some((w) => walkId(w) === id)) { console.log(`  rung ${rung}°: already walked`); continue }
    const r = walkReplica(near.dir, 24, `ladder@${rung}`)
    walks.push(r); saveWalk(walks)
  }
} else if (STAGE === 'E') {
  let walks = loadWalks()
  const cases = [
    { label: 'falsify:OLD-SPAWN', dir: OLD_SPAWN },
    { label: 'falsify:BASE-FALLBACK', dir: FALLBACK_BASE },
  ]
  for (const c of cases) {
    const id = `${c.dir.x.toFixed(6)},${c.dir.y.toFixed(6)},${c.dir.z.toFixed(6)},az24`
    if (walks.some((w) => walkId(w) === id)) { console.log(`  ${c.label}: already walked`); continue }
    const r = walkReplica(c.dir, 24, c.label)
    walks.push(r); saveWalk(walks)
  }
  console.log('stage E: steepened case runs in stage F after the bound is known')
} else if (STAGE === 'F') {
  let walks = loadWalks()
  // validated bound from the ladder: largest rung with a WALK-PASS at t2 <= 100
  const rungPass = {}
  for (const w of walks) if (w.label.startsWith('ladder@')) {
    const rung = parseFloat(w.label.slice(7))
    rungPass[rung] = w.walkOk && w.t2WallS !== null && w.t2WallS <= 100
  }
  console.log('stage F: ladder results:', JSON.stringify(rungPass))
  const passingRungs = Object.entries(rungPass).filter(([, ok]) => ok).map(([r]) => parseFloat(r)).sort((a, b) => b - a)
  const B = passingRungs.length > 0 ? passingRungs[0] : null
  console.log(`stage F: largest passing rung B = ${B === null ? 'NONE' : B + '°'}`)
  if (B !== null) {
    // steepened falsifier: nearest in-band site with corr >= B + 2.5
    const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
    const all = lattice.concat(stream).filter((s) => s.band < 2 && s.corr >= B + 2.5)
      .sort((a, b) => a.corr - b.corr || a.idx - b.idx)
    if (all.length > 0) {
      const s = all[0]
      const id = `${s.dir.x.toFixed(6)},${s.dir.y.toFixed(6)},${s.dir.z.toFixed(6)},az24`
      if (!walks.some((w) => walkId(w) === id)) {
        const r = walkReplica(s.dir, 24, `falsify:steepened@${s.corr.toFixed(1)} (bound ${B}+2.5)`)
        walks.push(r); saveWalk(walks)
      }
    } else console.log('stage F: no in-band site above bound+2.5 (all flatter) — steepened case vacuous')
  }
  // selector boot-cost measurement: screen-guided findSpawn on the WIDE stream
  const streamCost = (span, bound) => {
    const rand = mulberry32(0x7f1a)
    const t = performance.now()
    let best = null, bestScore = Infinity, checks = 0
    for (let i = 0; i < 24000; i++) {
      candidateAt(rand, BASE, span)
      const slope = slopeFromNormal(_scanT)
      if (slope < 0.01) continue
      const h0 = terrainHeight(_scanT.x, _scanT.y, _scanT.z)
      let dev = 0
      for (let k = 0; k < 4; k++) {
        const a = k * 1.57 + 0.4
        const ex = Math.cos(a) * 0.0006, ez = Math.sin(a) * 0.0006
        const el = Math.hypot(_scanT.x + ex, _scanT.y, _scanT.z + ez)
        dev = Math.max(dev, Math.abs(
          terrainHeight((_scanT.x + ex) / el, _scanT.y / el, (_scanT.z + ez) / el) - h0))
      }
      const score = slope * 40 + dev
      if (score < bestScore) {
        checks++
        const elev = elevEarth(_scanT)
        if (elev >= 5 && elev <= 25) {
          const c = corridorFor(_scanT, 24)
          if (c.maxSlope <= bound && losClear(_scanT, c.fwd).ok) {
            bestScore = score
            best = { x: _scanT.x, y: _scanT.y, z: _scanT.z }
            break
          }
        }
      }
    }
    return { ms: +(performance.now() - t).toFixed(0), checks, found: best !== null,
      dir: best, score: bestScore === Infinity ? null : +bestScore.toFixed(2) }
  }
  if (B !== null) {
    for (const span of [0.28, 0.45, 0.58]) {
      const r = streamCost(span, B)
      console.log(`stage F: selector cost span=${span} bound=${B}° -> ${r.found ? 'FOUND' : 'none'} idx-checks=${r.checks} ms=${r.ms}` +
        (r.dir ? ` dir=(${r.dir.x.toFixed(5)},${r.dir.y.toFixed(5)},${r.dir.z.toFixed(5)}) score=${r.score}` : ''))
    }
  }


} else if (STAGE === 'W') {
  // ONE walk in a FRESH process (instrument fidelity: the core diag only ever
  // walked once per process; back-to-back teleports in one process carry
  // entity state across walks — stage B's pool numbers were contaminated).
  // arg: 'base' | 'old' | <lattice idx>
  const arg = process.argv[3] ?? 'base'
  let dir
  if (arg === 'base') dir = BASE
  else if (arg === 'old') dir = OLD_SPAWN
  else {
    const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
    const site = lattice.concat(stream).find((x) => x.idx === Number(arg))
    if (site === undefined) throw new Error('site not found: ' + arg)
    dir = site.dir
  }
  let walks = loadWalks()
  const id = `${dir.x.toFixed(6)},${dir.y.toFixed(6)},${dir.z.toFixed(6)},az24`
  const r = walkReplica(dir, 24, `fresh:${arg}`)
  walks = walks.filter((w) => walkId(w) !== id)
  walks.push(r); saveWalk(walks)

} else if (STAGE === 'X') {
  // extended-wall walk of one site (R7_WALL env, default 360 s) — evidence
  // for the LIVE_SECONDS option: when does the 2nd/3rd crossing land?
  const arg = process.argv[3]
  const wall = Number(process.env.R7_WALL ?? 360)
  const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
  const site = lattice.concat(stream).find((x) => x.idx === Number(arg))
  const dir = site !== undefined ? site.dir : BASE
  const corr = corridorFor(dir, 24)
  const spawnPos = surfacePoint(dir.x, dir.y, dir.z, 0)
  const SAT_B = { x: spawnPos.x + corr.fwd.x * 2400 + dir.x * 400,
    y: spawnPos.y + corr.fwd.y * 2400 + dir.y * 400, z: spawnPos.z + corr.fwd.z * 2400 + dir.z * 400 }
  kcc.teleportSurface(dir.x, dir.y, dir.z)
  kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false; kcc.input.turnRate = 0.4
  for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)
  const rebases0 = core.stats.rebaseCount
  const _vA = { x: 0, y: 0, z: 0 }
  const times = []
  let simS = 0
  for (let f = 0; f < wall / DT; f++) {
    const rebBefore = core.stats.rebaseCount
    const p = kcc.pLocal
    _vA.x = SAT_B.x - p.x; _vA.y = SAT_B.y - p.y; _vA.z = SAT_B.z - p.z
    const tl = Math.hypot(_vA.x, _vA.y, _vA.z) || 1
    const a = signedAngleAbout(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z,
      _vA.x / tl, _vA.y / tl, _vA.z / tl, kcc.up.x, kcc.up.y, kcc.up.z)
    kcc.input.moveF = 1; kcc.input.moveR = 0; kcc.input.sprint = true; kcc.input.crouch = false
    kcc.input.turnRate = Math.max(-2, Math.min(2, a * 3))
    frame(6)
    simS += 5 * DT
    if (core.stats.rebaseCount !== rebBefore) {
      for (let n = 0; n < core.stats.rebaseCount - rebBefore; n++) times.push(+((f + 1) * DT).toFixed(1))
    }
  }
  const net = Math.hypot(kcc.absPos.x - spawnPos.x, kcc.absPos.y - spawnPos.y, kcc.absPos.z - spawnPos.z)
  console.log(`EXT #${arg ?? 'base'} wall=${wall}s crossings=${times.length} at [${times.join(', ')}] s — ` +
    `needs >=2 within 120 s: ${times.filter((t) => t <= 120).length >= 2 ? 'yes' : 'NO'}`)
} else if (STAGE === 'T') {
  // traced replica of a given site id (from /tmp/r7-screen.json) — per-10 s
  // O / |abs-O| / rebaseCount / mode / v / progress-along-fwd diagnostics
  const want = Number(process.argv[3] ?? 582)
  const { lattice, stream } = JSON.parse(readFileSync('/tmp/r7-screen.json', 'utf-8'))
  const site = lattice.concat(stream).find((x) => x.idx === want)
  if (site === undefined) throw new Error('site not found: ' + want)
  const dir = site.dir
  const corr = corridorFor(dir, 24)
  const spawnPos = surfacePoint(dir.x, dir.y, dir.z, 0)
  const SAT_B = { x: spawnPos.x + corr.fwd.x * 2400 + dir.x * 400,
    y: spawnPos.y + corr.fwd.y * 2400 + dir.y * 400, z: spawnPos.z + corr.fwd.z * 2400 + dir.z * 400 }
  kcc.teleportSurface(dir.x, dir.y, dir.z)
  kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false; kcc.input.turnRate = 0.4
  for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)
  const rebases0 = core.stats.rebaseCount
  const O0 = core.getOrigin()
  console.log(`trace site #${want}: post-warmup O=(${O0.x},${O0.y},${O0.z}) rebases0=${rebases0} ` +
    `spawn-O delta=${Math.hypot(spawnPos.x - O0.x, spawnPos.y - O0.y, spawnPos.z - O0.z).toFixed(1)} m`)
  const _vA = { x: 0, y: 0, z: 0 }
  let simS = 0
  for (let f = 0; f < WALL_SECONDS / DT; f++) {
    const p = kcc.pLocal
    _vA.x = SAT_B.x - p.x; _vA.y = SAT_B.y - p.y; _vA.z = SAT_B.z - p.z
    const tl = Math.hypot(_vA.x, _vA.y, _vA.z) || 1
    const a = signedAngleAbout(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z,
      _vA.x / tl, _vA.y / tl, _vA.z / tl, kcc.up.x, kcc.up.y, kcc.up.z)
    kcc.input.moveF = 1; kcc.input.moveR = 0; kcc.input.sprint = true; kcc.input.crouch = false
    kcc.input.turnRate = Math.max(-2, Math.min(2, a * 3))
    frame(6)
    simS += 5 * DT
    if (f % 600 === 0) {
      const O = core.getOrigin()
      const v = Math.hypot(astroState.velocity.x, astroState.velocity.y, astroState.velocity.z)
      const net = Math.hypot(kcc.absPos.x - spawnPos.x, kcc.absPos.y - spawnPos.y, kcc.absPos.z - spawnPos.z)
      console.log(`  t=${String(Math.round(simS)).padStart(4)}s O=(${O.x},${O.y},${O.z}) rebases=${core.stats.rebaseCount - rebases0} ` +
        `|abs-O|=(${Math.abs(kcc.absPos.x - O.x).toFixed(0)},${Math.abs(kcc.absPos.y - O.y).toFixed(0)},${Math.abs(kcc.absPos.z - O.z).toFixed(0)}) ` +
        `netFromSpawn=${net.toFixed(0)} mode=${kcc.mode} v=${v.toFixed(2)} distToSATB=${tl.toFixed(0)}`)
    }
  }
} else if (STAGE === 'GATE') {
  const { readdirSync, statSync } = await import('node:fs')
  const files = readdirSync('/tmp').filter((f) => /^r7-walks.*\.json$/.test(f))
  // F-05: keep freshest (fresh: label wins, then newest mtime), reject net>dist+1
  const byId = new Map()
  let rejected = 0, replaced = 0, kept = 0
  for (const f of files) {
    let mtime = 0; try { mtime = statSync('/tmp/' + f).mtimeMs } catch {}
    for (const w of JSON.parse(readFileSync('/tmp/' + f, 'utf-8'))) {
      if (w.net > w.dist + 1) { rejected++; continue }
      const id = walkId(w)
      const isFresh = String(w.label ?? '').startsWith('fresh:')
      const prev = byId.get(id)
      if (prev === undefined) { byId.set(id, { w, isFresh, mtime }); kept++ }
      else {
        const prevFresh = prev.isFresh
        if ((isFresh && !prevFresh) || (isFresh === prevFresh && mtime >= prev.mtime)) {
          byId.set(id, { w, isFresh, mtime }); replaced++
        }
      }
    }
  }
  const walks = [...byId.values()].map((e) => e.w)
  console.log(`GATE: merged ${files.length} store file(s), ${walks.length} unique walks (kept=${kept} replaced=${replaced} rejected=${rejected})`)
  const passers = walks.filter((w) => w.walkOk)
  const bandOf = (w) => (w.elevEarth >= 8 && w.elevEarth <= 22 ? 0 : 1)
  passers.sort((a, b) => bandOf(a) - bandOf(b) || (a.t2WallS ?? 999) - (b.t2WallS ?? 999) || a.corrSlope - b.corrSlope || b.losMargin - a.losMargin)
  console.log(`GATE: ${passers.length} WALK-PASS candidates of ${walks.length} walked`)
  for (const w of passers.slice(0, 8)) console.log(`  ${w.label} earth=${w.elevEarth} corr=${w.corrSlope} LOS=${w.losMargin} t2=${w.t2WallS} net=${w.net} crossings=${w.crossings}`)
  const winner = passers[0] ?? null
  if (winner === null) { console.log('GATE: NO WINNER — STOP per the directive'); process.exit(0) }
  const falsify = walks.filter((w) => w.label.startsWith('falsify:'))
  const falsified = falsify.filter((w) => !w.walkOk).length
  const checks = [
    ['crossings >= 2 in LIVE', winner.crossings >= 2],
    ['locals <= 1,024', winner.localsMax <= 1024],
    [`LOS margin > 0 (${winner.losMargin} m${winner.losMargin < 5 ? ' — FLAG < 5 m' : ''})`, winner.losOk && winner.losMargin > 0],
    ['Sun ACTIVE post-warmup', winner.sunWarmActive],
    ['Sun ACTIVE at suite pose', winner.sunSuiteActive],
    [`Earth elevation in band (${winner.elevEarth}°)`, winner.elevEarth >= 5 && winner.elevEarth <= 25],
    [`falsification cases fail as required (${falsified}/${falsify.length})`, falsified === falsify.length],
  ]
  for (const [label, ok] of checks) console.log(`  GATE ${ok ? 'PASS' : 'FAIL'}: ${label}`)
  console.log(`GATE RESULT: ${checks.every(([, ok]) => ok) ? 'PROCEED (selector + boot cost from stage F)' : 'STOP — report'}`)
}
