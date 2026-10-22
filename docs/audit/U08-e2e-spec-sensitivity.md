# A1-U08 — m1a harness + e2e plumbing (PARTIAL)

**Status: PARTIAL (session 60, 2026-10-22).** The e2e spec mutation results for `e2e/m1b.spec.ts` are complete and recorded below. The m1a harness review and the per-spec mutation runs for m1a and m1c–m1f were **not done**; see "Not yet checked". The U08 box in `docs/A1-plan.md` stays unticked.

Plan question (`docs/A1-plan.md` U08): do the specs fail on a wrong badge, a missing badge, a timeout and a page error?

## Method

Probe: `game/tools/audit/u08-spec-sensitivity.sh` and `game/tools/audit/u08-spec-mutate.mjs`.

- The script copies `game/` (without node_modules, dist and test-results) to a scratch directory, `/tmp/u08lab`, and symlinks node_modules. The repo tree is never edited.
- For each mutation it restores the original `src/test/Milestone1B_TestHarness.tsx` and applies ONE mutation with `u08-spec-mutate.mjs`.
- It then runs the REAL `e2e/m1b.spec.ts` under the REAL `playwright.config.ts`: Chrome channel, with `npm run build && vite preview` as the webServer.
- Each exit code is recorded unpiped (`echo $?` after a redirect only) to `/tmp/u08out/<mutation>.exit`.
- Environment: PromptQL VM v2 (2 vCPU / 4 GB), Chrome at `/opt/google/chrome/chrome`. The whole run took 75.6 s.

## Results (m1b spec)

| Mutation | What it injects | Spec exit | Caught? |
|---|---|---|---|
| baseline | none | 0 | (control: passes, 5 × PASS) |
| badgefail | row `m1a-regression` forced `pass:false`, verdict line forced PASSED | 1 | ✅ line 28 `no FAIL badge may remain` |
| timeout | suite never auto-runs (`elapsedTime > 1e9`) | 1 | ✅ `waitForEvent` 20 000 ms timeout |
| pageerror | uncaught `throw` right after `publishSuite` | 0 | ❌ captured as `pageerror: U08-injected pageerror`, never asserted |
| consoleerror | `console.error` before the verdict line | 0 | ❌ captured in the transcript, never asserted |
| norows | verdict PASSED, `results: {}` published | 0 | ❌ badges `["·····"×5]` |
| droprow | one TEST_ORDER row removed | 0 | ❌ 4 badges instead of 5 |
| typeerror | `const x: number = 'not a number'` in the harness | 0 | ❌ `vite build` does not type-check; `tsc --noEmit` on the same copy exits 2 (TS2322, line 388); clean-tree `tsc` exits 0 |

## Findings

### A1-U08-1 — Page errors and console errors are collected but never asserted
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** gate sensitivity
- **Location:** `game/e2e/m1b.spec.ts:7-8, 26-28`. The same pattern is in m1a/m1c/m1d/m1e/m1f (grep: the `pageerror` listener and the three identical `expect` lines).
- **Claim:** the specs fail on a page error.
- **Evidence:** the `pageerror` and `consoleerror` mutations both exit 0. Each injected error appears only in the printed transcript.
- **Impact:** a harness that throws after (or before, if the verdict still prints) its verdict passes the gate.
- **Proposed fix:** after the verdict, `expect(consoleLines.filter(l => /^(pageerror|error):/.test(l))).toEqual([])`.
- **Fix size:** XS (2 lines per spec).

### A1-U08-2 — A missing result passes: placeholder badges and dropped rows are not detected
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** gate sensitivity
- **Location:** `game/e2e/m1b.spec.ts:21, 27-28`; `game/src/test/Milestone1B_TestHarness.tsx:1127-1128` (placeholder `·····` uses the same `.badge` class).
- **Claim:** the specs fail on a missing badge.
- **Evidence:** `norows` passes with five `·····` badges; `droprow` passes with 4 badges. The spec only checks `length > 0` and the absence of the substring `FAIL`.
- **Impact:** the gate passes whenever the harness prints PASSED, whatever the rows show.
- **Proposed fix:** `expect(badges).toEqual(Array(N).fill('PASS'))` with N being each milestone's row count.
- **Fix size:** XS.

### A1-U08-3 — The gate trusts the harness's own PASSED line, which carries no cross-checkable values
- **Severity:** S2 · **Confidence:** high (citation) · **Category:** gate design
- **Location:** `game/e2e/m1b.spec.ts:26`; `Milestone1B_TestHarness.tsx:654-659` (literal `{…}`, see A1-U07-5).
- **Claim:** the e2e gate independently verifies the acceptance result.
- **Evidence:** the line-26 assertion is `toContain('PASSED')`. The `badgefail` mutation shows that the badge check is the only independent signal, and A1-U08-2 shows that signal is weak.
- **Impact:** combined with A1-U08-2, the gate passes whenever the harness prints PASSED.
- **Proposed fix:** fix A1-U08-2, plus print the real values in the verdict line (A1-U07-5).
- **Fix size:** XS.

### A1-U08-4 — The gate build does not type-check, and there is no CI
- **Severity:** S2 · **Confidence:** high (repro) · **Category:** build plumbing
- **Location:** `game/playwright.config.ts:16` (`npm run build && npx vite preview`); `game/package.json:8` (`"build": "vite build"`); no `.github/workflows`.
- **Claim:** a passing gate implies a type-correct build.
- **Evidence:** the `typeerror` mutation exits 0. `npx tsc --noEmit -p .` on the same copy exits 2.
- **Impact:** type errors reach a green gate unless someone runs `npm run typecheck` by hand.
- **Proposed fix:** set the webServer command to `npm run typecheck && npm run build && npx vite preview --port 4173`, or `"build": "tsc --noEmit && vite build"`.
- **Fix size:** XS.

## Checked, no issue
- Wrong badge with PASSED verdict (`badgefail`) → caught by line 28.
- Harness never reaches a verdict (`timeout`) → caught: `TimeoutError: page.waitForEvent: Timeout 20000ms exceeded`.
- Clean tree: m1b passes with 5 × PASS and no page errors; `tsc --noEmit` exits 0.
- All six specs (m1a–m1f) carry byte-identical assertion lines; only the `waitForEvent` timeout differs: 30/20/150/120/90/240 s. Found by grep, not by mutation run.

## Not yet checked (carry to next session)
1. **m1a harness review**: `game/src/test/Milestone1A_TestHarness.tsx` (766 lines). Can each row fail when its claim is broken? Use the U07 probe style.
2. **Mutation runs for the other specs**: run `u08-spec-sensitivity.sh` against m1a, m1c, m1d, m1e and m1f. The script is m1b-only; it needs a harness-path/spec parameter, and each harness needs its own mutation anchors. This is needed to confirm A1-U08-1/2 by repro rather than by grep. m1c, m1d and m1f are slow (timeouts of 150/120/240 s), so budget for them.
3. **Badge text change**: e.g. a harness rendering `OK`/`ERR` instead of `PASS`/`FAIL`. A1-U08-2 predicts this passes, but it has not been run.
4. **Plumbing**: whether `reuseExistingServer:false` plus a port already in use fails loudly; whether `npm test` (all specs, `workers:1`) propagates a single spec failure; the global `timeout: 300_000` against m1f's 240 s wait plus build time.
5. Ticking the U08 box, the task.md row 8/27, and a final commit.