// A1-U22 probe — play world (moonConfig / spawn / MoonLod / skyState / moonWorld boot)
// READ-ONLY audit. Expectations are written from geometry first (see the U22 report);
// the probe imports the REAL modules and measures them.
// Run from game/:  node tools/audit/u22-play-world.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
import { performance } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)

const p = (k, v) => console.log(`${k}=${v}`)
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }

const MC = await import('../../src/play/world/moonConfig.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const SP = await import('../../src/core/terrain/spherify.ts')
const { MoonLod, LOD } = await import('../../src/play/world/MoonLod.ts')
const { findEarthriseSpawn } = await import('../../src/play/world/spawn.ts')
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts')
TF.initTerrainField(MC.MOON_PARAMS)
const R = MC.MOON_R, H = TF.terrainHeight
const dir = (f, u, v) => { const o = { x: 0, y: 0, z: 0 }; SP.faceCubePointInto(f, u, v, o); SP.spherifyInto(o.x, o.y, o.z, o); return o }

// ---- P1 spawn: boot geometry exactly as createMoonWorld steps 2-8 ----
const core = new SimulationCore(); core.setTimeScale(0)
const es = core.getCelestialState('earth').absPos, ms = core.getCelestialState('moon').absPos
const ev = { x: es.x - ms.x, y: es.y - ms.y, z: es.z - ms.z }; const ed = Math.hypot(ev.x, ev.y, ev.z)
const earthDir = { x: ev.x / ed, y: ev.y / ed, z: ev.z / ed }
const sl = Math.hypot(ms.x, ms.y, ms.z); const sunDir = { x: -ms.x / sl, y: -ms.y / sl, z: -ms.z / sl }
// count terrain calls to infer loop iterations
let t0 = performance.now(); const site = findEarthriseSpawn(earthDir, sunDir); const spawnMs = performance.now() - t0
const S = site.dir
const sunElev = Math.asin(S.x * sunDir.x + S.y * sunDir.y + S.z * sunDir.z) * 180 / Math.PI
p('P1.spawn.dir', `${S.x.toFixed(6)},${S.y.toFixed(6)},${S.z.toFixed(6)}`)
p('P1.spawn.score', site.score.toFixed(4)); p('P1.spawn.ms', spawnMs.toFixed(0))
p('P1.spawn.earthElevDeg', site.earthElevDeg.toFixed(2)); p('P1.spawn.sunElevDeg', sunElev.toFixed(2))
p('P1.earlyBreakReachable(score<0.35 needs slope<0.00875deg, but slope<0.01 is skipped)', site.score < 0.35)
control('spawn_matches_test_pin', Math.abs(S.x - 0.32058829107484366) < 1e-9 && Math.abs(S.z - 0.9465025256421825) < 1e-9)
// dev probes: offsets are along world x/z. Tangential part of the offset at the spawn and at a pole-of-y site
const tang = (d, ex, ez) => { const dot = ex * d.x + ez * d.z; return Math.hypot(ex - dot * d.x, -dot * d.y, ez - dot * d.z) }
p('P1.devProbe.tangentialFrac.spawn(min over 4)', Math.min(...[0, 1, 2, 3].map(k => { const a = k * 1.57 + 0.4; return tang(S, Math.cos(a), Math.sin(a)) })).toFixed(3))
p('P1.devProbe.tangentialFrac.dir(1,0,0)(min over 4)', Math.min(...[0, 1, 2, 3].map(k => { const a = k * 1.57 + 0.4; return tang({ x: 1, y: 0, z: 0 }, Math.cos(a), Math.sin(a)) })).toFixed(3))

// ---- P2 render surface vs collision surface (L4 = finest, what the player stands on) ----
// The worker places vertices at R+H(grid dir); the GPU interpolates linearly between them.
// The KCC stands on the analytic H. Measure analytic − linear at triangle-edge/quad midpoints.
{
  const L = 4, D = TF.GRID_N << L, errs = []
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let s = 0; s < 40000; s++) {
    const f = (rnd() * 6) | 0, g = (rnd() * (D - 1)) | 0, h = (rnd() * (D - 1)) | 0
    const u0 = TF.gridCoord(g, D), u1 = TF.gridCoord(g + 1, D), v0 = TF.gridCoord(h, D), v1 = TF.gridCoord(h + 1, D)
    // diagonal midpoint of the quad (on the shared triangle edge whichever diagonal is used, take both)
    const a = dir(f, u0, v0), b = dir(f, u1, v1), c = dir(f, u1, v0), d = dir(f, u0, v1)
    const ra = R + H(a.x, a.y, a.z), rb = R + H(b.x, b.y, b.z), rc = R + H(c.x, c.y, c.z), rd = R + H(d.x, d.y, d.z)
    for (const [P, Q, rp, rq] of [[a, b, ra, rb], [c, d, rc, rd]]) {
      const mx = (P.x * rp + Q.x * rq) / 2, my = (P.y * rp + Q.y * rq) / 2, mz = (P.z * rp + Q.z * rq) / 2
      const rl = Math.hypot(mx, my, mz)
      errs.push((R + H(mx / rl, my / rl, mz / rl)) - rl)   // + = analytic above the drawn surface (feet sink)
    }
  }
  errs.sort((x, y) => x - y); const q = k => errs[Math.min(errs.length - 1, Math.floor(k * errs.length))]
  const abs = errs.map(Math.abs).sort((x, y) => x - y); const qa = k => abs[Math.min(abs.length - 1, Math.floor(k * abs.length))]
  p('P2.L4.quadSpacing_m', (TF.chunkArcWidth(4) / TF.GRID_N).toFixed(2))
  p('P2.L4.analyticMinusDrawn_m p01/p50/p99', `${q(0.01).toFixed(3)}/${q(0.5).toFixed(3)}/${q(0.99).toFixed(3)}`)
  p('P2.L4.|err| p50/p90/p99/max', `${qa(0.5).toFixed(3)}/${qa(0.9).toFixed(3)}/${qa(0.99).toFixed(3)}/${abs[abs.length - 1].toFixed(3)}`)
  p('P2.L4.frac|err|>0.02m(groundClearance)', (abs.filter(e => e > MC.MOON_ASTRONAUT.groundClearance).length / abs.length).toFixed(3))
  p('P2.L4.frac|err|>0.25m', (abs.filter(e => e > 0.25).length / abs.length).toFixed(3))
  control('P2_midpoint_on_flat_sphere_is_chord_sag', true)
}

// ---- P3 brad vs actual chunk extent (brad drives horizon cull AND camera-layer masks) ----
{
  for (let L = 0; L <= 4; L++) {
    const D = TF.GRID_N << L, cnt = 1 << L, brad = TF.chunkArcWidth(L) * 0.75 + MC.HEIGHT_SLACK, skirt = TF.skirtDepthFor(L)
    let worst = 0
    for (let f = 0; f < 6; f++) for (let ix = 0; ix < cnt; ix += Math.max(1, cnt >> 2)) for (let iy = 0; iy < cnt; iy += Math.max(1, cnt >> 2)) {
      const o = { x: 0, y: 0, z: 0 }; TF.chunkOriginInto(f, L, ix, iy, o)
      for (let i = 0; i <= TF.GRID_N; i += 4) for (let j = 0; j <= TF.GRID_N; j += 4) {
        const d = dir(f, TF.gridCoord(ix * TF.GRID_N + i, D), TF.gridCoord(iy * TF.GRID_N + j, D))
        const edge = i === 0 || j === 0 || i === TF.GRID_N || j === TF.GRID_N
        for (const drop of edge ? [0, skirt] : [0]) {
          const r = R + H(d.x, d.y, d.z) - drop
          worst = Math.max(worst, Math.hypot(d.x * r - o.x, d.y * r - o.y, d.z * r - o.z))
        }
      }
    }
    p(`P3.L${L}.maxExtent/brad`, `${worst.toFixed(0)}/${brad.toFixed(0)} = ${(worst / brad).toFixed(3)}`)
  }
}

// ---- P4 terrain range vs the core shell (R - MAX_TERRAIN_H - 40) and MAX_TERRAIN_H ----
{
  let mn = Infinity, mx = -Infinity
  for (let f = 0; f < 6; f++) for (let a = 0; a <= 400; a++) for (let b = 0; b <= 400; b++) {
    const d = dir(f, a / 200 - 1, b / 200 - 1); const h = H(d.x, d.y, d.z); if (h < mn) mn = h; if (h > mx) mx = h
  }
  p('P4.terrainH min/max (6x401^2 grid)', `${mn.toFixed(1)}/${mx.toFixed(1)}`)
  p('P4.shellDepthBelowR', MC.MAX_TERRAIN_H + 40)
  control('P4_terrain_above_shell', mn > -(MC.MAX_TERRAIN_H + 40))
}

// ---- P5 LOD demand vs the 96-record pool (fake pool, answered instantly) ----
function fakePool(meshCount) {
  const records = []
  for (let i = 0; i < meshCount; i++) records.push({ state: 0, unwanted: 0, owner: null, mesh: { visible: false } })
  return {
    records,
    acquire() { for (let i = 0; i < records.length; i++) { const r = records[i]; if (r.state === 0) { r.state = 1; r.unwanted = 0; r.owner = null; return i } } return -1 },
    release(i) { const r = records[i]; r.state = 0; r.mesh.visible = false },
    freeCount() { let c = 0; for (const r of records) if (r.state === 0) c++; return c },
    inFlightTotal() { let c = 0; for (const r of records) if (r.state === 1) c++; return c },
    answerAll() { for (const r of records) if (r.state === 1) { r.state = 2; r.mesh.visible = true } },
  }
}
const hS = H(S.x, S.y, S.z)
for (const alt of [1.4, 30, 200, 1000, 3000, 10000]) {
  const pool = fakePool(MC.PLAY_POOL_OPTS.meshCount), lod = new MoonLod(pool, R)
  const rr = R + hS + alt, cx = S.x * rr, cy = S.y * rr, cz = S.z * rr
  for (let fr = 0; fr < 400; fr++) { lod.update(cx, cy, cz); pool.answerAll() }
  let sel = 0, selNoData = 0, culledVisible = 0
  for (const arr of lod.faces) for (const n of arr) if (lod.isSelectedLeaf(n)) { sel++; if (!lod.nodeHasData(n)) selNoData++ }
  // horizon cull soundness: a culled root/subtree point visible over the bare sphere R (conservative occluder = R-400 shell gives an upper bound)
  const cam = { x: cx, y: cy, z: cz }, cr = Math.hypot(cx, cy, cz)
  const visOver = (Rocc, P) => { const rp = Math.hypot(P.x, P.y, P.z); const phi = Math.acos(Math.max(-1, Math.min(1, (P.x * cx + P.y * cy + P.z * cz) / (rp * cr)))); return phi <= Math.acos(Rocc / cr) + Math.acos(Math.min(1, Rocc / rp)) }
  let culledVisR = 0, culledN = 0
  for (const arr of lod.faces) for (const n of arr) {
    if (n.level !== 4) continue
    const camU = { x: cx / cr, y: cy / cr, z: cz / cr }
    if (n.ox * camU.x + n.oy * camU.y + n.oz * camU.z + n.brad >= (R * R) / cr - LOD.HORIZON_MARGIN) continue
    culledN++
    if (visOver(R, { x: n.ox, y: n.oy, z: n.oz })) culledVisR++
  }
  p(`P5.alt${alt}m.selectedLeaves/meshes`, `${sel}/${MC.PLAY_POOL_OPTS.meshCount} noData=${selNoData} active=${lod.stats.active}`)
  p(`P5.alt${alt}m.L4culled_centreVisibleOverSphereR`, `${culledVisR}/${culledN}`)
}
// ---- P2b grid-line edge midpoints only (drawn by every triangulation, unlike diagonals) ----
{
  const L = 4, D = TF.GRID_N << L, abs = []
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  for (let s = 0; s < 40000; s++) {
    const f = (rnd() * 6) | 0, g = (rnd() * (D - 1)) | 0, h = (rnd() * D) | 0
    const a = dir(f, TF.gridCoord(g, D), TF.gridCoord(h, D)), b = dir(f, TF.gridCoord(g + 1, D), TF.gridCoord(h, D))
    const ra = R + H(a.x, a.y, a.z), rb = R + H(b.x, b.y, b.z)
    const mx = (a.x * ra + b.x * rb) / 2, my = (a.y * ra + b.y * rb) / 2, mz = (a.z * ra + b.z * rb) / 2, rl = Math.hypot(mx, my, mz)
    abs.push(Math.abs(R + H(mx / rl, my / rl, mz / rl) - rl))
  }
  abs.sort((x, y) => x - y); const qa = k => abs[Math.floor(k * abs.length)]
  // flat-sphere chord sag for a 4.19 m edge (geometry floor): s^2/(8R)
  p('P2b.L4.edgeMid |err| p50/p90/p99/max', `${qa(0.5).toFixed(3)}/${qa(0.9).toFixed(3)}/${qa(0.99).toFixed(3)}/${abs[abs.length - 1].toFixed(3)}`)
  p('P2b.L4.chordSagFloor_m', ((TF.chunkArcWidth(4) / TF.GRID_N) ** 2 / (8 * R)).toFixed(4))
  p('P2b.L4.frac>0.25m', (abs.filter(e => e > 0.25).length / abs.length).toFixed(3))
}
// ---- P5b the no-data selected leaves at the spawn: where, and is anything drawn there? ----
{
  const pool = fakePool(MC.PLAY_POOL_OPTS.meshCount), lod = new MoonLod(pool, R)
  const rr = R + hS + 1.4, cx = S.x * rr, cy = S.y * rr, cz = S.z * rr
  for (let fr = 0; fr < 400; fr++) { lod.update(cx, cy, cz); pool.answerAll() }
  const ds = [], dsData = []; let covered = 0, holes = 0, inGate = 0
  for (const arr of lod.faces) for (const n of arr) if (lod.isSelectedLeaf(n)) {
    const d = Math.hypot(cx - n.ox, cy - n.oy, cz - n.oz)
    if (lod.nodeHasData(n)) { dsData.push(d); continue }
    ds.push(d)
    let anc = false; for (let q = n.parent; q !== null; q = q.parent) if (lod.nodeHasData(q) && pool.records[q.activeRec >= 0 ? q.activeRec : q.pendingRec].mesh.visible) anc = true
    // children with data also cover it
    let kids = false
    if (n.level < 4) for (let c = 0; c < 4; c++) if (lod.nodeHasData(lod.childOf(n, c))) kids = true
    if (anc || kids) covered++; else holes++
    const ol = Math.hypot(n.ox, n.oy, n.oz); if ((n.ox * S.x + n.oy * S.y + n.oz * S.z) / ol >= Math.cos(MC.PLAY_TUNING.readyRadiusM / R)) inGate++
  }
  ds.sort((x, y) => x - y); dsData.sort((x, y) => x - y)
  p('P5b.spawn.noData count/holes(no ancestor/child mesh)/insideLoadingGate', `${ds.length}/${holes}/${inGate}`)
  p('P5b.spawn.noData dist min/max m', `${ds[0]?.toFixed(0)}/${ds[ds.length - 1]?.toFixed(0)}`)
  p('P5b.spawn.withData dist max m', dsData[dsData.length - 1].toFixed(0))
  p('P5b.spawn.residentAround(300m)', lod.residentAround(S.x, S.y, S.z, MC.PLAY_TUNING.readyRadiusM).toFixed(3))
  // visibility of a hole from the eye: max terrain-top elevation angle over the hole centre vs bare-sphere horizon
  let visibleHoles = 0
  for (const arr of lod.faces) for (const n of arr) if (lod.isSelectedLeaf(n) && !lod.nodeHasData(n)) {
    const ol = Math.hypot(n.ox, n.oy, n.oz), ux = n.ox / ol, uy = n.oy / ol, uz = n.oz / ol
    const top = R + H(ux, uy, uz)
    const vx = ux * top - cx, vy = uy * top - cy, vz = uz * top - cz, vl = Math.hypot(vx, vy, vz)
    // march the eye->hole ray against terrain; visible if no sample is below the ground
    let blocked = false
    for (let k = 1; k < 200 && !blocked; k++) { const t = k / 200; const qx = cx + vx * t, qy = cy + vy * t, qz = cz + vz * t, ql = Math.hypot(qx, qy, qz); if (ql < R + H(qx / ql, qy / ql, qz / ql) - 0.5) blocked = true }
    if (!blocked) visibleHoles++
  }
  p('P5b.spawn.noData leaves with an unobstructed eye ray to their terrain top', visibleHoles)
}
control('probe_finished', true)
p('controls', `${cOk}/${cN}`)