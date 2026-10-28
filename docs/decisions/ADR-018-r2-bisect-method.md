# ADR-018 — How the m1f R2 regression is bisected (F2fa)

**Status:** accepted (session 127, 2026-10-27). The Lead's directive naming 1F for F2f is recorded in the APPROVAL LEDGER (session 115b).

## Context
A1-U01-1: R2 (Sun ground-truth footprint) has failed in every recorded m1f run since commit `3057899` ("F-01..F-12 batch"). That commit was a candidate, not a proven cause. Its parent is `c0ae8bf`. Both commits ship the same `102a5b8:game/e2e/m1f.spec.ts`. That spec waits 240 s for `[Milestone1F] acceptance PASSED|FAILED`. On the bot VM's headless Chrome, which renders in software at 3–10 fps, `c0ae8bf` takes 262 s to reach a verdict. The shipped spec therefore times out there with no verdict, and cannot answer the bisect question.

## Options
- (a) Edit the spec's budget in each worktree. Rejected: the test would no longer be the unedited historical gate. Edits to 1F rows also need care under §8, and the directive covers new gates as new files.
- (b) Run each commit's unedited page under a separate read-only observer with a longer verdict wait. Chosen.
- (c) Attribute directly to F-12 by reverting its hunk. Deferred: that is hunk-level attribution inside the batch, a separate unit (F2fb).

## Decision
- New `game/tools/audit/f2fa-m1f-observe.mjs` does the following. It runs `vite build` and `vite preview` in a commit's own git worktree. It opens `?page=m1f` in headless Chrome using the same channel and headless mode as the shipped `playwright.config.ts`. It waits up to 1200 s for the acceptance line, then records the badges and every row detail. It edits nothing in the worktree.
- Driver scripts: `pre-t4:game/tools/audit/f2fa-observe-both.sh` (parent, then candidate) and `pre-t4:game/tools/audit/f2fa-r2-bisect.sh` (the shipped spec at both commits). Evidence: `pre-t4:docs/audit/evidence/F2f/a/`.
- A commit counts as "good" for R2 only if its own unedited harness renders the R2 badge PASS. The whole-suite verdict does not decide this, because R5 fails at both commits and stays under the waiver.

## Consequence
The bisect is commit-level only. It cannot say which of F-01..F-12 inside `3057899` breaks R2. That attribution is F2fb.