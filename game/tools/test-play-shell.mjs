// T1 B5a Node check (plan §12.2 B5 → B5a, §10.7): the §10.2 phase machine
// (pure nextPhase + store dispatch) and InputState against a fake DOM.
// Same esbuild-bundle pattern as test-play-frame. Run: node --expose-gc.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-shell.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/ui/playStore'; export * from './play/input/InputState';
      export * from './play/frame/shellStages'; export * from './play/ui/shellRuntime';
      export * from './play/frame/playFrame'; export * from './play/world/moonWorld';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
// WHY: moonWorld builds canvas textures at import/boot — same stub as test-play-frame.
const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined
  : (..._a) => ({ addColorStop() {} })), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
  getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
const M = await import(pathToFileURL(out).href)

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }

// ---- part 1a: §10.2 table (pure) ----
const PHASES = ['LOADING', 'CLICK_TO_PLAY', 'PLAYING', 'PAUSED', 'ERROR']
const EVENTS = ['ready', 'timeout', 'lockAcquired', 'lockLost', 'pauseKey', 'hidden', 'lockError', 'fatal']
const TABLE = {
  'LOADING|ready': 'CLICK_TO_PLAY', 'LOADING|timeout': 'CLICK_TO_PLAY',
  'CLICK_TO_PLAY|lockAcquired': 'PLAYING', 'PAUSED|lockAcquired': 'PLAYING',
  'PLAYING|lockLost': 'PAUSED', 'PLAYING|pauseKey': 'PAUSED', 'PLAYING|hidden': 'PAUSED',
  'PAUSED|lockError': 'PAUSED',
  'LOADING|fatal': 'ERROR', 'CLICK_TO_PLAY|fatal': 'ERROR', 'PLAYING|fatal': 'ERROR', 'PAUSED|fatal': 'ERROR',
}
const hit = new Set()
for (const p of PHASES) for (const e of EVENTS) {
  const want = TABLE[`${p}|${e}`] ?? p
  const got = M.nextPhase(p, e)
  if (TABLE[`${p}|${e}`]) hit.add(`${p}|${e}`)
  ok(got === want, `nextPhase(${p},${e}) = ${got}, want ${want}`)
}
ok(hit.size === Object.keys(TABLE).length, `every §10.2 row hit (${hit.size})`)
// reachability from LOADING: exactly the five phases, nothing else
const seen = new Set(['LOADING']); const q = ['LOADING']
while (q.length) { const p = q.pop(); for (const e of EVENTS) { const t = M.nextPhase(p, e); if (!seen.has(t)) { seen.add(t); q.push(t) } } }
ok(seen.size === 5 && PHASES.every((p) => seen.has(p)), `reachable set = ${[...seen]}`)

// ---- part 1b: store dispatch side-fields ----
const S = M.usePlayStore
S.getState().reset()
ok(S.getState().phase === 'LOADING', 'store starts LOADING')
S.getState().dispatch('lockAcquired', 1)
ok(S.getState().phase === 'LOADING', 'lock while LOADING ignored')
S.getState().dispatch('timeout', 2)
ok(S.getState().phase === 'CLICK_TO_PLAY' && S.getState().loadTimedOut, 'timeout → CLICK_TO_PLAY + streaming note')
S.getState().dispatch('lockAcquired', 3)
ok(S.getState().phase === 'PLAYING', 'click-lock → PLAYING')
S.getState().dispatch('pauseKey', 1234)
ok(S.getState().phase === 'PAUSED' && S.getState().pausedAtMs === 1234, 'P → PAUSED, pausedAtMs recorded')
S.getState().dispatch('lockError', 1300)
ok(S.getState().phase === 'PAUSED' && S.getState().lockHint, 'lockError → hint, stays PAUSED')
S.getState().dispatch('lockAcquired', 2500)
ok(S.getState().phase === 'PLAYING' && !S.getState().lockHint, 'resume clears hint')
S.getState().dispatch('fatal', 2600, 'WebGL context lost')
ok(S.getState().phase === 'ERROR' && S.getState().errorText === 'WebGL context lost', 'fatal → ERROR with text')
S.getState().dispatch('lockAcquired', 2700)
ok(S.getState().phase === 'ERROR', 'ERROR is terminal')
S.getState().reset()
S.getState().dispatch('ready', 0)
ok(S.getState().phase === 'CLICK_TO_PLAY' && !S.getState().loadTimedOut, 'ready → CLICK_TO_PLAY without note')
let renders = 0; const unsub = S.subscribe(() => renders++)
S.getState().setLoad(0.5); S.getState().setLoad(0.5); S.getState().setPhase('CLICK_TO_PLAY')
ok(renders === 1, `unchanged setLoad/setPhase do not notify (${renders})`)
unsub()

// ---- part 1c: InputState with a fake DOM ----
function target() {
  const l = new Map()
  return {
    l,
    addEventListener(t, f) { if (!l.has(t)) l.set(t, new Set()); l.get(t).add(f) },
    removeEventListener(t, f) { l.get(t)?.delete(f) },
    fire(t, ev = {}) { for (const f of l.get(t) ?? []) f(ev) },
    count() { let c = 0; for (const s of l.values()) c += s.size; return c },
  }
}
const el = target(); const doc = target(); const win = target()
let lockReqs = 0
el.requestPointerLock = () => { lockReqs++; return Promise.reject(new Error('refused')) }
doc.pointerLockElement = null
doc.exitPointerLock = () => { doc.pointerLockElement = null; doc.fire('pointerlockchange') }
const lock = () => { doc.pointerLockElement = el; doc.fire('pointerlockchange') }
const key = (t, code, extra = {}) => { const ev = { code, repeat: false, prevented: false,
  preventDefault() { this.prevented = true }, ...extra }; win.fire(t, ev); return ev }

const I = new M.InputState()
I.attach(el, doc, win)
ok(el.count() + doc.count() + win.count() === 6, 'attach registers 6 listeners')
key('keydown', 'KeyW'); key('keydown', 'Space'); doc.fire('mousemove', { movementX: 50, movementY: 5 })
ok(I.moveY === 0 && !I.jumpPressed && I.lookDX === 0, 'keys/mouse ignored while unlocked')
I.requestLock()
ok(lockReqs === 1, 'requestLock calls el.requestPointerLock (rejection swallowed)')
lock()
ok(I.pointerLocked && I.lockChanged, 'pointerlockchange → locked + lockChanged')
doc.fire('mousemove', { movementX: 900, movementY: 900 })
ok(I.lookDX === 0 && I.lookDY === 0, 'first mouse delta after a lock change dropped')
doc.fire('mousemove', { movementX: 900, movementY: -30 })
ok(I.lookDX === M.MOUSE_EVENT_CLAMP_PX && I.lookDY === -30, `per-event clamp (${I.lookDX}, ${I.lookDY})`)
key('keydown', 'KeyW'); key('keydown', 'KeyD'); key('keydown', 'ShiftLeft'); key('keydown', 'KeyC')
ok(I.moveY === 1 && I.moveX === 1 && I.sprint && I.crouch, 'W/D/Shift/C held → move, sprint, crouch')
key('keydown', 'KeyS'); key('keydown', 'KeyA')
ok(I.moveY === 0 && I.moveX === 0, 'opposite keys cancel')
key('keyup', 'KeyS'); key('keyup', 'KeyA'); key('keyup', 'ShiftLeft'); key('keyup', 'KeyC')
ok(I.moveY === 1 && I.moveX === 1 && !I.sprint && !I.crouch, 'keyup releases')
const sp = key('keydown', 'Space')
ok(I.jumpPressed && sp.prevented, 'Space → jumpPressed + preventDefault')
I.jumpPressed = false
key('keydown', 'Space', { repeat: true })
ok(!I.jumpPressed, 'auto-repeat makes no second edge')
key('keydown', 'KeyV'); key('keydown', 'KeyR'); key('keydown', 'KeyP'); key('keydown', 'KeyH')
ok(I.toggleCamEdge && I.respawnEdge && I.pauseEdge && I.toggleHudEdge, 'V/R/P/H edges')
key('keydown', 'KeyV', { repeat: true })
I.clearEdges()
ok(!I.toggleCamEdge && !I.respawnEdge && !I.pauseEdge && !I.toggleHudEdge && !I.lockChanged, 'clearEdges resets all edges')
el.fire('wheel', { deltaY: 120 })
ok(I.zoomDelta === 120, 'wheel accumulates zoomDelta')
win.fire('blur')
ok(I.moveX === 0 && I.moveY === 0 && !I.sprint, 'blur clears held keys')
key('keydown', 'KeyW')
I.exitLock()
ok(!I.pointerLocked && I.moveY === 0 && I.lookDX === 0 && I.zoomDelta === 0, 'lock loss clears held + look')
I.detach()
ok(el.count() + doc.count() + win.count() === 0, 'detach removes every listener')
lock(); key('keydown', 'KeyW')
ok(I.moveY === 0 && !I.pointerLocked, 'detached instance ignores events')

// zero allocation per event (held set is a typed array; handlers bound once)
if (globalThis.gc) {
  const J = new M.InputState(); const e2 = target(); const d2 = target(); const w2 = target()
  d2.pointerLockElement = e2; J.attach(e2, d2, w2)
  const evD = { code: 'KeyW', repeat: false, preventDefault() {} }, evU = { code: 'KeyW', repeat: false, preventDefault() {} }
  const mm = { movementX: 3, movementY: 1 }
  for (let i = 0; i < 20000; i++) { w2.fire('keydown', evD); w2.fire('keyup', evU); d2.fire('mousemove', mm) }
  globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 100000; i++) { w2.fire('keydown', evD); w2.fire('keyup', evU); d2.fire('mousemove', mm) }
  globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
  ok(dh < 64 * 1024, `heap delta ${dh} B over 300,000 events`)
} else ok(false, 'run with node --expose-gc (heap row)')

// ---- part 2a: stage 1 clock (B5b) ----
{
  const C = new M.PlayClock()
  const seq = [['LOADING', 1 / 60], ['CLICK_TO_PLAY', 1 / 60], ['PLAYING', 1 / 60], ['PLAYING', 1 / 60],
    ['PLAYING', 1 / 60], ['PAUSED', 1 / 60], ['PAUSED', 1 / 60], ['PLAYING', 1 / 60], ['PLAYING', 1 / 60], ['PLAYING', 5]]
  const dts = seq.map(([p, d]) => C.step(p, d))
  ok(dts[0] === 0 && dts[1] === 0 && dts[5] === 0 && dts[6] === 0, `dt = 0 unless PLAYING (${dts})`)
  ok(dts[2] === 0 && dts[3] > 0 && dts[7] === 0 && dts[8] > 0, `exactly one dt = 0 frame per resume (${dts})`)
  ok(dts.filter((d, i) => d === 0 && seq[i][0] === 'PLAYING').length === 2, 'two resumes → two zero frames')
  ok(dts[9] === M.MAX_FRAME_DT, `stall clamped to ${M.MAX_FRAME_DT} (${dts[9]})`)
}
// ---- part 2b: stage 11 loading gate ----
{
  const T = M.cfg.PLAY_TUNING
  const G = new M.LoadingGate(T.loadTimeoutS)
  ok(G.step(1 / 60, 0.5) === null && G.step(1 / 60, 1) === null, 'gate: 0.5, 1.0 → still loading')
  ok(G.step(1 / 60, 1) === 'ready', 'gate: second consecutive 1.0 → ready')
  const G2 = new M.LoadingGate(T.loadTimeoutS)
  G2.step(1 / 60, 1); G2.step(1 / 60, 0.9)
  ok(G2.step(1 / 60, 1) === null, 'gate: 1.0, 0.9, 1.0 is not consecutive')
  const G3 = new M.LoadingGate(T.loadTimeoutS); let f = 0, ev = null, pubs = 0
  while (!ev && f < 2000) { ev = G3.step(1 / 60, 0.9); if (G3.publishDue()) pubs++; f++ }
  const tAt = f / 60
  ok(ev === 'timeout' && Math.abs(tAt - T.loadTimeoutS) <= 1 / 60 + 1e-9, `stuck 0.9 → timeout at ${tAt.toFixed(4)} s (${f} frames)`)
  ok(pubs <= Math.ceil(tAt * 10) + 1, `setLoad publish ≤ 10 Hz (${pubs} in ${tAt.toFixed(2)} s)`)
  ok(G3.step(1 / 60, 1) === null, 'gate fires once')
  const G4 = new M.LoadingGate(T.loadTimeoutS)
  ok(G4.step(30, 0.2) === null, 'one 30 s hitch does not time out by itself')
}
// ---- part 2c: shell runtime on a fake DOM ----
{
  const S2 = M.usePlayStore; S2.getState().reset()
  const cv = target(); const dc = target(); const wk = target()
  dc.pointerLockElement = null; dc.visibilityState = 'visible'
  let exits = 0; const inp = { exitLock() { exits++ } }
  const off = M.attachShellRuntime({ canvas: cv, doc: dc, workers: [wk] }, inp, S2, () => 42)
  ok(cv.count() + dc.count() + wk.count() === 5, 'runtime registers 5 listeners')
  S2.getState().dispatch('ready', 0)
  dc.pointerLockElement = cv; dc.fire('pointerlockchange')
  ok(S2.getState().phase === 'PLAYING', 'pointerlockchange (canvas) → PLAYING')
  dc.visibilityState = 'hidden'; dc.fire('visibilitychange')
  ok(S2.getState().phase === 'PAUSED' && S2.getState().pausedAtMs === 42 && exits === 1, 'hidden → PAUSED + exitLock')
  dc.pointerLockElement = null; dc.fire('pointerlockchange')
  ok(S2.getState().phase === 'PAUSED', 'lockLost from PAUSED is a no-op')
  dc.fire('pointerlockerror')
  ok(S2.getState().lockHint, 'pointerlockerror → hint')
  dc.visibilityState = 'visible'; dc.pointerLockElement = cv; dc.fire('pointerlockchange')
  ok(S2.getState().phase === 'PLAYING', 'resume via lock')
  dc.pointerLockElement = null; dc.fire('pointerlockchange')
  ok(S2.getState().phase === 'PAUSED', 'Esc (lockLost) → PAUSED')
  wk.fire('error', { message: 'boom' })
  ok(S2.getState().phase === 'ERROR' && /worker/.test(S2.getState().errorText), 'worker error → ERROR')
  S2.getState().reset(); let prevented = false
  cv.fire('webglcontextlost', { preventDefault() { prevented = true } })
  ok(S2.getState().phase === 'ERROR' && prevented, 'context lost → ERROR')
  off()
  ok(cv.count() + dc.count() + wk.count() === 0, 'runtime detach removes every listener')
}
// ---- part 2d: playFrame wiring (stages 1, 2, 11) with a fake pool ----
{
  function fakePool(meshCount) {
    const records = []
    for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, level: 0,
      originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
    return { records,
      acquire(face, level, ix, iy, ox, oy, oz) { for (let i = 0; i < records.length; i++) { const r = records[i]
        if (r.state === 0) { Object.assign(r, { state: 1, unwanted: 0, owner: null, level, originX: ox, originY: oy, originZ: oz }); return i } } return -1 },
      release(i) { records[i].state = 0; records[i].mesh.visible = false },
      freeCount() { return records.filter((r) => r.state === 0).length },
      inFlightTotal() { return records.filter((r) => r.state === 1).length },
      pump() { for (const r of records) if (r.state === 1) { r.state = 2; r.mesh.visible = true } },
      disposeAll() {} }
  }
  const S3 = M.usePlayStore; S3.getState().reset()
  const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fakePool(M.cfg.PLAY_POOL_OPTS.meshCount) })
  const cam = new M.ThirdPersonCamera(); cam.reset(w.kcc, w.earthDir)
  let exits = 0, respawns = 0
  const inp = { pauseEdge: false, respawnEdge: false, toggleHudEdge: false,
    exitLock() { exits++ }, clearEdges() { this.pauseEdge = this.respawnEdge = this.toggleHudEdge = false } }
  const rs = w.respawnPlayer; w.respawnPlayer = () => { respawns++; rs() }
  const frame = M.createPlayFrame(w, cam, { input: inp, store: S3, now: () => 7 })
  let k = 0; while (S3.getState().phase === 'LOADING' && k < 120) { frame(1 / 60); k++ }
  ok(S3.getState().phase === 'CLICK_TO_PLAY' && !S3.getState().loadTimedOut && k <= 60, `playFrame gate → CLICK_TO_PLAY after ${k} frames`)
  ok(S3.getState().loadProgress === 1, `loadProgress published (${S3.getState().loadProgress})`)
  S3.getState().dispatch('lockAcquired', 8)
  frame(1 / 60); const d0 = frame.clock.dt; frame(1 / 60); const d1 = frame.clock.dt
  ok(d0 === 0 && d1 > 0, `resume frame dt ${d0}, next ${d1}`)
  inp.respawnEdge = true; frame(1 / 60)
  ok(respawns === 1 && frame.clock.dt === 0 && !inp.respawnEdge, 'R edge → respawnPlayer, dt = 0, edge cleared')
  inp.toggleHudEdge = true; frame(1 / 60)
  ok(S3.getState().hudVisible === false, 'H edge toggles hudVisible')
  inp.pauseEdge = true; frame(1 / 60)
  ok(S3.getState().phase === 'PAUSED' && exits === 1 && frame.clock.dt === 0 && S3.getState().pausedAtMs === 7, 'P edge → PAUSED + exitLock, dt = 0')
  frame(1 / 60)
  ok(frame.clock.dt === 0, 'PAUSED frame dt = 0')
  if (globalThis.gc) {
    S3.getState().dispatch('lockAcquired', 9)
    // WHY (B10): 20,000 warm-up frames — a 2,000-frame warm-up leaves V8
    // tiering metadata growing (~70–110 KB here, also on 8f6a97e); --jitless is
    // flat, so it is not play-layer allocation (test-play-perf, CHANGES B10).
    for (let i = 0; i < 20000; i++) frame(1 / 60)
    globalThis.gc(); const h0 = process.memoryUsage().heapUsed
    for (let i = 0; i < 10000; i++) frame(1 / 60)
    globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
    ok(Math.abs(dh) < 64 * 1024, `shell frame heap delta ${dh} B over 10,000 frames`)
  }
}

if (fails.length) { console.log(`test-play-shell FAIL ${fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-shell PASS ${n}/${n}`)