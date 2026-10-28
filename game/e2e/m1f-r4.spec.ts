import { expect, test } from 'playwright/test'
import { driveR4 } from '../tools/r4-cdp-driver.mjs'

// F2fcda/F2fcdb (ADR-024): rebuilt m1f R4 gate on its own page, so the shipped m1f harness rows stay
// untouched. R4a is boot-object identity (=== plus GPU counts). R4b is allocation and R4c is
// retention; both are measured by tools/r4-cdp-driver.mjs over CDP around the page's exposed burn.
// R4b is RED BY MEASUREMENT (finding F2fcdb-1): the shipped executePasses render path allocates
// ~1.6 KB/frame (three.js frustum/render-list internals + MultiCameraRig), while the pure frame path
// stays under 64 B. So this spec PINS ['PASS','FAIL','PASS'], with R4b failing ONLY its render clause
// with a calibrated instrument. WHY: CI stays green while the badge stays honest; any other vector,
// an extra fail reason, a broken calibration or an error is red. The fix task flips this to all-PASS.
// Mutant self-test: node tools/test-m1f-r4-gate.mjs.
test('M1F R4 rebuilt gate (R4a + R4b + R4c; R4b pinned known-red on render)', async ({ page }) => {
  test.setTimeout(300_000)
  const lines: string[] = [], errors: string[] = []
  page.on('console', (m) => { lines.push(m.text()); if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  const verdict = page.waitForEvent('console', { predicate: (m) => /\[M1fR4Gate\] acceptance/.test(m.text()), timeout: 240_000 }).then((m) => m.text())
  await page.goto('/?page=m1fR4')
  await driveR4(page)
  const line = await verdict
  const badges = (await page.locator('.badge').allTextContents()).map((b) => b.trim())
  for (const l of lines.filter((x) => x.startsWith('[M1fR4Gate]'))) console.log(`  ${l}`)
  console.log(`[m1fR4 gate] badges: ${JSON.stringify(badges)}`)
  expect(errors, 'no page or console error').toEqual([])
  expect(line, 'pinned verdict').toBe('[M1fR4Gate] acceptance FAILED')
  expect(badges, 'pinned badge vector').toEqual(['PASS', 'FAIL', 'PASS'])
  const row = (p: string) => lines.find((l) => l.startsWith(`[M1fR4Gate] ${p}`)) ?? ''
  expect(row('R4a boot identity: PASS'), 'R4a identity').toMatch(/: 0 changed; GPU geometries (\d+)→\1, textures (\d+)→\2, programs (\d+)→\3;/)
  expect(row('R4b allocation: FAIL'), 'R4b calibrated, fails only on render').toMatch(/B\/iter \(ok\); .*fails: \[render\];/)
  expect(row('R4c retention: PASS'), 'R4c calibrated').toMatch(/B\/iter \(ok, ≥ 12\);/)
})