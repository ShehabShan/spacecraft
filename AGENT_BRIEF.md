# SOLARIS — GAME DEVELOPMENT BRIEF (PHASE 2: TASK-BASED MAIN DEVELOPMENT)

You are a game feature builder on a WebGL2 space-exploration game. The engine was
assembled and acceptance-verified in a prior phase (milestones 1A–1F; 1G deferred) —
that work is DONE. You do NOT re-derive it and you do NOT read the assembly-era
documents: the code in `game/src` is the source of truth. Your job: pick up the
active task, plan it or resume it midway, build it step by step, verify each step,
and commit+push after every completed step — so that ANY fresh session (a different
AI model, no shared memory) can continue exactly where you left off, from the repo
alone.

**ACTIVE TASK (2026-10-21): A1 ENGINE AUDIT — READ-ONLY.** While A1 is active you
are an AUDITOR, not a builder. The specs, the code and the tests are suspects to
check, not truths to defend. §11 AUDIT MODE overrides "the code is the source of
truth" above, and overrides §2, §3 and §8 where they conflict. T1 is PAUSED at B11.
Every session obeys §12 SESSION BUDGET and §13 GOAL & DECISION AUTHORITY.

## 1. READING ORDER (a fresh session reads exactly this, in order)
1. This brief (all of it — it is short).
2. `notes/task.md` — task tracker + task definitions; find the ACTIVE task.
3. The active task's plan `docs/<task>-plan.md` (now `docs/A1-plan.md`) — the FIRST UNCHECKED BOX is your
   starting point: a planning-checklist item while the plan is being authored,
   a build step once building has started (no plan file yet = the task is at
   its PLAN stage, first commit).
4. `notes/STATE.md` — NEXT ACTION (the binding pointer) and the SESSION LOG tail.
5. The code you are about to touch, under `game/src`.
6. If the active task is **A1 (engine audit)**: §11 AUDIT MODE below, which
   overrides parts of §2, §3 and §8 for that task only.

## 2. FILE MAP — what to read, what never to read
- `game/` — THE GAME. Source of truth for all behavior, constants, structure.
- `notes/task.md` + `docs/<Tn>-plan.md` + `notes/STATE.md` — the task system (§4).
- `notes/CHANGES.md` — change log. APPEND an entry for every code change you make
  (format: date · task · file · what · why · evidence · source).
- DO NOT READ (lifted during A1 — see §11; kept in the repo for history/audit only — reading them wastes
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
  camera bands, and the impostor hysteresis are RATIFIED — change none of them (except under §13: ADR + evidence)
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
  R5 FAIL is WAIVED for all task verification (Lead, 2026-10-20): count it as
  PASS, never a blocker or regression; do not change code to hide it.
- MS 1G (IndexedDB saves) — DEFERRED, explicitly ignored until the Lead orders
  it ("much later"). Do not start it, do not plan it.

## 9. HARD STOPS (always)
Any impulse to change a ratified constant/formula/threshold · any new library ·
a milestone regression page you cannot fix · suspected lost work · any doubt
about whether a change is allowed — STOP, write the options, ask the Lead.
During A1, also: any edit outside `docs/audit/**`, `game/tools/audit/**` and the
process files (`notes/task.md`, `notes/STATE.md`, `docs/A1-plan.md`).
The Lead is the repo owner.
Outside A1, a technical choice (including a ratified constant, formula,
threshold or a new library) is NOT a hard stop: decide it under §13 and record
an ADR. Stop and ask the Lead only for look-and-feel/gameplay preferences,
suspected lost work, or deleting the Lead's work.

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
- 2026-10-20 R5 waiver (Lead): the M1F R5 FAIL is deferred to later work and
  counts as PASS in every task's verification/regression check (m1f spec exit
  1 caused only by R5 is expected). No code, row or threshold changes (§8).
- 2026-10-21 Audit amendment (Lead): T1 PAUSED at B11; new task A1 engine audit
  (read-only) is active; §11 AUDIT MODE added; session budget 50 OLU per session
  stated as binding for every task; sessions from now on run on high-capability
  models.

- 2026-10-21 Goal & authority (Lead): §13 added. Real-looking, real-time solar
  system on an optimised, flexible engine; major rework allowed when clearly
  better; the session makes all technical calls (ADR in docs/decisions/); the
  Lead answers only look-and-feel questions; no-mess safeguards.

## 11. AUDIT MODE (binds only while the active task is A1)
Why: the milestone specs were written by GLM 5.3 and the engine by GLM 5.3 Flash
(Lead, 2026-10-21). Specs, code and tests are all suspect; a session that defends
the existing code cannot audit it.
- READ-ONLY: never edit `game/src/**`, `game/e2e/**`, `game/playwright.config.ts`,
  `Milestone/**`, `Design_specs/**`. Write only `docs/audit/**`, `game/tools/audit/**`
  (new files) and the process files.
- §2 DO-NOT-READ is lifted for A1: read `Milestone/*.txt` (targeted grep, never a
  whole file), `Design_specs/`, and `notes/reports/` as needed.
- §3 "when code looks odd, assume there is a reason" is SUSPENDED for A1. Treat
  `// WHY:` comments, CHANGES.md and reports as claims to verify, not as proof.
- "Code wins every conflict" does NOT apply in A1: a spec/code conflict is a
  finding, and the auditor judges which side is right on physics and math.
- RATIFIED items (§3) and parked 1F (§8) MAY be audited and flagged; changing them
  happens in a later fix task under §13 (ADR + evidence).
- Method, finding template, severity scale and budget rule: `docs/A1-plan.md` §6.

## 12. SESSION BUDGET (binds every task; Lead, 2026-10-21)
- One session = 50 OLU. Every committable unit (plan item, build step, audit
  unit) must finish, verify, commit and push inside one session.
- Do ONE unit per session. Start the wrap-up at about 40 OLU.
- If a unit will not fit, commit what is done as `<id>a`, add an unchecked `<id>b`
  box directly below it with the remaining scope, and repoint NEXT ACTION to it.
  Never end a session with uncommitted work.
- Quality over quantity: fewer, verified results beat many shallow ones.

## 13. PROJECT GOAL & DECISION AUTHORITY (Lead, 2026-10-21; binds every task)
- **Goal.** A game that looks like a real solar system: every planet and moon
  rotates and orbits, computed in real time. The engine must be optimised,
  flexible, high-performance and a solid foundation, so later features (e.g.
  fighting aliens, vehicles, new bodies) can be added without a rewrite.
- **Realism vs performance.** Looking real is the main requirement. Where exact
  simulation is impossible or too costly (heavy fps drops), use a workaround that
  still looks real (LOD, impostors, analytic rails, precomputation, approximation)
  and document the approximation.
- **Major change is allowed** — architecture, pipeline, state model, physics
  method, libraries — when it is clearly better for the goal.
- **The session decides technical questions** (engineering, physics, state,
  pipeline, performance) using its own best judgment. Do NOT ask the Lead to
  choose between technical options.
- **Ask the Lead only about look and feel / gameplay** (e.g. "should the Sun be
  blinding like the real Sun, or comfortable to look at?"), in plain language,
  with a recommended default.
- **ADR for every significant technical decision:** `docs/decisions/ADR-NNN-<slug>.md`
  (Context · Options · Decision · Why · Consequences), in the same commit.
- **No-mess safeguards:**
  1. Never delete the Lead's work: supersede, move or archive (`notes/archive/`);
     git history stays intact; never force-push.
  2. Rework happens on a task branch in session-sized steps (§12); every commit
     leaves typecheck, build and the task's tests green.
  3. Before replacing or retiring a test gate, the new independent check lands first.
  4. Any change claimed as an optimisation shows measured frame time / heap
     before and after.
  5. `main` changes only by merging a finished task.
- During A1, everything above is only **flagged and proposed**; changes happen in
  the fix tasks that follow.

