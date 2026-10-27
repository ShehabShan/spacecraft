# F2fbba: why the render-local Sun pose renders no Sun disk in m1f R2 (A1-U01-1)

Session 129, 2026-10-27, branch `f2f-m1f-gate`. This is the part of F2fbb that was done; the rest is F2fbbb. Decision: [ADR-019](../../../../decisions/ADR-019-r2-sun-pose-render-local.md). Prior step: [F2fba](../b/REPORT.md) showed that the R2 failure comes from the F-12 change of the R2(b) Sun readback pose *position*, from absolute `drv` to render-local `drv − O`.

## Question
At `3057899` the Sun readback pose is render-local. Why does it produce a 0 px Sun footprint, and which pose is correct?

## Instrument
`game/tools/audit/f2fb-make-variant.py <wt> F12diag` builds unedited `3057899` plus diagnostic-only code. The diagnostic code runs **after** the R2 result is assigned, so R2's own numbers are untouched. It re-renders the same R2(b) pose through `abRender`, varying one thing per render, and counts Sun pixels in the same box with the same colour test as R2. It logs a single `[F2fbb-diag]` line and a single `[F2fbb-diag2]` line. Each run used `game/tools/audit/f2fa-m1f-observe.mjs <wt>/game <port> 1200` (VM v2, 2 vCPU, headless Chrome). `tsc --noEmit` exit 0. There were 2 runs, both with observer exit 0 and verdict FAILED. Badges were P F P P F in both runs, the same as unedited `3057899`.

## Observations (identical in both runs)
| Quantity | Value |
|---|---|
| Floating origin O | (512, 0, 1280) m |
| ‖drv‖ (moon-centred camera) | 1,350.1 m |
| Render-local pose `drv − O` | (−5.1, 36.7, −29.2) m |
| Sun elevation over the radial up | **+32.97°** (well above the horizon), Sun slot active |
| Projected Sun centre / expected radius | (640.0, 358.8) px, i.e. the view centre / 21.0 px |

Sun pixels in the R2 box:

| Render (all use the R2(b) Sun-facing quaternion) | Sun px |
|---|---|
| R2 as shipped (local pose, all passes) | 0 |
| repeat of that render | 0 |
| near + mid camera layer masks = 0 (far/background pass only) | **1,371** |
| near masked, mid on | 1,371 |
| mid masked, near on | 0 |
| astronaut group hidden, all passes | 0 |
| terrain group (`spinGroup`) hidden, all passes | **1,371** |
| absolute pose `drv` (as at `c0ae8bf`), all passes | 1,372 |

Raw logs: `observe-F12diag.log` (run 1) and `observe-F12diag-run2.log` (run 2, which adds the diag2 line). Exit codes are in `exits.txt`.

## Result
- **Mechanism.** At the render-local pose the far pass draws the Sun impostor correctly: 1,371 px, the same as c0ae8bf's 1,372. The **near pass then draws terrain over it.** Hiding the terrain group alone restores the full disk. Masking the mid pass changes nothing, and hiding the astronaut changes nothing. The impostor angular scale, which is the quantity R2 is named for, is correct at `3057899`.
- **The absolute pose passes by accident.** `executePasses` puts all three cameras at the pose, and the scene is render-local: `spinGroup` sits at −O, Earth and probe meshes at `abs − O`, and the LIVE path feeds `drvLocal`. `applyRenderState(px…)` treats `px` as local (horizon up `normalize(px + O)`, sky observer `moonAbs + O + px`). With absolute `drv` the camera sits ‖O‖ ≈ 1.38 km away from where the scene thinks it is, so no terrain is in front of it. The sky observer and the horizon up are wrong by O, and the error is too small to move the Sun disk.
- **Correct pose: render-local `drv − O`** (the F-12 intent). It matches the LIVE path and both render contracts.
- **Not established yet (F2fbbb).** The Sun is 33° above the radial horizon, so why does terrain lie on the camera→Sun sightline? Candidates: the camera boom pose lies under or inside a terrain chunk; or the frames disagree, with `drv`/`sunGeom` inertial and `spinGroup` rotated by the moon's spin phase at the time of the readback. This decides whether the occlusion is a real render bug or just a correct occlusion at this pose.