// A1-U26 probe — architecture fitness vs the goal (AGENT_BRIEF §13). READ-ONLY audit.
// Measures the structural limits the U26 verdicts rest on, with the REAL core code:
//  A. per-thread terrain singleton: one active TerrainParams per thread (multi-body blocker?)
//  B. SimulationCore.tick cost vs entity count N (entity model scaling)
//  C. terrainHeight cost/call and AstronautKCC.update cost/tick (per-actor CPU budget)
//  D. two KCC instances interleaved vs alone — module scratch re-entrancy when sequential
// Run from game/:  node --expose-gc tools/audit/u26-architecture-fitness.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const K = await import('../../src/core/physics/astronautKCC.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const SC = await import('../../src/core/simulation/SimulationCore.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
let cOk = 0, cN = 0
const control = (n, c) => { cN++; if (c) cOk++; p(`control.${n}`, c ? 'ok' : 'FAIL') }
const now = () => Number(process.hrtime.bigint()) / 1e6 // ms
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] }

// ---------- A. terrain singleton ----------
// Claim (goal §13): every planet and moon is a place; a real-time solar system needs >1 body's
// surface live at once (approach from orbit, a moon seen from a planet, vehicles on two bodies).
// Prediction from the code: terrainField.ts:72 `let P` + noise.ts perm = ONE field per thread, so a
// second body's initTerrainField silently re-points every existing caller (KCC, camera, LOD).
const d = nrm(0.3, 0.8, -0.5)
TF.initTerrainField(MC.MOON_PARAMS)
const hMoon1 = TF.terrainHeight(d[0], d[1], d[2])
TF.initTerrainField(TF.TEST_PLANET)
const hOther = TF.terrainHeight(d[0], d[1], d[2])
TF.initTerrainField(MC.MOON_PARAMS)
const hMoon2 = TF.terrainHeight(d[0], d[1], d[2])
p('A.hMoon', f(hMoon1)); p('A.hAfterOtherInit', f(hOther)); p('A.hMoonRestored', f(hMoon2))
control('A.restoreDeterministic', hMoon1 === hMoon2)
p('A.singletonRepointed', hMoon1 !== hOther)
// KCC standing on the moon; another body's field is initialised (e.g. a second world streaming in)
const kA = new K.AstronautKCC(MC.MOON_ASTRONAUT)
kA.teleportSurface(d[0], d[1], d[2])
for (let i = 0; i < 60; i++) kA.update(1 / 60)
const r0 = Math.hypot(kA.absPos.x, kA.absPos.y, kA.absPos.z)
const agl0 = kA.telemetry.altAGL
TF.initTerrainField(TF.TEST_PLANET)
for (let i = 0; i < 60; i++) kA.update(1 / 60)
const r1 = Math.hypot(kA.absPos.x, kA.absPos.y, kA.absPos.z)
p('A.kccRadiusBefore', f(r0)); p('A.kccRadiusAfter', f(r1)); p('A.kccAglBefore', f(agl0)); p('A.kccAglAfter', f(kA.telemetry.altAGL))
p('A.kccRadiusJump_m', f(r1 - r0))
TF.initTerrainField(MC.MOON_PARAMS)

// ---------- B. SimulationCore tick vs N ----------
// Claim: the core is the entity layer future features (aliens, vehicles, NPCs) register into.
// Expected for a scalable design: O(N) with ~ns per entity. Also check what an entity can hold.
const sampleState = (() => { const c = new SC.SimulationCore(); return c.registerEntity('x', { absPos: { x: 1, y: 2, z: 3 } }) })()
p('B.entityFields', Object.keys(sampleState).join('|'))
for (const N of [1, 100, 1000, 10000]) {
  const c = new SC.SimulationCore()
  for (let i = 0; i < N; i++) c.registerEntity('e' + i, { absPos: { x: i, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } })
  for (let i = 0; i < 600; i++) c.tick() // warm
  const T = 3000, t0 = now()
  for (let i = 0; i < T; i++) c.tick()
  const ms = (now() - t0) / T
  p(`B.tick_us.N${N}`, f(ms * 1000)); p(`B.ns_per_entity.N${N}`, f(ms * 1e6 / N))
}
const celN = new SC.SimulationCore().getCelestialStates().length
p('B.celestials', celN)

// ---------- C. per-actor CPU ----------
// Claim (goal): later features add actors that stand on terrain (NPCs, aliens, vehicles).
// Measure the analytic height call and one KCC tick (walking) to size the per-actor budget.
{
  const M = 200000; let acc = 0
  for (let i = 0; i < 20000; i++) acc += TF.terrainHeight(Math.sin(i), Math.cos(i * 1.3), 0.4)
  const t0 = now()
  for (let i = 0; i < M; i++) { const a = i * 1e-4; acc += TF.terrainHeight(Math.cos(a), 0.31, Math.sin(a)) }
  const us = (now() - t0) * 1000 / M
  p('C.terrainHeight_us', f(us)); p('C.acc', f(acc))
  const k = new K.AstronautKCC(MC.MOON_ASTRONAUT); k.teleportSurface(d[0], d[1], d[2]); k.input.moveF = 1
  for (let i = 0; i < 600; i++) k.update(1 / 60)
  const T = 3000, t1 = now()
  for (let i = 0; i < T; i++) k.update(1 / 60)
  const kus = (now() - t1) * 1000 / T
  p('C.kccTick_us', f(kus))
  // budget: 4 ms of a 16.7 ms frame for actor physics at 60 Hz ticks
  p('C.actorsPer4ms', Math.floor(4000 / kus))
  p('C.heightCallsPerKccTick_equiv', f(kus / us))
}

// ---------- D. KCC re-entrancy (sequential interleave) ----------
// Claim (astronautKCC.ts module scratch header): integrateTick non-reentrant, one active controller
// per tick. Sequential multi-instance use must still be exact (two actors ticked one after another).
function run(withB) {
  const a = new K.AstronautKCC(MC.MOON_ASTRONAUT); a.teleportSurface(d[0], d[1], d[2]); a.input.moveF = 1
  const dB = nrm(-0.6, 0.2, 0.7)
  const b = withB ? new K.AstronautKCC(MC.MOON_ASTRONAUT) : null
  if (b) { b.teleportSurface(dB[0], dB[1], dB[2]); b.input.moveR = 1; b.input.sprint = true }
  for (let i = 0; i < 1200; i++) { if (i === 300) a.input.jump = true; if (i === 302) a.input.jump = false; a.update(1 / 60); if (b) b.update(1 / 60) }
  return [a.absPos.x, a.absPos.y, a.absPos.z]
}
const alone = run(false), inter = run(true)
const dd = Math.hypot(alone[0] - inter[0], alone[1] - inter[1], alone[2] - inter[2])
p('D.interleaveDelta_m', dd); control('D.runMoved', Math.hypot(alone[0], alone[1], alone[2]) > 0)
p('D.bitIdentical', dd === 0)

p('controls', `${cOk}/${cN}`)
process.exit(cOk === cN ? 0 : 1)