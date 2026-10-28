# SOLARIS — STATE (contract: AGENT_BRIEF.md)

Rulings: `notes/LEDGER.md`. History: `docs/history/SESSIONS.md`; the last full pre-compaction file is `git show 2614334:notes/STATE.md`.

## NEXT ACTION

**NEXT ACTION (session 154 S5):** T4 BUILDING, build 6/9. S5 is DONE: the APPROVAL LEDGER moved verbatim to `notes/LEDGER.md` (98 rows, row diff empty); session history (superseded NEXT ACTION and DONE paragraphs, MILESTONE LEDGER, IN-FLIGHT, ANCHOR, SESSION LOG rows 1–153) is digested in `docs/history/SESSIONS.md` (verbatim: `git show 2614334:notes/STATE.md`); the 1D FPS note is a BACKLOG row in `notes/task.md`. Next: a fresh bot runs S6 in `docs/T4-plan.md` (task.md tracker + CHANGES.md compaction). Gate: from `game/`, `node tools/check-repo-refs.mjs --max 100000` before/after (no NEW dangling; touched files 0). Push: GIT RECIPE below. T5/T6 planners read `docs/T5-T6-ideas.md`. Product goal: AAA browser game (AGENT_BRIEF §13).

## SESSION SETUP

OLU METER: GraphQL `{ olu_usage_aggregate(where:{thread_id:{_eq:"<thread>"}}){ aggregate { sum { olus } } } }`
(field is `olus`) at `$PROMPTQL_PLATFORM_API_URL/v1/graphql`.

COMMIT AUTHOR (Lead, 2026-10-22; APPROVAL LEDGER): every commit is authored as `Md Shehab Sarar <mdshehabsarar@gmail.com>` —
set repo-local `git config user.name/user.email` to it (with `GIT_CONFIG_GLOBAL=/dev/null`) before the first commit.

GIT RECIPE (VM, sessions 58–154): always `export GIT_CONFIG_GLOBAL=/dev/null` and set repo-local `user.name`/`user.email` (COMMIT AUTHOR). Clone/fetch/pull go direct (the repo is public). Push through the GitHub integration proxy (provider `__github`; Lead reconnected it 2026-10-28, session 154): `git -c url."$PROMPTQL_PLATFORM_API_URL/v1/integration/__github/github.com/".insteadOf=https://github.com/ -c http.extraHeader="Authorization: Bearer $PROMPTQL_USER_JWT" -c credential.helper= -c protocol.version=1 push`. Protocol v2 POSTs hang through the proxy; the wiki credential helper returned 401 in sessions 63/67. If the proxy answers 404 "not enabled", ask the Lead to connect GitHub.

## SESSION LOG

| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 153b | 2026-10-28 | T4 S4b (same bot as 153, Lead: run it here) | `docs/history/T1.md` (5970 B: architecture, modules, Q1–Q8 rulings, ADR-027, B1–B13, gates, open items) replaces `pre-t4:docs/T1-plan.md` (185 KB); 13 refs → `pre-t4:`. S4 done. | NEXT: T4 S5 in a fresh bot. |
| 153c | 2026-10-28 | Moon review (same bot; Lead: skip S5 if big) | S5 skipped (too big for the budget left). Read-only review of the Moon for T5/T6 → `docs/T5-T6-ideas.md`. Lead product goal recorded (APPROVAL LEDGER; AGENT_BRIEF §13). | NEXT: T4 S5 in a fresh bot. |
| 154 | 2026-10-28 | T4 S5 (bot 50f382f8, VM v2 2 vCPU/4 GB) | Bootstrap: `t4-repo-cleanup` (2614334) the only branch ahead of `main`; no drift. GitHub integration was not enabled (404 for `__github` and `github`); the Lead reconnected it, both now 200. STATE.md 265 KB → under 10 KB: ledger → `notes/LEDGER.md` verbatim (98 rows, diff empty), history → `docs/history/SESSIONS.md` (one line per task), 1D FPS → task.md BACKLOG; ledger pointers in AGENT_BRIEF/A1.md/T4-plan repointed. | NEXT: T4 S6 in a fresh bot. |
