# ADR-003 — Allocation gate for the headless harness loops (F1bb)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F1b part F1bb · Date: 2026-10-26
- Extends ADR-002 (same instrument, same budgets: sampled ≤ 64 B/tick, retained ≤ 8 B/tick).
- Addresses A1-U03-4, A1-U04-5, A1-U05-3, A1-U06-2, A1-U07-3 (K2a) by measurement. The old rows are NOT retired here (see Consequences).

## Context
The m1b T4, m1d T4 and m1e zero-gc rows prove "zero allocation" with an identity canary plus `usedJSHeapSize` deltas. U27b2 showed such deltas hide transient churn. m1c's counter is written only in the pool constructor; m1f R4 uses heap deltas over a render loop that needs a browser.

## Decision
`game/tools/test-alloc-loops.mjs` (shared instrument in `game/tools/alloc-lib.mjs`) runs, in Node, the exact burn programs of three rows with the ADR-002 sampler plus retained clause:
- m1b: `SimulationCore.tick()` (30000 ticks)
- m1d: `FlightController.integrateFlight(1/60)` with the row's input program
- m1e: `AstronautKCC.integrateTick(1/60)` with the row's three-phase program (surface walk, zero-G RCS, sphere sweep tail)

Self-test (`--self-test`; `--deliberate` adds one wrong expectation): for every loop a leak mutant (~40–50 B/tick retained) must turn the retained clause red; on a clean baseline the churn mutant (4 plain 3-field objects, ≈383 B/tick) must turn the allocation clause red. m1d and m1e are already over budget, and their run-to-run wobble (±150–1,200 B/tick) swamps a 400 B delta, so for them the churn clause is recorded, not asserted; churn sensitivity is shown on the clean m1b loop.

## Measured (current tree, `docs/audit/evidence/F1b/loops/`)
| Loop | sampled B/tick | retained B/tick | verdict |
|---|---|---|---|
| m1b `SimulationCore.tick` | 9.5 (tick 8.2) | 0.11 | PASS |
| m1d `integrateFlight` | 585 (integrateFlight 506, `_sweepTerrain` 65) | −0.05 | FAIL |
| m1e `integrateTick` | 5,483 (sampleSurfaceInto 1,754, terrainHeight 976, noise3 914, `_groundedTick` 704, `_fillTelemetry` 278, `_flightTick` 213) | 0.53 | FAIL |

So the "zero-GC" claim holds only for the orbit core; the flight controller allocates ≈0.5 KB/tick (new finding for F7a, not in A1 FINDINGS) and the KCC ≈5.5 KB/tick, mostly the terrain path (F5a).

## Open item (ADR-002) — NOT settled
Three further runs of the play gate: walk retained −0.80 / 0.00 / 0.13 B/frame, idle retained 9.31 / 6.11 / 9.31 B/frame (earlier 4.9–8.0). Idle is consistently positive and mostly above the 8 B budget while walk is ~0, so it is not simple noise; the cause (state that grows only while idle) is unidentified. The budget is not raised. Next step: bisect the idle path (F1bc/F5a) before deciding.

## Consequences
- Regression: `node --expose-gc tools/test-alloc-loops.mjs --self-test` → 8/8 exit 0 (the plain gate exits 1 on the current tree until F5a/F7a).
- Deferred to F1bc: retiring the m1b/m1d/m1e heap-delta rows, the m1c boot-only counter and m1f R4, re-pointing `test-play-perf`, and the matching row-count/ADR-001 edits. Browser-only loops (m1c pool, m1f render passes) still need a CDP sampler.
