# TASK TRACKER — PHASE 2 MAIN DEVELOPMENT (contract: AGENT_BRIEF.md)

Single source of truth for WHAT is being built and WHERE it stands. A fresh session
resumes from: this file + the active task's `docs/<Tn>-plan.md` + `notes/STATE.md`
NEXT ACTION. The first UNCHECKED plan step is always the starting point.

## TRACKER
| Task | Branch | Plan status | Build status | Step progress | Last commit | Blockers |
|------|--------|-------------|--------------|---------------|-------------|----------|
| T1 playable moon | `t1-playable-moon` | NOT STARTED → author `docs/T1-plan.md` | NOT STARTED | — | branch point: `m1-assembly` @ 3057899 | none |

## PARKED (carried from phase 1 — resume ONLY by a Lead directive naming the item)
| Item | State | Note |
|------|-------|------|
| MS 1F | RULING PENDING | Round-7 option menu at `notes/reports/M1F.md` §15.7 (recommendation (a): rebase gate ≥ 2 → ≥ 1). Do not touch 1F code without a directive naming 1F. |
| MS 1G | DEFERRED (ignored) | Explicitly out of scope — "much later" per Lead, 2026-10-19. Do not start or plan. |

## TASK DEFINITIONS

### T1 — PLAYABLE MOON
- Goal: a playable moon surface — the player can WALK on the moon: walkable terrain
  underfoot, a player controller (input → movement), ground collision (never falls
  through), and low gravity (the moon's real surface gravity from the catalog).
- Builds on (existing, verified — read the code, it is the source of truth):
  - `game/src/core/physics/astronautKCC.ts` — analytic kinematic character
    controller (walking, slopes, steps, jumps; parallel-transport frame);
    `sphericalFrame.ts` beside it for the local tangent frame.
  - `game/src/core/terrain/terrainField.ts` + `game/src/workers/terrainWorker.ts`
    + `game/src/render/TerrainMeshPool.ts` — the moon terrain heightfield,
    streaming, and meshing.
  - `game/src/core/orbit/celestialData.ts` — body catalog incl. the moon's
    surface gravity (catalog values are final — never re-derive).
  - `game/src/core/simulation/SimulationCore.ts` + `game/src/store/useGameStore.ts`
    + `game/src/render/FloatingOriginAdapter.ts` — tick, state, floating origin.
  - `game/src/test/Milestone1E_TestHarness.tsx` — a WORKING walking-astronaut
    page (reference for wiring input → KCC → terrain; the harness itself is
    regression — do not break it, build the game page alongside).
- Scope IN (to be fixed precisely by the plan): a game page with the astronaut
  standing and walking on the moon; WASD + jump input; camera that follows the
  player; terrain streaming around the player; low gravity per the catalog.
- Scope OUT: Rapier or any physics-engine swap (deferred by design) · EVA/ship
  boarding · saves (1G-era) · sky/rendering beauty passes · new libraries · any
  change to ratified constants.
- Plan: `docs/T1-plan.md` — NOT YET WRITTEN (STATE.md NEXT ACTION = "T1 plan").
  The planning session authors it per the schema below, sets this row's plan
  status to READY, and repoints NEXT ACTION at the first build step.

## PLAN FILE SCHEMA (every `docs/<Tn>-plan.md` follows this exactly)
- Header: task id · branch · status (PLANNING / BUILDING / DONE) · last-updated
  date · "resume at first unchecked step".
- Goal: 1–3 sentences.
- Scope IN / Scope OUT: bulleted, concrete.
- Affected modules: file paths.
- Steps: an ORDERED checklist; each step is small enough to verify and commit in
  one segment, and states its own verification (command + expected evidence).
- Risks & open decisions: anything needing a Lead ruling.
- A step is DONE when: box checked + verification passed + committed AND pushed.
  A step is the commit unit (AGENT_BRIEF.md §4).

## HOW TO RESUME A TASK MIDWAY (fresh session — full procedure in AGENT_BRIEF.md §5)
1. Read `AGENT_BRIEF.md` (the phase-2 contract above all else).
2. Here: find the ACTIVE task row (the one whose build status is not DONE).
3. Open its `docs/<Tn>-plan.md`: the first UNCHECKED step is the starting point.
4. `notes/STATE.md` NEXT ACTION confirms or overrides (it binds).
5. Reconcile `git log --oneline -15` + `git status` vs tracker; evidence wins;
   repair drift and note the repair in the SESSION LOG.
6. Continue the build; commit+push per completed step; before ending the session
   update: tracker row + plan checkboxes + STATE.md (NEXT ACTION + SESSION LOG
   handoff note).
