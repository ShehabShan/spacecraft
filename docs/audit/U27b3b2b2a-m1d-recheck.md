# U27b3b2b2a — m1d atmosphere and collision gate re-check

Base: `184dc6e`. Scope: A1-U05-1 and A1-U05-7 only. Session 91.
Reviewer: platform usage reports `gpt-6-astra`; historical-majority provenance
remains unresolved. This is evidence review, not full cross-model completion.

## Expectations written before implementation reads
- For the claimed exponential density law, ratios at two nonnegative heights
  must equal exp(−Δh/H); both sides of a suspected discontinuity must be sampled.
  Finite sampling can refute continuity, not establish C∞ smoothness.
- Mach = speed / sqrt(γ R_specific T(h)); a reference must vary altitude, not
  merely normalise by the same sea-level constant.
- For signed angular velocity Ω about +Y, the air velocity is Ω × p:
  (Ω pz, 0, −Ω px). Magnitude alone cannot distinguish prograde from retrograde.
- A no-tunnelling test must reject a segment with positive endpoint clearance
  but negative interior clearance. An independently sampled segment, including
  endpoints, provides counterexamples; positive samples do not prove global safety.
- Negative controls must show that the existing predicates can fail; acceptance
  of a deliberately broken variant is evidence about test coverage, not proof of
  a production failure. Run the original repros and new independent controls.

## Outcome
**Both findings re-confirmed, S1 retained, with narrower wording.**
Review progress: **21/55 S0/S1 reviewed; 34 pending**. No new finding ID and no
sign-off of other K2 members. Game code and old probes are unchanged.

### A1-U05-1 review — atmosphere gate misses discontinuity, altitude and direction
- Severity: **S1**. Confidence: **confirmed**. Category: **test**.
- Location at `184dc6e`: `game/src/test/Milestone1D_TestHarness.tsx:645–674`
  (actual T1 predicate and detail), `game/src/core/physics/atmosphere.ts:60–83,113–120`;
  `game/src/core/physics/flightController.ts:137` (fixture spin).
  Spec: `Milestone/Milestone 1D.txt` lines 16, 72, 75,
  1161–1163 and 1773–1829.
- Claim: T1's passing result supports the exponential smooth density law,
  Mach and rotating-atmosphere transport.
- Evidence: the new probe extracts the actual predicate and supplies four
  atmosphere functions. Independent expected values use the spec's constants,
  not the tested functions' returned values.

| Variant / control | Actual T1 | Independent evidence |
|---|---|---|
| Baseline | PASS | Density and Mach match at 8 selected altitudes; wind vector matches at 12 poses/spin combinations |
| Density halved at 4 km | PASS | Across 3999.99–4000.01 m, ratio 0.49999167 instead of 0.99998333 |
| Mach uses sea-level sound speed at every altitude | PASS | At 8 km and 800 m/s, reports 2.350920 rather than 2.596888 |
| Wind sign reversed | PASS | Vector error reaches 104 m/s; magnitude remains correct |
| No sound-speed lapse | FAIL | a8 < a0 check responds |
| Constant density | FAIL | Strict sampled monotonicity responds |
| Zero wind | FAIL | 52 m/s magnitude check responds |
| Mach always 2 | FAIL | Sea-level normalisation check responds |

- Qualification: “cannot fail” applies to these missing properties, **not the
  whole row**. The row does test sampled monotonicity, scalar bounds and one
  normalisation. Nonzero-spin transport is unexercised by the default m1d flight
  fixture, not absent from every possible FlightController instance.
- Smoothness qualification: finite numerical tests cannot prove C∞. The
  prescribed density is exponential for **h > 0**, but clamped for h ≤ 0:
  the global C∞ wording is itself too broad at zero. This review's discontinuity
  is at positive altitude, so it does not depend on that boundary.
- Impact: faulty density, altitude-dependent Mach, or signed wind can retain a
  green atmosphere row. No baseline atmosphere-function defect is alleged here.
- Proposed fix: add independent density-ratio/point checks straddling positive
  altitudes, multi-altitude Mach including the temperature floor, signed vector
  wind checks and a nonzero-spin integration fixture. Retain responsive controls.
  The original “1 m max jump proves continuity” remedy is insufficient: a finite
  grid can miss narrower faults and cannot certify derivatives. No RATIFIED change.
- Fix size: one 50-OLU gate session for scalar/vector cases; split the integration
  fixture if it requires additional frame-contract work.

### A1-U05-7 review — vertical dive cannot certify grazing-path collision
- Severity: **S1**. Confidence: **confirmed**. Category: **test**.
- Location at `184dc6e`: harness `:494–530` (observer/start), `:686–691`
  (T2), `:834–855` (frame driver); flight controller `:504–531` (sweep then
  endpoint telemetry), `:609–685` (sweep).
- Claim: the dive and post-tick AGL support no ground clipping.
- Evidence: the actual T2 predicate, `startDive` and observer are extracted.
  The Node driver runs 4/60 s updates with six substeps until landing or 676
  frames. It is a deterministic dive replay, **not the full browser phase
  machine** (which evaluates after cruise) or all five acceptance rows.

| Sweep | T2 | Speed at 1 km | Minimum post-tick AGL | Contacts / landed |
|---|---|---|---|---|
| Baseline | PASS | 264.7494 m/s | 3 m | 4 / yes |
| Literal start + endpoint only | PASS | 264.7494 | 3 m | 4 / yes |
| Lattice 64 / max gap 64 m | PASS | 264.7494 | 3 m | 4 / yes |
| Removed | FAIL | 264.7494 | −1533.66 m | 0 / no |

The three landed replays finish in 270 frames. The no-sweep control ends at
676 frames; the older replay's float-based cap stops slightly earlier and
reports −1529.07 m. This difference does not change the disposition.
Negative observer AGL, negative integrity AGL, no landing and v@1000 = 401
each fail the extracted T2 predicate.

**Independent constructed witness.** In a test-only Gaussian ridge field,
R = 5000 m, ridge height = 20 m and characteristic surface distance = 2 m,
the segment (−15,5010,0) → (15,5010,0) has endpoints +10.022455 m above ground
and an exactly calculable midpoint **10 m below ground**. Vacuum and zero
gravity isolate the path at 1800 m/s for one tick. The baseline sweep contacts
the ridge and ends at +3 m; the endpoint mutant reports no contact and
minPostTickAGL = +10.022455 m. A +30 m high-pass control does not contact.

**Real terrain witness.** A new independent seed (`0x27b205`), uniform-sphere
directions and fresh controllers produce **22/4096** endpoint-mutant paths
whose endpoints clear the real TEST_PLANET but interiors cross it. The worst
retained witness (index 1321) starts at +8.368280 m and ends at +4.247185 m;
post-tick telemetry agrees with that endpoint. Interior clearance is:
- 0.25 m sample gap: −15.046358 m;
- 0.125 m: −15.069991 m;
- 0.0625 m: −15.078225 m.

The same initial state under the unmodified controller produces one contact
and +3 m post-tick clearance. Full position, velocity, quaternion and sampled
witness coordinates are in the JSONL evidence logs. This is **a deliberately
weakened controller**, not a newly proven production tunnelling failure.
The independent height oracle shares the real field but neither the DDA's
sampling positions nor its telemetry. Negative samples are counterexamples;
nonnegative finite samples never establish a universal collision guarantee.

- Qualification: the original lattice=2 / gap=1e9 mutant is **not literally
  endpoint-only for every path**; face-lattice boundaries can still add samples.
  The new mutant replaces the sweep body with exactly start/end samples while
  retaining the engine's contact resolver. The resolver's original finite
  bisection bracket is not certified for arbitrary long weakened-sweep steps.
  The uncontacted grazing witnesses do not invoke that resolver.
- Impact: a substantial sampling regression passes the vertical dive while
  real-terrain interior penetration remains invisible to endpoint-only telemetry.
- Proposed fix: retain the vertical speed/landing test and add independent
  grazing-path checks, the constructed witness and deterministic real-terrain
  witnesses. Score interior clearance rather than trusting minPostTickAGL.
  Preserve no-sweep, negative-AGL and clear-path controls. No RATIFIED change.
- Fix size: one gate session for fixtures plus Node checks; production sweep
  proof/repair (A1-U05-8) is separate and not closed here.

## Verification and reproducibility
Working directory for Node/npm commands: `game/`. Evidence:
[`U27b3b2b2a-evidence/`](U27b3b2b2a-evidence/).
All command exits were captured directly, without piping through a formatter.

| Command | Observed result |
|---|---|
| `npm ci` | exit 0 |
| `node --expose-gc tools/audit/u05-m1d-validity.mjs` | exit 0; 10/11 observations confirmed |
| `node tools/audit/u05c-m1d-dda-dive.mjs` | exit 0; 9/10 observations confirmed |
| `node tools/audit/u27b3b2b2a-m1d-recheck.mjs` (final version, twice) | **26/26, exit 0 each** |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; existing >500 kB chunk warning |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` (repo root) | exit 0, empty |
| `git diff --check` (repo root, final review) | exit 0 |

Original repros intentionally return exit 0 even with unconfirmed observations:
U05's T3-2 expectation (maxDv >10.4; observed10.30) remains unconfirmed;
U05c's TERR-2 false slope bound remains unconfirmed. These are not new review
coverage. Original eight weakened-sweep tunnels (max5.20 m) reproduce; no
baseline tunnels in that original sample. Do not revive the original readonly
canary claim; U27b2 already qualified/refuted that reasoning.

Initial independent run: exit 1 after 11 passing checks because esbuild's ESM
transform inserted an `export` into a Function body. Corrected only this new
probe's Function-body transpilation; the failed log is preserved. Two subsequent
runs were 25/25 exit 0. Adding an explicit positive-endpoints assertion produced
the final 26/26 twice. The new probe exits nonzero on any failed assertion.
Node v24.22.0; source/predicate SHA-256 hashes are printed in every run.
npm reported two dependency vulnerabilities (one moderate, one high); dependency
changes are outside this audit unit. No browser, GPU or full m1d suite run.

## Checked, no issue / boundaries
- Baseline atmosphere values match the independent equations at the tested
  altitudes and signed wind poses.
- Existing T1 and T2 have working rejection controls; they are not universally
  tautological, only insufficient for the wider claims.
- The baseline sweep catches both selected adversarial witnesses.
- Typecheck and build succeed; protected trees and old probes are unchanged.
- No global sweep-safety, C∞, performance, frame-rate or full-suite certification.
  Untouched clusters and historical-majority model provenance remain open.

## Audit-method ADR draft (not a production decision)
- **Context:** confirming prior reports by rerunning their code alone risks
  repeating copied predicates, misleading mutation names and telemetry blind spots.
- **Options:** only replay old probes; duplicate the gate manually; or extract
  the real predicates and compare them against independently designed references.
- **Decision:** extract source predicates/setup, mutate only in memory, and use
  a constructed geometric witness plus independently seeded real-terrain paths.
- **Why:** signed/scalar controls establish predicate sensitivity; the exact
  ridge midpoint establishes penetration without trusting the DDA, while real
  terrain establishes relevance. Refinement checks witness stability, not a proof.
- **Consequences:** a scoped Node result, no browser verdict and no production
  changes. Future fix work must land a rejecting gate before changing the engine.
  This draft stays under docs/audit because A1 forbids docs/decisions edits.

## Handoff
Completed one unit: U27b3b2b2a. Next: **U27b3b2b2b**, remaining K2c five
(U06-1, U07-1/-2, U08-5/-6) and K2d four; split before execution, starting
m1c U06-1. Then K3–K9 and U27c → LEAD GATE. T1 stays paused.
