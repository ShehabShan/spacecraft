import { expect, test } from 'playwright/test'

// Milestone 1C gate (§3.7 budget: 150 s — a real 60 s flight window plus
// warmup). The harness auto-arms after warmup (~3–6 s) and runs the window;
// verdict: `[Milestone1C] acceptance PASSED|FAILED — geo=…`.
test('M1C — Web Worker Terrain & Zero-GC Pool acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1C\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 150_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1c')
  const line = await acceptanceLine
  console.log(`[m1c gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1c gate] badges: ${JSON.stringify(badges)}`)
  console.log('[m1c gate] page console transcript (tail):')
  for (const l of consoleLines.slice(-12)) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
