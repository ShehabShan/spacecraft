import { expect, test } from 'playwright/test'

// Milestone 1F gate (§3.7 budget raised 150 s → 240 s by F21b: the LIVE walk
// alone is 120 s wall post-calibration). The harness runs a streaming warmup,
// a 120 s live sprint (5 substeps/frame at ts=6), then a synchronous headless
// suite (3,000-iteration burn + 300 three-pass renders + 5 A/B renders are a
// multi-second main-thread pause — expected, not hangs), then logs
// `[Milestone1F] acceptance PASSED|FAILED`.
test('M1F — 3-Camera Layers & Sky Impostors acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1F\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 240_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1f')
  const line = await acceptanceLine
  console.log(`[m1f gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1f gate] badges: ${JSON.stringify(badges)}`)
  console.log('[m1f gate] page console transcript (tail):')
  for (const l of consoleLines.slice(-12)) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
