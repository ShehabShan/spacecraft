# A1-U23 — Play controller, camera, input, frame

- Unit: A1 U23 (`docs/A1-plan.md` §5 Phase E) · Session 80 · 2026-10-25 · start commit `1443228`
- Files read in full (749 lines):
  - `game/src/play/controller/PlayerController.ts` (159)
  - `game/src/play/camera/ThirdPersonCamera.ts` (192)
  - `game/src/play/input/InputState.ts` (172)
  - `game/src/play/frame/playFrame.ts` (152)
  - `game/src/play/frame/shellStages.ts` (74)
- Also read: `moonConfig.ts` PLAY_TUNING, astronautKCC.ts 386–400 / 548–575 / 660–690 (input → vDes, auto-turn, look yaw), terrainWorker.ts 74–84 (index topology), T1-plan coyote / camera / wheel passages (grep).
- Probe: `pre-t4:game/tools/audit/u23-controller-camera.mjs`. It drives the REAL PlayerController, ThirdPersonCamera, PlayClock and AstronautKCC through the esbuild bundle pattern of `test-play-controller.mjs`.
  - Run from `game/`: `node tools/audit/u23-controller-camera.mjs` → **PROBE_EXIT=0**, controls 3/3.
  - Full output: `pre-t4:docs/audit/U23-probe-output.txt`.
- Read-only: no file under `game/src`, `game/e2e`, `Milestone`, `Design_specs` changed (§6.4 diff empty, see commit VERIFIED).

## Claims written before probing
- C1 Sign conventions:
  - D moves the character toward screen-right;
  - mouse-right turns the view right;
  - the camera's X axis = heading × up.
  - (Seeded by A1-U18-1, where the flight controller's yaw/roll are mirrored.)
- C2 Game speed is frame-rate independent. W held for 3 s of wall time should give the same distance at every frame rate, or the plan should name a floor.
- C3 First-person mouse yaw should update the view every rendered frame, like third-person yaw and like FP pitch.
- C4 A heading that has lost its tangent component must recover a valid direction (setHeadingFrom has a fallback; transport may not).
- C5 Plan MT11: "camera never inside terrain". The camera must clear the terrain the player SEES, and the character must stay visible from the camera.
- C6 Wheel zoom should feel the same across browsers and wheel modes.

## Findings

### A1-U23-1 — Below 12 fps the game runs slow: PlayClock 0.1 s clamp + 5-substep cap shed up to 58 % of game time
- Severity: S2     Confidence: confirmed
- Category: play
- Location:
  - `play/frame/shellStages.ts:7,30` (MAX_FRAME_DT 0.1)
  - `play/controller/PlayerController.ts:75-89` (maxSubsteps 5, shed)
  - `play/frame/playFrame.ts:98` @ 1443228
- Claim: plan §9 / §13 "fixed-step simulation (frame-rate-independent feel)" (task.md T1 definition).
- Evidence (probe P2, W held for 3 s of wall time; ideal = 180 ticks, 9.146 m):

  | fps | ticks | speedRatio |
  |---|---|---|
  | 144, 60, 30, 15, 12 | 180 | 1.000 |
  | 10 | 150 | 0.833 |
  | 7.5 | 115 | 0.639 |
  | 5 | 75 | 0.417 |

  - The clock clamps dt to 0.1 s.
  - The controller then runs at most 5 × 1/60 s = 0.083 s per frame and sheds the rest.
  - The controller's own 0.25 s clamp (line 78) and the KCC's (astronautKCC.ts:388) are therefore dead in play.
  - `core.advance(clock.dt)` still receives the full 0.1 s, so below 12 fps the core and the KCC advance by different amounts each frame. Harmless while the sky is frozen; latent once bodies move (A1-U13-1).
- Impact:
  - On a weak machine or during a hitch the whole game goes into slow motion with no notice.
  - This is the play-layer twin of A1-U13-3 (core), now confirmed on the play path.
- Proposed fix: one time budget for the whole frame, in either of two forms:
  - clock clamp = maxSubsteps × TICK;
  - adaptive substeps up to the clamp.
  - Feed core and KCC the same consumed time. Not RATIFIED.
- Fix task size: fits one session (with A1-U13-3).

### A1-U23-2 — First-person yaw updates at the 60 Hz tick rate, not the frame rate (judder on high-refresh screens)
- Severity: S2     Confidence: confirmed (cadence); judder visibility suspected — confirm with a 144 Hz manual check
- Category: play
- Location:
  - `play/controller/PlayerController.ts:127` (FP lookDX consumed inside `step`, i.e. per tick)
  - `core/physics/astronautKCC.ts:390-395` (applied in `update`)
  - `play/camera/ThirdPersonCamera.ts:109` (FP heading = kcc.fwd) @ 1443228
- Claim: C3.
- Evidence (probe P3, 1,440 frames at 144 Hz, 4 px/frame of mouse X):
  - TP heading changes on **1440/1440** frames.
  - FP heading changes on **600/1440** frames and is still on 840.
  - FP pitch is applied per frame (camera.preStep), so in FP yaw and pitch run at different rates.
- Probe caveat: the probe assigns lookDX each frame, so leftovers on 0-tick frames are overwritten. The real InputState accumulates (`+=`), so no yaw is lost in the game; only the cadence differs.
- Impact:
  - At 144 Hz, FP yaw moves in 60 Hz steps (2–3 frames per step) while pitch is smooth.
  - The view stutters when panning sideways.
  - The same applies to any frame rate that is not a multiple of 60.
- Proposed fix: apply FP yaw to the body every frame (camera pre-step or a KCC per-frame yaw hook), not per tick. Not RATIFIED.
- Fix task size: small, fits one session.

### A1-U23-3 — Camera clearance uses the analytic height, but the drawn terrain sits higher: the camera can be inside the visible ground
- Severity: S2     Confidence: likely
- Category: play
- Location: `play/camera/ThirdPersonCamera.ts:137-155` (cut and floor both use `terrainHeight`) @ 1443228. Root cause A1-U22-1.
- Claim: C5 / plan MT11 "camera never inside terrain".
- Evidence (probe P5 + P6):
  - Against the analytic field the claim holds: 6,000 random poses, camera below analytic 0, minimum clearance 0.400 m. This is the cut working as designed.
  - The surface on screen is the L4 linear mesh (worker topology `a,b,c / a,c,d`, terrainWorker.ts:79-83).
  - At 120,000 drawn-edge midpoints, the drawn surface is above the analytic height by more than camClearance 0.4 m at **22.86 %**, by more than 1 m at **7.36 %**, and by up to **6.25 m** at worst.
  - So a camera clamped to analytic + 0.4 m (low pitch or a short boom over convex ground) can be below the drawn triangle.
- Not measured: the fraction of real camera poses that end up inside a drawn triangle. Confirm with a probe that intersects the camera point with the L4 triangle under it, or with a browser screenshot sweep (MT11).
- Impact: on bumps and ridges, the near plane clips into the ground, so the player sees through or under the terrain.
- Proposed fix: either
  - clear against the drawn surface (sample the triangle interpolation, or add the per-level max |drawn − analytic| bound to camClearance); or
  - fix A1-U22-1 at the source.
  - Not RATIFIED.
- Fix task size: fits one session (after or with the U22-1 fix).

### A1-U23-4 — The 4-point boom cut misses ridges between samples: the character is hidden behind terrain on 0.58 % of poses
- Severity: S2     Confidence: confirmed
- Category: play
- Location: `play/camera/ThirdPersonCamera.ts:135-145` @ 1443228
- Claim: C5. The spring arm keeps the character visible: the boom shrinks when terrain is between the pivot and the camera.
- Evidence (probe P5, same 6,000 snap poses):
  - The camera→pivot segment was sampled at 63 points against the analytic height.
  - Pivot occluded on **35/6000** poses (0.58 %): **7/2963** at the default 7 m boom and **28/3037** at 12 m.
  - The analytic ground pokes up to **2.19 m** above the line of sight.
  - The cut only tests ground clearance at 4 points (¼, ½, ¾, 1 × dist) and accepts the boom if all four are clear.
- Impact: walking along ridge crests or crater rims, the camera sits behind a hump and the character disappears. This is more likely zoomed out.
- Proposed fix: march the segment pivot→camera at a step ≤ the terrain feature size (≈ 1 m), or sweep the segment. Not RATIFIED.
- Fix task size: small, fits one session (with A1-U23-3).

### A1-U23-5 — A heading parallel to up collapses to zero and the player cannot move
- Severity: S3     Confidence: confirmed code path; reachability suspected
- Category: play
- Location:
  - `play/camera/ThirdPersonCamera.ts:161-166` (`transport`: `|| 1` keeps the zero vector)
  - `play/controller/PlayerController.ts:97-100` (same pattern) @ 1443228
- Claim: C4.
- Evidence (probe P4): heading set ∥ up → after transport |heading| = 0.000000, and W for 1 s moves **0.0000 m**. It never recovers. `setHeadingFrom` has a fwd fallback (line 174) but `transport` does not.
- Reachability:
  - Heading is re-projected every frame and `up` changes by small angles, so this needs an up change near 90° in one frame.
  - The largest observed is 51° (A1-U17 landing snap).
  - Confirm with a fuzz of landing snaps + transport.
- Impact: a latent softlock that only respawn clears.
- Proposed fix: fall back to `kcc.fwd` (as setHeadingFrom does) when the projected length is below 1e-6.
- Fix task size: trivial.

### A1-U23-6 — Wheel zoom ignores `deltaMode`
- Severity: S3     Confidence: likely (browser behaviour not run here)
- Category: play
- Location:
  - `play/input/InputState.ts:56-59`
  - `play/camera/ThirdPersonCamera.ts:93` @ 1443228
- Claim: C6. Plan §9.4 sizes zoom as "one 100-unit notch".
- Evidence:
  - `zoomDelta += ev.deltaY` with no `deltaMode` handling.
  - With deltaMode = 1 (lines), as some Firefox/Linux wheel setups report, deltaY is ≈ 3 per notch instead of ≈ 100, so zoom is ≈ 33× slower.
  - High-resolution trackpads send many small pixel deltas, which is fine because the zoom is multiplicative.
- Impact: zoom feels broken on some browser/OS setups.
- Proposed fix: scale by 16 px/line and the viewport height for page mode.
- Fix task size: trivial.

## Checked, no issue
- **Sign conventions (C1).** The play layer is NOT mirrored, unlike A1-U18-1 in the flight controller.
  - The camera X axis · (heading × up) = 1.0000.
  - D displacement · camera right = 1.0000.
  - Mouse +50 px turns the heading by −0.1100 rad (= −50 × lookSens) toward heading × up, i.e. right (P1).
- **Frame-rate independence from 12 to 144 fps.** 180 ticks and 9.146 m at every rate (P2). The 1e-9 tick tolerance keeps 144 Hz on 60 ticks/s.
- **Camera vs the analytic field.** Never below it; minimum clearance exactly camClearance 0.400 m (P5).
- **PlayClock.** The resume frame runs dt = 0. Pause and respawn force dt = 0. LoadingGate needs 2 consecutive ready frames and caps a hitch at 0.25 s.
- **InputState** (by reading):
  - keys are read only while locked;
  - auto-repeat makes no edges;
  - lock change and blur clear held keys and pending look;
  - the first mouse event after a lock change is dropped;
  - a 200 px per-event clamp;
  - listeners are bound once (no per-event allocation).
- **Jump buffer.** Re-derived per tick, consumed on launch (vertSpeed > 0.5); walking off a ledge is not counted as a jump.
- **Coyote time.** Absent as planned. `PLAY_TUNING.coyoteS` is an unused config value until B11 (KCC `coyoteTime`, Q2(a)), and T1 is paused at B11. Not a defect.
- **playFrame stage order** matches the plan §4.3 comments:
  1. clock;
  2. edges;
  3. camera pre-step (PLAYING only);
  4. controller ticks, then `core.advance`;
  5. extraction with the spin composed once;
  6. telemetry and animation;
  7. lagged pose;
  8. sky;
  9. LOD on the camera position;
  10. gate, HUD and clearEdges.
- **Allocations.** No per-frame allocation in these five files (module or closure scratch only).

## Not checked / seeds for later units
- A1-U15-1 (Gram-Schmidt "transport") also applies to `ThirdPersonCamera.transport`. The camera heading drift on a loop walk was not re-measured; it belongs to the U15-1 fix.
- A1-U13-2 (controller/core accumulator disagreement): the core and controller are still separate accumulators; not re-measured here.
- U24 (character):
  - `sampleTelemetry` reads `ctrl.inputMag` and the jump/land edges set here;
  - `landedThisFrame` is OR-ed over ticks, so two landings in one frame are reported once;
  - FP hides the rig via `setVisible(!firstPerson)`.

## Lead questions (look & feel / gameplay only)
None new.