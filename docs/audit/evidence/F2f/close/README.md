# F2f close-out evidence (session 142, ADR-026)

Run from `game/` on branch `f2f-m1f-gate`.

- `plumbing-run1.txt` + `plumbing-run1/`: `node tools/test-e2e-plumbing.mjs --out …` → 80/80 expected dispositions (8 clean PASS, 72 defects rejected at the intended assertion), mismatches 0, PLUMB_EXIT=0.
- `plumbing-mutant-6ce1d08.txt` + dir: `--specs-from 6ce1d08` (pre-F1a specs) → 31 MISMATCH lines, MUT_EXIT=1 (expected; the mutant control must fail).
- `m1f-r-specs-run.txt`: `npx playwright test e2e/m1f-r --reporter=line` → 5 passed, SPECS_EXIT=0 (R1/R2/R5 green; R3 and R4 pinned known-red vectors hold).
- `npm run typecheck` → TSC_EXIT=0.