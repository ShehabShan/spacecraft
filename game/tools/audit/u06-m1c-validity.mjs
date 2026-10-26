// A1-U06 probe — m1c harness validity (read-only audit; AGENT_BRIEF §11).
// Runs the REAL terrain worker (src/workers/terrainWorker.ts, esbuild type-strip, `self`
// stubbed, imports re-pointed at the real terrain modules) to generate chunks, then:
//   (1) runs the harness seam audit (Milestone1C_TestHarness.tsx posArr..auditSeams, sliced
//       verbatim) on a same-face scene and an all-faces scene, with two control mutations
//       that must be caught and one cross-face mutation the audit cannot see;
//   (2) an independent truth check: every vertex shared by two chunks (keyed by its exact
//       dyadic cube point) compared bitwise on normals + position, same-face AND cross-face;
//   (3) replays the harness LOD traversal (constants + buildNodes/childOf/nodeHasData/
//       updateFlight/clearSubtree/visitNode sliced verbatim) for 66 s @ 60 fps and measures
//       the desired set: stale desired nodes under a merged ancestor (overlap) and same-face
//       live-leaf neighbours with a level gap >= 2 (2:1 balance; never audited by T3);
//   (4) T-junction gaps vs skirt depth for level gaps 1..3 on real chunks;
//   (5) static checks on the T2 alloc counter, the T4 heap predicate and a detail string.
// Run (from game/): node tools/audit/u06-m1c-validity.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../src')
const esbuild = await import('esbuild')
const tfUrl = pathToFileURL(join(src, 'core/terrain/terrainField.ts')).href
const spUrl = pathToFileURL(join(src, 'core/terrain/spherify.ts')).href
const nzUrl = pathToFileURL(join(src, 'core/terrain/noise.ts')).href
const TF = await import(tfUrl)
const SP = await import(spUrl)
const NZ = await import(nzUrl)
TF.initTerrainField(TF.TEST_PLANET)
const N = TF.GRID_N, GW = TF.GRID_W
const results = []
const check = (id, cond, msg) => { results.push([id, !!cond]); console.log(`[u06] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }
async function compile(name, ts) {
  const js = esbuild.transformSync(ts, { loader: 'ts', format: 'esm' }).code
  const p = `/tmp/u06-${name}.mjs`
  writeFileSync(p, js)
  return import(pathToFileURL(p).href)
}
const H = readFileSync(join(src, 'test/Milestone1C_TestHarness.tsx'), 'utf8')

/* ---- real worker ------------------------------------------------------------------ */
let WSRC = readFileSync(join(src, 'workers/terrainWorker.ts'), 'utf8')
  .replace("from '../core/terrain/terrainField'", `from '${tfUrl}'`)
  .replace("from '../core/terrain/spherify'", `from '${spUrl}'`)
if (/from '\.\.?\//.test(WSRC)) throw new Error('worker has an un-repointed relative import')
const captured = []
globalThis.self = { postMessage(m) { captured.push(m) }, onmessage: null }
await compile('worker', WSRC)
const WK = globalThis.self
WK.onmessage({ data: { t: 'init', params: TF.TEST_PLANET, sets: 900 } })
let generated = 0
function gen(face, level, ix, iy) {
  captured.length = 0
  WK.onmessage({ data: { t: 'req', a: new Float64Array([1, TF.chunkKey(face, level, ix, iy), face, level, ix, iy]) } })
  const m = captured.find((x) => x.t === 'chunk')
  if (!m) throw new Error(`no chunk for ${face}/${level}/${ix}/${iy}`)
  generated++
  const o = { x: 0, y: 0, z: 0 }
  TF.chunkOriginInto(face, level, ix, iy, o)
  return { face, level, ix, iy, state: 2, originX: o.x, originY: o.y, originZ: o.z,
    geometry: { attributes: { position: { array: m.p }, normal: { array: m.n } } } }
}
const cloneRec = (r) => ({ ...r, geometry: { attributes: {
  position: { array: new Float32Array(r.geometry.attributes.position.array) },
  normal: { array: new Float32Array(r.geometry.attributes.normal.array) } } } })

/* ---- harness seam audit, verbatim slice ---------------------------------------- */
const a0 = H.indexOf('function posArr('), a1 = H.indexOf('const WINDOW_SECONDS')
const AUD = await compile('audit',
  `import { GRID_N, GRID_W } from '${tfUrl}';\n` +
  `export const metrics = { audits: { run: 0, pairs: 0, parentVerts: 0, maxPosDev: 0, nrmMismatch: 0 } };\n` +
  `export const pool = { records: [] };\n${H.slice(a0, a1)}\nexport { auditSeams };\n`)
const PRED = 'A.pairs >= 8 && A.parentVerts >= 4 && A.nrmMismatch === 0'
if (!H.includes(PRED)) throw new Error('seam predicate text changed')
function audit(recs) {
  const A = AUD.metrics.audits
  A.run = 0; A.pairs = 0; A.parentVerts = 0; A.maxPosDev = 0; A.nrmMismatch = 0
  AUD.pool.records = recs
  AUD.auditSeams()
  const pass = A.pairs >= 8 && A.parentVerts >= 4 && A.nrmMismatch === 0 && A.maxPosDev <= 5e-3
  return { ...A, pass }
}
function cube(face, level, ix, iy, i, j) {
  const D = N << level
  const u = TF.gridCoord(ix * N + (i - 1), D), v = TF.gridCoord(iy * N + (j - 1), D)
  const f3 = face * 3
  return { u, v,
    key: `${SP.FACE_C[f3] + u * SP.FACE_U[f3] + v * SP.FACE_V[f3]},` +
         `${SP.FACE_C[f3 + 1] + u * SP.FACE_U[f3 + 1] + v * SP.FACE_V[f3 + 1]},` +
         `${SP.FACE_C[f3 + 2] + u * SP.FACE_U[f3 + 2] + v * SP.FACE_V[f3 + 2]}` }
}
function truth(recs) {
  const map = new Map()
  recs.forEach((r, ri) => {
    for (let j = 1; j <= N + 1; j++) for (let i = 1; i <= N + 1; i++) {
      const { key } = cube(r.face, r.level, r.ix, r.iy, i, j)
      let l = map.get(key); if (!l) map.set(key, (l = []))
      l.push([ri, (j * GW + i) * 3])
    }
  })
  const o = { samePairs: 0, crossPairs: 0, sameMis: 0, crossMis: 0, maxDev: 0 }
  for (const l of map.values()) for (let p = 0; p < l.length; p++) for (let q = p + 1; q < l.length; q++) {
    const A = recs[l[p][0]], B = recs[l[q][0]], ka = l[p][1], kb = l[q][1]
    const pa = A.geometry.attributes.position.array, pb = B.geometry.attributes.position.array
    const na = A.geometry.attributes.normal.array, nb = B.geometry.attributes.normal.array
    const dev = Math.max(Math.abs(pa[ka] + A.originX - pb[kb] - B.originX),
      Math.abs(pa[ka + 1] + A.originY - pb[kb + 1] - B.originY), Math.abs(pa[ka + 2] + A.originZ - pb[kb + 2] - B.originZ))
    if (dev > o.maxDev) o.maxDev = dev
    const mis = na[ka] !== nb[kb] || na[ka + 1] !== nb[kb + 1] || na[ka + 2] !== nb[kb + 2] || dev > 5e-3
    if (A.face === B.face) { o.samePairs++; if (mis) o.sameMis++ } else { o.crossPairs++; if (mis) o.crossMis++ }
  }
  return o
}

// Scene S1: face 0, level-2 block with (1,1) replaced by its four level-3 children.
const S1 = []
for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) if (!(ix === 1 && iy === 1)) S1.push(gen(0, 2, ix, iy))
for (const [ix, iy] of [[2, 2], [3, 2], [2, 3], [3, 3]]) S1.push(gen(0, 3, ix, iy))
const s1 = audit(S1), t1 = truth(S1)
console.log('[u06] S1 audit', JSON.stringify(s1), 'truth', JSON.stringify(t1))
check('SEAM-BASE', s1.pass && s1.nrmMismatch === 0 && t1.sameMis === 0, 'same-face scene passes; truth agrees (0 shared-vertex mismatches)')
{ // control M1: perturb one same-level shared-edge normal (L2 (0,0) +u edge, row 5)
  const S = S1.map(cloneRec); const r = S.find((x) => x.level === 2 && x.ix === 0 && x.iy === 0)
  r.geometry.attributes.normal.array[(5 * GW + N + 1) * 3] += 1e-6
  const a = audit(S); check('SEAM-CTRL-SAME', !a.pass && a.nrmMismatch >= 1, `same-level edge mutation caught (nrmMismatch ${a.nrmMismatch})`)
}
{ // control M1b: perturb one parent/child coincident normal (L3 (2,2) -u edge, row 1)
  const S = S1.map(cloneRec); const r = S.find((x) => x.level === 3 && x.ix === 2 && x.iy === 2)
  r.geometry.attributes.normal.array[(1 * GW + 1) * 3] += 1e-6
  const a = audit(S); check('SEAM-CTRL-TJ', !a.pass && a.nrmMismatch >= 1, `parent/child T-junction mutation caught (nrmMismatch ${a.nrmMismatch})`)
}
// Scene S2: all 24 level-1 chunks of all six faces.
const S2 = []
for (let f = 0; f < 6; f++) for (let ix = 0; ix < 2; ix++) for (let iy = 0; iy < 2; iy++) S2.push(gen(f, 1, ix, iy))
// Scene S3 = S2 with face 5 (0,0) split into its four level-2 children, so the T3 predicate's
// parentVerts >= 4 clause is met and a passing baseline exists for the cross-face mutation.
const S3 = S2.filter((r) => !(r.face === 5 && r.ix === 0 && r.iy === 0))
for (const [ix, iy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) S3.push(gen(5, 2, ix, iy))
const s2 = audit(S2), t2 = truth(S2)
console.log('[u06] S2 audit', JSON.stringify(s2), 'truth', JSON.stringify(t2))
check('XFACE-UNAUDITED', s2.pairs === 6 * 4 * (N + 1) && t2.crossPairs > 0,
  `audit compares only same-face pairs (${s2.pairs} = 6 faces × 4 edges × ${N + 1}); ${t2.crossPairs} cross-face shared-vertex pairs exist and are never compared`)
check('XFACE-TRUTH-CLEAN', t2.crossMis === 0 && t2.sameMis === 0, `real engine: cross-face shared vertices bitwise-equal normals, max pos dev ${t2.maxDev.toExponential(2)} m`)
{ // M2: corrupt normals of every face-boundary vertex on face 0 only (deterministic per vertex)
  const b3 = audit(S3), t3 = truth(S3)
  console.log('[u06] S3 audit', JSON.stringify(b3), 'truth', JSON.stringify(t3))
  check('XFACE-BASE', b3.pass && t3.crossMis === 0, `all-faces baseline with one split passes (pairs ${b3.pairs}, parentVerts ${b3.parentVerts})`)
  const S = S3.map(cloneRec); let mutated = 0
  for (const r of S) if (r.face === 0) for (let j = 1; j <= N + 1; j++) for (let i = 1; i <= N + 1; i++) {
    const { u, v } = cube(r.face, r.level, r.ix, r.iy, i, j)
    if (Math.abs(u) === 1 || Math.abs(v) === 1) { const k = (j * GW + i) * 3; const na = r.geometry.attributes.normal.array; na[k] = -na[k]; na[k + 1] = -na[k + 1]; na[k + 2] = -na[k + 2]; mutated++ }
  }
  const a = audit(S), t = truth(S)
  check('XFACE-BLIND', a.pass && a.nrmMismatch === 0 && t.crossMis > 0,
    `face-0 boundary normals INVERTED on ${mutated} vertices: audit pass=${a.pass} (nrmMismatch ${a.nrmMismatch}); truth crossMis=${t.crossMis}`)
}

/* ---- LOD traversal replay (verbatim slices) ---------------------------------- */
const NAMES = ['R', 'MAX_LEVEL', 'SPLIT_K', 'MERGE_K', 'HORIZON_MARGIN', 'HEIGHT_SLACK', 'LEVEL_OFFSETS', 'FACE_NODES',
  'SPEED', 'ALT', 'ORBIT_R', 'OMEGA', 'E2', 'flightT', 'flightPaused', 'camPos', 'camDir', 'camFwd', 'camUX', 'candNodes', 'candDist', 'candCount']
const decl = NAMES.map((n) => { const m = new RegExp(`^(const|let) ${n}\\b.*$`, 'm').exec(H); if (!m) throw new Error(`decl ${n}`); return [m.index, m[0]] })
  .sort((x, y) => x[0] - y[0]).map((x) => x[1])
function block(tok, iife = false) {
  const s = H.indexOf(tok); if (s < 0) throw new Error(`block ${tok}`)
  let i = H.indexOf('{', s), d = 0
  for (;; i++) { if (H[i] === '{') d++; else if (H[i] === '}' && --d === 0) break }
  return H.slice(s, i + 1) + (iife ? ')();' : '')
}
for (const t of ['horizonDot = (R * R) / camR;', 'for (let f = 0; f < 6; f++) visitNode(FACE_NODES[f][0]);',
  'camUX = camPos.x / camR; camUY = camPos.y / camR; camUZ = camPos.z / camR;']) if (!H.includes(t)) throw new Error(`traversal text changed: ${t}`)
const CT = await compile('ctrl',
  `import { GRID_N, TEST_PLANET, terrainHeight, chunkArcWidth, chunkKey, gridCoord } from '${tfUrl}';\n` +
  `import { faceCubePointInto, spherifyInto } from '${spUrl}';\nconst pool = { records: [] };\n` +
  `${decl.join('\n')}\n${block('(function buildNodes', true)}\n${block('function childOf(')}\n${block('function nodeHasData(')}\n` +
  `${block('function updateFlight(')}\n${block('function clearSubtree(')}\n${block('function visitNode(')}\n` +
  `export function traverse() { const camR = Math.sqrt(camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z);\n` +
  ` camUX = camPos.x / camR; camUY = camPos.y / camR; camUZ = camPos.z / camR; horizonDot = (R * R) / camR; candCount = 0;\n` +
  ` for (let f = 0; f < 6; f++) visitNode(FACE_NODES[f][0]); }\nexport { FACE_NODES, updateFlight, MAX_LEVEL };\n`)
const M = CT.MAX_LEVEL
let samples = 0, staleFrames = 0, staleMax = 0, imbFrames = 0, imbPairs = 0, maxGap = 0, gap1Pairs = 0, liveMax = 0
const staleRun = new Map(); let staleRunMax = 0; const staleByLevel = [0, 0, 0, 0, 0]
for (let fr = 0; fr < 66 * 60; fr++) {
  CT.updateFlight(1 / 60); CT.traverse()
  if (fr < 360 || fr % 6) continue
  samples++
  let stale = 0, imb = 0; const seenStale = new Set()
  for (let f = 0; f < 6; f++) {
    const live = []
    for (const n of CT.FACE_NODES[f]) {
      if (!n.desired) continue
      let p = n.parent, ok = true
      while (p) { if (!p.split) { ok = false; break } p = p.parent }
      if (ok) live.push(n); else { stale++; staleByLevel[n.level]++; seenStale.add(n); staleRun.set(n, (staleRun.get(n) ?? 0) + 1); if (staleRun.get(n) > staleRunMax) staleRunMax = staleRun.get(n) }
    }
    if (live.length > liveMax) liveMax = live.length
    const box = live.map((n) => { const s = 1 << (M - n.level); return [n.ix * s, n.ix * s + s, n.iy * s, n.iy * s + s, n.level] })
    for (let a = 0; a < box.length; a++) for (let b = a + 1; b < box.length; b++) {
      const A = box[a], B = box[b]
      const ox = Math.min(A[1], B[1]) - Math.max(A[0], B[0]), oy = Math.min(A[3], B[3]) - Math.max(A[2], B[2])
      const adj = ((A[1] === B[0] || B[1] === A[0]) && oy > 0) || ((A[3] === B[2] || B[3] === A[2]) && ox > 0)
      if (!adj) continue
      const g = Math.abs(A[4] - B[4]); if (g > maxGap) maxGap = g
      if (g === 1) gap1Pairs++; if (g >= 2) { imb++; imbPairs++ }
    }
  }
  for (const n of [...staleRun.keys()]) if (!seenStale.has(n)) staleRun.delete(n)
  if (stale > 0) staleFrames++; if (stale > staleMax) staleMax = stale; if (imb > 0) imbFrames++
}
console.log(`[u06] LOD replay: ${samples} samples (every 6th frame, 6–66 s); live leaves max/face ${liveMax}; ` +
  `stale desired nodes: frames ${staleFrames}/${samples}, max ${staleMax}, by level ${JSON.stringify(staleByLevel)}, longest run ${(staleRunMax * 0.1).toFixed(1)} s; ` +
  `same-face live neighbours: gap1 ${gap1Pairs}, gap>=2 ${imbPairs} in ${imbFrames}/${samples} samples, max gap ${maxGap}`)
check('LOD-STALE-DESIRED', staleFrames > 0, `merged nodes leave children desired (overlap) in ${staleFrames}/${samples} samples, up to ${staleMax} nodes, runs up to ${(staleRunMax * 0.1).toFixed(1)} s`)
check('LOD-2TO1', imbPairs > 0, `same-face live-leaf neighbours with level gap >= 2: ${imbPairs} pair-samples, max gap ${maxGap}`)

/* ---- T-junction gap vs skirt depth ------------------------------------------------- */
const rand = NZ.mulberry32(0x0601c)
const gaps = {}
for (const [Lc, k] of [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [3, 1]]) {
  const g = (gaps[`${Lc}+${k}`] = { verts: 0, maxUp: 0, maxDown: 0, uncovered: 0, skirtF: TF.skirtDepthFor(Lc + k), skirtC: TF.skirtDepthFor(Lc) })
  for (let face = 0; face < 6; face++) {
    const cnt = 1 << Lc, cix = Math.floor(rand() * (cnt - 1)), ciy = Math.floor(rand() * cnt)
    const C = gen(face, Lc, cix, ciy), pc = C.geometry.attributes.position.array, s = 1 << k
    const cw = (j) => { const q = (j * GW + N + 1) * 3; return [pc[q] + C.originX, pc[q + 1] + C.originY, pc[q + 2] + C.originZ] }
    for (let q = 0; q < s; q++) {
      const fiy = ciy * s + q, F = gen(face, Lc + k, (cix + 1) * s, fiy), pf = F.geometry.attributes.position.array
      for (let j = 1; j <= N + 1; j++) {
        const t = (fiy * N + (j - 1)) / s - ciy * N, j0 = Math.floor(t), fr = t - j0
        const c0 = cw(j0 + 1), c1 = fr > 0 ? cw(j0 + 2) : c0
        const L = [c0[0] + (c1[0] - c0[0]) * fr, c0[1] + (c1[1] - c0[1]) * fr, c0[2] + (c1[2] - c0[2]) * fr]
        const kf = (j * GW + 1) * 3, V = [pf[kf] + F.originX, pf[kf + 1] + F.originY, pf[kf + 2] + F.originZ]
        const gap = Math.hypot(...V) - Math.hypot(...L)
        g.verts++
        if (gap > g.maxUp) g.maxUp = gap; if (-gap > g.maxDown) g.maxDown = -gap
        if (gap > 0 ? gap > g.skirtF : -gap > g.skirtC) g.uncovered++
      }
    }
  }
}
for (const [kk, g] of Object.entries(gaps)) console.log(`[u06] T-junction L${kk}: ${g.verts} fine edge verts, fine-above max ${g.maxUp.toFixed(2)} m (skirt ${g.skirtF.toFixed(1)}), fine-below max ${g.maxDown.toFixed(2)} m (skirt ${g.skirtC.toFixed(1)}), uncovered ${g.uncovered}`)
check('TJ-SKIRT-COVERS', Object.values(gaps).every((g) => g.uncovered === 0), 'every measured T-junction gap (level gaps 1..3) is within the covering skirt depth')

/* ---- static checks ------------------------------------------------------------------ */
const POOL = readFileSync(join(src, 'render/TerrainMeshPool.ts'), 'utf8').split('\n')
const incs = POOL.map((l, i) => [i + 1, l.trim()]).filter(([, l]) => /bootBufferAllocs\s*(\+=|\+\+|=[^=])/.test(l))
const ctor = POOL.findIndex((l) => /^\s*constructor\(/.test(l)) + 1, onMsg = POOL.findIndex((l) => l.includes('private onWorkerMessage(')) + 1
console.log(`[u06] bootBufferAllocs writes: ${JSON.stringify(incs)}; constructor @${ctor}; onWorkerMessage @${onMsg}`)
check('T2-ALLOC-CONST', incs.length === 1 && incs[0][0] > ctor && incs[0][0] < onMsg && H.includes('pool.counters.bootBufferAllocs - metrics.allocStart'),
  'the T2 alloc counter is written only in the pool constructor → allocDelta during flight is 0 by construction')
check('T4-HEAP-WEAK', H.includes('const heapOk = !heapAvailable || heapPerFrame <= 1024;') && !readFileSync(resolve(src, '../playwright.config.ts'), 'utf8').includes('precise-memory'),
  'heap clause passes when performance.memory is absent and on any negative delta; Chrome launched without precise memory info')
check('T4-DETAIL-TEMPLATE', H.includes('`heap growth {(heapDelta / 1024).toFixed(1)} KB over `'), 'heap-flat detail string lacks `$` → prints literal "{(heapDelta / 1024).toFixed(1)}"')
check('T3-FACE-SKIP', H.includes('ra.face !== rb.face) continue;'), 'auditSeams skips every cross-face pair')
console.log(`[u06] chunks generated by the real worker: ${generated}`)
console.log(`[u06] SUMMARY ${results.filter((r) => r[1]).length}/${results.length} confirmed`)