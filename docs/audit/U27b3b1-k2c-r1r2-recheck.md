# A1 U27b3b1 — K2c m1f R1/R2 row-validity re-check

- Date: 2026-10-25 · Session 88 · Branch: `a1-engine-audit`
- Base: `3081cd6`; protected source unchanged from `256d77d`.
- Scope: **A1-U02-1, A1-U02-2, A1-U02-3 only**. All three remain **S1, confirmed**, with the qualifications below. Total reviewed becomes **14/55; 41 pending**.
- Reviewer: platform usage reports **GPT-6 Astra (`gpt-6-astra`)**; raw record in `U27b3b1-evidence/platform-meter-model.json`. This verifies this reviewer, **not** the models of most historical audit units. The historical-majority cross-model condition remains unresolved.
- Deliverables: this report, new `game/tools/audit/u27b3b1-r1r2-recheck.mjs`, raw evidence, findings review and process checkpoint. No game, harness, test or ratified constant edits.

## 1. Method and scope

Expectations were recorded in `U27b3b1-evidence/claims-before-source.md` before reading implementation this session. Rerun the old probe, but do not use its replica as the new oracle.

The new probe extracts the actual R1 analytic statements, R2(a) loop and their final predicates from the TypeScript AST. Extraction boundaries and predicate counts are asserted. TypeScript transpilation removes types only. The real pool, math helpers, terrain-origin generator and rig-camera exports run under the existing audit-only loader (React hooks stubbed; no React component mounted).

Independent controls:
- Geometric truth is a separate six-body radius/distance fixture. All centers lie on the camera axis: this avoids silently certifying the separate off-axis findings. The observer reads submitted `instanceMatrix` and `aDisk`, not mutable body metadata. From the shader's disk boundary, physical disk radius is matrix scale × `aDisk.y / aDisk.x`; its on-axis angle is compared with `asin(radius/distance)`. These are CPU-side submission arrays, **not GPU readback**. The aligned fixture is not a claim that all six overlapping bodies are visibly drawn.
- Depth separation uses the exact difference of perspective normalized depth at z and z+gap, multiplied by 2²⁴, rather than the production differential helper. It reads the actual exported Mid camera near/far and an object's layer mask.
- Terrain non-coverage is checked with generated real chunk origins, a conservative bound derived from the noise implementation, an empty fixture, and a deliberately out-of-domain positive-branch control.

The R1 frozen-image difference and R2 Sun coverage/center values are supplied explicitly. They are controls of the extracted predicates, **not simulated pixels**. Passing with valid supplied values establishes a blind subcheck; it does not claim that the complete current browser suite passes. No fresh full m1f or GPU run.

## 2. Per-finding dispositions

### A1-U02-1 — Re-confirmed S1; qualify “cannot fail”

**Claim:** every instance's rendered angle matches f64 truth, and the audit reads written matrices. Source: `game/src/test/Milestone1F_TestHarness.tsx:28-30,1094-1122,1149-1150` at base; matching claim in `pre-t4:Milestone/Milestone 1F.txt:885-887,1907`.

**Observed:** six ranks cause six checks of slot 0 only. The unmodified fixture passes both the actual predicate and independent submitted-geometry oracle (maximum angle error **2.86e-10 rad**, direction error 0). These in-memory mutants still pass the actual predicate while the independent oracle rejects:

| Mutation | Independent maximum error |
|---|---|
| Double quad matrix scale | angle 0.00999817 rad |
| Enlarge one disk attribute by 10% | angle 0.000333331 rad |
| Translate one submitted instance by 100 m | direction 0.0104163 rad |
| Feed non-first body 1.5× its true angle | angle 0.00166667 rad |

The original probe also reruns successfully: **9/9**, exit 0, including the all-disk ×2 and upstream-Sun ×1.5 cases.

**Correction/qualification:** the old “cannot fail” title is too absolute outside its claimed rendered-data property. Actual controls reject a +1 m error in the first body's cached `stagedPX`, first-body alpha=0.5, and only five instances. Bad supplied Sun coverage or center also fails the full R2 predicate. Thus the position check is not an unconditional algebraic identity: it checks cached f64 bookkeeping, not the submitted transform. An upstream Sun mutation may be caught by real R2(b) pixels; the old probe demonstrated R2(a)'s blindness, not full-row acceptance.

**Impact:** R2(a) cannot certify every body or submitted angle/position data. A passing repeated-first-slot check is false coverage, while the genuinely responsive Sun subcheck is worth retaining.

**Proposed fix:** independent expected geometry for every required distinct body, explicit rank/body correspondence, finite-value checks and reads of submitted disk/transform data, plus rendered checks. Use a justified f32/angular tolerance rather than applying the metadata-only 1e-9 m threshold to f32 positions. Account for the shader's disk/edge ratio; reading only `atan(aDisk.y)` misses transform corruption. Keep the Sun test. One session for CPU gate and mutation controls; separate rendered integration if needed. No ratified production change proposed here.

### A1-U02-2 — Re-confirmed S1; analytic clause, not a fresh pixel verdict

**Claim:** the R1 pair audit measures depth spacing of assigned scene passes. Source: harness `:1024-1032,1058-1069,1078`; rig camera objects at `game/src/render/MultiCameraRig.tsx:52-68`.

**Observed:** the actual analytic clause reports layered minimum **1555.546682** and single-camera minimum **0.007725882**. Its values do not change when:
1. The real exported Mid camera is changed in memory to near=0.01, far=1e7. Independent exact depth separation falls from **1539.033448** to **0.007643867** depth steps; actual R1 still accepts with the supplied zero image difference.
2. A 233 km fixture object is assigned only to the Near layer, making it absent from the Mid pass (and beyond Near's far plane). Independent coverage rejects; actual analytic clause still accepts.

The healthy rig configuration passes the independent control. Supplying one differing frozen-image byte rejects R1. The distinction between the differential estimate 1555.55 and exact finite-gap separation 1539.03 is expected, not a new defect.

**Impact:** fixed formula arithmetic does not verify live camera planes, pass membership or visibility. A stable wrong image can satisfy a separate determinism check; this session did not render such an image.

**Proposed fix:** scene-driven pass/depth/visibility checks using actual cameras and object assignments, with plane/mask mutations required to fail. Keep temporal determinism under its proper name. Add an independently observable rendered counterfactual in a separate session if necessary. Changing the gate does not require changing ratified production camera bands. The 1F gate remains parked for later authorized fix work.

### A1-U02-3 — Re-confirmed S1 with stronger bound

**Claim:** R1(b) compares Earth with overlapping horizon terrain and reports a real separation. Source: harness `:1035-1056`; chunk origins in `game/src/core/terrain/terrainField.ts:218-232`; field construction `:131-145`; noise in `game/src/core/terrain/noise.ts`.

Let E be the moon-center-to-Earth distance, x a rotated chunk origin and w its nonnegative arc width. The pre-clamp gap obeys the triangle inequality:

`(E − 5000) − (|E_vector − x| + 0.75w + 420) ≤ |x| − 5420 − 0.75w`.

The old report's −3695.5 m bound assumes the hand-entered maximum terrain height of 360 m. This review **does not need that assumption**:
- Each simplex corner contribution is bounded by `sqrt(2) r (0.6−r²)^4`, maximized at `r²=0.6/9`.
- Four corners and the factor 32 give `|noise3| ≤ 3.781588336`. Normalized positive fBm weights preserve this bound.
- `ridged3` is bounded by `max(1,(3.781588336−1)²) = 7.737233668`; the smoothstep mask lies in [0,1].
- With Moon amplitudes 95/230/16, `h ≤ 2199.320049 m`, and radius plus height is at most **3563.820049 m**. The lower height bound keeps radius positive. The spherified cube has unit norm for valid face coordinates (squared norm expands to `1−(1−x²)(1−y²)(1−z²)`; one input component is ±1).
- Therefore raw gap is at most **−1856.179951 m**, even under this deliberately loose bound. Spin rotation preserves the norm. Floating-point rounding cannot bridge this margin.

Checks:
- **8190 actual generated chunk origins**, all six faces and all tiles at L0–L5, have maximum sampled norm **1600.701088 m**. The extracted gate returns the **1e9 ratio / 30,000 m gap sentinel**.
- Zero records also return that sentinel.
- Artificial origin (10,000,0,0), L12 — explicitly outside the Moon's domain — reaches the real positive branch with gap **4579.607541 m**, showing extraction did not disable it.
- A collinear common-observer fixture has real near-limb separation **32029.607541 m**, yet the original calculation substitutes 30,000 m. This illustrates the frame mistake; it is not a reconstruction of the real horizon image.

**Impact:** no physically admissible Moon chunk can contribute to this purported scene-derived comparison. The fallback turns no comparisons into a fabricated successful measurement.

**Proposed fix:** use one observer/camera frame for both projected angular overlap and depth separation; report and require an explicit eligible-comparison count. No eligible pairs must be N/A or insufficient coverage, not a numeric success. Repair with U02-2 in one CPU-gate session; GPU validation separately. No ratified item needs changing.

## 3. Checked, no issue / not checked

- Independent on-axis submitted-geometry baseline passes within 1e-6 rad.
- Current Mid-camera fixture has well-resolved positive depth separation; no production plane defect is claimed here.
- Actual R1 determinism predicate and R2 metadata/count/Sun scalar checks respond to invalid controls. Do not delete them on the false premise that nothing can fail.
- Positive Earth-gap branch works on the explicitly impossible control; zero real contributions are due to the formula/domain, not extraction.
- No source/harness/test mutations persisted. Source hashes and base commit are recorded.
- Not reviewed: U03-2/-3, remaining K2c/K2d, K3–K9, rendered off-axis silhouette, real Sun pixels, actual horizon occlusion, fresh full m1f acceptance, or historical-majority model attribution.

## 4. Verification and raw evidence

All commands were run without a shell pipeline. Logs: `pre-t4:docs/audit/U27b3b1-evidence/`.

| Command (from `game/`, except git) | Observed exit / result |
|---|---|
| `npm ci` | 0; existing dependency/security warnings retained in `npm-ci.log` |
| `node tools/audit/u02-r1r2-validity.mjs` | 0; 9/9 original expectations |
| `node tools/audit/u27b3b1-r1r2-recheck.mjs` ×2 | 0 both; **20/20** independent checks each |
| `npm run typecheck` | 0 |
| `npm run build` | 0; existing >500 kB chunk warning |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0; empty |
| `git diff --check` | 0 before report; final result also in `final-verification.log` |

`verification.json` records subprocess commands and raw return codes for the second probe and build checks. `source-manifest.json` records source hashes and Node version. First-run and original-probe exits were observed directly and are recorded here.

Setup-only corrections: a platform query initially quoted an enum and returned a GraphQL validation error; the corrected query succeeded. A source-reading command used nonexistent `u27b1-tsx-loader.mjs` and exited 1; the actual `u27b1-ts-loader.mjs` was located and reused. Neither was a failed test or a source change. The first staged whitespace check exited 2 for an extra blank line at the end of `typecheck.log`; only that trailing blank line was removed, with diagnostic content preserved, before committing.

## 5. Audit-method ADR draft — D-ADR-U27b3b1

**Context:** prior replicas risk repeating the same mistake; “cannot fail” wording hides responsive subclauses. A1 permits only audit/process changes.

**Options:** trust old replicas; rerun only full browser gates; or extract unchanged predicates and compare independently measured geometry with calibrated clean/broken controls.

**Decision:** use the third option for this session-sized CPU gate review, with explicit injected pixel scalars and no GPU claim. Retain the old reports as historical evidence; put qualifications in this report and FINDINGS.md. Keep the remaining 16 K2 findings unchecked.

**Why:** source extraction reduces replica drift; independent radius/distance and projective-depth math reveal missing sensitivity without editing protected files. A conservative noise bound removes reliance on the hand-entered terrain-height assertion.

**Consequences:** confirms these three gate defects, not complete renderer correctness. Later fix tasks must add rendered controls and preserve responsive subchecks. This is an audit-method decision, not authorization to change parked gates or production architecture; any implementation ADR is promoted after A1.

## 6. Handoff

Next: **U27b3b2**, split before execution, beginning **m1f R3 A1-U03-2/-3**. Remaining K2c has 12 findings and K2d has four. Then K3–K9 and U27c. T1 remains paused. Reconcile from the next commit; do not rerun these three findings without a source change or new contrary evidence.