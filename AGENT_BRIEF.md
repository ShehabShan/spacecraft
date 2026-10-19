# SOLARIS — GAME DEVELOPMENT BRIEF (PHASE 2: TASK-BASED MAIN DEVELOPMENT)

You are a game feature builder on a WebGL2 space-exploration game. The engine was
assembled and acceptance-verified in a prior phase (milestones 1A–1F; 1G deferred) —
that work is DONE. You do NOT re-derive it and you do NOT read the assembly-era
documents: the code in `game/src` is the source of truth. Your job: pick up the
active task, plan it or resume it midway, build it step by step, verify each step,
and commit+push after every completed step — so that ANY fresh session (a different
AI model, no shared memory) can continue exactly where you left off, from the repo
alone.

## 1. READING ORDER (a fresh session reads exactly this, in order)
1. This brief (all of it — it is short).
2. `notes/task.md` — task tracker + task definitions; find the ACTIVE task.
3. The active task's plan `docs/<Tn>-plan.md` — the FIRST UNCHECKED BOX is your
   starting point: a planning-checklist item while the plan is being authored,
   a build step once building has started (no plan file yet = the task is at
   its PLAN stage, first commit).
4. `notes/STATE.md` — NEXT ACTION (the binding pointer) and the SESSION LOG tail.
5. The code you are about to touch, under `game/src`.

## 2. FILE MAP — what to read, what never to read
- `game/` — THE GAME. Source of truth for all behavior, constants, structure.
- `notes/task.md` + `docs/<Tn>-plan.md` + `notes/STATE.md` — the task system (§4).
- `notes/CHANGES.md` — change log. APPEND an entry for every code change you make
  (format: date · task · file · what · why · evidence · source).
- DO NOT READ (kept in the repo for history/audit only — reading them wastes
  context and invites overturning settled decisions):
  - `Milestone/*.txt` — the seven assembly deliverables. Their content is already
    IN the code; where they differ from the code, the code is right.
  - `notes/reports/` and `notes/patches/` — assembly-phase evidence and addenda.
  - `notes/archive/` — the archived phase-1 brief (superseded by this file).
- OPTIONAL BACKGROUND: `Design_specs/` — the original design vision. Consult for
  feature context if useful; the CODE wins every conflict. Never edit it.
- `game/src/test/Milestone1X_TestHarness.tsx` — assembly acceptance pages, still
  runnable (`?page=m1a` … `?page=m1f`). They are your REGRESSION suite (§3).

## 3. ENGINE INVARIANTS — these still bind; protect them
The engine is unusual BY DESIGN. When code looks odd, assume there is a reason
(often a `// WHY:` comment or a CHANGES.md entry) — do not "simplify" it.
- Pure core: `src/core/**` imports NOTHING from three / react / @react-three/fiber
  / physics libs. Keep it that way.
- Zero-GC: all buffers and pools are boot-allocated; NO per-frame allocation in
  tick loops.
- Floating origin: 256 m lattice (O = 256·round(P/256)); rebase when max|local| >
  1,024 m; local coordinates are ALWAYS Float64 subtraction then narrowing.
- The canonical tick order lives in `SimulationCore.tick()` — do not reorder it.
- Astronaut orientation is a parallel-transport frame — NEVER Euler accumulators.
- Page rule: exactly one harness/game module per page, switched by full page
  loads via the `?page=` static map in `main.tsx` (module singletons + Web
  Workers + THREE prototype patches make multi-module pages corrupt each other).
  New game pages follow the same static-map pattern.
- Milestone harness pages are regression: if you touch shared modules (terrain /
  KCC / core / render), re-run the relevant `?page=m1X` suite(s) and keep them
  green. Breaking one is a bug you introduced — fix it before reporting.
- Final decisions live in code: catalog constants in `celestialData.ts` are never
  re-derived from formulas; the KCC step/slope rule, the C¹ speed cap, the layered
  camera bands, and the impostor hysteresis are RATIFIED — change none of them
  without a Lead ruling.
- Rapier (or any physics library) stays deferred: the analytic KCC + sweeps ARE
  the design. No new libraries without asking the Lead.

## 4. THE TASK SYSTEM
- Work is organized as TASKS (T1, T2, …) defined in `notes/task.md`. Each task
  has: one branch, one plan file `docs/<Tn>-plan.md`, and one tracker row.
- Two stages — BOTH incremental and multi-session:
  - PLAN: author `docs/<Tn>-plan.md` section by section, per the PLANNING
    CHECKLIST at the top of the plan file (schema in `notes/task.md`). The file
    is created on the FIRST planning commit (header + empty checklist), then
    sections are drafted, checked off, committed, pushed — a few per commit.
    Plan status lifecycle: NOT STARTED → IN PROGRESS (n/m sections) → READY.
  - BUILD: execute the plan's steps in order.
  - LEAD GATE: when the plan checklist completes, set plan status READY, update
    tracker + STATE.md, and STOP — building starts ONLY on the Lead's execute
    order ("execute the <Tn> plan"), never automatically.
- A STEP (build) or CHECKLIST ITEM (plan) is the unit of work AND the unit of
  commit: small, independently verifiable, checkpointed per §6.
- Tracker columns (update as you go): task · branch · plan status · build status ·
  step progress (done/total + next step) · last commit · blockers.
- Branch/merge: one branch per task (`<tn>-<slug>`, e.g. `t1-playable-moon`) cut
  from the latest integrated line. When a task is DONE and verified, merge its
  branch into `main` and push; the NEXT task branches from `main`. (This replaces
  the phase-1 "never push main" rule: `main` now receives completed-task merges,
  pushed by the merging session. Never force-push. Never stage `Design_specs/`
  or `Milestone/`.)

## 5. MULTI-SESSION RESUME PROTOCOL (the only entry procedure)
1. Read per §1 (brief → tracker → active plan → STATE.md NEXT ACTION).
2. Reconcile: `git log --oneline -15`, `git status`, and the filesystem must
   agree with the tracker + STATE.md. Hard evidence (commits, files, plan
   checkboxes) outranks prose. Minor drift: trust evidence, repair the
   tracker/STATE.md, note the repair in the SESSION LOG. Suspected lost or
   uncommitted work: STOP, ask the Lead.
3. Report ≤5 sentences: current state, exact next step, discrepancies.
4. Continue at NEXT ACTION (the first unchecked plan step). Never redo completed
   steps; never re-ask decisions recorded in STATE.md's APPROVAL LEDGER.
5. Before ending a session: the per-commit checkpoints (§6) have already left
   the repo fully resumable; session end only ADDS the SESSION LOG handoff row
   (what was accomplished, what is next, anything the successor must know) and
   commits it. A session that ends without a handoff note violates protocol.

## 6. COMMIT & PUSH POLICY
- Commit AND PUSH frequently — after every good committable amount of VERIFIED
  work: a plan section drafted, a build step done, a bug verified fixed.
  Frequency is the point — it is what makes mid-task resume possible.
- EVERY commit is a CHECKPOINT, in BOTH stages: before committing, update the
  progress system and INCLUDE those updates in the SAME commit — check off the
  finished plan-checklist item and/or build step in `docs/<Tn>-plan.md`, update
  the tracker row in `notes/task.md` (plan/build status, step progress, last
  commit), and repoint `notes/STATE.md` NEXT ACTION at the next unchecked box.
  After the push the repo is a COMPLETE resume point: if the session dies
  immediately after, a fresh session loses nothing. Never leave finished work
  or progress updates sitting uncommitted.
- Message format — a fresh session must understand the change from `git log`
  ALONE. First line `<area>: <one-line purpose>`; body covers:
  - WHAT: files / functions / behavior changed;
  - WHY: the problem, requirement, or plan step it serves;
  - STATE: what is true now, what remains open;
  - NEXT: the next step;
  - VERIFIED: commands + observed results; exit codes UNPIPED — a "clean" claim
    requires an observed exit 0.
- Never amend pushed commits; never force-push; never stage `Design_specs/` or
  `Milestone/`.

## 7. CODE COMMENTS — write WHY, not what
Important code and non-obvious functions get a SHORT (1–4 line) `// WHY:` comment
at the decision site (constraint, ruling, tradeoff, gotcha), referencing the task
id or CHANGES.md entry when one exists — so later sessions READ the reason in
place instead of guessing or re-deriving. Do not narrate the obvious; do not write
essays.

## 8. PARKED (do not touch without a Lead directive naming them)
- MS 1F — round-7 ruling PENDING: the option menu is at
  `notes/reports/M1F.md` §15.7 (recommendation (a): rebase gate ≥ 2 → ≥ 1).
  The 1F harness state is green except R5 by design; leave it that way.
- MS 1G (IndexedDB saves) — DEFERRED, explicitly ignored until the Lead orders
  it ("much later"). Do not start it, do not plan it.

## 9. HARD STOPS (always)
Any impulse to change a ratified constant/formula/threshold · any new library ·
a milestone regression page you cannot fix · suspected lost work · any doubt
about whether a change is allowed — STOP, write the options, ask the Lead.

## 10. AMENDMENT LOG
- 2026-10-19 Phase-2 transition (Lead order): brief rewritten for game feature
  builders; assembly brief archived verbatim at
  `notes/archive/AGENT_BRIEF-assembly.md`; task system installed (`notes/task.md`
  + `docs/<Tn>-plan.md` schema); commit+push after every completed step with
  WHAT/WHY/STATE/NEXT/VERIFIED messages; merge-to-main between tasks (supersedes
  phase-1 "never push main"); `Milestone/*.txt`, `notes/reports/`,
  `notes/patches/`, `notes/archive/` moved off the reading list;
  `Design_specs/` = optional background, code wins; 1F parked, 1G explicitly
  deferred; NEXT ACTION = "T1 plan".
- 2026-10-19 Amendment (Lead, same day): planning is NOT one-shot — plan files
  carry a PLANNING CHECKLIST and are authored section by section across
  sessions, exactly like the build. EVERY commit (planning or building) is a
  checkpoint: the plan checkbox, tracker row, and STATE.md NEXT ACTION updates
  ride in the SAME commit, so each push is a complete resume point. Lead gate
  added between plan READY and build start: execute only on the Lead's order.
