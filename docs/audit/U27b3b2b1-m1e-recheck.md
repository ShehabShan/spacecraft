# U27b3b2b1 — m1e Coriolis, clearance and yaw gate re-check

- Task: A1, read-only; session 90, 2026-10-25; branch `a1-engine-audit`.
- Audited base: `6823d42`; protected source identical to `256d77d`.
- Scope: **A1-U04-1, A1-U04-3, A1-U04-4 only**, all retained S1.
- Reviewer: platform-reported **GPT-6 Astra (`gpt-6-astra`)**; evidence:
  `U27b3b2b1-evidence/platform-meter-model.json`. Historical-majority model
  provenance remains unresolved; this is not overall cross-model completion.
- Resume reconciliation: clean HEAD = origin; tracker parent-hash convention,
  first unchecked box and NEXT ACTION agreed. No progress drift to repair.
  Split the requested residual box before execution: this unit is the three
  m1e findings; `U27b3b2b2` retains seven K2c and four K2d findings.

## Method and evidence

Expectations were written before reading implementation this session in
`U27b3b2b1-evidence/claims-before-source.md`. Read the full m1e harness and original
U04 probe; inspect KCC teleport/reset, tick, jump, sweep and landing paths.
Milestone text was searched selectively, not read wholesale.

New probe: `game/tools/audit/u27b3b2b1-m1e-recheck.mjs`.
It extracts actual harness setup and row functions with unique-anchor assertions,
strips TypeScript via esbuild, and runs the real KCC without a renderer.
Geometric clearance, injected yaw angle and endpoint separation are observed
independently of gate telemetry. R5's predicate is source-extracted; its reference
integrator uses independent vector arithmetic and RK4. No on-disk source mutants.

Raw logs, exit files, source SHA-256 manifest and verification results:
[`U27b3b2b1-evidence/`](U27b3b2b1-evidence/).

| Command (working directory) | Observed result / exit |
|---|---|
| `npm ci` (`game/`) | 0; dependency audit warnings retained in log |
| `node tools/audit/u04-m1e-validity.mjs` (`game/`) | **1, 20/21**; targeted checks reproduced; unrelated R4 M-LEAK did not falsely pass in these three trials |
| `node tools/audit/u27b3b2b1-m1e-recheck.mjs` (`game/`), first attempt | **1, 27/28**; slope mutation scheduled after the row ended; injection-count assertion caught it |
| Same independent command, corrected attempts 2 and 3 | **0, 28/28 twice** |
| `npm run typecheck` (`game/`) | 0 |
| `npm run build` (`game/`) | 0; existing >500 kB chunk warning |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` (root) | 0, empty |
| `git diff --exit-code 6823d42 -- game/tools/audit/u04-m1e-validity.mjs` (root) | 0, original probe unchanged |
| `git diff --check` (root) | 0 |

The failed first independent attempt remains recorded: R2 has 600 ticks, not
650. The corrected fault is at tick 550, within its cliff subtest (511–600).
No failed output is silently counted as a pass. The original probe's unrelated
readonly-canary statement was already refuted by U27b2 and is not endorsed here.

## A1-U04-1 — re-confirmed S1, with reference-physics qualifications

**Category:** test. **Confidence:** confirmed for the measurement/predicate defect.

**Location:** `game/src/test/Milestone1E_TestHarness.tsx:677–746`
(launch up, tilt subtraction, prediction, verdict);
`game/src/core/physics/astronautKCC.ts:589–608` (launch along terrain normal).
Spec: `Milestone/Milestone 1E.txt:51–54,2990`, at the audited base.

**Claim:** the row measures the approximately 1.8 cm westward drift of a vertical
jump and demonstrates agreement with theory.

**Observed evidence:**
- Actual R5 passes with **0.753635 cm west**, printed prediction **1.691802 cm**,
  cross-track **1.183169 cm**, 61 airborne ticks, settle tick 1.
- An independent projection of launch/landing displacement reproduces the
  gate's measurement. The gate subtracts the character's blended-up tilt;
  the actual terrain-normal launch differs by **0.115029°**.
- With controller spin disabled, retaining a fixed geographic measurement axis,
  the same up-based correction reports **−0.973916 cm**, despite no rotation.
  Correcting with the actual launch normal reduces that to **−0.012644 cm**.
  At normal spin, normal-corrected drift is **1.764627 cm**.
- Replacing only the `predicted` property with **−1 m, 100 m, or NaN** leaves the
  complete R5 verdict passing. The theoretical comparison is not an assertion.
- The independent equatorial, radial-launch, constant-radius contact reference
  returns **1.885435 cm**, flight time **1.043155 s**. Halving RK4 dt from
  0.0002 to 0.0001 s changes drift by about **6.1e−13 m**. Zero spin gives zero
  west drift; reversing spin reverses the sign.
- Six negative predicate controls correctly reject negative/excess west drift,
  excess cross-track, short airtime, slow settling and skating.

**Qualification / correction to the historical interpretation:**
The radial sphere is **not** the actual near-equatorial, terrain-normal launch
and uneven contact surface. Thus “true drift ≈1.9 cm” is a reference-scale
comparison, not the exact solution of this KCC fixture. Subtracting the zero-spin
run gives 1.727550 cm, but the two runs have different flight times (61 vs 58
airborne ticks); it is not an exact isolation of Coriolis. Neither that subtraction
nor the original ±15% test establishes a general “KCC physics is fine” verdict.
Likewise, multiplying spin is not an isolated factor-two Coriolis defect: it
also changes centrifugal effects, flight duration and terrain sampling.

The spec explicitly permits the **0.6–6 cm** window. The implementation satisfies
that broad numeric window; the defect is the wrong tilt compensation and the
stronger claim of theory agreement. R5 is not incapable of failing.

**Impact:** a passing result misrepresents the measured physical quantity; its
prediction can be arbitrarily wrong without changing acceptance.

**Proposed fix:** a later test task should use a radial, analytically defined
fixture with independently integrated contact time, then test terrain-normal
launch separately. Assert finite prediction and a justified error budget. Preserve
responsive settle/cross-track controls. No ratified production constants changed.
**Size:** one session for the independent fixture and gate, or split before work
if browser integration does not fit; no production fix authorized here.

## A1-U04-3 — re-confirmed S1; missing observations, not a broken comparator

**Category:** test / integrity telemetry. **Confidence:** confirmed.

**Location:** harness `:651–659,1062–1089`; KCC `:374–379,945`.
**Claim:** R1 walk and R2 cliff movement are penetration-free.

**Evidence:**
- Unmodified R1 (87,792 ticks) and R2 (600 ticks) stay grounded; independent
  minimum clearance is **0.020 m**. Both retain `integrity.minAGL = Infinity`.
- One **0.10 m inward position fault**, applied after a real tick to both
  planet-frame and absolute positions, produces **−0.080 m clearance**.
  Inject at R1 tick 1000 or R2 cliff tick 550. **Both complete rows still pass**,
  with no modification to their verdicts, thresholds, or integrity telemetry.
- Conversely, supplying finite `minAGL = −0.10 m` makes each complete row fail.
  The comparator is responsive when supplied a bad observation.

**Impact:** a transient grounded penetration at a tick boundary can be invisible.
This does not allege natural penetration in either baseline or that every possible
position defect passes.

**Proposed fix:** independently sample finite clearance on every relevant tick;
require observation count/coverage and reject the sentinel. Test with the injected
sink and finite-negative control. Changing core telemetry semantics would be a
separate ADR-backed decision. **Size:** one test-only session, no ratified change.

## A1-U04-4 — re-confirmed S1; snaps below the bound and no closed-loop test

**Category:** test. **Confidence:** confirmed.

**Location:** harness `:600–672`; spec `Milestone/Milestone 1E.txt:24`.
**Claim:** no yaw snaps; great-circle holonomy is an endpoint property.

**Evidence:**
- **87 independently measured 4° yaw injections** pass the complete R1 row.
  Maximum total per-tick forward change is **4.104375°**, below its 0.09 rad bound.
- **87 injections of 8°** correctly fail; maximum total change **8.098581°**.
  The original continuous 0.05°/tick drift control also fails.
- The baseline finishes **123.033475° from its starting radial direction** after
  13,600.074871 m. It is not a closed loop and asserts no endpoint-frame equality.
  The earlier path-length/radius estimate “156° of the great circle” is not an
  actual swept-angle measurement on rough terrain.

**Impact:** the raw forward-delta bound mixes intentional steering and frame
transport, allowing unintended 4° discontinuities. Printed holonomy does not
establish closed-loop transport correctness.

**Proposed fix:** separate commanded yaw, transport and residual error. First add
a controlled radial-normal closed-loop fixture with an independent minimal-rotation
reference; separately test terrain-blended normals and steering. Do not prescribe
the original report's **1e−6 rad** residual tolerance without deriving it for the
chosen discretization/path. U15-1 already flags projection vs parallel transport;
this re-check does not adjudicate that pending engine review. **Size:** one gate
fixture session; split terrain-path integration if necessary. No ratified edit.

## Checked, no issue within this scope

- Actual unmodified R1/R2/R5 headless rows pass in these fresh-controller fixtures.
  This is not the full browser suite, live trek or production-play acceptance.
- The baseline walk/slope fixtures show no geometric penetration.
- Finite-negative clearance and larger yaw controls fail as expected.
- R5 enforces measured west/cross-track/airtime/settle/skating bounds; it does not
  compare its theoretical prediction.
- Independent radial reference converges, is zero with zero spin, and reverses
  with reversed spin. These controls validate the reference's limited purpose.
- No game, e2e, original probe, milestone or design-spec file changed.

## Draft ADR — U27b3b2b1: separate measured faults from reference-fixture claims

**Context:** historical U04 mixed sound gate defects with stronger claims about
exact physics agreement and proposed numerical tolerances.

**Options:** (1) accept original aggregate probes as certification; (2) rewrite
production gates during A1; (3) retain source-extracted predicates, add independent
geometric observers and falsifying controls, and explicitly separate analytic
fixtures from real terrain.

**Decision:** option 3 for this audit. Retain all three S1 findings with the
qualifications above. This draft lives under `docs/audit/` because
`docs/decisions/` is outside the A1 write allowlist.

**Why:** it demonstrates actual false acceptance while preserving responsive
controls and avoids certifying a mismatched reference as exact physical truth.

**Consequences:** later gate tasks must establish fixture/error budgets before
tightening thresholds; no production architecture or gameplay change is approved.
No new Lead preference is needed.

## Handoff

Three more findings reviewed: **19/55 S0/S1**, **36 pending**.
Next: **U27b3b2b2**, seven remaining K2c plus four K2d, split by session beginning
m1d U05-1/-7. Then K3–K9 and U27c. Historical-majority model condition remains
open; the original R4 output and untouched clusters are not signed off.