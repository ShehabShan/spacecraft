# ADR-002 — Allocation gate: sampled bytes per frame plus a retained clause

- Status: ACCEPTED (session decision under AGENT_BRIEF §13) · Task: F1b (part F1ba) · Date: 2026-10-26
- Closes in F1ba: A1-U09-1 (play-frame side of cluster K2a) and the measurement half of A1-U25-1. The engine fix for A1-U25-1 is F5a.
- Left for F1bb: A1-U03-4, A1-U04-5, A1-U05-3, A1-U06-2, A1-U07-3 (the harness loops) and retiring the boot-only counters.
- Follows: draft D-ADR-1 (gates before engine fixes) and U27b2 (`pre-t4:docs/audit/U27b2-k2a-recheck.md`).

## Context
AGENT_BRIEF §3 says the engine does no per-frame allocation. No existing gate can check that claim.
- `tools/test-play-perf.mjs` reads `heapUsed` after `gc()`. A ~4 KB/frame transient mutant passes all 19/19 of its rows (A1-U09-1).
- The harness zero-gc rows use unforced browser heap deltas, and the m1c "zero buffer allocations" counter is written only in the pool constructor.
- U27b2 showed that a forced-GC/post-GC heap delta is not an allocation detector: about 41.6 MB of churn was hidden that way.
- A1-U25 measured about 10.5 KB/frame on the real play frame using V8's sampling heap profiler.

## Options
1. Keep heap deltas and tighten their thresholds.
2. Count allocations with `--trace-gc` scavenge counts. This is coarse, and its result depends on the semi-space size.
3. Use V8's sampling heap profiler with objects collected by minor and major GC included. This counts transient garbage, but a small retained leak can fall under the budget.
4. Use option 3 plus a separate retained-growth clause: `gc()` before and after N frames, taking the median of 3 rounds.

## Decision
Option 4, implemented in `game/tools/test-alloc-gate.mjs` (run from `game/` with `node --expose-gc`).

**Workload**
- The real `createMoonWorld`, `createPlayFrame` and `ThirdPersonCamera`, bundled with esbuild.
- A stub mesh pool and a stub store.
- The `test-play-perf` drive script, which covers walking and idle.
- 20,000 warm-up frames, then 2,880 measured frames (20 s at 144 Hz).

**Pass rule.** The gate passes only if both clauses hold:
- sampled allocated bytes ≤ **64 B/frame**;
- retained growth ≤ **8 B/frame**.

**Instrument checks**
- **Calibration.** The gate first checks the instrument against known rates: a no-op must read under 0.5 B per iteration, a 3-field object 16–64 B, and a `Float64Array(16)` at least 128 B. If calibration fails, the gate exits 2 (instrument broken). It does not report PASS or FAIL in that case.
- **Self-test** (`--self-test`). Each disposition below must hold:
  - A synthetic zero-allocation frame passes.
  - The churn mutant costs 300–500 B/frame. It fails the allocation clause and leaves the retained clause clean.
  - The leak mutant fails the retained clause.
  - Both mutants are detected when wrapped around the real play frame.
- **Deliberate wrong expectation** (`--deliberate`). Adding it must make the self-test exit 1.

## Why
- 64 B/frame is measurement slack: about 9 KB/s at 144 Hz. That is 6× below the 400 B/frame churn mutant and 160× below today's frame.
- Retained growth must be close to zero. Measured noise on a clean frame is 0.00–0.13 B/frame (walk).
- The two clauses catch different defects:
  - The churn mutant (≈395 B/frame) only fails the allocation clause.
  - A leak of one small object per frame (≈51 B/frame retained, ≈80 B/frame sampled on the synthetic frame) fails the retention clause and would pass a churn-only budget slightly above 80 B/frame.
- Mutants are built from plain objects, because the heap sampler under-counts typed-array payloads. A `Float64Array(42)` read about 200 B instead of more than 336 B, since its payload lives in an off-heap backing store.

## Consequences
- **The current tree is red.** Walk measures 10,527 B/frame and idle 10,728 B/frame. The top sites are:

  | Site | B/frame |
  |---|---|
  | core `terrainHeight` | 4,108 |
  | `noise3` | 1,889 |
  | `sampleSurfaceInto` | 1,649 |
  | `ThirdPersonCamera.poseInto` | 855 |
  | `playFrame` | 457 |
  | `applySkyState` | 195 |

  This is expected until F5a, which must report this gate's numbers before and after the change (§13 safeguard 4). Until then the regression for other tasks is `--self-test` with exit 0, not the plain gate.
- **Open item for F1bb/F5a.** Real-tree idle retained growth read 4.9–8.0 B/frame across runs, which is close to the budget. Whether this is real growth or noise has not been settled. The budget is not raised to hide it. **Settled in F1bca (ADR-004):** the growth was JIT code/metadata in V8's code and trusted spaces after the walk→idle switch; object heap growth is ≈0.12 B/frame. The retained clause now counts the object heap only.
- **Instrument limits.** The gate measures the JS heap only. Off-heap typed-array backing stores and GPU memory are out of scope. It runs in Node, not a browser.
- **Old checks stay until F1bb lands.** The browser harness loops (m1a–m1f) and the boot-only counters are replaced in F1bb. The old rows stay until their replacement exists (§13 safeguard 3).