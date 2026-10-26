import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1E gate (§3.7 budget: 90 s). The harness runs a streaming warmup,
// then a synchronous headless suite (rows R1–R5: 20k-tick face-walk + 30k-tick
// zero-GC burn are multi-second main-thread pauses — expected, not hangs),
// then a live 20 s trek at 4× before logging
// `[Milestone1E] acceptance PASSED|FAILED`.
// F1a: strict contract in ./gate.ts (ADR-001) — 6 rows = TEST_ORDER length.
test('M1E — Spherical Astronaut acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1E', page: 'm1e', timeoutMs: 90_000, expectedRows: 6, transcriptTail: 12 })
})
