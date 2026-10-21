// T1 B8 Node check (plan §12.2 B8, §8.7): the animation state machine in
// isolation — scripted telemetry sequences, hysteresis, dwell/coyote/slide/
// soft-landing/interrupt rules, the §8.1 legDrop solver table to 0.1°,
// quaternion integrity and zero-GC stepping. B9 extends it (foot slide,
// per-frame interrupt angle). Run: `node --expose-gc tools/test-play-anim.mjs`.
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
    contents: `export * from './play/character/animStateMachine'; export { RIG_DIMS } from './play/character/AstronautRig';`,
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

if (fails.length) { console.log(`test-play-anim FAIL ${n - fails.length}/${n}`); for (const f of fails) console.log('  ✗ ' + f); process.exit(1) }
console.log(`test-play-anim PASS ${n}/${n}`)