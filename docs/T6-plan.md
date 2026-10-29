# T6 — LOOK-AND-FEEL OVERHAUL (MOON + CHARACTER TO AAA) — PLAN

- Task: T6 · Branch: `t6-look-and-feel` (cut from `main` @ 787b9d4, session 159); track
  branches `t6-<track>` are cut from it at READY (`notes/T6-STATE.md`)
- Stage: PLANNING (3/7 sections)
- Last updated: 2026-10-29 (session 160)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [ ] Affected modules · [ ] Steps ·
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