// T3 S2 (ADR-028 amendment): generate the literal MOON_PARAMS.moon basin list.
// The S1 gate's makeBasins set (basin 0 at +Z) is rigidly rotated so basin 0
// sits under the deterministic spawn base direction (findEarthriseSpawn's
// 75°-rotated Earth direction at t=0). A rotation keeps every pairwise basin
// separation, so the gate's non-overlap property is preserved.
// Run from game/: node tools/gen-moon-basins.mjs
// WHY here: moved from the T3 S2 evidence dir in T4 S2 (ADR-030) so the generator survives the evidence purge.
import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)
const NZ = await import('../src/core/terrain/noise.ts')
const { SimulationCore } = await import('../src/core/simulation/SimulationCore.ts')

function makeBasins(radii, seed) {
  const rnd = NZ.mulberry32(seed), out = [{ d: [0, 0, 1], r: radii[0] }]
  for (let k = 1; k < radii.length; k++) {
    let best = null
    for (let t = 0; t < 4000; t++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u)
      const d = [Math.cos(th) * q, u, Math.sin(th) * q]
      if (out.every(o => Math.acos(Math.min(1, d[0] * o.d[0] + d[1] * o.d[1] + d[2] * o.d[2])) > (o.r + radii[k]) * 0.9 + 0.08)) { best = d; break }
    }
    out.push({ d: best || [0, 1, 0], r: radii[k] })
  }
  return out
}
const unit = (x, y, z) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l] }
const core = new SimulationCore(); core.setTimeScale(0)
const es = core.getCelestialState('earth'), ms = core.getCelestialState('moon')
const E = unit(es.absPos.x - ms.absPos.x, es.absPos.y - ms.absPos.y, es.absPos.z - ms.absPos.z)
const S = unit(-ms.absPos.x, -ms.absPos.y, -ms.absPos.z)
// spawn base = spawn.ts lines: Earth rotated 75° about E×S
const a = unit(E[1] * S[2] - E[2] * S[1], E[2] * S[0] - E[0] * S[2], E[0] * S[1] - E[1] * S[0])
const c = Math.cos(75 * Math.PI / 180), s = Math.sin(75 * Math.PI / 180)
const B = unit(E[0] * c + (a[1] * E[2] - a[2] * E[1]) * s, E[1] * c + (a[2] * E[0] - a[0] * E[2]) * s, E[2] * c + (a[0] * E[1] - a[1] * E[0]) * s)
// Rodrigues rotation taking +Z to B
const Z = [0, 0, 1], ax0 = [Z[1] * B[2] - Z[2] * B[1], Z[2] * B[0] - Z[0] * B[2], Z[0] * B[1] - Z[1] * B[0]]
const sn = Math.hypot(...ax0), cs = B[2], k = ax0.map(v => v / sn)
const rot = v => {
  const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2]
  const kx = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]
  return unit(...[0, 1, 2].map(i => v[i] * cs + kx[i] * sn + k[i] * kv * (1 - cs)))
}
const RADII = [0.62, 0.52, 0.45, 0.40, 0.36, 0.32, 0.28].map(r => r * 1.15)
const raw = makeBasins(RADII, 0x7a3e), rotd = raw.map(o => ({ d: rot(o.d), r: o.r }))
const r6 = x => Math.round(x * 1e6) / 1e6
let minGap = Infinity
for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
  const g0 = Math.acos(Math.min(1, raw[i].d.reduce((s, v, q) => s + v * raw[j].d[q], 0)))
  const g1 = Math.acos(Math.min(1, rotd[i].d.reduce((s, v, q) => s + v * rotd[j].d[q], 0)))
  minGap = Math.min(minGap, Math.abs(g0 - g1))
}
console.log('base', B.join(', '))
console.log('basin0·base', rotd[0].d.reduce((s, v, q) => s + v * B[q], 0))
console.log('max pairwise-angle change (rad)', minGap)
console.log('basins: [')
for (const o of rotd) console.log(`  ${r6(o.d[0])}, ${r6(o.d[1])}, ${r6(o.d[2])}, ${r6(o.r)},`)
console.log(']')