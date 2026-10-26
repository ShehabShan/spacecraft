import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1C gate (§3.7 budget: 150 s — a real 60 s flight window plus
// warmup). The harness auto-arms after warmup (~3–6 s) and runs the window;
// verdict: `[Milestone1C] acceptance PASSED|FAILED — geo=…`.
// F1a: strict contract in ./gate.ts (ADR-001) — 4 rows = TEST_ORDER length.
test('M1C — Web Worker Terrain & Zero-GC Pool acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1C', page: 'm1c', timeoutMs: 150_000, expectedRows: 4, transcriptTail: 12 })
})
