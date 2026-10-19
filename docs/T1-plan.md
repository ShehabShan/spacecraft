# T1 — PLAYABLE MOON — PLAN

- Task: **T1** (playable moon) — definition: `notes/task.md` § "T1 — PLAYABLE MOON"
- Branch: `t1-playable-moon`
- Stage: **PLANNING** — plan status IN PROGRESS (4/7 sections; Steps 4/15)
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
  - [x] §1 Executive summary (recommended architecture + why)
  - [x] §2 Assumptions and open questions
  - [x] §3 Current-state findings (verified repo facts)
  - [x] §4 Architecture (module/data-flow diagram, text)
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
  - edges for `toggleCam`, `respawn` and `pause`;
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
  - `phase`: `LOADING`, `CLICK_TO_PLAY`, `PLAYING` or `PAUSED`;
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
- **Planet frame** (moon-fixed, f64): KCC `absPos`/`up`/`fwd`, `heading`,
  the spawn, the LOD inputs, and the terrain sampling for camera clearance.
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