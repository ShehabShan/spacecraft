# U27b3b2b2b2b1 — m1a precision / rebase gate re-check

## Claims recorded before production-source review
- Under the contract, a shift occurs only when a post-integration local component exceeds 1024 m; new origin is 256·round(P/256) independently on each axis. A fixed-speed +x leg has an exact trigger sequence, not just a count.
- Origin coordinates being divisible by 256 is necessary but not sufficient: a coarser 512 lattice also satisfies it. Compare the actual nearest-256 origin and post-shift residual ≤128 m.
- Every registered entity's render local must equal a single Float32 rounding of the Float64 absolute-minus-origin difference. Compare dynamic and static entities after every sampled tick, including near floating-point grid boundaries around 1 AU.
- Gate defects require both false acceptance of known faults and responsive controls. Extract shipped predicates without rewriting them; build expected values independently from the literals/math above.
- Review only A1-U08-5/-6. Any incidental timing/heap/browser result is not an additional finding sign-off.

Bootstrap: clean 4d0692b = origin/a1-engine-audit; tracker parent convention agrees. Unit split before execution per NEXT ACTION. No drift.

## Result and scope
**DONE — A1-U08-5 and A1-U08-6 re-confirmed with qualifications; both remain S1, confirmed, test-category.** Two more reviewed: **26/55 S0/S1, 29 pending**; K2c is complete. No new finding IDs, severity changes or production fixes.

Review base: `4d0692b`. Reviewer: platform-reported `gpt-6-astra` / OpenAI (evidence `model-meter.json`); the historical-majority-model condition remains unresolved. This is a Node predicate/core/adapter review, **not** a browser/GPU/frame-time certification.

Read in full: `Milestone1A_TestHarness.tsx`, `precisionMath.ts`, `SimulationCore.ts`, `FloatingOriginAdapter.ts`, original `u08-m1a-validity.mjs`. Targeted specification passages: `Milestone/Milestone 1A.txt:29,85–99,114` (not the whole milestone). Catalog scale checked at `celestialData.ts:106–114`.

## Method and independent controls
New probe: `game/tools/audit/u27b3b2b2b2b1-m1a-recheck.mjs`.
- Extracts the shipped harness controller/verdict at lines 106–280 and capture block at 462–484 verbatim; stubs only the result store. Synthetic 60 Hz frames drive the real core; original predicates run unchanged, except separately labelled literal-constant controls.
- SHA-256 hashes of harness, precision module and core are emitted. Mutations require unique source anchors; generated copies go to a fresh `/tmp/u27-m1a-*`, never tracked production files.
- Independent expectations use literal 1024/256, an analytic tick sequence `floor(3072*k/100)+1`, and `Math.round(P/256)*256`. They import no origin helpers or engine constants. Local truth is one Float32 rounding of the Float64 subtraction.
- Flight observer checks all four entity locals and real adapter Object3D positions after every tick, including all nine baseline shifts. Static absolute positions must remain fixed.
- Separate stationary fixtures check all three axes and both signs immediately below/equal/above the trigger (18 cases), four signed nearest-cell ties, off-axis lattice identity, and far-origin precision. Event observations copy values synchronously, but local comparisons happen after extraction completes.
- Deliberate `--self-test` failure returns exit 1. The normal command returns nonzero on **any** failed assertion, unlike the older probe whose exit reflects only its controls.

## A1-U08-5 — Wrong trigger/lattice can pass all five rows
- **Disposition:** re-confirmed with qualifications; **S1 / confirmed / test**.
- **Location @ 4d0692b:** harness `TEST` at 106–120, T2–T4 at 188–203; `precisionMath.ts:155–169`; specification exact trace at Milestone 1A:88.
- **Claim:** the gate protects the 1024 m strict trigger and nearest-256 origin.
- **Evidence:** threshold 900, 1023, 1025 and 1100 mutants all pass `PPPPP`. Threshold 900 shifts at `[27,58,89,120,150,181,212,243,273]`, not the specified `[31,62,93,123,154,185,216,246,277]`. Threshold 1100 permits max local **1098.6666 m** and still passes by importing its own bound. Lattices 64/128/300/512/1000 all pass; lattice 300 even gives **10** shifts of 900 m.
- **Qualifications / responsive controls:**
  - T2–T4 are **not constant predicates**. Threshold 2048 fails T3; a 1000 m/s ship fails T1/T3; literal 1024 rejects the 1100 mutant; literal 256 rejects the 300/1000 delta mutants.
  - Thresholds 1023/1025 have the **same sampled flight trace** as baseline. Exact timing alone is insufficient: the independent boundary fixtures reject both and detect `>=` instead of `>`.
  - Merely hard-wiring constants still accepts 64/128/512 in the +x flight. At `(1100.3,−1300.7,50)`, true nearest-256 origin is `(1024,−1280,0)`; L512 gives `(1024,−1536,0)`. The latter is **on** the 256 lattice but leaves a 235.3 m residual. A modulo-only remedy is insufficient.
  - The report's title means sampled wrong values can escape, not that every wrong threshold/lattice must pass. The original `M1A-T3-WINDOW` searches threshold mutants only; its NOT-CONFIRMED does not refute the lattice-300 ten-shift case.
- **Impact:** acceptance cannot certify the specified rebase policy, even when all rows pass.
- **Proposed fix:** an independent literal-spec contract gate: exact nine-event trace and deltas; signed strict-trigger boundary cases; exact nearest-256 origins on off-axis fixtures; focus residual ≤128 m immediately after a shift. Do not limit **all** entities to 1024 m—distant static entities legitimately exceed it.
- **Fix size:** one 50-OLU gate-only session; no RATIFIED production constant changes. Keep existing gates until independent replacements land.

## A1-U08-6 — Precision and static-beacon faults escape
- **Disposition:** re-confirmed with qualifications; **S1 / confirmed / test**.
- **Location @ 4d0692b:** harness scene claim 9–16, verdict 177–203; core extraction 446–461 and focus statistic 465–469; adapter `update()`; Milestone 1A:29.
- **Claim:** Float64 subtraction precedes a single Float32 narrowing, and static beacons change local coordinates by the origin shift without changing absolute position.
- **Evidence:**
  - Early rounding `f32(P)−f32(O)` passes all rows. Even in the 10 km leg it differs from single-rounding truth by **0.000335693 m**; the original wording that this leg “cannot see it” is too strong—an exact oracle sees it.
  - Skipping static extraction passes all rows while beacons and actual adapter positions are wrong by **9216 m**; their absolute positions remain unchanged.
  - Setting **all entity locals to zero** also passes all rows: focus statistic stays zero, despite a 1022.6667 m focus error and an 8000 m static error.
  - At the constructed catalog-scale position `P.x=601000.37 m`, baseline agrees with single-rounding truth; early rounding is wrong by **0.004997253 m**.
  - At constructed real-AU `P.x=149600001000.37 m`, baseline exact residual is `−23.6300048828125 m`; early rounding gives zero.
  - Explicit ±64 m offsets around an f32 midpoint near 1 AU give **16320 m error**, with the early-rounding local becoming ±16384 instead of ±64 on affected axes. Both signs tested; baseline errors are zero for these chosen fixtures.
- **Qualifications / corrections to the original report:**
  - “No row reads localPosF32” is literally incorrect **indirectly**: T2 reads a statistic derived from focus locals (`SimulationCore.ts:465–469`). Setting locals to 2048 produces `PFPPP`. What is absent is a truth comparison and static-entity coverage, not every dependency on locals.
  - The original impact sentence “the game runs at 1.5·10¹¹ m” is not supported by the catalog: Earth is at **600000 game metres**, Moon offset 38850 (`celestialData.ts:106–114`). The AU cases are **stress fixtures**, not measured live-play positions or present 16 km production errors. The catalog-scale witness is also a constructed fixture.
  - Baseline code has none of these injected defects in the sampled cases. This finding is about a gate's sensitivity, **not** a newly discovered production precision failure.
  - “<1 mm” is appropriate for these nearby residual fixtures, not a universal bound on arbitrarily distant entities stored as Float32. For all entities compare to `fround(P−O)`; apply absolute-error tolerances only over declared coordinate ranges.
- **Impact:** precision-order regressions and invisible/stale scene objects can evade acceptance.
- **Proposed fix:** compare every dynamic/static entity local and adapter position to independent single-rounding truth after each sampled tick/rebase; preserve static absolute positions; add catalog-scale and midpoint stress fixtures. Keep gross-local errors as a responsive control.
- **Fix size:** one 50-OLU gate-only session, separate from the trigger/lattice session if needed. No engine or RATIFIED policy changes.

## Checked, no issue (bounded coverage)
- Unmodified core: exact nine specified trigger ticks, every delta `(1024,0,0)`.
- Dynamic/static locals and adapter positions agree with independent truth throughout the flight; beacon absolute positions do not move.
- All 18 strict signed-axis boundary cases, four signed ties and off-axis nearest-256 fixture pass.
- Constructed catalog-scale and three far-origin precision fixtures pass the baseline oracle.
- Shipped T1/T2/T3/T4 respond to the controls described above; not a universally green harness.
- No renderer pixels, real wall-clock stutter, heap/zero-GC, arbitrary magnitudes/non-finite inputs or celestial-local coverage claimed.

## Verification and raw evidence
Logs are whitespace-normalized only (trailing spaces/blank EOF removed after the first staged whitespace check returned exit 2); result text and numbers are unchanged. All logs are under `docs/audit/U27b3b2b2b2b1-evidence/`. Commands run from `game/` unless noted. Commands are redirected to logs, **not piped**; `$?` captured immediately.
| Command | Observed result / exit |
|---|---|
| `npm ci` | exit 0; `npm-ci.log` |
| `node tools/audit/u08-m1a-validity.mjs` | **16/18 CONFIRMED**, controls OK, exit 0; `original.log`. The two misses are threshold-only ten-shift search and >100 m assertion against a 23.63 m witness. Incidental U08-7 output is NOT its re-review. |
| new probe before added off-axis baseline/catalog-scale controls | 47/47 twice, exit 0; `independent-1.log`, `independent-2.log` |
| same pre-addition probe `--self-test` | deliberate 47/48, exit 1; `self-test.log` |
| `node tools/audit/u27b3b2b2b2b1-m1a-recheck.mjs` (final) | **50/50 twice, exit 0**; `final-1.log`, `final-2.log` |
| same final command `--self-test` | **50/51, exit 1 intentionally**; `self-test-final.log` |
| `npm run typecheck` | exit 0; `typecheck.log` |
| `npm run build` | exit 0; `build.log`; existing chunk-size warning, not a clean-warning claim |
| repo root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | empty, exit 0; protected source/spec trees unchanged |

Final scope/whitespace verification is recorded in `verification.log`. No old probe was edited.

## Audit-method ADR draft — literal contract plus coordinate witnesses
**Context:** imported constants and the +x fixture allow incorrect policies to pass; a modulo check can accept a coarser lattice; near-origin results understate early-rounding error.

**Options:** retain self-referential checks; add only exact flight timing; or combine timing with literal boundary/origin/local-coordinate oracles and responsive controls.

**Decision:** use the third option for this re-review and propose it for later gate fixes. Label AU fixtures as stress tests, and separate bit-pattern truth from range-dependent metric tolerances.

**Why:** the 1023/1025 and L512 controls demonstrate blind spots in the first two options; coordinate observations distinguish static/render failures from healthy core behavior.

**Consequences:** no production architecture changes or approved-gate replacements in A1. This draft stays under `docs/audit/` because `docs/decisions/` is outside A1's write allowlist; a fix task may promote it under §13.

## Handoff
Next: **U27b3b2b2b2b2**, four K2d findings; split before execution, recommended first **A1-U08-7 m1a timing/stall gate**. Remaining K2d: U03-5, U05-2, U08-7, U01-1. Then K3–K9 (25 findings), U27c fix tasks/Lead summary, stop at Lead gate. Historical-majority model provenance still unresolved.
