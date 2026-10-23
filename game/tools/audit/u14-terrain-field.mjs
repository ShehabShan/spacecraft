// A1-U14 probe — terrain field: noise range, height bound vs configured maxTerrainHeight /
// HEIGHT_SLACK, determinism, cube-face seams, spherify metric, chunk-size claims, normal
// accuracy (READ-ONLY audit). Imports the REAL core; references are written from math here.
// Run from game/:  node tools/audit/u14-terrain-field.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const SP = await import('../../src/core/terrain/spherify.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const { initTerrainField, terrainHeight, terrainNormalInto, TEST_PLANET, chunkArcWidth, gridCoord, GRID_N, chunkKey } = TF
const { noise3, initNoise, mulberry32 } = NZ
const { spherifyInto, faceCubePointInto, sphereToCubeInto, FACE_C, FACE_U, FACE_V } = SP
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(6)) : String(x))
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }
const deg = (r) => (r * 180) / Math.PI
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }

// Field configs as used by consumers (copied from the call sites, cited in the report)
const MOON = MC.MOON_PARAMS
const STEEP = { name: 'M1E STEEP', radius: 5000, seed: 777, continentFreq: 1.2, continentAmp: 40,
  maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200, detailFreq: 8, detailAmp: 3 }
const FIELDS = [
  // [params, configured maxTerrainHeight of the KCC/flight that walks it, HEIGHT_SLACK of the LOD that renders it]
  [TEST_PLANET, 900, 900, 'KCC EARTHSCALE_ASTRONAUT / flight default 900; m1c/m1d/m1e HEIGHT_SLACK 900'],
  [MOON, MC.MAX_TERRAIN_H, MC.HEIGHT_SLACK, 'moonConfig MAX_TERRAIN_H / HEIGHT_SLACK'],
  [STEEP, 900, 900, 'm1e slope suite: kcc = EARTHSCALE_ASTRONAUT (maxTerrainHeight 900)'],
]

// ---- P1 raw simplex range: dense random + hill climb on |noise3| ----
{
  initNoise(12345)
  const rnd = mulberry32(99)
  let best = 0, bx = 0, by = 0, bz = 0
  const tops = []
  for (let i = 0; i < 2_000_000; i++) {
    const x = rnd() * 64, y = rnd() * 64, z = rnd() * 64
    const n = Math.abs(noise3(x, y, z))
    if (n > 0.8) tops.push([n, x, y, z])
    if (n > best) { best = n; bx = x; by = y; bz = z }
  }
  tops.sort((a, b) => b[0] - a[0])
  let climbed = best
  for (const [n0, x0, y0, z0] of tops.slice(0, 40)) {
    let x = x0, y = y0, z = z0, n = n0, s = 0.02
    for (let it = 0; it < 4000; it++) {
      const nx = x + (rnd() - 0.5) * s, ny = y + (rnd() - 0.5) * s, nz = z + (rnd() - 0.5) * s
      const v = Math.abs(noise3(nx, ny, nz))
      if (v > n) { n = v; x = nx; y = ny; z = nz } else if (it % 400 === 399) s *= 0.5
    }
    if (n > climbed) climbed = n
  }
  p('P1.noise3_absmax_random', f(best)); p('P1.noise3_absmax_climbed', f(climbed))
  globalThis.NMAX = climbed
}

// ---- P2 height bound per field: Fibonacci sphere + hill climb on h ----
const fib = (i, n) => { const y = 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(1 - y * y); const t = i * 2.399963229728653; return [r * Math.cos(t), y, r * Math.sin(t)] }
for (const [P, maxH, slack, note] of FIELDS) {
  initTerrainField(P)
  const N = 600_000
  let hi = -1e9, lo = 1e9, above = 0, aboveSlack = 0, hd = null
  const tops = []
  for (let i = 0; i < N; i++) {
    const d = fib(i, N); const h = terrainHeight(d[0], d[1], d[2])
    if (h > hi) { hi = h; hd = d }
    if (h < lo) lo = h
    if (h > maxH) above++
    if (Math.abs(h) > slack) aboveSlack++
    if (tops.length < 64 || h > tops[63][0]) { tops.push([h, d]); tops.sort((a, b) => b[0] - a[0]); if (tops.length > 64) tops.pop() }
  }
  const rnd = mulberry32(7)
  let climbed = hi
  for (const [h0, d0] of tops) {
    let d = d0, h = h0, s = 2e-3
    for (let it = 0; it < 1500; it++) {
      const c = norm([d[0] + (rnd() - 0.5) * s, d[1] + (rnd() - 0.5) * s, d[2] + (rnd() - 0.5) * s])
      const v = terrainHeight(c[0], c[1], c[2])
      if (v > h) { h = v; d = c } else if (it % 150 === 149) s *= 0.5
    }
    if (h > climbed) climbed = h
  }
  const bound = P.continentAmp + P.mountainAmp + P.detailAmp
  p(`P2.${P.name.replace(/\W+/g, '_')}`, `hMin=${f(lo)} hMax=${f(hi)} hMaxClimbed=${f(climbed)} ampSum=${bound} ` +
    `configMaxTerrainHeight=${maxH} fracAboveMax=${f(above / N)} heightSlack=${slack} fracAbsAboveSlack=${f(aboveSlack / N)} ` +
    `areaAboveMax_km2=${f((above / N) * 4 * Math.PI * P.radius * P.radius / 1e6)} (${note})`)
}

// ---- P3 determinism + seed handling ----
{
  initTerrainField(MOON)
  const ds = []; for (let i = 0; i < 2000; i++) ds.push(fib(i, 2000))
  const a = ds.map((d) => terrainHeight(d[0], d[1], d[2]))
  const nA = { x: 0, y: 0, z: 0 }; terrainNormalInto(0.3, 0.5, Math.sqrt(1 - 0.34), nA); const nA0 = { ...nA }
  initTerrainField(TEST_PLANET); initTerrainField(STEEP); initTerrainField(MOON)
  const b = ds.map((d) => terrainHeight(d[0], d[1], d[2]))
  terrainNormalInto(0.3, 0.5, Math.sqrt(1 - 0.34), nA)
  control('reinit_bit_identical', a.every((v, i) => Object.is(v, b[i])) && nA.x === nA0.x && nA.y === nA0.y && nA.z === nA0.z)
  // seed aliasing: >>>0 truncation
  const sample = (seed) => { initNoise(seed); let s = 0; for (let i = 0; i < 200; i++) s += noise3(i * 0.37, i * 0.11, i * 0.73); return s }
  const s1 = sample(1), s1b = sample(1 + 2 ** 32), s15 = sample(1.9), sNeg = sample(-1), sMax = sample(2 ** 32 - 1)
  p('P3.seed_alias', `seed1==seed(1+2^32):${s1 === s1b} seed1==seed1.9:${s1 === s15} seed(-1)==seed(2^32-1):${sNeg === sMax}`)
  // idempotence trap: initNoise(seed) skipped when seed===activeSeed; NaN never cached
  initNoise(NaN); const n1 = noise3(0.3, 0.2, 0.1); initNoise(NaN); const n2 = noise3(0.3, 0.2, 0.1)
  p('P3.nan_seed', `stable=${n1 === n2}`)
  // two planets in one thread: the field is a module singleton
  initTerrainField(MOON); const hm = terrainHeight(0, 1, 0); initTerrainField(TEST_PLANET); const ht = terrainHeight(0, 1, 0)
  p('P3.singleton', `after initTerrainField(TEST) the moon query (0,1,0) returns ${f(ht)} not ${f(hm)} — one active field per thread`)
}

// ---- P4 face tables + cross-face seam bits ----
{
  let rh = 0
  for (let fc = 0; fc < 6; fc++) {
    const U = [FACE_U[fc * 3], FACE_U[fc * 3 + 1], FACE_U[fc * 3 + 2]], V = [FACE_V[fc * 3], FACE_V[fc * 3 + 1], FACE_V[fc * 3 + 2]]
    const C = [FACE_C[fc * 3], FACE_C[fc * 3 + 1], FACE_C[fc * 3 + 2]]
    const x = [U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0]]
    if (x[0] === C[0] && x[1] === C[1] && x[2] === C[2]) rh++
  }
  control('UxV_eq_C_6faces', rh === 6)
  for (const L of [0, 4, 8, 12]) {
    const D = GRID_N << L
    const map = new Map(); let pts = 0
    const o = { x: 0, y: 0, z: 0 }
    for (let fc = 0; fc < 6; fc++) for (let side = 0; side < 4; side++) for (let g = 0; g <= D; g += Math.max(1, D >> 9)) {
      const t = gridCoord(g, D)
      const u = side === 0 ? -1 : side === 1 ? 1 : t, v = side === 2 ? -1 : side === 3 ? 1 : t
      faceCubePointInto(fc, u, v, o); spherifyInto(o.x, o.y, o.z, o)
      const k = `${o.x.toFixed(9)},${o.y.toFixed(9)},${o.z.toFixed(9)}`
      const e = `${o.x},${o.y},${o.z}`
      if (!map.has(k)) map.set(k, new Set()); map.get(k).add(e); pts++
    }
    let mism = 0, single = 0
    for (const s of map.values()) if (s.size > 1) mism++
    p(`P4.seams.L${L}`, `edgeSamples=${pts} uniquePoints=${map.size} bitMismatches=${mism}`)
    if (L === 4) control('seam_L4_zero_mismatch', mism === 0)
  }
  // inverse round trip incl. near-edge
  const rnd = mulberry32(3); let maxE = 0
  const cc = { face: 0, u: 0, v: 0 }, o = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < 200000; i++) {
    const fc = (rnd() * 6) | 0, u = (rnd() * 2 - 1) * (i % 2 ? 1 : 1 - 1e-9 * rnd()), v = i % 3 ? rnd() * 2 - 1 : (rnd() < 0.5 ? -1 : 1)
    faceCubePointInto(fc, u, v, o); spherifyInto(o.x, o.y, o.z, o)
    sphereToCubeInto(o.x, o.y, o.z, cc)
    const q = { x: 0, y: 0, z: 0 }; faceCubePointInto(cc.face, cc.u, cc.v, q); spherifyInto(q.x, q.y, q.z, q)
    maxE = Math.max(maxE, Math.abs(q.x - o.x), Math.abs(q.y - o.y), Math.abs(q.z - o.z))
  }
  p('P4.inverse_roundtrip_maxerr', f(maxE))
  let ue = 0; for (let i = 0; i < 100000; i++) { const fc = (rnd() * 6) | 0; faceCubePointInto(fc, rnd() * 2 - 1, rnd() * 2 - 1, o); spherifyInto(o.x, o.y, o.z, o); ue = Math.max(ue, Math.abs(Math.hypot(o.x, o.y, o.z) - 1)) }
  p('P4.unit_norm_maxerr', f(ue))
}

// ---- P5 metric: Jacobian singular values over a face (spherified vs gnomonic) ----
{
  const sph = (u, v) => { const o = { x: 0, y: 0, z: 0 }; faceCubePointInto(4, u, v, o); spherifyInto(o.x, o.y, o.z, o); return [o.x, o.y, o.z] }
  const gno = (u, v) => norm([u, v, 1])
  const sv = (F, u, v) => {
    const h = 1e-6
    const a = F(Math.min(1, u + h), v), b = F(Math.max(-1, u - h), v), c = F(u, Math.min(1, v + h)), d = F(u, Math.max(-1, v - h))
    const du = (Math.min(1, u + h) - Math.max(-1, u - h)), dv = (Math.min(1, v + h) - Math.max(-1, v - h))
    const J1 = [(a[0] - b[0]) / du, (a[1] - b[1]) / du, (a[2] - b[2]) / du], J2 = [(c[0] - d[0]) / dv, (c[1] - d[1]) / dv, (c[2] - d[2]) / dv]
    const E = J1[0] ** 2 + J1[1] ** 2 + J1[2] ** 2, G = J2[0] ** 2 + J2[1] ** 2 + J2[2] ** 2, Fm = J1[0] * J2[0] + J1[1] * J2[1] + J1[2] * J2[2]
    const tr = E + G, det = E * G - Fm * Fm, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det))
    return [Math.sqrt(tr / 2 - disc), Math.sqrt(tr / 2 + disc), Math.sqrt(E), Math.sqrt(det)]
  }
  for (const [name, F] of [['spherified', sph], ['gnomonic', gno]]) {
    let smin = 9, smax = 0, amin = 9, amax = 0, wmin = '', wmax = ''
    const M = 200
    for (let i = 0; i <= M; i++) for (let j = 0; j <= M; j++) {
      const u = -1 + (2 * i) / M, v = -1 + (2 * j) / M
      const [s1, s2, , ar] = sv(F, u, v)
      if (s1 < smin) { smin = s1; wmin = `(${f(u)},${f(v)})` }
      if (s2 > smax) { smax = s2; wmax = `(${f(u)},${f(v)})` }
      amin = Math.min(amin, ar); amax = Math.max(amax, ar)
    }
    const c0 = sv(F, 0, 0), e0 = sv(F, 1, 0), k0 = sv(F, 1, 1)
    p(`P5.${name}`, `|dp/du| centre=${f(c0[2])} edgeMid(1,0)=${f(e0[2])} corner=${f(k0[2])} | sigmaMin=${f(smin)}@${wmin} sigmaMax=${f(smax)}@${wmax} ` +
      `linearRatio=${f(smax / smin)} areaRatio=${f(amax / amin)} | edgeMid sigmas=${f(e0[0])}/${f(e0[1])} (anisotropy ${f(e0[1] / e0[0])})`)
    if (name === 'spherified') globalThis.SMAX = smax
  }
}

// ---- P6 chunkArcWidth "conservative" + brad = 0.75·width (unit sphere, no height) ----
{
  const o = { x: 0, y: 0, z: 0 }, c = { x: 0, y: 0, z: 0 }
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)))
  for (const L of [0, 2, 4, 6, 8]) {
    const D = GRID_N << L, cnt = 1 << L, W = chunkArcWidth(L) / TF.activeTerrainParams().radius
    let maxSide = 0, minSide = 9, maxRad = 0, worst = ''
    const step = Math.max(1, cnt >> 4)
    for (let fc = 0; fc < 6; fc += 5) for (let ix = 0; ix < cnt; ix += (ix === cnt - 2 ? 1 : step)) for (let iy = 0; iy < cnt; iy += (iy === cnt - 2 ? 1 : step)) {
      faceCubePointInto(fc, gridCoord(ix * GRID_N + 16, D), gridCoord(iy * GRID_N + 16, D), c); spherifyInto(c.x, c.y, c.z, c)
      // four sides: arc length along the grid boundary; radius = max angle centre→boundary vertex
      for (let side = 0; side < 4; side++) {
        let len = 0; const prev = { x: 0, y: 0, z: 0 }
        for (let k = 0; k <= GRID_N; k++) {
          const gu = side < 2 ? ix * GRID_N + k : ix * GRID_N + (side === 2 ? 0 : GRID_N)
          const gv = side < 2 ? iy * GRID_N + (side === 0 ? 0 : GRID_N) : iy * GRID_N + k
          faceCubePointInto(fc, gridCoord(gu, D), gridCoord(gv, D), o); spherifyInto(o.x, o.y, o.z, o)
          if (k) len += ang(prev, o)
          prev.x = o.x; prev.y = o.y; prev.z = o.z
          const r = ang(c, o); if (r > maxRad) maxRad = r
        }
        if (len > maxSide) { maxSide = len; worst = `f${fc} ix${ix} iy${iy} s${side}` }
        if (len < minSide) minSide = len
      }
    }
    p(`P6.L${L}`, `maxSide/width=${f(maxSide / W)}@${worst} minSide/width=${f(minSide / W)} maxCentreToVertex/(0.75·width)=${f(maxRad / (0.75 * W))}`)
  }
  control('chunkKey_L8_unique_corner', chunkKey(0, 8, 255, 255) !== chunkKey(0, 9, 0, 255))
  p('P6.chunkKey_collision_L9', `key(0,9,1,0)=${chunkKey(0, 9, 1, 0)} key(0,9,0,256)=${chunkKey(0, 9, 0, 256)} equal=${chunkKey(0, 9, 1, 0) === chunkKey(0, 9, 0, 256)}`)
}

// ---- P7 normal accuracy: engine ε=0.002 rad vs independent fine-ε gradient normal ----
{
  const refNormal = (P, d) => {
    // independent: tangent basis from Gram-Schmidt on z or x; ε=2e-6 rad; n ∝ d − ∇_s h / (R+h)
    const a = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]
    let e1 = [a[1] * d[2] - a[2] * d[1], a[2] * d[0] - a[0] * d[2], a[0] * d[1] - a[1] * d[0]]; e1 = norm(e1)
    const e2 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]]
    const eps = 2e-6
    const H = (t1, t2) => { const q = norm([d[0] + t1 * e1[0] + t2 * e2[0], d[1] + t1 * e1[1] + t2 * e2[1], d[2] + t1 * e1[2] + t2 * e2[2]]); return terrainHeight(q[0], q[1], q[2]) }
    const g1 = (H(eps, 0) - H(-eps, 0)) / (2 * eps), g2 = (H(0, eps) - H(0, -eps)) / (2 * eps)
    const r = P.radius + H(0, 0)
    return norm([d[0] - (g1 * e1[0] + g2 * e2[0]) / r, d[1] - (g1 * e1[1] + g2 * e2[1]) / r, d[2] - (g1 * e1[2] + g2 * e2[2]) / r])
  }
  const n = { x: 0, y: 0, z: 0 }
  for (const [P] of FIELDS) {
    initTerrainField(P)
    const rnd = mulberry32(11); const errs = [], serr = []; let steepMis = 0, steepN = 0
    for (let i = 0; i < 20000; i++) {
      const d = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1])
      terrainNormalInto(d[0], d[1], d[2], n)
      const r = refNormal(P, d)
      errs.push(deg(Math.acos(Math.min(1, n.x * r[0] + n.y * r[1] + n.z * r[2]))))
      const sE = deg(Math.acos(Math.min(1, n.x * d[0] + n.y * d[1] + n.z * d[2]))), sR = deg(Math.acos(Math.min(1, r[0] * d[0] + r[1] * d[1] + r[2] * d[2])))
      serr.push(sE - sR)
      if (sR > 45) { steepN++; if (sE <= 45) steepMis++ }
    }
    errs.sort((a, b) => a - b); serr.sort((a, b) => a - b)
    const q = (a, x) => a[Math.min(a.length - 1, Math.floor(a.length * x))]
    p(`P7.${P.name.replace(/\W+/g, '_')}`, `epsArc_m=${f(0.002 * P.radius)} shortestDetailWavelength_m≈${f(P.radius / (P.detailFreq * 4))} ` +
      `normalErrDeg p50=${f(q(errs, 0.5))} p99=${f(q(errs, 0.99))} max=${f(errs[errs.length - 1])} slopeErrDeg p1=${f(q(serr, 0.01))} p99=${f(q(serr, 0.99))} ` +
      `trueSlope>45_reportedBelow=${steepMis}/${steepN}`)
  }
  // frame-switch discontinuity: engine ref axis flips where |dy| crosses |dx| (min-abs axis)
  initTerrainField(MOON)
  let jmax = 0; const rnd = mulberry32(5); const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 }
  for (let i = 0; i < 5000; i++) {
    const s = 0.1 + rnd() * 0.5, z = Math.sqrt(1 - 2 * s * s)
    const e = 1e-12
    const d1 = norm([s + e, s - e, z]), d2 = norm([s - e, s + e, z])
    terrainNormalInto(d1[0], d1[1], d1[2], a); terrainNormalInto(d2[0], d2[1], d2[2], b)
    jmax = Math.max(jmax, deg(Math.acos(Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))))
  }
  p('P7.frame_switch_jump_deg_max', f(jmax))
}

// ---- P8 zero-GC: GC events during 1e6 normal + height calls ----
{
  initTerrainField(MOON)
  let gcs = 0; const obs = new PerformanceObserver((l) => { gcs += l.getEntries().length }); obs.observe({ entryTypes: ['gc'] })
  const o = { x: 0, y: 0, z: 0 }; let acc = 0
  for (let i = 0; i < 1_000_000; i++) { const d = fib(i, 1_000_000); terrainNormalInto(d[0], d[1], d[2], o); acc += o.x }
  await new Promise((r) => setTimeout(r, 50))
  const g1 = gcs; gcs = 0
  for (let i = 0; i < 1_000_000; i++) { const t = i * 1e-6; terrainNormalInto(Math.cos(t), Math.sin(t), 0, o); acc += o.x + terrainHeight(Math.cos(t), 0, Math.sin(t)) }
  await new Promise((r) => setTimeout(r, 50)); obs.disconnect()
  p('P8.gc_events', `withProbeArrays=${g1} pureEngineLoop=${gcs} (acc ${f(acc)})`)
}

p('controls', `${cOk}/${cN}`)