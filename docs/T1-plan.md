# T1 — PLAYABLE MOON — PLAN

- Task: **T1** (playable moon) — definition: `notes/task.md` § "T1 — PLAYABLE MOON"
- Branch: `t1-playable-moon`
- Stage: **BUILDING — awaiting Lead acceptance** — plan READY (7/7); build 13/13 done (B1–B13); stage → DONE after the Lead accepts
- Last updated: 2026-10-21
- **Resume at the FIRST UNCHECKED BOX** (planning item or build step).
- Rules: planning changes NO game code (plan + process files only); each checked
  box rides in the same commit as the tracker row + `notes/STATE.md` NEXT ACTION
  update (AGENT_BRIEF.md §6). On 7/7 → status READY → STOP at the LEAD GATE.

## PLANNING CHECKLIST
- [x] Goal
- [x] Scope IN
- [x] Scope OUT
- [x] Affected modules
- [x] Steps — the 15 required sections (`notes/task.md` "Required structure"),
      drafted in order; each sub-box is its own checkpoint commit:
  - [x] §1 Executive summary (recommended architecture + why)
  - [x] §2 Assumptions and open questions
  - [x] §3 Current-state findings (verified repo facts)
  - [x] §4 Architecture (module/data-flow diagram, text)
  - [x] §5 File-by-file change plan
  - [x] §6 World bootstrap plan
  - [x] §7 Character rig specification
  - [x] §8 Animation state machine (table)
  - [x] §9 Controller + camera plan
  - [x] §10 Game shell + HUD plan
  - [x] §11 Performance plan
  - [x] §12 Implementation phases (= the ordered BUILD steps)
  - [x] §13 Verification plan
  - [x] §14 Risk register
  - [x] §15 First coding step
- [x] Verification per step
- [x] Risks & open decisions

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

## Steps
The 15 required sections, in order. Each is drafted as its own checkpoint.

### §1 Executive summary
**Recommendation: Option B.** Build a new play page under `game/src/play/`
with its own minimal moon boot. It reuses the core/render modules unchanged
and extracts nothing from the M1F harness in V1.

Why B over A:
- **The brief forbids importing the harness.** `Milestone1F_TestHarness.tsx`
  patches THREE `dispose`/`Scene.remove` prototypes at module scope
  (lines 77–92) and boots its world as module singletons (lines 98–221).
  Under Option A, any shared bootstrap has to be cut out of that file, which
  means editing the 1,777-line acceptance harness.
- **1F is parked at a ruling gate.** Rounds 1–7 were run with "no harness
  edit" as a standing condition. Option A's extraction would change the
  harness's boot order and its module-evaluation timing, which risks the
  1F gate (R3 0.82% green, R5 the single FAIL) while it is awaiting a
  ruling.
- **The duplication is small and bounded.** It covers only the boot
  constants (moon `TerrainParams`, MU, the KCC moon config), the spawn
  search, and the quadtree LOD controller, which lives inside the harness
  (lines 274–434) rather than in `render/`. That is roughly 300–400 lines
  of world setup, reimplemented as clean functions rather than copied.
  Physics, terrain, sky and floating origin are all reused, not rewritten.
- **Consolidation can come later.** Once `play` is stable, a follow-up task
  (subject to a Lead ruling) can make the harness consume the play-world
  module.

Headline architecture (detailed in §4):
- `PlayPage` mounts an R3F `Canvas` with `MultiCameraRig`.
- Its `onFrame` runs one fixed-order frame:
  1. input;
  2. `PlayerController`, which writes the KCC input;
  3. `kcc.update` and `core.advance` (real time, 1/60 fixed steps);
  4. render extraction (spin group, floating origin, character root);
  5. `CharacterAnimator.update(telemetry)`;
  6. `ThirdPersonCamera`, then `setDriverPose`;
  7. layer assignment;
  8. LOD plus `pool.pump`.
- The character is an articulated `AstronautRig` animated by a
  `ProceduralAnimator`, behind a `CharacterAnimator` interface. A GLB
  animator can later implement the same interface.
- Camera-relative movement needs **no core change**. The controller turns
  the camera-relative stick into the KCC's own frame (`moveF`/`moveR`), and
  the KCC's existing `autoTurnEnabled` turns the body toward its velocity.
- Jump buffering lives in the play layer. Coyote time and air control both
  need a small, opt-in, default-off KCC addition, which needs a Lead ruling
  (§2 Q2 and Q3).

### §2 Assumptions and open questions
**Assumptions** (taken as given unless the Lead overrides them):
- A1. The world is the M1F moon:
  - `TerrainParams` {radius 1364.5, seed 20240119, continentFreq 2.3 /
    continentAmp 95, maskFreq 3.7, mountainFreq 6.5 / mountainAmp 230,
    detailFreq 22 / detailAmp 16};
  - `MOON_MU = 1.62·R²` and `maxTerrainHeight` 360;
  - the sky is frozen (`setTimeScale(0)`).
- A2. The KCC moon config is reused verbatim from M1F (walk 3.2, sprint 6.5,
  crouch 1.5, jump 4.2, accelTau 0.15, maxWalkSlope 50°, slide 45°, …).
  Tuning happens through the play page's own config copy, never through KCC
  defaults.
- A3. The play page runs at real time (time scale 1), driven by
  `kcc.update(dt, 5)` and `core.advance(dt)`. M1F's LIVE autopilot ran at
  `ts = 6` as a test acceleration; play does not use that.
- A4. Input is desktop keyboard + mouse with pointer lock. There is no
  gamepad or touch input.
- A5. One page per full load, as with the harnesses. Module-level singletons
  (`initTerrainField`, the `MultiCameraRig` cameras) are therefore safe, but
  the play world is still created lazily from one `createMoonWorld()` call so
  that nothing boots on import.
- A6. The character and nearby terrain render on the NEAR layer of the
  existing three-pass rig. The Earth and sky use the existing MID/FAR
  passes.
- A7. The Earthrise spawn is the default spawn, and §6 evaluates whether its
  surroundings suit free roam. The `?spawn=x,y,z` override is kept as a
  debug aid.
- A8. three 0.165's `GLTFLoader` and `AnimationMixer` stay available for the
  future GLB swap. No asset ships in V1.

**Open questions** (need a Lead ruling; none block planning, and each has a
default the plan proceeds with):
- Q1. **Option B** (separate boot) over Option A? Default: B.
- Q2. **Coyote time** needs the KCC's help: jump is read only in
  `_groundedTick`, so a press after walking off a ledge cannot fire. Two
  options:
  - (a) an opt-in field `coyoteTime` (default 0) on `AstronautConfig`, where
    the KCC remembers the last grounded tick and the surface normal it had;
  - (b) a play-layer velocity kick through `teleportAbs`.
  Default: (a), as an additive, acceptance-safe change. (b) bypasses the
  KCC's F18 spin-phase composition.
- Q3. **Air control**: add an opt-in `airControl` field (default 0)? Default:
  yes, small (≈0.3 of the grounded response), on the play page only.
- Q4. **Crouch**: does V1 animate a crouch pose? Default: a simple crouch
  blend pose (cheap), with no separate crouch-walk cycle.
- Q5. **Jump-buffer comment**: the F14 comment in `astronautKCC.ts`
  (lines 478–483) claims "airborne presses buffer to the landing tick", but
  the code does not do this (see F10). Default: leave the core untouched,
  implement buffering in the play layer, and record the discrepancy here.
  The Lead decides whether the comment or the behaviour should be fixed in
  core.
- Q6. **Playwright smoke** `e2e/play.spec.ts` (page loads, canvas renders,
  no console errors, the character moves on a W press)? Default: yes, as an
  optional final phase.
- Q7. **Menu**: add only `play` (default), or also list the missing m1e/m1f
  entries? Default: `play` only.
- Q8. **Moon spin in play**: keep the harness `spinOmega` 0.0005 rad/s
  (3.49 h day; the spawn reaches sunset 21 min after load and stays dark
  for ~105 min), or set it to 0 so the Earthrise light holds? Default: keep
  (A2, KCC config verbatim). Evidence in §6.1.

### §3 Current-state findings
These were verified against `game/src` at `8f70131` (game code unchanged
since `0c555b3`). `npm ci`, `npm run typecheck` and `npm run build` all exit
0. Line numbers are approximate anchors.

**Routing and shell**
- F1. `main.tsx` has a static `pages` map `m1a`..`m1f` of dynamic imports,
  selected by `?page=`. With no match it renders the `App` menu. There is no
  StrictMode, deliberately: the harness singletons break under a double
  mount.
- F2. `App.tsx` `PAGES` lists only m1a–m1d (m1e and m1f are reachable by URL
  only). Links are plain `<a href>`, so every navigation is a full load.

**M1F harness: what is reusable and what is test-only**
- F3. Section map of `Milestone1F_TestHarness.tsx`:

  | Lines | Section | Test-only items |
  |---|---|---|
  | 75 | Dev patches: THREE prototype counters (77–92) | all of it |
  | 98 | Boot singletons: `MOON` (100), `initTerrainField`, `SimulationCore` + `setTimeScale(0)`, adapter, `TerrainMeshPool`, `SkyImpostorPool`, KCC config (126–135), entity registration | — |
  | 141 | Earth and Sun directions from the frozen rails | — |
  | 157–221 | Earthrise spawn search, then `kcc.teleportSurface` | — |
  | 223 | Walk direction + satellites | test-only |
  | 274–434 | Quadtree + LOD controller (MAX_LEVEL 4, SPLIT_K 2.0, MERGE_K 1.45, GRACE 45, 3 activations per frame, in-flight cap 24, HORIZON_MARGIN 150) | — |
  | 435 | Static scene: `sceneRoot` ⊃ `spinGroup` + `skyGroup`, lights, Earth hero mesh (471), probes (515, test-only), glow/stars (569), static astronaut (575) | probes |
  | 602 | Handoff state machine | test-only |
  | 650 | Input + TP/FP camera driver (697) | — |
  | 791 | Layer assignment + sky update (`applyRenderState`, `assignObject*`, `CAT_BODIES`; probe slots 9/10 are test-only) | probe slots |
  | 936–1384 | Stores, metrics, suite | test-only |
  | 1385 | Script phases + frame loop | test-only phases |
  | 1565 | Scene component | — |
  | 1595 | HUD | acceptance HUD |
  | 1709 | Root: click calls `requestPointerLock`, then `Canvas` | — |

- F4. The **LOD controller is not a module**. It is harness code: 6 faces ×
  341 `QNode`s, split/merge with grace frames, driven by the camera position
  in the planet frame, computed by spin-conjugating `kcc.absPos`. The play
  page needs its own `MoonLod` (see §6).
- F5. **Spawn search**: 24,000 `mulberry32(0x7f1a)` samples jittered around
  the Earthrise base direction, scored as `slope·40 + max height deviation`,
  stopping early when the score drops below 0.35. It is deterministic.
- F6. **The harness's manual-mode frame**, in order:
  1. look input;
  2. `kcc.update(dt, 5)` and `core.advance(dt)` (skipped while paused);
  3. `spinGroup` gets position = −origin and quaternion = `spinQuat(kcc.spinPhase)`;
  4. `adapter.update()`;
  5. the astronaut gets `localPosF32` and `spin ∘ frameQuat`;
  6. `computeDriverPose`, `setDriverPose` and `applyRenderState`;
  7. LOD plus `pool.pump()` (skipped while paused).
  The camera boom works like this:
  - start from −fwd, yawed by `cam.yawOffset` about up, then pitched;
  - clamp against the terrain with 4 samples (0.4 m clearance, minimum
    distance 1.2 m);
  - look at the character at up × 1.4.
  First person uses `kcc.lookYawDelta`. There is no smoothing. One
  per-frame object literal (`drvLocal`) is allocated.
- F7. **Pause gaps**: the harness pause (`P`) skips `kcc.update`,
  `core.advance` and LOD. Nothing resets the KCC or core accumulators on
  resume. Both cap `dt` at 0.25 s, so the first frame after resuming can run
  up to 5 catch-up ticks. The play page must zero its frame `dt` on resume.

**AstronautKCC (`core/physics/astronautKCC.ts`)**
- F8. `update(dtReal, maxSubsteps = 5)` keeps its **own** 1/60 accumulator,
  separate from `SimulationCore.advance`'s accumulator (`FIXED_DT` 1/60,
  `MAX_SUBSTEPS` 5, `MAX_ADVANCE_DT` 0.25). Both are driven with the same
  `dt`, as in the harness. Physics is frame-rate independent. `update`
  applies `lookYawDelta` once per frame and writes position and velocity
  through to the registered entity (`attachWriteThrough`).
- F9. **Grounded movement** (around line 548):
  - speed is crouch, sprint or walk;
  - `vDes = (fwd·moveF + right·moveR)·speed`, normalised to ≤ 1;
  - the velocity responds with an exact exponential (`accelTau`);
  - `turnRate` rotates `fwd`;
  - `autoTurnEnabled` (default true) rotates `fwd` toward the control
    velocity at a rate capped by `autoTurnRate` (6 rad/s), reported as
    `telemetry.turnApplied`.

  So camera-relative movement maps onto the existing inputs with no core
  change: project the camera-relative direction onto the KCC frame
  (fwd/right) as `moveF`/`moveR`, and let auto-turn face the body.
- F10. **No jump buffer** (DISCREPANCY with the brief and with the F14
  comment):
  - jump is read only in `_groundedTick` (line 590, `jump && !crouch`,
    along the surface normal; the launch tick continues inertially at 608);
  - `input.jump` is cleared after **every** `integrateTick` (line 483),
    airborne ticks included;
  - so an airborne press is discarded after one flight tick, unless the
    landing happens in that same tick.
  A press made on a frame where `update` ran 0 substeps carries over to the
  next frame.
- F11. **No coyote time**: there is no grace window, and nothing in
  `_flightTick` reads jump.
- F12. **No air control**: `_flightTick` (line 807) reads only the RCS axes
  and the ZERO-G `turnRate`. Surface-airborne flight is purely inertial.
- F13. **Signals for the animation state machine**:
  - telemetry: `grounded`, `relSpeed`, `slideSpeed` (line 1076), `slopeDeg`,
    `altAGL`, `crouched`, `eyeHeight`, `mode`, `turnApplied`;
  - vertical velocity, derived as the dot product of `absVel` minus the
    transport velocity with `up`;
  - landing events, from the change in `integrity.landings` (`_landAt`,
    line 970; increment at 1019), with impact speed from
    `integrity.lastLandingRelSpeed`.
  There is no landing callback; polling the counter is enough.
- F14. KCC module scratch is non-reentrant (one active controller per tick).
  That is fine for a single player.

**Render modules**
- F15. `MultiCameraRig`:
  - the near, mid and far cameras are module singletons;
  - the component's `useFrame` (priority 1) calls `onFrame(delta, gl, scene)`
    and then `executePasses`, and it sets `gl.autoClear = false`;
  - layers are NEAR/MID/FAR bits split at 2400 m and 300 km;
  - `setDriverPose` and `layerMaskFor` are exported.
  It is reusable unchanged.
- F16. The other render modules:
  - `FloatingOriginAdapter`: `bind`, `unbind`, `update`, `copyOriginInto`;
  - `TerrainMeshPool`: `attach`, `primeAll`, `unprimeAll`, `release`,
    `pump`, `disposeAll`; it creates its workers in the constructor
    (line 163);
  - `SkyImpostorPool(starCount, starRadius)`: `mesh`, `bodies`, `stars`,
    `material`.
- F17. `store/useGameStore.ts` is test-oriented (`TestId`, `TestResult`).
  Its `createTelemetryPublisher(minIntervalMs)` is reusable for throttled
  HUD updates.

**Brief vs code**
- F18. The brief's line anchors match the code to within a few lines:
  - astronaut at 575 (the brief says ~577);
  - input/camera at 650–790;
  - frame loop at 1385;
  - HUD at 1595.
- F19. `GLTFLoader` exists at
  `node_modules/three/examples/jsm/loaders/GLTFLoader.js` only after
  `npm ci` (node_modules is gitignored).
- F20. The "use the KCC's jump buffering" premise does not hold (F10).
  Coyote time needs a core hook (F11, §2 Q2).
### §4 Architecture
Option B (§1): one new module tree, `game/src/play/`, loaded only by
`?page=play`. It imports core/render modules read-only and nothing from
`src/test/**`. The names below are binding for §5, which adds exports and
signatures.

**4.1 Module graph (imports point downward; no cycles)**
```
main.tsx ──(?page=play, dynamic import, full load)──▶ play/PlayPage.tsx
PlayPage.tsx            React root: <Canvas> + <MultiCameraRig onFrame> + <PlayShell>
 ├─ world/moonWorld.ts   createMoonWorld(): MoonWorld        (boot, once)
 │    ├─ world/moonConfig.ts   MOON params, MOON_MU, KCC moon config (A1/A2)
 │    ├─ world/spawn.ts        findEarthriseSpawn() (deterministic, F5)
 │    ├─ world/MoonLod.ts      quadtree split/merge → pool.attach/release (F4)
 │    ├─ world/skyState.ts     applySkyState(): impostors + layer masks (no probes)
 │    └─ core/* + render/*     SimulationCore, AstronautKCC, terrainField,
 │                             FloatingOriginAdapter, TerrainMeshPool,
 │                             SkyImpostorPool, MultiCameraRig exports
 ├─ input/InputState.ts        DOM listeners → plain fields (keys, mouse dx/dy,
 │                             edges, pointer-lock flag); no React
 ├─ controller/PlayerController.ts   InputState + camera heading → kcc.input;
 │                             jump buffer, coyote (Q2), respawn, pause gate
 ├─ character/CharacterTelemetry.ts  sampleTelemetry(kcc, ctrl, out) — KCC → anim signals
 ├─ character/CharacterAnimator.ts   interface (THE GLB seam)
 │    └─ character/ProceduralAnimator.ts  implements it
 │         ├─ character/AstronautRig.ts       joint hierarchy + meshes (§7)
 │         └─ character/animStateMachine.ts   states/transitions/blends (§8)
 ├─ camera/ThirdPersonCamera.ts orbit + spring arm + clearance + FP → driver pose
 ├─ frame/playFrame.ts          the ordered per-frame pipeline (4.3)
 └─ ui/ (PlayShell, Hud, overlays) + ui/playStore.ts (zustand, throttled)
```
Rules:
- `play/**` never imports `src/test/**`. From `store/useGameStore.ts` it may
  import only `createTelemetryPublisher`, never the test types.
- Nothing boots on import. Every singleton is created inside
  `createMoonWorld()` (A5).
- The pure core stays pure. Play-layer math uses plain `{x,y,z}` scratch
  objects and the `sphericalFrame.ts` helpers, and converts to THREE only at
  the render-extraction stage.

**4.2 Ownership and data contracts**
- **`MoonWorld`** is returned by `createMoonWorld`, boot-allocated, and owned
  by `PlayPage` for its lifetime. Fields:
  - `core`, `adapter`, `pool`, `sky`, `kcc`;
  - `astroState` (the registered entity);
  - `sceneRoot`, which contains `spinGroup` (moon-fixed: terrain, core
    shell), `skyGroup` (Earth hero, glow, stars), `characterRoot` and the
    lights;
  - `lod: MoonLod`;
  - `spawn: {dir, absPos}`;
  - `dispose()`.
- **`PlayInput`** (the `InputState` fields):
  - `moveX`/`moveY` ∈ [-1, 1] from WASD;
  - `sprint` and `crouch`;
  - `jumpPressed` (an edge, latched until consumed);
  - `lookDX`/`lookDY` (accumulated mouse pixels, zeroed on read);
  - edges for `toggleCam`, `respawn` and `pause`, plus `toggleHud` (§10.5);
  - `pointerLocked`.
- **Camera heading.** `ThirdPersonCamera` owns a planet-frame unit vector
  `heading` (tangent to `kcc.up`), plus `pitch` and `distance`. Each frame
  it re-projects `heading` onto the new up plane, renormalises it (parallel
  transport, never an Euler accumulator — §3 invariant), then yaws it by
  mouse X. `heading` is NOT stored relative to `kcc.fwd`: the harness's
  `yawOffset` approach would feed back into auto-turn and spin the
  character.
- **`kcc.input` has a single writer**, `PlayerController`:
  - `moveF`/`moveR`: the heading-relative stick projected onto `kcc.fwd`
    and right;
  - `sprint`, `crouch` and `jump`;
  - `turnRate` = 0 in third person; first person uses `lookYawDelta`.
- **`CharacterTelemetry`** is one boot-allocated struct, refreshed each
  frame:
  - `grounded`;
  - `speed` (`relSpeed`);
  - `vertSpeed` ((`absVel` − transport) · up);
  - `slopeDeg`;
  - `sliding` (`slideSpeed` > ε);
  - `sprint`, `crouch`, `inputMag`;
  - `jumped` (the controller issued a jump that launched this frame);
  - `landed` + `landingSpeed` (from the change in `integrity.landings` and
    `lastLandingRelSpeed`);
  - `airTime` and `dt`.
- **`CharacterAnimator`** (the interface):
  - members: `readonly root: THREE.Object3D`,
    `update(t: CharacterTelemetry, dt: number): void`, `setVisible(v)` and
    `dispose()`;
  - `characterRoot` holds `animator.root`;
  - the root's local origin is the feet contact point, +Y is character up,
    and −Z is facing (three.js forward);
  - a future `GltfAnimator` implements the same four members.
- **`ui/playStore`** holds:
  - `phase`: `LOADING`, `CLICK_TO_PLAY`, `PLAYING`, `PAUSED` or `ERROR` (§10.2);
  - `loadProgress`;
  - a HUD snapshot (speed, state name, grounded, FPS, coordinates),
    published at ≤10 Hz through `createTelemetryPublisher`.

  React reads the store; the frame loop never reads React state.

**4.3 Per-frame pipeline**
`playFrame(world, delta)` is the `onFrame` passed to `MultiCameraRig`. It
runs before `executePasses`, in this fixed order:
1. **Clock**: `dt = (phase !== PLAYING || resumedThisFrame) ? 0 :
   min(delta, MAX_ADVANCE_DT)`. A zero `dt` on resume removes the F7
   catch-up burst.
2. **Input**: drain `lookDX`/`lookDY` and handle the edges (camera toggle,
   respawn, pause).
3. **Camera pre-step**: transport `heading` and apply yaw and pitch (reads
   `kcc.up`).
4. **Controller**: write `kcc.input` (needs `heading` and `kcc.fwd`/`up`),
   and do the jump-buffer and coyote bookkeeping.
5. **Simulate**: `kcc.update(dt, 5)`, then `core.advance(dt)`. These are the
   two fixed 1/60 accumulators, driven with the same `dt` exactly as in the
   harness (F8). They do nothing while not PLAYING, because `dt` is 0.
6. **Render extraction**:
   - `spinGroup` gets position −origin and quaternion
     `spinQuat(kcc.spinPhase)`;
   - `adapter.update()`;
   - `characterRoot` gets `astroState.localPosF32` and spin ∘
     `kcc.frameQuatInto`.
7. **Telemetry + animation**: `sampleTelemetry`, then
   `animator.update(t, dt)`. Animation uses the same `dt`, so pausing the
   game freezes the pose.
8. **Camera post-step**: spring-arm boom from the character's render-local
   pivot, terrain clearance and smoothing, then `setDriverPose(...)`. This
   uses boot scratch, with no `drvLocal` literal (F6).
9. **Sky + layers**: `applySkyState(driver pose)` updates the impostors and
   the Earth/glow, and sets the layer masks for every scene object,
   including `characterRoot` on NEAR.
10. **LOD + streaming**: `lod.update(camera planet-frame pos)` and
    `pool.pump()`. This runs in every phase, including LOADING and PAUSED,
    so terrain keeps warming while the simulation is frozen.
11. **HUD**: the throttled publish and the loading-progress check.

`MultiCameraRig` then runs `executePasses` (the unchanged three-pass
render).

**4.4 Coordinate frames** (who uses which)
- **Planet frame** (moon-fixed, f64): KCC `pLocal`/`up`/`fwd`, `heading`,
  the spawn, the LOD inputs, and the terrain sampling for camera clearance.
  KCC `absPos`/`absVel` are ABSOLUTE (inertial), not planet-frame (see the
  §5 erratum).
- **Render-local** (f32, origin-relative): `localPosF32`, the driver pose
  and `characterRoot`. Always Float64 subtraction, then narrowing.
- **Spin**: planet to scene via `spinQuat(kcc.spinPhase)`. The character and
  the camera each compose spin exactly once (stages 6 and 8), mirroring the
  harness.
- **Rig-local**: joint pivots in metres relative to `characterRoot` (§7).

**4.5 Lifecycle**
- **Boot**:
  1. `PlayPage` mounts and calls `createMoonWorld()`: terrain init, the core
     with `setTimeScale(0)`, the pool and its workers, the KCC teleport to
     spawn, the scene graph and the animator.
  2. The phase is LOADING. When the LOD reports the spawn neighbourhood
     resident (the §10 criterion), the phase becomes CLICK_TO_PLAY.
  3. A click requests pointer lock and the phase becomes PLAYING.
  4. Losing pointer lock, or pressing `Esc`/`P`, gives PAUSED.
- **Teardown** (on unmount only, which full page loads make rare): remove
  the DOM listeners, call `pool.disposeAll()` and `animator.dispose()`, and
  unregister the entity.
- **Hot path**: stages 1–11 allocate nothing. All vectors, quaternions and
  telemetry structs are boot-allocated module or `MoonWorld` fields (§11).
### §5 File-by-file change plan
Paths are relative to `game/`. The exports and signatures below are binding
for the build. Bodies are sketched only where the logic is not obvious;
§6–§11 give the details. All `src/play/**` files obey §4.1: no
`src/test/**` imports, nothing boots on import, and no per-frame
allocation.

**Erratum to §4.4** (verified at `astronautKCC.ts` 216–224): `kcc.absPos` and
`kcc.absVel` are **absolute (inertial)**. Only `kcc.pLocal`, `kcc.up` and
`kcc.fwd` are planet-frame. To convert between them, rotate by
`spinQuatInto(kcc.spinPhase)`, or by its conjugate in the other direction,
exactly as the harness's `computeDriverPose` and `refreshFwdWorld` do.
§4.4 is corrected in place.

**5.1 Edited existing files**

| File | Change | Notes |
|---|---|---|
| `src/main.tsx` | add `play: () => import('./play/PlayPage')` to `pages` | Same pattern, so Vite splits it into its own chunk. Keeps the no-StrictMode comment. |
| `src/App.tsx` | add `{ id: 'play', label: 'PLAY — Playable Moon (T1)' }` as the FIRST `PAGES` row; title becomes `SOLARIS — PLAY / MILESTONE HARNESSES` | Q7 default: m1e/m1f are not added. |
| `src/core/physics/astronautKCC.ts` | CONDITIONAL (Q2/Q3 Lead ruling): optional `coyoteTime?: number` and `airControl?: number` on `AstronautConfig`, read as `cfg.coyoteTime ?? 0` | Spec in 5.3. Optional fields mean `EARTHSCALE_ASTRONAUT` and every harness config compile unchanged. |

**5.2 New files (`src/play/`)**

`world/moonConfig.ts` contains constants only, copied by value from harness
lines 100–135 (the M1F moon). Ported values carry a `// WHY:` comment naming
the source line.
```ts
export const MOON_PARAMS: TerrainParams;          // name 'Play Moon', R 1364.5, seed 20240119, …
export const MOON_R: number; export const MOON_MU: number;  // 1.62·R²
export const MAX_TERRAIN_H = 360; export const HEIGHT_SLACK = 420;
export const MOON_SPIN_OMEGA = 0.0005;
export const MOON_ASTRONAUT: AstronautConfig;     // harness KCC config verbatim (A2)
export const PLAY_POOL_OPTS: Omit<TerrainMeshPoolOptions, 'material'>; // 96/2/96/6/12
export const PLAY_TUNING: {
  lookSens: number;            // 0.0022 rad/px (harness SENS)
  camDistance: number; camDistMin: number; camDistMax: number; // 7 / 1.2 / 12
  camPitchMin: number; camPitchMax: number; camPitchDefault: number; // −1.2 / 1.2 / 0.35
  camClearance: number;        // 0.4 m
  camPosTau: number; camRotTau: number; // spring-arm smoothing (§9)
  pivotHeight: number;         // 1.4 m look-at height
  jumpBufferS: number;         // 0.12
  coyoteS: number;             // 0.10 (used only if Q2(a) is ruled in)
  airControl: number;          // 0.3 (used only if Q3 is ruled in)
  camBoomTau: number;          // 0.30 s boom regrowth (§9.4 amendment)
  hardLandingSpeed: number; landRecoverScale: number; // 4.5 m/s / 0.5 (§9.3 amendment)
  jumpDelayS: number;          // 0 — §9.3 decision; only if the Lead overrides
  readyRadiusM: number; loadTimeoutS: number; // 300 m / 15 s loading gate (§10.3 amendment)
};
```

`world/spawn.ts` holds the spawn logic. §6 decides whether to port the
harness search or use a fixed constant.
```ts
export interface SpawnSite { dir: Vec3; score: number; earthElevDeg: number; }
export function findEarthriseSpawn(earthDirPlanet: Vec3): SpawnSite; // deterministic, boot-only
export function parseSpawnOverride(search: string): Vec3 | null;     // ?spawn=x,y,z (A7)
```

`world/MoonLod.ts` is the harness quadtree (lines 274–434) refactored into a
class. The constants and the split/merge algorithm are unchanged; the only
change is that the module-level state moves into instance fields.
```ts
export const LOD = { MAX_LEVEL: 4, SPLIT_K: 2.0, MERGE_K: 1.45, GRACE_FRAMES: 45,
  ACTIVATIONS_PER_FRAME: 3, TOTAL_INFLIGHT_CAP: 24, HORIZON_MARGIN: 150 } as const;
export class MoonLod {
  constructor(pool: TerrainMeshPool, radius: number);
  update(camPlanetX: number, camPlanetY: number, camPlanetZ: number): void; // zero-alloc
  /** Loading gate (§10): every leaf whose centre is within radiusM of dir is resident. */
  residentAround(dirX: number, dirY: number, dirZ: number, radiusM: number): boolean;
  readonly stats: { active: number; pending: number; candidates: number };
}
```

`world/skyState.ts` is ported from harness `applyRenderState` and
`assignObject*` (lines 791–935), MINUS probe slots 9/10 and the test
counters.
```ts
export const PLAY_BODIES: ReadonlyArray<{ slot: number; id: string; radius: number;
  color: [number, number, number]; kind: number }>;   // slots 0–8, harness values
export function applySkyState(w: MoonWorld,
  px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number): void;
```
It updates impostors and the Earth/glow, then sets layer masks for terrain
records, the shell, `characterRoot` (always `NEAR_BIT`) and the sky objects.

`world/moonWorld.ts` holds boot and teardown.
```ts
export interface MoonWorld {
  core: SimulationCore; adapter: FloatingOriginAdapter; pool: TerrainMeshPool;
  sky: SkyImpostorPool; kcc: AstronautKCC; astroState: EntityState; lod: MoonLod;
  sceneRoot: THREE.Group; spinGroup: THREE.Group; skyGroup: THREE.Group;
  characterRoot: THREE.Group; earthMesh: THREE.Mesh;
  earthDir: Vec3; sunDir: Vec3; moonState: CelestialState;
  spawn: SpawnSite;
  dispose(): void;
}
export function createMoonWorld(opts: { spawnOverride: Vec3 | null }): MoonWorld;
export function respawnPlayer(w: MoonWorld): void; // kcc.teleportSurface(spawn.dir); zero vel
```
The boot order is fixed:
1. `initTerrainField`;
2. the core, with `setTimeScale(0)`;
3. the adapter;
4. the pool;
5. the sky;
6. the KCC and the entity registration (`setFocusEntity` + `attachWriteThrough`);
7. the Earth/Sun directions;
8. the spawn and `teleportSurface`;
9. the scene graph;
10. `pool.attach(scene)`, which happens in `PlayPage` once R3F hands over
    the scene.

`input/InputState.ts` contains DOM code only (no THREE, no React).
```ts
export class InputState {
  moveX = 0; moveY = 0;               // D−A, W−S
  sprint = false; crouch = false;
  jumpPressed = false;                // latched edge, cleared by the controller
  lookDX = 0; lookDY = 0;             // accumulated movementX/Y while locked
  toggleCamEdge = false; respawnEdge = false; pauseEdge = false; toggleHudEdge = false; // H (§10.5)
  pointerLocked = false;
  attach(el: HTMLElement): void;      // keydown/keyup/blur/mousemove/pointerlockchange
  detach(): void;
  requestLock(): void;                // el.requestPointerLock()
  clearEdges(): void;                 // end of frame
}
```
Key map: WASD move, Shift sprint, Space jump, C crouch, V camera, R respawn,
P pause. Esc pauses through the browser's pointer-lock release. `blur`
clears all keys, and `preventDefault` applies to Space and the arrow keys.

`controller/PlayerController.ts` is the only writer of `kcc.input`.
```ts
export class PlayerController {
  constructor(kcc: AstronautKCC, tuning: typeof PLAY_TUNING);
  firstPerson: boolean;
  jumpedThisFrame: boolean;           // read by sampleTelemetry
  step(inp: InputState, cam: ThirdPersonCamera, dt: number): void; // stage 4
  postSimulate(): void;               // after kcc.update: launch detection
  reset(): void;                      // respawn
}
```
Movement math (planet frame; §9 has the full derivation):
- the desired direction is `d = heading·moveY + right(heading, up)·moveX`,
  clamped so that |d| ≤ 1;
- `moveF = d·kcc.fwd` and `moveR = d·kRight`, where `kRight` uses the KCC's
  OWN right convention, copied from `_groundedTick` and checked by a build
  test (D must strafe right);
- `turnRate = 0` in third person, with `autoTurnEnabled = true`;
- in first person, `autoTurnEnabled = false` and `kcc.lookYawDelta` takes
  the mouse yaw (harness pattern).

Jump buffer, in the play layer (F10):
```
if (inp.jumpPressed) { buffer = tuning.jumpBufferS; inp.jumpPressed = false; }
if (buffer > 0 && (kcc.grounded || coyoteActiveInKcc)) kcc.input.jump = !kcc.input.crouch;
buffer = max(0, buffer - dt);
postSimulate: if (wasGrounded && !kcc.grounded && vertSpeed > 0.5) { buffer = 0; jumpedThisFrame = true; }
```

`character/CharacterTelemetry.ts`:
```ts
export interface CharacterTelemetry {
  grounded: boolean; speed: number; vertSpeed: number; slopeDeg: number;
  sliding: boolean; sprint: boolean; crouch: boolean; inputMag: number;
  jumped: boolean; landed: boolean; landingSpeed: number; airTime: number; dt: number;
  slopeFwdDeg: number; slopeSideDeg: number; // §8.6 additive amendment
}
export function createTelemetry(): CharacterTelemetry;
export function sampleTelemetry(kcc: AstronautKCC, ctrl: PlayerController,
  inp: InputState, dt: number, out: CharacterTelemetry): void;
```
How each field is derived:
- `vertSpeed` = (`absVel` − `transportVelocityInto(Ω, absPos)`) ·
  (spin · `up`), computed from module scratch. It is 0 when grounded.
- `landed` is true when `integrity.landings` differs from the previous
  frame's value; `landingSpeed` = `integrity.lastLandingRelSpeed`.
- `sliding` = `telemetry.slideSpeed > 0.25`.
- `slopeFwdDeg` / `slopeSideDeg` = signed angle between the ground normal
  and `kcc.up`, projected on `kcc.fwd` / right (0 when airborne); §8.6.

`character/CharacterAnimator.ts` is THE GLB seam, an interface only:
```ts
export interface CharacterAnimator {
  readonly root: THREE.Object3D;      // feet contact = origin, +Y up, −Z facing
  readonly stateName: string;         // HUD/debug
  update(t: Readonly<CharacterTelemetry>, dt: number): void;
  setVisible(v: boolean): void;       // false in first person
  dispose(): void;
}
```
`stateName` is added to the four members listed in §4.2, for the HUD.
§9/§10 document the future `GltfAnimator` (GLTFLoader + AnimationMixer:
clip-per-state, `crossFadeTo`, `timeScale` driven by speed).

`character/AstronautRig.ts` (§7 has the dimensions):
```ts
export const JOINTS = ['hips','spine','chest','neck','head',
  'upperArmL','lowerArmL','handL','upperArmR','lowerArmR','handR',
  'upperLegL','lowerLegL','footL','upperLegR','lowerLegR','footR'] as const;
export type JointName = typeof JOINTS[number];
export interface AstronautRig {
  root: THREE.Group;                       // characterRoot child; carries the facing yaw fix
  joints: Record<JointName, THREE.Object3D>;  // pivot groups; meshes hang below
  restHipsY: number;
  geometries: THREE.BufferGeometry[]; materials: THREE.Material[];
}
export function buildAstronautRig(): AstronautRig;  // boot only
export function disposeAstronautRig(r: AstronautRig): void;
```

`character/animStateMachine.ts` (§8 has the table). The states are an
`as const` object rather than a `const enum`, because esbuild's
isolatedModules mode cannot inline a `const enum` across files.
```ts
export const AnimState = { Idle: 0, Walk: 1, Run: 2, JumpLaunch: 3,
  JumpRise: 4, Fall: 5, Land: 6, Slide: 7 } as const;
export type AnimStateId = typeof AnimState[keyof typeof AnimState];
export class AnimStateMachine {
  state: AnimStateId; prev: AnimStateId; timeInState: number;
  blend: number;                         // 0→1 crossfade prev→state
  blendTime: number;                     // per-transition, from the §8 table
  step(t: Readonly<CharacterTelemetry>, dt: number): void;
}
```

`character/ProceduralAnimator.ts`:
```ts
export type PoseFn = (s: PoseSample, out: PoseBuffer) => void; // s = {phase, speed, t, …}
export class PoseBuffer { q: Float32Array /* JOINTS.length·4 */; hipsY: number; }
export class ProceduralAnimator implements CharacterAnimator {
  constructor(rig?: AstronautRig);       // builds its own rig by default
  // §8.2 amendment: a third boot PoseBuffer `snap` freezes the blended pose on an interrupted blend
  // update: sm.step → gait phase += dt·strideHz(speed) → evaluate prev+cur
  // poses into two boot PoseBuffers → per-joint slerp by sm.blend → write joints
}
```
Pose evaluation writes into preallocated buffers through
`THREE.Quaternion.fromArray` / `slerpFlat`, with zero allocation.

`camera/ThirdPersonCamera.ts`:
```ts
export class ThirdPersonCamera {
  readonly heading: Vec3;                // planet frame, ⊥ kcc.up (§4.2)
  pitch: number; distance: number; firstPerson: boolean;
  readonly driver: { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }; // render-local
  readonly camPlanet: Vec3;              // for MoonLod.update
  preStep(kcc: AstronautKCC, lookDX: number, lookDY: number, sens: number): void; // stage 3
  postStep(w: MoonWorld, dt: number): void;   // stage 8 → setDriverPose
  reset(kcc: AstronautKCC): void;        // heading = kcc.fwd, pitch default
}
```

`frame/playFrame.ts`:
```ts
export interface PlayRuntime { world: MoonWorld; input: InputState; ctrl: PlayerController;
  cam: ThirdPersonCamera; animator: CharacterAnimator; telem: CharacterTelemetry; }
export function createPlayFrame(rt: PlayRuntime):
  (delta: number, gl: THREE.WebGLRenderer, scene: THREE.Scene) => void; // §4.3 stages 1–11
```

`ui/playStore.ts`:
```ts
export type PlayPhase = 'LOADING' | 'CLICK_TO_PLAY' | 'PLAYING' | 'PAUSED' | 'ERROR'; // ERROR: §10.2 amendment
export interface PlayHud { speed: number; state: string; grounded: boolean; fps: number;
  lat: number; lon: number; altAGL: number; }
export const usePlayStore: UseBoundStore<StoreApi<{ phase: PlayPhase; loadProgress: number;
  hud: PlayHud; setPhase(p: PlayPhase): void; setLoad(p: number): void; setHud(h: PlayHud): void }>>;
```
The frame loop writes through `usePlayStore.getState()`. HUD writes go
through `createTelemetryPublisher(100)`, and only `setPhase` is unthrottled.

UI files:
- `ui/PlayShell.tsx`: `export function PlayShell(props: { onRequestPlay(): void })` renders the overlays by phase.
- `ui/Hud.tsx`: `export function Hud()` shows the controls hint, speed, state, FPS and coordinates.
- `ui/Overlays.tsx`: `LoadingOverlay`, `ClickToPlayOverlay` and `PauseOverlay`.

`PlayPage.tsx`, the route component:
```ts
export default function PlayPage(): JSX.Element;
// useMemo(once) → createMoonWorld + runtime; <Canvas gl={{antialias:true}}>
//   <primitive object={world.sceneRoot}/> <MultiCameraRig onFrame={frame}/> </Canvas>
//   <PlayShell/>; useEffect → input.attach(canvas), pool.attach(scene); cleanup → dispose
```

**Optional:** `e2e/play.spec.ts` (Q6, last phase). It loads `/?page=play`,
waits for CLICK_TO_PLAY, and asserts no console errors and a non-blank
canvas. In a test-only mode (`?autoplay=1`) it presses W and asserts that
the HUD speed is > 0.

**5.3 Conditional core edit** (only on a Lead ruling for Q2/Q3; default-off,
additive, acceptance-safe):
- `coyoteTime` (s, default 0):
  - when a SURFACE `_groundedTick` ends airborne WITHOUT a jump (a walk-off),
    record `_coyoteLeft = coyoteTime` and the last surface normal;
  - in `_flightTick`, while `_coyoteLeft > 0` and `input.jump` is set, apply
    the jump impulse `jumpSpeed` along the stored normal (radial blend per
    `upBlendWeight`) once, then set `_coyoteLeft = 0`;
  - with a value of 0, the branch is never taken.
- `airControl` (fraction, default 0): in SURFACE-airborne `_flightTick`, add
  `airControl·(vDes − vRelTangential)/accelTau·dt`, tangent-projected and
  capped so it never raises the speed above `sprintSpeed`. With a value of
  0, the branch is skipped before any arithmetic.
- Verification: m1e + m1f regression pages unchanged
  (`npx playwright test e2e/m1e.spec.ts e2e/m1f.spec.ts`), and a byte-equal
  integrity trace with the field at 0 (§13).

**5.4 Process files** (every checkpoint): `docs/T1-plan.md`, `notes/task.md`,
`notes/STATE.md`, plus a `notes/CHANGES.md` entry for every code change in
the build stage.
### §6 World bootstrap plan
This section settles where the player spawns, which harness code the play world ports (and which it drops), and the exact boot and teardown order of `createMoonWorld()`. Harness line numbers refer to `game/src/test/Milestone1F_TestHarness.tsx` (1777 lines, last changed in `3057899`). Every ported block is a by-value copy. The harness file itself is never edited or imported (§4.1).

**6.1 Spawn evaluation (A7)**

Evidence comes from a read-only Node probe. It ran the shipped `findSpawn` verbatim against the real `terrainField` and `SimulationCore` rails, using the M1F moon params. The probe was a scratch run and is not committed. A committed equivalent arrives as a §13 build test.

| Measure | Result |
|---|---|
| Spawn direction (planet frame) | (0.320588, −0.036825, 0.946503) — deterministic, mulberry32(0x7f1a) |
| Search | score 16.505; never reaches the 0.35 early break, so it runs all 24,000 iterations; **159 ms** in Node (boot only, inside LOADING) |
| Spawn point | height −2.31 m, slope 0.41° |
| Sky at t = 0 | Earth elevation 8.67° (Earthrise), Sun elevation 36.41° |
| Connected walkable patch | the ≤45° (no-slide) region flood-filled from the spawn on a 2 m grid covers ≥14.9 ha and reaches ≥424 m. It hit the ±300 m probe box, so the true size is larger. |
| Ring walkability, ≤45° (≤50° = max walk) | 10 m 89% (100%) · 25 m 56% (64%) · 50 m 76% (88%) · 100 m 60% (69%) · 200 m 58% (63%) · 400 m 38% (46%) · 800 m 60% (64%) |
| Relief | ring max slopes reach 80°+ (cliffs); heights span −58 … +190 m within 800 m |
| Global context | 51.7% of the moon is ≤45° (20,000 uniform samples) |

**Decision: keep the shipped Earthrise spawn.** It is flat at the start point, the walkable patch around it is large and connected, and the terrain beyond is varied (slopes, cliffs, relief) for free roam. Cliffs over 45° are handled by the KCC's existing slide behaviour, and R (respawn) is the escape hatch.
- `world/spawn.ts` ports harness lines 157–221 (`slopeFromNormal` + the `findSpawn` body) **verbatim**. The search is deterministic, so play and M1F spawn at the same site.
- The `?spawn=x,y,z` parse moves out into `parseSpawnOverride()`, with its warning prefix changed from `[M1F]` to `[play]`.
- The rejected F30x corridor/LOS gate (`tools/diag-m1f-core.mjs`, commit `439f4d5`) is satellite-specific and was never shipped. It is **not** ported.
- A build test pins the result to the direction above (tolerance 1e-9), so any terrain or rail drift fails loudly instead of silently moving the spawn.
- If the Lead prefers no boot search, the fallback is to replace the search with that constant. This is a one-line change, and the test already holds the value.

**Initial facing.** After `teleportSurface`, `ThirdPersonCamera.reset()` sets `heading` to Earth's tangential projection at the spawn. That is `earthDir` rotated into the planet frame by the conjugate of `spinQuatInto(kcc.spinPhase)`, then projected ⊥ `kcc.up`, falling back to `kcc.fwd` if the projection is degenerate. As a result, the first CLICK_TO_PLAY frame shows the Earthrise behind the astronaut. `respawnPlayer()` repeats this with the *current* spin phase.

**Day/night finding.** The core's `timeScale` stays 0, so the Sun and Earth are inertially fixed. The KCC still spins the moon under them at `spinOmega` 0.0005 rad/s, which gives a period of **3.49 h**. At the spawn:
- 10 min: Earth 25.9°, Sun 19.2°;
- 21.3 min: **sunset**;
- 30 min: Earth 60.2°, Sun −15.1°;
- 99.8 min: Earth sets;
- 126.0 min: sunrise;
- 204.4 min: Earth rises.

A player who stays in one place therefore spends about 105 min in Earth-light (0.28) plus ambient light (0.5) only. This becomes open question **Q8** (§2). The default keeps the harness value, per A2.

**6.2 Port map** (harness range → play destination)

| Harness lines | Content | Play destination | Disposition |
|---|---|---|---|
| 100–108 | `MOON` params, `R`, `MOON_MU`, `MAX_TERRAIN_H` 360, `HEIGHT_SLACK` 420 | `world/moonConfig.ts` | PORT (name → `'Play Moon'`; every other value identical) |
| 109 | `initTerrainField(MOON)` | `createMoonWorld` step 1 | PORT (moved from module scope into the function) |
| 112–113 | `SimulationCore` + `setTimeScale(0)`, `FloatingOriginAdapter` | step 2–3 | PORT |
| 116–120 | `TerrainMeshPool` 96/2/96/6/12, `new SkyImpostorPool()` | step 4–5 | PORT (pool opts → `PLAY_POOL_OPTS`; sky uses its 1400/9700 defaults) |
| 123–137 | KCC config, `registerEntity(dynamic:false)`, `setFocusEntity`, `attachWriteThrough` | `MOON_ASTRONAUT` + step 6 | PORT (entity id → `'play-astronaut'`) |
| 141–154 | `earthVec`/`earthDist`/`earthDir`/`sunDir` from frozen rails | step 7 → `MoonWorld.earthDir/sunDir` | PORT |
| 157–222 | `slopeFromNormal`, `findSpawn`, `teleportSurface` | `world/spawn.ts` + step 8 | PORT (6.1) |
| 224–260 | `walkFwd` autopilot direction | — | EXCLUDE (test-only) |
| 261–272 | `surfacePoint` | — | EXCLUDE (used only by satellites/probes) |
| 274–434 | quadtree nodes + `updateLOD` | `world/MoonLod.ts` | PORT as a class (module globals `camPlanet`, `camU*`, `horizonDot`, `cand*`, `FACE_NODES` → instance fields); algorithm byte-for-byte |
| 435–453 | `sceneRoot` ⊃ `spinGroup` + `skyGroup`; Sun light 0xfff1de 2.2 @ `sunDir`·8000; Earth light 0x8fb4e8 0.28; ambient 0x2a3850 0.5; core shell R−MAX_H−40 (40×28, 0x0d1118) | step 9 | PORT |
| ~455–469 | satellites A/B/C | — | EXCLUDE |
| 471–513 | Earth hero mesh (`EARTH_R` 5000, Lambert+rim `ShaderMaterial`) | step 9 | PORT |
| ~515–568 | probe pair (materials, meshes, `PROBE_DIR`) | — | EXCLUDE |
| ~569–572 | glow quad + `sky.stars`, `sky.mesh` | step 9 | PORT |
| ~574–600 | M1E box astronaut | — | REPLACE with `AstronautRig` (§7) under `characterRoot` |
| 629–668 | `updateProbes` | — | EXCLUDE |
| 650–696 | key/mouse listeners, `readUserInput` | — | REPLACE (`InputState` + `PlayerController`, §5/§9) |
| 697–790 | `computeDriverPose` + quat helpers | `camera/ThirdPersonCamera.ts` | REWRITE (§9). `lookAtQuatInto` and the boom terrain clamp are reused; the frame mixing is fixed per the §4.4 erratum. |
| 810–914 | `applyRenderState` | `world/skyState.ts` `applySkyState` | PORT minus probe slots 9/10, probe meshes, satellites, `RIG.maskOverride`, `RIG.stats` |
| 915–927 | `assignObject`, `assignObjectMesh` | `world/skyState.ts` (module-private) | PORT (drop the `maskOverride` line) |
| 929–932 | `assignSpinObject` | — | EXCLUDE (satellites only) |
| 950–1398 | telemetry/suite/A-B render machinery | — | EXCLUDE (acceptance harness) |
| 1399–1567 | `onFrame` | `frame/playFrame.ts` | REWRITE as the §4.3 pipeline |

**Port gotcha (`applySkyState`).** The harness calls `spinQuatInto(kcc.spinPhase, _qS)` inside the *satellites* block (around line 888). The terrain-record loop that follows depends on `_qS`. When the satellites are removed, that one call must stay, placed just before the terrain loop. Otherwise chunk layer masks are computed with a stale rotation. A build test checks this: after 60 s of spin, every resident chunk near the player carries `NEAR_BIT`.

**6.3 `createMoonWorld()` boot sequence** (called once from `PlayPage`'s `useMemo`; nothing runs at import)

| # | Step | Notes |
|---|---|---|
| 1 | `initTerrainField(MOON_PARAMS)` | A module singleton, so one world per page load (main.tsx full-load rule) |
| 2 | `core = new SimulationCore(); core.setTimeScale(0)` | Frozen rails (A3) |
| 3 | `adapter = new FloatingOriginAdapter(core)` | |
| 4 | `pool = new TerrainMeshPool({...PLAY_POOL_OPTS, params: MOON_PARAMS})` | Workers spawn here |
| 5 | `sky = new SkyImpostorPool()`; `setBody` for slots 0–8 from `PLAY_BODIES` | |
| 6 | `kcc = new AstronautKCC(MOON_ASTRONAUT)`; `registerEntity('play-astronaut', {dynamic:false})`; `setFocusEntity`; `kcc.attachWriteThrough(...)` | |
| 7 | Earth/Sun directions from `getCelestialState('earth'|'moon')` | Throws if the rails are missing (harness behaviour) |
| 8 | `spawn = parseSpawnOverride(location.search) ?? findEarthriseSpawn(earthDir)`; `kcc.teleportSurface(spawn.dir)` | About 159 ms (6.1) |
| 9 | Scene graph: lights, shell, Earth mesh, glow, stars, `characterRoot`; `lod = new MoonLod(pool, MOON_R)` | All allocation happens here, boot only |
| 10 | In `PlayPage`, after R3F mounts: `pool.attach(scene)` | Copies the harness `Scene()` effect (line 1568) exactly, including its `primeAll`/`unprimeAll` usage, which is verified line by line when porting |

The phase goes LOADING → CLICK_TO_PLAY when `lod.residentAround(spawn.dir, …)` is true, or after the §10 timeout. The radius and timeout are set in §10.

**6.4 Teardown** (`MoonWorld.dispose()`, run on `PlayPage` unmount): `pool.disposeAll()` (workers and meshes), dispose the sky material/geometry, the Earth/shell/glow geometries and materials, and the rig (`disposeAstronautRig`). After that, `core.unregister` if the API exists, otherwise nothing. `terrainField` is a module singleton and is never reset. That is why leaving the page is a full navigation (`<a href>`), matching every harness page.

### §7 Character rig specification
`character/AstronautRig.ts` builds the V1 character in code: a ROBLOX-like
blocky astronaut about 1.87 m tall, made of 17 pivot groups with box meshes
hanging below them. It has no skeleton, no skinning and no asset. Every
number below is binding for the build. The only exception is the colour
values, which are tunable within the listed palette.

**Additions to §5 (additive, binding):**
- `export const RIG_DIMS` (7.2). §8's pose and IK math reads it, and no
  literal may be duplicated elsewhere.
- `buildAstronautRig(groundClearance = 0.02)`, which takes an optional
  parameter (7.4). `moonWorld` passes `MOON_ASTRONAUT.groundClearance`.

**7.1 Axes, facing and rotation sign conventions** (checked numerically
against `sphericalFrame.ts` and `astronautKCC.ts`)
- **Rig-local axes** (three.js convention): +Y is up, −Z is facing, and +X
  is the character's right, because (−Z)×(+Y) = +X.
- **KCC frame.** `kcc.frameQuatInto` is `quatFromFrameInto(fwd, up)`
  (`astronautKCC.ts` 367). Its matrix columns are X = `fwd`, Y = `up` and
  Z = `fwd×up`. Z is exactly the KCC's own `_right` (line 555). So the
  local +X of `characterRoot` is the KCC's forward. That is why the harness
  box astronaut was modelled facing +X.
- **Facing fix.** `rig.root` carries a constant yaw of **Ry(−π/2)**, set
  once at boot. It maps rig −Z (facing) to +X (`kcc.fwd`), and rig +X
  (right) to +Z (`kcc` right). This is a proper rotation, so there is no
  mirroring: D strafes right and the visor faces the direction of travel.
  The animator never writes `rig.root.quaternion` after boot.
- **Rest pose = identity.** Every joint's rest quaternion is the identity,
  with the legs straight and the arms hanging straight down at the sides.
  A `PoseBuffer` filled with identity quaternions is therefore the rest
  pose, and every pose quaternion in §8 is a rest-relative delta (which is
  also how a retargeted GLB clip is expressed; see 7.5).
- **Sign table.** For a joint whose segment hangs along −Y at rest:

  | Motion | Axis/sign | Check |
  |---|---|---|
  | Hip or shoulder flexion (limb swings forward) | +X | Rx(+0.5)·(0,−1,0) = (0, −0.878, −0.479): toward −Z |
  | Knee flexion (shin swings back) | −X | the opposite of flexion |
  | Elbow flexion (forearm swings forward) | +X | the same as shoulder flexion |
  | Spine/chest lean forward (the segment points +Y) | −X | Rx(t)·(0,1,0) = (0, cos t, sin t), so the top moves toward −Z when t < 0 |
  | Ankle dorsiflexion (toes up) | +X | the toe at −Z rises when rotated +X about the ankle |
  | Right-side abduction (limb out to +X) | +Z | Rz(+0.5)·(0,−1,0) = (+0.479, −0.878, 0) |
  | Left-side abduction | −Z | mirror |

- **Mirror rule.** Pose functions author ONE side and take
  `side = +1 (R) / −1 (L)`. X components (flexion) keep their sign, and Y
  and Z components are multiplied by `side`. A gait offsets the left side
  by half a cycle (phase + 0.5).

**7.2 Joint hierarchy, pivots and segments** (metres; "rest Y" is the
pivot height above the sole in rig space)

| Joint | Parent | Pivot offset from parent | Rest Y | Segment mesh(es) below the pivot: size w×h×d, centre offset, material |
|---|---|---|---|---|
| `hips` | `rig.root` | (0, 0.92, 0) | 0.92 | pelvis 0.36×0.18×0.24 @ (0, 0, 0), dark |
| `spine` | hips | (0, 0.08, 0) | 1.00 | abdomen 0.34×0.20×0.24 @ (0, 0.10, 0), suit |
| `chest` | spine | (0, 0.20, 0) | 1.20 | torso 0.46×0.34×0.28 @ (0, 0.15, 0), suit; chest panel 0.20×0.12×0.02 @ (0, 0.18, −0.15), accent; backpack 0.38×0.46×0.18 @ (0, 0.13, +0.23), dark |
| `neck` | chest | (0, 0.32, 0) | 1.52 | neck ring (cylinder r 0.09, h 0.06) @ (0, 0.03, 0), dark |
| `head` | neck | (0, 0.06, 0) | 1.58 | helmet (sphere r 0.21) @ (0, 0.08, 0), suit; visor 0.26×0.14×0.06 @ (0, 0.09, −0.19), visor |
| `upperArmR` / `L` | chest | (±0.30, 0.28, 0) | 1.48 | upper arm 0.14×0.30×0.14 @ (0, −0.15, 0), suit |
| `lowerArmR` / `L` | upperArm | (0, −0.30, 0) | 1.18 | forearm 0.13×0.26×0.13 @ (0, −0.13, 0), suit |
| `handR` / `L` | lowerArm | (0, −0.26, 0) | 0.92 | glove 0.12×0.12×0.12 @ (0, −0.06, 0), dark |
| `upperLegR` / `L` | hips | (±0.11, −0.06, 0) | 0.86 | thigh 0.17×0.40×0.19 @ (0, −0.20, 0), suit |
| `lowerLegR` / `L` | upperLeg | (0, −0.40, 0) | 0.46 | shin 0.16×0.40×0.18 @ (0, −0.20, 0), suit |
| `footR` / `L` | lowerLeg | (0, −0.40, 0) | 0.06 (ankle) | boot 0.16×0.08×0.28 @ (0, −0.02, −0.05), dark: the sole sits at y = 0, the toe at z −0.19 and the heel at z +0.09 |

Notes:
- **R is +X, L is −X** (7.1). `JOINTS` order and names are exactly the §5
  list. `joints[name]` is the pivot `THREE.Group`.
- **Derived extents.**
  - The helmet top is at 1.87 m and the visor centre at 1.67 m. That is
    within 5 cm of the KCC `eyeHeight` of 1.62, which keeps the FP camera
    inside the helmet sphere.
  - The hands reach 0.80 m (mid-thigh). The shoulder outer edge is at
    x = 0.37.
  - The backpack spans z +0.14…+0.32, so it reads as behind the character
    from a trailing camera.
- **Leg chain.** The hip pivot is at 0.86, with L1 = L2 = 0.40 and the ankle
  at 0.06. The two-bone law of cosines gives (computed): a pelvis drop of
  0.05 / 0.15 / 0.30 m needs hip flexion 20.4° / 35.7° / 51.3°, knee
  flexion 40.7° / 71.3° / 102.6°, and ankle compensation equal to hip
  flexion, so the foot stays flat. §8's crouch, landing and stance-IK poses
  use this solver on `RIG_DIMS`.

```ts
export const RIG_DIMS = {
  height: 1.87, eyeY: 1.67, hipsY: 0.92,
  hipX: 0.11, hipDrop: 0.06, upperLeg: 0.40, lowerLeg: 0.40, ankleY: 0.06,
  toeZ: -0.19, heelZ: 0.09,
  shoulderX: 0.30, shoulderY: 0.28 /* from chest */, upperArm: 0.30, lowerArm: 0.26, hand: 0.12,
} as const;  // restHipsY === RIG_DIMS.hipsY
```

**7.3 Geometry, materials and render flags**
- **Geometries: three in total**, shared across all meshes and sized
  through `mesh.scale`:
  - a unit `BoxGeometry(1, 1, 1)` for all 18 boxes;
  - `SphereGeometry(1, 20, 14)` for the helmet;
  - `CylinderGeometry(1, 1, 1, 16)` for the neck ring.

  `rig.geometries` holds exactly these three.
- **Materials: four** `MeshStandardMaterial`s, with the harness palette
  kept for continuity:
  - `suit`: 0xe8ecef, roughness 0.85;
  - `dark`: 0x3a4652, roughness 0.7 (pelvis, backpack, neck ring, gloves
    and boots — dark extremities make the gait readable against bright
    regolith);
  - `visor`: 0x7fd4ff, emissive 0x1e7fb8 × 0.9, roughness 0.2,
    metalness 0.1;
  - `accent`: 0xd9822b, roughness 0.6 (the chest panel, which signals
    facing in third person).
- **Mesh count: 20.** That is 8 trunk/head meshes (pelvis, abdomen, torso,
  chest panel, backpack, neck ring, helmet, visor), 6 arm meshes and 6 leg
  meshes. These are 20 small draw calls on the NEAR pass (§11 budget).
- **Scale is 1.0, in true metres.** KCC collision is a point at
  `groundClearance` with no capsule, so the visual size never affects
  physics. The scale is kept at 1 so that stride and foot-plant math in §8
  stays metric.
- **Layers.** After building, `rig.root.traverse(o => o.layers.mask =
  NEAR_BIT)`. three.js tests layers per object, not per parent, so every
  mesh must carry the bit. Default layer 0 already equals `NEAR_BIT`; the
  explicit traverse documents the requirement and guards against a future
  layer-bit change. `applySkyState` sets only `characterRoot` (§5).
- **No shadows.** The rig enables no `shadowMap` (F15). A contact blob
  shadow is a post-V1 polish item, not V1.
- `frustumCulled` stays at its default. Static meshes call `updateMatrix()`
  once and set `matrixAutoUpdate = false`. Joint groups keep auto-update
  (they are animated).
- `disposeAstronautRig(r)` removes `r.root` from its parent and disposes the
  three geometries and four materials. It is teardown only.

**7.4 Attachment under the floating-origin hierarchy and moon spin**
```
sceneRoot
 ├─ spinGroup      pos −origin, quat spinQuat(θ)     terrain, shell (moon-fixed)
 ├─ skyGroup       Earth hero, glow, stars, impostors
 ├─ lights
 └─ characterRoot  pos localPosF32, quat spin∘frame  (owned by stage 6, §4.3)
     └─ rig.root   pos (0, −groundClearance, 0), quat Ry(−π/2)   (boot-constant)
         └─ hips → … (17 joint groups; animator writes their quaternions + hips.position.y)
```
- `characterRoot` is a direct child of `sceneRoot`, NOT of `spinGroup`.
  This mirrors the harness (`sceneRoot.add(astroMesh)`, line 598). Its
  position comes from the core's render-local f32 copy of the INERTIAL
  `absPos`, so spin must not be applied a second time through the parent.
- In `PlayPage`'s mount effect, `characterRoot` is bound to the adapter with
  `adapter.bind('play-astronaut', characterRoot)`, as in harness line 1573.
  Stage 6 still sets `position` from `astroState.localPosF32` explicitly
  (harness 1480–1481). The orientation is `quatMulInto(spinQuat, frameQuat,
  scratch)`, using the exported helper (`sphericalFrame.ts` 194) instead of
  the harness-private `quatMulF64`. It is computed in f64 scratch and
  narrowed once with `quaternion.set`. Spin is composed exactly once.
- **Why the `−groundClearance` offset.** The KCC rests the body at
  R + h + `groundClearance` (`astronautKCC.ts` 353/976). Without the offset,
  the boots float 2 cm above the terrain.
- **Ownership split.**
  - Stage 6 owns `characterRoot`.
  - The animator owns everything below `rig.root`: joint quaternions plus
    `hips.position.y` (bob, crouch and landing drop).
  - Slope and lean tilts are applied on `hips` or `spine`, never on
    `rig.root` or `characterRoot`. So the KCC heading is never contradicted
    by the visual.
- **Up vector caveat.** `characterRoot`'s +Y is `kcc.up`, a blend of radial
  and surface normal (`upBlendWeight` 0.65), not the terrain normal. On a
  slope, flat feet are off by up to (footLen/2)·tan(slope residual), about
  4–8 cm at 30°. §8 owns the mitigation (ankle pitch from `slopeDeg`, plus
  stance-foot IK if it is cheap). V1 accepts the residual.
- **First person.** `animator.setVisible(false)` sets `rig.root.visible =
  false`. This is the harness rule `astroMesh.visible = !camFirstPerson`.
  The NEAR plane (0.1 m) would clip the helmet anyway.

**7.5 GLB swap compatibility** (documented here; nothing is exported for it
in V1)
- **Bone map** to the conventional Mixamo names, for a future
  `GltfAnimator`:
  - `hips`→`Hips`, `spine`→`Spine`, `chest`→`Spine2`, `neck`→`Neck`,
    `head`→`Head`;
  - `upperArm*`→`*Arm`, `lowerArm*`→`*ForeArm`, `hand*`→`*Hand`;
  - `upperLeg*`→`*UpLeg`, `lowerLeg*`→`*Leg`, `foot*`→`*Foot`;
  - `*` is `Left`/`Right`, with the `mixamorig` prefix stripped.
- **Facing correction.** glTF assets face **+Z** (glTF 2.0 convention), but
  the rig contract is −Z. A `GltfAnimator` therefore wraps the loaded scene
  in a group with Ry(π), placed under its own root (which carries the same
  Ry(−π/2) and −groundClearance as `rig.root`). It normalises height to
  `RIG_DIMS.height` with the soles at y = 0.
- The `CharacterAnimator` contract (§5) is unchanged:
  - `root`: feet contact at the origin, +Y up, −Z facing;
  - `update(telemetry, dt)`, `setVisible`, `dispose`, `stateName`.

  The controller, camera and frame pipeline never see joints.

**7.6 Rig build checks** (these feed §13; a Node script, no browser)
- `Object.keys(joints)` equals `JOINTS` in order, 17 entries, with the
  parent of each joint as listed in 7.2.
- At rest (identity pose), the world pivot positions match the "Rest Y"
  column and the ±X offsets to 1e-6.
- The minimum Y of the boot meshes' world bounding boxes is 0 to 1e-6, so
  the soles are on the contact plane. `rig.root.position.y ===
  −groundClearance`.
- `rig.root.quaternion` maps (0, 0, −1) to (1, 0, 0) and (1, 0, 0) to
  (0, 0, 1), each to 1e-9. The visor centre has rig z < 0.
- A pose of Rx(+0.5) on `upperLegR` moves the right boot toward rig −Z
  (the sign-table spot check).
- The rig has 20 meshes, `geometries.length === 3`,
  `materials.length === 4`, and every mesh has `layers.mask === NEAR_BIT`.

### §8 Animation state machine

`character/animStateMachine.ts` picks the state. `character/ProceduralAnimator.ts`
evaluates the poses. The only input is `CharacterTelemetry` (§5). Every pose
quaternion is a rest-relative delta in the §7.1 sign conventions: hip and
shoulder flexion is +X, knee flexion is −X, a forward spine lean is −X, ankle
dorsiflexion is +X, and R abduction is +Z. One side is authored and mirrored
with `side`. Every length comes from `RIG_DIMS`. Angles are in radians unless
marked °.

**8.1 Two-bone leg solver** (`legDrop(D)`, from §7.2)
- The hip pivot is at 0.86 and the ankle at 0.06, so `d0 = upperLeg +
  lowerLeg = 0.80` and `L = 0.40`.
- For a pelvis drop `D` (clamped to [0, 0.30]), `d = d0 − D` and
  `hip = acos(d / 2L)` (+X).
- `knee = 2·hip` (−X) and `ankle = hip` (the sum of the X rotations is 0, so
  the foot stays flat). `hipsY = RIG_DIMS.hipsY − D`.
- Computed values:

  | D (m) | 0.05 | 0.12 | 0.15 | 0.30 |
  |---|---|---|---|---|
  | hip flexion (°) | 20.4 | 31.8 | 35.7 | 51.3 |
  | knee flexion (°) | 40.7 | 63.6 | 71.3 | 102.6 |

- Used by crouch (0.12), the launch dip (0.10), landing (0.03–0.30) and
  slide (0.15).

**8.2 The state table** (evaluated top-down every `step`; the first row
whose entry holds wins, subject to the exit rule of the current state)

| Prio | State | Entry (telemetry) | Exit | Blend-in | Pose driver |
|---|---|---|---|---|---|
| 1 | JumpLaunch | `jumped` (from any state) | after `T_launch` = 0.12 s → JumpRise (or Fall if `vertSpeed` ≤ 0.5) | 0.05 s | 8.4 dip → extension |
| 2 | Land | `landed` and `landingSpeed` > 1.0 m/s | after `T_land` = clamp(0.10 + 0.04·landingSpeed, 0.12, 0.40) s, or at once on `jumped` | 0.04 s | 8.4 absorb with `legDrop` |
| 3 | JumpRise | not `grounded` and `vertSpeed` > 0.5, entered only from JumpLaunch | `vertSpeed` ≤ 0.5 → Fall; `grounded` → Land or locomotion | 0.15 s | 8.4 tuck |
| 4 | Fall | not `grounded`, `airTime` > 0.15 (coyote grace), `vertSpeed` ≤ 0.5 | `grounded` → Land (or locomotion when the landing is soft) | 0.25 s | 8.4 arms-out, ramped by `airTime` |
| 5 | Slide | `grounded` and `sliding` | `sliding` false for 0.10 s | 0.20 s | 8.5 |
| 6 | Run | `grounded` and `speed` ≥ 5.0 m/s | `speed` < 4.5 | 0.20 s | 8.3 gait, run parameters |
| 7 | Walk | `grounded` and `speed` ≥ 0.30 m/s | `speed` < 0.15 and `inputMag` < 0.1 | 0.20 s | 8.3 gait, walk parameters |
| 8 | Idle | default | any row above | 0.30 s | 8.3 idle |

Rules:
- **Hysteresis.** Walk/Run uses 5.0/4.5 m/s, which falls between `walkSpeed`
  3.2 and `sprintSpeed` 6.5 (`MOON_ASTRONAUT`, A2). Idle/Walk uses 0.30/0.15 m/s. Crouch speed (1.5)
  stays in Walk.
- **Coyote grace.** If the character leaves the ground without `jumped`
  (bumps, crests) and `airTime` < 0.15 s, the ground state is held.
- **Soft landing.** `landed` with `landingSpeed` ≤ 1.0 skips Land. An additive
  `legDrop(0.03)` dip decays over 0.10 s instead.
- **Crouch is a weight, not a state.** `w_c` eases toward `crouch ? 1 : 0`
  over 0.15 s. It adds `legDrop(0.12·w_c)` and a chest lean of −X 0.15·w_c
  onto Idle, Walk and Run.
- **Blend curve.** `blend = smoothstep(timeInState / blendTime)`, and the
  joints are combined with a per-joint `slerpFlat(prev, cur, blend)`.
- **Interrupt.** If a transition fires while `blend` < 1, the current blended
  output is copied into a third boot buffer, `snap`. `prev` then evaluates as
  the frozen `snap` and `blend` restarts from 0, so there is no pop (§5
  additive amendment).
- **Minimum dwell.** 0.08 s on every state except JumpLaunch and Land, which
  are timed.

**8.3 Locomotion and foot-slide minimisation** (Walk and Run share one
`gait(v)` PoseFn, so the phase never resets between them)
- **Phase.** `p += dt·f(v)` with `v = speed`, where
  `f(v) = clamp(0.8 + 0.2v, 0.8, 2.2)` Hz.
- **Amplitude.** The hip half-swing is `A(v) = clamp(0.10 + 0.075v, 0.10, 0.60)`.
- **No-slide law.** A stance foot sweeps `S = 2·d0·sin A` relative to the
  hips. To keep the foot planted, the stance must last `S / v`, so the stance
  fraction is `β = S·f / v` (computed):

  | v (m/s) | 1 | 2 | 4 | 8 |
  |---|---|---|---|---|
  | f (Hz) | 1.0 | 1.2 | 1.6 | 2.2 |
  | S (m) | 0.28 | 0.40 | 0.62 | 0.90 |
  | β | 0.28 | 0.24 | 0.25 | 0.25 |

  β stays within [0.22, 0.65] from 0.5 to 8 m/s. A duty cycle of about 0.25
  with a flight phase is the 1/6 g lunar lope, which is the intended look.
- **Stance** (`p_s < β`, with `p_s = p + 0.5` on the L side, mod 1):
  - hip `θ = asin(sin A·(1 − 2p_s/β))` (+X). The foot's hip-relative x is then
    exactly linear in time, so slide is zero on flat ground. A plain linear θ
    would slide up to about 1.1 cm (computed).
  - The knee is 0. The ankle is `−θ`, which keeps the foot flat.
- **Swing** (`u = (p_s − β)/(1 − β)`):
  - hip `θ = −A + 2A·smoothstep(u)`;
  - knee −X `(0.6 + A)·sin(πu)`;
  - ankle +X `0.25·sin(πu)`, for toe clearance.
- **Bob.** `hipsY = RIG_DIMS.hipsY − 0.02 + 0.04·(v/8)·|sin 2πp|`. The pelvis
  peaks during flight.
- **Upper body.**
  - Arm flexion is `−0.8·θ` of the same-side leg (counter-swing).
  - The elbow is +X `0.25 + 0.35·(v/8)`.
  - The chest leans −X `0.05 + 0.10·(v/8)`.
  - The spine counter-twists by Ry `0.05·sin 2πp`.
  - Run uses the same formulas. The v terms are the only difference, so there
    is no discontinuity at 5.0 m/s.
- **Idle.**
  - Breathing: chest −X `0.02·sin(2π·0.25t)`.
  - Suit-bulk arm abduction: 0.06 (R +Z, L −Z).
  - Legs: `legDrop(0.02)`.

**8.4 Jump, air and landing poses**
- **JumpLaunch.**
  - The first 40 % of `T_launch` is the crouch anticipation: `legDrop(0.10)`,
    chest −X 0.20 and arm flexion −0.5 (back).
  - The rest is extension: the legs go to rest, the ankles plantarflex
    −X 0.35, and the arms swing to flexion +1.2.
  - **Caveat.** The KCC applies `jumpSpeed` on the `jumped` frame, so the body
    is already rising during the dip. The anticipation therefore reads
    compressed, at about 50 ms. A true anticipation needs an optional delay of
    about 70 ms on the jump impulse, which is a controller decision for §9.
    The default is no delay, for responsiveness.
- **JumpRise (tuck).**
  - Hip +0.6, knee −1.0, ankle +0.2.
  - The R leg leads by 0.15 rad for asymmetry.
  - Arm flexion +0.6, arm abduction 0.25.
- **Fall (arms out).**
  - The weight is `clamp((airTime − 0.15)/0.5, 0, 1)`.
  - Arm abduction 1.1 (R +Z, L −Z), elbow 0.3.
  - The legs reach for the ground: hip +0.2, knee −0.35.
  - A slow flail of Rz `0.08·sin(2π·0.6t)` on the chest.
- **Land (absorb).**
  - `D = clamp(0.04·landingSpeed, 0.03, 0.30)` through `legDrop`.
  - The drop eases out to `D` over the first 30 % of `T_land`, then recovers
    with a smoothstep.
  - Chest −X `0.6·D/0.30`, arm flexion +0.3 for balance.
  - A flat full-height jump (`landingSpeed` ≈ 4.2) gives D ≈ 0.17 and T_land ≈ 0.27 s.

**8.5 Slide pose**
- The stride phase is frozen and the legs are at `legDrop(0.15)`.
- The R leg leads (hip +0.35) and the L leg trails (hip −0.20).
- Arm abduction 0.7 for balance. The chest leans back +X 0.10.

**8.6 Slope-foot residual** (the §7.4 caveat)
- `kcc.up` is weighted 0.65 toward the normal, so the sole is tilted against
  the terrain by about 0.35·slope (10.5° at 30°). Uncorrected, that leaves a
  toe or heel gap of 4–8 cm.
- **Mitigation.** Two telemetry fields are added (an additive §5 amendment):
  `slopeFwdDeg` and `slopeSideDeg`. They are the signed angles between the
  ground normal and `kcc.up`, projected on `kcc.fwd` and on right. Both are 0
  when airborne.
- Each stance foot adds ankle pitch +X `rad(slopeFwdDeg)` (uphill ahead means
  dorsiflexion) and ankle roll Rz `−rad(slopeSideDeg)`. The roll follows the
  terrain, so it is NOT multiplied by `side`.
- Both corrections are weighted by stance: 1 in stance, fading to 0 across
  swing. Each is clamped to ±20°.
- What remains is the ankle-height error `ankleY·(1 − cos α)` ≈ 1.0 mm at a
  30° slope (computed). Per-leg stance IK is not worth its cost in V1, so the
  residual is accepted.

**8.7 State machine checks** (these feed §13; a Node script, no browser)
- **Scripted telemetry sequences** produce exactly these state sequences:
  - Idle → Walk → Run → Walk → Idle;
  - JumpLaunch → JumpRise → Fall → Land → Idle;
  - a coyote bump (`airTime` 0.1 s without `jumped`) produces no air state.
- **Hysteresis.** Speed noise of ±0.2 around 4.75 m/s produces 0 transitions.
- **Foot slide.** On flat ground at v ∈ {1, 2, 4, 8}, the stance foot's
  displacement over a stance phase is < 1 cm.
- **Solver.** `legDrop` matches the 8.1 table to 0.1°. For D ∈ [0, 0.30] the
  sole normal · up exceeds 0.9999.
- **Interrupt.** A JumpLaunch fired at blend 0.5 of a Walk → Run blend changes
  any joint by < 5° between frames.
- **Integrity.** Every quaternion is unit to 1e-6. The heap delta over 10k
  `update` calls is about 0, so there is zero allocation.

### §9 Controller + camera plan

The play controller (`controller/PlayerController.ts`) and the camera
(`camera/ThirdPersonCamera.ts`) are play-layer modules. The KCC stays the
physics authority. All vector math is in the **planet frame** (moon-fixed,
f64). Render-local values are produced only at the stage-6 and stage-8
extraction points (§4.3), each of which composes spin exactly once. Speeds
are the `MOON_ASTRONAUT` values (A2, verbatim):

| Parameter | Value |
|---|---|
| walk | 3.2 |
| sprint | 6.5 |
| crouch | 1.5 |
| jump | 4.2 |
| `accelTau` | 0.15 s |
| `autoTurnRate` | 6 rad/s |
| moon g | 1.62 m/s² |

**9.1 Input mapping** (`input/InputState.ts`; look and keys are read only
while `pointerLocked`, and §10 owns the click-to-play overlay)

| Input | Field | Effect |
|---|---|---|
| W / S | `moveY` +1 / −1 | forward / back, relative to the camera |
| D / A | `moveX` +1 / −1 | strafe right / left, relative to the camera |
| Shift (hold) | `sprint` | sprint speed. It is ignored while crouching (the KCC already gives crouch priority) |
| Space (press) | `jumpPressed` edge | jump, through the 9.3 buffer |
| C (hold) | `crouch` | crouch speed and the §8 crouch weight. Jumping is blocked while crouched (KCC `jump && !crouch`) |
| Mouse X / Y | `lookDX` / `lookDY` | orbit yaw / pitch (9.4). In FP: body yaw / look pitch |
| Wheel | `zoomDelta` (additive field) | boom distance, clamped to [1.2, 12] |
| V | `toggleCam` edge | TP ↔ FP (9.4) |
| R | `respawn` edge | respawn (9.3) |
| P / Esc | `pause` edge | pause. Esc also releases pointer lock, which also pauses (§10) |
| H | `toggleHud` edge (additive, §10.5) | debug HUD readout on/off |

Keys are tracked as held sets. `keydown` repeat events are ignored, so an
edge fires once per physical press. A `blur` clears every held key, so no
stuck keys after an alt-tab.

**9.2 Movement math** (stage 4)
- Let `h` be the camera `heading` (unit, ⊥ `kcc.up`). The camera's right is
  `c = h × up`, which is the KCC's own right convention (`_right = fwd × up`,
  `astronautKCC.ts` ~555).
- The desired direction is `d = h·moveY + c·moveX`. When |d| > 1 it is
  normalised, so diagonals are not faster.
- The controller writes `moveF = d·kcc.fwd` and `moveR = d·(kcc.fwd × up)`.
  The KCC rebuilds `vDes = (fwd·moveF + right·moveR)·speed`. Because `fwd`
  and `right` span the same tangent plane as `h` and `c`, `vDes` is exactly
  `d·speed`. The movement direction depends only on the camera and never on
  the body's facing, so there is no feedback loop.
- **Facing ("orient to movement").** In TP, `turnRate = 0` and
  `autoTurnEnabled = true`. The KCC turns `fwd` toward the control velocity
  with `step = a·(1 − e^{−8dt})`, capped at 6 rad/s. A 180° reversal therefore
  turns in about 0.5 s while the velocity swings through `accelTau`.
  Strafing (A/D only) turns the body sideways, as in Unreal/ROBLOX.
  `telemetry.turnApplied` is NOT fed back into the camera, because `heading`
  is not stored relative to `fwd` (§4.2).
- **Sprint.** Sprint is forwarded only while `inputMag > 0.5`, so it never
  fires from standing. The 0 → 6.5 m/s ramp follows `accelTau`: 95 % in
  about 0.45 s, which is a deliberately weighty lunar feel. No change to
  `accelTau`.
- **Slopes and sliding** are KCC-owned (`maxWalkSlopeDeg` and `slideAngleDeg`
  in `MOON_ASTRONAUT`, verbatim). The controller adds nothing. While
  `sliding`, input still steers `vCtl` on top of `vSlide`, which is the
  existing KCC behaviour.
- **Fixed step.** The KCC's own 1/60 accumulator (`update(dt, 5)`, F8) and
  `core.advance(dt)` make the physics frame-rate independent. The controller
  is evaluated once per frame. Its inputs are levels (held keys) plus the
  buffered jump edge, so a frame that runs 0 or 5 substeps loses nothing.
  The F10 note applies: a press made on a 0-substep frame carries over.

**9.3 Jump, fall, landing and respawn** (the controller vs KCC split)
- **Jump buffer** (play layer, F10/Q5). A press sets `buffer = jumpBufferS`
  (0.12 s). While `buffer > 0` and the KCC can launch, the controller sets
  `kcc.input.jump = true`. `postSimulate` detects the launch (grounded →
  airborne with `vertSpeed` > 0.5), clears the buffer and raises
  `jumpedThisFrame`. The result: a press up to 0.12 s before touchdown jumps
  on the landing tick.
- **Coyote time.**
  - Under Q2(a): the opt-in KCC field `coyoteTime` (default 0, so acceptance
    behaviour is unchanged) lets `_flightTick` honour `jump` within
    `coyoteS` = 0.10 s of leaving the ground without a jump. It launches along
    the remembered normal, with the F18 spin-phase composition reused.
  - Without the ruling, V1 has the buffer only. That is documented, and it is
    not emulated by teleport (Q2(b) breaks F18).
- **The §8.4 caveat is DECIDED here: no jump-impulse delay.** The impulse
  lands on the press tick, so responsiveness wins. The crouch anticipation
  stays visual-only (compressed to about 50 ms). The Lead may override this
  with a single `jumpDelayS` tuning field (default 0).
- **Air control.**
  - Under Q3: the opt-in `airControl` field (default 0; play value 0.3) adds,
    in `_flightTick`, a tangential acceleration of `airControl·(d·walk −
    v_tan)/accelTau`. It acts only on the tangential part, never along up.
  - Without the ruling, flight is purely inertial, as now.
  - Q3's default is yes.
- **Landing recovery.** A soft landing (`landingSpeed` ≤ 4.5 m/s, which is
  above a flat full-height jump of about 4.2) has no gameplay penalty; it is
  only the §8 Land pose. A hard landing (> 4.5, for example off a crater
  rim) scales `moveF`/`moveR` by `landRecoverScale` = 0.5 for the §8
  `T_land`, so the absorb reads as weight. This is play layer only, and
  there is no fall damage in V1.
- **Respawn (R).** The character is placed at the §6 boot spawn through the
  same KCC placement call boot uses. The controller then clears the buffer
  and edges and calls `cam.reset(kcc)` (heading = `kcc.fwd`, default pitch
  and distance). The respawn frame runs with `dt = 0` (the same rule as
  resume) so no catch-up ticks run on the new pose.
- **Pause.** Stage 1 forces `dt = 0` while not PLAYING and on the resume
  frame (F7), so physics, animation and camera smoothing all freeze.
  Streaming continues (§4.3 stage 10).

**9.4 Camera** (pre-step at stage 3, post-step at stage 8)
- **Orbit.**
  - Each frame `heading` is re-projected onto the current `up` plane and
    renormalised (parallel transport, §4.2).
  - It is then rotated about `up` by `a = −lookDX·lookSens` (0.0022 rad/px).
    By Rodrigues, a mouse move to the right (dx > 0) turns `heading` toward
    `c` (computed check in VERIFIED).
  - `pitch = clamp(pitch + lookDY·lookSens, −1.2, 1.2)` (default 0.35; >0
    means above the character, looking down; mouse-down raises the camera
    — the conventional non-inverted orbit).
  - Mouse look is applied **raw** (unsmoothed); `camRotTau` = 0 is reserved.
- **Boom.**
  - The pivot is `P = charPos + up·pivotHeight` (1.4 m).
  - The desired camera is `C = P − h·cos(pitch)·dist + up·sin(pitch)·dist`.
- **Terrain collision** (the harness pattern, F6, extended):
  - The terrain is sampled (planet frame, CPU height function) at 4 points:
    0.25, 0.5, 0.75 and 1.0 of the boom.
  - The boom length is cut to the first sample where `boomHeight <
    terrain + camClearance` (0.4 m). It is clamped to ≥ 1.2 m.
  - The camera height is also clamped to `terrain(C) + 0.4`.
  - Spring arm: the length **shrinks instantly** (never clips) and **regrows**
    with `camBoomTau` = 0.30 s (an additive `PLAY_TUNING` field).
- **Follow smoothing.** The pivot lags the character with `camPosTau` = 0.08 s,
  using `k = 1 − e^{−dt/τ}`. **Smoothing runs in the planet frame**, as a lag
  offset relative to the true pivot. Render-local positions jump on every
  floating-origin rebase, so smoothing them would visibly lurch. The spin
  phase is composed only at extraction.
- **Look-at** is the smoothed pivot. `setDriverPose` gets a boot-scratch pose
  (no `drvLocal` literal, F6).
- **First person (V).**
  - On enter: `lookYawDelta = signedAngle(fwd, heading)` once, so the body
    faces where the camera looked. Then `autoTurnEnabled = false`, mouse X
    drives `kcc.lookYawDelta`, and `heading` tracks `kcc.fwd`.
  - The camera sits at `charPos + up·eyeHeight` (1.62) with the pitch
    applied, and `animator.setVisible(false)`.
  - On exit: `heading = kcc.fwd` and `autoTurnEnabled = true`.
  - The minimum TP distance (1.2 m) keeps the helmet outside the 0.1 m near
    plane.
- **Recentering.** There is no auto-recenter behind the character (PC
  convention). Respawn and FP exit realign it.

**9.5 KCC touchpoints**

| Direction | Members | Owner |
|---|---|---|
| Write (each frame) | `input.moveF/moveR/sprint/crouch/jump`, `input.turnRate` (=0), `lookYawDelta` (FP), `autoTurnEnabled` | PlayerController only |
| Write (events) | the spawn placement call (boot, respawn) | PlayerController.reset / moonWorld |
| Read | `grounded`, `up`, `fwd`, `mode`, `spinPhase`, `frameQuatInto`, `telemetry.relSpeed/slideSpeed/turnApplied`, `integrity.landings/lastLandingRelSpeed`, `crouched`, `eyeHeight` | controller, camera, telemetry |
| Core change (only on a ruling) | `coyoteTime` (Q2a), `airControl` (Q3); optional `jumpDelayS` (9.3) | `astronautKCC.ts`, every default 0 |

Acceptance safety:
- Every core field defaults to 0, and the 0 path must execute the existing
  code unchanged (guarded `if (cfg.x > 0)` blocks only).
- Any such edit triggers the full 1A–1E regression before merge (§13).
- No existing default changes.

**9.6 Controller and camera checks** (these feed §13; a Node script with the
real KCC on a flat or synthetic patch)
- **Mapping.**
  - With heading = fwd: W gives moveF = 1, D gives moveR = +1 and moves
    toward `fwd × up`.
  - With heading 90° from fwd: W moves along heading to 1e-6 once `vCtl` has
    settled.
  - Diagonal |d| = 1.
- **Facing.** With W held and heading reversed, `fwd` converges to within 2°
  of heading in ≤ 0.8 s with no overshoot.
- **Buffer.** A press 0.10 s before touchdown launches within 1 tick of
  landing. A press 0.20 s before touchdown does not launch.
- **Pause.** 120 frames in PAUSED leave `absPos`, `absVel` and the pose
  bit-identical, and the resume frame runs 0 substeps.
- **Frame-rate independence.** The same 5 s input script at 30, 60 and 144 Hz
  ends within 1 cm and with the same tick count.
- **Camera clearance.** A scripted 360° orbit at pitch −1.2…1.2 over a
  crater rim never puts the camera below terrain + 0.35. The boom is never
  shorter than 1.2 m.
- **Rebase continuity.** Across a forced origin rebase, the camera
  render-world step equals the character's step to 1 mm (no lurch).
- **Core default path.** With `coyoteTime` = `airControl` = 0, the 1E/1F KCC
  acceptance traces are unchanged (run only if the core is edited).

### §10 Game shell + HUD plan

The shell is everything around the frame loop: the route, the menu entry, the
loading gate, pointer lock, pause, the respawn UI and the HUD. It is React DOM
on top of the canvas. React only **reads** `ui/playStore` (§4.2). The frame
loop writes the store through `usePlayStore.getState()` and never reads React
state. Every navigation is a full page load (F1/F2).

**10.1 Route and menu**
- **Route.** `main.tsx` gets `play: () => import('./play/PlayPage')` in
  `pages`, so `/?page=play` loads it as its own Vite chunk. The
  no-StrictMode comment is kept, because the KCC and rig singletons break
  under a double mount (F1).
- **Menu.** `App.tsx` `PAGES` gets `{ id: 'play', label: 'PLAY — Playable Moon (T1)' }` (§5.1; corrected in place at §15)
  as the **first** entry, so the game sits above the test harnesses. Only
  `play` is added (Q7 default). m1e and m1f stay URL-only.
- **Back to menu.** This is a plain `<a href="/">` in the pause overlay. The
  full load runs `MoonWorld.dispose()` through the unmount path (§6.4), but
  correctness does not depend on it.

**10.2 Phase machine** (`ui/playStore.phase`; `setPhase` is the only
unthrottled store write)

| From | Event | To | Side effects |
|---|---|---|---|
| (mount) | `createMoonWorld()` returns | LOADING | the frame loop runs with `dt = 0`; LOD and streaming run (§4.3 stage 10) |
| LOADING | ready (10.3) or `loadTimeoutS` | CLICK_TO_PLAY | the overlay shows "Click to play" (plus "terrain still streaming" on timeout) |
| CLICK_TO_PLAY / PAUSED | click on the overlay or the canvas | (unchanged until lock) | `canvas.requestPointerLock()`. This is called inside the click handler, because browsers need a user gesture |
| CLICK_TO_PLAY / PAUSED | `pointerlockchange` with lock = canvas | PLAYING | `resumedThisFrame = true`, so the next frame runs `dt = 0` (F7); held keys are cleared |
| PLAYING | `pointerlockchange` with lock lost (Esc, alt-tab, browser UI) | PAUSED | `input.clearHeld()` |
| PLAYING | `P` edge | PAUSED | `document.exitPointerLock()` |
| PLAYING | `visibilitychange` to hidden | PAUSED | the same as a lock loss. A hidden tab must never simulate |
| PAUSED | `pointerlockerror` | PAUSED | an overlay hint: "Click again to resume" |
| any | WebGL `webglcontextlost`, or a worker `error` | ERROR (additive phase) | an error overlay with a Reload link. No recovery is attempted in V1 |

Rules:
- **Re-lock cool-down.** After the user presses Esc, Chrome refuses an
  immediate `requestPointerLock` (about 1 s) and fires `pointerlockerror`.
  The pause overlay therefore disables its Resume button for 1.0 s after
  entering PAUSED, which avoids a dead click.
- **`P` and Esc are equivalent.** Both end in PAUSED with the lock released.
  Esc cannot be intercepted while locked, so it is never bound to anything
  else.
- **`ERROR` is additive.** `PlayPhase` gains `'ERROR'`, which is a §5 type
  amendment.

**10.3 Loading gate** (sets the criterion that §6.3 leaves to §10)
- **Criterion.** `lod.residentAround(spawn.dir, readyRadiusM)` returns the
  fraction in [0, 1] of the currently selected LOD leaves within the
  angular radius `readyRadiusM / R` of the spawn that have a resident mesh.
  The world is ready at 1.0 on two consecutive frames.
- **Values** (additive `PLAY_TUNING` fields):
  - `readyRadiusM` = 300 m. On R = 1364.5 m that is about 12.6° of arc,
    which covers the boom (≤ 12 m), the near layer, and a few seconds of
    sprinting in any direction.
  - `loadTimeoutS` = 15 s. The overlay then offers play anyway. Streaming
    continues and the LOD shows lower-detail tiles until the high-detail
    ones arrive, which is the existing M1F behaviour.
- **Progress.** `setLoad(fraction)` is throttled to ≤10 Hz through the same
  publisher. The overlay shows a bar and a percentage.
- **Physics during loading.** It is frozen (`dt = 0`), so the character
  cannot fall through tiles that are not yet resident. The camera is posed
  once by `cam.reset(kcc)` so the backdrop is the spawn view.

**10.4 Pause overlay** (`ui/Overlays.tsx` `PauseOverlay`)
- **Resume.** A button that calls `requestPointerLock` (respecting the 10.2
  cool-down). A click anywhere on the dimmed canvas does the same.
- **Respawn.** Sets the `respawn` edge. The §9.3 placement runs on the next
  frame with `dt = 0`, and the phase stays PAUSED, so the user sees the new
  spot before resuming.
- **Controls.** The full key list from §9.1.
- **Back to menu.** 10.1.
- **No settings in V1.** Mouse sensitivity and invert-Y are fixed
  `PLAY_TUNING` values.

**10.5 HUD** (`ui/Hud.tsx`; every element is `pointer-events: none` so the
canvas keeps every click)
- **Controls hint**, bottom centre: "WASD move · Shift sprint · Space jump ·
  C crouch · V camera · R respawn · P pause". It fades out after 8 s of
  PLAYING or after the first 20 m walked, whichever comes first. It comes
  back on the pause overlay only.
- **Status**, bottom left: speed in m/s (1 decimal), the §8 state name, and a
  grounded / airborne indicator.
- **Debug readout**, top right, toggled by `H` (an additive `toggleHud`
  edge in `InputState`; default ON in dev builds and OFF in production):
  - FPS as an exponential average with τ = 0.5 s, computed in stage 11 from
    the raw frame `delta`, so it still reads during PAUSED and LOADING;
  - latitude and longitude in degrees, from `kcc.up` in the planet frame;
  - `altAGL` in metres.
- **Zero allocation at 10 Hz.** Two boot-allocated `PlayHud` objects are
  used **alternately** (double buffer). Each publish fills the idle buffer
  and calls `setHud(buf)`, so zustand sees a new reference without anything
  being allocated (§4.5 hot-path rule). State names are module string
  constants.
- **No crosshair in V1.** There is no aiming. FP shows a 4 px centre dot
  only.

**10.6 Teardown and robustness**
- **Unmount** runs `input.detach()` (all listeners from 10.2 plus
  `visibilitychange` and context loss) and then `MoonWorld.dispose()` (§6.4).
  The page then calls `document.exitPointerLock()` if the lock is held.
- **Resize** is handled by R3F. The three-pass camera aspect follows the
  existing `MultiCameraRig` behaviour (F15, unchanged).
- **Focus.** The canvas gets `tabIndex = 0` and focus on the first click, so
  key events never go to the page body.

**10.7 Shell checks** (these feed §13)
- **Phase machine.** A store-only Node test drives the 10.2 events with a
  fake `document`. Every row of the table is hit, and no other transition is
  reachable. A resume always produces exactly one `dt = 0` frame.
- **Loading gate.** A fake LOD that reports 0.5 → 1.0 → 1.0 gives
  CLICK_TO_PLAY on the second 1.0. A fake LOD that stays at 0.9 gives
  CLICK_TO_PLAY at 15 s ± 1 frame, with the streaming note.
- **HUD.** 1,000 frames at 144 Hz produce ≤ 10 publishes per simulated
  second, and the heap delta is about 0.
- **Hidden tab.** `visibilitychange` to hidden during PLAYING makes the next
  frame pause, and the KCC tick count stays unchanged.
- **Playwright (Q6, optional).** `/?page=play` reaches CLICK_TO_PLAY within
  20 s with no console errors and a non-blank canvas. The menu link exists.

### §11 Performance plan

The target is smooth play at typical desktop rates (60 Hz, and higher on
high-refresh displays) with **no per-frame allocation in the play layer**.
Every number below was read from the code at `ba05413` (line anchors given)
or derived from those values, and the derivations are re-checked by the
commit's VERIFIED script.

**11.1 What the existing modules already cost** (reused unchanged)

| Item | Value | Source |
|---|---|---|
| Terrain mesh pool | `meshCount` 96, `workerCount` 2, `workerPoolSets` 96, `maxBatch` 6, `inFlightPerWorker` 12 | `Milestone1F_TestHarness.tsx` 117–120 |
| Chunk grid | `GRID_N` 32 quads per side, `GRID_W` 35 padded (1 skirt ring), `CHUNK_VERTS` 1225 | `terrainField.ts` 33–35 |
| Triangles per chunk | ≤ (35 − 1)² · 2 = 2,312, skirt included | derived |
| Terrain triangles, worst case | 96 · 2,312 ≈ 222k | derived |
| Quadtree | 341 nodes per face (levels 0–4: 1 + 4 + 16 + 64 + 256), 6 faces = 2,046 nodes, boot-allocated | harness 294 |
| Finest chunk | face arc πR/2 ≈ 2,143 m / 16 ≈ 134 m, so ≈ 4.2 m vertex spacing | derived (R = 1364.5) |
| LOD hysteresis | `SPLIT_K` 2.0, `MERGE_K` 1.45, `GRACE_FRAMES` 45; eviction pressure when `freeCount() < 6` | harness 278, 374–411 |
| Streaming allocation | `pump()` allocates only the `postMessage` envelopes, < ~150 B/frame amortized (the 1C analysis) | `TerrainMeshPool.ts` 17–20, 276 |
| Render passes | 3 passes: FAR, then a depth clear, MID, a depth clear, NEAR; `executePasses()` allocates nothing | `MultiCameraRig.tsx` 6–18, 31 |
| Layer split | NEAR [0.1, 3000] / MID [2000, 3e5]; `NEAR_MID_THRESHOLD` 2400, `MID_FAR_LIMIT` 300000 | `MultiCameraRig.tsx` 6, 48–49 |
| Sky | 1 `InstancedMesh` (capacity 24) + a 1,400-star `Points` cloud | `SkyImpostorPool.ts` 6, 145, 169 |
| Spawn search | 159 ms, boot only, inside LOADING | §6.1 |

**11.2 Frame budget** (a mid-range desktop at 60 Hz, 16.7 ms per frame)

| Stage (§4.3) | Budget | Notes |
|---|---|---|
| 1–4 clock, input, camera pre-step, controller | ≤ 0.1 ms | scalar math on boot scratch |
| 5 simulate | ≤ 1.0 ms | ≤ 5 KCC substeps (F8) plus `core.advance`; one substep per frame at 60 Hz |
| 6 render extraction | ≤ 0.1 ms | one spin compose, `adapter.update()` |
| 7 telemetry + animator | ≤ 0.3 ms | 8-state machine, two `PoseBuffer`s, per-joint `slerpFlat` (§8) |
| 8 camera post-step | ≤ 0.2 ms | 4 terrain height samples (§9.4) |
| 9 sky + layers | ≤ 0.2 ms | the existing `applySkyState` work |
| 10 LOD + streaming | ≤ 1.0 ms | a walk over ≤ 2,046 nodes plus `pump()`; the meshing itself runs in the 2 workers |
| 11 HUD | ≤ 0.05 ms | the 10 Hz publish (§10.5) |
| **Play-layer CPU total** | **≤ 3 ms** | leaves ≥ 13 ms for three.js submission and the GPU |

GPU: ≤ 222k terrain triangles plus the §7 rig primitives and the sky, which
is the same load M1F already renders. There are no shadows and no
post-processing in V1.

**11.3 Allocation rules** (the §4.5 hot-path rule made concrete)
- **Boot-allocated.** All vectors, quaternions, the `PoseBuffer`s (§8),
  the two `PlayHud` buffers (§10.5), the camera scratch and the driver pose
  (no `drvLocal` literal, F6) are fields of `MoonWorld` or module scratch.
- **Forbidden in stages 1–11:**
  - `new`, object or array literals, closures and `Array` methods that
    return arrays (`map`, `filter`, `slice`);
  - template strings (state names are module constants);
  - `three.js` helpers that allocate (`clone()`, `Vector3.toArray()` without
    a target).
- **The one accepted exception** is the terrain `postMessage` envelopes
  (< ~150 B/frame, the existing M1C/M1F budget).
- **React** re-renders only on `setPhase` and the ≤ 10 Hz HUD publish. The
  canvas tree never re-renders during play.

**11.4 Terrain and LOD in play**
- **The same pool settings as M1F** (11.1), with no tuning in V1. The play
  camera moves at most 6.5 m/s (sprint), which is far slower than the M1F
  flight tests the pool was sized for.
- **Loading gate** (§10.3). 300 m around the spawn is roughly 2–3 finest
  chunks in every direction.
- **Pressure.** `freeCount() < 6` already evicts before the pool runs dry.
  §13 asserts that pressure never fires during a 60 s walk at the spawn.

**11.5 Performance checks** (these feed §13)
- **Zero allocation.** In Node with `--expose-gc`, 10,000 `playFrame` calls
  on fakes (a stub pool and LOD, the real KCC, the animator and the
  controller) give a `process.memoryUsage().heapUsed` delta of about 0 after
  a final GC, with no growth trend over the run.
- **Browser.** A Chrome DevTools allocation timeline over a 30 s walk shows
  no play-layer allocation sites, only the terrain envelopes.
- **Frame time.** A scripted 60 s walk and sprint from the spawn gives a p99
  frame time ≤ 20 ms at 60 Hz. The HUD FPS EMA stays ≥ 58 on the reference
  machine (to be named by the Lead).
- **Pool health.** `freeCount()` never drops below 6 during the walk.
  `inFlightTotal()` stays ≤ 24 (2 workers × 12).

### §12 Implementation phases
These are the ordered BUILD steps. Building starts only on the Lead's execute
order (LEAD GATE, AGENT_BRIEF.md §4). Each step below is ONE commit and one
checkpoint: the step box, the tracker row, the STATE.md NEXT ACTION and a
`notes/CHANGES.md` entry ride in the same commit (§6). Steps are never merged
or reordered. A step that fails its checks is not committed as done.

**Rules for every step**
- **V0 base check** (every step, exit codes UNPIPED):
  `cd game && npm run typecheck; echo TSC_EXIT=$?` → 0;
  `npm run build; echo BUILD_EXIT=$?` → 0;
  `git diff --quiet ea112ec -- Design_specs Milestone; echo CANON_EXIT=$?` → 0.
- **Additive only.** Until B11, no file outside `src/play/**`, `src/main.tsx`,
  `src/App.tsx`, `tools/test-play-*.mjs` and the process files changes.
  `git diff --quiet <step-base> -- src/core src/render src/workers src/test`
  must exit 0 in B1–B10. That is what makes skipping the M1A–M1F regression
  pages legitimate before B11 (§3 invariant: regression is required only when
  shared modules are touched).
- **Node checks** are new scripts `game/tools/test-play-<area>.mjs`. They use
  the existing loader pattern (`register('./ts-resolve-loader.mjs',
  import.meta.url)`, as in `tools/diag-m1f-core.mjs` line 2), import only
  `src/play/**` + `src/core/**` (no DOM, no WebGL), print one line
  `[test-play-<area>] PASS n/n` or the failing assertions, and exit non-zero
  on any failure. Each is run as `node tools/test-play-<area>.mjs; echo
  NODE_EXIT=$?`. Modules that need THREE objects (rig, animator) use three's
  pure math/scene classes, which run in Node without a renderer.
- **Manual checks** are run on `npm run dev` at `http://localhost:5173/?page=play`
  and recorded in the commit's VERIFIED block as observed facts.
- **Anchors** (grep-verified at planning time, HEAD 6e17fd0):
  `main.tsx` 11–17 (`pages` map) · `App.tsx` 1 (`PAGES`) · harness
  `findSpawn` 167, `updateLOD` 360, `buildAstronaut` 577,
  `computeDriverPose` 697, `applyRenderState` 810, `onFrame` 1399,
  `pool.attach` 1572 / `primeAll` 1574 / `unprimeAll` 1581,
  `<MultiCameraRig onFrame>` 1588 · `astronautKCC.ts` `input.jump` 65,
  `telemetry` 238, `attachWriteThrough` 285, `teleportSurface` 347,
  `resetIntegrityStats` 373, jump clear 483, jump read 590 ·
  `MultiCameraRig.tsx` `NEAR_BIT` 41. If an anchor has drifted when a step
  starts, re-grep it and note the new line in the commit; the code wins.

**12.1 Step overview**

| Step | Content (files, §5 names) | Playable / verifiable outcome | Node check |
|---|---|---|---|
| B1 | route + menu + `PlayPage` stub | `/?page=play` loads, menu lists PLAY first | — |
| B2 | `world/moonConfig.ts`, `world/spawn.ts` | spawn pinned in Node | `test-play-spawn` |
| B3 | `world/MoonLod.ts` | quadtree selection verified in Node | `test-play-lod` |
| B4 | `world/skyState.ts`, `world/moonWorld.ts`, `ThirdPersonCamera.reset/pose`, `frame/playFrame.ts` (stages 6, 8-static, 9, 10) | **static moon**: terrain streams, Earthrise visible | — |
| B5 | `ui/playStore.ts`, `input/InputState.ts`, `ui/Overlays.tsx`, `ui/PlayShell.tsx`, playFrame stages 1, 2, 11 | LOADING → CLICK_TO_PLAY → PLAYING ⇄ PAUSED | `test-play-shell` |
| B6 | `character/AstronautRig.ts`, `CharacterAnimator.ts` (+ `RestAnimator`) | articulated astronaut stands at the spawn | `test-play-rig` |
| B7 | `controller/PlayerController.ts`, `CharacterTelemetry.ts`, camera completed, stages 3–5, 7 | **FIRST PLAYABLE**: walk/run/jump/fall/slide, orbit camera | `test-play-controller` |
| B8 | `character/animStateMachine.ts` (+ `legDrop`) | state sequences verified in Node | `test-play-anim` |
| B9 | `character/ProceduralAnimator.ts`, wired | **ANIMATED**: all 8 states visible in play | `test-play-anim` (full) |
| B10 | `ui/Hud.tsx`, publisher, `H` toggle; perf pass | HUD + zero-allocation proof | `test-play-perf` |
| B11 | CONDITIONAL (Q2/Q3): `astronautKCC.ts` `coyoteTime`/`airControl` | coyote jump + air control; acceptance unchanged | `test-play-controller` (+core) |
| B12 | OPTIONAL (Q6): `e2e/play.spec.ts` | automated smoke | Playwright |
| B13 | close-out | T1 DONE, ready for Lead acceptance + merge | full §13 matrix |

**12.2 Build steps** (resume at the first unchecked box)

- [x] **B1 — Route stub.**
  - Files: `src/main.tsx` (add `play: () => import('./play/PlayPage')` to the
    `pages` map, lines 11–17; keep the no-StrictMode comment), `src/App.tsx`
    (first `PAGES` row `{ id: 'play', label: 'PLAY — Playable Moon (T1)' }`,
    title per §5.1), `src/play/PlayPage.tsx` (default export: a full-window
    div with "SOLARIS — PLAY (booting…)" and a `← menu` `<a href="/">`; no
    world, no Canvas yet).
  - Outcome: the route exists and is its own Vite chunk.
  - Checks: V0; build output lists a separate `PlayPage-*.js` chunk; manual —
    the menu shows PLAY first and the m1a–m1d links unchanged, `/?page=play`
    renders the stub with no console errors, `/?page=m1a` still loads.
  - **Build note (B1, 2026-10-20, independent decision).** The only console
    error seen on `/?page=play` is the browser's automatic `GET /favicon.ico`
    → 404. It is pre-existing: `index.html` declares no icon and the unchanged
    menu `/` logs the same error. It is not a B1 defect and no favicon is
    added (out of scope). Every later "no console errors" check (MT1, B12
    smoke) ignores exactly this `/favicon.ico` 404 and nothing else.

- [x] **B2 — Moon constants + spawn.**
  - Files: `src/play/world/moonConfig.ts` (`MOON_PARAMS`, `MOON_R`, `MOON_MU`,
    `MAX_TERRAIN_H`, `HEIGHT_SLACK`, `MOON_SPIN_OMEGA`, `MOON_ASTRONAUT`,
    `PLAY_POOL_OPTS`, `PLAY_TUNING` incl. `readyRadiusM` 300 / `loadTimeoutS`
    15; values by value from harness 100–137, each with a `// WHY:` source
    line), `src/play/world/spawn.ts` (`slopeFromNormal` + `findEarthriseSpawn`
    = harness 157–221 verbatim; `parseSpawnOverride`, prefix `[play]`).
  - Outcome: the play world's numbers exist with zero runtime effect.
  - Checks: V0; `test-play-spawn` asserts the A1/A2 literals field by field,
    `findEarthriseSpawn(earthDir)` = (0.320588, −0.036825, 0.946503) to 1e-6
    (the step pins the full-precision value it observes as the 1e-9 constant,
    §6.1), spawn slope < 1°, Earth elevation 8.67° ± 0.01°, Sun 36.41° ± 0.01°,
    and `parseSpawnOverride('?spawn=1,0,0')` = (1, 0, 0) / garbage → `null`.
  - **Q8 ruling (2026-10-20):** `MOON_ASTRONAUT.spinOmega` = 0 (play config
    copy only; the harness and KCC defaults are untouched), with a `// WHY:`
    line citing Q8. `test-play-spawn` pins `spinOmega === 0`.

  - **Build notes (B2, 2026-10-20, independent decisions — later steps use these).**
    - `findEarthriseSpawn(earthDir, sunDir)` takes **both** directions (§5.2
      listed `earthDir` only): the verbatim search rotates Earth 75° about
      earth×sun, so the Sun direction is an input. B4 stage 8 passes both.
    - `PLAY_POOL_OPTS` omits `params` as well as `material`
      (`Omit<TerrainMeshPoolOptions, 'material' | 'params'>`); B4 constructs
      `new TerrainMeshPool({ ...PLAY_POOL_OPTS, params: MOON_PARAMS })`.
    - `PLAY_TUNING` is a plain `as const` object with every §5.2 field set to
      the value the plan names (camDistance 7 / 1.2 / 12, pitch ±1.2 / 0.35,
      clearance 0.4, camPosTau 0.08, camRotTau 0, pivot 1.4, jumpBuffer 0.12,
      coyote 0.10, airControl 0.3, boomTau 0.30, hard landing 4.5 / 0.5,
      jumpDelay 0, ready 300 m / 15 s). Later steps tune values here only.
    - Spawn pin: the 1e-9 constant is the full-precision value observed in
      Node 24 — (0.32058829107484366, −0.03682548816622783, 0.9465025256421825);
      it agrees with §6.1's 6-digit value. Search 157–162 ms, score 16.505.
    - `moonConfig.ts` has no module-scope side effects; `initTerrainField`
      stays in `createMoonWorld()` (B4). Neither file is imported by
      `PlayPage` yet, so B2 has zero runtime effect.

- [x] **B3 — LOD controller.**
  - Files: `src/play/world/MoonLod.ts` (class port of harness 274–434: module
    globals → fields, algorithm byte-for-byte, plus the new
    `residentAround(dir, radiusM)` of §10.3).
  - Outcome: the quadtree runs headless.
  - Checks: V0; `test-play-lod` with a fake pool: 341 nodes/face, 2,046 total;
    at the spawn pose at 1.4 m AGL the finest selected level is `MAX_LEVEL` 4
    and the leaf set is identical over 100 repeated `update` calls
    (hysteresis, §11.4); ±0.5 m camera jitter changes 0 leaves;
    `residentAround` = 0 on an empty pool and 1 when every request is
    answered; heap delta ≈ 0 over 1,000 updates.

  - **Build notes (B3, 2026-10-20, independent decisions — later steps use these).**
    - `residentAround(dirX, dirY, dirZ, radiusM)` returns a **number**, the
      §10.3 fraction in [0, 1] (the §5 sketch said `boolean`); it is 0 while
      no leaf is selected yet. B4/B5 gate on `=== 1` for two consecutive frames.
    - `isSelectedLeaf(n)` (additive): the harness never clears `desired` on
      the children of a node that merges, so `desired` alone over-counts. The
      selected leaf set is `desired` plus every ancestor split and not desired.
      `residentAround` and `test-play-lod` use it; the harness algorithm is
      untouched.
    - `LodPool` = `Pick<TerrainMeshPool, 'records' | 'acquire' | 'release' |
      'freeCount' | 'inFlightTotal'>`, so `test-play-lod` drives a fake pool.
    - `update()` does NOT call `pool.pump()`; the frame loop pumps after it
      (harness 1504 order: `updateLOD(); pool.pump();`). The caller passes the
      camera in the planet frame (spin-conjugated, harness 1501–1503).
    - `stats { active, pending, candidates }` is a read-only pass after the
      harness body. Construction samples `terrainHeight`, so
      `initTerrainField(MOON_PARAMS)` must run before `new MoonLod(...)`.
    - K2 diff: 134 of 157 non-blank harness lines (274–434) are verbatim in
      the port (indentation and `this.` normalised); the 23 others are the
      banner, the constant/state declarations and the function headers. No
      algorithm line differs. Observed at spawn: 125 selected leaves, ready
      after 10 answered frames; heap delta −6.5 KB over 1,000 updates.

- [x] **B4 — Static world on screen.**
  - Files: `src/play/world/skyState.ts` (`applySkyState` = harness 810–914
    minus probes/satellites/`maskOverride`/`RIG.stats`; keep the
    `spinQuatInto(kcc.spinPhase, _qS)` call per the §6.2 gotcha),
    `src/play/world/moonWorld.ts` (`createMoonWorld` §6.3 steps 1–9,
    `dispose` §6.4, `respawnPlayer`), `src/play/camera/ThirdPersonCamera.ts`
    (ONLY `reset(kcc)` and the static pose: heading = Earth tangent, pitch
    `camPitchDefault`, boom `camDistance`; the rest lands in B7),
    `src/play/frame/playFrame.ts` (stages 6, 8 static, 9, 10), `PlayPage.tsx`
    (Canvas + `<primitive object={world.sceneRoot}/>` + `MultiCameraRig
    onFrame`; `pool.attach`/`primeAll`/`unprimeAll` copied from harness
    1568–1581 line by line).
  - Outcome: **a static moon** — terrain tiles stream in around the spawn,
    Earth sits ~8.7° above the horizon toward the camera's view, stars and
    Sun light render; nothing moves.
  - Checks: V0; manual — terrain fills within ~15 s with no holes in the near
    field, Earth visible, no console errors or worker errors; navigating to
    `/?page=m1f` afterwards (full load) shows the 1F harness unaffected.

  - **Split (2026-10-21, independent decision).** B4 covers five files and a
    manual browser check, which is more than one session can finish. It is
    split into B4a–B4c below. Each sub-step has its own files, outcome and
    check, and is one commit. B4 is checked once B4c is done. The intent is
    unchanged: a static moon on screen.
    `TerrainMeshPool` spawns Web Workers in its constructor, so it cannot be
    built in Node. `createMoonWorld` therefore takes an optional `makePool`
    factory: the real pool by default, a fake `LodPool` in Node tests. This
    adds no runtime behaviour.
  - [x] **B4a — World bootstrap (headless).**
    - Files: `src/play/world/skyState.ts` (`PLAY_BODIES` = harness slots
      0–8; `applySkyState` + module-private `assignObject`/`assignObjectMesh`
      per the B4 bullet above, keeping `spinQuatInto(kcc.spinPhase, _qS)`
      just before the terrain loop), `src/play/world/moonWorld.ts`
      (`createMoonWorld({ spawnOverride, makePool? })` §6.3 steps 1–9,
      `dispose` §6.4, `respawnPlayer`), `tools/test-play-world.mjs`.
    - Outcome: the full play world, minus the pool's workers, builds and
      updates in Node.
    - Checks: V0; `test-play-world` asserts:
      - the spawn equals the B2 pin to 1e-9 and the KCC sits at it;
      - the scene graph holds the lights, shell, Earth, glow, stars and
        `characterRoot`;
      - after `applySkyState` at the spawn eye pose, `characterRoot` has
        `NEAR_BIT`, the Earth mask is non-zero, Sun slot 0 is active, and
        every resident fake record within 300 m has `NEAR_BIT`;
      - the heap delta is ≈ 0 over 1,000 `applySkyState` calls;
      - `respawnPlayer` returns the KCC to the spawn.
    - **Build notes (B4a, 2026-10-21, independent decisions — later steps use these).**
      - `applySkyState(ctx, px, py, pz, qx, qy, qz, qw)` takes a `SkyCtx`
        (`core, kcc, sky, pool, moonAbs, earthVec, earthDist, earthMesh, glow,
        characterRoot`); `MoonWorld` extends `SkyCtx`, so B4b calls
        `applySkyState(world, …)`. Layer counts go to the exported
        `skyStats { near, mid, written }` instead of `RIG.stats`.
      - The harness allocated `{x,y,z,w} as Quat` per call for the Sun camera
        rotation; the port uses a module scratch `_qCam` (zero-GC, §3).
      - `characterRoot` is a plain `Group` directly under `sceneRoot`
        (render-local, mask `NEAR_BIT`); B6 mounts the rig under it.
      - `MoonWorld.dispose()` calls `core.unregisterEntity('play-astronaut')`
        (the §6.4 "`core.unregister` if it exists" is `unregisterEntity`).
      - `PlayPool = LodPool & Pick<TerrainMeshPool, 'pump' | 'disposeAll'>`;
        `createMoonWorld({ spawnOverride, makePool? })`, spawn search gets
        `(earthDir, sunDir)` per the B2 note.
      - `test-play-world` bundles the TS with esbuild (skyState imports
        `MultiCameraRig.tsx`, which Node type-stripping cannot load) and stubs
        `document` for `makeGlowQuad`'s CanvasTexture. Heap tolerance 64 KB
        over 1,000 calls (observed 16 KB: V8 noise, no per-call objects).
  - [x] **B4b — Static camera + frame stages.**
    - Files: `src/play/camera/ThirdPersonCamera.ts` (only `reset(kcc)` and
      the static pose: heading = Earth tangent, pitch `camPitchDefault`, boom
      `camDistance`), `src/play/frame/playFrame.ts` (stages 6, 8 static, 9
      and 10, with stages 1–5/7/11 as no-op slots), `tools/test-play-frame.mjs`.
    - Outcome: one frame call produces a valid driver pose, sky state and LOD
      request in Node.
    - Checks: V0; `test-play-frame` asserts:
      - the driver pose is finite and the boom length is `camDistance` ± the
        terrain clearance;
      - Earth lies in the camera's front hemisphere (the Earthrise
        composition);
      - `lod.update` and `pool.pump` run on every frame;
      - the heap delta is ≈ 0 over 1,000 frames.
    - **Build notes (B4b, 2026-10-21, independent decisions — later steps use these).**
      - `ThirdPersonCamera.reset(kcc, toward)` takes the look-toward direction
        (the plan said `reset(kcc)`); the static pose faces the Earth tangent,
        so PlayPage/respawn pass `world.earthDir`.
      - `poseInto(kcc)` works in the PLANET frame (K1) and writes
        `offsetPlanet` (camera − feet) and `quatPlanet`; `boomLen` is the
        clamped boom. B7 adds orbit input, spring-arm regrowth, smoothing, FP.
      - `lookAtQuatInto` is exported from `ThirdPersonCamera.ts` (harness
        verbatim, F27 basis); `quatMulInto` from `playFrame.ts`.
      - `createPlayFrame(world, cam)` returns the `onFrame(delta)`; stage 6
        composes the spin once, stage 8 rotates the planet offset/quat by it
        and calls `setDriverPose` with boot scratch (no `drvLocal` literal),
        stage 10 feeds `lod.update` the CAMERA position in the planet frame.
      - `MoonWorld.astroState` (the core entity) is exposed for
        `localPosF32`.
      - Heap row: warm 2,000 frames, measure 10,000 (< 64 KB). V8 warm-up
        retains ~30–70 KB over the first ~1,000 frames that does not grow
        with N (1k → 31 KB, 10k → 18 KB, 50k → 2.8 KB).
      - Observed at spawn: boom 7.000 m, camera–character 7.595 m,
        fwd·earth 0.876, Earth 28.9° off the view axis (inside the 31° half
        FOV; B7 tuning may lower the pitch to centre it).
  - [x] **B4c — PlayPage wiring (static moon on screen).**
    - Files: `src/play/PlayPage.tsx` (Canvas + `<primitive
      object={world.sceneRoot}/>` + `MultiCameraRig onFrame`;
      `pool.attach`/`primeAll`/`unprimeAll` copied from harness 1568–1581).
    - Outcome and checks: exactly the B4 outcome and manual checks above.
    - Closing: check B4c **and** B4.
    - **Build notes (B4c, 2026-10-21, independent decisions — later steps use these).**
      - Entity sync fix: the KCC write-through into the core entity runs only
        inside `kcc.update()`, and nothing updates the KCC before B5, so the
        entity sat at (0,0,0), the origin never rebased and the camera was
        inside the moon (first MT2 run: stars + Earth only). `createMoonWorld`
        now seeds `astroState.absPos/velocity` from the KCC after
        `teleportSurface` and runs one `core.tick()` (time scale 0): the tick
        rebases to the spawn's 256 m lattice and extracts `localPosF32`.
        `respawnPlayer` does the same. Once B5's controller stage calls
        `kcc.update` every frame the write-through takes over; the boot sync
        stays (it covers frame 0). test-play-world gains 4 rows (27/27).
      - `PlayPool` adds `attach | primeAll | unprimeAll`. No `adapter.bind`:
        playFrame stage 6 writes `characterRoot` from `localPosF32` itself.
      - Canvas props are the harness's (dpr [1,1.75], fov 62, near 0.1,
        far 3000); a `← menu` link sits top-left until B5's shell.
      - `tools/check-play-b4.mjs` automates MT2 + MT16 (headless Chrome,
        SwiftShader; needs `vite preview` on :4173): exit 0 iff no non-favicon
        console/page/worker errors on `/?page=play` (15 s) and on a following
        full load of `/?page=m1f&manual=1`. Screenshots go to /tmp.
      - Node tests must run as `node --expose-gc tools/test-play-*.mjs`
        (the heap rows fail without it).

- [x] **B5 — Game shell.**
  - Files: `src/play/ui/playStore.ts` (phases incl. `ERROR`),
    `src/play/input/InputState.ts` (§9.1 map, held sets, edges, `blur`
    clear, `attach/detach`), `src/play/ui/Overlays.tsx` + `PlayShell.tsx`
    (loading bar, click-to-play, pause with the 1.0 s re-lock cool-down,
    error + Reload), playFrame stages 1, 2 and 11 (clock, edges, loading-gate
    publish).
  - Outcome: LOADING → CLICK_TO_PLAY → (click) PLAYING; Esc/P → PAUSED;
    hidden tab → PAUSED.
  - Checks: V0; `test-play-shell` = §10.7 phase machine (every 10.2 row hit,
    nothing else reachable, one `dt = 0` frame per resume) + loading gate
    (0.5→1.0→1.0 and the 15 s timeout); manual — the overlays appear in that
    order, pointer lock engages on click, Esc pauses, Resume is disabled for
    ~1 s then works.
  - **Split (2026-10-21, oversized-step rule).** B5 touches four new files,
    playFrame and PlayPage and needs headless + browser checks — too big for
    one commit. Intent unchanged; B5 is checked when B5c is.
  - [x] **B5a — Store + input (headless).**
    - Files: `src/play/ui/playStore.ts` (`PlayPhase` incl. `ERROR`,
      `PlayHud`, `usePlayStore` with `setPhase`/`setLoad`/`setHud`, and the
      pure `nextPhase(phase, event)` that encodes the §10.2 table),
      `src/play/input/InputState.ts` (§5.2 class + §9.1 map + `zoomDelta`,
      held sets, repeat-ignored edges, `blur` → `clearHeld`, lock-change
      handling with the first-delta drop + per-event clamp (K3),
      `attach/detach`, `requestLock`, `clearEdges`),
      `tools/test-play-shell.mjs` (new).
    - Outcome: no runtime effect (nothing imports them yet).
    - Checks: V0; `test-play-shell` part 1 — every §10.2 row hit and no
      other transition reachable; InputState with a fake element/document:
      WASD/Shift/C held → `moveX/moveY/sprint/crouch`, one edge per physical
      press (repeat ignored), keys ignored while unlocked, `blur` clears
      held, lock change clears held + drops the first mouse delta,
      `detach` removes every listener.
    - **Build notes (B5a, 2026-10-21, independent decisions — later steps use these).**
      - `usePlayStore.dispatch(event, nowMs, detail)` is the single entry for
        §10.2 transitions; it calls the pure `nextPhase(phase, event)` and
        writes the side-fields in the same `set()`: `pausedAtMs` (for the
        1.0 s Resume cool-down), `loadTimedOut` (the "terrain still
        streaming" note), `lockHint` (after `pointerlockerror`), `errorText`.
        `PlayEvent` = ready | timeout | lockAcquired | lockLost | pauseKey |
        hidden | lockError | fatal. ERROR is terminal in V1.
      - `InputState.attach(el, doc?, win?)` takes injectable DOM targets.
        Keys and blur listen on `window`, mousemove and pointerlockchange on
        `document`, wheel on the canvas. Additive members: `lockChanged`
        (an edge, set on every lock change, cleared by `clearEdges`),
        `zoomDelta` (wheel deltaY, accumulated), `exitLock()`.
      - K3: the first mouse event after a lock change is dropped, and every
        event is clamped to `MOUSE_EVENT_CLAMP_PX` = 200 px (0.44 rad at
        `lookSens`). A lock change also zeroes pending look/zoom and clears
        held keys and `jumpPressed`.
      - `pointerlockerror`, `visibilitychange`, `webglcontextlost` and worker
        `error` are NOT in InputState; B5b's `shellRuntime.ts` maps them to
        `dispatch`.
  - [x] **B5b — Frame stages 1, 2, 11 + loading gate (headless).**
    - Files: `src/play/frame/playFrame.ts` (stage 1 clock with
      `resumedThisFrame`, stage 2 edges — `pause` → `exitPointerLock` +
      PAUSED, `respawn` (respawnPlayer, dt = 0), `toggleHud` —, stage 11
      loading gate (two consecutive `residentAround = 1.0` or
      `loadTimeoutS`, ≤10 Hz `setLoad`)), `src/play/ui/shellRuntime.ts`
      (DOM-event → `nextPhase` glue: `pointerlockchange`,
      `pointerlockerror`, `visibilitychange`, `webglcontextlost`, worker
      `error`), `tools/test-play-shell.mjs` part 2.
    - Outcome: the frame loop owns `dt` gating; still no UI.
    - Checks: V0; loading gate 0.5 → 1.0 → 1.0 gives CLICK_TO_PLAY on the
      second 1.0, a stuck 0.9 gives it at 15 s ± 1 frame with the streaming
      note; exactly one `dt = 0` frame per resume; hidden tab → PAUSED with
      `dt = 0` on the next frame; test-play-frame still green.
    - **Build notes (B5b, 2026-10-21, independent decisions — later steps use these).**
      - Stages 1 and 11 live as DOM-free classes in `src/play/frame/shellStages.ts`
        (`PlayClock`, `LoadingGate`) so they are unit-tested headless;
        `createPlayFrame(w, cam, shell?)` runs stages 1/2/11 only when a
        `{ input, store, now? }` shell is passed (B4's static loop and
        test-play-frame are unchanged). The returned function exposes
        `.clock` (B7 reads `clock.dt`) and `.gate`.
      - Clock: `dt` is clamped to `MAX_FRAME_DT` = 0.1 s (a GC/tab stall must
        not inject a huge step; B7's fixed-step accumulator sits below it).
      - Loading gate counts REAL time (the rig delta), each frame capped at
        0.25 s so a single shader-compile hitch cannot fire the 15 s timeout;
        `setLoad` is published at ≤ 10 Hz plus once on the deciding frame.
      - Stage 2: P → `dispatch('pauseKey')` then `input.exitLock()` (the
        resulting lockLost is a no-op from PAUSED); R → `respawnPlayer()` with
        `dt = 0`; H → store `toggleHud()` (new `hudVisible` field, default
        true). `input.clearEdges()` runs at the end of stage 11.
      - `attachShellRuntime({ canvas, doc, workers? }, input, store, now?)`
        returns its detach function. Hidden tab, context loss and worker
        error also call `input.exitLock()` so every resume goes through the
        click → lock path. B5c must pass the pool's workers (TerrainMeshPool
        keeps them private — expose a read-only getter there or skip the
        worker hook; decide in B5c).
  - [x] **B5c — Overlays + PlayShell + PlayPage wiring (browser).**
    - Files: `src/play/ui/Overlays.tsx` (`LoadingOverlay`,
      `ClickToPlayOverlay`, `PauseOverlay` with the 1.0 s Resume cool-down,
      `ErrorOverlay` + Reload), `src/play/ui/PlayShell.tsx`,
      `src/play/PlayPage.tsx` (InputState attach on the canvas, shell
      runtime, the B4 `← menu` link moves into the pause overlay),
      `tools/check-play-b5.mjs` (new; extends check-play-b4).
    - Outcome: LOADING → CLICK_TO_PLAY → (click) PLAYING; Esc/P → PAUSED;
      hidden tab → PAUSED.
    - Checks: V0; check-play-b5 — the loading overlay then "Click to play"
      within 20 s, no non-favicon errors, m1f&manual=1 still boots; manual
      MT3/MT4 (overlays in order, lock on click, Esc pauses, Resume disabled
      ~1 s then works). Closing: check B5c **and** B5.
    - **Build notes (B5c, 2026-10-21, independent decisions — later steps use these).**
      - `PlayShell` renders one overlay per phase and NONE while PLAYING
        (pointer events pass to the canvas); the root carries `data-phase`,
        the pause title `data-paused-at`, the Resume button `data-resume` —
        stable hooks for check-play-b5 and B12. B10's HUD mounts in
        PlayShell's PLAYING branch.
      - `PauseOverlay` disables Resume until `RESUME_COOLDOWN_MS` = 1000 ms
        after `pausedAtMs` (Chrome's re-lock refusal window); the `← menu`
        link lives in the pause and error overlays.
      - InputState is created with the world in PlayPage's `useMemo`; Scene
        attaches it and `attachShellRuntime` to `gl.domElement` in an effect
        and detaches both on unmount.
      - NO worker-error → ERROR hook in V1: TerrainMeshPool keeps its workers
        private and already logs worker errors; exposing them is a shared
        render-module edit (+ m1X regression) for an edge case. Revisit only
        if a worker failure is ever observed in play.
      - check-play-b5 judges the cool-down IN PAGE (disabled iff
        `performance.now() − pausedAtMs < 1000` at read time) because a
        SwiftShader frame can block the main thread > 1 s; the disabled
        window itself is therefore a manual MT3/MT4 check.

- [x] **B6 — Articulated rig.**
  - Files: `src/play/character/CharacterAnimator.ts` (interface, §5.2) +
    `RestAnimator` (identity pose; the B6–B8 placeholder),
    `src/play/character/AstronautRig.ts` (§7.2 hierarchy, §7.3 3 geometries /
    4 materials / 20 meshes on NEAR, `disposeAstronautRig`), mounted under
    `characterRoot`, placed by stage 6.
  - Outcome: the block astronaut stands on the terrain at the spawn, feet on
    the ground, visor facing away from the camera (toward Earth).
  - Checks: V0; `test-play-rig` = every §7.6 assertion; manual — soles touch
    the terrain (no float, no sink > 2 cm), rig visible at both near and far
    boom distances.
  - Build notes (B6, independent decisions — Lead review):
      - `CharacterTelemetry.ts` ships in B6 as the record type +
        `createTelemetry()` only (the animator seam is typed against it);
        `sampleTelemetry(kcc, ctrl, inp, dt, out)` needs `PlayerController`
        and lands in B7 with the §5.2 signature unchanged.
      - `createMoonWorld` builds `RestAnimator(buildAstronautRig(
        MOON_ASTRONAUT.groundClearance))`, mounts `animator.root` under
        `characterRoot`, exposes `world.animator` (B9 swaps in
        `ProceduralAnimator` there) and disposes it in `world.dispose()`.
        playFrame stage 7 already calls `w.animator.update(telem, clock.dt)`
        on a boot telemetry record (B7 fills it).
      - `buildAstronautRig` constructs parent-first (legs after hips), then
        re-keys `joints` in `JOINTS` order so `Object.keys(joints)` equals
        `JOINTS` (§7.6).
      - `test-play-rig` adds a Node MT5 analog: mounted in the play world,
        one frame, sole contact −0.0000 m from the terrain (|·| ≤ 2 cm) and
        visor-from-head-centre · kcc.fwd = 0.904 (= 0.19/hypot(0.09, 0.19),
        the geometric value). `tools/check-play-b6.mjs` screenshots the rig
        after a pause (a PLAYING screenshot times out under SwiftShader).

- [x] **B7 — Controller + camera (FIRST PLAYABLE)** — split into B7a–B7c
  (session 39 decision: one step = controller + camera + wiring + browser
  check exceeds one session's budget; intent unchanged — B7 is DONE when B7c
  is checked). Original outcome kept: **the moon is playable** — WASD
  camera-relative walk, Shift sprint, Space jump, C crouch, R respawn, V first
  person, mouse orbit; the rig moves and turns but holds its rest pose.
  - [x] **B7a — PlayerController + sampleTelemetry (headless).**
    - Files: `src/play/controller/PlayerController.ts` (sole writer of
      `kcc.input`; §9.2 math, §9.3 play-layer jump buffer, hard-landing
      recover scale, `reset()`), `sampleTelemetry` in
      `src/play/character/CharacterTelemetry.ts` (§5.2 derivations),
      `tools/test-play-controller.mjs` (part 1).
    - Outcome: the controller drives the real KCC in Node; nothing on screen
      changes yet (playFrame untouched).
    - Checks: V0; `test-play-controller` = §9.6 Mapping, Facing, Buffer,
      Frame-rate independence + telemetry derivations (vertSpeed, landed,
      sliding) + heap ≈ 0 over 10k controller steps; all play tests green.
    - Build notes (B7a, independent decisions — Lead review):
        - **Per-tick controller (affects B7c).** `PlayerController.simulate(inp,
          cam, dt, 5)` owns the 1/60 accumulator and runs, per tick,
          `step` → `kcc.update(1/60, 1)` → `postSimulate`. Reason: the KCC
          auto-turns `fwd` every tick, so moveF/moveR computed once per frame go
          stale on multi-tick frames (measured 104 mm drift at 30 Hz vs 60 Hz
          over the script); per tick, vDes = d·speed exactly and 30/60/144 Hz
          end within 0.000 mm with equal tick counts. Stage 5 in B7c therefore
          calls `ctrl.simulate(...)` instead of `kcc.update(dt, 5)` directly;
          the KCC's own accumulator stays unused-but-intact (no core edit).
          `beginFrame()` clears the jumped/landed edges once per frame; the
          edges OR over the frame's ticks.
        - `step` re-projects the camera heading onto the current `up` locally
          (the camera still owns transport of its stored heading, B7b).
        - Jump input is re-derived each tick (`jump = buffer > 0 && grounded
          && !crouch`), never latched, so a stale flag cannot outlive the
          buffer (supersedes the F10 carry-over note for the play layer).
        - Hard-landing recovery window = the §8.2 `T_land` formula
          (`landDuration`), so B9's Land pose and the input scale share one
          duration. Telemetry `landed` reads the controller's landings edge
          (one counter diff, not two).
        - `slopeFwdDeg`/`slopeSideDeg` = `atan2(−n·fwd, n·up)` / `atan2(−n·right,
          n·up)` from `terrainNormalInto` at the contact (+ = uphill ahead /
          right); 0 airborne.
        - Test scripts: the §9.6 frame-rate script runs 8 s, not 5 s — a lunar
          jump flies 2u/g = 5.19 s, so 5 s cannot contain the landing. Checks
          run on a zero-amplitude (perfect sphere) field so mapping/facing are
          not confounded by slope; real-terrain behaviour is B7c's browser check.
  - [x] **B7b — ThirdPersonCamera completed (headless).**
    - Files: `src/play/camera/ThirdPersonCamera.ts` (§9.4 orbit, pitch clamp,
      zoom, spring arm shrink/regrow `camBoomTau`, planet-frame pivot lag
      `camPosTau`, FP pose + enter/exit), `test-play-controller` part 2.
    - Outcome: camera behaviour verified in Node against the real terrain.
    - Checks: V0; §9.6 Camera clearance (360° orbit, pitch −1.2…1.2, never
      below terrain + 0.35, boom ≥ 1.2) + Rebase continuity (camera step =
      character step to 1 mm) + orbit sign (dx > 0 turns heading toward
      `heading × up`).
    - Build notes (B7b, independent decisions — Lead review):
        - **API (affects B7c).** Stage 3 = `cam.preStep(kcc, input, ctrl)`
          (transport, TP orbit, pitch, zoom, V toggle; consumes `lookDY` /
          `zoomDelta` always and `lookDX` in TP only — in FP `lookDX` is left
          on the shared InputState for `ctrl.step` as body yaw). Stage 8 =
          `cam.poseInto(kcc, clock.dt)`; `poseInto(kcc)` without dt = snap (no
          lag, boom at target) — the B4b static path, kept for test-play-frame.
          Respawn: `cam.reset(kcc, earthDir, ctrl)` (always returns to TP and
          clears `ctrl.firstPerson`). The camera owns the FP flag and syncs the
          controller's (`FirstPersonSink`).
        - Zoom is multiplicative: `dist·e^{zoomDelta·camZoomSens}`, new additive
          `PLAY_TUNING.camZoomSens` = 0.001 per wheel unit (one 100-unit notch ≈
          10 %), clamped [1.2, 12] — same feel at both ends.
        - Pivot lag snaps (lag = 0) when the pivot moves > 50 m in one frame
          (teleport/respawn), on FP exit, and on the first pose; dt = 0 keeps
          the lag/boom frozen (pose bit-identical over 120 frozen frames).
        - The terrain cut samples the boom from the SMOOTHED pivot (the point
          the camera actually hangs from); the spring arm then shrinks to the
          cut instantly and regrows with `1 − e^{−dt/camBoomTau}`.
        - FP shares the TP `pitch` value (pitch > 0 = look down, mouse-down
          looks down, same sense as the orbit); it is not reset on enter/exit.
          FP has no follow lag (the eye is rigid to the head).
        - Checks: rebase continuity emulates the 256 m lattice / 1,024 m
          threshold in the test (Float64 subtract then `Math.fround`, as the
          adapter does) — measured 0.30 mm, the Float32 narrowing floor;
          clearance runs on the real MOON_PARAMS field at the steepest sample
          within ±1.2 km of the spawn (79.7 m per 5 m), 7 pitches × 72 orbit
          steps, boom compressed on every frame.
  - [x] **B7c — playFrame stages 3–5/7 wiring + browser check (FIRST PLAYABLE).**
    - Files: `src/play/frame/playFrame.ts` (stage 3 camera pre-step, 4
      controller, 5 `kcc.update(dt, 5)` + `core.advance(dt)`, 7
      `sampleTelemetry`), `PlayPage.tsx` / `moonWorld.ts` wiring (respawn
      through `ctrl.reset` + `cam.reset`), `tools/check-play-b7.mjs`.
    - Checks: V0; §9.6 Pause (120 PAUSED frames bit-identical, resume frame
      0 substeps) in `test-play-frame`; `check-play-b7` (scripted W hold
      moves the character, Space leaves the ground, P freezes); manual —
      walk/sprint ~3.2 / ~6.5 m/s, jump lands, crater-rim fall, >45° slide,
      no camera clip on a full orbit.
    - **Build notes (B7c, session 40 — independent decisions).**
      - `createPlayFrame` owns the `PlayerController` (exposed as `frame.ctrl`
        and `frame.lastTicks` = KCC ticks of the last frame). Stage 5 is
        `ctrl.simulate(input, cam, clock.dt, 5)` (per-tick step →
        `kcc.update(1/60, 1)` → postSimulate, the B7a frame-rate fix) rather
        than one `kcc.update(dt, 5)`, then `core.advance(clock.dt)` (harness
        order: KCC, then core). The no-shell static path is unchanged (snap).
      - Stage 3 `cam.preStep` runs only while PLAYING: re-projecting the
        heading on a frozen `up` is not bit-idempotent, so running it while
        PAUSED would drift the pose (§9.6 requires bit-identical).
      - Respawn edge: `w.respawnPlayer(); ctrl.reset(); cam.reset(kcc,
        earthDir, ctrl); clock.forceZero()` inside stage 2 — no `PlayPage` /
        `moonWorld` change needed.
      - Opt-in read-only probe: `?page=play&probe=1` sets
        `window.__playProbe = { kcc, core, world, frame, cam }`; absent by
        default (no behaviour change).
      - `check-play-b7` runs at 640×360 with short PLAYING windows: under
        SwiftShader the headless renderer's RSS grows ~100–200 MB/s while
        PLAYING (pre-existing — reproduced identically at B7b HEAD, 554 → 1353
        MB in 6 s; JS heap flat 18–19 MB), and 1280×720 OOMs a 4 GB VM.
        SwiftShader also runs only ~0.03–0.3 sim s per wall s, so the browser
        check asserts movement and no overspeed (≤ 3.6 m/s per sim s, judged
        on `core.stats.simTime`); the walk-speed number is test-play-frame's
        Node row (W 2 s → 5.959 m incl. acceleration).
      - test-play-frame's shell-path heap row warms 12,000 frames before the
        10,000-frame measurement (JIT warm-up: 83 KB after 2k warm, 168 B /
        96 B at 30k / 60k — non-growing).
      - Manual checks (walk/sprint feel, crater-rim fall, >45° slide, orbit
        clip) are left for the Lead's hands-on pass; the scripted ones pass.

- [x] **B8 — Animation state machine.**
  - Files: `src/play/character/animStateMachine.ts` (§8.2 table, timers,
    hysteresis; `legDrop` §8.1). Pure TS: no THREE.
  - Outcome: the machine is verified in isolation; nothing on screen changes.
  - Checks: V0; `test-play-anim` = §8.7 scripted sequences, hysteresis,
    solver table to 0.1°, quaternion integrity, heap ≈ 0 over 10k steps.

    - **Build notes (B8, session 41 — independent decisions).**
      - `LEG = {d0 0.80, L 0.40, hipsY 0.92, maxDrop 0.30}` is restated in
        `animStateMachine.ts` instead of importing `RIG_DIMS` (AstronautRig
        pulls THREE + MultiCameraRig; the machine must stay pure). The test
        asserts `LEG` against `RIG_DIMS`. `legDrop(D, out)` writes a boot
        `LegPose` (angles + hip/knee/ankle X quaternions, f64) — B9 copies
        them into its `PoseBuffer`.
      - The JumpLaunch and Land entries override the 0.08 s minimum dwell:
        `jumped`/`landed` are one-frame edges and would otherwise be lost.
      - An un-jumped airborne body past the 0.15 s coyote grace enters Fall
        even while `vertSpeed` > 0.5 (crest launch): §8.2 enters JumpRise only
        from JumpLaunch, and holding a gait in mid-air reads as a bug.
      - A grounded exit of JumpLaunch / JumpRise / Fall re-evaluates the
        ground rows (Land if `landed` and > 1.0 m/s, else Slide/Run/Walk/Idle).
      - `sm.interrupted` is true for exactly the step whose transition fired
        while `blend` < 1; B9 copies its blended output into `snap` then.
        `sm.softDipD` (0.03 m decaying linearly over 0.10 s) and
        `sm.crouchW` (linear ease, 0.15 s) are exposed for B9's poses.
      - `test-play-anim` PASS 48/48: the three §8.7 sequences, hysteresis
        0 transitions from Walk and from Run, dwell, ledge Fall at 0.15 s +
        Land → Walk, slide-off 0.10 s, Land→JumpLaunch, mid-blend interrupt
        flag, smoothstep + BLEND_IN, crouch weight, solver table to 0.1°,
        sole·up > 0.9999, unit quaternions, heap < 64 KB over 10k steps.
        The foot-slide and per-frame interrupt-angle rows land in B9.

- [x] **B9 — Procedural animator (ANIMATED).**
  - Files: `src/play/character/ProceduralAnimator.ts` (§8.3–§8.6 poses,
    `PoseBuffer` crossfade, stride scaling), swapped in for `RestAnimator`
    in `PlayPage`.
  - Outcome: **movement animates**: idle sway, walk and run cycles that
    scale with speed, jump crouch → extension → tuck, arms-out fall, landing
    absorb + recovery, slide pose, crouch blend.
  - Checks: V0; `test-play-anim` extended with §8.7 foot slide (< 1 cm at
    v ∈ {1, 2, 4, 8}) and interrupt (< 5° per frame); manual matrix — each of
    Idle, Walk, Run, JumpLaunch, JumpRise, Fall, Land, Slide observed at least
    once in a 2-minute session, no visible pops at transitions.
  - **Split (session 41, oversized-step rule):** B9 is one pose module plus
    two test families plus a page swap — too large for one session. It is
    split by state family so each sub-step is independently verifiable; the
    B9 box is checked when B9c is done. Intent, files and checks unchanged.
  - [x] **B9a — PoseBuffer + ProceduralAnimator core + locomotion.**
    - Files: `src/play/character/ProceduralAnimator.ts` — `PoseBuffer`
      (JOINTS·4 f32 + hipsY), boot `prev`/`cur`/`snap` buffers, per-joint
      `slerpFlat` crossfade by `sm.blend`, joint write-out; PoseFns Idle
      (§8.3 idle) and the shared `gait(v)` Walk/Run (§8.3 phase, amplitude,
      no-slide stance law), crouch weight via `legDrop(0.12·w_c)` + chest
      lean, soft-landing dip. Other states fall back to Idle until B9b.
      Not yet swapped into `PlayPage` (nothing on screen changes).
    - Outcome: Idle/Walk/Run/crouch poses evaluate headless from telemetry.
    - Checks: V0; `test-play-anim` extended — §8.7 foot slide (stance foot
      < 1 cm over a stance phase at v ∈ {1, 2, 4, 8}), phase continuity
      across Walk ↔ Run, unit quaternions to 1e-6, heap ≈ 0 over 10k
      `update` calls.
    - **B9a build notes (session 42, independent decisions):**
      - `ProceduralAnimator.ts`: `PoseBuffer` (f32 JOINTS·4 + `hipsY`),
        `JOINT_INDEX`, `GAIT` literals, `gaitFreq/gaitAmp/gaitBeta`,
        `gaitPose` (Walk + Run, one formula), `idlePose`, `blendPose`
        (per-joint shortest-path slerp, lerp+normalize when cos > 0.9995),
        boot `prev/cur/snap/out`; pose math in f64, THREE is type-only.
        `evalState` returns Idle for JumpLaunch/JumpRise/Fall/Land/Slide
        (B9b replaces those branches). `snap` is already filled from `out`
        on `sm.interrupted` and used as `prev` (`prevIsSnap`).
      - **Swing ankle (deviation from the §8.3 literal):** the literal swing
        ankle `0.25·sin(πu)` is 0 at both ends while the stance ankle `−θ`
        ends at ±A — a measured 34° pop per step at sprint. The swing ankle
        is `knee − θ + 0.25·sin(πu)` (the stance foot-flat law extended to
        swing, plus the same toe-clearance term): C⁰ at both stance
        boundaries, flat foot + clearance intent kept.
      - β is clamped to [0.22, 0.65] (the band §8.3 computes for 0.5–8 m/s):
        below ~0.25 m/s `S·f/v` → ∞, the clamp keeps a swing phase at a
        crawl. The v/8 terms use v clamped to [0, 8].
      - Crouch and the soft dip are additive `legDrop(0.12·w_c + softDipD)`
        X angles on the gait legs (all about X, so they commute with θ);
        Idle uses `legDrop(0.02 + addD)`. Chest lean −0.15·w_c is additive.
      - The "no pop" row samples Walk ↔ Run at 600 Hz (< 3° per 1/600 s): at
        60 Hz a sprint swing legitimately moves > 10° per frame, so a
        per-frame bound cannot tell a pop from motion. B9b's §8.7 interrupt
        row (< 5° per frame) stays as specified.
      - `test-play-anim` PASS 75/75 (+27: purity, PoseBuffer layout, β table,
        foot slide 0.0000 cm at v = 1 and < 1 cm at 2/4/8, phase error
        1e-16, max joint step 1.39°/600 Hz, write-out, Idle/crouch/soft-dip,
        Idle fallback, heap ≈ 0 over 10k `update`).
  - [x] **B9b — air, landing and slide poses + interrupt snap.**
    - Files: `ProceduralAnimator.ts` — §8.4 JumpLaunch dip → extension,
      JumpRise tuck, Fall arms-out ramped by `airTime`, Land absorb +
      recovery (`legDrop` D = clamp(0.04·landingSpeed, 0.03, 0.30)); §8.5
      Slide; §8.6 slope ankle terms; `snap` filled on `sm.interrupted`.
    - Outcome: every §8.2 state has its pose; transitions never pop.
    - Checks: V0; `test-play-anim` — §8.7 interrupt (JumpLaunch at blend 0.5
      of Walk → Run changes any joint < 5° between frames), each of the 8
      states' poses differs from rest, unit quaternions, heap ≈ 0.
    - **B9b build notes (session 43, independent decisions):**
      - `ProceduralAnimator.ts`: `AIR` literals (§8.4–§8.5), `launchPose`,
        `risePose`, `fallPose`, `landDepth`, `landDrop`, `landPose`,
        `slidePose`, `dropLegs`; `evalState(b, s, speed, u)` takes the timed
        state's progress `u` (`progress()`: JumpLaunch t/tLaunch, Land
        t/T_land). Land depth D is fixed at Land entry (`landD`).
      - A timed prev state (JumpLaunch / Land) is evaluated at its END pose
        (u = 1) while blending out — the pose it handed over from.
      - JumpLaunch: the dip (first 40 %) is a held pose (the 0.05 s blend-in
        eases into it); the extension smoothsteps every angle from the dip
        values to its targets, so the seam is C⁰ (< 1° per u/1200).
      - JumpRise: the R-leg 0.15 rad lead is split ±0.075 about hip 0.6.
      - Land drop: quadratic ease-out 0 → D over the first 30 %, smoothstep
        recovery to 0; chest −X 0.6·d/0.30, arm flexion 0.3·d/D.
      - §8.6 slope terms ride on Idle / Walk / Run / Land / Slide (ground
        states); air states have 0 by telemetry. Gait swing weight is
        `1 − sin(πu)`: 0 mid-swing, C⁰ at both stance boundaries.
      - Slide freezes the stride phase (`phase` not advanced in Slide).
      - §8.7 interrupt (< 5°) is read as the TRANSITION frame: the frozen
        `snap` is what blend 0 shows (measured 0.035°); the 0.05 s
        JumpLaunch blend-in that follows is intended motion (up to ~32° per
        frame — a 50 ms crossfade). Walk and Run share `gaitPose`, so an
        Idle → Walk control row proves the check discriminates (no-snap
        step 17.9°).
      - `test-play-anim` PASS 115/115 (+40; the B9a Idle-fallback rows
        retired).
  - [x] **B9c — swap into PlayPage (ANIMATED on screen).**
    - Files: `PlayPage.tsx` (ProceduralAnimator replaces RestAnimator; HUD
      state name via `stateName`), new `tools/check-play-b9.mjs`.
    - Outcome: **movement animates** in the browser (the B9 outcome).
    - Checks: V0; all play Node tests; `check-play-b9` (W → Walk/Run state
      observed, Space → JumpLaunch/JumpRise/Fall/Land, 0 errors) + b7
      regression; manual matrix (B9 checks) left for the Lead's hands-on pass.
    - Build notes (session 44, decisions):
      - The swap is in `createMoonWorld` (`moonWorld.ts`), not `PlayPage.tsx`:
        the world already owns the animator (B6), so page, Node tests and a
        future GLB animator share one mount behind the K13 seam. PlayPage is
        unchanged; `PlayerController.ts` imports no animator (grep 0).
      - HUD state name: there is no HUD component before B10, so B9c exposes
        `stateName` through the opt-in `?probe=1` probe
        (`__playProbe.world.animator.stateName`); **B10's `Hud.tsx` shows it**
        (the B10 HUD already lists "state").
      - `check-play-b9` records the state on every rAF frame (single-frame
        timed states would be missed by polling) and waits on the KCC for the
        landing (~5 sim s airborne at 4.2 m/s, g 1.62 → tens of wall s under
        SwiftShader, capped at 60 s). Viewport 400×225: the long jump window
        at 640×360 drove the renderer to ~3.9 GB and the 4 GB VM killed the
        browser; the VM was also resized to 8 GB. 640×360 stays for b7.
      - `test-play-rig` row 193 now expects `Idle` from the world animator.
      - Evidence: check-play-b9 PASS (Idle → Walk; Idle → JumpLaunch →
        JumpRise → Fall → Land → Idle in 4.98 sim s; PAUSED holds; 0 errors);
        check-play-b7 PASS; anim 115, rig 97, world 27, frame 23, shell 101,
        lod 40, spawn 70, controller 57 PASS; TSC/BUILD exit 0.

- [x] **B10 — HUD + performance pass.** (DONE 2026-10-21, session 45 — Node + V0 verified; browser b9/b7 PASS on re-run, session 46)
  - Files: `src/play/ui/Hud.tsx`, `createTelemetryPublisher(100)` wiring,
    the `H` toggle; any allocation fixes the perf check reveals.
  - Outcome: the controls hint + speed/state/FPS/coords HUD; the play layer
    proven allocation-free.
  - Checks: V0; `test-play-perf` = §11.5 zero allocation (10,000 `playFrame`
    calls on fakes, `--expose-gc`, heap delta ≈ 0, no trend) + §10.7 HUD
    (≤ 10 publishes per simulated second at 144 Hz); manual — DevTools
    allocation timeline over 30 s shows only terrain envelopes, HUD FPS ≥ 58,
    `freeCount()` ≥ 6 throughout a 60 s walk/sprint.

  - B10 build notes (decisions, session 45):
    - Publisher: play-local `ui/hudPublisher.ts` (`HudPublisher`) replaces
      `createTelemetryPublisher(100)`. The store one writes the TEST store's
      telemetry shape through object literals on `performance.now()`. The
      play one keeps the same 100 ms throttle (`PLAY_HUD_INTERVAL_S` = 0.1)
      but runs on accumulated raw frame delta, which is deterministic
      headless. It double-buffers `PlayHud` (§10.5) and has an FPS EMA of
      α = 1 − e^(−Δ/τ) with τ = 0.5 s, reading in every phase.
    - `PlayHud` gains `hintOn` and `firstPerson` (additive). The hint
      latches off at 8 s of PLAYING time or 20 m walked while grounded.
      Latitude = asin(up.y) and longitude = atan2(up.x, up.z), in the planet
      frame with the spin axis +Y. `hudVisible` defaults to
      `import.meta.env.DEV` (Node → ON).
    - `Hud.tsx` mounts inside PlayShell while PLAYING. Hooks: `data-hud`,
      `data-hud-state`, `data-hud-debug`, `data-hud-dot`.
    - Allocation: no play-layer fix was needed. The sampling heap profiler
      shows no retained growth.
    - Warm-up change in `test-play-perf` and `test-play-shell`: the heap
      tests now warm up for 20,000 frames. A 2,000-frame warm-up leaves a
      ~15 KB / 1k-frame creep, but `--jitless` is flat to the byte and the
      creep vanishes after ~20k frames, so it is V8 tiering metadata. The
      test-play-shell heap row also failed on 8f6a97e without B10.
    - Pool health: `freeCount ≥ 6` is judged on the real pool (MT15). The
      instant-pump stub fills to MoonLod's `freeCount ≤ 2` stop, so the
      stub value is printed only.
    - Browser checks deferred (OLU budget) and re-run in session 46 on an
      8 GB VM against HEAD 1283545: check-play-b9 (400×225) B9_EXIT=0
      (Idle → Walk; JumpLaunch → JumpRise → Fall → Land → Idle; 5.18 sim s
      airborne; P freezes; 0 errors) and check-play-b7 B7_EXIT=0 (1.04 m/s
      from rest, airborne, paused drift 0 m, 0 errors). B10 fully verified.

- [x] **B11 — CONDITIONAL core edit (only on a Lead ruling for Q2 and/or Q3).**
  - **DONE (session 144, 2026-10-28; ADR-027).** Both fields applied, default 0; play
    0.10 s / 0.3. Default-path hash trace byte-equal to the unedited core
    (`tools/test-kcc-default-trace.mjs`); test-play-controller 76/76; regression
    `e2e/m1e.spec.ts e2e/m1f-r` (m1f-r replaces the retired m1f.spec.ts, ADR-026),
    test-kcc-gate exit 0, alloc gate unchanged (known red, ADR-005). Evidence
    `docs/audit/evidence/T1/B11/`.
  - **PAUSED 2026-10-21 for A1** — resume only after A1 U01's m1f baseline
    verdict and a Lead order.
  - **Ruled IN (2026-10-20): Q2 = (a) and Q3 = yes.** B11 is applied, not
    skipped: both opt-in fields, default 0, play values `coyoteTime` 0.10 s
    and `airControl` 0.3. The baseline-first m1e/m1f regression is mandatory.
  - **BLOCKED at the baseline (session 46, 2026-10-21) — Lead ruling needed.**
    The §13.5 baseline-first regression was run on the UNEDITED tree
    (HEAD 1283545; `git diff 3057899 HEAD -- src/core src/render src/workers
    src/test e2e playwright.config.ts` empty, so no shared file has changed
    since T1 branched). m1e 6/6 PASS. m1f badges: run 1 `[PASS,FAIL,FAIL,
    PASS,FAIL]`, run 2 `[PASS,FAIL,PASS,PASS,FAIL]`. R2 fails in both runs
    and R3 fails in one (R3DUMP run 1 meshR = impR = 0.00, so nothing was
    drawn in the A/B window; run 2 meshR 85.75, sym 0). Environment: Chrome
    155.0.8059.84 (channel chrome), SwiftShader, 2 vCPU / 8 GB VM. The B11
    gate needs m1f R1–R4 PASS, and a red baseline cannot attribute a later
    failure to the edit, so the core edit was NOT started (AGENT_BRIEF.md §9:
    a regression page that cannot be fixed → STOP). Options for the Lead:
    (a) rule R2 (and the R3 flake) environment-soft for this VM, judging
    B11 by "badges identical to baseline"; (b) re-run m1f on hardware WebGL
    or the Lead's machine first; (c) investigate R2 as its own item first.
    1F is §8-parked, so no harness or row change is made under any option.
  - Files: `src/core/physics/astronautKCC.ts` (§5.3: optional `coyoteTime` /
    `airControl`, default 0, branch skipped at 0; re-read the F14 jump clear
    at 483 and the read at 590 before editing), `MOON_ASTRONAUT` enables the
    ruled values, `PlayerController` drops nothing (the buffer stays in play).
  - Outcome: a jump pressed ≤ `coyoteTime` after walking off a ledge fires;
    limited air steering.
  - Checks: V0; `test-play-controller` + the §9.6 core default-path item
    (integrity trace byte-equal with both fields at 0); REGRESSION
    `npx playwright test e2e/m1e.spec.ts e2e/m1f.spec.ts; echo PW_EXIT=$?` →
    m1e 6/6 PASS, m1f badges R1–R4 PASS, R5 WAIVED (counted as PASS whatever it shows,
    Lead directive 2026-10-20; `PW_EXIT` stays 1 while R5 shows FAIL, so judge by the
    badges, §13.5). With no ruling on record, this box is checked as **SKIPPED (no
    ruling)** with that reason in the commit, and no core file changes.

- [x] **B12 — OPTIONAL Playwright smoke (Q6).** DONE (session 145): `e2e/play.spec.ts` PW_EXIT=0 ×2; 4 mutants exit 1.
  - **Ruled IN (2026-10-20): Q6 = yes**, because Playwright runs in the build
    VM (verified: Chrome 152 installed, `e2e/m1a.spec.ts` ran to its badges).
  - Files: `e2e/play.spec.ts` (+ `?autoplay=1` test mode in `PlayShell`,
    inert without the parameter).
  - Checks: V0; `npx playwright test e2e/play.spec.ts; echo PW_EXIT=$?` → 0
    (CLICK_TO_PLAY ≤ 20 s, no console errors, non-blank canvas, HUD speed > 0
    after W). Checked as SKIPPED if the Lead declines Q6.

- [x] **B13 — Close-out.** DONE (session 146): full §13 automated matrix green on the final tree (evidence `docs/audit/evidence/T1/B13/`); one stale test literal fixed (test-play-spawn 69/70 → 72/72). Manual MT1–MT16 (hardware WebGL, human) NOT RUN in the VM — owed by the Lead in the acceptance play-test; headless stand-ins check-play-b4/b5/b6/b7/b9 exit 0.
  - Run the full §13 verification matrix once on the final tree; record
    every result in the commit.
  - Tracker: build status DONE (pending Lead acceptance); STATE.md NEXT
    ACTION → "Lead acceptance of T1, then merge `t1-playable-moon` → `main`"
    (§4: merge only once DONE and verified; never force-push).
  - Plan header stage → DONE after the Lead accepts.

**12.3 Not a step** (excluded from every build step)
- No edit to `Milestone1F_TestHarness.tsx` or any `src/test/**` file; no
  harness consolidation (Option A follow-up is a separate task, §1).
- No GLB asset, no sound, no saves (1G), no Design_specs/Milestone staging.
- No KCC default change in any step; B11 is the only core touch and only on
  a ruling.

### §13 Verification plan
This section turns every check list in the plan into one matrix:
§6.1, §7.6, §8.7, §9.6, §10.7, §11.5 and the 12.2 per-step checks. Each build
step runs the subset its 12.2 box names. B13 runs everything once, on the
final tree. A "clean" or "PASS" claim needs an observed, UNPIPED exit code
(standing rule, approval ledger 2026-10-15).

**Erratum to 12.2 B11** (verified at HEAD e063c7c, `game/e2e/m1f.spec.ts`):
- The m1f spec asserts `not.toContain('FAIL')` on the joined badges ("no FAIL
  badge may remain").
- R5 is the parked FAIL, so `npx playwright test e2e/m1f.spec.ts` **exits 1
  by design**.
- The regression criterion is therefore the badge vector the spec logs
  (`[m1f gate] badges: …`), not the exit code. B11's text is corrected in place.
- **R5 waiver (Lead directive 2026-10-20).** R5 is deferred to later work and counts as
  PASS in every T1 check. An R5 FAIL is never a regression and never a
  blocker; record it as `R5 WAIVED`. Every other FAIL still blocks. The
  waiver changes no code: the harness, its rows and thresholds, and
  `e2e/m1f.spec.ts` stay as they are (Scope OUT; AGENT_BRIEF.md §8).

**13.1 Base commands (V0, every step)** — run from `game/`:

| # | Command | Pass evidence |
|---|---|---|
| V0.1 | `npm ci; echo CI_EXIT=$?` (once per fresh VM/session) | `CI_EXIT=0` |
| V0.2 | `npm run typecheck; echo TSC_EXIT=$?` | `TSC_EXIT=0` |
| V0.3 | `npm run build; echo BUILD_EXIT=$?` | `BUILD_EXIT=0`, plus a `PlayPage-*.js` chunk from B1 on |
| V0.4 | `git diff --quiet ea112ec -- Design_specs Milestone; echo CANON_EXIT=$?` | `CANON_EXIT=0`. In a shallow clone without `ea112ec`, use `HEAD` and say so |
| V0.5 | `git diff --quiet <step-base> -- src/core src/render src/workers src/test; echo SHARED_EXIT=$?` (B1–B10) | `SHARED_EXIT=0`. A non-zero result means a shared module was touched, so §13.5 regression becomes mandatory for that step |

**13.2 Node test matrix** — `node [--expose-gc] tools/test-play-<area>.mjs;
echo NODE_EXIT=$?`.
- Each script registers `./ts-resolve-loader.mjs`, as `tools/diag-m1f-core.mjs`
  does.
- Each script prints `[test-play-<area>] PASS n/n` and exits non-zero on any
  failed assertion.
- A script, once introduced, stays green in every later step. B13 runs all
  seven.

| Script | From | Assertions (source) |
|---|---|---|
| `test-play-spawn` | B2 | A1/A2 literals field by field; spawn dir (0.320588, −0.036825, 0.946503) pinned (1e-9 after B2 fixes it); slope < 1°; Earth 8.67° / Sun 36.41° ± 0.01°; `parseSpawnOverride` valid → vector, garbage → `null` (§6.1, B2) |
| `test-play-lod` | B3 | 341 nodes/face and 2,046 total; `MAX_LEVEL` 4 at the spawn pose; leaf set stable over 100 updates; ±0.5 m jitter changes 0 leaves; `residentAround` 0 → 1; heap ≈ 0 over 1,000 updates (§11.1, §11.4, §10.3) |
| `test-play-shell` | B5 | every §10.2 row hit and nothing else reachable; one `dt = 0` frame per resume; loading gate 0.5 → 1.0 → 1.0 and the 15 s ± 1 frame timeout; a hidden tab pauses with an unchanged tick count (§10.7) |
| `test-play-rig` | B6 | the 17 joints in order with their parents; rest pivots to 1e-6; sole min-Y 0; root quaternion axis maps; visor z < 0; the Rx(+0.5) sign check; 20 meshes / 3 geometries / 4 materials, all `NEAR_BIT` (§7.6) |
| `test-play-controller` | B7 (+B11) | Mapping, Facing, Buffer (0.10 s fires / 0.20 s does not), Pause bit-identical over 120 frames, frame-rate independence 30/60/144 Hz ≤ 1 cm, camera clearance ≥ terrain + 0.35 and boom ≥ 1.2 m, rebase continuity ≤ 1 mm (§9.6); from B11, also the core default-path trace |
| `test-play-anim` | B8 (B9 full) | scripted state sequences; ±0.2 m/s hysteresis gives 0 transitions; coyote bump gives no air state; `legDrop` table to 0.1°; sole·up > 0.9999; unit quaternions; heap ≈ 0 over 10k; from B9, also foot slide < 1 cm at v ∈ {1, 2, 4, 8} and interrupt < 5°/frame (§8.7) |
| `test-play-perf` | B10 | `--expose-gc`: 10,000 `playFrame` calls on fakes, heap delta ≈ 0 with no trend; HUD ≤ 10 publishes per simulated second at 144 Hz (§11.5, §10.7) |

"Heap ≈ 0" means a `process.memoryUsage().heapUsed` delta after a final
`gc()` of less than 64 KiB, with no monotonic growth across 10 equal chunks.

**13.3 Manual test matrix** — `npm run dev`, Chrome, hardware WebGL,
`http://localhost:5173/?page=play`.
- Each row is recorded in the step's VERIFIED block as `MTn ✓ <observed>`,
  or `MTn ✗ <observed>`, which blocks the step.
- "From" is the first step whose commit must record the row. B13 records all
  of them.

| Row | From | Action | Expected |
|---|---|---|---|
| MT1 | B1 | open `/` | PLAY listed first; m1a–m1d links unchanged; `/?page=m1a` still loads |
| MT2 | B4 | load `/?page=play` | terrain streams around the spawn with no near-field holes; Earth ~8.7° up in view; no console or worker errors |
| MT3 | B5 | wait, then click | loading bar → "Click to play" within 15 s (or the timeout note); a click engages pointer lock → PLAYING |
| MT4 | B5 | Esc, then P, then switch tabs | each one → PAUSED; Resume disabled for ~1 s, then works; no lurch on resume |
| MT5 | B6 | stand at the spawn | rig on the ground (no float, sink ≤ 2 cm), visor away from the camera |
| MT6 | B7 | W / A / S / D, mouse orbit | camera-relative movement; body turns toward its motion; diagonal speed not faster |
| MT7 | B7 | hold Shift; hold C | ≈ 6.5 m/s sprint; ≈ 1.5 m/s crouch; Space does nothing while crouched |
| MT8 | B7 | Space on flat ground; Space ~0.1 s before landing | the jump lands; the buffered press re-launches on touchdown |
| MT9 | B7 | walk off a crater rim | falls, lands, keeps control |
| MT10 | B7 | climb a > 45° slope | slides down; can walk out at the bottom |
| MT11 | B7 | full 360° orbit at both pitch limits; wheel | camera never inside terrain; zoom clamps to 1.2 … 12 m |
| MT12 | B7 | V, then V; R | FP and back; respawn at the spawn with zero velocity |
| MT13 | B7 | walk/sprint more than 1,100 m from the spawn | an origin rebase happens (local > 1,024 m) with no visible camera or character jump |
| MT14 | B9 | a 2-minute session through every state | Idle, Walk, Run, JumpLaunch, JumpRise, Fall, Land, Slide each seen at least once; stride scales with speed; no pops at transitions; pause freezes the pose |
| MT15 | B10 | H; a 60 s walk + sprint | HUD toggles; FPS EMA ≥ 58; DevTools allocation timeline shows only terrain envelopes; `freeCount()` ≥ 6 |
| MT16 | B4 | `← menu`, then `/?page=m1f` (full load) | the 1F harness boots and runs unaffected by the play page |

**13.4 Playwright smoke (optional, B12 / Q6)**
- `npx playwright test e2e/play.spec.ts; echo PW_EXIT=$?` → `PW_EXIT=0`.
- The spec checks, as listed in B12:
  - CLICK_TO_PLAY within 20 s;
  - no console errors;
  - a non-blank canvas;
  - HUD speed > 0 after W in `?autoplay=1`.
- It inherits `playwright.config.ts`: Chrome channel, preview server on
  :4173, `workers: 1`.
- If Chrome is not installed where the step runs, the row is recorded as
  NOT RUN with the reason. It is never recorded as passed.

**13.5 Milestone regression (when shared modules are touched)**
- **When it is required.**
  - It is mandatory at B11.
  - It is mandatory at any step whose V0.5 is non-zero.
  - It is not required for B1–B10 when V0.5 = 0. The page is additive, and
    AGENT_BRIEF.md §3 requires regression only when shared modules change.
- **Baseline first.** Before the B11 edit, run the suites on the unedited
  tree and record the badges. After the edit, the result must equal that
  baseline. This separates environment noise from a regression.
- **Command.** `npx playwright test e2e/<spec>.ts; echo PW_EXIT=$?`.
  - `astronautKCC.ts` (B11) → `m1e`, `m1f`.
  - Any other `src/core/**` change → all of `m1a`…`m1f`.
- **Expected outcomes** (from the STATE.md ledger):

| Suite | Expected | Known environment-soft rows |
|---|---|---|
| m1a | 5/5 PASS | row 5 (frame time, machine-dependent) |
| m1b | 5/5 PASS | — |
| m1c | 4/4 PASS | — |
| m1d | 5/5 PASS on hardware WebGL | row 2 (dive misses grounding under SwiftShader; FPS backlog) |
| m1e | 6/6 PASS, `PW_EXIT=0` | — |
| m1f | R1–R4 PASS; R5 WAIVED = PASS (Lead directive 2026-10-20); `PW_EXIT=1` while R5 shows FAIL is expected, not a failure | R5 (waived, excluded from comparison) |

- **Pass rule.** Each suite's badges must match its baseline exactly. An
  environment-soft row may differ only if it also differed in the baseline.
  m1f R5 is excluded from the comparison (waived).
- **Stop rule.** Any other difference is a regression. Fix it before
  reporting, or STOP (AGENT_BRIEF.md §9).

**13.6 Evidence format** (the VERIFIED block of every build commit)
- **Exit codes.** One line per command, with the exit token: `TSC_EXIT=0`,
  `BUILD_EXIT=0`, `CANON_EXIT=0`, `SHARED_EXIT=0`.
- **Node checks.** One line per script: the PASS line plus `NODE_EXIT=0`.
- **Manual checks.** One line per manual row that the step introduces or
  re-checks, with the observed value. For example: `MT7 ✓ sprint 6.4–6.5 m/s
  (HUD)`.
- **Regression.** Where regression was run, the baseline and post-edit
  badges side by side.
- **Not run.** Anything not run is written as NOT RUN with the reason. A step
  whose required checks were not run is not checked off.

### §14 Risk register
Each row names the step that owns the mitigation and the check that proves it.
Likelihood: L (unlikely) · M (plausible) · H (expected without the
mitigation). A risk whose mitigation fails its check is a STOP for that step
(AGENT_BRIEF.md §9), never a silent workaround.

**14.1 Register**

| # | Risk | Impact | Likelihood | Mitigation (and its proof) | Owner step |
|---|---|---|---|---|---|
| K1 | **KCC frame mixing** (§5 erratum to §4.4): `absPos`/`absVel` are inertial, `pLocal`/`up`/`fwd` are planet-frame; mixing them rotates the WASD mapping, the heading and the camera boom by the spin phase (0.0005 rad/s ≈ 1.7°/min). | High — controls and camera drift slowly away from "forward"; looks like a bug only after minutes of play. | H | All play-layer math (heading, move mapping, boom, smoothing) runs in the PLANET frame; the spin is composed ONCE at render extraction (§4.3 stage 6), via `spinQuatInto(kcc.spinPhase)` exactly as `computeDriverPose`/`refreshFwdWorld` do. Proof: `test-play-controller` runs the §9.6 mapping case after advancing the spin phase by 600 s and still meets the 1e-6 tolerance. | B4, B7 |
| K2 | **LOD port drift**: the class port of harness 274–434 (`MoonLod`) changes selection, split/merge hysteresis or activation order (module globals → fields). | Medium — popping, holes, or a different streaming load than the ratified M1F behaviour. | M | Byte-for-byte algorithm port (constants MAX_LEVEL 4, SPLIT_K 2.0, MERGE_K 1.45, GRACE 45, 3 activations/frame, in-flight cap 24, HORIZON_MARGIN 150 copied, not re-derived); the step's commit shows a side-by-side diff of the body vs the harness range. Proof: `test-play-lod` (341 nodes/face, 2,046 total, MAX_LEVEL 4 at spawn, stable leaf set over 100 updates, ±0.5 m jitter → 0 changes). | B3 |
| K3 | **Pointer-lock quirks**: Chrome's ~1 s re-lock refusal after Esc (`pointerlockerror`), `movementX/Y` spikes on the lock/unlock frame, browsers differing (Firefox/Safari), lock lost on alt-tab. | Medium — dead clicks, camera snapping on resume, stuck keys. | H | §10.2 rules: Resume disabled 1.0 s after entering PAUSED; `input.clearHeld()` on every lock change; mouse deltas are ignored on the first event after a lock change and clamped per event; `resumedThisFrame` gives a `dt = 0` frame. Proof: MT4 (Esc/P/tab switch → PAUSED, no lurch on resume). Chrome is the reference browser; others are best-effort and noted in the commit. | B5 |
| K4 | **Rebase lurch**: a floating-origin rebase (max\|local\| > 1,024 m, `REBASE_THRESHOLD` in `precisionMath.ts`) shifts every render-local position; any smoothing or cached render-local value jumps by up to 1,024 m. | High — a visible camera/character jump every ~1 km of travel. | M | Camera follow smoothing runs as a planet-frame lag offset (§9.4); nothing in the play layer caches a render-local position across frames; local positions are always Float64 subtraction then narrowing (§3 invariant). Proof: §9.6 "rebase continuity" (camera step = character step to 1 mm across a forced rebase) and MT13. | B7 |
| K5 | **Foot slide / foot gap on slopes** (§8.6): `kcc.up` leans only 0.65 toward the normal, so a planted sole is tilted ≈ 0.35·slope against the terrain (4–8 cm toe/heel gap at 30°), and stride/speed mismatch slides the stance foot. | Low–medium — cosmetic, but it is the most visible animation flaw. | H | §8.6 ankle pitch/roll from `slopeFwdDeg`/`slopeSideDeg` (stance-weighted, clamped ±20°; residual ≈ 1 mm accepted); stride frequency derived from speed (§8). Proof: `test-play-anim` flat-ground stance displacement < 1 cm at v ∈ {1, 2, 4, 8}; MT14 visual check on a 30° slope. Per-leg IK is explicitly out of V1. | B8, B9 |
| K6 | **Day/night (Q8)**: with `spinOmega` 0.0005 the spawn reaches sunset 21.3 min after load and stays Sun-dark for ~105 min (§6.1). | Medium — a player who stays near the spawn sees the world go dark and may read it as a rendering failure. | H (if played > 20 min) | Q8 default keeps the harness value (A2). The value lives in the play page's own config copy (`moonConfig.ts`), so a Lead ruling of `spinOmega = 0` (or a slower day) is a one-field change with no core edit; `test-play-spawn` pins the configured value so a change is deliberate. Earth-light (0.28) + ambient (0.5) keep the terrain readable at night. | B2 |
| K7 | **Performance budget** (§11.2: play-layer CPU ≤ 3 ms, FPS EMA ≥ 58): animator, 4 terrain samples, LOD walk and HUD exceed it on low-end machines; hidden per-frame allocations cause GC hitches. Software WebGL (SwiftShader) runs ~20 FPS regardless (STATE.md E-1 evidence). | Medium — stutter; GC pauses break the zero-GC invariant. | M | §11.3 allocation rules; boot-allocated scratch; `test-play-perf` heap delta ≈ 0 over 10k frames; MT15 is judged on HARDWARE WebGL only and the commit records the renderer string; a SwiftShader FPS shortfall is environment-soft (same rule as m1d row 2), an allocation is never soft. | B10 |
| K8 | **B11 core regression**: adding `coyoteTime`/`airControl` to `astronautKCC.ts` alters the default path — the F14 jump clear (~483) and read (~590) and the F18 launch compose are the two ratified core edits and sit exactly there. | High — breaks the m1e/m1f acceptance gates and the 1G §3.5 re-grep. | M | Only on a Lead ruling (Q2/Q3); optional fields read as `cfg.x ?? 0`, logic only inside `if (cfg.x > 0)` blocks; baseline-first regression (§13.5) — m1e 6/6, m1f R1–R4 PASS, R5 WAIVED = PASS; integrity trace byte-equal with both fields at 0. No ruling → B11 checked SKIPPED, no core file changes. | B11 |
| K9 | **Shallow-clone / proxy push friction**: a full clone stalled (session 24, `--depth 30` used); `git push` through the integration proxy hung (session 25 pushed via the GitHub git-data API); the V0 canon check against `ea112ec` fails when that commit is outside the shallow history. | Medium — finished work not pushed = a broken resume point (§6); a false CANON failure blocks a step. | M | Push with a bounded timeout first; on a hang, fall back to the git-data API (blob → tree → commit with the repo owner as author/committer → fast-forward ref update, never force); after every push verify the remote branch head equals the local `HEAD`. Canon check: `git diff --quiet ea112ec -- Design_specs Milestone` when `ea112ec` is reachable, else `git diff --quiet HEAD -- Design_specs Milestone` plus `git status --short` showing no staged canon path — the substitution is noted in VERIFIED. | every step |
| K10 | **Harness leakage into the play page**: an import of `src/test/**` (or a shared module that imports it) executes M1F singletons, satellites and THREE patches on the play page. | High — corrupted page state (AGENT_BRIEF.md §3 page rule). | L | §4.1 rule; every step's VERIFIED carries `grep -rn "src/test\|test/Milestone" game/src/play` → 0 hits; the build lists a separate `PlayPage-*.js` chunk (B1); MT16 confirms m1f still boots after leaving play. | B1–B10 |
| K11 | **Terrain warm-up never "ready"**: a worker stall or the F10b detach race keeps `residentAround` < 1.0, so the loading gate hangs. | Medium — the player waits on LOADING. | L | `loadTimeoutS` 15 s fallback to CLICK_TO_PLAY with "terrain still streaming" (§10.3); worker `error` → ERROR phase (§10.2); the step logs time-to-ready. Proof: B4/B5 manual load observation; `residentAround` unit cases in `test-play-lod`. | B4, B5 |
| K12 | **Jump-buffer semantics (Q5)**: the F14 comment claims airborne presses buffer to landing but the code does not; a future core fix would double-buffer with the play-layer buffer. | Low — an extra or double jump only if core changes later. | L | Buffer lives in the play layer only (§9.3); §9.6 buffer case (0.10 s fires, 0.20 s does not); Q5 recorded for a Lead ruling; any core buffering change must remove the play buffer in the same commit. | B7 |
| K13 | **GLB-swap path rot**: the `CharacterAnimator` interface grows procedural-only assumptions, so a future GLTF/AnimationMixer animator needs controller changes. | Medium — defeats a stated T1 requirement. | M | Two implementations from B6 onward (`RestAnimator` + `ProceduralAnimator`) behind the same interface; the controller and telemetry import only the interface type; the B9 commit greps that `PlayerController.ts` does not import `ProceduralAnimator`. | B6, B9 |

**14.2 Open decisions that move a risk** (§2; the plan proceeds on the
defaults until ruled)
- Q1 (Option B) — retires nothing; Option A would add K2-class drift risk to
  the 1F harness itself.
- Q2/Q3 (coyote time / air control) — the only trigger for K8.
- Q5 (jump-buffer comment) — K12.
- Q6 (Playwright smoke) — adds an automated K10/K11 guard if approved.
- Q8 (spin) — K6.

**14.3 Stop triggers** (any one → STOP, write the options, ask the Lead)
- A check above fails and the fix would touch a ratified constant, the KCC
  default path, a milestone harness, or `Design_specs/`/`Milestone/`.
- A push cannot be completed by either route (K9) — finished work would sit
  unpushed.
- A regression badge differs from its baseline (other than the waived m1f R5).

### §15 First coding step
The first change after the Lead's execute order is build step **B1 — Route
stub** (§12.2). It is the smallest change that can be verified on its own. It
creates the route, the menu entry and the separate Vite chunk, and it touches
no shared module. Every later step lands inside the page it creates.

**15.1 Preconditions**
- **LEAD GATE passed.** The plan status is READY, and STATE.md records the
  Lead's execute order. B1 depends on no open question except Q7 (menu), and
  it uses the Q7 default: only `play` is added.
- **Clean start.** The tree is clean on `t1-playable-moon`, and HEAD is the
  READY commit. Run `cd game && npm ci` if `node_modules` is missing.
- **Anchors** (re-grep them before editing; the code wins):
  - `main.tsx`: the `pages` map at lines 11–17.
  - `App.tsx`: `PAGES` at lines 1–6, and the `<h1>` title text at line 23.
  - Both were verified at `bf7bc6c`.

**15.2 Edits** (three files, nothing else)
1. **`game/src/main.tsx`.** Add one entry to `pages`, after `m1f`. The key
   order does not affect routing. Keep both comments (the one-harness-per-page
   rule and no-StrictMode) unchanged.
   ```ts
   play: () => import('./play/PlayPage'),
   ```
2. **`game/src/App.tsx`.**
   - Insert `{ id: 'play', label: 'PLAY — Playable Moon (T1)' }` as the FIRST
     `PAGES` row. The rows m1a–m1d stay unchanged, and m1e/m1f are not added
     (Q7).
   - Change the `<h1>` text to `SOLARIS — PLAY / MILESTONE HARNESSES`.
   - **Label discrepancy.** §10.1 said `T1 — Playable Moon`, while §5.1 and
     B1 say `PLAY — Playable Moon (T1)`. §5.1 is the binding file plan, so its
     label is used, and §10.1 is corrected in place.
3. **`game/src/play/PlayPage.tsx`** (new; the only file under `src/play/` in
   B1). It contains no `three` import, no Canvas, no store and no world.
   ```tsx
   // T1 play page, B1 stub: route + chunk only. The world, Canvas and shell
   // arrive in B4/B5 (§12). Nothing under src/play may import src/test/** (§4.1).
   export default function PlayPage(): JSX.Element {
     return (
       <main style={{ position: 'fixed', inset: 0, display: 'flex',
         flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
         gap: 16, background: '#04070c', color: '#cfe0ee',
         fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
         <div style={{ color: '#7fd4ff', letterSpacing: '0.08em' }}>
           SOLARIS — PLAY (booting…)
         </div>
         <a href="/" style={{ color: '#aec6dc' }}>← menu</a>
       </main>
     )
   }
   ```
   The palette is copied from `App.tsx`, so the stub matches the menu.

**15.3 Checks** (record each result in VERIFIED, with exit codes UNPIPED, §13.6)
- **V0.**
  - `npm run typecheck; echo TSC_EXIT=$?` → 0.
  - `npm run build; echo BUILD_EXIT=$?` → 0.
  - `git diff --quiet ea112ec -- Design_specs Milestone; echo CANON_EXIT=$?` → 0.
    If `ea112ec` is not reachable, use the K9 substitution.
- **Chunk.** `ls dist/assets | grep -c '^PlayPage-.*\.js$'` → 1.
- **Additive (V0.5).**
  `git diff --quiet <step-base> -- src/core src/render src/workers src/test; echo SHARED_EXIT=$?`
  → 0. This is why the M1 regression is not required in B1 (§13.5).
- **Leakage (K10).** `grep -rn "test/" src/play; echo GREP_EXIT=$?` → 1
  (no hits).
- **Manual** (`npm run dev`), all observed in the same session:
  - the menu lists PLAY first;
  - the m1a–m1d links are unchanged;
  - `/?page=play` renders the stub with no console errors;
  - `← menu` returns to the menu;
  - `/?page=m1a` still loads.

**15.4 Commit** (one commit, AGENT_BRIEF.md §6, authored as the repo owner)
- **First line:** `T1-build: B1 — route stub (/?page=play + menu entry)`.
- **Body:** WHAT (the three files) / WHY (§12 B1, §15) / STATE (BUILDING,
  B1/13) / NEXT (B2 moon constants + spawn) / VERIFIED (15.3, line by line).
- **Riding in the same commit:**
  - the B1 box checked;
  - the plan header stage → BUILDING;
  - the tracker row's build status → IN PROGRESS (B1 of B1–B13);
  - STATE.md NEXT ACTION → B2;
  - a `notes/CHANGES.md` entry.
- **Push, then verify** that the remote branch head equals the local `HEAD`.

**15.5 Done when.** All 15.3 checks pass, and the commit is pushed and
verified. If any check fails, B1 is not checked off. Fix it inside the three
files, or STOP (§14.3).

### Verification per step
How each build step B1–B13 (§12.2) is verified. This section only maps steps
to checks that are defined elsewhere: the step box in §12.2 is the authority
for its own checks, §13 defines every command, script and manual row, and
§14 names the risk each check retires. Nothing here adds a new check.

**Rules (all steps)**
- **V0** (§13.1 V0.2–V0.5, plus V0.1 once per fresh VM) runs in every step.
- **Cumulative Node checks.** A `test-play-*` script, once introduced, re-runs
  in every later step and must stay green (§13.2).
- **Manual rows.** A step records the rows it introduces ("From" in §13.3)
  and re-checks earlier rows its change can affect. B13 records all of them.
- **Regression** (§13.5) only where the table says so, or wherever V0.5 is
  non-zero.
- **Evidence** in the step commit's VERIFIED block, in the §13.6 format. A
  required check NOT RUN means the box stays unchecked; a failure is fixed
  inside the step or is a STOP (§14.3).

| Step | Node scripts (§13.2; **new** in bold) | Manual rows (§13.3) | Regression (§13.5) | Step-specific checks (§12.2 / §14) |
|---|---|---|---|---|
| B1 | — | MT1 | not required (V0.5 = 0) | one `PlayPage-*.js` chunk; K10 leakage grep (§15.3) |
| B2 | **spawn** | — | not required | spawn literals pinned; configured `spinOmega` pinned (K6) |
| B3 | spawn, **lod** | — | not required | side-by-side diff of the `MoonLod` port vs harness 274–434 (K2) |
| B4 | spawn, lod | MT2, MT16 | not required | K10 grep; time-to-ready logged (K11) |
| B5 | + **shell** | MT3, MT4 | not required | pointer-lock rules (K3); timeout path (K11) |
| B6 | + **rig** | MT5 | not required | `RestAnimator` behind `CharacterAnimator` (K13) |
| B7 | + **controller** | MT6–MT13 | not required | spin-advanced mapping case (K1); rebase continuity (K4); buffer case (K12) |
| B8 | + **anim** (state machine) | — (nothing on screen changes) | not required | heap ≈ 0 over 10k steps |
| B9 | anim (full: foot slide, interrupt) | MT14 | not required | `PlayerController.ts` does not import `ProceduralAnimator` (K13); slope stance (K5) |
| B10 | + **perf** (`--expose-gc`) | MT15 | not required | renderer string recorded; SwiftShader FPS = env-soft, allocation never soft (K7) |
| B11 | controller + core default-path trace | MT8, MT9 re-check | **mandatory**, baseline first: m1e, m1f (R5 WAIVED) | V0.5 non-zero by design; integrity trace byte-equal at 0 (K8); no ruling → SKIPPED, no core change |
| B12 | — | — | not required | §13.4 `PW_EXIT=0`, or SKIPPED (Q6 declined) / NOT RUN (no Chrome) |
| B13 | all seven | MT1–MT16 | m1e + m1f re-run on the final tree if B11 was applied; otherwise not required | full §13 matrix on the final tree; §13.6 evidence |

### Risks & open decisions
The risks are registered in §14 (K1–K13, each with its mitigation, proving
check and owner step) and are not repeated here. The decisions that need a
Lead ruling are §2 Q1–Q8. None of them blocks the execute order: each has a
default, and the plan builds on the defaults until a ruling replaces them.
A ruling is needed only before the step that first depends on it.

**Highest-impact risks** (§14.1): K1 KCC frame mixing (B4, B7), K4 rebase
lurch (B7), K8 core regression (B11, only on a Q2/Q3 ruling) and K10 harness
leakage (B1–B10). Every one has a proving check in the B1–B13 table above.

**Open decisions**

| Q | Decision (§2) | Default the plan uses | Needed before | Risk moved (§14.2) | Effect of a different ruling |
|---|---|---|---|---|---|
| Q1 | Boot strategy | Option B — separate boot under `src/play/` | B1 | none retired; Option A adds K2-class drift to the 1F harness | Option A = a re-plan of §5/§6 before B1 |
| Q2 | Coyote time | (a) opt-in KCC field `coyoteTime`, default 0 | B11 | K8 | (b) play-layer velocity kick = rejected by the plan (bypasses F18); "no" = B11 SKIPPED for coyote |
| Q3 | Air control | opt-in KCC field `airControl` ≈ 0.3, default 0 | B11 | K8 | "no" = B11 SKIPPED for air control; with Q2 also "no", B11 SKIPPED and no core file changes |
| Q4 | Crouch pose | simple crouch blend pose, no crouch-walk cycle | B9 | — | a crouch-walk cycle adds one §8 state and its B8/B9 checks |
| Q5 | F14 jump-buffer comment vs code | core untouched; buffer in the play layer | B7 | K12 | a core fix must remove the play-layer buffer in the same commit (K12) |
| Q6 | Playwright smoke `e2e/play.spec.ts` | yes, optional final step | B12 | adds an automated K10/K11 guard | "no" = B12 SKIPPED |
| Q7 | Menu entries | add `play` only | B1 | — | also listing m1e/m1f = two extra `PAGES` rows in B1 |
| Q8 | Moon spin in play | keep `spinOmega` 0.0005 rad/s (sunset ~21 min after load) | B2 | K6 | `spinOmega` 0 (or slower) = one field in `moonConfig.ts`, pinned by `test-play-spawn` |

**Rulings (Lead, 2026-10-20)** — these replace the defaults above. Q2, Q5 and
Q8 were delegated to the bot ("choose the best one"); the choice and the
reason are recorded here.

| Q | Ruling | Reason (delegated items) | Effect on the steps |
|---|---|---|---|
| Q1 | **Option B** | — | as planned |
| Q2 | **(a)** opt-in KCC field `coyoteTime`, default 0, play value 0.10 s *(delegated)* | (b) teleports velocity and bypasses the F18 spin-phase launch compose; (a) is default-off, so acceptance behaviour cannot change | B11 applied |
| Q3 | **yes**, `airControl` 0.3, default 0 | — | B11 applied |
| Q4 | **yes**, simple crouch blend pose | — | as planned (B9) |
| Q5 | **core untouched; buffer in the play layer** *(delegated)* | the F14 lines are a ratified core edit and are flagged for the 1G §3.5 re-grep; changing comment or behaviour there gains the play page nothing. The comment/behaviour mismatch stays recorded (§2 Q5, K12) for a later core task | as planned (B7) |
| Q6 | **yes** — Playwright runs in this environment | — | B12 applied |
| Q7 | **`play` only** | — | as planned (B1) |
| Q8 | **`spinOmega` = 0** in the play page's `MOON_ASTRONAUT` copy *(delegated)* | at 0.0005 rad/s the spawn goes dark 21 min after load for ~105 min (§6.1), which reads as a rendering fault in a free-roam V1. With 0 the Earthrise light holds, and Earth stays fixed in the sky, as it does on the real (tidally locked) Moon. Harness and KCC defaults are unchanged. | B2 sets and pins 0; K6 retired. K1 still applies: the play layer keeps composing `spinQuatInto(kcc.spinPhase)`, and `test-play-controller` runs its K1 case with a nonzero test spin |

With Q2 and Q3 ruled in, B11 is a real core edit (K8). Its baseline-first
m1e/m1f regression (§13.5) is mandatory, and B13 re-runs m1e and m1f on the
final tree.

**Lead gate.** With this item checked the plan is READY. Building starts
only on the Lead's execute order ("execute the T1 plan", AGENT_BRIEF.md §4).
An execute order without a ruling on a question means that question's
default is accepted. Rulings are recorded in STATE.md's APPROVAL LEDGER.
