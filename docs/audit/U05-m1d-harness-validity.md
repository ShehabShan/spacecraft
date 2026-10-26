# A1-U05 — m1d harness validity (U05b: probes + findings)

- Unit: U05b (the first part of U05 was the reading pass, U05a: `docs/audit/U05a-m1d-harness-reading.md`). Commit base: 6f1d740.
- Probe: `game/tools/audit/u05-m1d-validity.mjs`. Run from `game/` with `node --expose-gc tools/audit/u05-m1d-validity.mjs`. Result: PROBE_EXIT=0, 9/11 checks confirmed; the 2 that were not confirmed are reported honestly below.
- What the probe does:
  - Slices the T1 predicate verbatim (`Milestone1D_TestHarness.tsx` :645–:663), strips its types with esbuild and runs it with injected mutations of the atmosphere functions.
  - Replicates the T4 `heapOk` clause (:734) and the T5 offset clause (:867–871).
  - Replays the DIVE phase (:512–527, :834–836, observer :495–510) on the real `FlightController` under Node.
- Line numbers are `Milestone1D_TestHarness.tsx` @ 6f1d740 unless stated otherwise.

### A1-U05-1 — T1 cannot fail on its own claims (C∞ law, Mach, rotating atmosphere)
- Severity: S1     Confidence: confirmed
- Category: test
- Location: harness :644–674; `core/physics/atmosphere.ts` :60–64, :80–83, :113–120; `flightController.ts` :137 (`planetSpin: 0`)
- Claim: the T1 detail says the density follows a "C∞ law ρ = ρ₀e^(−h/1200), no cutoff discontinuity", that the Mach number is right, and that the rotating-atmosphere law holds.
- Evidence (probe, T1 pass flag), each case a mutation of an atmosphere function:

  | Case | T1 result |
  |---|---|
  | Baseline (unmutated) | `true` |
  | Density with a 50 % step at 4 km | `true` |
  | `machNumber` uses sea-level `a` at every altitude | `true` |
  | Atmosphere spins retrograde (sign flipped) | `true` |
  | Control: lapse rate removed | `false` (caught) |

  - Why the Mach and wind checks cannot fail:
    - Mach is checked only at h = 0, where it is `a0/a0`.
    - Wind is checked as a magnitude at a single point, so its sign is never tested.
  - Why the wind law is never exercised: `EARTHSCALE_FLIGHT.planetSpin = 0`, so no flight tick ever uses it.
- Impact:
  - A discontinuous or mis-signed atmosphere ships green.
  - The rotating-atmosphere code path (needed for the §13 "every planet rotates" goal) has no flight coverage.
- Proposed fix:
  - Check continuity numerically: the max relative jump between 1 m steps must be ≤ the analytic e^(−1/1200) bound.
  - Check Mach at ≥2 altitudes against an independent formula.
  - Check the wind as a vector (Ω × p, with sign).
  - Add a flight row with planetSpin ≠ 0.
  - No RATIFIED item is touched.
- Fix task size: fits one session.

### A1-U05-2 — T2 (governor dive) verdict depends on machine frame rate
- Severity: S1     Confidence: confirmed
- Category: test (and play: documents a real slow-motion effect)
- Location: harness :834–836 (`simElapsed += dt*4`; `flight.update(dt*4, 6)`; exit at `simElapsed > 45`); `flightController.ts` :355–370 (0.25 s cap, shed beyond `maxSubsteps`)
- Claim: T2 is a deterministic acceptance check of the dive.
- Evidence (Node replay):

  | Frame rate | Counted time | Physics time | Grounded | Lowest altitude above ground | T2 |
  |---|---|---|---|---|---|
  | 60 fps | 18.0 s | 18.0 s | yes | — | PASS (v@1000 m = 264.7 m/s) |
  | 30 fps | 24.0 s | 18.0 s | yes | — | PASS |
  | 15 fps | 45.1 s | 16.9 s | no | 57.3 m | FAIL |

  - At 15 fps the backlog is shed: 0.267 s → 0.25 s cap → 15 ticks wanted, 6 allowed. The 45 s counted cap then expires mid-air.
- Impact:
  - A slow CI machine or a SwiftShader run turns T2 red with no code change.
  - In play, the ship runs in slow motion below about 40 fps under ×4 time scale. This is the "1D FPS BACKLOG" note in STATE.md, now quantified.
- Proposed fix:
  - Gate the dive headlessly in fixed ticks (as `runBurn` already does for T4), with the cap counted in ticks.
  - Keep the rendered dive as a visual only.
- Fix task size: fits one session.

### A1-U05-3 — T4 heap clause passes any negative delta, and its verdict is GC noise
- Severity: S1     Confidence: confirmed (clause); likely (browser noise level)
- Category: test
- Location: harness :577, :734 `heapOk = heap < 0 || heap <= 1_048_576`
- Claim: "zero-GC physics tick … heap Δ over the burn (limit 1 MB)".
- Evidence:
  - Truth table: `-1→true`, `-5,000,000→true`, `1,048,577→false`. The −1 "N/A" sentinel and any GC that runs during the burn both pass.
  - Node burns (20,000 ticks, ×3, after `gc()` and a warm-up):

    | Burn | Heap Δ per run | Runs over the 1 MB bound |
    |---|---|---|
    | Clean (real controller) | 1.37 / 0.89 / 1.47 MB | 2 of 3 |
    | Allocates one object every tick | 2.04 / 0.93 / 0.33 MB | 1 of 3 |

    So the bound does not separate allocating from non-allocating code: GC timing decides it.
  - The seed "an allocating burn still passes 3/3" (probe check T4-2) was **not confirmed**. The measurement is noisy in both directions.
- Impact: the zero-GC claim is not tested. This is the same pattern as A1-U03 (R4) and A1-U04 (R4).
- Proposed fix:
  - Count allocations deterministically instead of sampling `usedJSHeapSize`, for example with a `--jitless` Node probe plus `heapUsed` after forced `gc()` on both sides, with a trend over N repeats as `test-play-perf` does.
  - Fail on a missing measurement instead of passing.
- Fix task size: fits one session (shared with the U03/U04 heap fixes).

### A1-U05-4 — T4 identity canary is tautological
- Severity: S2     Confidence: confirmed (code citation + grep)
- Category: test
- Location: harness :548–552 and :571–575; `flightController.ts` :265–283
- Claim: "every state object identity preserved".
- Evidence:
  - `pos/vel/quat/angVel/input/telemetry/integrity` are `readonly` fields, assigned only in their initializers.
  - `grep -rn "\.(pos|vel|quat|angVel|input|telemetry|integrity) = " src` finds no reassignment of them. The only hits are unrelated `TerrainMeshPool` entries.
  - So the canary can only fail if someone removes `readonly` and adds a reassignment.
- Impact: the check adds no evidence for the zero-GC claim.
- Proposed fix: drop the canary, or replace it with an allocation count.
- Fix task size: trivial (with A1-U05-3).

### A1-U05-5 — T5 offset check cannot fail; the "Δ f32-exact" claim is never checked
- Severity: S2     Confidence: confirmed
- Category: test
- Location: harness :867–871 and :752, :757
- Claim: "terrain-group offset tracks −O", and origin shifts are "Δ f32-exact".
- Evidence:
  - `position.set(−o)` is followed immediately by `|position + o|`, so the offset error is exactly `0` even for off-lattice, non-f32 origins (1e7 + 0.1, 5e8 + 0.7).
  - Neither the lattice property (O = 256·k) nor f32-exactness is tested anywhere in T5.
- Impact: a broken origin lattice would pass T5.
- Proposed fix: assert `o.x % 256 === 0` (and the same for y, z), and `Math.fround(Δ) === Δ` per rebase.
- Fix task size: trivial.

### A1-U05-6 — T3 "no hard clamp" only covers clamps inside `integrateFlight`
- Severity: S3     Confidence: confirmed
- Category: test
- Location: harness :708–730; `flightController.ts` :562–575 (Δv is measured from `_velStart` within one tick)
- Claim: "a hard clamp would show hundreds".
- Evidence:
  - A mutation clamps the speed to `v_safe` after each tick, in the observer, so it sits outside the per-tick Δv window. Result: maxDv 1.47 and T3 = **true**.
  - T2 does catch it: v@1000 m = 117.1 < 150.
  - Baseline maxDv is 10.30 m/s against the bound 12, a margin of 1.70 m/s (14 %). It matches the detail's ≈10.4 peak, so the check labelled T3-2 in the probe was a mis-stated expectation, not a finding.
- Impact: low. The suite as a whole catches the clamp; T3 alone does not.
- Proposed fix: none needed beyond a comment, or measure Δv across whole frames.
- Fix task size: trivial.

## Checked, no issue
- The baseline dive replay at 60 fps passes T2 and T3:
  - v@1000 m = 264.7 m/s (gate 150–400); vmax = 2000 (C¹ fade holds the cap).
  - minPostTickAGL = 3.000 m (= DDA_CLEARANCE); 4 contacts; 0 reversals; 0 NaN.
- T1 does catch a missing lapse rate (control mutation).
- The T4 `heapOk` boundary is exactly 1,048,576 B, as documented.
- `flight.update` is fixed-tick with shed-don't-dilate, as its header says. The frame-rate dependence in A1-U05-2 is the harness's use of it, not a core bug.
- `scripted` at :846 is dead code (S3 note, no finding).

## Left for U05c (done 2026-10-22 — see "U05c" below)
- T2 penetration: a DDA mutation (coarsen `DDA_MAX_GAP`, or disable `_sweepTerrain`) to check whether T2 or minPostTickAGL can fail at all.
- An independent analytic drag + gravity integration for v@1000 m.
- Read `flightController.ts` :60–355 and :580–750 (sweep/contact), `aerodynamics.ts`, `atmosphere.ts` in full, harness :1000–1182 (HUD), and the Milestone 1D grep.
## U05c — DDA penetration, analytic dive, remaining reads (2026-10-22)
Probe: `game/tools/audit/u05c-m1d-dda-dive.mjs` (run from `game/`: `node tools/audit/u05c-m1d-dda-dive.mjs`).
It builds mutant copies of the real `flightController.ts` by text substitution, strips types with esbuild, and re-points their imports at the real atmosphere, aerodynamics and terrain modules.
Result: PROBE_EXIT=0, 9/10 checks confirmed. TERR-2 was not confirmed, and that miss is itself finding A1-U05-8.
Reads done: `flightController.ts` :1–160, :376–560 and :596–750; `aerodynamics.ts` header + `SHIP_AERO`; `atmosphere.ts` density law; harness :488–530 and :680–705; the harness verdict (:1000–1182 is HUD + ALL-PASS chip only); Milestone 1D grep (:19, :72 DDA proof, :2325).

### A1-U05-7 — T2's no-clip clauses cannot test the DDA; `minPostTickAGL` is blind to tunnelling by construction
- Severity: S1     Confidence: confirmed
- Category: test
- Location: harness :686–691 (T2 predicate), :494–510 (observer); `flightController.ts` :504–531 (post-tick AGL), :609–685 (sweep) @ 739f1e0
- Claim: the T2 detail says "Analytic DDA held the ship at/above the surface on every tick". Milestone 1D :72 states a no-clip proof for the 4 m-gap lattice sweep.
- Evidence (probe dive section):
  - BASE: T2 = true; minPostAGL 3.000; true minimum of the path, sampled every 0.25 m, = 3.000.
  - ENDPOINT-only sweep (lattice 2, gap 1e9): **T2 = true**, with identical numbers.
  - COARSE sweep (lattice 64, gap 64 m): **T2 = true**.
  - Control, sweep removed: T2 = false, minPostAGL −1,529 m. Only total removal is caught.
  - The dive is straight down. Every tick's path ends inside the same radial column, so the endpoint sample alone finds the contact.
  - Low-tick section: 3,000 single ticks at 4–30 m AGL, 300–1,900 m/s, near-horizontal over real terrain. The ENDPOINT sweep tunnels through terrain on 8 uncontacted ticks, up to 5.2 m deep. On all 8, minPostTickAGL stays ≥ 0, because it is sampled only at the tick's end point (:524–531).
- Impact: the property that matters (no tunnelling through ridges on grazing, fast, low passes) has no gate. A regression in the sweep's gap or lattice stepping would ship green.
- Proposed fix: add a T2b row of grazing passes over the steepest terrain. Score it with an independent dense path sample (as this probe does), not with `minPostTickAGL`. Keep the vertical dive for v@1000.
- Fix task size: one session (harness row + Node twin).

### A1-U05-8 — The DDA no-clip proof rests on a false terrain slope bound (L = 1.2; measured up to 6.4)
- Severity: S1     Confidence: confirmed (the premise is false); suspected (that real tunnelling occurs)
- Category: spec + engine
- Location: `flightController.ts` :59 `DDA_LIPSCHITZ = 1.2`, :623 early-out, :605–607 proof comment; Milestone 1D :72 ("conservative terrain Lipschitz L = 1.2 … ≤ 5.8 m … the next sample always detects it")
- Claim: the terrain never rises faster than 1.2 m per metre of arc, so the mid-gap penetration is at most 4·2.2 − 3 = 5.8 m and is always detected.
- Evidence:
  - Measured over 200,000 random points and directions on TEST_PLANET, using a 0.5 m finite difference: **max |dh/ds| = 6.41**, and **11.2 %** of samples are steeper than 1.2.
  - With L = 6.4 the proof's own bound becomes 4·7.4 − 3 ≈ 26.6 m. A ridge narrower than the gap can rise above the chord between two samples that both clear the surface. In that case "the next sample always detects it" does not hold.
  - The bound also feeds the early-out at :623 (L·gap = 4.8 m of the margin). Measured max height is 734.8 m against a 900 m band, so the early-out stays safe through its height margin, not through L.
  - The BASE sweep showed 0 tunnels in 3,000 random low ticks. Real misses were **not** reproduced.
  - Evidence that would confirm the impact: an adversarial search for grazing paths across the steepest, narrowest ridges, scored by dense path sampling.
- Impact: the safety argument behind the "exact" collision claim is invalid. Any later terrain retune (higher mountainAmp or detailFreq) moves it further from safe without any gate noticing (see A1-U05-7).
- Proposed fix: derive the gap from a measured or analytic slope bound of the noise field, for example gap ≤ (clearance + margin)/(L + 1). Alternatively, make detection conservative with a per-sample segment-vs-heightfield bound. Not a RATIFIED item.
- Fix task size: one session (measure the bound, set the gap, add the A1-U05-7 row as its gate).

### A1-U05-9 — The "structural limit" a_struct is exceeded 6.9× during the governed dive
- Severity: S2     Confidence: confirmed
- Category: spec + doc
- Location: `aerodynamics.ts` :8–14 (governor header), `SHIP_AERO.aStruct = 90`; Milestone 1D :2325 ("GOVERNOR chip lighting up … as the ship crosses the structural curve")
- Claim: v_safe is "the speed at which quadratic drag deceleration equals the airframe limit a_struct". The drag map "forces the ship down onto the curve — no clamping, no discontinuity, no overshoot".
- Evidence:
  - Peak drag deceleration is **621 m/s² (63 g)** in an independent RK4 integration and **625 m/s²** in engine telemetry. That is 6.9× aStruct = 90 m/s² (9.2 g).
  - At the 1,000 m gate the ship is still above the curve: 264.7 m/s against v_safe(1000) = 229.8 m/s.
  - Converging onto the curve from above requires drag greater than aStruct, by construction. The "limit" is therefore exceeded every time the governor acts.
- Impact: no gameplay effect today (there is no damage model). It is a trap for any later structural-damage, pilot-g or VFX feature that reads a_struct as an actual limit. The docs overstate what the governor guarantees.
- Proposed fix: rename and redocument a_struct as the governor's equilibrium constant, or add a real airframe-load model. Decide this at a later feature task (§13 ADR).
- Fix task size: doc-only in one session; a load model is its own task.

### A1-U05-10 — Telemetry g-load excludes drag (0.000 g shown during a 63 g deceleration)
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `flightController.ts` sensed accumulators `sx/sy/sz` (thrust + lift only, :~455–488), `t.gLoad = sensed / G0` (:~548) @ 739f1e0
- Claim: the code comment says `sensed (non-gravitational) accel`. Drag is a non-gravitational contact force, which a real accelerometer or pilot feels.
- Evidence: in the dive replay, `peakG` = 0.000 while telemetry `dragDecel` peaks at 625 m/s² (63.7 g). Drag is applied as a velocity scale in step D and never enters `sx/sy/sz`.
- Impact: the HUD "G / PEAK G" reads 0 throughout every re-entry. Any future g-dependent effect (blackout, damage, camera shake) would be wrong.
- Proposed fix: add the drag deceleration vector (−k·v_rel) and the contact impulses per tick to the sensed sum. Zero allocation; scalar math only.
- Fix task size: small, fits one session with a Node check.

### Checked, no issue (U05c)
- **v@1000 m.** An independent RK4 integration (dt 1e-4 s, μ/r² gravity, drag βQρv² + βLρv, same atmosphere) gives 266.00 m/s. The engine Node replay gives 264.75, and M1D claims 264.7. The 0.5 % gap matches the engine's first-order split (exact drag map, then semi-implicit kick). Without drag the value would be 2,012 m/s.
- **βQ derivation** (`aerodynamics.ts` :17–21): the vertical-dive integral requires βQ ≥ 2.52e-3. βQ = 3.2e-3 carries a 27 % margin, and C_d·A/(2m) = 0.35·22/2400 ≈ 3.2e-3, both as stated.
- **Sweep endpoint.** The sweep always samples the exact segment endpoint (:675, :681). Contact places the ship at surface + 3 m, kills the inward radial velocity, scales speed by 0.985, and lands below 3.5 m/s relative speed. Every tick therefore ends ≥ 3 m AGL, as claimed.
- **BASE sweep, no tunnelling in sample.** 0/3,000 random low, fast ticks tunnel. The sweep removal control is caught by T2.
- **Terrain height.** Max sampled height is 734.8 m ≤ `maxTerrainHeight` 900, and the minimum is −423.0 m. The early-out and sample bands are safe on height.
- **HUD.** Harness :1000–1182 is HUD only. The overall verdict is `TEST_ORDER.every(pass)`, with no extra logic.


## U27 recheck qualification — 2026-10-25, session 96
A1-U05-2 retains S1. The real harness checks its deadline before updating; original replay allowed one extra frame. Correct 15 fps values: 16.8 physical seconds and 62.607 m AGL, not 16.9/57.3. Tick-deadline controls pass with identical physical traces.
Evidence and authoritative recheck disposition: [K2d batch](U27-k2d-recheck.md).
