// T1 B10 Node check (plan §11.5 zero allocation, §10.7 HUD throttle): 10,000
// shell playFrame calls at 144 Hz on fakes (stub pool, real KCC + controller +
// camera + ProceduralAnimator + LOD) — retained (post-gc) heap ≈ 0 with no trend
// (a leak check; allocation is tools/test-alloc-gate.mjs, ADR-005); HUD
// publishes ≤ 10 per simulated second. Same esbuild-bundle + `document` stub
// pattern as test-play-frame. Run: node --expose-gc tools/test-play-perf.mjs
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-perf.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';
      export * from './play/ui/hudPublisher'; export { makeHud } from './play/ui/playStore';`,
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
if (!globalThis.gc) { console.log('test-play-perf needs node --expose-gc'); process.exit(2) }

// Allocation-free stub pool (index loops only, so the stub itself adds nothing).
function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, level: 0,
    originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
  return {
    records,
    acquire(face, level, ix, iy, ox, oy, oz) {
      for (let i = 0; i < records.length; i++) { const r = records[i]
        if (r.state === 0) { r.state = 1; r.unwanted = 0; r.owner = null; r.level = level; r.originX = ox; r.originY = oy; r.originZ = oz; return i } }
      return -1
    },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 1) c++; return c },
    pump() { for (let i = 0; i < records.length; i++) { const r = records[i]; if (r.state === 1) { r.state = 2; r.mesh.visible = true } } },
    disposeAll() {},
  }
}

let lastHud = null, prevHud = null, hudSets = 0, alternated = true
const st = {
  phase: 'PLAYING', hudVisible: true,
  dispatch(ev) { if (ev === 'pauseKey') st.phase = 'PAUSED' },
  toggleHud() { st.hudVisible = !st.hudVisible }, setLoad() {},
  setHud(h) { if (prevHud !== null && h !== prevHud) alternated = false; prevHud = lastHud; lastHud = h; hudSets++ },
}
const inp = { moveX: 0, moveY: 0, sprint: false, crouch: false, jumpPressed: false,
  lookDX: 0, lookDY: 0, zoomDelta: 0, toggleCamEdge: false, respawnEdge: false,
  pauseEdge: false, toggleHudEdge: false, clearEdges() { this.toggleCamEdge = false;
    this.respawnEdge = false; this.pauseEdge = false; this.toggleHudEdge = false }, exitLock() {} }

const fp = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fp })
const cam = new M.ThirdPersonCamera(); cam.reset(w.kcc, w.earthDir)
const frame = M.createPlayFrame(w, cam, { input: inp, store: { getState: () => st }, now: () => 0 })
const DT = 1 / 144
// Scripted walk / sprint / turn / jump cycle; primitive writes only (no allocation).
function drive(i) {
  const c = i % 1440
  inp.moveY = c < 1150 ? 1 : 0
  inp.sprint = c >= 400 && c < 900
  inp.moveX = c >= 900 && c < 1100 ? 0.6 : 0
  inp.lookDX = c % 288 < 30 ? 3 : 0
  inp.jumpPressed = c >= 1000 && c < 1006
}

// WHY (B10 decision): 20,000 warm-up frames. With a 2,000-frame warm-up the
// heap creeps ~15 KB / 1,000 frames, but the same run under --jitless is flat
// to the byte and the creep vanishes once tiering settles (~20k frames) — it is
// V8 code/feedback metadata, not play-layer allocation (diag in CHANGES B10).
for (let i = 0; i < 20000; i++) { drive(i); frame(DT) }
const pub0 = frame.hud.publishes
const samples = []
globalThis.gc(); samples.push(process.memoryUsage().heapUsed)
let maxWin = 0, win = 0, winPub0 = frame.hud.publishes, states = new Set()
for (let b = 0; b < 10; b++) {
  for (let i = 0; i < 1000; i++) {
    drive(20000 + b * 1000 + i); frame(DT)
    if (++win === 144) { const p = frame.hud.publishes; if (p - winPub0 > maxWin) maxWin = p - winPub0; winPub0 = p; win = 0 }
  }
  globalThis.gc(); samples.push(process.memoryUsage().heapUsed)
  states.add(lastHud.state)
}
const dh = samples[samples.length - 1] - samples[0]
// least-squares slope over the 11 samples, bytes per 1,000 frames
const xm = 5, ym = samples.reduce((a, v) => a + v, 0) / samples.length
let num = 0, den = 0
for (let i = 0; i < samples.length; i++) { num += (i - xm) * (samples[i] - ym); den += (i - xm) ** 2 }
const slope = num / den
// WHY (F1bcb, ADR-005): these post-gc rows measure RETENTION (leaks) only — gc() frees
// transient garbage first, so ~10 KB/frame of churn passes here (A1-U09-1). Per-frame
// allocation is gated by `node --expose-gc tools/test-alloc-gate.mjs` (ADR-002).
ok(Math.abs(dh) < 64 * 1024, `retained heap delta (post-gc) ${dh} B over 10,000 frames (bound 64 KB; leaks only)`)
ok(Math.abs(slope) < 2048, `retained heap trend (post-gc) ${slope.toFixed(0)} B / 1,000 frames (bound 2 KB; leaks only)`)

// §10.7 HUD throttle at 144 Hz
const pubs = frame.hud.publishes - pub0, simS = 10000 * DT
ok(pubs <= Math.ceil(simS * 10) + 1, `${pubs} publishes in ${simS.toFixed(1)} s (≤ 10/s)`)
ok(pubs >= simS * 9, `${pubs} publishes in ${simS.toFixed(1)} s (expected ≈ 9.6/s)`)
ok(maxWin <= 10, `max ${maxWin} publishes in any simulated second`)
ok(hudSets === frame.hud.publishes, `setHud ${hudSets} vs publishes ${frame.hud.publishes}`)
ok(alternated && lastHud !== prevHud, 'two boot buffers used alternately')
ok(Math.abs(frame.hud.fps - 144) < 1, `FPS EMA ${frame.hud.fps.toFixed(2)} at 144 Hz`)
ok([lastHud.speed, lastHud.lat, lastHud.lon, lastHud.altAGL].every(Number.isFinite), `HUD numbers finite ${JSON.stringify(lastHud)}`)
ok(lastHud.lat >= -90 && lastHud.lat <= 90 && Math.abs(lastHud.lon) <= 180, 'lat/lon in range')
ok(states.size >= 2, `animator states seen in the HUD: ${[...states].join(',')}`)
ok(lastHud.hintOn === false && frame.hud.hintOn === false, 'controls hint faded after 8 s / 20 m')
// WHY: pool health (freeCount ≥ 6) is judged on the REAL pool in MT15; the
// instant-pump stub fills to the LOD's freeCount ≤ 2 stop, so it is printed only.
const freeNow = fp.freeCount()
ok(w.kcc.integrity === undefined || Number.isFinite(w.kcc.absPos.x), 'KCC state finite')

// FPS keeps reading while PAUSED (raw delta, §10.5); the hint latch stays off
st.phase = 'PAUSED'
const pt = frame.hud.playTime
for (let i = 0; i < 90; i++) frame(1 / 30)
ok(Math.abs(frame.hud.fps - 30) < 1, `PAUSED FPS EMA ${frame.hud.fps.toFixed(2)} at 30 Hz`)
ok(frame.hud.playTime === pt, 'PAUSED frames add no PLAYING time')

// Hint fade unit rows (fresh publisher)
const fakeK = { grounded: true, telemetry: { relSpeed: 0, upX: 0, upY: 1, upZ: 0, altAGL: 0 } }
const sink = { setHud() {} }
const h1 = new M.HudPublisher(0.1)
for (let i = 0; i < 60 * 7.9; i++) h1.step(1 / 60, 1 / 60, fakeK, 'Idle', false, sink)
ok(h1.hintOn, 'hint still on at 7.9 s idle')
for (let i = 0; i < 12; i++) h1.step(1 / 60, 1 / 60, fakeK, 'Idle', false, sink)
ok(!h1.hintOn, 'hint off after 8 s')
const h2 = new M.HudPublisher(0.1); fakeK.telemetry.relSpeed = 6.5
for (let i = 0; i < 60 * 3.2; i++) h2.step(1 / 60, 1 / 60, fakeK, 'Run', false, sink)
ok(!h2.hintOn && h2.playTime < 8, `hint off after ${h2.walked.toFixed(1)} m walked`)
const h3 = new M.HudPublisher(0.1); fakeK.telemetry.relSpeed = 0
for (let i = 0; i < 600; i++) h3.step(1 / 60, 0, fakeK, 'Idle', false, sink)
ok(h3.hintOn, 'hint unaffected by non-PLAYING (simDt 0) frames')

console.log(`  stub pool freeCount ${freeNow} (informational)`)
console.log(`  heap samples (KB): ${samples.map((s) => (s / 1024).toFixed(0)).join(' ')}`)
if (fails.length) { console.log(`test-play-perf FAIL ${fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-perf PASS ${n}/${n} (heap Δ ${dh} B, trend ${slope.toFixed(0)} B/1k frames, ${pubs} publishes / ${simS.toFixed(1)} s, max ${maxWin}/s)`)