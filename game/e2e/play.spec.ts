// T1 B12 (plan §12.2 B12, §13.4; Q6 ruled IN 2026-10-20): Playwright smoke
// for the playable moon page `?page=play`. It inherits playwright.config.ts:
// the Chrome channel, the preview server on :4173, and workers 1.
//   S1  no param: CLICK_TO_PLAY within 20 s, a non-blank canvas, and the
//       shell stays in CLICK_TO_PLAY (autoplay is inert).
//   S2  ?autoplay=1: reaches PLAYING with no click, and after W is held the
//       HUD speed is > 0.
//   Both: no console, page or worker errors (favicon 404 excluded).
import { test, expect, type Page } from 'playwright/test'

function collectErrors(page: Page): string[] {
  const errs: string[] = []
  const keep = (t: string): boolean => !t.includes('favicon')
  page.on('console', (m) => { if (m.type() === 'error' && keep(m.text())) errs.push(`console: ${m.text()}`) })
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`))
  page.on('worker', (w) => w.on('console', (m) => { if (m.type() === 'error' && keep(m.text())) errs.push(`worker: ${m.text()}`) }))
  return errs
}

const phaseOf = (page: Page): Promise<string> =>
  page.evaluate(() => document.querySelector('[data-phase]')?.getAttribute('data-phase') ?? 'none')

// WHY: the WebGL canvas has no preserveDrawingBuffer, so its pixels cannot be
// read back from the page. Take a compositor screenshot of the canvas instead,
// decode it in the page with a 2D canvas (no PNG library needed), and count
// the distinct colours and the share of non-black pixels.
async function canvasStats(page: Page): Promise<{ colours: number; litShare: number }> {
  const png = await page.locator('canvas').first().screenshot({ timeout: 60_000 })
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d')!
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    const seen = new Set<number>()
    let lit = 0
    for (let i = 0; i < d.length; i += 4) {
      seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
      if (d[i] + d[i + 1] + d[i + 2] > 30) lit++
    }
    return { colours: seen.size, litShare: lit / (d.length / 4) }
  }, png.toString('base64'))
}

test.describe.configure({ mode: 'serial' })

test('S1 play page: CLICK_TO_PLAY ≤ 20 s, non-blank canvas, autoplay inert, no errors', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 })
  const errs = collectErrors(page)
  await page.goto('/?page=play')
  await page.waitForSelector('[data-phase]', { timeout: 30_000 })
  const t0 = Date.now()
  await page.waitForSelector('[data-phase="CLICK_TO_PLAY"]', { timeout: 20_000 })
  console.log(`[S1] CLICK_TO_PLAY ${Date.now() - t0} ms after the shell mounted`)
  const st = await canvasStats(page)
  console.log(`[S1] canvas colours=${st.colours} lit=${(st.litShare * 100).toFixed(2)}%`)
  expect(st.colours, 'canvas has more than a few colours').toBeGreaterThan(16)
  expect(st.litShare, 'canvas is not all black').toBeGreaterThan(0.01)
  await page.waitForTimeout(2000)
  expect(await phaseOf(page), 'without ?autoplay the shell waits for a click').toBe('CLICK_TO_PLAY')
  expect(errs, errs.join('\n')).toEqual([])
})

test('S2 ?autoplay=1: PLAYING without a click, HUD speed > 0 after W, no errors', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 })
  const errs = collectErrors(page)
  await page.goto('/?page=play&autoplay=1')
  await page.waitForSelector('[data-phase]', { timeout: 30_000 })
  await page.waitForSelector('[data-phase="PLAYING"]', { timeout: 20_000 })
  await page.waitForSelector('[data-hud-status]', { timeout: 10_000 })
  const speed = (): Promise<number> => page.evaluate(() =>
    parseFloat(document.querySelector('[data-hud-status]')?.textContent ?? 'NaN'))
  const v0 = await speed()
  await page.keyboard.down('KeyW')
  let vMax = -1
  const tEnd = Date.now() + 20_000
  while (Date.now() < tEnd) {
    await page.waitForTimeout(250)
    vMax = Math.max(vMax, await speed())
    if (vMax > 0) break
  }
  await page.keyboard.up('KeyW')
  console.log(`[S2] HUD speed before W ${v0}, max while W held ${vMax} m/s`)
  expect(await phaseOf(page)).toBe('PLAYING')
  expect(vMax, 'HUD speed rises above 0 while W is held').toBeGreaterThan(0)
  expect(errs, errs.join('\n')).toEqual([])
})