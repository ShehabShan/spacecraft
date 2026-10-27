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
// WHY: F3abbbbbc (ADR-016) puts the spawn Earth 31.9° off axis; its disc half-angle there is ~7.3°, so the disc (not its centre) must be inside the 31° half-height.
ok(elAngle < 31 + 7, `Earth ${elAngle.toFixed(1)}° off the view axis (FOV half-height 31° + disc half-angle ~7°)`)
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

// ---- B7c: shell-driven frame — W moves, Space jumps, §9.6 Pause --------
// WHY: a stub store + input (plain objects) drive the real stages 1–8; the
// pause row compares the KCC state and the driver/camera pose bit-for-bit.
const st = { phase: 'PLAYING', dispatch(ev) { if (ev === 'pauseKey') st.phase = 'PAUSED' },
  toggleHud() {}, setLoad() {}, setHud() {} }
const inp = { moveX: 0, moveY: 0, sprint: false, crouch: false, jumpPressed: false,
  lookDX: 0, lookDY: 0, zoomDelta: 0, toggleCamEdge: false, respawnEdge: false,
  pauseEdge: false, toggleHudEdge: false, clearEdges() { this.toggleCamEdge = false;
    this.respawnEdge = false; this.pauseEdge = false; this.toggleHudEdge = false }, exitLock() {} }
const fp2 = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w2 = M.createMoonWorld({ spawnOverride: null, makePool: () => fp2 })
const cam2 = new M.ThirdPersonCamera(); cam2.reset(w2.kcc, w2.earthDir)
const f2 = M.createPlayFrame(w2, cam2, { input: inp, store: { getState: () => st }, now: () => 0 })
f2(1 / 60)
ok(f2.lastTicks === 0, `first PLAYING frame ran ${f2.lastTicks} ticks (resume rule: 0)`)
for (let i = 0; i < 60; i++) f2(1 / 60) // settle
const k2 = w2.kcc, p0 = { ...k2.absPos }
inp.moveY = 1
let ticks = 0
for (let i = 0; i < 120; i++) { f2(1 / 60); ticks += f2.lastTicks }
inp.moveY = 0
const moved = Math.hypot(k2.absPos.x - p0.x, k2.absPos.y - p0.y, k2.absPos.z - p0.z)
ok(ticks === 120, `W hold ran ${ticks} ticks over 120 frames`)
ok(moved > 4 && moved < 8, `W hold 2 s moved ${moved.toFixed(3)} m (walk 3.2 m/s incl. accel)`)
for (let i = 0; i < 90; i++) f2(1 / 60) // stop
inp.jumpPressed = true
let airborne = false
for (let i = 0; i < 30; i++) { f2(1 / 60); if (!k2.grounded) airborne = true }
ok(airborne, 'Space leaves the ground')
for (let i = 0; i < 400 && !k2.grounded; i++) f2(1 / 60)
ok(k2.grounded, 'jump lands within 400 frames')
// §9.6 Pause: 120 PAUSED frames bit-identical, resume frame 0 substeps
inp.moveY = 1; f2(1 / 60); f2(1 / 60)
inp.pauseEdge = true; f2(1 / 60)
ok(st.phase === 'PAUSED', 'P edge → PAUSED')
const snap = () => JSON.stringify([k2.absPos, k2.absVel, k2.fwd, k2.up, cam2.offsetPlanet, cam2.quatPlanet, M.RIG.driver])
const s0 = snap()
for (let i = 0; i < 120; i++) { inp.lookDX = 3; f2(1 / 60) }
inp.lookDX = 0
ok(snap() === s0, 'pose/state changed during 120 PAUSED frames')
st.phase = 'PLAYING'; f2(1 / 60)
ok(f2.lastTicks === 0, `resume frame ran ${f2.lastTicks} substeps`)
f2(1 / 60)
ok(f2.lastTicks === 1, `post-resume frame ran ${f2.lastTicks} ticks`)
// respawn: back at the spawn, TP, dt = 0
inp.respawnEdge = true; f2(1 / 60)
const sp = w2.spawnDir, al = Math.hypot(k2.absPos.x, k2.absPos.y, k2.absPos.z)
const sdot = (k2.pLocal.x * sp.x + k2.pLocal.y * sp.y + k2.pLocal.z * sp.z) / Math.hypot(k2.pLocal.x, k2.pLocal.y, k2.pLocal.z)
ok(f2.lastTicks === 0 && sdot > 0.999999 && !cam2.firstPerson, `respawn: ticks ${f2.lastTicks}, spawn·dir ${sdot}`)
// zero-GC on the shell path (walking in a circle: W + steady orbit)
let heap2 = NaN
if (typeof globalThis.gc === 'function') {
  const run = (N) => { for (let i = 0; i < N; i++) { inp.lookDX = 2; f2(1 / 60) } }
  // WHY: the shell path (controller + KCC + lagged camera) JIT-warms longer
  // than the static path — diag: warm 2k → 10k measured 83 KB, then 30k
  // measured 168 B, 60k 96 B (non-growing). Warm 12,000, measure 10,000.
  run(12000); globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  run(10000); globalThis.gc(); heap2 = process.memoryUsage().heapUsed - h0
  ok(Math.abs(heap2) < 64 * 1024, `shell-path heap delta ${heap2} B over 10,000 walking frames`)
}
inp.moveY = 0; inp.lookDX = 0
console.log(`[test-play-frame] info (B7c): shell-path heap delta ${heap2} B`)
console.log(`[test-play-frame] info (B7c): W 2 s → ${moved.toFixed(3)} m; |abs| ${al.toFixed(1)}`)

console.log(`[test-play-frame] info: boom ${cam.boomLen.toFixed(3)} m, cam–char ${camChar.toFixed(3)} m, fwd·earth ${fe.toFixed(4)}, Earth ${elAngle.toFixed(2)}° off-axis, heap delta ${heapDelta} B`)
if (fails.length) { console.log(`[test-play-frame] FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  - ' + f); process.exit(1) }
console.log(`[test-play-frame] PASS ${n}/${n}`)