# ADR-028 — T3: opt-in Moon terrain profile (mare basins, craters, softened highlands)

Status: accepted (session 147, 2026-10-28) · Task: T3 S1 · Authority: Lead delegated T3 design decisions (task definition, 2026-10-28)

## Context
The play Moon (`/?page=play`, `MOON_PARAMS`, R 1,364.5 m) has mountains almost everywhere. A probe over 20k
Fibonacci directions found 40.9% of the surface at slope ≥50°, which is beyond the KCC walk limit of 50°. Only 0.9% is
flatter than 5°. The cause is that the ridged mountain term covers most of the sphere at mask ≈1, and a 230 m amplitude
on such a small body produces steep slopes everywhere. `terrainHeight` is shared by the KCC, workers, the m1c/m1d/m1e/m1f-r
gates and the harness moons. Those must not move (§13, brief §3 invariants).

## Options
1. Retune `MOON_PARAMS` (lower `mountainAmp`). This gives no flat plains and no basin/crater structure, the
   slopes are still noisy, and it is not mare-like.
2. Edit the shared default field. This moves every gate and harness pin, so it is rejected.
3. Add an opt-in `TerrainParams.moon` profile, evaluated only when present (chosen).

## Decision
- `TerrainParams.moon?: MoonProfile` is optional and made only of plain numbers and number arrays, so it is structured-cloneable to workers.
  `terrainHeight` dispatches to `moonHeight` only when `P.moon !== undefined`. Otherwise it evaluates the unchanged pre-T3
  expression (now named `fieldHeight`).
- Mare basins: an explicit list of [dir, angular radius]. The mask is a smoothstep over a shore band and selects the max
  over basins. The floor is a constant level plus low-frequency fBm (freq 8, 1.2 m). A Gaussian rim ring outside the edge
  forms the basin-ring mountains, with height 25 m + 72.6 m/rad·r. The highland field is skipped where the mask is 1.
- Craters: two procedural layers on a 3D cell lattice of d, so they are continuous across cube faces and table-free:
  - F 9, occupancy 0.55, r 18–60 m;
  - F 32, occupancy 0.45, r 8–16 m (the minimum radius is above the 4.2 m mesh and the 2.7 m normal epsilon).
  - Profile: parabolic bowl with depth 0.18·r plus a Gaussian rim of 0.05·r.
  - Craters are damped ×(1 − 0.9·mask) on mare.
  - Evaluation uses chord distance, a cell-box prune and a basin-cone prune.
- Highlands: the existing field with mountainAmp ×0.12 and detailAmp ×0.35.
- Tables are allocated in `initTerrainField` only. Evaluation is pure in d and zero-allocation, so seams and LODs stay bit-exact.
- `moonMareMask(d)` is exported for gates and for the S3 mare shading.
- Coverage of about 33% mare sits between the real Moon's ~16% global and ~31% near side. Playability comes first.
- Not wired to play in S1. `MOON_PARAMS.moon` stays unset, and S2 sets it with basin 0 rotated under the spawn.

## Evidence
`node tools/test-moon-profile.mjs` (S1 candidate "G-prune", docs/T3-plan.md §3.1) passes 13/13:

| Measure | Result |
|---|---|
| Slope <5° | 32.6% |
| Slope <45° | 92.3% |
| Slope ≥50° | 3.9% |
| Slope ≥30° | 29.1% |
| Mare | 33.0% |
| Height | −72.1…164.7 m (bound 340) |
| Cost | 1.88× baseline |

The default-path SHA-256 pins match those taken on the unedited tree:
- TEST_PLANET `412ed993…`
- harness MOON `b7403bae…`

`--self-test` catches 4/4 mutants (profile off, mare radius 0, crater depth ×10, default-path perturbation).
`tsc --noEmit` exits 0. kcc-default-trace and kcc-gate exit 0 unchanged. All nine play Node tests exit 0
(`--expose-gc`).

## Consequences
- S2 will move the play pins: test-play-spawn (field count 10 → 11, spawn site) and the moon half of
  test-kcc-default-trace. It needs an amendment here with before/after evidence. TEST_PLANET pins must not move.
- The worker build cost per vertex rises about 1.9× on the play Moon only.