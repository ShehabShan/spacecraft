# F2fa — bisect of the m1f R2 regression (A1-U01-1)

Session 127, 2026-10-27, branch `f2f-m1f-gate` cut from `main` `2232e9d`. Method: [ADR-018](../../../../decisions/ADR-018-r2-bisect-method.md).

## Question
R2 (Sun ground-truth footprint) has failed in every recorded run since `3057899` ("F-01..F-12 batch"). Is `3057899` the first bad commit?

## Runs
Each commit ran unedited in its own git worktree. `package-lock.json` is byte-identical at both commits and on `main`, so `node_modules` was shared. The machine was the bot VM (v2) with headless Chrome rendering in software at 3–10 fps.

| Commit | Run | Instrument | Verdict | Badges R1..R5 | R2 Sun footprint / centre |
|---|---|---|---|---|---|
| `c0ae8bf` (= `3057899^`) | 1 | shipped `e2e/m1f.spec.ts` | **none**: the 240 s wait expired | — | — |
| `c0ae8bf` | 1 | `f2fa-m1f-observe.mjs` | FAILED after 262.1 s | P P P P F | 1,372 px = 99.1% of π·r²; 0.71 px |
| `c0ae8bf` | 2 | `f2fa-m1f-observe.mjs` | FAILED after 264.9 s | P P P P F | 1,372 px = 99.1%; 0.71 px |
| `3057899` | 1 | shipped `e2e/m1f.spec.ts` | FAILED | P **F** P P F | (spec log has no row detail) |
| `3057899` | 1 | `f2fa-m1f-observe.mjs` | FAILED after 231.6 s | P **F** P P F | **0 px = 0.0%; 999.00 px (sentinel)** |

Raw logs are in this folder (`gate-*.log`, `observe-*.log`). The exit codes are in `exits.txt`. `gate-c0ae8bf-run2-ABORTED.log` is a partial run: its job was stopped deliberately once run 1 had shown that the shipped spec times out at `c0ae8bf`. It is not evidence.

Two more facts from the row details:
- R2(a) counts **9** live instances at `c0ae8bf` and **8** at `3057899`.
- R5 fails at both commits. It stays under the Lead's waiver, so the whole-suite verdict is FAILED at both and does not decide the bisect (ADR-018).

## Result
- **`3057899` is the first bad commit for R2. This is confirmed, no longer just "likely".** Its only parent, `c0ae8bf`, passes R2 twice with an identical Sun disk (99.1% footprint, 0.71 px offset). `3057899` fails R2 twice: the footprint is zero and the centre is the 999 px sentinel. Nothing else differs between the two: same machine, same spec, same lockfile.
- Not established yet: which change inside the batch causes it. The suspects are F-12 (Sun and probe suite poses moved to render-local `drv − O` with radial up) and F-07 (the LIVE fixed-step accumulator changes the walk's end pose). U27's visibility controls point at the spin group. Attribution is F2fb.
- Side finding: at `c0ae8bf` the shipped 240 s spec budget is shorter than this machine's time-to-verdict, so on this machine the shipped spec cannot produce a verdict there.