# T1 — PLAYABLE MOON — PLAN

- Task: **T1** (playable moon) — definition: `notes/task.md` § "T1 — PLAYABLE MOON"
- Branch: `t1-playable-moon`
- Stage: **PLANNING** — plan status IN PROGRESS (4/7 sections)
- Last updated: 2026-10-19
- **Resume at the FIRST UNCHECKED BOX** (planning item or build step).
- Rules: planning changes NO game code (plan + process files only); each checked
  box rides in the same commit as the tracker row + `notes/STATE.md` NEXT ACTION
  update (AGENT_BRIEF.md §6). On 7/7 → status READY → STOP at the LEAD GATE.

## PLANNING CHECKLIST
- [x] Goal
- [x] Scope IN
- [x] Scope OUT
- [x] Affected modules
- [ ] Steps — the 15 required sections (`notes/task.md` "Required structure"),
      drafted in order; each sub-box is its own checkpoint commit:
  - [ ] §1 Executive summary (recommended architecture + why)
  - [ ] §2 Assumptions and open questions
  - [ ] §3 Current-state findings (verified repo facts)
  - [ ] §4 Architecture (module/data-flow diagram, text)
  - [ ] §5 File-by-file change plan
  - [ ] §6 World bootstrap plan
  - [ ] §7 Character rig specification
  - [ ] §8 Animation state machine (table)
  - [ ] §9 Controller + camera plan
  - [ ] §10 Game shell + HUD plan
  - [ ] §11 Performance plan
  - [ ] §12 Implementation phases (= the ordered BUILD steps)
  - [ ] §13 Verification plan
  - [ ] §14 Risk register
  - [ ] §15 First coding step
- [ ] Verification per step
- [ ] Risks & open decisions

<!-- Sections are appended below as they are drafted. -->

## Goal
Ship `/?page=play`: the first GAME page. It is a standalone, independently
loadable third-person free-roam playground on the procedural moon, listed in
the menu. The player drives a visible articulated astronaut whose procedural
animation (idle, walk, run, jump launch/rise, fall, land, slope slide) is
driven by real KCC movement state. Controls are camera-relative and the
camera orbits. The page reuses the existing core/render modules and must not
import or regress the M1F acceptance harness.

## Scope IN
- **Route + menu**: a `play` entry in the `pages` map in `game/src/main.tsx`
  (dynamic import, full page load, no StrictMode, same as the harnesses) and
  a menu link in `game/src/App.tsx`.
- **Page module tree** under `game/src/play/`. The boot strategy (Option A:
  shared extracted bootstrap, or Option B: minimal duplicated boot) is
  decided in §1 and specified in §6.
- **World (reused, not reimplemented)**:
  - the M1F moon `TerrainParams` (R = 1364.5, g = 1.62 m/s²,
    maxTerrainHeight 360) via `initTerrainField`;
  - `SimulationCore` with frozen sky (`setTimeScale(0)`) and `FIXED_DT`
    fixed-step simulation;
  - `FloatingOriginAdapter`, `TerrainMeshPool` streaming plus quadtree LOD,
    `terrainWorker`, `SkyImpostorPool`, and the `MultiCameraRig` three-pass
    renderer;
  - a scenic, walkable spawn (the Earthrise spawn is evaluated in §6).
- **Character**: a self-contained articulated astronaut built in-engine
  (ROBLOX-like block proportions, joint hierarchy with correct pivots). It
  replaces the static box group on the play page only.
- **Animation**:
  - a `CharacterAnimator` interface plus a procedural implementation;
  - a state machine (Idle, Walk, Run, JumpLaunch, JumpRise, Apex/Fall,
    Land, Slide) driven by KCC telemetry and landing events, with
    crossfades, stride scaling with speed, and foot-slide minimization;
  - a documented GLB swap path (GLTFLoader + AnimationMixer), with no asset
    dependency in V1.
- **Controller**:
  - camera-relative WASD mapped onto the KCC's `moveF`/`moveR`/`turnRate`,
    turning the character toward the desired direction;
  - sprint;
  - jump with play-layer coyote time and jump buffering (the KCC's own
    buffering is verified in §3);
  - landing recovery;
  - respawn;
  - pause that does not advance physics.
- **Optional air control**: only as an opt-in KCC config field whose default
  (0/off) preserves acceptance behavior. This needs a Lead ruling (see Risks
  & open decisions).
- **Camera**: third-person mouse orbit with pointer lock, a spring-arm boom,
  terrain collision and a minimum distance, smoothed position and rotation,
  and an FP toggle.
- **Shell + HUD**:
  - a click-to-play overlay;
  - a loading state while terrain warms up;
  - a pause overlay;
  - a controls hint;
  - optional speed, coordinates and FPS readouts.
- **Performance**: smooth at typical desktop frame rates, with no per-frame
  allocations in the play-layer hot path (the same scratch-object discipline
  as the core).
- **Verification**:
  - `npm run typecheck` and `npm run build`;
  - a manual test matrix;
  - an optional Playwright smoke test (`e2e/play.spec.ts`);
  - an M1F regression check (`npx playwright test e2e/m1f.spec.ts` unchanged).

## Scope OUT
- Combat, objectives, inventory, quests, sound, saves, multiplayer, and
  touch or gamepad input.
- Sourcing, loading, or shipping any external GLB/FBX asset in V1 (only the
  interface and the swap path are in scope).
- Any edit to `Design_specs/` or `Milestone/`. No change to M1F acceptance
  rows, thresholds, or R5/F-09/F-10 behavior. The M1F round-7 ruling and the
  1G milestone stay parked.
- Importing anything test-only into the play page:
  - `test/Milestone1F_TestHarness.tsx` (its module singletons and the THREE
    `dispose`/`Scene.remove` prototype patches at lines 77–92 would execute);
  - `test/m1fStraddle.ts`;
  - the test probes, satellites (SAT_B), acceptance HUD, autopilot, and the
    test-result fields of `store/useGameStore.ts`.
- Reimplementing physics, terrain, sky, or floating origin.
- Changing any existing `AstronautKCC` default or behavior. Core edits are
  limited to additive, opt-in, default-off fields.
- ZERO-G (RCS) and VEHICLE gameplay. A dedicated crouch animation state: the
  `C` key may pass through to the KCC; whether V1 animates crouch is an open
  decision.
- Day/night or orbital time progression (the sky stays frozen).
- Pre-existing menu gaps (m1e and m1f are not listed in `App.tsx`). They are
  noted only; only the `play` entry is added.

## Affected modules
Paths are relative to `game/`. New file names are provisional; §5 finalizes
names, exports and APIs.

- **New** (play layer, under `src/play/`):
  - `PlayPage.tsx`: the route's default export (Canvas, shell, frame loop).
  - `world/` (moon world boot): terrain params, `SimulationCore`, the
    adapter, the terrain and sky pools, and spawn.
  - `character/AstronautRig.ts`: the articulated joint hierarchy, meshes and
    materials.
  - `character/CharacterAnimator.ts`: the animator interface (the GLB swap
    seam).
  - `character/ProceduralAnimator.ts`: the procedural poses and blending.
  - `character/animStateMachine.ts`: states, transitions and blend times.
  - `controller/PlayerController.ts`: camera-relative input to KCC input,
    coyote time, jump buffering and respawn.
  - `camera/ThirdPersonCamera.ts`: the orbit, spring arm, terrain clearance,
    and FP toggle.
  - `input/`: keyboard, mouse and pointer-lock state.
  - `ui/`: HUD, overlays and loading state.
  - `e2e/play.spec.ts` (optional Playwright smoke test).
- **Edited**:
  - `src/main.tsx`: adds the `play` loader.
  - `src/App.tsx`: adds the menu entry.
- **Conditionally edited (Lead ruling required)**:
  - `src/core/physics/astronautKCC.ts`: an opt-in air-control config field,
    default 0, which keeps acceptance safe.
  - Under Option A only: a shared moon bootstrap extracted from
    `src/test/Milestone1F_TestHarness.tsx` (this touches the acceptance
    harness, so it carries 1F regression risk).
- **Reused read-only**:
  - `src/core/simulation/SimulationCore.ts`
  - `src/core/terrain/{terrainField,spherify,noise}.ts`
  - `src/core/physics/{astronautKCC,sphericalFrame}.ts`
  - `src/render/{FloatingOriginAdapter,TerrainMeshPool,SkyImpostorPool}.ts`
  - `src/render/MultiCameraRig.tsx`
  - `src/workers/terrainWorker.ts`
  - `three` and `@react-three/fiber`
- **Not touched**: `src/test/**`, `e2e/m1*.spec.ts`, `Design_specs/`,
  `Milestone/`.
- **Process files** (each checkpoint): `docs/T1-plan.md`, `notes/task.md`,
  `notes/STATE.md`.
