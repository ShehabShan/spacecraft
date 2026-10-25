# U27b3b2b2b2b2a — m1a timing/stall gate re-check

- Session 95 · 2026-10-25 · base `9add690` on `a1-engine-audit`.
- Scope: **A1-U08-7 only**. Disposition: **re-confirmed with qualifications; S1 retained**.
- Reviewer: `gpt-6-astra`, returned by the platform usage ledger for this session.
  Historical-majority model provenance remains unverified; this is not a claim
  that the overall U27b different-model requirement is complete.
- Bootstrap: integration-routed checkout/pull, clean tree, HEAD = origin.
  Tracker's `4d0692b` is HEAD's parent, matching its documented convention.
  Plan, NEXT ACTION and session 94 agree; no drift repair needed.
- Split the pending K2d box before execution: this unit handles U08-7;
  `U27b3b2b2b2b2b` retains U03-5, U05-2 and U01-1.

## 1. Pre-source expectations

These were written before reading the harness implementation in this session:

- A callback-start interval ending at callback k cannot measure work first done
  inside callback k. Work in callback k can affect the interval ending at k+1.
- A long interval alone cannot distinguish tab suspension from expensive rebase
  work. Excluding it by duration is not evidence of no rebase stutter.
- Milestone 1A line 90 expressly excludes >250 ms as tab stalls. Separate
  conformance to that stated hygiene from validity of its no-stutter claim.
- Responsive controls must show that sub-cutoff bad timing can fail.
- Timing replay validates collector/verdict logic, not GPU cost, browser
  scheduling or actual production rebase performance.

## 2. Method and evidence boundary

Read the full `Milestone1A_TestHarness.tsx` and original
`tools/audit/u08-m1a-validity.mjs`; read only targeted Milestone 1A passages.
The new probe extracts the actual controller/finalizer (lines 106–280),
advance/rebase detection (402–406) and capture/termination (462–484).
It runs the real `SimulationCore` with independent synthetic callback intervals;
the extracted predicate receives neither the oracle's work labels nor its results.

The clock model was checked against installed, lockfile-pinned dependencies:
`three@0.165.0`'s actual `Clock.getDelta()` with a controlled external time source
charges 80 ms of work after one sample to the following sample
(16.6667 ms then 96.6667 ms including normal cadence). R3F `8.18.0`'s
`dist/events-*.esm.js:1532–1546` samples the clock before calling useFrame
subscribers, then renders. The probe records dependency/source hashes.

For the causal fixtures, extra work after a rebase delays the next callback,
giving total intervals of 40, 80 or 300 ms. No busy wait or browser is involved.
An independent timeline records every interval after one 20-callback warmup
without duration censoring. Its comparison budgets are literal 20/48 ms, not
read from the predicate under test. The actual workload duration is known in
these constructed fixtures; a real following interval alone would not prove it.

Sources at base:
- Harness SHA-256: `97f33017026fc1b38a9462f172ac2acb10b1fb5e202960ca5c0f994546673d3f`
- SimulationCore SHA-256: `234676fa768f5300d7df725294defd8de8331704e9489f7eb2cc22d7643f38f1`

## 3. A1-U08-7 — timing coverage and attribution are unsound

- **Severity:** S1 · **Confidence:** confirmed · **Category:** test/spec
- **Location:** `game/src/test/Milestone1A_TestHarness.tsx:23,115–117,205–227,402–404,462–473`
  @ `9add690`; `Milestone/Milestone 1A.txt:90,1149,1335–1356,1591–1595`.
- **Claim:** stable frame time and “origin shifts cost no stutter frame.”
- **Evidence:** original timing repros re-confirm; new independent probe
  **27/27 twice, exit 0**. Details below.
- **Impact:** severe stalls can coexist with five passing rows, while the
  rebase-specific diagnostic can report the interval preceding the work.
  This weakens the gate; it does **not** establish that real rebases are slow.
- **Proposed fix:** retain all foreground observations, explicitly classify
  visibility/interruption evidence, apply warmup once, and separate total
  frame intervals from measured CPU spans. Validate with injected work and
  controls before replacing the old gate. No RATIFIED engine change needed.
- **Fix size:** one focused timing-gate unit is a candidate for a 50-OLU session;
  U27c must size the browser instrumentation and controls explicitly. If those
  do not fit, land the independent regression checks before gate replacement.

### 3.1 Duration censoring produces a discontinuous false acceptance

One changed interval at callback 60:

| Interval | T5 | Independent timing oracle |
|---|---|---|
| 48 ms | PASS | PASS |
| 48.001 ms | FAIL | FAIL |
| 200 ms | FAIL | FAIL |
| 249.999 ms | FAIL | FAIL |
| **250 ms** | **PASS** | **FAIL** |
| 250.001 ms | PASS | FAIL |
| 1,000 ms | PASS | FAIL |

The `frameMs < 250` condition excludes **exactly 250 ms too**, despite the
spec/comment saying “>250.” Three one-second freezes also pass all five rows.
Nine constructed 300 ms intervals following rebases pass all rows, reporting
16.67 ms worst despite an uncensored mean of **27.1175 ms**.

**Qualification:** exclusion of long intervals is explicitly in the spec; this
is not simply implementation nonconformance. The assumption that duration
identifies tab stalls is what undermines the no-stutter inference.

### 3.2 Attribution is wrong, but short-delay acceptance is not itself a threshold bug

| Total interval after each of nine rebases | T5 | Reported worst rebase-frame | Timeline-attributed worst |
|---|---|---|---|
| 40 ms | PASS | 16.67 ms | 40 ms |
| 80 ms | FAIL | 16.67 ms | 80 ms |
| 300 ms | PASS | 16.67 ms | 300 ms |

The current callback detects its own rebase but tags the delta already measured
before its work. That delta cannot contain its own rebase cost.

**Qualification:** 40 ms is below the declared 48 ms maximum, and its mean
17.4502 ms is below 20 ms. Its PASS is correct under those numeric budgets.
It demonstrates incorrect attribution, not that the predicate must reject
every perceptible hitch. The 80 ms control proves the overall worst-frame
clause can reject delayed callbacks even with wrong rebase attribution.

`rebaseWorst` is only diagnostic: injecting 9,999 ms into that buffer leaves
T5 PASS. Adding `rebaseWorst <= 48` alone would still legitimately accept 40 ms,
and would not solve collection, attribution or causal measurement.

### 3.3 Warmup is applied twice

The collector discards callbacks 1–20, then the finalizer skips the first
20 **stored** intervals again. Without censoring, evaluation begins at
callback **41**, not 21.

A 200 ms interval at callback 30 is stored and appears as a 200 ms rebase
diagnostic, yet all rows pass because the finalizer skips it. The same interval
at callback 41 fails. This is a refinement of U08-7's coverage finding, not
another indexed finding; the 167-finding total is unchanged.

### 3.4 Display-rate dependence needs a narrower interpretation

60, 50 and 144 Hz pass; 30 Hz fails, even without injected rebase work.
That matches the declared average budget, so it is not proof of a physics
error or a wholly invalid performance target. It does mean that this gate
does not isolate the **incremental cost of rebasing** from display cadence,
render cost and scheduling.

## 4. Checked, no issue / responsive controls

- Real-core 60 Hz baseline passes all five extracted rows.
- The 48 ms maximum is inclusive; 48.001 ms fails.
- A 200 ms interval after warmup, and nine 80 ms following-rebase intervals,
  fail T5. It is not universally incapable of failure.
- 50/144 Hz timing passes and 30 Hz fails consistently with the average bound.
- Actual installed Clock/R3F sampling order supports the timing model.
- Deliberately false probe assertion returns **exit 1**, not a green wrapper.
- Typecheck/build succeed; protected source diff is empty.

Not checked: a fresh browser acceptance run, pixels/GPU timing, hidden-tab
behavior, real rebase CPU cost, or universal performance on other machines.
No other K2d or K3–K9 finding is signed off by this unit.

## 5. Commands, outcomes and reproducibility

From `game/`, with logs in
[`evidence/U27b3b2b2b2b2a/`](evidence/U27b3b2b2b2b2a/).
Commands run without pipelines; exit statuses were captured immediately.

| Command | Observed outcome |
|---|---|
| `npm ci` | exit 0; existing dependency warnings retained |
| `node tools/audit/u08-m1a-validity.mjs` | exit 0; 16/18 confirmed, controls OK; both timing claims confirmed |
| `node tools/audit/u27b3b2b2b2b2a-m1a-timing-recheck.mjs` initial | exit 1 before tests; static import ran before loader registration |
| Same, corrected dynamic import | 25/25, exit 0; before clock-calibration checks were added |
| Same, final, twice | **27/27 each, exit 0**; `final-1.log`, `final-2.log` |
| Same with `--self-test` | **27/28, exit 1**, intentional false assertion |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; existing large-chunk warning, no error |
| `git diff --exit-code 256d77d -- src e2e playwright.config.ts ../Milestone ../Design_specs` | exit 0, empty output |

The original's two non-confirmations are unrelated: `M1A-T3-WINDOW` found no
ten-shift threshold case; `M1A-F32-FAR` measured 24 m rather than its >100 m
expectation. Do not equate its exit 0 with all 18 claims proven. They were
already qualified in the prior review; this session re-reviews timing only.

The initial loader failure, subsequent runs and all raw exits are retained.
For Git whitespace checks only, the trailing blank line in `typecheck.log`
was removed; command output content is otherwise unchanged. Its unnormalized
SHA-256 was `9c943822863517f583c01d320fde85d24f6359c0726d653ef825047978d34510`.
No existing probe, production file or acceptance spec was changed.

## 6. Audit-method ADR draft — separate symptoms, causes and exclusions

**Context:** the gate conflates callback intervals with rebase work and infers
tab suspension solely from duration; exclusions hide its worst observations.

**Options:** keep duration filtering and add a diagnostic threshold; attribute
following intervals only; or retain interval coverage and add separately timed
CPU spans plus explicit interruption evidence.

**Decision:** propose the third option for the later fix task. Use following
intervals as correlation/symptom evidence, not a pure rebase-cost measurement.
Apply a single documented warmup and test boundary/exclusion behavior.

**Why:** a following interval also contains rendering, scheduling and other
work. Timing `advance()` measures simulation as a whole, not rebasing alone;
isolating rebasing requires a scoped span or controlled matched comparison.
A hidden page may invalidate a trial, but should not silently turn it green.

**Consequences:** browser instrumentation and injected-work controls are needed
before a gate replacement. No performance target or ratified engine threshold
is changed here. This draft remains in `docs/audit/`, within A1's write rules;
a later fix task can promote it to `docs/decisions/`.

## 7. Handoff

**27/55 S0/S1 reviewed; 28 pending**: K2d has three findings, K3–K9 has 25.
Next: **U27b3b2b2b2b2b**, split before execution starting **A1-U03-5**
(the m1f R5 fixture/rebase requirement), then U05-2 and U01-1.
T1 remains paused. Historical-majority model provenance remains open.