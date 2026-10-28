# F2fccbbb evidence (session 137, ADR-023)

- `tsc.txt`: `npx tsc --noEmit -p .`, TSC_EXIT=0.
- `measure-all-cases.txt`: the first GPU run of all seven cases (a throwaway copy of the self-test with no expectations), used to pin the measured R3c vector.
- `self-test.run1.txt`, `.run2.txt`: `node tools/test-m1f-r3-gate.mjs`, EXIT=0 both. Seven cases (none, ctl=ref, mut=meshhide, noimp, shift, scale, bright), all AS EXPECTED. Each case checks all three rows' badges and a detail regex. The R3c detail lines are byte-identical across the two runs.
- `m1f-r3-spec.run1.txt`, `.run2.txt`: `npx playwright test e2e/m1f-r3.spec.ts`, EXIT=0 both, badges `["FAIL","FAIL","FAIL"]`.

## Measured R3c (unmutated)
Mesh-only vs impostor-only renders with R > 8 masks in a 48² window, on the R3b fixture (cleared rig background).

| km | mesh px | impostor px | ideal π·r² | sym / limit 0.5·2πr | Δcentroid | repeat |
|----|---------|-------------|------------|---------------------|-----------|--------|
| 228 | 71 | 88 | 70.3 | 17 / 14.9 | 0.11 px | identical |
| 232 | 68 | 88 | 67.9 | 20 / 14.6 | 0.00 px | identical |
| 236 | 68 | 88 | 65.6 | 20 / 14.4 | 0.00 px | identical |

Fails: [228(imp-area,sym) 232(imp-area,sym) 236(imp-area,sym)]. The mesh masks stay within ±1.5% of ideal, so the comparison is not vacuous. Centroids agree and repeat renders are byte-identical, so the 0-px flake is gone.

ADR-023 predicted PASS. The row fails because of finding F2fccbb-1: the impostor-only mask is 88 px at every one of the three distances (about 1.25–1.34× ideal), while the mesh shrinks with distance as expected. The impostor disk does not track the mesh's projected size in this band. The cause (radius term vs anti-aliased edge vs colour path) is not isolated here; this unit only measures and pins.

## Mutants (R3c)
- `shift` (impostor 3 px along camera right): Δc 3.00–3.11 px, so centroid fails and sym rises to 60–63.
- `scale` (impostor tan θ ×1.5): impostor 172–191 px, sym 104–120.
- `bright` (far-pass backdrop rgb 90,80,66, the A1-U03-3 masquerade): both masks 2304 px (the whole window) with sym 0, which is exactly the shipped row's vacuous pass. Here both area bounds fail it.
- `meshhide`: mesh 0 px (all four reasons). `noimp`: impostor 0 px.
- `ctl=ref` does not change R3c (it controls the handoff, not the silhouettes).
