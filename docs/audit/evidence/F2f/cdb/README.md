# F2fcdb evidence: rebuilt m1f R4 rows R4b (allocation) and R4c (retention)

Session 139, 2026-10-28, VM v2 (2 vCPU / 4 GB), headless Chrome via Playwright 1.64, ADR-024 amendment.

| File | What it shows |
|------|---------------|
| `probe-run1-before-fixes.log` | First driven run. R4b calibration f64x16 read 112.7 B/iter, below the node bound of 128, because Chrome keeps the Float64Array backing store off the V8 heap. R4c calibration read 0 because the minifier dropped the write-only `push`. Render retention read [37.4, 8.7, 2.2], with the first round warming caches. |
| `probe-run2-mut-{none,churn,leak}.log` | The same probe after the three fixes (holders on `window.__r4hold`, f64 bound ≥ 64, one warm retention round). |
| `selftest-run1.log`, `selftest-run2.log` | `node tools/test-m1f-r4-gate.mjs`: 6 cases each, all AS EXPECTED, exit 0 both times. |
| `spec-m1f-r4.log` | `npx playwright test e2e/m1f-r4.spec.ts`: 1 passed, exit 0, badges ["PASS","FAIL","PASS"]. |
| `tsc.txt` | `npx tsc --noEmit`, exit 0. |

## Measured, unmutated

| Row | Result | Detail |
|-----|--------|--------|
| R4a | PASS | — |
| R4b | FAIL, `fails: [render]` only | Pure frame path 53–54 B/frame against a budget of 64. The `executePasses` render path is 1,618–1,647 B/frame over 300 renders. Top sites: three.js `setFromProjectionMatrix` ~730 B, three.js render internals ~230 B, and MultiCameraRig ~187 B. |
| R4c | PASS | Pure median 0.0 B/frame. Render median −0.1 B/frame. One render round read 8.8–13.1 B/frame; the median absorbs it. |

The calibration read noop 0.02, obj3 24.0–24.1, f64x16 112–113 and the retained control 24.3 B/iter, all ok. **Finding F2fcdb-1:** the shipped render path allocates about 1.6 KB per frame. Its cause is not isolated beyond the sampled call sites above.

## Mutants

| Mutant | R4a | R4b | R4c |
|--------|-----|-----|-----|
| `churn` | — | pure 152 B/frame, `fails: [pure, render]` | PASS (transient, not retained) |
| `leak` | — | pure 91 B/frame, `fails: [pure, render]` | FAIL, pure median 24.5 and render median 19.9 B/frame |
| `replace` | FAIL `[bodies[5]]` | — | — |
| `realloc` | FAIL `[attr aDisk.array]` | — | — |
| no driver (`&wait=3000`) | — | FAIL "instrument missing" | FAIL "instrument missing" |