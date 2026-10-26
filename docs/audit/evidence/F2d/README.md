# F2d evidence — independent m1d flight gate (ADR-009)

Run from `game/`. Every exit code was captured directly (`exits.txt`), without a pipe.

| File | Content |
|---|---|
| `gate-1.log`, `gate-2.log`, `gate-3.log` | `node tools/test-flight-gate.mjs`: 12/12 exit 0. Run 3 was after the harness fix. |
| `self-test-1.log`, `self-test-2.log` | `--self-test`: 8/8 mutants red as named, exit 0 |
| `deliberate.log` | `--self-test --deliberate`: 8/9, exit 1 |
| `reg-*.log` | Regression runs: the seam, precision and orbit gates and their self-tests; the alloc-loops self-test; e2e plumbing at 60/60 with 0 mismatches (json files copied here); typecheck; build; playwright m1d |
| `reg-playwright-m1d-before.log` | playwright m1d with the old requested-time deadline: exit 1. T2 FAILED: min post-tick AGL 65.57 m, 0 contacts, so the ship was still airborne at the deadline (A1-U05-2 reproduced in the real browser on 2 vCPU). |
| `reg-playwright-m1d.log` | After the tick-time deadline fix: exit 0, 5/5 PASS, v@1000 = 264.7 m/s |
| `protected.diff` | The diff of `game/src`, `game/e2e` and `playwright.config.ts` against `main`. It touches only the `Milestone1D_TestHarness.tsx` dive deadline. |
| `source-sha256.txt` | Hashes of the production atmosphere, flight controller and terrain field. The gate re-checks them after the mutants and finds them unchanged. |

Baseline numbers:
- Density point error 0, straddle error 3.3e-15. Mach error 0. Wind vector error 0 over 20 cases.
- Ridge: 1 contact, the tick ends at +3 m.
- Real terrain: 4,096 trials, 950 contacts, 0 interior violations.
- Dive: lands after 18 s of physics time at 60/30/15/10 fps, against 18.1/24.1/48.3/72.4 s of requested time. v@1000 = 264.749 m/s, peak 1,999.96 m/s, and the 1,076-sample trace is identical at every frame rate.
