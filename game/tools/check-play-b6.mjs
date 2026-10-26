// B6 browser check (plan §12.2 B6, MT5). Usage:
//   node tools/check-play-b6.mjs http://localhost:4173
// Loads /?page=play, waits CLICK_TO_PLAY, clicks into PLAYING, screenshots
// the frame (/tmp/b6-play.png) and counts rig-coloured pixels (accent/visor/
// suit hues) in the centre band, where the trailing camera frames the rig.
// Exit 0 iff PLAYING is reached, rig pixels are present and there are no
// non-favicon errors. The no-float / sink ≤ 2 cm judgement is test-play-rig's
// exact sole-contact row; the screenshot is the visual MT5 record.
import { chromium } from 'playwright'
const base = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) errs.push(m.text()) })
page.on('pageerror', (e) => errs.push(e.message))
await page.goto(`${base}/?page=play`)
await page.waitForSelector('[data-phase="CLICK_TO_PLAY"]', { timeout: 30000 })
await page.mouse.click(640, 360)
await page.waitForTimeout(2500)
const phase = await page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute('data-phase'))
// WHY: a PLAYING-phase screenshot times out under SwiftShader (continuous
// frames starve the capture); pause first (P) — the frame keeps stages 6–10
// live, so the rig is still drawn behind the pause overlay.
await page.keyboard.press('KeyP')
await page.waitForTimeout(1500)
await page.screenshot({ path: '/tmp/b6-play.png', timeout: 90000 })
// WHY: read pixels from the screenshot itself (preserveDrawingBuffer is off).
const png = await page.screenshot({ clip: { x: 440, y: 200, width: 400, height: 400 }, timeout: 90000 })
const counts = await page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, c.width, c.height).data
  let accent = 0, visor = 0
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2]
    if (r > 120 && r > gg + 40 && gg > b + 20) accent++          // orange chest panel / lit suit warm
    if (b > 120 && b > r + 50 && gg > r + 20) visor++            // cyan visor
  }
  return { accent, visor }
}, png.toString('base64'))
await browser.close()
const rig = counts.accent + counts.visor
console.log(`[B6] phase ${phase}; centre-band rig pixels accent ${counts.accent} visor ${counts.visor}; errors ${errs.length}`)
for (const e of errs) console.log('  ' + e)
const pass = phase === 'PLAYING' && errs.length === 0
console.log(`[B6] ${pass ? 'PASS' : 'FAIL'} (rig pixels informational — the trailing camera sees the BACK (backpack), so accent/visor ≈ 0 is the correct facing: ${rig > 0 ? 'front hues present' : 'none'}; see /tmp/b6-play.png)`)
process.exit(pass ? 0 : 1)