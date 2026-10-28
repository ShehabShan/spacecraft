// F2d flight gate (ADR-009): an INDEPENDENT check of the m1d contract — the atmosphere law
// (density, Mach with lapse + floor, signed rotating-atmosphere wind), terrain-sweep truth scored
// on the INTERIOR of every path, and the governor dive on a TICK-TIME deadline at 60/30/15/10 fps.
// WHY: m1d T1 passes a 50 % density step, sea-level-only Mach and reversed wind (A1-U05-1); T2
// passes an endpoint-only sweep because minPostTickAGL reads only tick endpoints (A1-U05-7); and
// T2's 45 s deadline counts REQUESTED time, so at 15/10 fps the shed ticks leave the ship airborne
// (A1-U05-2). Rechecks: pre-t4:docs/audit/U27b3b2b2a-m1d-recheck.md, pre-t4:docs/audit/U27-k2d-recheck.md. Truth here comes
// from PINNED SPEC LITERALS (Milestone 1D) and an independent path oracle; the only engine data
// the oracle shares is the real terrain height field (never the DDA's samples or telemetry).
//
// Run from game/:
//   node tools/test-flight-gate.mjs                              gate (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-flight-gate.mjs --self-test [--deliberate]   every mutant must turn the gate red
import { build } from 'esbuild'
import ts from 'typescript'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned spec literals (Milestone 1D; change only with an ADR in the same commit) ----------
const PIN = { rho0: 1.225, scaleHeight: 1200, atmosphereHeight: 8000, gamma: 1.4, rSpecific: 287.05,
  tempSeaLevel: 288.15, lapseRate: 0.0065, tempFloor: 210 }
const R = 5000, MU = 9.81 * R * R, DT = 1 / 60
const rhoRef = (h) => PIN.rho0 * Math.exp(-Math.max(h, 0) / PIN.scaleHeight)
const aRef = (h) => Math.sqrt(PIN.gamma * PIN.rSpecific * Math.max(PIN.tempFloor, PIN.tempSeaLevel - PIN.lapseRate * Math.max(h, 0)))
// Dive: 2,000 m/s straight down from 10 km, harness pacing ×4, ≤ 6 substeps, 0.1 s frame clamp.
// v@1000 reference 266.0 m/s = the audit's independent RK4 (U05c); band ±6 m/s (2.3 %).
const DIVE = { alt: 10000, speed: 2000, scale: 4, sub: 6, clamp: 0.1, deadline: 45, v1000: 266.0, v1000Tol: 6, peak: 1980 }
const FPS = [60, 30, 15, 10]
const TRIALS = 4096, SEED = 0x27b205 // real-terrain grazing paths (U27b3b2b2a seed: 22 endpoint-mutant tunnels)

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const SRC = {
  at: path.join(game, 'src/core/physics/atmosphere.ts'),
  fc: path.join(game, 'src/core/physics/flightController.ts'),
  tf: path.join(game, 'src/core/terrain/terrainField.ts'),
}
const sha = () => Object.values(SRC).map((f) => createHash('sha256').update(readFileSync(f)).digest('hex')).join(':')
const PRODUCTION = sha()

// Bundles the REAL modules; a rewrite is [fileKey, from, to] (string split) or [fileKey, fn] (fn(src)
// must change src). Fresh module instance per bundle; production files are never written.
let nBuild = 0
async function load(rewrites = []) {
  const hits = rewrites.map(() => 0)
  const out = path.join(game, 'node_modules', '.cache', `f2d-flight-${process.pid}-${nBuild++}.mjs`)
  await build({
    stdin: { contents: `export * as AT from './core/physics/atmosphere'; export * as FC from './core/physics/flightController'; export * as TF from './core/terrain/terrainField';`,
      resolveDir: path.join(game, 'src'), loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
    plugins: [{ name: 'f2d-mutate', setup(b) {
      b.onLoad({ filter: /(atmosphere|flightController|terrainField)\.ts$/ }, (a) => {
        let src = readFileSync(a.path, 'utf8')
        rewrites.forEach(([k, from, to], i) => {
          if (a.path !== SRC[k]) return
          if (typeof from === 'function') { const n = from(src); if (n !== src) hits[i]++; src = n; return }
          const parts = src.split(from); hits[i] += parts.length - 1; src = parts.join(to)
        })
        return { contents: src, loader: 'ts' }
      })
    } }],
  })
  const bad = rewrites.filter((_, i) => hits[i] === 0)
  if (bad.length) throw new Error(`rewrite matched nothing: ${String(bad[0][1]).slice(0, 80)}`)
  return import(pathToFileURL(out).href)
}

// Test-only Gaussian ridge across the +Y pole: 20 m high, ~2 m wide along the surface. The
// segment (−15,5010,0)→(15,5010,0) has endpoints +10.02 m clear and its midpoint 10 m BELOW ground.
const RIDGE = ['fc', "import { terrainHeight } from '../terrain/terrainField';",
  'function terrainHeight(x: number, y: number, z: number): number { const a = 2500 * Math.atan2(x, y); return 20 * Math.exp(-a * a); }']
const ridgeRef = (x, y, z) => { const a = 2500 * Math.atan2(x, y); return 20 * Math.exp(-a * a) }
function replaceSweep(body) {
  return (s) => {
    const sf = ts.createSourceFile('f.ts', s, ts.ScriptTarget.Latest, true)
    const c = sf.statements.find((n) => ts.isClassDeclaration(n) && n.name?.text === 'FlightController')
    const m = c?.members.find((n) => n.name?.getText(sf) === '_sweepTerrain')
    if (!m?.body) return s
    return s.slice(0, m.body.getStart(sf)) + body + s.slice(m.body.end)
  }
}

// ---- independent path oracle ------------------------------------------------------------------
const clearance = (p, h) => { const r = Math.hypot(p[0], p[1], p[2]); return r - R - h(p[0] / r, p[1] / r, p[2] / r) }
function interiorMin(a, b, h, gap) {
  const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / gap))
  let min = Infinity
  for (let j = 0; j <= n; j++) { const u = j / n; min = Math.min(min, clearance([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * u), h)) }
  return min
}
// A tick is TRUE iff it either reported a contact and ended on/above ground, or reported none and
// its whole straight path stayed clear. Endpoint telemetry alone can never satisfy the second arm.
const tickTruth = (contacted, a, b, h, gap) => contacted ? clearance(b, h) >= -1e-6 : interiorMin(a, b, h, gap) >= -0.01
const xyz = (p) => [p.x, p.y, p.z]

// ---- the gate --------------------------------------------------------------------------------
function gate(real, ridge, schedule = 'tick') {
  const rows = []
  const check = (id, pass, evidence) => rows.push({ id, pass: Boolean(pass), evidence })
  const { AT, FC, TF } = real

  const prof = AT.EARTHSCALE_ATMOSPHERE, fl = FC.EARTHSCALE_FLIGHT
  const drift = Object.keys(PIN).filter((k) => prof[k] !== PIN[k])
  check('profile-pinned', drift.length === 0 && fl.atmosphere === prof && fl.planetRadius === R && fl.planetMu === MU,
    { drift, planetRadius: fl.planetRadius, planetMu: fl.planetMu })

  // Density: point law at 0.5 m … 24 km, the h ≤ 0 clamp, and two-sided ratios straddling every
  // 25 m mark — a step anywhere moves the point check, one at a mark also breaks its ratio.
  let pErr = 0, rErr = 0, worst = null
  const want = Math.exp(-0.02 / PIN.scaleHeight)
  for (const h of [-100, 0, 0.5, 1]) pErr = Math.max(pErr, Math.abs(AT.densityAt(PIN, h) / rhoRef(h) - 1))
  for (let h = 25; h <= 24000; h += 25) {
    const e = Math.abs(AT.densityAt(PIN, h) / rhoRef(h) - 1); if (e > pErr) { pErr = e; worst = h }
    rErr = Math.max(rErr, Math.abs(AT.densityAt(PIN, h + 0.01) / AT.densityAt(PIN, h - 0.01) / want - 1))
  }
  check('density-law', pErr < 1e-12 && rErr < 1e-9, { pointRelErr: pErr, worstAlt: worst, straddleRelErr: rErr })

  // Mach: altitude-dependent sound speed through the lapse and onto the 210 K floor (≈12,023 m).
  let mErr = 0, mAt = null
  for (let h = 0; h <= 24000; h += 50) for (const v of [100, 800, 1900]) {
    const e = Math.abs(AT.machNumber(PIN, h, v) / (v / aRef(h)) - 1); if (e > mErr) { mErr = e; mAt = [h, v] }
  }
  check('mach-law', mErr < 1e-12, { relErr: mErr, at: mAt })

  // Wind: signed Ω × p for Ω = (0, ω, 0), full general cross product — magnitude cannot hide a sign.
  let wErr = 0
  for (const w of [-0.0104, -0.001, 0.0104, 0.05]) for (const p of [[5000, 0, 0], [0, 0, 5000], [0, 5000, 0], [3000, 1000, -4000], [-2500, -700, 4100]]) {
    const out = AT.atmosphereVelocityInto(w, p[0], p[1], p[2], { x: NaN, y: NaN, z: NaN })
    const e = [w * p[2], 0, -w * p[0]]
    wErr = Math.max(wErr, Math.hypot(out.x - e[0], out.y - e[1], out.z - e[2]))
  }
  check('wind-vector', wErr < 1e-9, { maxVectorErr: wErr, cases: 20 })

  // Ridge witness (constructed geometry, vacuum, no gravity — the path is a straight line).
  const ridgeTick = (y) => {
    const c = new ridge.FC.FlightController({ ...ridge.FC.EARTHSCALE_FLIGHT, planetMu: 0, atmosphere: { ...PIN, rho0: 0 } })
    c.teleport(-15, y, 0, 1800, 0, 0); c.resetIntegrityStats(); c.integrateFlight(DT)
    const a = [-15, y, 0], b = xyz(c.pos)
    return { contacts: c.integrity.contacts, truth: tickTruth(c.integrity.contacts > 0, a, b, ridgeRef, 0.025),
      interior: interiorMin(a, b, ridgeRef, 0.025), end: clearance(b, ridgeRef), minPost: c.integrity.minPostTickAGL }
  }
  const rg = ridgeTick(5010), hi = ridgeTick(5030)
  check('ridge-sweep', rg.truth, rg)
  check('ridge-clear-pass', hi.contacts === 0 && hi.truth, hi)

  // Real terrain: seeded grazing paths, fresh controller per tick, scored by the interior oracle.
  TF.initTerrainField(TF.TEST_PLANET)
  let seed = SEED, bad = 0, contacts = 0, worstBad = null
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const norm = (a) => { const n = Math.hypot(...a); return a.map((x) => x / n) }
  for (let i = 0; i < TRIALS; i++) {
    const y = 2 * rand() - 1, phi = 2 * Math.PI * rand(), r = Math.sqrt(1 - y * y)
    const u = [r * Math.cos(phi), y, r * Math.sin(phi)]
    const t0 = norm(cross(u, Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0])), t1 = cross(u, t0), az = 2 * Math.PI * rand()
    const tan = t0.map((x, j) => x * Math.cos(az) + t1[j] * Math.sin(az))
    const agl = 4 + 20 * rand(), speed = 800 + 1100 * rand(), dip = -0.12 * rand()
    const p = u.map((x) => x * (R + TF.terrainHeight(...u) + agl)), v = tan.map((x, j) => speed * (x + dip * u[j]))
    const c = new FC.FlightController(fl), q = { x: 0, y: 0, z: 0, w: 1 }
    FC.quatFromBasisInto(...tan, ...u, q)
    c.teleport(...p, ...v, q); c.resetIntegrityStats(); c.integrateFlight(DT)
    if (c.integrity.contacts) contacts++
    if (!tickTruth(c.integrity.contacts > 0, p, xyz(c.pos), TF.terrainHeight, 0.25)) {
      bad++
      const m = interiorMin(p, xyz(c.pos), TF.terrainHeight, 0.25)
      if (!worstBad || m < worstBad.interior) worstBad = { trial: i, interior: m, end: clearance(xyz(c.pos), TF.terrainHeight), minPost: c.integrity.minPostTickAGL }
    }
  }
  check('real-terrain-grazing', bad === 0, { seed: '0x27b205', trials: TRIALS, contacts, violations: bad, worst: worstBad })

  // Governor dive per frame rate. Deadline = PHYSICS time (ticks run / 60) — fps-independent. The
  // 'requested' schedule reproduces the harness's requested-time deadline (self-test mutant).
  const traces = {}
  for (const fps of FPS) {
    const c = new FC.FlightController(fl), q = { x: 0, y: 0, z: 0, w: 1 }
    FC.quatFromBasisInto(0, -1, 0, 1, 0, 0, q)
    c.teleport(0, R + DIVE.alt, 0, 0, -DIVE.speed, 0, q); c.resetIntegrityStats()
    const tr = []; let prev = xyz(c.pos), prevC = 0, segBad = 0, prevAlt = Infinity, v1000 = -1, peak = 0
    c.tickObserver = (k) => {
      const t = k.telemetry, b = xyz(k.pos), hit = k.integrity.contacts > prevC
      if (!tickTruth(hit, prev, b, TF.terrainHeight, 1)) segBad++
      prev = b; prevC = k.integrity.contacts
      if (!t.grounded) {
        if (prevAlt > 1000 && t.altMSL <= 1000 && v1000 < 0) v1000 = t.groundSpeed
        prevAlt = t.altMSL; peak = Math.max(peak, t.groundSpeed); tr.push(t.altMSL, t.groundSpeed)
      }
    }
    let ticks = 0, requested = 0
    const dt = Math.min(1 / fps, DIVE.clamp)
    for (let f = 0; f < 100000; f++) {
      requested += dt * DIVE.scale
      if (c.telemetry.grounded || (schedule === 'tick' ? ticks * DT : requested) > DIVE.deadline) break
      ticks += c.update(dt * DIVE.scale, DIVE.sub)
    }
    traces[fps] = tr
    const ok = c.telemetry.grounded && ticks * DT <= DIVE.deadline && Math.abs(v1000 - DIVE.v1000) <= DIVE.v1000Tol
      && v1000 <= 400 && peak >= DIVE.peak && segBad === 0 && clearance(xyz(c.pos), TF.terrainHeight) >= -1e-6
    check(`dive-${fps}`, ok, { grounded: c.telemetry.grounded, physicsS: +(ticks * DT).toFixed(3), requestedS: +requested.toFixed(3),
      v1000, peak, segViolations: segBad, endAGL: clearance(xyz(c.pos), TF.terrainHeight), contacts: c.integrity.contacts })
  }
  const ref = JSON.stringify(traces[60])
  check('dive-fps-independent', FPS.every((f) => JSON.stringify(traces[f]) === ref), FPS.map((f) => [f, traces[f].length / 2]))
  return rows
}

async function runGate(rewrites = [], schedule = 'tick') {
  const real = await load(rewrites), ridge = await load([...rewrites, RIDGE])
  return gate(real, ridge, schedule)
}

const ENDPOINT_SWEEP = `{
    const p0 = this._prevPos, p1 = this.pos;
    segP0x = p0.x; segP0y = p0.y; segP0z = p0.z;
    segDx = p1.x - p0.x; segDy = p1.y - p0.y; segDz = p1.z - p0.z;
    segLen = Math.hypot(segDx, segDy, segDz);
    if (segLen < 1e-9) return;
    if (this._sampleAt(0, R, cfg)) return;
    this._sampleAt(segLen, R, cfg);
  }`
const MUTANTS = [
  { id: 'density-step-4km', red: ['density-law'], rw: [['at', 'return p.rho0 * Math.exp(-alt / p.scaleHeight);', 'return p.rho0 * Math.exp(-alt / p.scaleHeight) * (alt >= 4000 ? 0.5 : 1);']] },
  { id: 'mach-sea-level-sound', red: ['mach-law'], rw: [['at', 'return speedRel / speedOfSoundAt(p, alt);', 'return speedRel / speedOfSoundAt(p, 0);']] },
  { id: 'temperature-no-floor', red: ['mach-law'], rw: [['at', 'return t < p.tempFloor ? p.tempFloor : t;', 'return t;']] },
  { id: 'wind-reversed', red: ['wind-vector'], rw: [['at', 'out.x = spinRadPerSec * pz;', 'out.x = -spinRadPerSec * pz;'], ['at', 'out.z = -spinRadPerSec * px;', 'out.z = spinRadPerSec * px;']] },
  { id: 'profile-rho0-drift', red: ['profile-pinned'], rw: [['at', '  rho0: 1.225,', '  rho0: 1.2,']] },
  { id: 'sweep-endpoint-only', red: ['ridge-sweep', 'real-terrain-grazing'], rw: [['fc', replaceSweep(ENDPOINT_SWEEP)]] },
  { id: 'sweep-removed', red: ['ridge-sweep', 'dive-60'], rw: [['fc', replaceSweep('{}')]] },
  { id: 'schedule-requested-time-15fps', red: ['dive-15', 'dive-10'], rw: [], schedule: 'requested' },
]
if (DELIB) MUTANTS.push({ id: 'deliberate-noop', red: ['density-law'], rw: [] })

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
      const rows = await runGate(m.rw, m.schedule)
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