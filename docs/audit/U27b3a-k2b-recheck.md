# A1-U27b3a — K2b e2e plumbing re-check

**DONE, 2026-10-25, session 87.** Base `af725c1`; read-only A1.
Scope: **A1-U08-1, A1-U08-2, A1-U08-9 only**. All three re-confirmed,
S1 retained. Review total: **11/55**, 44 pending; no additional finding IDs.

Reviewer: **GPT-6 Astra (`gpt-6-astra`)**, verified from this bot's platform
`llm_usage` records; see `U27b3a-evidence/environment.json`. The model of the
majority of original audit units remains unverified. This unit does **not**
certify completion of the cross-model condition.

## 1. Independent contract and method

The following contract was written before running the probes:

> A passing acceptance gate requires a completed suite, every required result
> present and explicitly PASS, and no unexpected uncaught page error or
> console.error before completion. A PASSED log alone is not evidence of these
> properties. Fixed expected row counts must be independent of the page under
> test. Complete PASS must pass; FAIL, FAILED verdict, zero rows and no verdict
> must fail. Missing rows, placeholder/ERR badges and runtime errors must also
> fail even with a PASSED log.

**Source-claim qualification:** archived assembly brief §3.7
(`pre-t4:notes/archive/AGENT_BRIEF-assembly.md:183–193`) explicitly requires collecting
console messages, asserting PASSED and scraping badges. It does **not** explicitly
require zero errors or every badge to equal PASS. Thus the original U08 report's
wording “the specs fail on a page error” and “brief §3.7 asserts every row passed”
overstates the historical text. These remain independently demonstrated
**gate-quality gaps**, not failures to implement an explicit sentence of §3.7.

Two evidence layers:

1. Re-run the **original** U08 mutation tools unchanged on fresh scratch copies,
   using real harnesses, real specs and the real build/preview configuration.
   No original tool or protected repository file is edited.
2. New `game/tools/audit/u27b3a-k2b-recheck.mjs`: copy the six real spec files
   byte-for-byte into a fresh temporary directory and run them against
   deterministic HTML fixtures in real Chrome. SHA-256 equality is checked
   before and after, against both copies and repository originals.
   A separate browser observer checks completion, exact PASS text, fixed expected
   counts, errors and verdict. It does not copy the spec's assertion logic.

Fixture counts are fixed in the new probe: A/B/D/F = 5, C = 4, E = 6.
These match the harness `TEST_ORDER` declarations at A:591, B:1100, C:787,
D:960, E:1391, F:1597, but are not read from the fixture.
Nine cases × six specs = 54 executions, repeated in a fresh process.

**Intentional environment differences:** fixture configuration omits Vite/build
and WebGL, serves an ephemeral loopback port, and uses a 30 s outer test timeout.
Chrome channel, headless, one worker and zero retries are explicit. Spec-local
event waits/assertions are unchanged. Errors are emitted **before** the acceptance
log, not after a race-prone timeout. Independent observation and actual spec
transcripts must both contain the error token or exact badge array. Negative
controls must fail at the intended assertion, not at setup.

## 2. Results

### Original tools, actual harnesses

All child exit codes below are captured directly, without pipes. The original
shell runners themselves return 0 after their loop; that does **not** mean all
child tests passed.

| Actual page / mutation | Exit | Observed evidence |
|---|---:|---|
| m1b baseline | 0 | Five PASS badges |
| m1b pageerror | 0 | `pageerror: U08-injected pageerror` in transcript |
| m1b consoleerror | 0 | `error: U08-injected console.error` in transcript |
| m1b norows | 0 | Five `·····` badges |
| m1b droprow | 0 | Four PASS badges instead of five |
| m1b badgefail | 1 | Four PASS + one FAIL; fails `no FAIL badge may remain` |
| m1b timeout | 1 | Acceptance wait times out at 20,000 ms |
| m1a baseline | 0 | Five PASS badges |
| m1a pageerror | 0 | Injected pageerror in transcript |
| m1a badgeerr | 0 | Five ERR badges; verdict forced PASSED |
| m1a badgefail | 1 | Five FAIL badges; intended badge assertion rejects |
| m1a nolog | 1 | Acceptance wait times out at 30,000 ms |
| m1d baseline | 1 | `PASS,FAIL,PASS,PASS,PASS`; acceptance FAILED |
| m1d badgeerr | 0 | Five ERR badges; acceptance forced PASSED |

The two m1d runs both report `v@1000m=264.7 maxDv=10.30 rebases=8 recv=46
geo=151 burnHeap=0B`. The existing governor-dive failure remains underneath the
presentation mutation. This is not a green m1d baseline or a repaired engine.

The real m1a/m1b baseline transcripts also contain an unattributed resource-404
console error. They are not error-free controls; the fixture baseline is.
Its cause was not investigated in this unit.

### Independent unchanged-spec matrix

Identical outcomes on **two runs**:

| Fixture | Specs accepting / 6 | Independent oracle | Interpretation |
|---|---:|---|---|
| Complete PASS, no errors | 6 | PASS | Positive control |
| One literal FAIL | 0 | Reject | Negative control |
| FAILED verdict | 0 | Reject | Negative control |
| Zero badges | 0 | Reject | Negative control |
| Uncaught error before PASSED | 6 | Reject | U08-1 false pass |
| console.error before PASSED | 6 | Reject | U08-1 false pass |
| All placeholder badges | 6 | Reject | U08-2 false pass |
| One required badge missing | 6 | Reject | U08-2 false pass |
| All ERR badges | 6 | Reject | U08-9 false pass |

Per run: **6 clean accepts + 18 correct rejects + 30 false accepts**.
Independent observer rejects all 48 defective fixtures. All **54/54 expected
dispositions** matched; audit wrapper exit **0**. Raw Playwright exit **1** is
expected because the matrix includes 18 deliberately failing controls.
This includes m1f's **plumbing**, not its real renderer/harness acceptance.

## 3. Finding dispositions

### Re-check: A1-U08-1 — runtime errors are recorded, not asserted
- **Disposition:** re-confirmed. **Severity:** S1. **Confidence:** confirmed.
  **Category:** test.
- **Location:** `game/e2e/m1b.spec.ts:7–8,26–28` at `af725c1`; all six specs
  have the same listener/assertion pattern (`source-anchors.log`).
- **Claim:** independent contract requires rejection of unexpected runtime errors;
  historical §3.7 claim is qualified above.
- **Evidence:** original m1b page/console error and m1a pageerror mutations exit 0;
  both error classes falsely accepted by all six unchanged specs, twice.
- **Impact:** green gate does not establish an error-free execution.
- **Proposed fix:** capture errors separately and assert them at an explicit suite
  completion boundary, before closing the page. Resolve baseline resource errors,
  or narrowly allowlist individually justified messages; never suppress all errors.
  A late error after the chosen boundary remains outside that boundary.
- **Fix size:** one session shared with U08-2/-9; no ratified engine math change.
  Keep 1F work within its later task authorization.

### Re-check: A1-U08-2 — missing and incomplete results pass
- **Disposition:** re-confirmed. **Severity:** S1. **Confidence:** confirmed.
  **Category:** test.
- **Location:** `game/e2e/m1b.spec.ts:21,27–28`;
  `game/src/test/Milestone1B_TestHarness.tsx:1100–1106,1122–1128` at `af725c1`.
- **Claim:** every required acceptance result must be present and complete.
- **Evidence:** real m1b five placeholders and four-row mutations exit 0;
  both fixture classes accepted by all six specs, twice.
- **Impact:** partial/unfinished result publication can receive a green gate.
- **Proposed fix:** wait for completed results, then compare exact required row
  identities and explicit PASS states against a test-owned manifest. Fixed counts
  plus exact PASS would close these repros, but identities also prevent a duplicate
  row from substituting for a missing one. Do not take expected count from the
  page being tested.
- **Fix size:** same one-session plumbing task; no engine behavior change.

### Re-check: A1-U08-9 — ERR is accepted because only substring FAIL is rejected
- **Disposition:** re-confirmed. **Severity:** S1. **Confidence:** confirmed.
  **Category:** test.
- **Location:** final `badges.join(' | ').not.toContain('FAIL')` assertion in
  `game/e2e/m1a.spec.ts:30` and the other five specs at `af725c1`.
- **Claim:** acceptance must establish explicit successful results, not merely
  absence of one failure spelling.
- **Evidence:** original m1a ERR mutation and genuinely red m1d presentation
  mutation both exit 0; all six fixture specs accept ERR twice.
- **Impact:** a failing/error presentation can be reported as accepted.
- **Proposed fix:** exact PASS states plus required identities as above, retaining
  adversarial ERR/placeholder/missing-row controls.
- **Fix size:** same plumbing task. No threshold or R5-waiver change.

## 4. Commands and verification

From `game/`, original reproductions (each LAB/OUT was a fresh `mktemp -d`):

```sh
LAB=<fresh-lab-b> OUT=<fresh-out-b> \
MUTS="baseline pageerror consoleerror timeout badgefail norows droprow" \
sh tools/audit/u08-spec-sensitivity.sh

LAB=<fresh-lab-a> OUT=<fresh-out-a> \
PLAN="m1a:baseline,badgefail,badgeerr,pageerror,nolog m1d:baseline,badgeerr" \
sh tools/audit/u08b-spec-sensitivity.sh

node tools/audit/u27b3a-k2b-recheck.mjs ../docs/audit/U27b3a-evidence/independent
node tools/audit/u27b3a-k2b-recheck.mjs ../docs/audit/U27b3a-evidence/independent-repeat
npm run typecheck
npm run build
```

The new probe refuses an existing output directory: reruns must use a new path.
The old scripts delete LAB/OUT, so always provide fresh scratch directories.

| Verification | Unpiped exit / result |
|---|---|
| `npm ci` | 0; reports 2 dependency vulnerabilities (1 moderate, 1 high), not modified |
| Original m1b / generic runners | 0 each; child exits in table above and raw summaries |
| Independent probe / repeat | 0 each; 54/54 expected dispositions each |
| Raw mixed fixture Playwright runs | 1 each, intentional 18 negative controls |
| `npm run typecheck` | 0 |
| `npm run build` | 0; existing >500 kB chunk warning |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` (repo root) | 0, empty |

Evidence directory: `docs/audit/U27b3a-evidence/`.
Original per-case logs and exits are in `original-b/` and `original-a/`.
Independent directories hold observations, actual Playwright JSON reports,
child process exits, source hashes, configuration and validated summaries.
`verification-exits.json` records outer verification results. Text `.log` files
have trailing spaces and excess terminal blank lines removed after the initial
staged whitespace check exited 2; content and outcomes are unchanged. JSON
browser/process evidence is preserved without that normalization.
A preliminary read command exited 2 because `/bin/sh` did not expand a Bash
brace glob; the corrected wildcard read succeeded. No file changes resulted.

## 5. Checked, no issue / limits

- Literal FAIL, FAILED verdict and zero badges really reject in all six specs.
- Missing acceptance event rejects in the original m1a/m1b timeout controls.
- Complete, error-free fixture pages pass in all six specs.
- Spec originals and their scratch copies have matching hashes before/after.
- Protected-source diff remains empty; no production test/config edits.
- No fresh full m1c/m1e/m1f harness run. Original m1f GPU mutation residual stays
  open; this fixture run does not resolve its timeout/performance question.
- No K2c/K2d or K3–K9 sign-off, no physics/pixel quality claim.
- Port-conflict/npm-test propagation checks were not rerun.
- No new production fix or replacement gate has landed.

## 6. Audit-method ADR draft — deterministic boundary controls

**Context:** harness rendering/timing can mask test-plumbing defects.
**Options:** rerun only costly harnesses; clone assertions; or execute unchanged
spec files against deterministic browser fixtures alongside real harness repros.
**Decision:** the third option; preserve byte-identical specs and use an
audit-only configuration/server with recorded browser observations and exits.
**Why:** tests the real gate rather than a copied interpretation; positive and
negative controls distinguish intended rejection from setup failure.
**Consequences:** certifies plumbing only, not engine/GPU acceptance. Retain real
harness evidence and residuals separately. This is an audit-method decision, not
authorization to replace tests; draft stays under `docs/audit/` per A1 write rules.

## 7. Handoff

Next: **U27b3b**, split remaining K2c (15) / K2d (4) into session-sized units,
beginning with K2c m1f row-validity findings. Then K3–K9, U27c fix tasks and the
Lead summary. Preserve historical model-provenance uncertainty.