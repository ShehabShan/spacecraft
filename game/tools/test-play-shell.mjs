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
    contents: `export * from './play/ui/playStore'; export * from './play/input/InputState';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out,
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
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

if (fails.length) { console.log(`test-play-shell FAIL ${fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-shell PASS ${n}/${n}`)