// A1-U24 probe — play/character (READ-ONLY audit). Claims are written first in
// docs/audit/U24-character.md. Drives the REAL ProceduralAnimator /
// AnimStateMachine / AstronautRig (esbuild bundle pattern of
// tools/test-play-anim.mjs). Forward kinematics is the probe's own f64 code,
// built from the §7.2 joint offsets, not from the animator.
// Run from game/:  node tools/audit/u24-character.mjs   (exit 0 = probe ran)
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..', '..')
const out = path.join(game, 'node_modules', '.cache', 'u24-audit.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/character/animStateMachine'; export * from './play/character/AstronautRig';
      export * as PA from './play/character/ProceduralAnimator';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)
const PA = M.PA, S = M.AnimState, J = PA.JOINT_INDEX
const p = (k, v) => console.log(`${k}=${v}`)
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }
const DEG = 180 / Math.PI

// ---- own f64 quaternion FK (xyzw)
const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
const qrot = (q, v) => { const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]); return [r[0], r[1], r[2]] }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const qj = (b, n) => { const o = J[n] * 4; return [b.q[o], b.q[o + 1], b.q[o + 2], b.q[o + 3]] }
// §7.2 offsets: hips (0,hipsY,0) → upperLeg (±0.11,−0.06,0) → lowerLeg (0,−0.40,0) → foot (0,−0.40,0); sole y −0.06, toe z −0.19, heel z +0.09
function foot(b, side) {
  const sx = side === 'R' ? 1 : -1
  let q = qj(b, 'hips'), pos = [0, b.hipsY, 0]
  pos = add(pos, qrot(q, [sx * 0.11, -0.06, 0])); q = qmul(q, qj(b, `upperLeg${side}`))
  pos = add(pos, qrot(q, [0, -0.40, 0])); q = qmul(q, qj(b, `lowerLeg${side}`))
  pos = add(pos, qrot(q, [0, -0.40, 0])); q = qmul(q, qj(b, `foot${side}`))
  const heel = add(pos, qrot(q, [0, -0.06, 0.09])), toe = add(pos, qrot(q, [0, -0.06, -0.19])), mid = add(pos, qrot(q, [0, -0.06, 0]))
  return { heel, toe, mid, n: qrot(q, [0, 1, 0]) }
}

// ---- control: Idle sole on the ground plane, normal up
{ const b = PA.createPoseBuffer(), lg = M.createLegPose(); PA.idlePose(b, 0, 0, 0, lg, 0, 0)
  const f = foot(b, 'R'); control('idle_sole_y0', Math.abs(f.heel[1]) < 1e-5 && Math.abs(f.toe[1]) < 1e-5 && f.n[1] > 0.99999)
  p('idle.sole_y_cm', `${(f.heel[1] * 100).toFixed(4)}/${(f.toe[1] * 100).toFixed(4)}`) }

// ---- A. stance foot over a gait cycle: vertical (unchecked by test-play-anim 15) + horizontal slide
function gait(v, addD, tag) {
  const b = PA.createPoseBuffer(), lg = M.createLegPose(), f = PA.gaitFreq(v), beta = PA.gaitBeta(v)
  const N = 2000; let yMin = 1e9, yMax = -1e9, zW = [], swingMin = 1e9
  for (let i = 0; i < N; i++) {
    const ph = i / N; PA.gaitPose(b, v, ph, addD, 0, lg, 0, 0)
    const ft = foot(b, 'R'), low = Math.min(ft.heel[1], ft.toe[1])
    if (ph < beta) { yMin = Math.min(yMin, low); yMax = Math.max(yMax, low); zW.push(ft.mid[2] - v * (ph / f)) }  // body moves −Z at v
    else swingMin = Math.min(swingMin, low)
  }
  const slide = Math.max(...zW) - Math.min(...zW)
  p(`gait.${tag}`, `v=${v} addD=${addD} beta=${beta.toFixed(3)} stanceSoleY_cm=[${(yMin * 100).toFixed(2)},${(yMax * 100).toFixed(2)}] rise_cm=${((yMax - yMin) * 100).toFixed(2)} stanceSlideZ_cm=${(slide * 100).toFixed(3)} swingMinY_cm=${(swingMin * 100).toFixed(2)}`)
  return { yMin, yMax, slide }
}
const g1 = gait(1.0, 0, 'v1'); control('gait_v1_horizontal_slide_lt_1cm (reproduces test 15)', g1.slide < 0.01)
gait(3.2, 0, 'walk'); gait(5.0, 0, 'run_in'); gait(6.5, 0, 'sprint')
gait(1.5, 0.12 + 0, 'crouch_walk')   // crouchSpeed 1.5, crouchDrop 0.12 · w_c = 1

// ---- B. slope ankle signs through the real ProceduralAnimator.update (Idle, both feet stance)
const tel = () => ({ grounded: true, speed: 0, vertSpeed: 0, slopeDeg: 0, sliding: false, sprint: false, crouch: false,
  inputMag: 0, jumped: false, landed: false, landingSpeed: 0, airTime: 0, dt: 1 / 60, slopeFwdDeg: 0, slopeSideDeg: 0 })
function slopeCase(fwd, side) {
  const an = new PA.ProceduralAnimator(), t = tel(); t.slopeFwdDeg = fwd; t.slopeSideDeg = side
  for (let i = 0; i < 60; i++) an.update(t, 1 / 60)
  const fr = foot(an.out, 'R')
  // telemetry convention (CharacterTelemetry.ts:252, plan §5.2): + = uphill ahead (rig −Z) / right (rig +X)
  const a = fwd / DEG, c = side / DEG
  const nG = [-Math.sin(c), 1, Math.sin(a)]; const l = Math.hypot(...nG); for (let k = 0; k < 3; k++) nG[k] /= l
  const dot = fr.n[0] * nG[0] + fr.n[1] * nG[1] + fr.n[2] * nG[2]
  return { err: Math.acos(Math.min(1, dot)) * DEG, n: fr.n, st: an.stateName }
}
const pf = slopeCase(10, 0); p('slope.fwd10', `state=${pf.st} sole-vs-ground ${pf.err.toFixed(2)}deg n=${pf.n.map((x) => x.toFixed(3))}`)
control('slope_pitch_follows_ground', pf.err < 0.5)
const ps = slopeCase(0, 10); p('slope.side10', `state=${ps.st} sole-vs-ground ${ps.err.toFixed(2)}deg n=${ps.n.map((x) => x.toFixed(3))}`)
const ps2 = slopeCase(0, -10); p('slope.side-10', `sole-vs-ground ${ps2.err.toFixed(2)}deg`)

// ---- C. landing edge inside JumpLaunch (0.12 s) is dropped
function jumpThenLand(landAtS, landingSpeed) {
  const sm = new M.AnimStateMachine(), t = tel(), dt = 1 / 60, seen = []
  t.speed = 3; for (let i = 0; i < 30; i++) sm.step(t, dt)          // Walk
  t.jumped = true; t.grounded = false; t.vertSpeed = 4.2; sm.step(t, dt); t.jumped = false; seen.push(sm.stateName)
  let tt = dt, landed = false
  for (let i = 0; i < 60; i++) {
    tt += dt
    if (!landed && tt >= landAtS) { t.grounded = true; t.vertSpeed = 0; t.landed = true; t.landingSpeed = landingSpeed; landed = true } else t.landed = false
    t.airTime = t.grounded ? 0 : tt; sm.step(t, dt)
    if (seen[seen.length - 1] !== sm.stateName) seen.push(sm.stateName)
  }
  return seen.join('>')
}
p('edge.land_at_0.05s_v3', jumpThenLand(0.05, 3)); p('edge.land_at_0.10s_v4', jumpThenLand(0.10, 4))
p('edge.land_at_0.20s_v3 (control)', jumpThenLand(0.20, 3))
control('land_after_launch_is_seen', jumpThenLand(0.20, 3).includes('Land'))

// ---- D. GLB seam: the root a CharacterAnimator hands to moonWorld carries rig-private transforms
{ const rig = M.buildAstronautRig(0.02), q = rig.root.quaternion
  p('seam.root_quat', `${[q.x, q.y, q.z, q.w].map((x) => x.toFixed(4))} yawDeg=${(2 * Math.atan2(q.y, q.w) * DEG).toFixed(1)} rootY=${rig.root.position.y}`)
  // a GLB-style root (identity, feet at origin, −Z facing) placed under characterRoot (+X = fwd): facing goes where?
  const face = qrot([0, 0, 0, 1], [0, 0, -1]); p('seam.identity_root_faces_characterRoot', `${face} (characterRoot fwd = +X, right = +Z)`)
  const faceRig = qrot([q.x, q.y, q.z, q.w], [0, 0, -1]); control('rig_root_faces_plusX', Math.abs(faceRig[0] - 1) < 1e-6) }

p('controls', `${cOk}/${cN}`)
p('PROBE_EXIT', cOk === cN ? 0 : 1)
process.exit(cOk === cN ? 0 : 1)