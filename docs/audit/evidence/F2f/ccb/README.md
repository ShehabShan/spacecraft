# F2fccba evidence (session 135, ADR-023)

- `m1f-r3-spec.run1.txt`, `.run2.txt` — `npx playwright test e2e/m1f-r3.spec.ts`, EXIT=0 both. Pinned badges `["FAIL"]`.
- `self-test.run1.txt`, `.run2.txt` — `node tools/test-m1f-r3-gate.mjs`, EXIT=0 both. Unmutated: R3a FAIL with the descending hole [220000, 225647] m and 0 ascending; `?ctl=ref`: R3a PASS (0 holes, dimming 0.010).
- `m1f-shipped-spec.txt` — shipped `e2e/m1f.spec.ts` after the extraction: badges PASS, PASS, PASS, PASS, FAIL. The FAIL is R5 (waived, §8), so exit 1 comes from R5 only.
- Audit tools after the extraction, before the patch: EXIT=1 (all three could not find the controller in the harness source). After the patch, all EXIT=0. u27b3b2a and u27b1 output is byte-identical to the pre-extraction tree; u03 differs only in its cited line numbers.
