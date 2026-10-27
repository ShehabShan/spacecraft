# F2fcaba evidence: rebuilt m1f R2 gate, rows R2a + R2b

- `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r2-gate.mjs` from `game/`, exit 0 both times (unpiped). The unmutated page PASSES R2a and R2b; `mut=theta` fails R2a (4.2e-3 rad) and R2b (159% coverage); `mut=pose` fails R2b (0 px).
- `playwright-r2-and-shipped-m1f.log`: `npx playwright test e2e/m1f-r2.spec.ts e2e/m1f.spec.ts`. The new spec passes with badges ["PASS","PASS"]. The shipped m1f spec shows PASS×4 plus R5 FAIL, the waived row, unchanged.
- `typecheck.log`: `npx tsc --noEmit`, exit 0. The build ran inside each self-test (`build EXIT=0`).
- Before the atan2 fix, the unmutated R2a failed on direction error 2.1e-8 rad (acos floor); see ADR-021 amendment.
