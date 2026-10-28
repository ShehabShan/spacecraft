# ADR-023 — Rebuilt m1f R3 (mesh↔impostor handoff) gate design

- Status: ACCEPTED (F2fcca, session 134, 2026-10-27). Design only; F2fccb implements it.
- Task: F2f (U27c §2), findings A1-U03-2 and A1-U03-3 (K2c); related A1-U03-1 (S0, fixed by F8a).

## Context
The shipped R3 row (`Milestone1F_TestHarness.tsx` `runSuite`, "R3: handoff hysteresis") cannot fail:
- R3(a) and R3(b) count holes and doubles with `mesh = 1 − imp` and ignore `meshState`, so both
  predicates are unsatisfiable (A1-U03-2). The rendered rules are different: the mesh draws iff
  `meshState && alphaMesh > 0.01`, and the impostor draws iff `alphaImp > 0.01`.
- R3(c) thresholds red > 8 in a 160² window over a lit background. U01 measured totA = 25,600
  (the whole window), so sym = 0 is forced, and totA is never bounded (A1-U03-3). The same pose is
  behind the "0-px silhouette flake" (R3 failed 3/6 runs in F2fa/F2fba): there the disk was lost
  against the scene, and the row compared two empty masks.
- The controller really has a hole. Measured with the rendered rules on the verbatim controller
  (`docs/audit/evidence/F2f/cca/handoff-analytic.out.txt`): descending, nothing is drawn for
  d ∈ [220,000, 225,647] m (5,647 m, at 1 m steps), and the drawn coverage falls to 0. Ascending has
  0 holes and a maximum dimming of 0.010. A1-U03-1 assigns the fix to F8a (U27c row: "inbound probe
  hole (5,648 m) red before, 0 after").
- Expected probe disk (R = 1,800 m, fov 62°, 1280×720): r = 4.57–4.86 px and area 66–74 px² over
  222–236 km; r = 3.72 px at 290 km and 5.26 px at 205 km.

## Options
1. Fix the counters in place. Rejected: the shipped rows are never edited.
2. A new gate that reports only green rows and measures the handoff away from the hole band.
   Rejected: this repeats A1-U03-3's blind spot by sampling around the defect the gate guards.
3. A new gate that measures the rendered handoff truthfully everywhere and is RED today. Its spec
   pins the exact known-red vector, so CI stays green while the badges stay honest. F8a must flip
   the spec to all-PASS.
4. Also fix the controller here. Rejected as out of scope: F8a owns the fix and its ADR.

## Decision
Option 3. The gate is a new page `?page=m1fR3` (`game/src/test/M1fR3Gate.tsx`, one `main.tsx`
static-map entry), with spec `game/e2e/m1f-r3.spec.ts`, self-test `game/tools/test-m1f-r3-gate.mjs`,
and evidence in `docs/audit/evidence/F2f/ccb/`.

**Controller under test.** `HANDOFF_*`, `handoffFade` and `handoffNextState` move verbatim into a
pure module, `game/src/test/m1fHandoff.ts`. The shipped harness imports and re-exports them, so its
rows and exported names are unchanged. The gate imports the same module, so it tests the shipped
code rather than a copy. Importing the harness itself is ruled out by the page rule, because the
harness has boot-time side effects. F8a later moves the module into `render/`. Regression: the
shipped m1f spec badges must stay unchanged (R3 still PASS, R5 waived).

**Rows.**
- **R3a — state-coupled sweep (CPU, rendered rules).** The row runs 20 round trips over
  [200, 300] km in 1 m steps, plus a 60 Hz frame-stepped live triangle (the shipped 24 s each way)
  that records `meshState`.
  - A hole is a sample where neither representation draws under the rendered rules.
  - A double is a sample where both draw at ≥ 0.99.
  - The row also requires flips = 21 and a drawn-coverage dimming of ≤ 0.01.
  - On FAIL, the row lists each band as `[lo, hi] m` per direction.
  - Today: FAIL, with the descending hole [220000, 225647] m.
- **R3b — rendered coverage sweep (GPU).** The probe mesh and its impostor are drawn under the
  harness draw rules, in an isolated scene against a cleared black target.
  - Isolation removes the occluders and the lit background behind the 0-px flake and the
    saturated window.
  - Readback uses `readPixels` without the `abRender` quiesce guard (A1-U02-6 stays in the shipped
    harness).
  - Samples: d ∈ {205, 222, 224, 228, 232, 238, 245, 290} km in each direction. Each sample's state
    is reached by walking the sweep from the far end.
  - Measure: drawn coverage = Σ pixel luminance ÷ the full-opacity reference render at the same
    distance. Each sample must lie within 1 ± 0.25. A reference area outside ±25% of π·r², or a
    0-px reference, makes the sample n/a, and n/a = FAIL.
  - Today's prediction (evidence script): FAIL at 222 and 224 km descending (coverage 0.000), and
    at 228 km (0.183) and 232 km (0.699) descending, where the impostor ghost-fades with no mesh
    behind it. Every ascending sample passes.
- **R3c — silhouette A/B (GPU).** The row renders mesh-only and impostor-only at 228, 232 and
  236 km on the same isolated target.
  - Both masks must be within ±25% of π·r², so the comparison is never vacuous.
  - The symmetric difference must be ≤ 0.5 × the ring length 2πr (2πr ≈ 29 px).
  - The centroid offset must be ≤ 0.5 px.
  - Two renders of each side must be byte-identical. This determinism check replaces the flake.
  - Expected today: PASS.

**Spec.** The spec asserts the badge vector `['FAIL','FAIL','PASS']`. It also requires:
- R3a's detail names the descending band `[220000, 2256xx]` and reports 0 ascending holes;
- R3b fails exactly the descending samples 222, 224, 228 and 232 km.

Any other vector is red. This is the only spec in the suite that pins a FAIL, and F8a's
done-condition flips it to all-PASS. If the first GPU run's R3b set differs from the prediction,
F2fccb records the measured set with its evidence and pins that set.

**Self-test mutants (each must change the pinned vector).**
- `?mut=meshhide`: the mesh is hidden below 200 km, which adds ascending holes. R3a and R3b go red
  in new places.
- `?mut=noimp`: the impostor never fades in. R3a, R3b and R3c go red.
- `?mut=shift`: the impostor is offset by 3 px. R3c goes red.
- `?mut=scale`: the impostor radius is ×1.5. R3c goes red.
- `?mut=bright`: the target is cleared to the shipped lit background (A1-U03-3's masquerade). R3c
  must fail on its area bound.
- `?ctl=ref`: a test-only positive control, not F8a's design. The mesh stays drawn while
  `alphaImp < 0.99`. R3a and R3b must turn PASS, which proves the gate can go green.

## Why
A gate exists to see the defect it guards. The rebuilt R3 measures what is drawn, on the code that
ships. It keeps the 0-px flake out by construction: it renders in isolation, bounds both areas, and
checks determinism. Pinning the red vector keeps every commit green (§13 safeguard 2) without
hiding the S0 defect behind a PASS badge.

## Consequences
- `m1f-r3` is red by design until F8a. The pinned vector is the contract, and F8a must flip it.
- The verbatim extraction touches the shipped harness's controller section, but none of its rows.
- If F2fccb does not fit in one session, it splits per §12: first R3a with the extraction and the
  spec, then R3b and R3c with the mutants.
## Amendment (F2fccba, session 135)
- F2fccb split per §12: F2fccba = controller extraction + R3a + spec pin; F2fccbb = R3b, R3c and the mutants. Until F2fccbb the spec pins `['FAIL']`.
- The extraction also moves the controller out of the harness text that three audit tools parse (`game/tools/audit/u03-r3r4r5-validity.mjs`, `u27b3b2a-r3-recheck.mjs`, `u27b1-k1-recheck.mjs`). They now append `m1fHandoff.ts` to the source they read; their verdicts are unchanged.
- Measured R3a: sweep descending hole [220000, 225647] m (56,480 hole samples over 10 descents), 0 ascending, 21 flips, 0 doubles. The live triangle samples frames, so each descending period gives its own band ([220062, 225569] m and [220063, 225569] m); the spec accepts one band per period.
## Amendment (F2fccbba, session 136)
- F2fccbb was split per §12. F2fccbba covers R3b, the mutants meshhide and noimp, and the `?ctl=ref` control. F2fccbbb covers R3c and the mutants shift, scale and bright. Until F2fccbbb, the spec pins `['FAIL','FAIL']`.
- R3b is built on the shipped `SkyImpostorPool` and `MultiCameraRig.executePasses`. The probe is a pinned copy of the harness material on an isolated black target with a ±24 px window.
- R3b coverage is **drawn area ÷ the full-opacity mesh reference area**. It is not luminance, because luminance mixed a shading mismatch into coverage (finding F2fccbb-1, evidence `docs/audit/evidence/F2f/ccbb/`).
- Measured fail set: down [290, 245, 238, 228, 224, 222] km; up [238, 245, 290] km. This differs from the prediction because the impostor draws about 1.35× the mesh area. 232 km descending measures 0.765, which is inside tolerance. The spec pins the measured set.
- `?ctl=ref` is an opaque swap: the mesh stays at full opacity while alphaImp < 0.99, and the impostor is suppressed while the mesh is drawn. With it, R3a passes, and R3b passes every sample where the mesh is drawn; only the impostor-only samples fail (F2fccbb-1). A cross-fade cannot reach full area, because the shipped impostor fades by shrinking its disk radius.
- `?mut=meshhide` hides the mesh at every distance, not only below 200 km. It is simpler and still adds ascending holes, including at 205 km.
