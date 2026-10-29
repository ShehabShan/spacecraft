# T6 — LOOK-AND-FEEL OVERHAUL (MOON + CHARACTER TO AAA) — PLAN

- Task: T6 · Branch: `t6-look-and-feel` (cut from `main` @ 787b9d4, session 159); track
  branches `t6-<track>` are cut from it at READY (`notes/T6-STATE.md`)
- Stage: READY (7/7 sections, session 160). LEAD GATE: build only on the Lead's order
  ("execute the T6 plan"); the first build step is C1 (§5.0)
- Last updated: 2026-10-29 (session 160)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

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

## 5. Steps
Each box is one 50-OLU session that finishes, verifies, commits and pushes (brief §12).
A step that will not fit is split into `<id>a` and `<id>b` in place. "M" means matrix M,
listed in §6.1. Each step's commit carries one evidence summary (≤ 5 KB) at
`docs/evidence/<T6>/<id>.txt`. A track session creates that directory with its first
summary.

### 5.0 T6-core (serial, on `t6-look-and-feel`, before any track branch is cut)
- [ ] **C1** Hook scaffolding: `frameHooks`, `sceneContributors` (with the manifest and six
  stub `register.ts` files), `footEvents` (the ring only), `placement`, `hudSlots`. Wire them
  into `playFrame.ts` and `moonWorld.ts`, and move the lights unchanged into
  `world/lighting.ts`. New `tools/test-t6-hooks.mjs`. Gate: M green with no re-pins, and
  `test-alloc-gate` plain unchanged. Empty hooks change no frame output
  (`test-play-frame` 26/26).
- [ ] **C2** `shaderSlots` on the ADR-029 injection, the `postPipeline` pass-through and
  shell `onPhase`. Gate: with every slot empty, the shader source equals the pre-C2 source
  byte for byte (new `test-moon-material` row); M green. ADR-040 (T6 hook architecture).
- [ ] **C3** Drive the foot events from `ProceduralAnimator`. Add `tools/check-assets.mjs`
  (with `--self-test` mutants: missing row, SHA mismatch, over budget) and the `ASSETS.md`
  template, and add the gate to M. Gate: M green; event counts in a scripted walk match
  the animator's plants. **Then the track branches may be cut.**

### 5.1 Audio (`t6-audio`) — may start after C3, before T5 merges
- [ ] **A1** Engine: an AudioContext unlocked through `onPhase`, master and helmet buses
  (suit-conduction low-pass), a boot-allocated voice pool, a mute/volume control. ADR-065
  covers formats and the engine. Gate: `test-t6-audio-engine` (OfflineAudioContext render,
  no node created per frame); no AudioContext before the gesture.
- [ ] **A2** Helmet breathing driven by exertion (speed, jumps, landings), relaxing at
  rest. Gate: the breath rate tracks a scripted exertion curve; rendered loudness stays in
  range.
- [ ] **A3** Suit-conducted footsteps and landing thumps from foot events, scaled by
  landing speed. Vacuum rule: no airborne sound from the world. Gate: one sound per
  plant, ±1 frame; the landing gain is monotone in landing speed.
- [ ] **A4** Radio chatter and static (strict CC0 by default, Q4) with a HUD caption slot,
  spaced and never overlapping. Gate: the scheduler test, `check-assets`.
- [ ] **A5** Adaptive score: silence on the open Moon, then layers that swell near
  placement-registered landmarks; final mix. Gate: score state over a scripted route; the
  perf row shows audio time ≤ 0.5 ms per frame.

### 5.2 Character (`t6-character`) — may start after C3, before T5 merges
- [ ] **K1** Read the rig and animation modules. Measure the cost of the current rig
  against a rigged CC0 GLB candidate, and record the choice in ADR-055. Gate: M green;
  the evidence holds the measurement.
- [ ] **K2** Suit model and PBR materials (fabric, backpack, hoses, gold visor), per
  ADR-055. Gate: `test-play-rig` re-pinned with a reason; draw calls and triangles within
  the §6.3 budget.
- [ ] **K3** A visor that reflects the sky, Earth and Sun (an environment map built at
  boot and refreshed on a slow cadence). Gate: no per-frame allocation; perf row.
- [ ] **K4** Low-g locomotion: the Apollo lope and skip, and walk and run blends driven
  by speed and slope. Foot-event timing comes from the gait. Gate: `test-play-anim` rows
  for gait phase and foot plants; no foot sliding above 5 cm per plant.
- [ ] **K5** Jump anticipation, an air pose, and landing compression scaled by landing
  speed. Gate: `test-play-anim` rows per state; the anim state machine has no stuck
  state.
- [ ] **K6** (only if Q2 stays the default) A jetpack boost on the existing RCS: thrust and
  fuel in the controller, a plume visual, a fuel HUD slot. Gate: `test-play-controller`
  rows (fuel bounds, no thrust when empty); `test-kcc-default-trace` unchanged with the
  boost unused.

### 5.3 Light (`t6-light`) — after T5 merges and `main` is merged into `t6-look-and-feel`
- [ ] **L1** Neutral-grey albedo (≈ `0x8a8a88`, mare ×0.6) and black shadows (ambient ≤
  0.08, earthshine the only fill). Gate: luminance statistics of a fixed frame (shadow
  mean below the target); `test-moon-material` re-pinned with a reason.
- [ ] **L2** A sun shadow map fitted around the player in `afterCamera`, texel-snapped so
  it does not swim when the origin rebases. Character, boulders and set pieces cast
  shadows. Gate: a shadow row at a fixed pose; perf row before and after.
- [ ] **L3** A low sun at the spawn (Q3, about 10°) through the spawn criterion. Gate:
  `test-play-spawn` re-pinned with the new sun elevation; Earth still in view.
- [ ] **L4** Lunar BRDF (Lommel-Seeliger/Hapke-style with opposition surge) in the `brdf`
  slot. ADR-045. Gate: shader unit rows (limb brightening, phase curve); perf row.
- [ ] **L5** Terrain-scale shadows in the `shadowing` slot (a horizon map per chunk or a
  short height ray-march), so crater floors go black at a low sun. ADR-046. Gate: a
  shadowed-crater-floor row; perf row. Split a/b if needed.
- [ ] **L6** Post pipeline: tone mapping, exposure, bloom of registered emissives. Gate:
  perf row; with no emissives registered, the bloom output equals no bloom.

### 5.4 Surface (`t6-surface`) — after the T5 merge
- [ ] **S1** Bright ray masks on young craters in the `albedo` slot, derived from the T5
  crater lattice (deterministic). Gate: the mask agrees with the lattice at sample points.
- [ ] **S2** Triplanar regolith detail within about 30 m, fading out with distance (CC0 or
  procedural). Gate: no visible tiling at 2 m (stats row); perf row; `check-assets`.
- [ ] **S3** Footprint decals from foot events: a boot-allocated pool, oldest recycled
  first, kept through origin rebases. Gate: decal count bounded; rebase row.
- [ ] **S4** Ballistic dust from steps, landings and the jetpack: pure parabolas under lunar
  g with no drag, settling on contact. Gate: the particle path matches the analytic
  parabola to 1e-3; zero-GC row.

### 5.5 Objects (`t6-objects`) — after the T5 merge
- [ ] **O1** Static KCC obstacles (sphere, capsule and box proxies in a boot-allocated grid
  broadphase), queried from `astronautKCC.ts`. ADR-060. Gate: `test-kcc-default-trace`
  identical with no obstacles; new `test-t6-objects-kcc` (step-up, slide, no tunnelling at
  the speed cap); `test-kcc-gate` green.
- [ ] **O2** Boulder fields: instanced, deterministic on the crater lattice with ejecta near
  rims. Rocks under the 0.5 m step height are decorative; larger ones register obstacles
  and skip reserved discs. Gate: determinism row; obstacle agreement; perf row.
- [ ] **O3** Glowing crystals: emissive, instanced, registered for bloom. Gate: perf row.
- [ ] **O4** A crashed lander (CC0 GLB) 200–400 m from the spawn as the first goal, with a
  collision proxy and a placement reservation. Gate: `check-assets`; reachability walk.

### 5.6 World (`t6-world`) — after the T5 merge and after O1 is integrated
- [ ] **W1** Set-piece framework: a flat-site finder on the analytic terrain, reservations,
  loading on approach, collision proxies through O1 obstacles. ADR-070. Gate: site rows
  (slope, distance); unload balances load.
- [ ] **W2** Lunar outpost: houses with warm window light. Gate: `check-assets`; perf row
  near the outpost.
- [ ] **W3** Greenhouse dome with large *Moon Fairy Tale*-style trees and a still pond.
  Gate: perf row inside the dome; collision walk.
- [ ] **W4** Glowing crystal grotto built on the surface (arch or overhang). Gate:
  collision walk; bloom registered; audio landmark registered.
- [ ] **W5** Far landmarks, visible from the spawn and reachable, plus a heading cue. Gate:
  visibility rows at range; perf row.

### 5.7 Integration and close-out (on `t6-look-and-feel`)
- [ ] **I1…In** One integration session per finished track (procedure in §6.2), in the
  order the tracks finish. Each adds its row here when it runs.
- [ ] **IX** T6 close-out: full M, a frame-time and heap report against §6.3, a Lead
  acceptance tour, and then the merge into `main` (brief §4, §13 safeguard 5).

## 6. Verification per step

### 6.1 Matrix M and per-step checks
**Matrix M** is the T5 S1a matrix (`88c51b8:docs/evidence/T5/S1a.txt`) plus the T6 gates
as they land. Run it from `game/`, with exit codes recorded unpiped:
- `npx tsc --noEmit` · `npm run build`
- `tools/test-play-{anim,controller,frame,lod,perf,rig,shell,spawn,world}.mjs`
- `test-moon-profile --self-test` · `test-moon-material` (plain and `--self-test`) ·
  `test-kcc-default-trace`
- F-gates: orbit, precision, seam, flight, scale-law, rail-validation, real-body-data,
  spin-law
- `test-alloc-gate --self-test` · `test-alloc-loops --self-test`
- `npx playwright test e2e/play.spec.ts e2e/m1e.spec.ts e2e/m1f-r` (R5 waived, brief §8) ·
  `npx playwright test e2e/m1a e2e/m1b e2e/m1c e2e/m1d`
- `node tools/check-repo-refs.mjs --max 100000` (dangling 0)
- added by T6: `test-t6-hooks` (C1), `check-assets --self-test` and plain (C3), and every
  `test-t6-<track>-*` gate once its track is integrated

**Every step:** typecheck, build, the step's own gate (§5), the M rows for the modules it
touches, `test-alloc-gate` plain (no new per-frame allocation), the ref check and, if it
adds binaries, `check-assets`. A step that touches shared terrain, KCC or render code
also runs `e2e/m1a`…`m1d` (brief §3). Every re-pin is listed in the commit body with its
reason. **The last step of a track** runs the full M on the track branch before it asks
for integration.

Visual results cannot be checked by eye in headless runs. Light, Surface and World gates
therefore assert numbers on fixed frames: luminance statistics, a pixel-row probe at a
pinned pose and seed, and shader unit rows. Each track also commits one Lead-review
screenshot per visual step, at most 200 KB, as allowed by ADR-030 when a ruling needs an
image.

### 6.2 Integration procedure (one integration session per finished track)
1. Fetch. Merge `t6-look-and-feel` into the track branch on the track side if it has
   fallen behind, so conflicts surface there first.
2. On `t6-look-and-feel`, merge the track branch with `git merge --no-ff`. Never rebase,
   squash or force-push.
3. Resolve conflicts. Track-owned files keep the track's side. Integration-only files are
   merged by hand, and the hook contract (§4.2) wins.
4. Fold the track's `notes/T6-<track>.md` into `notes/CHANGES.md` (one digest line per
   step) and into the T6 rows of the tracker in `notes/task.md`. The track notes file then
   stays in place as a pointer.
5. Run the full M plus the frame budget check (§6.3). If anything is red, fix it on the
   integration branch or send it back to the track. Never push a red `t6-look-and-feel`.
6. Push, add the `I<n>` row and a T6 SESSION LOG row, and update NEXT ACTION in
   `notes/T6-STATE.md`.
- **When `main` moves** (the T5 merge): an integration session merges `main` into
  `t6-look-and-feel` and runs the full M. Open tracks then merge `t6-look-and-feel` into
  their branches. The Light, Surface, Objects and World branches are cut only after this
  merge.

### 6.3 Frame-time and heap budget
C1 measures the baseline frame time (p50/p95) and heap with `tools/check-play-frametime.mjs`
and `test-play-perf`, on the spawn route and on a fixed walk, and commits the numbers.
Every step that adds render or audio work records before and after numbers in the same
environment (brief §13 safeguard 4). Allowed p95 additions over the baseline:

| Track | Light | Surface | Character | Objects | Audio | World |
|---|---|---|---|---|---|---|
| p95 added | 3.0 ms | 1.0 ms | 1.0 ms | 1.5 ms | 0.5 ms (main thread) | 1.5 ms (at the set piece) |

The plain `test-alloc-gate` stays at 0, and heap growth over the fixed walk stays within
the current `test-play-perf` bound. A track over its share either optimises or stops and
records the options (an ADR for a technical trade-off, the Lead for a visible quality
trade-off).

## 7. Risks & open decisions

### 7.1 Open look-and-feel questions (Lead; asked 2026-10-29, session 160)
The plan proceeds on these defaults until the Lead rules. A ruling changes only the
steps named.

| # | Question | Default | Steps affected |
|---|---|---|---|
| Q1 | Earth in the sky: keep the large Earth (about 14.7°) or show it at real size? | Keep it large | none (L3 keeps Earth in view) |
| Q2 | Faster travel on the real-size Moon | Jetpack boost on the existing RCS; a rover later | K6, S4 |
| Q3 | Sun height at the spawn | About 10°, for long black shadows | L3 |
| Q4 | Radio voices: allow public-domain NASA Apollo audio, or strict CC0 only? | Strict CC0 (procedural or CC0 chatter and static) | A4 |

### 7.2 Risks
- **T5 slips or changes the terrain contract.** Four tracks wait for the T5 merge. Mitigation:
  Audio and Character run first. Surface S1 and Objects O2 read the crater lattice only
  through T5's merged API, and they re-read it after the merge rather than assuming it.
- **Merge conflicts in shared files.** Mitigation: the hooks in §4.2 and the ownership table
  in §4.1. A track that needs a change to an integration-only file asks for it and does not
  make it.
- **Shadow swimming and precision at real size.** The shadow camera is fitted in render-local
  space and texel-snapped, and its tests run across an origin rebase (L2).
- **KCC obstacle support is a core edit.** O1 must leave `test-kcc-default-trace`
  identical when no obstacles exist, and it lands before any obstacle consumer (O2, O4,
  W1).
- **Frame budget.** The per-track shares in §6.3, measured before and after. Light L5
  (terrain shadows) is the largest risk and may split into a/b, or fall back to a coarser
  horizon map, recorded in an ADR.
- **Repo size from assets.** The budget and gate in §4.3. Procedural content is preferred,
  and an over-budget asset is a Lead stop.
- **Character rig choice.** A GLB rig may break `test-play-rig` and `test-play-anim`
  contracts. K1 decides by measurement in ADR-055, and the replacement gates land before
  the old rows retire (brief §13 safeguard 3).
- **Audio autoplay policy.** The context unlocks only from the CLICK_TO_PLAY gesture through
  `onPhase`. Headless tests use OfflineAudioContext, and the B12 autoplay path stays
  silent.
- **Bloom and postprocessing within the fixed library set.** Only `three/examples/jsm` is
  used, with no new dependency. If it cannot meet the budget, Light stops and records the
  options in an ADR.
