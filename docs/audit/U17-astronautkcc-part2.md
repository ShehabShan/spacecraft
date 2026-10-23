# A1-U17 — astronautKCC part 2 (jump/landing, slide, airborne + zero-G, vehicle, telemetry)

- Unit: A1 U17 · Session 72 · 2026-10-23 · auditor: PromptQL bot (VM v2, 2 vCPU / 4 GB)
- Code: `game/src/core/physics/astronautKCC.ts` @ 810b032, lines 524–1114 (part 1, lines 1–560, is U16),
  plus `play/world/moonConfig.ts` (MOON_ASTRONAUT) and `core/physics/sphericalFrame.ts` (helpers).
- Spec: Milestone 1E grep ("Coriolis handoff", "Zero-G" passages, lines 51–63). It matches the code header.
- Probe: `game/tools/audit/u17-kcc-part2.mjs` (imports the REAL KCC and terrain; the truth is computed in the
  probe: radials from the KCC's own positions, true AGL from the height field, ballistics from an RK4).
- Scope note: the plan lists "the C¹ speed cap (RATIFIED)" under U17. **The KCC has no speed cap.** The C¹ cap
  is the 2,000 m/s thrust fade in `flightController.ts:18/445`, so it moves to U18 (A1-U17-9).

## Claims written before probing
1. `up`/`fwd` are PLANET-frame vectors in every mode (class doc, line 223). Every write to them must use
   planet-frame inputs.
2. A jump is a ballistic arc. Flight time and apex should match an independent integration within one tick of
   integrator bias.
3. Landing (Spec M1E line 51) kills the normal velocity and plants the tangential velocity at the input target.
   It should not pop the visible frame.
4. Sliding is Coulomb: `a = g(sinθ − μk·cosθ)` along the fall line. Below the slide angle it should decelerate at
   no more than μk·g (0.97 m/s² on the Moon).
5. Telemetry `altAGL` is the height above the terrain under the character, in every mode.

## Findings

### A1-U17-1 — airborne/zero-G "up re-alignment" pulls the planet-frame `up` toward the WORLD radial
- Severity: S1     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:857–865` (`_flightTick`: `px/r0` with `px = this.absPos.x`) @ 810b032
- Claim: `up` is planet-frame (line 223, and `teleportAbs` sets `up = _dS`, a planet-frame direction); the
  airborne frame "gently re-aligns up toward local radial".
- Evidence: `node tools/audit/u17-kcc-part2.mjs` (PROBE_EXIT=0, controls 5/5). EARTHSCALE config (Ω 0.0104), the
  same jump from the same site, started at different spin phases θ:

  | θ at take-off | max airborne up vs planet radial | up jump on the landing tick |
  |---|---|---|
  | 0 (frames coincide) | 17.3° (= take-off tilt 17.4°, decaying) | 8.2° |
  | 0.624 rad | 22.6° | 18.1° |
  | π/2 | **43.9°** | **37.3°** |

  Zero-G, 10 s at rest, started radially aligned: θ0 = π/2 → up is **92.8°** off the planet radial (0.74° off the
  world radial). Control: Ω = 0, θ0 = 0 → 1.8e-15°. Even θ0 = 0 drifts 5.8° in 10 s, because the planet turns
  5.96° in that time.
- Impact: on any spinning body the character tilts sideways in the air, by up to the spin phase, and snaps back
  on landing. In zero-G the "up" chases a direction that means nothing in the frame where it is used, so RCS
  thrust (lines 822–833 rotate the frame by θ to world) points the wrong way. This is latent in the play Moon
  (Ω = 0, by U13-1's frozen sky). It becomes live as soon as bodies rotate, which the goal requires (U12-1).
- Proposed fix: blend toward the planet-frame radial (`pLocal` normalised, which `_flightTick` already computes
  at its end), or convert `absPos` by `spin(θ)⁻¹` first. Add a regression row with Ω ≠ 0 and θ0 = π/2. Not a
  RATIFIED item.
- Fix task size: fits one session (together with A1-U17-2).

### A1-U17-2 — the vehicle tick writes `up`/`fwd` in the WORLD frame; a parked vehicle drifts by the spin angle
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:1028–1056` (`_vehicleTick`: `up = provider.quat · _vehUp`), `296–312`
  (`attachVehicle`: conjugates a planet-frame `up` by the world-frame `provider.quat`) @ 810b032
- Claim: as A1-U17-1. The vehicle compose is "parented" (Spec 01.1 step 3).
- Evidence: same probe, section G. A vehicle that rides the planet (pos = spin(θ)·P0, quat = spin(θ),
  vel = Ω×P). `pLocal` stays exact (≤ 1.9e-12 m), but the planet-frame `up` drifts by θ: **34.3° after 60 s
  (θ 35.8°) and 85.4° after 151 s (θ 90°)**. Control: Ω = 0 → drift 0.
- Impact: with any rotating parent, the character's frame inside a vehicle rotates away from the vehicle. On
  detach, the airborne frame starts from that wrong `up`. Latent: no vehicle is in play yet. This is one
  concrete symptom of the missing parented-compose layer (U13-1).
- Proposed fix: keep one frame convention. Either store `up`/`fwd` in world space while in VEHICLE and convert
  with spin(θ)⁻¹ on attach/detach, or rotate by `spin(θ)⁻¹·provider.quat`. Lands with A1-U17-1.
- Fix task size: fits one session with A1-U17-1.

### A1-U17-3 — every landing snaps the character frame by up to 51° in one tick (play Moon, Ω = 0)
- Severity: S1     Confidence: confirmed
- Category: engine (visible in play)
- Location: `astronautKCC.ts:857–865` (airborne up decays to radial, τ = 2 s) + `1019` (`_landAt` →
  `_refreshUpFwd` re-blends the terrain normal at once) @ 810b032
- Claim: the airborne re-alignment is "C0, no snaps" (line 856). The landing should not pop the frame.
- Evidence: section B, MOON_ASTRONAUT, 120 standing jumps from random 0–40° sites. The largest per-tick up change
  in the air is 0.21°. On the landing tick the change is **p50 18.8°, p90 33.1°, max 50.8°**, and 86 % of
  landings exceed 10°. A Moon jump lasts ≈ 5 s (2.5 τ), so `up` has decayed almost fully to radial; the plant then
  restores `up = norm(0.65 n + 0.35 r̂)` in one step. The snap does not track the take-off slope, because it
  depends on the landing site's normal (sample pairs take-off slope : snap: 38.4°:20.9°, 29.7°:36.1°).
- Impact: a visible pop of the character (and of any camera parented to `up`) on almost every landing on uneven
  ground. Whether the play rig or camera smooths it is not checked here (seed for U23/U24).
- Proposed fix: smooth `up` toward the blended normal over a short τ after landing (as in the air), or keep the
  airborne target at the predicted landing normal. Not RATIFIED.
- Fix task size: fits one session.

### A1-U17-4 — sliding stops 15–28× harder than kinetic friction allows once the slope reads ≤ 45°
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:570–582` @ 810b032
- Claim: "Slope sliding: static threshold slope > slideAngle (mu_s = tan(angle))" with kinetic friction μk = 0.6.
- Evidence: section C, 30 Moon sites at 46–70°, 12 slides crossing to ≤ 45° (held for 6 ticks). The effective
  deceleration is **p50 14.6, max 26.8 m/s²**. The physical bound is μk·g = 0.97 m/s². The speed left after 0.1 s
  is p50 25 %. At every crossing (100 %, slope 44.9°) Coulomb friction would still **accelerate** the slide by
  +0.46 m/s², because sliding continues for θ > atan μk = 31°. The cause: below 45° the code multiplies vSlide by
  `exp(−dt/0.06)`, which does not depend on g, μk or θ. The max slide speed seen was 5.3 m/s.
- Impact: slides end in a jerk at an invisible line. Static (45°) and kinetic (31°) thresholds are mixed up.
  With U16-7 (the 45–50° walk/slide overlap) this is the "steep slope" feel question already put to the Lead.
- Proposed fix: once sliding, keep Coulomb kinetic friction until the speed reaches 0 or the slope drops below
  atan μk; reserve the grip τ for slopes under that angle. Not RATIFIED (the step/slope rule is; slide is not).
- Fix task size: fits one session.

### A1-U17-5 — airborne `altAGL` is measured against the take-off ground height
- Severity: S2     Confidence: confirmed
- Category: engine (telemetry shown on the HUD: `play/ui/Hud.tsx:36`)
- Location: `astronautKCC.ts:1088–1092` (`_hCur` is only refreshed when grounded) @ 810b032
- Claim: `altAGL` = altitude above ground level.
- Evidence: section D, 60 sprint jumps on the Moon. |reported − true AGL| max per jump: **p50 6.3 m, p90 27.9 m,
  max 56.2 m**. **3,851 ticks report a negative AGL while the character is more than 0.2 m above the ground.**
  Above `R + maxTerrainHeight + 64` the formula switches to `altMSL − maxTerrainHeight`, which is a different
  quantity (a jump in the reading at that radius).
- Impact: the HUD shows wrong heights in the air; any future gameplay (fall damage, landing warnings,
  jetpack AI) reading `altAGL` gets a number that can be off by tens of metres or below zero.
- Proposed fix: sample `terrainHeight` under the planet-frame position in `_fillTelemetry` when airborne
  (one call per tick; the zero-GC path already does it in `_sweep`).
- Fix task size: small; fits one session with other telemetry fixes.

### A1-U17-6 — the landing plant drops strafe and plants a velocity that is not tangent
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:1005–1015` (`_vCtl = fwd·inF·speed`, computed with the pre-landing `fwd`, before
  `_refreshUpFwd` at 1019) @ 810b032
- Claim (Spec M1E line 51): tangential velocity is "planted (vWalk = input target)". The input target is
  `fwd·inF + right·inR` (line 556).
- Evidence: section E, Moon, auto-turn off. Forward input keeps 3.2 m/s on the landing tick (control). **Pure
  strafe: 3.2 → 0 m/s on the landing tick, 21 ticks (0.35 s) to recover 90 %. Diagonal: 3.20 → 2.26 m/s.** On
  20–35° sites, the planted vCtl has |vCtl·up|/|vCtl| = 0.30 — 30 % of it points along the new `up`.
- Impact: strafing players stop dead on every landing. The planted vector is built in the airborne frame, so
  part of the first grounded move points into or out of the ground (the step rule then re-projects it).
- Proposed fix: plant the same `_vDes` the grounded tick builds (fwd·inF + right·inR, ·speed), after
  `_refreshUpFwd`.
- Fix task size: small; fits one session (with A1-U17-3).

### A1-U17-7 — the landing's "kill the normal component" step is dead code; the comment says the opposite of the code
- Severity: S3     Confidence: confirmed (code citation)
- Category: doc / engine
- Location: `astronautKCC.ts:994–1004` @ 810b032
- Evidence: `_rel` is computed, `lastLandingRelSpeed` is taken from it (line 990), then the normal component is
  removed from `_rel` (lines 997–1000), and `_rel` is never read again. The comment at 1005 says "Keep the landing
  tangential momentum only along the input intent", but no landing momentum is kept: vCtl is overwritten with the
  input target and vSlide with 0.
- Impact: a reader believes momentum is conserved on landing. Spec M1E wants "never skate", which the code does,
  so behaviour is per spec; the dead lines and the comment are misleading.
- Proposed fix: delete lines 994–1000 or use them (e.g. carry landing momentum into vSlide on steep landings, if
  the Lead wants that feel). Fix comment.
- Fix task size: trivial.

### A1-U17-8 — `cliff` is computed and never read (`void cliff`)
- Severity: S3     Confidence: confirmed (code citation)
- Category: engine
- Location: `astronautKCC.ts:618, 632–636, 701` @ 810b032
- Evidence: `cliff` is set only when `!moved && !this._grounded`. But the cliff path in `_tryMove` returns true,
  so `moved` is true and that branch cannot be reached with a cliff. `void cliff` silences the linter.
- Impact: none at runtime; the comment at 633–635 describes a path that does not exist.
- Proposed fix: delete the variable and the comment.
- Fix task size: trivial.

### A1-U17-9 — the plan's "C¹ speed cap (RATIFIED)" is not in the KCC
- Severity: S3     Confidence: confirmed (grep)
- Category: doc
- Location: `docs/A1-plan.md` U17 line; `grep -rn "C¹" src` → only `aerodynamics.ts:41/105` and
  `flightController.ts:18/445` @ 810b032
- Evidence: the KCC applies no speed cap in any mode. A falling or RCS-driven astronaut has no cap; only the
  flight controller fades thrust toward 2,000 m/s.
- Impact: none for play; the audit coverage must check the cap in U18 instead.
- Proposed fix: U18 covers the C¹ cap (seeded below).
- Fix task size: n/a.

## Checked, no issue
- **Ballistics:** Moon flight time 4.98–5.52 s vs RK4 within 0.039 s; apex 0.04 m low = the semi-implicit Euler
  bias u·dt/2 = 0.035 m (control ok). No energy drift in a single arc that matters for play.
- **Airborne frame continuity (Ω = 0):** max per-tick up change 0.21° in the air; zero-G at Ω = 0 holds up
  exactly radial (1.8e-15°).
- **Jump launch compose (F18):** the launch at θ_prev and the first sweep work; the θ0 = 0 jump lands with no
  false landing (84 ticks, as U16 off-wrap).
- **Forward landing plant:** speed kept (3.2 → 3.2 m/s), so "no skating" and "input takes over" hold for moveF.
- **Vehicle compose at rest:** pLocal error ≤ 1.9e-12 m over 151 s; V = parentVel + ω×(P − parentPos) is the
  correct rigid-body formula.
- **Mode hysteresis / detach:** detach picks ZERO-G below 0.05 m/s², consistent with lines 482–490.
- **RCS budget:** decremented by a·|input| per tick and clamped at 0; regen only when planted.
- **Sweep band vs U14-2:** the early-out uses `cfg.maxTerrainHeight`, so it inherits U14-2 (hand-typed bound);
  no new finding — U14-2's fix (derive the bound from params) fixes the sweep too.
- **Zero-GC:** part 2 writes only module scratch and owned fields; no `new`, closures or array literals in
  `_flightTick`, `_sweep`, `_landAt`, `_vehicleTick`, `_fillTelemetry` (read; U14-5 covers the terrain calls).

## Commands and exit codes
| Command (from `game/`) | Exit |
|---|---|
| `npm ci` | CI_EXIT=0 |
| `node tools/audit/u17-kcc-part2.mjs` (run 1) | PROBE_EXIT=0, controls 3/5 — two controls were wrong, see below |
| `node tools/audit/u17-kcc-part2.mjs` (run 2, controls fixed) | PROBE_EXIT=0, controls 5/5 |
| `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | empty (read-only held) |

Control fixes between runs (recorded, not hidden): (1) "zero-G at θ0 = 0 holds radial" was not a valid control
with Ω ≠ 0 — the planet turns 6° in 10 s — so it is now Ω = 0. (2) "flight time within 2 ticks" was too tight for
0–2° sites (one jump landed 0.039 s off on a sloped spot); replaced by the integrator-bias bound on the apex,
which is what semi-implicit Euler predicts. Neither change affects a finding.

## Seeds for later units
- **U18:** the C¹ thrust fade (A1-U17-9); check whether flightController has the same world/planet frame mix as
  A1-U17-1 (it composes with the spin too).
- **U23/U24:** does the camera or character rig smooth the landing snap (A1-U17-3)? Does the HUD use `altAGL`
  (A1-U17-5: yes, `Hud.tsx:36`)?
- **U26:** A1-U17-1/2 plus U13-1 say the frame model needs one written convention (planet vs world vs parent),
  enforced in one compose layer.

## Questions for the Lead (look and feel only)
1. **Landing on a slope.** When you land on a hillside, should the astronaut lean into the hill smoothly, or stay
   upright? *Suggested default: lean smoothly over about a quarter of a second; never snap.*
2. **Sliding.** When a slide reaches gentler ground, should it slow down gradually (like real sliding on dust),
   or stop almost at once (more control)? *Suggested default: slow down gradually over about one second.*