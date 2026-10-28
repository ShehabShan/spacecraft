import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// F2fcda (ADR-024): rebuilt m1f R4 gate, row R4a (boot-object identity compared with ===,
// plus GPU resource counts). Its own page, so the shipped m1f harness rows stay untouched.
// R4b/R4c (allocation/retention via a CDP sampling profiler) land in F2fcdb.
// Mutant self-test: node tools/test-m1f-r4-gate.mjs.
test('M1F R4 rebuilt gate (R4a)', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'M1fR4Gate', page: 'm1fR4', timeoutMs: 90_000, expectedRows: 1, transcriptTail: 4 })
})