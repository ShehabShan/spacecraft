# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
Await Lead approval of the M1E report (notes/reports/M1E.md — GATE GREEN:
`[Milestone1E] acceptance PASSED` 6/6 + full 1A/1B/1C/1D regression,
"5 passed (1.9m)", PLAYWRIGHT_EXIT=0). On approval: 1E → APPROVED in the
milestone ledger; begin Milestone 1F per the §8 loop — read
Milestone/Milestone 1F.txt in full, run `node tools/extract.mjs 1F` (expect
4 blocks; DEFENSIVE: discard any src/render/layeredCameras.ts block and
report if it triggers), apply F3 ((a) delete the dead slopeDegAt stub;
(b) sun-trace rebase-marking → per-frame module-counter comparison against
core.stats.rebaseCount), verify impostorMath.ts has NO three imports (pure
core), register ?page=m1f, typecheck+build unpiped, run the 1F gate (150 s)
+ full 1A–1E regression, write notes/reports/M1F.md, commit per cadence,
push, STOP at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | APPROVED | Gate GREEN 4/4 + 1A/1B regression 5/5 ("3 passed (1.2m)"); F10a/F10b verified against all four ruling requirements; final commit a86ce94; report: notes/reports/M1C.md; Lead approval 2026-10-15 |
| 1D | APPROVED | Commit e830759; gate GREEN 5/5 + full 1A/1B/1C regression green ("4 passed (1.5m)"); F11/F12 applied as ruled; erratum + standing rule adopted; authorship verified: v@1000m 264.7 matches corrected derivation, locals max 1022.8 matches 1A structural prediction (1022.67), geo 151 = F12-predicted constant count; report: notes/reports/M1D.md; Lead approval 2026-10-16 |
| 1E | GATE GREEN·AWAITING LEAD | All nine rulings applied + vindicated (F14 core #1 7947369; F15–F17+$-strip e689d4c; F18 core #2 37a4c9e — launch compose at θ_prev + embed-guard; F19/F20 7d77e52); FINAL: `[Milestone1E] acceptance PASSED` 6/6 (coriolis 0.75 cm west/1.02 s/1-tick plant; vehicleErr 0.0e+0; deorbit landed 22,307; face-walk 0.82° corner/2 changes; slope rows clean, minAGL n/a) + full 1A/1B/1C/1D regression ("5 passed (1.9m)", PLAYWRIGHT_EXIT=0); report: notes/reports/M1E.md |
| 1F–1G | NOT STARTED | 1F (F3 + impostorMath purity); 1G (F2 + hand-applied KCC patch + MANDATORY full 1E re-run) |

## IN-FLIGHT
Milestone 1E — COMPLETE through §8 step 6, parked at the approval gate.
All nine rulings applied and vindicated; two authorized core edits on
record (F14 7947369: dead-jump consumption relocation; F18 37a4c9e: launch
compose at θ_prev + launch-tick embed guard — BOTH flagged for the 1G §3.5
re-grep). Final gate: 6/6 PASS + full regression "5 passed (1.9m)",
PLAYWRIGHT_EXIT=0. Node verification agreed with the browser
number-for-number (coriolis 61 ticks / 0.75 cm west / 1.18 cm cross-track /
1-tick plant; deorbit landed 22,307; vehicleErr 0.0e+0; slope minAGL +∞).
Standing rule in force: unpiped exits (TSC_EXIT=0 BUILD_EXIT=0
PLAYWRIGHT_EXIT=0 observed). Probes kept: diag-m1e.mjs (DOM scrape),
diag-m1e-field.mjs (field calibration), diag-m1e-core.mjs (Node row
verifier). F17c conditional relaxation MOOT. No open debugging.

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
| 2026-10-16 | F14 AUTHORIZED + APPLIED: dead-jump consumption relocated after the mode dispatch (canon cleared input.jump before _groundedTick read it) — FIRST CORE-BEHAVIOR EDIT, isolated commit 7947369; edge-trigger preserved; 1G note: re-grep the §3.5 patch against the moved line |
| 2026-10-16 | F15 AUTHORIZED + APPLIED: vehicle-verify composes the parent-frame offset (conjugate-rotate (0,2,0) at attach quat); dead tx lines deleted; vindicated — vehicleErr 0.2565 → 0.0e+0 |
| 2026-10-16 | F16a/b/c AUTHORIZED + APPLIED: face-walk budget 13,600 + cap 140,000; up bound cos(0.02)→cos(0.06) + detail "(bound 3.44°)"; corner print deg()→radians·180/π — vindicated (2 face changes, corner prints 0.82°) |
| 2026-10-16 | F17a/b/c AUTHORIZED + APPLIED: stale-alt0 → direct hypot reads; STEEP recalibrated (freq 3.0, amp 2200, detail 8/3) + scanFor uniformity gate (8 compass probes @ 3 m; <35°/>45°/>60°); probe: FINAL mountainAmp 2200 (moderate@49 25.9°, steep@12 60.2°, cliff@4 73.2°, >70° = 17.96%); conditional cliff-AGL relaxation to −0.15 authorized ONLY within [−0.15,−0.05) — NOT triggered (browser −0.206 outside window); bounds otherwise kept, all PASS |
| 2026-10-16 | L1015 $-strip AUTHORIZED + APPLIED (one instance, one character); F1-vacuous RATIFIED as-delivered; both strict-TS repairs RATIFIED (Math.SQRT1_3 confirmed nonexistent); F2 remains EXPECTED at 1G |
| 2026-10-16 | Re-run outcome: 3 rows converted to PASS (face-walk, state-machine vehicleErr, slope moderate/steep/cliff-net; zero-gc PASS with F14 live); THREE NEW ROUTINGS: (R1) coriolis launch-tick compose@θ_new vs sweep embed@θ_prev = 0.867 m probe offset → re-lands in-tick (−85.22 cm; CORE EDIT #2 candidate: compose launch at θ_prev, physics-neutral); (R2) deorbit 20,000-tick cap < ≈22,400 needed (Node: r=12,551 m, v=146 m/s at cap); (R3) cliff-minAGL −0.206 = zero-gc burn's landing bisection contaminating the global accumulator (cliff sprint never airborne; Node tick 20,590 −0.1119) — outside conditional window → route |
| 2026-10-16 | F18 AUTHORIZED + APPLIED (CORE EDIT #2, 37a4c9e): launch compose (P + velocity rotation) at θ_prev via an optional _composeGrounded phase param (default this._theta — all 3-arg sites unchanged); _flightTick/_sweep gain launchTick and the tick-start embed check is guarded `!launchTick`; rationale on record (θ_new compose = no physical instant, double-counted one transport tick = the 0.87 m phantom; guard removes the ~3e-14 m ulp coin-flip — launch AGL is exactly groundClearance); mid-sweep sampling untouched; flagged for the 1G §3.5 re-grep alongside F14 |
| 2026-10-16 | F19 AUTHORIZED + APPLIED (7d77e52): deorbit cap 20,000 → 26,000 — landed at tick 22,307 (analytic ≈22,400) |
| 2026-10-16 | F20 AUTHORIZED + APPLIED (7d77e52): resetIntegrityStats first in runSlopeStep (cliff criterion measures only its own window) + 'n/a (never airborne)' print; F17c conditional relaxation MOOT (post-reset minAGL = +∞) |
| 2026-10-16 | Ratified observations: field calibration GREEN under original bounds on the recalibrated field; burn in-sweep transient within the Lipschitz bound, no row asserts it; ledgers append-only. VERIFICATION: Node first (coriolis 61 ticks/0.75 cm/1.18 cm/1-tick plant; landed 22,307; vehicleErr 0.0e+0; minAGL +∞) then browser — M1E GATE GREEN 6/6 + regression "5 passed (1.9m)", PLAYWRIGHT_EXIT=0 |

## SESSION LOG
| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 1 | 2026-10-14 | §9 opening report → scaffold + Milestone 1A | Opening report approved; branch m1-assembly created; game/ scaffolded per §3; extract.mjs written (6/6 blocks 1A); 1A wired, typecheck+build clean, gate PASSED 5/5; report delivered in chat — ended before writing the STATE.md/report files (protocol did not exist yet) | none written — reconciled post-hoc |
| 2 | 2026-10-14 | Protocol install + reconcile | AGENT_BRIEF.md written verbatim (389-line paste + 47-line §10 append); session-1 work preserved as WIP d849d6b; notes/ tree created; CHANGES.md relocated to root; STATE.md written from evidence; M1A report persisted to notes/reports/M1A.md | Session parked at the 1A approval gate — resumed by session 3 |
| 3 | 2026-10-14 | 1A approval + protocol install | approved + installed + pushed | Run the F6 pre-scan over all seven Milestone .txt files (report per file whether the acceptance-line `$` is present), then begin Milestone 1B: read Milestone/Milestone 1B.txt in full, run `node tools/extract.mjs 1B` (expect 5 blocks; the parenthetical overlay on src/core/simulation/SimulationCore.ts explicitly reported — it must be the ONLY parenthetical match), F6 check/repair on the 1B harness, register ?page=m1b, typecheck+build, run the 1B gate PLUS the 1A page as regression, write notes/reports/M1B.md with verbatim gate output and the pre-scan table, commit per the amended cadence, push, then STOP at the approval gate. |
| 4 | 2026-10-14/15 | M1B execution | (continuation — session resumed after wind-down in the same live session) Pre-scan done (1C verdict missing → F8); extraction 5/5 + overlay, invariant held; F7a/F7b per ruling → typecheck/build clean; 1A regression green; 1B deadlock diagnosed to canon auto-run guard → F9 authorized + applied; 1C-CP persisted; BOTH gates green ("2 passed (9.5s)") | M1B parked at the approval gate — next: Lead approval of notes/reports/M1B.md, then 1C (extract 6 blocks, F5 + 1C-CP at extraction, workers check, gate + regression, report) |
| 5 | 2026-10-16 | M1D approval + M1E execution | Bootstrap clean; M1D APPROVED + 1E ordered recorded; extraction 3/3, F13, F1 vacuous, 2 TS fixes, ?page=m1e wired; three ruling rounds total: (1) first gate FAIL 4 rows → F14–F17 + $-strip ruled + applied (F14 = core #1), all vindicated; (2) re-run FAIL 3 rows → F18 (core #2: launch compose at θ_prev + embed guard), F19 (cap 26,000), F20 (per-row reset + Infinity print) ruled + applied, Node verification FIRST agreed with browser number-for-number; (3) FINAL GATE GREEN: 1E 6/6 PASS + full 1A/1B/1C/1D regression "5 passed (1.9m)", PLAYWRIGHT_EXIT=0; spec-canonical coriolis row green (0.75 cm west, 1.02 s, 1-tick plant) | M1E parked at the approval gate — next: Lead approval of notes/reports/M1E.md; then 1F per §8 (extract 4 blocks, F3, impostorMath purity, gate 150 s + regression, report, STOP) |

## ANCHOR
df1e04f — "M1A: extracted, gates green" (branch m1-assembly; chain: ea112ec
canon → d849d6b WIP preservation → 2e409c0 protocol install → df1e04f M1A
approval). This wind-down STATE.md travels in the commit AFTER df1e04f (a
file cannot contain its own commit hash); resolve the exact carrier with
`git log -1 --format=%H -- notes/STATE.md`. Canon (Design_specs/,
Milestone/) must remain unchanged from ea112ec — verified: git diff ea112ec
on both trees is empty.
