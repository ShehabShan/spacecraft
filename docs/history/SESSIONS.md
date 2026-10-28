# SESSION HISTORY DIGEST (T4 S5, session 154)

One line per task: sessions · outcome · ADRs. Verbatim session rows, superseded NEXT ACTION paragraphs, the phase-1 MILESTONE LEDGER, IN-FLIGHT and ANCHOR: `git show 2614334:notes/STATE.md` (sessions 1–153c). Binding rulings: `notes/LEDGER.md`. Current pointer: `notes/STATE.md` NEXT ACTION.

## Phase 1 — engine assembly (sessions 1–13, branch `m1-assembly`)
- Scaffold: deps pinned (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); WIP d849d6b.
- 1A APPROVED · df1e04f · gate 5/5, 9 rebases matching the canon trace.
- 1B APPROVED · db13db8 · gate 5/5 + 1A regression (Lead 2026-10-15).
- 1C APPROVED · a86ce94 · gate 4/4 + 1A/1B regression (Lead 2026-10-15).
- 1D APPROVED · e830759 · gate 5/5 + regression; dive frame-rate sensitivity is a BACKLOG row in `notes/task.md`.
- 1E APPROVED · 4c352dd · gate 6/6.
- 1F PARKED · seven gate rounds (sessions 7–13); round 7: 0/429 walks reach ≥2 crossings; ruling pending (option menu `pre-t4:notes/reports/M1F.md` §15.7). F2f rebuilt R1–R5 as `?page=m1fR1`…`m1fR5` (ADR-026); R5 FAIL waived.
- 1G DEFERRED (Lead 2026-10-19, "much later").
- Phase-2 transition (session 14, 2026-10-19): task system installed, brief rewritten; phase-1 anchor 07ae8ad.

## Phase 2 — tasks
- T1 playable moon · sessions 15–46 (plan, B1–B11), paused 2026-10-21 for A1, resumed 143–146b (B11–B13) · DONE, Lead-accepted 2026-10-28, ff-merged into `main` · ADR-027 · digest `docs/history/T1.md`.
- A1 engine audit (read-only) · sessions 47–103 (U01–U27c) · 167 findings, 55 S0/S1 in K1–K9, fix tasks in `docs/audit/U27c-fix-tasks.md`; Lead-accepted 2026-10-26, merged · no ADR · digest `docs/history/A1.md`.
- F1a e2e plumbing · 104 · DONE, ff-merged · ADR-001.
- F1b allocation gate · 105–108 · DONE, ff-merged · ADR-002…ADR-005.
- F2a m1b orbit gate · 109 · DONE, ff-merged · ADR-006.
- F2b m1a precision/rebase/timing gate · 111 · DONE, ff-merged · ADR-007.
- F2c m1c seam gate · 112 · DONE, ff-merged · ADR-008.
- F2d m1d flight gate + tick-time dive deadline · 113 · DONE, ff-merged · ADR-009.
- F2e m1e KCC gate · 114 · DONE, ff-merged · ADR-010.
- F3a catalog scale laws + rotation data · 115–125 (120–121 bootstrap only) · DONE, Lead-confirmed 2026-10-27, ff-merged session 125 · ADR-011…ADR-016.
- F3a-follow-ups · (2) spawn view frames the Earth, session 126 (Lead ruling 126b) · row stays OPEN in the tracker · ADR-017.
- F2f m1f gates R1–R5 rebuilt + R2 bisect · 127–142 · DONE 2026-10-28, ff-merged; shipped m1f rows retired · ADR-018…ADR-026.
- T3 better Moon · 146c–150c · DONE, Lead-accepted 2026-10-28, merged · ADR-028, ADR-029.
- T4 repo cleanup · 150d–156+ (plan 151; S0–S1 151b–151c; S2–S3 152–152c; S4 153–153b; S5 154; S6 155; S7 156) · BUILDING · ADR-030 · plan `docs/T4-plan.md`.
- No-unit rows (Lead rulings, process fixes, reviews): 6, 26, 54, 64b, 65b, 74, 76, 102b, 110, 115b, 121b, 126b, 146b, 150d–150g, 153c (Moon review → `docs/T5-T6-ideas.md`). Their rulings are rows in `notes/LEDGER.md`.
