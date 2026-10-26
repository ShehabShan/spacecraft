# F2e evidence — independent m1e KCC gate (ADR-010)

Run from `game/` by `game/tools/audit/f2e-regress.sh`. Every exit code was captured directly into `exits.txt`, without a pipe.

| File | Content |
|---|---|
| `gate-1.log`, `gate-2.log` | `node tools/test-kcc-gate.mjs`: 13/13, exit 0 |
| `self-test-1.log`, `self-test-2.log` | `--self-test`: 8/8 mutants red as named, exit 0 |
| `deliberate.log` | `--self-test --deliberate`: 8/9, exit 1 (the no-op case must fail) |
| `reg-*.log` | Regression runs: the flight, seam, precision and orbit gates and their self-tests; the alloc-loops self-test; e2e plumbing (`plumbing-summary.json`); typecheck; build; playwright m1e and m1d |
| `protected.diff` | `git diff main -- game/src game/e2e game/playwright.config.ts Milestone Design_specs`: empty |

Key numbers (gate-1.log): smooth-sphere jump KCC 1.920 cm west vs inertial RK4 truth 2.018 cm (error 0.98 mm at 1/60, 0.25 mm at 1/240); zero spin 0; reversed spin exactly negated; real 6.67° site error 9.9 mm (1.6 mm at 1/240); corner walk 30,000 ticks / 4.76 km and steep turn 6,000 ticks / 827 m, every tick observed, grounded clearance 0.02 m within 1.7e-11 m, abs/local error ≤ 9.4e-9 m, yaw residual max 0.0152° (residual/δ² ≤ 0.250, bound 0.5).