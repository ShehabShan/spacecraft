# T1 — PLAYABLE MOON — PLAN

- Task: **T1** (playable moon) — definition: `notes/task.md` § "T1 — PLAYABLE MOON"
- Branch: `t1-playable-moon`
- Stage: **PLANNING** — plan status IN PROGRESS (4/7 sections; Steps 7/15)
- Last updated: 2026-10-20
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
  - [x] §5 File-by-file change plan
  - [x] §6 World bootstrap plan
  - [x] §7 Character rig specification
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
  toggleCamEdge = false; respawnEdge = false; pauseEdge = false;
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
export type PlayPhase = 'LOADING' | 'CLICK_TO_PLAY' | 'PLAYING' | 'PAUSED';
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
