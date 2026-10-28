# ADR-008 — Independent m1c cross-face seam gate (F2c)

**Status:** accepted (session 112, 2026-10-26) · **Task:** F2c · **Finding:** A1-U06-1 (K2c)

## Context
m1c T3 (`auditSeams` in `Milestone1C_TestHarness.tsx`) skips every chunk pair on different cube faces. A one-sided normal fault at any of the 12 cube edges or 8 corners passes, and so does a 1 m position fault at any edge. The recheck (`pre-t4:docs/audit/U27b3b2b2b1-m1c-recheck.md`) measured 64 false accepts per run across two fixtures. Same-face and T-junction faults are caught.

## Options
1. Patch T3 in the browser harness to compare cross-face pairs. Its identity would still come from the production face tables, so a face-table fault could validate itself. Changing the row also touches the strict ADR-001 contract (C4).
2. Add a Node gate that runs the unchanged terrain worker and takes its truth from outside the engine. Mutants are source rewrites in fresh bundles (the ADR-006 and ADR-007 pattern). The browser rows stay as they are.
3. Do both now.

## Decision
Option 2: `game/tools/test-seam-gate.mjs`.

The gate bundles the real `terrainWorker.ts` and drives its own `init`/`req` handlers. It reconstructs world positions with the main-thread `chunkOriginInto`. It checks two layouts:
- **L0:** six chunks, one per face.
- **mixed:** the recheck's 27 chunks. All faces are at level 1, and face 5's (0,0) chunk is replaced by four level-2 children, which creates a real T-junction.

Identity keys are exact dyadic cube coordinates. They come from a pinned Cartesian chart per face: +X (1,v,−u), −X (−1,v,u), +Y (u,1,−v), −Y (u,−1,v), +Z (u,v,1), −Z (−u,v,−1). They do not use `FACE_C/U/V` or `gridCoord`.

| Check | What it compares |
|---|---|
| `coverage` | Each of the 12 edges has exactly 2^(L+5)−1 shared points (31 at L0, 63 in mixed), each on 2 faces. Each of the 8 corners is on 3 faces. The mixed layout has T-junction pairs. |
| `finite` | Every interior position and normal is finite. |
| `chart-direction` | Each vertex's world direction matches the public spherified-cube formula on the independent chart (≤ 1e-6). |
| `normal-outward-unit` | Normals point outward (dot > 0) and are unit length (±1e-4). |
| `cross-normal-bits` | Every coincident pair on different faces has bit-identical Float32 normals. |
| `cross-position` | Every coincident pair on different faces agrees in world position to ≤ 5 mm. |
| `same-face-normal-bits` / `same-face-position` | The same comparisons for same-face pairs, including T-junctions (mixed layout only). |

`--self-test` runs 42 cases. Each must turn its named checks red:
- the recheck's fixtures: 12 edge-normal faults, 8 corner-normal faults and 12 edge-position faults, each applied to one face only;
- 4 same-face and T-junction controls;
- 2 missing-chunk controls;
- 4 worker source mutants: a face-3 normal scaled by 1+1e-6, a face-0 position offset of +1 cm, a mirrored u on face 2, and a Float32 nudge to the edge-row normal on face 1.

A rewrite that matches nothing breaks the gate (exit 2). The production terrain and worker hashes must be unchanged afterwards. `--deliberate` adds a no-op case and must exit 1.

## Why
- The identity and the expected topology come from outside the engine, so a wrong face table or a wrong grid mapping cannot validate itself.
- Bit comparison on Float32 patterns matches the spec's "normals agree bitwise" claim exactly.
- The gate runs the real worker. Synthetic data was used only in the audit, so this gate makes no fixture-only claims.

## Consequences
- The m1c browser rows are unchanged. Row counts (C4) and ADR-001 are unchanged. T3 still covers same-face seams in the browser, and this gate covers cross-face seams.
- Equal vertices do not prove whole-triangle or skirt continuity. The gate compares CPU data and makes no GPU or pixel claim.
- F5a–F5d (terrain service, normals, mesh pool) must keep this gate green. A refactor of the rewritten worker lines breaks the self-test loudly (exit 2), and the rewrite strings must then be updated.