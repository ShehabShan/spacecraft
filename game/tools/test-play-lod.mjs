import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// T1 B3 Node check (plan §12.2 B3, §13.2, K2/K11): drives the MoonLod port
// headless against a fake pool. Run with `node --expose-gc` for the heap row.
// Prints `[test-play-lod] PASS n/n` or the failing assertions; exit 1 on failure.
const cfg = await import('../src/play/world/moonConfig.ts')
const { MoonLod, LOD, NODES_PER_FACE } = await import('../src/play/world/MoonLod.ts')
const { initTerrainField, terrainHeight } = await import('../src/core/terrain/terrainField.ts')

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }
const eq = (a, b, msg) => ok(a === b, `${msg}: got ${a}, want ${b}`)

// ---- fake pool: same record shape / state machine subset as TerrainMeshPool
function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, mesh: { visible: false } })
  return {
    records,
    acquire() {
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        if (r.state === 0) { r.state = 1; r.unwanted = 0; r.owner = null; return i }
      }
      return -1
    },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (let i = 0; i < records.length; i++) if (records[i].state === 1) c++; return c },
    answerAll() { for (let i = 0; i < records.length; i++) { const r = records[i]; if (r.state === 1) { r.state = 2; r.mesh.visible = true } } },
  }
}

initTerrainField(cfg.MOON_PARAMS)
const R = cfg.MOON_R
// Spawn pin from B2 (test-play-spawn, 1e-9).
const S = { x: 0.8349753337306719, y: -0.07279905191367053, z: 0.5454507219738775 } // re-pinned F3abbbbbc (ADR-016)
const rr = R + terrainHeight(S.x, S.y, S.z) + 1.4
const cam = { x: S.x * rr, y: S.y * rr, z: S.z * rr }

// ---- constants (K2) --------------------------------------------------
const K2 = { MAX_LEVEL: 4, SPLIT_K: 2.0, MERGE_K: 1.45, GRACE_FRAMES: 45,
  ACTIVATIONS_PER_FRAME: 3, TOTAL_INFLIGHT_CAP: 24, HORIZON_MARGIN: 150 }
for (const k of Object.keys(K2)) eq(LOD[k], K2[k], `LOD.${k}`)
eq(Object.keys(LOD).length, 7, 'LOD field count')

// ---- node build ------------------------------------------------------
const pool = fakePool(cfg.PLAY_POOL_OPTS.meshCount)
const lod = new MoonLod(pool, R)
eq(lod.faces.length, 6, 'faces')
let total = 0
for (const arr of lod.faces) { eq(arr.length, 341, 'nodes/face'); total += arr.length; for (const nd of arr) if (!nd) fails.push('hole in node array') }
eq(NODES_PER_FACE, 341, 'NODES_PER_FACE')
eq(total, 2046, 'total nodes')
const keys = new Set(); for (const arr of lod.faces) for (const nd of arr) keys.add(nd.key)
eq(keys.size, 2046, 'unique chunk keys')

// ---- residentAround on an empty pool ---------------------------------
eq(lod.residentAround(S.x, S.y, S.z, cfg.PLAY_TUNING.readyRadiusM), 0, 'residentAround before any update')
lod.update(cam.x, cam.y, cam.z)
eq(lod.residentAround(S.x, S.y, S.z, cfg.PLAY_TUNING.readyRadiusM), 0, 'residentAround with nothing answered')
ok(lod.stats.pending > 0 && lod.stats.pending <= LOD.ACTIVATIONS_PER_FRAME, `first update activates 1..3 (got ${lod.stats.pending})`)

const leafSet = () => { const s = []; for (const arr of lod.faces) for (const nd of arr) if (lod.isSelectedLeaf(nd)) s.push(nd.key); return s.join(',') }
let maxLevel = -1, leafCount = 0
for (const arr of lod.faces) for (const nd of arr) if (lod.isSelectedLeaf(nd)) { leafCount++; if (nd.level > maxLevel) maxLevel = nd.level }
eq(maxLevel, LOD.MAX_LEVEL, 'finest selected level at spawn, 1.4 m AGL')
ok(leafCount > 0, 'some leaves selected')

// ---- 100 repeated updates: identical leaf set (hysteresis, §11.4) ----
const base = leafSet()
let changed = 0
for (let i = 0; i < 100; i++) { lod.update(cam.x, cam.y, cam.z); if (leafSet() !== base) changed++ }
eq(changed, 0, 'leaf set changes over 100 identical updates')

// ---- ±0.5 m jitter: 0 leaf changes -----------------------------------
let seed = 12345
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
let jChanged = 0
for (let i = 0; i < 200; i++) {
  lod.update(cam.x + (rnd() - 0.5), cam.y + (rnd() - 0.5), cam.z + (rnd() - 0.5))
  if (leafSet() !== base) jChanged++
}
eq(jChanged, 0, 'leaf set changes under ±0.5 m jitter (200 frames)')

// ---- residentAround → 1 when every request is answered ---------------
let frames = 0, frac = 0, prev = 0, consec = 0
for (; frames < 400; frames++) {
  pool.answerAll()
  lod.update(cam.x, cam.y, cam.z)
  frac = lod.residentAround(S.x, S.y, S.z, cfg.PLAY_TUNING.readyRadiusM)
  ok(frac >= 0 && frac <= 1, `fraction in [0,1] (frame ${frames}: ${frac})`)
  if (frac === 1 && prev === 1) { consec = 2; break }
  prev = frac
}
eq(frac, 1, 'residentAround after answering every request')
eq(consec, 2, 'ready on two consecutive frames')
ok(lod.stats.active > 0, 'stats.active > 0 once answered')
eq(leafSet(), base, 'leaf set unchanged by streaming')
console.log(`[test-play-lod] info: ${leafCount} leaves selected, ready after ${frames + 1} answered frames, active ${lod.stats.active}, pending ${lod.stats.pending}`)

// ---- heap delta over 1,000 updates (§11.1) ----------------------------
if (typeof globalThis.gc === 'function') {
  for (let i = 0; i < 200; i++) { pool.answerAll(); lod.update(cam.x, cam.y, cam.z) } // warm (JIT)
  globalThis.gc(); globalThis.gc()
  const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < 1000; i++) { lod.update(cam.x, cam.y, cam.z); lod.residentAround(S.x, S.y, S.z, 300) }
  globalThis.gc(); globalThis.gc()
  const dh = process.memoryUsage().heapUsed - h0
  console.log(`[test-play-lod] info: heap delta over 1,000 updates = ${dh} B`)
  ok(Math.abs(dh) < 64 * 1024, `heap delta ≈ 0 over 1,000 updates (got ${dh} B, tol 64 KiB)`)
} else {
  fails.push('heap row needs `node --expose-gc`')
}

if (fails.length) { console.log(`[test-play-lod] FAIL ${n - fails.length}/${n}`); for (const f of fails.slice(0, 30)) console.log('  ✗ ' + f); process.exit(1) }
console.log(`[test-play-lod] PASS ${n}/${n}`)