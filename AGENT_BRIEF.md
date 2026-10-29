# SOLARIS — GAME DEVELOPMENT BRIEF (PHASE 2: TASK-BASED MAIN DEVELOPMENT)

You build features for a WebGL2 space-exploration game. The engine (milestones
1A–1F; 1G deferred) is DONE and acceptance-verified: do not re-derive it or read
assembly-era documents; `game/src` is the source of truth. Plan or resume the
active task, build and verify it step by step, commit+push after every step, so
ANY fresh session (other model, no memory) continues from the repo alone.

**ACTIVE WORK:** `notes/STATE.md` NEXT ACTION + the `notes/task.md` tracker. Order
after T4 (Lead, `notes/LEDGER.md` 2026-10-28): T5 → T6 → F3b. Every session obeys
§12 and §13.

## 1. READING ORDER (exactly this, in order)
1. This brief, all of it.
2. `notes/task.md`: the TRACKER header and the ACTIVE row
   (`grep -n '^| <task>' notes/task.md`); skip DONE rows and inactive definitions.
3. The task definition. FIX TASK (F…): no plan file; read only its
   `docs/audit/U27c-fix-tasks.md` §2 row (the definition; the tracker row is the
   checkbox) and, before the first commit, the S2/S3 rows of its cluster in
   `docs/audit/FINDINGS.md` §4. Other tasks: `docs/<task>-plan.md`, FIRST UNCHECKED
   BOX (planning item or build step; no plan file = PLAN stage, first commit).
4. `notes/STATE.md`: bold NEXT ACTION (binding), any RECON paragraph under it, last
   3 SESSION LOG rows. Nothing below SESSION LOG.
5. The code you will touch: `grep -rn` the names in the definition, then `sed -n`
   only those functions. Never read whole large files.

LEAN READ (Lead, 2026-10-27; binds every session): read only what §1 needs (full
process files cost ~25 OLU); never `cat` a process file, use `sed -n`/`grep`;
check `notes/LEDGER.md` by `grep` only, when a decision may be ruled already;
history (`docs/history/`, `git show pre-t4:<path>`) only when a task needs it.

## 2. FILE MAP
- `game/` — THE GAME; the CODE wins every conflict with any document.
- Task system (§4): `notes/task.md` (tracker, definitions, PLAN FILE SCHEMA),
  `docs/<Tn>-plan.md`, `notes/STATE.md` (NEXT ACTION, GIT RECIPE, COMMIT AUTHOR,
  OLU METER, SESSION LOG).
- `notes/LEDGER.md` — APPROVAL LEDGER: binding Lead rulings; append-only.
- `notes/CHANGES.md` — APPEND under "## Entries" for every code change: date ·
  task · file · what · why · evidence · source.
- `docs/decisions/` ADRs (§13) · `docs/audit/` open A1 outputs (`FINDINGS.md`,
  `U27c-fix-tasks.md`, `U26-adr-drafts.md`) · `docs/history/` digests of finished
  work · `docs/evidence/<task>/` new evidence (§6) · `docs/T5-T6-ideas.md` T5/T6
  planner input.
- REMOVED in T4 (Lead ruling (a), 2026-10-28; ADR-030): phase-1 canon and design
  vision, phase-1 reports/patches/archive, raw evidence, A1 unit reports, DONE
  plans. Their content is in the code; if a task needs one: `git show
  pre-t4:<path>`. Never re-add them.
- REGRESSION suite (§3): `?page=m1a` … `?page=m1e`
  (`game/src/test/Milestone1<X>_TestHarness.tsx`) and the rebuilt 1F gates
  `?page=m1fR1` … `m1fR5` (`npx playwright test e2e/m1f-r`). Shipped `?page=m1f`
  rows are retired (ADR-026); the page stays for manual mode and tools.

## 3. ENGINE INVARIANTS (protect them)
The engine is unusual BY DESIGN: odd code usually has a reason (`// WHY:` or a
CHANGES.md entry) — do not "simplify" it.
- `src/core/**` imports NOTHING from three / react / @react-three/fiber / physics.
- Zero-GC: buffers and pools boot-allocated; NO per-frame allocation in tick loops.
- Floating origin: 256 m lattice (O = 256·round(P/256)); rebase when max|local| >
  1,024 m; local coords ALWAYS Float64 subtraction, then narrowing.
- Canonical tick order lives in `SimulationCore.tick()`; never reorder it.
- Astronaut orientation is a parallel-transport frame, NEVER Euler accumulators.
- One harness/game module per page, switched by full page loads via the `?page=`
  static map in `main.tsx` (module singletons, Workers and THREE prototype patches
  corrupt multi-module pages); new game pages follow it.
- Touching shared modules (terrain / KCC / core / render): re-run the relevant
  `?page=m1X` suites and keep them green; a break you caused is your bug — fix it
  before reporting.
- `celestialData.ts` catalog constants are never re-derived from formulas. The KCC
  step/slope rule, C¹ speed cap, layered camera bands and impostor hysteresis are
  RATIFIED: change none without a Lead ruling, except under §13 (ADR + evidence).
- Rapier or any physics library stays deferred: analytic KCC + sweeps ARE the
  design. No new libraries without asking the Lead.

## 4. THE TASK SYSTEM
- TASKS are defined in `notes/task.md`: one branch, one plan file
  `docs/<Tn>-plan.md` (fix tasks: §1.3), one tracker row each.
- PLAN: author the plan section by section per its PLANNING CHECKLIST (schema in
  `notes/task.md`); the first planning commit creates it (header + empty
  checklist); draft, check off, commit, push a few sections per commit. Status:
  NOT STARTED → IN PROGRESS (n/m) → READY. BUILD: run the steps in order.
- LEAD GATE: at checklist completion set READY, update tracker + STATE.md and STOP.
  Build only on the Lead's order ("execute the <Tn> plan"), never automatically.
- A step or checklist item is the unit of work and of commit: small, verifiable,
  checkpointed per §6.
- Tracker columns: task · branch · plan status · build status · step progress
  (done/total + next) · last commit · blockers.
- Branch `<tn>-<slug>` from the latest integrated line. A DONE, verified task is
  merged into `main` and pushed by that session; the next task branches from
  `main`.

## 5. RESUME PROTOCOL (the only entry procedure)
1. Read per §1.
2. Reconcile `git log --oneline -15`, `git status` and the files with tracker +
   STATE.md; hard evidence (commits, files, checkboxes) outranks prose. Minor
   drift: repair tracker/STATE.md, note it in the SESSION LOG. Suspected lost or
   uncommitted work: STOP, ask the Lead. Before cutting a branch, `git ls-remote
   origin`: if it exists, check it out and follow ITS `notes/STATE.md` NEXT ACTION.
3. Report ≤5 sentences: state, exact next step, discrepancies.
4. Continue at NEXT ACTION; never redo done steps or re-ask `notes/LEDGER.md`
   decisions.
5. Session end ADDS the SESSION LOG handoff row (done, next, must-knows) and
   commits it. No handoff note = protocol violation.

## 6. COMMIT & PUSH POLICY
- Commit AND PUSH after every VERIFIED unit (plan section, build step, verified
  fix); frequency makes resume possible.
- Every commit is a CHECKPOINT: the same commit checks off the plan box, updates
  the tracker row (status, progress, last commit) and repoints NEXT ACTION. Never
  leave work or progress updates uncommitted.
- REF CHECK before every commit, from `game/`: `node tools/check-repo-refs.mjs
  --max 100000` — no NEW dangling refs; touched files 0 (ADR-030).
- EVIDENCE (ADR-030): one summary ≤ 5 KB per step in `docs/evidence/<task>/`
  (commands, exit codes, key numbers). Never commit raw `playwright.json`, bulk
  logs or screenshots unless a ruling needs one image.
- Message: `<area>: <one-line purpose>`; body WHAT · WHY · STATE (true now, open) ·
  NEXT · VERIFIED (commands + results; exit codes UNPIPED; "clean" needs an
  observed exit 0) — understandable from `git log` alone.
- PUSH AUTHORITY (Lead, 2026-10-27): push verified commits without asking, and the
  §4 fast-forward into `main` unless NEXT ACTION or the task row says wait. Push
  via the `__github` proxy (STATE.md GIT RECIPE).
- Never amend pushed commits, never force-push, never re-add removed history.
- END REPORT (Lead, 2026-10-28): final message ≤ 4 short lines, no tables:
  1. unit + result (one key number); 2. commit hash, merged or not; 3. what the
  Lead must decide, or "nothing"; 4. next unit. Details: commit + SESSION LOG.

## 7. CODE COMMENTS
Non-obvious code gets a 1–4 line `// WHY:` at the decision site (constraint,
ruling, tradeoff, gotcha), citing the task id or CHANGES.md entry. No narration of
the obvious, no essays.

## 8. PARKED (only on a Lead directive naming them)
- 1F: round-7 ruling PENDING (menu `pre-t4:notes/reports/M1F.md` §15.7; rec. (a)
  rebase gate ≥ 2 → ≥ 1). Green except R5, by design; leave it. R5 FAIL is WAIVED
  (Lead, 2026-10-20): counts as PASS in all verification; never hide it in code.
- 1G (IndexedDB saves): DEFERRED; do not start or plan it.

## 9. HARD STOPS
STOP, write the options and ask the Lead (repo owner) on: a regression page you
cannot fix · suspected lost work · deleting the Lead's work · look-and-feel or
gameplay preferences · doubt whether a change is allowed. A technical choice
(ratified constant, formula, threshold, new library) is NOT a hard stop: decide it
under §13 with an ADR.

## 10. AMENDMENTS (full text: `git show bb9637d:AGENT_BRIEF.md`)
- 10-19 Phase 2 (Lead): task system, commit+push per step, merge to `main`; 1F parked, 1G deferred.
- 10-19 (Lead): incremental planning; every commit a checkpoint; Lead gate.
- 10-20 R5 waiver (Lead, §8). · 10-21 A1 audit, T1 paused, 50 OLU budget (§12). · 10-21 §13 (Lead).
- 10-26 banner repair (s104) · branch check `git ls-remote` (s112, §5).
- 10-27 LEAN READ (Lead, s121). · 10-28 END REPORT, lean code read (Lead).
- 10-28 rebuilt 1F gates (s142, ADR-026) · phase-1 canon removed (s151, ADR-030) · AAA goal (Lead, s153c).
- 10-28 T4 S7 (s156): trimmed to the T4 layout; §11 AUDIT MODE and A1-only clauses retired (A1 DONE; `docs/history/A1.md`); §6 REF CHECK + EVIDENCE. No other rule change.
- 10-29 T6 parallel tracks (Lead, s159): T6 runs as tracks on separate branches and bots, merged through `t6-look-and-feel`; the starter prompt names the branch; T6 sessions read and update `notes/T6-STATE.md` (amends §4 for T6).

## 11. AUDIT MODE — RETIRED (A1 DONE 2026-10-26; `docs/history/A1.md`)

## 12. SESSION BUDGET (Lead, 2026-10-21; every task)
- Session = 50 OLU, ONE unit (plan item or build step) that finishes, verifies,
  commits and pushes inside it.
- Wrap up at ~40 OLU (~10 OLU reserve for commit + push; late steps cost more);
  up to 50 is allowed; unused budget is waste (Lead, 2026-10-28).
- After bootstrap, check the meter and take the largest slice ending near ~40. If
  it won't fit: commit the done part as `<id>a`, add unchecked `<id>b` directly
  below with the rest, repoint NEXT ACTION. Never end with uncommitted work.
- Quality over quantity: done early → improve that unit (mutants, edge cases,
  second run, tighter evidence), not a new unit.
- Fresh bot per session: the OLU meter is a lifetime total per bot.

## 13. GOAL & DECISION AUTHORITY (Lead, 2026-10-21; every task)
- **Product (Lead, 2026-10-28):** a publishable AAA browser game, not a prototype
  or "vibe" game; every choice aims at shipped commercial quality in look, feel,
  performance and stability; a finished task leaves no placeholder or stopgap.
- **Goal:** a real-looking solar system — every planet and moon rotates and
  orbits, computed in real time — on an optimised, flexible engine that later
  features (aliens, vehicles, new bodies) extend without a rewrite.
- **Realism vs performance:** looking real comes first; where exact simulation is
  impossible or costs heavy fps, use a real-looking workaround (LOD, impostors,
  analytic rails, precomputation, approximation) and document it.
- **Major change is allowed** (architecture, pipeline, state model, physics,
  libraries) when clearly better for the goal.
- **The session decides technical questions** by its own judgment; never ask the
  Lead to pick between technical options.
- **Ask the Lead only about look and feel / gameplay**, in plain language, with a
  recommended default (e.g. "blinding real Sun, or comfortable to look at?").
- **ADR per significant technical decision:** `docs/decisions/ADR-NNN-<slug>.md`
  (Context · Options · Decision · Why · Consequences), same commit.
- **No-mess safeguards:** 1. never delete the Lead's work — supersede, move or
  archive (`git show pre-t4:<path>`, ADR-030), never force-push; 2. rework on a
  task branch in §12-sized steps, each commit green on typecheck, build and the
  task's tests; 3. a replacement gate lands before the old one retires; 4. an
  optimisation claim shows measured frame time / heap before and after; 5. `main`
  changes only by merging a finished task.