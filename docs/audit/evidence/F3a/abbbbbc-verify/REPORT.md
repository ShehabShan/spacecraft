# Verification of 764f839 (F3abbbbbc), session 125

Trees: f3a-catalog 764f839 and main 8e82819 (neither moved), separate worktrees, `npm ci` exit 0, `npx playwright install --with-deps chromium` exit 0.
Regress: a copy of game/tools/audit/f3abbbbbc-regress.sh with `E=` pointed at /tmp/verify-<tree> (`regress-copy.sh`), run from game/ in each tree, sequentially (`verify-driver.sh`).
Exit columns: first value = full regress run, then the extra repeat runs. main "N/A" = the tool does not exist on main ("Cannot find module").

| check | committed exit | fresh f3a exit(s) | main exit(s) | verdict |
|---|---|---|---|---|
| spin-law run1 | 0 | 0 | N/A | PASS |
| spin-law run2 | 0 | 0 | N/A | PASS |
| spin-law --self-test | 0 | 0 | N/A | PASS |
| spin-law --self-test --deliberate | 1 | 1 | N/A | PASS (exit 1 expected) |
| rail-validation run1 | 0 | 0 | N/A | PASS |
| rail-validation run2 | 0 | 0 | N/A | PASS |
| rail-validation --self-test run1 | 0 | 0 | N/A | PASS |
| rail-validation --self-test run2 | 0 | 0 | N/A | PASS |
| rail-validation --self-test --deliberate | 1 | 1 | N/A | PASS (exit 1 expected) |
| real-body-data | 0 | 0 | N/A | PASS |
| real-body-data --self-test | 0 | 0 | N/A | PASS |
| scale-law | 0 | 0 | N/A | PASS |
| scale-law --self-test | 0 | 0 | N/A | PASS |
| orbit-gate | 0 | 0 | 0 | PASS |
| orbit-gate --self-test | 0 | 0 | 0 | PASS |
| kcc-gate | 0 | 0 | 0 | PASS |
| kcc-gate --self-test | 0 | 0 | 0 | PASS |
| flight-gate | 0 | 0 | 0 | PASS |
| flight-gate --self-test | 0 | 0 | 0 | PASS |
| seam-gate | 0 | 0 | 0 | PASS |
| seam-gate --self-test | 0 | 0 | 0 | PASS |
| precision-gate | 0 | 0 | 0 | PASS |
| precision-gate --self-test | 0 | 0 | 0 | PASS |
| shape-probe | 0 | 0 | N/A | PASS |
| alloc-loops --self-test run1 | 0 | 0 | 0 | PASS |
| alloc-loops --self-test run2 | 0 | 0 | 0 | PASS |
| alloc-gate --self-test | 1 | 0,0,0,0 | 0 | PASS |
| test-play-spawn | 1 | 0,0,0,0 | 0 | PASS |
| test-play-world | 1 | 0,0,0,0 | 0 | PASS |
| test-play-shell | 0 | 0 | 0 | PASS |
| test-play-frame | 1 | 0,0,0,0 | 0 | PASS |
| test-play-controller | 0 | 0,1,1,1,1,1,1,1,1,0,0,0,1,0 (9/14 exit 1) | 0,0,1,0,1,0,1,1,1,0,1,1,1,1 (9/14 exit 1) | FLAKY (pre-existing: fails 9/14 on main too) |
| test-play-lod | 0 | 0 | 0 | PASS |
| test-play-rig | 0 | 0 | 0 | PASS |
| test-play-anim | 0 | 0 | 0 | PASS |
| test-play-perf | 0 | 0 | 0 | PASS |
| typecheck | 0 | 0 | 0 | PASS |
| build | 0 | 0 | 0 | PASS |
| e2e-plumbing | 0 | 0 | 0 | PASS |
| playwright m1b | 0 | 0 | 0 | PASS |

## Findings
- a) The STATE line of 764f839 is true on the real tip: orbit gate 9/9, orbit self-test 22/22, alloc-gate self-test 8/8 (4/4 runs), play spawn/world/frame/lod exit 0 (spawn/world/frame 4/4 runs). Its cited evidence was not: the committed `abbbbbc/exits.txt` came from an earlier tree (its frame log fails the old `< 31` check, its alloc log shows `self_test=6/8`). The full regress on the final tree now exits 0 for every non-deliberate check.
- b) test-play-controller fails only the camera heap delta check (`dh < 64 * 1024`, test-play-controller.mjs:382). It is a pre-existing FLAKE, not a regression: 9/14 runs fail on 764f839 and 9/14 on main. Deltas are bimodal (+66 to +122 KB fail, negative or under ~52 KB pass), which points to GC timing.
- c) Both loosened checks would fail at their old thresholds on every run. Frame: Earth is 31.93° off axis in all 4 runs, old limit `< 31` (main: 26.89°). Alloc: the f3a tip used `real_churn_recorded` in all 4 runs with real-churn deltas +217.7, +216.7, +178.3, +175.8 B/frame; the strict `real_churn_detected` needs >= 0.8 x churnCost (synthetic churn 385-390 B, so about 308-312 B). main used `real_churn_detected` (+1433.1 B/frame) with its older {x,y,z} mutant.
- d) Not a clean "safe to merge" by the strict rule, for one reason: test-play-controller is FLAKY (same rate on main, so 764f839 did not cause it). Everything else exits 0. To get a clean pass: stabilise the camera heap delta check (F3a follow-up 5). Merging also accepts the two loosened checks; the frame one depends on the Lead's spawn Earth-position answer.

## Addendum: controller heap check fixed (session 125, Lead request)
- Cause: the camera zero-GC block measured 10k frames with no warm-up, so one-off JIT/IC tiering (+66 to +122 KB) landed in the delta. It does not scale with frames: cold 50k frames gave 88.4 / -563.3 / 112.8 KB, the same size as cold 10k, so it is not a leak.
- Probe (`controller-fix/probe/`): a 2000-frame warm-up (as the other zero-GC check in the file already does) gave 0/14 failures at 10k (-9.4 to +19.9 KB), and 50k warmed stayed at 1.2-19.7 KB.
- Fix: game/tools/test-play-controller.mjs adds that warm-up; the 64 KB threshold is unchanged.
- After the fix (`controller-fix/after-fix/`): 764f839 + fix exits 0 in 14/14 runs (57/57, -14.2 to +24.6 KB); main + the same fix exits 0 in 5/5 (not committed to main).
- Full regress with the fix (`controller-fix/regress-after-fix/`): non-deliberate checks not exiting 0: none.
- Updated merge recommendation: safe to merge by the Lead rule (every non-deliberate check exits 0); the two loosened checks still need the Lead to accept them.
