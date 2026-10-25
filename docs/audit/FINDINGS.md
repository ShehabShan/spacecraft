# A1 ENGINE AUDIT — CONSOLIDATED FINDINGS

- Task: A1 (read-only) · Branch: `a1-engine-audit` · Built from U01–U26 reports at `49e6c32`
- Status: **U27b in progress — K1, K2a, K2b and eight K2c findings re-checked (through U27b3b2b1); 19/55 S0/S1 reviewed, 36 pending.** U27a built the index without rerunning repros. Fix tasks and the Lead summary remain U27c. Historical-majority model provenance is not yet established (see review below).
- Original evidence lives in each unit report (`docs/audit/Uxx-*.md`). This file indexes, groups and ranks it; the re-check table records later confirmation or correction without erasing original reports.
- Regenerate the index (§4) with `python3 game/tools/audit/u27-findings-index.py --md` from the repo root. `--stats` and `--s01` print the counts and the S0/S1 list.

## 1. Totals

| | S0 | S1 | S2 | S3 | Total |
|---|---|---|---|---|---|
| Findings | 1 | 54 | 66 | 46 | 167 |

- **Confidence:** 143 confirmed, 15 high, 7 likely, 1 medium, 1 suspected.
  - U08 and U09 use "high (repro/read/citation)" in place of the template's "confirmed". This file ranks "high" as confirmed and "medium" between likely and suspected. The reports are left unchanged.
- **Duplicate IDs:** 0 (167 unique `### A1-Uxx-n` headers).
- **Category, as first word in the reports:** engine 60, test 30, play 22, spec 21, doc 12. The remaining findings use free-text categories.
- **Unanswered look-and-feel questions for the Lead** are at the ends of U10a, U10b, U16 (two) and U17 (two). They are collected for the Lead summary in U27c. The U19 questions were ruled on 2026-10-23.

## 2. Ranking rule

- **Score** = severity weight × confidence weight.
  - Severity weights: S0 = 4, S1 = 3, S2 = 2, S3 = 1.
  - Confidence weights: confirmed or high = 1.0, likely = 0.7, medium = 0.5, suspected = 0.3.
- **Merging:** duplicates are merged into a **cluster** when one root cause or one fix closes them. The member IDs stay listed so every report remains traceable.
- **Cluster order:** clusters are ranked first by their worst member, then by the summed score of their S0/S1 members, then by how directly they block the §13 goal.
- **Rank by this rule:** K1 (S0, 7.0) → K2 (83.1) → K3 (21.0) → K4 (15.0) = K6 (15.0) → K7 (9.0) → K8 (6.0) = K9 (6.0) → K5 (3.0). Cluster numbers group by subsystem and do not follow rank.
- **Rank is not fix order.** Fix order is set in U27c and puts gates first, per the plan.

## 3. S0/S1 clusters (all 55 S0/S1 findings, each in exactly one cluster)

### K1 — The mesh↔impostor handoff exists only in the test harness and renders nothing for 5.6 km on descent — score 7.0 (1× S0, 1× S1)
- **Members:**
  - A1-U03-1 (S0): the handoff renders nothing for 5.6 km on every descent, and R3 cannot see it.
  - A1-U21-3 (S1): the handoff and its RATIFIED hysteresis live only in the 1F harness. The engine pool has an alpha nobody computes, and play passes α = 1.
- **Why merged:** one missing engine-level handoff controller. The play page sidesteps it today only because Earth is always a mesh.
- **Touches:** RATIFIED impostor hysteresis (ADR needed). Render path (`MultiCameraRig`, `SkyImpostorPool`).

#### K1 re-check — U27b1 (2026-10-25, base `341ba65`)

| Member | Review outcome | Evidence |
|---|---|---|
| A1-U03-1 | **Re-confirmed (S0)**, scope clarified | Source-extracted real update/apply functions + real pool: 57 missing samples at 100 m spacing; cutoff 225,647.934 m, inbound return strictly below 220,000 m. Actual R3(a): zero holes. |
| A1-U21-3 | **Re-confirmed (S1)** | Real play update: 72/72 alpha values = 1; no Earth/Moon impostor slot. Source caller inventory confines handoff to harness. |

Full method, commands/exits and controls: [U27b1 K1 re-check](U27b1-k1-recheck.md).
Both old repros rerun (exit 0); independent probe 11/11 (exit 0). **No fresh GPU
pixels or full browser suite.** “Nothing” is the affected probe's representations,
not the whole scene or a demonstrated play-page disappearance; distances are
harness sweep parameters. The spec's proof also omits mesh state. Moving the
controller alone is not a sufficient fix: coverage, silhouette and production
integration require separate verification.

Reviewer model per platform usage: **GPT-6 Astra (`gpt-6-astra`)**. Accessible
prior SOLARIS work used Claude Opus 5.5, but the models of most historical audit
units are not attributable from available records. That cross-model provenance
condition remains open. K2–K9 were **not reviewed** by the U27b1 checkpoint; see the later K2a review below.

### K2 — Acceptance gates cannot fail on their own claims — score 83.1 (28× S1)
This is the largest cluster. The 1A–1F approvals rest on these gates, so they cannot be trusted as proof until the cluster is fixed.

- **K2a — allocation claims use insufficient instruments (unforced browser heap deltas, post-GC Node retained heap, or a boot-only buffer counter):** A1-U03-4, A1-U04-5, A1-U05-3, A1-U06-2, A1-U07-3, A1-U09-1. The engine-side allocation they miss is K5.
- **K2b — e2e spec plumbing passes broken pages:** A1-U08-1 (page and console errors are never asserted), A1-U08-2 (placeholder badges and dropped rows pass), A1-U08-9 (only the literal text "FAIL" fails).
- **K2c — rows that are tautologies or compare constants:** A1-U02-1, A1-U02-2, A1-U02-3, A1-U03-2, A1-U03-3, A1-U04-1, A1-U04-3, A1-U04-4, A1-U05-1, A1-U05-7, A1-U06-1, A1-U07-1, A1-U07-2, A1-U08-5, A1-U08-6.
- **K2d — verdict depends on the fixture, the frame rate or the process:**
  - A1-U03-5: R5's "rebases ≥ 2" is unreachable by its own fixture.
  - A1-U05-2: the T2 verdict is fps-dependent.
  - A1-U08-7: m1a T5 misses stalls and flags the wrong rebase frame.
  - A1-U01-1 (likely): the R2 regression at 3057899 shipped without a gate run.
- **Touches:** tests and harness acceptance rows only, with no game behaviour change. The 1F rows are PARKED (§8), so changing them needs a Lead directive naming 1F.

#### K2a re-check — U27b2 (2026-10-25, base `36106c8`)

| Member | Review outcome | Evidence / correction |
|---|---|---|
| A1-U03-4 | Re-confirmed S1 | m1f actual R4 accepts same-shaped replacement; missing/negative heap readings pass. |
| A1-U04-5 | **Changed in part; S1 retained** | Heap under-test confirmed, but “canary cannot fail” refuted: replacing `up` fails the actual identity check. |
| A1-U05-3 | Re-confirmed S1 | Real-controller extra-allocation burn passes 3/3; baseline exceeds bound 2/3. |
| A1-U06-2 | Re-confirmed S1 | 1,000 injected runtime buffers retain 4,096,000 B; actual T2 counter delta remains 0/pass. Counter-increment control fails. |
| A1-U07-3 | Re-confirmed S1 | Real-core allocation mutants pass absent/negative measurement; identity replacement and large retained leak controls fail. |
| A1-U09-1 | Re-confirmed S1 | ~4 KB/frame transient mutant passes perf 19/19; retained mutant fails. Independent observer sees ~41.6 MB churn hidden by post-GC delta. |

Full method, source citations, commands/unpiped exits, controls, limitations and
audit-method ADR draft: [U27b2 K2a re-check](U27b2-k2a-recheck.md).
Original repros all exit 0, **not** all expectations pass: U05 10/11 (old unrelated
T3-2 expectation), U09 10/11 (cold-camera failure did not recur).
New `node --expose-gc tools/audit/u27b2-k2a-recheck.mjs` from `game/`:
**19/19, exit 0 on three runs**. Typecheck/build exit 0; protected-source diff
against `256d77d` empty. No fresh browser/GPU run or production allocation-rate
claim. Raw logs and exit manifests: `U27b2-evidence/`.

**Remedy correction:** forced GC before/after, even with `--jitless` or a trend,
measures retention, not transient allocation; do not implement the U04/U05/U07
suggestions as allocation detectors. Keep meaningful identity checks, add
calibrated allocation-sensitive controls (including collected objects), and
independently instrument runtime buffer allocations. These are proposals for
later fix tasks, not implemented fixes. Original reports/index titles are retained
for provenance; this review supersedes the corrected subclaims.

Six members reviewed here, plus two in K1 = **8/55**, with **47 pending**.
Reviewer **GPT-6 Astra (`gpt-6-astra`)**, verified from platform usage; historical-
majority provenance remains open. Remaining K2 and K3–K9 are not signed off.

#### K2b re-check — U27b3a (2026-10-25, base `af725c1`)

| Member | Review outcome | Evidence / qualification |
|---|---|---|
| A1-U08-1 | Re-confirmed S1 | Real m1b page/console errors and m1a pageerror pass; all six unchanged specs accept pre-verdict errors in fixtures. |
| A1-U08-2 | Re-confirmed S1 | Real m1b placeholders / dropped row pass; all six specs accept both fixture classes. |
| A1-U08-9 | Re-confirmed S1 | Real m1a ERR and red m1d with ERR + forced PASSED pass; all six specs accept ERR fixtures. |

Full method, commands/exits, exact citations and audit-method ADR:
[U27b3a K2b re-check](U27b3a-k2b-recheck.md).
Independent probe **54/54 expected dispositions ×2**, wrapper exit 0:
6 clean accepts, 18 correctly rejected controls, **30 false accepts per run**.
The raw mixed Playwright suites exit 1 intentionally. These are plumbing tests,
including m1f; **not** fresh engine/GPU acceptance or closure of the full m1f
mutation residual. Original m1d baseline remains red.

The archived §3.7 only mandates console collection/PASSED assertion/badge scraping;
the original report overstates an explicit no-error/all-rows-PASS mandate. Findings
stand as independently demonstrated gate-quality gaps. Remedy: explicit suite
completion, required row identities + exact PASS states, and unexpected-error
assertions; resolve or narrowly justify baseline 404 messages before gating them.
Do not derive the expected row manifest from the page under test.

Three members reviewed here, plus prior eight = **11/55**, **44 pending**.
Reviewer platform model: **GPT-6 Astra (`gpt-6-astra`)**; historical-majority
provenance remains unresolved. K2c/K2d and K3–K9 are not signed off.
Typecheck/build/protected diff exit 0. Raw evidence: `U27b3a-evidence/`.


#### K2c m1f R1/R2 re-check — U27b3b1 (2026-10-25, base `3081cd6`)

| Member | Review outcome | Evidence / qualification |
|---|---|---|
| A1-U02-1 | Re-confirmed S1; qualified | Actual loop checks slot 0 six times. Four submitted/input geometry mutants pass while independent geometry rejects. Cached-position, first-slot fade, count and Sun scalar controls do fail; not a claim that full R2 can never fail. |
| A1-U02-2 | Re-confirmed S1 | Actual plane/mask mutations do not affect fixed pair arithmetic. Independent depth separation drops 1539.03 → 0.00764 steps; actual clause still passes with supplied identical-image scalar. No GPU verdict. |
| A1-U02-3 | Re-confirmed S1 | 8190 actual chunk origins hit the 1e9/30 km sentinel. Conservative noise-derived bound makes raw gap ≤ −1856.18 m without relying on the hand-entered 360 m terrain maximum. Positive out-of-domain control exercises real branch. |

Full method, corrections, source citations, controls and audit-method ADR draft:
[U27b3b1 R1/R2 re-check](U27b3b1-k2c-r1r2-recheck.md).
Original repro **9/9**, exit 0; independent extracted predicates **20/20 ×2**,
exit 0. Typecheck/build/protected diff exit 0. Raw logs: `U27b3b1-evidence/`.

The R2 “cannot fail” wording in the historical report/index is scoped to the
rendered-data property: cached bookkeeping can fail, and R2(b) remains responsive.
Use submitted transform plus shader disk/edge ratio, not only the disk attribute,
in future angular checks. Preserve real controls; require distinct bodies and
explicit coverage. R1's analytic test is separate from its determinism predicate.
No fresh browser/pixels or full m1f gate.

Three more reviewed = **14/55; 41 pending**. Remaining K2c: 12; K2d: four.
Reviewer platform model **GPT-6 Astra (`gpt-6-astra`)**; historical-majority
provenance unresolved. Remaining K2 and K3–K9 are not signed off.

#### K2c m1f R3 re-check — U27b3b2a (2026-10-25, base `0826c26`)

| Member | Review outcome | Evidence / qualification |
|---|---|---|
| A1-U03-2 | Re-confirmed S1; qualified | Actual scalar/live loops miss 120 inbound omissions; hidden/full draw-output controls miss 4,020 omissions/doubles with supplied matching silhouette. Original M1/M2 fail other clauses: flips/slope. Non-complementary trace and missing crossings do fail. |
| A1-U03-3 | Re-confirmed S1; qualified | Extracted pixel loop accepts bright-background missing/shifted/enlarged targets; a 69-pixel difference becomes 0.2695% against 25,600 background pixels. Empty masks and isolated bad disks fail. Historical U01 saturation re-read, not a fresh GPU run or proof of every run since 3057899. |

Method, source citations, qualifications and audit-method ADR draft:
[U27b3b2a R3 re-check](U27b3b2a-k2c-r3-recheck.md).
Original repro **22/22**, independent controls **26/26 ×2**, all exit 0.
Typecheck/build/protected diff exit 0; evidence in `U27b3b2a-evidence/`.
These are source-extracted predicate tests with synthetic draw/byte fixtures, not
a fresh browser/full-R3 verdict. Preserve responsive controls; future pixel gates
must isolate target identity and establish coverage before comparison.

Two more reviewed = **16/55; 39 pending**. Remaining K2c: ten; K2d: four.
Next U27b3b2b must split before execution, beginning m1e U04-1/-3/-4.
Reviewer platform model **GPT-6 Astra (`gpt-6-astra`)**; historical-majority
provenance still unresolved. Unrelated original-probe R4/R5 output is not sign-off.

#### K2c m1e re-check — U27b3b2b1 (2026-10-25, base `6823d42`)

| Member | Review outcome | Evidence / qualification |
|---|---|---|
| A1-U04-1 | Re-confirmed S1; qualified | Wrong launch-tilt correction: zero-spin residual −0.974 cm becomes −0.0126 cm using the actual normal. Prediction −1/100/NaN still passes. Six measured-variable controls reject. The ≈1.885 cm radial sphere is a different fixture, not exact terrain truth or general KCC physics sign-off. |
| A1-U04-3 | Re-confirmed S1 | One inward position fault gives −0.080 m geometric clearance but complete R1/R2 rows still pass with Infinity telemetry. Finite −0.10 m telemetry fails both. Baselines have +0.020 m clearance; no natural penetration alleged. |
| A1-U04-4 | Re-confirmed S1; qualified | 87 measured 4° snaps pass; 8° snaps fail. Baseline ends 123.03° from start: no closed-loop holonomy test. Separate steering/transport and derive tolerances; original 1e−6 rad recommendation is not established for the terrain-blended path. |

Report, controls and audit-method ADR draft:
[U27b3b2b1 m1e re-check](U27b3b2b1-m1e-recheck.md).
Original repro **20/21, exit 1** (unrelated R4 M-LEAK GC trial); targeted
checks reproduced. Independent first attempt **27/28, exit 1** caught an
out-of-window injection; corrected probe **28/28 ×2, exit 0**.
Typecheck/build/protected diff exit 0; raw evidence in `U27b3b2b1-evidence/`.

The spec explicitly permits R5's broad 0.6–6 cm window; the issue is incorrect
tilt compensation and implied theory agreement. Spin scaling changes more than
Coriolis. Preserve the working bounds and distinguish analytic reference fixtures
from terrain-normal launches. Original reports/index remain historical; this
review supersedes their qualified subclaims. No fresh browser/live-trek verdict.

Three more reviewed = **19/55; 36 pending**. Remaining K2c: seven; K2d: four.
Next **U27b3b2b2**, split before execution beginning m1d U05-1/-7.
Reviewer platform model **GPT-6 Astra (`gpt-6-astra`)**; historical-majority
provenance unresolved. Original readonly-canary output remains refuted by U27b2;
no untouched findings signed off.

### K3 — No reference-frame model: bodies do not spin and actors are not parented — score 21.0 (7× S1)
- **Members:**
  - A1-U26-2: synthesis of the members below.
  - A1-U12-1: no spin rail, pole or prime meridian.
  - A1-U13-1: no parented-compose step in the tick, so the play world freezes the sky.
  - A1-U17-1: airborne/zero-G `up` re-aligns toward the world radial. Latent at Ω = 0.
  - A1-U18-3: the ship is split across two frames under planet spin; a parked ship slides 179 m in 10 s.
  - A1-U16-2: the spin-phase wrap tick gives 66 % false landings.
  - A1-U10-5: the speed limits have no frame, so every body outruns them.
- **Why merged:** one state-model change (D-ADR-2/3 in `U26-adr-drafts.md`) closes all of these.
- **Blocks:** the §13 goal ("every planet and moon rotates and orbits") and T2.

### K4 — Terrain truth is inconsistent: the drawn mesh, normals, height bounds and streaming disagree with the collision field — score 15.0 (5× S1)
- **Members:**
  - A1-U22-1: drawn L4 mesh vs analytic height; metre-scale error, so feet sink or float.
  - A1-U14-1: fixed ε = 0.002 rad normals are wrong by degrees.
  - A1-U14-3: `maxTerrainHeight` is hand-typed; STEEP reaches 2,216 m against a 900 m bound.
  - A1-U05-8: the DDA no-clip proof assumes a slope bound of 1.2; the measured slope is up to 6.4.
  - A1-U20-1: 144 meshes on 96 worker sets drops requests, and the dead `pendingRec` leaves holes.
- **Why merged:** all are fixed by one terrain-instance and height-service design (D-ADR-6) whose bounds are derived from the noise parameters.

### K5 — The play frame allocates ≈10.5 KB per frame against the zero-GC invariant — score 3.0 (1× S1)
- **Member:** A1-U25-1. 72–78 % of the allocation is in the core `terrainHeight`, `noise3` and `sampleSurfaceInto` path.
- **Ordering:** the K2a gate fix must land first so the fix can be measured (§13 safeguard 4). The fix shares the height service with K4.

### K6 — Flight model: controls, the speed cap and landing physics — score 15.0 (5× S1)
- **Members:**
  - A1-U18-1: yaw and roll are mirrored.
  - A1-U18-2: the RATIFIED C¹ cap also fades retro thrust, so the ship cannot brake near 2,000 m/s.
  - A1-U19-2: the governor holds only for Earth's ρ0·H.
  - A1-U19-3: any touchdown speed "lands".
  - A1-U19-4: one atmosphere for every body.
- **T2 link:** U19-2/3/4 and U18-2 are T2 prerequisites. The Lead rulings of 2026-10-23 apply to them.

### K7 — Character controller (KCC) rules and timing — score 9.0 (3× S1)
- **Members:**
  - A1-U16-1: the RATIFIED 50° walk limit is really ≈56–59°.
  - A1-U17-3: landings snap the frame by up to 51° in one tick.
  - A1-U13-2: the controller and core accumulators disagree on 16.7 % of 144 Hz frames.
- **Touches:** the RATIFIED KCC slope rule (ADR needed).

### K8 — Impostor projection off-axis — score 6.0 (2× S1)
- **Members:**
  - A1-U15-3: camera-facing quads squash big bodies by up to ~31 %.
  - A1-U15-4: staged-rank depth draws far bodies over near ones off-axis.

### K9 — Character animation foot contact — score 6.0 (2× S1)
- **Members:**
  - A1-U24-1: the stance foot floats up to 14 cm at run.
  - A1-U24-3: slope-foot roll is inverted.
- **Note:** the drawn-vs-collision part of foot error depends on K4.

### Cross-cluster dependencies (input to U27c fix ordering, from U26 §1)
- Gate fixes come before everything else: K2 → all other clusters.
- K3 (frames) → K6, K7 and T2.
- K4 (height service) → K5, K9 and the K7 clearance work.
- K1 and K8 (render) come after K3.

## 4. Full index (auto-generated; all 167 findings)

| ID | Sev | Conf | Category | Title | Report |
|---|---|---|---|---|---|
| A1-U01-1 | S1 | likely | test | R2 regressed in commit 3057899 (F-12 suite-pose change), which shipped without a gate run | `U01-m1f-baseline.md` |
| A1-U01-2 | S2 | confirmed | test | R2 fails silently: the detail string cannot distinguish "occluded" from "culled" or "blank" | `U01-m1f-baseline.md` |
| A1-U02-1 | S1 | confirmed | test (and spec: the same code is in Milestone 1F ~1900–1931) | R2(a)'s per-instance θ/position audit cannot fail, and it audits only one body | `U02-m1f-r1r2-validity.md` |
| A1-U02-2 | S1 | confirmed | test (spec: Milestone 1F ~1840–1880, same code) | R1's pair audit runs on constants: `layeredMin > 10 && singleMin < 1` is true by construction | `U02-m1f-r1r2-validity.md` |
| A1-U02-3 | S1 | confirmed | test (spec: Milestone 1F :1849–1869; the spec table :2562 claims "Earth/horizon ~600,000×") | R1(b) "Earth vs horizon terrain" is structurally dead (frame error); it always prints the 1e9 sentinel | `U02-m1f-r1r2-validity.md` |
| A1-U02-4 | S2 | likely | test | R1's frozen-frame determinism half cannot detect z-fighting | `U02-m1f-r1r2-validity.md` |
| A1-U02-5 | S2 | confirmed | doc / spec | R2's tolerances are documented three different ways | `U02-m1f-r1r2-validity.md` |
| A1-U02-6 | S3 | confirmed | test | `abRender`'s quiesce guard is vacuous, and its fallthrough comment is false | `U02-m1f-r1r2-validity.md` |
| A1-U03-1 | S0 | confirmed | engine (harness handoff controller) + test | The mesh↔impostor handoff renders NOTHING for 5.6 km on every descent; R3 cannot see it | `U03-m1f-r3r4r5-validity.md` |
| A1-U03-2 | S1 | confirmed | test (spec: same code in Milestone 1F) | R3(a) and R3(b) hole/double counters are tautologies | `U03-m1f-r3r4r5-validity.md` |
| A1-U03-3 | S1 | confirmed | test | R3(c) silhouette A/B compares a saturated window, so it passes vacuously | `U03-m1f-r3r4r5-validity.md` |
| A1-U03-4 | S1 | confirmed | test | R4's identity canary is never checked; heap rows pass on GC or missing data | `U03-m1f-r3r4r5-validity.md` |
| A1-U03-5 | S1 | confirmed | test (fixture) — answers the plan seed "is the gate wrong, or the terrain, or the KCC?": the gate. | R5 "rebases ≥ 2" is unreachable by the gate's own fixture (SAT_B is overhead; the walk ends at its nadir) | `U03-m1f-r3r4r5-validity.md` |
| A1-U03-6 | S2 | confirmed | test | R5 straddler A/B never checks that Sat B is visible; Sun continuity is sampled only on rebase frames | `U03-m1f-r3r4r5-validity.md` |
| A1-U04-1 | S1 | confirmed | test | R5 "spec-canonical" Coriolis row passes on a mis-measured drift (0.75 cm vs ≈1.9 cm true); `predicted` is never compared | `U04-m1e-harness-validity.md` |
| A1-U04-2 | S3 | confirmed | spec / doc | The spec's (4/3)Ωu³/g² uses g = 9.81 and ignores the rotating frame; the true drift here is 11% larger | `U04-m1e-harness-validity.md` |
| A1-U04-3 | S1 | confirmed | test (plus KCC integrity semantics) | "Penetration-free" clauses in R1 and R2(c) are vacuous: `integrity.minAGL` is never written while grounded | `U04-m1e-harness-validity.md` |
| A1-U04-4 | S1 | confirmed | test | R1 "no yaw snaps" bounds admit 4° snaps; the holonomy claim is printed but untested | `U04-m1e-harness-validity.md` |
| A1-U04-5 | S1 | confirmed | test | R4 zero-gc: identity canary cannot fail; heap guard is optional and GC-timing dependent | `U04-m1e-harness-validity.md` |
| A1-U04-6 | S2 | confirmed | test | R3 state-machine sub-checks weaker than worded | `U04-m1e-harness-validity.md` |
| A1-U05-1 | S1 | confirmed | test | T1 cannot fail on its own claims (C∞ law, Mach, rotating atmosphere) | `U05-m1d-harness-validity.md` |
| A1-U05-2 | S1 | confirmed | test (and play: documents a real slow-motion effect) | T2 (governor dive) verdict depends on machine frame rate | `U05-m1d-harness-validity.md` |
| A1-U05-3 | S1 | confirmed | test | T4 heap clause passes any negative delta, and its verdict is GC noise | `U05-m1d-harness-validity.md` |
| A1-U05-4 | S2 | confirmed | test | T4 identity canary is tautological | `U05-m1d-harness-validity.md` |
| A1-U05-5 | S2 | confirmed | test | T5 offset check cannot fail; the "Δ f32-exact" claim is never checked | `U05-m1d-harness-validity.md` |
| A1-U05-6 | S3 | confirmed | test | T3 "no hard clamp" only covers clamps inside `integrateFlight` | `U05-m1d-harness-validity.md` |
| A1-U05-7 | S1 | confirmed | test | T2's no-clip clauses cannot test the DDA; `minPostTickAGL` is blind to tunnelling by construction | `U05-m1d-harness-validity.md` |
| A1-U05-8 | S1 | confirmed | spec + engine | The DDA no-clip proof rests on a false terrain slope bound (L = 1.2; measured up to 6.4) | `U05-m1d-harness-validity.md` |
| A1-U05-9 | S2 | confirmed | spec + doc | The "structural limit" a_struct is exceeded 6.9× during the governed dive | `U05-m1d-harness-validity.md` |
| A1-U05-10 | S2 | confirmed | engine | Telemetry g-load excludes drag (0.000 g shown during a 63 g deceleration) | `U05-m1d-harness-validity.md` |
| A1-U06-1 | S1 | confirmed | test | T3 never compares the 12 cube-face seams; inverted face-edge normals still PASS | `U06-m1c-harness-validity.md` |
| A1-U06-2 | S1 | confirmed | test | T2 "zero main-thread buffer allocations" is zero by construction | `U06-m1c-harness-validity.md` |
| A1-U06-3 | S2 | confirmed | test (harness controller; it is not the play-layer LOD) | The harness LOD merge leaves children `desired`; parent and children chunks can coexist for seconds | `U06-m1c-harness-validity.md` |
| A1-U06-4 | S2 | confirmed | test / engine (design) | Neighbours two levels apart occur in flight and are never audited (no 2:1 balance) | `U06-m1c-harness-validity.md` |
| A1-U06-5 | S2 | confirmed | test | T4 heap guard passes on N/A and on any negative delta; memory is bucketed | `U06-m1c-harness-validity.md` |
| A1-U06-6 | S3 | confirmed | test / doc | heap-flat detail string prints a literal template expression | `U06-m1c-harness-validity.md` |
| A1-U07-1 | S1 | confirmed | test | No m1b row checks the orbital time scale; Kepler-3 is a tautology | `U07-m1b-harness-validity.md` |
| A1-U07-2 | S1 | confirmed | test | The "independent" reference re-uses the rail's geometry; orbit direction is never checked | `U07-m1b-harness-validity.md` |
| A1-U07-3 | S1 | confirmed | test | Zero-GC row: heap clause passes on missing API and on GC; verdict flips between runs | `U07-m1b-harness-validity.md` |
| A1-U07-4 | S2 | confirmed | test | Vis-viva clause is an identity and skips all moons | `U07-m1b-harness-validity.md` |
| A1-U07-5 | S2 | confirmed | test | Acceptance console line and T3 detail print literal `{…}` instead of values | `U07-m1b-harness-validity.md` |
| A1-U07-6 | S2 | confirmed | doc | Documented period table is stale by up to 11 s | `U07-m1b-harness-validity.md` |
| A1-U07-7 | S3 | confirmed | spec | Earth's Moon sits at 0.71 of Earth's Hill radius | `U07-m1b-harness-validity.md` |
| A1-U08-1 | S1 | high | gate sensitivity | Page errors and console errors are collected but never asserted | `U08-e2e-spec-sensitivity.md` |
| A1-U08-2 | S1 | high | gate sensitivity | A missing result passes: placeholder badges and dropped rows are not detected | `U08-e2e-spec-sensitivity.md` |
| A1-U08-3 | S2 | high | gate design | The gate trusts the harness's own PASSED line, which carries no cross-checkable values | `U08-e2e-spec-sensitivity.md` |
| A1-U08-4 | S2 | high | build plumbing | The gate build does not type-check, and there is no CI | `U08-e2e-spec-sensitivity.md` |
| A1-U08-5 | S1 | high | test | m1a rows T2–T4 cannot detect a wrong rebase threshold or a wrong lattice | `U08-e2e-spec-sensitivity.md` |
| A1-U08-6 | S1 | high | test | m1a never checks the precision invariant or the static beacons it renders as "the signature visual proof" | `U08-e2e-spec-sensitivity.md` |
| A1-U08-7 | S1 | high | test | m1a T5 cannot see the worst stutters, and its "rebase frame" is the wrong frame | `U08-e2e-spec-sensitivity.md` |
| A1-U08-8 | S2 | high | test | m1a console verdict line and four of the five row details print literal template text | `U08-e2e-spec-sensitivity.md` |
| A1-U08-9 | S1 | high | test | The badge check only rejects the literal text "FAIL"; any other failing badge passes | `U08-e2e-spec-sensitivity.md` |
| A1-U08-10 | S3 | medium | test / env | The m1f gate did not reach a verdict within 240 s on a 2 vCPU / 4 GB VM | `U08-e2e-spec-sensitivity.md` |
| A1-U09-1 | S1 | high | test | The heap rows cannot detect per-frame allocation, so the zero-GC claim is untested | `U09-play-node-tests.md` |
| A1-U09-2 | S2 | high | test (bad method) | The controller camera heap row is red because it has no warm-up, not because of a leak | `U09-play-node-tests.md` |
| A1-U09-3 | S2 | high | spec–test mismatch | Only test-play-perf checks the §13.2 "no monotonic growth" clause; six rows are one-sided | `U09-play-node-tests.md` |
| A1-U09-4 | S3 | high | test sensitivity | The jump-buffer rows bracket the window at [0.10, 0.20) s, not 0.12 s | `U09-play-node-tests.md` |
| A1-U09-5 | S3 | high | test | Without `--expose-gc` the controller zero-GC row passes vacuously | `U09-play-node-tests.md` |
| A1-U09-6 | S3 | high | test / reporting | Output lines do not follow the §13.2 format | `U09-play-node-tests.md` |
| A1-U10-1 | S2 | confirmed | spec | Spec 02 has lost every formula: 9 empty value/formula slots | `U10-design-specs-scale.md` |
| A1-U10-2 | S2 | confirmed | spec (data) | Catalog radii follow two different compression laws; Mars is smaller than Mercury, Charon and Titania larger than the Moon | `U10-design-specs-scale.md` |
| A1-U10-3 | S2 | confirmed | spec (data) / play | Earth fills 14.7° of the play Moon's sky (real 1.9°); moon orbits have no common compression law | `U10-design-specs-scale.md` |
| A1-U10-4 | S2 | confirmed | spec / play | The play Moon is a 1:1,273 world with real g: horizon 66 m, mountains 26 % of the radius | `U10-design-specs-scale.md` |
| A1-U10-5 | S1 | confirmed | spec | The speed limits have no reference frame, and every planet and moon outruns them | `U10-design-specs-scale.md` |
| A1-U10-6 | S2 | confirmed | spec | A day is longer than a year: spin runs on real time, orbits on the 30× clock | `U10-design-specs-scale.md` |
| A1-U10-7 | S2 | confirmed | spec | Spec 05 1B asks for "exact real-world relative positions"; the catalog cannot produce them, and spec 00 rules them out of scope | `U10-design-specs-scale.md` |
| A1-U10-8 | S2 | confirmed | spec | `gravityRange` is called a sphere of influence but matches neither Hill nor Laplace SOI; the Sun has no range yet drives every rail | `U10-design-specs-scale.md` |
| A1-U10-9 | S2 | confirmed | spec | Atmospheres are called "shallow" but most are as tall as the planet | `U10-design-specs-scale.md` |
| A1-U10-10 | S2 | confirmed | spec / doc | Specs 00/01/05 are built on Rapier; the engine and the brief defer it | `U10-design-specs-scale.md` |
| A1-U10-11 | S3 | confirmed | spec | Spec 01 says rebase on crossing a 256 m boundary; spec 05 and the code rebase past 1,024 m | `U10-design-specs-scale.md` |
| A1-U10-12 | S3 | confirmed | spec / engine | Spec 03 gives no moon a portal distance; the code invents 80,000 m | `U10-design-specs-scale.md` |
| A1-U10-13 | S3 | confirmed | spec | Two different zero-GC bars | `U10-design-specs-scale.md` |
| A1-U10-14 | S3 | confirmed | spec (look and feel) | The artistic Sun is 3.8° wide from Earth and only 1.2× Jupiter | `U10-design-specs-scale.md` |
| A1-U11-1 | S2 | confirmed | engine | Adapter never re-shows an entity that is unregistered and registered again | `U11-precision-floating-origin.md` |
| A1-U11-2 | S2 | confirmed | engine | Unregistering the focus entity silently re-focuses an arbitrary entity, and the origin jumps there | `U11-precision-floating-origin.md` |
| A1-U11-3 | S3 | confirmed | engine | `getOrigin()` / `getOriginReadonly()` return the live, writable origin; one write breaks the lattice and `RebaseEvent.delta` | `U11-precision-floating-origin.md` |
| A1-U11-4 | S3 | confirmed | doc | The power-of-two rationale is overstated: render precision does not depend on the lattice, and the Δ bound is conservative | `U11-precision-floating-origin.md` |
| A1-U12-1 | S1 | confirmed | engine + spec | No body rotates: the engine has no spin rail, no pole, no prime meridian | `U12-orbits-catalog.md` |
| A1-U12-2 | S2 | confirmed | engine | The rail accepts non-elliptical elements and returns NaN or a degenerate line silently | `U12-orbits-catalog.md` |
| A1-U12-3 | S2 | confirmed | spec + engine (data) | Every orbit is circular and in one plane, including the systems where that is visibly wrong | `U12-orbits-catalog.md` |
| A1-U12-4 | S3 | confirmed | engine | Newton exit is never met for e ≥ 0.9999 near M ≈ 0 (accuracy still fine) | `U12-orbits-catalog.md` |
| A1-U12-5 | S3 | confirmed | doc | `wrapAngle` returns [−π, π), not (−π, π] as documented | `U12-orbits-catalog.md` |
| A1-U12-6 | S3 | confirmed | spec (data) | Triton's surface gravity disagrees with its own mass fact by 8 % | `U12-orbits-catalog.md` |
| A1-U13-1 | S1 | confirmed | engine + spec | The tick has no parented-compose step: the player world is detached from the solar system | `U13-simulation-core.md` |
| A1-U13-2 | S1 | confirmed | play + engine | Controller and core accumulators drift apart at 144 Hz (16.7 % of frames) | `U13-simulation-core.md` |
| A1-U13-3 | S2 | confirmed | engine + spec + doc | Below 12 fps the game runs in slow motion; the spec's load shedding does not exist and `shedSeconds` under-counts | `U13-simulation-core.md` |
| A1-U13-4 | S2 | confirmed | engine | No interpolation factor: 58 % of frames at 144 Hz render with no new tick | `U13-simulation-core.md` |
| A1-U13-5 | S2 | confirmed | engine | A rebase listener that unsubscribes during the emit makes the next listener miss the event | `U13-simulation-core.md` |
| A1-U13-6 | S3 | confirmed | play | `moonWorld` ticks the core directly at boot and on every respawn | `U13-simulation-core.md` |
| A1-U13-7 | S3 | likely | engine + doc | "Allocation per tick: 0" is not exact (≈ 1.6 B/tick, GC count grows with N) | `U13-simulation-core.md` |
| A1-U14-1 | S1 | confirmed | engine + spec | Fixed ε = 0.002 rad is too coarse for the detail octaves: normals and slopes are wrong by degrees | `U14-terrain-field.md` |
| A1-U14-2 | S2 | confirmed | engine + spec | The normal depends on a tangent-frame choice that flips on 6 planes: up to 37° jumps | `U14-terrain-field.md` |
| A1-U14-3 | S1 | confirmed | test + engine | `maxTerrainHeight` / `HEIGHT_SLACK` are hand-typed, and the m1e slope suite breaks its own: STEEP reaches 2,216 m vs 900 m | `U14-terrain-field.md` |
| A1-U14-4 | S3 | confirmed | doc + engine | Spherify distortion is misstated: linear variation 2×, not √2; `chunkArcWidth` is not conservative | `U14-terrain-field.md` |
| A1-U14-5 | S2 | likely | engine | `terrainHeight` and `terrainNormalInto` are not allocation-free in V8 | `U14-terrain-field.md` |
| A1-U14-6 | S3 | confirmed | engine | `chunkKey` collides from level 9; seeds alias; one active field per thread | `U14-terrain-field.md` |
| A1-U15-1 | S2 | confirmed | engine | "Parallel transport" is Gram-Schmidt projection: not reversible, so up jitter turns into heading drift | `U15-spherical-frame-impostor.md` |
| A1-U15-2 | S2 | confirmed | engine / play | Below-horizon cull uses a fixed 0.03 rad allowance, smaller than the eye-height dip on the play Moon | `U15-spherical-frame-impostor.md` |
| A1-U15-3 | S1 | confirmed | engine (render) | Camera-facing impostor quads break the tan law off-axis: big bodies are squashed up to ~31 % | `U15-spherical-frame-impostor.md` |
| A1-U15-4 | S1 | confirmed | engine (render) | Staged-rank occlusion inverts off-axis: a far body is drawn over a near one | `U15-spherical-frame-impostor.md` |
| A1-U15-5 | S3 | confirmed | engine | Unclamped tan law and singular inputs | `U15-spherical-frame-impostor.md` |
| A1-U15-6 | S3 | confirmed | doc | Header numbers and wording are wrong | `U15-spherical-frame-impostor.md` |
| A1-U16-1 | S1 | confirmed | engine (RATIFIED item: the KCC step/slope rule) | the ratified 50° walk limit is really ≈ 56–59° (ratio measured along the tilted `fwd`) | `U16-astronautkcc-part1.md` |
| A1-U16-2 | S1 | confirmed | engine | on the spin-phase wrap tick the sweep samples a whole turn — 66 % false landings | `U16-astronautkcc-part1.md` |
| A1-U16-3 | S2 | confirmed | engine | grounded velocity is the commanded velocity, not the realised motion | `U16-astronautkcc-part1.md` |
| A1-U16-4 | S2 | confirmed | engine | the NaN guard rolls back the pose but keeps the NaN velocity, so the controller stays dead | `U16-astronautkcc-part1.md` |
| A1-U16-5 | S2 | confirmed | engine / gameplay | jump launches along the cached terrain normal — up to 4.1 m/s sideways, from a wrong ε-normal | `U16-astronautkcc-part1.md` |
| A1-U16-6 | S3 | confirmed | engine / doc | the stepHeight clause never binds — the "dual" rule is the ratio rule alone | `U16-astronautkcc-part1.md` |
| A1-U16-7 | S3 | confirmed | engine (config) | slideAngle 45° < maxWalkSlope 50°: the character climbs while it slides | `U16-astronautkcc-part1.md` |
| A1-U17-1 | S1 | confirmed | engine | airborne/zero-G "up re-alignment" pulls the planet-frame `up` toward the WORLD radial | `U17-astronautkcc-part2.md` |
| A1-U17-2 | S2 | confirmed | engine | the vehicle tick writes `up`/`fwd` in the WORLD frame; a parked vehicle drifts by the spin angle | `U17-astronautkcc-part2.md` |
| A1-U17-3 | S1 | confirmed | engine (visible in play) | every landing snaps the character frame by up to 51° in one tick (play Moon, Ω = 0) | `U17-astronautkcc-part2.md` |
| A1-U17-4 | S2 | confirmed | engine | sliding stops 15–28× harder than kinetic friction allows once the slope reads ≤ 45° | `U17-astronautkcc-part2.md` |
| A1-U17-5 | S2 | confirmed | engine (telemetry shown on the HUD: `play/ui/Hud.tsx:36`) | airborne `altAGL` is measured against the take-off ground height | `U17-astronautkcc-part2.md` |
| A1-U17-6 | S2 | confirmed | engine | the landing plant drops strafe and plants a velocity that is not tangent | `U17-astronautkcc-part2.md` |
| A1-U17-7 | S3 | confirmed | doc / engine | the landing's "kill the normal component" step is dead code; the comment says the opposite of the code | `U17-astronautkcc-part2.md` |
| A1-U17-8 | S3 | confirmed | engine | `cliff` is computed and never read (`void cliff`) | `U17-astronautkcc-part2.md` |
| A1-U17-9 | S3 | confirmed | doc | the plan's "C¹ speed cap (RATIFIED)" is not in the KCC | `U17-astronautkcc-part2.md` |
| A1-U18-1 | S1 | confirmed | engine + spec | yaw and roll are mirrored: D / → steer the ship LEFT | `U18-flight-controller.md` |
| A1-U18-2 | S1 | confirmed | engine (RATIFIED C¹ speed cap) | the C¹ cap also fades RETRO thrust: near 2,000 m/s the ship cannot brake | `U18-flight-controller.md` |
| A1-U18-3 | S1 | confirmed | engine | planet spin splits the ship across two frames: a parked ship slides 179 m in 10 s | `U18-flight-controller.md` |
| A1-U18-4 | S2 | confirmed | engine + doc | one NaN input latches angVel to NaN; the ship freezes forever and the observer sees NaN state | `U18-flight-controller.md` |
| A1-U18-5 | S2 | likely | engine | the "unreachable" 2,025 m/s rescale is reachable on the giant planets | `U18-flight-controller.md` |
| A1-U18-6 | S3 | confirmed | engine (instrument only) | telemetry pressure ignores the temperature floor and goes negative | `U18-flight-controller.md` |
| A1-U19-1 | S2 | confirmed | spec / engine | the atmosphere is not hydrostatic: H = 1,200 m implies g = 68.9 m/s² (7× the planet) | `U19-aero-atmosphere.md` |
| A1-U19-2 | S1 | confirmed | engine / spec (T2 prerequisite) | the governor's "slow arrival" holds only for Earth's ρ0·H: with real densities, Mars and Pluto hit the ground near 2,000 m/s and Venus never lands | `U19-aero-atmosphere.md` |
| A1-U19-3 | S1 | confirmed | engine (T2 prerequisite) | any touchdown speed "lands": contacts at 25, 57 and 124 m/s all end LANDED in the contact tick | `U19-aero-atmosphere.md` |
| A1-U19-4 | S1 | confirmed | engine / spec (T2 gap) | one Earth-scale atmosphere for every body; the catalog's atmosphereHeight is never read; no cruise/boost regime exists | `U19-aero-atmosphere.md` |
| A1-U19-5 | S2 | confirmed | engine | lift is not governed: 112.5 m/s² at sea-level v_safe, above a_struct = 90 | `U19-aero-atmosphere.md` |
| A1-U19-6 | S3 | confirmed | engine / doc | lift switches on as a step at \|v_rel\| = 15 m/s (1.06 m/s² at sea level) | `U19-aero-atmosphere.md` |
| A1-U19-7 | S3 | confirmed | doc | documentation errors: the Milestone 1D v_safe table's 2 km row is wrong; the "< 2 %" lapse claim; v_safe omits βL | `U19-aero-atmosphere.md` |
| A1-U20-1 | S1 | confirmed | engine | "A free set always exists" is wrong: with 144 meshes on 96 sets the worker drops requests, and the LOD keeps a dead `pendingRec`, so terrain holes persist | `U20-terrain-meshing-worker.md` |
| A1-U20-2 | S2 | confirmed | engine (performance) | No load balancing: `pump()` always fills worker 0 first, so one worker does almost all the generation | `U20-terrain-meshing-worker.md` |
| A1-U20-3 | S3 | confirmed | doc | Header and comment drift: the request array rides the LAST response; the allocation budget ignores the receive path; the ring bound is undocumented | `U20-terrain-meshing-worker.md` |
| A1-U21-1 | S2 | confirmed | engine + spec (Milestone 1F l.45/55) | The Near pass paints over Mid-only objects in the 2,400–3,000 m overlap (painter order inverted) | `U21-camera-rig-sky-impostors.md` |
| A1-U21-2 | S2 | confirmed | engine | Meshes past 300 km are clipped or not drawn by any pass; no mesh can use the Far band | `U21-camera-rig-sky-impostors.md` |
| A1-U21-3 | S1 | confirmed | engine + play | The mesh↔impostor handoff and its hysteresis (RATIFIED) exist only in the test harness | `U21-camera-rig-sky-impostors.md` |
| A1-U21-4 | S2 | confirmed | engine | The impostor "fade" shrinks an opaque disk instead of fading it, so the cross-fade is not silhouette-exact | `U21-camera-rig-sky-impostors.md` |
| A1-U21-5 | S3 | confirmed | engine | `executePasses()` allocates every frame (header says zero) | `U21-camera-rig-sky-impostors.md` |
| A1-U21-6 | S3 | confirmed | doc | Draw-order comments are wrong: stars and glow are drawn after the impostors | `U21-camera-rig-sky-impostors.md` |
| A1-U21-7 | S3 | confirmed | engine | Near-pass depth resolution is coarse at the band end (3.4–5.4 m) | `U21-camera-rig-sky-impostors.md` |
| A1-U22-1 | S1 | confirmed | play / engine | The drawn terrain is not the terrain the player stands on: metre-scale mismatch at the finest LOD | `U22-play-world.md` |
| A1-U22-2 | S2 | confirmed | play | The LOD wants more chunks than the 96-mesh pool holds; selected leaves at 1–1.9 km stay unmeshed with no fallback | `U22-play-world.md` |
| A1-U22-3 | S3 | confirmed | play | `brad` is 1.5–2.2× the real chunk extent: conservative, but every layer mask and horizon test is inflated | `U22-play-world.md` |
| A1-U22-4 | S3 | confirmed | play | Spawn search: early exit unreachable (always 24,000 iterations), flat sites skipped, roughness probes not tangent | `U22-play-world.md` |
| A1-U23-1 | S2 | confirmed | play | Below 12 fps the game runs slow: PlayClock 0.1 s clamp + 5-substep cap shed up to 58 % of game time | `U23-controller-camera-input-frame.md` |
| A1-U23-2 | S2 | confirmed | play | First-person yaw updates at the 60 Hz tick rate, not the frame rate (judder on high-refresh screens) | `U23-controller-camera-input-frame.md` |
| A1-U23-3 | S2 | likely | play | Camera clearance uses the analytic height, but the drawn terrain sits higher: the camera can be inside the visible ground | `U23-controller-camera-input-frame.md` |
| A1-U23-4 | S2 | confirmed | play | The 4-point boom cut misses ridges between samples: the character is hidden behind terrain on 0.58 % of poses | `U23-controller-camera-input-frame.md` |
| A1-U23-5 | S3 | confirmed | play | A heading parallel to up collapses to zero and the player cannot move | `U23-controller-camera-input-frame.md` |
| A1-U23-6 | S3 | likely | play | Wheel zoom ignores `deltaMode` | `U23-controller-camera-input-frame.md` |
| A1-U24-1 | S1 | confirmed | play + test | The "planted" stance foot floats up to 14 cm at run/sprint and sinks 1.6 cm at a crawl; no gate checks foot height | `U24-character.md` |
| A1-U24-2 | S2 | confirmed | play + test | Crouch-walk breaks the no-slide stride: the stance foot slides 5 cm per step | `U24-character.md` |
| A1-U24-3 | S1 | confirmed | play + test | Slope-foot roll is inverted: on a 10° cross-slope the sole is tilted 19.6° against the terrain | `U24-character.md` |
| A1-U24-4 | S2 | confirmed | play | A landing within 0.12 s of a launch is lost: JumpLaunch → Walk with no Land, even at 3–4 m/s | `U24-character.md` |
| A1-U24-5 | S3 | confirmed | play + doc | The GLB seam documents a facing that `characterRoot` does not use; the yaw fix and ground clearance are rig-private | `U24-character.md` |
| A1-U24-6 | S3 | suspected | play | `jumpedThisFrame` fires on any launch with vertical speed > 0.5 m/s, so the "crest launch → Fall" decision may never be taken | `U24-character.md` |
| A1-U25-1 | S1 | confirmed | engine / play / test | The play frame allocates ≈10.5 KB per frame (≈1.5 MB/s at 144 Hz); 72–78 % is in the core terrain height path; the zero-GC gate cannot see it | `U25-invariants-ui-sweep.md` |
| A1-U25-2 | S2 | confirmed | play | Debug HUD latitude/longitude come from the tilted body `up`, not from the position — up to 33–39° (~900 m) off | `U25-invariants-ui-sweep.md` |
| A1-U25-3 | S3 | confirmed | doc | `HudPublisher` comment "nothing is allocated": the real zustand `setHud` costs ≈297 B per publish | `U25-invariants-ui-sweep.md` |
| A1-U25-4 | S3 | confirmed | play | The menu (`App.tsx`) lists play and m1a–m1d only; the m1e/m1f regression pages are not linked | `U25-invariants-ui-sweep.md` |
| A1-U25-5 | S3 | confirmed | play | A terrain worker error never reaches the ERROR phase (documented deferral) | `U25-invariants-ui-sweep.md` |
| A1-U26-1 | S2 | confirmed | engine | Terrain field is a per-thread singleton: a second body's init silently re-points every live actor | `U26-architecture-fitness.md` |
| A1-U26-2 | S1 | confirmed | engine | No reference-frame model: bodies have no spin, actors have no parent frame (synthesis of U12-1, U13-1, U17-1/2, U18-3) | `U26-architecture-fitness.md` |
| A1-U26-3 | S2 | confirmed | engine | Core entity record is position/velocity only; physics lives outside the core and writes through | `U26-architecture-fitness.md` |
| A1-U26-4 | S2 | confirmed | play | Play frame and rig are single-world, hand-ordered and module-global: no extension seam | `U26-architecture-fitness.md` |
| A1-U26-5 | S3 | confirmed | engine | CPU is not the binding constraint; allocation and the height-query count are | `U26-architecture-fitness.md` |
