# ADR-021: Design of the rebuilt m1f R2 gate (F2fc, first unit)

Status: accepted (session 131, 2026-10-27, branch `f2f-m1f-gate`). Builds on [ADR-019](ADR-019-r2-sun-pose-render-local.md) and [ADR-020](ADR-020-r2-sun-sightline-real-occlusion.md).

## Context
The shipped m1f R2 row (`src/test/Milestone1F_TestHarness.tsx` `runSuite`, R2 block) mixes two claims at one pose: (1) impostor angular scale and (2) "the Sun is visible on screen". The pose is the end-of-LIVE-sprint driver position, and nobody checked that the Sun sightline is clear from it. ADR-019 fixed the pose contract as render-local (`drv − O`) and moved the scale reading to the far pass. ADR-020 showed the 0 px is real terrain (horizon 61° at 41 m against a Sun at 33°). U27c §2 requires new gates in new files, so the harness rows stay unedited. The harness's `runSuite` internals are not exported. Importing them would mean editing the harness.

## Options
1. Patch the harness at test time by anchor-string injection (the `f2fb-make-variant.py` method). Rejected: it is a diagnostic instrument, it is brittle to edits, and the gate would still share the harness's unverified code.
2. A Node-only gate. Rejected: R2 is a pixel claim and needs a real WebGL readback.
3. A new gate page `?page=m1fR2` (its own module, added to the `main.tsx` static map per brief §3), plus a new spec `e2e/m1f-r2.spec.ts` using the shared `runAcceptanceGate` contract (ADR-001), plus a `--self-test` mutant mode.

## Decision
Option 3. The page builds its own scene from engine modules: SimulationCore, the catalog, SkyImpostorPool, MultiCameraRig `executePasses`, and TerrainMeshPool for row R2c. It reports three rows:
- **R2a angular law**: for every live impostor, rendered half-angle against an independent Float64 θ = asin(R/D) recomputed from catalog rail positions, tolerance 1e-6 rad.
- **R2b far-pass footprint**: render-local pose aimed at the Sun, near/mid layer masks zeroed, 1280×720 readback. Coverage against π·r² is within ±15% and the centre is within 1.5 px of an independent f64 projection. Terrain cannot affect this row by construction.
- **R2c composite visibility**: all three passes with terrain loaded at a site whose sightline is proven clear first. The proof is an analytic heightfield horizon march (spin-correct frame, 3 km, 1 m steps) that must stay ≥ 2° below the Sun elevation, and a mesh raycast must report no hit (ADR-020: the mesh can sit ~0.5 m above the analytic field). The camera is raised along radial up in 5 m steps, up to 200 m, until both hold. If no pose qualifies, the row FAILS with "sightline not clear", never 0 px.
- **Self-test mutants** (each must turn its row red): θ scale ×1.2 (R2a, R2b); absolute pose instead of render-local (R2b); horizon test bypassed at the occluded ADR-020 site (R2c reports an occluded Sun); mesh raycast skipped with the camera clamped into the mesh (R2c).

## Why
Each claim gets a pose where its premise holds, and the premise is checked. The page needs no 120 s LIVE sprint, so the gate runs in seconds instead of ~260 s. The truth comes from catalog f64 and independent geometry, not from the harness code under audit.

## Consequences
- `main.tsx` gains one static-map entry. The shipped harness and `e2e/m1f.spec.ts` are unchanged, and R5 stays waived.
- Implementation is F2fcab. It may split further per §12, for example R2a/R2b first and R2c plus mutants second.
- R1, R3, R4 and R5 rebuilds follow the same page-plus-spec pattern. Carry the R3 0-px silhouette flake into R3.

## Amendment (session 131b, F2fcaba)
- **R2a uses a pinned 8-body fixture, not the catalog.** The page feeds `SkyImpostorPool.setBody` pinned directions, θ and distances (Sun θ = 0.02 rad, planets 0.001–0.009 rad, gas giants kind 2) and checks the staged instances against the pinned literals: quad half-angle atan(half/D) and the `aDisk.x` edge attribute against θe = 1.06·θ + 0.0035, `aDisk.y` against θ, all < 1e-6 rad; staged direction < 1e-9 rad; staged D in [500, 9600] m. Why: the claim under test is the impostor staging law; booting SimulationCore and the catalog would add the rail code to the trust base without testing anything R2 claims. Catalog θ = asin(R/D) correctness belongs to the F3a scale-law gates.
- **Direction error uses atan2(|u×d|, u·d).** acos of the dot product floors at about 2e-8 rad in f64, which is above the 1e-9 tolerance and failed the unmutated page.
- **R2b checks two poses** (Sun centred, and 12° off-axis) so the coverage reference, a 128-gon of projected boundary rays, is exercised off the optical axis. Measured coverage is about 109% at both.
- **Mutants are URL flags** on the same page: `?mut=theta` (θ×1.2 fed to the pool) and `?mut=pose` (staging origin 1,380 m off the camera, the F2fbba absolute-pose accident). R2c and its two mutants come in F2fcabb.
