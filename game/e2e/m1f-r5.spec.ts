import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// F2fcea (ADR-025): rebuilt m1f R5 gate, row R5a (rebase lattice on a scripted,
// continuous 4,000 m surface route through the real SimulationCore, checked every tick
// against an independent f64 oracle). Its own page, so the shipped m1f harness rows stay
// untouched; the shipped R5 waiver stays. R5b (straddler A/B with coverage) is F2fceb.
// Mutant self-test: node tools/test-m1f-r5-gate.mjs.
test('M1F R5 rebuilt gate (R5a)', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'M1fR5Gate', page: 'm1fR5', timeoutMs: 60_000, expectedRows: 1, transcriptTail: 4 })
})
