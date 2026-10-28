# A1-U03 — m1f R3 + R4 + R5 validity

- Unit: A1-U03 (`docs/A1-plan.md` §5) · Commit audited: `5bdac3a` (game/src identical to 256d77d) · Session: 52 (2026-10-22)
- Question: can R3 (handoff), R4 (zero-gc) and R5 (m1a-integration) **fail** when the property each one claims is broken?
- Files read: `game/src/test/Milestone1F_TestHarness.tsx` lines 1–60, 167–270, 516–660, 810–935, 963–1012, 1163–1367, 1394–1520; `game/src/test/m1fStraddle.ts` (all); `game/src/render/MultiCameraRig.tsx` `layerMaskFor` (:117–122); `game/src/core/simulation/SimulationCore.ts` rebase step (:430–440); `game/playwright.config.ts`; `102a5b8:game/e2e/m1f.spec.ts`; `pre-t4:notes/reports/M1F.md` §14 (:1215–1260) and §15.3–15.4 (:1443–1470) as claims.
- Evidence reused: `pre-t4:docs/audit/U01-evidence/gate-run1.log` (unedited tree, badges `[P,F,P,P,F]`).
- Probe: `game/tools/audit/u03-r3r4r5-validity.mjs`. It extracts `handoffFade`/`handoffNextState` **verbatim from the harness source text**, replicates the gate loops, adds an independent "what is actually drawn" sweep built from the harness's own visibility rules (:846, :875), runs two mutations, scans the R4/R5 blocks, and runs an ideal-walker Monte Carlo for R5.
  - Command: `cd game && node tools/audit/u03-r3r4r5-validity.mjs` → `[u03] CONFIRMED 22/22`, `PROBE_EXIT=0` (unpiped).
- Method note: expected behaviour was written down before reading each block (a handoff must never draw nothing; a zero-GC row must fail on allocation; a rebase row must be reachable by the fixture).

## Verdict
| Row part | Can it fail on its claim? | Evidence |
|---|---|---|
| R3(a) unit sweep: hole / double | **No.** Tautology (`m = 1 − imp`). | Unsatisfiable for every imp ∈ [0,1]; mutations M1/M2 stay at 0 holes. |
| R3(a) flips = 21, slope ≤ 1.5e-4/m | Yes, but they test the state counter and smoothstep only. | Replica 21 / 1.360e-4. |
| R3(b) live trace holes | **No.** Same tautology on recorded alphas. | Trace stores `alphaMeshA = 1 − alphaImpA`; `meshState` never recorded. |
| R3(b) crossed both fade edges | Yes (weak). | — |
| R3(c) silhouette A/B | **No, since 3057899.** The window is saturated. | totA = 25,600 = all 160×160 px; expected probe disk ≈ 68 px. |
| **Handoff itself** | — | **Real defect the gate hides:** a 5.6 km descending band where nothing is drawn (A1-U03-1). |
| R4 identity canary | **No.** Built, never compared. | Only `void canary.cams`. |
| R4 heap deltas | Weakly. Negative delta or no `performance.memory` passes; no precise-memory flag. | 87 B/iteration allowance; allocation in the burned path. |
| R5 rebases ≥ 2 | **Unreachable by the fixture.** | Ideal walker: 0 / 2,000 geometries reach 2 rebases. |
| R5 straddler A/B | Only for differences; no visibility check on Sat B. | — |
| R5 Sun continuity | Samples rebase frames only (0–1 samples here). | — |

**Net:** R3's PASS today reduces to `flips === 21`, the smoothstep slope bound and "crossed both edges" — none of which can see the hole that the handoff actually renders. R4's PASS reduces to two loose heap bounds. R5's FAIL is caused by the gate's own fixture, not by the terrain or the KCC.

## Findings

### A1-U03-1 — The mesh↔impostor handoff renders NOTHING for 5.6 km on every descent; R3 cannot see it
- Severity: S0 (gate that cannot fail while it hides a defect)     Confidence: confirmed
- Category: engine (harness handoff controller) + test
- Location: `Milestone1F_TestHarness.tsx:604-621` (constants, `handoffFade`, `handoffNextState`), `:846` (impostor active iff `alphaImpA > 0.01`), `:875` (mesh visible iff `meshStateA && alphaMeshA > 0.01`) @ 5bdac3a. Spec: header `:31-33`; detail `:1259-1260` "Hysteresis band [220, 240 km] strictly contains the fade window [225, 236 km] — threshold oscillation can never modulate a partially-faded representation".
- Claim: the handoff has "no hole / no double / continuous fade".
- Evidence:
  - The fade is a pure function of distance, but mesh visibility also needs `meshState`, which flips at 240 km going out and only at 220 km coming back.
  - Descending from beyond 240 km the state stays IMPOSTOR until 220 km, while the impostor alpha drops to ≤ 0.01 at 225.65 km (analytic smoothstep edge). For d ∈ [220,000, 225,648] m **neither representation is drawn**. Probe: `analytic descending hole: d in [220000, 225648] m (5648 m)`; rendered sweep `hole samples 120 over d [220000,225500]`.
  - In [226, 235] km on the way down, the impostor fades out with no mesh behind it (`ghost samples 190`): the object visibly dims to nothing, then pops back as a full mesh at 220 km.
  - Ascending is clean (`0 hole samples`): the defect is one-directional, which is why a symmetric-looking design hides it.
  - Live exposure: the probe descends at 5,417 m/s (sim), so each descent has ~0.9 sim s ≈ 9 frames of invisible probe; ~15 descents per gate run.
  - The detail string's reasoning is backwards: a hysteresis band that *contains* the fade window guarantees that one direction crosses the whole fade while in the wrong state.
- Impact: in the game, any body using this controller would vanish and pop at the LOD boundary on approach — exactly the artifact the handoff exists to prevent. The same pattern applies to any future planet/moon mesh↔impostor switch built from this code.
- Proposed fix: drive both alphas from the state machine, not from distance alone — e.g. fade is evaluated only while transitioning and the mesh stays visible until the impostor is ≥ 0.99 (or put the fade window *outside* the band, starting at the switching threshold of each direction). Then re-test R3 with the independent rendered sweep (A1-U03-2). Not a RATIFIED item (the ratified "impostor hysteresis" is the band; flag in the ADR that the band/fade relationship changes).
- Fix task size: one session (controller + rendered-sweep row + mutation self-test).

### A1-U03-2 — R3(a) and R3(b) hole/double counters are tautologies
- Severity: S1     Confidence: confirmed
- Category: test (spec: same code in Milestone 1F)
- Location: `Milestone1F_TestHarness.tsx:1174-1176` (unit sweep), `:1183-1184` (live trace), `:643` and `:1515` (trace records `alphaMeshA = 1 − alphaImpA`) @ 5bdac3a
- Claim: "no hole / no double" over the unit sweep and the live sweep trace.
- Evidence:
  - With `m = 1 − imp`, "hole" (both ≤ 0.01) and "double" (both ≥ 0.99) are unsatisfiable for any imp ∈ [0, 1] (probe `R3a-tautology`).
  - The loop computes `next`/`flips` but never uses `mesh` in the hole test, so the state machine is not part of the check.
  - Mutation M1 (mesh hidden from 200 km): gate holes 0, rendered holes 1,430. Mutation M2 (impostor never fades in): gate holes 0, rendered holes 4,810.
- Impact: R3 is green while A1-U03-1's hole exists.
- Proposed fix: compute hole/double from the rendered rules (`meshVisible = state && alphaMesh > 0.01`, `impActive = alphaImp > 0.01`), record `meshState` in the live trace, and add M1/M2 as a self-test that must go red. The probe's `renderedSweep()` is a template.
- Fix task size: part of the A1-U03-1 fix task.

### A1-U03-3 — R3(c) silhouette A/B compares a saturated window, so it passes vacuously
- Severity: S1     Confidence: confirmed (for the unedited tree since 3057899)
- Category: test
- Location: `Milestone1F_TestHarness.tsx:1221-1233` (window, `> 8` threshold), `:1255-1257` (pass) @ 5bdac3a; threshold history `pre-t4:notes/reports/M1F.md` §14 (:1215–1226, round 6b `> 45` → `> 8`)
- Claim: "sub-pixel silhouette match (mesh-only vs impostor-only renders)".
- Evidence:
  - Expected probe disk at 232 km: r = f·tan(asin(1800/232,000)) = **4.65 px**, area ≈ 68 px (f from fov 62°, 1280×720).
  - U01 gate run 1 (R3 badge PASS): `R3DUMP hdr ... meshR=90.27 impR=90.27 meshRmax=113.14 impRmax=113.14 totA=25600 sym=0`. 25,600 = 160² = every window pixel has red > 8 in **both** renders. The "disk" radius 90 px is the window, not the probe (113.14 = 80·√2, the window corner).
  - So sym = 0 is forced; any mesh/impostor mismatch inside the window is invisible. Round 6b recorded a 122-px disk at 0.82%; the post-3057899 pose (the F-12 change U01 identified for R2) now aims the A/B at a lit background. Plausibly the same occluder/background as R2's `[90,80,66]` pixel (U01): red 90 > 8.
  - The pass condition bounds only `symPct`, never `totA` against the expected disk.
  - Seed answer (45 → 8): lowering the threshold made the mask track any dim background. At 8 it no longer separates probe from scene; the row now tests the fixture's lighting, not the handoff.
- Impact: R3(c) has measured nothing since 3057899, and even before it only checked one distance (232 km, outside the hole).
- Proposed fix: render the probe against a cleared/masked background (or use an ID/alpha channel), assert `totA` within ±25% of π·r², and sample at several distances including the hole band of A1-U03-1.
- Fix task size: one session (can share with A1-U03-1/2 if small; otherwise F-b).

### A1-U03-4 — R4's identity canary is never checked; heap rows pass on GC or missing data
- Severity: S1     Confidence: confirmed
- Category: test
- Location: `Milestone1F_TestHarness.tsx:1270-1316` (R4), `:857` (allocation in the burned path), `game/playwright.config.ts` @ 5bdac3a
- Claim: "identity canary + heap deltas over pure-update and full-render burns"; detail: "all math in module scratch, no new … anywhere in the path", "React re-renders during flight: 0".
- Evidence:
  - The `canary` object is built and only `void canary.cams` is referenced; no captured identity is compared after the burn. `identityOk` checks `instanceMatrix !== undefined`, `bodies.length === CAP` and `astroMesh.children.length === 8` — properties that hold whether or not objects were replaced.
  - Pass is `(pureDelta < 0 || pureDelta <= 262144) && (renderDelta < 0 || renderDelta <= 4194304)`: a GC during the burn (negative Δ) or no `performance.memory` (−1) passes.
  - Chrome is launched without `--enable-precise-memory-info`, so `usedJSHeapSize` is bucketed and cached; small allocations are not resolvable. (`suspected` impact on numbers: would be confirmed by logging h0..h3 with and without the flag.)
  - The pure path calls `applyRenderState`, which allocates `{ x: qx, y: qy, z: qz, w: qw }` per call at `:857`, so the "no allocation anywhere" detail is false; the 87 B/iteration allowance absorbs it. (Small and short-lived; the defect is the gate, not the allocation.)
  - "React re-renders during flight: 0" is a string literal; nothing counts renders.
- Impact: R4 cannot detect per-frame allocation below ~87 B/iteration or ~14 KiB/frame, nor object replacement. The engine's zero-GC invariant (AGENT_BRIEF §3) is unproven by this row.
- Proposed fix: capture identities before the burn and compare with `===` after; fail on negative deltas (retry after `gc()` with `--js-flags=--expose-gc`) and on missing `performance.memory`; add `--enable-precise-memory-info`; replace heap deltas with an allocation-sampling check (CDP `HeapProfiler.startSampling`) on the pure path; count React commits with a profiler callback or drop the claim. Remove the `:857` literal (module scratch).
- Fix task size: one session.

### A1-U03-5 — R5 "rebases ≥ 2" is unreachable by the gate's own fixture (SAT_B is overhead; the walk ends at its nadir)
- Severity: S1     Confidence: confirmed (geometry + ideal-walker model)
- Category: test (fixture) — answers the plan seed "is the gate wrong, or the terrain, or the KCC?": **the gate**.
- Location: `Milestone1F_TestHarness.tsx:269` (`SAT_B = spawn + walkFwd·2400 + up·400`, a straight tangent), `:1416-1426` (autopilot steers to SAT_B for the whole LIVE), `:1355` (pass) @ 5bdac3a; claim `pre-t4:notes/reports/M1F.md` §15.3 (:1443–1453) "directedness caps net progress … everywhere in the domain"
- Claim (M1F §15.3): the acceptance is unmeetable because the autopilot either climb-limits or "ORBITS the target" on this terrain.
- Evidence:
  - On a 1,364.5 m moon, a point 2,400 m along a straight tangent is far above the surface: |SAT_B| ≈ 2,979–3,205 m, i.e. ≥ 1,254 m above any terrain. Its nadir is only 48.5–53.7° of arc (1,155–1,278 m) from spawn. Steering "toward SAT_B" can at best bring the walker to that nadir, then it circles/parks.
  - Round 7's "orbiting" trace (#582: distToSATB plateau ~1,650 m) lies inside the nadir distance floor of 1,254–1,841 m: it is the walker under an overhead target, not a terrain/steering failure.
  - Ideal-walker Monte Carlo (2,000 random spawn/heading pairs, flat sphere, sprint 6.5 m/s straight to the nadir, harness spin 0.0005 rad/s about +Y, M1A rebase rule > 1,024 / 256 lattice, 728 sim s): **rebases 0: 511, 1: 1,489, 2+: 0**. Even a perfect walker never reaches 2.
  - Consistent with M1F §15.4: the extended-wall runs reach a 2nd crossing only at ~300–326 wall s (~1,800 sim s), when the moon spin (0.9 rad ≈ 1,550 m) supplies the drift — not walking.
  - Model limits (stated): terrain height fixed at 180 m, no warmup motion, origin seeded at spawn. Each simplification favours the walker, so the 0 is a robust upper bound for the shipped fixture.
- Impact: R5 has been red by fixture design; round 7's 2,425-site search could never succeed. The waiver stands, but the "terrain is unmeetable" conclusion in M1F §15 is wrong and must not feed a terrain or KCC change.
- Proposed fix: make the walk target a **surface** point (e.g. `surfacePoint` 2,400+ m of arc along `walkFwd`, or a waypoint chain) so rebases come from walking; or test the lattice/continuity property with a scripted teleport-free pose path instead of the autopilot. Then re-evaluate option (a) (≥ 2 → ≥ 1) in M1F §15.7 — it becomes unnecessary. Not a RATIFIED item.
- Fix task size: one session (fixture + one gate run on an 8 GB VM).

### A1-U03-6 — R5 straddler A/B never checks that Sat B is visible; Sun continuity is sampled only on rebase frames
- Severity: S2     Confidence: confirmed (code) / suspected (that Sat B is off-screen or occluded at the suite pose — would be confirmed by counting Sat B-coloured pixels in `autoPx` via a U01-style CDP logpoint)
- Category: test
- Location: `Milestone1F_TestHarness.tsx:1331-1353` (A/B, pass `diffNear === 0 && diffMid === 0`), `:1324-1329` (`if (!b.rebased) continue;`) @ 5bdac3a
- Evidence: zero differing bytes is also the result when Sat B covers no pixel (occluded by terrain, behind the near plane, or off-frame). The row has no pixel-coverage assertion, so "byte-exact at the layer threshold" is unproven. `sunJump` is the max over rebase frames only; with 0–1 rebases (A1-U03-5) it is computed from 0–1 samples, and 0 samples gives 0 mm (pass).
- Impact: two R5 terms can pass without exercising their claim.
- Proposed fix: assert Sat B pixel count > N in `autoPx` (and that it straddles 2,400 m: `layerMaskFor` returns both bits); require `sunTrace` rebase samples ≥ the rebase count and > 0.
- Fix task size: small; part of the A1-U03-5 fix task.

## Checked, no issue
- `handoffNextState` flips exactly once per threshold crossing (21 = 20 crossings + 1 initial correction); no thrash in the unit sweep.
- `handoffFade` is a correct C¹ smoothstep; max slope 1.5/11,000 m = 1.364e-4/m (≤ 1.5e-4 bound).
- The outbound handoff (distance increasing, mesh → impostor) has no hole.
- `layerMaskFor` (`MultiCameraRig.tsx:117-122`) assigns Near for dn < 2,400 and Mid for df > 2,400 && dn < far limit; a straddler is dual-assigned as designed.
- `straddlePoseInto` (`m1fStraddle.ts`) places the camera exactly 2,400 m from the rendered Sat B (T − dir·2,400) in render-local coordinates with radial up; the math is correct.
- R5 lattice check: every rebase Δ is tested for `% 256 === 0` on all three axes (`:974`); `localsOk` reads the core's post-tick max local. Both can fail.
- `geoConst` window opens at LIVE start (F26) and is a real min/max over LIVE frames.
- The LIVE loop is fixed-step (1/60 wall × ts 6, accumulator capped at 0.1 s), so KCC decisions are FPS-independent; LIVE length is still wall-time (120 s), as U01 noted.

## Leads for later units
- U21 (camera rig + sky impostors): the handoff controller lives in the harness, not in `render/`; any production LOD switch must not copy it (A1-U03-1).
- U25 (invariants): `:857` per-call literal in `applyRenderState`; check the play layer's equivalent path.
- U01/R2 + U03/R3(c): both A/B rows went blind at the post-3057899 pose; the fix task for A1-U01-1 should re-check R3(c) in the same gate run.

## U27 recheck qualification — 2026-10-25, session 96
A1-U03-5 retains S1, but the universal impossibility/robust-upper-bound claim is withdrawn: sphere Monte Carlo is not a bound on real terrain/steering/warmup paths. Independent 1440-case short-path grid gives zero two-plus rebases; 4000 m surface-path control gives two-plus in all cases. This confirms a poor fixture, not that every candidate site was mathematically impossible.
Evidence and authoritative recheck disposition: [K2d batch](U27-k2d-recheck.md).
