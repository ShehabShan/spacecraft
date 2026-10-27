# ADR-019: R2 Sun readback pose is render-local; impostor scale is read from the far pass

Status: accepted (session 129, F2fbba, 2026-10-27). Evidence: `docs/audit/evidence/F2f/bb/REPORT.md`.

## Context
m1f R2(b) checks the Sun impostor's pixel footprint against the f64 truth. At `c0ae8bf` it posed the A/B camera at absolute `drv` and passed. F-12 (`3057899`) changed the pose to render-local `drv − O`, and R2 began reading 0 px (F2fa, F2fba). F2fbba measured the far pass alone at the local pose: 1,371 px, which is correct. The near pass overdraws that disk with terrain, and hiding terrain restores it. The absolute pose avoids the overdraw only because it puts the camera ~1.38 km away from the render-local scene.

## Options
1. Revert to the absolute pose. R2 goes green, but the check runs in an inconsistent frame: the camera is off by O, and the sky observer and horizon up are wrong by O. It would encode an accident.
2. Keep the render-local pose and the all-pass readback. R2 then tests "is the Sun visible from here", which mixes occlusion into an angular-scale row and fails for a reason R2 does not name.
3. Keep the render-local pose. Measure the impostor footprint from the **far pass only**, using the near/mid camera layer masks at 0. Check occlusion and compositing separately, at a pose with a verified clear sightline.

## Decision
Option 3. The render-local pose `drv − O` is the correct contract. It matches the LIVE path (`drvLocal`), `executePasses`, and `applyRenderState`. The rebuilt R2 gate, a new file per the F2f rules, reads the Sun footprint from the far pass at the render-local pose. Whether terrain *should* cover a Sun that sits 33° above the radial horizon goes to F2fbbb. If F2fbbb finds a real frame bug, it is fixed under its own ADR, and a composite (all-pass) Sun visibility check is added to the R1/R2 rebuild.

## Why
An angular-scale row should fail only when the angular scale is wrong. The far-only readback isolates the impostor pipeline, while the render-local pose keeps the check in the frame the game actually renders in.

## Consequences
- The shipped m1f R2 stays red at HEAD. It is not edited, because new gates go in as new files (F2f).
- F2fbbb must resolve the sightline question before the composite check is written.
- No production or harness code changed in this decision.