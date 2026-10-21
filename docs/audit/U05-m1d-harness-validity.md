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

## Left for U05c
- T2 penetration: a DDA mutation (coarsen `DDA_MAX_GAP`, or disable `_sweepTerrain`) to check whether T2 or minPostTickAGL can fail at all.
- An independent analytic drag + gravity integration for v@1000 m.
- Read `flightController.ts` :60–355 and :580–750 (sweep/contact), `aerodynamics.ts`, `atmosphere.ts` in full, harness :1000–1182 (HUD), and the Milestone 1D grep.