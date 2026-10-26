// F2c seam gate (ADR-008): an INDEPENDENT check that the real terrain worker's chunks meet
// across all 12 cube-face edges and all 8 cube corners — normals bit-identical, world positions
// within 5 mm — plus same-face and T-junction seams, run in Node on the unchanged worker.
// WHY: m1c T3 (`auditSeams`) skips every pair of chunks on different faces, so a unilateral
// fault at any of the 12 edges / 8 corners passes (A1-U06-1, K2c; recheck
// docs/audit/U27b3b2b2b1-m1c-recheck.md: 64 false accepts). Truth here comes from an explicit
// Cartesian chart per face (pinned public face convention, NOT the production FACE_C/U/V or
// gridCoord), exact dyadic cube-coordinate identity keys, and Float32 bit patterns.
//
// Run from game/:
//   node tools/test-seam-gate.mjs                              gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-seam-gate.mjs --self-test [--deliberate]   every fixture/mutant must turn its checks red
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned literals (Milestone 1C contract; change only with an ADR in the same commit) -----
const N = 32, W = N + 3          // quads per chunk side; padded side (interior rows/cols 1..N+1)
const POS_TOL = 5e-3             // m, world-position agreement at a shared vertex (spec 1C T3)
const DIR_TOL = 1e-6             // vertex world direction vs the independent chart (measured 1.45e-8)
// Independent face charts (+X, −X, +Y, −Y, +Z, −Z), cube point for face params (u, v) ∈ [−1, 1]².
const CHART = [
  (u, v) => [1, v, -u], (u, v) => [-1, v, u], (u, v) => [u, 1, -v],
  (u, v) => [u, -1, v], (u, v) => [u, v, 1], (u, v) => [-u, v, -1],
]
// Two layouts: every face at level 0 (each chunk IS a face), and the recheck's 27-chunk mix —
// all faces at level 1 with face 5's (0,0) chunk replaced by four level-2 children, so a real
// T-junction exists. Expected shared points per cube edge: 2^(L+5) − 1 at the coarser level.
const LAYOUTS = {
  L0: { chunks: [0, 1, 2, 3, 4, 5].map((face) => ({ face, level: 0, ix: 0, iy: 0 })), perEdge: 31, tj: false },
  mixed: { chunks: (() => {
    const c = []
    for (let f = 0; f < 6; f++) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
      if (f === 5 && x === 0 && y === 0) {
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) c.push({ face: f, level: 2, ix: a, iy: b })
      } else c.push({ face: f, level: 1, ix: x, iy: y })
    }
    return c
  })(), perEdge: 63, tj: true },
}

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const terrainDir = path.join(game, 'src/core/terrain')
const SRC = { worker: path.join(game, 'src/workers/terrainWorker.ts') }
for (const f of readdirSync(terrainDir)) if (f.endsWith('.ts')) SRC[f.replace('.ts', '')] = path.join(terrainDir, f)
const sha = () => Object.values(SRC).sort().map((f) => createHash('sha256').update(readFileSync(f)).digest('hex')).join(':')
const PRODUCTION = sha()

class Broken extends Error {}

// Bundles the REAL worker (+ the field it shares); a mutant is [fileKey, from, to] source
// rewrites applied in the bundle only — fresh module instance per mutant, files never written.
let nBuild = 0
async function load(rewrites = []) {
  const hits = rewrites.map(() => 0)
  const out = path.join(game, 'node_modules', '.cache', `f2c-seam-${process.pid}-${nBuild++}.mjs`)
  await build({
    stdin: { contents: `import './workers/terrainWorker';\nexport { TEST_PLANET, GRID_N, GRID_W, chunkOriginInto } from './core/terrain/terrainField';`,
      resolveDir: path.join(game, 'src'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    plugins: [{ name: 'f2c-mutate', setup(b) {
      b.onLoad({ filter: /\.ts$/ }, (a) => {
        let src = readFileSync(a.path, 'utf8')
        rewrites.forEach(([k, from, to], i) => {
          if (a.path !== SRC[k]) return
          const parts = src.split(from); hits[i] += parts.length - 1; src = parts.join(to)
        })
        return { contents: src, loader: 'ts' }
      })
    } }],
  })
  const bad = rewrites.filter((_, i) => hits[i] === 0)
  if (bad.length) throw new Broken(`mutant rewrite matched nothing: ${JSON.stringify(bad[0][1])}`)
  const sink = []
  // The worker binds `self` at module evaluation; give each bundle its own message port.
  const port = { postMessage: (m) => sink.push(m), onmessage: null }
  globalThis.self = port
  const mod = await import(pathToFileURL(out).href)
  if (mod.GRID_N !== N || mod.GRID_W !== W) throw new Broken(`grid ${mod.GRID_N}/${mod.GRID_W} ≠ pinned ${N}/${W}`)
  return { mod, port, sink }
}

// Runs the worker's own init + req handlers and returns chunk records with the main-thread origin.
function generate({ mod, port, sink }, chunks) {
  port.onmessage({ data: { t: 'init', params: mod.TEST_PLANET, sets: chunks.length } })
  return chunks.map((c, key) => {
    sink.length = 0
    port.onmessage({ data: { t: 'req', a: new Float64Array([1, key, c.face, c.level, c.ix, c.iy]) } })
    if (sink.length !== 1 || sink[0].t !== 'chunk') throw new Broken(`chunk ${key}: worker answered ${JSON.stringify(sink.map((m) => m.t))}`)
    const o = { x: 0, y: 0, z: 0 }; mod.chunkOriginInto(c.face, c.level, c.ix, c.iy, o)
    return { ...c, p: sink[0].p, n: sink[0].n, o: [o.x, o.y, o.z] }
  })
}

// ---- oracle --------------------------------------------------------------------------------
// Exact dyadic cube coordinate of interior vertex (i, j) of a chunk — the identity key.
function cubeAt(c, i, j) {
  const D = N * 2 ** c.level
  return CHART[c.face](2 * (c.ix * N + i - 1) / D - 1, 2 * (c.iy * N + j - 1) / D - 1)
}
// Public spherified-cube direction (unit), for the absolute direction calibration.
function sphereDir([x, y, z]) {
  return [x * Math.sqrt(1 - y * y / 2 - z * z / 2 + y * y * z * z / 3),
    y * Math.sqrt(1 - z * z / 2 - x * x / 2 + z * z * x * x / 3),
    z * Math.sqrt(1 - x * x / 2 - y * y / 2 + x * x * y * y / 3)]
}
function groupsOf(records) {
  const g = new Map()
  records.forEach((r, ri) => {
    for (let j = 1; j <= N + 1; j++) for (let i = 1; i <= N + 1; i++) {
      const c = cubeAt(r, i, j), key = c.join(',')
      if (!g.has(key)) g.set(key, { c, refs: [] })
      g.get(key).refs.push({ ri, k: (j * W + i) * 3 })
    }
  })
  return g
}
// The 12 edges: two axes fixed at ±1, one free in (−1, 1); the 8 corners: all three at ±1.
const EDGES = []
for (let free = 0; free < 3; free++) for (const s of [-1, 1]) for (const t of [-1, 1]) {
  const fixed = [0, 1, 2].filter((a) => a !== free); EDGES.push({ free, fixed, val: [s, t] })
}
const CORNERS = []
for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) CORNERS.push([x, y, z])
const onEdge = (e, c) => c[e.fixed[0]] === e.val[0] && c[e.fixed[1]] === e.val[1] && Math.abs(c[e.free]) < 1

function evaluate(name, records, layout) {
  const res = {}
  const put = (id, ok, ev) => { res[`${name}:${id}`] = { ok: !!ok, ev } }
  const groups = groupsOf(records)
  const faceSet = (g) => new Set(g.refs.map((v) => records[v.ri].face))
  // coverage: every edge has exactly perEdge shared points, each on exactly 2 faces; corners 3.
  const perEdge = EDGES.map((e) => {
    const pts = [...groups.values()].filter((g) => onEdge(e, g.c) && g.refs.length > 1)
    return { n: pts.length, twoFaces: pts.every((g) => faceSet(g).size === 2) }
  })
  const corners = CORNERS.map((c) => { const g = groups.get(c.join(',')); return g ? faceSet(g).size : 0 })
  let crossPairs = 0, samePairs = 0, tjPairs = 0
  let crossNrmBad = 0, sameNrmBad = 0, crossPos = 0, samePos = 0, nonFinite = 0
  const bits = records.map((r) => new Uint32Array(r.n.buffer, r.n.byteOffset, r.n.length))
  const firstBad = {}
  for (const g of groups.values()) {
    if (g.refs.length < 2) continue
    for (let a = 0; a < g.refs.length; a++) for (let b = a + 1; b < g.refs.length; b++) {
      const A = g.refs[a], B = g.refs[b], ra = records[A.ri], rb = records[B.ri]
      const cross = ra.face !== rb.face
      let nb = false, dev = 0
      for (let k = 0; k < 3; k++) {
        nb ||= bits[A.ri][A.k + k] !== bits[B.ri][B.k + k]
        dev = Math.max(dev, Math.abs((ra.p[A.k + k] + ra.o[k]) - (rb.p[B.k + k] + rb.o[k])))
      }
      if (!Number.isFinite(dev)) dev = Infinity
      if (cross) { crossPairs++; crossNrmBad += nb; crossPos = Math.max(crossPos, dev); if (nb && !firstBad.cross) firstBad.cross = g.c }
      else {
        samePairs++; if (ra.level !== rb.level) tjPairs++
        sameNrmBad += nb; samePos = Math.max(samePos, dev); if (nb && !firstBad.same) firstBad.same = g.c
      }
    }
  }
  // direction calibration + outward unit normals on every interior vertex
  let dirErr = 0, minDot = Infinity, unitErr = 0
  for (const r of records) for (let j = 1; j <= N + 1; j++) for (let i = 1; i <= N + 1; i++) {
    const k = (j * W + i) * 3, d = sphereDir(cubeAt(r, i, j))
    const p = [r.p[k] + r.o[0], r.p[k + 1] + r.o[1], r.p[k + 2] + r.o[2]], len = Math.hypot(...p)
    const n = [r.n[k], r.n[k + 1], r.n[k + 2]]
    if (![...p, ...n].every(Number.isFinite)) { nonFinite++; continue }
    for (let a = 0; a < 3; a++) dirErr = Math.max(dirErr, Math.abs(d[a] - p[a] / len))
    minDot = Math.min(minDot, n[0] * d[0] + n[1] * d[1] + n[2] * d[2])
    unitErr = Math.max(unitErr, Math.abs(Math.hypot(...n) - 1))
  }
  put('coverage', perEdge.every((e) => e.n === layout.perEdge && e.twoFaces) && corners.every((f) => f === 3) &&
    (!layout.tj || tjPairs > 0), { perEdge: perEdge.map((e) => e.n), corners, tjPairs })
  put('finite', nonFinite === 0, { nonFinite })
  put('chart-direction', dirErr <= DIR_TOL, { dirErr })
  put('normal-outward-unit', minDot > 0 && unitErr <= 1e-4, { minDot, unitErr })
  put('cross-normal-bits', crossPairs > 0 && crossNrmBad === 0, { crossPairs, crossNrmBad, first: firstBad.cross })
  put('cross-position', crossPairs > 0 && crossPos <= POS_TOL, { crossPairs, maxDev: crossPos })
  // WHY: at L0 every chunk is a whole face, so there are no same-face seams to compare there.
  if (layout.tj) {
    put('same-face-normal-bits', samePairs > 0 && sameNrmBad === 0, { samePairs, tjPairs, sameNrmBad, first: firstBad.same })
    put('same-face-position', samePairs > 0 && samePos <= POS_TOL, { samePairs, maxDev: samePos })
  }
  return { res, groups }
}

async function gateRun(rewrites = [], edit = null) {
  const inst = await load(rewrites)
  const all = {}, ctx = {}
  for (const [name, layout] of Object.entries(LAYOUTS)) {
    let records = generate(inst, layout.chunks)
    ctx[name] = records
    if (edit) records = edit(name, records) ?? records
    Object.assign(all, evaluate(name, records, layout).res)
  }
  return { all, ctx }
}
const red = (all) => Object.keys(all).filter((k) => !all[k].ok)

// ---- data fixtures (the U27b3b2b2b1 edge/corner faults): a unilateral fault on ONE face ------
const clone = (rs) => rs.map((r) => ({ ...r, p: r.p.slice(), n: r.n.slice() }))
function fault(records, key, kind, oneRef = false) {
  const out = clone(records), g = groupsOf(out).get(key)
  if (!g || g.refs.length < 2) throw new Broken(`fixture point ${key} is not shared`)
  const face = out[g.refs[0].ri].face
  for (const { ri, k } of oneRef ? [g.refs[0]] : g.refs.filter((v) => out[v.ri].face === face)) {
    if (kind === 'normal') for (let a = 0; a < 3; a++) out[ri].n[k + a] *= -1
    else out[ri].p[k] += 1
  }
  return out
}
function sameFacePoint(records, tj) {
  for (const g of groupsOf(records).values()) {
    if (g.refs.length !== 2) continue
    const [a, b] = g.refs.map((v) => records[v.ri])
    if (a.face === b.face && (Math.abs(a.level - b.level) === 1) === tj) return g.c.join(',')
  }
  throw new Broken('no same-face point')
}
const edgeSample = (e) => { const c = [0, 0, 0]; c[e.free] = -0.75; c[e.fixed[0]] = e.val[0]; c[e.fixed[1]] = e.val[1]; return c.join(',') }

function fixtures() {
  const fx = []
  const on = (name, edit) => (n, rs) => (n === 'mixed' ? edit(rs) : rs)
  EDGES.forEach((e) => fx.push({ id: `fx-edge-normal ${edgeSample(e)}`, edit: on('mixed', (rs) => fault(rs, edgeSample(e), 'normal')), need: ['mixed:cross-normal-bits'] }))
  CORNERS.forEach((c) => fx.push({ id: `fx-corner-normal ${c}`, edit: on('mixed', (rs) => fault(rs, c.join(','), 'normal')), need: ['mixed:cross-normal-bits'] }))
  EDGES.forEach((e) => fx.push({ id: `fx-edge-position ${edgeSample(e)}`, edit: on('mixed', (rs) => fault(rs, edgeSample(e), 'position')), need: ['mixed:cross-position'] }))
  for (const tj of [false, true]) for (const kind of ['normal', 'position']) {
    fx.push({ id: `control-${tj ? 'tjunction' : 'same-level'}-${kind}`,
      edit: on('mixed', (rs) => fault(rs, sameFacePoint(rs, tj), kind, true)),
      need: [kind === 'normal' ? 'mixed:same-face-normal-bits' : 'mixed:same-face-position'] })
  }
  fx.push({ id: 'control-face-4-missing', edit: (n, rs) => rs.filter((r) => r.face !== 4), need: ['L0:coverage', 'mixed:coverage'] })
  fx.push({ id: 'control-level-2-missing', edit: on('mixed', (rs) => rs.filter((r) => r.level !== 2)), need: ['mixed:coverage'] })
  return fx
}

// ---- source mutants: face-local generation faults in the real worker ------------------------
const MUTANTS = [
  { id: 'src-face3-normal-scale', rw: [['worker', 'nrm[k] = _nrm.x;', 'nrm[k] = face === 3 ? _nrm.x * (1 + 1e-6) : _nrm.x;']],
    need: ['L0:cross-normal-bits', 'mixed:cross-normal-bits'] },
  { id: 'src-face0-position-1cm', rw: [['worker', 'pos[k] = dx * r - ox;', 'pos[k] = dx * r - ox + (face === 0 ? 0.01 : 0);']],
    need: ['L0:cross-position', 'mixed:cross-position'] },
  { id: 'src-face2-mirrored-u', rw: [['worker', 'const u = gridCoord(ix * N + ii, D);', 'const u = face === 2 ? -gridCoord(ix * N + ii, D) : gridCoord(ix * N + ii, D);']],
    need: ['L0:cross-position', 'L0:chart-direction', 'mixed:cross-position'] },
  { id: 'src-edge-row-normal-f32-nudge', rw: [['worker', 'nrm[k + 2] = _nrm.z;', 'nrm[k + 2] = (face === 1 && i === N + 1) ? _nrm.z + 1e-6 : _nrm.z;']],
    need: ['L0:cross-normal-bits', 'mixed:cross-normal-bits'] },
]

async function main() {
  const base = await gateRun()
  const rows = Object.entries(base.all)
  for (const [id, r] of rows) console.log(JSON.stringify({ check: id, ok: r.ok, ...r.ev }))
  const basePass = rows.every(([, r]) => r.ok)
  console.log(`GATE ${basePass ? 'PASS' : 'FAIL'} ${rows.filter(([, r]) => r.ok).length}/${rows.length}`)
  if (!SELF) return basePass ? 0 : 1
  if (!basePass) { console.log('SELF-TEST needs a passing baseline'); return 1 }
  const cases = []
  for (const f of fixtures()) cases.push({ id: f.id, need: f.need, all: (await gateRun([], f.edit)).all })
  for (const m of MUTANTS) cases.push({ id: m.id, need: m.need, all: (await gateRun(m.rw)).all })
  if (DELIB) cases.push({ id: 'deliberate-no-op', need: ['mixed:coverage'], all: base.all })
  let caught = 0
  for (const c of cases) {
    const r = red(c.all), ok = c.need.every((k) => r.includes(k))
    caught += ok
    console.log(JSON.stringify({ case: c.id, caught: ok, need: c.need, red: r }))
  }
  console.log(`SELF-TEST ${caught === cases.length ? 'PASS' : 'FAIL'} ${caught}/${cases.length}`)
  return caught === cases.length ? 0 : 1
}

let code
try { code = await main() } catch (e) { console.error(e instanceof Broken ? `BROKEN: ${e.message}` : e); code = 2 }
if (sha() !== PRODUCTION) { console.error('BROKEN: production terrain/worker sources changed during the run'); code = 2 }
else console.log(`production sources unchanged (${Object.keys(SRC).length} files hashed)`)
process.exit(code)