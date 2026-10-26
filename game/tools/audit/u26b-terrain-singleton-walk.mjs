// A1-U26b probe — does a second body's initTerrainField re-point a WALKING KCC on the first body?
// READ-ONLY audit. Part A of u26-architecture-fitness.mjs used a standing KCC (no re-sample);
// here the KCC walks, so every tick samples terrainHeight against the per-thread singleton P.
// Run from game/:  node tools/audit/u26b-terrain-singleton-walk.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const K = await import('../../src/core/physics/astronautKCC.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const l = Math.hypot(0.3, 0.8, -0.5), d = [0.3 / l, 0.8 / l, -0.5 / l]
TF.initTerrainField(MC.MOON_PARAMS)
const k = new K.AstronautKCC(MC.MOON_ASTRONAUT); k.teleportSurface(...d); k.input.moveF = 1
for (let i = 0; i < 60; i++) k.update(1 / 60)
const rr = () => {
  const r = Math.hypot(k.absPos.x, k.absPos.y, k.absPos.z)
  const u = [k.absPos.x / r, k.absPos.y / r, k.absPos.z / r]
  return [r, MC.MOON_R + TF.terrainHeight(...u)]
}
const [r0, g0] = rr()
console.log(`walk.before r=${r0.toFixed(3)} moonGround=${g0.toFixed(3)} off_m=${(r0 - g0).toFixed(3)} mode=${k.telemetry.mode}`)
TF.initTerrainField(TF.TEST_PLANET)          // e.g. a second body's field brought up on the main thread
for (let i = 0; i < 60; i++) k.update(1 / 60)
const [r1] = rr()
TF.initTerrainField(MC.MOON_PARAMS)
const [, gM] = rr()
console.log(`walk.after r=${r1.toFixed(3)} moonGround=${gM.toFixed(3)} offMoonGround_m=${(r1 - gM).toFixed(3)} mode=${k.telemetry.mode} agl=${k.telemetry.altAGL.toFixed(3)} nan=${k.integrity.nanEvents}`)
console.log(`MOON_R=${MC.MOON_R} TEST_PLANET.radius=${TF.TEST_PLANET.radius}`)