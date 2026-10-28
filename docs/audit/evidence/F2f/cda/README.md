# F2fcda evidence — rebuilt m1f R4a (boot identity), ADR-024

Session 138, 2026-10-28, branch `f2f-m1f-gate`, VM v2 2 vCPU/4 GB, headless Chrome.

| File | Command (from `game/`) | Exit |
|---|---|---|
| `tsc.txt` | `npx tsc --noEmit -p .` | 0 |
| `selftest-run1.log` | `node tools/test-m1f-r4-gate.mjs` | 0 |
| `selftest-run2.log` | `node tools/test-m1f-r4-gate.mjs` | 0 |
| `spec-m1f-r4.log` | `npx playwright test e2e/m1f-r4.spec.ts` | 0 |

The self-test results were the same in both runs:
- Unmutated: R4a PASS. It compared 75 references with `===` and found 0 changed. GPU counts held
  (geometries 3→3, textures 1→1, programs 3→3).
- `mut=replace`: R4a FAIL with exactly `[bodies[5]]` changed, while the shipped shape predicate held.
- `mut=realloc`: R4a FAIL with exactly `[attr aDisk.array]` changed, while the shipped shape
  predicate held.

The two mutant cases are the A1-U03-4 blind spot. A same-shaped replacement passes the shipped
shape check, and the rebuilt row catches it.