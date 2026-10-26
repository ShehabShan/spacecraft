// A1-U16 probe — astronautKCC part 1: ground probe + step/slope rule (RATIFIED) + walk kinematics.
// READ-ONLY audit. Imports the REAL KCC + terrain; the truth (secant slope, gradient, surface
// path) is computed HERE from the height field (U14: heights/seams/determinism clean), never
// from the KCC's own normal or ratio. Run from game/:  node tools/audit/u16-kcc-step-rule.mjs
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const K = await import('../../src/core/physics/astronautKCC.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180
let cOk = 0, cN = 0
const control = (n, c) => { cN++; if (c) cOk++; p(`control.${n}`, c ? 'ok' : 'FAIL') }
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const nrm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l } }
const add = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s })
const sc = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s })
const ang = (a, b) => Math.atan2(Math.hypot(...Object.values(crs(a, b))), dot(a, b))
const H = (d) => TF.terrainHeight(d.x, d.y, d.z)
const DT = 1 / 60

TF.initTerrainField(MC.MOON_PARAMS)
const CFG = MC.MOON_ASTRONAUT, R = CFG.planetRadius
const rnd = NZ.mulberry32(1616)
const randUnit = () => { for (;;) { const a = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }; const l = Math.hypot(a.x, a.y, a.z); if (l > 0.1 && l <= 1) return nrm(a) } }
const basis = (d) => { const a = Math.abs(d.x) < 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 }; const e1 = nrm(crs(d, a)); return [e1, crs(d, e1)] }
const gc = (d, e, a) => nrm(add(sc(d, Math.cos(a)), e, Math.sin(a)))
// True gradient (independent): central differences along great circles, ε = 1e-6 rad (~1.4 mm).
function trueGrad(d) {
  const [e1, e2] = basis(d), h0 = H(d), eps = 1e-6, L = 2 * eps * (R + h0)
  const gx = (H(gc(d, e1, eps)) - H(gc(d, e1, -eps))) / L
  const gy = (H(gc(d, e2, eps)) - H(gc(d, e2, -eps))) / L
  const g = add(sc(e1, gx), e2, gy), t = Math.hypot(gx, gy)
  // true unit normal of the surface r = R + h(d): radial minus gradient (small-angle exact form)
  return { tan: t, dir: t > 0 ? nrm(g) : e1, h0, n: nrm(add(d, g, -1)) }
}

// ---- analytic prediction (written before running the KCC) ----
// fwd ⊥ up, up = norm(w·n + (1−w)·r̂). Facing up a slope θ, fwd tilts up from the radial tangent
// plane by α with tan α = w·sinθ / ((1−w) + w·cosθ). Re-projecting pLocal to the surface keeps
// only the horizontal part |d|·cosα, so the ratio clause sees dH/|d| = tanθ·cosα, not tanθ.
function alphaOf(th, w) { return Math.atan2(w * Math.sin(th), (1 - w) + w * Math.cos(th)) }
function limitDeg(w, lim = 50) { let lo = 0, hi = rad(89.9); for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; (Math.tan(m) * Math.cos(alphaOf(m, w)) <= Math.tan(rad(lim))) ? lo = m : hi = m } return deg(lo) }
p('analytic.alpha_at_45deg', f(deg(alphaOf(rad(45), CFG.upBlendWeight))))
p('analytic.trueSlopeLimit_w0.65', f(limitDeg(CFG.upBlendWeight)))
p('analytic.trueSlopeLimit_w0', f(limitDeg(0)))
p('analytic.maxAcceptedDH_sprint_m', f(Math.tan(rad(50)) * CFG.sprintSpeed * DT))
p('analytic.arcNeededForStepHeightToBind_mPerTick', f(CFG.stepHeight / Math.tan(rad(50))))
p('analytic.speedNeededForStepHeightToBind_mps', f(CFG.stepHeight / Math.tan(rad(50)) / DT))

// ---- one climb attempt with the REAL _tryMove (private in TS only) ----
function attempt(cfg, dS, dir, v) {
  const k = new K.AstronautKCC(cfg)
  k.teleportSurface(dS.x, dS.y, dS.z)
  const up = k.up, fw = nrm(add(dir, up, -dot(dir, up)))
  k.fwd.x = fw.x; k.fwd.y = fw.y; k.fwd.z = fw.z
  const d = sc(fw, v * DT), p0 = { ...k.pLocal }, r = Math.hypot(p0.x, p0.y, p0.z)
  const ok = k._tryMove(d.x, d.y, d.z, R + k._hCur, r)
  const dE = nrm(add(p0, d)), hS = k._hCur, hE = H(dE)
  const harc = ang(dS, dE) * (R + hS), dh = hE - hS
  const disp = add({ ...k.pLocal }, p0, -1)
  const codeSlope = deg(Math.acos(Math.max(-1, Math.min(1, dot(k._nCur, dS)))))
  return { ok, grounded: k._grounded, sec: deg(Math.atan2(dh, harc)), dh, harc, codeRatio: dh / Math.hypot(d.x, d.y, d.z),
    alpha: deg(Math.asin(dot(fw, dS))), pathRatio: ok ? Math.hypot(harc, dh) / (v * DT) : NaN,
    velErr: ok ? deg(ang(d, disp)) : NaN, codeSlope }
}

// ---- sample the play Moon for steep spots (true slope 35–80°) ----
const pts = []
let scanned = 0
const t0 = Date.now()
while (scanned < 400000 && pts.length < 3000) { scanned++; const d = randUnit(), g = trueGrad(d); const s = deg(Math.atan(g.tan)); if (s >= 35 && s <= 80) pts.push({ d, g, s }) }
p('sample.scanned', scanned); p('sample.steep35to80', pts.length); p('sample.ms', Date.now() - t0)

// controls
{
  let flat = null; for (let i = 0; i < 5000 && !flat; i++) { const d = randUnit(), g = trueGrad(d); if (Math.atan(g.tan) < rad(2)) flat = { d, g } }
  const a = attempt(CFG, flat.d, flat.g.dir, CFG.walkSpeed)
  control('flatWalkAccepted', a.ok && a.grounded)
  control('flatSecantMatchesCodeRatio', Math.abs(Math.atan(a.codeRatio) - rad(a.sec)) < rad(0.5))
  control('trueGradMatchesSecant', (() => { const b = attempt(CFG, pts[0].d, pts[0].g.dir, 0.06); return Math.abs(b.sec - pts[0].s) < 1.0 })())
}

const SPEEDS = [['crouch', CFG.crouchSpeed], ['walk', CFG.walkSpeed], ['sprint', CFG.sprintSpeed]]
const BINS = [[35, 45], [45, 50], [50, 52.5], [52.5, 55], [55, 57.5], [57.5, 60], [60, 65], [65, 80]]
function run(cfg, tag) {
  const acc = {}, tot = {}; let maxAcc = { walk: -1, sprint: -1, crouch: -1 }, maxDH = 0, disagree = 0, n = 0, slideClimb = 0, accTot = 0
  const alphaErr = [], pathUp = [], velUp = []
  for (const P of pts) {
    const res = {}
    for (const [nm, v] of SPEEDS) {
      const a = attempt(cfg, P.d, P.g.dir, v); res[nm] = a
      const b = BINS.findIndex(([lo, hi]) => a.sec >= lo && a.sec < hi)
      if (b >= 0) { const key = `${nm}.${BINS[b][0]}-${BINS[b][1]}`; tot[key] = (tot[key] || 0) + 1; if (a.ok) acc[key] = (acc[key] || 0) + 1 }
      if (a.ok && a.dh > 0) { if (a.sec > maxAcc[nm]) maxAcc[nm] = a.sec; if (a.dh > maxDH) maxDH = a.dh }
      if (nm === 'walk') {
        if (a.ok && a.dh > 0) { accTot++; if (a.codeSlope > cfg.slideAngleDeg) slideClimb++ }
        if (Math.abs(a.codeSlope - P.s) < 1) alphaErr.push(Math.abs(a.alpha - deg(alphaOf(rad(P.s), cfg.upBlendWeight))))
        if (a.ok && a.dh > 0 && P.s >= 40 && P.s < 50) { pathUp.push(a.pathRatio); velUp.push(a.velErr) }
      }
    }
    n++
    const o = SPEEDS.map(([nm]) => res[nm].ok); if (o.some((x) => x !== o[0])) disagree++
  }
  for (const [nm] of SPEEDS) for (const [lo, hi] of BINS) { const key = `${nm}.${lo}-${hi}`; if (tot[key]) p(`${tag}.accept.${key}`, `${acc[key] || 0}/${tot[key]}`) }
  for (const [nm] of SPEEDS) p(`${tag}.maxAcceptedTrueSecantDeg.${nm}`, f(maxAcc[nm]))
  p(`${tag}.maxAcceptedDH_m`, f(maxDH))
  p(`${tag}.speedDisagreement`, `${disagree}/${n}`)
  p(`${tag}.walkClimbsWhileSlideActive`, `${slideClimb}/${accTot}`)
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? f(s[Math.floor(s.length / 2)]) : 'n/a' }
  const mx = (a) => a.length ? f(Math.max(...a)) : 'n/a'
  p(`${tag}.alphaModelErrDeg.median|max(n=${alphaErr.length})`, `${med(alphaErr)}|${mx(alphaErr)}`)
  p(`${tag}.uphill40to50.surfacePath/commanded.median|max(n=${pathUp.length})`, `${med(pathUp)}|${mx(pathUp)}`)
  p(`${tag}.uphill40to50.angle(velocity,displacement)deg.median|max`, `${med(velUp)}|${mx(velUp)}`)
  return maxAcc
}
const m65 = run(CFG, 'w0.65')
const m0 = run({ ...CFG, upBlendWeight: 0 }, 'w0')
control('w0LimitHolds_sprint', m0.sprint <= 51.0)
control('w0.65ExceedsLimit', m65.sprint > 51.0)

// downhill: surface path vs commanded (snap path — no slope gate)
{
  const r = []; for (const P of pts) if (P.s >= 40 && P.s < 50) { const a = attempt(CFG, P.d, sc(P.g.dir, -1), CFG.walkSpeed); if (a.ok && a.grounded) r.push(a.pathRatio) }
  r.sort((a, b) => a - b); p('w0.65.downhill40to50.surfacePath/commanded.median|min|max', `${f(r[r.length >> 1])}|${f(r[0])}|${f(r[r.length - 1])}`)
}

// jump launch direction (code: along cached normal n): horizontal kick vs vertical, and vs true normal
{
  const kick = [], err = []
  for (const P of pts) { const k = new K.AstronautKCC(CFG); k.teleportSurface(P.d.x, P.d.y, P.d.z); const n = k._nCur
    kick.push(CFG.jumpSpeed * Math.sin(ang(n, P.d))); err.push(deg(ang(n, P.g.n))) }
  const q = (a, x) => { const s = [...a].sort((u, v) => u - v); return f(s[Math.min(s.length - 1, Math.floor(s.length * x))]) }
  p('jump.horizontalKick_mps.p50|p90|max', `${q(kick, 0.5)}|${q(kick, 0.9)}|${q(kick, 1)}`)
  p('jump.launchDirVsTrueNormalDeg.p50|p90|p99', `${q(err, 0.5)}|${q(err, 0.9)}|${q(err, 0.99)}`)
}
p('controls', `${cOk}/${cN}`)