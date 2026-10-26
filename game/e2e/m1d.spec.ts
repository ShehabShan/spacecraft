import { expect, test } from 'playwright/test'

// Milestone 1D gate (§3.7 budget: 120 s). The harness auto-runs its scripted
// sequence (warmup → dive → cruise → synchronous 20k-tick burn) and logs
// `[Milestone1D] acceptance PASSED|FAILED — …`.
test('M1D — Flight & Aerodynamic Governor acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1D\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 120_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1d')
  const line = await acceptanceLine
  console.log(`[m1d gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1d gate] badges: ${JSON.stringify(badges)}`)
  console.log('[m1d gate] page console transcript (tail):')
  for (const l of consoleLines.slice(-12)) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
