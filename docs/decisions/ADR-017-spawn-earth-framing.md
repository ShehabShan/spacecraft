# ADR-017 — Spawn view frames the Earth near the centre (F3a-follow-up 2)

**Status:** accepted (session 126, 2026-10-27). Lead ruling 2026-10-27 (APPROVAL LEDGER): "re-pin so Earth sits near the centre of the view".

## Context
After ADR-016 gave the Moon its real orbit elements, the t=0 Moon→Earth direction moved. At the deterministic Earthrise spawn the Earth stands 14.35° above the horizon (centre direction; 14.15° from the KCC up, ~12° topocentric). The camera reset used the harness look-down pitch 0.35 rad (20°), so the Earth sat 31.93° off the view axis: at the edge of the 62° FOV (half-height 31°). F3abbbbbc loosened `test-play-frame.mjs` to `< 31 + 7` to keep it green.

## Options
- (a) Move the spawn site (change `findEarthriseSpawn`) until Earth lands near the axis. Rejected: with a 20° look-down the Earth would have to sit at the horizon or below it; the search is the M1F harness search verbatim (M1F/play spawn parity, `test-play-spawn` pins).
- (b) Change `camPitchDefault`. Rejected: it is the harness feel value and also the pitch every other reset uses (controller tests, camera feel); a fixed pitch cannot follow the Earth's elevation when orbits change again.
- (c) Aim the spawn/respawn camera at the Earth: new `ThirdPersonCamera.frameToward(kcc, target, targetDist, ctrl?)` = `reset()` then pitch chosen so the Earth sits `PLAY_TUNING.camSpawnAimAbove` above the view axis. Chosen.

## Decision
- `camSpawnAimAbove` = 13°. The Earth is not put exactly on the axis because the astronaut stands there: the helmet top (1.87 m − pivot 1.4 m = 0.47 m at a 7.17 m camera distance) reaches ~3.8° above the axis, and the Earth disc half-angle is ~8.7° (R 5,000 m at 33.1 km). At 13° the disc bottom is ~4.3° above the axis, clear of the helmet, and the disc centre is well inside the central half of the view.
- The elevation is taken from the topocentric vector `earthDir·earthDist − kcc.pLocal`, not the planet-centre direction: parallax at 1,365 m / 33 km is ~2.3° (centre direction gave 10.73° instead of 13°).
- The pitch is clamped to `[camPitchMin, camPitchMax]`; the result is applied by PlayPage at boot and by the respawn (R) path in `playFrame` stage 3, so respawn re-frames identically. Scalars only — zero allocation (respawn runs inside the frame).
- `test-play-frame.mjs`: old `< 31°` row restored; new rows: off-axis = 13° ± 1.5°, Earth above the axis, respawn pitch = spawn pitch.

## Why
It follows the Earth wherever the rail puts it at t=0, keeps the spawn site and harness feel constants untouched, and is a play-layer-only change (no core/render edit).

## Consequences
- Spawn view: Earth 12.99° above the axis (was 31.93°), pitch +1.85° (camera looks almost level, slightly down; was 20° down), boom 7.000 m.
- If a later orbit change puts the Earth below the horizon at spawn, the clamp keeps the pitch in range and the 13° row in `test-play-frame` goes red — that is intended: the spawn search then needs revisiting.
- Free-look after spawn is unchanged (orbit/pitch/zoom from input as before).