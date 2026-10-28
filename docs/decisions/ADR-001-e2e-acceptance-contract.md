# ADR-001 — Strict e2e acceptance contract for the milestone specs

- Status: ACCEPTED (session decision under AGENT_BRIEF §13) · Task: F1a · Date: 2026-10-26
- Closes: A1-U08-1, A1-U08-2, A1-U08-9 (cluster K2b, `docs/audit/FINDINGS.md`; recheck `pre-t4:docs/audit/U27b3a-k2b-recheck.md`)
- Follows: draft D-ADR-1 ("independent gates before any engine fix", `docs/audit/U26-adr-drafts.md`)

## Context
The six specs `game/e2e/m1a…m1f.spec.ts` recorded page errors and console errors but never asserted them. They accepted any badge text except the literal `FAIL`, and they accepted any number of badge rows above zero. U27b3a showed that the unchanged specs give 30 false passes in a 9-case fixture matrix. Uncaught errors, `console.error`, placeholder badges, a dropped row and `ERR` badges all passed in all six specs. The real m1a/m1b baselines also logged a console error: `Failed to load resource … 404`, which was not explained. A strict error assertion would turn those baselines red.

## Options
1. Patch each spec in place with extra `expect` lines (six copies of the same logic).
2. Add one shared helper, `game/e2e/gate.ts`, that every spec calls with its tag, page, budget and fixed expected row count. Resolve the baseline 404 at its source.
3. As option 2, but allowlist the 404 message pattern in the error assertion.
4. Rewrite the harnesses so that they emit a machine-readable verdict.

## Decision
Option 2.

A page passes only if all of these hold:
- it logs `[<tag>] acceptance PASSED`;
- it raises no `pageerror` and no `console.error` at any time;
- it renders exactly `expectedRows` badge rows (the `TEST_ORDER` length, fixed in the spec: A5 B5 C4 D5 E6 F5);
- every badge reads exactly `PASS`.

The 404 came from Chrome's automatic `/favicon.ico` request: `game/index.html` declared no icon and the repo has no `public/` directory. The probe recorded the response `http://localhost:4173/favicon.ico → 404`, and it was the only error on both baselines. `index.html` now declares an empty `data:` icon, so the request no longer happens. The error assertion has no allowlist.

## Why
- One helper means one contract. A later gate change cannot drift between specs.
- An allowlist would hide any future resource failure that matches the same message. Removing the request leaves the assertion strict.
- Expected row counts are fixed in the specs, not read from the harness. So a harness that drops a row cannot also lower the bar.
- Option 4 would edit six ~1,000-line harnesses. That is a larger change than K2b needs. The harnesses stop being the acceptance authority claim by claim as F1b–F2f land their independent Node gates (D-ADR-1).

## Consequences
- Regression gate: `node game/tools/test-e2e-plumbing.mjs --out <NEW dir>` (run from `game/`). It extends the U27b3a matrix with a `resource404` case, for 10 cases × 6 real specs = 60 runs. The clean fixture must pass in all six specs. Each of the 54 defect runs must fail at its intended assertion label. An independent browser observer confirms what each fixture contains.
- Mutant control: `--specs-from 6ce1d08` (the pre-F1a specs) must exit 1.
- A spec that truly fails now fails earlier and louder. A harness with a pre-existing red row (for example the m1d governor dive) stays red for the same reason as before.
- The m1f R5 waiver (AGENT_BRIEF §8) is not changed. The waiver lives in task verification, not in the spec. The m1f spec was already red on R5 and stays red.
- New badge texts such as `SKIP` or `N/A` would now fail. Any future harness that needs them must change this ADR.

## Amendment (2026-10-28, F2f close-out, ADR-026)
The shipped `m1f.spec.ts` is archived. The plumbing gate now runs the three rebuilt 1F specs on this contract (`m1f-r1`, `m1f-r2`, `m1f-r5`) in its place: 10 cases × 8 specs = 80 runs, exit 0; the `--specs-from 6ce1d08` mutant control still exits 1. `m1f-r3`/`m1f-r4` pin known-red vectors with their own assertions and are outside the matrix.
