# F2fccbba evidence (session 136, ADR-023)

- `tsc.txt`: `npx tsc --noEmit -p .`, TSC_EXIT=0.
- `self-test.run1.txt`, `.run2.txt`: `node tools/test-m1f-r3-gate.mjs`, EXIT=0 both. Cases none, ctl=ref, mut=meshhide and mut=noimp are all AS EXPECTED. Each case checks both badges and a detail regex.
- `m1f-r3-spec.run1.txt`, `.run2.txt`: `npx playwright test e2e/m1f-r3.spec.ts`, EXIT=0 both, badges `["FAIL","FAIL"]`.

Measured R3b (unmutated): drawn area divided by the full-opacity mesh reference area, tolerance 1 ± 0.25.
- down: 290:1.364 245:1.333 238:1.375 232:0.765 228:0.085 224:0.000 222:0.000 205:1.000
- up: 205:1.000 222:1.000 224:1.000 228:1.000 232:1.000 238:1.375 245:1.333 290:1.364
- Fails: down [290, 245, 238, 228, 224, 222] km; up [238, 245, 290] km.
- Every reference area lies within ±3% of ideal π·r², for example 232 km: 68 px vs 67.9.

## Finding F2fccbb-1 (shading/size mismatch, S2 proposed)
At full opacity, the shipped impostor (SkyImpostorPool kind 3) does not match the harness probe mesh it replaces. It draws about 1.35× the mesh's area (R > 8 silhouette) and about 2.57× its summed luminance at 238–290 km.

The probe colour is fed two ways. The mesh gets `new THREE.Color(0xc96f4a)`, which three 0.165 converts to linear (0.584, 0.159, 0.068) under ColorManagement. The impostor gets raw floats (0.79, 0.44, 0.29). The impostor's anti-aliased edge also writes full colour, because it is opaque with alphaToCoverage on a non-MSAA target. These are candidate causes, not yet isolated, and both the harness and this fixture share them.

The ADR-023 prediction assumed that the impostor matches the mesh, so R3b also fails the impostor-only samples. The spec pins the measured set, as ADR-023 allows. R3c (silhouette A/B, next unit) is the row that must name this mismatch.

A first draft measured luminance, which reported the impostor brightness as coverage (2.56). Coverage is now drawn area, and the luminance ratio is printed as a diagnostic only.
