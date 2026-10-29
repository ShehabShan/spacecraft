# SOLARIS — STATE (contract: AGENT_BRIEF.md)

Rulings: `notes/LEDGER.md`. History: `docs/history/SESSIONS.md`; the last full pre-compaction file is `git show 2614334:notes/STATE.md`.

## NEXT ACTION

**NEXT ACTION (session 157):** T5 PLAN stage on `t5-bigger-moon`, plan file `docs/T5-plan.md` IN PROGRESS (4/7). Done: Goal, Scope IN, Scope OUT, Affected modules; ADR-031 folds F5a–F5d into T5 as its first build steps (order F5a → F5b → F5d → F5c). Next: a fresh bot drafts the plan's first unchecked boxes, Steps and Verification per step (ordered §12-sized steps: F5a, F5b, lazy LOD + F5d leaf budget, metre crater ladder, GPU precision gate, R = 1,737 km + spawn + re-pins + F5c at final R; each with command + expected evidence), then Risks & open decisions. LEAD GATE at plan READY; build only on the Lead's "execute the T5 plan". ORDER (Lead, `notes/LEDGER.md` 2026-10-28): T5 → T6 → F3b. Push: GIT RECIPE below. Product goal: AAA browser game (AGENT_BRIEF §13).

## SESSION SETUP

OLU METER: GraphQL `{ olu_usage_aggregate(where:{thread_id:{_eq:"<thread>"}}){ aggregate { sum { olus } } } }`
(field is `olus`) at `$PROMPTQL_PLATFORM_API_URL/v1/graphql`.

COMMIT AUTHOR (Lead, 2026-10-22; APPROVAL LEDGER): every commit is authored as `Md Shehab Sarar <mdshehabsarar@gmail.com>` —
set repo-local `git config user.name/user.email` to it (with `GIT_CONFIG_GLOBAL=/dev/null`) before the first commit.

GIT RECIPE (VM, sessions 58–154): always `export GIT_CONFIG_GLOBAL=/dev/null` and set repo-local `user.name`/`user.email` (COMMIT AUTHOR). Clone/fetch/pull go direct (the repo is public). Push through the GitHub integration proxy (provider `__github`; Lead reconnected it 2026-10-28, session 154): `git -c url."$PROMPTQL_PLATFORM_API_URL/v1/integration/__github/github.com/".insteadOf=https://github.com/ -c http.extraHeader="Authorization: Bearer $PROMPTQL_USER_JWT" -c credential.helper= -c protocol.version=1 push`. Protocol v2 POSTs hang through the proxy; the wiki credential helper returned 401 in sessions 63/67. If the proxy answers 404 "not enabled", ask the Lead to connect GitHub. The push POST (`git-receive-pack`) waits up to 5 min for the Lead's approval in PromptQL unless an approval rule matches: add `-c http.extraHeader="X-PromptQL-Description: <one line>"`, wrap the push in `timeout 380`, and tell the Lead to approve (session 157).

## SESSION LOG

| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 156 | 2026-10-28 | T4 S7 (bot 76a23ebc, VM v2 2 vCPU/4 GB) | Bootstrap: `t4-repo-cleanup` (bb9637d) the only branch ahead of `main`; no drift. GitHub integration was not enabled (404); the Lead connected it, proxy 200. `AGENT_BRIEF.md` 21035 → 12138 B; rule map in the S7 commit; `notes/task.md` resume step 1 no longer names §11; checker: touched 0, tree 3 (S8 forward refs). | NEXT: T4 S8 close-out in a fresh bot. |
| 156b | 2026-10-28 | T4 S8 (same bot 76a23ebc; Lead: run it here) | Matrix green on 80b2161 (plain alloc-gate red as ADR-002 expects; `--self-test` 8/8); m1f-r 5 passed, R5 waived; checker 0; T4 fast-forwarded into `main`. Kill a stale `vite preview` on :4173 by port, never `pkill -f` (it kills the calling shell). | NEXT: T5 plan in a fresh bot. |
| 156c | 2026-10-28 | T5/T6 inputs polish (same bot 76a23ebc; Lead: "polish them" before T5/T6 planning) | Cut `t5-bigger-moon` from `main`. `docs/T5-T6-ideas.md` re-checked on 787b9d4 and extended: §0 F5a–F5d prerequisites, float32 and gate re-pin rows, sound, character, §5 open questions with defaults. T5/T6 definitions added to `notes/task.md`. Docs only. | NEXT: T5 plan in a fresh bot. |
| 157 | 2026-10-29 | T5 PLAN, first planning commit (bot a8dc4a95, VM v2 2 vCPU/4 GB) | Bootstrap: `t5-bigger-moon` (a659942) the only branch ahead of `main`; no drift. GitHub integration 404 at start; the Lead connected it, proxy 200. Created `docs/T5-plan.md` (header, checklist, Goal, Scope IN, Scope OUT, Affected modules) and ADR-031 (fold F5a–F5d into T5). Docs only. Play Moon does not import `scaleLaw.ts`; the worker already writes Float32 chunk-local positions against a Float64 origin. Push of 4724c26 hung until the Lead approved it in PromptQL; GIT RECIPE updated. | NEXT: T5 plan Steps + Verification in a fresh bot. |
