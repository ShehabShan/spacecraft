import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1D gate (§3.7 budget: 120 s). The harness auto-runs its scripted
// sequence (warmup → dive → cruise → synchronous 20k-tick burn) and logs
// `[Milestone1D] acceptance PASSED|FAILED — …`.
// F1a: strict contract in ./gate.ts (ADR-001) — 5 rows = TEST_ORDER length.
test('M1D — Flight & Aerodynamic Governor acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1D', page: 'm1d', timeoutMs: 120_000, expectedRows: 5, transcriptTail: 12 })
})
