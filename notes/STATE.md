# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
Execute Milestone 1E per the §8 loop (ORDERED 2026-10-16): read
Milestone/Milestone 1E.txt in full (§1.1 parallel-transport proofs, §1.2
dual step/slope rule RATIFIED, §1.3 Coriolis 1.8 cm theorem, §1.4
spin-interpolated sweep), run `node tools/extract.mjs 1E` (expect 3 blocks:
sphericalFrame, astronautKCC, harness; zero parentheticals), apply F1
(MANDATORY: require-shim → top-level ESM import of terrainNormalInto) and
F13 (PRE-AUTHORIZED: mulberry32 `0x51ope5` → `0x5109e5`; skip + note if
grep finds nothing) AT EXTRACTION TIME, typecheck unpiped, register
?page=m1e, typecheck+build (unpiped exit codes), run the 1E gate (budget
90 s) + full 1A/1B/1C/1D regression (~3 m serial), write
notes/reports/M1E.md (verify steep-field restore of TEST_PLANET
explicitly), commit per cadence, push, STOP at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | APPROVED | Gate GREEN 4/4 + 1A/1B regression 5/5 ("3 passed (1.2m)"); F10a/F10b verified against all four ruling requirements; final commit a86ce94; report: notes/reports/M1C.md; Lead approval 2026-10-15 |
| 1D | APPROVED | Commit e830759; gate GREEN 5/5 + full 1A/1B/1C regression green ("4 passed (1.5m)"); F11/F12 applied as ruled; erratum + standing rule adopted; authorship verified: v@1000m 264.7 matches corrected derivation, locals max 1022.8 matches 1A structural prediction (1022.67), geo 151 = F12-predicted constant count; report: notes/reports/M1D.md; Lead approval 2026-10-16 |
| 1E | IN PROGRESS | Ordered 2026-10-16 (F1 MANDATORY + F13 pre-authorized at extraction); watch: slope-site scan routing, TEST_PLANET restore verification; KCC stays PRISTINE (1G §3.5 patch is 1G's, never now) |
| 1F–1G | NOT STARTED | 1F (F3 + impostorMath purity); 1G (F2 + hand-applied KCC patch + MANDATORY full 1E re-run) |

## IN-FLIGHT
Milestone 1D — COMPLETE through §8 step 6: F11/F12 applied and verified
(probe: geo = 151 from the first tracked frame, never moves; maxDv 10.30 ≤
corrected bound 12; v@1km 264.7); final gate PASSED 5/5 + full 1A/1B/1C
regression green ("4 passed (1.5m)"). Parked at §8.7 approval gate. No open
debugging. Standing rule in force: unpiped exit codes for typecheck/build;
"clean" claims backed by observed exit 0 (all runs in M1D.md comply).
Diagnostic probes kept: game/tools/diag-m1d.mjs (and earlier diag-*).

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
| 2026-10-15 | F10a authorized (authorial self-test normalization; criterion unchanged) |
| 2026-10-15 | F10b authorized (authorial detach race; last-response transfer; zero allocation preserved; main thread unchanged) |
| 2026-10-15 | 145/146 investigation authorized (report-only, no forced counts) — CLOSED: shell permanently frustum-culled (analytic proof, 4.36° margin); 145 true count; authorial miscount |
| 2026-10-15 | MILESTONE 1C: APPROVED (gate GREEN 4/4, regressions green, F10a/F10b verified) |
| 2026-10-15 | Worker-1 idle: OBSERVATION-ONLY — benign load-balancing artifact of canon's w=0-first queue drain; least-in-flight tweak DECLINED under §6 (no failing row); known benign artifact. Geometry-row precedent: rows assert CONSTANCY, never a specific count |
| 2026-10-15 | F11 authorized (bound 8→12 + corrected prose; β_q ratified and vindicated; overshoot prose corrected — g at 3R = 1.09 m/s² < entry drag 3.79) |
| 2026-10-15 | F12 authorized (shell priming completion; expected constant 151; 1C's 145 untouched) |
| 2026-10-15 | Erratum ratified (02b313c "typecheck clean" was false); STANDING RULE adopted: typecheck/build with UNPIPED exit codes; "clean" claims backed by observed exit 0 |
| 2026-10-16 | MILESTONE 1D: APPROVED (gate GREEN 5/5, full 1A/1B/1C regression green, F11/F12 applied as ruled, erratum + standing rule adopted; verified from authorship: v@1000m 264.7 matches the corrected derivation, locals max 1022.8 matches the 1A structural prediction 1022.67, geo 151 is the F12-predicted constant count; commit e830759; report notes/reports/M1D.md) |
| 2026-10-16 | MILESTONE 1E ORDERED: execute per §8 with F1 MANDATORY (require() breaks ESM builds) and F13 PRE-AUTHORIZED (authorial `0x51ope5` invalid hex → `0x5109e5` entire-argument replacement; skip + note if absent); watch items: slope-site scan failure = paste params before touching (authorial calibration question), verify steep-field TEST_PLANET restore, astronautKCC.ts PRISTINE (1G §3.5 patch applied in 1G, never now) |
| 2026-10-16 | Fresh-session bootstrap completed per §10.3 — reconciliation clean (git log/status/filesystem agree with STATE.md; canon byte-identical to ea112ec; only .DS_Store dirty); NEXT ACTION was awaiting this directive's M1D approval — proceeded without further go as instructed |

## SESSION LOG
| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 1 | 2026-10-14 | §9 opening report → scaffold + Milestone 1A | Opening report approved; branch m1-assembly created; game/ scaffolded per §3; extract.mjs written (6/6 blocks 1A); 1A wired, typecheck+build clean, gate PASSED 5/5; report delivered in chat — ended before writing the STATE.md/report files (protocol did not exist yet) | none written — reconciled post-hoc |
| 2 | 2026-10-14 | Protocol install + reconcile | AGENT_BRIEF.md written verbatim (389-line paste + 47-line §10 append); session-1 work preserved as WIP d849d6b; notes/ tree created; CHANGES.md relocated to root; STATE.md written from evidence; M1A report persisted to notes/reports/M1A.md | Session parked at the 1A approval gate — resumed by session 3 |
| 3 | 2026-10-14 | 1A approval + protocol install | approved + installed + pushed | Run the F6 pre-scan over all seven Milestone .txt files (report per file whether the acceptance-line `$` is present), then begin Milestone 1B: read Milestone/Milestone 1B.txt in full, run `node tools/extract.mjs 1B` (expect 5 blocks; the parenthetical overlay on src/core/simulation/SimulationCore.ts explicitly reported — it must be the ONLY parenthetical match), F6 check/repair on the 1B harness, register ?page=m1b, typecheck+build, run the 1B gate PLUS the 1A page as regression, write notes/reports/M1B.md with verbatim gate output and the pre-scan table, commit per the amended cadence, push, then STOP at the approval gate. |
| 4 | 2026-10-14/15 | M1B execution | (continuation — session resumed after wind-down in the same live session) Pre-scan done (1C verdict missing → F8); extraction 5/5 + overlay, invariant held; F7a/F7b per ruling → typecheck/build clean; 1A regression green; 1B deadlock diagnosed to canon auto-run guard → F9 authorized + applied; 1C-CP persisted; BOTH gates green ("2 passed (9.5s)") | M1B parked at the approval gate — next: Lead approval of notes/reports/M1B.md, then 1C (extract 6 blocks, F5 + 1C-CP at extraction, workers check, gate + regression, report) |
| 5 | 2026-10-16 | M1D approval + M1E execution | Fresh-session bootstrap per §10.3 clean (canon = ea112ec, evidence matches STATE.md); M1D APPROVED + 1E ordered recorded in ledgers before any 1E work; 1E execution per §8 loop (outcome in next handoff) | (pending — will be written at wind-down) |

## ANCHOR
df1e04f — "M1A: extracted, gates green" (branch m1-assembly; chain: ea112ec
canon → d849d6b WIP preservation → 2e409c0 protocol install → df1e04f M1A
approval). This wind-down STATE.md travels in the commit AFTER df1e04f (a
file cannot contain its own commit hash); resolve the exact carrier with
`git log -1 --format=%H -- notes/STATE.md`. Canon (Design_specs/,
Milestone/) must remain unchanged from ea112ec — verified: git diff ea112ec
on both trees is empty.
