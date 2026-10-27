# F2fcaa (session 131): R2 gate design only

Design decision: [ADR-021](../../../../decisions/ADR-021-r2-gate-design.md). No code was written. The session's budget went to bootstrap, and the remaining budget could not fit a verified browser gate (§12 split). Facts the design relies on, read from the harness at `3a2d629`:
- R2 block: `runSuite`, comment `/* -- R2: impostor angular scale */`.
- The pose is `sL = drv − O`, and `lookAtQuatInto` uses radial up `drv/|drv|`.
- Readback is `abRender` at `AB_W×AB_H = 1280×720` with vertical fov 62°, and the pixel test is `r > 165 && g > 120` inside a ±2·expectR box.
- Pass criteria: coverage 0.85–1.15, centre < 1.5 px, θ err < 1e-6, pos err < 1e-9, audited > 5.
- Far-only pass: zero `rigCamNear`/`rigCamMid` layer masks (exported by `src/render/MultiCameraRig`).
