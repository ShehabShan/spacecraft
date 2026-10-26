# A1-U05a — m1d harness validity: reading pass (partial unit)

- Unit: U05 split per AGENT_BRIEF §12. The Lead reported a low balance, so the session stopped before any probe ran.
- Commit base: 20b6e7a. This file contains **no findings**. Under A1-plan §6.3, a finding needs a probe or an exact code citation that has been checked.
- Read fully:
  - `game/src/test/Milestone1D_TestHarness.tsx` lines 1–1000 (boot, LOD controller, scene, input, phase machine, `evaluateSuite`, frame loop).
  - `game/e2e/m1d.spec.ts`.
  - `game/src/core/physics/flightController.ts` lines 1–60 and 355–750 (`update`, `integrateFlight`, DDA sweep, contact resolution).
- Not yet read:
  - harness lines 1000–1182 (HUD only);
  - `flightController.ts` lines 60–355 (config and types);
  - `aerodynamics.ts` and `atmosphere.ts`;
  - the Milestone 1D grep.

## Seeds for U05b (claims to test, each with the evidence that would settle it)
Line numbers refer to `Milestone1D_TestHarness.tsx` @ 20b6e7a unless stated otherwise.

1. **T4 heap clause accepts any negative delta**
   - Code: `heapOk = heap < 0 || heap <= 1_048_576` (~:717).
   - `heapDelta = -1` when `performance.memory` is absent, so the clause passes without measuring anything.
   - This is the same pattern as U03 R4 and U04 R4.
   - Probe: a heap shim run ≥3×, plus an allocating mutation inside `integrateFlight`.
2. **T4 identity canary is likely tautological**
   - It compares `readonly` instance fields (`flightController.ts` :156–161) with themselves after the burn.
   - This is the same pattern as U04 R4.
   - Probe: check whether any reassignment can compile or run.
3. **T5 offset check is likely tautological**
   - At :869 the harness does `terrainGroup.position.set(-o.x, …)` and immediately measures `|position.x + o.x|`.
   - THREE `Vector3` stores f64, so the error is exactly 0 by construction. The detail string's "Δ f32-exact" is never checked.
   - Probe: replicate the lines and apply a mutation that offsets the origin.
4. **T1 contains self-comparisons**
   - `machNumber(atm, 0, a0)` is compared with 1, which is `a0/a0`.
   - The wind check `|Ω×p| = 0.0104·5000 = 52` checks a multiplication.
   - `r0 === 1.225` checks the config literal.
   - `EARTHSCALE_FLIGHT.planetSpin = 0`, so the rotating atmosphere is never exercised in flight.
   - Probe: mutate `densityAt` and `speedOfSoundAt` (e.g. make the density law non-C∞, or put a step at 8 km) and see whether T1 still passes.
5. **T3 bounds need measuring**
   - `maxDv <= 12` against a stated peak of ≈10.4 m/s per tick leaves about a 15% margin.
   - `crossOk` only flags a drop of more than 8 m/s across 400.
   - The reversal counter (dot < −1e-9) cannot trip under an exponential drag map.
   - Probe: a velocity-clamp mutation (e.g. clamp to `vSafe` once per tick). Does T3 fail? This is the row's core claim.
6. **T2 penetration clauses**
   - `minPostTickAGL` is measured after `_resolveContact` has placed the ship at h + 3 m.
   - `diveMinPostAGL` skips grounded ticks (`diveObserver` returns early).
   - Probe: disable or coarsen the DDA (`DDA_MAX_GAP`) under a mutation and check whether T2 fails. Compare against an independent analytic drag+gravity integration for v@1000.
7. **Wall-clock dive (known: STATE "1D FPS BACKLOG")**
   - `flight.update(dt*4, 6)` sheds ticks when the frame rate drops, while `simElapsed` keeps counting wall-scaled time.
   - `core.advance(dt)` is not ×4.
   - U05b should quantify the outcome against fps (Node replay at 60/30/15 fps).
8. **Minor**
   - The `scripted` variable at :846 is dead code.
   - `abRender`-style retries are absent here (nothing to check).

## Checked, no issue (so far)
- The e2e spec fails on a FAIL badge, a missing acceptance line (120 s timeout) and zero badges.
  - A `pageerror` is only logged, not asserted (carry this to U08).
- `update()` uses a fixed 1/60 tick, a 0.25 s cap and shed-don't-dilate, as its header documents.