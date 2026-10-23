# A1-U18 — flightController audit

- Unit: U18 · Session 73 · 2026-10-23 · audited at `21e63b1` (branch `a1-engine-audit`)
- File: `game/src/core/physics/flightController.ts` (750 lines, read in full), plus the calls it makes into
  `aerodynamics.ts` / `atmosphere.ts`. U19 owns aerodynamics and the atmosphere model.
- Probe: `game/tools/audit/u18-flight-controller.mjs`. It imports the REAL `FlightController` and the terrain field.
  Body axes, "right" (= fwd × up), the expected thrust and the vacuum bounds are computed in the probe itself.
- Command (from `game/`): `node tools/audit/u18-flight-controller.mjs` → **PROBE_EXIT=0**, controls 5/5.
  Catalog escape speeds come from a one-off read of `CELESTIAL_CONFIGS` (`vesc = √(2·g·R²/R)`); that check is arithmetic only.
- Not redone: U05 already covered the m1d harness, the DDA sweep and its no-clip proof, a_struct, the g-load drag exclusion and v@1000 (A1-U05-*).

## Claims written before probing
1. +yaw turns the nose right, +roll banks right, and +pitch raises the nose (fc.ts header + `ShipInput` docs).
2. The 2,000 m/s cap is a capability governor. It fades thrust C¹ and is "never a velocity clamp". Braking should stay available.
3. The rescale above 2,025 m/s is "unreachable" — a NaN-pathology guard only.
4. With planet spin, the ship lives in a single consistent frame for air, terrain, gravity and the LANDED state.
5. The NaN guard restores the last good state. The tick observer sees "valid, post-resolution state".
6. Telemetry agrees with the atmosphere module's own instruments.

## Findings

### A1-U18-1 — yaw and roll are mirrored: D / → steer the ship LEFT
- Severity: S1     Confidence: confirmed
- Category: engine + spec
- Location: `flightController.ts:153` (body frame doc), `:416–417` (`wx = −roll·max`, `wy = +yaw·max`) @ 21e63b1. Also `Milestone/Milestone 1D.txt:35` ("+Z = X×Y (left)") and harness `Milestone1D_TestHarness.tsx:460–461`.
- Claim: the body frame is right-handed with +Z = X×Y "left". +yaw means nose right, and +roll means roll right.
- Evidence: in a right-handed frame, X×Y = +Z points RIGHT of a ship looking along +X with +Y up (the probe gets fwd×up = (0,0,1)). Every sign derived from "+Z is left" is therefore mirrored. Each probe below ran 0.5 s with full input:
  - `A.yaw+1.fwd·right0=-0.1234`: the nose moved left.
  - `A.roll+1.up·right0=-0.4308`: the ship banked left.
  - `A.pitch+1.fwd·up0=0.2209`: pitch is correct.
  - `A.bankTurn` at 200 m/s, roll +1 for 0.42 s: `vel·right0=-0.0048`, so the ship turned left.
- Impact: in the m1d manual mode, `KeyD` (yaw +1) and `ArrowRight` (roll +1) steer left. Any future ship page built on this controller ships mirrored controls. No m1d row checks a control sign, so the gate cannot see it.
- Proposed fix: negate `wx` and `wy`, or redefine the body +Z as right. Correct the doc and spec comment to match. Add a sign row: +yaw → fwd·right > 0, +roll → up·right > 0. Not a ratified item.
- Fix task size: one session (two signs + docs + a Node sign test).

### A1-U18-2 — the C¹ cap also fades RETRO thrust: near 2,000 m/s the ship cannot brake
- Severity: S1     Confidence: confirmed
- Category: engine (RATIFIED C¹ speed cap)
- Location: `flightController.ts:450–454` @ 21e63b1
- Claim: the cap is "a capability governor, never a velocity clamp". The fade should limit how fast the ship can GAIN speed.
- Evidence: the fade multiplies all thrust by f(|v|), whatever direction the thrust points. Full retro thrust (nose against the velocity, vacuum) gives:

  | \|v\| m/s | 1880 | 1940 | 1980 | 1995 | 2000 |
  |---|---|---|---|---|---|
  | retro decel m/s² | 45 | 22.5 | 3.33 | 0.228 | ≈0 |

  From 1,999 m/s, full retro thrust cannot get down to 1,880 m/s within 60 s (`B.brake1999to1880.seconds=60`, the loop limit). Unfaded thrust would take 2.64 s. At exactly 2,000 m/s, braking is zero for as long as the ship stays at that speed.
- Impact: a pilot at top speed in vacuum has no brakes and no steering authority by thrust. The ship coasts at 2,000 m/s until gravity or drag acts. This makes the "governor" a trap.
- Proposed fix: fade only the prograde component, i.e. apply `fade` when `fwd·v̂ > 0`, scaled by that dot product. Retro and lateral thrust then stay available. The cap is RATIFIED, so the change needs an ADR under §13 in the fix task.
- Fix task size: one session (fade rule + ADR + a retro-braking row).

### A1-U18-3 — planet spin splits the ship across two frames: a parked ship slides 179 m in 10 s
- Severity: S1 (latent: every config has `planetSpin = 0`)     Confidence: confirmed
- Category: engine
- Location: `flightController.ts:399/532/741` (air and LANDED state use v_atm = Ω×p), `:525/696/719/728` (terrain sampled at the INERTIAL direction pos/r), `:491–494` (inertial gravity) @ 21e63b1
- Claim: one consistent frame. The atmosphere doc says v_rel is relative to the rotating atmosphere, and LANDED means the ship is at rest on the ground.
- Evidence: the probe parks a ship 3.2 m above the terrain with v = Ω×p, i.e. at rest relative to the air, at Ω = 0.0104 rad/s (the spec's 52 m/s equator example). The terrain does not rotate, so the ship slides over the collision terrain.
  - Ω = 0.0104: `arc_over_terrain_10s=178.6 m`, grounded 396/600 ticks, airspeed 0, AGL 3. The LANDED settle (`:743`) re-imposes v = Ω×p every contact tick.
  - Ω = 0 control: 0 m, grounded 588/600.
  - The cap is measured on inertial |v| (`:446`). On the ground at that spin, the ground-relative headroom is 1,948 m/s prograde and 2,052 m/s retrograde.
- Impact: this is the same frame mix as A1-U17-1 (KCC airborne up) and A1-U13-1 (no parented compose). It blocks A1-U12-1, the goal requirement that every body rotates. Ships would skate on any spinning planet, and landings would never settle.
- Proposed fix: integrate the ship in the planet's rotating frame, either by sampling the terrain at R(−θ)·p or by keeping ship state planet-local. Add Coriolis/centrifugal terms if the rotating frame is used. Fix it together with the U17-1 / U13-1 parented-frame task, and measure the cap against the local-frame speed.
- Fix task size: part of the shared "parented rotating frame" fix task. As a stand-alone flight change, one session: terrain sample rotation + a parked-ship row.

### A1-U18-4 — one NaN input latches angVel to NaN; the ship freezes forever and the observer sees NaN state
- Severity: S2     Confidence: confirmed
- Category: engine + doc
- Location: `flightController.ts:413–415` (`clamp(NaN)` returns NaN), `:381–384` (no `angVel` snapshot), `:579` (observer runs before the guard at `:583`), doc `:290` @ 21e63b1
- Claim: the NaN guard restores the last good snapshot, and the observer gets "valid, post-resolution state".
- Evidence: one tick with `input.yaw = NaN`, then 300 clean ticks at 100 m/s. Result: `nanEvents 301/301`, `angVel.y NaN`, and the ship moved 0 m in 5 s. The observer saw NaN state 301 times. The clean control run moves 500 m.
- Impact: one bad input (a gamepad axis glitch, or a divide-by-zero in a future autopilot) permanently freezes the ship. The harness trace observer records NaN while its doc promises otherwise. This mirrors the KCC guard defect A1-U16-4.
- Proposed fix: sanitise the inputs (non-finite → 0), snapshot and restore `angVel` too, and call the observer after the guard.
- Fix task size: one session; can be combined with the A1-U16-4 fix.

### A1-U18-5 — the "unreachable" 2,025 m/s rescale is reachable on the giant planets
- Severity: S2     Confidence: likely (arithmetic from catalog values; no live dive was run on a giant)
- Category: engine
- Location: `flightController.ts:509–514` (`safetyRescaleAbove: 2025`, `:139`) @ 21e63b1
- Claim: the rescale is an "unreachable NaN-pathology guard only — never a gameplay clamp".
- Evidence: a ship entering at 2,000 m/s and falling in vacuum to r = R reaches √(2000² + v_esc²):
  - EARTHSCALE test planet: 2,024 m/s, just under 2,025. The probe dive peaks at 2,000 m/s with 0 rescale events, because drag holds it.
  - Catalog (g·R² law): Jupiter 2,197, Saturn 2,077, Neptune 2,054, Uranus 2,043 m/s. All are above the bound.
  - The bound was tuned to the one test planet.
- Impact: on a gas-giant descent with thin upper drag, the guard silently snaps |v| to 2,000. This is a velocity clamp with a 25 m/s discontinuity, which the design says must never happen.
- Proposed fix: derive the guard from the body, e.g. `hardCap + vesc + margin`, or replace it with an `isFinite` check. Add a row that dives on the highest-μ body.
- Fix task size: one session; can be combined with A1-U18-2.

### A1-U18-6 — telemetry pressure ignores the temperature floor and goes negative
- Severity: S3     Confidence: confirmed
- Category: engine (instrument only)
- Location: `flightController.ts:541` @ 21e63b1 (`atmosphere.ts` `pressureAt` uses `temperatureAt` with `tempFloor`)
- Evidence:
  - 10 km: telemetry equals `pressureAt` (1.886e+1 Pa).
  - 20 km: telemetry 3.213e-3 vs 4.266e-3 Pa (25 % low).
  - 50 km: telemetry −1.04e-14 vs 5.93e-14 Pa (negative).
- Impact: a HUD instrument only; physics does not use it.
- Proposed fix: call `pressureAt(atm, alt2)`.
- Fix task size: trivial; fold it into any flight fix task.

## Checked, no issue
- The C¹ smoothstep fade itself: one-sided slopes ≈ 0 at 1,880 and 2,000 m/s, and the prograde values are right (45 / 22.5 / 3.33 / 0.228 m/s²).
- Drag dive from 60 km at 1,990 m/s: vmax 1,995 m/s at throttle 0 and 2,000 m/s at throttle 1, with 0 rescale events.
- The pitch sign is correct.
- The exponential rate tracker matches the exact first-order step (0.04389 rad/s after one tick).
- `quatIntegrateInPlace` is first order with renormalisation: 18 rad of yaw over 600 ticks drifts 0.077°. This is fine for a rate-commanded ship.
- `rotBodyToWorldInto` agrees with `quatFromBasisInto` and with an independent q⊗v⊗q*.
- `atmosphereVelocityInto` = Ω×p for Ω along +Y (formula checked).
- The fixed 1/60 tick, the 0.25 s clamp and the shed-don't-dilate accumulator match spec 02.6. The below-12-fps slow-down is the same class as A1-U13-3 and is not re-reported.
- The terrain radius equals the flight radius on EARTHSCALE.

## Seeds for later units
- **U19:** the sound speed lapse vs the isothermal density law, and the lift AoA convention. A1-U18-1 does not affect pitch, but re-check the sign of the lift direction against body-up under roll.
- **U26:** A1-U18-3 joins A1-U13-1 / A1-U17-1 / A1-U12-1 as a single "rotating parent frame" rework. Ship, astronaut and terrain need one planet-local state model.
- **U27:** A1-U18-2 and A1-U18-5 both touch the RATIFIED cap. Group them into one ADR.