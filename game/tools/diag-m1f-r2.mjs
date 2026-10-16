import { register } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
register('./ts-resolve-loader.mjs', import.meta.url)

// F27 verification probe (ruling round 2 -> round 3): run the REAL edited
// harness lookAtQuatInto — extracted VERBATIM from the harness source at
// runtime, not a local copy — against the real quatFromFrameInto and
// projectDirectionInto, and project the four suite poses (TP boom, R2 Sun,
// R3 silhouette, R5 SAT_B) built from a verbatim Node replica of the harness
// boot + WARMUP + LIVE walk. Expect every pose to aim its target dead-center
// (~640/~360, behind=false).
const here = dirname(fileURLToPath(import.meta.url))
const harnessSrc = readFileSync(join(here, '../src/test/Milestone1F_TestHarness.tsx'), 'utf8')

// -- extract the live lookAtQuatInto (brace-matched, verbatim) ---------------
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`${name} not found in harness source`)
  let i = src.indexOf('{', start), depth = 0, end = -1
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
  }
  if (end < 0) throw new Error(`unbalanced braces extracting ${name}`)
  return src.slice(start, end)
}
const lookAtSrc = extractFn(harnessSrc, 'lookAtQuatInto')
const callLine = lookAtSrc.split('\n').find((l) => l.includes('quatFromFrameInto('))
console.log(`harness lookAtQuatInto (verbatim extract) final call:`)
console.log(`  ${callLine.trim()}`)
if (!callLine.includes('quatFromFrameInto(rx, ry, rz, upx, upy, upz, out)')) {
  console.log('  !! F27 edit NOT present in the harness — pose results below are the OLD basis')
}

const { quatFromFrameInto, spinQuatInto, rotateAboutAxisInto, rotateByQuatInto, rotateByQuatConjInto, signedAngleAbout } =
  await import('../src/core/physics/sphericalFrame.ts')
const { projectDirectionInto, bodyGeometryInto } = await import('../src/core/render/impostorMath.ts')

// instantiate the REAL edited harness function: write the verbatim extract
// (plus a real import of quatFromFrameInto) to a temp .ts sibling and load it
// through the registered TS loader — annotations stay, no local copy.
import { writeFileSync, unlinkSync } from 'node:fs'
const tmpTs = join(here, '_f27_extract.ts')
writeFileSync(tmpTs,
  "import { quatFromFrameInto, type Quat } from '../src/core/physics/sphericalFrame.ts'\n" +
  lookAtSrc + '\nexport default lookAtQuatInto\n')
const lookAtQuatInto = (await import('./_f27_extract.ts')).default
unlinkSync(tmpTs)

// -- verbatim harness constants (ARCS + LIVE_SECONDS read from the source) ---
const ARCS = JSON.parse(harnessSrc.match(/const ARCS = (\[[^\]]*\]);/)[1])
const LIVE_SECONDS = Number(harnessSrc.match(/const LIVE_SECONDS = (\d+);/)[1])
console.log(`harness ARCS (F25d): ${JSON.stringify(ARCS)}`)
console.log(`harness LIVE_SECONDS: ${LIVE_SECONDS}`)

const { initTerrainField, terrainHeight, terrainNormalInto } = await import('../src/core/terrain/terrainField.ts')
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
const { SimulationCore } = await import('../src/core/simulation/SimulationCore.ts')
const { AstronautKCC } = await import('../src/core/physics/astronautKCC.ts')

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
  planetRadius: R, planetMu: MOON_MU, gravityRange: 8187, spinOmega: 0.0005,
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

// ---- verbatim spawn scan ----------------------------------------------------
const _scanT = { x: 0, y: 0, z: 0 }
const _scanN = { x: 0, y: 0, z: 0 }
function slopeFromNormal(d) {
  terrainNormalInto(d.x, d.y, d.z, _scanN)
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}
const SPAWN_DIR = (function findSpawn() {
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
  const base = { x: rx / rl, y: ry / rl, z: rz / rl }
  const rand = mulberry32(0x7f1a)
  let best = base; let bestScore = Infinity
  for (let i = 0; i < 24000; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2
    const q = Math.sqrt(1 - u * u)
    const jitter = 0.02 + 0.1 * rand()
    const cx = base.x + Math.cos(th) * q * jitter
    const cy = base.y + u * jitter
    const cz = base.z + Math.sin(th) * q * jitter
    const cl = Math.hypot(cx, cy, cz)
    _scanT.x = cx / cl; _scanT.y = cy / cl; _scanT.z = cz / cl
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
})()
kcc.teleportSurface(SPAWN_DIR.x, SPAWN_DIR.y, SPAWN_DIR.z)

// ---- walkFwd via the F25d corridor scan (mirrors the harness, REAL ARCS) ----
const walkFwd = (function () {
  const _p = { x: 0, y: 0, z: 0 }
  let e1x = -SPAWN_DIR.z, e1y = 0, e1z = SPAWN_DIR.x
  const e1l = Math.hypot(e1x, e1y, e1z) || 1
  e1x /= e1l; e1y /= e1l; e1z /= e1l
  const e2x = SPAWN_DIR.y * e1z - SPAWN_DIR.z * e1y
  const e2y = SPAWN_DIR.z * e1x - SPAWN_DIR.x * e1z
  const e2z = SPAWN_DIR.x * e1y - SPAWN_DIR.y * e1x
  let bx = 0, by = 0, bz = 0, bestScore = Infinity, bestDev = 0
  for (let k = 0; k < 24; k++) {
    const azim = (k * 15 * Math.PI) / 180
    const c = Math.cos(azim), s = Math.sin(azim)
    const tx = e1x * c + e2x * s, ty = e1y * c + e2y * s, tz = e1z * c + e2z * s
    const ax = SPAWN_DIR.y * tz - SPAWN_DIR.z * ty
    const ay = SPAWN_DIR.z * tx - SPAWN_DIR.x * tz
    const az2 = SPAWN_DIR.x * ty - SPAWN_DIR.y * tx
    let maxSlope = 0, maxDev = 0
    let prevH = terrainHeight(SPAWN_DIR.x, SPAWN_DIR.y, SPAWN_DIR.z)
    for (const arc of ARCS) {
      const th = arc / R, cc = Math.cos(th), ss = Math.sin(th)
      const px2 = SPAWN_DIR.x * cc + (ay * SPAWN_DIR.z - az2 * SPAWN_DIR.y) * ss
      const py2 = SPAWN_DIR.y * cc + (az2 * SPAWN_DIR.x - ax * SPAWN_DIR.z) * ss
      const pz2 = SPAWN_DIR.z * cc + (ax * SPAWN_DIR.y - ay * SPAWN_DIR.x) * ss
      _p.x = px2; _p.y = py2; _p.z = pz2
      const h = terrainHeight(_p.x, _p.y, _p.z)
      maxDev = Math.max(maxDev, Math.abs(h - prevH)); prevH = h
      maxSlope = Math.max(maxSlope, slopeFromNormal(_p))
    }
    if (maxSlope < bestScore || (maxSlope === bestScore && maxDev < bestDev)) {
      bestScore = maxSlope; bestDev = maxDev; bx = tx; by = ty; bz = tz
    }
  }
  return { x: bx, y: by, z: bz }
})()
function surfacePoint(dirX, dirY, dirZ, alt) {
  const h = terrainHeight(dirX, dirY, dirZ)
  const rr = R + h + alt
  return { x: dirX * rr, y: dirY * rr, z: dirZ * rr }
}
const spawnPos = surfacePoint(SPAWN_DIR.x, SPAWN_DIR.y, SPAWN_DIR.z, 0)
const SAT_B = {
  x: spawnPos.x + walkFwd.x * 2400 + SPAWN_DIR.x * 400,
  y: spawnPos.y + walkFwd.y * 2400 + SPAWN_DIR.y * 400,
  z: spawnPos.z + walkFwd.z * 2400 + SPAWN_DIR.z * 400,
}

// ---- PROBE_DIR (harness formula, verbatim) ----------------------------------
const PROBE_DIR = (function () {
  let x = earthDir.y * sunDir.z - earthDir.z * sunDir.y
  let y = earthDir.z * sunDir.x - earthDir.x * sunDir.z
  let z = earthDir.x * sunDir.y - earthDir.y * sunDir.x
  const l = Math.hypot(x, y, z) || 1
  x /= l; y /= l; z /= l
  const p = { x: x * 0.5 + sunDir.x * -0.35, y: y * 0.5 + 0.6, z: z * 0.5 + sunDir.z * -0.35 }
  const pl = Math.hypot(p.x, p.y, p.z)
  p.x /= pl; p.y /= pl; p.z /= pl
  return p
})()

// ---- WARMUP + LIVE walk (verbatim input model) -------------------------------
const DT = 1 / 60
function frame(ts) {
  kcc.update(DT * ts, 5)
  core.advance(DT * ts)
}
const WARM_S = 3.5
kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false
kcc.input.turnRate = 0.4
for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)

const _vA = { x: 0, y: 0, z: 0 }
let crossings = 0
for (let f = 0; f < LIVE_SECONDS / DT; f++) {
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
  if (core.stats.rebaseCount !== rebBefore) crossings += core.stats.rebaseCount - rebBefore
}
console.log(`walk replica: ${crossings} crossings during LIVE (${LIVE_SECONDS} wall s)`)

// ---- suite-time driver pose: TP boom branch of computeDriverPose (verbatim) --
const cam = { yawOffset: 0.6, pitch: 0.35, dist: 7.0 }
const _qS = { x: 0, y: 0, z: 0, w: 1 }
const _vB = { x: 0, y: 0, z: 0 }
const _vC = { x: 0, y: 0, z: 0 }
function quatMulF64(a, b) {
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w
  _qS.x = x; _qS.y = y; _qS.z = z; _qS.w = w
  return _qS
}
const drv = { x: 0, y: 0, z: 0 }
const drvQuat = { x: 0, y: 0, z: 0, w: 1 }
{
  const eye = kcc.telemetry.eyeHeight
  const ux = kcc.up.x, uy = kcc.up.y, uz = kcc.up.z
  spinQuatInto(kcc.spinPhase, _qS)
  const fwdWorld = { x: 0, y: 0, z: 0 }
  rotateByQuatInto(_qS, kcc.fwd.x, kcc.fwd.y, kcc.fwd.z, fwdWorld)
  const fwdx = fwdWorld.x, fwdy = fwdWorld.y, fwdz = fwdWorld.z
  rotateAboutAxisInto(-fwdx, -fwdy, -fwdz, ux, uy, uz, -cam.yawOffset, _vA)
  const rx = _vA.y * uz - _vA.z * uy, ry = _vA.z * ux - _vA.x * uz, rz = _vA.x * uy - _vA.y * ux
  rotateAboutAxisInto(_vA.x, _vA.y, _vA.z, rx, ry, rz, -cam.pitch, _vB)
  let dist = cam.dist
  for (let s = 1; s <= 4; s++) {
    const f = (s / 4) * cam.dist
    const px = kcc.absPos.x + ux * eye + _vB.x * f
    const py = kcc.absPos.y + uy * eye + _vB.y * f
    const pz = kcc.absPos.z + uz * eye + _vB.z * f
    const rr = Math.hypot(px, py, pz)
    if (rr < R + MAX_TERRAIN_H + 80) {
      rotateByQuatConjInto(_qS, px / rr, py / rr, pz / rr, _vC)
      if (rr - (R + terrainHeight(_vC.x, _vC.y, _vC.z)) < 0.4) { dist = Math.min(dist, f - 0.4); break }
    }
  }
  if (dist < 1.2) dist = 1.2
  drv.x = kcc.absPos.x + ux * eye + _vB.x * dist
  drv.y = kcc.absPos.y + uy * eye + _vB.y * dist
  drv.z = kcc.absPos.z + uz * eye + _vB.z * dist
  lookAtQuatInto(drv.x, drv.y, drv.z,
    kcc.absPos.x + ux * 1.4, kcc.absPos.y + uy * 1.4, kcc.absPos.z + uz * 1.4, ux, uy, uz, drvQuat)
}

// ---- sun geometry at suite time (observer = moon rail + driver local) --------
const sunState = core.getCelestialState('sun')
const O = core.getOrigin()
const drvLocal = { x: drv.x - O.x, y: drv.y - O.y, z: drv.z - O.z }
const sunGeom = { dirX: 0, dirY: 0, dirZ: 0, dist: 0, theta: 0 }
bodyGeometryInto(moonState.absPos.x + drvLocal.x, moonState.absPos.y + drvLocal.y, moonState.absPos.z + drvLocal.z,
  sunState.absPos.x, sunState.absPos.y, sunState.absPos.z, 20000, sunGeom)

// ---- project the four poses through the REAL edited lookAtQuatInto ----------
const out = { px: 0, py: 0, behind: false }
const FOV = (62 * Math.PI) / 180, W = 1280, H = 720
function report(label, dirX, dirY, dirZ, q) {
  projectDirectionInto(dirX, dirY, dirZ, q, FOV, W / H, W, H, out)
  const off = Math.hypot(out.px - W / 2, out.py - H / 2)
  console.log(`  ${label}: px=${out.px.toFixed(2)} py=${out.py.toFixed(2)} behind=${out.behind} (centre offset ${off.toFixed(3)} px)`)
  return { px: out.px, py: out.py, off }
}
console.log('\nfour poses through the REAL edited lookAtQuatInto (expect ~640/~360, behind=false):')
// 1. TP boom (target = astronaut chest; up = character up)
{
  const tx = kcc.absPos.x + kcc.up.x * 1.4 - drv.x
  const ty = kcc.absPos.y + kcc.up.y * 1.4 - drv.y
  const tz = kcc.absPos.z + kcc.up.z * 1.4 - drv.z
  const tl = Math.hypot(tx, ty, tz)
  report('TP boom (astronaut) ', tx / tl, ty / tl, tz / tl, drvQuat)
}
// 2. R2 Sun pose (suite R2(b) formula)
{
  const q = { x: 0, y: 0, z: 0, w: 1 }
  lookAtQuatInto(drv.x, drv.y, drv.z,
    drv.x + sunGeom.dirX, drv.y + sunGeom.dirY, drv.z + sunGeom.dirZ, 0, 1, 0, q)
  report('R2 Sun              ', sunGeom.dirX, sunGeom.dirY, sunGeom.dirZ, q)
}
// 3. R3 silhouette pose (suite R3(c) formula, PROBE_DIR target)
{
  const q = { x: 0, y: 0, z: 0, w: 1 }
  lookAtQuatInto(drv.x, drv.y, drv.z,
    drv.x + PROBE_DIR.x, drv.y + PROBE_DIR.y, drv.z + PROBE_DIR.z, 0, 1, 0, q)
  report('R3 silhouette (probe)', PROBE_DIR.x, PROBE_DIR.y, PROBE_DIR.z, q)
}
// 4. R5 SAT_B straddle pose (suite R5 formula)
{
  const dirLen = Math.hypot(SAT_B.x - spawnPos.x, SAT_B.y - spawnPos.y, SAT_B.z - spawnPos.z)
  const dx = (SAT_B.x - spawnPos.x) / dirLen
  const dy = (SAT_B.y - spawnPos.y) / dirLen
  const dz = (SAT_B.z - spawnPos.z) / dirLen
  const poseX = SAT_B.x - dx * 2400, poseY = SAT_B.y - dy * 2400, poseZ = SAT_B.z - dz * 2400
  const q = { x: 0, y: 0, z: 0, w: 1 }
  lookAtQuatInto(poseX, poseY, poseZ, SAT_B.x, SAT_B.y, SAT_B.z, 0, 1, 0, q)
  report('R5 straddle (SAT_B) ', dx, dy, dz, q)
}

// ---- sun disk footprint numbers ----------------------------------------------
{
  const pxPerRad = H / (2 * Math.tan((31 * Math.PI) / 180))
  const rpx = sunGeom.theta * pxPerRad
  const ideal = Math.PI * rpx * rpx
  console.log(`\nSun disk (f64 truth at suite-time observer): θ=${((sunGeom.theta * 180) / Math.PI).toFixed(3)}° ` +
    `-> r=${rpx.toFixed(2)} px (pxPerRad=${pxPerRad.toFixed(2)}); ideal footprint π·r²=${ideal.toFixed(0)} px ` +
    `(expect ≈π·21²≈1,385 px; round-2 measured 1,381)`)
  console.log(`  A/B readback window will be ±2r ≈ ±${(2 * rpx).toFixed(0)} px around the projected centre`)
}
