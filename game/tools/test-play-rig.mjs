// T1 B6 Node check (plan §12.2 B6, §7.6, K13): builds the articulated
// astronaut headless and asserts every §7.6 rig-build check plus the
// RestAnimator seam (identity pose, visibility, teardown, zero-GC update).
// WHY: esbuild bundle (test-play-world pattern) — AstronautRig imports
// NEAR_BIT from MultiCameraRig.tsx (JSX), which Node cannot load directly.
// Run: `node --expose-gc tools/test-play-rig.mjs`. Exit 1 on failure.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-rig.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/character/AstronautRig'; export * from './play/character/CharacterAnimator';
      export * from './play/character/CharacterTelemetry'; export { NEAR_BIT } from './render/MultiCameraRig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)
const THREE = await import('three')

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }
const near = (a, b, eps) => Math.abs(a - b) <= eps

// ---- §7.2 expected table: joint → [parent, rest X, rest Y] (rig space)
const EXP = {
  hips: [null, 0, 0.92], spine: ['hips', 0, 1.00], chest: ['spine', 0, 1.20],
  neck: ['chest', 0, 1.52], head: ['neck', 0, 1.58],
  upperArmL: ['chest', -0.30, 1.48], lowerArmL: ['upperArmL', -0.30, 1.18], handL: ['lowerArmL', -0.30, 0.92],
  upperArmR: ['chest', 0.30, 1.48], lowerArmR: ['upperArmR', 0.30, 1.18], handR: ['lowerArmR', 0.30, 0.92],
  upperLegL: ['hips', -0.11, 0.86], lowerLegL: ['upperLegL', -0.11, 0.46], footL: ['lowerLegL', -0.11, 0.06],
  upperLegR: ['hips', 0.11, 0.86], lowerLegR: ['upperLegR', 0.11, 0.46], footR: ['lowerLegR', 0.11, 0.06],
}

const GC = 0.02
const rig = M.buildAstronautRig(GC)
const { root, joints } = rig

// Rig-space measurement: zero the boot-constant root transform, measure,
// restore (rig space = rig.root local frame, soles on y = 0).
function inRigSpace(fn) {
  const p = root.position.clone(), q = root.quaternion.clone()
  root.position.set(0, 0, 0); root.quaternion.identity(); root.updateMatrixWorld(true)
  try { return fn() } finally { root.position.copy(p); root.quaternion.copy(q); root.updateMatrixWorld(true) }
}
const wp = (o) => o.getWorldPosition(new THREE.Vector3())
const meshBox = (o) => { const b = new THREE.Box3(); o.children.filter((c) => c.isMesh).forEach((c) => b.expandByObject(c)); return b }

// 1. joints: keys = JOINTS in order, 17, parents per §7.2
const keys = Object.keys(joints)
ok(M.JOINTS.length === 17, `JOINTS length ${M.JOINTS.length}`)
ok(keys.length === 17 && keys.every((k, i) => k === M.JOINTS[i]), `joint keys order ${keys.join(',')}`)
for (const name of M.JOINTS) {
  const [parent] = EXP[name]
  const want = parent === null ? root : joints[parent]
  ok(joints[name].parent === want, `${name} parent ${joints[name].parent?.name} ≠ ${parent ?? 'rig.root'}`)
  ok(joints[name].isGroup === true, `${name} is not a THREE.Group pivot`)
}
ok(rig.restHipsY === M.RIG_DIMS.hipsY && rig.restHipsY === 0.92, `restHipsY ${rig.restHipsY}`)

// 2. rest world pivots match Rest Y + ±X to 1e-6
inRigSpace(() => {
  for (const name of M.JOINTS) {
    const [, x, y] = EXP[name]; const p = wp(joints[name])
    ok(near(p.x, x, 1e-6) && near(p.y, y, 1e-6) && near(p.z, 0, 1e-6), `${name} rest pivot (${p.x}, ${p.y}, ${p.z}) ≠ (${x}, ${y}, 0)`)
  }
  // 3. soles on the contact plane (boot world-bbox min Y = 0)
  for (const f of ['footL', 'footR']) {
    const b = meshBox(joints[f])
    ok(near(b.min.y, 0, 1e-6), `${f} sole min Y ${b.min.y}`)
    ok(near(b.min.z, M.RIG_DIMS.toeZ, 1e-6) && near(b.max.z, M.RIG_DIMS.heelZ, 1e-6), `${f} toe/heel z ${b.min.z}/${b.max.z}`)
  }
  // derived extents (§7.2 notes)
  const helm = meshBox(joints.head)
  ok(near(helm.max.y, M.RIG_DIMS.height, 1e-6), `helmet top ${helm.max.y} ≠ 1.87`)
  const visor = joints.head.children.find((c) => c.isMesh && c.material.emissiveIntensity === 0.9)
  ok(visor !== undefined, 'visor mesh missing')
  if (visor) {
    const vc = wp(visor)
    ok(vc.z < 0, `visor centre rig z ${vc.z} not < 0`)
    ok(near(vc.y, M.RIG_DIMS.eyeY, 1e-6), `visor centre y ${vc.y} ≠ eyeY 1.67`)
  }
  const hand = meshBox(joints.handR)
  ok(near(hand.min.y, 0.80, 1e-6), `hand reach ${hand.min.y} ≠ 0.80`)
  const pack = meshBox(joints.chest).max.z
  ok(near(pack, 0.32, 1e-6), `backpack rear z ${pack} ≠ 0.32`)

  // 5. sign-table spot check: Rx(+0.5) on upperLegR moves the right boot toward −Z
  const before = meshBox(joints.footR).getCenter(new THREE.Vector3())
  joints.upperLegR.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.5)
  root.updateMatrixWorld(true)
  const after = meshBox(joints.footR).getCenter(new THREE.Vector3())
  ok(after.z < before.z - 0.1, `Rx(+0.5) boot z ${before.z.toFixed(3)} → ${after.z.toFixed(3)} (not toward −Z)`)
  const leftZ = meshBox(joints.footL).getCenter(new THREE.Vector3()).z
  ok(near(leftZ, before.z, 1e-9), 'left boot moved with the right hip')
  joints.upperLegR.quaternion.identity()
})

// 4. root transform: −groundClearance, Ry(−π/2) facing fix
ok(root.position.y === -GC && root.position.x === 0 && root.position.z === 0, `root position ${root.position.toArray()}`)
ok(M.buildAstronautRig(0.05).root.position.y === -0.05, 'groundClearance parameter ignored')
ok(M.buildAstronautRig().root.position.y === -0.02, 'default groundClearance ≠ 0.02')
const f = new THREE.Vector3(0, 0, -1).applyQuaternion(root.quaternion)
const r = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion)
ok(near(f.x, 1, 1e-9) && near(f.y, 0, 1e-9) && near(f.z, 0, 1e-9), `facing (0,0,−1) → ${f.toArray()}`)
ok(near(r.x, 0, 1e-9) && near(r.y, 0, 1e-9) && near(r.z, 1, 1e-9), `right (1,0,0) → ${r.toArray()}`)
// proper rotation (no mirroring): det = +1 ⇔ up stays up
const u = new THREE.Vector3(0, 1, 0).applyQuaternion(root.quaternion)
ok(near(u.y, 1, 1e-9), `up (0,1,0) → ${u.toArray()}`)

// 6. counts + layers
const meshes = []; let all = 0, badMask = 0
root.traverse((o) => { all++; if (o.isMesh) meshes.push(o); if (o.layers.mask !== M.NEAR_BIT) badMask++ })
ok(meshes.length === 20, `mesh count ${meshes.length}`)
ok(meshes.filter((m) => m.geometry.type === 'BoxGeometry').length === 18, 'box mesh count ≠ 18')
ok(rig.geometries.length === 3, `geometries ${rig.geometries.length}`)
ok(rig.materials.length === 4, `materials ${rig.materials.length}`)
ok(new Set(meshes.map((m) => m.geometry)).size === 3 && meshes.every((m) => rig.geometries.includes(m.geometry)), 'meshes do not share the 3 geometries')
ok(new Set(meshes.map((m) => m.material)).size === 4 && meshes.every((m) => rig.materials.includes(m.material)), 'meshes do not share the 4 materials')
ok(badMask === 0, `${badMask}/${all} objects without layers.mask === NEAR_BIT`)
ok(meshes.every((m) => m.matrixAutoUpdate === false), 'a static mesh keeps matrixAutoUpdate')
ok(M.JOINTS.every((k) => joints[k].matrixAutoUpdate === true), 'a joint lost matrixAutoUpdate')
ok(meshes.every((m) => m.castShadow === false && m.frustumCulled === true), 'shadow/frustum flags changed')

// 7. RestAnimator seam (K13): identity pose, rest hips, visibility, teardown
const parent = new THREE.Group()
const anim = new M.RestAnimator(M.buildAstronautRig(GC))
parent.add(anim.root)
ok(anim.stateName === 'Rest', `stateName ${anim.stateName}`)
ok(anim.root === anim.rig.root, 'animator root ≠ rig.root')
for (const k of M.JOINTS) anim.rig.joints[k].quaternion.set(0.1, 0.2, 0.3, 0.9).normalize()
anim.rig.joints.hips.position.y = 0.5
const telem = M.createTelemetry()
anim.update(telem, 1 / 60)
ok(M.JOINTS.every((k) => { const q = anim.rig.joints[k].quaternion; return q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1 }), 'RestAnimator did not write identity')
ok(anim.rig.joints.hips.position.y === 0.92, `RestAnimator hips y ${anim.rig.joints.hips.position.y}`)
anim.setVisible(false); ok(anim.root.visible === false, 'setVisible(false)')
anim.setVisible(true); ok(anim.root.visible === true, 'setVisible(true)')
ok(Object.keys(telem).length === 15, `telemetry fields ${Object.keys(telem).length}`)
ok(new M.RestAnimator().rig.root.position.y === -0.02, 'RestAnimator default rig')
// zero-GC update (same heap bound as test-play-shell)
if (typeof globalThis.gc === 'function') {
  for (let i = 0; i < 1000; i++) anim.update(telem, 1 / 60)
  globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 10000; i++) anim.update(telem, 1 / 60)
  globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
  ok(dh < 64 * 1024, `RestAnimator.update heap +${dh} B over 10,000 frames`)
} else ok(false, 'run with node --expose-gc')
let disposed = 0
for (const g of anim.rig.geometries) g.addEventListener('dispose', () => disposed++)
for (const m of anim.rig.materials) m.addEventListener('dispose', () => disposed++)
anim.dispose()
ok(anim.root.parent === null && parent.children.length === 0, 'dispose did not detach rig.root')
ok(disposed === 7, `dispose fired ${disposed}/7 dispose events`)

// 8. Node MT5 analog (B6 outcome): mounted in the play world, after one frame
// the soles sit on the terrain (no float, sink ≤ 2 cm) and the visor faces
// kcc.fwd (away from the trailing camera, toward Earth).
{
  const W = path.join(game, 'node_modules', '.cache', 'test-play-rig-world.bundle.mjs')
  await build({
    stdin: {
      contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
        export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';
        export { terrainHeight } from './core/terrain/terrainField';`,
      resolveDir: path.join(game, 'src'), loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'esm', outfile: W, jsx: 'automatic',
    external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
  })
  const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined
    : (..._a) => ({ addColorStop() {} })), set: () => true })
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
    getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
  const P = await import(pathToFileURL(W).href)
  const recs = []
  for (let i = 0; i < P.cfg.PLAY_POOL_OPTS.meshCount; i++) recs.push({ state: 0, unwanted: 0, owner: null, level: 0,
    originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
  const fp = { records: recs, acquire() { return -1 }, release() {}, freeCount() { return recs.length },
    inFlightTotal() { return 0 }, pump() {}, disposeAll() {} }
  const w = P.createMoonWorld({ spawnOverride: null, makePool: () => fp })
  const cam = new P.ThirdPersonCamera(); cam.reset(w.kcc, w.earthDir)
  const frame = P.createPlayFrame(w, cam)
  frame(1 / 60)
  w.sceneRoot.updateMatrixWorld(true)
  const an = w.animator
  ok(an.root.parent === w.characterRoot, 'rig.root not mounted under characterRoot')
  ok(an.stateName === 'Rest', `world animator ${an.stateName}`)
  const o = w.core.getOrigin(), R = P.cfg.MOON_R, S = w.spawnDir
  const ground = R + P.terrainHeight(S.x, S.y, S.z)
  let worst = -Infinity, best = Infinity
  for (const f of ['footL', 'footR']) {
    const b = new THREE.Box3()
    an.rig.joints[f].children.forEach((c) => b.expandByObject(c))
    // lowest corner (radially) of the boot box in render-local → moon-centred
    const pts = [b.min.x, b.max.x].flatMap((x) => [b.min.y, b.max.y].flatMap((y) => [b.min.z, b.max.z].map((z) => [x, y, z])))
    for (const [x, y, z] of pts) {
      const rr = Math.hypot(x + o.x, y + o.y, z + o.z) - ground
      worst = Math.max(worst, rr); best = Math.min(best, rr)
    }
  }
  // WHY: boxes are axis-aligned in render-local, so bounds are loose; the
  // radial min over corners is a conservative sole estimate — judge the
  // exact sole point (characterRoot origin − 0 along up) too.
  const cr = w.characterRoot.position
  const contact = Math.hypot(cr.x + o.x, cr.y + o.y, cr.z + o.z) - P.cfg.MOON_ASTRONAUT.groundClearance - ground
  ok(Math.abs(contact) <= 0.02, `sole contact ${contact.toFixed(4)} m off terrain (float/sink > 2 cm)`)
  const vis = an.rig.joints.head.children.find((c) => c.isMesh && c.material.emissiveIntensity === 0.9)
  const vc = vis.getWorldPosition(new THREE.Vector3())
  const hc = an.rig.joints.head.getWorldPosition(new THREE.Vector3())
  const kf = new THREE.Vector3(1, 0, 0).applyQuaternion(w.characterRoot.quaternion)
  const vf = vc.sub(hc).normalize().dot(kf)
  ok(vf > 0.9, `visor not along kcc.fwd (dot ${vf.toFixed(3)})`)
  console.log(`[test-play-rig] info: sole contact ${contact.toFixed(4)} m, boot-bbox radial range [${best.toFixed(3)}, ${worst.toFixed(3)}] m, visor·fwd ${vf.toFixed(3)}`)
}

if (fails.length) { console.log(`test-play-rig FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-rig PASS ${n}/${n}`)