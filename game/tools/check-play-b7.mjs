// B7c browser check (plan §12.2 B7 → B7c, FIRST PLAYABLE). Usage:
//   node tools/check-play-b7.mjs http://localhost:4173
// Loads /?page=play&probe=1, clicks into PLAYING, then scripts real key input:
// W held must move the character at ≈ walk speed per SIMULATED second, Space
// must leave the ground, P must freeze the KCC (absPos and sim time identical
// across 1.5 s PAUSED). State is read through the opt-in ?probe=1
// window.__playProbe. Exit 0 iff all hold and there are no non-favicon errors.
// WHY: 640×360 + short PLAYING windows — under SwiftShader the headless
// renderer's RSS grows ~100–200 MB/s while PLAYING (pre-existing, reproduced
// at B7b HEAD; JS heap flat) and a 1280×720 run OOMs the 4 GB VM. Speed is
// judged per sim second (core.stats.simTime): SwiftShader runs a few FPS and
// each frame is capped at 5 ticks, so wall time ≠ sim time — a few-second W hold
// covers only ~0.1–0.7 sim s, mostly the from-rest acceleration. So this check
// asserts movement and no overspeed (≤ 3.6 m/s per sim s); the walk-speed
// number itself is test-play-frame's Node row (W 2 s → 4–8 m, real KCC).
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 640, height: 360 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`${base}/?page=play&probe=1`)
await page.waitForSelector('[data-phase="CLICK_TO_PLAY"]', { timeout: 60000 })
await page.mouse.click(320, 180)
await page.waitForTimeout(1500)
const probe = () => page.evaluate(() => { const P = window.__playProbe, k = P.kcc
  return { x: k.absPos.x, y: k.absPos.y, z: k.absPos.z, g: k.grounded, t: P.core.stats.simTime,
    phase: document.querySelector('[data-phase]')?.getAttribute('data-phase') } })
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const p0 = await probe()
await page.keyboard.down('KeyW'); await page.waitForTimeout(2500)
const p1 = await probe(); await page.keyboard.up('KeyW')
await page.keyboard.press('Space')
let air = false
for (let i = 0; i < 20 && !air; i++) { await page.waitForTimeout(100); if (!(await probe()).g) air = true }
await page.keyboard.press('KeyP'); await page.waitForTimeout(500)
const q0 = await probe(); await page.waitForTimeout(1500); const q1 = await probe()
await browser.close()
const walked = dist(p0, p1), simS = p1.t - p0.t, mps = simS > 0 ? walked / simS : 0, frozen = dist(q0, q1)
console.log(`[B7] phase ${p0.phase} → ${q1.phase}; W: ${walked.toFixed(3)} m over ${simS.toFixed(2)} sim s = ${mps.toFixed(2)} m/s (from rest; ≤ 3.6); airborne ${air}; paused drift ${frozen} m (sim ${q0.t}→${q1.t}); errors ${errs.length}`)
for (const e of errs) console.log('  ' + e)
const pass = p0.phase === 'PLAYING' && walked > 0.01 && simS > 0 && mps < 3.6 && air
  && q1.phase === 'PAUSED' && frozen === 0 && q0.t === q1.t && errs.length === 0
console.log(`[B7] ${pass ? 'PASS' : 'FAIL'}`)
process.exit(pass ? 0 : 1)