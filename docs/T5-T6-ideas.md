# T5 / T6 inputs — bigger Moon and look-and-feel (review session 153c, polished session 156c)

Quality bar: SOLARIS is a publishable AAA browser game (AGENT_BRIEF §13). Everything below is the minimum for that bar, not optional polish. Planners turn it into steps with gates and decide the technical design (§13). Nothing here is a commitment until a plan says so.

Sources: the Lead's rulings in `notes/LEDGER.md` dated 2026-10-28: directive 150d, rulings (a)–(d) 150e, style reference 150f, neutral grey 150g and the order ruling 155. Ruling (b), real size, supersedes the 2026-10-22 ruling "keep the small play Moon". Code facts were re-checked on `main` 787b9d4 in session 156c, in `game/src/play/world/MoonLod.ts`, `game/src/play/world/moonConfig.ts`, `game/src/play/world/moonMaterial.ts`, `game/src/play/world/moonWorld.ts` and `game/src/core/terrain/terrainField.ts`. Numbers marked (calc) are computed, not measured.

## 0. Prerequisites — open U27c fix tasks (`docs/audit/U27c-fix-tasks.md`)

| Fix | What | Why T5 needs it |
|---|---|---|
| F5a | `TerrainField` per-body instance + allocation-free height/normal service | The terrain service is rebuilt for R = 1,737 km anyway. F5a is also what turns the plain alloc-gate green; it is red until F5a (ADR-002) |
| F5b | Analytic or level-matched normals; height bound derived from params (A1-U14-1, A1-U14-3) | The fixed `NORMAL_EPS` is unusable at real size (§1). Depends on F5a and F2d (F2d is done) |
| F5c | Drawn and collision terrain agree near the actor (U22-1) | The feet must sit on the drawn ground at every LOD. Its "lower relief" item (2026-10-22) is retuned by the new crater ladder |
| F5d | Mesh pool ≤ worker sets, drop accounting, LOD leaf budget with coarser fallback (U20-1) | The lazy LOD needs a leaf budget |

The T5 planner decides, with an ADR, whether to fold F5a–F5d into T5 steps or to run them first as separate fix tasks. Either way they land before R changes.

## 1. What "real size" (T5, R = 1,737 km) breaks — fix these first

| Today (R = 1,364.5 m) | At R = 1,737 km | What to do |
|---|---|---|
| The horizon is 68 m away at eye height 1.7 m, and the ground drops 0.9 m at 50 m (calc) | The horizon is about 2.4 km away and the drop at 50 m is 1 mm (calc), so the curve right in front of the player is gone | This is the goal of T5. A 3 km peak is visible from about 100 km, so the LOD must reach about 100 km |
| `MoonLod`: `MAX_LEVEL` 4, `NODES_PER_FACE` 341 preallocated, `GRID_N` 32 | A level-4 chunk is about 170 km wide, so quads are about 5 km (calc). Quads of about 2 m need `MAX_LEVEL` ≈ 15 (calc) | Grow the quadtree lazily from a node pool, with `MAX_LEVEL` derived from R and a leaf budget (F5d) |
| `NORMAL_EPS` = 0.002 rad, fixed | 0.002 rad is about 3.5 km of arc (calc), so normals would ignore every crater and rock | Use analytic or level-matched normals (F5b) |
| `MAX_TERRAIN_H` 360 and `HEIGHT_SLACK` 420 are hand-typed | Both are wrong as soon as the amplitudes change | Derive them from the params (F5b) |
| Noise frequencies are per unit direction: detailFreq 22, crater lattice F 9 / F 32 | Frequency 22 gives features about 80 km across. F 9 crater cells are about 190 km, so r 18–60 m craters become rare dots | Rebuild the profile in metres: crater layers on a power-law size ladder (N(>D) ∝ D⁻²) from about 50 km basins down to about 2 m pits, each layer on its own lattice, plus metre-scale fBm |
| `rimAmp0` 25 m, `floorHeight` −25 m | A basin with a 0.7 rad radius spans about 1,200 km. That matches real maria, but the rims need km-scale relief | Scale rim and floor heights in km. Keep the spawn on a flat mare floor, which is good for walking |
| float32 vertex positions near 1.4 km have a 0.0001 m step (calc) | Near 1.7e6 m the float32 step is 0.125 m (calc), so vertices visibly jitter | Keep every GPU position chunk-local or camera-relative, and add a gate for it. Check how `MoonLod` builds positions today |
| `MID_FAR_LIMIT` 300 km; floating-origin rebase every 1,024 m | Fine for on-foot play | Keep. Check that a whole-Moon view from orbit still composes |
| Gate pins assume the small Moon: `test-play-lod` (341 nodes per face, 2,046 total), spawn, KCC and m1e/m1f pinned values | They will fail for the right reasons | Re-pin under §13 safeguard 3: each replacement gate lands before the old one retires, and every re-pin is listed in its step's commit |
| Terrain evaluation already costs 1.88× pre-T3 (ADR-028), on 2 workers | More crater layers cost more per vertex | Prune per layer (chord distance plus cell box, as today), use 4 workers if the CPU allows, and keep the frame-time gate (safeguard 4: before/after numbers) |

**Gameplay at real size.** At 3.2 m/s, walking to the horizon takes about 12 minutes (calc). Points of interest go within 200–800 m of the spawn (§4). A faster travel mode is an open question (§5).

## 2. Look and feel (T6) — Moon

1. **Colour bug.** `MOON_TERRAIN_COLOR = 0x7d8a6f` is green-grey (R125 G138 B111). The Lead ruled neutral grey (150g). Use something like `0x8a8a88`, with mare at ×0.6 as today.
2. **Black shadows.** The ambient light is `0x2a3850` at intensity 0.5, a blue fill, but the photos show near-black shadows. Drop the ambient to about 0.03–0.08 and keep earthshine (`earthLight` 0.28) as the only fill.
3. **No shadows.** No `castShadow` or `receiveShadow` exists in `game/src/play` or `game/src/render`. Add a sun shadow map near the player so the astronaut, boulders and lander cast sharp shadows. Large-scale terrain shadows (crater floors at the terminator) need a horizon map or ray-marched height, which is a bigger item.
4. **Low sun.** The Sun is 36.41° above the spawn horizon, and long black shadows need about 5–15°. Pick a spawn near the terminator or a sun at about 10° (§5).
5. **Lunar BRDF.** A Lommel-Seeliger/Hapke-style BRDF gives the flat, limb-bright look and the opposition surge seen in Apollo photos. It is a shader injection like ADR-029.
6. **Ray craters.** Give a few young craters a bright albedo ray mask in the same pass as the mare mask.
7. **Close-up detail.** Triplanar detail noise or a regolith texture within about 30 m, footprint decals, and dust thrown ballistically (pure parabolas with no billowing, because there is no air).
8. **Sound (ruling d).** There is no Web Audio code in `game/src` (grep for `AudioContext`, 156c). Needed:
   - in-helmet breathing;
   - footsteps on KCC ground contact, muffled because in vacuum they are heard only through the suit;
   - radio chatter and a soft ambient score.
   Assets are CC0 only, with the source URL recorded per file. Browsers block autoplay, so start audio on the CLICK_TO_PLAY gesture.

## 3. Look and feel (T6) — character (order ruling 155: "Moon and character look AAA")

The astronaut must meet the same bar: model, suit materials, helmet visor reflection, and animation for walk, run, the low-g lope or skip seen in Apollo footage, jump and landing. The planner first reads the current rig and animation modules (gates `test-play-rig`, `test-play-anim`). It then decides, with an ADR, between upgrading the current rig and moving to a rigged CC0 GLB with its source URL recorded.

## 4. Objects (ruling c: boulder fields, glowing minerals, crashed lander)

- **Boulders.** Scatter them as instanced meshes, deterministically, on the terrain's crater lattice (ejecta near rims), so they agree with the craters. The KCC only knows analytic terrain. Rocks under the 0.5 m step height can be decorative; larger ones need obstacle support in the KCC, which is a core edit needing an ADR and the default-trace gate.
- **Glowing minerals.** Emissive instanced crystals. Bloom needs a post-processing pass, so first check that the fixed library set allows one.
- **Crashed lander.** One CC0 GLB with its source URL recorded, placed 200–400 m from the spawn as the first goal, with a simple collision proxy. It has the same KCC obstacle need as boulders.

## 5. Open look-and-feel questions (ask the Lead in plain language with the default, §9/§13)

| Task | Question | Suggested default |
|---|---|---|
| T6 | Size of Earth in the sky. The 2026-10-22 ruling kept the oversized Earth (14.7°) on purpose; the 150f photo traits list a "small crescent Earth", but those are orbital views | Keep the large Earth |
| T6 | Faster travel at real size | A jetpack boost on the existing RCS; a rover is a later extra |
| T6 | Sun height at the spawn | About 10°, for long black shadows |

T5 has no open look-and-feel question: real size and real g are ruled (b), and the technical choices are the planner's.

## 6. Suggested order

- **T5:** F5a → F5b normals and height bound → lazy LOD sized from R with leaf budget (F5d) → metre-scale crater ladder → chunk-local positions → R = 1,737 km with the spawn re-derived, gates re-pinned and F5c agreement checked.
- **T6:** colour and ambient → sun shadows and low sun → BRDF and rays → character (model, animation) → objects (boulders, lander, crystals) → close-up detail and dust → sound.
- **After T6:** F3b (order ruling 155).