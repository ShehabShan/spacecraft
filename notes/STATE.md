# SOLARIS — STATE (contract: AGENT_BRIEF.md)

Rulings: `notes/LEDGER.md`. History: `docs/history/SESSIONS.md`; the last full pre-compaction file is `git show 2614334:notes/STATE.md`.

## NEXT ACTION

**NEXT ACTION (session 156 S7):** T4 BUILDING, build 8/9. S7 is DONE: `AGENT_BRIEF.md` 21035 → 12138 B, trimmed to the T4 layout (§1 reading order folds in LEAN READ; §2 file map; §6 REF CHECK + EVIDENCE per ADR-030; §10 one line per amendment; §11 AUDIT MODE and the A1-only clauses retired; rule map in the S7 commit message). Next: a fresh bot runs S8 in `docs/T4-plan.md` (close-out): checker 0 over the whole tree (the 3 dangling today are the S8 forward refs in `docs/T4-plan.md`), full §13 matrix green (fresh VM: `npm ci` + `npx playwright install chromium` in `game/`), before/after size table, the S8 evidence summary named in the plan (≤ 5 KB), then fast-forward `t4-repo-cleanup` into `main` and push (§6 push authority); NEXT ACTION → T5 plan. Push: GIT RECIPE below. T5/T6 planners read `docs/T5-T6-ideas.md`. ORDER after T4 (Lead, `notes/LEDGER.md` 2026-10-28): T5 → T6 → F3b. Product goal: AAA browser game (AGENT_BRIEF §13).

## SESSION SETUP

OLU METER: GraphQL `{ olu_usage_aggregate(where:{thread_id:{_eq:"<thread>"}}){ aggregate { sum { olus } } } }`
(field is `olus`) at `$PROMPTQL_PLATFORM_API_URL/v1/graphql`.

COMMIT AUTHOR (Lead, 2026-10-22; APPROVAL LEDGER): every commit is authored as `Md Shehab Sarar <mdshehabsarar@gmail.com>` —
set repo-local `git config user.name/user.email` to it (with `GIT_CONFIG_GLOBAL=/dev/null`) before the first commit.

GIT RECIPE (VM, sessions 58–154): always `export GIT_CONFIG_GLOBAL=/dev/null` and set repo-local `user.name`/`user.email` (COMMIT AUTHOR). Clone/fetch/pull go direct (the repo is public). Push through the GitHub integration proxy (provider `__github`; Lead reconnected it 2026-10-28, session 154): `git -c url."$PROMPTQL_PLATFORM_API_URL/v1/integration/__github/github.com/".insteadOf=https://github.com/ -c http.extraHeader="Authorization: Bearer $PROMPTQL_USER_JWT" -c credential.helper= -c protocol.version=1 push`. Protocol v2 POSTs hang through the proxy; the wiki credential helper returned 401 in sessions 63/67. If the proxy answers 404 "not enabled", ask the Lead to connect GitHub.

## SESSION LOG

| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 154 | 2026-10-28 | T4 S5 (bot 50f382f8, VM v2 2 vCPU/4 GB) | Bootstrap: `t4-repo-cleanup` (2614334) the only branch ahead of `main`; no drift. GitHub integration was not enabled (404 for `__github` and `github`); the Lead reconnected it, both now 200. STATE.md 265 KB → under 10 KB: ledger → `notes/LEDGER.md` verbatim (98 rows, diff empty), history → `docs/history/SESSIONS.md` (one line per task), 1D FPS → task.md BACKLOG; ledger pointers in AGENT_BRIEF/A1.md/T4-plan repointed. | NEXT: T4 S6 in a fresh bot. |
| 155 | 2026-10-28 | T4 S6 (bot 50f382f8, same VM; Lead: run it here) | `notes/task.md` 53825 → 11747 B, `notes/CHANGES.md` 125513 → 5854 B (21 digest lines). Open rows, T2 def, PARKED/BACKLOG, schema and resume byte-identical; tracker ids identical; checker: touched 0, tree 3 (S8 forward refs); tsc + build 0. Commits 878920e + process-file follow-up. | NEXT: T4 S7 (brief) in a fresh bot. |
| 156 | 2026-10-28 | T4 S7 (bot 76a23ebc, VM v2 2 vCPU/4 GB) | Bootstrap: `t4-repo-cleanup` (bb9637d) the only branch ahead of `main`; no drift. GitHub integration was not enabled (404); the Lead connected it, proxy 200. `AGENT_BRIEF.md` 21035 → 12138 B; rule map in the S7 commit; `notes/task.md` resume step 1 no longer names §11; checker: touched 0, tree 3 (S8 forward refs). | NEXT: T4 S8 close-out in a fresh bot. |
