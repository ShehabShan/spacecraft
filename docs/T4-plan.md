# T4 — REPO CLEANUP (AI-ORIENTED COMPACTION) — PLAN

- Task: T4 · Branch: `t4-repo-cleanup` (cut from `main` @ 7018e56, session 150d)
- Stage: BUILDING (Lead's execute order 2026-10-28, session 151; build 1/9)
- Last updated: 2026-10-28 (session 151)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).
- Source: Lead directive 2026-10-28 (STATE.md APPROVAL LEDGER, session 150d) + ruling (a) (session 150e). Readers are AI sessions only; optimise for fast AI reading, not human readability.

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

## Goal
Shrink the tracked tree from 11.44 MB / 1,531 files (bb73503) to ≤ 3 MB. Keep only what a fresh AI session needs for T5, T6 and F3b onward: code, live gates, ADRs, open fix-task definitions, binding rulings, and short digests of finished work. Everything removed stays reachable through the annotated tag `pre-t4` (`git show pre-t4:<path>`); no history rewrite, no force-push.

## Inventory (bb73503; tracked bytes · files) — role → T4 fate
| Path | Size | Role | Fate (step) |
|---|---|---|---|
| `game/src` | 804 KB · 63 | engine + play code + milestone harness pages | KEEP; 2 comment path edits (S1, S2) |
| `game/tools/*.mjs` (non-audit) | 501 KB · 56 | live gates `test-*`, `check-play-*`, `alloc-*`, loaders; phase-1 `diag-m1*`, `diag-spherify`, `r4-cdp-driver`; `extract.mjs` (reads `Milestone/`) | KEEP gates; DELETE `extract.mjs` (S1); DELETE diag/driver unless referenced (S3) |
| `game/tools/audit` | 578 KB · 77 | A1 probes; F-task `*-regress.sh` runners that write into evidence dirs | KEEP probes cited by open U27c §2 rows; DELETE the rest (S3) |
| `game/` other | ~91 KB | package.json, lock, configs, e2e | KEEP |
| `docs/audit/evidence` | 5.93 MB · 952 | raw per-step proof F1a–F3a, F2f, T1, T3 (713 `.log`, 73 `playwright.json` up to 410 KB, 9 PNG) | DELETE → `docs/history/EVIDENCE-INDEX.md` (S2) |
| `docs/audit/U*-evidence/`, `U*-probe-output.txt` | 0.89 MB · 218 | raw A1 proof | DELETE → index (S2) |
| `docs/audit/*.md` | 722 KB · 82 | A1 unit reports; `FINDINGS.md` (167 findings); `U27c-fix-tasks.md` (open F-task list); `U26-adr-drafts.md` (D-ADRs promoted by open F tasks) | KEEP those 3; rest → `docs/history/A1.md` (S4) |
| `docs/decisions` | 126 KB · 30 | ADR-001…029 + README | KEEP; dangling paths rewritten only (S2) |
| `docs/T1-plan.md`, `docs/A1-plan.md` | 186 + 37 KB | DONE plans | → `docs/history/T1.md`, `docs/history/A1.md` (S4) |
| `docs/T3-plan.md`, `docs/T4-plan.md` | 12 KB, this | DONE (terse) / active | KEEP |
| `notes/STATE.md` | 254 KB | NEXT ACTION + ~70 superseded/DONE paragraphs, MILESTONE LEDGER, IN-FLIGHT (stale), 1D FPS BACKLOG, APPROVAL LEDGER (96 rows, binding), SESSION LOG (168 rows), ANCHOR | compact (S5) |
| `notes/task.md` | 52 KB | tracker, task definitions, plan schema | compact DONE rows + definitions (S6) |
| `notes/CHANGES.md` | 122 KB | change log (brief §2) | older entries → per-task digest (S6) |
| `notes/reports`, `notes/patches`, `notes/archive` | 311 + 1 + 34 KB | phase-1 history (already DO-NOT-READ) | DELETE (S1) |
| `Milestone/`, `Design_specs/` | 738 + 22 KB | phase-1 canon | DELETE — Lead ruling (a) (S1) |
| `AGENT_BRIEF.md` | 20 KB | the contract | trim, every rule kept (S7) |
| `.DS_Store` (root) | 10 KB | junk | DELETE + `.gitignore` (S1) |

## Scope IN
- `pre-t4` tag, `game/tools/check-repo-refs.mjs` (dangling-path gate), ADR-030 (layout, history pointer, evidence policy).
- Deletions and digests listed in the Inventory; new `docs/history/` (A1.md, T1.md, SESSIONS.md, EVIDENCE-INDEX.md) and `notes/LEDGER.md`.
- Rewriting every reference to a removed path into `pre-t4:<path>` form (docs, ADRs, tool and code comments).
- Brief, tracker, STATE.md and CHANGES.md compaction; evidence policy for future tasks.

## Scope OUT
- Any game behaviour, constant, threshold or gate logic change (comment edits only in `game/src`).
- Rewriting git history, force-push, deleting branches.
- Changing the meaning of any APPROVAL LEDGER row or ADR decision (ADRs get path rewrites only).
- T5, T6, F3b and every other task; `docs/T3-plan.md`; `package-lock.json`.

## Affected modules
- New: `game/tools/check-repo-refs.mjs`, `game/tools/gen-moon-basins.mjs` (moved from `docs/audit/evidence/T3/S2/basins-gen.mjs`), `docs/decisions/ADR-030-repo-layout-history-pointer.md`, `docs/history/{A1,T1,SESSIONS,EVIDENCE-INDEX}.md`, `notes/LEDGER.md`, `docs/evidence/T4/` (summaries only).
- Edited: `AGENT_BRIEF.md`, `notes/STATE.md`, `notes/task.md`, `notes/CHANGES.md`, `.gitignore`, `docs/decisions/*.md`, `docs/audit/{FINDINGS,U27c-fix-tasks}.md`, comments in `game/src/test/Milestone1F_TestHarness.tsx` (l.1586), `game/src/play/world/moonConfig.ts` (l.22), `game/tools/test-{orbit,flight,kcc,seam,precision}-gate.mjs`, `game/tools/test-moon-profile.mjs`, `game/tools/test-e2e-plumbing.mjs`.
- Deleted: `Milestone/`, `Design_specs/`, `notes/{reports,patches,archive}/`, `.DS_Store`, `game/tools/extract.mjs`, `docs/audit/evidence/`, `docs/audit/U*-evidence/`, `docs/audit/U*-probe-output.txt`, `docs/audit/U*.md` except the 3 kept, `docs/T1-plan.md`, `docs/A1-plan.md`, part of `game/tools/audit/` and of `game/tools/diag-*`.

## Steps
Each step is one session (§12); split `<id>a`/`<id>b` if it will not fit. Every step: checker shows no NEW dangling refs, and the files the step touched have 0. Fresh VMs need `npm ci` (+ `npx playwright install chromium` for S3/S8) in `game/`.
- [x] **S0 anchor + checker + ADR-030.** DONE session 151: tag `pre-t4`, checker self-test 15/15 exit 0, baseline dangling 56 recorded in ADR-030 and the S0 commit message. Annotated tag `pre-t4` on the S0 commit, pushed. `check-repo-refs.mjs`: scans tracked text files (md, ts, tsx, mjs, js, sh, json minus lockfile) for repo-path tokens (`docs/`, `notes/`, `game/`, `Milestone/`, `Design_specs/`, and `../docs/`-style forms from `game/`), fails on any that does not exist unless written `pre-t4:<path>` (or `<hash>:<path>`); placeholders such as `<task>` and globs are ignored. ADR-030: `docs/history/` layout, the `pre-t4:` pointer, evidence policy (per-step summary ≤ 5 KB in `docs/evidence/<task>/`; never commit raw `playwright.json` or bulk logs). VERIFIED: `node tools/check-repo-refs.mjs --self-test` exit 0 (mutants: missing path fails; `pre-t4:` missing path passes; existing passes; placeholder ignored); baseline run prints the dangling count N (red is expected); `git ls-remote origin refs/tags/pre-t4` shows the tag.
- [ ] **S1 phase-1 canon + history out.** Delete `Milestone/`, `Design_specs/`, `notes/reports/`, `notes/patches/`, `notes/archive/`, `.DS_Store` (+ `.gitignore`), `game/tools/extract.mjs`. Rewrite their references in `AGENT_BRIEF.md` (§2, §8 1F pointer, §10, §11), `notes/task.md`, and the harness comment to `pre-t4:` form. VERIFIED: `npm run typecheck` and `npm run build` exit 0; `git ls-files Milestone Design_specs notes/reports notes/patches notes/archive | wc -l` = 0; checker 0 in `AGENT_BRIEF.md`, `notes/task.md`, `game/src`.
- [ ] **S2 evidence → index.** Delete `docs/audit/evidence/**`, `docs/audit/U*-evidence/**`, `docs/audit/U*-probe-output.txt`. Write `docs/history/EVIDENCE-INDEX.md` with one line per evidence dir: task·step · what it proved · key number · `pre-t4:` path. Move `T3/S2/basins-gen.mjs` → `game/tools/gen-moon-basins.mjs` (moonConfig comment updated). Keep `U01-evidence/gate-run1.log` only if an S3-kept probe reads it. Rewrite evidence paths in ADRs, `U27c-fix-tasks.md`, `FINDINGS.md` and tool comments. VERIFIED: `git ls-files docs/audit | grep -c evidence` = 0; `node tools/gen-moon-basins.mjs` stdout identical to the `pre-t4` copy's; tsc + build exit 0; checker 0 in `docs/decisions`, `docs/audit`, `game/`.
- [ ] **S3 tools.** In `game/tools/audit/` keep only probes named in a kept doc (FINDINGS, U27c-fix-tasks, U26-adr-drafts, an ADR) or a kept gate: 17 at afafc14, e.g. `u27b3a-k2b-recheck.mjs` (source of test-e2e-plumbing) and `u27-findings-index.py` (FINDINGS §4 generator); delete the rest and every `*-regress.sh` / `f2fa-*.sh` runner. Delete phase-1 `diag-m1*.mjs`, `diag-spherify.mjs`, `r4-cdp-driver.mjs` unless imported by a kept tool or cited by an open row or ADR. Keep-list + reason per file in EVIDENCE-INDEX §Tools. VERIFIED: `grep -rn` finds no import/readFile of a deleted file under `game/`; each kept probe runs with its recorded exit code; `test-e2e-plumbing` and `test-{orbit,flight,kcc,seam,precision}-gate` exit 0; tsc + build exit 0; checker 0 in `game/`.
- [ ] **S4 plans + A1 reports → digests.** `docs/history/A1.md`: A1 method + severity scale (from A1-plan §6) + one row per unit (id · subject · finding ids · outcome) + U27c-lead-summary folded in; each unit row keeps the "red before" number an open U27c §2 row cites (e.g. F4a: U27b4bbba 0.1083 m, from `U27-k7-recheck.md`); delete the other `docs/audit/U*.md` (keep FINDINGS, U27c-fix-tasks, U26-adr-drafts). `docs/history/T1.md` (≤ 8 KB: what was built, modules, rulings, ADR-027, gates) replaces `docs/T1-plan.md`; `docs/A1-plan.md` deleted. VERIFIED: `grep -c` of distinct `A1-U..-n` ids in FINDINGS §4 = 167, unchanged; every unit id of the old A1 tracker row appears in A1.md (script diff empty); checker 0 in `docs/`.
- [ ] **S5 STATE.md.** Keep: the current NEXT ACTION paragraph, one working VM git recipe, the last 3 SESSION LOG rows. Move the APPROVAL LEDGER verbatim (no rewording) to `notes/LEDGER.md`. Move 1D FPS BACKLOG to a task.md backlog row. MILESTONE LEDGER, IN-FLIGHT, ANCHOR, superseded/DONE paragraphs and older SESSION LOG rows → `docs/history/SESSIONS.md` (one line per task: sessions, outcome, ADRs) + `pre-t4:notes/STATE.md`. VERIFIED: ledger row diff pre vs post empty (96 rows + any added since); STATE.md ≤ 10 KB; checker 0.
- [ ] **S6 task.md + CHANGES.md.** Tracker: one ≤ 200-char row per DONE task (status · merge · ADRs · gate), open rows (F3a-follow-ups, T2, T4, T5, T6) unchanged; DONE task definitions → `pre-t4`; PLAN FILE SCHEMA and resume procedure kept. CHANGES.md: pre-T4 entries → one digest line per task/milestone + `pre-t4:notes/CHANGES.md`; §2 format continues. VERIFIED: every task id of the old tracker present; open rows byte-identical except progress columns; checker 0.
- [ ] **S7 brief.** Update §1 reading order/LEAN READ and §2 file map to the new layout; retire §11 AUDIT MODE and A1-only clauses in §9/§13 (history in `docs/history/A1.md`); §10 → one line per amendment; add the ADR-030 evidence policy and "run `check-repo-refs` before every commit". No other rule change. VERIFIED: rule map in the commit message (every old §/bullet → new place, or "A1-only, retired"); brief ≤ 12 KB; checker 0.
- [ ] **S8 close-out.** Checker 0 over the whole tree; full §13 matrix green (tsc, build, play Node tests with `--expose-gc`, kcc-default-trace, kcc-gate, the F-gates, `e2e/play.spec.ts`, m1e, m1f-r with R5 waived); before/after size table; fast-forward `t4-repo-cleanup` into `main` and push (§6 push authority); NEXT ACTION → T5 plan. VERIFIED: `docs/evidence/T4/S8.txt` (≤ 5 KB) with exit codes; total tracked bytes ≤ 3 MB.

## Risks & open decisions
- R1 a binding ruling lost → ledger moved verbatim; row diff must be empty (S5).
- R2 dangling references → the checker lands first (S0, §13 safeguard 3) and gates every step.
- R3 a tool or page reads a deleted file → grep + run kept tools (S3); tsc/build every step.
- R4 a later task needs raw evidence or a probe → `pre-t4` tag + EVIDENCE-INDEX; probes cited by open rows are kept.
- R5 tag push fails through the proxy → record the S0 commit hash in `docs/history/README` in S1 and use `<hash>:` pointers; the checker accepts both.
- R6 the brief rewrite drifts a rule → S7 rule map; only A1-only clauses retire.
- R7 budget → S2 and S5 are the largest; split per §12.
- Lead's own work: `Milestone/` + `Design_specs/` deletion is ruling (a); `AGENT_BRIEF.md` is trimmed with every rule kept.
- Open decisions for the Lead: none. Session decisions (§13, recorded in ADR-030 at S0): tag name `pre-t4`, `docs/history/` layout, evidence policy, keep-list rule for probes.