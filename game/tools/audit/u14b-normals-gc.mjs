// A1-U14b probe — terrain normal convergence in ε, normal discontinuity on the tangent-frame
// switch planes, height of the m1e STEEP slope sites vs the KCC maxTerrainHeight, and
// per-call allocation of the height/normal hot path (READ-ONLY audit). Imports the REAL core.
// Run from game/:  node tools/audit/u14b-normals-gc.mjs [gc-mode]   (exit 0 = probe ran)
import { register } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const { initTerrainField, terrainHeight, terrainNormalInto, TEST_PLANET } = TF
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(5)) : String(x))
const deg = (r) => (r * 180) / Math.PI
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l] }
const q = (a, x) => a[Math.min(a.length - 1, Math.floor(a.length * x))]
const MOON = MC.MOON_PARAMS
const STEEP = { name: 'M1E STEEP', radius: 5000, seed: 777, continentFreq: 1.2, continentAmp: 40,
  maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200, detailFreq: 8, detailAmp: 3 }
const mode = process.argv[2] || 'all'

// Independent re-implementation of the engine's normal formula with a free ε, frame given
// (written from the documented formula: T1×T2 of ±ε chords of S(d)=(R+h)d). Used only to test
// convergence in ε; the engine's own value is the ε=0.002 reference point.
const normalEps = (R, d, eps, frame) => {
  const a = frame === 'z' ? [0, 0, 1] : frame === 'x' ? [1, 0, 0] : [0, 1, 0]
  const t1 = norm([d[1] * a[2] - d[2] * a[1], d[2] * a[0] - d[0] * a[2], d[0] * a[1] - d[1] * a[0]])
  const t2 = [d[1] * t1[2] - d[2] * t1[1], d[2] * t1[0] - d[0] * t1[2], d[0] * t1[1] - d[1] * t1[0]]
  const S = (v) => { const u = norm(v); const r = R + terrainHeight(u[0], u[1], u[2]); return [u[0] * r, u[1] * r, u[2] * r] }
  const c = Math.cos(eps), s = Math.sin(eps)
  const sub = (A, B) => [A[0] - B[0], A[1] - B[1], A[2] - B[2]]
  const T1 = sub(S([d[0] * c - t2[0] * s, d[1] * c - t2[1] * s, d[2] * c - t2[2] * s]), S([d[0] * c + t2[0] * s, d[1] * c + t2[1] * s, d[2] * c + t2[2] * s]))
  const T2 = sub(S([d[0] * c + t1[0] * s, d[1] * c + t1[1] * s, d[2] * c + t1[2] * s]), S([d[0] * c - t1[0] * s, d[1] * c - t1[1] * s, d[2] * c - t1[2] * s]))
  return norm([T1[1] * T2[2] - T1[2] * T2[1], T1[2] * T2[0] - T1[0] * T2[2], T1[0] * T2[1] - T1[1] * T2[0]])
}
const ang = (a, b) => deg(Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])))
const minAxis = (d) => { const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]); let k = 'x', m = ax; if (ay < m) { m = ay; k = 'y' } if (az < m) k = 'z'; return k }

if (mode === 'all') {
  const n = { x: 0, y: 0, z: 0 }
  for (const P of [TEST_PLANET, MOON, STEEP]) {
    initTerrainField(P)
    const rnd = NZ.mulberry32(21)
    const selfErr = [], half = [], quarter = [], frameDiff = []
    for (let i = 0; i < 6000; i++) {
      const d = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1])
      terrainNormalInto(d[0], d[1], d[2], n); const e = [n.x, n.y, n.z]
      const k = minAxis(d)
      const mine = normalEps(P.radius, d, 0.002, k)
      selfErr.push(ang(e, mine))
      half.push(ang(e, normalEps(P.radius, d, 0.001, k)))
      quarter.push(ang(normalEps(P.radius, d, 0.001, k), normalEps(P.radius, d, 0.0005, k)))
      const other = k === 'x' ? 'y' : 'x'
      frameDiff.push(ang(e, normalEps(P.radius, d, 0.002, other)))
    }
    for (const a of [selfErr, half, quarter, frameDiff]) a.sort((x, y) => x - y)
    const frac = (a, t) => f(a.filter((x) => x > t).length / a.length)
    p(`C1.${P.name.replace(/\W+/g, '_')}`, `reimplVsEngine max=${f(selfErr[selfErr.length - 1])} | ` +
      `eps→eps/2 p50=${f(q(half, 0.5))} p90=${f(q(half, 0.9))} p99=${f(q(half, 0.99))} frac>5deg=${frac(half, 5)} | ` +
      `eps/2→eps/4 p50=${f(q(quarter, 0.5))} p90=${f(q(quarter, 0.9))} | ` +
      `otherFrame p50=${f(q(frameDiff, 0.5))} p90=${f(q(frameDiff, 0.9))} p99=${f(q(frameDiff, 0.99))} frac>5deg=${frac(frameDiff, 5)} frac>15deg=${frac(frameDiff, 15)}`)
  }
  // C2: slope bands used by the m1e slope scan (moderate 18–28°, steep 52–68°, cliff >70°): height of those sites in STEEP
  initTerrainField(STEEP)
  const rnd = NZ.mulberry32(0x5109e5)
  const bands = { moderate: [18, 28], steep: [52, 68], cliff: [70, 90] }
  for (const [b, [lo, hi]] of Object.entries(bands)) {
    let cnt = 0, above = 0, hmax = -1e9
    for (let i = 0; i < 200000 && cnt < 2000; i++) {
      const d = norm([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1])
      terrainNormalInto(d[0], d[1], d[2], n)
      const s = deg(Math.acos(Math.min(1, n.x * d[0] + n.y * d[1] + n.z * d[2])))
      if (s > lo && s < hi) { cnt++; const h = terrainHeight(d[0], d[1], d[2]); if (h > 900) above++; if (h > hmax) hmax = h }
    }
    p(`C2.STEEP.${b}`, `sites=${cnt} fracAbove900m=${f(above / cnt)} hMax=${f(hmax)}`)
  }
}

// C3: allocation per call — GC count for 2e6 calls of each hot function vs an arithmetic baseline
{
  initTerrainField(MOON)
  let gcs = 0; const obs = new PerformanceObserver((l) => { gcs += l.getEntries().length }); obs.observe({ entryTypes: ['gc'] })
  const o = { x: 0.5, y: 0.5, z: 0.5 }; let acc = 0
  const run = async (name, fn) => {
    for (let i = 0; i < 200000; i++) acc += fn(i)  // warm-up (JIT)
    await new Promise((r) => setTimeout(r, 30)); gcs = 0
    const N = 2_000_000
    for (let i = 0; i < N; i++) acc += fn(i)
    await new Promise((r) => setTimeout(r, 30))
    p(`C3.${name}`, `gcEvents=${gcs} per1e6=${f(gcs / 2)}`)
  }
  await run('baseline_trig', (i) => Math.cos(i * 1e-6) * Math.sin(i * 1e-6))
  await run('noise3', (i) => NZ.noise3(i * 1e-3, 0.37, i * 7e-4))
  await run('terrainHeight', (i) => { const t = i * 1e-6; return terrainHeight(Math.cos(t), 0, Math.sin(t)) })
  await run('terrainNormalInto', (i) => { const t = i * 1e-6; terrainNormalInto(Math.cos(t), Math.sin(t) * 0.6, Math.sin(t) * 0.8, o); return o.x })
  obs.disconnect()
  p('C3.acc', f(acc))
}