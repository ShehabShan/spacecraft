# SOLARIS — STATE (contract: AGENT_BRIEF.md)

Rulings: `notes/LEDGER.md`. History: `docs/history/SESSIONS.md`; the last full pre-compaction file is `git show 2614334:notes/STATE.md`.

## NEXT ACTION

**NEXT ACTION (session 155 S6):** T4 BUILDING, build 7/9. S6 is DONE: the `notes/task.md` tracker has one ≤ 200-char row per DONE task, and the DONE definitions (A1, T1, T3) are out (verbatim: `git show pre-t4:notes/task.md`). The pre-T4 entries in `notes/CHANGES.md` are now one digest line per task or milestone (verbatim: `git show pre-t4:notes/CHANGES.md`); new entries are appended under "## Entries". Next: a fresh bot runs S7 in `docs/T4-plan.md` (the AGENT_BRIEF.md trim; the CHANGES.md header points at §2 for the format). Gate: from `game/`, `node tools/check-repo-refs.mjs --max 100000` before and after (no NEW dangling; touched files 0). Push: GIT RECIPE below. T5/T6 planners read `docs/T5-T6-ideas.md`. Product goal: AAA browser game (AGENT_BRIEF §13).

## SESSION SETUP

OLU METER: GraphQL `{ olu_usage_aggregate(where:{thread_id:{_eq:"<thread>"}}){ aggregate { sum { olus } } } }`
(field is `olus`) at `$PROMPTQL_PLATFORM_API_URL/v1/graphql`.

COMMIT AUTHOR (Lead, 2026-10-22; APPROVAL LEDGER): every commit is authored as `Md Shehab Sarar <mdshehabsarar@gmail.com>` —
set repo-local `git config user.name/user.email` to it (with `GIT_CONFIG_GLOBAL=/dev/null`) before the first commit.

GIT RECIPE (VM, sessions 58–154): always `export GIT_CONFIG_GLOBAL=/dev/null` and set repo-local `user.name`/`user.email` (COMMIT AUTHOR). Clone/fetch/pull go direct (the repo is public). Push through the GitHub integration proxy (provider `__github`; Lead reconnected it 2026-10-28, session 154): `git -c url."$PROMPTQL_PLATFORM_API_URL/v1/integration/__github/github.com/".insteadOf=https://github.com/ -c http.extraHeader="Authorization: Bearer $PROMPTQL_USER_JWT" -c credential.helper= -c protocol.version=1 push`. Protocol v2 POSTs hang through the proxy; the wiki credential helper returned 401 in sessions 63/67. If the proxy answers 404 "not enabled", ask the Lead to connect GitHub.

## SESSION LOG

| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 153c | 2026-10-28 | Moon review (same bot; Lead: skip S5 if big) | S5 skipped (too big for the budget left). Read-only review of the Moon for T5/T6 → `docs/T5-T6-ideas.md`. Lead product goal recorded (APPROVAL LEDGER; AGENT_BRIEF §13). | NEXT: T4 S5 in a fresh bot. |
| 154 | 2026-10-28 | T4 S5 (bot 50f382f8, VM v2 2 vCPU/4 GB) | Bootstrap: `t4-repo-cleanup` (2614334) the only branch ahead of `main`; no drift. GitHub integration was not enabled (404 for `__github` and `github`); the Lead reconnected it, both now 200. STATE.md 265 KB → under 10 KB: ledger → `notes/LEDGER.md` verbatim (98 rows, diff empty), history → `docs/history/SESSIONS.md` (one line per task), 1D FPS → task.md BACKLOG; ledger pointers in AGENT_BRIEF/A1.md/T4-plan repointed. | NEXT: T4 S6 in a fresh bot. |
| 155 | 2026-10-28 | T4 S6 (bot 50f382f8, same VM; Lead: run it here) | `notes/task.md` 53825 → 11747 B, `notes/CHANGES.md` 125513 → 5854 B (21 digest lines). Open rows, T2 def, PARKED/BACKLOG, schema and resume byte-identical; tracker ids identical; checker: touched 0, tree 3 (S8 forward refs); tsc + build 0. Commits 878920e + process-file follow-up. | NEXT: T4 S7 (brief) in a fresh bot. |
