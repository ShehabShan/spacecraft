import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// F2fcb (ADR-022): rebuilt m1f R1 gate, rows R1a (depth separation from scene
// state) + R1b (rendered layering, jitter, determinism, fused counterfactual).
// Its own page, so the shipped m1f harness rows stay untouched.
// Mutant self-test: node tools/test-m1f-r1-gate.mjs.
test('M1F R1 rebuilt gate (R1a + R1b)', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'M1fR1Gate', page: 'm1fR1', timeoutMs: 60_000, expectedRows: 2, transcriptTail: 8 })
})