import { expect, test } from 'playwright/test'

// F2fccba (ADR-023): rebuilt m1f R3 handoff gate. It is RED BY DESIGN until F8a fixes
// A1-U03-1, so this spec PINS the known-red vector instead of using runAcceptanceGate.
// WHY: CI stays green while the badge stays honest. Any other vector, an error, or a
// changed hole band is red. F8a's done-condition flips this spec to all-PASS.
// F2fccbb extends the pin to ['FAIL','FAIL','PASS'] (R3b, R3c).
test('M1F R3 rebuilt gate (pinned known-red: R3a)', async ({ page }) => {
  const lines: string[] = [], errors: string[] = []
  page.on('console', (m) => { lines.push(m.text()); if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  const verdict = page.waitForEvent('console', { predicate: (m) => /\[M1fR3Gate\] acceptance/.test(m.text()), timeout: 60_000 }).then((m) => m.text())
  await page.goto('/?page=m1fR3')
  const line = await verdict
  const badges = (await page.locator('.badge').allTextContents()).map((b) => b.trim())
  for (const l of lines) console.log(`  ${l}`)
  console.log(`[m1fR3 gate] badges: ${JSON.stringify(badges)}`)
  expect(errors, 'no page or console error').toEqual([])
  expect(line, 'pinned verdict').toBe('[M1fR3Gate] acceptance FAILED')
  expect(badges, 'pinned known-red badge vector').toEqual(['FAIL'])
  const r3a = lines.find((l) => l.startsWith('[M1fR3Gate] R3a state-coupled sweep: FAIL')) ?? ''
  // The pinned defect: the descending hole of A1-U03-1, and nothing ascending.
  expect(r3a, 'R3a sweep descending band').toMatch(/sweep .*down: \d+ holes in \[220000, 2256\d\d\] m; up: 0 holes;/)
  // One band per descending pass of the live triangle (frame sampling differs per period).
  expect(r3a, 'R3a live descending hole').toMatch(/live .*down: \d+ holes in \[22\d{4}, 22\d{4}\] m(, \[22\d{4}, 22\d{4}\] m)*; up: 0 holes\./)
  expect(r3a, 'R3a flips and doubles').toMatch(/ 0 doubles; 21 flips /)
})