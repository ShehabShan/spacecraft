# A1-U21 — Camera rig + sky impostors

- Unit: A1-U21 (`docs/A1-plan.md` §5 Phase D) · Session 78 · 2026-10-25 · base commit 39a8ad2
- Files read in full: `game/src/render/MultiCameraRig.tsx` (217), `game/src/render/SkyImpostorPool.ts` (326),
  `game/src/play/world/skyState.ts` (127, the play port of the harness sky state).
  Also read: `game/src/core/render/impostorMath.ts` exports, `Milestone1F_TestHarness.tsx` 604–645 and 836–880
  (handoff state machine + probe fade), Milestone 1F grep (lines 4, 26, 42, 45, 55, 73).
- Probe: `game/tools/audit/u21-camera-sky.mjs`, plus `game/tools/audit/u21-tsx-loader.mjs` (a Node loader that
  transpiles the real `.tsx` with the repo's esbuild and stubs react / R3F, because the probe calls only the pure
  exports). Output: `pre-t4:docs/audit/U21-probe-output.txt`.
  - Command: `cd game && node --expose-gc tools/audit/u21-camera-sky.mjs` → **PROBE_EXIT=0**, controls 4/4.
- Read-only check: `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` is empty (see commit VERIFIED).

## Claims written before probing
1. Spec 04.1 loop: clear colour+depth once → Far → clearDepth → Mid → clearDepth → Near, all three cameras co-located.
2. Milestone 1F l.45: "inter-band ordering is a painter's algorithm *by construction* … no cross-band depth
   interaction ever occurs". l.55: the only caveat is the same heightfield drawn twice in the [2000, 3000] overlap.
3. Every mesh the assignment rule marks visible is drawn in full by the passes it is assigned to.
4. Spec 04.1 / Milestone 1F l.73: each body has a mesh↔impostor state machine with a hysteresis band that contains
   a distance-continuous cross-fade. The pool header (lines 15–17) says the swap is "silhouette-exact".
5. Pool header (lines 21–22) and `makeGlowQuad` (line 323): stars are drawn first, then the glow, then the planet impostors.
6. Rig header (lines 30–31): `executePasses()` allocates nothing.

## Findings

### A1-U21-1 — The Near pass paints over Mid-only objects in the 2,400–3,000 m overlap (painter order inverted)
- Severity: S2     Confidence: confirmed
- Category: engine + spec (Milestone 1F l.45/55)
- Location: `game/src/render/MultiCameraRig.tsx:48,52,117–122,151–154` @ 39a8ad2 (RATIFIED camera bands)
- Claim: no cross-band depth interaction; the only overlap artefact is the same heightfield drawn twice.
- Evidence: an object is Mid-only when its near distance dn ≥ 2,400 (line 119). A straddler (dn < 2,400) carries the
  Near bit and the Near pass draws it out to the Near far plane 3,000 m. Near is drawn LAST after `clearDepth`, so
  every Near fragment wins over every Mid fragment. When a straddler's fragment at depth zB ∈ (dn_A, 3000] lies
  BEHIND a Mid-only object A in the same pixel, the Near pass paints it over A. Probe §3: 21,168 inverted cases in the
  sweep (e.g. A at dn 2,400, Mid-only; a terrain chunk with dn 1,000 drawing at z 2,401 over it). Control: with the
  Near far plane at 2,400 the count is 0, and no Near-only object is clipped (Mid still draws the straddler's part beyond 2,400).
- Impact: anything Mid-only at 2.4–3 km (a ship, a vehicle, an alien, a different body's mesh) in front of near
  terrain or a near mesh shows the far surface through it. Latent on the play Moon today (no Mid-only object sits in
  front of a straddler), but the goal's vehicles and combat put objects exactly there.
- Proposed fix: set the Near far plane equal to `NEAR_MID_THRESHOLD` (2,400), or equivalently make the threshold
  3,000. Then the Near and Mid bands meet at one depth and the painter order is exact. Touches a RATIFIED item →
  fix task with an ADR and the m1f A/B regression rows.
- Fix task size: one session (constant + ADR + m1f regression run on an 8 GB VM).

### A1-U21-2 — Meshes past 300 km are clipped or not drawn by any pass; no mesh can use the Far band
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `MultiCameraRig.tsx:49,53,120` @ 39a8ad2; `skyState.ts:24–35,113` (Earth has no impostor slot)
- Claim: every mesh the rule marks visible is fully drawn; beyond 300 km a body is shown by its impostor.
- Evidence: the Mid bit needs only dn < 3e5, but the Mid far plane is 3e5, so a sphere with dn < 3e5 < df is cut at
  300 km. Probe §2: for r = 5,000 m (play Earth) the cut starts at d = 300.1 km; at d = 302 km 1,959 m of visible depth
  is undrawn. From dn ≥ 3e5 the mask is 0 — no pass draws it (r = 5,000: from d = 305 km; r = 20,000: from 320 km).
  No mesh ever carries `FAR_BIT`. The play sky draws Earth only as a mesh (PLAY_BODIES slots 0–8 have no Earth/Moon).
- Impact: a body that is a mesh and has no impostor vanishes or is sliced flat past 300 km. Safe in the T1 play
  world (Earth at ≈39 km, U10a); breaks as soon as the player travels between bodies (T2 cruise, the §13 goal).
- Proposed fix: make "visible ⇒ mesh in a band OR an active impostor" a single engine invariant (see A1-U21-3), and
  clamp the Mid bit to df ≤ MID far (or extend the Mid far plane to cover the handoff fade). Do it in the handoff fix task.
- Fix task size: one session together with A1-U21-3.

### A1-U21-3 — The mesh↔impostor handoff and its hysteresis (RATIFIED) exist only in the test harness
- Severity: S1     Confidence: confirmed
- Category: engine + play
- Location: `game/src/test/Milestone1F_TestHarness.tsx:604–645` (HANDOFF_D_HARD 240,000 / SOFT 220,000, fade
  225,000–236,000, `handoffFade`, state machine) @ 39a8ad2; no handoff code in `src/core`, `src/render` or `src/play`
  (`grep -rn -i hysteresis game/src` finds the handoff only in the 1F harness).
- Claim: Spec 04.1 / Milestone 1F l.73 — every body has a two-threshold state machine with a contained cross-fade.
- Evidence: the only code is the harness block driving two test probes. The engine `SkyImpostorPool` takes a
  per-body `alpha` but nothing in the engine computes it. The play port (`skyState.ts:82`) passes alpha = 1 for every
  impostor, and Earth is always a mesh: there is no swap at all.
- Impact: the ratified handoff is not an engine feature. Any task that lets the player approach a planet (T2,
  §13 goal) must first move the state machine into the engine. Until then m1f R3 tests harness code that the game does not run.
- Proposed fix: a `BodyRenderState` module in `src/core/render/` (pure: distance → {mesh, impostor, alpha} with the
  ratified thresholds), used by both the harness and `skyState.ts`, plus a unit test of the band containment. Also fixes A1-U21-2.
- Fix task size: one session (move + unit test); wiring Earth/Moon impostor slots in play is a second session.

### A1-U21-4 — The impostor "fade" shrinks an opaque disk instead of fading it, so the cross-fade is not silhouette-exact
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `game/src/render/SkyImpostorPool.ts:285` (`aDisk.y = tan θ · alpha`), `:165–167` (`transparent:false`,
  `alphaToCoverage:true`), header 15–17; harness pairs it with mesh opacity 1 − α (`Milestone1F_TestHarness.tsx:643,877`) @ 39a8ad2
- Claim: the mesh↔impostor swap is a cross-fade, shading-continuous and silhouette-exact.
- Evidence: probe §5 on the real pool: the drawn disk radius equals α × the true radius. At α = 0.5 the impostor is a
  half-radius disk (25 % of the area); the outer 75 % shows only the 50 %-opaque mesh over the sky. The output
  alpha is coverage only, and `alphaToCoverage` does nothing on a non-MSAA target, so the inner disk is fully opaque.
- Impact: during the 225–236 km fade a body shows a shrinking bright core inside a half-transparent ring — a visible
  pulse instead of a cross-fade. Related but different from the 5.6 km descending hole (A1-U03), which R3 also misses.
- Proposed fix: keep the full radius and fade with opacity (premultiplied, `transparent:true`, depthWrite while α > 0.95),
  or dither both sides with the same screen-space pattern so their coverages are complementary.
- Fix task size: one session (inside the handoff fix task, with a pixel check in the 1F A/B instrument).

### A1-U21-5 — `executePasses()` allocates every frame (header says zero)
- Severity: S3     Confidence: confirmed (cause: likely)
- Category: engine
- Location: `MultiCameraRig.tsx:128` (`const cams = [rigCamNear, rigCamMid, rigCamFar]`), header 30–31 @ 39a8ad2
- Evidence: probe §7, 2,000,000 calls with a fake renderer: 40 GC events vs 2 for a control loop doing the same three
  `updateMatrixWorld` calls. The array literal per call is the only allocation in the function.
- Impact: small steady garbage in the render loop; the zero-GC invariant (AGENT_BRIEF §3) does not hold here.
- Proposed fix: a module-level `const CAMS = [...]`. Fix task size: minutes (bundle with A1-U25 invariant fixes).

### A1-U21-6 — Draw-order comments are wrong: stars and glow are drawn after the impostors
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `SkyImpostorPool.ts:21–22, 213, 323` @ 39a8ad2; three.js `node_modules/three/build/three.module.js:29708–29710`
- Evidence: stars (`transparent:true`) and the glow (`transparent:true`) go to three's transparent list, which is drawn
  after the opaque list; `renderOrder` sorts only within a list. So the order is impostors → stars → glow, not the
  documented stars → glow → impostors. The picture is still right (stars at 9,700 m fail the depth test behind
  impostors at ≤ 9,600 m; the glow sits at the Sun's staged depth).
- Proposed fix: correct the comments, or rely on the order explicitly. Fix task size: minutes.

### A1-U21-7 — Near-pass depth resolution is coarse at the band end (3.4–5.4 m)
- Severity: S3     Confidence: confirmed (math)
- Category: engine
- Location: `MultiCameraRig.tsx:52` (Near [0.1, 3000]) @ 39a8ad2
- Evidence: probe §4, 24-bit perspective δ = z²/(n·2²⁴): Near δ 3.43 m at 2,400 m, 5.36 m at 3,000 m. (Mid 1.72 m at
  240 km, BG 1.1 cm at 9,600 m — both fine.)
- Impact: surfaces within ~5 m of each other at 2–3 km (a vehicle on terrain, decals, skirts) may z-fight in the Near
  pass. Raising the near plane to 0.5 m gives 0.7 m at 2,400 m; the fix to A1-U21-1 (far plane 2,400) helps too.
- Proposed fix: decide the near plane with the A1-U21-1 ADR. Fix task size: same session as A1-U21-1.

## Checked, no issue
- Pass sequence matches the spec 04.1 loop exactly (clear colour+depth once, Far, clearDepth, Mid, clearDepth, Near).
- All three cameras get the identical pose, fov and aspect each call (A/B pixel invariance precondition holds).
- `scene.background = null` and `fog = null` set on mount; the clear colour is owned by the rig.
- Near-only objects (df ≤ 2,400) always lie inside the Near far plane (control).
- BG staging: ranks 0–23 sit at 9,600…8,565 m, inside [500, 10,000]; the 45 m step is 4,096× the BG depth resolution.
- At α = 1 the impostor disk radius equals the true angular radius (control).
- Mid depth resolution at the 240 km handoff (1.72 m) resolves the Milestone 1F probe pair (2.5 km apart).
- `layerMaskFor` is the single assignment path for the play Earth and all terrain chunks (`skyState.ts:112–125`).

## Not checked (left for later units)
- Real WebGL rendering of the inversion (no Playwright chromium on this VM); the probe proves it from the pass order.
- `SkyImpostorPool.update()` GC rate; off-axis quad squash and staged-rank occlusion are already A1-U15-3/4.
- The handoff thresholds' own numbers and the descending hole: covered by A1-U03.

## Seeds for later units
- U22 (play world): Earth has no impostor slot and no handoff (A1-U21-2/3); the sky is frozen (A1-U13-1).
- U25: the per-frame array in `executePasses` (A1-U21-5).
- U26: the handoff belongs in the engine as one "visible body" state model (mesh band, impostor, fade); see A1-U21-3.