import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// F2fcea/F2fceb (ADR-025): rebuilt m1f R5 gate. R5a = rebase lattice on a scripted,
// continuous 4,000 m surface route through the real SimulationCore, checked every tick
// against an independent f64 oracle. R5b = straddler A/B at 2,400 m through executePasses
// (coverage floor, 1 m sensitivity, layerMaskFor NEAR|MID) + Sun continuity rendered and
// checked on every frame of a real rebase sequence. Its own page, so the shipped m1f
// harness rows stay untouched; the shipped R5 waiver stays.
// Mutant self-test: node tools/test-m1f-r5-gate.mjs.
test('M1F R5 rebuilt gate (R5a + R5b)', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'M1fR5Gate', page: 'm1fR5', timeoutMs: 60_000, expectedRows: 2, transcriptTail: 4 })
})