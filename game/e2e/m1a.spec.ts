import { expect, test } from 'playwright/test'

// Milestone 1A gate (assembly brief §3.7): wait for the acceptance console
// line (budget 30 s), assert PASSED, scrape .badge rows for the report.
test('M1A — Floating Origin acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  // Register the waiter BEFORE goto so an instantly-logging harness is not missed.
  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1A\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 30_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1a')
  const line = await acceptanceLine
  console.log(`[m1a gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1a gate] badges: ${JSON.stringify(badges)}`)

  console.log('[m1a gate] page console transcript:')
  for (const l of consoleLines) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
