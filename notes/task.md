# TASK TRACKER — PHASE 2 MAIN DEVELOPMENT (contract: AGENT_BRIEF.md)

Single source of truth for WHAT is being built and WHERE it stands. A fresh session
resumes from: this file + the active task's `docs/<Tn>-plan.md` + `notes/STATE.md`
NEXT ACTION. The first UNCHECKED BOX (planning item or build step) is always the
starting point.

## TRACKER
| Task | Branch | Plan status | Build status | Step progress | Last commit | Blockers |
|------|--------|-------------|--------------|---------------|-------------|----------|
| T1 playable moon | `t1-playable-moon` | IN PROGRESS (4/7 — next: Steps) | NOT STARTED | — | 3d8dcb8 | none |

Note: "Last commit" = the commit BEFORE the newest checkpoint (a file cannot
contain its own hash); current HEAD: `git log -1`.

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
  Planning session(s) author it INCREMENTALLY per the schema below: the first
  checkpoint-commit creates the file with the empty PLANNING CHECKLIST, sections
  follow one by one, and on completion the tracker flips to READY and the
  session STOPS at the LEAD GATE (build only on the Lead's execute order).

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
