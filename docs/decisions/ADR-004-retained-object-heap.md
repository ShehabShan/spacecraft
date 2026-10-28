# ADR-004 — Retained clause counts the JS-object heap, not JIT code spaces (F1bca)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F1b part F1bca · Date: 2026-10-26
- Amends ADR-002 and ADR-003 (same budgets: sampled ≤ 64 B/frame, retained ≤ 8 B/frame). Settles the ADR-002 "open item": play idle retained growth 4.9–9.3 B/frame.

## Context
The play gate's idle run read retained growth just over the 8 B/frame budget (this session before the change: 8.59 B/frame, `pre-t4:docs/audit/evidence/F1b/idle-retained/gate-before.log`), while walk read ≈0. ADR-002 left open whether this was real growth or noise, and said the budget is not raised to hide it.

## Investigation
Probe `game/tools/alloc-idle-probe.mjs` (same world and drive as the gate) runs 10 consecutive gc-bracketed rounds of 2,880 frames and splits the retained delta by V8 heap space (`v8.getHeapSpaceStatistics`):
- Idle after the 20,000-frame walk warm-up: old_space +0.12 B/frame every round, nothing else (`p_idle.log`).
- Walk: rounds 1–4 grow 1.7 → 10.5 B/frame, almost all in `code_space` + `trusted_space` (JIT code and bytecode/feedback metadata); round 5 frees it (−3.4); rounds 6–9 read old_space +0.12 only (`p_walk.log`).
- Idle under `--jitless`: +0.12 B/frame old_space, no code-space growth (`p_jl.log`).
So the idle "retained growth" is V8 tiering re-optimising after the walk→idle workload switch, not a per-frame object leak. The real object-heap growth is ≈0.12 B/frame (well under budget, and flat across rounds).

## Options
1. Raise the retained budget above ~10 B/frame — rejected: hides a real 8–10 B/frame leak.
2. Warm idle longer before measuring — fragile: tiering timing depends on machine and Node version.
3. Count only the JS-object heap spaces (new/old/large-object/…) and exclude code_space and trusted spaces — chosen.

## Decision
`objectHeapUsed()` in `game/tools/alloc-lib.mjs` sums `space_used_size` over all heap spaces except `code_space`, `code_large_object_space` and the `trusted*` spaces. The retained clause in `test-alloc-gate.mjs` and `test-alloc-loops.mjs` uses it instead of `process.memoryUsage().heapUsed`. Budgets unchanged.

## Why
Per-frame object leaks (the defect the clause exists for) are allocated in new space and promoted to old space, so they are still counted; JIT code is not game state and is freed by V8 on its own schedule.

## Evidence (`pre-t4:docs/audit/evidence/F1b/idle-retained/`)
- Gate on the current tree, two runs: walk alloc 10538.9/10538.4 B/frame, retained 0.00/0.15; idle alloc 10736.1/10734.5 B/frame, retained 0.08/0.03. Retained clause now PASS on both; GATE still FAIL exit 1 on the allocation clause (expected until F5a/F7a).
- Gate `--self-test` 8/8 exit 0: real-frame leak mutant still +39.99 B/frame retained → FAIL; churn +1424 B/frame → FAIL; synthetic leak 49.35 → FAIL.
- Loops `--self-test` exit 0: leak mutants +39.98/+40.00 B/tick on integrateFlight/integrateTick still FAIL on retained.
- Gate `--self-test --deliberate` 8/9 exit 1 (the deliberately wrong row mismatches).

## Consequences
- The retained clause no longer reports JIT-tiering noise; it cannot see code-space leaks (e.g. unbounded `new Function`). None exist in the game; if one is ever suspected, the probe still prints per-space deltas.
- Off-heap typed-array stores remain out of scope (ADR-002).
