# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
Await Lead rulings on the four routed 1E defects (notes/reports/M1E.md —
GATE FAILED 4 rows, zero-gc + integration PASS, full 1A/1B/1C/1D regression
green): F14-proposal DEAD JUMP (canon integrateTick consumes input.jump at
canon 812 / extracted astronautKCC 467 BEFORE _groundedTick reads it at
canon 932 / extracted 587 — relocate the one line after the mode dispatch),
F15-proposal vehicle-verify offset (harness check composes the WORLD offset
(0,2,0) as parent-frame; KCC's R_att⁻¹ compose is correct — fix the check,
~2 lines), F16-proposal face-walk calibration (faceChanges 1 < 2 — pathLen
budget eaten by unrestricted climbing; up-rotation 2.145° > 1.15°) + the
deg() double-acos detail bug, F17-proposal slope-step calibration
(moderate slide 5.275 > 0.05, steep displacement ratio 0.00 + uphill net
2.13 > 0.3, cliff minAGL −0.091 < −0.05) + stale-alt0 fix, plus the routed
family-A $-strip (extracted harness 1015). On rulings: apply, re-run the
1E gate + full regression, update M1E.md, re-present at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | APPROVED | Gate GREEN 4/4 + 1A/1B regression 5/5 ("3 passed (1.2m)"); F10a/F10b verified against all four ruling requirements; final commit a86ce94; report: notes/reports/M1C.md; Lead approval 2026-10-15 |
| 1D | APPROVED | Commit e830759; gate GREEN 5/5 + full 1A/1B/1C regression green ("4 passed (1.5m)"); F11/F12 applied as ruled; erratum + standing rule adopted; authorship verified: v@1000m 264.7 matches corrected derivation, locals max 1022.8 matches 1A structural prediction (1022.67), geo 151 = F12-predicted constant count; report: notes/reports/M1D.md; Lead approval 2026-10-16 |
| 1E | GATE FAILED·ROUTED | Extraction 3/3 (2871 L, zero parentheticals); F13 applied; F1 vacuous (0 require — import already top-level); 2 §6 strict-TS fixes (TSC_EXIT=0 unpiped); ?page=m1e wired (caad62c); gate FAILED 4 rows (badges F,F,F,P,F,P) — zero-gc + integration PASS, regression 1A/1B/1C/1D green ("4 passed (1.9m)"); 4 root causes diagnosed + routed (F14–F17 proposals + $-strip); report: notes/reports/M1E.md |
| 1F–1G | NOT STARTED | 1F (F3 + impostorMath purity); 1G (F2 + hand-applied KCC patch + MANDATORY full 1E re-run) |

## IN-FLIGHT
Milestone 1E — parked at the ruling gate after §8 step 5. Gate FAILED on
face-walk / slope-step / state-machine / coriolis; zero-gc + integration
PASS; full regression green. Root causes (all authorial canon defects, none
extraction-related, NOTHING touched): (1) jump structurally dead —
input.jump consumed before _groundedTick reads it (canon 812 vs 932);
(2) harness VEHICLE verify composes world offset (0,2,0) instead of the
parent-frame R_att⁻¹·(0,2,0) — constant 0.2565 m error, KCC correct (detach
check 0.0e+0); (3) face-walk: faceChanges 1 < 2 (climb-inflated pathLen
budget) + up-rotation 2.145° > 1.15° — real-terrain calibration; corner
criterion actually PASSES (0.0143 rad; the detail string double-acos's it
into "89.18°"); (4) slope-step: slide/uphill/AGL bounds vs the engineered
field's wild dynamics + stale-alt0 cross-field contamination (climbGain
103.3 m spurious). Watch 5.b params pasted in M1E.md §4.4; watch 5.c
restore VERIFIED (canon 2490–2492 / extracted 1042–1043); watch 5.f KCC
pristine except the §6 null-guard type fix. Standing rule in force: unpiped
exit codes (TSC_EXIT=0 BUILD_EXIT=0 PLAYWRIGHT_EXIT=1 observed). Diagnostic
probe kept: game/tools/diag-m1e.mjs (read-only DOM scrape).

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
| 5 | 2026-10-16 | M1D approval + M1E execution | Fresh-session bootstrap per §10.3 clean (canon = ea112ec, evidence matches STATE.md); M1D APPROVED + 1E ordered recorded in ledgers before any 1E work; extraction 3/3, F13 applied, F1 vacuous (0 require), 2 §6 strict-TS fixes, ?page=m1e wired; 1E gate FAILED 4 rows (authorial canon defects — dead jump, vehicle-verify offset, face-walk + slope-step calibration, stale-alt0) — all diagnosed + routed, NOTHING touched; regression 1A/1B/1C/1D green; report notes/reports/M1E.md | Parked at the ruling gate — next: Lead rulings on F14–F17 proposals + the routed $-strip; then apply, re-run 1E gate + full regression, update M1E.md, re-present at the approval gate |

## ANCHOR
df1e04f — "M1A: extracted, gates green" (branch m1-assembly; chain: ea112ec
canon → d849d6b WIP preservation → 2e409c0 protocol install → df1e04f M1A
approval). This wind-down STATE.md travels in the commit AFTER df1e04f (a
file cannot contain its own commit hash); resolve the exact carrier with
`git log -1 --format=%H -- notes/STATE.md`. Canon (Design_specs/,
Milestone/) must remain unchanged from ea112ec — verified: git diff ea112ec
on both trees is empty.
