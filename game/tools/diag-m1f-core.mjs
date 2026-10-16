import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// M1F F30 node-first gate (ruling round 4): mirror corridorFor/spawnEligible/
// findSpawn VERBATIM (as they will land in the harness) and report every
// number the proceed gate needs BEFORE the harness is edited:
//   candidates evaluated / pass(1) / pass(1)+(2) · chosen index + score ·
//   angular distance new vs old spawn · Earth elevation new vs old ·
//   Sun elevation post-warmup + suite pose · corridor az + max slope ·
//   min LOS margin + where · 600 s KCC sim (crossings/locals/path/net) ·
//   findSpawn boot cost.
const { initTerrainField, terrainHeight, terrainNormalInto } = await import(
  '../src/core/terrain/terrainField.ts'
)
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
const { rotateAboutAxisInto, signedAngleAbout } = await import('../src/core/physics/sphericalFrame.ts')
const { SimulationCore } = await import('../src/core/simulation/SimulationCore.ts')
const { AstronautKCC } = await import('../src/core/physics/astronautKCC.ts')

// ---- verbatim 1F harness constants ------------------------------------
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

// ---- rail geometry (t = 0, timeScale 0) --------------------------------
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
console.log(`rails: earthDist=${(earthDist / 1000).toFixed(1)} km  sunDist=${(sunDist / 1000).toFixed(1)} km`)

// ---- shared scan scratch + helpers (harness-identical) ------------------
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

// ---- F30 (a): corridorFor — mirrors the harness edit verbatim ------------
function corridorFor(dir) {
  const _p = { x: 0, y: 0, z: 0 }
  let e1x = -dir.z, e1y = 0, e1z = dir.x   // ⊥ dir
  const e1l = Math.hypot(e1x, e1y, e1z) || 1
  e1x /= e1l; e1y /= e1l; e1z /= e1l
  const e2x = dir.y * e1z - dir.z * e1y
  const e2y = dir.z * e1x - dir.x * e1z
  const e2z = dir.x * e1y - dir.y * e1x
  const ARCS = [25, 50, 100, 200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600]
  let bx = 0, by = 0, bz = 0, bestScore = Infinity, bestDev = 0, bestK = -1
  for (let k = 0; k < 24; k++) {
    const azim = (k * 15 * Math.PI) / 180
    const c = Math.cos(azim), s = Math.sin(azim)
    const tx = e1x * c + e2x * s, ty = e1y * c + e2y * s, tz = e1z * c + e2z * s
    // rotation axis dir × t moves the surface point along +t
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
  return { fwd: { x: bx, y: by, z: bz }, maxSlope: bestScore, az: bestK * 15 }
}

// ---- F30 (b): LOS instrumentation (diag-only; spawnEligible inlines this) -
function losClear(dir, fwd) {
  const sp = surfacePoint(dir.x, dir.y, dir.z, 0)
  const sb = {
    x: sp.x + fwd.x * 2400 + dir.x * 400,
    y: sp.y + fwd.y * 2400 + dir.y * 400,
    z: sp.z + fwd.z * 2400 + dir.z * 400,
  }
  const bl = Math.hypot(sb.x - sp.x, sb.y - sp.y, sb.z - sp.z) || 1
  const dx = (sb.x - sp.x) / bl, dy = (sb.y - sp.y) / bl, dz = (sb.z - sp.z) / bl
  const poseX = sb.x - dx * 2400, poseY = sb.y - dy * 2400, poseZ = sb.z - dz * 2400
  const segLen = Math.hypot(sb.x - poseX, sb.y - poseY, sb.z - poseZ) || 1
  const N = Math.ceil(segLen / 10)
  let minMargin = Infinity, minF = -1
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const qx = poseX + (sb.x - poseX) * f
    const qy = poseY + (sb.y - poseY) * f
    const qz = poseZ + (sb.z - poseZ) * f
    const ql = Math.hypot(qx, qy, qz)
    const clearance = ql - (R + terrainHeight(qx / ql, qy / ql, qz / ql))
    const margin = clearance - SAT_R * f
    if (margin < minMargin) { minMargin = margin; minF = f }
    if (!(clearance > SAT_R * f)) return { ok: false, minMargin, minF }
  }
  return { ok: true, minMargin, minF }
}

// ---- F30 (b): spawnEligible — mirrors the harness edit verbatim ----------
function spawnEligible(dir) {
  const c = corridorFor(dir)
  if (!(c.maxSlope <= 40)) return false
  const sp = surfacePoint(dir.x, dir.y, dir.z, 0)
  const sb = {
    x: sp.x + c.fwd.x * 2400 + dir.x * 400,
    y: sp.y + c.fwd.y * 2400 + dir.y * 400,
    z: sp.z + c.fwd.z * 2400 + dir.z * 400,
  }
  const bl = Math.hypot(sb.x - sp.x, sb.y - sp.y, sb.z - sp.z) || 1
  const dx = (sb.x - sp.x) / bl, dy = (sb.y - sp.y) / bl, dz = (sb.z - sp.z) / bl
  const poseX = sb.x - dx * 2400, poseY = sb.y - dy * 2400, poseZ = sb.z - dz * 2400
  const segLen = Math.hypot(sb.x - poseX, sb.y - poseY, sb.z - poseZ) || 1
  const N = Math.ceil(segLen / 10)
  for (let i = 0; i <= N; i++) {
    const f = i / N
    const qx = poseX + (sb.x - poseX) * f
    const qy = poseY + (sb.y - poseY) * f
    const qz = poseZ + (sb.z - poseZ) * f
    const ql = Math.hypot(qx, qy, qz)
    const clearance = ql - (R + terrainHeight(qx / ql, qy / ql, qz / ql))
    if (!(clearance > SAT_R * f)) return false
  }
  return true
}

// ---- the 75° base rotation (unchanged) -----------------------------------
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

// candidate generator shared by all three passes (identical stream)
function candidateAt(rand, base) {
  const u = rand() * 2 - 1, th = rand() * Math.PI * 2
  const q = Math.sqrt(1 - u * u)
  const jitter = 0.02 + 0.1 * rand()
  const cx = base.x + Math.cos(th) * q * jitter
  const cy = base.y + u * jitter
  const cz = base.z + Math.sin(th) * q * jitter
  const cl = Math.hypot(cx, cy, cz)
  _scanT.x = cx / cl; _scanT.y = cy / cl; _scanT.z = cz / cl
}

// ---- OLD acceptance (production at bbeb4f4) — for comparison only --------
function findSpawnOld() {
  const base = spawnBase()
  const rand = mulberry32(0x7f1a)
  let best = base, bestScore = Infinity
  for (let i = 0; i < 24000; i++) {
    candidateAt(rand, base)
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
    if (score < bestScore) { bestScore = score; best = { x: _scanT.x, y: _scanT.y, z: _scanT.z } }
    if (score < 0.35) break
  }
  return best
}

// ---- F30 (c) findSpawn — mirrors the harness edit verbatim (timed clean) --
function findSpawn() {
  const base = spawnBase()
  const rand = mulberry32(0x7f1a)
  let best = base, bestScore = Infinity
  for (let i = 0; i < 24000; i++) {
    candidateAt(rand, base)
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
      if (spawnEligible(_scanT)) {
        bestScore = score
        best = { x: _scanT.x, y: _scanT.y, z: _scanT.z }
        if (score < 0.35) break
      }
    }
  }
  return best
}

// ---- run the three passes + the round-4 report ----------------------------
const oldSpawn = findSpawnOld()
const t0 = performance.now()
const newSpawn = findSpawn()
const findSpawnMs = performance.now() - t0

// counted pass (same acceptance; split counters for pass(1)/pass(1)+(2))
{
  const base = spawnBase()
  const rand = mulberry32(0x7f1a)
  var evaluated = 0, checked = 0, passCorr = 0, passBoth = 0, chosenIdx = -1, chosenScore = NaN
  let bestScore = Infinity
  for (let i = 0; i < 24000; i++) {
    evaluated++
    candidateAt(rand, base)
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
      checked++
      if (spawnEligible(_scanT)) {
        passBoth++
        bestScore = score; chosenIdx = i; chosenScore = score
        if (score < 0.35) break
      } else {
        const c = corridorFor(_scanT)   // counter support only
        if (c.maxSlope <= 40) passCorr++
      }
    }
  }
  console.log(`F30 spawn search: evaluated=${evaluated} eligibilityChecked(lazy, score<best)=${checked} ` +
    `pass(1) total=${passCorr + passBoth} (corridor-only=${passCorr} + eligible=${passBoth}) — pass(1)+(2)=${passBoth}`)
  console.log(`  chosen: index=${chosenIdx} score=${chosenScore}`)
}
const angOld = Math.acos(Math.max(-1, Math.min(1,
  oldSpawn.x * newSpawn.x + oldSpawn.y * newSpawn.y + oldSpawn.z * newSpawn.z))) * 180 / Math.PI
const elevOf = (dir, ref) => Math.asin(Math.max(-1, Math.min(1,
  dir.x * ref.x + dir.y * ref.y + dir.z * ref.z))) * 180 / Math.PI
const newCorr = corridorFor(newSpawn)
const newLos = losClear(newSpawn, newCorr.fwd)
console.log(`F30 spawns: old=(${oldSpawn.x.toFixed(5)},${oldSpawn.y.toFixed(5)},${oldSpawn.z.toFixed(5)}) ` +
  `new=(${newSpawn.x.toFixed(5)},${newSpawn.y.toFixed(5)},${newSpawn.z.toFixed(5)}) angularDistance=${angOld.toFixed(3)}°`)
console.log(`  Earth elevation: old=${elevOf(earthDir, oldSpawn).toFixed(2)}° new=${elevOf(earthDir, newSpawn).toFixed(2)}° (canon intent ≈15°)`)
console.log(`  new corridor: azimuth=${newCorr.az}° maxSlope=${newCorr.maxSlope.toFixed(1)}° (gate ≤ 40°)`)
console.log(`  new LOS pose→SAT_B: clear=${newLos.ok} minMargin=${newLos.minMargin.toFixed(1)} m at f=${newLos.minF.toFixed(3)}`)
console.log(`  findSpawn boot cost: ${findSpawnMs.toFixed(0)} ms (gate ≤ 2,000 ms)`)
console.log(`  new spawn: slope=${slopeFromNormal(newSpawn).toFixed(3)}° h=${terrainHeight(newSpawn.x, newSpawn.y, newSpawn.z).toFixed(2)} m`)
kcc.teleportSurface(newSpawn.x, newSpawn.y, newSpawn.z)

const walkFwd = newCorr.fwd
const spawnPos = surfacePoint(newSpawn.x, newSpawn.y, newSpawn.z, 0)
const SAT_B = {
  x: spawnPos.x + walkFwd.x * 2400 + newSpawn.x * 400,
  y: spawnPos.y + walkFwd.y * 2400 + newSpawn.y * 400,
  z: spawnPos.z + walkFwd.z * 2400 + newSpawn.z * 400,
}

// ---- horizon cull of the 9 catalog bodies (harness convention) ------------
const CAT = [
  ['sun', 20000], ['mercury', 3105.7], ['venus', 4870.3], ['mars', 2649.3],
  ['jupiter', 16640.2], ['saturn', 15120.4], ['uranus', 9980.5], ['neptune', 9835.4], ['pluto', 2160.8],
]
function elevationOf(dir, up) {
  const d = dir.x * up.x + dir.y * up.y + dir.z * up.z
  return Math.asin(d >= 1 ? 1 : d <= -1 ? -1 : d)
}
function auditCull(label, obsLocal) {
  const O = core.getOrigin()
  const ax = O.x + obsLocal.x, ay = O.y + obsLocal.y, az = O.z + obsLocal.z
  const al = Math.hypot(ax, ay, az) || 1
  const up = { x: ax / al, y: ay / al, z: az / al }
  console.log(`${label}: local=(${obsLocal.x.toFixed(1)},${obsLocal.y.toFixed(1)},${obsLocal.z.toFixed(1)}) |local|=${Math.hypot(obsLocal.x, obsLocal.y, obsLocal.z).toFixed(1)} ` +
    `O=(${O.x},${O.y},${O.z})`)
  const ox = moonState.absPos.x + obsLocal.x, oy = moonState.absPos.y + obsLocal.y, oz = moonState.absPos.z + obsLocal.z
  let nActive = 0, sunElev = NaN
  for (const [id, rad] of CAT) {
    const st = core.getCelestialState(id)
    if (st === null) continue
    const dx = st.absPos.x - ox, dy = st.absPos.y - oy, dz = st.absPos.z - oz
    const d = Math.hypot(dx, dy, dz)
    const dir = { x: dx / d, y: dy / d, z: dz / d }
    const theta = Math.asin(Math.min(1, rad / d))
    const el = elevationOf(dir, up)
    const culled = el < -(theta + 0.03)
    if (!culled) nActive++
    if (id === 'sun') {
      sunElev = el
      const pxPerRad = 720 / (2 * Math.tan((31 * Math.PI) / 180))
      const rpx = theta * pxPerRad
      console.log(`  SUN: elev=${((el * 180) / Math.PI).toFixed(1)} deg theta=${((theta * 180) / Math.PI).toFixed(2)} -> ${culled ? 'CULLED' : 'ACTIVE'}; ideal footprint ~pi*r^2 = ${(Math.PI * rpx * rpx).toFixed(0)} px (r=${rpx.toFixed(1)} px)`)
    } else console.log(`  ${id.padEnd(8)} elev=${((el * 180) / Math.PI).toFixed(1).padStart(7)} deg ${culled ? 'CULLED' : 'active'}`)
  }
  console.log(`  -> ${nActive} of 9 catalog bodies ACTIVE`)
  return sunElev
}

// ---- WARMUP (ts=1) then LIVE (ts=6, 5 substeps) — verbatim input model ---
const DT = 1 / 60
function frame(ts) {
  kcc.update(DT * ts, 5)
  core.advance(DT * ts)
}
const WARM_S = 3.5
kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false
kcc.input.turnRate = 0.4
for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)
const rebases0 = core.stats.rebaseCount
console.log(`WARMUP done (${WARM_S}s): rebases0=${rebases0} maxLocalPostTick=${core.stats.focusMaxLocalPostTick.toFixed(1)}`)
const sunElevWarmup = auditCull('post-WARMUP audit', {
  x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2],
})

const WALL_SECONDS = Number(process.env.WALL_SECONDS ?? 120)
const _vA = { x: 0, y: 0, z: 0 }
let simS = 0
let maxLocalLive = 0
let distWalked = 0
let prevAbs = { ...kcc.absPos }
const trace = []
const crossings = []
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
    for (let n = 0; n < core.stats.rebaseCount - rebBefore; n++) {
      crossings.push({ wallS: f * DT, simS })
    }
  }
  const O = core.getOrigin()
  maxLocalLive = Math.max(maxLocalLive,
    Math.abs(kcc.absPos.x - O.x), Math.abs(kcc.absPos.y - O.y), Math.abs(kcc.absPos.z - O.z))
  distWalked += Math.hypot(kcc.absPos.x - prevAbs.x, kcc.absPos.y - prevAbs.y, kcc.absPos.z - prevAbs.z)
  prevAbs = { ...kcc.absPos }
  if (f % 600 === 0) {
    const fl = Math.hypot(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z) || 1
    const ax = kcc.absPos.x + kcc.fwd.x / fl * 3, ay = kcc.absPos.y + kcc.fwd.y / fl * 3, az = kcc.absPos.z + kcc.fwd.z / fl * 3
    const al2 = Math.hypot(ax, ay, az)
    const slopeAhead = slopeFromNormal({ x: ax / al2, y: ay / al2, z: az / al2 })
    trace.push(`t=${simS.toFixed(0).padStart(4)}s rebases=${core.stats.rebaseCount - rebases0} ` +
      `maxBubbleComp=${maxLocalLive.toFixed(0).padStart(4)}m walked=${distWalked.toFixed(1).padStart(7)}m ` +
      `mode=${kcc.mode} v=${Math.hypot(...Object.values(astroState.velocity)).toFixed(2)} ` +
      `slopeAhead=${slopeAhead.toFixed(1)}deg`)
  }
}
console.log(`LIVE trace (${WALL_SECONDS}s wall, every 10 s):`)
for (const t of trace) console.log('  ' + t)
console.log(`LIVE result: rebasesDuringLive=${core.stats.rebaseCount - rebases0} ` +
  `maxBubbleLocalComp=${maxLocalLive.toFixed(1)} totalWalked=${distWalked.toFixed(1)} m ` +
  `netFromSpawn=${Math.hypot(kcc.absPos.x - spawnPos.x, kcc.absPos.y - spawnPos.y, kcc.absPos.z - spawnPos.z).toFixed(1)} m`)

{
  const fmt = crossings.map((c) => `(wall ${c.wallS.toFixed(1)}s / sim ${c.simS.toFixed(0)}s)`)
  console.log(`crossings (${crossings.length} total): ${fmt.length > 0 ? fmt.join(', ') : 'NONE'}`)
  console.log(`  within first 120 SIM s: ${crossings.filter((c) => c.simS <= 120).length}` +
    ` · within LIVE_SECONDS (120 wall s = 600 sim s): ${crossings.filter((c) => c.wallS <= 120).length}`)
  const sunElevSuite = auditCull('post-LIVE audit (R2 suite-time pose)', {
    x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2],
  })
  // round-4 proceed gate
  const inLive = crossings.filter((c) => c.wallS <= 120).length
  const checks = [
    [`eligible candidate exists`, passBoth >= 1],
    [`>= 2 crossings within LIVE_SECONDS`, inLive >= 2],
    [`locals <= 1,024`, maxLocalLive <= 1024],
    [`Sun ACTIVE post-warmup`, sunElevWarmup > -(20000 / sunDist + 0.03)],
    [`Sun ACTIVE at suite pose`, sunElevSuite > -(20000 / sunDist + 0.03)],
    [`findSpawn cost <= 2,000 ms`, findSpawnMs <= 2000],
  ]
  for (const [label, ok] of checks) console.log(`  GATE ${ok ? 'PASS' : 'FAIL'}: ${label}`)
  console.log(`F30 PROCEED: ${checks.every(([, ok]) => ok) ? 'YES — proceed with the harness edit' : 'NO — STOP and route F30x'}`)
}

// ---- terrain profile along the new walkFwd --------------------------------
console.log('terrain profile along walkFwd (surface slope at distance d):')
{
  const axx = newSpawn.y * walkFwd.z - newSpawn.z * walkFwd.y
  const axy = newSpawn.z * walkFwd.x - newSpawn.x * walkFwd.z
  const axz = newSpawn.x * walkFwd.y - newSpawn.y * walkFwd.x
  const al = Math.hypot(axx, axy, axz) || 1
  const ux = axx / al, uy = axy / al, uz = axz / al
  for (let d = 0; d <= 2600; d += 200) {
    const th = d / R, c = Math.cos(th), s = Math.sin(th)
    const cx = newSpawn.x * c + (uy * newSpawn.z - uz * newSpawn.y) * s
    const cy = newSpawn.y * c + (uz * newSpawn.x - ux * newSpawn.z) * s
    const cz = newSpawn.z * c + (ux * newSpawn.y - uy * newSpawn.x) * s
    console.log(`  d=${String(d).padStart(5)} m  slope=${slopeFromNormal({ x: cx, y: cy, z: cz }).toFixed(1).padStart(5)} deg  h=${terrainHeight(cx, cy, cz).toFixed(1)} m`)
  }
}
