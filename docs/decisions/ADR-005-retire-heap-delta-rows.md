# ADR-005 — Retire the blind heap-delta and boot-only allocation clauses (F1bcb)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F1b part F1bcb · Date: 2026-10-26
- Completes F1b (U27c §2). Builds on ADR-002 (play-frame gate), ADR-003 (harness-loop gate), ADR-004 (retained = object heap).
- Closes K2a by measurement: A1-U03-4, A1-U04-5, A1-U05-3, A1-U06-2, A1-U07-3, A1-U09-1.

## Context
Four milestone rows claimed "zero allocation" with checks that cannot see per-tick churn:
- m1b T4, m1d T4, m1e zero-gc: `usedJSHeapSize` delta over a burn, passing on N/A, on a negative delta, and on up to 1 MB of growth. A1-U27b2 showed ~41.6 MB of transient allocation hidden by such deltas.
- m1c T2: `pool.counters.bootBufferAllocs`, written only in the `TerrainMeshPool` constructor (A1-U06-2), so its delta is zero by construction.

ADR-003's Node gate (`game/tools/test-alloc-loops.mjs`) now measures the exact m1b/m1d/m1e burn programs with V8's sampling heap profiler and catches both leak and churn mutants, so AGENT_BRIEF §13 safeguard 3 ("the new independent check lands first") is met for those three loops. It is NOT met for the browser-only loops (m1c pool frame loop, m1f multi-pass render loop): no CDP sampler exists yet.

## Options
1. Delete the four rows and lower the fixed row counts (A5 B4 C4 D4 E5 F5).
2. Keep the rows, remove only the clauses that cannot fail, and keep what the rows really check (identity canary; NaN count on m1d/m1e; dispose/remove counts on m1c T2). Row counts unchanged.
3. Leave everything until a CDP browser sampler exists.

## Decision
Option 2.
- m1b T4: pass = identity canary only. m1d T4 and m1e zero-gc: pass = identity canary AND zero NaN events. The heap-delta clause and its 1 MB limit are removed. Labels say "allocation: Node gate", and the detail text names `node --expose-gc tools/test-alloc-loops.mjs`.
- m1c T2: the `bootBufferAllocs` delta no longer decides the row. Dispose and scene.remove counts stay.
- m1c heap-flat and m1f R4 are UNCHANGED. Both are browser-only; retiring them before a CDP `HeapProfiler.startSampling` gate exists would break safeguard 3, and m1f is PARKED (§8). They stay weak known-blind rows (A1-U06-5, A1-U03-4) until that sampler lands.
- `game/tools/test-play-perf.mjs`: its post-gc heap rows are kept as retention (leak) checks and relabelled. Per-frame allocation of the play frame is decided by `game/tools/test-alloc-gate.mjs` (ADR-002).

## Why
- Every remaining clause can fail on a real defect: the identity canary fails on reallocated state, NaN on numeric blow-up, dispose/remove on churned GPU objects.
- Keeping rows (not deleting them) keeps the fixed TEST_ORDER counts, the F1a contract (ADR-001), and the 60-run plumbing gate unchanged, and avoids touching six specs for no gain in coverage.
- A row that says "zero allocations" while it cannot detect them is worse than no row: it gives false confidence. The claim now lives where it is measured.

## Consequences
- No row count changes: `game/e2e/*.spec.ts`, `game/e2e/gate.ts`, `game/tools/test-e2e-plumbing.mjs` and ADR-001 stay valid as written.
- The allocation verdict for m1b/m1d/m1e is the Node gate, which is red on the current tree for m1d (≈585 B/tick, F7a) and m1e (≈5.5 KB/tick, F5a). The browser rows no longer show allocation at all, so the red is visible only in the Node gate — run it in every task that touches core/terrain/KCC/flight.
- Open item: a CDP sampler through Playwright for the m1c pool loop and the m1f render loop, after which m1c heap-flat and m1f R4 can be retired the same way (m1f only under a Lead directive naming 1F). Suggested home: F5d (pool) / F2f (1F).
- The optional fold of `test-alloc-gate.mjs`'s inline instrument onto `alloc-lib.mjs` was not done (no behaviour gain; risk of disturbing a calibrated gate).