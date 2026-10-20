// B4 manual checks MT2 + MT16 in headless Chrome (plan §13 / Q6). Usage:
//   node tools/check-play-b4.mjs http://localhost:4173
// MT2: load /?page=play, wait for the terrain to stream, record console and
// page errors + time-to-ready (K11), screenshot. MT16: full load /?page=m1f
// afterwards and confirm the harness boots (canvas + no page errors).
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error') errs.push(`console: ${m.text()}`) })
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
page.on('worker', (w) => w.on('console', (m) => { if (m.type() === 'error') errs.push(`worker: ${m.text()}`) }))
const t0 = Date.now()
await page.goto(`${base}/?page=play`)
await page.waitForSelector('canvas', { timeout: 30000 })
const tCanvas = Date.now() - t0
await page.waitForTimeout(15000)
await page.screenshot({ path: '/tmp/mt2-play.png' })
const px = await page.evaluate(() => {
  const c = document.querySelector('canvas'); const g = c.getContext('webgl2', { preserveDrawingBuffer: true })
  return { w: c.width, h: c.height, gl: g !== null }
})
console.log(`[MT2] canvas after ${tCanvas} ms; canvas ${px.w}x${px.h}`)
const mt2Errs = errs.filter((e) => !e.includes('favicon'))
console.log(`[MT2] errors (favicon excluded): ${mt2Errs.length}`); for (const e of mt2Errs) console.log('  ' + e)
errs.length = 0
await page.goto(`${base}/?page=m1f&manual=1`)
await page.waitForSelector('canvas', { timeout: 30000 })
await page.waitForTimeout(8000)
await page.screenshot({ path: '/tmp/mt16-m1f.png' })
const hud = await page.evaluate(() => document.body.innerText.slice(0, 300))
const mt16Errs = errs.filter((e) => !e.includes('favicon'))
console.log(`[MT16] m1f canvas present; errors (favicon excluded): ${mt16Errs.length}`); for (const e of mt16Errs) console.log('  ' + e)
console.log(`[MT16] hud: ${hud.replace(/\s+/g, ' ')}`)
await browser.close()
process.exit(mt2Errs.length + mt16Errs.length === 0 ? 0 : 1)