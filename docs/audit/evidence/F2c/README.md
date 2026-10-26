# F2c evidence — independent cross-face seam gate (ADR-008)

Session 112, 2026-10-26, branch `f2c-seam-gate` cut from `main` @ bcdc980. VM v2 has 2 vCPU and 4 GB. `npm ci` exited 0.

| File | Content |
|---|---|
| `gate-1.log`, `gate-2.log` | `node tools/test-seam-gate.mjs`: 14/14, exit 0 on both runs |
| `self-test-1.log`, `self-test-2.log` | `--self-test`: 42/42, exit 0 on both runs |
| `deliberate.log` | `--self-test --deliberate`: 42/43, exit 1 (the no-op case is reported as not caught, as intended) |
| `reg-*.log` | Regression runs: precision gate and self-test, orbit gate and self-test, alloc-loops self-test, e2e plumbing, playwright m1c, typecheck, build |
| `exits.txt` | Every exit code, recorded unpiped |
| `fixture-config.json`, `observations.json`, `playwright.json`, `summary.json` | e2e-plumbing output: 60/60 expected dispositions, mismatches 0 |
| `source-sha256.txt` | Hashes of the terrain, worker and m1c harness sources |
| `protected.diff` | `git diff --stat main -- src e2e playwright.config.ts`: 0 bytes, so no game, spec or config change |

## Baseline measurements on the real worker (TEST_PLANET, R = 5,000 m)

| Measure | L0 | mixed |
|---|---|---|
| Shared points per edge | 31 × 12 | 63 × 12 |
| Faces per corner | 3 × 8 | 3 × 8 |
| Cross-face coincident pairs | 396 | 818 |
| Cross-face normal-bit mismatches | 0 | 0 |
| Max cross-face position deviation | 0.188 mm | 0.120 mm |
| Same-face pairs (T-junction pairs) | — | 940 (69) |
| Max same-face position deviation | — | 0.112 mm |
| Max chart-direction error | 2.9e-8 | 1.4e-8 |

The mixed figures match the recheck: 818 cross-face pairs, 0.120 mm and 940 same-face pairs. All 32 recheck edge/corner fault fixtures are red on `mixed:cross-normal-bits` or `mixed:cross-position`.