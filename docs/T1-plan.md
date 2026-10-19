# T1 — PLAYABLE MOON (plan)

- Task: T1 playable moon · Branch: `t1-playable-moon` · Stage: PLANNING
- Last updated: 2026-10-19
- Resume at the FIRST UNCHECKED BOX below (planning item now; build step once
  BUILDING). When all 7 are checked: stage READY, update the tracker, STOP at
  the LEAD GATE (AGENT_BRIEF.md §4).

## PLANNING CHECKLIST
- [x] Goal
- [x] Scope IN
- [x] Scope OUT
- [x] Affected modules
- [ ] Steps
- [ ] Verification per step
- [ ] Risks & open decisions

## GOAL
A playable moon: a new game page (`?page=moon`) where the player-controlled
astronaut walks on the moon's terrain — WASD / sprint / crouch / jump input,
third-person orbit camera with first-person toggle (pointer-lock mouse look),
analytic ground collision (the KCC against the streamed heightfield — never
falls through), floating-origin rebasing while walking, and the moon's true
low gravity (g = 1.62 m/s², catalog). This is the first GAME page (not a test
harness) and becomes the wiring template for all later game pages.

## SCOPE IN
- New page module `game/src/game/MoonGame.tsx`, registered as `moon` in the
  `main.tsx` static map (full-page-load rule) + a menu link in `App.tsx`.
- New `game/src/game/moonConfig.ts`:
  - `MOON_TERRAIN: TerrainParams` — radius 1364.5 (catalog `radiusGame`),
    initial noise amps/freqs tuned by eye during the build.
  - `MOON_ASTRONAUT: AstronautConfig` — planetRadius 1364.5, planetMu =
    1.62·1364.5² ≈ 3.0162e6 (computed from the catalog, WHY-commented, never
    hand-tuned), gravityRange 8187 (catalog), spinOmega = 2π/3072
    (tidally-locked game day), maxTerrainHeight ≥ actual terrain amp sum.
- Boot + frame wiring after the proven 1E-harness pattern, minus the suite:
  SimulationCore (entity + focus + write-through), FloatingOriginAdapter,
  TerrainMeshPool + a per-page quadtree LOD controller (per-page duplication
  is the established pattern), astronaut mesh, stars + directional sun +
  ambient light, deterministic flat-site spawn scan at boot, fixed-step 1/60
  accumulator (F-07 pattern) driving `kcc.update` + `core.advance` in
  lockstep, TP camera with boom terrain clamp + FP toggle, minimal telemetry
  HUD + control legend.
- `notes/CHANGES.md` entry + `// WHY:` comments at every non-obvious choice.

## SCOPE OUT
- NO 1F sky rig (impostors, layered cameras) — plain starfield + sun light;
  sky/atmosphere beauty is a later task. NO Rapier or any physics lib.
- NO edits to any `src/core` module or ratified constant (config-only
  consumption of the engine). NO EVA/ship boarding, saves (1G), portals,
  aerodynamic drag, damage/audio/fuel.
- NO acceptance suite on the page (it is a game page, not a harness) —
  verification is this plan's per-step checks + the m1 regression run.
- NO terrain-system work: moon noise params are initial values tuned by eye,
  not a change to the terrain field system.

## AFFECTED MODULES
- NEW: `game/src/game/moonConfig.ts`, `game/src/game/MoonGame.tsx`
  (the LOD controller may live in `game/src/game/moonLod.ts` — same
  page-module ownership either way).
- EDIT: `game/src/main.tsx` (static map entry), `game/src/App.tsx` (menu).
- READ-ONLY engine deps: `core/simulation/SimulationCore.ts`,
  `core/physics/astronautKCC.ts` + `sphericalFrame.ts`,
  `core/terrain/terrainField.ts` + `spherify.ts` + `noise.ts`,
  `workers/terrainWorker.ts` (via the pool), `render/TerrainMeshPool.ts` +
  `FloatingOriginAdapter.ts`.
- Process: `notes/CHANGES.md`, `docs/T1-plan.md`, `notes/task.md`,
  `notes/STATE.md`.

