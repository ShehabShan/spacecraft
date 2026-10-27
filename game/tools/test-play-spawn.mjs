import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// T1 B2 Node check (plan §12.2 B2, §13.2): pins the play moon constants
// (A1/A2 + Q8) and the deterministic Earthrise spawn. Prints
// `[test-play-spawn] PASS n/n` or the failing assertions; exit 1 on failure.
const cfg = await import('../src/play/world/moonConfig.ts')
const { findEarthriseSpawn, slopeFromNormal, parseSpawnOverride } = await import('../src/play/world/spawn.ts')
const { initTerrainField, terrainHeight } = await import('../src/core/terrain/terrainField.ts')
const { SimulationCore } = await import('../src/core/simulation/SimulationCore.ts')

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }
const eq = (a, b, msg) => ok(a === b, `${msg}: got ${a}, want ${b}`)
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b} ±${tol}`)

// ---- A1 terrain params (harness ~100) ---------------------------------
const P = cfg.MOON_PARAMS
const A1 = { radius: 1364.5, seed: 20240119, continentFreq: 2.3, continentAmp: 95, maskFreq: 3.7,
  mountainFreq: 6.5, mountainAmp: 230, detailFreq: 22, detailAmp: 16 }
for (const k of Object.keys(A1)) eq(P[k], A1[k], `MOON_PARAMS.${k}`)
eq(P.name, 'Play Moon', 'MOON_PARAMS.name')
eq(Object.keys(P).length, 10, 'MOON_PARAMS field count')
eq(cfg.MOON_R, 1364.5, 'MOON_R')
eq(cfg.MOON_MU, 1.62 * 1364.5 * 1364.5, 'MOON_MU')
eq(cfg.MAX_TERRAIN_H, 360, 'MAX_TERRAIN_H')
eq(cfg.HEIGHT_SLACK, 420, 'HEIGHT_SLACK')

// ---- A2 KCC config (harness ~121–129) + Q8 ----------------------------
const A2 = { planetRadius: 1364.5, planetMu: 1.62 * 1364.5 * 1364.5, gravityRange: 8187, spinOmega: 0,
  maxTerrainHeight: 360, walkSpeed: 3.2, sprintSpeed: 6.5, crouchSpeed: 1.5, jumpSpeed: 4.2,
  accelTau: 0.15, stepHeight: 0.5, snapDistance: 0.4, groundClearance: 0.02,
  maxWalkSlopeDeg: 50, slideAngleDeg: 45, kineticFriction: 0.6, slideGripTau: 0.06,
  eyeHeight: 1.62, crouchEyeHeight: 0.95, upBlendWeight: 0.65, airborneUpTau: 2.0,
  autoTurnRate: 6, rcsAccel: 1.2, rcsBudgetMax: 20, rcsRegen: 0.5, sweepGap: 0.25 }
const K = cfg.MOON_ASTRONAUT
for (const k of Object.keys(A2)) eq(K[k], A2[k], `MOON_ASTRONAUT.${k}`)
eq(Object.keys(K).length, Object.keys(A2).length, 'MOON_ASTRONAUT field count')
eq(K.spinOmega, 0, 'Q8 spinOmega === 0')
eq(cfg.MOON_SPIN_OMEGA, 0, 'Q8 MOON_SPIN_OMEGA === 0')

// ---- pool + tuning ----------------------------------------------------
const PO = { meshCount: 96, workerCount: 2, workerPoolSets: 96, maxBatch: 6, inFlightPerWorker: 12 }
for (const k of Object.keys(PO)) eq(cfg.PLAY_POOL_OPTS[k], PO[k], `PLAY_POOL_OPTS.${k}`)
eq(cfg.PLAY_TUNING.readyRadiusM, 300, 'PLAY_TUNING.readyRadiusM')
eq(cfg.PLAY_TUNING.loadTimeoutS, 15, 'PLAY_TUNING.loadTimeoutS')
eq(cfg.PLAY_TUNING.lookSens, 0.0022, 'PLAY_TUNING.lookSens')
eq(cfg.PLAY_TUNING.jumpBufferS, 0.12, 'PLAY_TUNING.jumpBufferS')

// ---- spawn (§6.1) -----------------------------------------------------
initTerrainField(P)
const core = new SimulationCore()
core.setTimeScale(0)
const es = core.getCelestialState('earth'), ms = core.getCelestialState('moon')
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l } }
const earthDir = unit(es.absPos.x - ms.absPos.x, es.absPos.y - ms.absPos.y, es.absPos.z - ms.absPos.z)
const sunDir = unit(-ms.absPos.x, -ms.absPos.y, -ms.absPos.z)
const t0 = performance.now()
const site = findEarthriseSpawn(earthDir, sunDir)
const ms_ = performance.now() - t0
const d = site.dir
// Pinned at B2 (full precision observed in Node 24, 2026-10-20).
const PIN = { x: 0.8349753337306719, y: -0.07279905191367053, z: 0.5454507219738775 }
near(d.x, 0.834975, 1e-6, 'spawn.x (§6.1)'); near(d.y, -0.072799, 1e-6, 'spawn.y (§6.1)'); near(d.z, 0.545451, 1e-6, 'spawn.z (§6.1)')
near(d.x, PIN.x, 1e-9, 'spawn.x pin'); near(d.y, PIN.y, 1e-9, 'spawn.y pin'); near(d.z, PIN.z, 1e-9, 'spawn.z pin')
const slope = slopeFromNormal(d)
ok(slope < 1, `spawn slope < 1°: got ${slope}`)
const elev = (v) => Math.asin(d.x * v.x + d.y * v.y + d.z * v.z) * 180 / Math.PI
near(site.earthElevDeg, 14.3488, 0.01, 'Earth elevation')
near(elev(earthDir), 14.3488, 0.01, 'Earth elevation (recomputed)')
// WHY: F3abbbbbb (ADR-015) moves the Moon orbit 38,850 -> 32,047 m, so the Moon->Sun direction at t=0 shifts; Earth elevation (design anchor) and the spawn pin are unchanged.
// WHY: F3abbbbbc (ADR-016) gives the Moon its real e/i/omega/M0, so the t=0 Moon->Earth/Sun directions move again; spawn pin, Earth 14.35 deg and Sun 46.21 deg re-pinned (search unchanged).
near(elev(sunDir), 46.2127, 0.01, 'Sun elevation')

// ---- override parse ---------------------------------------------------
const o = parseSpawnOverride('?spawn=1,0,0')
ok(o !== null && o.x === 1 && o.y === 0 && o.z === 0, `override 1,0,0: got ${JSON.stringify(o)}`)
const o2 = parseSpawnOverride('?spawn=0,3,4')
ok(o2 !== null && Math.abs(o2.y - 0.6) < 1e-12 && Math.abs(o2.z - 0.8) < 1e-12, 'override normalizes')
const warn = console.warn; let warned = ''; console.warn = (m) => { warned = m }
eq(parseSpawnOverride('?spawn=garbage'), null, 'override garbage → null')
eq(parseSpawnOverride('?spawn=0,0,0'), null, 'override zero → null')
eq(parseSpawnOverride('?spawn=1,2'), null, 'override 2-part → null')
console.warn = warn
ok(warned.startsWith('[play]'), `warning prefix [play]: got "${warned}"`)
eq(parseSpawnOverride('?page=play'), null, 'override absent → null')

console.log(`[test-play-spawn] spawn (${d.x}, ${d.y}, ${d.z}) score ${site.score.toFixed(3)} ` +
  `h ${terrainHeight(d.x, d.y, d.z).toFixed(2)} m slope ${slope.toFixed(2)}° earth ${elev(earthDir).toFixed(2)}° ` +
  `sun ${elev(sunDir).toFixed(2)}° search ${ms_.toFixed(0)} ms`)
if (fails.length) { console.log(`[test-play-spawn] FAIL ${n - fails.length}/${n}\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`[test-play-spawn] PASS ${n}/${n}`)