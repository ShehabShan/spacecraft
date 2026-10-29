// T6 C1 gate (plan §4.2, §5.0): the T6 registration points — frame hooks (slot order inside
// the real playFrame, cap, clear, zero-GC run), scene contributors (manifest, mount order,
// reverse dispose, rollback on a throwing mount, duplicate ids), the foot-event ring
// (wrap, oldest) and placement reservations. Same esbuild-bundle + `document` stub
// pattern as test-play-frame. Run from game/: node --expose-gc tools/test-t6-hooks.mjs
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-t6-hooks.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/frame/playFrame';
      export * from './play/camera/ThirdPersonCamera'; export * as cfg from './play/world/moonConfig';
      export * from './play/t6/frameHooks'; export * from './play/t6/footEvents';
      export * from './play/t6/placement'; export * from './play/t6/sceneContributors';`,
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
const throws = (f) => { try { f(); return false } catch { return true } }

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

// --- 1. manifest: six tracks, unique ids, all empty stubs
const ids = M.T6_CONTRIBUTORS.map((c) => c.id)
ok(JSON.stringify(ids) === JSON.stringify(['light', 'surface', 'character', 'objects', 'audio', 'world']), `manifest ids ${ids}`)

// --- 2. frame hooks inside the real playFrame: slot order and stage positions
const fp = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fp })
ok(w.t6 && w.t6.frameHooks && w.t6.footEvents && w.t6.placement, 'world.t6 bundle missing')
const cam = new M.ThirdPersonCamera()
cam.frameToward(w.kcc, w.earthDir, w.earthDist)
const frame = M.createPlayFrame(w, cam)
const order = []; let pumpsAtBeforeRender = -1, pumpsAtAfterCamera = -1, seenTelem = null
w.t6.frameHooks.afterTelemetry.add((t, dt) => { order.push('afterTelemetry'); seenTelem = t; ok(dt === 0, `static path dt ${dt}`) })
w.t6.frameHooks.afterCamera.add(() => { order.push('afterCamera'); pumpsAtAfterCamera = fp.pumps })
w.t6.frameHooks.beforeRender.add(() => { order.push('beforeRender'); pumpsAtBeforeRender = fp.pumps })
const p0 = fp.pumps
frame(1 / 60)
ok(order.join(',') === 'afterTelemetry,afterCamera,beforeRender', `slot order ${order}`)
ok(pumpsAtAfterCamera === p0, 'afterCamera ran after stage 10 (pool already pumped)')
ok(pumpsAtBeforeRender === p0 + 1, 'beforeRender ran before stage 10 finished')
ok(seenTelem !== null && typeof seenTelem.grounded === 'boolean', 'hook did not receive telemetry')
frame(1 / 60)
ok(order.length === 6, `hooks per frame: ${order.length / 2}`)

// --- 3. cap, clear, zero-GC run
const L = new M.FrameHookList('t')
for (let i = 0; i < M.FRAME_HOOK_CAP; i++) L.add(() => {})
ok(L.count === M.FRAME_HOOK_CAP && throws(() => L.add(() => {})), 'cap overflow not rejected')
L.clear(); ok(L.count === 0, 'clear')
let calls = 0; L.add(() => { calls++ })
const telem = seenTelem
if (typeof globalThis.gc === 'function') {
  for (let i = 0; i < 20000; i++) L.run(telem, 0.016)
  globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 200000; i++) L.run(telem, 0.016)
  globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
  ok(Math.abs(dh) < 64 * 1024, `run() heap delta ${dh} B over 200,000 runs`)
  console.log(`[test-t6-hooks] info: run() heap delta ${dh} B / 200k`)
}
ok(calls === 220000 || typeof globalThis.gc !== 'function', `hook calls ${calls}`)

// --- 4. contributors: order, reverse dispose, rollback, duplicates
const log = []
const mk = (id, bad = false) => ({ id, mount() { if (bad) throw new Error('boom'); log.push('m:' + id) }, dispose() { log.push('d:' + id) } })
const un = M.mountContributors(w, [mk('a'), mk('b'), mk('c')])
un()
ok(log.join(',') === 'm:a,m:b,m:c,d:c,d:b,d:a', `mount/dispose order ${log}`)
log.length = 0
ok(throws(() => M.mountContributors(w, [mk('a'), mk('b'), mk('x', true)])) && log.join(',') === 'm:a,m:b,d:b,d:a', `rollback ${log}`)
log.length = 0
ok(throws(() => M.mountContributors(w, [mk('a'), mk('a')])) && log.length === 0, 'duplicate id mounted')
// world.dispose drops the frame hooks
w.dispose()
ok(w.t6.frameHooks.afterTelemetry.count === 0 && w.t6.frameHooks.beforeRender.count === 0, 'dispose kept hooks')

// --- 5. foot-event ring
const R = new M.FootEventRing()
ok(R.oldest() === 0 && R.seq === 0, 'fresh ring')
for (let i = 0; i < M.FOOT_EVENT_CAP + 5; i++) R.push(M.FootEventKind.Plant, i % 2, i, i + 0.5, -i, 1.5, 0)
ok(R.seq === M.FOOT_EVENT_CAP + 5 && R.oldest() === 5, `wrap seq ${R.seq} oldest ${R.oldest()}`)
const j = R.index(R.seq - 1), last = M.FOOT_EVENT_CAP + 4
ok(R.pos[j * 3] === last && R.pos[j * 3 + 1] === last + 0.5 && R.pos[j * 3 + 2] === -last && R.foot[j] === last % 2, 'newest event fields')
R.push(M.FootEventKind.Land, M.FOOT_BOTH, 0, 0, 0, 0.2, 3.25)
const k = R.index(R.seq - 1)
ok(R.kind[k] === M.FootEventKind.Land && R.landingSpeed[k] === 3.25 && R.foot[k] === M.FOOT_BOTH, 'land event fields')

// --- 6. placement reservations (Float64, Moon-fixed metres)
const P = new M.PlacementReservations()
const MR = 1737400
P.reserve('outpost', MR, 0, 0, 120)
ok(P.isReserved(MR + 0.01, 119.9, 0) && !P.isReserved(MR, 120.1, 0), 'disc edge at 1.7e6 m')
ok(throws(() => P.reserve('outpost', 0, 0, MR, 10)), 'duplicate placement id accepted')
ok(throws(() => P.reserve('zero', 0, 0, MR, 0)), 'zero radius accepted')
for (let i = 1; i < M.PLACEMENT_CAP; i++) P.reserve('p' + i, 0, i * 1000, MR, 5)
ok(P.count === M.PLACEMENT_CAP && throws(() => P.reserve('over', 0, 0, 0, 1)), 'placement cap')

if (fails.length) { console.log(`[test-t6-hooks] FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  - ' + f); process.exit(1) }
console.log(`[test-t6-hooks] PASS ${n}/${n}`)