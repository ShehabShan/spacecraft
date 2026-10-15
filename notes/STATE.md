# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
BLOCKED awaiting Lead rulings F11 + F12 (full diagnosis in
notes/reports/M1D.md). F11 (T3): the airborne-|Δv| bound 8 contradicts the
ratified β_q=3.2e-3 dive physics (true peak ≈ 10.3–10.4 m/s/tick ≈ 60 g at
the ρv² max; observed 10.30; v@1km 264.7 matches independent integration
262) — proposal: raise the bound to 12 (or 16); the no-clamp evidence is
untouched. F12 (T5): the static shell sphere registers MID-RUN (camera
looks down the nadir at 10 km → shell enters frustum) stepping geometries
150→151 → constancy fails; proposal: harness-only priming of the static
shell during the 2 primed frames (frustumCulled=false, then restore) —
mirrors primeAll's documented intent; count constant at 151; criterion
unchanged. On authorization: apply, re-run the 1D gate + full regression,
complete M1D.md, commit, push, STOP at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | APPROVED | Gate GREEN 4/4 + 1A/1B regression 5/5 ("3 passed (1.2m)"); F10a/F10b verified against all four ruling requirements; final commit a86ce94; report: notes/reports/M1C.md; Lead approval 2026-10-15 |
| 1D | EXTRACTED · GATE RUN · BLOCKED (2 canon calibrations → F11/F12) | 4/4 verbatim + F4 (02b313c; erratum in dc55895: 3 strict-TS type-only fixes, §6 MAY-fix); regression 1A/1B/1C GREEN; gate: atmosphere/dive/zero-gc PASS (v@1km 264.7, min AGL 3.38 m, LANDED, burn heap 0 B), drag-continuity FAIL (maxDv 10.30 vs bound 8 — physics correct for ratified β_q) + integration FAIL (shell registers mid-run 150→151) → F11/F12 routed; report: notes/reports/M1D.md |
| 1E–1G | NOT STARTED | 1E next (F1 at extraction); 1F (F3 + impostorMath purity); 1G (F2 + hand-applied KCC patch + MANDATORY full 1E re-run) |

## IN-FLIGHT
Milestone 1D / gate run — FAILED on T3 (drag-continuity) and T5
(integration); diagnosed to root cause, routed (F11/F12). T3: maxDv=10.30
vs the author's bound 8 — independent integration of the ratified
β_q=3.2e-3 gives v@1km=262 (observed 264.7) and peak per-tick Δv ≈ 10.4
(~60 g at the ρv² max; entry overshoots v_safe BY DESIGN) → the bound is an
authorial miscalibration. T5: MutationObserver trace shows geometries
150→151 exactly at the dive start — the static shell sphere enters the
frustum for the first time (nadir view from 10 km) and registers mid-run;
primeAll covers only pool meshes. Healthy: atmosphere PASS (52 m/s wind
exact, a(0)=340.3), dive PASS (≤400 @ 1 km with huge margin, min post-tick
AGL 3.38 m, LANDED, 4 contacts), zero-gc PASS (20,000 ticks, identities ✓,
heap 0 B), regression 1A/1B/1C GREEN. Probes: game/tools/diag-m1d.mjs.
Nothing tried beyond diagnosis; no acceptance logic touched.

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
