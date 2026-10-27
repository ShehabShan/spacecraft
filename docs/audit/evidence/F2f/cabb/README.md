# F2fcabb evidence: rebuilt m1f R2 gate, row R2c + its two mutants

- `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r2-gate.mjs` from `game/`, exit 0 both times (unpiped), identical rows. Unmutated page: R2a, R2b, R2c PASS. R2c: camera raised to 17.00 m above the analytic ground after 4 poses (2, 7, 12 m rejected), Sun 35.00°, terrain horizon 17.25°, mesh raycast clear, composite 492 px vs ideal 451.0 (109.1%), centre error 0.00 px.
- Mutants: `mut=horizon` (clearance proof bypassed; Sun 10° at the most occluded of 24 azimuths, horizon 75.78°) R2c FAIL with 0 px. `mut=noray` (raycast skipped, camera clamped 0.3 m under the mesh, which sits 14.32 m above the analytic field at the site) R2c FAIL with 0 px, although the analytic horizon test alone said clear (23.41° < 33°). `theta` and `pose` still fail their rows.
- `playwright-r2.log`: `npx playwright test e2e/m1f-r2.spec.ts`, exit 0, badges ["PASS","PASS","PASS"], 6.4 s.
- `typecheck.log`: `npx tsc --noEmit`, exit 0. The build ran inside each self-test (`build EXIT=0`).
- No shared module, shipped harness row or shipped spec was edited, so the shipped m1f spec was not re-run (brief §3 binds only when shared modules change).
