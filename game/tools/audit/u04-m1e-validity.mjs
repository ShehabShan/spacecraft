// A1-U04 probe (read-only audit; AGENT_BRIEF §11). Checks whether the m1e
// headless rows (R1 face-walk, R2 slope-step, R3 state-machine, R4 zero-gc,
// R5 coriolis) can FAIL when the property each one claims is broken.
// The row functions and their setup are extracted VERBATIM from the harness
// source text (types stripped by esbuild) and run against the real core.
// Expected behaviour (written before reading the rows):
//  - R5: a vertical 5 m/s jump on the 52 m/s equator lands (4/3)Ωu³/g² ≈ 1.8 cm
//    west; a gate should be tight enough to see a factor-2 Coriolis error.
//  - R1: parallel transport must not yaw the frame; a walk gate should fail on
//    a visible yaw snap and on accumulated yaw drift.
//  - "penetration-free" clauses must measure clearance on every tick.
//  - R4: a zero-alloc row must fail when the tick allocates.
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const esbuild = await import('esbuild')
const KCC = await import('../../src/core/physics/astronautKCC.ts')
const SF = await import('../../src/core/physics/sphericalFrame.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const SRC = readFileSync(join(here, '../../src/test/Milestone1E_TestHarness.tsx'), 'utf8')

const results = []
const check = (id, cond, msg) => { results.push([id, !!cond]); console.log(`[u04] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }
const lineOf = (s) => SRC.slice(0, SRC.indexOf(s)).split('\n').length

// ---- verbatim extraction ----------------------------------------------------
const A = 'const kcc = new AstronautKCC(EARTHSCALE_ASTRONAUT);'
const B = 'const CORNER: Vec3'
const iA = SRC.indexOf(A), iB = SRC.indexOf(B)
let setup = SRC.slice(iA, SRC.indexOf('\n', iB))
setup = setup.replace(/const ASTRO_ID[\s\S]*?kcc\.attachWriteThrough\(astroState\.absPos, astroState\.velocity\);/, '')
const iS = SRC.indexOf('const suite = {'), iE = SRC.indexOf('function runHeadlessSuite')
const rows = SRC.slice(iS, iE)
console.log(`[u04] extracted setup :${lineOf(A)}-:${lineOf(B)} and rows :${lineOf('const suite = {')}-:${lineOf('function runHeadlessSuite') - 1}`)
const js = esbuild.transformSync(setup + '\n' + rows, { loader: 'ts' }).code
const DEPS = ['AstronautKCC', 'EARTHSCALE_ASTRONAUT', 'TEST_PLANET', 'R', 'initTerrainField', 'terrainHeight',
  'terrainNormalInto', 'mulberry32', 'heapApi', 'quatFromFrameInto', 'quatMulInto', 'rotateAboutAxisInto',
  'rotateByQuatConjInto', 'signedAngleAbout', 'spinQuatInto', 'transportVelocityInto']
const factory = new Function(...DEPS, js +
  '\nreturn { kcc, kccT1, suite, FLAT_SITE, runFaceWalk, runCoriolisJump, runStateMachine, runZeroGcBurn, runSlopeStep };')
const make = (o = {}) => {
  TF.initTerrainField(TF.TEST_PLANET)
  const d = { ...SF, ...TF, ...NZ, AstronautKCC: KCC.AstronautKCC, EARTHSCALE_ASTRONAUT: o.cfg ?? KCC.EARTHSCALE_ASTRONAUT,
    R: TF.TEST_PLANET.radius, heapApi: o.heapApi ?? null }
  return factory(...DEPS.map((k) => d[k]))
}
const wrap = (k, after) => { const orig = k.integrateTick.bind(k); let n = 0; k.integrateTick = (dt) => { orig(dt); after(k, ++n) } }
const yaw = (k, a) => {
  const u = k.up, f = k.fwd
  const cx = u.y * f.z - u.z * f.y, cy = u.z * f.x - u.x * f.z, cz = u.x * f.y - u.y * f.x
  const c = Math.cos(a), s = Math.sin(a)
  f.x = f.x * c + cx * s; f.y = f.y * c + cy * s; f.z = f.z * c + cz * s
}
const aglOf = (k) => {
  const p = k.pLocal, l = Math.hypot(p.x, p.y, p.z)
  return l - (TF.TEST_PLANET.radius + TF.terrainHeight(p.x / l, p.y / l, p.z / l))
}
const deg = (r) => (r * 180) / Math.PI

// ---- R1 face-walk -------------------------------------------------------------
{
  const base = make(); let minAgl = Infinity, airTicks = 0
  wrap(base.kccT1, (k) => { const a = aglOf(k); if (a < minAgl) minAgl = a; if (!k.grounded) airTicks++ })
  const r = base.runFaceWalk(); const F = base.suite.face
  console.log(`[u04] R1 base: pass=${r.pass} path ${(F.pathLen / 1000).toFixed(2)} km ticks ${F.ticks} faces ${F.faceChanges} ` +
    `corner ${deg(F.minCornerAngle).toFixed(2)}° maxUp ${deg(Math.acos(Math.min(1, F.minUpDot))).toFixed(4)}° ` +
    `maxFwd ${deg(Math.acos(Math.min(1, F.minFwdDot))).toFixed(4)}° integrity.minAGL=${F.minAGL} independent minAGL ${minAgl.toFixed(3)} m airborne ticks ${airTicks}`)
  check('r1-base-pass', r.pass, 'verbatim R1 passes on the unedited core')
  check('r1-minagl-vacuous', !Number.isFinite(F.minAGL) && airTicks === 0,
    `integrity.minAGL = ${F.minAGL} (only written by the airborne sweep); the clause minAGL > -0.05 is vacuous; walker never airborne (${airTicks} ticks)`)
  const arc = deg(F.pathLen / TF.TEST_PLANET.radius)
  check('r1-holonomy-untested', arc < 359, `walk covers ${arc.toFixed(0)}° of the great circle, so the printed "holonomy 2π ≡ identity" claim is never exercised`)
}
{
  const m = make(); wrap(m.kccT1, (k, n) => { if (n % 1000 === 0) yaw(k, (4 * Math.PI) / 180) })
  const r = m.runFaceWalk()
  check('r1-snap-undetected', r.pass, `mutation M-SNAP (4° yaw snap every 1,000 ticks, ${Math.floor(m.suite.face.ticks / 1000)} snaps) → R1 pass=${r.pass}`)
}
{
  const m = make(); wrap(m.kccT1, (k) => yaw(k, (0.05 * Math.PI) / 180))
  const r = m.runFaceWalk()
  check('r1-drift-detected', !r.pass, `mutation M-DRIFT (0.05°/tick continuous yaw error, ${(0.05 * m.suite.face.ticks).toFixed(0)}° total) → R1 pass=${r.pass} (REFUTES the suspicion: continuous drift IS caught)`)
}

// ---- R5 coriolis ------------------------------------------------------------
const cfg0 = KCC.EARTHSCALE_ASTRONAUT
let base5
{
  base5 = make(); const r = base5.runCoriolisJump(); const C = base5.suite.coriolis
  console.log(`[u04] R5 base: pass=${r.pass} west ${(C.westDrift * 100).toFixed(3)} cm predicted ${(C.predicted * 100).toFixed(3)} cm ` +
    `perp ${(C.perpDrift * 100).toFixed(3)} cm air ${C.airTicks} settle ${C.settleTicks}`)
  check('r5-base-pass', r.pass, 'verbatim R5 passes')
  check('r5-below-theory', C.westDrift / C.predicted < 0.7, `measured/theory = ${(C.westDrift / C.predicted).toFixed(3)}; predicted is printed but never compared`)
  // Independent inertial ballistic flight (RK4, dt 1e-4) from the same launch radius.
  const s = base5.FLAT_SITE, h = TF.terrainHeight(s.x, s.y, s.z), r0 = TF.TEST_PLANET.radius + h + cfg0.groundClearance
  const w = cfg0.spinOmega, mu = cfg0.planetMu, u = cfg0.jumpSpeed
  let p = [s.x * r0, s.y * r0, s.z * r0]
  let v = [w * p[2] + u * s.x, u * s.y, -w * p[0] + u * s.z]
  const acc = (q) => { const rr = Math.hypot(...q); const k = -mu / rr ** 3; return q.map((c) => c * k) }
  let t = 0; const dt = 1e-4
  for (;;) {
    const a1 = acc(p), p2 = p.map((c, i) => c + v[i] * dt / 2), v2 = v.map((c, i) => c + a1[i] * dt / 2)
    const a2 = acc(p2), p3 = p.map((c, i) => c + v2[i] * dt / 2), v3 = v.map((c, i) => c + a2[i] * dt / 2)
    const a3 = acc(p3), p4 = p.map((c, i) => c + v3[i] * dt), v4 = v.map((c, i) => c + a3[i] * dt)
    const a4 = acc(p4)
    p = p.map((c, i) => c + (dt / 6) * (v[i] + 2 * v2[i] + 2 * v3[i] + v4[i]))
    v = v.map((c, i) => c + (dt / 6) * (a1[i] + 2 * a2[i] + 2 * a3[i] + a4[i]))
    t += dt
    if (t > 0.5 && Math.hypot(...p) <= r0) break
  }
  const ang = w * t, gx = s.x * r0 * Math.cos(ang) + s.z * r0 * Math.sin(ang), gz = -s.x * r0 * Math.sin(ang) + s.z * r0 * Math.cos(ang)
  const ex = gz, ez = -gx, el = Math.hypot(ex, ez)
  const westRK = -((p[0] - gx) * ex + (p[2] - gz) * ez) / el
  const g = mu / (r0 * r0), theory = (4 / 3) * w * u ** 3 / (g * g)
  console.log(`[u04] R5 independent RK4: flight ${t.toFixed(4)} s, west ${(westRK * 100).toFixed(3)} cm; formula ${(theory * 100).toFixed(3)} cm`)
  const gEff = g - w * w * r0
  console.log(`[u04] R5 r0 ${r0.toFixed(2)} m, g ${g.toFixed(4)}, g−ω²r ${gEff.toFixed(4)}, 2u/g ${(2 * u / g).toFixed(4)} s, formula with g−ω²r ${((4 / 3) * w * u ** 3 / (gEff * gEff) * 100).toFixed(3)} cm`)
  check('r5-truth-near-formula', Math.abs(westRK - theory) / theory < 0.15, `independent inertial RK4 west ${(westRK * 100).toFixed(2)} cm vs flat formula ${(theory * 100).toFixed(2)} cm (${(100 * (westRK / theory - 1)).toFixed(1)}%: the formula ignores the 52 m/s frame's centrifugal term); KCC reports ${(base5.suite.coriolis.westDrift * 100).toFixed(2)} cm`)
  globalThis.__rk = westRK
  // Geometry at the launch site: terrain normal vs blended up vs radial.
  const n = { x: 0, y: 0, z: 0 }; TF.terrainNormalInto(s.x, s.y, s.z, n)
  const nr = n.x * s.x + n.y * s.y + n.z * s.z
  const tiltN = { x: n.x - nr * s.x, y: n.y - nr * s.y, z: n.z - nr * s.z }
  const e0 = { x: s.z, y: 0, z: -s.x }, e0l = Math.hypot(e0.x, e0.z)
  const westTiltN = -(tiltN.x * e0.x + tiltN.z * e0.z) / e0l
  console.log(`[u04] R5 site: slope ${s.slopeDeg.toFixed(3)}°, normal tilt west component ${westTiltN.toExponential(3)} → uncorrected drift at T≈1.02 s: ${(westTiltN * u * 1.02 * 100).toFixed(2)} cm per unit of uncorrected weight`)
  globalThis.__u04 = { westTiltN }
}
{
  // Control: same site, same verbatim correction, NO spin — every west cm is artefact.
  const m = make({ cfg: { ...cfg0, spinOmega: 0 } })
  const k = m.kcc, s = m.FLAT_SITE
  k.teleportSurface(s.x, s.y, s.z); k.autoTurnEnabled = true
  Object.assign(k.input, { moveF: 0, moveR: 0, sprint: false, crouch: false, turnRate: 0, rcsF: 0, rcsU: 0, rcsR: 0 })
  for (let i = 0; i < 5; i++) k.integrateTick(1 / 60)
  const l0 = { ...k.pLocal }, up0 = { ...k.up }
  const rl = Math.hypot(l0.x, l0.y, l0.z), rx = l0.x / rl, ry = l0.y / rl, rz = l0.z / rl
  k.input.jump = true; let air = 0
  for (let i = 0; i < 240; i++) { k.integrateTick(1 / 60); if (k.grounded) break; air++ }
  const T = air / 60, upd = up0.x * rx + up0.y * ry + up0.z * rz
  const dx = k.pLocal.x - l0.x - (up0.x - upd * rx) * 5 * T, dz = k.pLocal.z - l0.z - (up0.z - upd * rz) * 5 * T
  const ex = l0.z, ez = -l0.x, el = Math.hypot(ex, ez)
  const westCtl = -(dx * ex + dz * ez) / el
  const meas = base5.suite.coriolis.westDrift, pred = base5.suite.coriolis.predicted
  console.log(`[u04] R5 control Ω=0: air ${air} ticks, residual west ${(westCtl * 100).toFixed(3)} cm (gate's tilt correction applied); measured − theory = ${((meas - pred) * 100).toFixed(3)} cm`)
  check('r5-tilt-artefact', Math.abs(westCtl) > 0.003 && Math.abs((meas - pred) - westCtl) < 0.003,
    `with spin OFF the verbatim measurement still reports ${(westCtl * 100).toFixed(2)} cm west; that artefact explains the ${((meas - pred) * 100).toFixed(2)} cm shortfall to within 0.3 cm`)
  const corr = meas - westCtl
  check('r5-kcc-physics-ok', Math.abs(corr - globalThis.__rk) / globalThis.__rk < 0.15,
    `artefact-removed KCC drift ${(corr * 100).toFixed(2)} cm vs independent RK4 ${(globalThis.__rk * 100).toFixed(2)} cm (${(100 * (corr / globalThis.__rk - 1)).toFixed(1)}%): the KCC physics is close; the GATE's measurement is wrong`)
}
for (const f of [0.5, 2, 3]) {
  const m = make({ cfg: { ...cfg0, spinOmega: cfg0.spinOmega * f } })
  const r = m.runCoriolisJump(); const C = m.suite.coriolis
  check(`r5-fails-x${f}`, !r.pass, `Coriolis ${f}× → R5 pass=${r.pass}: west ${(C.westDrift * 100).toFixed(2)} cm (window 0.6–6), perp ${(C.perpDrift * 100).toFixed(3)} cm (bound 1.2), air ${C.airTicks}, settle ${C.settleTicks}`)
}
check('r5-perp-margin', base5.suite.coriolis.perpDrift > 0.0115, `base cross-track ${(base5.suite.coriolis.perpDrift * 100).toFixed(3)} cm vs bound 1.2 cm: ${(100 * (1 - base5.suite.coriolis.perpDrift / 0.012)).toFixed(1)}% margin`)

// ---- R3 state machine (verbatim, plus a landing-altitude read) --------------
{
  const m = make(); m.runCoriolisJump(); const r = m.runStateMachine(); const S = m.suite.sm
  console.log(`[u04] R3: pass=${r.pass} rcsDv ${S.rcsDv.toFixed(4)} budget ${S.budgetUsed.toFixed(4)} yaw ${S.yawAngle.toFixed(4)} vehErr ${S.vehicleErr} detachDv ${S.detachDv}`)
  check('r3-base-pass', r.pass, 'verbatim R3 passes')
}

// ---- R4 zero-gc ---------------------------------------------------------------
const shim = { get usedJSHeapSize() { return process.memoryUsage().heapUsed } }
{
  const m = make(); const r = m.runZeroGcBurn()
  check('r4-noheap-pass', r.pass && m.suite.burn.heapDelta === -1, `heapApi = null → heap clause skipped, R4 pass=${r.pass} on identity + NaN only`)
}
// GC timing decides the heap delta, so each mutation runs 3 times in-process.
const trials = (mut) => { const out = []; for (let t = 0; t < 3; t++) { const m = make({ heapApi: shim }); const keep = []; wrap(m.kcc, (k, n) => mut(keep, n)); const r = m.runZeroGcBurn(); out.push(`${r.pass ? 'P' : 'F'}(${m.suite.burn.heapDelta})`) } return out }
{
  const g = trials((keep, n) => { keep[0] = { n, a: [n, n + 1, n + 2, n + 3], b: new Float64Array(8) } })
  check('r4-garbage-unreliable', g.some((x) => x[0] === 'P'), `M-GARBAGE (~200 B/tick short-lived, ~6 MB total) over 3 runs: ${g.join(' ')} — the verdict depends on GC timing`)
  const l = trials((keep, n) => { keep.push(n * 0.5) })
  check('r4-leak-unreliable', l.some((x) => x[0] === 'P'), `M-LEAK (one retained boxed double per tick, 30,000 retained) over 3 runs: ${l.join(' ')}`)
  const l3 = trials((keep, n) => { if (n % 3 === 0) keep.push(n * 0.5) })
  console.log(`[u04] INFO M-LEAK/3 (10,000 retained doubles) over 3 runs: ${l3.join(' ')} — heap verdicts flip with GC timing`)
}
check('r4-canary-readonly', /readonly absPos[\s\S]*readonly integrity/.test(readFileSync(join(here, '../../src/core/physics/astronautKCC.ts'), 'utf8')),
  'every canary field is a `readonly` member assigned once in the class body, so identityOk tests the TypeScript compiler, not allocation')

// ---- R2 slope-step ------------------------------------------------------------
{
  const m = make(); let minAgl = Infinity, air = 0
  wrap(m.kcc, (k) => { const a = aglOf(k); if (a < minAgl) minAgl = a; if (!k.grounded) air++ })
  const r = m.runSlopeStep()
  console.log(`[u04] R2: pass=${r.pass} integrity.minAGL=${m.kcc.integrity.minAGL} independent minAGL ${minAgl.toFixed(3)} m airborne ticks ${air}`)
  console.log(`[u04] R2 detail: ${r.detail}`)
  check('r2-base-pass', r.pass, 'verbatim R2 passes')
  check('r2-cliff-minagl-vacuous', !Number.isFinite(m.kcc.integrity.minAGL), `R2(c) "penetration-free" reads integrity.minAGL = ${m.kcc.integrity.minAGL} — never written while grounded`)
}

const ok = results.filter((r) => r[1]).length
console.log(`[u04] CONFIRMED ${ok}/${results.length}`)
process.exit(ok === results.length ? 0 : 1)