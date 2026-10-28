# ADR-030 — T4: repo layout, `pre-t4` history pointer, evidence policy

Status: accepted (session 151) · Task: T4 S0 · Authority: §13 (technical decision); Lead directive 2026-10-28 (session 150d) and ruling (a) (session 150e)

## Context
At bb73503 the tracked tree is 11.44 MB / 1,531 files. About 8 MB is finished-task history: raw evidence (`pre-t4:docs/audit/evidence/`, 5.93 MB, 713 logs and 73 `playwright.json` dumps of up to 410 KB), A1 unit reports, DONE plans, phase-1 canon (`pre-t4:Milestone/`, `pre-t4:Design_specs/`) and phase-1 reports. Only AI sessions read the repo, and bootstrap reading costs OLU (§1 LEAN READ). T4 removes this history from the tree without rewriting git history. Live files then must not point at paths that no longer exist.

## Options
1. Delete and rely on commit hashes in prose. Pointers are hard to find and easy to get wrong.
2. Move history to a separate branch. This adds a second line to keep in sync, and branch tips move.
3. An annotated tag `pre-t4` on the last commit before any deletion, `pre-t4:<path>` pointers, and a gate that fails on dangling paths (chosen).

## Decision
- Tag `pre-t4` (annotated) marks the T4 S0 commit, which is the last tree that holds all history. Read a removed file with `git show pre-t4:<path>`. The tag is never moved or deleted.
- A reference to a removed path is written `pre-t4:<path>`, or `<hash>:<path>` if the tag is unavailable. Placeholders (`docs/<task>-plan.md`) and globs are not paths.
- Gate `game/tools/check-repo-refs.mjs` scans the tracked md/ts/tsx/mjs/js/sh/json/py files (not the lockfile) for `docs/`, `notes/`, `game/`, `pre-t4:Milestone/` and `pre-t4:Design_specs/` tokens, including `../` forms. It exits 1 on any token that matches no tracked file, directory or file-name prefix and is not a pointer. Its `--self-test` covers 15 cases.
- Layout after T4: `docs/history/` holds the digests (A1.md, T1.md, SESSIONS.md, EVIDENCE-INDEX.md); `notes/LEDGER.md` holds the APPROVAL LEDGER verbatim; `docs/evidence/<task>/` holds new evidence.
- Evidence policy, from T4 on: commit one summary of at most 5 KB per step (commands, exit codes, key numbers). Never commit raw `playwright.json`, bulk logs or screenshots unless a ruling needs one image.

## Why
The tag is immutable and needs no upkeep. One pointer form can be grepped and machine-checked. The gate turns "no dangling reference" from a promise into an exit code, and it lands before the first deletion (§13 safeguard 3).

## Consequences
- The baseline at S0 is red: 48 dangling tokens after the self-skip fix (`--summary` per area in the S0 and S0-fix commit messages; the S0 commit itself also counted the gate's own 11 self-test fixtures). The T4 plan and this ADR name paths that S1–S5 create (`docs/history/`, `notes/LEDGER.md`), so they count until then. Most are in files that later T4 steps delete or compact, and the rest are rewritten. S8 requires 0 over the whole tree, and every later commit runs the gate.
- Prefix matching accepts stems such as `docs/decisions/ADR-015`, so a dangling stem that happens to prefix a real file passes. This is accepted, because a false pass on a stem that names a real file is harmless.
- Untracked files (for example `node_modules`) count only when present on disk.