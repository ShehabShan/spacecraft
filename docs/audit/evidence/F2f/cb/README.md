# F2fcb evidence — rebuilt m1f R1 gate (ADR-022)

Session 133, 2026-10-27, VM v2 with 2 vCPU and 4 GB, branch `f2f-m1f-gate` at 0ae81e6 plus this unit.

- `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r1-gate.mjs`. The result was `SELFTEST_EXIT=0` both times.
  - Unmutated: R1a and R1b PASS. gap/δ is 1,523 for the probe pair, 11,342 for boots/ground, and 705,619 for hill/Earth. The front share is 100% at all 5 poses and the determinism diff is 0 bytes. In the counterfactual the probe pair fuses (0.00%), while boots and the hill stay at 100%.
  - `planes`: R1a FAIL, with probe gap/δ 0.0076 and hill/Earth 3.5046. R1b FAIL, with the probe front share at 0.00%.
  - `assign`: R1a FAIL, because the probe pair lies outside the Near planes and its gap/δ is 0.0756. R1b FAIL, with the probe front share at 0.00%.
- `spec.log`: `npx playwright test e2e/m1f-r1.spec.ts e2e/m1f-r2.spec.ts`. Result: 2 passed, `SPEC_EXIT=0`, with m1fR1 badges PASS×2 and m1fR2 badges PASS×3.
- `npx tsc --noEmit -p .`: exit 0. `vite build`: exit 0, inside the self-test.
- The shipped m1f spec was not re-run. No shared module changed; the only shared edit is one new `main.tsx` static-map entry.