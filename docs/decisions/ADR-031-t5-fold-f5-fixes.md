# ADR-031 — T5: fold fix tasks F5a–F5d into T5

Status: accepted (session 157) · Task: T5 PLAN (Scope IN) · Authority: §13 (technical decision); T5 definition in `notes/task.md` ("the planner decides, with an ADR, whether to fold them into T5 or run them first")

## Context
T5 puts the play Moon at R = 1,737 km. The open U27c §2 fix tasks F5a (per-body terrain service), F5b (normals, height bound), F5c (drawn vs collision agreement) and F5d (pool, drop accounting, leaf budget) must land before R changes (`docs/T5-T6-ideas.md` §0). They edit the same modules T5 rebuilds: `terrainField.ts`, `terrainWorker.ts`, `TerrainMeshPool.ts` and `MoonLod.ts`. Fix tasks normally run on their own branch and fast-forward into `main`. `t5-bigger-moon` is already cut from `main` @ 787b9d4.

## Options
1. Run F5a–F5d first as four fix tasks, each merged into `main`, then rebase T5. F5d's leaf budget would be built for the 341-node preallocated tree that T5 replaces with a lazy one, so it would be written twice and its gates re-pinned twice.
2. Fold all four into T5 as its first build steps on `t5-bigger-moon` (chosen).
3. Fold F5a and F5b only and run F5c and F5d after T5. F5c's agreement check and F5d's budget are needed at real size, so T5 could not finish DONE without them.

## Decision
- F5a, F5b, F5d and F5c are T5 build steps, in that dependency order (U27c §2: F5b needs F5a; F5d needs F5a; F5c needs F5b). F5d is designed for the lazy quadtree. F5c's agreement gate is re-run at the final R.
- Each folded step takes its U27c §2 definition and verification as its acceptance, and its commit names the fix id it closes. The T5 tracker row records the closed ids.
- F5c's "lower lunar relief" item (ledger 2026-10-22) is replaced by the metre-scale crater ladder step.
- F3a follow-up (4), the strict real-tree churn check in `test-alloc-gate` that waits for F5a, lands in the F5a step.

## Why
The fixes and T5 rewrite the same files. Folding avoids building and gating code on `main` that T5 replaces immediately. `main` still changes only by merging a finished task (§13 safeguard 5), and §12-sized steps keep every commit a checkpoint.

## Consequences
- `main` gets F5a–F5d only when T5 merges. Until then the plain alloc-gate stays red on `main`, as ADR-002 expects.
- If T5 stops midway, its finished F steps are a prefix of the branch history, and `main` can be fast-forwarded to that commit.
- Step sizing, verification and gate re-pins for these steps are written in the T5 plan Steps section.