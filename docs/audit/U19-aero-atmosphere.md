# A1-U19 — aerodynamics + atmosphere (+ T2 gap check)

- Unit: U19 (`docs/A1-plan.md` §5, Phase C) · Session 75 · 2026-10-23 · audited @ 061a0ae
- Files read in full: `game/src/core/physics/atmosphere.ts` (120), `game/src/core/physics/aerodynamics.ts` (136);
  call sites in `game/src/core/physics/flightController.ts` (config 113–145, tick 375–560, contact 700–748).
  Specs: `pre-t4:Milestone/Milestone 1D.txt` lines 16–42, 43, 75 (grep); `pre-t4:Design_specs/00` line 22, `02` §4, `03` atmosphereHeight (grep).
- Lead extension (2026-10-23): also check the T2 requirement in `notes/task.md`
  (per-body real atmospheres, a manual landing that the atmosphere affects, 2,000 m/s for deep space only).
- Probe: `pre-t4:game/tools/audit/u19-aero-atmosphere.mjs`. It imports the real atmosphere, aerodynamics,
  flightController and terrain modules. Truth comes from hydrostatics (dP/dh = −ρg, P = ρ·Rs·T) and
  NASA planetary fact-sheet values, rounded.
  - Command (from `game/`): `node --expose-gc tools/audit/u19-aero-atmosphere.mjs > /tmp/u19.log` → **PROBE_EXIT=0**, `controls=11/11`.
  - Controls, all derived independently: a(0) = √(1.4·287.05·288.15) = 340.3 m/s; a(8 km) = 308 m/s; equator wind 52 m/s along −Z;
    planet g = 9.81 m/s²; ρ matches 1.225·e^(−h/1200) at 6 heights; C_l is odd.
  - The first run exited 1 because I used the Milestone 1D v_safe table as a control. That table is a claim, not a truth, so it is now report-only (A1-U19-7).

## Claims written before probing
1. An isothermal exponential atmosphere is consistent only if H_s = Rs·T/g, with g the planet's surface gravity (Milestone 1D line 16 states this law itself).
2. The pressure shown on the HUD should satisfy dP/dh = −ρg.
3. The governor's promise (Spec 01 "The Governor": slow arrival at the terrain) should hold on every body that has an atmosphere, not only on the Earth-scale test planet.
4. Landing should depend on touchdown speed. A real-looking game needs some outcome for a hard impact.
5. T2 needs one atmosphere profile per body and a speed rule that depends on distance from bodies.
6. C_l(α) should be C¹ and odd, lift should be perpendicular to the relative wind, and lift should roll with the ship.

## Findings

### A1-U19-1 — the atmosphere is not hydrostatic: H = 1,200 m implies g = 68.9 m/s² (7× the planet)
- Severity: S2     Confidence: confirmed
- Category: spec | engine
- Location: `game/src/core/physics/atmosphere.ts:46–56` (EARTHSCALE_ATMOSPHERE), `:92–94` (pressureAt), `flightController.ts:541` (telemetry pressure) @ 061a0ae; `pre-t4:Milestone/Milestone 1D.txt:16`
- Claim: Milestone 1D line 16 derives H_s = Rs·T/g, compresses H 7× ("same ~7× compression factor as the catalog's linear scale"), and calls this "internally consistent".
- Evidence:
  - H itself was compressed, but T (288 K) and g (9.81 m/s²) were not. The H that matches the planet's g is 8,432 m. With H = 1,200 m and T = 288 K, the implied g is 68.93 m/s² (`A.g_implied_by_H`, ratio 7.03).
  - The HUD pressure gradient, divided by −ρg, gives 7.14 at 500 m, 6.90 at 2 km and 6.27 at 6 km (`A.dPdh_over_minus_rho_g@…`). The air column on the HUD does not balance gravity.
  - The header claims the isothermal density is within 2 % of the exact lapse-rate density. With the g that H implies, ρ_iso/ρ_exact is:

    | Altitude | 1 km | 2 km | 4 km | 6 km | 8 km | 12 km |
    |---|---|---|---|---|---|---|
    | ρ_iso/ρ_exact | 0.987 | 0.993 | 1.068 | 1.255 | 1.626 | 3.84 |

    So "< 2 %" holds only up to about 2 km.
  - Density (isothermal) and sound speed (lapse rate) come from two different temperature models.
- Impact: the HUD's pressure, temperature and Mach readings belong to a different atmosphere than the one that produces drag. Any future heating, engine or physics model built on (ρ, P, T) inherits the inconsistency. It is also a symptom of the root problem: the profile was hand-tuned for one gate, not derived per body (A1-U19-2/4).
- Proposed fix: derive each profile from (g_body, T_body, Rs_body). If a compressed H is wanted for gameplay, write that down as an explicit approximation and derive P from ρ and H (P = ρ·g·H) so the HUD stays self-consistent. Not RATIFIED.
- Fix task size: one session. It folds into the T2 per-body profile work.

### A1-U19-2 — the governor's "slow arrival" holds only for Earth's ρ0·H: with real densities, Mars and Pluto hit the ground near 2,000 m/s and Venus never lands
- Severity: S1     Confidence: confirmed
- Category: engine | spec (T2 prerequisite)
- Location: `aerodynamics.ts:8–21` (governor header, βQ derived from the single Earth-scale gate), `flightController.ts:398–434` (drag map) @ 061a0ae; Spec 01 "The Governor"
- Claim: entering an atmosphere, the ship is "mathematically forced to decelerate". By the time it reaches the terrain, its speed is low enough that the terrain workers have time to stream.
- Evidence: probe section G runs the same unmodified code with only ρ0 swapped to the real surface density. It keeps H = 1,200 m and dives vertically from 8 km at 2,000 m/s with zero throttle.

  | Body | ρ0 (kg/m³) | Speed at terrain | Peak drag |
  |---|---|---|---|
  | Mars | 0.020 | **1,865 m/s** | 22.8 g |
  | Earth | 1.225 | 51 m/s | 64 g |
  | Titan | 5.3 | 22 m/s | 67 g |
  | Venus | 65 | **no contact within 100 s** | 118 g |
  | Pluto | 8e-5 | **2,014 m/s** | 0.11 g |

  βQ = 3.2e-3 was derived from one Earth-scale gate (`aerodynamics.ts:16–21`), so the guarantee is a property of that single ρ0·H product. It is not a property of the method.
- Impact:
  - On thin-air bodies (Mars, Pluto, Triton) the ship reaches the terrain near the hard cap, so the streaming-time guarantee is gone.
  - On Venus, the ship hangs high above the ground under extreme deceleration.
  - Every peak deceleration exceeds a_struct = 90 m/s² by a large factor (see also U05c's a_struct finding). The "governor" governs nothing on these bodies.
- Proposed fix (T2 or an earlier fix task):
  - Use a per-body profile (A1-U19-4).
  - Use an explicit near-body speed rule (thrust limit or speed limit by altitude/regime), so arrival speed no longer depends on drag alone.
  - Size streaming for the worst arrival speed of any regime.
  - It touches the C¹ cap (RATIFIED, see A1-U18-2), so it needs an ADR under §13.
- Fix task size: the planning in T2 decides the regime rule (ADR); the build is two sessions (profiles + regime rule; streaming check).

### A1-U19-3 — any touchdown speed "lands": contacts at 25, 57 and 124 m/s all end LANDED in the contact tick
- Severity: S1     Confidence: confirmed
- Category: engine (T2 prerequisite)
- Location: `flightController.ts:709–748` (`_resolveContact`; `_grounded = true` at 745) @ 061a0ae
- Claim (T2, Lead): landing is manual — the player flies the ship down, and the atmosphere affects it. Claim 4 above: touchdown speed should matter.
- Evidence:
  - Probe section E drops the ship vertically from 40 m. Contacts at 25.2, 57.3 and 123.9 m/s all give `mode=LANDED` in the same tick, with 0 NaN events.
  - `_resolveContact` removes the inward radial velocity, multiplies the rest by 0.985, and grounds the ship once the relative speed is below 3.5 m/s.
  - No state, event or telemetry field records touchdown speed. The integrity keys are `ticks|maxDeltaVAirborne|reversals|minSampledAGL|minPostTickAGL|contacts|ddaSamples|nanEvents`, and the telemetry keys have no touchdown field.
  - The contact normal is radial, not the terrain normal, so slopes do not change the outcome.
- Impact: a manual landing has no skill element and no failure. A 124 m/s impact behaves like a soft touchdown, so there is nothing for the atmosphere to "affect" in landing.
- Proposed fix (T2):
  - Record the touchdown speed (normal and tangential) and the terrain normal at contact.
  - Add a landing outcome (soft / hard / crash) with thresholds. The thresholds are a gameplay call; see Q2 below.
  - Use the terrain normal for the contact response.
- Fix task size: one session (contact data + outcome state + Node test).

### A1-U19-4 — one Earth-scale atmosphere for every body; the catalog's atmosphereHeight is never read; no cruise/boost regime exists
- Severity: S1     Confidence: confirmed
- Category: engine | spec (T2 gap)
- Location: `atmosphere.ts:46` (the only profile), `flightController.ts:134–145` (EARTHSCALE_FLIGHT, the only config; `atmosphere: EARTHSCALE_ATMOSPHERE` at 139), `celestialData.ts:76/89–187/252` @ 061a0ae; `pre-t4:Design_specs/00_VISION_AND_RULES.txt:22`
- Claim:
  - T2: every body with a real atmosphere gets its own real-world-based profile; airless bodies are vacuum; 2,000 m/s is a deep-space speed only.
  - Spec 00:22: "400 m/s soft cruise. 1,600 m/s Boost (allowed anywhere outside atmospheres). 2,000 m/s absolute hard cap."
- Evidence:
  - Probe F: the exported profiles are `EARTHSCALE_ATMOSPHERE` only (count 1); the flight configs are `EARTHSCALE_FLIGHT` only.
  - Grep: `atmosphereHeight` from the catalog is read nowhere in physics. `inAtmosphere`/`EXO-ATM` use the profile's own 8,000 m.
  - Grep shows no cruise, boost or 1,600 m/s rule anywhere in `core/` or `play/`. The 2,000 m/s cap applies at every distance, with a fade on retro thrust (A1-U18-2).
  - Only the M1D harness constructs a FlightController; no play page has a ship.
  - Catalog values against real data:
    - Pluto 0 m, but Pluto has a thin real N₂ atmosphere (~1 Pa).
    - Triton 100 m, real ~1.4 Pa.
    - Titan 2,000 m, but Titan's real atmosphere is the thickest relative to its size (1.5 bar, ρ ≈ 5.3 kg/m³, H ≈ 21 km).
    - The Sun has 3,000 m, which is meaningless for a star.
    - Mercury, Moon, Phobos, Io, Titania and Charon are 0, which is right.
  - Thickness relative to body size (builds on A1-U10-9):

    | Body | Real H/R | Game atmosphereHeight/R |
    |---|---|---|
    | Earth | 0.0013 | 1.6 |
    | Venus | 0.0026 | 1.23 |
    | Mars | 0.0033 | 0.75 |
    | Titan | 0.0082 | 0.63 |
    | Jupiter | 0.0004 | 0.72 |
    | Saturn | 0.0010 | 0.99 |
    | Uranus | 0.0011 | 0.80 |
    | Neptune | 0.0008 | 0.81 |

    The Earth-scale profile's own H/R is 0.24, about 180× the real ratio.
- Impact: T2's first requirement has no foundation in the engine. Any ship flight on another body would use Earth air, Earth sound speed and an Earth-tuned governor (A1-U19-2).
- Proposed fix (T2):
  - Add a per-body `AtmosphereProfile` table: ρ0, H (derived or documented compression), T, γ, Rs, molar mass. Vacuum = no profile.
  - Select the profile from the dominant body.
  - Retire the catalog atmosphereHeight, or make it the derived mode boundary.
  - Add a regime rule (near-body vs deep-space limit), with an ADR.
  - `celestialData` constants are RATIFIED, so correcting Pluto/Triton/Titan/Sun needs an ADR plus evidence.
- Fix task size: two sessions (profile table + selection + tests; regime/cruise rule + ADR).

### A1-U19-5 — lift is not governed: 112.5 m/s² at sea-level v_safe, above a_struct = 90
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `aerodynamics.ts:69–73` (v_safe uses drag only), `flightController.ts:463–483` (lift) @ 061a0ae
- Claim: v_safe is "the speed at which … deceleration equals the airframe limit a_struct".
- Evidence: at ρ0 and v_safe = 151.5 m/s, the maximum lift (C_l max 0.685 at α = 18.5°) is 112.5 m/s², which is 1.25 a_struct. The governor's curve counts drag only. Lift and drag together are larger still. Probe section C.
- Impact: a pull-up on the governor curve exceeds the airframe limit that the governor exists to respect. A future damage/g-limit model inherits a curve that is not safe.
- Proposed fix: define a_struct against the total aerodynamic acceleration, or cap C_l·q·S/m in the controller. Document the choice. Not RATIFIED.
- Fix task size: under one session.

### A1-U19-6 — lift switches on as a step at |v_rel| = 15 m/s (1.06 m/s² at sea level)
- Severity: S3     Confidence: confirmed
- Category: engine | doc
- Location: `flightController.ts:463` (`if (rho > 0 && speedRel > 15)`) @ 061a0ae
- Claim: the header and Milestone 1D call the model C¹ / "no discontinuity".
- Evidence: at α_crit, sea level and 15 m/s, lift jumps from 0 to 1.061 m/s² (`C.lift_step_at_15ms_mps2`).
- Impact: a small jolt at low speed during landing flare. Minor.
- Proposed fix: fade lift in smoothly over a speed band (e.g. 10–20 m/s).
- Fix task size: minutes; bundle with A1-U19-5.

### A1-U19-7 — documentation errors: the Milestone 1D v_safe table's 2 km row is wrong; the "< 2 %" lapse claim; v_safe omits βL
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `pre-t4:Milestone/Milestone 1D.txt:20–24` (table), `atmosphere.ts:15–18` (header), `aerodynamics.ts:69–73` @ 061a0ae
- Evidence:
  - The 2 km row of the table: ρ 0.231 in code (the table says 0.152) and v_safe 349 m/s (the table says 430). All other rows match within 0.35 % (probe D).
  - The "< 2 %" claim is false above about 2 km (A1-U19-1).
  - At v_safe, the drag/a_struct ratio is 1.001–1.025, because the curve leaves out the linear term βL.
- Impact: misleading reference numbers for any future tuning.
- Proposed fix: correct the table and the header when T2 rewrites the profiles.
- Fix task size: trivial; bundle.

## Checked, no issue (do not redo)
- Lift direction n̂ = normalize(û − (û·v̂)v̂): perpendicular to the relative wind, work-free, and it rolls with the ship, so a banked turn tilts the lift correctly. A1-U18-1 mirrors only the yaw/roll *input* signs.
- AoA α = −asin(v̂_b·ŷ_b): velocity below the nose gives positive α, which gives lift along body-up, as Milestone 1D line 43 says.
- Stall curve: C¹ at α_crit (left/right slope 2.2/2.2), odd, never changes sign, C_l max 0.685 at 18.5°.
- Exponential drag map v ← v·e^(−k·dt): monotone, no reversals (also covered by U05), k-form matches Spec 02.4.
- Transport wind v_atm = Ω×p with Ω = +Y: sign and 52 m/s equator value correct.
- Sound speed √(γRsT) with lapse rate and floor: matches the stated 340.3 m/s → 308 m/s.
- controlDamping clamp; safeSpeedAt returns infinity in vacuum; densityAt clamps below MSL.
- Not redone (U05c): drag dive, a_struct in the governed dive, v@1000 = 264.7. The telemetry pressure without the temperature floor is A1-U18-6.

## Questions for the Lead (look and feel only)
- **Q1 — How thick should atmospheres look and feel?** Real air layers are very thin compared to the planet, like the skin on an apple. On our small planets, a truly real one would be only a few metres to tens of metres thick, so there would be almost no air to fly through. Today they are about as tall as the planet itself.
  **Suggested default:** a thin, glowing shell that clearly looks thin from space (a few percent of the planet's size), but thick enough that you feel the air slowing you on the way down.
  **ANSWERED (Lead, 2026-10-23): suggested default accepted.**
- **Q2 — What should happen when you hit the ground too fast?** Today the ship just stops and counts as landed, even at 124 m/s.
  **Suggested default:**
  - Gentle (under ~5 m/s): a clean landing.
  - 5–15 m/s: a hard landing with a camera shake.
  - Faster: a crash, with a short explosion, then a respawn in orbit above the planet.
  **ANSWERED (Lead, 2026-10-23): suggested default accepted.**

## Seeds for later units
- U20 (terrain streaming): after T2, the arrival speed is set by the regime rule, not by drag (A1-U19-2). Streaming has to be sized for the fastest regime arrival.
- U26 (architecture): the atmosphere/aero layer is a single global config, not a per-body component. The FlightConfig mixes body data (R, μ, spin, atmosphere) with ship data (aero, thrust), so ships on many bodies need these two split.
- T2 planning: findings A1-U19-2, -3 and -4 are prerequisites, together with A1-U18-2 (retro fade) and A1-U18-3 (spin frame split).