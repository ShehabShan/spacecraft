# ADR-026 — Retire the shipped m1f acceptance rows R1–R5 (F2f close-out)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F2f close-out · Date: 2026-10-28
- Completes F2f (U27c §2) under the Lead directive naming 1F (APPROVAL LEDGER, session 115b).
- Builds on ADR-005 (retire, do not delete), ADR-021…ADR-025 (the rebuilt R2, R1, R3, R4, R5 gates) and ADR-001 (e2e contract).

## Context
The shipped 1F harness (`?page=m1f`, `game/src/test/Milestone1F_TestHarness.tsx`, TEST_ORDER 5 rows) and its spec `game/e2e/m1f.spec.ts` were the m1f regression. A1 found every row weak or blind: R1 overlap audit (A1-U02), R2 tautological θ audit and the 0-px Sun (A1-U01-1, U02), R3 threshold tuned to pass (A1-U03-2/-3), R4 accepting a same-shaped replacement and N/A heap readings (A1-U03-4), and R5 sampling the Sun only on rebase frames with Sat B allowed off-screen (A1-U03-5/-6). F2f rebuilt each row as an independent gate on its own page and spec: `?page=m1fR1`…`m1fR5`, `game/e2e/m1f-r1…r5.spec.ts`, each with mutants in a self-test. Safeguard 3 of AGENT_BRIEF §13 ("the new independent check lands first") is therefore met for all five rows.

The shipped page is still used for other things: manual mode `?page=m1f&manual=1` (T1 browser checks b4/b5) and the audit/diag tools under `game/tools/`.

## Options
1. Delete the shipped rows and the spec.
2. Edit the shipped rows to call the new gates.
3. Archive the shipped spec (so the Playwright run no longer gates on it) and leave the page and its rows verbatim, with a WHY comment marking them retired. The regression becomes the five rebuilt specs.

## Decision
Option 3.
- `game/e2e/m1f.spec.ts` → `pre-t4:notes/archive/m1f.spec.ts` (`git mv`, byte-identical; history intact). Playwright's `testDir` is `e2e`, so it no longer runs.
- `Milestone1F_TestHarness.tsx`: rows unchanged; a WHY comment above TEST_ORDER names this ADR. The page stays for manual mode and the tools.
- The m1f regression is `npx playwright test e2e/m1f-r` (five specs). Known-red pins ride inside the specs: R3 pins `['FAIL','FAIL','FAIL']` (the A1-U03-1 descending hole [220000, 225647] m and finding F2fccbb-1, impostor ~1.35× mesh area), R4 pins `['PASS','FAIL','PASS']` with R4b failing only its render clause (finding F2fcdb-1, `executePasses` ~1.6 KB/frame). R1, R2, R5 are green. A pinned spec passes only while the measured defect is exactly the pinned one; a fix must re-pin it.
- The e2e plumbing gate (ADR-001, `game/tools/test-e2e-plumbing.mjs`) replaces the m1f spec with the three rebuilt specs on the `runAcceptanceGate` contract (m1f-r1/r2/r5): 10 cases × 8 specs = 80 runs. R3/R4 use their own pinned assertions, not the contract, so they are not in that matrix.

## Why
- Never delete the Lead's work (§13 safeguard 1): the spec is archived and the rows are kept as written.
- Editing shipped rows was ruled out for every F2f unit; the page is a dependency of manual mode and tools.
- A spec that gates on rows A1 proved blind gives false confidence; the claims now live where they are measured.

## Consequences
- The R5 waiver (§8) needs no spec carve-out any more: the rebuilt R5 is green. Only the Lead lifts the waiver itself.
- F8a (handoff controller) must re-pin R3; any fix to F2fcdb-1 or F2fccbb-1 must re-pin R4/R3.
- ADR-001 regression count is now 80 runs (amended there). The pre-F1a mutant control (`--specs-from 6ce1d08`) still exits 1.
- ADR-005's open item for m1f R4 is closed (R4b/R4c via CDP, ADR-024).