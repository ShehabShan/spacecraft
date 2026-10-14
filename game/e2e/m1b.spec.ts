import { expect, test } from 'playwright/test'

// Milestone 1B gate (§3.7 budget: 20 s). The 1B harness auto-runs its suite
// ~0.75 s after mount; verdict: `[Milestone1B] acceptance PASSED|FAILED in N ms — …`.
test('M1B — Kepler Rails & Two-Tier Time acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1B\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 20_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1b')
  const line = await acceptanceLine
  console.log(`[m1b gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1b gate] badges: ${JSON.stringify(badges)}`)
  console.log('[m1b gate] page console transcript:')
  for (const l of consoleLines) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
