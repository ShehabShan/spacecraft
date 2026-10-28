# ADR-029 — T3 S3: darker mare albedo through shader injection

Status: accepted (proposed session 149; accepted 2026-10-28 with the Lead's ruling on the rim frame-time result, recorded session 150) · Task: T3 S3 · Authority: Lead delegated T3 design decisions (task definition, 2026-10-28)

## Context
After S2 the play Moon has mare basins in the height field (ADR-028), but the terrain uses TerrainMeshPool's default
single-colour MeshStandardMaterial, so the mare floor reads the same as the highlands. The worker chunk format carries
position, normal and unused grid `uv`; the core and the worker must not change for a look-only step.

## Options
1. A per-vertex mask attribute filled by the workers. This changes the chunk format, the boot buffers and the worker code.
2. A per-vertex mask computed in the vertex shader from the moon-fixed direction (chosen).
3. A texture lookup. This needs a parameterisation the cube-sphere chunks do not have.

## Decision
- `game/src/play/world/moonMaterial.ts` builds a MeshStandardMaterial (the pool's default colour 0x7d8a6f, so highlands
  are unchanged) and injects code after `<begin_vertex>` and `<color_fragment>` with `onBeforeCompile`.
- Moon-fixed direction = conj(qS)·(world + origin), with origin and spin written each frame by `setFrame` in playFrame
  stage 6 (no allocation). The mask is the same shore smoothstep and max over basins as terrainField `basinsInto`.
  Cosine bounds per basin skip `acos` outside the shore band.
- Mare albedo factor 0.6 of the highland albedo (real mare ≈ 0.07 vs highland ≈ 0.12).
- Gate `game/tools/test-moon-material.mjs`: a JS mirror of the shader math equals `moonMareMask` (max |Δ| 2.0e-14 over
  20,000 directions and 2,000 spun and rebased poses), and the self-test catches three mutants.

## Consequences
- No change to the core, the workers or TerrainMeshPool. The harness keeps its own material.
- Frame time is measured by `game/tools/check-play-frametime.mjs`, an interleaved A/B against the pre-S3 tree, because
  T1 B13 recorded no frame-time number. In headless SwiftShader the spawn view is equal (ratio 1.000). The rim view is one
  rAF quantum slower (316.7 → 333.3 ms medians, ratio 1.052 against a 1.05 bound), with and without the cosine culls.
  See `docs/audit/evidence/T3/S3/`.