// A1-U05c probe — m1d DDA penetration + analytic dive (read-only audit; AGENT_BRIEF §11).
// Builds MUTANT copies of the real flightController.ts (constants/lines replaced in the
// source text, esbuild type-strip, written to /tmp, imports re-pointed at the real
// atmosphere/aerodynamics/terrain modules so terrain state is shared), then:
//   (1) runs the harness T2 dive replica + T2 predicate on BASE / ENDPOINT-ONLY / COARSE /
//       NO-SWEEP (control) controllers;
//   (2) fires 3,000 low, fast, near-horizontal single ticks over real terrain and densely
//       samples each tick's straight path for true terrain penetration the sweep missed;
//   (3) measures terrain max height and slope against the DDA's assumed bounds (900 m, 1.2);
//   (4) integrates the vertical dive independently (RK4, dt 1e-4 s) for v@1000 m and
//       compares drag deceleration with a_struct and the telemetry peakG.
// Run (from game/): node tools/audit/u05c-m1d-dda-dive.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const phys = resolve(here, '../../src/core/physics')
const terr = resolve(here, '../../src/core/terrain')
const esbuild = await import('esbuild')
const TF = await import(pathToFileURL(join(terr, 'terrainField.ts')).href)
const AT = await import(pathToFileURL(join(phys, 'atmosphere.ts')).href)
const AE = await import(pathToFileURL(join(phys, 'aerodynamics.ts')).href)
const FC_SRC = readFileSync(join(phys, 'flightController.ts'), 'utf8')
const results = []
const check = (id, cond, msg) => { results.push([id, !!cond]); console.log(`[u05c] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }

function variant(name, edits) {
  let s = FC_SRC
  for (const [a, b] of edits) {
    if (!s.includes(a)) throw new Error(`mutation anchor missing in ${name}: ${a}`)
    s = s.replace(a, b)
  }
  s = s.replace("from './atmosphere'", `from '${pathToFileURL(join(phys, 'atmosphere.ts')).href}'`)
    .replace("from './aerodynamics'", `from '${pathToFileURL(join(phys, 'aerodynamics.ts')).href}'`)
    .replace("from '../terrain/terrainField'", `from '${pathToFileURL(join(terr, 'terrainField.ts')).href}'`)
    .replace("from '../terrain/spherify'", `from '${pathToFileURL(join(terr, 'spherify.ts')).href}'`)
  const js = esbuild.transformSync(s, { loader: 'ts', format: 'esm' }).code
  const f = `/tmp/u05c-fc-${name}.mjs`
  writeFileSync(f, js)
  return import(pathToFileURL(f).href)
}
const V = {
  BASE: await variant('base', []),
  ENDPOINT: await variant('endpoint', [['const DDA_LATTICE = 2048;', 'const DDA_LATTICE = 2;'], ['const DDA_MAX_GAP = 4;', 'const DDA_MAX_GAP = 1e9;']]),
  COARSE: await variant('coarse', [['const DDA_LATTICE = 2048;', 'const DDA_LATTICE = 64;'], ['const DDA_MAX_GAP = 4;', 'const DDA_MAX_GAP = 64;']]),
  NOSWEEP: await variant('nosweep', [['this._sweepTerrain(R, cfg);', ';']]),
}
TF.initTerrainField(TF.TEST_PLANET)
const R = TF.TEST_PLANET.radius
const CFG = V.BASE.EARTHSCALE_FLIGHT
const q = { x: 0, y: 0, z: 0, w: 1 }
const aglAt = (x, y, z) => { const r = Math.hypot(x, y, z); return r - (R + TF.terrainHeight(x / r, y / r, z / r)) }

// ---- (1) T2 dive replica (harness :494–530 observer/start, :686–691 predicate) ----------
function dive(FC) {
  const c = new FC.FlightController(FC.EARTHSCALE_FLIGHT)
  FC.quatFromBasisInto(0, -1, 0, 1, 0, 0, q)
  c.teleport(0, R + 10000, 0, 0, -2000, 0, q)
  c.resetIntegrityStats()
  const s = { prev: Infinity, v1000: -1, vmax: 0, minAGL: Infinity, maxDrag: 0, trueMin: Infinity }
  c.tickObserver = (k) => {
    const t = k.telemetry
    // independent truth: densely sample this tick's straight path (0.25 m) for penetration
    const p0 = k._prevPos, p1 = k.pos
    const L = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z), n = Math.max(1, Math.ceil(L / 0.25))
    if (Math.hypot(p0.x, p0.y, p0.z) < R + 1000) for (let i = 0; i <= n; i++) {
      const u = i / n, a = aglAt(p0.x + (p1.x - p0.x) * u, p0.y + (p1.y - p0.y) * u, p0.z + (p1.z - p0.z) * u)
      if (a < s.trueMin) s.trueMin = a
    }
    if (t.dragDecel > s.maxDrag) s.maxDrag = t.dragDecel
    if (t.grounded) return
    if (s.prev > 1000 && t.altMSL <= 1000 && s.v1000 < 0) s.v1000 = t.groundSpeed
    s.prev = t.altMSL
    if (t.groundSpeed > s.vmax) s.vmax = t.groundSpeed
    if (t.altAGL < s.minAGL) s.minAGL = t.altAGL
  }
  let sim = 0
  while (!c.telemetry.grounded && !(sim > 45)) { sim += 4 / 60; c.update(4 / 60, 6) }
  const I = c.integrity
  const t2 = s.v1000 > 150 && s.v1000 <= 400 && s.vmax >= 1980 && s.minAGL >= -1e-6 && c.telemetry.grounded && I.minPostTickAGL >= -1e-6
  return { t2, ...s, grounded: c.telemetry.grounded, minPost: I.minPostTickAGL, contacts: I.contacts, samples: I.ddaSamples, peakG: c.telemetry.peakG, sim }
}
const D = {}
for (const k of Object.keys(V)) {
  const r = D[k] = dive(V[k])
  console.log(`[u05c] dive ${k.padEnd(8)} T2=${r.t2} v1000=${r.v1000.toFixed(1)} vmax=${r.vmax.toFixed(0)} grounded=${r.grounded} minPostAGL=${r.minPost.toFixed(3)} trueMinPathAGL=${r.trueMin.toFixed(3)} contacts=${r.contacts} ddaSamples=${r.samples} maxDragDecel=${r.maxDrag.toFixed(1)} peakG=${r.peakG.toFixed(3)} sim=${r.sim.toFixed(1)}s`)
}
check('DIVE-ctl', D.BASE.t2 && !D.NOSWEEP.t2, 'control: BASE passes T2; removing the sweep entirely IS caught')
check('DIVE-1', D.ENDPOINT.t2 && D.COARSE.t2, 'T2 passes with an endpoint-only sweep (lattice 2, gap 1e9) and with a 16x coarser sweep (lattice 64, gap 64 m): the vertical dive cannot test the DDA gap/lattice (the no-clip mechanism)')

// ---- (2) low fast near-horizontal ticks: does the sweep miss real penetration? ----------
let seed = 0x5eed05c >>> 0
const rnd = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const starts = []
for (let i = 0; i < 3000; i++) {
  let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; const n = Math.hypot(x, y, z); x /= n; y /= n; z /= n
  let tx = rnd() * 2 - 1, ty = rnd() * 2 - 1, tz = rnd() * 2 - 1; const d = tx * x + ty * y + tz * z
  tx -= d * x; ty -= d * y; tz -= d * z; const m = Math.hypot(tx, ty, tz); tx /= m; ty /= m; tz /= m
  const h = TF.terrainHeight(x, y, z), agl = 4 + rnd() * 26, sp = 300 + rnd() * 1600, dip = -rnd() * 0.15
  starts.push([x, y, z, tx, ty, tz, h, agl, sp, dip])
}
function sweepStats(FC) {
  const c = new FC.FlightController(FC.EARTHSCALE_FLIGHT)
  let tunnel = 0, worst = 0, postNeg = 0, contacts = 0
  for (const [x, y, z, tx, ty, tz, h, agl, sp, dip] of starts) {
    const rr = R + h + agl
    FC.quatFromBasisInto(tx, ty, tz, x, y, z, q)
    c.teleport(x * rr, y * rr, z * rr, (tx + dip * x) * sp, (ty + dip * y) * sp, (tz + dip * z) * sp, q)
    c.resetIntegrityStats()
    c.integrateFlight(1 / 60)
    if (c.integrity.contacts > 0) { contacts++; continue }
    const p0 = c._prevPos, p1 = c.pos
    const L = Math.hypot(p1.x - p0.x, p1.y - p0.y, p1.z - p0.z), n = Math.max(1, Math.ceil(L / 0.1))
    let mn = Infinity
    for (let i = 0; i <= n; i++) { const u = i / n; const a = aglAt(p0.x + (p1.x - p0.x) * u, p0.y + (p1.y - p0.y) * u, p0.z + (p1.z - p0.z) * u); if (a < mn) mn = a }
    if (mn < 0) { tunnel++; if (-mn > worst) worst = -mn }
    if (c.integrity.minPostTickAGL < 0) postNeg++
  }
  return { tunnel, worst, postNeg, contacts }
}
const S = {}
for (const k of ['BASE', 'ENDPOINT', 'COARSE']) {
  const r = S[k] = sweepStats(V[k])
  console.log(`[u05c] 3000 low ticks ${k.padEnd(8)} contacts=${r.contacts} uncontacted-ticks-whose-path-goes-UNDER-terrain=${r.tunnel} worstDepth=${r.worst.toFixed(2)} m  ticks with minPostTickAGL<0=${r.postNeg}`)
}
check('SWEEP-ctl', S.BASE.tunnel === 0, `BASE sweep: ${S.BASE.tunnel} of 3,000 uncontacted ticks pass under the terrain (the no-clip claim holds in this sample)`)
check('SWEEP-1', S.ENDPOINT.tunnel > 0 && S.ENDPOINT.postNeg === 0, `ENDPOINT-only sweep tunnels on ${S.ENDPOINT.tunnel} ticks (worst ${S.ENDPOINT.worst.toFixed(1)} m deep) while minPostTickAGL never goes negative: the post-tick clause is blind to tunnelling`)

// ---- (3) terrain bounds vs the DDA assumptions (maxTerrainHeight 900, Lipschitz 1.2) ----
let hMax = -Infinity, hMin = Infinity, slopeMax = 0, nSteep = 0
const NS = 200000, ds = 0.5
for (let i = 0; i < NS; i++) {
  let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; const n = Math.hypot(x, y, z); x /= n; y /= n; z /= n
  let tx = rnd() * 2 - 1, ty = rnd() * 2 - 1, tz = rnd() * 2 - 1; const d = tx * x + ty * y + tz * z
  tx -= d * x; ty -= d * y; tz -= d * z; const m = Math.hypot(tx, ty, tz); tx /= m; ty /= m; tz /= m
  const h0 = TF.terrainHeight(x, y, z)
  const e = ds / (R + h0)
  let x1 = x + tx * e, y1 = y + ty * e, z1 = z + tz * e; const n1 = Math.hypot(x1, y1, z1)
  const h1 = TF.terrainHeight(x1 / n1, y1 / n1, z1 / n1)
  const sl = Math.abs(h1 - h0) / ds
  if (sl > slopeMax) slopeMax = sl
  if (sl > CFG_L()) nSteep++
  if (h0 > hMax) hMax = h0; if (h0 < hMin) hMin = h0
}
function CFG_L() { return 1.2 }
console.log(`[u05c] terrain ${NS} samples: h in [${hMin.toFixed(1)}, ${hMax.toFixed(1)}] m (maxTerrainHeight ${CFG.maxTerrainHeight}); max |dh/ds| over 0.5 m = ${slopeMax.toFixed(3)} (DDA_LIPSCHITZ 1.2); fraction steeper than 1.2 = ${(nSteep / NS * 100).toFixed(3)} %`)
check('TERR-1', hMax <= CFG.maxTerrainHeight, `sampled max height ${hMax.toFixed(1)} m ≤ maxTerrainHeight 900 (early-out band is safe on this sample)`)
check('TERR-2', slopeMax <= 1.2, `sampled max slope ${slopeMax.toFixed(3)} ≤ assumed Lipschitz 1.2`)

// ---- (4) independent vertical dive (RK4) + drag vs a_struct ------------------------------
const mu = CFG.planetMu, aero = AE.SHIP_AERO, atm = AT.EARTHSCALE_ATMOSPHERE
const rho = (alt) => alt <= 0 ? atm.rho0 : atm.rho0 * Math.exp(-alt / atm.scaleHeight)
const acc = (r, v) => { const p = rho(r - R); return -mu / (r * r) - (aero.betaQ * p * Math.abs(v) + aero.betaL * p) * v }
let r = R + 10000, v = -2000, t = 0, vAt1000 = NaN, peakDrag = 0, vmax = 2000
const hdt = 1e-4
const hTop = TF.terrainHeight(0, 1, 0)
while (r - R > hTop + 3) {
  const k1r = v, k1v = acc(r, v)
  const k2r = v + 0.5 * hdt * k1v, k2v = acc(r + 0.5 * hdt * k1r, v + 0.5 * hdt * k1v)
  const k3r = v + 0.5 * hdt * k2v, k3v = acc(r + 0.5 * hdt * k2r, v + 0.5 * hdt * k2v)
  const k4r = v + hdt * k3v, k4v = acc(r + hdt * k3r, v + hdt * k3v)
  const rn = r + hdt / 6 * (k1r + 2 * k2r + 2 * k3r + k4r), vn = v + hdt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
  if (r - R > 1000 && rn - R <= 1000) vAt1000 = Math.abs(v + (vn - v) * ((r - R - 1000) / (r - rn)))
  r = rn; v = vn; t += hdt
  const p = rho(r - R), dd = aero.betaQ * p * v * v + aero.betaL * p * Math.abs(v)
  if (dd > peakDrag) peakDrag = dd
  if (Math.abs(v) > vmax) vmax = Math.abs(v)
}
const vSafe1000 = AE.safeSpeedAt(aero, rho(1000))
const vacuum = Math.sqrt(2000 ** 2 + 2 * mu * (1 / (R + 1000) - 1 / (R + 10000)))
console.log(`[u05c] RK4 dive: v@1000 = ${vAt1000.toFixed(2)} m/s (Node replay ${D.BASE.v1000.toFixed(2)}, M1D claim 264.7); peak ${vmax.toFixed(1)} m/s; touchdown at h=${hTop.toFixed(1)} m after ${t.toFixed(2)} s at ${Math.abs(v).toFixed(1)} m/s; peak drag decel ${peakDrag.toFixed(1)} m/s² = ${(peakDrag / 9.81).toFixed(1)} g vs aStruct ${aero.aStruct} m/s²; v_safe(1000) = ${vSafe1000.toFixed(1)} m/s; no-drag v@1000 = ${vacuum.toFixed(0)} m/s`)
check('RK4-1', Math.abs(vAt1000 - D.BASE.v1000) / vAt1000 < 0.01 && Math.abs(vAt1000 - 264.7) < 3, `independent integration agrees with the engine (Δ ${(D.BASE.v1000 - vAt1000).toFixed(2)} m/s) and with the M1D 264.7 claim`)
check('GOV-1', peakDrag > 2 * aero.aStruct && D.BASE.maxDrag > 2 * aero.aStruct, `the governed dive decelerates at up to ${(peakDrag / aero.aStruct).toFixed(1)}× a_struct (RK4) / ${(D.BASE.maxDrag / aero.aStruct).toFixed(1)}× (engine telemetry): the "structural limit" is exceeded, not enforced`)
check('GOV-2', D.BASE.v1000 > vSafe1000, `at the 1,000 m gate the ship is ABOVE v_safe (${D.BASE.v1000.toFixed(1)} > ${vSafe1000.toFixed(1)} m/s)`)
check('G-1', D.BASE.peakG < 0.05 && D.BASE.maxDrag / 9.81 > 5, `telemetry peakG ${D.BASE.peakG.toFixed(3)} g during a ${(D.BASE.maxDrag / 9.81).toFixed(1)} g drag deceleration: sensed G excludes drag`)

const failed = results.filter(([, ok]) => !ok).map(([id]) => id)
console.log(`[u05c] ${results.length - failed.length}/${results.length} checks CONFIRMED${failed.length ? ' — not confirmed: ' + failed.join(',') : ''}`)