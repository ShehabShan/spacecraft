// A1-U15b probe — (1) staged-rank occlusion in the unsafe direction, (2) heading change per
// up flip with the KCC up blend (upBlendWeight 0.65). Run from game/: node tools/audit/u15b-occlusion-flip.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const SF = await import('../../src/core/physics/sphericalFrame.ts')
const IM = await import('../../src/core/render/impostorMath.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => Number(x.toPrecision(5))
const r = (d) => (d * Math.PI) / 180
// (1) camera-facing quads: depth = D·cosβ. Near body (rank 1) at β=30°, far body (rank 0) at β=31°.
const Df = IM.stagedDistanceForRank(0), Dn = IM.stagedDistanceForRank(1)
for (const [bn, bf] of [[30, 31], [20, 21], [10, 11.6]]) {
  const zn = Dn * Math.cos(r(bn)), zf = Df * Math.cos(r(bf))
  p(`occl.near${bn}_far${bf}.nearZ/farZ/farInFront`, `${f(zn)}/${f(zf)}/${zf < zn}`)
}
// (2) up flips u1 -> u2 -> u1 where the raw normal jumps 37° (U14-3); KCC up = norm(0.65 n + 0.35 radial)
const w = 0.65, rad = { x: 0, y: 1, z: 0 }
for (const flipDeg of [10, 20, 37]) {
  const nA = { x: Math.sin(r(flipDeg / 2)) / Math.SQRT2, y: Math.cos(r(flipDeg / 2)), z: Math.sin(r(flipDeg / 2)) / Math.SQRT2 }
  const nB = { x: -nA.x, y: nA.y, z: -nA.z }
  const up = (n) => { const x = w * n.x + (1 - w) * rad.x, y = w * n.y + (1 - w) * rad.y, z = w * n.z + (1 - w) * rad.z; const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l } }
  const uA = up(nA), uB = up(nB)
  const upJump = Math.acos(uA.x * uB.x + uA.y * uB.y + uA.z * uB.z)
  let fw = { x: 0, y: 0, z: 1 }; const o = { x: 0, y: 0, z: 0 }
  SF.transportFrameInto(fw.x, fw.y, fw.z, uA.x, uA.y, uA.z, o); fw = { ...o }; const f0 = { ...fw }
  for (let i = 0; i < 1; i++) {
    SF.transportFrameInto(fw.x, fw.y, fw.z, uB.x, uB.y, uB.z, o); fw = { ...o }
    SF.transportFrameInto(fw.x, fw.y, fw.z, uA.x, uA.y, uA.z, o); fw = { ...o }
  }
  const h = SF.signedAngleAbout(f0.x, f0.y, f0.z, fw.x, fw.y, fw.z, uA.x, uA.y, uA.z)
  p(`flip.normal${flipDeg}deg.blendedUpJump_deg/headingChangePerRoundTrip_deg`, `${f(upJump * 180 / Math.PI)}/${f(h * 180 / Math.PI)}`)
}
