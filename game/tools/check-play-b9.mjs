// B9c browser check (plan §12.2 B9 → B9c, ANIMATED on screen). Usage:
//   node tools/check-play-b9.mjs http://localhost:4173
// Loads /?page=play&probe=1, clicks into PLAYING, then scripts real key input
// and records the ProceduralAnimator state shown on EVERY rendered frame:
// W held must reach Walk (or Run); Space must pass JumpLaunch/JumpRise, then
// Fall and Land before returning to the ground; P freezes (state unchanged).
// Exit 0 iff all hold and there are no non-favicon console/page errors.
// WHY: a per-frame rAF recorder in the page, not page.evaluate polling — under
// SwiftShader a frame is ~100+ ms and the short timed states (JumpLaunch,
// Land) can last a single frame; the animator updates once per frame, so a
// per-frame sample sees every state that reached the screen. 640×360 + short
// PLAYING windows for the renderer-RSS reason in check-play-b7.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 400, height: 225 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`${base}/?page=play&probe=1`)
await page.waitForSelector('[data-phase="CLICK_TO_PLAY"]', { timeout: 60000 })
await page.evaluate(() => {
  const w = window
  w.__b9 = { seq: [], mark: 0 }
  const tick = () => {
    const s = w.__playProbe.world.animator.stateName, q = w.__b9.seq
    if (q.length === 0 || q[q.length - 1] !== s) q.push(s)
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.mouse.click(200, 112)
await page.waitForTimeout(1500)
const seq = () => page.evaluate(() => window.__b9.seq.slice())
const s0 = await seq()
await page.keyboard.down('KeyW'); await page.waitForTimeout(3000)
const sW = await seq(); await page.keyboard.up('KeyW'); await page.waitForTimeout(1500)
const nW = (await seq()).length
await page.keyboard.press('Space')
// WHY: a moon jump (4.2 m/s, g 1.62) is ~5.2 SIM s airborne; SwiftShader
// runs a few FPS at ≤ 5 ticks/frame, so landing can take tens of wall
// seconds — wait on the KCC (grounded again), capped at 60 s wall.
const tJ0 = await page.evaluate(() => window.__playProbe.core.stats.simTime)
let grounded = false, sawAir = false
for (let i = 0; i < 300 && !(sawAir && grounded); i++) {
  await page.waitForTimeout(200)
  const g = await page.evaluate(() => window.__playProbe.kcc.grounded)
  if (!g) sawAir = true; else if (sawAir) grounded = true
}
const tJ1 = await page.evaluate(() => window.__playProbe.core.stats.simTime)
await page.waitForTimeout(1500)
const sJ = (await seq()).slice(nW)
await page.keyboard.press('KeyP'); await page.waitForTimeout(400)
const a0 = await page.evaluate(() => window.__playProbe.world.animator.stateName)
await page.waitForTimeout(1200)
const a1 = await page.evaluate(() => window.__playProbe.world.animator.stateName)
const phase = await page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute('data-phase'))
await browser.close()
const has = (l, s) => l.includes(s)
const walkOk = has(sW.slice(s0.length), 'Walk') || has(sW.slice(s0.length), 'Run')
const iL = sJ.indexOf('JumpLaunch'), iF = sJ.indexOf('Fall', iL), iLand = sJ.indexOf('Land', iF)
const jumpOk = iL >= 0 && (has(sJ, 'JumpRise') || iF > iL) && iF > iL && iLand > iF
console.log(`[B9] start ${s0.join('→')}; W: ${sW.slice(s0.length).join('→')}; jump: ${sJ.join('→')}; air ${sawAir} → ground ${grounded} (${(tJ1 - tJ0).toFixed(2)} sim s); paused ${phase} ${a0}/${a1}; errors ${errs.length}`)
for (const e of errs) console.log('  ' + e)
const pass = s0.length > 0 && walkOk && jumpOk && grounded && phase === 'PAUSED' && a0 === a1 && errs.length === 0
console.log(`[B9] walk ${walkOk} jump ${jumpOk} ${pass ? 'PASS' : 'FAIL'}`)
process.exit(pass ? 0 : 1)