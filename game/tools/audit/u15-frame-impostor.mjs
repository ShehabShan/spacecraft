// A1-U15 probe — spherical frame (parallel transport) + impostor math (READ-ONLY audit).
// Imports the REAL core; every reference is written from first principles here, never from
// the code under test. Run from game/:  node tools/audit/u15-frame-impostor.mjs  (exit 0 = probe ran)
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
const SF = await import('../../src/core/physics/sphericalFrame.ts')
const IM = await import('../../src/core/render/impostorMath.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const NZ = await import('../../src/core/terrain/noise.ts')
const MC = await import('../../src/play/world/moonConfig.ts')
const SC = await import('../../src/core/simulation/SimulationCore.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(5)) : String(x))
const deg = (r) => (r * 180) / Math.PI
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }
const v = () => ({ x: 0, y: 0, z: 0 })
const q = () => ({ x: 0, y: 0, z: 0, w: 1 })
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const nrm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l } }
const add = (a, b, s = 1) => ({ x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s })
const ang = (a, b) => Math.atan2(Math.hypot(...Object.values(crs(a, b))), dot(a, b))
const rnd = NZ.mulberry32(1515)
const randUnit = () => { for (;;) { const a = { x: rnd() * 2 - 1, y: rnd() * 2 - 1, z: rnd() * 2 - 1 }; const l = Math.hypot(a.x, a.y, a.z); if (l > 0.1 && l <= 1) return nrm(a) } }
// Reference transport (written here): minimal rotation taking uOld to uNew, applied to fwd.
function mrTransport(fw, uOld, uNew) {
  const k = crs(uOld, uNew); const s = Math.hypot(k.x, k.y, k.z); const c = dot(uOld, uNew)
  if (s < 1e-15) return { ...fw }
  const kk = { x: k.x / s, y: k.y / s, z: k.z / s }; const a = Math.atan2(s, c)
  const ca = Math.cos(a), sa = Math.sin(a), d = dot(kk, fw), cr = crs(kk, fw)
  return nrm({ x: fw.x * ca + cr.x * sa + kk.x * d * (1 - ca), y: fw.y * ca + cr.y * sa + kk.y * d * (1 - ca), z: fw.z * ca + cr.z * sa + kk.z * d * (1 - ca) })
}
const gsT = (fw, u) => { const o = v(); SF.transportFrameInto(fw.x, fw.y, fw.z, u.x, u.y, u.z, o); return { ...o } }

// ---- controls: the reference + the real primitives agree with closed forms ----
{
  // spin: world = R(θ)·planet about +Y; transport velocity = d/dθ of that rotation × ω
  const qs = q(), o = v(), o2 = v()
  const P = { x: 5000, y: 300, z: -1200 }, w = 0.0104, h = 1e-6
  SF.spinQuatInto(h, qs); SF.rotateByQuatInto(qs, P.x, P.y, P.z, o)
  SF.transportVelocityInto(w, P.x, P.y, P.z, o2)
  const fd = { x: (o.x - P.x) / h * w, y: (o.y - P.y) / h * w, z: (o.z - P.z) / h * w }
  control('spinVelocityMatchesFD', Math.hypot(fd.x - o2.x, fd.y - o2.y, fd.z - o2.z) < 1e-4)
  SF.transportVelocityInto(0.0104, 5000, 0, 0, o2); control('equator52', Math.abs(Math.hypot(o2.x, o2.y, o2.z) - 52) < 1e-9)
  // quatFromFrame reproduces the basis X=fwd, Y=up (random orthonormal frames)
  let worst = 0
  for (let i = 0; i < 20000; i++) {
    const u = randUnit(); const fw = gsT(randUnit(), u); const qq = q(); SF.quatFromFrameInto(fw.x, fw.y, fw.z, u.x, u.y, u.z, qq)
    const X = v(), Y = v(); SF.rotateByQuatInto(qq, 1, 0, 0, X); SF.rotateByQuatInto(qq, 0, 1, 0, Y)
    worst = Math.max(worst, ang(X, fw), ang(Y, u), Math.abs(Math.hypot(qq.x, qq.y, qq.z, qq.w) - 1))
  }
  control('quatFromFrameExact', worst < 1e-12); p('quatFromFrame.worst', f(worst))
  // canonical tangent bound
  let minC = 9; for (let i = 0; i < 200000; i++) { const u = randUnit(); const t = v(); SF.canonicalTangentInto(u.x, u.y, u.z, t); minC = Math.min(minC, Math.abs(dot(t, u)) < 1e-12 ? 1 : 0) }
  control('canonicalTangentPerp', minC === 1)
  // reference MR transport is exactly reversible
  const u1 = { x: 0, y: 1, z: 0 }, u2 = nrm({ x: 0.1, y: 1, z: 0.05 }); const fw0 = gsT(nrm({ x: 0.3, y: 0, z: 1 }), u1)
  control('mrReversible', ang(mrTransport(mrTransport(fw0, u1, u2), u2, u1), fw0) < 1e-14)
}

// ---- T1: Gram-Schmidt reprojection vs parallel transport — round-trip (jitter) drift ----
// Up oscillates u1 -> u2 -> u1 (tilt δ about an axis k at 45° to fwd); count heading change per cycle.
for (const dDeg of [1, 3.2, 7.6, 37]) {
  const d = (dDeg * Math.PI) / 180
  const u1 = { x: 0, y: 1, z: 0 }
  const k = nrm({ x: 1, y: 0, z: 1 }) // tilt axis 45° from fwd (+Z)
  const u2 = mrTransport(u1, { x: 0, y: 1, z: 0 }, u1) // placeholder
  // u2 = u1 rotated about k by d
  const ca = Math.cos(d), sa = Math.sin(d), cr = crs(k, u1), dk = dot(k, u1)
  const U2 = nrm({ x: u1.x * ca + cr.x * sa + k.x * dk * (1 - ca), y: u1.y * ca + cr.y * sa + k.y * dk * (1 - ca), z: u1.z * ca + cr.z * sa + k.z * dk * (1 - ca) })
  void u2
  let fg = { x: 0, y: 0, z: 1 }, fm = { x: 0, y: 0, z: 1 }
  const f0 = { ...fg }
  const after = {}
  for (let c = 1; c <= 1000; c++) {
    fg = gsT(gsT(fg, U2), u1); fm = mrTransport(mrTransport(fm, u1, U2), U2, u1)
    if (c === 1 || c === 10 || c === 100 || c === 1000) after[c] = [deg(SF.signedAngleAbout(f0.x, f0.y, f0.z, fg.x, fg.y, fg.z, 0, 1, 0)), deg(ang(fm, f0))]
  }
  p(`T1.roundtrip.delta${dDeg}deg.GS_heading_deg_after_1/10/100/1000`, [1, 10, 100, 1000].map((c) => f(after[c][0])).join('/'))
  p(`T1.roundtrip.delta${dDeg}deg.MR_heading_deg_after_1000`, f(after[1000][1]))
}

// ---- T1b: realistic walk on the play Moon: up = blend(terrain normal, radial) per KCC _refreshUpFwd ----
{
  TF.initTerrainField(MC.MOON_PARAMS)
  const R = MC.MOON_PARAMS.radius, w = MC.MOON_ASTRONAUT.upBlendWeight
  const step = MC.MOON_ASTRONAUT.walkSpeed !== undefined ? MC.MOON_ASTRONAUT.walkSpeed / 60 : 3.2 / 60
  const upAt = (r) => { const n = v(); TF.terrainNormalInto(r.x, r.y, r.z, n); return nrm({ x: w * n.x + (1 - w) * r.x, y: w * n.y + (1 - w) * r.y, z: w * n.z + (1 - w) * r.z }) }
  const res = []
  for (let s = 0; s < 12; s++) {
    let r = randUnit(); const r0 = { ...r }
    let u = upAt(r)
    let fg = gsT(randUnit(), u), fm = { ...fg }
    const h0g = gsT(fg, r) // initial heading in the radial tangent plane
    // walk the GS path: move along the radial-tangent projection of fwd
    const walk = (fw0, tr) => {
      let rr = { ...r0 }, uu = upAt(rr), fw = { ...fw0 }
      const ticks = Math.round(1000 / step) // 1 km
      for (let i = 0; i < ticks; i++) {
        const t = gsT(fw, rr)
        rr = nrm(add(rr, t, step / R))
        const un = upAt(rr)
        fw = tr === 'gs' ? gsT(fw, un) : mrTransport(fw, uu, un)
        uu = un
      }
      return { rr, fw }
    }
    const G = walk(fg, 'gs'), M = walk(fm, 'mr')
    // cross-track distance from the start great circle (plane spanned by r0, initial heading)
    const nPlane = nrm(crs(r0, h0g))
    const xg = Math.asin(dot(G.rr, nPlane)) * R, xm = Math.asin(dot(M.rr, nPlane)) * R
    // heading difference between GS and MR at the end, compared in the radial plane at each end point
    res.push({ xg, xm, sep: ang(G.rr, M.rr) * R })
    void u; void fm; void r
  }
  const a = (k) => res.map((o) => Math.abs(o[k])).sort((x, y) => x - y)
  const med = (arr) => arr[Math.floor(arr.length / 2)]
  p('T1b.walk1km.sites', res.length)
  p('T1b.crossTrack_m.GS.median/max', `${f(med(a('xg')))}/${f(Math.max(...a('xg')))}`)
  p('T1b.crossTrack_m.MR.median/max', `${f(med(a('xm')))}/${f(Math.max(...a('xm')))}`)
  p('T1b.GSvsMR_endpointSeparation_m.median/max', `${f(med(a('sep')))}/${f(Math.max(...a('sep')))}`)
}

// ---- I1: below-horizon cull allowance 0.03 rad vs the real horizon on the play Moon ----
{
  const R = MC.MOON_PARAMS.radius
  for (const h of [1.62, 5, 20]) p(`I1.smoothSphereDip_rad.h${h}`, f(Math.acos(R / (R + h))))
  // Terrain horizon: max terrain elevation per azimuth from an eye at h above ground (radial up, as skyState).
  const H = TF.terrainHeight
  let below = 0, total = 0, minHz = 9; const perSite = []
  for (let s = 0; s < 10; s++) {
    const d0 = randUnit(); const e1 = nrm(crs(d0, Math.abs(d0.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 })); const e2 = crs(d0, e1)
    const eyeR = R + H(d0.x, d0.y, d0.z) + 1.62
    const E = { x: d0.x * eyeR, y: d0.y * eyeR, z: d0.z * eyeR }
    let siteBelow = 0
    for (let a = 0; a < 180; a++) {
      const az = (a / 180) * 2 * Math.PI; const t = add({ x: e1.x * Math.cos(az), y: e1.y * Math.cos(az), z: e1.z * Math.cos(az) }, e2, Math.sin(az))
      let hz = -Math.PI / 2
      for (let i = 1; i <= 1200; i++) {
        const psi = (i / 1200) * 0.8
        const dd = add({ x: d0.x * Math.cos(psi), y: d0.y * Math.cos(psi), z: d0.z * Math.cos(psi) }, t, Math.sin(psi))
        const rr = R + H(dd.x, dd.y, dd.z)
        const P = { x: dd.x * rr - E.x, y: dd.y * rr - E.y, z: dd.z * rr - E.z }
        const el = Math.asin(dot(P, d0) / Math.hypot(P.x, P.y, P.z))
        if (el > hz) hz = el
      }
      total++; if (hz < -0.03) { below++; siteBelow++ } ; if (hz < minHz) minHz = hz
    }
    perSite.push(siteBelow)
  }
  p('I1.terrainHorizon.azimuthsBelowAllowance', `${below}/${total}`)
  p('I1.terrainHorizon.perSite(of180)', perSite.join(','))
  p('I1.terrainHorizon.min_rad', f(minHz))
  // a body whose disk-top is above the terrain horizon but whose centre elevation < -(θ+0.03) is culled
  const cull = IM.fullyBelowHorizon(-0.045, 0.002, 0.03)
  p('I1.example.el-0.045_theta0.002_culled', cull)
}

// ---- I2: impostor shape — camera-facing quad vs true sphere (angle space + screen) ----
{
  // Camera at origin looking along -Z (identity quat), as projectDirectionInto's convention.
  const qc = q(), fov = (62 * Math.PI) / 180, W = 1920, Hh = 1080, aspect = W / Hh
  const theta = 0.0642 // Earth-from-Moon-sized disk (≈3.7° radius, U10a)
  const D = IM.stagedDistanceForRank(0)
  const pr = { px: 0, py: 0, behind: false }
  const proj = (d) => { const n = nrm(d); IM.projectDirectionInto(n.x, n.y, n.z, qc, fov, aspect, W, Hh, pr); return [pr.px, pr.py] }
  const rows = []
  for (const bDeg of [0, 15, 30, 40, 46]) {
    const b = (bDeg * Math.PI) / 180
    const dir = { x: Math.sin(b), y: 0, z: -Math.cos(b) } // off-axis horizontally (radial = x)
    // impostor disk: centre D·dir, disk radius D·tanθ in the camera right/up plane (SkyImpostorPool: _q = camera quat)
    const rD = D * Math.tan(theta), C = { x: dir.x * D, y: dir.y * D, z: dir.z * D }
    const iR = [add(C, { x: 1, y: 0, z: 0 }, rD), add(C, { x: 1, y: 0, z: 0 }, -rD)]
    const iT = [add(C, { x: 0, y: 1, z: 0 }, rD), add(C, { x: 0, y: 1, z: 0 }, -rD)]
    const angR = (ang(iR[0], dir) + ang(iR[1], dir)) / 2, angT = (ang(iT[0], dir) + ang(iT[1], dir)) / 2
    // true sphere limb: directions at exactly θ from dir, radial (in x–z plane) and tangential (y)
    const rot = (axis, a) => { const o = v(); SF.rotateAboutAxisInto(dir.x, dir.y, dir.z, axis.x, axis.y, axis.z, a, o); return o }
    const tR = [rot({ x: 0, y: 1, z: 0 }, theta), rot({ x: 0, y: 1, z: 0 }, -theta)]
    const tax = nrm(crs(dir, { x: 0, y: 1, z: 0 }))
    const tT = [rot(tax, theta), rot(tax, -theta)]
    const sx = (a, bb) => Math.abs(proj(a)[0] - proj(bb)[0]), sy = (a, bb) => Math.abs(proj(a)[1] - proj(bb)[1])
    const impW = sx(iR[0], iR[1]), impH = sy(iT[0], iT[1]), truW = sx(tR[0], tR[1]), truH = sy(tT[0], tT[1])
    rows.push(`${bDeg}deg: angR/θ=${f(angR / theta)} angT/θ=${f(angT / theta)} screenW imp/true=${f(impW / truW)} screenH imp/true=${f(impH / truH)}`)
  }
  rows.forEach((r, i) => p(`I2.shape.${i}`, r))
  p('I2.screenCornerAngle_deg', f(deg(Math.atan(Math.hypot(Math.tan(fov / 2), Math.tan(fov / 2) * aspect)))))
}

// ---- I3: mutual occlusion by staged rank — parallel camera-facing quads ----
{
  // depth of a camera-facing quad = view-space z of its centre = D·cosβ (constant across the quad)
  const Df = IM.stagedDistanceForRank(0), Dn = IM.stagedDistanceForRank(1)
  const crit = (bDeg) => deg((Df - Dn) / Df / Math.tan((bDeg * Math.PI) / 180))
  p('I3.gap_m', Df - Dn)
  p('I3.criticalCentreOffset_deg.at10/20/30/45', [10, 20, 30, 45].map((b) => f(crit(b))).join('/'))
  // example: near big disk (θ 3.7°) centred at β=30°; far small disk 2° nearer the screen centre (inside the near limb)
  const bn = (30 * Math.PI) / 180, bf = (28 * Math.PI) / 180
  const zn = Dn * Math.cos(bn), zf = Df * Math.cos(bf)
  p('I3.example.nearZ/farZ', `${f(zn)}/${f(zf)}`)
  p('I3.example.farDrawnOverNear', zf < zn)
}

// ---- I4/I5: doc numbers in the impostorMath header ----
{
  p('I4.depthResolution_m.at9600.bg[500,10000]', f(IM.depthResolution(9600, 500, 10000)))
  p('I4.depthResolution_m.at9600.over45mGap_ratio', f(45 / IM.depthResolution(9600, 500, 10000)))
  const t = Math.PI / 4
  p('I5.sinVsTan_at45.undersize_pct(1-sin/tan)', f((1 - Math.sin(t) / Math.tan(t)) * 100))
  p('I5.sinVsTan_at45.factor_pct(tan/sin-1)', f((Math.tan(t) / Math.sin(t) - 1) * 100))
}

// ---- I6: diskFractionAboveHorizon vs exact spherical cap / great circle (MC on the sphere) ----
{
  let worstAbs = 0, worstRatio = 0
  for (const thDeg of [1, 4, 8]) {
    const th = (thDeg * Math.PI) / 180
    for (const eFrac of [-0.8, -0.4, 0, 0.4, 0.8]) {
      const e = eFrac * th
      // exact: fraction of the cap of angular radius th centred at elevation e lying above the horizon (y>0)
      const c = { x: Math.cos(e), y: Math.sin(e), z: 0 }; const u = { x: -Math.sin(e), y: Math.cos(e), z: 0 }, w = { x: 0, y: 0, z: 1 }
      let above = 0, N = 0
      const g = 400
      for (let i = 0; i < g; i++) for (let j = 0; j < g; j++) {
        // uniform over cap area: cosρ uniform in [cos th, 1]
        const cr = 1 - ((i + 0.5) / g) * (1 - Math.cos(th)); const rho = Math.acos(cr); const phi = ((j + 0.5) / g) * 2 * Math.PI
        const y = c.y * Math.cos(rho) + (u.y * Math.cos(phi) + w.y * Math.sin(phi)) * Math.sin(rho)
        N++; if (y > 0) above++
      }
      const exact = above / N, got = IM.diskFractionAboveHorizon(e, th)
      worstAbs = Math.max(worstAbs, Math.abs(exact - got)); worstRatio = Math.max(worstRatio, Math.abs(exact - got) / (th * th / 8))
    }
  }
  p('I6.diskFraction.worstAbsErr(θ≤8°)', f(worstAbs))
  p('I6.diskFraction.worstErr_over_claimed_bound', f(worstRatio))
}

// ---- I7: edge cases of the unclamped tan law ----
{
  p('I7.thetaEdge_hits_pi/2_at_theta_rad', f((Math.PI / 2 - IM.IMPOSTOR_EDGE_MARGIN) / IM.IMPOSTOR_EDGE_SCALE))
  p('I7.glow(θ·2.4)_hits_pi/2_at_theta_rad', f((Math.PI / 2 - IM.IMPOSTOR_EDGE_MARGIN) / IM.IMPOSTOR_EDGE_SCALE / 2.4))
  p('I7.quadHalfSize_at_theta1.5', f(IM.quadHalfSize(9600, IM.thetaEdge(1.5))))
  const g = { dirX: 0, dirY: 0, dirZ: 0, dist: 0, theta: 0 }
  IM.bodyGeometryInto(0, 0, 0, 0, 0, 0, 10, g); p('I7.bodyGeometry_coincident_theta', f(g.theta))
  const o = v(); SF.gravityInto(1, 0, 0, 0, 0, o); p('I7.gravityAtCentre', `${o.x},${o.y},${o.z}`)
  // real play-sky angular radii at boot (PLAY_BODIES radii, skyState.ts:27–35) from the Moon's centre
  const core = new SC.SimulationCore()
  const ids = core.getCelestialStates().map((s) => s.id)
  p('I7.coreIds', ids.join(','))
  const radii = { sun: 20000, mercury: 3105.7, venus: 4870.3, mars: 2649.3, jupiter: 16640.2, saturn: 15120.4, uranus: 9980.5, neptune: 9835.4, pluto: 2160.8, earth: 5000 }
  const moon = core.getCelestialState('moon')
  if (moon) {
    const out = []
    for (const [id, rad] of Object.entries(radii)) {
      const st = core.getCelestialState(id); if (!st) continue
      IM.bodyGeometryInto(moon.absPos.x, moon.absPos.y, moon.absPos.z, st.absPos.x, st.absPos.y, st.absPos.z, rad, g)
      out.push(`${id}:${f(deg(g.theta))}`)
    }
    p('I7.playSkyThetaDeg_fromMoonCentre', out.join(' '))
  }
}
p('controls', `${cOk}/${cN}`)