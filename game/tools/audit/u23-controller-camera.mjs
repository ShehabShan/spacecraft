// A1-U23 probe — play controller, camera, input, frame (READ-ONLY audit).
// Claims are written first in docs/audit/U23-controller-camera-input-frame.md;
// this probe drives the REAL PlayerController / ThirdPersonCamera / AstronautKCC
// (esbuild bundle pattern of tools/test-play-controller.mjs) and measures them.
// Run from game/:  node tools/audit/u23-controller-camera.mjs   (exit 0 = probe ran)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..', '..')
const out = path.join(game, 'node_modules', '.cache', 'u23-audit.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/controller/PlayerController';
      export * as cfg from './play/world/moonConfig'; export { AstronautKCC } from './core/physics/astronautKCC';
      export { initTerrainField, terrainHeight, gridCoord, GRID_N } from './core/terrain/terrainField';
      export { faceCubePointInto, spherifyInto } from './core/terrain/spherify';
      export { spinQuatInto, rotateByQuatConjInto, signedAngleAbout } from './core/physics/sphericalFrame';
      export * from './play/camera/ThirdPersonCamera'; export * from './play/frame/shellStages';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out,
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)
const T = M.cfg.PLAY_TUNING, R = M.cfg.MOON_R
const p = (k, v) => console.log(`${k}=${v}`)
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }
const SP = { x: 0.32058829107484366, y: -0.03682548816622783, z: 0.9465025256421825 }
const inp = () => ({ moveX: 0, moveY: 0, sprint: false, crouch: false, jumpPressed: false,
  lookDX: 0, lookDY: 0, zoomDelta: 0, toggleCamEdge: false })
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

// ---------- flat sphere (mapping / timing not confounded by terrain) ----------
M.initTerrainField({ ...M.cfg.MOON_PARAMS, continentAmp: 0, mountainAmp: 0, detailAmp: 0 })
function rig() {
  const kcc = new M.AstronautKCC(M.cfg.MOON_ASTRONAUT); kcc.teleportSurface(SP.x, SP.y, SP.z)
  const ctrl = new M.PlayerController(kcc), cam = new M.ThirdPersonCamera()
  cam.reset(kcc, kcc.fwd, ctrl)
  return { kcc, ctrl, cam, i: inp(), clock: new M.PlayClock() }
}
// one playFrame (stages 1, 3, 4+5, 8) with the real PlayClock (0.1 s clamp)
function frame(r, delta) {
  r.clock.step('PLAYING', delta)
  r.cam.preStep(r.kcc, r.i, r.ctrl)
  r.ctrl.beginFrame()
  const n = r.ctrl.simulate(r.i, r.cam, r.clock.dt, 5)
  r.cam.poseInto(r.kcc, r.clock.dt)
  return n
}

// P1 — D moves right on screen, mouse-right turns right (sign conventions)
{
  const r = rig(); frame(r, 1 / 60)
  const c0 = { ...r.kcc.absPos }, h = { ...r.cam.heading }, u = { ...r.kcc.up }
  const right = { x: h.y * u.z - h.z * u.y, y: h.z * u.x - h.x * u.z, z: h.x * u.y - h.y * u.x } // heading × up
  // camera basis from the quat: three.js X axis = right
  const q = r.cam.quatPlanet
  const camX = { x: 1 - 2 * (q.y * q.y + q.z * q.z), y: 2 * (q.x * q.y + q.w * q.z), z: 2 * (q.x * q.z - q.w * q.y) }
  p('P1.camXdotHeadingXup', (camX.x * right.x + camX.y * right.y + camX.z * right.z).toFixed(4))
  r.i.moveX = 1; for (let k = 0; k < 60; k++) frame(r, 1 / 60)
  const d = { x: r.kcc.absPos.x - c0.x, y: r.kcc.absPos.y - c0.y, z: r.kcc.absPos.z - c0.z }
  p('P1.Dkey.dispDotCamRight', ((d.x * camX.x + d.y * camX.y + d.z * camX.z) / Math.hypot(d.x, d.y, d.z)).toFixed(4))
  const r2 = rig(); frame(r2, 1 / 60); const h0 = { ...r2.cam.heading }
  r2.i.lookDX = 50; frame(r2, 1 / 60)
  const a = M.signedAngleAbout(h0.x, h0.y, h0.z, r2.cam.heading.x, r2.cam.heading.y, r2.cam.heading.z, r2.kcc.up.x, r2.kcc.up.y, r2.kcc.up.z)
  const h1 = r2.cam.heading
  p('P1.mouseRight.newHeadingDotOldRight', ((h1.x - h0.x) * right.x + (h1.y - h0.y) * right.y + (h1.z - h0.z) * right.z > 0))
  p('P1.mouseRight.angleRad', a.toFixed(4))
}

// P2 — game speed vs frame rate (W held, 3 s wall time, real PlayClock + controller)
{
  const res = {}
  for (const fps of [144, 60, 30, 15, 12, 10, 7.5, 5]) {
    const r = rig(); frame(r, 1 / fps); r.i.moveY = 1
    const c0 = { ...r.kcc.absPos }; let ticks = 0
    const N = Math.round(3 * fps)
    for (let k = 0; k < N; k++) ticks += frame(r, 1 / fps)
    res[fps] = { d: dist3(r.kcc.absPos, c0), ticks }
  }
  for (const fps of Object.keys(res)) p(`P2.fps${fps}`, `dist=${res[fps].d.toFixed(3)}m ticks=${res[fps].ticks} (wall 3 s → ideal 180) speedRatio=${(res[fps].ticks / 180).toFixed(3)}`)
  control('P2_60fps_runs_180_ticks', res[60].ticks === 180)
}

// P3 — first-person yaw cadence at 144 Hz vs third-person yaw cadence
{
  const cad = (fp) => {
    const r = rig(); frame(r, 1 / 144)
    if (fp) { r.i.toggleCamEdge = true; frame(r, 1 / 144); r.i.toggleCamEdge = false }
    for (let k = 0; k < 20; k++) frame(r, 1 / 144)
    let moved = 0, still = 0, maxStep = 0; const N = 1440
    for (let k = 0; k < N; k++) {
      const h0 = { ...r.cam.heading }
      r.i.lookDX = 4; r.i.lookDY = 1
      frame(r, 1 / 144)
      const ang = Math.acos(Math.min(1, h0.x * r.cam.heading.x + h0.y * r.cam.heading.y + h0.z * r.cam.heading.z))
      if (ang > 1e-7) moved++; else still++
      if (ang > maxStep) maxStep = ang
    }
    return { moved, still, maxStepDeg: maxStep * 180 / Math.PI, fp: r.cam.firstPerson }
  }
  const tp = cad(false), fp = cad(true)
  p('P3.TP.144Hz', `framesYawMoved=${tp.moved}/1440 still=${tp.still} maxStepDeg=${tp.maxStepDeg.toFixed(3)}`)
  p('P3.FP.144Hz', `framesYawMoved=${fp.moved}/1440 still=${fp.still} maxStepDeg=${fp.maxStepDeg.toFixed(3)} (4 px/frame → ${(4 * T.lookSens * 180 / Math.PI).toFixed(3)} deg/frame expected)`)
  control('P3_fp_mode_entered', fp.fp === true)
}

// P4 — degenerate heading: transport of a heading parallel to up (code path, not reachability)
{
  const r = rig(); frame(r, 1 / 60)
  const u = r.kcc.up; r.cam.heading.x = u.x; r.cam.heading.y = u.y; r.cam.heading.z = u.z
  frame(r, 1 / 60)
  const hl = Math.hypot(r.cam.heading.x, r.cam.heading.y, r.cam.heading.z)
  r.i.moveY = 1; const c0 = { ...r.kcc.absPos }
  for (let k = 0; k < 60; k++) frame(r, 1 / 60)
  p('P4.headingParallelUp', `|heading| after transport=${hl.toFixed(6)} Wdisp1s=${dist3(r.kcc.absPos, c0).toFixed(4)}m`)
}

// ---------- real moon terrain ----------
M.initTerrainField(M.cfg.MOON_PARAMS)
const H = M.terrainHeight
// P5 — camera vs analytic terrain: line of sight + the 4-sample cut (random poses over the moon)
{
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  const qS = { x: 0, y: 0, z: 0, w: 1 }, pp = { x: 0, y: 0, z: 0 }
  let poses = 0, losBlocked = 0, camBelow = 0, minClr = Infinity, blockedDepthMax = 0
  const byDist = { 7: [0, 0], 12: [0, 0] }
  for (let s = 0; s < 6000; s++) {
    let x = rnd() * 2 - 1, y = rnd() * 2 - 1, z = rnd() * 2 - 1; const l = Math.hypot(x, y, z); if (l < 0.1 || l > 1) { s--; continue }
    x /= l; y /= l; z /= l
    const kcc = new M.AstronautKCC(M.cfg.MOON_ASTRONAUT); kcc.teleportSurface(x, y, z)
    const cam = new M.ThirdPersonCamera(), a = rnd() * 2 * Math.PI
    const f = kcc.fwd, u = kcc.up, rr = { x: f.y * u.z - f.z * u.y, y: f.z * u.x - f.x * u.z, z: f.x * u.y - f.y * u.x }
    cam.reset(kcc, { x: f.x * Math.cos(a) + rr.x * Math.sin(a), y: f.y * Math.cos(a) + rr.y * Math.sin(a), z: f.z * Math.cos(a) + rr.z * Math.sin(a) })
    cam.pitch = T.camPitchMin + rnd() * (T.camPitchMax - T.camPitchMin)
    const D = rnd() < 0.5 ? 7 : 12; cam.dist = D
    cam.poseInto(kcc) // snap pose (lag 0) — S = pivot
    M.spinQuatInto(kcc.spinPhase, qS); M.rotateByQuatConjInto(qS, kcc.absPos.x, kcc.absPos.y, kcc.absPos.z, pp)
    const C = { x: pp.x + cam.offsetPlanet.x, y: pp.y + cam.offsetPlanet.y, z: pp.z + cam.offsetPlanet.z }
    const S = { x: pp.x + u.x * T.pivotHeight, y: pp.y + u.y * T.pivotHeight, z: pp.z + u.z * T.pivotHeight }
    const cr = Math.hypot(C.x, C.y, C.z), clr = cr - (R + H(C.x / cr, C.y / cr, C.z / cr))
    if (clr < minClr) minClr = clr; if (clr < 0) camBelow++
    let blocked = false, depth = 0
    for (let k = 1; k < 64; k++) {
      const t = k / 64, q = { x: C.x + (S.x - C.x) * t, y: C.y + (S.y - C.y) * t, z: C.z + (S.z - C.z) * t }
      const qr = Math.hypot(q.x, q.y, q.z), g = qr - (R + H(q.x / qr, q.y / qr, q.z / qr))
      if (g < 0) { blocked = true; if (-g > depth) depth = -g }
    }
    poses++; byDist[D][0]++
    if (blocked) { losBlocked++; byDist[D][1]++; if (depth > blockedDepthMax) blockedDepthMax = depth }
  }
  p('P5.poses', poses); p('P5.camBelowAnalytic', camBelow); p('P5.minCamClearance_m', minClr.toFixed(3))
  p('P5.pivotOccludedByAnalyticTerrain', `${losBlocked}/${poses} (${(100 * losBlocked / poses).toFixed(2)} %) maxDepth=${blockedDepthMax.toFixed(2)} m`)
  p('P5.occluded.dist7', `${byDist[7][1]}/${byDist[7][0]}`); p('P5.occluded.dist12', `${byDist[12][1]}/${byDist[12][0]}`)
  control('P5_camera_never_below_analytic', camBelow === 0)
}

// P6 — drawn (L4 linear mesh) above analytic by more than camClearance: where the camera,
// held camClearance above ANALYTIC height, is inside the DRAWN terrain (U22-1 geometry)
{
  const L = 4, Dn = M.GRID_N << L
  const dir = (f, uu, vv) => { const o = { x: 0, y: 0, z: 0 }; M.faceCubePointInto(f, uu, vv, o); M.spherifyInto(o.x, o.y, o.z, o); return o }
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  let n = 0, over = 0, over1 = 0, worst = 0
  for (let s = 0; s < 40000; s++) {
    const f = (rnd() * 6) | 0, g = (rnd() * (Dn - 1)) | 0, h = (rnd() * (Dn - 1)) | 0
    const u0 = M.gridCoord(g, Dn), u1 = M.gridCoord(g + 1, Dn), v0 = M.gridCoord(h, Dn), v1 = M.gridCoord(h + 1, Dn)
    const a = dir(f, u0, v0), b = dir(f, u1, v1), c = dir(f, u1, v0), d = dir(f, u0, v1)
    const ra = R + H(a.x, a.y, a.z), rb = R + H(b.x, b.y, b.z), rc = R + H(c.x, c.y, c.z), rd = R + H(d.x, d.y, d.z)
    // drawn mesh edges only: the worker splits each quad along (i,j)-(i+1,j+1) (terrainWorker.ts:79-83)
    // = a-b here, plus the two quad sides a-c (u step) and a-d (v step); the anti-diagonal c-d is not drawn
    for (const [P, Q, rp, rq] of [[a, b, ra, rb], [a, c, ra, rc], [a, d, ra, rd]]) {
      const mx = (P.x * rp + Q.x * rq) / 2, my = (P.y * rp + Q.y * rq) / 2, mz = (P.z * rp + Q.z * rq) / 2
      const rl = Math.hypot(mx, my, mz), drawnAbove = rl - (R + H(mx / rl, my / rl, mz / rl))
      n++; if (drawnAbove > T.camClearance) over++; if (drawnAbove > 1) over1++; if (drawnAbove > worst) worst = drawnAbove
    }
  }
  p('P6.L4.midpoints', n)
  p('P6.drawnAboveAnalytic>camClearance(0.4m)', `${over} (${(100 * over / n).toFixed(2)} %)`)
  p('P6.drawnAboveAnalytic>1m', `${over1} (${(100 * over1 / n).toFixed(2)} %)`); p('P6.worst_m', worst.toFixed(2))
}
p('controls', `${cOk}/${cN}`)
process.exit(0)