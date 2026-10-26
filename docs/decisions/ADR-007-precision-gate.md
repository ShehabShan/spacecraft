# ADR-007 — Independent m1a precision/rebase gate (F2ba)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F2ba (U27c §2 row F2b, split per §12) · Date: 2026-10-26
- Closes K2c findings A1-U08-5 and A1-U08-6 (exact origins, trigger and lattice boundaries). A1-U08-7 (stall attribution, K2d) moves to F2bb.

## Context
The m1a harness rows check the floating origin with the engine's own constants and one axis-aligned flight from 0. The A1 recheck (`docs/audit/U27b3b2b2b2b1-m1a-recheck.md`) showed that they miss a static origin error of 9216 m and early f32 rounding (16,320 m stress at AU range). They also never probe the exact trigger boundary (1024 vs 1024+ε), the round-half-up lattice ties, or stale locals.

## Options
1. Tighten the m1a browser rows. This changes a browser spec and the F1a row contract (A5 B5 C4 D5 E6 F5, ADR-001), and the check would still read the engine's constants.
2. Mutate the engine through runtime monkey-patching, as in the ADR-006 orbit gate. This does not work here, because `REBASE_THRESHOLD`, `ORIGIN_LATTICE` and the tick's extract order are module constants and inline code, not instance state.
3. Add a new Node gate whose oracle replays the pinned rules on raw inputs. Each mutant is a fresh esbuild bundle of patched source, built in memory.

## Decision
Option 3: `game/tools/test-precision-gate.mjs`.

1. **Pinned facts (change only with an ADR):**
   - lattice 256, with O = 256·floor(P/256 + 0.5) per axis;
   - rebase iff the max-axis |P − O| > 1024, strictly;
   - tick = 1/60 s.

   The oracle uses only these facts and the raw entity positions and velocities. It never reads engine constants.
2. **Δ f32-exactness is bounded.** m1a T4 requires `Math.fround(Δ) === Δ`. That holds by construction only for |Δ| ≤ 2^32 (256 · 2^24). On the first rebase at AU range, Δ ≈ 1.5e11 m. That value is f64-exact but not f32-representable. Production never narrows Δ, because locals are computed as f64(P − O) and only then narrowed. The gate therefore requires lattice-multiple Δ always, and f32-exact Δ only for |Δ| ≤ 2^32. Exact locals are still checked everywhere.
3. **Mutants:**
   - Each patch is a regex with an asserted match count, so a refactor that silently defeats a mutant breaks the gate (exit 2) instead of passing it.
   - The source files are sha256-checked before and after the run (`production-source-unchanged`).
   - Mutant bundles live in `node_modules/.cache/`.

## Consequences
- **Checks (9):** trigger-boundary, abs-f64-exact, locals-exact, post-tick-bound, recentre, lattice-delta, tie-rounding, origin-exact, celestial-locals-exact.
- **Scenarios:**
  - ±x/y/z at 1024 and 1024+2^-30, plus a corner;
  - ties at ±1152, 3200 and −5248, and just below a tie;
  - three flights;
  - AU static and AU flight, with celestial locals.
- **Mutants that go red (8):** threshold 1023 and 2048, non-strict trigger, lattice 128 and 512, floor without +0.5, early f32 rounding, and stale pre-rebase origin.
- The m1a browser rows, the row counts and ADR-001 are unchanged. No game source changed.
- The patch regexes are tied to the extract statements in `SimulationCore.tick()`. If that code is refactored, update the patches in the same commit.