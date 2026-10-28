# A1 U27b3b2a — K2c M1F R3 gate re-check

- Date/session: 2026-10-25 / 89. Base: `0826c26`.
- Scope: **A1-U03-2 and A1-U03-3 only**. Both remain **S1, confirmed**, with qualifications below. This completes one split unit, not all remaining K2.
- Reviewer: platform-reported **GPT-6 Astra (`gpt-6-astra`)**, recorded in `U27b3b2a-evidence/platform-meter-start.json`. Historical-majority model provenance remains unverified; this is not overall cross-model sign-off.
- Bootstrap: integration-proxied clone, checkout `a1-engine-audit`, pull `--ff-only`; clean HEAD matched origin. Tracker's `3081cd6` was the intentional parent-hash convention. Plan/NEXT agreed; **no drift repair needed**.
- All evidence paths below are relative to this directory. No game, milestone, design-spec or existing probe edits; no new libraries.

## 1. Method and scope of evidence

Expected properties were written before reading the R3 implementation in
[`claims-before-source.md`](U27b3b2a-evidence/claims-before-source.md).
Source was then checked against `pre-t4:Milestone/Milestone 1F.txt:70–86,1973–2050`
(targeted passages, not the whole file), and the original repro was read and rerun.

New probe: `game/tools/audit/u27b3b2a-r3-recheck.mjs`.
It uses TypeScript's AST to extract the **actual** unit/live loops, final Boolean
conjunction, pixel classifier, `updateProbes`, trace-recording expression and draw
visibility predicates from `Milestone1F_TestHarness.tsx`. It does not import/run
the React harness. Expected properties, draw-output mutations and synthetic RGBA
fixtures are independently designed; the expected projected radius uses elementary
perspective geometry, not engine math helpers.

**Evidence boundary:** scalar/trace tests supply `symPct=0` to isolate those
clauses. Pixel tests supply synthetic bytes to the actual classifier. Draw-output
mutations modify local fixture records, not the GPU or engine files. Passing the
extracted conjunction is **not a fresh full R3/browser PASS**. Historical pixels
are explicitly reused from U01; no fresh GPU run was needed to establish the
predicate blind spots. R4/R5 output from the shared original probe is not sign-off
on those findings.

## 2. Dispositions

| Finding | Disposition | Decisive evidence |
|---|---|---|
| A1-U03-2 | Re-confirmed S1, qualified | Actual update/trace and draw predicates disagree on 120 inbound samples; scalar/live holes remain 0. Hidden/full draw-output mutants give 4,020 omissions/double-full samples without changing the scalar/trace verdict. Other R3 terms demonstrably fail. |
| A1-U03-3 | Re-confirmed S1, qualified | Equal isolated 69-pixel disks pass; isolated missing/shifted/enlarged disks fail. Bright-background fixtures pass even with missing, shifted or enlarged targets. Historical U01 records 25,600 foreground pixels and zero symmetric difference. Empty masks correctly fail. |

### 2.1 A1-U03-2 — complementary bookkeeping does not test actual contributions

- **Severity / confidence / category:** S1 / confirmed / test.
- **Location @ base:** `game/src/test/Milestone1F_TestHarness.tsx:604–646`
  (state/update), `:843–846,875–878` (submitted visibility/opacity), `:1166–1187`
  (unit/live predicates), `:1255–1256` (conjunction), `:1515` (trace).
- **Claim:** no holes or double-full frames during the handoff.
- **Independent expectation:** rendered contributions must be measured separately,
  including visibility and state. If `m=1-i`, `m+i=1`; both values cannot be
  ≤0.01 or ≥0.99. This proves the unit counters are unreachable, not that the
  whole R3 verdict is constant.
- **Evidence:** 20 alternating traversals ×201 samples = 4,020 samples, on the
  actual gate's 200–300 km domain. The extracted update/trace gives flips=21,
  maxSlope=0.0001359879789631857, holes=0, doubles=0, liveHoles=0. The separately
  extracted visibility predicates expose **120 inbound omissions, zero outbound**.
  The trace contains only `d,mesh,imp`, with `mesh` storing an alpha, not a state.
  Forcing both fixture draw submissions hidden/full produces respectively
  **4,020 omissions / 4,020 double-full samples**, still accepted with a supplied
  matching-silhouette scalar.
- **Responsive controls:** a non-complementary live trace `(mesh=0,imp=0)` fails
  (`liveHoles=1`); missing either distance crossing fails; frozen mesh state fails
  (`flips=0`); step fade fails (`maxSlope=0.002`).
- **Correction to interpretation of original repro:** original M1 has flips=1,
  and M2 has maxSlope=0.002, so **both fail the complete conjunction elsewhere**.
  They establish hole-counter blindness only. The old `renderedSweep` also extends
  beyond the gate's distance domain; this new probe uses the gate's exact domain.
  Live R3(b) is not inherently unable to fail: its shipped trace producer makes
  the hole predicate unreachable. There is no live double-full counter.
- **Impact:** the advertised coverage invariant is untested, despite functioning
  flip/slope/range checks; this masks U03-1's independently established handoff gap.
- **Proposed fix:** preserve responsive controls; record actual visibility and
  contribution inputs independently and test both directions, including states
  inside the incoming hole. Add hidden/full mutations as failing controls. This
  proposal changes no ratified band or engine behavior.
- **Fix size:** one gate-focused session with independent checks landing before
  replacement; controller repair remains a separate task if it cannot fit.

### 2.2 A1-U03-3 — scene brightness can masquerade as target agreement

- **Severity / confidence / category:** S1 / confirmed / test.
- **Location @ base:** same harness `:1189–1220` (A/B setup),
  `:1221–1252` (red>8 masks and symmetric difference), `:1255–1256` (verdict).
  Historical record: `pre-t4:docs/audit/U01-evidence/gate-run1.log:23`.
- **Claim:** mesh-only and impostor-only silhouettes match to sub-pixel precision.
- **Independent expectation:** establish target-specific, plausible coverage before
  comparing it. For an on-axis radius 1,800 m at eye distance 232,000 m, 62° vertical
  FOV and 720-pixel height, `r=f*tan(asin(R/d))=4.648645 px`, area=67.889495 px.
  The actual eye/body distance must be used in a future GPU gate; 232,000 here is
  an explicitly defined control, not a claim of exact live observer distance.
- **Evidence from actual classifier:**

  | Synthetic A/B fixture | `totA` | `sym` | `symPct` | Current classification |
  |---|---:|---:|---:|---|
  | Same isolated disk on black | 69 | 0 | 0 | Pass, valid control |
  | Isolated disk vs absent disk | 69 | 69 | 100 | Fail |
  | Isolated disk shifted 2 px | 69 | 36 | 52.17 | Fail |
  | Isolated disk with doubled radius | 69 | 208 | 301.45 | Fail |
  | Both masks empty (background 0 or 8) | 0 | 0 | 100 | Fail |
  | Uniform background red=9 or red=90 | 25,600 | 0 | 0 | False accept |
  | Red=90 background; target absent / shifted 20 px / doubled | 25,600 | 0 | 0 | False accept, each |
  | Bright background vs a 69-pixel dark target-sized hole | 25,600 | 69 | 0.2695 | False accept |

  The last case demonstrates **denominator dilution**, even without identical
  all-ones masks. A target-sized discrepancy falls below the 3% threshold when
  background supplies the denominator. This is part of the same finding, not a
  new ID.

  Historical U01 dump: `meshR=90.27 impR=90.27 totA=25600 sym=0`, exactly consistent
  with the 160×160 mask being fully classified as foreground in both images.
  This was reread and hash-recorded, not re-rendered.
- **Qualifications:** the classifier is **not universally tautological**: empty
  masks, isolated omissions and displaced disks do fail. “Nothing measured since
  3057899” is too broad: unchanged source and a recorded saturated run do not
  establish every later pose/device/run, the responsible background object, or a
  bisected regression boundary. Saturation can hide differences that stay on the
  same side of the threshold; sufficiently large below-threshold differences can
  still fail. No fresh screenshot/full-suite result is claimed here.
- **Impact:** background contamination can certify a missing or incorrect target.
- **Proposed fix:** isolate the target using an object-ID mask or target-only
  render, assert plausible coverage for **both** representations, then compare.
  An area check alone is necessary but not sufficient: another object can have
  the same area. Retain absent/shifted/enlarged, empty and bright-background controls;
  calibrate pixel/AA tolerances independently. The probe's ±25% area sanity check
  is for binary on-axis fixtures, **not a production tolerance decision**.
- **Fix size:** one gate-focused session for isolation/coverage and adversarial
  controls; broader distance/transition sampling should be split if needed.
  No ratified threshold is changed by this audit.

## 3. Checked, no issue / not checked

- Actual 21-flip and smooth-fade checks remain responsive; retain them.
- Outbound visibility sweep has no holes in this control domain.
- A manually non-complementary trace correctly triggers the live-hole check.
- Low/high coverage clauses fail when the corresponding samples are removed.
- Pixel threshold uses strict `>8`; `totA=0` yields 100%, not a false PASS.
- Matching isolated geometric coverage passes; missing/shifted/enlarged cases fail.
- **Not checked:** fresh WebGL behavior, full M1F verdict, R4/R5 findings, other
  K2 members, or historical-majority reviewer identity. No implicit approvals.

## 4. Audit-method ADR draft — observe contributions and isolate target identity

- **Context:** copied loops and one historical screenshot can overstate whether a
  whole gate is blind, especially when other clauses remain responsive.
- **Options:** rerun old repro alone; rerun the full GPU suite; extract actual
  predicates and test independent positive/negative controls.
- **Decision:** use extracted predicates plus independent draw/byte fixtures and
  explicitly labeled historical pixel evidence for this unit. Keep future
  object-ID/coverage gate changes proposed only.
- **Why:** deterministically distinguishes unreachable bookkeeping predicates from
  working controls without conflating scene setup with classification.
- **Consequences:** no fresh GPU verdict or renderer-mutation claim. A future fix
  needs end-to-end target isolation and tests before old gates are retired.
  Stored here because `docs/decisions/` is outside A1 write rules; no production
  architecture decision is enacted.

## 5. Verification and handoff

Commands are unpiped; return codes observed directly. Logs and command metadata
are under `U27b3b2a-evidence/` (`verification.json`, SHA-256 source manifest).

| Command (from `game/` unless stated) | Result | Exit |
|---|---|---:|
| `npm ci` | Installed locked dependencies; 1 moderate + 1 high vulnerability reported; no dependency fixes | 0 |
| `node tools/audit/u03-r3r4r5-validity.mjs` | Original 22/22; only U03-2/-3 dispositions reviewed here | 0 |
| `node tools/audit/u27b3b2a-r3-recheck.mjs` (twice) | Independent **26/26 ×2** | 0, 0 |
| `npm run typecheck` | Clean | 0 |
| `npm run build` | Built; existing >500 kB chunk warning | 0 |
| Root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | Empty protected-source diff | 0 |

Two more findings reviewed: **16/55 reviewed, 39 pending**. Next:
**U27b3b2b** remaining K2c ten / K2d four; split before execution, beginning
M1E U04-1/-3/-4. Then remaining K3–K9 and U27c → Lead gate. T1 stays paused.