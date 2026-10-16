import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// M1F gate-failure attribution probe (read-only; diag-m1e-core precedent).
// Replicates the extracted 1F harness boot + WARMUP + LIVE walk VERBATIM in
// Node and prints every number the routing needs:
//  (1) rail geometry + horizon cull of all 9 catalog bodies at the spawn
//      (R2: was the Sun impostor culled -> 0 px readback?),
//  (2) the LIVE walk trace (R5: rebases during LIVE, where the walk stalls),
//  (3) spawn-scan outcome + the F21b arithmetic inputs.
const { initTerrainField, terrainHeight, terrainNormalInto } = await import(
  '../src/core/terrain/terrainField.ts'
)
const { mulberry32 } = await import('../src/core/terrain/noise.ts')
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
console.log(`  earthDir=(${earthDir.x.toFixed(4)},${earthDir.y.toFixed(4)},${earthDir.z.toFixed(4)})`)
console.log(`  sunDir  =(${sunDir.x.toFixed(4)},${sunDir.y.toFixed(4)},${sunDir.z.toFixed(4)})`)
const cosES = Math.max(-1, Math.min(1, earthDir.x * sunDir.x + earthDir.y * sunDir.y + earthDir.z * sunDir.z))
console.log(`  angle(earthDir,sunDir)=${((Math.acos(cosES) * 180) / Math.PI).toFixed(2)} deg`)

// ---- verbatim spawn scan ------------------------------------------------
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
console.log(`spawn: dir=(${SPAWN_DIR.x.toFixed(5)},${SPAWN_DIR.y.toFixed(5)},${SPAWN_DIR.z.toFixed(5)}) ` +
  `slope=${slopeFromNormal(SPAWN_DIR).toFixed(3)} deg h=${terrainHeight(SPAWN_DIR.x, SPAWN_DIR.y, SPAWN_DIR.z).toFixed(2)} m`)
kcc.teleportSurface(SPAWN_DIR.x, SPAWN_DIR.y, SPAWN_DIR.z)

// ---- horizon cull of the 9 catalog bodies (harness convention: obs = moonRail + local) ----
const CAT = [
  ['sun', 20000], ['mercury', 3105.7], ['venus', 4870.3], ['mars', 2649.3],
  ['jupiter', 16640.2], ['saturn', 15120.4], ['uranus', 9980.5], ['neptune', 9835.4], ['pluto', 2160.8],
]
function elevationOf(dir, up) {
  const d = dir.x * up.x + dir.y * up.y + dir.z * up.z
  return Math.asin(d >= 1 ? 1 : d <= -1 ? -1 : d)
}
function auditCull(label, obsLocal) {
  // replicate applyRenderState's cull EXACTLY: obs = moonRail + driver local,
  // up = normalize(driver local)  <- the harness's actual formula
  const ol = Math.hypot(obsLocal.x, obsLocal.y, obsLocal.z) || 1
  const up = { x: obsLocal.x / ol, y: obsLocal.y / ol, z: obsLocal.z / ol }
  // true radial up for comparison: moon-frame abs = O + local
  const O = core.getOrigin()
  const ax = O.x + obsLocal.x, ay = O.y + obsLocal.y, az = O.z + obsLocal.z
  const al = Math.hypot(ax, ay, az) || 1
  const upTrue = { x: ax / al, y: ay / al, z: az / al }
  const dotUU = up.x * upTrue.x + up.y * upTrue.y + up.z * upTrue.z
  console.log(`${label}: local=(${obsLocal.x.toFixed(1)},${obsLocal.y.toFixed(1)},${obsLocal.z.toFixed(1)}) |local|=${ol.toFixed(1)} ` +
    `O=(${O.x},${O.y},${O.z})`)
  console.log(`  harness up=normalize(local)=(${up.x.toFixed(3)},${up.y.toFixed(3)},${up.z.toFixed(3)}) vs ` +
    `true radial=(${upTrue.x.toFixed(3)},${upTrue.y.toFixed(3)},${upTrue.z.toFixed(3)}) — ` +
    `${((Math.acos(Math.max(-1, Math.min(1, dotUU))) * 180) / Math.PI).toFixed(1)} deg apart`)
  const ox = moonState.absPos.x + obsLocal.x, oy = moonState.absPos.y + obsLocal.y, oz = moonState.absPos.z + obsLocal.z
  let nActive = 0, sunLine = ''
  for (const [id, rad] of CAT) {
    const st = core.getCelestialState(id)
    if (st === null) continue
    const dx = st.absPos.x - ox, dy = st.absPos.y - oy, dz = st.absPos.z - oz
    const d = Math.hypot(dx, dy, dz)
    const dir = { x: dx / d, y: dy / d, z: dz / d }
    const theta = Math.asin(Math.min(1, rad / d))
    const el = elevationOf(dir, up)
    const elTrue = elevationOf(dir, upTrue)
    const culled = el < -(theta + 0.03)
    if (!culled) nActive++
    if (id === 'sun') sunLine = `  SUN: harness-elev=${((el * 180) / Math.PI).toFixed(1)} deg (true-elev ${((elTrue * 180) / Math.PI).toFixed(1)}) theta=${((theta * 180) / Math.PI).toFixed(2)} -> ${culled ? 'CULLED' : 'active'}`
    else console.log(`  ${id.padEnd(8)} harness-elev=${((el * 180) / Math.PI).toFixed(1).padStart(7)} deg (true ${((elTrue * 180) / Math.PI).toFixed(1).padStart(7)}) ${culled ? 'CULLED' : 'active'}`)
  }
  console.log(sunLine)
  console.log(`  -> ${nActive} of 9 catalog bodies ACTIVE under the harness up`)
  return nActive
}

// ---- walkFwd + SAT_B (verbatim) -----------------------------------------
const walkFwd = (function () {
  let tx = SPAWN_DIR.y * 0 - SPAWN_DIR.z * 1
  let ty = SPAWN_DIR.z * 0 - SPAWN_DIR.x * 0
  let tz = SPAWN_DIR.x * 1 - SPAWN_DIR.y * 0
  const tl = Math.hypot(tx, ty, tz) || 1
  tx /= tl; ty /= tl; tz /= tl
  if (tx * sunDir.x + ty * sunDir.y + tz * sunDir.z < 0) { tx = -tx; tz = -tz }
  return { x: tx, y: ty, z: tz }
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

// ---- verbatim sphericalFrame helpers used by the autopilot --------------
const { signedAngleAbout } = await import('../src/core/physics/sphericalFrame.ts')
const _vA = { x: 0, y: 0, z: 0 }

// ---- WARMUP (ts=1) then LIVE (ts=6, 5 substeps) — verbatim input model ---
const DT = 1 / 60
function frame(ts) {
  kcc.update(DT * ts, 5)
  core.advance(DT * ts)
}
// WARMUP: browser transitioned at warm>3 with pool active>=30 (HUD: 94 active)
const WARM_S = 3.5
kcc.input.moveF = 0.3; kcc.input.moveR = 0; kcc.input.sprint = false
kcc.input.turnRate = 0.4
for (let f = 0; f < Math.round(WARM_S / DT); f++) frame(1)
const rebases0 = core.stats.rebaseCount
console.log(`WARMUP done (${WARM_S}s): rebases0=${rebases0} maxLocalPostTick=${core.stats.focusMaxLocalPostTick.toFixed(1)}`)

// cull audit at the harness's FIRST post-warmup frame (driver local ~ entity local)
auditCull('post-WARMUP audit (harness up = normalize(driver LOCAL))', {
  x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2],
})

const WALL_SECONDS = Number(process.env.WALL_SECONDS ?? 120)
// LIVE: autopilot verbatim; effective 5x (ts=6, 5-substep cap)
let simS = 0
let maxLocalLive = 0
let distWalked = 0
let prevAbs = { ...kcc.absPos }
const trace = []
for (let f = 0; f < WALL_SECONDS / DT; f++) {
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
console.log(`origin: O=(${core.getOrigin().x},${core.getOrigin().y},${core.getOrigin().z})`)

// cull audit at suite time (driver local ~ entity local at end of walk)
auditCull('post-LIVE audit (suite-time pose)', {
  x: astroState.localPosF32[0], y: astroState.localPosF32[1], z: astroState.localPosF32[2],
})

// ---- terrain profile along walkFwd (why the sprint crawls) ----------------
console.log('terrain profile along walkFwd (surface slope at distance d):')
{
  // rotation axis moving SPAWN_DIR toward walkFwd
  const axx = SPAWN_DIR.y * walkFwd.z - SPAWN_DIR.z * walkFwd.y
  const axy = SPAWN_DIR.z * walkFwd.x - SPAWN_DIR.x * walkFwd.z
  const axz = SPAWN_DIR.x * walkFwd.y - SPAWN_DIR.y * walkFwd.x
  const al = Math.hypot(axx, axy, axz) || 1
  const ux = axx / al, uy = axy / al, uz = axz / al
  for (let d = 0; d <= 2600; d += 200) {
    const th = d / R, c = Math.cos(th), s = Math.sin(th)
    // Rodrigues: v' = v c + (u×v) s + u (u·v)(1-c); u·v=0 (tangent axis)
    const cx = SPAWN_DIR.x * c + (uy * SPAWN_DIR.z - uz * SPAWN_DIR.y) * s
    const cy = SPAWN_DIR.y * c + (uz * SPAWN_DIR.x - ux * SPAWN_DIR.z) * s
    const cz = SPAWN_DIR.z * c + (ux * SPAWN_DIR.y - uy * SPAWN_DIR.x) * s
    console.log(`  d=${String(d).padStart(5)} m  slope=${slopeFromNormal({ x: cx, y: cy, z: cz }).toFixed(1).padStart(5)} deg  h=${terrainHeight(cx, cy, cz).toFixed(1)} m`)
  }
}
