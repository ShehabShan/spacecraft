# A1-U22 — Play world (`play/world/*`)

- Unit: A1 plan §5 Phase E, **U22 play world**. The plan asks for a check of the boot, LOD, spawn and sky state.
- Commit audited: `fe2b6f4` (branch `a1-engine-audit`). The unit is read-only: no `game/src` edits.
- Files read in full:
  - `play/world/moonConfig.ts` (63)
  - `spawn.ts` (80)
  - `moonWorld.ts` (201)
  - `skyState.ts` (127)
  - `MoonLod.ts` (250)
  - Call sites in `play/frame/playFrame.ts` (stages 6–11) and `PlayPage.tsx`
  - The helpers they lean on: `terrainField.ts` (`gridCoord`, `chunkArcWidth`, `chunkOriginInto`, `skirtDepthFor`) and `KCC.teleportSurface`
- Probe: `game/tools/audit/u22-play-world.mjs`. It imports the real modules: MoonLod over a fake instant-answer pool (the `test-play-lod` shape), the real spawn search, the real SimulationCore and the real terrain field.
- Run from `game/`: `node --expose-gc tools/audit/u22-play-world.mjs`.
  - Result: PROBE_EXIT=0, controls 4/4.
  - Output: `pre-t4:docs/audit/U22-probe-output.txt`.

## Claims written before probing (geometry / physics)
- **C1.** The surface the player stands on (the analytic `terrainHeight` in the KCC) should match the surface that is drawn (the finest LOD mesh, linear between vertices). The error should be within a few cm, the scale of `groundClearance` 0.02 m.
  - Otherwise feet visibly sink into the ground or float above it.
- **C2.** The LOD's selected leaf set should fit the mesh pool, or the controller should coarsen until it does.
  - A selected leaf with no resident mesh, no covering parent and no covering children is a hole.
- **C3.** `brad` (node bounding radius) must bound every vertex, including skirts, or both the horizon cull and the camera-layer masks are wrong.
  - It should not exceed the extent by much: it widens the layer masks, and the horizon cull keeps more nodes.
- **C4.** All terrain must lie above the core shell sphere (R − MAX_TERRAIN_H − 40) and below MAX_TERRAIN_H. This is the KCC height bound, which A1-U14-2 found broken for m1e.
- **C5.** The spawn search must give an earthrise: Earth just above the horizon, Sun up. Its early-exit condition must be reachable.

## Findings

### A1-U22-1 — The drawn terrain is not the terrain the player stands on: metre-scale mismatch at the finest LOD
- Severity: S1     Confidence: confirmed
- Category: play / engine
- Location:
  - `play/world/MoonLod.ts:18` (`MAX_LEVEL: 4`)
  - `core/terrain/terrainField.ts:33` (`GRID_N = 32`)
  - `core/physics/astronautKCC.ts:351` (the KCC samples analytic `terrainHeight`), all @ fe2b6f4
- Claim: C1. The character stands on the ground it is drawn on, offset by `groundClearance` 0.02 m.
- Evidence (probe P2/P2b):
  - The play Moon's finest LOD is L4: chunk arc 134 m on 32 quads, so a **4.19 m vertex spacing**.
  - The GPU draws straight lines between vertices. The KCC stands on the analytic height.
  - At grid-edge midpoints (40,000 random L4 edges), |analytic − drawn| measured:

    | p50 | p90 | p99 | max |
    |---|---|---|---|
    | 0.22 m | 1.01 m | 3.89 m | 12.9 m |

  - 46 % of edge midpoints are off by more than 0.25 m.
  - At quad diagonals: p99 6.0 m, max 26 m. 97 % are off by more than `groundClearance`.
  - The curvature (chord-sag) floor for a 4.19 m edge is only 0.0016 m. The error is all from terrain detail that the 4.19 m mesh cannot represent, consistent with A1-U14-1 (normals under-resolve the detail octaves).
- Impact:
  - On most of the surface the astronaut's feet are buried tens of centimetres to metres in the drawn ground, or hover above it. The same mismatch applies to the camera clearance (also analytic).
  - Rocks and ridges that the player collides with are not drawn, and drawn bumps are walked through.
  - No gate compares the two surfaces.
- Proposed fix (choose under §13, ADR): either is the smallest fix.
  - (a) Make collision sample the drawn surface: a bilinear or triangle lookup over the same grid at the finest resident level around the player.
  - (b) Band-limit `terrainHeight` to the finest mesh's Nyquist (≈ 8.4 m wavelength), and add a deeper LOD level (L5–L6, ≈ 1–2 m spacing) only within ~100 m of the player.
  - Option (b) also fixes the A1-U14-1 normals. Not a RATIFIED item, but it touches the KCC ground query.
- Fix task size: one session for (a) plus a gate that measures the max |collision − drawn| under the player on a 1 km walk. (b) is two sessions: field filter, then a deeper LOD with a pool-size check (see U22-2).

### A1-U22-2 — The LOD wants more chunks than the 96-mesh pool holds; selected leaves at 1–1.9 km stay unmeshed with no fallback
- Severity: S2     Confidence: confirmed (gap) · suspected (visible from altitude)
- Category: play
- Location: `play/world/moonConfig.ts:45` (`meshCount: 96`); `MoonLod.ts:153–209` (no demand-vs-capacity coarsening) @ fe2b6f4
- Claim: C2. Each selected leaf ends up drawn by its own mesh, or by a parent or children still resident.
- Evidence (probe P5/P5b; fake pool answers every request at once, 400 frames, camera above the spawn):

  | camera altitude | selected leaves | active meshes | leaves with no data |
  |---|---|---|---|
  | 1.4 m | 125 | 94 | 31 |
  | 30 m | 123 | 94 | 29 |
  | 200 m | 117 | 94 | 23 |
  | 1,000 m | 48 | 47 | 1 |
  | 3,000 m | 12 | 12 | 0 |

  - At 1.4 m, all 31 meshless leaves are true holes: no ancestor or child holds a mesh. They lie 1,005–1,907 m from the eye. Every leaf with data is within 989 m.
  - From the spawn eye, terrain occludes all 31 (0 unobstructed eye rays). That is why play looks fine at the spawn.
  - The loading gate reads `residentAround(300 m) = 1.000`: the gate cannot see the deficit.
  - `pressure` (`freeCount < 6`) only releases meshes. Nothing reduces the selection.
- Impact:
  - Steady-state holes exist whenever demand > 96, which is every altitude below ~1 km.
  - They are hidden by horizon occlusion at walking height on this terrain. On a flat area, a crater rim or a jump/jetpack height they may be visible.
  - Visibility at 30 m and 200 m was not ray-tested. **To confirm:** eye-ray test at those altitudes, or a browser screenshot from 200 m.
  - Coupled to A1-U20-1: raising `meshCount` above `workerPoolSets` makes the worker drop requests.
- Proposed fix: make the LOD honour the budget.
  - When selected leaves > meshCount − reserve, raise the split distance (or stop splitting the farthest nodes) until the selection fits.
  - Add a gate: selected-without-data == 0 in steady state over an altitude sweep.
- Fix task size: one session (controller change + gate), after or with the A1-U20-1 set-accounting fix.

### A1-U22-3 — `brad` is 1.5–2.2× the real chunk extent: conservative, but every layer mask and horizon test is inflated
- Severity: S3     Confidence: confirmed
- Category: play
- Location: `MoonLod.ts:73` and `skyState.ts:113` (`chunkArcWidth·0.75 + HEIGHT_SLACK 420`) @ fe2b6f4
- Claim: C3.
- Evidence (probe P3): max vertex distance from the node origin, including the skirt drop, compared with `brad`:

  | Level | max extent / brad (m) | ratio |
  |---|---|---|
  | L0 | 1,323 / 2,028 | 0.65 |
  | L1 | 824 / 1,224 | 0.67 |
  | L2 | 524 / 822 | 0.64 |
  | L3 | 309 / 621 | 0.50 |
  | L4 | 234 / 520 | 0.45 |

  - The bound holds: no culled L4 centre was visible over the sphere at 1.4–1,000 m or 10 km.
  - There was 1/639 at 3 km (suspected, centre-over-bare-sphere test only).
- Impact:
  - `layerMaskFor(d − brad, d + brad)` spans ±520 m for an L4 chunk that is ±234 m. Chunks get both NEAR and MID bits more often than needed, so they are drawn twice.
  - This makes the A1-U21-2 Near/Mid overlap inversion region larger.
  - The fixed 420 m `HEIGHT_SLACK` dominates at fine levels.
- Proposed fix: per-node `brad` from the actual min/max height of the chunk (the worker can return it), plus skirt depth.
- Fix task size: one session; fold it into the U22-2 or A1-U21-2 fix.

### A1-U22-4 — Spawn search: early exit unreachable (always 24,000 iterations), flat sites skipped, roughness probes not tangent
- Severity: S3     Confidence: confirmed
- Category: play
- Location: `play/world/spawn.ts:114, 117–126` @ fe2b6f4 (a verbatim copy of the M1F harness `findSpawn`)
- Claim: C5. The search stops at a good site (`score < 0.35`) and scores roughness around the candidate.
- Evidence (probe P1):
  - `slope < 0.01°` candidates are skipped, so any scored site has `score = slope·40 + dev ≥ 0.4 > 0.35`. The break can never fire.
    - The search always runs all 24,000 samples: 160 ms at boot. The chosen score is 16.5.
    - The "skip slope < 0.01" condition also throws away the flattest sites, the ones the search is looking for.
  - The 4 roughness probes offset the direction along world x/z, not the local tangent plane.
    - At the spawn, the smallest tangential share of a probe offset is 0.66. At direction (1,0,0) it falls to 0.39, so the probes lose spread near the ±x/±z axes and under-measure roughness there.
  - The result does give the intended earthrise: Earth 8.7° and Sun 36.4° above the horizon. It is deterministic and matches the `test-play-spawn` pin to 1e-9.
- Impact: a boot-time cost and a weaker search. The spawn itself is fine.
- Proposed fix:
  - Drop the `slope < 0.01` skip, or make the break threshold reachable.
  - Build the probe offsets from a tangent basis.
  - Note: this changes the spawn pin used by `test-play-spawn`/`test-play-lod`, so re-pin it in the same commit.
- Fix task size: well under one session.

## Checked, no issue
- **Terrain vs the core shell and the KCC bound (C4):** play Moon height over a 6 × 401² grid is −80.8 / +282.5 m.
  - That is inside the shell depth of 400 m below R and below `MAX_TERRAIN_H` 360.
  - The KCC height bound that A1-U14-2 found broken for m1e holds for the play Moon.
- **Horizon cull soundness:** `brad` bounds every vertex and skirt at L0–L4 (U22-3), and no culled L4 node centre is visible over the bare sphere at 1.4 m – 1 km and 10 km.
- **Spawn determinism and earthrise geometry:** see U22-4. The boot order holds: initTerrainField before MoonLod and the spawn; syncEntity after teleport so the origin rebases before the first frame.
- **`isSelectedLeaf`:** it correctly excludes the stale-`desired` children that the harness merge leaves behind (A1-U06 harness S2). `residentAround` is consistent with it.
- **`applySkyState`:**
  - The harness per-call Quat allocation was replaced by a module scratch.
  - The terrain loop uses the spin quat before reading chunk origins (the port gotcha it notes).
  - Records not in state 2 get mask 0.
- **Boot sky geometry:**
  - `earthDir`/`sunDir` come from the f64 rails and are moon-centred.
  - The Earth mesh is placed at `earthVec − origin`.
  - The play layer uses moon-centred coordinates consistently (observer = moonAbs + origin + local).
- **Dispose path:** it terminates the workers, frees the pool, impostor, shell, Earth and glow geometry, disposes the animator and unregisters the entity.

## Already reported elsewhere (not duplicated)
- Frozen sky (`setTimeScale(0)`, Earth/Sun lights fixed at boot): A1-U13-1.
- `syncEntity`/`respawnPlayer` tick the core directly: A1-U13 (S3).
- Earth has no impostor slot and no mesh↔impostor handoff in play: A1-U21-1.
- Adapter re-register / focus: A1-U11-1/2.
- Mesh pool meshCount vs worker sets: A1-U20-1.

## Seeds for later units
- **U23:**
  - The camera clearance (`camClearance` 0.4 m, analytic samples) inherits U22-1. The camera can sit inside drawn bumps or float over drawn dips by metres. Check `play/camera` against the drawn surface.
  - The controller tolerance seam: A1-U13-2.
- **U26:** the play layer runs entities in a moon-centred frame inside a SimulationCore whose rails are heliocentric. It works only because the sky is frozen. A rotating, orbiting Moon needs the parented-frame compose (A1-U13-1).
  - LOD budget (U22-2), collision/render surface (U22-1) and brad (U22-3) are one "terrain service" design question: a single height source sampled by physics, LOD and culling.