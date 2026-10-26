# A1-U16 — astronautKCC part 1 (config, ground probe, step/slope rule, sweep)

- Unit: U16 (`docs/A1-plan.md` §5 Phase C) · Session 71 · 2026-10-23 · auditor: PromptQL bot (VM v2, 2 vCPU / 4 GB)
- Read in full: `game/src/core/physics/astronautKCC.ts` lines 1–560 (header, config, state, setup API,
  `update()` governor, `integrateTick()`, the start of `_groundedTick()`). I also read the helpers that
  part 1 calls, because they decide the step rule and the ground probe: `_groundedTick` 560–700, `_tryMove`
  706–749, `_wallDirFromTarget` 752–771, `_refreshUpFwd` 774–786, `_composeGrounded` 790–804, `_sweep` 894–968
  and `_landAt` 970–1026. Config consumer: `game/src/play/world/moonConfig.ts` (`MOON_ASTRONAUT`).
- Spec grep: the Milestone 1E STEP RULE passage (lines 205–229) is the code header verbatim, so there is no
  spec/code conflict. The defects below are in how the code feeds the rule, not in what the rule says.
- Probes (new, read-only): `game/tools/audit/u16-kcc-step-rule.mjs` (controls 5/5) and
  `game/tools/audit/u16b-kcc-wrap-nan-blocked.mjs` (controls 2/2). Both import the REAL KCC and terrain. Every
  reference is written inside the probe:
  - The true slope is a great-circle central-difference gradient of the height field. U14 found the heights,
    seams and determinism clean.
  - The true AGL is taken at the true spin phase.
  - The KCC's own normal and ratio are never used as truth.
- Commit audited: `488b7b3` (HEAD at session start; `git diff 256d77d -- game/src …` empty).

## Claims written before reading the code
1. The RATIFIED step/slope rule: a move climbs iff Δh ≤ stepHeight AND Δh/arc ≤ tan(maxWalkSlope), where arc is
   the horizontal (tangent-plane) distance. So no uphill move steeper than 50° is ever accepted, at any speed.
2. The rule is invariant to speed (header), and both clauses can bind (otherwise the dual rule is redundant).
3. Grounded velocity: V = Ω×P + R(θ)·v_rel, where v_rel is the velocity the character actually moves with.
4. Sweep: samples the terrain at the spin phase interpolated across the tick, θ(s) = θ0 + Ω·dt·s. It never lands
   when the body is clear of the ground, never misses a contact, and never ends below the surface.
5. NaN guard (Spec 00.2 "nothing may NaN"): one bad tick is rolled back, and the controller keeps working.
6. Jump: a 4.2 m/s launch is a vertical hop (game feel), and its direction comes from a reliable normal.
7. Config sanity: μ = g·R², the mode hysteresis band is consistent, and the slide and walk angles agree.

## Findings

### A1-U16-1 — the ratified 50° walk limit is really ≈ 56–59° (ratio measured along the tilted `fwd`)
- Severity: S1     Confidence: confirmed
- Category: engine (RATIFIED item: the KCC step/slope rule)
- Location: `astronautKCC.ts:738–739` (ratio clause), `_groundedTick` move `d = (vCtl+vSlide)·dt`, `:774–786`
  (`_refreshUpFwd`: up = norm(0.65·n + 0.35·r̂), fwd ⊥ up) @ 488b7b3
- Claim: "a move climbs iff … Δh/arc ≤ tan(maxWalkSlope)" (header; Milestone 1E 223–229), with maxWalkSlopeDeg
  50 in both `EARTHSCALE_ASTRONAUT` and `MOON_ASTRONAUT`.
- Evidence: `arc` is |d|, and d lies along `fwd`. `fwd` is perpendicular to the blended up, so on a slope θ it
  tilts up out of the horizontal plane by α:
  - tan α = w·sin θ / ((1−w) + w·cos θ), with w = upBlendWeight 0.65. At 45°, α = 29.6°.
  - `_tryMove` re-projects the target onto the surface, so only |d|·cos α of the move is horizontal.
  - The clause therefore tests tan θ·cos α ≤ tan 50°. Analytic true limit: **56.3°** (w 0.65) vs 50.0° (w 0).

  `node tools/audit/u16-kcc-step-rule.mjs` → exit 0, controls 5/5. It tests 3,000 play-Moon spots with true
  slope 35–80°, using the real `_tryMove` at crouch, walk and sprint:
  - Walk acceptance by true secant: 50–52.5° 156/158; 52.5–55° 156/171; 55–57.5° 54/148; 57.5–60° 1/124;
    ≥ 60° 0/1,258.
  - Max accepted true secant: crouch 58.66°, walk 58.78°, sprint 59.01°.
  - Mutant control (w = 0, same spots): max 50.00 / 50.00 / 49.92°, and 0 accepted above 50°.

  So the rule is right and its input is wrong. The measured α matches the model (median error 0.33°). The worst
  outliers are where the code's ε-normal is off (U14-1).
- Impact: the player walks straight up 50–59° faces that the design says should block them. Climbable terrain is
  silently wider than the ratified value, and it depends on upBlendWeight, which is a visual tuning knob. Every
  gate and every T1 tuning that assumes "50° blocks" is mis-calibrated. The same band is also the slide band
  (U16-7), so the character slides and climbs at once.
- Proposed fix: compute the ratio against the horizontal distance, arc_h = angle(d̂_start, d̂_target)·(R + h),
  or project d onto the plane ⊥ r̂ before the clause. This is one line in `_tryMove`. It touches the RATIFIED
  step rule (meaning kept, implementation corrected), so it needs an ADR in the fix task. Then re-run m1e (slope
  rows) and test-play-*.
- Fix task size: one session (fix + ADR + m1e/play regression).

### A1-U16-2 — on the spin-phase wrap tick the sweep samples a whole turn — 66 % false landings
- Severity: S1     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:452` (`_theta = (θ + ω·dt) % 2π`), `:936` (`dTheta = (_theta − _thetaPrev)/steps`),
  `:945` (bisection θ interpolation) @ 488b7b3
- Claim: the sweep uses "SPIN-INTERPOLATED sample transforms θ(s) = θ0 + Ω·dt·s" (header).
- Evidence: on the tick where θ wraps, `_theta − _thetaPrev` = **−6.283 rad** instead of ω·dt = 1.733e-4 rad,
  so the samples sweep the terrain through almost a full turn. `node tools/audit/u16b-kcc-wrap-nan-blocked.mjs`
  → exit 0. Setup: EARTHSCALE (ω 0.0104) on TEST_PLANET, with a body 5 m above the terrain and at rest in the
  rotating frame.
  - Wrap tick: **1,971/3,000** false landings (the body is teleported onto distant terrain).
  - Control at θ = 1: 0/3,000 false landings.
  - Missed contacts: 0/3,000 (0.3 m up, −30 m/s), with no end position below the true surface.
- Impact: once per sidereal day, an airborne character within maxTerrainHeight of the ground is snapped to the
  wrong terrain. That is 604 s at EARTHSCALE, or 12,566 s at the m1f harness ω of 0.0005 (`moonConfig.ts` Q8
  comment). The result is a visible teleport or stop. T1 play is not affected today (ω = 0), but the bug
  appears as soon as bodies really spin, which the goal requires (§13: every body rotates).
- Proposed fix: interpolate with the unwrapped increment, θ(s) = _thetaPrev + ω·dt·s, in both the loop and the
  bisection. `_landAt`'s caller already does this for the landing phase. A few lines; not ratified.
- Fix task size: tiny (bundle with U16-4 or the U17 fixes).

### A1-U16-3 — grounded velocity is the commanded velocity, not the realised motion
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `_groundedTick` final `_composeGrounded(vCtl + vSlide)`, `_tryMove` cliff path (~720), jump compose
  (589–602) @ 488b7b3
- Claim: V = Ω×P + R(θ)·v_rel, where v_rel is the relative walking velocity (Spec 01.4).
- Evidence: the displacement is re-projected onto the surface, but the velocity keeps the unprojected vCtl along
  the tilted `fwd`. From `u16-kcc-step-rule.mjs`, uphill on 40–50° true slopes:
  - Angle between velocity and displacement: median **16.4°**, max **73.1°**.
  - Surface path / commanded speed: median 1.24, max 1.53. Downhill: median 1.24, range 0.93–1.53.
  - Control (w = 0): angle 44.6°, path ratio 1.41. That is the plain 1/cos θ re-projection with no tilt to
    compensate.

  Blocked case (`u16b` P3, n = 1): against a 62–85° face the reported |absVel| is 2.62 m/s while the position
  does not move, and the jump launches with 1.96 m/s horizontal. Only one sample was blocked (the other steep
  spots wall-slide or slide), so this part is weak evidence.
- Impact: the written-through entity velocity (`update()` → `_wtVel`) disagrees with the actual motion. That
  feeds animation speed and the camera, and cliff and jump launches hand off to inertial flight with a velocity
  off the real path. On slopes the character covers about 24 % more ground than its set speed.
- Proposed fix: decide the move in the tangent plane, then compose V from the realised (p_new − p_old)/dt (or
  from the projected move), and zero it when blocked. Not ratified.
- Fix task size: one session, together with U16-1 (same code path).

### A1-U16-4 — the NaN guard rolls back the pose but keeps the NaN velocity, so the controller stays dead
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `astronautKCC.ts:491–515` (the guard restores absPos/absVel/pLocal/up/fwd only); input axes used
  unsanitised in `_groundedTick` @ 488b7b3
- Claim: "NaN guard (Spec 00.2: nothing may NaN)", i.e. a bad tick is recovered.
- Evidence (`u16b` P2, play Moon): one tick with `moveF = NaN`, then 300 valid ticks.
  - nanEvents goes from 1 to **301**, `_vCtl` = (NaN, NaN, NaN), and telemetry.relSpeed is NaN.
  - Displacement over the 5 s of valid input: **0 m**.
  - Only `teleportSurface` recovers it (2.74 m covered in the next 1 s).

  The guard never snapshots `_vCtl`, `_vSlide`, `_theta`, `_nCur` or `_hCur`.
- Impact: one non-finite input freezes the player permanently, while telemetry reports NaN on every tick.
  Sources include a gamepad axis, a divide-by-zero in the play layer, or a NaN look delta. Keyboard input alone
  cannot trigger it.
- Proposed fix: snapshot and restore the full private state (or reset vCtl/vSlide to 0 on a NaN event), and
  sanitise the input axes at the top of the tick. Not ratified.
- Fix task size: tiny.

### A1-U16-5 — jump launches along the cached terrain normal — up to 4.1 m/s sideways, from a wrong ε-normal
- Severity: S2     Confidence: confirmed
- Category: engine / gameplay
- Location: `astronautKCC.ts:589–592` (`_vT = vCtl + vSlide + n·jumpSpeed`, n = `_nCur`) @ 488b7b3
- Claim: "JUMP — along the surface normal".
- Evidence (`u16-kcc-step-rule.mjs`, 3,000 spots at 35–80°):
  - Horizontal kick: p50 **3.39** m/s, p90 4.04, max 4.14, out of a jumpSpeed of 4.2.
  - Launch direction vs the true normal: p50 2.9°, p90 16.9°, p99 **72.6°**. This error comes from U14-1: the
    fixed-ε normal is wrong on the Moon.
- Impact: on slopes a jump is mostly a sideways shove downhill, and where the ε-normal is wrong its direction
  is partly random. Whether a jump should push away from the slope is a gameplay choice (question below). That
  it follows a wrong normal is a defect either way.
- Proposed fix: after the Lead's answer, launch along the radial (or blended) up, and use the corrected normal
  once U14-1 is fixed. Not ratified.
- Fix task size: tiny.

### A1-U16-6 — the stepHeight clause never binds — the "dual" rule is the ratio rule alone
- Severity: S3     Confidence: confirmed
- Category: engine / doc
- Location: `astronautKCC.ts:739` @ 488b7b3; header lines 28–30
- Claim: "climbs iff Δh ≤ stepHeight AND Δh/arc ≤ tan(maxWalkSlope)".
- Evidence: per tick, Δh is capped at tan 50°·v·dt, which at sprint (6.5 m/s) is 0.129 m. The measured max
  accepted Δh is 0.129 m (w 0.65) and 0.1287 m (w 0). stepHeight 0.5 would only bind at arc ≥ 0.42 m per tick,
  i.e. ≥ 25 m/s. The header's speed-invariance claim does hold: crouch, walk and sprint disagree on only 24 of
  3,000 spots, all at the threshold.
- Impact: there are no "steps". A 0.3 m kerb steeper than 59° blocks the player, even though stepHeight says
  they can step up 0.5 m. stepHeight is a dead parameter.
- Proposed fix: decide whether step-ups exist (gameplay). If they do, test the step clause over a lookahead of
  about one body width rather than per tick; if not, drop the parameter. RATIFIED item → ADR.
- Fix task size: one session (with U16-1 or separate).

### A1-U16-7 — slideAngle 45° < maxWalkSlope 50°: the character climbs while it slides
- Severity: S3     Confidence: confirmed
- Category: engine (config)
- Location: `astronautKCC.ts:131–132`, `moonConfig.ts:37`, and `astronautKCC.ts:571` (slide gate on the cached
  ε-normal) @ 488b7b3
- Claim: "Slopes above this slide (mu_s = tan(slideAngle))" and "Slopes above this are blocked for climbing".
- Evidence: accepted walk climbs on spots whose code slope is above 45°: **621/1,505** (w 0.65) and 259/1,134
  (w 0). Both configs use 50/45, so the 45–50° band both slides and climbs; because of U16-1 the real band is
  45–59°. The slide gate also reads the ε-normal (U14-1).
- Impact: on 45–59° slopes the player walks up while being dragged down, which reads as unclear "slippery but
  climbable" movement.
- Proposed fix: after the Lead's answer, make the bands disjoint (slide ≥ walk limit, or walk limit = slide
  angle). This is a config change, but to the ratified rule → ADR.
- Fix task size: tiny (with U16-1).

## Checked, no issue
- μ = g·R² in both configs (245,250,000 = 9.81·5000²; MOON_MU = 1.62·R²). `gravityInto` = −μ/r²·fade, and
  `rangeFade` is a smoothstep over 0.75–1.0 of range.
- The 0.05 / 0.15 m/s² mode hysteresis is applied consistently in `teleportAbs`, `detachVehicle` and the tick.
- The header's "0.87 m/tick at the equator" checks out: 5000·0.0104/60 = 0.867.
- `teleportSurface` anchors at R + h + groundClearance.
- Flat walks are accepted, and on flat ground the code ratio equals the true secant (control).
- The exponential control response is exact and frame-rate independent.
- The step rule is speed invariant (see U16-6).
- Off the wrap tick the sweep is clean: 0/3,000 false landings, 0/3,000 missed contacts (0.3 m up, −30 m/s),
  and 0 end positions below the true surface.
- F14: the jump input is consumed after the tick acts (one fire per press).
- F18: the launch composes P and V at θ_prev.
- `_landAt` removes only the inward normal velocity and plants vCtl according to the input.
- Look deltas are applied once per `update()` as finite rotations (no Euler), and the ZERO-G
  re-orthogonalisation is fine.
- Cube-face tracking (dominant axis) and the governor (≤ 5 substeps, 0.25 s clamp, shed) match U13.

## Seeds for U17 (lines 560–1114)
- `_landAt` plants `vCtl = fwd·inF·speed` only, so moveR (strafe) is dropped on the landing tick.
- Slide: check the kinetic-friction direction and stopping, and whether vSlide ever stops in the 45–50° band.
- `_sweep` early-out band is R + maxTerrainHeight + 2·gap. Against U14-2 (the STEEP field reaches 2,216 m vs
  900), terrain above the band is never probed.
- The cliff path composes the commanded velocity (U16-3); `void cliff` is dead code.
- Check `_flightTick`'s airborne up τ and the U15-1 transport sites 338/415/782/859.

## Commands and exit codes
| Command (from `game/`) | Exit |
|---|---|
| `npm ci` | CI_EXIT=0 |
| `node tools/audit/u16-kcc-step-rule.mjs` | PROBE_EXIT=0 (controls 5/5) |
| `node tools/audit/u16b-kcc-wrap-nan-blocked.mjs` | PROBE_EXIT=0 (controls 2/2) |
| `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | empty, 0 bytes (read-only held) |

## Questions for the Lead (look and feel only)
1. **Jumping on a slope.** When you jump while standing on a hillside, should you jump straight up (as in most
   games), or get pushed away from the hill? *Suggested default: straight up, with a small push away only on
   very steep ground.*
2. **Steep slopes.** Should there be one clear angle where a slope becomes "too steep: you slide down and cannot
   walk up"? Today there is a 45–59° zone where you slowly walk up while sliding. *Suggested default: one clear
   angle (about 45° on the Moon). Below it you walk normally; above it you slide and cannot climb.*