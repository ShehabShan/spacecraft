# A1-U15 — Spherical frame + impostor math

- Unit: U15 · Session 70 · 2026-10-23 · audited at `34f2c41` · read-only (AGENT_BRIEF §11)
- Files read in full: `game/src/core/physics/sphericalFrame.ts` (249), `game/src/core/render/impostorMath.ts` (171).
- Callers read: `astronautKCC.ts` 310–420, 770–800, 850–870; `render/SkyImpostorPool.ts` 30–110, 155–175, 240–300; `play/world/skyState.ts` 24–100; `play/frame/playFrame.ts` 100–125; `play/camera/ThirdPersonCamera.ts` (heading/transport); `render/MultiCameraRig.tsx` planes.
- Probes (both import the REAL core; every reference is written here from first principles):
  - `node tools/audit/u15-frame-impostor.mjs` → PROBE_EXIT=0, controls 5/5, 2.6 s.
  - `node tools/audit/u15b-occlusion-flip.mjs` → PROBE_EXIT=0.
- Read-only check: `git diff --stat 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` printed nothing, DIFF_EXIT=0.

## Claims written before reading the code
1. Parallel transport of a heading along a path on a curved surface means rotating `fwd` by the minimal rotation that takes `up_old` to `up_new`. That map is an isometry of the frame and is exactly reversible: any up path that returns to its start leaves the heading as it was, plus the holonomy of the closed loop (which is zero for a loop with no enclosed area).
2. A flat quad at distance D subtends a half-angle θ along its own normal only when `s = D·tanθ` **and** the quad is perpendicular to the line of sight to its centre.
3. A disk is hidden behind the horizon only when its top is below the *real* horizon. Seen from an eye at height h on a sphere of radius R, that horizon dips by `acos(R/(R+h))` below the radial plane. Terrain can raise it or lower it.
4. Painter-style occlusion by "staged distance" needs the depth written at each pixel to keep the rank order over the whole sky.

## Findings

### A1-U15-1 — "Parallel transport" is Gram-Schmidt projection: not reversible, so up jitter turns into heading drift
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `game/src/core/physics/sphericalFrame.ts:71–90` @ 34f2c41. Called from `astronautKCC.ts:338, 415, 782 (_refreshUpFwd), 859`. `play/camera/ThirdPersonCamera.ts:160–175` (`transport`) uses the same projection on the camera heading.
- Claim: the header (lines 9–13) and Spec 01.4 say this is parallel transport of the character frame.
- Evidence (u15-frame-impostor T1, u15b flip):
  - **Round trip u1→u2→u1, tilt axis 45° from fwd.** The heading change after 1 / 10 / 100 / 1000 cycles:

    | Tilt δ | 1 cycle | 10 cycles | 100 cycles | 1000 cycles |
    |---|---|---|---|---|
    | 1° | 0.0087° | 0.087° | 0.87° | 8.6° |
    | 3.2° (U14-1 normal p50) | 0.089° | 0.89° | 8.8° | 42° |
    | 7.6° | 0.51° | 5.0° | 35° | 45° (converges to the tilt axis) |
    | 37° (U14-3 flip) | 12.5° | 44° | — | — |

    The reference minimal-rotation transport returns to within 1.7e-12° after 1000 cycles.
  - **With the KCC up blend (`upBlendWeight` 0.65).** A raw-normal flip of 10° / 20° / 37° becomes a blended up jump of 6.5° / 13.0° / 24.1°, and each flip-and-return turns the heading by −0.37° / −1.49° / −5.18°.
  - **1 km walk on the play Moon** (12 random sites, 3.2 m/s at 60 Hz, up = KCC blend). Projection and minimal rotation end a median 429 m apart (max 1,312 m). The path leaves the start great circle in both cases (cross-track median 264 m vs 422 m), because the terrain-following up bends it. The transport method alone moves the endpoint by hundreds of metres.
- Impact: walking with no input over rough ground (where the up jitters frame to frame, U14-1/-3) slowly turns the character and the camera heading toward the local tilt axis. "Walk straight" is not straight, and the result depends on the frame rate and on normal noise. It is not a singularity: the canonical fallback is fine.
- Proposed fix: transport `fwd` with the minimal rotation `up_old → up_new` (Rodrigues about `up_old × up_new`, which is already in this file), then re-project only to remove rounding. The callers already hold the old up in `this.up` before overwriting it. Apply the same change in `ThirdPersonCamera.transport`. Not a RATIFIED item.
- Fix task size: 1 session (core function + 5 call sites + a reversibility test).

### A1-U15-2 — Below-horizon cull uses a fixed 0.03 rad allowance, smaller than the eye-height dip on the play Moon
- Severity: S2     Confidence: confirmed
- Category: engine / play
- Location: `impostorMath.ts:118–126` (`fullyBelowHorizon`); call sites `play/world/skyState.ts:80–81` and `test/Milestone1F_TestHarness.tsx:828–829`. Both pass `terrainRoughnessRad = 0.03` with the elevation measured against the radial plane at the observer.
- Claim: "Conservative below-horizon cull" (line 119).
- Evidence (u15 I1):
  - **Smooth-sphere dip on the play Moon** (R 1,364.5 m): 0.0487 rad at eye height 1.62 m, 0.0855 rad at 5 m, 0.170 rad at 20 m (a boomed third-person camera). All are larger than 0.03.
  - **Real terrain horizon** (10 sites × 180 azimuths, eye 1.62 m above ground): below −0.03 rad on 63/1800 azimuths (per site 4, 6, 14, 0, 4, 0, 32, 0, 0, 3), lowest −0.195 rad.
  - `fullyBelowHorizon(-0.045, 0.002, 0.03)` = true. A body that is above the smooth horizon is culled.
- Impact: Sun, Earth and planets vanish while their disk still sits above the visible horizon. They pop out instead of setting behind the terrain, and earlier when the camera is high. The allowance is not conservative on a small body, so the cull is a correctness bug, not just an optimisation. Related to the "Sun culled at suite pose" history (U01/U03, M1F §15).
- Proposed fix: allowance = `acos(R/(R+h_eye))` + roughness (or the per-azimuth terrain horizon). Or drop the cull and let the terrain depth occlude the impostor, as the passes already allow.
- Fix task size: 1 session.

### A1-U15-3 — Camera-facing impostor quads break the tan law off-axis: big bodies are squashed up to ~31 %
- Severity: S1     Confidence: confirmed
- Category: engine (render)
- Location: `render/SkyImpostorPool.ts:268–279`. Every instance is composed with the same camera quaternion `_q`. `impostorMath.ts:9–18` says the quad "subtends EXACTLY 2θ".
- Claim: `s = D·tanθ` makes the impostor subtend exactly 2θ on screen.
- Evidence (u15 I2): a disk of θ = 3.68° (Earth seen from the Moon is 7.39° in the play sky, I7), 62° vertical FOV, 1920×1080, centre β off the view axis.

  | Centre off-axis β | Radial angular extent / θ | Screen width, impostor / true sphere | Tangential extent |
  |---|---|---|---|
  | 0° | 1 | 1 | exact |
  | 15° | 0.966 | 0.966 | exact |
  | 30° | 0.867 | 0.865 | exact |
  | 40° | 0.768 | 0.764 | exact |
  | 46° | 0.697 | 0.692 | exact |

  The screen corner is at 50.8° off-axis. The m1f R2 row checks `atan(halfSize/stageD)` against the same formula (harness 1103–1105; U02), so it cannot see this.
- Impact: Earth, the Sun (2.0°) and the gas giants turn into ellipses that squash as they move toward the screen edge, and stretch back as the camera turns. This is visible in play and works against "looks real" (§13).
- Proposed fix: orient each instance perpendicular to its own direction (per-instance basis built from `dir`), keeping `s = D·tanθ`. That makes the cone ∩ plane an exact circle for every β. The camera bands and the hysteresis (RATIFIED) are untouched.
- Fix task size: 1 session (pool matrix compose + an off-axis angular test that does not reuse the formula).

### A1-U15-4 — Staged-rank occlusion inverts off-axis: a far body is drawn over a near one
- Severity: S1     Confidence: confirmed (camera-facing case, probed); derived (perpendicular-quad case)
- Category: engine (render)
- Location: `impostorMath.ts:20–24, 84–87` (45 m rank gap); `SkyImpostorPool.ts:165–168` (`depthWrite: true`, opaque, alpha-to-coverage) + `:252` (sort by true distance).
- Claim: "Staggering by true-distance rank sorts mutual occlusion with ≥45 m gaps against ~1 cm of Background depth resolution."
- Evidence (u15 I3, u15b):
  - A camera-facing quad writes view depth `D·cosβ`, not D. With ranks 9,600 m and 9,555 m, the far body wins wherever its centre is farther off-axis than the near one by more than `(ΔD/D)/tanβ`: 1.52° at β = 10°, 0.74° at 20°, 0.47° at 30°, 0.27° at 45°.
  - Near disk at 30° and far disk at 31°: nearZ 8,274.9 m, farZ 8,228.8 m, so the far disk is in front. The 20°/21° and 10°/11.6° cases invert as well.
  - The 1 cm depth-resolution figure is right (`depthResolution(9600, 500, 10000)` = 0.0104 m, ratio 4,312), but the cosβ term is many orders of magnitude larger.
  - With perpendicular quads (the U15-3 fix), the near quad's ray depth at its limb is `Dn/cos α`. That passes the far rank's 9,600 m once α > `acos(9555/9600)` = 5.55°, and Earth from the Moon is 7.39°. So the U15-3 fix alone does not cure this.
- Impact: the Sun or a planet can show through Earth near the screen edges, or through Earth's limb, depending on the camera yaw. That is wrong-looking sky in play.
- Proposed fix: impostors are already sorted far-to-near, so draw them in that order with `depthTest` against each other off (painter's order). Alternatively, use a rank gap larger than `D·(1/cos θ_max − 1)` (≈ 80 m at 7.4°) together with per-instance orientation. Ship with an off-axis overlap test.
- Fix task size: 1 session (can share a session with U15-3).

### A1-U15-5 — Unclamped tan law and singular inputs
- Severity: S3     Confidence: confirmed
- Category: engine
- Location: `impostorMath.ts:72–81, 63, 67`; `skyState.ts:96` (glow `thetaEdge(θ·2.4)`); `sphericalFrame.ts:225–236, 57–68`.
- Evidence (u15 I7):
  - `thetaEdge` reaches π/2 at θ = 1.4786 rad. `quadHalfSize(9600, thetaEdge(1.5))` = −422,770, a negative and inverted quad.
  - The Sun glow breaks at θ ≥ 0.616 rad.
  - `bodyGeometryInto` returns θ = π/2 inside or at a body.
  - `gravityInto` at r = 0 returns NaN, NaN, NaN, and `canonicalTangentInto(0, 0, 0)` returns NaN.
- Impact: unreachable while the sky is frozen and bodies are far (max θ 7.4°). It becomes reachable once planets are reachable (U10b ruling) and bodies are approached through the impostor path before the mesh handoff.
- Proposed fix: clamp θ_e below π/2 and require the mesh handoff before θ grows large; guard r = 0.
- Fix task size: part of the U15-3/4 session.

### A1-U15-6 — Header numbers and wording are wrong
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `impostorMath.ts:17–18`; `sphericalFrame.ts:9–13, 19–20`.
- Evidence (u15 I5):
  - "s = D·sinθ undersizes by 1/cosθ — 34% at 45°". The real figures at 45° are 29.3 % undersize (1 − sin/tan), or a factor of 1.414 (41.4 %). 34 % matches neither.
  - "up derives from the C1 analytic normal field": up is a 0.65/0.35 blend of a finite-difference ε normal (U14-1, not C1-accurate) with radial.
  - "Parallel transport" names a projection (U15-1).
- Proposed fix: correct the comments in the U15-1/U15-3 fix tasks.

## Checked, no issue
- `spinQuatInto` + `transportVelocityInto`: v = Ω×p matches the finite-difference derivative of the spin rotation (< 1e-4); the equator check is exactly 52 m/s.
- `quatFromFrameInto` on orthonormal frames: X→fwd, Y→up, unit norm, worst error 6.1e-15 over 20,000 random frames; the basis is right-handed (Z = fwd × up).
- `canonicalTangentInto` is perpendicular to up (200,000 samples); the |u×ref| ≥ √(2/3) = 0.816 bound is correct.
- Rodrigues (`rotateAboutAxisInto`), Hamilton product, `rotateByQuatInto` / `rotateByQuatConjInto`: checked by hand and used by the controls.
- `bodyGeometryInto` θ = asin(R/d); `elevationAngle` clamping; `signedAngleAbout` atan2 form.
- `diskFractionAboveHorizon` stays within its stated θ²/8 flat-sky bound: worst absolute error 2.8e-4 = 0.50 of the bound for θ ≤ 8°, against a Monte-Carlo spherical cap.
- `depthResolution` formula and the 1 cm figure at 9,600 m with `BG_PLANES` [500, 10,000].
- `projectDirectionInto` on-axis; `stagedDistanceForRank` ordering; the tan law itself on the view axis.
- Purity: `impostorMath` imports only `sphericalFrame`; `sphericalFrame` imports nothing. Zero allocation by reading (out-params plus the module scratch `_pv`).

Not checked: `quatFromFrameInto` with non-orthonormal input; the impostor fragment shader limb/AA model; the glow sprite's look.

## Seeds for later units
- U16/U17: `fwd` transport call sites 338, 415, 782, 859. The old up is available at each one, so the U15-1 fix is local. Check whether `_refreshUpFwd`'s per-tick up jitter is filtered anywhere.
- U21: impostor orientation (U15-3), rank depth (U15-4) and the cull (U15-2) are all in `SkyImpostorPool`/`skyState`. The R2 row is blind to U15-3.
- U23: `ThirdPersonCamera.transport` uses the same projection.
- U26: the sky stack needs per-body orientation, painter's order and a real horizon test before planets become reachable.