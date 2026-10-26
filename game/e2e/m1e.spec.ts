import { expect, test } from 'playwright/test'

// Milestone 1E gate (§3.7 budget: 90 s). The harness runs a streaming warmup,
// then a synchronous headless suite (rows R1–R5: 20k-tick face-walk + 30k-tick
// zero-GC burn are multi-second main-thread pauses — expected, not hangs),
// then a live 20 s trek at 4× before logging
// `[Milestone1E] acceptance PASSED|FAILED`.
test('M1E — Spherical Astronaut acceptance', async ({ page }) => {
  const consoleLines: string[] = []
  page.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => consoleLines.push(`pageerror: ${e.message}`))

  const acceptanceLine = page
    .waitForEvent('console', {
      predicate: (m) => /\[Milestone1E\] acceptance (PASSED|FAILED)/.test(m.text()),
      timeout: 90_000,
    })
    .then((m) => m.text())

  await page.goto('/?page=m1e')
  const line = await acceptanceLine
  console.log(`[m1e gate] acceptance line: ${line}`)

  const badges = await page.locator('.badge').allTextContents()
  console.log(`[m1e gate] badges: ${JSON.stringify(badges)}`)
  console.log('[m1e gate] page console transcript (tail):')
  for (const l of consoleLines.slice(-12)) console.log(`  ${l}`)

  expect(line, 'acceptance console line').toContain('PASSED')
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
})
