// B5c browser check (plan §12.2 B5c; extends check-play-b4). Usage:
//   node tools/check-play-b5.mjs http://localhost:4173
// C1 LOADING overlay first; C2 CLICK_TO_PLAY within 20 s; C3 click → PLAYING
// (pointer lock); C4 P → PAUSED, Resume disabled, enabled after ~1 s; C5 no
// non-favicon errors; C6 /?page=m1f&manual=1 boots afterwards (MT16).
// Exit 0 only if C1, C2, C5, C6 pass. C3/C4 depend on headless pointer-lock
// support: reported, and they fail the run only if lock engaged but the
// overlays misbehaved.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`) })
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
page.on('worker', (w) => w.on('console', (m) => { if (m.type() === 'error') errs.push(`worker: ${m.text()}`) }))
const phase = () => page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute('data-phase') ?? 'none')
let hard = 0
const t0 = Date.now()
await page.goto(`${base}/?page=play`)
await page.waitForSelector('[data-phase]', { timeout: 30000 })
const p0 = await phase()
const c1 = p0 === 'LOADING' || p0 === 'CLICK_TO_PLAY'
const sawLoading = p0 === 'LOADING'
console.log(`[C1] first phase ${p0} after ${Date.now() - t0} ms — ${sawLoading ? 'PASS' : c1 ? 'PASS (gate already done)' : 'FAIL'}`); if (!c1) hard++
let tReady = -1
try {
  await page.waitForSelector('[data-phase="CLICK_TO_PLAY"]', { timeout: 20000 }); tReady = Date.now() - t0
} catch { /* reported below */ }
const note = await page.evaluate(() => document.body.innerText.includes('still streaming'))
console.log(`[C2] CLICK_TO_PLAY after ${tReady} ms${note ? ' (timeout note shown)' : ''} — ${tReady >= 0 ? 'PASS' : 'FAIL'}`); if (tReady < 0) hard++
await page.screenshot({ path: '/tmp/b5-click.png' })
let c3 = 'SKIP', c4 = 'SKIP'
if (tReady >= 0) {
  await page.mouse.click(640, 360)
  await page.waitForTimeout(1500)
  const locked = await page.evaluate(() => document.pointerLockElement?.tagName ?? null)
  const p3 = await phase()
  c3 = p3 === 'PLAYING' ? 'PASS' : locked ? 'FAIL' : `SKIP (no lock in headless; phase ${p3})`
  if (c3 === 'FAIL') hard++
  console.log(`[C3] click → lock=${locked} phase=${p3} — ${c3}`)
  if (p3 === 'PLAYING') {
    await page.keyboard.press('KeyP')
    await page.waitForTimeout(150)
    const p4 = await phase()
    // WHY: under SwiftShader one frame can block the main thread > 1 s, so a
    // wall-clock wait says nothing; the cool-down is judged IN PAGE: the button
    // must be disabled iff performance.now() - pausedAtMs < 1000 at read time.
    const rd = () => page.evaluate(() => {
      const at = Number(document.querySelector('[data-paused-at]')?.getAttribute('data-paused-at') ?? NaN)
      return { dis: document.querySelector('[data-resume]')?.disabled ?? null, el: performance.now() - at }
    })
    const r0 = await rd()
    await page.waitForTimeout(1200)
    const r1 = await rd()
    const unlocked = await page.evaluate(() => document.pointerLockElement === null)
    await page.screenshot({ path: '/tmp/b5-paused.png' })
    const ok0 = r0.dis === (r0.el < 1000) || Math.abs(r0.el - 1000) < 50
    const ok1 = r1.el >= 1000 && r1.dis === false
    c4 = p4 === 'PAUSED' && ok0 && ok1 && unlocked ? 'PASS' : 'FAIL'
    if (c4 === 'FAIL') hard++
    console.log(`[C4] P → phase=${p4} read0 disabled=${r0.dis} @${r0.el.toFixed(0)}ms since pause; read1 disabled=${r1.dis} @${r1.el.toFixed(0)}ms; unlocked=${unlocked} — ${c4}`)
    if (c4 === 'PASS') {
      await page.click('[data-resume]'); await page.waitForTimeout(800)
      console.log(`[C4b] Resume → phase=${await phase()}`)
    }
  }
}
const playErrs = errs.filter((e) => !e.includes('favicon'))
console.log(`[C5] play errors (favicon excluded): ${playErrs.length} — ${playErrs.length ? 'FAIL' : 'PASS'}`); for (const e of playErrs) console.log('  ' + e)
hard += playErrs.length ? 1 : 0
errs.length = 0
await page.goto(`${base}/?page=m1f&manual=1`)
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(8000)
const m1fErrs = errs.filter((e) => !e.includes('favicon'))
console.log(`[C6] m1f&manual=1 boots; errors (favicon excluded): ${m1fErrs.length} — ${m1fErrs.length ? 'FAIL' : 'PASS'}`); for (const e of m1fErrs) console.log('  ' + e)
hard += m1fErrs.length ? 1 : 0
await browser.close()
console.log(`[B5] hard failures: ${hard}`)
process.exit(hard === 0 ? 0 : 1)