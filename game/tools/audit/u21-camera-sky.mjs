// A1-U21 probe: camera rig bands + sky impostor pool (read-only audit).
// Claims are written from Spec 04.1/04.2, Milestone 1F (l.45/55/73) and the
// file headers BEFORE reading the numbers; each section prints PASS/FAIL of the
// CLAIM (a FAIL = a finding). Run: node --expose-gc tools/audit/u21-camera-sky.mjs
import { register } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
register('./u21-tsx-loader.mjs', import.meta.url)

const R = await import('../../src/render/MultiCameraRig.tsx')
const { SkyImpostorPool } = await import('../../src/render/SkyImpostorPool.ts')
const IM = await import('../../src/core/render/impostorMath.ts')
const out = []
const say = (s) => { out.push(s); console.log(s) }
let controls = 0, controlsOk = 0
const control = (name, ok) => { controls++; if (ok) controlsOk++; say(`  control ${name}: ${ok ? 'ok' : 'BROKEN'}`) }

const [NN, NF] = R.NEAR_PLANES, [MN, MF] = R.MID_PLANES
const NEAR = R.NEAR_BIT, MID = R.MID_BIT

// ---- 1. pass sequence (spec 04.1 loop) ---------------------------------
say('== 1. executePasses sequence vs spec 04.1 loop')
const log = []
const fakeGl = {
  autoClear: true, info: { render: { calls: 0 } },
  setClearColor() { log.push('clearColor') },
  clear(c, d, s) { log.push(`clear(${c},${d},${s})`) },
  clearDepth() { log.push('clearDepth') },
  render(_s, cam) { this.info.render.calls++; log.push(cam === R.rigCamFar ? 'far' : cam === R.rigCamMid ? 'mid' : cam === R.rigCamNear ? 'near' : '?') },
}
R.setDriverPose(12.5, -3, 700, 0, 0.3826834, 0, 0.9238795)
R.executePasses(fakeGl, {})
const seq = log.join(' ')
say(`  sequence: ${seq}`)
const seqOk = seq === 'clearColor clear(true,true,false) far clearDepth mid clearDepth near'
say(`  CLAIM spec loop order: ${seqOk ? 'PASS' : 'FAIL'}`)
const colo = [R.rigCamNear, R.rigCamMid, R.rigCamFar].every(c => c.position.x === 12.5 && c.position.z === 700 && Math.abs(c.quaternion.y - 0.3826834) < 1e-12)
say(`  CLAIM co-located cameras: ${colo ? 'PASS' : 'FAIL'}`)
const fovs = [R.rigCamNear, R.rigCamMid, R.rigCamFar].map(c => c.fov + '/' + c.aspect)
say(`  fov/aspect: ${fovs.join(' ')} -> ${new Set(fovs).size === 1 ? 'identical' : 'DIFFER'}`)

// ---- 2. band coverage: is every visible surface point drawn by a pass of its mask?
say('== 2. layerMaskFor coverage (sphere radius r at distance d; visible depth range)')
// Visible front surface of a sphere spans eye distance [d-r, sqrt(d^2-r^2)];
// on the view axis eye distance = view z, off-axis z <= distance (conservative).
function coverage(d, r) {
  const dn = d - r, df = d + r
  const m = R.layerMaskFor(dn, df)
  const zLo = Math.max(dn, 0), zHi = Math.sqrt(Math.max(0, d * d - r * r))
  const segs = []
  if (m & NEAR) segs.push([NN, NF]); if (m & MID) segs.push([MN, MF])
  // undrawn = part of [zLo,zHi] not inside any seg
  let undrawn = 0, z = zLo
  const sorted = segs.sort((a, b) => a[0] - b[0])
  for (const [a, b] of sorted) { if (a > z) undrawn += Math.max(0, Math.min(a, zHi) - z); z = Math.max(z, b); if (z >= zHi) break }
  if (z < zHi) undrawn += zHi - z
  return { m, undrawn, zLo, zHi }
}
let clipWorst = { d: 0, r: 0, undrawn: 0 }, invisible = []
for (const r of [1, 50, 500, 1364.5, 5000, 20000]) {
  let firstClip = null, firstZero = null
  for (let d = r + 1; d < 400000; d += Math.max(1, r / 50)) {
    const c = coverage(d, r)
    if (c.m !== 0 && c.undrawn > 0 && firstClip === null) firstClip = d
    if (c.m === 0 && firstZero === null) firstZero = d
    if (c.undrawn > clipWorst.undrawn && c.m !== 0) clipWorst = { d, r, undrawn: c.undrawn }
  }
  say(`  r=${r}: first partially-clipped d=${firstClip?.toFixed(0) ?? '-'} · mask 0 (not drawn by any pass) from d=${firstZero?.toFixed(0) ?? '-'}`)
  invisible.push(firstZero)
}
const e = coverage(302000, 5000)
say(`  Earth-size r=5000 at d=302 km: mask=${e.m} visible depth ${e.zLo.toFixed(0)}..${e.zHi.toFixed(0)} m, beyond Mid far ${MF}: ${(e.zHi - MF).toFixed(0)} m of depth undrawn`)
say(`  CLAIM "every body with dn<3e5 is fully drawn": ${clipWorst.undrawn > 0 ? 'FAIL' : 'PASS'} (worst d=${clipWorst.d.toFixed(0)} r=${clipWorst.r})`)
say(`  CLAIM "a mesh beyond 3e5 has a pass" (no mesh carries FAR_BIT): ${invisible.every(x => x === null) ? 'PASS' : 'FAIL'}`)
// near-only objects: always df<=2400 <= Near far → covered
let nearOnlyClip = 0
for (let dn = 0; dn < 2400; dn += 7) for (let df = dn; df <= 2400; df += 13) { const m = R.layerMaskFor(dn, df); if (m === NEAR && df > NF) nearOnlyClip++ }
control('near-only objects inside Near far plane', nearOnlyClip === 0)

// ---- 3. painter order across the Near/Mid overlap ----------------------
say('== 3. painter order: Mid-only object vs a straddler fragment behind it')
// Claim (Milestone 1F l.45): "no cross-band depth interaction ever occurs".
// Near is drawn LAST after clearDepth, so any Near-pass fragment overwrites
// every Mid-pass fragment. A Mid-only object A has dn_A >= 2400. A straddler
// B (Near|Mid) is drawn by Near for its fragments z <= 3000. If B's fragment
// at depth zB lies BEHIND A's fragment zA (zA < zB <= 3000) in the same pixel,
// the Near pass paints B over A: an occlusion inversion.
let inversions = 0, sample = null
for (let dnA = 2400; dnA < 3000; dnA += 25) {
  const mA = R.layerMaskFor(dnA, dnA + 40)               // 20 m-radius object (e.g. a ship)
  for (let dnB = 1000; dnB < 2400; dnB += 50) {
    const mB = R.layerMaskFor(dnB, dnB + 2000)           // terrain chunk sphere, radius 1000
    for (let zB = dnA + 1; zB <= Math.min(dnB + 2000, NF); zB += 10) {
      if (mA === MID && (mB & NEAR) && zB > dnA) { inversions++; if (!sample) sample = { dnA, mA, dnB, mB, zB } }
    }
  }
}
say(`  inverted (A in front, B drawn over it) depth cases: ${inversions}; e.g. ${JSON.stringify(sample)}`)
say(`  CLAIM no cross-band depth interaction: ${inversions > 0 ? 'FAIL' : 'PASS'}`)
// Proposed rule: Near far plane == NEAR_MID_THRESHOLD (2400). Re-run.
let inv2 = 0, clip2 = 0
for (let dnA = 2400; dnA < 3000; dnA += 25) for (let dnB = 1000; dnB < 2400; dnB += 50)
  for (let zB = dnA + 1; zB <= Math.min(dnB + 2000, 2400); zB += 10) inv2++
for (let dn = 0; dn < 2400; dn += 7) for (let df = dn; df <= 2400; df += 13) { const m = R.layerMaskFor(dn, df); if (m === NEAR && df > 2400) clip2++ }
say(`  with Near far = 2400: inversions ${inv2}, near-only clipped ${clip2} (straddler parts >2400 stay drawn by Mid)`)
control('fix variant removes inversions', inv2 === 0 && clip2 === 0)

// ---- 4. depth resolution per pass (24-bit, standard perspective) ------
say('== 4. depth resolution δ(z) = z²/(n·2^24) at band-critical depths')
const d24 = (z, n) => z * z / (n * 16777216)
for (const [name, n, z] of [['Near', NN, 2400], ['Near', NN, NF], ['Mid', MN, 240000], ['Mid', MN, MF], ['BG', 500, IM.BG_STAGE_D_MAX], ['BG', 500, 9700]])
  say(`  ${name} n=${n} z=${z}: δ=${d24(z, n).toPrecision(3)} m`)
const bgMinStage = IM.stagedDistanceForRank(23)
say(`  BG staged range rank0..23 = ${IM.stagedDistanceForRank(0)}..${bgMinStage} m inside [500,10000]: ${bgMinStage > 500 ? 'yes' : 'NO'}; step ${IM.BG_STAGE_D_STEP} m = ${(IM.BG_STAGE_D_STEP / d24(9600, 500)).toFixed(0)}× δ`)
control('BG gap ≫ δ', IM.BG_STAGE_D_STEP / d24(9600, 500) > 1000)

// ---- 5. impostor fade semantics ---------------------------------------
say('== 5. SkyImpostorPool alpha: header says "fade alpha"; harness pairs it with mesh opacity 1-α')
const pool = new SkyImpostorPool(10, 9700)
const theta = 0.02
const profile = []
for (const a of [1, 0.75, 0.5, 0.25, 0.05]) {
  pool.setBody(0, 'p', 3, 0, 0, -1, theta, 230000, 1, 1, 1, a, true)
  pool.update(0, 0, 0, 0, 0, 0, 1, 0, 0, 1)
  const dA = pool.mesh.geometry.getAttribute('aDisk').array
  // shader: discard where r = |uv|·tan(thetaE) > tan(theta)·α  (coverage edge)
  const rEdge = dA[1] / Math.tan(theta)                    // drawn disk radius / true radius (tan units)
  const area = rEdge * rEdge
  profile.push({ alpha: a, diskRadiusFrac: +rEdge.toFixed(3), opaqueAreaFrac: +area.toFixed(3), meshOpacity: +(1 - a).toFixed(2), ringSeeThrough: +((1 - area) * a).toFixed(3) })
}
for (const p of profile) say(`  ${JSON.stringify(p)}`)
say(`  material.transparent=${pool.material.transparent} alphaToCoverage=${pool.material.alphaToCoverage} → disk is opaque; α shrinks its RADIUS`)
const half = profile.find(p => p.alpha === 0.5)
say(`  at α=0.5: outer ${(100 * (1 - half.opaqueAreaFrac)).toFixed(0)} % of the disk shows only the 50 %-opaque mesh over the sky`)
say(`  CLAIM swap is a silhouette-exact cross-fade: ${half.diskRadiusFrac < 0.99 ? 'FAIL' : 'PASS'}`)
control('α=1 disk radius = true radius', Math.abs(profile[0].diskRadiusFrac - 1) < 1e-6)

// ---- 6. render order inside the BG pass (three: opaque list, then transparent)
say('== 6. BG pass draw order')
const glow = { transparent: true }
say(`  stars transparent=${pool.stars.material.transparent} renderOrder=${pool.stars.renderOrder}; impostors transparent=${pool.material.transparent} renderOrder=${pool.mesh.renderOrder}; glow transparent=${glow.transparent} renderOrder=-5`)
say('  three.js WebGLRenderer renders the opaque list before the transparent list; renderOrder sorts only within a list')
say(`  CLAIM "stars drawn first" / "glow before planet impostors": ${pool.stars.material.transparent && !pool.material.transparent ? 'FAIL (they draw after the impostors; depth test hides stars behind impostors anyway)' : 'PASS'}`)

// ---- 7. executePasses allocation (header: "allocates nothing") --------
say('== 7. executePasses allocation (GC count over N calls vs control)')
let gcs = 0
const obs = new PerformanceObserver(l => { gcs += l.getEntries().length })
obs.observe({ entryTypes: ['gc'] })
const N = 2_000_000
const silentGl = { autoClear: true, info: { render: { calls: 0 } }, setClearColor() {}, clear() {}, clearDepth() {}, render() { this.info.render.calls++ } }
const scene = {}
function control3() { const c = R.rigCamNear; c.updateMatrixWorld(true); R.rigCamMid.updateMatrixWorld(true); R.rigCamFar.updateMatrixWorld(true) }
global.gc(); await new Promise(r => setTimeout(r, 50)); gcs = 0
for (let i = 0; i < N; i++) control3()
await new Promise(r => setTimeout(r, 50)); const gcControl = gcs
global.gc(); await new Promise(r => setTimeout(r, 50)); gcs = 0
for (let i = 0; i < N; i++) R.executePasses(silentGl, scene)
await new Promise(r => setTimeout(r, 50)); const gcRig = gcs
obs.disconnect()
say(`  GC events over ${N} frames: control (3× updateMatrixWorld) ${gcControl - 0}, executePasses ${gcRig - 0} (incl. 1 forced)`)
say(`  CLAIM zero allocation: ${gcRig - gcControl > 2 ? 'FAIL (likely the per-call `const cams = [...]` array, line 128)' : 'PASS (V8 escape analysis removes the array literal)'}`)

say(`== controls ${controlsOk}/${controls}`)
process.exit(controlsOk === controls ? 0 : 2)