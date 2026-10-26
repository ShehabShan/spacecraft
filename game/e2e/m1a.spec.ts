import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1A gate (assembly brief §3.7): wait for the acceptance console
// line (budget 30 s), assert PASSED, scrape .badge rows for the report.
// F1a: strict contract in ./gate.ts (ADR-001) — 5 rows = TEST_ORDER length.
test('M1A — Floating Origin acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1A', page: 'm1a', timeoutMs: 30_000, expectedRows: 5 })
})
