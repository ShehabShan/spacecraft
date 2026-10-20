# TASK TRACKER — PHASE 2 MAIN DEVELOPMENT (contract: AGENT_BRIEF.md)

Single source of truth for WHAT is being built and WHERE it stands. A fresh session
resumes from: this file + the active task's `docs/<Tn>-plan.md` + `notes/STATE.md`
NEXT ACTION. The first UNCHECKED BOX (planning item or build step) is always the
starting point.

## TRACKER
| Task | Branch | Plan status | Build status | Step progress | Last commit | Blockers |
|------|--------|-------------|--------------|---------------|-------------|----------|
| T1 playable moon | `t1-playable-moon` | IN PROGRESS (4/7 sections; Steps 11/15) — `docs/T1-plan.md` | NOT STARTED | plan 4/7 · Steps 11/15 · next: Steps §12 Implementation phases | f6a735f | none (open questions Q1–Q8 in plan §2, non-blocking) |

Note: "Last commit" = the commit BEFORE the newest checkpoint (a file cannot
contain its own hash); current HEAD: `git log -1`.

## PARKED (carried from phase 1 — resume ONLY by a Lead directive naming the item)
| Item | State | Note |
|------|-------|------|
| MS 1F | RULING PENDING | Round-7 option menu at `notes/reports/M1F.md` §15.7 (recommendation (a): rebase gate ≥ 2 → ≥ 1). Do not touch 1F code without a directive naming 1F. |
| MS 1G | DEFERRED (ignored) | Explicitly out of scope — "much later" per Lead, 2026-10-19. Do not start or plan. |

## TASK DEFINITIONS

### T1 — PLAYABLE MOON
Task type: new game page (the first GAME page, not a test harness). Branch:
`t1-playable-moon` (cut from `m1-assembly` @ 3057899 — "branch m1-assembly" in
the source brief refers to that branch point). All work on this branch.

**Product (V1 — free-roam movement playground).** A standalone, playable moon
game at `/?page=play`, listed in the menu. The player controls a visible
third-person character on the procedural moon surface and can walk, run/
sprint, jump, fall, and slide on steep slopes (existing KCC behavior).
Movement must FEEL like a real game (Unreal/ROBLOX-style third-person) with
proper movement animation: idle, walk, run, jump launch/rise, fall, landing,
slope slide. No combat, objectives, inventory, quests, sound, or saves in V1 —
testing and polish follow the first playable build.

**Verified current state (trust the code over this text; re-verify before
planning — note discrepancies in the plan).** The repo contains test
harnesses, not a game shell:
- Routing: `game/src/main.tsx` static map `m1a..m1f`; one module per page,
  full page loads (module singletons + THREE prototype patches). `App.tsx`
  menu lists only m1a–m1d.
- The closest foundation is `game/src/test/Milestone1F_TestHarness.tsx` and
  its hidden manual mode `?page=m1f&manual=1` (WASD / Shift sprint / Space
  jump / C crouch / V cam TP-FP / R reset / P pause, click pointer-lock),
  which already has: moon terrain params (R = 1364.5, g = 1.62 m/s²,
  maxTerrainHeight 360), a moon-configured AstronautKCC (walk 3.2, sprint
  6.5, crouch 1.5, jump 4.2, accelTau 0.15, slope limits, sliding, airborne
  inertial flight, landing sweep), SimulationCore with frozen sky
  (`setTimeScale(0)`), FloatingOriginAdapter, TerrainMeshPool streaming
  (96 meshes, 2 workers) + quadtree LOD, SkyImpostorPool, MultiCameraRig
  three-pass renderer, and a TP/FP camera driver (boomed camera, 4-sample
  terrain clearance).
- The astronaut is a STATIC group of boxes (`buildAstronaut`, ~line 577) —
  no skeleton, rig, animation system, GLB/FBX assets, or GLTF import.
- Airborne flight is inertial (no generic air control; ZERO-G RCS is
  separate). Jump buffering: verify in KCC. Coyote time: does NOT exist.

**Architecture decision the plan must make (recommend ONE after comparing).**
- Option A — extract a shared moon bootstrap from the M1F harness used by
  both harness and play page. One source of truth, less drift; risk:
  touching the acceptance harness can regress the 1F gate.
- Option B — new play page under `game/src/play/` with a minimal duplicated
  boot, reusing core/render modules. Zero risk to the harness, fastest path;
  risk: temporary duplication of world setup.
Do NOT copy the ~1,800-line harness wholesale: the plan must identify
exactly which code is reusable, which must be extracted, which rewritten.

**Character + animation (the heart of the task).** V1 character: a
self-contained articulated astronaut built in-engine (ROBLOX-like block
proportions) replacing the static box group. The plan must specify:
- Joint hierarchy with correct pivots: root/feet, pelvis, spine/torso, head,
  upper/lower arms ×2, upper/lower legs ×2, feet. Materials + scale suited
  to third-person view; how the rig attaches under the floating-origin
  render-local hierarchy and composes with the moon spin.
- A procedural animation state machine driven by KCC telemetry — relSpeed,
  grounded, vertical velocity (absVel), slopeDeg, input magnitude + sprint,
  landing events (`integrity.lastLandingRelSpeed`). States + transitions:
  Idle, Walk, Run, Jump launch, Jump rise, Apex/fall, Land, Slide. How poses
  blend (crossfade times, weights), stride frequency scaling with speed,
  practical foot-slide minimization; jump/fall poses: crouch anticipation,
  extended launch, tucked rise, arms-out fall, landing crouch + recovery.
- A clean `CharacterAnimator` interface so a future GLB (GLTFLoader from
  three/examples is in node_modules; AnimationMixer + clips) can replace the
  procedural rig WITHOUT rewriting the controller. V1 must not depend on
  obtaining an external asset.

**Controller + game feel.** The plan must cover:
- Camera-relative WASD: the KCC moves along its own fwd/right — the play
  layer computes the desired tangent direction from camera yaw, rotates the
  character toward it, and drives moveF/moveR/turnRate correctly.
- Third-person camera: mouse orbit, boomed/spring-arm follow, terrain
  collision + minimum distance, smoothed position/rotation, FP toggle.
- Jump feel: use the KCC's jump buffering (verify first); add play-layer
  coyote time; landing recovery; OPTIONAL limited air control — prefer an
  opt-in KCC config field whose default (0/off) preserves acceptance
  behavior over changing existing defaults.
- Sprint behavior + speed tuning; slope behavior + sliding; pause/resume
  must not advance physics; fixed-step simulation (frame-rate-independent
  feel); respawn to spawn point.
- Identify exactly which behaviors belong in the play controller vs the
  core KCC, and which core changes are acceptance-safe.

**World + presentation.** Scenic, walkable spawn (the existing Earthrise
spawn is a candidate — evaluate whether its corridor suits free roam); keep
terrain streaming + floating origin; REMOVE test-only probes, satellites,
acceptance HUD, autopilot; evaluate reusing MultiCameraRig unchanged (keep
the three-pass renderer if terrain/sky need it); minimal HUD (controls hint,
optional speed/coords/FPS, pause overlay, loading state while terrain warms
up); menu entry + routing; pointer lock + click-to-play overlay; performance:
smooth at typical desktop frame rates, avoid per-frame allocations.

**Hard constraints (all bind).**
- Do NOT modify Design_specs/ or Milestone/. Do NOT change M1F acceptance
  rows, thresholds, or R5/F-09/F-10 behavior (1F is PARKED — its R5 gap is a
  known test-coverage/ruling issue, not a reason to change the game design).
- The play page must NOT import Milestone1F_TestHarness.tsx (module
  singletons + test-only code would execute). Keep the page additive and
  independently loadable.
- Reuse core/render modules — never reimplement physics, terrain, sky, or
  floating origin. Preserve frame-rate-independent physics.
- Character animation must be visible and driven by real movement state,
  not a canned loop. V1 free-roam only. Clean GLB-swap path required.

**Required structure of `docs/T1-plan.md`** (in addition to the standard
schema header + PLANNING CHECKLIST, the finished plan must contain, in
order): 1 executive summary (recommended architecture + why) · 2 assumptions
and open questions · 3 current-state findings (verified repo facts) ·
4 architecture (module/data-flow diagram, text) · 5 file-by-file change plan
(new + edited files, purpose, key exports/APIs) · 6 world bootstrap plan
(exact reuse/extraction strategy + exclusions) · 7 character rig
specification (hierarchy, dimensions, pivots, materials) · 8 animation state
machine (TABLE: states, entry conditions, exit conditions, pose drivers,
blend times) · 9 controller + camera plan (input mapping, movement math,
jump/fall/landing, camera behavior, KCC touchpoints) · 10 game shell + HUD
plan (route, menu, loading, pointer lock, pause, respawn) · 11 performance
plan (allocations, terrain/LOD, render passes, budgets) · 12 implementation
phases (ordered, incremental, each with a playable/verifiable outcome +
acceptance checks) · 13 verification plan (typecheck, build, manual test
matrix, optional Playwright smoke, M1F regression check) · 14 risk register
(risk, impact, mitigation) · 15 first coding step (the single smallest
change to begin after plan approval). Specific enough that a coding model
can start file creation without making architectural decisions from scratch
— include function/class names, data structures, pseudocode where useful;
do NOT write the full implementation.

**Reference facts.** Verify from `game/`: `npm run typecheck`, `npm run
build`, `npm run dev`, `npx playwright test e2e/m1f.spec.ts` (do not
break). Routes: menu `http://localhost:5173/` · existing manual scene
`?page=m1f&manual=1` · target `?page=play`. 1F-harness line anchors: moon
setup/KCC config ~100 · spawn search ~170 · terrain LOD/quadtree ~330 ·
static scene + astronaut ~440–598 · input/camera ~650–780 · layer
assignment/sky ~840+ · frame loop/manual mode ~1380+ · HUD ~1580+.

**Stage.** Plan: `docs/T1-plan.md` — NOT YET WRITTEN. The planning session:
read the repository first and verify every path/API/assumption against the
source (the code wins over this definition on any conflict — note the
discrepancy in the plan); author the plan INCREMENTALLY per the schema
below (PLANNING CHECKLIST items; the 15 required sections are the "Steps"
item's content); NO game-code changes during planning — only the plan
document + process files; on completion set plan status READY and STOP at
the LEAD GATE.

## PLAN FILE SCHEMA (every `docs/<Tn>-plan.md` follows this exactly)
- Header: task id · branch · stage (PLANNING / READY / BUILDING / DONE) ·
  last-updated date · "resume at the FIRST UNCHECKED BOX (planning item or
  build step)".
- PLANNING CHECKLIST — at the top of the file, created on the FIRST planning
  commit (file starts as header + empty checklist):
  [ ] Goal · [ ] Scope IN · [ ] Scope OUT · [ ] Affected modules · [ ] Steps ·
  [ ] Verification per step · [ ] Risks & open decisions.
  Sections are then drafted, checked off, committed, pushed — planning is
  INCREMENTAL and multi-session, exactly like building. Status lifecycle:
  NOT STARTED → IN PROGRESS (n/m sections) → READY. On completion: set plan
  status READY, repoint STATE.md NEXT ACTION, and STOP at the LEAD GATE
  (AGENT_BRIEF.md §4).
- Goal: 1–3 sentences.
- Scope IN / Scope OUT: bulleted, concrete.
- Affected modules: file paths.
- Steps: an ORDERED checklist; each step is small enough to verify and commit in
  one segment, and states its own verification (command + expected evidence).
- Risks & open decisions: anything needing a Lead ruling.
- A box is DONE when: checked + verification passed (where applicable) + the
  commit that carries it — which ALSO carries the tracker row + STATE.md NEXT
  ACTION update — is pushed. A box is the commit unit (AGENT_BRIEF.md §4/§6).

## HOW TO RESUME A TASK MIDWAY (fresh session — full procedure in AGENT_BRIEF.md §5)
1. Read `AGENT_BRIEF.md` (the phase-2 contract above all else).
2. Here: find the ACTIVE task row (any row whose stage is not DONE).
3. Open its `docs/<Tn>-plan.md`: the FIRST UNCHECKED BOX is the starting point —
   a planning-checklist item while the plan is IN PROGRESS, a build step once
   building (if the plan is READY but no execute order is on record, you are at
   the LEAD GATE — do not build; report and wait).
4. `notes/STATE.md` NEXT ACTION confirms or overrides (it binds).
5. Reconcile `git log --oneline -15` + `git status` vs tracker; evidence wins;
   repair drift and note the repair in the SESSION LOG.
6. Continue (planning or building); commit+push per completed segment — each
   commit carries its checkbox + tracker row + STATE.md NEXT ACTION update
   (AGENT_BRIEF.md §6); session end adds the SESSION LOG handoff note.
