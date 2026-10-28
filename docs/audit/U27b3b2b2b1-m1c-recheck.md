# A1-U27b3b2b2b1 — m1c seam-gate re-check

Baseline: `6632762`, branch `a1-engine-audit`. Scope: A1-U06-1 only.
Audit-only; no engine or gate changes.

## Independent claim recorded before implementation review

A spherified cube represents one continuous surface. The two face parameterizations
of any cube edge must give the same boundary position and normal; the three
parameterizations of each corner must also agree. A gate claiming every shared
edge must reject a unilateral normal error on each of the 12 edges and on each of
the eight corners, not just within a face. It must also reject a same-face
fault and accept unmodified data. Matching by independently enumerated Cartesian
cube coordinates (not the production face-basis table) will establish coverage;
bit comparisons must use Float32 bit patterns, not merely decimal tolerance.
This checks generated CPU data and gate sensitivity, not rendered pixels.

The old report is a claim to retest, not evidence for this session.


## Disposition

### A1-U06-1 — Cross-face seams are excluded from the actual T3 comparison
- **Severity: S1; confidence: confirmed; category: test. Re-confirmed with qualifications.**
- **Location:** `game/src/test/Milestone1C_TestHarness.tsx:419–503`, specifically
  `:487` skips different faces; complete T3 predicate `:547–549`, header claim
  `:15–18`, boot self-test `:191–221`, periodic call `:722–725`, all at `6632762`.
  Spec: `pre-t4:Milestone/Milestone 1C.txt:34,38–47,1336–1339` (targeted passages only).
- **Claim:** normals agree bitwise at every shared edge and positions agree to
  5e-3 m, including cube-face boundaries and corners.
- **Evidence:** exact source-extracted audit and complete T3 predicate accept
  individual reversed normals at all **12 cube edges and eight corners**, and
  **1 m position faults at all 12 edges**, in both an independent analytic
  sphere fixture and real worker output. **64 false accepts per run**, all
  rejected by the independent coincident-vertex oracle. Eight same-face
  normal/position controls (same-level and one-level T-junction, both fixtures)
  fail T3 as expected. Empty data, no T-junction coverage and bad round-trip
  error also fail.
- **Impact:** a face-local generation/export fault at a cube boundary can pass
  T3; the gate does not establish its advertised cross-face contract.
  This is a gate defect, not a newly observed production terrain crack.
- **Proposed fix:** add boundary identities independent of production face
  tables, explicit 12-edge/8-corner coverage and pair comparisons across faces;
  retain same-face/T-junction, position-tolerance and boot-self-test checks.
  Land the independent check before replacing any gate. Keep the original
  finding's any-level shared-vertex proposal, but do not confuse equal vertices
  with a proof of whole-triangle/skirt continuity. No RATIFIED item changes.
- **Fix task size:** one session for the seam-gate/controls change after A1
  triage. Any mesh/skirt or runtime-streaming redesign is separate.

## Method and controls

New runnable repro: `game/tools/audit/u27b3b2b2b1-m1c-recheck.mjs`
(from `game/`: `node tools/audit/u27b3b2b2b1-m1c-recheck.mjs`).
It exits nonzero if an expected disposition fails.

1. Record the claim above before reading the harness implementation. Read the
   whole harness, worker, terrain field, spherify module and original U06 probe;
   use only targeted milestone passages.
2. Transpile the **verbatim** `posArr` through `auditSeams` slice. Extract the
   complete `seamsOk` expression from source, including `roundtripErr`, instead
   of copying the old probe's shortened predicate. Run the actual boot
   round-trip self-test; error is `1.1037980425510074e-13`.
3. Independently define Cartesian charts: +X=(1,v,-u), −X=(−1,v,u),
   +Y=(u,1,−v), −Y=(u,−1,v), +Z=(u,v,1), −Z=(−u,v,−1).
   These encode the public face-number/orientation convention, not an alternate
   engine. The oracle does not import `FACE_C/U/V`, `gridCoord` or the old
   probe. Keys are exact dyadic cube coordinates, not rounded world positions.
   Independently enumerate each two-fixed-axis edge at free coordinate −0.75
   (away from chunk intersections) and each ±1 corner. Require two distinct
   faces per edge and three per corner.
4. Use 27 chunks: all level-1 faces, replacing face 5's (0,0) chunk by four
   level-2 children. This gives a passing T3 baseline with real T-junction
   comparisons; no counter is fabricated to make the predicate pass.
5. Two datasets use this topology:
   - Independent sphere: normalize each cube point radially to radius 5000;
     unit radial normals. This is intentionally not production spherification.
   - Production terrain: bundle and execute the unchanged worker's init/req
     handler in Node, capture real position/normal arrays, reconstruct positions
     with the main-thread chunk origin. All 29,403 interior vertices agree with
     the independent chart/spherified direction within `1.45e-8` component error.
6. Compare all coincident chunk vertices (Uint32 views of Float32 normals;
   f64-origin-reconstructed position max-component tolerance 0.005 m).
   Inject faults on just one face, consistently on duplicate vertices of that
   face if needed. That isolates cross-face sensitivity from same-face faults.
   Same-face controls mutate only one record.
7. Rerun the original repro unchanged for historical comparison. Its unrelated
   findings are not signed off by this unit.

### Measured results

| Observation | Result |
|---|---|
| Production gate baseline | PASS: 858 same-level comparisons, 69 parent/child comparisons, 0 normal mismatches |
| Independent production baseline | 940 same-face and **818 cross-face** coincident-record pairs; 0 normal-bit mismatches or position violations |
| Maximum production reconstructed position difference | `0.00012024637885588163 m` (about 0.120 mm); gate sees `0.00011186934352735989 m` |
| 12 edge-normal + 8 corner-normal mutants per dataset | T3 accepts 20/20; independent oracle rejects 20/20 |
| 12 edge-position mutants per dataset | T3 accepts 12/12; independent oracle rejects 12/12 |
| Same-face normal/position controls | 8/8 correctly rejected across two datasets |
| Missing-data / missing-T-junction / bad-roundtrip controls | 3/3 correctly rejected |
| New probe final runs | **80/80 twice, exit 0** |
| Original probe | **14/14**, 215 worker chunks, exit 0 |

Raw per-case metrics live in `U27b3b2b2b1-evidence/independent-2.log` and
`independent-3.log`; the counts are expected test dispositions, not 80 production
properties proven. The 940 oracle pairs include coincident chunk-corner contacts
and are not the same counting unit as the gate's 858 edge comparisons + 69
parent/child comparisons.

### Initial failed run, preserved rather than hidden

The first new-probe run was **78/79, exit 1** (`independent-1.log`). Its strict
bit oracle found **16 signed-zero differences** in synthetic sphere normals:
a chart's negated zero became −0 while a neighbouring chart produced +0.
All nonzero normal components agreed. This was a synthetic fixture mismatch,
not evidence of a production seam fault. Added a control proving all 16
differences are signed zeros, then canonicalized zeros **only in the synthetic
fixture**; production worker arrays and the oracle are untouched. Final runs
have 80 checks. The old report's “bitwise” oracle actually used numeric `!==`;
this re-check uses raw bits and does not silently relax that property.
Signed-zero equality is physically harmless here; no separate engine defect
is claimed.

## Checked, no issue / qualifications

- Selected real worker data has matching normal bits across all sampled cube
  edges/corners, with position reconstruction inside tolerance.
- T3 is **not universally unable to fail**: same-face normal and position
  controls, missing coverage and bad round-trip checks are responsive.
- A production `FACE_*` or spherify regression is not guaranteed to pass:
  it might also break a same-face check or the boot inverse self-test. The
  original report's broad example is qualified to the demonstrated
  boundary-local faults; no global mutation was claimed here.
- Equal sampled normals do not prove physical normal accuracy (U14), smooth
  triangles between samples, whole-mesh continuity, skirt coverage or arbitrary
  LOD correctness. U06-4 and other findings are not newly reviewed here.
- No actual browser, GPU readback, live-flight phase machine, actual Worker
  concurrency, buffer-detachment or rendering-performance verdict. The handler
  is real; `self.postMessage` is a synchronous capture stub in this probe.
- The independent chart fixes correspondence without consuming production
  tables. The direction calibration shares the specified spherified formula;
  it checks chart mapping, not a new proof of that formula.
- No game code, original probe, acceptance threshold or library changed.

## Audit-method ADR draft — explicit topology and responsive controls

**Context:** U27 requires independent re-review, while A1 permits no game/gate
changes. The old repro used production face tables and a shortened predicate.

**Options:** repeat only the old probe; run only rendered screenshots; or pair
the exact CPU gate with a separately defined topology and deliberate faults.

**Decision:** use the last option plus the old repro, two data fixtures, complete
predicate extraction, strict Float32-bit comparisons and responsive negative
controls. Audit-method decision only; future production changes remain proposals.

**Why:** enumerating 12 edges/eight corners makes missing coverage explicit;
an independent analytic sphere prevents agreement solely through production
terrain code, while the real worker fixture grounds the result in actual arrays.
Controls show the gate and oracle are alive.

**Consequences:** CPU gate sensitivity is reproducible without graphics timing;
runtime scheduling, geometry between vertices and rendered seams remain outside
this result. Draft remains in `docs/audit/` because `docs/decisions/` is outside
A1's write allowlist; future fix tasks can promote a production ADR.

## Verification, provenance and handoff

Commands run unpiped (stdout/stderr redirected to individual logs); exits captured
immediately in `U27b3b2b2b1-evidence/exits.txt`:

| Command (from `game/`, except protected diff at repo root) | Exit / observation |
|---|---|
| `npm ci` | 0 |
| `node tools/audit/u06-m1c-validity.mjs` | 0, 14/14; unrelated observations not endorsed |
| `node tools/audit/u27b3b2b2b1-m1c-recheck.mjs` initial | 1, 78/79, synthetic signed-zero issue above |
| Same command, corrected, twice | 0 / 0, 80/80 each |
| `npm run typecheck` | 0 |
| `npm run build` | 0; existing >500 kB bundle warning retained |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0, empty (`protected.diff`) |

Source hashes in `source-sha256.txt`. Bootstrap clone/checkout/pull via GitHub
integration; HEAD `6632762` equalled remote, worktree clean, tracker parent-hash
convention and plan/NEXT consistent: no drift repair needed.
Reviewer **GPT-6 Astra (`gpt-6-astra`, OpenAI)** from platform `llm_usage`.
Historical-majority model provenance remains unresolved; this is evidence review
of U06-1 only, not completion of the overall cross-model requirement.

Budget meter before final commit preparation: **29.86 OLU** recorded for this
interaction; no second unit started.

One more reviewed: **22/55 S0/S1; 33 pending**. NEXT:
**U27b3b2b2b2**, split before execution starting m1b U07-1/-2; remaining K2c
U07-1/-2 and U08-5/-6 (four), K2d (four), then K3–K9 and U27c.
