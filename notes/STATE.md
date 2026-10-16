# SOLARIS — ASSEMBLY STATE (see AGENT_BRIEF.md §10)

## NEXT ACTION
AWAITING LEAD RULING (round 3) on the M1F routes F25e/F29 (full evidence
in notes/reports/M1F.md §10): F25e corridor (F25d applied as ruled — full
2,600 m horizon shows EVERY azimuth mountainous; best az 345° @ 67.5° >
40° gate; 600 s sim 0 crossings, locals 371.8; no selection-input change
can meet the gate at this spawn — options: retarget SAT_B / rebases >= 1 /
longer LIVE_SECONDS / Lead's design); F29 (the now-AIMED renders expose
two real-geometry failures: R3 silhouette 47.69% sym-diff — Node: mesh
centre 637.09/360.61 vs impostor 640/360 = 2.97 px parallax vs 4.63/4.65
px disk radii, the author's sub-pixel claim assumed a bubble-center eye;
R5 straddler diffMid = 500 bytes — Node: camera→SAT_B ray blocked, worst
clearance −4.0 m at 20% along; Near-band hill occludes SAT_B in auto but
is clipped by Mid's 2,000 m near plane). PLUS one environment-soft note:
m1d row 2 (diveGrounded) failed this session on FPS-dependent dive
profiling (all numbers match the approved gate to the digit; 1D files
byte-identical to e830759; no code changed — routed with options). On
ruling: apply → Node verify → 1F gate (240 s) + full 1A–1E regression →
update notes/reports/M1F.md → commit + push → STOP at the approval gate.

## MILESTONE LEDGER
| MS | Status | Evidence |
|----|--------|----------|
| scaffold | DONE | game/ tree committed (WIP d849d6b); deps pinned per §3.3 (react 18.2.0, three 0.165.0, R3F 8.18.0, zustand ^4.4, TS ~5.4, vite 5.4.21, playwright 1.64.0); `npm run typecheck` + `npm run build` clean |
| 1A | APPROVED | Commit df1e04f "M1A: extracted, gates green"; gate GREEN 5/5 PASS, 9 rebases matching canon's predicted trace, zero canon edits; report: notes/reports/M1A.md |
| 1B | APPROVED | Gate GREEN (`acceptance PASSED in 21.5 ms`, 5/5 rows) + 1A regression 5/5 on the overlaid core; commits d582efc/F9 3f12b43/final db13db8; report: notes/reports/M1B.md; Lead approval 2026-10-15 |
| 1C | APPROVED | Gate GREEN 4/4 + 1A/1B regression 5/5 ("3 passed (1.2m)"); F10a/F10b verified against all four ruling requirements; final commit a86ce94; report: notes/reports/M1C.md; Lead approval 2026-10-15 |
| 1D | APPROVED | Commit e830759; gate GREEN 5/5 + full 1A/1B/1C regression green ("4 passed (1.5m)"); F11/F12 applied as ruled; erratum + standing rule adopted; authorship verified: v@1000m 264.7 matches corrected derivation, locals max 1022.8 matches 1A structural prediction (1022.67), geo 151 = F12-predicted constant count; report: notes/reports/M1D.md; Lead approval 2026-10-16 |
| 1E | APPROVED | Commit 4c352dd (gate-green report + ledgers); FINAL: `[Milestone1E] acceptance PASSED` 6/6 (coriolis 0.75 cm west/1.02 s/1-tick plant; vehicleErr 0.0e+0; deorbit landed 22,307; face-walk 0.82° corner/2 changes; slope rows clean, minAGL n/a) + full 1A/1B/1C/1D regression ("5 passed (1.9m)", PLAYWRIGHT_EXIT=0); all nine rulings applied + vindicated (F14 core #1 7947369; F15–F17+$-strip e689d4c; F18 core #2 37a4c9e; F19/F20 7d77e52); report: notes/reports/M1E.md; Lead approval 2026-10-16 |
| 1F | GATE RUN ×3 — FAILED, ROUTED (round 3) | Round 1: extraction 4/4 + F3/F21 (5a17673); gate FAILED 1/5 → F22–F26+D-1/D-2 routed (3c79440). Round 2: ruling applied (0b2fae8); gate FAILED ["PASS","FAIL","PASS","FAIL","FAIL"] → F27/F28/F25c routed. Round 3 (2026-10-17): ruling applied EXACTLY (a6de872 + B-1 74875e5 + probes 1c8a2b8/1d76fd0); TSC/BUILD exit 0; Node FIRST: 4/4 poses dead-center through the REAL edited lookAtQuatInto (F27 ✓), Sun r=20.95 px ideal 1,379 px; F25d branch (iii) per its own Node conditional (best az 345° @ 67.5° > 40°; 600 s sim 0 crossings, locals 371.8); third gate ["PASS","PASS","FAIL","PASS","FAIL"] — R2 PASS (footprint 105.5%, center 0.71 px; F27 VINDICATED), R4 PASS (heaps 0/0; F28 VINDICATED), R3 FAIL on the now-real silhouette clause (47.69% > 3%), R5 FAIL 0 shifts + NEW diffMid=500; regression 1A/1B/1C/1E GREEN, m1d row-2 ENV-SOFT (FPS-dependent dive profile; numbers match approved gate; files byte-identical to e830759; no code change); report: notes/reports/M1F.md §10; PARKED AT RULING GATE round 3 (routes F25e/F29) |
| 1G | NOT STARTED | F2 + hand-applied KCC patch + MANDATORY full 1E re-run; re-grep the §3.5 patch against F14/F18's moved/edited regions |

## IN-FLIGHT
Milestone 1F — PARKED AT THE RULING GATE, ROUND 3 (2026-10-17). Round-3
ruling (F27/F28/F25d + B-1) applied exactly and verified; F27 and F28
VINDICATED in Node and browser (R2 PASS: Sun footprint 105.5%, centre
0.71 px; R4 PASS: heaps 0/0). F25d's own conditional resolved to branch
(iii): with the full 2,600 m horizon every azimuth is mountainous (best
az 345° @ 67.5°), the 600 s sim shows 0 crossings (locals 371.8, path
934.5 m, net 118.8 m; straight line to SAT_B max 80.6° at ~863 m) — the
edit stays committed, gate run anyway, routed as F25e. TWO NEW ROUTES
awaiting the Lead (details + verbatim evidence in notes/reports/M1F.md
§10.4):
- F25e: corridor — no azimuth at this spawn meets the 40° gate over the
  full walk; no selection-input change can produce ≥2 crossings within
  LIVE_SECONDS=120. Options: retarget SAT_B / rebases >= 1 / longer
  LIVE_SECONDS / Lead's design.
- F29: the now-aimed A/B clauses fail on real geometry. R3 silhouette:
  mesh centre projects (637.09, 360.61) vs impostor (640.00, 360.00) —
  2.97 px parallax vs 4.63/4.65 px disk radii (the mesh is placed
  bubble-center-relative, the impostor staged along the fixed PROBE_DIR
  from the observer 1,348.8 m off-center; the author's sub-pixel claim
  assumed a bubble-center eye) → 47.69% sym-diff. R5 straddler: diffMid
  = 500 bytes (diffNear 0) — the camera→SAT_B ray is blocked (worst
  clearance −4.0 m at 20% along); the Near-band occluder is clipped by
  Mid's 2,000 m near plane, so auto ≈ forced-Near ≠ forced-Mid. The 500
  bytes ≈ 125 px are also the SAT_B framing evidence (renders
  dead-centre, occluded).
PLUS environment-soft note (not a 1F route): m1d row 2 failed this
session on diveGrounded — the variable-step dive integrates real frame
deltas against a wall-scaled 45 s cap, so the profile is FPS-dependent;
this host's new Chrome renders slow ReadPixels frames (1F live trace
1,603 frames vs 7,201 in round 2). All printed 1D numbers match the
approved gate to the digit (264.7/10.30/8/151/0B; min AGL 65.57 vs
approved 3.38/LANDED); 1D files byte-identical to e830759; deterministic
across two runs; NO code changed (canon row; §6). Options routed: re-run
on a faster/quieter machine, or a Lead ruling on the row's FPS
sensitivity.
R5's sunJump clause stays vacuous until crossings exist (F21a measurement
live). 1E is closed: APPROVED at 4c352dd.

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
| 2026-10-16 | MILESTONE 1E: APPROVED (gate GREEN 6/6 + full 1A–1E regression "5 passed (1.9m)"; F15 confirmed to the digit; F14/F18 noted as THE ONLY TWO CORE EDITS TO DATE, both astronautKCC.ts — flag both for re-grep at 1G §3.5 application; Coriolis-magnitude note on record: 0.75 cm measured vs ~1.8 cm ideal = first-order tilt-correction slop, window 0.6–6 cm was set for exactly this; discriminators exact: 61 ticks = 2u/g, plant 1 tick, west-positive; commit 4c352dd; report notes/reports/M1E.md) |
| 2026-10-16 | 1E ordered→done bookkeeping closed: ordered 2026-10-16 (entry above), executed through three ruling rounds + two authorized core edits, gate green, approved same day |
| 2026-10-16 | MILESTONE 1F ORDERED with F3 EXPANDED (Lead-ratified; every part conditional on the extracted canon matching the described form — material difference = STOP and route with exact extracted lines): F3a delete the dead slopeDegAt stub + its `void slopeDegAt;` line; F3c slopeFromNormal require() shim → terrainNormalInto added to the top-level terrainField import, shim deleted (F1/F2 pattern; real this time); F3b+F21a sun-trace semantics — canon's marking never marks (vacuous sunJump=0) and activating as-is measures the WRONG quantity (trace stores ABSOLUTE local staged position, shifts by rebase Δ up to 1,024 m; documented intent is CAMERA-RELATIVE invariance): add `lastRebaseCount: 0` to the `live` literal, store camera-relative offsets (staged − drvLocal) + `rebased: core.stats.rebaseCount !== live.lastRebaseCount` + update lastRebaseCount in the LIVE-phase push, DELETE both vestigial blocks, bound sunJump < 0.02 → < 0.05, detail wording updated (observer parallax ~12 mm/frame at D=9,600 m, d_sun≈600 km; ~20,000× discrimination retained) |
| 2026-10-16 | F21b CONDITIONAL CALIBRATION authorized (F16a/F19 precedent): FIRST read-only arithmetic from the EXTRACTED constants accounting for the 5-substep cap (ts=6 → both kcc.update and core.advance run exactly 5 ticks/frame, in lockstep); Lead's authorship numbers: LIVE_SECONDS 25, ts 6, sprint 6.5, Ω 0.0005, R 1364.5 → ~900 m → ~1 rebase crossing vs the row's `rebases >= 3`; if arithmetic confirms <3 expected crossings: LIVE_SECONDS=120 (≥2 crossings guaranteed even at effective 3×), `rebases >= 3` → `>= 2` (detail text updated; 1D's cruise row carries the 8-rebase lattice evidence), Playwright budget 150 s → 240 s (gate infrastructure, §6); if extracted constants already yield ≥3, change nothing |
| 2026-10-16 | §6 authority re-affirmed for 1F: strict-TS/build fixes authorized — if the R4 zero-gc canary references rigCamNear while the import list names rigCamFar (undefined name), correct the IMPORT LIST to match usage; any harness import that does not resolve against MultiCameraRig's exports is a §6 broken-import fix; log every fix |
| 2026-10-16 | Prior-session closure: session 5 ended at the M1E approval gate; its STATE.md row (handoff note present) was committed in 4c352dd but no dedicated closure row existed — closure row appended to the SESSION LOG this session per §10.2 |
| 2026-10-16 | F22 AUTHORIZED + APPLIED (Lead ruling round 1): horizon-cull up = ABSOLUTE radial normalize(O+local); origin read hoisted, single declaration — live-path VINDICATED (9 active instances at suite; Sun +47.7° ACTIVE; ideal footprint ≈1,381 px; Saturn/Uranus correctly culled) |
| 2026-10-16 | F23a/b AUTHORIZED + APPLIED: flips === 21 + deterministic-flips detail clause; maxSlope ≤ 0.00015 — VINDICATED (R3 PASS: 21 flips, 0.14/km) |
| 2026-10-16 | F24 AUTHORIZED + APPLIED: canary term → astroMesh.children.length === 8 (other terms unchanged) — term true; R4's remaining failure is the SECOND term's own defect (F28 routed) |
| 2026-10-16 | F25 AUTHORIZED + APPLIED: 24-azimuth corridor scan replaces walkFwd (score = max slope, tie-break max |Δh|; SAT formulas unchanged; LIVE_SECONDS untouched); 40° gate + Node-measure fallback — best corridor az 330° @ 42.2° > 40° → measured 600 s sim: 0 crossings (686.1 max bubble comp < 1,024; 1,321 m path/478 m net; 69.7/72.7° walls beyond 1.2 km) → routed per the ruling's own stop condition (F25c) |
| 2026-10-16 | F26 AUTHORIZED + APPLIED: geoMin/geoMax reset at WARMUP→LIVE + LIVE-only capture — VINDICATED (geometries constant at 49) |
| 2026-10-16 | D-1/D-2 AUTHORIZED + APPLIED ($ restored + paren repaired in R2 detail); O-1/O-2 ACCEPTED no action (recorded) |
| 2026-10-16 | ROUND-2 ROUTES PENDING LEAD: F27 lookAt convention mismatch (quatFromFrameInto is an X-forward frame quat; lookAtQuatInto poses aim the camera ~90° off-target while projectDirectionInto uses −Z; Sun renders opposite the ±42 px window — proposed one-line fix quatFromFrameInto(right, up) VERIFIED dead-center in Node); F28 identityOk second term bodies.length === 11 structurally false (capacity-24 pool; active = 9); F25c corridor gate failure (0 crossings measured, numbers on record) |
| 2026-10-17 | ROUND-2 RULING (Lead): diagnosis ACCEPTED as correct. F27 APPROVED — lookAtQuatInto only: quatFromFrameInto(fwd,up) → (right,up) + one-line comment "three.js camera basis: X=right, Y=up, −Z=forward (F27)"; sphericalFrame/projectDirectionInto/all four call sites/thresholds untouched. F28 APPROVED — identityOk second term → sky.bodies.length === IMPOSTOR_CAPACITY (imported from SkyImpostorPool, no literal 24); other canary terms + heap bounds untouched. F25d APPROVED (user decision, option A of the F25c escalation) — corridor scan widened to 2,600 m (ARCS extended to 16 arcs), comment updated, diag-m1f-core.mjs mirrored; SAT_B/LIVE_SECONDS/rebases/40° gate/R5 terms all untouched; conditional branch decided in Node at step 4b: (i) slope ≤ 40° → proceed; (ii) slope > 40° but ≥ 2 crossings within LIVE_SECONDS with locals ≤ 1,024 → proceed; (iii) otherwise keep the edit, run the gate anyway, route F25e. B-1 bookkeeping ordered (ledger commit note + ANCHOR → 0b2fae8 + this ledger). Expected gate: [PASS,PASS,PASS,PASS,PASS] if 4b predicts ≥ 2 crossings. |
| 2026-10-17 | ROUND-3 EXECUTION COMPLETE: F27/F28/F25d/B-1 applied exactly (a6de872, 74875e5); TSC/BUILD exit 0 unpiped; Node 4b — F27 verified through the REAL edited function (4/4 poses dead-center), F25d conditional resolved to branch (iii) per the ruling's own procedure (best az 345° @ 67.5° > 40°; 600 s sim 0 crossings, locals 371.8 ≤ 1,024) → gate + regression run anyway as ruled. Third gate ["PASS","PASS","FAIL","PASS","FAIL"]: R2 PASS (F27 VINDICATED — footprint 105.5%, centre 0.71 px), R4 PASS (F28 VINDICATED — heaps 0/0), R3 FAIL on the now-real silhouette clause (47.69% > 3%), R5 FAIL (0 shifts + diffMid=500). NEW ROUTES PENDING LEAD: F25e (corridor unmeetable at this spawn over the full horizon — options unchanged) and F29 (R3 parallax: mesh centre 637.09/360.61 vs impostor 640/360, 2.97 px vs 4.63/4.65 px radii, author assumed bubble-center eye; R5 straddle ray blocked, worst clearance −4.0 m at 20% — Near-band occluder clipped by Mid's 2,000 m plane explains diffNear 0 / diffMid 500). m1d regression row-2 failure ENVIRONMENT-SOFT per M1A row-5 precedent: variable-step dive vs wall-scaled cap is FPS-dependent; all numbers match the approved gate (264.7/10.30/8/151/0B); 1D files byte-identical to e830759; deterministic; NO code changed; options routed (faster-machine re-run / ruling on FPS sensitivity). |

## SESSION LOG
| # | Date | Goal | Outcome | Handoff note |
|---|------|------|---------|--------------|
| 1 | 2026-10-14 | §9 opening report → scaffold + Milestone 1A | Opening report approved; branch m1-assembly created; game/ scaffolded per §3; extract.mjs written (6/6 blocks 1A); 1A wired, typecheck+build clean, gate PASSED 5/5; report delivered in chat — ended before writing the STATE.md/report files (protocol did not exist yet) | none written — reconciled post-hoc |
| 2 | 2026-10-14 | Protocol install + reconcile | AGENT_BRIEF.md written verbatim (389-line paste + 47-line §10 append); session-1 work preserved as WIP d849d6b; notes/ tree created; CHANGES.md relocated to root; STATE.md written from evidence; M1A report persisted to notes/reports/M1A.md | Session parked at the 1A approval gate — resumed by session 3 |
| 3 | 2026-10-14 | 1A approval + protocol install | approved + installed + pushed | Run the F6 pre-scan over all seven Milestone .txt files (report per file whether the acceptance-line `$` is present), then begin Milestone 1B: read Milestone/Milestone 1B.txt in full, run `node tools/extract.mjs 1B` (expect 5 blocks; the parenthetical overlay on src/core/simulation/SimulationCore.ts explicitly reported — it must be the ONLY parenthetical match), F6 check/repair on the 1B harness, register ?page=m1b, typecheck+build, run the 1B gate PLUS the 1A page as regression, write notes/reports/M1B.md with verbatim gate output and the pre-scan table, commit per the amended cadence, push, then STOP at the approval gate. |
| 4 | 2026-10-14/15 | M1B execution | (continuation — session resumed after wind-down in the same live session) Pre-scan done (1C verdict missing → F8); extraction 5/5 + overlay, invariant held; F7a/F7b per ruling → typecheck/build clean; 1A regression green; 1B deadlock diagnosed to canon auto-run guard → F9 authorized + applied; 1C-CP persisted; BOTH gates green ("2 passed (9.5s)") | M1B parked at the approval gate — next: Lead approval of notes/reports/M1B.md, then 1C (extract 6 blocks, F5 + 1C-CP at extraction, workers check, gate + regression, report) |
| 5 | 2026-10-16 | M1D approval + M1E execution | Bootstrap clean; M1D APPROVED + 1E ordered recorded; extraction 3/3, F13, F1 vacuous, 2 TS fixes, ?page=m1e wired; three ruling rounds total: (1) first gate FAIL 4 rows → F14–F17 + $-strip ruled + applied (F14 = core #1), all vindicated; (2) re-run FAIL 3 rows → F18 (core #2: launch compose at θ_prev + embed guard), F19 (cap 26,000), F20 (per-row reset + Infinity print) ruled + applied, Node verification FIRST agreed with browser number-for-number; (3) FINAL GATE GREEN: 1E 6/6 PASS + full 1A/1B/1C/1D regression "5 passed (1.9m)", PLAYWRIGHT_EXIT=0; spec-canonical coriolis row green (0.75 cm west, 1.02 s, 1-tick plant) | M1E parked at the approval gate — next: Lead approval of notes/reports/M1E.md; then 1F per §8 (extract 4 blocks, F3, impostorMath purity, gate 150 s + regression, report, STOP) |
| 6 | 2026-10-16 | Prior-session CLOSURE ROW (appended by session 6 per §10.2 + Lead directive) | Session 5 ended at the M1E approval gate; its handoff note above was committed in 4c352dd, but no dedicated closure row existed at session end — the §10.2 gap is formal, noted in the Approval Ledger, closed by this row. M1E subsequently APPROVED by directive 2026-10-16 | Resumed by session 6 (fresh bootstrap, reconciliation clean, canon byte-identical to ea112ec) |
| 7 | 2026-10-16 | M1E approval bookkeeping + M1F execution (two ruling rounds) | Bootstrap: directive items 1/2/6 already recorded in bbbbb47; ONE drift — prior session's uncommitted partial 1F extraction (re-extracted verbatim, nothing unique lost). Round 1: extraction 4/4 (0 parenthetical; layeredCameras silent; impostorMath PURE), F3a/c/b+F21a + F21b applied, 5 §6 strict-TS fixes, ?page=m1f wired, TSC/BUILD exit 0 (5a17673); gate FAILED 1/5 → F22–F26+D-1/D-2 root-caused (Node+browser probes) and routed (3c79440); regression 1A–1E GREEN. Round 2 (Lead ruling): all seven items applied exactly; Node verified FIRST (corridor 42.2° > 40° gate → measured 0 crossings; Sun +47.7° ACTIVE, footprint ideal ≈1,381 px); second gate FAILED ["PASS","FAIL","PASS","FAIL","FAIL"] — R3 PASS + F22/F23/F26/D-1/D-2 vindicated; THREE NEW ROUTES: F27 (lookAt X-forward-frame vs −Z convention — Sun renders opposite the ±42 px window; one-line fix VERIFIED in Node), F28 (identityOk bodies.length === 11 vs capacity-24 pool), F25c (corridor gate stop per the ruling's own conditional); regression 1A–1E GREEN again; report §9 + ledgers finalized | M1F awaits the Lead's round-2 ruling on F27/F28/F25c (evidence in notes/reports/M1F.md §9.3). On authorization: apply → Node verify → full gate + regression → report → commit + push → STOP at the approval gate. 1G after that. |
| 8 | 2026-10-17 | M1F round-3 ruling execution | Preconditions clean (HEAD 0b2fae8 = origin, canon diff ea112ec empty). Environment repairs only: npm ci (node_modules absent), Chrome installed by the user mid-session. F27/F28/F25d applied exactly + B-1 (a6de872, 74875e5); TSC/BUILD exit 0; diag-m1f-r2 rewritten to execute the REAL edited lookAtQuatInto (verbatim runtime extract) — 4/4 poses dead-center; diag-m1f-core instrumented → F25d branch (iii) (az 345° @ 67.5°; 0 crossings; locals 371.8; straight line to SAT_B 80.6°); third gate ["PASS","PASS","FAIL","PASS","FAIL"] — F27/F28 VINDICATED (R2 footprint 105.5%/0.71 px; R4 heaps 0/0); F29 routed (R3 silhouette 47.69% = 2.97 px parallax vs 4.63 px radii; R5 diffMid 500 = ray blocked, −4.0 m at 20%) + F25e routed; regression 1A/1B/1C/1E GREEN, m1d row-2 ENV-SOFT (diveGrounded; numbers match approved gate; FPS-dependent; no code change; probes diag-m1d-details/dive created); report §10 + CHANGES 51–55 + ledgers | M1F awaits the Lead's round-3 ruling on F25e/F29 + the m1d env-soft decision (evidence in notes/reports/M1F.md §10.4–10.5). On authorization: apply → Node verify → full gate + regression → report → commit + push → STOP at the approval gate. 1G after that. |

## ANCHOR
0b2fae8 — "M1F/ruling-round-1 APPLIED … parked at ruling gate round 2"
(the last pushed, Lead-verified state at the 2026-10-17 round-3 ruling;
branch m1-assembly; chain: ea112ec canon → d849d6b WIP preservation →
2e409c0 protocol install → df1e04f M1A approval → … → 0b2fae8 M1F round-2
gate → a6de872 round-3 edits → 74875e5 B-1 → 1c8a2b8/1d76fd0 probes →
9627eee CHANGES 51–55). This wind-down STATE.md travels in a commit AFTER
those (a file cannot contain its own commit hash); resolve the exact
carrier with `git log -1 --format=%H -- notes/STATE.md`. Canon
(Design_specs/, Milestone/) must remain unchanged from ea112ec —
verified: git diff ea112ec on both trees is empty.
