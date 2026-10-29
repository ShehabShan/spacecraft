# T5 — BIGGER MOON (REAL SIZE) — PLAN

- Task: T5 · Branch: `t5-bigger-moon` (cut from `main` @ 787b9d4, session 156c)
- Stage: PLANNING — IN PROGRESS (4/7 sections)
- Last updated: 2026-10-29 (session 157)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).
- Source: Lead directive 2026-10-28 (150d, item 2) and ruling (b) (150e), `notes/LEDGER.md`; definition `notes/task.md` §T5; inputs `docs/T5-T6-ideas.md` §0, §1, §6.
- Prerequisites F5a–F5d are folded into T5 as its first build steps (ADR-031).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [ ] Steps ·
  [ ] Verification per step · [ ] Risks & open decisions

## Goal
The play Moon (`?page=play`) gets its real radius, 1,737 km, and real surface gravity, 1.62 m/s², so the ground in front of a walking player reads flat out to the horizon (about 2.4 km at eye height, calc) and distant relief stays visible out to about 100 km. Terrain detail, LOD reach, normals, GPU precision and the gates are rebuilt for that scale, the spawn is re-derived, and frame time and heap show no regression against the 787b9d4 baseline (§13 safeguard 4).

## Scope IN
- **F5a–F5d (U27c §2), first, in dependency order (ADR-031).** Each keeps its U27c §2 definition and verification as its acceptance.
  - F5a: a per-body `TerrainField` instance with an allocation-free height/normal service. It turns the plain alloc-gate green (ADR-002) and carries F3a follow-up (4), the strict real-tree churn check in `test-alloc-gate`.
  - F5b: analytic or level-matched normals instead of the fixed `NORMAL_EPS`, a height bound derived from the params instead of the hand-typed `MAX_TERRAIN_H`/`HEIGHT_SLACK`, and a DDA slope bound from measurement.
  - F5d: mesh pool ≤ worker sets, drop accounting, and an LOD leaf budget with a coarser fallback, built for the lazy quadtree below.
  - F5c: drawn and collision terrain agree near the actor at every LOD, checked again at the final R. Its "lower relief" item is replaced by the crater ladder.
- **Lazy LOD.** The quadtree grows from a boot-allocated node pool, replacing the 341-node-per-face preallocated tree. `MAX_LEVEL` is derived from R (about 15 for quads of about 2 m, calc), split distances reach about 100 km, and the F5d leaf budget caps it. Zero per-frame allocation (brief §3).
- **Terrain profile in metres.** Crater layers sit on a power-law size ladder (N(>D) ∝ D⁻²) from basins of about 50 km down to pits of about 2 m. Each layer has its own lattice and its own prune (chord distance plus cell box, as today), plus metre-scale fBm. Mare rims and floors get km-scale relief. The spawn stays on a flat mare floor. This amends ADR-028.
- **GPU precision.** Every GPU position stays chunk-local or camera-relative at R = 1.737e6 m. The worker already writes Float32 chunk-local positions against a Float64 chunk origin; the step measures the vertex error per LOD level and adds a gate for it.
- **Scale constants.** `MOON_PARAMS.radius` = 1,737,000 m, `MOON_MU` = 1.62·R², KCC `gravityRange`, derived height bounds, the camera clearance probe bounds, and the moonWorld occluder sphere. Earth and Sun framing keep the ruled spawn view (Earth 13° above the view axis, ADR-017).
- **Spawn.** `findEarthriseSpawn` probes and search radius are re-expressed in metres for the real R, and `test-play-spawn` is re-pinned.
- **Gates.** Every re-pin lands replacement-first (§13 safeguard 3) and is listed in its step's commit. Frame time is checked by A/B against 787b9d4 (`check-play-frametime`) and heap by `test-play-perf`. Shared-module edits re-run the `?page=m1X` and m1f-r suites (brief §3).
- Floating-origin rebase (1,024 m) and `MID_FAR_LIMIT` (300 km) are kept, with a check that a whole-Moon view from orbit still composes.

## Scope OUT
- Look and feel, which is T6 (`docs/T5-T6-ideas.md` §2–§5): colour, shadows, Sun height, BRDF, objects (boulders, glowing minerals, crashed lander), character, sound, and a faster travel mode.
- The milestone harness pages (`?page=m1a`…`m1e`, `m1fR1`…`m1fR5`). They keep their own Moon fixtures at R = 1,364.5 m and change only for the F5a service API. They stay regression gates for the shared code.
- The solar-system scale law and catalog (`game/src/core/orbit/scaleLaw.ts`, `celestialData.ts`, F3a, ADR-011…016). The play Moon does not import them.
- KCC obstacle support (T6 boulders and lander need it), physics libraries (brief §3), 1F round 7 and 1G saves (brief §8), T2, F3b (after T6).
- The ratified KCC step/slope rule, C¹ speed cap, camera bands and impostor hysteresis. These change only under an ADR (§13).

## Affected modules
- `game/src/core/terrain/terrainField.ts`: per-body instance (F5a), normals and height bound (F5b), metre profile and crater ladder.
- `game/src/core/terrain/noise.ts`: crater-layer lattices, if needed.
- `game/src/core/terrain/spherify.ts`: cube-sphere mapping at deep levels (precision check).
- `game/src/workers/terrainWorker.ts`: chunk build on the instance, chunk-local positions, per-layer prune.
- `game/src/render/TerrainMeshPool.ts`: pool ≤ worker sets, drop accounting (F5d), worker count (2 or 4).
- `game/src/play/world/MoonLod.ts`: lazy quadtree, node pool, leaf budget, `MAX_LEVEL` from R.
- `game/src/play/world/moonConfig.ts`: R, μ, profile params, derived bounds, KCC config.
- `game/src/play/world/moonWorld.ts`: world build, occluder sphere, LOD wiring.
- `game/src/play/world/spawn.ts`: spawn search at real R.
- `game/src/play/world/skyState.ts`, `game/src/play/world/moonMaterial.ts`: check for scale-dependent terms.
- `game/src/play/camera/ThirdPersonCamera.ts`: clearance probe bounds.
- Terrain service consumers (F5a API change only, behaviour unchanged): `game/src/core/physics/astronautKCC.ts`, `game/src/core/physics/flightController.ts`, `game/src/play/controller/PlayerController.ts`, `game/src/play/frame/playFrame.ts`, `game/src/play/character/CharacterTelemetry.ts`, `game/src/test/Milestone1C_TestHarness.tsx`, `game/src/test/Milestone1D_TestHarness.tsx`, `game/src/test/Milestone1E_TestHarness.tsx`, `game/src/test/Milestone1F_TestHarness.tsx`, `game/src/test/M1fR2Gate.tsx`.
- Gates to re-pin or extend: `game/tools/test-play-lod.mjs`, `game/tools/test-play-spawn.mjs`, `game/tools/test-play-world.mjs`, `game/tools/test-moon-profile.mjs`, `game/tools/test-alloc-gate.mjs`, `game/tools/test-kcc-gate.mjs`, `game/tools/test-kcc-default-trace.mjs`, `game/tools/test-seam-gate.mjs`, `game/tools/test-flight-gate.mjs`, `game/tools/check-play-frametime.mjs`, `game/tools/test-play-perf.mjs`, `game/e2e/play.spec.ts`. New gates are named in Steps.
- Docs: ADR-031 (fold), one ADR per significant step decision, `notes/CHANGES.md`.