# Change log — see AGENT_BRIEF.md §2 for format

One entry per change: date · task · file · what · why · evidence · source. APPEND new entries at the end of "Entries".
Entries before T4 are digested one line per task/milestone (T4 S6); verbatim entries: `git show pre-t4:notes/CHANGES.md` (or `git show 0dc7867:notes/CHANGES.md`).

---

## Pre-T4 digest (date · task · what · entry count · ADRs)

- 2026-10-14 · scaffold · Vite + React + R3F project scaffold, pinned deps (react 18.2.0, three 0.165.0, R3F 8.18.0, TS ~5.4, vite 5.4.21) · 6 entries · no ADR
- 2026-10-14…10-15 · protocol · multi-session protocol install; state carriers moved to repo-root `notes/` · 8 entries · no ADR
- 2026-10-14 · 1A · milestone 1A extraction (APPROVED, gate 5/5) · 1 entry · no ADR
- 2026-10-14…10-15 · 1B · milestone 1B extraction + F7/F9 fixes (APPROVED) · 6 entries · no ADR
- 2026-10-14…10-15 · 1C · milestone 1C extraction + ruled patches (APPROVED) · 6 entries · no ADR
- 2026-10-15…10-17 · 1D · milestone 1D extraction + F4 (APPROVED) · 7 entries · no ADR
- 2026-10-16 · 1E · milestone 1E extraction + F14–F17 (APPROVED) · 9 entries · no ADR
- 2026-10-16…10-19 · 1F · milestone 1F gate rounds 1–7 (PARKED, ruling pending) · 33 entries · no ADR
- 2026-10-20…10-28 · T1 · playable Moon page B1–B13 (DONE) · 23 entries · ADR-027
- 2026-10-26 · F1a · e2e gate plumbing · 1 entry · ADR-001
- 2026-10-26 · F1b · allocation gate · 4 entries · ADR-002…005
- 2026-10-26 · F2a · independent m1b orbit gate · 1 entry · ADR-006
- 2026-10-26 · F2b · independent m1a precision/rebase/timing gate · 1 entry · ADR-001, ADR-007
- 2026-10-26 · F2c · independent m1c seam gate · 1 entry · ADR-008
- 2026-10-26 · F2d · independent m1d flight gate · 1 entry · ADR-009
- 2026-10-26 · F2e · independent m1e KCC gate · 1 entry · ADR-010
- 2026-10-26…10-27 · F3a · real body data, rail validation, spin + scale laws · 7 entries · ADR-011…016
- 2026-10-27 · F3a-follow-ups · (2) spawn view frames the Earth · 1 entry · ADR-017
- 2026-10-27…10-28 · F2f · R2 bisect + rebuilt m1f gates R1–R5 (`?page=m1fR1`…`m1fR5`) · 17 entries · ADR-018…026
- 2026-10-28 · T3 · opt-in Moon terrain profile, material, close-out (DONE) · 6 entries · ADR-028…029
- 2026-10-28 · brief rulings · AGENT_BRIEF §1 LEAN READ, §6 END REPORT, §12 OLU use (docs only) · 3 entries · no ADR

---

## Entries

- 2026-10-28 · T4 (S0, session 151) · `game/tools/check-repo-refs.mjs` (new), `docs/decisions/ADR-030-repo-layout-history-pointer.md` (new) · dangling repo-path gate with `--self-test`; tag `pre-t4` anchors all pre-cleanup history · why: plan S0, the gate lands before any deletion · evidence: S0 commit message · source: ADR-030
- 2026-10-28 · T4 (S1, session 151) · removed `pre-t4:Milestone/`, `pre-t4:Design_specs/`, `notes/{reports,patches,archive}/`, `.DS_Store`, `pre-t4:game/tools/extract.mjs`, `game/tools/audit/u10{a,b}-*.mjs`, `u12-orbits-catalog.mjs`; comment path in `game/src/test/Milestone1F_TestHarness.tsx` · phase-1 history out of the tree, references rewritten to `pre-t4:<path>` · why: plan S1, Lead ruling (a) · evidence: S1 commit message · source: ADR-030
- 2026-10-28 · T4 (S2, session 152) · removed `pre-t4:docs/audit/evidence/`, `pre-t4:docs/audit/U*-evidence/`, `pre-t4:docs/audit/U*-probe-output.txt`; moved the T3 S2 basins generator to `game/tools/gen-moon-basins.mjs` (import paths only) and the U01 gate log to `game/tools/audit/u01-gate-run1.log`; comment path in `game/src/play/world/moonConfig.ts`; readers in `u03-r3r4r5-validity.mjs`, `u27b3b2a-r3-recheck.mjs`, `u27b3a-k2b-recheck.mjs` (tmpdir default), `u27-k2d-verify-sun.py` (argv path), runner output dirs → `$EVID` or `/tmp/evidence` · why: plan S2, ADR-030 evidence policy · evidence: `docs/history/EVIDENCE-INDEX.md`, S2 commit message · source: ADR-030
- 2026-10-28 · T4 (S3a, session 152b) · removed 75 files from `game/tools/audit/` and `game/tools/` (uncited A1 probes, `*-regress.sh` runners, phase-1 `diag-*`, a stray `.pyc`); `.gitignore` += `__pycache__/` · why: plan S3, keep only tools a kept doc or gate names · evidence: `docs/history/EVIDENCE-INDEX.md` §Tools, S3a commit message · source: ADR-030
- 2026-10-28 · T4 (S3b, session 152c) · no code change · kept-probe run table in `docs/history/EVIDENCE-INDEX.md` §Tools; ADR-018 runner names → `pre-t4:` pointers · why: plan S3 verification · evidence: S3b commit message · source: ADR-030
- 2026-10-28 · T4 (S5, session 154) · `notes/STATE.md` (264906 B → current NEXT ACTION, SESSION SETUP with OLU METER / COMMIT AUTHOR / one GIT RECIPE, last 3 SESSION LOG rows) · `notes/LEDGER.md` (new; APPROVAL LEDGER verbatim, 98 rows) · `docs/history/SESSIONS.md` (new; one line per task) · `notes/task.md` (BACKLOG row for the 1D FPS note; T4 row 6/9) · ledger pointers in `AGENT_BRIEF.md` §0/§5/§6, `docs/history/A1.md`, `docs/T4-plan.md` · why: T4 S5, AI sessions read STATE.md every bootstrap · evidence: ledger row diff empty, checker no new dangling · source: `docs/T4-plan.md` S5.
- 2026-10-28 · T4 (S6, session 155) · `notes/task.md` (53825 B → 11747 B), `notes/CHANGES.md` (125513 B → 5854 B) · tracker: one ≤200-char row per DONE task (status · merge · ADRs · gate), open rows (F3a-follow-ups, T2, T4, T5, T6) unchanged except T4 progress; DONE definitions (A1, T1, T3) out, T2 definition, PLAN FILE SCHEMA and resume procedure kept; CHANGES.md: every pre-T4 entry → one digest line per task/milestone · why: plan S6 (AI-oriented compaction, ADR-030) · evidence: tracker task ids identical to `0dc7867:notes/task.md`; every pre-T4 task id has a digest line; checker 0 on touched files; tsc + build exit 0 · source: Lead execute order 2026-10-28
