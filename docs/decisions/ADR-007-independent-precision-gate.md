# ADR-007 — Independent m1a precision / rebase / timing gate (F2b)

**Status:** accepted (session 111, 2026-10-26) · **Task:** F2b · **Findings:** A1-U08-5, A1-U08-6 (K2c), A1-U08-7 (K2d)

## Context
The m1a harness rows cannot fail on the floating-origin contract they claim to prove.
- T2 and T4 read the engine's own `REBASE_THRESHOLD` / `ORIGIN_LATTICE`. Thresholds 900–1100 and lattices 64–1000 pass.
- T3 counts rebases but does not check when they happen.
- No row reads any `localPosF32`, so the f32-before-subtract and stale-static-locals faults pass.
- T5 drops every frame ≥ 250 ms. It tags the frame *before* the rebase as the rebase frame, and its verdict depends on the display rate.

The rechecks are `docs/audit/U27b3b2b2b2b1-m1a-recheck.md` and `U27b3b2b2b2b2a-m1a-timing-recheck.md`.

## Options
1. Patch the browser harness rows (spec literals, extra legs, re-timed T5). The verdict would still depend on wall-clock frame rate under SwiftShader, and every row change touches the strict ADR-001 contract (A5).
2. Add a Node gate on the real `SimulationCore` that takes its truth from pinned spec literals and raw f64 inputs, with mutants built from source rewrites in fresh bundles (the ADR-006 pattern). The browser rows stay as they are.
3. Do both now.

## Decision
Option 2: `game/tools/test-precision-gate.mjs`, with 7 checks.

| Check | What it compares |
|---|---|
| `trigger-ticks` | Exact spec ticks 31…277 and Δ = (1024, 0, 0) |
| `offaxis-origins` | Velocity (1400, −900, 600) from a non-lattice start: origin === oracle on every tick, \|local\| ≤ 128 after a shift and ≤ 1024 otherwise |
| `boundary` | Strict > 1024 at ±1024, 1023.5, 1024.0001, 1024.5 |
| `extract-exact` | Every entity (dynamic and static) and all 17 celestials: `localPosF32 === fround(abs − O)` on 1,200 ticks |
| `far-origin` | 1.496e11 m: ship local error < 1 mm |
| `stall-ceiling` | Every `advance()` call ≤ 16 ms; calls ≥ 250 ms are counted, not dropped |
| `rebase-cost` | Rebasing call plus the next call ≤ 4 ms |

Both timing checks take the minimum over three runs. They judge the cost of the work, not the display rate.

`--self-test` runs 15 mutants:
- thresholds 900, 1023 and 1025, and a non-strict trigger;
- lattices 128, 300 and 512, and floor instead of round;
- f32-before-subtract, static locals stale, celestial locals stale;
- a 300 ms stall per rebase, three 1 s freezes, a 40 ms hitch on the rebase, and a 40 ms hitch on the frame after the rebase.

Each mutant must turn its named checks red. A rewrite that matches no source text breaks the gate (exit 2). The production source hashes must be unchanged afterwards.

## Why
- Truth comes from outside the engine. The gate imports no engine constant, so a wrong constant cannot validate itself.
- Mutants run on fresh module instances, so production is never edited.
- Timing the `advance()` call itself measures the shift cost. The 60-fps check did not, and the minimum over three runs keeps it stable on a slow VM.

## Consequences
- The m1a browser rows are unchanged. The row counts (A5) and ADR-001 are unchanged.
- The S2 template-text defect A1-U08-8 in the harness detail strings stays open. It rides with the next task that edits `Milestone1A_TestHarness.tsx`.
- The gate covers the core contract, not GPU or frame pacing. Display-rate frame stability remains a browser-only, machine-dependent row.
- If the lattice or trigger changes under §13, the pinned literals and `SPEC_TICKS` change in the same commit, with an ADR.