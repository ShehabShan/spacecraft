import { expect, test } from 'playwright/test'

// F2fccba/F2fccbba (ADR-023): rebuilt m1f R3 handoff gate. It is RED BY DESIGN until F8a fixes
// A1-U03-1, so this spec PINS the known-red vector instead of using runAcceptanceGate.
// WHY: CI stays green while the badge stays honest. Any other vector, an error, or a
// changed hole band / R3b fail set is red. F8a's done-condition flips this spec to all-PASS.
// R3b's set is the MEASURED one (ADR-023 amendment, F2fccbba): it also fails the impostor-only
// samples because the impostor draws ~1.35× the mesh's area (finding F2fccbb-1).
// R3c (F2fccbbb) is also MEASURED red: the impostor-only mask is 88 px against a ~68 px mesh disk
// (imp-area + sym fail at 228/232/236 km), the same finding F2fccbb-1; centroid and repeat hold.
test('M1F R3 rebuilt gate (pinned known-red: R3a, R3b, R3c)', async ({ page }) => {
  const lines: string[] = [], errors: string[] = []
  page.on('console', (m) => { lines.push(m.text()); if (m.type() === 'error') errors.push(m.text()) })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  const verdict = page.waitForEvent('console', { predicate: (m) => /\[M1fR3Gate\] acceptance/.test(m.text()), timeout: 90_000 }).then((m) => m.text())
  await page.goto('/?page=m1fR3')
  const line = await verdict
  const badges = (await page.locator('.badge').allTextContents()).map((b) => b.trim())
  for (const l of lines) console.log(`  ${l}`)
  console.log(`[m1fR3 gate] badges: ${JSON.stringify(badges)}`)
  expect(errors, 'no page or console error').toEqual([])
  expect(line, 'pinned verdict').toBe('[M1fR3Gate] acceptance FAILED')
  expect(badges, 'pinned known-red badge vector').toEqual(['FAIL', 'FAIL', 'FAIL'])
  const r3a = lines.find((l) => l.startsWith('[M1fR3Gate] R3a state-coupled sweep: FAIL')) ?? ''
  // The pinned defect: the descending hole of A1-U03-1, and nothing ascending.
  expect(r3a, 'R3a sweep descending band').toMatch(/sweep .*down: \d+ holes in \[220000, 2256\d\d\] m; up: 0 holes;/)
  // One band per descending pass of the live triangle (frame sampling differs per period).
  expect(r3a, 'R3a live descending hole').toMatch(/live .*down: \d+ holes in \[22\d{4}, 22\d{4}\] m(, \[22\d{4}, 22\d{4}\] m)*; up: 0 holes\./)
  expect(r3a, 'R3a flips and doubles').toMatch(/ 0 doubles; 21 flips /)
  const r3b = lines.find((l) => l.startsWith('[M1fR3Gate] R3b rendered coverage: FAIL')) ?? ''
  expect(r3b, 'R3b measured fail set').toMatch(/fails: down \[290, 245, 238, 228, 224, 222\] km; up \[238, 245, 290\] km\./)
  expect(r3b, 'R3b holes are zero coverage').toMatch(/ 224:0\.000! 222:0\.000! 205:1\.000;/)
  const r3c = lines.find((l) => l.startsWith('[M1fR3Gate] R3c silhouette A/B: FAIL')) ?? ''
  expect(r3c, 'R3c measured fail reasons').toMatch(/fails: \[228\(imp-area,sym\) 232\(imp-area,sym\) 236\(imp-area,sym\)\]\./)
  expect(r3c, 'R3c mesh masks bounded, centroid and repeat hold').toMatch(/228: mesh 7\d imp 88 px .*Δc 0\.\d\d px, repeat identical; 232: mesh 6\d imp 88 px .*repeat identical; 236: mesh 6\d imp 88 px .*repeat identical\./)
})
