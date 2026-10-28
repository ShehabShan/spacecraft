// T3 P0 quality (session 147): feasibility probe for the docs/T3-plan.md §3 design.
// Standalone prototype of the Moon profile — NO game code is edited. It also takes
// the pre-edit default-path pins (SHA-256 of terrainHeight on 4,096 Fibonacci dirs)
// that S1's gate must reproduce bit-for-bit after editing terrainField.ts.
// Run from the repo root: node docs/audit/evidence/T3/P0/feasibility-probe.mjs
import { register } from 'node:module'
import { createHash } from 'node:crypto'
register('../../../../../game/tools/ts-resolve-loader.mjs', import.meta.url)
const SRC = new URL('../../../../../game/src/', import.meta.url)
const TF = await import(new URL('core/terrain/terrainField.ts', SRC).href)
const NZ = await import(new URL('core/terrain/noise.ts', SRC).href)
const MC = await import(new URL('play/world/moonConfig.ts', SRC).href)
const R = MC.MOON_R, HMAX = MC.MAX_TERRAIN_H

function fibDir(i, N) {
  const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i
  return [Math.cos(th) * r, y, Math.sin(th) * r]
}

// ---- 1. default-path pins (pre-edit tree) --------------------------------
function pin(params) {
  TF.initTerrainField(params)
  const h = createHash('sha256'), b = new Float64Array(1)
  for (let i = 0; i < 4096; i++) { const [x, y, z] = fibDir(i, 4096); b[0] = TF.terrainHeight(x, y, z); h.update(new Uint8Array(b.buffer)) }
  return h.digest('hex')
}
const HARNESS_MOON = { ...MC.MOON_PARAMS, name: 'M1F Moon (catalog)' }
const pT1 = pin(TF.TEST_PLANET), pM1 = pin(HARNESS_MOON), pT2 = pin(TF.TEST_PLANET), pM2 = pin(HARNESS_MOON)
console.log(`PIN TEST_PLANET ${pT1} (repeat ${pT1 === pT2 ? 'identical' : 'DIFFERENT'})`)
console.log(`PIN HARNESS_MOON ${pM1} (repeat ${pM1 === pM2 ? 'identical' : 'DIFFERENT'})`)

// ---- 2. prototype profile -------------------------------------------------
function hash01(ix, iy, iz, s) {
  let h = Math.imul(ix, 0x8da6b343) ^ Math.imul(iy, 0xd8163841) ^ Math.imul(iz, 0xcb1ab31f) ^ s
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15
  return (h >>> 0) / 4294967296
}
// Crater layer on a 3D cell lattice of the direction (continuous across cube faces).
function craters(dx, dy, dz, F, pOcc, rMin, rMax, depthK, rimK, seed) {
  const px = dx * F, py = dy * F, pz = dz * F
  const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz)
  let h = 0
  // WHY (prune): a crater centre lies inside its cell box, so a cell whose box is
  // farther than the reach (1.8·rMax, in lattice units) cannot touch this sample.
  const reach = 1.8 * rMax / R * F, r2 = reach * reach
  const fx = px - cx, fy = py - cy, fz = pz - cz
  for (let a = -1; a <= 1; a++) {
    const gx = a < 0 ? fx : a > 0 ? 1 - fx : 0; if (gx * gx > r2) continue
    for (let b = -1; b <= 1; b++) {
      const gy = b < 0 ? fy : b > 0 ? 1 - fy : 0; if (gx * gx + gy * gy > r2) continue
      for (let c = -1; c <= 1; c++) {
    const gz = c < 0 ? fz : c > 0 ? 1 - fz : 0; if (gx * gx + gy * gy + gz * gz > r2) continue
    const ix = cx + a, iy = cy + b, iz = cz + c
    if (hash01(ix, iy, iz, seed) > pOcc) continue
    const ox = (ix + hash01(ix, iy, iz, seed + 1)) / F, oy = (iy + hash01(ix, iy, iz, seed + 2)) / F, oz = (iz + hash01(ix, iy, iz, seed + 3)) / F
    const ol = Math.sqrt(ox * ox + oy * oy + oz * oz)
    if (Math.abs(ol - 1) > 0.5 / F) continue
    const u = hash01(ix, iy, iz, seed + 4)
    const rm = rMin + (rMax - rMin) * u * u, rA = rm / R
    // WHY (fast variant): small-angle chord distance instead of acos/cos (rA ≤ 0.05 rad,
    // error < 0.1%); reach 1.8·r (rim Gaussian is < 0.6% there).
    const ex = dx - ox / ol, ey = dy - oy / ol, ez = dz - oz / ol
    const x2 = (ex * ex + ey * ey + ez * ez) / (rA * rA)
    if (x2 > 3.24) continue
    const x = Math.sqrt(x2)
    if (x < 1) h += rm * depthK * (x * x - 1)
    const g = (x - 1) / 0.35
    h += rm * rimK * Math.exp(-g * g)
  }}}
  return h
}
function makeBasins(radii, seed) {
  const rnd = NZ.mulberry32(seed), out = [{ d: [0, 0, 1], r: radii[0] }]
  for (let k = 1; k < radii.length; k++) {
    let best = null
    for (let t = 0; t < 4000; t++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u)
      const d = [Math.cos(th) * q, u, Math.sin(th) * q]
      if (out.every(o => Math.acos(Math.min(1, d[0] * o.d[0] + d[1] * o.d[1] + d[2] * o.d[2])) > (o.r + radii[k]) * 0.9 + 0.08)) { best = d; break }
    }
    out.push({ d: best || [0, 1, 0], r: radii[k] })
  }
  return out
}
function makeProfile(cfg) {
  const basins = makeBasins(cfg.radii.map(r => r * cfg.rScale), 0x7a3e)
  const hp = { ...MC.MOON_PARAMS, mountainAmp: MC.MOON_PARAMS.mountainAmp * cfg.k, detailAmp: MC.MOON_PARAMS.detailAmp * cfg.kd }
  return { cfg, basins, hp }
}
let MASK = 0
function profileHeight(pr, dx, dy, dz) {
  const c = pr.cfg
  let mask = 0, rim = 0
  for (const b of pr.basins) {
    const ca = dx * b.d[0] + dy * b.d[1] + dz * b.d[2]
    // WHY (prune): beyond r + 0.3w + 3σ the mask is 0 and the rim < 1e-4·amp; skip acos.
    if (c.prune && ca < Math.cos(b.r + 0.3 * c.w + 3 * c.sig)) continue
    const a = Math.acos(ca > 1 ? 1 : ca < -1 ? -1 : ca)
    let t = (a - (b.r - c.w)) / c.w; t = t < 0 ? 0 : t > 1 ? 1 : t
    const m = 1 - t * t * (3 - 2 * t); if (m > mask) mask = m
    const g = (a - b.r - 0.3 * c.w) / c.sig
    rim += (c.rim0 + c.rim1 * b.r / 0.62) * Math.exp(-g * g)
  }
  MASK = mask
  // WHY: skip the highland field where the mare floor fully replaces it (cost).
  const hh = mask < 1 ? TF.terrainHeight(dx, dy, dz) : 0
  const fl = c.floor + NZ.fbm3(dx * c.floorF, dy * c.floorF, dz * c.floorF, 3, 2, 0.5) * c.floorAmp
  let h = hh * (1 - mask) + fl * mask + rim
  if (c.craters) {
    const cm = 1 - c.mareCrat * mask
    h += cm * (craters(dx, dy, dz, 9, 0.55, 18, 60, 0.18, 0.05, 0x51a7) + craters(dx, dy, dz, 32, 0.45, 8, 16, 0.18, 0.05, 0x3c91))
  }
  return h
}
// Slope via central differences in a canonical tangent frame (as terrainNormalInto).
function slopeDeg(H, d) {
  const [dx, dy, dz] = d, ax = Math.abs(dx), ay = Math.abs(dy), az = Math.abs(dz)
  const ref = ax <= ay && ax <= az ? [1, 0, 0] : ay <= az ? [0, 1, 0] : [0, 0, 1]
  let t1 = [dy * ref[2] - dz * ref[1], dz * ref[0] - dx * ref[2], dx * ref[1] - dy * ref[0]]
  const l1 = Math.hypot(...t1); t1 = t1.map(v => v / l1)
  const t2 = [dy * t1[2] - dz * t1[1], dz * t1[0] - dx * t1[2], dx * t1[1] - dy * t1[0]]
  const e = 0.002, ce = Math.cos(e), se = Math.sin(e)
  const S = (t, s) => { const q = [dx * ce + t[0] * se * s, dy * ce + t[1] * se * s, dz * ce + t[2] * se * s]; const r = R + H(q[0], q[1], q[2]); return q.map(v => v * r) }
  const A = S(t1, 1), B = S(t1, -1), C = S(t2, 1), D = S(t2, -1)
  const T1 = [A[0] - B[0], A[1] - B[1], A[2] - B[2]], T2 = [C[0] - D[0], C[1] - D[1], C[2] - D[2]]
  const n = [T1[1] * T2[2] - T1[2] * T2[1], T1[2] * T2[0] - T1[0] * T2[2], T1[0] * T2[1] - T1[1] * T2[0]]
  const c = (n[0] * dx + n[1] * dy + n[2] * dz) / Math.hypot(...n)
  return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI
}
function measure(label, H, maskOf) {
  const N = 20000; let lt5 = 0, lt45 = 0, ge50 = 0, ge30 = 0, mare = 0, mareFlat = 0, hmin = 1e9, hmax = -1e9
  for (let i = 0; i < N; i++) {
    const d = fibDir(i, N), h = H(d[0], d[1], d[2]); const m = maskOf ? MASK : 0
    if (h < hmin) hmin = h; if (h > hmax) hmax = h
    const s = slopeDeg(H, d)
    if (s < 5) lt5++; if (s < 45) lt45++; if (s >= 50) ge50++; if (s >= 30) ge30++
    if (m > 0.9) { mare++; if (s < 5) mareFlat++ }
  }
  const p = v => (100 * v / N).toFixed(1).padStart(5)
  console.log(`${label.padEnd(10)} <5°${p(lt5)}%  <45°${p(lt45)}%  ≥50°${p(ge50)}%  ≥30°${p(ge30)}%  mare${p(mare)}% (flat ${mare ? (100 * mareFlat / mare).toFixed(0) : '-'}%)  h ${hmin.toFixed(0)}..${hmax.toFixed(0)} m (bound ±${HMAX - 20})`)
}
function cost(H) {
  const N = 20000, t0 = performance.now(); let acc = 0
  for (let i = 0; i < N; i++) { const d = fibDir(i, N); acc += H(d[0], d[1], d[2]) }
  return [(performance.now() - t0) * 1e6 / N, acc]
}

TF.initTerrainField(MC.MOON_PARAMS)
measure('baseline', (x, y, z) => TF.terrainHeight(x, y, z), false)
cost((x, y, z) => TF.terrainHeight(x, y, z))
const [cBase] = cost((x, y, z) => TF.terrainHeight(x, y, z))

const RADII = [0.62, 0.52, 0.45, 0.40, 0.36, 0.32, 0.28]
const base = { radii: RADII, rScale: 1, k: 0.2, kd: 0.45, w: 0.08, sig: 0.05, rim0: 25, rim1: 45, floor: -25, floorAmp: 3, floorF: 22, mareCrat: 0.7, craters: true }
const CFG = {
  B: base,
  'B-nocrat': { ...base, craters: false },
  E: { ...base, floorAmp: 1.2, floorF: 8, mareCrat: 0.9 },
  F: { ...base, floorAmp: 1.2, floorF: 8, mareCrat: 0.9, rScale: 1.15 },
  G: { ...base, floorAmp: 1.2, floorF: 8, mareCrat: 0.9, rScale: 1.15, k: 0.12, kd: 0.35 },
  'G-prune': { ...base, floorAmp: 1.2, floorF: 8, mareCrat: 0.9, rScale: 1.15, k: 0.12, kd: 0.35, prune: true },
}
for (const [name, cfg] of Object.entries(CFG)) {
  const pr = makeProfile(cfg)
  TF.initTerrainField(pr.hp)
  const H = (x, y, z) => profileHeight(pr, x, y, z)
  measure(name, H, true)
  const [c] = cost(H)
  console.log(`${''.padEnd(10)} cost ${c.toFixed(0)} ns/sample = ${(c / cBase).toFixed(2)}× baseline (${cBase.toFixed(0)} ns)`)
}