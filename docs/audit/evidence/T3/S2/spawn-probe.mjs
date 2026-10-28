// T3 S2: spawn and slope probe on the real MOON_PARAMS (run from game/).
import { register } from 'node:module'
register('../../../../../game/tools/ts-resolve-loader.mjs', import.meta.url)
const cfg = await import('../../../../../game/src/play/world/moonConfig.ts')
const { findEarthriseSpawn, slopeFromNormal } = await import('../../../../../game/src/play/world/spawn.ts')
const TF = await import('../../../../../game/src/core/terrain/terrainField.ts')
const { SimulationCore } = await import('../../../../../game/src/core/simulation/SimulationCore.ts')
TF.initTerrainField(cfg.MOON_PARAMS)
const core = new SimulationCore(); core.setTimeScale(0)
const es = core.getCelestialState('earth'), ms = core.getCelestialState('moon')
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l } }
const E = unit(es.absPos.x - ms.absPos.x, es.absPos.y - ms.absPos.y, es.absPos.z - ms.absPos.z)
const S = unit(-ms.absPos.x, -ms.absPos.y, -ms.absPos.z)
const t0 = performance.now(), site = findEarthriseSpawn(E, S), dt = performance.now() - t0
const d = site.dir, R = cfg.MOON_R
const elev = v => Math.asin(d.x * v.x + d.y * v.y + d.z * v.z) * 180 / Math.PI
console.log('spawn', JSON.stringify(d), 'score', site.score, 'search ms', dt.toFixed(0))
console.log('slope', slopeFromNormal(d), 'h', TF.terrainHeight(d.x, d.y, d.z), 'mare', TF.moonMareMask(d.x, d.y, d.z))
console.log('earth', elev(E), 'sun', elev(S))
// every sample within 60 m: rings at 5..60 m, 64 azimuths
const t = unit(-d.z, 0, d.x), b = { x: d.y * t.z - d.z * t.y, y: d.z * t.x - d.x * t.z, z: d.x * t.y - d.y * t.x }
let maxS = 0, cnt = 0
for (let r = 0; r <= 60; r += 5) for (let k = 0; k < 64; k++) {
  const a = k * Math.PI / 32, q = r / R
  const p = unit(d.x + (t.x * Math.cos(a) + b.x * Math.sin(a)) * q, d.y + (t.y * Math.cos(a) + b.y * Math.sin(a)) * q, d.z + (t.z * Math.cos(a) + b.z * Math.sin(a)) * q)
  maxS = Math.max(maxS, slopeFromNormal(p)); cnt++
}
console.log('within 60 m:', cnt, 'samples, max slope', maxS.toFixed(3))