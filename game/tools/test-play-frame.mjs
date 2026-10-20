// T1 B4b Node check (plan §12.2 B4b): one playFrame call yields a valid
// driver pose, sky state and LOD request headless. Same esbuild-bundle +
// `document` stub pattern as test-play-world. Run: node --expose-gc.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import * as THREE from 'three'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-frame.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';
      export { RIG } from './render/MultiCameraRig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined
  : (..._a) => ({ addColorStop() {} })), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
  getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
const M = await import(pathToFileURL(out).href)

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }

function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, level: 0,
    originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
  return {
    records, pumps: 0,
    acquire(face, level, ix, iy, ox, oy, oz) {
      for (let i = 0; i < records.length; i++) { const r = records[i]
        if (r.state === 0) { r.state = 1; r.unwanted = 0; r.owner = null; r.level = level; r.originX = ox; r.originY = oy; r.originZ = oz; return i } }
      return -1
    },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (const r of records) if (r.state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (const r of records) if (r.state === 1) c++; return c },
    pump() { this.pumps++; for (const r of records) if (r.state === 1) { r.state = 2; r.mesh.visible = true } },
    disposeAll() {},
  }
}

const fp = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fp })
let lodCalls = 0
const lodUpdate = w.lod.update.bind(w.lod)
w.lod.update = (x, y, z) => { lodCalls++; lodUpdate(x, y, z) }
const cam = new M.ThirdPersonCamera()
cam.reset(w.kcc, w.earthDir)
const frame = M.createPlayFrame(w, cam)
frame(1 / 60)

const d = M.RIG.driver
ok([d.x, d.y, d.z, d.qx, d.qy, d.qz, d.qw].every(Number.isFinite), `driver pose not finite ${JSON.stringify(d)}`)
ok(Math.abs(Math.hypot(d.qx, d.qy, d.qz, d.qw) - 1) < 1e-9, 'driver quat not unit')
const T = M.cfg.PLAY_TUNING
ok(Math.abs(cam.boomLen - T.camDistance) <= T.camClearance, `boom ${cam.boomLen} vs ${T.camDistance}±${T.camClearance}`)
// camera ↔ character distance (render-local) = |boom + pivot| geometry
const alp = w.astroState.localPosF32
const camChar = Math.hypot(d.x - alp[0], d.y - alp[1], d.z - alp[2])
ok(camChar > 5 && camChar < 9, `camera–character distance ${camChar}`)
ok(w.characterRoot.position.x === alp[0] && w.characterRoot.position.z === alp[2], 'characterRoot not at localPosF32')
// Earthrise composition: Earth in the camera's front hemisphere (three −Z forward)
const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(new THREE.Quaternion(d.qx, d.qy, d.qz, d.qw))
const e = w.earthDir
const fe = fwd.x * e.x + fwd.y * e.y + fwd.z * e.z
ok(fe > 0, `Earth behind the camera (fwd·earth ${fe})`)
const ef = new THREE.Vector3(w.earthMesh.position.x - d.x, w.earthMesh.position.y - d.y, w.earthMesh.position.z - d.z).normalize()
const elAngle = Math.acos(Math.max(-1, Math.min(1, fwd.dot(ef)))) * 180 / Math.PI
ok(elAngle < 31, `Earth ${elAngle.toFixed(1)}° off the view axis (FOV half-height 31°)`)
ok(w.sky.bodies[0].active === true, 'Sun inactive')
ok(lodCalls === 1 && fp.pumps === 1, `lod ${lodCalls} pump ${fp.pumps} after 1 frame`)
for (let i = 0; i < 59; i++) frame(1 / 60)
ok(lodCalls === 60 && fp.pumps === 60, `lod ${lodCalls} pump ${fp.pumps} after 60 frames`)
const ready = w.lod.residentAround(w.spawnDir.x, w.spawnDir.y, w.spawnDir.z, T.readyRadiusM)
ok(ready === 1, `residentAround after 60 frames = ${ready}`)

let heapDelta = NaN
if (typeof globalThis.gc === 'function') {
  // WHY: V8 JIT warm-up retains ~30–70 KB over the first ~1,000 frames that
  // does NOT grow with N (diag: 1k → 31 KB, 10k → 18 KB, 50k → 2.8 KB), so the
  // row warms 2,000 frames and measures 10,000 (a per-frame object would show
  // as ≥ 10,000 × ~40 B ≈ 400 KB).
  for (let i = 0; i < 2000; i++) frame(1 / 60)
  globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 10000; i++) frame(1 / 60)
  globalThis.gc(); heapDelta = process.memoryUsage().heapUsed - h0
  ok(Math.abs(heapDelta) < 64 * 1024, `heap delta ${heapDelta} B over 10,000 frames`)
} else fails.push('run with node --expose-gc (heap row)')

console.log(`[test-play-frame] info: boom ${cam.boomLen.toFixed(3)} m, cam–char ${camChar.toFixed(3)} m, fwd·earth ${fe.toFixed(4)}, Earth ${elAngle.toFixed(2)}° off-axis, heap delta ${heapDelta} B`)
if (fails.length) { console.log(`[test-play-frame] FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  - ' + f); process.exit(1) }
console.log(`[test-play-frame] PASS ${n}/${n}`)