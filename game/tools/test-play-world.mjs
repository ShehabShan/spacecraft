// T1 B4a Node check (plan §12.2 B4a, §6.2–§6.4, K10/K11): builds the full play
// world headless (fake pool — TerrainMeshPool spawns Workers) and checks the
// spawn, scene graph, layer masks, zero-GC applySkyState and respawn.
// WHY: esbuild bundle, not the ts-resolve loader — skyState imports
// MultiCameraRig.tsx (JSX), which Node type-stripping cannot load.
// Run: `node --expose-gc tools/test-play-world.mjs`. Exit 1 on failure.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-world.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonWorld'; export * from './play/world/skyState';
      export * as cfg from './play/world/moonConfig'; export { NEAR_BIT, MID_BIT } from './render/MultiCameraRig';
      export { terrainHeight } from './core/terrain/terrainField';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
// WHY: SkyImpostorPool.makeGlowQuad paints a CanvasTexture via `document`;
// Node has none, so a no-op 2D canvas stub stands in (test-only, B4a).
const noop2d = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined
  : (..._a) => ({ addColorStop() {} })), set: () => true })
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {},
  getContext: () => noop2d, addEventListener() {}, removeEventListener() {} }) }
const M = await import(pathToFileURL(out).href)

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }

// ---- fake pool: TerrainMeshPool record shape (state 0 free / 1 in flight / 2 resident)
function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, level: 0,
    originX: 0, originY: 0, originZ: 0, mesh: { visible: false, layers: { mask: 0 } } })
  return {
    records, pumps: 0, disposed: false,
    acquire(face, level, ix, iy, ox, oy, oz) {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        if (r.state === 0) { Object.assign(r, { state: 1, unwanted: 0, owner: null, level, originX: ox, originY: oy, originZ: oz }); return i }
      }
      return -1
    },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (const r of records) if (r.state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (const r of records) if (r.state === 1) c++; return c },
    pump() { this.pumps++; for (const r of records) if (r.state === 1) { r.state = 2; r.mesh.visible = true } },
    disposeAll() { this.disposed = true },
  }
}

const fp = fakePool(M.cfg.PLAY_POOL_OPTS.meshCount)
const w = M.createMoonWorld({ spawnOverride: null, makePool: () => fp })
const R = M.cfg.MOON_R

// ---- spawn = B2 pin, KCC at it -----------------------------------------
const S = { x: 0.32058829107484366, y: -0.03682548816622783, z: 0.9465025256421825 }
ok(Math.abs(w.spawnDir.x - S.x) < 1e-9 && Math.abs(w.spawnDir.y - S.y) < 1e-9 && Math.abs(w.spawnDir.z - S.z) < 1e-9,
  `spawn pin: got ${JSON.stringify(w.spawnDir)}`)
const a = w.kcc.absPos, aL = Math.hypot(a.x, a.y, a.z)
const hS = M.terrainHeight(S.x, S.y, S.z)
const dirErr = Math.hypot(a.x / aL - S.x, a.y / aL - S.y, a.z / aL - S.z)
ok(dirErr < 1e-6, `KCC direction off spawn by ${dirErr}`)
ok(Math.abs(aL - (R + hS)) < 1.0, `KCC radius ${aL} vs surface ${R + hS}`)

// ---- scene graph --------------------------------------------------------
let dl = 0, amb = 0; const seen = new Set()
w.sceneRoot.traverse((o) => { seen.add(o); if (o.isDirectionalLight) dl++; if (o.isAmbientLight) amb++ })
ok(dl === 2, `directional lights ${dl}`); ok(amb === 1, `ambient lights ${amb}`)
for (const [name, obj] of [['earth', w.earthMesh], ['glow', w.glow], ['stars', w.sky.stars],
  ['impostors', w.sky.mesh], ['characterRoot', w.characterRoot]]) ok(seen.has(obj), `scene lacks ${name}`)
ok(w.spinGroup.children.some((c) => c.isMesh && c.geometry.type === 'SphereGeometry'), 'scene lacks core shell')

// ---- LOD warm-up at the spawn eye (planet frame; spin 0, Q8) -------------
const up = { x: a.x / aL, y: a.y / aL, z: a.z / aL }
const eyeH = 1.4
for (let f = 0; f < 60; f++) {
  w.lod.update(a.x + up.x * eyeH, a.y + up.y * eyeH, a.z + up.z * eyeH)
  w.pool.pump()
}
const ready = w.lod.residentAround(S.x, S.y, S.z, M.cfg.PLAY_TUNING.readyRadiusM)
ok(ready === 1, `residentAround after warm-up = ${ready}`)

// ---- applySkyState at the spawn eye pose -----------------------------------
const o = w.core.getOrigin()
const px = a.x - o.x + up.x * M.cfg.MOON_ASTRONAUT.eyeHeight
const py = a.y - o.y + up.y * M.cfg.MOON_ASTRONAUT.eyeHeight
const pz = a.z - o.z + up.z * M.cfg.MOON_ASTRONAUT.eyeHeight
M.applySkyState(w, px, py, pz, 0, 0, 0, 1)
ok(w.characterRoot.layers.mask === M.NEAR_BIT, `characterRoot mask ${w.characterRoot.layers.mask}`)
ok(w.earthMesh.layers.mask !== 0, 'Earth mask is 0')
ok(w.sky.bodies[0].active === true, 'Sun slot 0 inactive')
let resident = 0, near300 = 0, badNear = 0
for (const r of fp.records) {
  if (r.state !== 2) { ok(r.mesh.layers.mask === 0, 'non-resident record has a mask'); continue }
  resident++
  if (Math.hypot(r.originX - a.x, r.originY - a.y, r.originZ - a.z) < 300) {
    near300++; if ((r.mesh.layers.mask & M.NEAR_BIT) === 0) badNear++
  }
}
ok(near300 > 0, 'no resident record within 300 m'); ok(badNear === 0, `${badNear} records within 300 m lack NEAR_BIT`)

// ---- zero-GC: 1,000 applySkyState calls -------------------------------------
let heapDelta = NaN
if (typeof globalThis.gc === 'function') {
  for (let i = 0; i < 200; i++) M.applySkyState(w, px, py, pz, 0, 0, 0, 1)
  globalThis.gc(); const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 1000; i++) M.applySkyState(w, px, py, pz, 0, 0, 0, 1)
  globalThis.gc(); heapDelta = process.memoryUsage().heapUsed - h0
  ok(Math.abs(heapDelta) < 64 * 1024, `heap delta ${heapDelta} B over 1,000 applySkyState`)
} else fails.push('run with node --expose-gc (heap row)')

// ---- entity sync (B4c fix): the core entity mirrors the KCC at boot, the
// origin sits on the spawn's 256 m lattice and the render-local stays ≤ 1,024 m
const eAbs = w.astroState.absPos, kAbs = w.kcc.absPos, org = w.core.getOrigin()
ok(Math.hypot(eAbs.x - kAbs.x, eAbs.y - kAbs.y, eAbs.z - kAbs.z) < 1e-9, `entity ${JSON.stringify(eAbs)} not at KCC ${JSON.stringify(kAbs)}`)
ok(org.x % 256 === 0 && org.y % 256 === 0 && org.z % 256 === 0 && Math.hypot(org.x, org.y, org.z) > 0, `origin ${JSON.stringify(org)} not rebased to the spawn lattice`)
const lp = w.astroState.localPosF32
ok(Math.max(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2])) <= 1024 && Math.abs(lp[0] - (kAbs.x - org.x)) < 1e-3, `localPosF32 ${Array.from(lp)} wrong`)

// ---- respawn + dispose ------------------------------------------------------
w.kcc.teleportSurface(0, 1, 0)
ok(Math.abs(w.kcc.absPos.y / Math.hypot(w.kcc.absPos.x, w.kcc.absPos.y, w.kcc.absPos.z) - 1) < 1e-9, 'teleport away failed')
w.respawnPlayer()
const b = w.kcc.absPos
ok(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) < 1e-6, `respawn off by ${Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)} m`)
ok(Math.hypot(eAbs.x - b.x, eAbs.y - b.y, eAbs.z - b.z) < 1e-9, 'respawn did not resync the entity')
w.dispose()
ok(fp.disposed, 'dispose did not reach pool.disposeAll')

console.log(`[test-play-world] info: KCC r ${aL.toFixed(3)} m (surface ${(R + hS).toFixed(3)}), resident ${resident}, within 300 m ${near300}, near ${M.skyStats.near} mid ${M.skyStats.mid} impostors ${M.skyStats.written}, heap delta ${heapDelta} B`)
if (fails.length) { console.log(`[test-play-world] FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  - ' + f); process.exit(1) }
console.log(`[test-play-world] PASS ${n}/${n}`)