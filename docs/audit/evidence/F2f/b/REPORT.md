# F2fba — attribute the m1f R2 regression inside `3057899` (A1-U01-1)

Session 128, 2026-10-27, branch `f2f-m1f-gate` (on top of F2fa `d06d026`). Method: [ADR-018](../../../../decisions/ADR-018-r2-bisect-method.md). F2fa proved that `3057899` (the F-01..F-12 batch) is the first bad commit for R2.

## Question
Which change inside `3057899` turns the R2(b) Sun ground-truth footprint from 99% into 0 px?

## Instrument
- `game/tools/audit/f2fb-make-variant.py <wt> <variant>` builds a git worktree at `3057899`. In `Milestone1F_TestHarness.tsx` it reverts exactly one expression group to its `c0ae8bf` text. It matches the text exactly and exits 3 if the hunk is not found exactly once, so no variant can silently end up as an unedited tree.
- Each variant ran unedited under `game/tools/audit/f2fa-m1f-observe.mjs <wt>/game <port> 1200` on the bot VM (v2, 2 vCPU, headless Chrome with software GL).
- The runs were sequential. `node_modules` was shared, because `package-lock.json` is byte-identical (`cmp` exit 0).
- `tsc --noEmit` returned exit 0 on every variant worktree.

## Variants (all on `3057899`)
| Variant | What is reverted to the `c0ae8bf` text | Still in place |
|---|---|---|
| `F12sun` | the whole F-12 Sun-pose hunk: position `drv − O` → `drv`, and up `drv/‖drv‖` → `(0,1,0)` | F-01, F-02, F-03, F-07, the F-12 probe hunk |
| `F12sunPos` | position only: `lookAtQuatInto` eye/target and `sunPose.{x,y,z}` go back to the absolute `drv` | radial up, everything else |
| `F12sunUp` | up only: back to `(0,1,0)` | render-local position `drv − O`, everything else |

## Runs
| Variant | Run | Observer exit | Badges R1..R5 | R2 Sun footprint / centre offset |
|---|---|---|---|---|
| `F12sun` | 1 | 0 | P **P** P P F | 1,372 px = 98.9%; 0.71 px |
| `F12sun` | 2 | 0 | P **P** F P F | 1,372 px = 98.9%; 0.71 px |
| `F12sunPos` | 1 | 0 | P **P** P P F | 1,372 px = 98.9%; 0.71 px |
| `F12sunPos` | 2 | 0 | P **P** F P F | 1,372 px = 98.9%; 0.71 px |
| `F12sunUp` | 1 | 0 | P **F** P P F | **0 px = 0.0%; 999 px (sentinel)** |
| `F12sunUp` | 2 | 0 | P **F** F P F | 0 px = 0.0%; 999 px |

Observer exit 0 means a verdict was captured. It does not mean the gate passed. R5 fails in every run and stays waived. Raw logs are `observe-<variant>[-run2].log`, and the exit codes are in `exits.txt`.

## Result
- **The R2 regression is the F-12 change of the R2(b) Sun readback pose *position*, from absolute `drv` to render-local `drv − O`.** Reverting that expression alone restores R2 twice. The result is identical to `c0ae8bf`: 98.9%, 0.71 px.
- The up-vector change (radial instead of `(0,1,0)`) is innocent. With only the up vector reverted, R2 still fails twice with a 0 px footprint.
- F-01 (sky observer `+O`), F-07 (the LIVE fixed-step accumulator), F-02/F-03 and the F-12 probe hunk stay in place in every passing variant. So none of them is needed to cause the R2 failure. The live instance count (8 here vs 9 at `c0ae8bf`) does not decide R2.
- **Not established yet:** the mechanism, and which pose is *correct*. At `3057899`, `applyRenderState(px,…)` stages the sky with `obs = moonAbs + O + px`, which treats `px` as local. That is consistent with the F-12 intent, so the absolute pose may pass only by accident. This is the F2fbb question.

## Side finding
R3 failed in 3 of 6 runs. Every failing run showed a silhouette A/B "100.00% of the 0-px disk", meaning the impostor/mesh disk was not drawn in that A/B render. The failures span all variants and touch none of the reverted lines, so the new R3 gate must handle the 0-px case explicitly.