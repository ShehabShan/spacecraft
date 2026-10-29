# TASK TRACKER — PHASE 2 MAIN DEVELOPMENT (contract: AGENT_BRIEF.md)

Single source of truth for WHAT is being built and WHERE it stands. A fresh session
resumes from: this file + the active task's `docs/<task>-plan.md` + `notes/STATE.md`
NEXT ACTION. The first UNCHECKED BOX (planning item or build step) is always the
starting point.

## TRACKER
| Task | Branch | Plan status | Build status | Step progress | Last commit | Blockers |
|------|--------|-------------|--------------|---------------|-------------|----------|
| T1 playable moon | `t1-playable-moon` | `docs/history/T1.md` | DONE 2026-10-28 · ff-merged s146 · ADR-027 · gate `game/e2e/play.spec.ts` | 13/13 | 20c3671 | — |
| A1 engine audit (read-only) | `a1-engine-audit` | `docs/history/A1.md` | DONE 2026-10-26 · merged · no ADR · read-only | 27/27 units | bd079fe | — |
| F1a e2e plumbing | `f1a-e2e-plumbing` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-001 · gate `tools/test-e2e-plumbing.mjs` | s104 | 6ce1d08 | — |
| F1b allocation gate | `f1b-allocation-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-002…005 · gate `tools/test-alloc-gate.mjs` | s105–108 | e9dcf06 | — |
| F2a m1b orbit gate | `f2a-orbit-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-006 · gate `tools/test-orbit-gate.mjs` | s109 | ae9acf7 | — |
| F2b m1a precision/rebase/timing gate | `f2b-precision-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-007 · gate `tools/test-precision-gate.mjs` | s111 | 83272db | — |
| F2c m1c seam gate | `f2c-seam-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-008 · gate `tools/test-seam-gate.mjs` | s112 | bcdc980 | — |
| F2d m1d gate | `f2d-m1d-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-009 · gate `tools/test-flight-gate.mjs` | s113 | 61fae86 | — |
| F2e m1e KCC gate | `f2e-m1e-gate` | U27c §2 | DONE 2026-10-26 · ff-merged · ADR-010 · gate `tools/test-kcc-gate.mjs` | s114 | b8cfe20 | — |
| F3a catalog scale laws + rotation data | `f3a-catalog` | U27c §2 | DONE 2026-10-27 · ff-merged · ADR-011…016 · gate `tools/test-scale-law.mjs` +3 | s115–125 | 7e550b2 | — |
| F3a-follow-ups (added by session 124, not started) | `f3a-catalog` | (1) DONE session 125: Lead confirmed, F3a fast-forwarded into `main`, both branches pushed; (2) DONE session 126 (Lead ruled re-pin, 2026-10-27): spawn/respawn camera `frameToward` puts the Earth 13° above the view axis (was 31.93°); spawn site unchanged; old `< 31°` frame row restored; ADR-017, evidence `pre-t4:docs/audit/evidence/F3a/fu2/`; (3) DONE session 125: regress re-run on 764f839, every non-deliberate check exit 0, evidence in `pre-t4:docs/audit/evidence/F3a/abbbbbc-verify/` (`abbbbbc/exits.txt` left as committed, stale); (4) restore the strict real-tree churn check in test-alloc-gate after F5a; (5) DONE session 125: camera heap delta check was a JIT-warm-up flake (9/14 fails on both trees); 2000-frame warm-up added, 14/14 exit 0; (6) confirm the node-origin convention for non-planet moons (ASSUMED ascending node on the ICRF equator, ADR-016) against a source | OPEN — (2) done and merged; (4) waits for F5a, (6) not blocking; F2f is next (Lead) | 4/6 | 81be6d8 | — |
| F2f m1f gates R1–R5 rebuilt + R2 bisect | `f2f-m1f-gate` | U27c §2 | DONE 2026-10-28 · ff-merged · ADR-018…026 · gate `?page=m1fR1`…`m1fR5` | s127–142 | 102a5b8 | R5 FAIL waived (Lead) |
| T2 atmospheres + manual landing + cruise speed | (not cut) | NOT STARTED — defined 2026-10-23 (Lead); no plan yet | NOT STARTED | — | — | Starts only on a Lead order; gap audited by A1-U19 (pre-t4:docs/audit/U19-aero-atmosphere.md: A1-U19-1..4 are T2 prerequisites; Lead look-and-feel rulings 2026-10-23: thin glowing atmosphere; soft/hard/crash landing) |
| T3 better Moon (playable terrain) | `t3-better-moon` | `docs/T3-plan.md` | DONE 2026-10-28 · merged · ADR-028, 029 · gate `tools/test-moon-profile.mjs` | 5/5 | 7018e56 | — |
| T4 repo cleanup (AI-oriented compaction) | `t4-repo-cleanup` | `docs/T4-plan.md` | DONE 2026-10-28 · ff-merged s156b · ADR-030 · gate `tools/check-repo-refs.mjs` | 9/9 | S8 (this commit) | — |
| T5 bigger Moon | `t5-bigger-moon` (cut s156c) | `docs/T5-plan.md` READY 2026-10-29 (7/7, s157b) · ADR-031 (F5a–F5d folded in) | BUILDING — Lead "execute the T5 plan" 2026-10-29 | 4/13 · S1bbba done s161 (`docs/evidence/T5/S1bbba.txt`; S1bbb split S1bbba/S1bbbb) · next: S1bbbb | 96fa0eb | — (Lead ruled 2026-10-28: real size, radius 1,737 km) |
| T6 look-and-feel overhaul (animation, sound, textures, objects, colour) | (not cut) | NOT STARTED — Lead directive 2026-10-28; starts after T5 | NOT STARTED | — | — | — (Lead ruled 2026-10-28: cinematic style + sci-fi extras; in-helmet audio + ambient score; see STATE.md ledger) |


Note: "Last commit" = the commit BEFORE the newest checkpoint (a file cannot
contain its own hash); current HEAD: `git log -1`.

ORDER (Lead ruling 2026-10-28, `notes/LEDGER.md`): T4 → T5 → T6 → F3b. F3b (U27c §2) starts only after the Moon and character changes (T5, T6) reach the AAA look.

## PARKED (carried from phase 1 — resume ONLY by a Lead directive naming the item)
| Item | State | Note |
|------|-------|------|
| MS 1F | RULING PENDING | Round-7 option menu at `pre-t4:notes/reports/M1F.md` §15.7 (recommendation (a): rebase gate ≥ 2 → ≥ 1). Do not touch 1F code without a directive naming 1F. |
| MS 1G | DEFERRED (ignored) | Explicitly out of scope — "much later" per Lead, 2026-10-19. Do not start or plan. |

## BACKLOG (Lead-ordered notes — do NOT fix without a task naming them)
| Item | Note |
|------|------|
| 1D dive fixed-step (moved from STATE.md "1D FPS BACKLOG", T4 S5) | The 1D dive integrates `flight.update(dt·4, 6)` with dt = REAL frame delta against a wall-scaled `simElapsed > 45` cap, so the dive outcome is frame-rate-sensitive (variable-step profile vs a wall clock). Under hardware WebGL the ship lands as approved; under SwiftShader it misses grounding by ~60 m. A fixed-step review is deferred to a future milestone, Lead's call. (Evidence: pre-t4:notes/reports/M1F.md §10.5, §11.3.) F2d (session 113, ADR-009) later moved the m1d dive deadline to tick time; check that before acting. |

## TASK DEFINITIONS

Definitions of DONE tasks (A1, T1, T3) were moved out in T4 S6: verbatim at `git show pre-t4:notes/task.md` (or `git show 0dc7867:notes/task.md`); digests in `docs/history/A1.md`, `docs/history/T1.md` and `docs/history/SESSIONS.md`; T3 plan `docs/T3-plan.md`. The full pre-compaction tracker rows are in the same commits. Only definitions of tasks not yet DONE stay here.

### T2 — PER-BODY ATMOSPHERES, MANUAL LANDING, DEEP-SPACE CRUISE SPEED — NOT STARTED
Source: Lead, 2026-10-23 (session 74, chat). Requirement:
1. Every planet and moon that has a real atmosphere gets one in the flight model, with
   its own real-world-based profile (density, scale height, temperature/sound speed).
   Bodies with no real atmosphere get vacuum.
2. Atmosphere affects landing (drag/lift/heating as the model supports). Landing is
   NOT automatic: the player flies the ship down to the surface of a planet or moon.
3. The 2,000 m/s figure is a DEEP-SPACE speed only: for travel between bodies through
   space without a portal. The ship reaches it only when far enough from a body.
   The planning session DECIDES the cruise speed and the distance/regime rule
   (e.g. near-body limit vs deep-space limit) and records it as an ADR (Lead delegated).
Known state @ 8b23b52 (evidence: grep, session 74):
- `celestialData.ts` has an `atmosphereHeight` per body (Venus 6000, Earth 8000,
  Mars 2000, Jupiter 12000, Saturn 15000, Titan 2000, Uranus 8000, Neptune 8000,
  Triton 100; Mercury/Moon/Phobos/Io/Titania/Pluto/Charon 0), but NOTHING in
  physics reads it (only `celestialData.ts` + `types.ts` mention it).
- The flight model uses ONE profile, `EARTHSCALE_ATMOSPHERE` (atmosphere.ts:46),
  as the FlightController default (flightController.ts:139) for every body.
- The C1 2,000 m/s cap applies everywhere on inertial |v| and also fades retro
  thrust (A1-U18-2); the spin frame split A1-U18-3 affects landing. Fix these within T2 or before it.
- Check the catalog against real data (e.g. Pluto has a thin real atmosphere but 0 here).
Order: planned by a FRESH session after A1 U19 (which audits this gap), and built
only on the Lead's execute order (phase-2 Lead gate).
Lead look-and-feel rulings (2026-10-23, A1-U19 Q1/Q2 — defaults accepted; never re-ask):
- Atmosphere: a thin, glowing shell that clearly looks thin from space (a few percent of
  the body's radius), but thick enough that the player feels the air slow the ship on descent.
- Touchdown: under ~5 m/s clean landing; 5–15 m/s hard landing with camera shake; faster =
  crash (short explosion, then respawn in orbit above the body). Exact numbers: planning ADR.

### T5 — BIGGER MOON (REAL SIZE) — NOT STARTED
Source: Lead directive 2026-10-28 (session 150d, item 2) and ruling (b) (150e), `notes/LEDGER.md`; supersedes the 2026-10-22 "keep the small play Moon" ruling.
Requirement: the play Moon gets its real radius, 1,737 km, with real g, so the curve is no longer visible right in front of the player.
Terrain detail, LOD reach, precision and gates are rebuilt for that scale with no fps regression (§13 safeguard 4), and the spawn is re-derived.
Inputs: `docs/T5-T6-ideas.md` §0, §1 and §6.
Prerequisites: F5a–F5d; the planner decides, with an ADR, whether to fold them into T5 or run them first.
Out of scope: look and feel (T6).
Order: plan → READY → the Lead's "execute the T5 plan".

### T6 — LOOK-AND-FEEL OVERHAUL (MOON + CHARACTER TO AAA) — NOT STARTED
Source: Lead directive 150d (item 3), rulings (c) and (d) (150e), style reference 150f, neutral grey 150g and order 155, all 2026-10-28, `notes/LEDGER.md`.
Requirement: animation, sound, textures, many object types and colour for the Moon and the astronaut. Looking good beats real-Moon accuracy, game extras are allowed, and the sessions decide the design.
Fixed by the Lead:
- neutral grey regolith as in the eight NASA photos;
- sharp shadows;
- boulder fields, glowing minerals and a crashed lander;
- in-helmet audio and a soft ambient score;
- CC0 assets only, with the source URL recorded per file.
Inputs: `docs/T5-T6-ideas.md` §2–§6. The planner asks the open questions in §5 with their defaults.
Order: starts after T5 is merged into `main`; F3b comes after T6.

## PLAN FILE SCHEMA (every `docs/<task>-plan.md` follows this exactly)
Audit plans (A-tasks) use audit units (Uxx, default one per session; recheck batches per active plan) instead of build
steps; see `pre-t4:docs/A1-plan.md`.
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
1. Read `AGENT_BRIEF.md` (the phase-2 contract above all else). §12 SESSION BUDGET and
   §13 GOAL & DECISION AUTHORITY bind every task.
2. Here: find the ACTIVE task row (any row whose stage is not DONE).
3. Open its `docs/<task>-plan.md`: the FIRST UNCHECKED BOX is the starting point —
   a planning-checklist item while the plan is IN PROGRESS, a build step once
   building (if the plan is READY but no execute order is on record, you are at
   the LEAD GATE — do not build; report and wait).
4. `notes/STATE.md` NEXT ACTION confirms or overrides (it binds).
5. Reconcile `git log --oneline -15` + `git status` vs tracker; evidence wins;
   repair drift and note the repair in the SESSION LOG.
6. Continue (planning or building); commit+push per completed segment — each
   commit carries its checkbox + tracker row + STATE.md NEXT ACTION update
   (AGENT_BRIEF.md §6); session end adds the SESSION LOG handoff note.
