// T1 B7a Node check (plan §12.2 B7a, §9.6): drives the REAL AstronautKCC with
// the PlayerController on a flat sphere of the moon's radius (synthetic patch,
// §9.6 "flat or synthetic") and checks Mapping, Facing, Buffer, Frame-rate
// independence, telemetry derivations and zero-GC stepping.
// Run: `node --expose-gc tools/test-play-controller.mjs`. Exit 1 on failure.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-play-controller.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/controller/PlayerController'; export * from './play/character/CharacterTelemetry';
      export * as cfg from './play/world/moonConfig'; export { AstronautKCC } from './core/physics/astronautKCC';
      export { initTerrainField, terrainHeight } from './core/terrain/terrainField';
      export { signedAngleAbout, rotateAboutAxisInto } from './core/physics/sphericalFrame';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, jsx: 'automatic',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)
const T = M.cfg.PLAY_TUNING

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }

// WHY: zero-amplitude field = a perfect sphere of radius MOON_R, so mapping /
// facing / timing checks are not confounded by terrain slope.
M.initTerrainField({ ...M.cfg.MOON_PARAMS, continentAmp: 0, mountainAmp: 0, detailAmp: 0 })
ok(Math.abs(M.terrainHeight(0.3, -0.04, 0.95)) < 1e-9, `flat field height ${M.terrainHeight(0.3, -0.04, 0.95)}`)
const SP = { x: 0.32058829107484366, y: -0.03682548816622783, z: 0.9465025256421825 } // B2 spawn pin

const inpStub = () => ({ moveX: 0, moveY: 0, sprint: false, crouch: false, jumpPressed: false, lookDX: 0 })
function rig() {
  const kcc = new M.AstronautKCC(M.cfg.MOON_ASTRONAUT)
  kcc.teleportSurface(SP.x, SP.y, SP.z)
  const ctrl = new M.PlayerController(kcc)
  const cam = { heading: { x: kcc.fwd.x, y: kcc.fwd.y, z: kcc.fwd.z } }
  return { kcc, ctrl, cam, inp: inpStub(), tel: M.createTelemetry() }
}
const scratch = { x: 0, y: 0, z: 0 }
function reproject(h, u) { // what ThirdPersonCamera does each frame (§9.4 parallel transport)
  const d = h.x * u.x + h.y * u.y + h.z * u.z
  h.x -= u.x * d; h.y -= u.y * d; h.z -= u.z * d
  const l = Math.hypot(h.x, h.y, h.z); h.x /= l; h.y /= l; h.z /= l
}
function frame(r, dt) {
  reproject(r.cam.heading, r.kcc.up)
  r.ctrl.beginFrame()
  const ticks = r.ctrl.simulate(r.inp, r.cam, dt)
  M.sampleTelemetry(r.kcc, r.ctrl, r.inp, dt, r.tel)
  return ticks
}
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
const angBetween = (a, b, u) => M.signedAngleAbout(a.x, a.y, a.z, b.x, b.y, b.z, u.x, u.y, u.z)

// ---- Mapping (§9.6) -----------------------------------------------------
{
  const r = rig(); const { kcc, ctrl, cam, inp } = r
  inp.moveY = 1; ctrl.step(inp, cam, 1 / 60)
  ok(Math.abs(kcc.input.moveF - 1) < 1e-12 && Math.abs(kcc.input.moveR) < 1e-12, `W: moveF ${kcc.input.moveF} moveR ${kcc.input.moveR}`)
  inp.moveY = 0; inp.moveX = 1; ctrl.step(inp, cam, 1 / 60)
  ok(Math.abs(kcc.input.moveR - 1) < 1e-12 && Math.abs(kcc.input.moveF) < 1e-12, `D: moveF ${kcc.input.moveF} moveR ${kcc.input.moveR}`)
  inp.moveY = 1; ctrl.step(inp, cam, 1 / 60)
  ok(Math.abs(Math.hypot(kcc.input.moveF, kcc.input.moveR) - 1) < 1e-12, `diagonal |d| ${Math.hypot(kcc.input.moveF, kcc.input.moveR)}`)
  ok(!kcc.input.sprint, 'sprint without held key')
  // D strafes toward fwd × up (the KCC's own right): walk D for 1 s, no auto-turn bias check on displacement
  const r2 = rig(); r2.inp.moveX = 1
  const p0 = { ...r2.kcc.pLocal }; const f0 = { ...r2.kcc.fwd }, u0 = { ...r2.kcc.up }
  const right0 = { x: f0.y * u0.z - f0.z * u0.y, y: f0.z * u0.x - f0.x * u0.z, z: f0.x * u0.y - f0.y * u0.x }
  for (let i = 0; i < 30; i++) frame(r2, 1 / 60)
  const dp = { x: r2.kcc.pLocal.x - p0.x, y: r2.kcc.pLocal.y - p0.y, z: r2.kcc.pLocal.z - p0.z }
  const dl = Math.hypot(dp.x, dp.y, dp.z)
  ok(dl > 0.3 && dot(dp, right0) / dl > 0.99, `D displacement ·right ${dot(dp, right0) / dl} (|dp| ${dl})`)
  // heading 90° from fwd: W moves along heading once vCtl settled
  const r3 = rig(); const h = r3.cam.heading
  M.rotateAboutAxisInto(h.x, h.y, h.z, r3.kcc.up.x, r3.kcc.up.y, r3.kcc.up.z, Math.PI / 2, scratch)
  h.x = scratch.x; h.y = scratch.y; h.z = scratch.z
  r3.inp.moveY = 1
  for (let i = 0; i < 180; i++) frame(r3, 1 / 60)
  const v = r3.kcc.absVel, vl = Math.hypot(v.x, v.y, v.z)
  const vt = { x: v.x / vl, y: v.y / vl, z: v.z / vl }
  const err = Math.abs(angBetween(vt, r3.cam.heading, r3.kcc.up))
  ok(err < 1e-6, `W @ heading+90°: velocity off heading by ${err} rad`)
  ok(Math.abs(vl - 3.2) < 0.01, `walk speed ${vl}`)
  r3.inp.sprint = true
  for (let i = 0; i < 120; i++) frame(r3, 1 / 60)
  ok(Math.abs(r3.tel.speed - 6.5) < 0.02 && r3.tel.sprint, `sprint speed ${r3.tel.speed}`)
  console.log(`mapping: D·right ${(dot(dp, right0) / dl).toFixed(6)}, heading err ${err.toExponential(2)} rad, walk ${vl.toFixed(3)}, sprint ${r3.tel.speed.toFixed(3)} m/s`)
}

// ---- Facing (§9.6): W with heading reversed → fwd within 2° in ≤ 0.8 s, no overshoot
{
  const r = rig(); const h = r.cam.heading
  h.x = -r.kcc.fwd.x; h.y = -r.kcc.fwd.y; h.z = -r.kcc.fwd.z
  r.inp.moveY = 1
  let tHit = -1, sign0 = 0, overshoot = false
  for (let i = 1; i <= 120; i++) {
    frame(r, 1 / 60)
    const a = angBetween(r.kcc.fwd, h, r.kcc.up)
    if (i === 3) sign0 = Math.sign(a)
    if (i > 3 && Math.sign(a) !== sign0 && Math.abs(a) > 0.5 * Math.PI / 180) overshoot = true
    if (tHit < 0 && Math.abs(a) < 2 * Math.PI / 180) tHit = i / 60
  }
  ok(tHit > 0 && tHit <= 0.8, `facing: within 2° at ${tHit} s`)
  ok(!overshoot, 'facing overshoot')
  console.log(`facing: 180° reversal within 2° at ${tHit.toFixed(3)} s, overshoot ${overshoot}`)
}

// ---- Buffer (§9.6): press d s before touchdown → relaunch within 1 tick of landing
// WHY: a lunar jump (u 4.2, g 1.62) flies 2u/g = 5.19 s, so windows are 600 frames.
function firstFlight() {
  const r = rig(); r.inp.jumpPressed = true
  for (let f = 0; f < 600; f++) { frame(r, 1 / 60); if (r.tel.landed) return f }
  return -1
}
function pressRun(landF, d) {
  const r = rig(); r.inp.jumpPressed = true
  let landTick = -1, relaunchTick = -1
  for (let f = 0; f < 700; f++) {
    if (f === landF - Math.round(d * 60)) r.inp.jumpPressed = true
    frame(r, 1 / 60)
    if (r.tel.landed && landTick < 0) landTick = r.kcc.integrity.ticks
    if (landTick >= 0 && r.tel.jumped) { relaunchTick = r.kcc.integrity.ticks; break }
    if (landTick >= 0 && r.kcc.integrity.ticks - landTick > 60) break
  }
  return { landTick, relaunchTick }
}
{
  const landF = firstFlight()
  ok(landF > 290 && landF < 330, `first flight landed at frame ${landF}`)
  const a = pressRun(landF, 0.10), b = pressRun(landF, 0.20)
  ok(a.landTick > 0 && a.relaunchTick > 0 && a.relaunchTick - a.landTick <= 1, `buffer 0.10 s: land ${a.landTick} relaunch ${a.relaunchTick}`)
  ok(b.landTick > 0 && b.relaunchTick < 0, `buffer 0.20 s relaunched at ${b.relaunchTick} (land ${b.landTick})`)
  console.log(`buffer: flight lands frame ${landF} (2u/g = ${(2 * 4.2 / 1.62).toFixed(3)} s); 0.10 s → relaunch +${a.relaunchTick - a.landTick} tick; 0.20 s → no relaunch`)
}

// ---- Telemetry derivations ---------------------------------------------------
{
  const r = rig(); r.inp.jumpPressed = true
  let vs0 = null, landedFrames = 0, jumpedFrames = 0, maxAir = 0, apexSign = false
  for (let f = 0; f < 400; f++) {
    frame(r, 1 / 60)
    if (r.tel.jumped) jumpedFrames++
    if (!r.tel.grounded && vs0 === null) vs0 = r.tel.vertSpeed
    if (!r.tel.grounded) {
      const pred = vs0 - 1.62 * (r.tel.airTime - 1 / 60)
      if (Math.abs(r.tel.vertSpeed - pred) > 0.05) apexSign = true
      maxAir = Math.max(maxAir, r.tel.airTime)
    }
    if (r.tel.landed) landedFrames++
  }
  ok(vs0 > 3.9 && vs0 <= 4.21, `launch vertSpeed ${vs0}`)
  ok(!apexSign, 'vertSpeed ≠ v0 − g·t during flight (> 5 cm/s)')
  ok(jumpedFrames === 1 && landedFrames === 1, `jumped ${jumpedFrames} landed ${landedFrames} frames`)
  ok(r.tel.grounded && r.tel.vertSpeed === 0 && r.tel.airTime === 0, 'grounded resets vertSpeed/airTime')
  ok(Math.abs(r.tel.landingSpeed - 4.2) < 0.15, `landingSpeed ${r.tel.landingSpeed}`)
  ok(r.ctrl.recoverT === 0, 'soft landing must not trigger recovery')
  ok(Math.abs(r.tel.slopeFwdDeg) < 1e-6 && Math.abs(r.tel.slopeSideDeg) < 1e-6, `flat slopes ${r.tel.slopeFwdDeg}/${r.tel.slopeSideDeg}`)
  // derivations on a stub KCC (sliding, airborne slope zeroing, sprint gating)
  const kS = { grounded: true, telemetry: { relSpeed: 2, slopeDeg: 47, slideSpeed: 0.3 },
    input: { sprint: true }, integrity: { lastLandingRelSpeed: 0 },
    pLocal: { x: 1, y: 0, z: 0 }, up: { x: 1, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: -1 } }
  const cS = { spinOmega: 0, inputMag: 1, jumpedThisFrame: false, landedThisFrame: false }
  const tS = M.createTelemetry()
  M.sampleTelemetry(kS, cS, { crouch: false }, 1 / 60, tS)
  ok(tS.sliding && tS.slopeDeg === 47 && tS.sprint && tS.speed === 2, `stub grounded ${JSON.stringify(tS)}`)
  kS.telemetry.slideSpeed = 0.2; M.sampleTelemetry(kS, cS, { crouch: true }, 1 / 60, tS)
  ok(!tS.sliding && !tS.sprint && tS.crouch, 'stub slide threshold / crouch gates sprint')
  // hard landing → recovery window, scaled input
  const c2 = new M.PlayerController({ grounded: false, integrity: { landings: 0, lastLandingRelSpeed: 0 } })
  c2.kcc.integrity.landings = 1; c2.kcc.integrity.lastLandingRelSpeed = 8
  c2.postSimulate()
  ok(c2.landedThisFrame && M.landDuration(8) === 0.40 && c2.recoverT === 0.40,
    `hard landing recoverT ${c2.recoverT}`)
  console.log(`telemetry: launch vertSpeed ${vs0.toFixed(4)}, air ${maxAir.toFixed(3)} s, landing ${r.tel.landingSpeed.toFixed(3)} m/s, 1 jumped + 1 landed frame`)
}
{ // hard-landing input scale with a real KCC
  const r = rig(); r.inp.moveY = 1; r.ctrl.recoverT = 0.2
  r.ctrl.step(r.inp, r.cam, 1 / 60)
  ok(Math.abs(r.kcc.input.moveF - T.landRecoverScale) < 1e-12, `recover scale moveF ${r.kcc.input.moveF}`)
}

// ---- Frame-rate independence (§9.6): same script at 30/60/144 Hz -------------------
// WHY (B7a decision): 8 s, not the plan's 5 s — a lunar jump flies 5.19 s, so a
// 5 s script cannot contain the landing; 8 s covers walk/strafe/sprint/jump/land.
function script(hz) {
  const r = rig(); const dt = 1 / hz; let ticks = 0
  const N = Math.round(8 * hz)
  for (let f = 0; f < N; f++) {
    const t = f / hz // WHY: segment edges at multiples of 1/6 s align frames at all three rates
    r.inp.moveY = t < 4 ? 1 : 0
    r.inp.moveX = t >= 1 && t < 2 ? 1 : 0
    r.inp.sprint = t >= 2 && t < 3
    if (Math.abs(t - 1.5) < 1e-9) r.inp.jumpPressed = true
    ticks += frame(r, dt)
  }
  return { p: { ...r.kcc.pLocal }, ticks, landings: r.kcc.integrity.landings }
}
{
  const a = script(30), b = script(60), c = script(144)
  const d = (x, y) => Math.hypot(x.p.x - y.p.x, x.p.y - y.p.y, x.p.z - y.p.z)
  const dab = d(a, b), dcb = d(c, b)
  ok(dab < 0.01 && dcb < 0.01, `frame-rate end positions differ: 30↔60 ${dab} m, 144↔60 ${dcb} m`)
  ok(a.ticks === b.ticks && c.ticks === b.ticks, `ticks 30:${a.ticks} 60:${b.ticks} 144:${c.ticks}`)
  ok(b.landings === 1 && a.landings === 1 && c.landings === 1, `landings ${a.landings}/${b.landings}/${c.landings}`)
  console.log(`frame-rate: ticks ${a.ticks}/${b.ticks}/${c.ticks}, Δ30 ${(dab * 1000).toFixed(3)} mm, Δ144 ${(dcb * 1000).toFixed(3)} mm`)
}

// ---- Zero-GC: 10k frames of step + update + postSimulate + sampleTelemetry ----------
{
  const r = rig(); r.inp.moveY = 1
  const run = (k) => { for (let i = 0; i < k; i++) { r.inp.moveX = (i >> 6) & 1; r.inp.jumpPressed = (i % 400) === 0; frame(r, 1 / 60) } }
  run(2000)
  if (globalThis.gc) gc()
  const h0 = process.memoryUsage().heapUsed
  run(10000)
  if (globalThis.gc) gc()
  const dh = process.memoryUsage().heapUsed - h0
  ok(!globalThis.gc || dh < 64 * 1024, `heap grew ${dh} B over 10k frames`)
  console.log(`zero-gc: heap Δ ${dh} B over 10,000 frames${globalThis.gc ? '' : ' (no --expose-gc: not asserted)'}`)
}

if (fails.length) { console.error(`test-play-controller FAIL ${n - fails.length}/${n}`); for (const f of fails) console.error('  - ' + f); process.exit(1) }
console.log(`test-play-controller PASS ${n}/${n}`)