import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1B gate (§3.7 budget: 20 s). The 1B harness auto-runs its suite
// ~0.75 s after mount; verdict: `[Milestone1B] acceptance PASSED|FAILED in N ms — …`.
// F1a: strict contract in ./gate.ts (ADR-001) — 5 rows = TEST_ORDER length.
test('M1B — Kepler Rails & Two-Tier Time acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1B', page: 'm1b', timeoutMs: 20_000, expectedRows: 5 })
})
