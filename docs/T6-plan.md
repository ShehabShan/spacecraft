# T6 — LOOK-AND-FEEL OVERHAUL (MOON + CHARACTER TO AAA) — PLAN

- Task: T6 · Branch: `t6-look-and-feel` (cut from `main` @ 787b9d4, session 159); track
  branches `t6-<track>` are cut from it at READY (`notes/T6-STATE.md`)
- Stage: PLANNING (4/7 sections)
- Last updated: 2026-10-29 (session 160)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [ ] Steps ·
  [ ] Verification per step · [ ] Risks & open decisions

## 1. Goal
Bring the play Moon (`/?page=play`) and the astronaut to shipped AAA look and feel.
The open Moon stays stark and real: neutral grey regolith, black shadows, a low sun and a
lunar BRDF. Close-up regolith, footprints and ballistic dust are added. The suit, visor
and low-g animation reach the same bar, and the player hears breathing, suit-conducted
footsteps, radio and a soft score. The fairy-tale warmth lives in a few reachable set
pieces: an outpost, a greenhouse dome with trees and a pond, and a crystal cave.
T6 runs as six parallel tracks merged through `t6-look-and-feel` (Lead rulings 1–3,
2026-10-29). Matrix M stays green throughout, and frame time stays inside the budget
in §6.

## 2. Scope IN
- **T6-core** (on `t6-look-and-feel`, before any track): named hooks and registration
  points in the shared frame, scene, shell and terrain-shader code, so that tracks add
  files instead of editing the same lines. Also the asset gate (§4.3).
- **Light** (`t6-light`): neutral-grey albedo (≈ `0x8a8a88`, mare ×0.6); ambient light
  ≤ 0.08 with earthshine as the only fill; a sun shadow map near the player; a low sun at
  the spawn; a Lommel-Seeliger/Hapke-style BRDF with opposition surge; terrain-scale
  (horizon-map) shadows; tone mapping, exposure and bloom.
- **Surface** (`t6-surface`): bright ray masks on young craters; triplanar regolith
  detail within ~30 m; footprint decals; ballistic dust thrown as pure parabolas with no
  drag.
- **Character** (`t6-character`): an ADR choosing between the upgraded procedural rig
  and a rigged CC0 GLB. Then the suit model and PBR materials, a visor that reflects the
  sky and Earth, a low-g lope and skip, walk and run, and jump anticipation and landing.
  If the Lead keeps the default for question Q2 (§7), a jetpack boost on the existing
  RCS.
- **Objects** (`t6-objects`): static obstacle support in the KCC (core edit, with an
  ADR and the kcc-default-trace gate); boulder fields placed deterministically on the
  crater lattice; emissive crystals; a crashed lander 200–400 m from the spawn as the
  first goal.
- **Audio** (`t6-audio`): a Web Audio engine started on the CLICK_TO_PLAY gesture; helmet
  breathing driven by exertion; muffled footsteps and landing thumps from KCC contact;
  radio chatter and static; a soft adaptive score in which silence is followed by sound
  at landmarks.
- **World** (`t6-world`): a set-piece placement framework on naturally flat sites; outpost
  houses with warm window light; a greenhouse dome with large *Moon Fairy Tale*-style trees
  and a pond; a glowing crystal grotto; far landmarks that can be seen and reached.
- **Integration**: track merges into `t6-look-and-feel` (§6.2), and the T6 close-out
  that merges into `main`.

## 3. Scope OUT
- T5 work: radius, terrain field, LOD, crater ladder, spawn re-derivation. T6 consumes
  T5's results and never edits them on a track branch.
- 1G saves (deferred), F3b (comes after T6), the parked 1F round-7 ruling.
- Rapier or any physics library. KCC obstacles stay analytic (brief §3).
- New npm dependencies. Everything T6 needs ships with the existing `three` package or
  the browser: `three/examples/jsm` postprocessing, GLTFLoader with meshopt, and Web
  Audio. A track that finds a real need for a new library STOPs and asks the Lead.
- Other bodies' surfaces (Earth, planets), the rover, missions, inventory, multiplayer.
- Walkable caves under the analytic terrain. The crystal cave is a grotto built on the
  surface (an arch or overhang with obstacle proxies), not a void inside the height
  field.
- Retuning ratified constants (KCC step/slope, speed cap, camera bands, impostor
  hysteresis) except under brief §13 with an ADR.
## 4. Affected modules (file ownership, hooks, assets, ADR ranges)
Paths in §4–§6 are relative to `game/` unless they start with `docs/` or `notes/`.

### 4.1 File ownership
A track edits only the paths in its row, its own notes file `notes/T6-<track>.md`, and its
own plan boxes. A path marked *(new)* is created by its owner. Paths that no row names are
**integration-only**: only the T6-core or an integration session edits them, and a track
that needs a change there writes the request into its notes file. All tracks may add tests
named `tools/test-t6-<track>-*.mjs` and evidence named `docs/evidence/<task>/<step>.txt`.

| Owner | May edit |
|---|---|
| T6-core / integration | `src/play/frame/playFrame.ts`, `src/play/world/moonWorld.ts`, `src/play/PlayPage.tsx`, `src/play/ui/shellRuntime.ts`, `src/play/ui/Hud.tsx`, `src/play/t6/` hook files *(new)*: `frameHooks.ts`, `sceneContributors.ts`, `footEvents.ts`, `placement.ts`, `hudSlots.ts`, `shaderSlots.ts`; `tools/check-assets.mjs` *(new)*; `notes/T6-STATE.md` |
| Light | `src/play/t6/light/**` *(new)*, `src/play/world/lighting.ts` *(new, moved out of moonWorld by C1)*, `src/play/render/postPipeline.ts` *(new)*, `src/play/world/spawn.ts` (sun-height criterion only), `src/play/world/moonMaterial.ts` (base colour and the BRDF slot body only) |
| Surface | `src/play/t6/surface/**` *(new)* (ray, detail and footprint shader chunks, decal pool, dust pool), `src/assets/surface/**` *(new)* |
| Character | `src/play/character/**`, `src/play/t6/character/**` *(new)*, `src/play/controller/PlayerController.ts` (jetpack only, Q2), `src/assets/character/**` *(new)* |
| Objects | `src/core/physics/astronautKCC.ts` (obstacle query only), `src/core/physics/obstacles.ts` *(new)*, `src/play/t6/objects/**` *(new)*, `src/assets/objects/**` *(new)* |
| Audio | `src/play/t6/audio/**` *(new)*, `src/assets/audio/**` *(new)* |
| World | `src/play/t6/world/**` *(new)*, `src/assets/world/**` *(new)* |

T5 owns the terrain field, LOD, terrain workers, `moonConfig.ts` and the spawn search.
T6 tracks never edit them. The Light track's sun-height criterion in `spawn.ts` is
written after T5 merges, on top of T5's spawn.

### 4.2 Hooks built by T6-core (registration points)
Every hook is registered at boot. Per frame, a hook runs over a fixed-length array and
allocates nothing (brief §3 zero-GC). Each hook has a test row in `tools/test-t6-hooks.mjs`
*(new, C1)*.
- **Frame hooks** (`src/play/t6/frameHooks.ts`): named slots that `playFrame` calls at fixed
  points of the canonical stage order, which is never reordered: `afterTelemetry` (after
  stage 7: audio, dust, footprints), `afterCamera` (after stage 8: shadow fit, visor
  environment, listener pose), `beforeRender` (after stage 10: post pipeline uniforms). A
  slot receives the shared read-only telemetry and the frame `dt`.
- **Scene contributors** (`src/play/t6/sceneContributors.ts`): `{ id, mount(world),
  dispose() }`. `createMoonWorld` mounts them after its scene graph is built, and dispose
  runs them in reverse order. C1 pre-creates one stub file per track, `src/play/t6/<track>/register.ts`,
  and lists all six in the manifest. A track then edits only its own `register.ts`, never
  the manifest.
- **Shader slots** (`src/play/t6/shaderSlots.ts`): the ADR-029 terrain-shader injection gets
  named, ordered chunks: `albedo` (Surface: rays and detail), `brdf` (Light), `decal`
  (Surface: footprints) and `shadowing` (Light). Each slot is empty by default, and an empty
  slot compiles to today's shader byte for byte.
- **Foot events** (`src/play/t6/footEvents.ts`): a boot-allocated ring buffer of foot-plant,
  lift-off, jump and landing events (foot, render-local position, speed, landing speed).
  The animator is its only producer; Audio and Surface consume it. C3 drives it from the
  current `ProceduralAnimator`, and Character later refines the timing.
- **Placement reservations** (`src/play/t6/placement.ts`): set pieces and the lander reserve
  discs (centre, radius). Boulder scatter skips reserved discs. The flat-site finder reads the
  analytic terrain only.
- **Post pipeline seam** (`src/play/render/postPipeline.ts`, a C2 pass-through, owned by
  Light from then on): `registerEmissive(material)` for bloom candidates (Objects, World)
  and `setExposureHint(...)`. Until Light builds the real pipeline, it renders exactly as
  today.
- **Shell phase** (`shellRuntime.ts`): `onPhase(cb)` fires on phase changes. Audio unlocks
  its AudioContext on the first CLICK_TO_PLAY → PLAYING transition, which comes from a
  user gesture.
- **HUD slots** (`src/play/t6/hudSlots.ts`): small named HUD readouts (jetpack fuel, radio
  caption), published through the existing ≤ 10 Hz HudPublisher.

### 4.3 Asset policy and gate
- CC0 only (Lead, 2026-10-28). Each `src/assets/<track>/` folder has an `ASSETS.md`
  manifest with one row per file: file · source URL · author · licence (CC0 1.0) · bytes ·
  SHA-256 · edits made. Procedural content (noise textures, synthesised audio, generated
  meshes) is preferred and needs no manifest row.
- Formats: textures as KTX2/Basis, or WebP for small ones; meshes as GLB with meshopt;
  audio as Opus with an AAC fallback. The Audio track decides the final audio formats in
  an ADR.
- Repo-size budget (ADR-030 brought the tree to 1.78 MB): at most 1.5 MB per file and
  12 MB of T6 binaries in total. An asset that would break the budget is a hard stop
  (brief §9): write the options and ask the Lead. Never commit a source or authoring file
  (`.blend`, `.wav` masters).
- Gate `tools/check-assets.mjs` *(new, C3)*: every binary under `src/assets/` has a complete
  manifest row whose SHA matches the file, and the per-file and total budgets hold. It
  joins matrix M at C3.

### 4.4 ADR number ranges
T5 keeps ADR-031–039. T6-core and integration use 040–044, Light 045–049, Surface 050–054,
Character 055–059, Objects 060–064, Audio 065–069 and World 070–074. A track that runs out
of numbers asks the integration session for a new block (075 and up). It never takes a
number from another track's range.
