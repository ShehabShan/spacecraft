# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
BLOCKED awaiting Lead rulings F10a + F10b (full diagnosis in
notes/reports/M1C.md): (F10a) 1C harness self-test compares unit spherify
outputs against RAW non-unit corner inputs → roundtripErr 4.226e-1 = 1−1/√3;
the inverse itself is exact (1.1e-13 on unit inputs); proposal: normalize
the comparison target (harness-only). (F10b) terrainWorker.ts req handler
transfers the request array home on the FIRST chunk response while still
reading it for batch entries 2..n → detached reads → undefined params →
requests silently lost → stranded pendings (140) → pool exhaustion → LOD
collapse (active 24→2) → parentVerts=0; proposal: ride the array on the
LAST response (~3 worker lines; main thread already position-agnostic).
On authorization: apply, typecheck+build, re-run 1C gate + full 1A/1B
regression, complete M1C.md, commit, push, STOP at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | EXTRACTED · GATE RUN · BLOCKED (2 canon defects → F10a/F10b) | 6/6 verbatim, no parentheticals; 1C-CP ITEM 2→1 + F5 applied, typecheck clean (2cd69a1); worker chunk bundled; gate: geo/dispose/heap PASS, seamless FAIL — diagnosed: F10a (self-test unit-compare, Node-proven 4.226e-1=1−1/√3) + F10b (worker req-array detach race, protocol-traced); 1A/1B regression GREEN; report: notes/reports/M1C.md |

## IN-FLIGHT
Milestone 1C / gate run — FAILED on the seamless row; diagnosed to root
cause, routed (F10a/F10b). Symptom chain: roundtripErr 4.2e-1 (Node repro:
only the 4 raw corners fail — self-test compares unit outputs against
non-unit inputs); parentVerts=0 (protocol trace: worker0 got all 117 reqs,
batches n=1–3, dispatch stops with 140 pending / inflight 0; worker req
handler transfers `a.buffer` on the first response then reads the detached
array for entries 2..n). Healthy: geo constant 145, dispose/remove 0,
allocs frozen 576, heap 0 B/frame, nrmMismatch 0, maxPosDev 2.0e-5, 1A/1B
regression green. Nothing tried beyond diagnosis; probes kept in
game/tools/diag-*.mjs for fix verification.

## APPROVAL LEDGER (settled — never re-ask)
| Date | Decision |
|------|----------|
| 2026-10-14 | Opening report approved in full (structure, pins, gates, branch strategy) |
| 2026-10-14 | §4 regex relaxation approved (exactly one parenthetical match: 1B SimulationCore) |
| 2026-10-14 | Ordered: branch m1-assembly, scaffold per §3, begin Milestone 1A |
| 2026-10-14 | Multi-session continuity protocol installed per Lead directive |
| 2026-10-14 | MILESTONE 1A: APPROVED (gate GREEN, 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits) |
| 2026-10-14 | Protocol install ratified: §10 append, STATE.md structure, anchor fixed-point convention (anchor = stable work commit; carrier commit via `git log -1 --format=%H -- notes/STATE.md`), CHANGES.md relocation to root notes/ |
| 2026-10-14 | Pre-authorized fix F6 ratified (scope: ONLY each harness's acceptance-verdict console.log; insert missing `$`; FORBIDDEN: badge detail strings, HUD strings, CSS template literals; any other difference → STOP and paste exact extracted source; logged in AGENT_BRIEF.md §10.4) |
| 2026-10-14 | Commit & push policy amended (§8.8): commit after every §8 loop step + every §10.2 checkpoint + wind-down; push m1-assembly to origin PRE-AUTHORIZED after every commit; never push main, never force-push, never stage canon (logged in AGENT_BRIEF.md §10.4) |
| 2026-10-14 | 1B pre-scan ordered as step 0 of the next session: read-only grep of all seven Milestone .txt files for the acceptance console lines, reporting per file whether the `$` is present |
| 2026-10-14 | F7 RATIFIED: 1B defects are canon authorship errors; F7a/F7b applied to extracted harness (canon patched by the Lead); systemic pre-scan rule added (backtick+`{`, single-armed ternary → route, never F6-repair) |
| 2026-10-14 | F8 ISSUED: 1C verdict = canon truncation; Lead will author 1C-CP addendum; assembler supplies verbatim 1C harness tail; 1C gated until it lands |
| 2026-10-15 | F9 authorized (original-author confirmed): authorial canon defect, 1B-only, 1C–1G verified unaffected; single-line deletion of `publishSuite({ started: true })`; acceptance-neutral |
| 2026-10-15 | 1C-CP addendum delivered (ITEM 1 verdict-line replacement with application rule; ITEM 2 `seamless'` quote restoration); persisted at notes/patches/1C-CP.md; apply at 1C extraction time |
| 2026-10-15 | Standing damage protocol: families (A) $-stripping, (B) object-key quote loss; every NEW instance in any milestone = stop-and-route; no blanket pre-authorization beyond F6, F7, 1C-CP ITEM 1/2 |
| 2026-10-15 | MILESTONE 1B: APPROVED (gate GREEN, 5/5 PASS, 21.5 ms synchronous suite, 1A regression green inline + as a page on the overlaid core); deferred verdict-stat restoration stays parked |
| 2026-10-15 | MILESTONE 1C ORDERED: execute per §8 with 1C-CP ITEM 2 → ITEM 1 → F5 applied at extraction time (typecheck immediately after); worker-pipeline verification FIRST on any stall; budget 150 s + full 1A/1B regression |

## SESSION LOG
| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 1 | 2026-10-14 | §9 opening report → scaffold + Milestone 1A | Opening report approved; branch m1-assembly created; game/ scaffolded per §3; extract.mjs written (6/6 blocks 1A); 1A wired, typecheck+build clean, gate PASSED 5/5; report delivered in chat — ended before writing the STATE.md/report files (protocol did not exist yet) | none written — reconciled post-hoc |
| 2 | 2026-10-14 | Protocol install + reconcile | AGENT_BRIEF.md written verbatim (389-line paste + 47-line §10 append); session-1 work preserved as WIP d849d6b; notes/ tree created; CHANGES.md relocated to root; STATE.md written from evidence; M1A report persisted to notes/reports/M1A.md | Session parked at the 1A approval gate — resumed by session 3 |
| 3 | 2026-10-14 | 1A approval + protocol install | approved + installed + pushed | Run the F6 pre-scan over all seven Milestone .txt files (report per file whether the acceptance-line `$` is present), then begin Milestone 1B: read Milestone/Milestone 1B.txt in full, run `node tools/extract.mjs 1B` (expect 5 blocks; the parenthetical overlay on src/core/simulation/SimulationCore.ts explicitly reported — it must be the ONLY parenthetical match), F6 check/repair on the 1B harness, register ?page=m1b, typecheck+build, run the 1B gate PLUS the 1A page as regression, write notes/reports/M1B.md with verbatim gate output and the pre-scan table, commit per the amended cadence, push, then STOP at the approval gate. |
| 4 | 2026-10-14/15 | M1B execution | (continuation — session resumed after wind-down in the same live session) Pre-scan done (1C verdict missing → F8); extraction 5/5 + overlay, invariant held; F7a/F7b per ruling → typecheck/build clean; 1A regression green; 1B deadlock diagnosed to canon auto-run guard → F9 authorized + applied; 1C-CP persisted; BOTH gates green ("2 passed (9.5s)") | M1B parked at the approval gate — next: Lead approval of notes/reports/M1B.md, then 1C (extract 6 blocks, F5 + 1C-CP at extraction, workers check, gate + regression, report) |

## ANCHOR
df1e04f — "M1A: extracted, gates green" (branch m1-assembly; chain: ea112ec
canon → d849d6b WIP preservation → 2e409c0 protocol install → df1e04f M1A
approval). This wind-down STATE.md travels in the commit AFTER df1e04f (a
file cannot contain its own commit hash); resolve the exact carrier with
`git log -1 --format=%H -- notes/STATE.md`. Canon (Design_specs/,
Milestone/) must remain unchanged from ea112ec — verified: git diff ea112ec
on both trees is empty.
