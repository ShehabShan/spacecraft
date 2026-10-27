import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// F2fcab (ADR-021): rebuilt m1f R2 gate, rows R2a (angular law) + R2b (far-pass
// Sun footprint). Its own page, so the shipped m1f harness rows stay untouched.
// Mutant self-test: node tools/test-m1f-r2-gate.mjs.
test('M1F R2 rebuilt gate (R2a + R2b)', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'M1fR2Gate', page: 'm1fR2', timeoutMs: 60_000, expectedRows: 2, transcriptTail: 6 })
})