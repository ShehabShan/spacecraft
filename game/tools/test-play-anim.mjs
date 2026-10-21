// T1 B8 Node check (plan §12.2 B8, §8.7): the animation state machine in
// isolation — scripted telemetry sequences, hysteresis, dwell/coyote/slide/
// soft-landing/interrupt rules, the §8.1 legDrop solver table to 0.1°,
// quaternion integrity and zero-GC stepping. B9a/B9b extend it (poses, foot
// slide, slope ankles, per-frame interrupt angle). Run: `node --expose-gc tools/test-play-anim.mjs`.
// WHY: esbuild bundle (test-play-rig pattern) so RIG_DIMS can be compared.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-anim.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/character/animStateMachine'; export { RIG_DIMS } from './play/character/AstronautRig'; export * as PA from './play/character/ProceduralAnimator';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)
const { AnimState: S, AnimStateMachine, ANIM_STATE_NAMES: N, ANIM_TUNING: K, BLEND_IN, LEG, legDrop, createLegPose, RIG_DIMS } = M

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }
const DT = 1 / 60, G = 1.62, DEG = 180 / Math.PI
const tel = () => ({ grounded: true, speed: 0, vertSpeed: 0, slopeDeg: 0, sliding: false, sprint: false, crouch: false,
  inputMag: 0, jumped: false, landed: false, landingSpeed: 0, airTime: 0, dt: DT, slopeFwdDeg: 0, slopeSideDeg: 0 })
function rec(sm) { const log = []; return { log, step(t) { const s0 = sm.state; sm.step(t, DT); if (sm.state !== s0) log.push(N[sm.state]) } } }
const seq = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

// ---- purity: no THREE / core import in the machine
const src = readFileSync(path.join(game, 'src/play/character/animStateMachine.ts'), 'utf8')
ok(!/from\s+'three'|core\//.test(src), 'animStateMachine.ts imports THREE or core')
ok(/import type \{ CharacterTelemetry \}/.test(src), 'telemetry import is not type-only')

// ---- 1. Idle → Walk → Run → Walk → Idle (speed ramp 0→6.5→0)
{ const sm = new AnimStateMachine(), r = rec(sm), t = tel()
  for (let i = 0; i < 60; i++) r.step(t)
  const ramp = (a, b, s) => { const f = Math.round(s / DT); for (let i = 1; i <= f; i++) { t.speed = a + (b - a) * i / f; r.step(t) } }
  t.inputMag = 1; ramp(0, 6.5, 3); for (let i = 0; i < 60; i++) r.step(t)
  ramp(6.5, 0.0, 3); t.inputMag = 0; for (let i = 0; i < 60; i++) r.step(t)
  ok(seq(r.log, ['Walk', 'Run', 'Walk', 'Idle']), `locomotion sequence ${r.log.join('→')}`) }

// ---- 2. JumpLaunch → JumpRise → Fall → Land → Idle (ballistic, g = 1.62)
{ const sm = new AnimStateMachine(), r = rec(sm), t = tel()
  for (let i = 0; i < 30; i++) r.step(t)
  let h = 0, vs = 4.2, air = 0, landFrames = 0
  t.grounded = false; t.jumped = true; t.vertSpeed = vs; r.step(t); t.jumped = false
  ok(sm.state === S.JumpLaunch && sm.blendTime === 0.05, 'jumped → JumpLaunch, blend-in 0.05')
  let launchFrames = 1
  while (true) { h += vs * DT; vs -= G * DT; air += DT; if (h <= 0) break
    t.vertSpeed = vs; t.airTime = air; r.step(t); if (sm.state === S.JumpLaunch) launchFrames++ }
  ok(Math.abs(launchFrames * DT - K.tLaunch) <= DT + 1e-9, `JumpLaunch lasted ${(launchFrames * DT).toFixed(3)} s`)
  t.grounded = true; t.vertSpeed = 0; t.airTime = 0; t.landed = true; t.landingSpeed = -vs; r.step(t); t.landed = false
  const expLand = Math.min(0.40, Math.max(0.12, 0.10 + 0.04 * -vs))
  ok(sm.state === S.Land && Math.abs(sm.landDuration - expLand) < 1e-9, `Land T_land ${sm.landDuration} vs ${expLand}`)
  while (sm.state === S.Land) { landFrames++; r.step(t) }
  ok(Math.abs(landFrames * DT - expLand) <= DT + 1e-9, `Land lasted ${(landFrames * DT).toFixed(3)} s`)
  for (let i = 0; i < 30; i++) r.step(t)
  ok(seq(r.log, ['JumpLaunch', 'JumpRise', 'Fall', 'Land', 'Idle']), `jump sequence ${r.log.join('→')}`) }

// ---- 3. coyote bump (airTime 0.1 s, no jumped, soft touchdown) → no air state
{ const sm = new AnimStateMachine(), r = rec(sm), t = tel()
  t.speed = 2; t.inputMag = 1; for (let i = 0; i < 30; i++) r.step(t)
  t.grounded = false; t.vertSpeed = 0.3
  for (let a = DT; a <= 0.1 + 1e-9; a += DT) { t.airTime = a; r.step(t) }
  t.grounded = true; t.airTime = 0; t.vertSpeed = 0; t.landed = true; t.landingSpeed = 0.4; r.step(t); t.landed = false
  ok(Math.abs(sm.softDipD - 0.03) < 1e-9, `soft landing dip ${sm.softDipD}`)
  for (let i = 0; i < 6; i++) r.step(t)
  ok(sm.softDipD < 1e-9, `soft dip decayed to ${sm.softDipD} after 0.10 s`)
  for (let i = 0; i < 30; i++) r.step(t)
  ok(seq(r.log, ['Walk']), `coyote bump ${r.log.join('→')}`) }

// ---- 4. hysteresis: ±0.2 noise around 4.75 m/s → 0 transitions (from Walk and from Run)
for (const start of ['Walk', 'Run']) {
  const sm = new AnimStateMachine(), t = tel(); t.inputMag = 1
  t.speed = start === 'Run' ? 6 : 4.75; for (let i = 0; i < 60; i++) sm.step(t, DT)
  ok(N[sm.state] === start, `hysteresis setup ${N[sm.state]}`)
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const c0 = sm.transitions
  for (let i = 0; i < 1200; i++) { t.speed = 4.75 + (rnd() * 2 - 1) * 0.2; sm.step(t, DT) }
  ok(sm.transitions === c0, `hysteresis from ${start}: ${sm.transitions - c0} transitions`) }

// ---- 5. minimum dwell 0.08 s (1-frame speed flick)
{ const sm = new AnimStateMachine(), t = tel()
  for (let i = 0; i < 30; i++) sm.step(t, DT)
  t.speed = 0.4; t.inputMag = 1; sm.step(t, DT); t.speed = 0; t.inputMag = 0
  let walk = 1; while (sm.state === S.Walk && walk < 100) { sm.step(t, DT); if (sm.state === S.Walk) walk++ }
  ok(sm.state === S.Idle && walk * DT >= K.minDwell - 1e-9 && walk * DT <= K.minDwell + DT + 1e-9, `Walk dwell ${(walk * DT).toFixed(3)} s`) }

// ---- 6. walk off a ledge: Fall only after the 0.15 s grace; hard landing → Land → Walk
{ const sm = new AnimStateMachine(), r = rec(sm), t = tel(); t.speed = 2; t.inputMag = 1
  for (let i = 0; i < 30; i++) r.step(t)
  t.grounded = false; let a = 0, fallAt = -1
  for (let i = 0; i < 60; i++) { a += DT; t.airTime = a; t.vertSpeed = -G * a; r.step(t); if (fallAt < 0 && sm.state === S.Fall) fallAt = a }
  ok(fallAt > K.coyoteS && fallAt <= K.coyoteS + DT + 1e-9, `ledge Fall entered at airTime ${fallAt.toFixed(3)}`)
  t.grounded = true; t.airTime = 0; t.vertSpeed = 0; t.landed = true; t.landingSpeed = 2.5; r.step(t); t.landed = false
  for (let i = 0; i < 40; i++) r.step(t)
  ok(seq(r.log, ['Walk', 'Fall', 'Land', 'Walk']), `ledge sequence ${r.log.join('→')}`) }

// ---- 7. un-jumped rising launch past the grace → Fall (B8 decision)
{ const sm = new AnimStateMachine(), t = tel(); t.speed = 3; t.inputMag = 1
  for (let i = 0; i < 30; i++) sm.step(t, DT)
  t.grounded = false; t.vertSpeed = 1.0
  for (let a = DT; a <= 0.3; a += DT) { t.airTime = a; sm.step(t, DT) }
  ok(sm.state === S.Fall, `crest launch state ${N[sm.state]}`) }

// ---- 8. Slide entry/exit (sliding false must persist 0.10 s)
{ const sm = new AnimStateMachine(), t = tel(); t.speed = 2; t.inputMag = 1
  for (let i = 0; i < 30; i++) sm.step(t, DT)
  t.sliding = true; for (let i = 0; i < 30; i++) sm.step(t, DT)
  ok(sm.state === S.Slide && sm.blendTime === 0.20, `slide entry ${N[sm.state]}`)
  t.sliding = false; for (let i = 0; i < 3; i++) sm.step(t, DT)
  ok(sm.state === S.Slide, 'slide held for 0.05 s of sliding=false')
  for (let i = 0; i < 4; i++) sm.step(t, DT)
  ok(sm.state === S.Walk, `slide exit after 0.10 s → ${N[sm.state]}`) }

// ---- 9. Land interrupted at once by jumped; Walk→Run blend interrupted by a jump
{ const sm = new AnimStateMachine(), t = tel()
  t.grounded = true; t.landed = true; t.landingSpeed = 4; sm.step(t, DT); t.landed = false
  ok(sm.state === S.Land, 'hard landing from Idle → Land')
  sm.step(t, DT); t.jumped = true; t.grounded = false; t.vertSpeed = 4.2; sm.step(t, DT); t.jumped = false
  ok(sm.state === S.JumpLaunch && sm.prev === S.Land, 'jumped exits Land at once') }
{ const sm = new AnimStateMachine(), t = tel(); t.inputMag = 1; t.speed = 3
  for (let i = 0; i < 60; i++) sm.step(t, DT)
  t.speed = 6; sm.step(t, DT)
  ok(sm.state === S.Run && sm.prev === S.Walk, 'Walk → Run')
  while (sm.timeInState < 0.1 - 1e-9) sm.step(t, DT)
  const b = sm.blend
  ok(Math.abs(b - 0.5) < 0.1, `blend at mid Walk→Run ${b.toFixed(3)}`)
  t.jumped = true; t.grounded = false; t.vertSpeed = 4.2; sm.step(t, DT); t.jumped = false
  ok(sm.state === S.JumpLaunch && sm.interrupted && sm.prev === S.Run && sm.blend === 0, 'interrupt flag on mid-blend jump')
  t.airTime = DT; sm.step(t, DT)
  ok(!sm.interrupted, 'interrupt flag lasts one step') }

// ---- 10. blend curve + per-state blend-in table
{ ok(seq(BLEND_IN, [0.30, 0.20, 0.20, 0.05, 0.15, 0.25, 0.04, 0.20]), 'BLEND_IN table')
  const sm = new AnimStateMachine(), t = tel()
  for (let i = 0; i < 30; i++) sm.step(t, DT)            // past Idle's 0.08 s dwell
  t.inputMag = 1; t.speed = 1
  sm.step(t, DT); let good = sm.state === S.Walk && sm.blendTime === 0.20
  for (let i = 0; i < 20; i++) { sm.step(t, DT); const x = Math.min(1, sm.timeInState / 0.20); if (Math.abs(sm.blend - x * x * (3 - 2 * x)) > 1e-12) good = false }
  ok(good && sm.blend === 1, 'blend = smoothstep(timeInState / blendTime)') }

// ---- 11. crouch weight eases over 0.15 s
{ const sm = new AnimStateMachine(), t = tel(); t.crouch = true
  for (let i = 0; i < 4; i++) sm.step(t, DT)
  ok(Math.abs(sm.crouchW - 4 * DT / 0.15) < 1e-9, `crouchW after 4 frames ${sm.crouchW}`)
  for (let i = 0; i < 6; i++) sm.step(t, DT)
  ok(sm.crouchW === 1, 'crouchW reaches 1 at 0.15 s')
  t.crouch = false; for (let i = 0; i < 10; i++) sm.step(t, DT)
  ok(sm.crouchW === 0 && sm.state === S.Idle, 'crouchW back to 0; crouch is not a state') }

// ---- 12. solver: §8.1 table to 0.1°, flat sole, ankle under hip, unit quaternions
{ ok(LEG.d0 === RIG_DIMS.upperLeg + RIG_DIMS.lowerLeg && LEG.L === RIG_DIMS.upperLeg && LEG.L === RIG_DIMS.lowerLeg
     && LEG.hipsY === RIG_DIMS.hipsY && Math.abs(RIG_DIMS.hipsY - RIG_DIMS.hipDrop - RIG_DIMS.ankleY - LEG.d0) < 1e-12, 'LEG matches RIG_DIMS')
  const p = createLegPose()
  for (const [D, h, k] of [[0.05, 20.4, 40.7], [0.12, 31.8, 63.6], [0.15, 35.7, 71.3], [0.30, 51.3, 102.6]]) {
    legDrop(D, p)
    ok(Math.abs(p.hip * DEG - h) < 0.05 && Math.abs(p.knee * DEG - k) < 0.05, `legDrop(${D}) hip ${(p.hip * DEG).toFixed(2)} knee ${(p.knee * DEG).toFixed(2)}`)
    ok(Math.abs(p.hipsY - (0.92 - D)) < 1e-12, `legDrop(${D}) hipsY`) }
  ok(legDrop(0.5, p).D === 0.30 && legDrop(-1, p).D === 0 && p.hip === 0, 'legDrop clamps D to [0, 0.30]')
  const qmul = (a, o, b, u) => { const [ax, ay, az, aw] = [a[o], a[o + 1], a[o + 2], a[o + 3]], [bx, by, bz, bw] = b.slice ? [b[u], b[u + 1], b[u + 2], b[u + 3]] : b
    return [aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz] }
  const rot = (q, v) => { const [x, y, z, w] = q, [vx, vy, vz] = v, tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
    return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx] }
  let unit = 0, sole = 1, under = 0, drop = 0
  for (let i = 0; i <= 300; i++) { const D = i / 1000; legDrop(D, p); const q = p.q
    for (let o = 0; o < 12; o += 4) unit = Math.max(unit, Math.abs(Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]) - 1))
    const qhk = qmul(q, 0, q, 4), qhka = qmul(qhk, 0, q, 8)
    sole = Math.min(sole, rot(qhka, [0, 1, 0])[1])
    const knee = rot([q[0], q[1], q[2], q[3]], [0, -LEG.L, 0]), shank = rot(qhk, [0, -LEG.L, 0])
    under = Math.max(under, Math.abs(knee[2] + shank[2]), Math.abs(knee[0] + shank[0]))
    drop = Math.max(drop, Math.abs(-(knee[1] + shank[1]) - (LEG.d0 - D))) }
  ok(unit < 1e-6, `legDrop quaternion unit error ${unit.toExponential(2)}`)
  ok(sole > 0.9999, `sole normal · up min ${sole}`)
  ok(under < 1e-9 && drop < 1e-9, `ankle under hip (horiz ${under.toExponential(2)}, drop err ${drop.toExponential(2)})`) }

// ---- 13. zero-GC: 10,000 steps across every state (same bound as test-play-rig)
{ const sm = new AnimStateMachine(), t = tel(), p = createLegPose()
  const drive = (i) => { const k = i % 600
    t.jumped = k === 300; t.landed = k === 500; t.landingSpeed = 3
    t.grounded = k < 300 || k >= 500; t.airTime = t.grounded ? 0 : (k - 300) * DT
    t.vertSpeed = t.grounded ? 0 : 4.2 - G * (k - 300) * DT
    t.speed = k < 300 ? (k / 300) * 7 : 1; t.inputMag = 1; t.sliding = k > 560; t.crouch = k > 540 && k < 560
    sm.step(t, DT); legDrop(sm.softDipD + 0.12 * sm.crouchW, p) }
  for (let i = 0; i < 20000; i++) drive(i)
  if (globalThis.gc) { globalThis.gc(); const h0 = process.memoryUsage().heapUsed
    for (let i = 0; i < 10000; i++) drive(i)
    globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
    ok(dh < 64 * 1024, `AnimStateMachine.step heap +${dh} B over 10,000 steps`)
  } else ok(false, 'run with node --expose-gc')
  ok(sm.transitions > 50, `heap drive exercised ${sm.transitions} transitions`) }

// ==== B9a: ProceduralAnimator core + locomotion (§8.3, §8.7 foot slide)
const { PA } = M
const qrot = (q, o, v) => { const x = q[o], y = q[o + 1], z = q[o + 2], w = q[o + 3], [vx, vy, vz] = v
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx] }
const qmulA = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]
const q4 = (b, j) => { const o = PA.JOINT_INDEX[j] * 4; return [b.q[o], b.q[o + 1], b.q[o + 2], b.q[o + 3]] }
// R ankle in the hips frame (hips carry no rotation): hip pivot + thigh + shank.
function ankleR(b) { const qh = q4(b, 'upperLegR'), qk = qmulA(qh, q4(b, 'lowerLegR'))
  const th = qrot(qh, 0, [0, -RIG_DIMS.upperLeg, 0]), sh = qrot(qk, 0, [0, -RIG_DIMS.lowerLeg, 0])
  return [-RIG_DIMS.hipX + th[0] + sh[0], b.hipsY - RIG_DIMS.hipDrop + th[1] + sh[1], th[2] + sh[2]] }
const maxAngle = (a, b) => { let m = 0; for (let o = 0; o < a.length; o += 4) {
  const c = Math.min(1, Math.abs(a[o] * b[o] + a[o + 1] * b[o + 1] + a[o + 2] * b[o + 2] + a[o + 3] * b[o + 3])); m = Math.max(m, 2 * Math.acos(c)) } return m }
const unitErr = (q) => { let m = 0; for (let o = 0; o < q.length; o += 4) m = Math.max(m, Math.abs(Math.hypot(q[o], q[o + 1], q[o + 2], q[o + 3]) - 1)); return m }

// ---- 14. purity + PoseBuffer layout
{ const s = readFileSync(path.join(game, 'src/play/character/ProceduralAnimator.ts'), 'utf8')
  ok(/import type \* as THREE from 'three'/.test(s) && !/from\s+'three'/.test(s.replace(/import type \* as THREE from 'three'/, '')) && !/core\//.test(s),
    'ProceduralAnimator: THREE is type-only, no core import')
  const b = PA.createPoseBuffer()
  ok(b.q.length === 17 * 4 && b.q instanceof Float32Array && b.hipsY === RIG_DIMS.hipsY && unitErr(b.q) === 0, 'PoseBuffer = JOINTS·4 f32 identity + rest hipsY') }

// ---- 15. §8.3 β table + §8.7 foot slide: stance ankle < 1 cm at v ∈ {1,2,4,8}
{ const want = { 1: 0.28, 2: 0.24, 4: 0.25, 8: 0.25 }, leg = createLegPose(), b = PA.createPoseBuffer()
  for (const v of [1, 2, 4, 8]) {
    const beta = PA.gaitBeta(v), f = PA.gaitFreq(v), h = 1 / 6000
    ok(Math.abs(beta - want[v]) < 0.006, `β(${v}) ${beta.toFixed(3)} ≠ ${want[v]}`)
    // Walk one stance of the R leg (ps = p ∈ [0, β)); body travels −Z at v.
    let zMin = 1e9, zMax = -1e9, xMin = 1e9, xMax = -1e9
    for (let t = 0; t * f < beta; t += h) {
      PA.gaitPose(b, v, t * f, 0, 0, leg)
      const a = ankleR(b), zw = -v * t + a[2]
      zMin = Math.min(zMin, zw); zMax = Math.max(zMax, zw); xMin = Math.min(xMin, a[0]); xMax = Math.max(xMax, a[0]) }
    const slide = Math.hypot(zMax - zMin, xMax - xMin)
    ok(slide < 0.01, `foot slide at v=${v}: ${(slide * 100).toFixed(3)} cm ≥ 1 cm`)
    if (v === 1) console.log(`  foot slide (cm) v=1 ${(slide * 100).toFixed(4)}`) } }

// ---- 16. Walk ↔ Run phase continuity, no pops, unit quats.
// WHY: sampled at 600 Hz — a pop is a step that does not shrink with dt, while
// real sprint joint speeds (≤ ~16 rad/s) give < 1.6° per 1/600 s step.
{ const an = new PA.ProceduralAnimator(), t = tel(), H = 1 / 600; t.inputMag = 1; t.dt = H
  let phaseErr = 0, worst = 0, unit = 0, sawRun = false, sawWalkBack = false, prevQ = new Float32Array(an.out.q)
  const fr = (v) => { const p0 = an.phase; t.speed = v; an.update(t, H)
    let d = an.phase - p0; if (d < 0) d += 1
    phaseErr = Math.max(phaseErr, Math.abs(d - H * PA.gaitFreq(v)))
    unit = Math.max(unit, unitErr(an.out.q))
    if (an.sm.state === S.Run) sawRun = true
    if (sawRun && an.sm.state === S.Walk) sawWalkBack = true
    if (an.sm.state === S.Walk || an.sm.state === S.Run) worst = Math.max(worst, maxAngle(prevQ, an.out.q))
    prevQ.set(an.out.q) }
  for (let i = 0; i < 300; i++) fr(0)
  for (let i = 1; i <= 2400; i++) fr(Math.min(6.5, 1 + 5.5 * i / 2400))   // Walk → Run
  for (let i = 0; i < 600; i++) fr(6.5)
  for (let i = 1; i <= 2400; i++) fr(6.5 - 5.5 * i / 2400)                // Run → Walk
  ok(sawRun && sawWalkBack, `Walk → Run → Walk not reached (run ${sawRun}, walk-back ${sawWalkBack})`)
  ok(phaseErr < 1e-9, `gait phase advanced off dt·f(v) by ${phaseErr.toExponential(2)} (reset?)`)
  ok(worst * DEG < 3, `largest Walk/Run joint step ${(worst * DEG).toFixed(2)}° per 1/600 s (pop)`)
  ok(unit < 1e-6, `out quaternion unit error ${unit.toExponential(2)}`)
  const jq = an.rig.joints.upperLegR.quaternion, o = PA.JOINT_INDEX.upperLegR * 4
  ok(Math.abs(jq.x - an.out.q[o]) + Math.abs(jq.w - an.out.q[o + 3]) < 1e-7 && an.rig.joints.hips.position.y === an.out.hipsY,
    'write-out copies the out buffer into the rig joints')
  console.log(`  walk/run: max joint step ${(worst * DEG).toFixed(2)}° per 1/600 s, phase err ${phaseErr.toExponential(1)}`) }

// ---- 17. Idle pose, crouch weight, soft dip, other states fall back to Idle
{ const an = new PA.ProceduralAnimator(), t = tel()
  for (let i = 0; i < 60; i++) an.update(t, DT)
  ok(an.stateName === 'Idle' && Math.abs(an.out.hipsY - (0.92 - 0.02)) < 1e-6, `Idle hipsY ${an.out.hipsY}`)
  const abd = an.rig.joints.upperArmR.quaternion
  ok(Math.abs(2 * Math.asin(abd.z) - 0.06) < 1e-6 && Math.abs(an.rig.joints.upperArmL.quaternion.z + abd.z) < 1e-9, 'Idle suit-bulk arm abduction R +Z / L −Z 0.06')
  t.crouch = true; for (let i = 0; i < 30; i++) an.update(t, DT)
  ok(an.sm.crouchW === 1 && Math.abs(an.out.hipsY - (0.92 - 0.14)) < 1e-6, `crouch hipsY ${an.out.hipsY.toFixed(4)} (want 0.78)`)
  t.crouch = false; for (let i = 0; i < 30; i++) an.update(t, DT)
  t.landed = true; t.landingSpeed = 0.5; an.update(t, DT); t.landed = false
  ok(an.sm.state === S.Idle && an.out.hipsY < 0.90 - 0.02, `soft dip lowers hips (hipsY ${an.out.hipsY.toFixed(4)})`)
  for (let i = 0; i < 12; i++) an.update(t, DT)
  ok(Math.abs(an.out.hipsY - 0.90) < 1e-6, 'soft dip decays in 0.10 s')
}

// ---- 17b. B9b: every §8.2 state has its own pose (≠ rest, ≠ Idle), unit quats
{ const an = new PA.ProceduralAnimator(), rest = PA.createPoseBuffer(), idle = PA.createPoseBuffer(), b = PA.createPoseBuffer()
  an.time = 0.7; an.airTime = 1.0; an.landD = PA.landDepth(4.2); an.phase = 0.1
  an.evalState(idle, S.Idle, 0, 0)
  const cases = [[S.Idle, 0, 0], [S.Walk, 2, 0], [S.Run, 6, 0], [S.JumpLaunch, 0, 0.2], [S.JumpRise, 0, 0],
    [S.Fall, 0, 0], [S.Land, 0, 0.3], [S.Slide, 0, 0]]
  for (const [st, v, u] of cases) { an.evalState(b, st, v, u)
    ok(maxAngle(b.q, rest.q) * DEG > 2, `${N[st]} pose ≈ rest (${(maxAngle(b.q, rest.q) * DEG).toFixed(2)}°)`)
    if (st !== S.Idle) ok(maxAngle(b.q, idle.q) * DEG > 2, `${N[st]} pose ≈ Idle`)
    ok(unitErr(b.q) < 1e-6, `${N[st]} pose unit error`) }
  // §8.4 JumpLaunch: dip held for 40 %, then extension; C⁰ across the seam.
  const ang = (bb, j) => 2 * Math.atan2(q4(bb, j)[0], q4(bb, j)[3])
  PA.launchPose(b, 0.2, createLegPose())
  ok(Math.abs(b.hipsY - 0.82) < 1e-9 && Math.abs(ang(b, 'upperArmR') + 0.5) < 1e-6 && Math.abs(ang(b, 'chest') + 0.20) < 1e-6,
    `launch dip hipsY ${b.hipsY.toFixed(4)} arm ${ang(b, 'upperArmR').toFixed(3)}`)
  PA.launchPose(b, 1, createLegPose())
  ok(Math.abs(b.hipsY - 0.92) < 1e-9 && Math.abs(ang(b, 'footR') + 0.35) < 1e-6 && Math.abs(ang(b, 'upperArmR') - 1.2) < 1e-6
    && Math.abs(ang(b, 'upperLegR')) < 1e-9, 'launch extension: legs rest, ankles −0.35, arms +1.2')
  { const a = PA.createPoseBuffer(), c = PA.createPoseBuffer(); let w = 0; PA.launchPose(a, 0, createLegPose())
    for (let i = 1; i <= 1200; i++) { PA.launchPose(c, i / 1200, createLegPose()); w = Math.max(w, maxAngle(a.q, c.q)); a.q.set(c.q) }
    ok(w * DEG < 1, `launch pose step ${(w * DEG).toFixed(3)}° per u/1200 (seam pop)`) }
  // §8.4 JumpRise: R leads by 0.15 rad.
  PA.risePose(b)
  ok(Math.abs(ang(b, 'upperLegR') - ang(b, 'upperLegL') - 0.15) < 1e-6 && Math.abs(ang(b, 'lowerLegR') + 1.0) < 1e-6, 'rise tuck: R leads 0.15, knee −1.0')
  // §8.4 Fall weight: 0 at airTime 0.15, full at 0.65.
  PA.fallPose(b, 0.15, 0.3); ok(maxAngle(b.q, rest.q) < 1e-9, 'fall weight 0 at airTime 0.15')
  PA.fallPose(b, 0.65, 0); ok(Math.abs(2 * Math.asin(q4(b, 'upperArmR')[2]) - 1.1) < 1e-6 && Math.abs(q4(b, 'upperArmL')[2] + q4(b, 'upperArmR')[2]) < 1e-9, 'fall arms out R +Z / L −Z 1.1')
  // §8.4 Land: D from landing speed, peak at 30 %, recovered at 100 %, continuous.
  ok(Math.abs(PA.landDepth(4.2) - 0.168) < 1e-9 && PA.landDepth(0) === 0.03 && PA.landDepth(20) === 0.30, 'landDepth clamp(0.04·v, 0.03, 0.30)')
  ok(Math.abs(PA.landDrop(0.3, 0.17) - 0.17) < 1e-12 && PA.landDrop(0, 0.17) === 0 && Math.abs(PA.landDrop(1, 0.17)) < 1e-12, 'land drop 0 → D at 30 % → 0')
  { let w = 0; for (let i = 1; i <= 1000; i++) w = Math.max(w, Math.abs(PA.landDrop(i / 1000, 0.3) - PA.landDrop((i - 1) / 1000, 0.3)))
    ok(w < 0.003, `land drop step ${w.toFixed(5)} m per u/1000`) }
  PA.landPose(b, 0.3, 0.17, 0, 0, createLegPose(), 0, 0)
  ok(Math.abs(b.hipsY - (0.92 - 0.17)) < 1e-9 && Math.abs(ang(b, 'chest') + 0.6 * 0.17 / 0.30) < 1e-6, `land peak hipsY ${b.hipsY.toFixed(4)}`)
  // §8.5 Slide: legDrop(0.15), R +0.35 / L −0.20 about the drop hip, phase frozen.
  const leg = legDrop(0.15, createLegPose()); PA.slidePose(b, 0, 0, createLegPose(), 0, 0)
  ok(Math.abs(ang(b, 'upperLegR') - (leg.hip + 0.35)) < 1e-6 && Math.abs(ang(b, 'upperLegL') - (leg.hip - 0.20)) < 1e-6
    && Math.abs(b.hipsY - (0.92 - 0.15)) < 1e-9 && Math.abs(ang(b, 'chest') - 0.10) < 1e-6, 'slide pose')
  { const a2 = new PA.ProceduralAnimator(), t = tel(); t.sliding = true; for (let i = 0; i < 30; i++) a2.update(t, DT)
    const p0 = a2.phase; t.speed = 4; for (let i = 0; i < 30; i++) a2.update(t, DT)
    ok(a2.sm.state === S.Slide && a2.phase === p0, `stride phase frozen in Slide (${a2.stateName})`) } }

// ---- 17c. §8.6 slope ankle terms: stance-weighted, clamped ±20°, roll not mirrored
{ const lg = createLegPose(), a = PA.createPoseBuffer(), c = PA.createPoseBuffer()
  PA.idlePose(a, 0, 0, 0, lg, 0, 0); PA.idlePose(c, 0, 0, 0, lg, 0.1, 0)
  ok(Math.abs(2 * Math.atan2(q4(c, 'footR')[0], q4(c, 'footR')[3]) - 2 * Math.atan2(q4(a, 'footR')[0], q4(a, 'footR')[3]) - 0.1) < 1e-6, 'idle stance ankle pitch +sp')
  PA.idlePose(c, 0, 0, 0, lg, 0, 0.1)
  ok(Math.abs(q4(c, 'footR')[2] - q4(c, 'footL')[2]) < 1e-12 && q4(c, 'footR')[2] > 0, 'slope roll same sign both feet (not mirrored)')
  const v = 4, beta = PA.gaitBeta(v), pStance = 0.3 * beta, pSwing = beta + 0.5 * (1 - beta)
  // WHY: f32 quaternions → 2·acos(c) near c = 1 has a ~7e-4 rad noise floor.
  const footD = (p) => { PA.gaitPose(a, v, p, 0, 0, lg, 0, 0); PA.gaitPose(c, v, p, 0, 0, lg, 0.2, 0)
    const o = PA.JOINT_INDEX.footR * 4; return maxAngle(a.q.subarray(o, o + 4), c.q.subarray(o, o + 4)) }
  ok(Math.abs(footD(pStance) - 0.2) < 1e-5, `gait stance ankle gets full slope pitch (${footD(pStance).toFixed(4)})`)
  ok(footD(pSwing) < 2e-3, `gait mid-swing ankle slope weight 0 (${footD(pSwing).toExponential(1)})`)
  const an = new PA.ProceduralAnimator(), t = tel(); t.slopeFwdDeg = 30; t.slopeSideDeg = -35; an.update(t, DT)
  ok(Math.abs(an.slopeP - 20 / DEG) < 1e-12 && Math.abs(an.slopeR - 20 / DEG) < 1e-12, 'slope terms clamped ±20°, roll = −slopeSide') }

// ---- 17d. §8.7 interrupt: JumpLaunch fired at blend 0.5 of a Walk → Run blend
// WHY (B9b): the < 5° bound applies to the transition frame — the frozen snap
// is what blend 0 shows; the following frames are the 0.05 s blend-in (§8.2).
// Walk and Run share gaitPose, so an Idle → Walk run also proves the row
// discriminates (without the snap the frame would jump > 5°).
function interruptRun(from, to, vFrom, vTo) {
  const an = new PA.ProceduralAnimator(), t = tel(); t.inputMag = 1; t.speed = vFrom
  for (let i = 0; i < 120; i++) an.update(t, DT)
  const s0 = an.sm.state; t.speed = vTo
  let guard = 0; do { an.update(t, DT); guard++ } while (!(an.sm.state === to && an.sm.blend >= 0.45) && guard < 200)
  const blendAt = an.sm.blend, before = new Float32Array(an.out.q)
  // naive (no snap): what blend 0 would show if prev were the old state's pose
  const naive = PA.createPoseBuffer(); an.evalState(naive, an.sm.state, t.speed, 1)
  t.jumped = true; t.grounded = false; t.vertSpeed = 4.2; an.update(t, DT); t.jumped = false
  const step = maxAngle(before, an.out.q), naiveStep = maxAngle(before, naive.q)
  const interrupted = an.sm.prev === to && an.prevIsSnap
  let follow = 0; let q = new Float32Array(an.out.q)
  for (let i = 0; i < 12; i++) { t.airTime += DT; an.update(t, DT); follow = Math.max(follow, maxAngle(q, an.out.q)); q.set(an.out.q) }
  return { s0, interrupted, blendAt, step, naiveStep, follow, unit: unitErr(an.out.q) }
}
{ const r = interruptRun(S.Walk, S.Run, 4, 6)
  ok(r.s0 === S.Walk && r.interrupted && r.blendAt >= 0.45 && r.blendAt < 0.8, `Walk→Run interrupt setup (s0 ${N[r.s0]}, blend ${r.blendAt.toFixed(2)}, snap ${r.interrupted})`)
  ok(r.step * DEG < 5, `Walk→Run interrupt frame joint change ${(r.step * DEG).toFixed(2)}° ≥ 5°`)
  ok(r.unit < 1e-6, 'unit quaternions after interrupt')
  const i2 = interruptRun(S.Idle, S.Walk, 0, 2)
  ok(i2.s0 === S.Idle && i2.interrupted && i2.step * DEG < 5, `Idle→Walk interrupt frame ${(i2.step * DEG).toFixed(2)}° (snap ${i2.interrupted})`)
  ok(i2.naiveStep * DEG > 5, `row not discriminating: no-snap step ${(i2.naiveStep * DEG).toFixed(2)}°`)
  console.log(`  interrupt: Walk→Run ${(r.step * DEG).toFixed(3)}°, Idle→Walk ${(i2.step * DEG).toFixed(3)}° (no-snap ${(i2.naiveStep * DEG).toFixed(1)}°); blend-in max ${(Math.max(r.follow, i2.follow) * DEG).toFixed(1)}°/frame`) }

// ---- 18. zero-GC: 10,000 ProceduralAnimator.update calls across every state
{ const an = new PA.ProceduralAnimator(), t = tel()
  const drive = (i) => { const k = i % 600
    t.jumped = k === 300; t.landed = k === 500; t.landingSpeed = 3
    t.grounded = k < 300 || k >= 500; t.airTime = t.grounded ? 0 : (k - 300) * DT
    t.vertSpeed = t.grounded ? 0 : 4.2 - G * (k - 300) * DT
    t.speed = k < 300 ? (k / 300) * 7 : 1; t.inputMag = 1; t.sliding = k > 560; t.crouch = k > 540 && k < 560
    an.update(t, DT) }
  for (let i = 0; i < 20000; i++) drive(i)
  if (globalThis.gc) { globalThis.gc(); const h0 = process.memoryUsage().heapUsed
    for (let i = 0; i < 10000; i++) drive(i)
    globalThis.gc(); const dh = process.memoryUsage().heapUsed - h0
    ok(dh < 64 * 1024, `ProceduralAnimator.update heap +${dh} B over 10,000 calls`)
    console.log(`  animator heap delta ${dh} B / 10k updates`)
  } else ok(false, 'run with node --expose-gc')
  ok(unitErr(an.out.q) < 1e-6, 'unit quaternions after the heap drive') }

if (fails.length) { console.log(`test-play-anim FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-anim PASS ${n}/${n}`)