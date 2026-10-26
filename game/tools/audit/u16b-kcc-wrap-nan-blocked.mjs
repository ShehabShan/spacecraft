// A1-U16b probe — astronautKCC part 1: spin-phase wrap in the sweep, NaN-guard recovery,
// composed velocity while blocked. READ-ONLY audit; imports the REAL KCC; the reference
// (true landing / true AGL at the true spin phase) is computed here.
// Run from game/:  node tools/audit/u16b-kcc-wrap-nan-blocked.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const K = await import('../../src/core/physics/astronautKCC.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const SF = await import('../../src/core/physics/sphericalFrame.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(4)) : String(x))
let cOk = 0, cN = 0
const control = (n, c) => { cN++; if (c) cOk++; p(`control.${n}`, c ? 'ok' : 'FAIL') }
const nrm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l } }
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const DT = 1 / 60, TWO_PI = Math.PI * 2
const rnd = NZ.mulberry32(16162)
const randUnit = () => { for (;;) { const a = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }; const l = Math.hypot(a.x, a.y, a.z); if (l > 0.1 && l <= 1) return nrm(a) } }
const rot = (th, v) => { const q = { x: 0, y: 0, z: 0, w: 1 }, o = { x: 0, y: 0, z: 0 }; SF.spinQuatInto(th, q); SF.rotateByQuatInto(q, v.x, v.y, v.z, o); return { ...o } }
const unrot = (th, v) => { const q = { x: 0, y: 0, z: 0, w: 1 }, o = { x: 0, y: 0, z: 0 }; SF.spinQuatInto(th, q); SF.rotateByQuatConjInto(q, v.x, v.y, v.z, o); return { ...o } }

// ---- P1: spin-phase wrap tick (EARTHSCALE: ω 0.0104 → day 604 s; TEST_PLANET terrain) ----
{
  TF.initTerrainField(TF.TEST_PLANET)
  const C = K.EARTHSCALE_ASTRONAUT, R = C.planetRadius, w = C.spinOmega
  const trueAGL = (P, th) => { const r = Math.hypot(P.x, P.y, P.z), d = unrot(th, { x: P.x / r, y: P.y / r, z: P.z / r }); return r - (R + TF.terrainHeight(d.x, d.y, d.z)) }
  function trial(th0, A, vRad) {
    const d = randUnit(), h = TF.terrainHeight(d.x, d.y, d.z)
    const Pp = { x: d.x * (R + h + A), y: d.y * (R + h + A), z: d.z * (R + h + A) }
    const Pw = rot(th0, Pp), om = { x: 0, y: 0, z: 0 }
    SF.transportVelocityInto(w, Pw.x, Pw.y, Pw.z, om)
    const rw = nrm(Pw)
    const k = new K.AstronautKCC(C); k._theta = th0
    k.teleportAbs(Pw.x, Pw.y, Pw.z, om.x + rw.x * vRad, om.y + rw.y * vRad, om.z + rw.z * vRad)
    k.integrateTick(DT)
    return { landed: k._grounded, agl: trueAGL(k.absPos, th0 + w * DT) }
  }
  const N = 3000
  for (const [tag, th0] of [['control_theta1', 1.0], ['wrap', TWO_PI - w * DT * 0.5]]) {
    let fl = 0, miss = 0, below = 0, maxBelow = 0
    for (let i = 0; i < N; i++) { const a = trial(th0, 5, 0); if (a.landed) fl++ }           // 5 m up, at rest: must NOT land
    for (let i = 0; i < N; i++) { const a = trial(th0, 0.3, -30); if (!a.landed) miss++; if (a.agl < -0.01) { below++; maxBelow = Math.max(maxBelow, -a.agl) } } // must land
    p(`P1.${tag}.falseLandings_5mAtRest`, `${fl}/${N}`)
    p(`P1.${tag}.missedLandings_0.3mAt30mps`, `${miss}/${N}`)
    p(`P1.${tag}.endBelowTrueSurface`, `${below}/${N} max ${f(maxBelow)} m`)
    if (tag === 'control_theta1') control('noFalseLandingOffWrap', fl === 0)
  }
  // reproduce the wrapped dTheta directly
  const thPrev = TWO_PI - w * DT * 0.5, thNew = (thPrev + w * DT) % TWO_PI
  p('P1.wrap.dTheta_perTick_code', f(thNew - thPrev)); p('P1.wrap.dTheta_perTick_true', f(w * DT))
  p('P1.wrapTicksPerSiderealDay', 1); p('P1.siderealDay_s', f(TWO_PI / w))
}

// ---- P2: NaN input → NaN guard recovery (play Moon) ----
TF.initTerrainField(MC.MOON_PARAMS)
const CFG = MC.MOON_ASTRONAUT, R = CFG.planetRadius
{
  let d0; for (;;) { const d = randUnit(), n = { x: 0, y: 0, z: 0 }; TF.terrainNormalInto(d.x, d.y, d.z, n); if (dot(n, d) > Math.cos(5 * Math.PI / 180)) { d0 = d; break } }
  const k = new K.AstronautKCC(CFG); k.teleportSurface(d0.x, d0.y, d0.z)
  for (let i = 0; i < 10; i++) { k.input.moveF = 1; k.integrateTick(DT) }
  control('walksBeforeNaN', k.integrity.nanEvents === 0)
  const before = { ...k.pLocal }
  k.input.moveF = NaN; k.integrateTick(DT)                     // ONE bad input frame (e.g. a NaN gamepad axis)
  const ev1 = k.integrity.nanEvents
  k.input.moveF = 1
  for (let i = 0; i < 300; i++) k.integrateTick(DT)           // 5 s of valid input
  const moved = Math.hypot(k.pLocal.x - before.x, k.pLocal.y - before.y, k.pLocal.z - before.z)
  p('P2.nanEventsAfterBadFrame', ev1)
  p('P2.nanEventsAfter300ValidTicks', k.integrity.nanEvents)
  p('P2.vCtlAfter', `${f(k._vCtl.x)},${f(k._vCtl.y)},${f(k._vCtl.z)}`)
  p('P2.displacementIn5sValidInput_m', f(moved))
  p('P2.telemetry.relSpeed', f(k.telemetry.relSpeed))
  // teleport recovers?
  k.teleportSurface(d0.x, d0.y, d0.z); const b2 = { ...k.pLocal }
  for (let i = 0; i < 60; i++) k.integrateTick(DT)
  p('P2.displacementAfterTeleport_1s_m', f(Math.hypot(k.pLocal.x - b2.x, k.pLocal.y - b2.y, k.pLocal.z - b2.z)))
}

// ---- P3: composed velocity while blocked (play Moon, ω = 0 → absVel = R·(vCtl+vSlide)) ----
{
  const pts = []
  for (let i = 0; i < 200000 && pts.length < 400; i++) {
    const d = randUnit(), n = { x: 0, y: 0, z: 0 }; TF.terrainNormalInto(d.x, d.y, d.z, n)
    const s = Math.acos(Math.min(1, dot(n, d))) * 180 / Math.PI
    if (s > 62 && s < 85) pts.push({ d, n })
  }
  let blocked = 0, ratios = [], speeds = [], jumpH = []
  for (const P of pts) {
    const k = new K.AstronautKCC(CFG); k.teleportSurface(P.d.x, P.d.y, P.d.z)
    const up = k.up, g = { x: P.n.x - dot(P.n, P.d) * P.d.x, y: P.n.y - dot(P.n, P.d) * P.d.y, z: P.n.z - dot(P.n, P.d) * P.d.z }
    let fw = nrm({ x: -g.x, y: -g.y, z: -g.z }); fw = nrm({ x: fw.x - dot(fw, up) * up.x, y: fw.y - dot(fw, up) * up.y, z: fw.z - dot(fw, up) * up.z })
    k.fwd.x = fw.x; k.fwd.y = fw.y; k.fwd.z = fw.z
    k.autoTurnEnabled = false
    for (let i = 0; i < 30; i++) {                             // 0.5 s pushing uphill into the face
      const b = { ...k.pLocal }; k.input.moveF = 1; k.integrateTick(DT)
      if (!k._grounded) break
      const disp = Math.hypot(k.pLocal.x - b.x, k.pLocal.y - b.y, k.pLocal.z - b.z) / DT
      const vs = Math.hypot(k.absVel.x, k.absVel.y, k.absVel.z)
      if (i === 29) { if (disp < 1e-6) blocked++; ratios.push(disp); speeds.push(vs) }
    }
    if (k._grounded && speeds.length && ratios[ratios.length - 1] < 1e-6) {
      k.input.jump = true; k.integrateTick(DT)
      const r = nrm(k.absPos), v = k.absVel, vr = dot(v, r)
      jumpH.push(Math.hypot(v.x - vr * r.x, v.y - vr * r.y, v.z - vr * r.z))
    }
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? f(s[s.length >> 1]) : 'n/a' }
  p('P3.steepSpots62to85', pts.length)
  p('P3.fullyBlockedAfter0.5s', `${blocked}/${speeds.length}`)
  p('P3.blocked.reportedSpeed_mps.median', med(speeds.filter((_, i) => ratios[i] < 1e-6)))
  p('P3.blocked.actualSpeed_mps', 0)
  p('P3.blocked.jumpHorizontalLaunch_mps.median|n', `${med(jumpH)}|${jumpH.length}`)
}
p('controls', `${cOk}/${cN}`)