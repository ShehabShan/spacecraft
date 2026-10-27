# F2fbbb: why terrain lies on the camera→Sun sightline in m1f R2(b) (A1-U01-1)

Session 130, 2026-10-27, branch `f2f-m1f-gate`. Decision: [ADR-020](../../../../decisions/ADR-020-r2-sun-sightline-real-occlusion.md). Prior step: [F2fbba](../bb/REPORT.md) showed that at the render-local R2(b) pose the far pass draws the Sun (1,371 px) and the near-pass terrain covers it, although the Sun is +32.97° above the radial horizon.

## Question
Is the terrain on the sightline a render bug (Sun and terrain in different frames, or a camera under the ground), or a correct occlusion at this pose?

## Instrument
`game/tools/audit/f2fb-make-variant.py <wt> F12ray` = unedited `3057899` + the F12diag block + one more read-only block, all after the R2 verdict. It logs one `[F2fbbb-ray]` line:
1. the rendered `spinGroup` quaternion and position against `spinQuatInto(kcc.spinPhase)` and −O at readback time;
2. an analytic heightfield march (0.5 m steps, 3 km) from the camera along the Sun direction, in the spin-correct planet frame and, as a counterfactual, unspun;
3. the terrain horizon elevation in the Sun's azimuth (1 m steps, 3 km), both frames;
4. a `THREE.Raycaster` from the render-local pose toward the Sun against the actual terrain meshes;
5. the camera boom length and the astronaut's clearance above the heightfield.

Run with `game/tools/audit/f2fa-m1f-observe.mjs <wt>/game <port> 1200`, twice (VM v2, 2 vCPU, headless Chrome). Exit codes: `exits.txt`. Raw logs: `observe-F12ray.log`, `observe-F12ray-run2.log`.

## Observations
| Quantity | Run 1 | Run 2 |
|---|---|---|
| Rendered spinGroup vs spin law at readback | 0 deg, 0 m | 0 deg, 0 m |
| Camera mode / boom length | third person / 2.51 m | third person / 2.51 m |
| Camera clearance over heightfield (spun / unspun) | +0.60 m / −10.68 m | +0.58 m / −10.80 m |
| Sun elevation over radial up | 32.967° | 32.965° |
| Terrain horizon toward the Sun (spun) | **61.17° at 41 m** (h = 65.0 m) | **61.14° at 41 m** (h = 64.9 m) |
| Sightline march (spun): first below-ground point / deepest | 2.5 m / −107.8 m at 181.5 m | 2.5 m / −107.7 m at 181.5 m |
| Raycaster vs terrain meshes | 3 hits, first at 0.12 m | 3 hits, first at 0.26 m |
| R2(b) diag counts (R2 / far only / terrain hidden / absolute pose) | 0 / 1,371 / 1,371 / 1,372 | 0 / 1,371 / 1,371 / 1,372 |

## Result
- **No frame mismatch.** The rendered terrain group equals the spin law and −O exactly. In the unspun counterfactual the camera would be 10.7 m underground, so the spun frame is the self-consistent one.
- **Camera is not under the terrain.** The third-person boom was clamped to 2.51 m and sits 0.6 m above the analytic surface.
- **The occlusion is real.** After the LIVE sprint the astronaut stands at the foot of a slope: in the Sun's azimuth the terrain rises to 61° at 41 m, well above the Sun's 33°. The sightline enters the ground 2.5 m out. The render is correct; the R2(b) check is badly posed, because it reuses the end-of-sprint driver position without checking that the Sun is visible from it. At `c0ae8bf` it passed only through the absolute-pose accident (F2fbba).
- **Side observation (harness only).** The raycaster meets a terrain mesh 0.12–0.26 m from the camera, while the analytic surface is 0.6 m below the camera and the analytic march enters the ground only at 2.5 m. The rendered chunk surface therefore lies about 0.5 m above the analytic heightfield there. The harness boom clamp (0.4 m against the analytic heightfield) does not guarantee clearance against the mesh. This affects only the 1F harness camera; carry it into the gate rebuild.
