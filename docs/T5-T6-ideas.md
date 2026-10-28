# Making the Moon better — ideas for T5 / T6 (read-only review, session 153c)

Quality bar: SOLARIS is a publishable AAA browser game (AGENT_BRIEF §13). Everything below is the minimum for that bar, not optional polish; planners turn it into steps with gates.

These notes are based on the code at `dd1c8ed` (`game/src/play/world/*`, `core/terrain/terrainField.ts`, `render/*`), on ADR-028 and on the Lead's rulings of 2026-10-22 and 2026-10-28. No code was changed. Computed numbers are marked (calc).

## 1. What "real size" (T5, R = 1,737 km) breaks — fix these first

| Today (R = 1,364.5 m) | At R = 1,737 km | What to do |
|---|---|---|
| Horizon is 68 m away at eye height 1.7 m; ground drops 0.9 m at 50 m (calc) | Horizon is about 2.4 km away; the drop at 50 m is 1 mm (calc), so the "curve right in front of you" is gone | This is the goal of T5. Peaks remain visible from much farther away (a 3 km peak can be seen from about 100 km), so the LOD must reach roughly 100 km |
| `MoonLod`: `MAX_LEVEL` 4 with 341 nodes per face, all preallocated; `GRID_N` 32 | A level-4 chunk is about 170 km wide, which makes quads about 5 km (calc). About 2 m quads need `MAX_LEVEL` ≈ 15 (calc) | Grow the quadtree lazily from a node pool, with `MAX_LEVEL` derived from R. The pins in `test-play-lod` (341 nodes per face, 2,046 total) will change |
| `NORMAL_EPS` = 0.002 rad is fixed | 0.002 rad is about 3.5 km of arc (calc), so normals would ignore every crater and rock | Use a level-matched epsilon or analytic normals. This is already fix task F5b (A1-U14-1) and is a hard prerequisite for T5 |
| `MAX_TERRAIN_H` 360 and `HEIGHT_SLACK` 420 are typed by hand | Wrong as soon as amplitudes change | Derive both from the params (A1-U14-3, F5b) |
| Noise frequencies are per unit direction (detailFreq 22, crater lattice F 9 / F 32) | Detail at frequency 22 becomes about 80 km features. Crater cells at F 9 are about 190 km, so r 18–60 m craters become rare dots | Rebuild the profile in metres: crater layers on a power-law size ladder (N(>D) ∝ D⁻², from about 50 km basins down to about 2 m pits, each layer with its own lattice), plus metre-scale fBm |
| `rimAmp0` 25 m and `floorHeight` −25 m | Basins with a 0.7 rad radius span about 1,200 km. Real maria are like this, but rims need km-scale relief | Scale the rim and floor in km, and keep the spawn on a flat mare floor (good for walking) |
| `MID_FAR_LIMIT` is 300 km; floating-origin rebase every 1,024 m | Fine for on-foot play | Keep. Check that a whole-Moon view from orbit still composes |
| Terrain evaluation already costs 1.88× pre-T3 (ADR-028), on 2 workers | More crater layers cost more per vertex | Prune per layer (chord distance plus cell box, as today), use 4 workers if the CPU allows, and keep the frame-time gate |

**Gameplay at real size.** Walking at 3.2 m/s, reaching the horizon takes about 12 minutes (calc). Put points of interest within 200–800 m of the spawn (§2), and consider a faster mode later: a jetpack boost on the existing RCS, or a rover.

## 2. Look and feel (T6) — first items

1. **Colour bug.** `MOON_TERRAIN_COLOR = 0x7d8a6f` is green-grey (R125 G138 B111), but the 2026-10-28 ruling asks for neutral grey. Use something like `0x8a8a88`, with mare at ×0.6 as today.
2. **Black shadows.** The ambient light is `0x2a3850` at intensity 0.5 (blue fill). The photos show near-black shadows. Drop the ambient to about 0.03–0.08 and keep earthshine (`earthLight` 0.28) as the only fill.
3. **No shadows exist.** There is no `castShadow` or `receiveShadow` anywhere in `play/` or `render/`. Add a sun shadow map near the player, so the astronaut, boulders and lander cast sharp shadows. Large-scale terrain shadows (crater floors at the terminator) need a horizon-map or ray-marched height approach, which is a bigger item.
4. **Low sun.** The Sun is 36.41° above the spawn horizon. "Long black shadows" need about 5–15°. Pick a spawn near the terminator, or a sun direction at about 10°.
5. **Lunar surface shading.** A Lommel-Seeliger/Hapke-style BRDF gives the flat, limb-bright look and the opposition surge (brightening when the Sun is behind you) seen in Apollo photos. It is a shader injection like ADR-029.
6. **Ray craters.** A few young craters can get a bright albedo ray mask in the same shader pass as the mare mask.
7. **Close-up detail.** Add triplanar detail noise or a texture for regolith grain within about 30 m, plus footprint decals and dust kicked up ballistically (no air means pure parabolas and no billowing — very lunar).

## 3. Objects (Lead ruling c: boulder fields, glowing minerals, crashed lander)

- **Boulders.** Scatter them as instanced meshes, deterministically, on the same crater lattice as the terrain (ejecta near rims), so they agree with the craters. Collision: the KCC only knows analytic terrain. Rocks under the 0.5 m step height can be decorative; larger ones need obstacle support in the KCC (a core edit, so an ADR and the default-trace gate).
- **Glowing minerals.** Emissive instanced crystals. Bloom needs a post-processing pass, so first check that the fixed library set allows one.
- **Crashed lander.** One CC0 GLB with its source URL recorded, placed 200–400 m from the spawn as the first goal, with a simple collision proxy (same KCC obstacle need as boulders).

## 4. Suggested order

- **T5:** F5b normals and height bound, then a lazy LOD sized from R, then the metre-scale crater ladder, then R = 1,737 km with the spawn re-derived and the gates re-pinned.
- **T6:** colour and ambient, then sun shadows and a low sun, then the BRDF and rays, then objects (boulders, lander, crystals), then detail, dust and sound.
