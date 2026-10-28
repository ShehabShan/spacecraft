import { test } from 'playwright/test'
import { runAcceptanceGate } from './gate'

// Milestone 1F gate (§3.7 budget raised 150 s → 240 s by F21b: the LIVE walk
// alone is 120 s wall post-calibration). The harness runs a streaming warmup,
// a 120 s live sprint (5 substeps/frame at ts=6), then a synchronous headless
// suite (3,000-iteration burn + 300 three-pass renders + 5 A/B renders are a
// multi-second main-thread pause — expected, not hangs), then logs
// `[Milestone1F] acceptance PASSED|FAILED`.
// F1a: strict contract in ./gate.ts (ADR-001) — 5 rows = TEST_ORDER length.
test('M1F — 3-Camera Layers & Sky Impostors acceptance', async ({ page }) => {
  await runAcceptanceGate(page, { tag: 'Milestone1F', page: 'm1f', timeoutMs: 240_000, expectedRows: 5, transcriptTail: 12 })
})
