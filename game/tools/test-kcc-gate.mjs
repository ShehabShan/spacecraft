// F2e KCC gate (ADR-010): an INDEPENDENT check of the m1e contract — the vertical-jump Coriolis
// drift against an inertial RK4 truth, a FINITE clearance observation on every walking tick, and
// a per-tick yaw residual (commanded yaw and frame transport separated from unintended rotation).
// WHY: m1e R5 subtracts the blended-up tilt instead of the real launch normal (−0.97 cm artefact at
// zero spin) and never compares its own prediction (A1-U04-1); R1/R2 keep integrity.minAGL =
// Infinity while grounded, so a 0.10 m sink passes (A1-U04-3); R1's raw forward-delta bound
// accepts 4° yaw snaps (A1-U04-4). Recheck: docs/audit/U27b3b2b1-m1e-recheck.md. Truth here comes
// from PINNED catalog literals, an independent integrator and independent geometry; the only engine
// data shared is the terrain height field and its normal service (never KCC telemetry/integrity).
//
// Run from game/:
//   node tools/test-kcc-gate.mjs                              gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-kcc-gate.mjs --self-test [--deliberate]   every mutant must turn the gate red
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned literals (EARTHSCALE_ASTRONAUT on the M1C test planet; change only with an ADR) -----
const PIN = { planetRadius: 5000, planetMu: 245_250_000, gravityRange: 30_000, spinOmega: 0.0104,
  jumpSpeed: 5, groundClearance: 0.02 }
const R = PIN.planetRadius, CLR = PIN.groundClearance
// Error budgets, measured on the unmutated engine (ADR-010 records the numbers):
const JUMP_TOL = 0.004   // m, smooth sphere: |KCC landing − inertial truth| (tangential) at dt = 1/60
// Real sloped site: the launch carries ~0.4 m/s downhill, so the landing-tick contact error is
// ~v·dt/2 larger (measured 9.9 mm at 1/60, 1.6 mm at 1/240 — discretisation, convergence row).
// A launch along the blended up instead of the normal moves the landing by ~0.2 m (mutant).
const JUMP_REAL_TOL = 0.015
const SPIN_SYM = 1e-6    // m, smooth-sphere zero-spin / reversed-spin symmetry
const POS_TOL = 1e-6     // m, grounded clearance = groundClearance; abs = R_y(ωt)·pLocal
const YAW_K = 0.5, YAW_EPS = 1e-9 // rad, per-tick yaw residual ≤ K·δ² + ε (δ = per-tick up rotation)

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const SRC = {
  k: path.join(game, 'src/core/physics/astronautKCC.ts'),
  sf: path.join(game, 'src/core/physics/sphericalFrame.ts'),
  tf: path.join(game, 'src/core/terrain/terrainField.ts'),
}
const sha = () => Object.values(SRC).map((f) => createHash('sha256').update(readFileSync(f)).digest('hex')).join(':')
const PRODUCTION = sha()

let nBuild = 0
async function load(rewrites = []) {
  const hits = rewrites.map(() => 0)
  const out = path.join(game, 'node_modules', '.cache', `f2e-kcc-${process.pid}-${nBuild++}.mjs`)
  await build({
    stdin: { contents: `export * as K from './core/physics/astronautKCC'; export * as TF from './core/terrain/terrainField';`,
      resolveDir: path.join(game, 'src'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    plugins: [{ name: 'f2e-mutate', setup(b) {
      b.onLoad({ filter: /(astronautKCC|sphericalFrame|terrainField)\.ts$/ }, (a) => {
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
  if (bad.length) throw new Error(`rewrite matched nothing: ${String(bad[0][1]).slice(0, 80)}`)
  const M = await import(pathToFileURL(out).href)
  M.TF.initTerrainField(M.TF.TEST_PLANET)
  return M
}
// Test-only smooth sphere for the KCC (terrain 0, radial normal): the analytic Coriolis fixture.
const SMOOTH = ['k', "import { terrainHeight, terrainNormalInto } from '../terrain/terrainField';",
  'function terrainHeight(_x: number, _y: number, _z: number): number { return 0; }\n' +
  'function terrainNormalInto(x: number, y: number, z: number, out: { x: number; y: number; z: number }) { const l = Math.hypot(x, y, z); out.x = x / l; out.y = y / l; out.z = z / l; return out; }']

// ---- independent vector geometry --------------------------------------------------------------
const arr = (p) => [p.x, p.y, p.z]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => Math.hypot(a[0], a[1], a[2])
const unit = (a) => { const l = norm(a); return [a[0] / l, a[1] / l, a[2] / l] }
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
// Spin about +Y by θ (body → inertial): x' = x cosθ + z sinθ, z' = −x sinθ + z cosθ.
const rotY = (t, v) => [v[0] * Math.cos(t) + v[2] * Math.sin(t), v[1], -v[0] * Math.sin(t) + v[2] * Math.cos(t)]
function rodrigues(v, k, a) {
  const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v)
  return [0, 1, 2].map((i) => v[i] * c + kv[i] * s + k[i] * d * (1 - c))
}
const signedAngle = (a, b, axis) => Math.atan2(dot(cross(a, b), axis), dot(a, b))
const hOf = (TF) => (d) => TF.terrainHeight(d[0], d[1], d[2])
const nOf = (TF) => (d) => { const o = { x: 0, y: 0, z: 0 }; TF.terrainNormalInto(d[0], d[1], d[2], o); return arr(o) }
const flatH = () => 0, flatN = (d) => d

// Deterministic site scan near the equator: slope in [lo, hi] deg, normals within 1° of the
// centre normal 2 m away (so the jump lands on locally planar ground).
function findSite(TF, lo, hi) {
  let s = 0x2e5eed
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  for (let i = 0; i < 200000; i++) {
    const th = rnd() * 2 * Math.PI, y = (rnd() * 2 - 1) * 0.05, c = Math.sqrt(1 - y * y)
    const d = [Math.cos(th) * c, y, Math.sin(th) * c], n = nOf(TF)(d)
    const sl = Math.acos(Math.min(1, dot(n, d))) * 180 / Math.PI
    if (sl < lo || sl > hi) continue
    let ok = true
    for (let k = 0; k < 4 && ok; k++) {
      const a = k * Math.PI / 2, e = unit(add(d, [Math.cos(a) * 4e-4, Math.sin(a) * 4e-4, -Math.cos(a) * 4e-4]))
      if (Math.acos(Math.min(1, dot(nOf(TF)(e), n))) > Math.PI / 180) ok = false
    }
    if (ok) return { d, slopeDeg: sl }
  }
  throw new Error(`no site with slope ${lo}–${hi}°`)
}

// ---- inertial truth: RK4 from the launch state, contact against the ROTATING terrain -----------
// Launch at the tick-start spin phase θ0: P0 = R_y(θ0)·p0, V0 = Ω×P0 + R_y(θ0)·(n̂·u). Contact when
// |p| − R − h(R_y(−θ(t))·p̂) < groundClearance. Returns the planet-frame landing point.
function inertialTruth(p0, th0, omega, n, h) {
  const P0 = rotY(th0, p0), nI = rotY(th0, n)
  let y = [...P0, omega * P0[2] + nI[0] * PIN.jumpSpeed, nI[1] * PIN.jumpSpeed, -omega * P0[0] + nI[2] * PIN.jumpSpeed]
  const f = (s) => { const r = Math.hypot(s[0], s[1], s[2]), g = -PIN.planetMu / r ** 3; return [s[3], s[4], s[5], g * s[0], g * s[1], g * s[2]] }
  const ax = (s, k, hh) => s.map((v, i) => v + hh * k[i])
  const step = (s, hh) => { const a = f(s), b = f(ax(s, a, hh / 2)), c = f(ax(s, b, hh / 2)), d = f(ax(s, c, hh)); return s.map((v, i) => v + hh * (a[i] + 2 * b[i] + 2 * c[i] + d[i]) / 6) }
  const agl = (s, t) => { const p = s.slice(0, 3), d = unit(rotY(-(th0 + omega * t), p)); return norm(p) - R - h(d) - CLR }
  const H = 1e-4
  let t = 0
  for (let i = 0; i < 100000; i++) {
    const nx = step(y, H)
    if (t > 0.05 && agl(nx, t + H) < 0) {
      let lo = 0, hi = H
      for (let j = 0; j < 50; j++) { const m = (lo + hi) / 2; if (agl(step(y, m), t + m) < 0) hi = m; else lo = m }
      const m = (lo + hi) / 2, s = step(y, m), d = unit(rotY(-(th0 + omega * (t + m)), s.slice(0, 3)))
      return { t: t + m, land: scale(d, R + h(d) + CLR) }
    }
    y = nx; t += H
  }
  throw new Error('truth did not land')
}

function jump(M, over, dir, dt, h, n) {
  const cfg = { ...M.K.EARTHSCALE_ASTRONAUT, ...over }, k = new M.K.AstronautKCC(cfg)
  k.teleportSurface(dir[0], dir[1], dir[2])
  let ticks = 0
  for (let i = 0; i < Math.round(5 / 60 / dt); i++) { k.integrateTick(dt); ticks++ }
  const p0 = arr(k.pLocal), th0 = cfg.spinOmega * dt * ticks, launchN = n(unit(p0))
  k.input.jump = true
  let air = 0, landed = false
  for (let i = 0; i < 4 / dt; i++) { k.integrateTick(dt); if (k.grounded) { landed = true; break } air++ }
  const p1 = arr(k.pLocal), truth = inertialTruth(p0, th0, cfg.spinOmega, launchN, h)
  const r0 = unit(p0), tang = (v) => sub(v, scale(r0, dot(v, r0)))
  const east = unit([r0[2], 0, -r0[0]]) // Ω×p̂ direction for Ω = (0, +ω, 0)
  const dK = tang(sub(p1, p0)), dT = tang(sub(truth.land, p0)), err = norm(sub(dK, dT))
  return { landed, airS: air * dt, truthS: truth.t, westKcc: -dot(dK, east), westTruth: -dot(dT, east),
    errM: err, finite: [...p1].every(Number.isFinite) }
}

// ---- per-tick observer: clearance, abs/local consistency, yaw residual -------------------------
function walk(M, over, dir, ticks, steer, h) {
  const cfg = { ...M.K.EARTHSCALE_ASTRONAUT, ...over }, k = new M.K.AstronautKCC(cfg), dt = 1 / 60
  k.teleportSurface(dir[0], dir[1], dir[2]); k.autoTurnEnabled = false
  Object.assign(k.input, { moveF: 1, moveR: 0, sprint: true, crouch: false, jump: false, turnRate: 0 })
  const st = { ticks: 0, obs: 0, grounded: 0, air: 0, nonFinite: 0, clrBad: 0, minClr: Infinity, maxClrDev: 0,
    absBad: 0, maxAbsErr: 0, yawBad: 0, maxYawRes: 0, maxYawResDeg: 0, worstRatio: 0, path: 0 }
  let n = 0
  for (let i = 0; i < ticks; i++) {
    k.input.turnRate = steer(k)
    const u0 = arr(k.up), f0 = arr(k.fwd), was = k.grounded, cmd = k.input.turnRate * dt, pl0 = arr(k.pLocal)
    k.integrateTick(dt); n++; st.ticks++
    const pl = arr(k.pLocal), ab = arr(k.absPos), u1 = arr(k.up), f1 = arr(k.fwd)
    st.path += norm(sub(pl, pl0))
    if (![...pl, ...ab, ...u1, ...f1].every(Number.isFinite)) { st.nonFinite++; continue }
    st.obs++
    const r = norm(pl), c = r - R - h(scale(pl, 1 / r))
    st.minClr = Math.min(st.minClr, c)
    if (k.grounded) { st.grounded++; const dv = Math.abs(c - CLR); st.maxClrDev = Math.max(st.maxClrDev, dv); if (dv > POS_TOL) st.clrBad++ }
    else { st.air++; if (c < -POS_TOL) st.clrBad++ }
    const ae = norm(sub(ab, rotY(cfg.spinOmega * dt * n, pl)))
    st.maxAbsErr = Math.max(st.maxAbsErr, ae); if (ae > POS_TOL) st.absBad++
    // Expected fwd: minimal rotation u0 → u1 applied to f0, then the commanded yaw about u1.
    const ax = cross(u0, u1), s = norm(ax), delta = Math.atan2(s, dot(u0, u1))
    const ft = s > 1e-15 ? rodrigues(f0, scale(ax, 1 / s), delta) : f0
    const fe = rodrigues(unit(sub(ft, scale(u1, dot(ft, u1)))), u1, was && k.grounded ? cmd : 0)
    const res = Math.abs(signedAngle(fe, f1, u1)), bound = YAW_K * delta * delta + YAW_EPS
    if (res > st.maxYawRes) { st.maxYawRes = res; st.maxYawResDeg = res * 180 / Math.PI }
    if (delta > 1e-6) st.worstRatio = Math.max(st.worstRatio, res / (delta * delta))
    if (res > bound) st.yawBad++
  }
  return st
}
const GC = unit([0, -1, 1]) // great circle through +X and (0,1,1)/√2 — crosses the (1,1,1)/√3 corner
const gcSteer = (k) => {
  const p = unit(arr(k.pLocal)), t = unit(cross(GC, p))
  return Math.max(-2.5, Math.min(2.5, 3 * signedAngle(arr(k.fwd), t, arr(k.up))))
}
const CLIMB = { stepHeight: 60, snapDistance: 60, slideAngleDeg: 89, maxWalkSlopeDeg: 89 }

// ---- the gate --------------------------------------------------------------------------------
function gate(real, smooth) {
  const rows = []
  const check = (id, pass, evidence) => rows.push({ id, pass: Boolean(pass), evidence })
  const cfg = real.K.EARTHSCALE_ASTRONAUT
  const drift = Object.keys(PIN).filter((k) => cfg[k] !== PIN[k])
  check('profile-pinned', drift.length === 0, { drift })

  // A. Coriolis on the smooth sphere (radial launch): KCC vs inertial truth; spin controls.
  const eq = [1, 0, 0], w = PIN.spinOmega
  const s60 = jump(smooth, {}, eq, 1 / 60, flatH, flatN), s240 = jump(smooth, {}, eq, 1 / 240, flatH, flatN)
  const s0 = jump(smooth, { spinOmega: 0 }, eq, 1 / 60, flatH, flatN), sNeg = jump(smooth, { spinOmega: -w }, eq, 1 / 60, flatH, flatN)
  check('jump-smooth-truth', s60.landed && s60.finite && s60.errM <= JUMP_TOL && s60.westTruth > 0.015 && s60.westTruth < 0.022,
    { ...s60, closedFormFlatG: (4 / 3) * w * 125 / (PIN.planetMu / R / R) ** 2 })
  check('jump-smooth-converges', s240.landed && s240.errM < s60.errM / 2, { err60: s60.errM, err240: s240.errM })
  check('jump-smooth-zero-spin', s0.landed && Math.abs(s0.westKcc) < SPIN_SYM && Math.abs(s0.westTruth) < SPIN_SYM, s0)
  check('jump-smooth-reversed', sNeg.landed && Math.abs(sNeg.westKcc + s60.westKcc) < SPIN_SYM, { pos: s60.westKcc, neg: sNeg.westKcc })

  // B. Terrain-normal launch on a sloped real site (4–8°, normal ≠ blended up): truth uses the
  // real launch normal and rotating real-terrain contact; the tilt is part of the trajectory.
  const site = findSite(real.TF, 4, 8), h = hOf(real.TF), nn = nOf(real.TF)
  const r60 = jump(real, {}, site.d, 1 / 60, h, nn), r240 = jump(real, {}, site.d, 1 / 240, h, nn)
  check('jump-real-truth', r60.landed && r60.finite && r60.errM <= JUMP_REAL_TOL, { slopeDeg: site.slopeDeg, ...r60 })
  check('jump-real-converges', r240.landed && r240.errM < r60.errM / 2, { err60: r60.errM, err240: r240.errM })

  // C. Walks on the real terrain, every tick observed: great-circle walk through the cube corner
  // (climb-unrestricted, steered) and a turning sprint on a steep site with the ratified rules.
  const steep = findSite(real.TF, 25, 40)
  const A = walk(real, CLIMB, unit([Math.cos(0.1745), Math.sin(0.1745) * Math.SQRT1_2, Math.sin(0.1745) * Math.SQRT1_2]), 30000, gcSteer, h)
  const B = walk(real, {}, steep.d, 6000, () => 0.25, h)
  for (const [id, st] of [['walk-corner', A], ['walk-steep', B]]) {
    check(`clearance-${id}`, st.obs === st.ticks && st.nonFinite === 0 && st.clrBad === 0 && st.grounded > 0 && Number.isFinite(st.minClr),
      { ticks: st.ticks, observed: st.obs, grounded: st.grounded, air: st.air, minClr: st.minClr, maxClrDev: st.maxClrDev, bad: st.clrBad, pathM: st.path })
    check(`frame-${id}`, st.absBad === 0, { maxAbsErrM: st.maxAbsErr })
    check(`yaw-${id}`, st.obs === st.ticks && st.yawBad === 0,
      { maxResidualDeg: st.maxYawResDeg, worstResOverDelta2: st.worstRatio, bad: st.yawBad, boundK: YAW_K })
  }
  return rows
}
async function runGate(rw = []) { return gate(await load(rw), await load([...rw, SMOOTH])) }

// Mutants: source rewrites of the real modules (fresh bundles; production files never written).
const SNAP = (deg, every) => ['k', '    this.integrity.ticks++;\n', `    this.integrity.ticks++;\n    if (this._grounded && this.integrity.ticks % ${every} === 0) { rotateAboutAxisInto(this.fwd.x, this.fwd.y, this.fwd.z, this.up.x, this.up.y, this.up.z, ${deg} * Math.PI / 180, _fwdT); this.fwd.x = _fwdT.x; this.fwd.y = _fwdT.y; this.fwd.z = _fwdT.z; }\n`]
const MUTANTS = [
  { id: 'launch-along-up-tilt', red: ['jump-real-truth'], rw: [
    ['k', '+ n.x * u;', '+ this.up.x * u;'], ['k', '+ n.y * u;', '+ this.up.y * u;'], ['k', '+ n.z * u;', '+ this.up.z * u;']] },
  { id: 'launch-compose-theta-new', red: ['jump-smooth-truth', 'jump-real-truth'], rw: [['k', 'this._thetaPrev); // P only', 'this._theta); // P only']] },
  { id: 'transport-velocity-x2', red: ['jump-smooth-truth'], rw: [['sf', 'out.x = omega * pz;', 'out.x = 2 * omega * pz;'], ['sf', 'out.z = -omega * px;', 'out.z = -2 * omega * px;']] },
  { id: 'sink-0.10m-tick-1000', red: ['clearance-walk-corner'], rw: [['k', '    this.integrity.ticks++;\n',
    '    this.integrity.ticks++;\n    if (this._grounded && this.integrity.ticks === 1000) { const f = 1 - 0.1 / Math.hypot(this.pLocal.x, this.pLocal.y, this.pLocal.z); this.pLocal.x *= f; this.pLocal.y *= f; this.pLocal.z *= f; this.absPos.x *= f; this.absPos.y *= f; this.absPos.z *= f; }\n']] },
  { id: 'compose-at-theta-prev', red: ['frame-walk-corner'], rw: [['k', 'theta: number = this._theta): void {', 'theta: number = this._thetaPrev): void {']] },
  { id: 'yaw-snap-4deg', red: ['yaw-walk-corner', 'yaw-walk-steep'], rw: [SNAP(4, 1000)] },
  { id: 'yaw-snap-8deg', red: ['yaw-walk-corner', 'yaw-walk-steep'], rw: [SNAP(8, 1000)] },
  { id: 'yaw-creep-0.05deg-per-tick', red: ['yaw-walk-corner', 'yaw-walk-steep'], rw: [SNAP(0.05, 1)] },
]
if (DELIB) MUTANTS.push({ id: 'deliberate-noop', red: ['profile-pinned'], rw: [] })

let code = 0
try {
  const base = await runGate()
  for (const r of base) console.log(JSON.stringify(r))
  const failed = base.filter((r) => !r.pass).map((r) => r.id)
  console.log(JSON.stringify({ gate: { passed: base.length - failed.length, total: base.length, failed } }))
  if (failed.length) code = 1
  if (SELF) {
    let ok = 0
    for (const m of MUTANTS) {
      const rows = await runGate(m.rw)
      const red = rows.filter((r) => !r.pass).map((r) => r.id)
      const pass = m.red.every((id) => red.includes(id))
      if (pass) ok++
      console.log(JSON.stringify({ mutant: m.id, expectRed: m.red, red, pass }))
    }
    console.log(JSON.stringify({ selfTest: { passed: ok, total: MUTANTS.length } }))
    if (ok !== MUTANTS.length) code = 1
  }
  if (sha() !== PRODUCTION) { console.log('production sources changed'); code = 2 }
  console.log(JSON.stringify({ productionSha256: PRODUCTION, unchanged: sha() === PRODUCTION }))
} catch (e) { console.error(e); code = 2 }
process.exit(code)