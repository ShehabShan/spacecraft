import { expect, type Page } from 'playwright/test'

// F1a (ADR-001): the shared e2e acceptance contract for the six milestone
// specs. A page passes ONLY if it logs `[<tag>] acceptance PASSED`, raised no
// pageerror and no console.error at any time, shows exactly the expected
// number of badge rows, and every badge reads exactly `PASS`.
// WHY: before F1a the specs only rejected the literal text "FAIL", so errors,
// placeholder/ERR badges and dropped rows passed (A1-U08-1/-2/-9, U27b3a).
export interface AcceptanceGate {
  /** Console tag, e.g. `Milestone1A`. */
  tag: string
  /** `?page=` key, e.g. `m1a`. */
  page: string
  /** Budget for the acceptance console line (assembly brief §3.7). */
  timeoutMs: number
  /** Badge rows the harness must render. Fixed in the spec, never read from the harness. */
  expectedRows: number
  /** Print only the last N console lines (long harness transcripts). */
  transcriptTail?: number
}

export async function runAcceptanceGate(page: Page, gate: AcceptanceGate): Promise<void> {
  const consoleLines: string[] = []
  const runtimeErrors: string[] = []
  page.on('console', (m) => {
    const line = `${m.type()}: ${m.text()}`
    consoleLines.push(line)
    if (m.type() === 'error') runtimeErrors.push(line)
  })
  page.on('pageerror', (e) => {
    const line = `pageerror: ${e.message}`
    consoleLines.push(line)
    runtimeErrors.push(line)
  })

  // Register the waiter BEFORE goto so an instantly-logging harness is not missed.
  const verdict = new RegExp(`\\[${gate.tag}\\] acceptance (PASSED|FAILED)`)
  const acceptanceLine = page
    .waitForEvent('console', { predicate: (m) => verdict.test(m.text()), timeout: gate.timeoutMs })
    .then((m) => m.text())

  await page.goto(`/?page=${gate.page}`)
  const line = await acceptanceLine
  console.log(`[${gate.page} gate] acceptance line: ${line}`)

  const badges = (await page.locator('.badge').allTextContents()).map((b) => b.trim())
  console.log(`[${gate.page} gate] badges: ${JSON.stringify(badges)}`)
  console.log(`[${gate.page} gate] runtime errors: ${JSON.stringify(runtimeErrors)}`)
  const shown = gate.transcriptTail ? consoleLines.slice(-gate.transcriptTail) : consoleLines
  console.log(`[${gate.page} gate] page console transcript${gate.transcriptTail ? ' (tail)' : ''}:`)
  for (const l of shown) console.log(`  ${l}`)

  // Order matters only for which label a broken page reports first; every
  // assertion is independent and each one alone rejects its defect class.
  expect(line, 'acceptance console line').toMatch(new RegExp(`\\[${gate.tag}\\] acceptance PASSED`))
  expect(runtimeErrors, 'no page or console error').toEqual([])
  expect(badges.length, 'badge rows scraped').toBeGreaterThan(0)
  expect(badges.length, 'badge row count').toBe(gate.expectedRows)
  expect(badges.join(' | '), 'no FAIL badge may remain').not.toContain('FAIL')
  expect(badges.filter((b) => b !== 'PASS'), 'every badge is exactly PASS').toEqual([])
}