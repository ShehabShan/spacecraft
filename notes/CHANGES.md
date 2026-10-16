# Change log — see AGENT_BRIEF.md §6 for policy

(Solaris Engine Assembly; relocated from game/notes/ to the repo-root notes/
tree by the §10 multi-session protocol install — the state carriers live at
the repo root. Format: date · milestone · file · what · why · evidence · source.)

No canon file (Design_specs/, Milestone/) is ever modified; entries below
touch only scaffolding created by this assembly (brief §3) and, where
applicable, code fixes proven by failing acceptance output.

---

## 2026-10-14 — Scaffolding (pre-1A)

1. 2026-10-14 · scaffold · game/package.json · Replaced the create-vite
   template's versions (react ^19.2.8, vite ^8.3.0, typescript ~6.0.2,
   @vitejs/plugin-react ^6.1.1, plus oxlint/@types/node) with the exact
   ratified pins: react/react-dom 18.2.0, three 0.165.0, @react-three/fiber
   ^8.15.0 (resolved 8.18.0 — v8 line, NOT v9), zustand ^4.4.0, typescript
   ~5.4.0, vite ^5.2.0 (resolved 5.4.21), @vitejs/plugin-react ^4.2.0,
   playwright ^1.44.0 (resolved 1.64.0); scripts = dev/build/preview/
   typecheck/test. · The template ships newer majors than the approved stack;
   the pin list is exhaustive. · Evidence: create-vite output package.json
   (react 19 / vite 8 / ts 6) vs brief list. · Source: brief §3.3.

2. 2026-10-14 · scaffold · game/tsconfig.json · Consolidated the template's
   tsconfig.json + tsconfig.app.json + tsconfig.node.json split into ONE
   tsconfig.json with exactly the §3.4 options (target ES2020, bundler
   resolution, strict, noUnusedLocals/noUnusedParameters FALSE, noEmit,
   isolatedModules, types ["vite/client"], include ["src"]). · Brief
   specifies a single config; the app/node split serves nothing here. ·
   Evidence: template scaffold listing. · Source: brief §3.4.

3. 2026-10-14 · scaffold · game/src/main.tsx · Entry renders WITHOUT
   React.StrictMode and routes ?page= through a static page → () => import()
   map (m1a registered); unselected harness modules never execute (verified:
   build emits the harness as its own chunk). · StrictMode double-mount
   corrupts module-singleton harnesses; terrainField is one-planet-per-page. ·
   Evidence: `npm run build` output shows `Milestone1A_TestHarness-*.js` as a
   separate 828 kB chunk. · Source: brief §3.2, §3.6.

4. 2026-10-14 · scaffold · game/src/App.tsx, game/index.html,
   game/vite.config.ts, deletions (src/App.css, src/index.css, src/assets/,
   public/favicon.svg, public/icons.svg, README.md) · Replaced the template
   demo app with the plain-<a> menu page (full page loads only); stock vite
   config with the react plugin only (native worker bundling). · Scaffolding
   the brief requires; demo cruft removed. · Evidence: n/a (creation). ·
   Source: brief §3.1, §3.5, §3.6.

5. 2026-10-14 · scaffold · game/tools/extract.mjs · Heading regex includes
   the Lead-approved OPTIONAL trailing parenthetical
   (`### N. \`path\` (…)`) with an enforced invariant: the parenthetical
   branch may match exactly ONE heading in the entire canon — 1B's
   src/core/simulation/SimulationCore.ts — and any other parenthetical match
   aborts before writing. Also implements: BOM strip + CRLF→LF, expected
   block counts per milestone (1A→6 … 1G→4), unbalanced-fence abort, 1B
   overlay marking, 1G §3.5 Appendix staging to tools/patches/, defensive
   layeredCameras discard. · The brief's literal end-anchored regex misses
   1B's heading `### 4. \`src/core/simulation/SimulationCore.ts\` (updated
   for M1B)` (verified in canon at Milestone 1B.txt:772). · Evidence: grep
   of canon heading, opening report finding #1. · Source: Lead approval
   2026-10-14 ("Regex relaxation APPROVED … LOG every heading matched via the
   optional-parenthetical branch").

6. 2026-10-14 · scaffold · game/playwright.config.ts, game/e2e/m1a.spec.ts ·
   Gate config per §3.7 (chrome channel, headless, serial, 300 s timeout,
   webServer `npm run build && npx vite preview --port 4173`); imports use
   `playwright/test` because the single approved devDep `playwright`
   (1.64.0) ships the ./test subpath and the runner CLI itself —
   @playwright/test is NOT separately installed. · Brief pins only
   `playwright`; adding @playwright/test would be an unapproved package. ·
   Evidence: `node -e "…playwright/package.json…exports"` → ["…","./test"]. ·
   Source: brief §3.3, §3.7.

## 2026-10-14 — Milestone 1A

No code changes to extracted canon. Pre-authorized fixes: none apply to 1A.
`npm run typecheck` and `npm run build` passed on the first run with zero
edits.

Observations (NO change made — recorded for the Lead):

- O1 · 1A · src/test/Milestone1A_TestHarness.tsx · The canon harness's
  badge/console detail strings contain several template interpolations that
  lost their `$` (e.g. `P.x={ticks}`, `{simTime.toFixed(3)}`,
  `maxLocal={f2(avg)}ms`). They are syntactically valid template literals
  (literal brace text), affect only cosmetic detail text, and the acceptance
  prefix `[Milestone1A] acceptance PASSED` is intact — the gate regex
  matches, all five rows evaluate from real values. Extracted VERBATIM; no
  fix attempted (not a build/type error, not a failing row). · Source:
  Milestone 1A.txt lines ~1366–1402.
- O2 · 1A · page console · One harmless 404 (`Failed to load resource`) —
  Chrome auto-requests /favicon.ico; no favicon is linked. Cosmetic only.

## 2026-10-14 — Protocol install (Lead directive)

7. 2026-10-14 · protocol · AGENT_BRIEF.md · Created at repo root — the full
   ZCode Agent Brief copied VERBATIM (byte-copy) from the original session
   paste (this session received the brief in context, STEP 0 case 2), then
   §10 MULTI-SESSION RESUME PROTOCOL appended verbatim per APPENDIX A. No
   other change to the brief text. · Lead directive "install the
   multi-session continuity protocol". · Evidence: 389-line paste → 389-line
   copy (wc identical), +47 lines after §10 append. · Source: Lead directive
   2026-10-14; brief §10.4 amendment log.

8. 2026-10-14 · protocol · notes/ (tree), notes/CHANGES.md (this file),
   notes/reports/ · Created the §10 state-carrier tree at the repo root;
   relocated the change log from game/notes/CHANGES.md (git mv; contents
   unchanged except this header note and the entries below). · The §10
   protocol defines root-level notes/ as the canonical carrier location. ·
   Evidence: git mv d849d6b→this commit. · Source: brief §10, Lead
   directive STEP 3.

9. 2026-10-14 · protocol · notes/STATE.md · Written from reconciled reality
   (git log, branch list, filesystem evidence, M1A gate output), not
   placeholders; includes the four seeded APPROVAL LEDGER entries and this
   session's SESSION LOG row. · Lead directive STEP 4. · Evidence: see
   STATE.md ANCHOR. · Source: brief §10.1, Lead directive STEP 4.

10. 2026-10-14 · protocol · WIP commit d849d6b · All session-1 work (game/
    scaffold + 1A extraction + gate + e2e + tooling, 18 files, 4270
    insertions) committed as "WIP: preserved by protocol install" BEFORE any
    protocol file was staged — never discarded, never reset. · Lead
    directive STEP 1. · Evidence: git log d849d6b. · Source: brief §10.1
    write discipline; directive STEP 1.

11. 2026-10-14 · 1A · notes/reports/M1A.md · Milestone 1A report (§8.6)
    persisted to the reports tree per §10 — evidence must outlive its
    session. Content identical to the report delivered in chat; output
    blocks verbatim. · Lead directive §10 state carriers. · Evidence: file
    created this commit. · Source: brief §10, §8.6.

## 2026-10-14 — Milestone 1B (stopped at step 2)

12. 2026-10-14 · 1B/step0 · notes/reports/M1B.md · F6 pre-scan executed
   read-only over all seven canon files; table + exact 1C anomaly source
   recorded. No canon touched. · Lead-ordered pre-scan. · Evidence: commit
   fc3368c. · Source: Approval Ledger 2026-10-14; AGENT_BRIEF.md §10.4.

13. 2026-10-14 · 1B/step1 · game/src/core/orbit/*, game/src/core/simulation/
   SimulationCore.ts, game/src/test/Milestone1B_TestHarness.tsx · Extracted
   5 blocks verbatim (2393 lines); parenthetical invariant held (exactly one
   match — the sanctioned SimulationCore overlay, 395→486 lines; setSimTime/
   fastForward/reverse/getCelestialStates verified). · §8 loop step 1. ·
   Evidence: extraction report in notes/reports/M1B.md; commit 1d302df. ·
   Source: brief §4, §7-1B.

14. 2026-10-14 · 1B/step2 · src/test/Milestone1B_TestHarness.tsx (NO change
   made) · F6 verdict check: token `${allPass ? …}` intact at L655 — no
   repair applied. Typecheck then failed on TWO canon syntax defects beyond
   F6 scope: badge-detail nested template missing `$` (extracted L466 =
   canon 1734) and HUD fmtSimTime ternary missing `$` AND else-branch
   (extracted L998 = canon 2266). Both in F6-FORBIDDEN string classes →
   hard stop, exact sources pasted to the Lead in notes/reports/M1B.md §3. ·
   Change policy §6 + F6 ratification stop clause. · Evidence: tsc output
   (TS1109/TS1128/TS1005) pasted in report. · Source: AGENT_BRIEF.md §10.4
   F6; §6.

## 2026-10-14 — Milestone 1B continued (F7 applied per Lead ruling)

15. 2026-10-14 · 1B/step3 · game/src/test/Milestone1B_TestHarness.tsx ·
   F7a APPROVED: L466 badge detail — inserted `$` before `{maxPosErr`
   (one character; nested backtick legal inside the outer `${…}`).
   F7b APPROVED: L998 fmtSimTime — `p2` completed with else branch
   (`` (v < 10 ? `0${v}` : `${v}`) ``) and `$` restored on `{d}`/`{p2(m)}`
   at L999 per the mandatory rule. No other byte changed. · Canon defects
   ruled authorship errors; both lines were F6-forbidden classes → repaired
   only under F7 authorization. · Evidence: typecheck went from 3 errors
   (TS1109/TS1128/TS1005) to clean; cascades L470/L661 cleared. · Source:
   Lead ruling 2026-10-14 (F7a/F7b/F7c); AGENT_BRIEF.md §10.4.

16. 2026-10-14 · protocol · AGENT_BRIEF.md §10.4 · Logged the systemic
   pre-scan rule (backtick+`{` fingerprint; single-armed ternary adjacent to
   template literal → route to Lead, never F6-repair; cosmetic stat-string
   strips restorable on encounter, logged) and F8 (1C verdict addendum to be
   authored by the Lead; assembler supplies the verbatim 1C harness tail;
   1C gated until then). · Lead rulings are the frozen carrier's content. ·
   Evidence: §10.4 entries. · Source: Lead ruling 2026-10-14.

17. 2026-10-14 · 1B/step4 · game/e2e/m1b.spec.ts (created), game/tools/
   diag-m1b.mjs (created) · Wired the 1B gate (20 s budget) and ran both
   gates. 1A regression: PASSED 5/5 on the overlaid core. 1B gate: TIMEOUT —
   diagnosed via DOM/console/CDP probes: runSuite() self-deadlocks on the
   canon auto-run path (pre-publish `started:true` triggers runSuite's
   reentrancy guard; suite never executes; RE-RUN button equally dead).
   Canon defect → routed to Lead as F9 (proposal: delete the single
   pre-publish line, canon 2228). No engine code changed. · §6 + systemic
   pre-scan rule. · Evidence: M1B.md §Step 4 (DOM state, RESPONSIVE main
   thread, canon 1656/2226 quotes). · Source: Lead ruling 2026-10-14 (F7);
   brief §6.

18. 2026-10-14 · 1C (pre-scan) · notes/reports/M1C-canon-tail.txt,
   notes/reports/M1C-canon-suite-tail.txt · Persisted the Lead-requested
   verbatim last-80-lines (canon 2245–2324) plus a supplement (canon
   1800–1945: suite results assembly, anomalous verdict line, store head).
   NEW canon defect found: canon 1902 `seamless': {` — results key lost its
   opening quote (syntax error, blocks 1C compile independently of the F8
   verdict addendum). Routed. · F8 ruling asked for the tail; defect
   discovered while supplying it. · Evidence: byte-verbatim extracts. ·
   Source: Lead ruling 2026-10-14 (F8).

## 2026-10-15 — Milestone 1B completion (F9 + 1C-CP per Lead ruling)

19. 2026-10-15 · 1B/step5 · game/src/test/Milestone1B_TestHarness.tsx ·
   F9 AUTHORIZED AND APPLIED: deleted the single line
   `publishSuite({ started: true });` from the auto-run block (was extracted
   L961 after the F7 line-count shift). Nothing else touched — guard, suite
   body, results, criteria verbatim. Classification: authorial canon bug,
   1B-only, 1C–1G verified unaffected; acceptance-neutral (PENDING vs
   RUNNING chip for the first 0.75 s). · Removes the self-deadlock: auto-run
   now passes the reentrancy guard, runs synchronously, publishes once at
   completion; RE-RUN passes because done=true. · Evidence: typecheck +
   build clean after deletion; gate output below (M1B.md §Step 5). · Source:
   Lead ruling 2026-10-15 (F9); AGENT_BRIEF.md §10.4.

20. 2026-10-15 · protocol · notes/patches/1C-CP.md (created) · 1C-CP
   addendum persisted VERBATIM as delivered: ITEM 1 = 1C verdict console.log
   full replacement text + application rule; ITEM 2 = canon-1902 `seamless'`
   opening-quote restoration. TO BE APPLIED AT 1C EXTRACTION TIME. · Lead
   dictated; assembler must not synthesize 1C content. · Evidence: file
   byte-transcribed from the ruling. · Source: Lead ruling 2026-10-15; §10.4.

21. 2026-10-15 · protocol · AGENT_BRIEF.md §10.4 · Standing damage protocol
   recorded: families (A) $-stripping in template literals, (B) quote loss
   on object keys; typecheck gate catches B per extraction; every NEW
   instance = stop-and-route; no blanket pre-authorization beyond F6, F7,
   1C-CP ITEM 1/2. · Ruling carrier. · Evidence: §10.4 entries. · Source:
   Lead ruling 2026-10-15.

## 2026-10-15 — Milestone 1C (extraction + ruled patches)

22. 2026-10-15 · 1C/step1 · game/src/core/terrain/*, game/src/workers/
   terrainWorker.ts, game/src/render/TerrainMeshPool.ts,
   game/src/test/Milestone1C_TestHarness.tsx · Extracted 6 blocks verbatim
   (2180 lines); ZERO parenthetical matches (invariant intact — 1B's
   SimulationCore remains the only one). · §8 loop step 1. · Evidence:
   extraction report. · Source: brief §4, §7-1C.

23. 2026-10-15 · 1C/step2 · game/src/test/Milestone1C_TestHarness.tsx ·
   Applied at extraction time per Lead order, in order: 1C-CP ITEM 2
   (`seamless': {` → `'seamless': {` — family-B quote loss; NOTE: canon line
   is 1894, not 1902 as earlier estimated — corrected on full read);
   1C-CP ITEM 1 (verdict console.log replaced byte-exact with the addendum
   text — structural diff, so whole-statement replacement per the
   application rule); F5 (deleted the `void m;` no-op guard line in the
   WIREFRAME onClick — canon's own closing note sanctions it). No other byte
   changed. · Typecheck immediately after: CLEAN. · Evidence: tsc pass;
   patch sites verified. · Source: Lead ruling 1C-CP (2026-10-15), F5
   (brief §4), ruling step 3c ordering.

24. 2026-10-15 · 1C/step3 · game/e2e/m1c.spec.ts (created earlier),
   game/tools/diag-spherify.mjs + game/tools/diag-m1c.mjs (created) · 1C
   gate FAILED on `seamless` (parentVerts=0, roundtripErr 4.2e-1); full
   diagnosis to root cause with protocol-level proof; BOTH defects routed
   to the Lead (F10a/F10b) — no unauthorized fixes. 1A/1B regression GREEN. ·
   §6 + standing damage protocol (new defect class: authorial race/test-
   contract bugs → route like F9). · Evidence: notes/reports/M1C.md §3–5. ·
   Source: brief §6; Lead rulings F9/standing protocol.

25. 2026-10-15 · 1C/step4 · game/src/test/Milestone1C_TestHarness.tsx,
   game/src/workers/terrainWorker.ts · F10a + F10b applied per Lead ruling
   (9b4afdf): (a) spherifySelfTest check() now compares the round-tripped
   output against the NORMALIZED input direction — criterion, 2048 random
   probes, and fixed probes unchanged; (b) the worker req handler transfers
   the request array on the LAST response of the batch (chunk or drop path)
   — all reads happen while worker-owned; requirements (a)–(d) of the ruling
   preserved. · Authorial canon defects confirmed from authorship. ·
   Evidence: post-fix probe (ACTIVE plateau 93–96, parentVerts 6,061 at 40 s,
   rt=1.1e-13, req'd 1093 = resps 1093) and gate PASSED. · Source: Lead
   ruling 2026-10-15 (F10a/F10b).

26. 2026-10-15 · 1C/step5 · (no code change) · 145-vs-146 investigation
   closed as authorial miscount: the far shell sphere (radius 4100) is
   frustum-culled every frame — camera pitch 15.52° down + half-fov 31°
   puts the bottom frustum plane 46.52° below horizontal; the nadir-pointing
   shell (angular radius arcsin(4100/6500)=39.12°) misses it by 4.36° for
   the entire flight → never draws → never registers. True count = 144 pool
   + stars = 145 exactly, constant. Observation also routed: worker 1 idle
   (canon pump drains the shared queue at w=0 first; efficiency artifact;
   all criteria pass). · Ruling item 4 (report-only). · Evidence: M1C.md §5,
   probe wfree W1=96 constant. · Source: Lead ruling 2026-10-15.

## 2026-10-15 — Milestone 1D (extraction + F4)

27. 2026-10-15 · 1D/step1 · game/src/core/physics/atmosphere.ts,
   game/src/core/physics/aerodynamics.ts, game/src/core/physics/
   flightController.ts, game/src/test/Milestone1D_TestHarness.tsx ·
   Extracted 4 blocks verbatim (2182 lines); ZERO parenthetical matches
   (invariant intact). · §8 loop step 1. · Evidence: extraction report. ·
   Source: brief §4, §7-1D.

28. 2026-10-15 · 1D/step2 · game/src/core/physics/flightController.ts ·
   F4 applied: deleted the single leftover line
   `const _segP0x: number[] = [0]; // boxed scalars avoided — use plain
   module lets:` (canon 622 / extracted 249); the live state is the
   `let segP0x…` module block immediately after it. No other byte changed.
   Typecheck immediately after: CLEAN. · Pre-authorized fix per brief §4. ·
   Evidence: tsc pass. · Source: brief §4 F4; Lead directive 2026-10-15.

29. 2026-10-15 · 1D/step2-ERRATUM + step3 · game/src/core/physics/
   flightController.ts, game/src/test/Milestone1D_TestHarness.tsx ·
   CORRECTION: commit 02b313c's message claims "typecheck clean" — FALSE;
   the check was masked by a pipe (tail's exit status). Actual tsc result:
   3 strict-TS errors, the FIRST canon strict-mode failures (1A–1C were
   clean). All three are type-level only, runtime-neutral, fixed minimally
   under §6 MAY-fix ("type errors"): (a) flightController update() —
   write-through guard extended to `this._wtPos !== null &&
   this._wtVel !== null` (both set together in attachWriteThrough; TS
   cannot narrow one from the other) — canon 740; (b)+(c) harness phase
   comparisons cast `(script.phase as Phase)` at canon 1971 and 1974–5 —
   runBurn() legitimately sets phase='DONE' mid-chain, invisible to TS
   property narrowing; runtime untouched. Typecheck + build re-verified
   with UNPIPED exit codes: both 0. · Evidence: this entry; tsc log. ·
   Source: brief §6.

30. 2026-10-15 · 1D/step4 · (no code change) · 1D gate FAILED on 2 rows;
   diagnosed, routed (F11/F12 proposals). T3 drag-continuity: maxDv=10.30
   vs bound 8 — independent integration of the ratified β_q=3.2e-3 dive
   gives v@1km=262 (observed 264.7 ✓) and peak per-tick Δv ≈ 10.3–10.4
   (~60 g at the ρv² max near 3–4 km; entry overshoots v_safe BY DESIGN);
   the author's prose (310–345 arrival, 17 g / 2.8 m/s per tick, +0.2%
   overshoot) is inconsistent with their own shipped constant — the bound
   8 is an authorial miscalibration. T5 integration: GL geometries step
   150→151 at dive start (MutationObserver trace) — the far shell sphere
   enters the frustum for the first time when the camera looks down the
   nadir at 10 km and registers mid-run; primeAll covers only pool meshes,
   so the static shell's registration is view-dependent → geoMin(150) ≠
   geoMax(151) → constancy fails. Both are acceptance-logic calibrations →
   Lead only. Regression 1A/1B/1C GREEN. · §6 (may NOT touch acceptance
   logic) + F9/F10 routing precedent. · Evidence: notes/reports/M1D.md §3–4,
   diag traces. · Source: brief §6; Lead directive 2026-10-15 (1D).

31. 2026-10-15 · 1D/step5 · game/src/test/Milestone1D_TestHarness.tsx ·
   F11 + F12 applied per Lead ruling: (F11a) drag-continuity pass criterion
   `maxDv <= 8` → `maxDv <= 12`; (F11b) detail prose replaced with the
   corrected physics (bound 12 — peak entry decel ≈ 63 g ≈ 10.4 m/s/tick at
   the ρ·v² max near 2.5–3 km, transiently above a_struct BY DESIGN; the
   extracted detail string was intact — no F6 restoration needed);
   (F12a) shell Mesh captured as module const `shellMesh`; (F12b)
   `shellMesh.frustumCulled = false` after pool.primeAll(); (F12c) restored
   to true at unprime. No other bytes changed. · Authorial calibrations
   corrected on the record (bound 8, "17 g = 2.8 m/s/tick", "+0.2%
   overshoot" — g at 3R = 1.09 m/s² < entry drag 3.79, peak displayed
   2,000.0); β_q = 3.2e-3 RATIFIED and vindicated. · Typecheck + build:
   TSC_EXIT=0 BUILD_EXIT=0, observed unpiped per the new standing rule. ·
   Source: Lead ruling 2026-10-15 (F11/F12).

32. 2026-10-15 · protocol · game/tools/diag-spherify.mjs, diag-m1c.mjs,
   diag-m1d.mjs · Committed and pushed the three forensic-diagnostic probes
   (previously untracked scaffolding; diag-m1b.mjs already tracked since
   aca7047). The user EXPLICITLY GAVE PERMISSION for these files to be
   committed and pushed to GitHub (home-PC access via pull). No engine or
   canon content; read-only observation tools cited as evidence in
   notes/reports/M1B–M1D. · User authorization 2026-10-15. · Evidence: this
   commit. · Source: user (Lead) direct instruction.

## 2026-10-16 — Milestone 1E (extraction + fixes)

33. 2026-10-16 · 1E/step1 · game/src/core/physics/sphericalFrame.ts,
   game/src/core/physics/astronautKCC.ts, game/src/test/
   Milestone1E_TestHarness.tsx · Extracted 3 blocks verbatim (2871 lines:
   249 + 1096 + 1526); ZERO parenthetical matches (invariant intact — 1B's
   SimulationCore remains the only one). · §8 loop step 1. · Evidence:
   extraction report. · Source: brief §4, §7-1E.

34. 2026-10-16 · 1E/step2 · game/src/test/Milestone1E_TestHarness.tsx ·
   F13 PRE-AUTHORIZED, applied: canon ~2377 / extracted 929
   `mulberry32(0x51ope5 as unknown as number || 0x5109e5)` — invalid hex
   literal (`o`, `p` not lexable) — entire argument replaced with the
   fallback-proven seed: `const rand = mulberry32(0x5109e5);`. No other byte
   changed. · Authorial syntax error, confirmed from authorship (the `||
   0x5109e5` fallback proves the intended seed). · Evidence: grep found
   exactly one occurrence. · Source: Lead directive 2026-10-16 (F13).
   F1 CHECKED AND VACUOUS: grep for `require(` in the extracted harness
   found ZERO occurrences — the canon harness calls the top-level imported
   `terrainNormalInto` directly (import at extracted L50–53 already includes
   it); there is no shim to replace, so F1's ESM intent is satisfied
   as-extracted and the build cannot break from require(). Documented, not
   "skipped". · Source: brief §4 F1; directive item 3c.

35. 2026-10-16 · 1E/step2 · game/src/core/physics/astronautKCC.ts,
   game/src/test/Milestone1E_TestHarness.tsx · TWO strict-TS type-error
   repairs under §6 MAY-fix ("type errors"), both type-level only,
   runtime-neutral: (a) astronautKCC update() write-through guard
   `if (this._wtPos !== null)` → `if (this._wtPos !== null &&
   this._wtVel !== null)` (extracted 430 = canon ~775; _wtPos/_wtVel are set
   together in attachWriteThrough so TS cannot narrow one from the other —
   the identical pattern ratified in the 1D erratum, dc55895 fix (a));
   (b) harness L195 `Math.SQRT1_3` (nonexistent Math constant — TS2551 ×3;
   in loose JS it would be `undefined` → NaN angle → the face-walk corner
   row could never pass) → `1 / Math.sqrt(3)` ×3, the author's documented
   intent (the unit corner (1,1,1)/√3 per canon §3 comment and §1.1/§1.4
   prose; unit vector restored: 3·(1/√3)² = 1). · Evidence: tsc 6 errors
   (TS2531 ×3, TS2551 ×3) → TSC_EXIT=0 unpiped after the two edits. ·
   Source: brief §6; 1D erratum ratification precedent (§10.4).

36. 2026-10-16 · 1E/step2 · (NO change made — ROUTED per standing damage
   protocol) · NEW family-A instance found in the extracted harness L1015
   (canon ~2462–2463), slope-step row (b) detail string: the template
   literal segment `` `{vEnd.toFixed(1)} m/s downhill (displacement 100%
   downhill: ` + `` is missing `$` before `{vEnd.toFixed(1)}`. This is a
   BADGE-DETAIL string — the F6-FORBIDDEN class — and F7/1C-CP cover 1B/1C
   only, so per the standing protocol it is STOP-AND-ROUTE: not repaired;
   awaiting the Lead's authorization for the one-character `$`
   restoration. Verdict-neutral: syntactically valid (literal braces),
   pass logic reads S.ok computed from climbOk/descGrounded/slideOk/
   blockOk/cliffOk, never the detail text. · Standing damage protocol
   (§10.4, 2026-10-15): every NEW instance of family A = stop-and-route. ·
   Evidence: grep `` `{ `` — exactly one match in all three 1E files. ·
   Source: AGENT_BRIEF.md §10.4 standing damage protocol; directive 5.d.

37. 2026-10-16 · 1E/step3 · game/src/main.tsx, game/e2e/m1e.spec.ts (created) ·
   Registered `?page=m1e` in the static page map (own chunk verified:
   Milestone1E_TestHarness-DCd2LQg4.js); wired the 1E gate (90 s budget,
   §3.7 pattern). Typecheck + build re-verified with UNPIPED exit codes:
   TSC_EXIT=0 BUILD_EXIT=0. · §8 loop step 3. · Evidence: this commit. ·
   Source: brief §3.2, §3.7, §7-1E.

38. 2026-10-16 · 1E/step5 · (NO code change) · 1E gate FAILED on 4 rows
   (face-walk, slope-step, state-machine, coriolis; zero-gc and integration
   PASS) — full regression 1A/1B/1C/1D GREEN in the same serial run
   ("4 passed (1.9m)"). All four diagnosed to root cause; ALL ROUTED to the
   Lead, nothing touched: (1) coriolis — the canon jump is STRUCTURALLY DEAD:
   integrateTick clears `this.input.jump` (canon 812 / extracted
   astronautKCC 467) BEFORE _groundedTick reads it (canon 932 / extracted
   587), so airTicks = 0 and the SPEC-CANONICAL row measures a grounded
   tick; (2) state-machine — the harness's independent VEHICLE verify
   composes the WORLD attach offset (0,2,0) as if parent-frame
   (extracted 788), but attachVehicle correctly stores R_att⁻¹·(0,2,0)
   (extracted astronautKCC 296–311) — constant 0.2565 m verification error,
   KCC self-consistent (detach check passes at 0.0e+0); (3) face-walk —
   authorial calibration vs real terrain: faceChanges 1 < 2 (pathLen budget
   consumed by unrestricted vertical climbing before the second boundary)
   and max per-tick up rotation 2.145° > 1.15° bound; PLUS a detail-string
   bug: deg(minCornerAngle) applies acos to an already-angular value — the
   ACTUAL closest approach 0.0143 rad PASSES (< 0.06) but prints 89.18°;
   (4) slope-step — authorial calibration/measurement on the engineered
   field: moderate maxSlide 5.275 > 0.05 (walk crosses >45° patches near the
   20° site), steep displacement-downhill ratio 0.00 and uphill sprint net
   2.13 > 0.3 (wall-slide zigzag), cliff minAGL −0.091 < −0.05 (Lipschitz
   transient, detected + landed), and alt0 read from STALE pre-swap
   telemetry (teleportSurface does not fill telemetry; climbGain 103.3 m is
   cross-field contamination). Scan params + STEEP TerrainParams pasted in
   notes/reports/M1E.md per watch item 5.b. · §6 (may NOT touch acceptance
   logic) + F9/F10/F11 routing precedent + standing damage protocol. ·
   Evidence: notes/reports/M1E.md §3–5 (verbatim gate output + diag scrape).
   · Source: brief §6; directive 5.b/5.d.

## 2026-10-16 — Milestone 1E (F14–F17 applied per Lead ruling + re-run)

39. 2026-10-16 · 1E/fixes · game/src/core/physics/astronautKCC.ts (F14),
   game/src/test/Milestone1E_TestHarness.tsx (F15/F16/F17/$-strip),
   game/tools/diag-m1e-field.mjs + ts-resolve-loader.mjs (F17b probe),
   game/tools/diag-m1e-core.mjs (attribution) · ALL SIX RULINGS APPLIED
   EXACTLY AS SPECIFIED (Lead ruling 2026-10-16, all confirmed authorial):
   **F14 — THE FIRST CORE-BEHAVIOR EDIT** (7947369): the jump-consumption
   line moved from BEFORE the mode dispatch (canon 812 / extracted 467) to
   immediately AFTER it (before hysteresis); edge-trigger preserved;
   _flightTick never reads input.jump; airborne presses buffer to the
   landing tick. Flagged for 1G: re-grep the §3.5 patch application against
   the moved line (no overlap, but verify). F15 (e689d4c): runStateMachine's
   independent VEHICLE check now composes the PARENT-FRAME offset —
   `rotateByQuatConjInto(prov.quat, 0, 2, 0, offP)` captured once at
   attach-time quat before the loop (harness computes it; KCC private state
   not read); dead `const tx…/void tx;` deleted; inner `off` replaced by the
   captured `offP`. F16a: face-walk budget 11,600→13,600 AND cap
   95,000→140,000 (both, per ruling). F16b: `cos(0.02)`→`cos(0.06)` +
   detail "(bound 1.15°)"→"(bound 3.44°)". F16c: corner print
   `deg(F.minCornerAngle)`→`(F.minCornerAngle*180/Math.PI)`. F17a: alt0 and
   climbGain end-read both `Math.hypot(pLocal)−5000` (telemetry stale).
   F17b: STEEP recalibrated (mountainFreq 3.0, mountainAmp 2200, detailFreq
   8, detailAmp 3) + scanFor optional neighbor predicate + uniformAround()
   (8 compass probes at 3 m arc; moderate <35°, steep >45°, cliff >60°);
   probe verdict: FINAL mountainAmp = 2200 — moderate@try49 (25.9°), steep@
   try12 (60.2°), cliff@try4 (73.2°), >70° class = 17.96% of the sphere;
   +200 escalation NOT needed. $-strip: `$` restored at the slope-step
   detail string. Typecheck + build UNPIPED: TSC_EXIT=0 BUILD_EXIT=0. ·
   Lead ruling 2026-10-16 (items 1–5, 7a–b). · Evidence: commits 7947369,
   e689d4c, dd3e97a; probe output in M1E.md §3.

40. 2026-10-16 · 1E/step7c · (NO code change) · RE-RUN: 1E gate FAILED on 3
   rows (badges ["PASS","FAIL","FAIL","PASS","FAIL","PASS"]); full
   regression 1A/1B/1C/1D GREEN ("4 passed (1.9m)"). F14/F15/F16/F17a-b
   VINDICATED: face-walk now PASS (2 face changes, corner prints 0.82°, up
   2.145 ≤ 3.44); vehicleErr 0.0e+0 (< 1e-9 — was the constant 0.2565);
   zero-gc PASS WITH F14 LIVE (real jumps in the 30k burn; identities ✓,
   heap 0 B, NaN 0); slope-step moderate+steep+cliff-net criteria all PASS
   on the new field (climbGain 4.9 vs expected 4.4 direct-read, slide
   0.000, t30=5, vEnd 10.3, ratio 1.00, uphill 0.11, cliff net 0.02).
   THREE REMAINING FAILURES — ALL ROUTED, NOTHING TOUCHED (per the ruling's
   stop-and-route terms): (1) coriolis airTicks 0 — NEW CORE DEFECT EXPOSED
   BY F14: the launch branch composes absPos at the ADVANCED θ_new while
   _sweep's tick-start embed check probes terrain at θ_prev — probe
   direction mis-rotated by exactly Ω·dt = 0.867 m at the equator → embed
   hit → _landAt(θ_prev) re-plants ~0.87 m EAST within the launch tick
   (westDrift −85.22 cm; perp 1.20 cm; Node tick-1 trace: grounded=true
   immediately). Fix options belong to the Lead (core edit #2 — e.g.
   compose the launch at θ_prev, physics-neutral: planet-frame trajectory
   unchanged, only world-frame bookkeeping consistency with the sweep).
   (2) state-machine landed=false — the canon 20,000-tick deorbit cap is
   too small for the real free-fall (Node trace: tick 19,999 at r=12,551 m,
   v=146 m/s, still airborne; analytic landing ≈ tick 22,400; every OTHER
   criterion passes incl. vehicleErr 0.0e+0). (3) cliff-row minAGL −0.206 —
   CROSS-ROW CONTAMINATION: the criterion reads the global
   integrity.minAGL accumulator, which the zero-gc burn's phase-3 deorbit
   landing bisection lowered BEFORE runSlopeStep ran (Node full-sequence:
   tick 20,590, mode SURFACE, −0.1119; browser −0.206 — same transient
   class, ulp-level V8 divergence in the chaotic 30k-tick trajectory); the
   cliff sprint itself NEVER goes airborne (no minAGL drops in the
   verbatim (a)/(b)/(c) replication; firstAirborneTick=null) — value
   outside the pre-authorized [−0.15,−0.05) window → routed per ruling.
   · §6 + the ruling's stop-and-route terms. · Evidence:
   notes/reports/M1E.md §4–5; game/tools/diag-m1e-core.mjs (2d7bf7f). ·
   Source: Lead ruling 2026-10-16 (items 7c, 8).

41. 2026-10-16 · 1E/fixes-2 · game/src/core/physics/astronautKCC.ts (F18),
   game/src/test/Milestone1E_TestHarness.tsx (F19/F20),
   game/tools/diag-m1e-core.mjs (rewritten as the post-fix verifier) ·
   RULINGS R1/R2/R3 APPLIED EXACTLY AS SPECIFIED. **F18 — CORE EDIT #2**
   (37a4c9e; flagged alongside F14 for the 1G §3.5 re-grep): (a)
   _composeGrounded gains an optional spin phase
   (theta = this._theta default — all 3-arg call sites unchanged), first
   line spinQuatInto(theta, _qSpin); (b) the jump branch composes P AND
   rotates the launch velocity at θ_prev; _flightTick(dt, true); (c)
   _flightTick(dt, launchTick = false) passes through to _sweep; (d) _sweep
   gains launchTick = false and guards the tick-start embed check with
   `!launchTick`. Rationale ON RECORD: every normal flight tick's start
   position corresponds to θ_prev; the launch compose at θ_new corresponded
   to NO physical instant and double-counted one tick of transport (the
   0.87 m phantom = the −85.22 cm); the guard removes the embed check's
   ~3e-14 m compose/decompose-round-trip ulp coin-flip at launch (launch
   AGL is EXACTLY groundClearance by construction; the check exists for
   prior-tick transients and is semantically inapplicable at launch);
   mid-sweep sampling untouched (the launch segment ascends
   monotonically). F19 (7d77e52): deorbit cap 20,000 → 26,000. F20
   (7d77e52): runSlopeStep resets kcc integrity stats as its FIRST
   statement (the cliff criterion measures only its own window) + the
   authorized 'n/a (never airborne)' Infinity print; the F17c conditional
   relaxation is MOOT (post-reset minAGL = +∞). VERIFICATION per ruling 4b:
   Node FIRST (diag-m1e-core.mjs): coriolis airTicks=61, west 0.75 cm
   (window 0.6–6; theory 1.69), perp 1.18 cm (<1.2), settle 1 tick,
   maxSettle 0.0000; state-machine landed=true at tick 22,307 (<26,000),
   vehicleErr 0.0e+0, detachDv 0.0e+0, NaN 0; slope-step minAGL +Infinity
   (never airborne), all bounds pass. Then the browser: TSC_EXIT=0
   BUILD_EXIT=0 PLAYWRIGHT_EXIT=0 — `[Milestone1E] acceptance PASSED`
   6/6 badges + full 1A/1B/1C/1D regression GREEN ("5 passed (1.9m)") —
   browser and Node agree number-for-number. · Lead ruling 2026-10-16
   (R1/R2/R3 = F18/F19/F20). · Evidence: notes/reports/M1E.md §3–4. ·
   Source: Lead ruling 2026-10-16; brief §6 (evidence-backed fix path).

## 2026-10-16 — Milestone 1F (extraction + F3 expanded + F21)

42. 2026-10-16 · 1F/step1 · game/src/core/render/impostorMath.ts,
    game/src/render/SkyImpostorPool.ts, game/src/render/MultiCameraRig.tsx,
    game/src/test/Milestone1F_TestHarness.tsx · Extracted 4 blocks verbatim
    (2404 lines: impostorMath 171, SkyImpostorPool 326, MultiCameraRig 217,
    harness 1690); ZERO parenthetical matches (invariant intact — 1B's
    SimulationCore remains the only one); the defensive layeredCameras
    discard did NOT trigger (zero canon matches). PURITY VERIFIED:
    impostorMath.ts imports ONLY `rotateByQuatConjInto, type Quat` from
    '../physics/sphericalFrame' — no three/react/rapier (brief §5). DRIFT
    NOTE: a prior session had extracted these files uncommitted and begun
    F3 application; its harness copy differed from verbatim canon (hash
    00d95df3… vs the verbatim 6d56bb0f…; the other three were
    byte-identical) and was overwritten by the re-run — nothing unique
    lost (F3's replacement content is fully specified by the directive;
    re-applied below); no APFS snapshot or backup copy existed. · §8 loop
    step 1. · Evidence: extraction report + before/after hashes. · Source:
    brief §4; directive 2026-10-16 item 3.b.

43. 2026-10-16 · 1F/step2 · game/src/test/Milestone1F_TestHarness.tsx ·
    F3a/F3c/F3b+F21a/F21b applied exactly per the expanded directive:
    F3a — dead slopeDegAt stub function + its `void slopeDegAt;` line
    deleted. F3c — terrainNormalInto added to the top-level terrainField
    import; the require() shim inside slopeFromNormal deleted (F1/F2
    pattern, real this time). F3b+F21a — `lastRebaseCount: 0` added to the
    live object literal; the LIVE-phase push now stores CAMERA-RELATIVE
    offsets (stagedPX/PY/PZ − drvLocal.x/y/z) with
    `rebased: core.stats.rebaseCount !== live.lastRebaseCount` and updates
    lastRebaseCount after the push; BOTH vestigial blocks deleted (the
    vacuous `extends never ? 0 : 0` conditional inside the LIVE capture and
    the self-assigning `const st = …` post-hoc block); sunJump bound
    0.02 → 0.05; detail wording per the directive's replacement text — plus
    "world position" → "camera-relative position" so the sentence describes
    the measured quantity (micro-edit flagged to the Lead in the report).
    F21b (arithmetic FIRST, from the extracted constants: ts=6 with the
    5-substep cap → kcc.update AND core.advance run exactly 5 ticks/frame
    in lockstep → LIVE_SECONDS 25 ≈ 125 s sim ≈ ~810–900 m at sprint 6.5 →
    ~1 rebase crossing vs the row's `rebases >= 3` — confirms < 3):
    LIVE_SECONDS 25 → 120, criterion `rebases >= 3` → `>= 2`, detail text
    updated per the directive (each rebase is an independent Δ-lattice +
    sky-invariance sample; 1D's cruise row already carries the 8-rebase
    lattice evidence), Playwright budget 150 s → 240 s. · Lead directive
    2026-10-16 (F3 expanded; F21a semantics/bound; F21b conditional
    calibration). · Evidence: edits + post-fix typecheck (entry 44). ·
    Source: directive item 3.d; AGENT_BRIEF.md §10.4.

44. 2026-10-16 · 1F/step2 · game/src/test/Milestone1F_TestHarness.tsx ·
    THREE strict-TS repairs under §6 MAY-fix ("type errors"), all
    type-level and runtime-neutral: (a) the import list's rigCamFar →
    rigCamNear — the R4 canary (extracted 1198) references rigCamNear while
    canon imported rigCamFar (never used): exactly the directive's
    known-suspect; import list corrected to match usage; (b) moonState
    TS18047 ×3 in applyRenderState → non-null assertions (the boot guard
    throws on null at module scope; TS cannot carry the narrowing into
    function scope); (c) the dead 3-arg setDriverPose call (TS2554,
    extracted 1380) deleted — immediately overwritten by the full 7-arg
    call two lines below; F4 leftover-line pattern. ROUTED-IN-ADVANCE
    (static analysis, awaiting gate confirmation): R4's identityOk reads
    `astroMesh.geometry` (extracted 1218) where astroMesh is a THREE.Group
    — TS2339 blocked the build AND at loose-JS runtime the expression is
    `undefined`, so `identityOk` is false and the zero-gc row cannot pass
    as authored (canon authorship defect class F9/F10a). Runtime-neutral
    cast `(astroMesh as unknown as { geometry?: unknown })` applied ONLY to
    unblock the build — the asserted expression and its runtime value are
    untouched; if the gate confirms the row failure it is routed to the
    Lead (acceptance-logic change = Lead only). · Brief §6; directive item
    3.e. · Evidence: tsc 5 errors → TSC_EXIT=0 unpiped; BUILD_EXIT=0
    unpiped. · Source: brief §6; directive 3.e.

45. 2026-10-16 · 1F/step3 · game/src/main.tsx, game/e2e/m1f.spec.ts
    (created) · Registered `?page=m1f` in the static page map (own chunk
    verified: Milestone1F_TestHarness-BxLi97fs.js, 48.15 kB); wired the 1F
    gate with the F21b budget (240 s wait for the acceptance line).
    Typecheck + build re-verified UNPIPED: TSC_EXIT=0 BUILD_EXIT=0. · §8
    loop step 3. · Evidence: build log (chunk list). · Source: brief §3.2,
    §3.7.

46. 2026-10-16 · 1F/step5 · (NO code change — GATE FAILED, ALL FOUR
    FAILING ROWS ROUTED) · 1F gate: `[Milestone1F] acceptance FAILED`,
    badges ["PASS","FAIL","FAIL","FAIL","FAIL"]; full 1A–1E regression
    GREEN in the same serial run ("5 passed (3.9m)"; PLAYWRIGHT_EXIT=1 on
    the 1F row only). Root causes proven by Node replication
    (tools/diag-m1f-core.mjs) + live browser probe (tools/diag-m1f-browser
    .mjs), nothing touched: **F22** (R2) horizon-cull up = normalize(driver
    LOCAL) instead of the radial normalize(O+local) — |O|≈1,378 m ≈ R, so
    the cull up is 91.6° off at the suite pose; the SUN (true elev +21.7°)
    reads −68.9° → CULLED → sun footprint readback 0 px (row FAIL); sky
    inverted (Uranus active, Venus/Mars/Jupiter culled); the harness's own
    telemetry Earth-elevation path uses the correct radial — two
    inconsistent code paths. **F23** (R3) unit sweep: 20 trips = 10 round
    trips = 20 crossings + 1 initial-state correction = exactly 21 flips vs
    the required 40 (unreachable as written), AND the smoothstep fade's max
    slope 1.5/11,000 = 1.364e-4/m exceeds the 1.1e-4 bound (the bound is
    below the canon function's own max derivative). **F24** (R4)
    identityOk reads astroMesh.geometry on a THREE.Group (nonexistent →
    structurally false; the F9/F10a class — routed in advance at #44; heap
    criteria all PASS: 0 B pure + 0 B render burns). **F25** (R5-rebases)
    the scripted walk cannot reach a rebase crossing: terrain along
    walkFwd is a mountain wall (68° @200 m … 78° @1.2–1.4 km); 600 s sim
    yields 625 m path / 347 m net, bubble locals peak 227 m ≪ 1,024 → 0
    crossings (< 2). F21b's sprint arithmetic assumed clear ground. Walk
    -target/LIVE_SECONDS calibration = Lead. **F26** (R5-geo) geo-constancy
    window opens pre-first-render (onFrame runs before executePasses in the
    same frame → first WARMUP read 0) + WARMUP streaming growth → geoMin=0
    poisoned vs geoMax=107 → geoConst false; F12-class window defect,
    proposed F20-shape reset at the WARMUP→LIVE transition. Cosmetics
    routed per standing damage protocol: **D-1** family-A $-strip in R2's
    detail (canon 1966 `{(coverage * 100).toFixed(1)}` — one character;
    verdict-neutral); **D-2** unmatched paren in the same string.
    Observations: O-1 silhouette window sampled only 8 disk px (probe
    mostly unlit); O-2 R2's per-instance audit samples ONE body ×
    mesh.count (slot-order break); O-3 browser/Node end-of-walk divergence
    (36k ticks ulp) shifts individual bodies across the razor-edge wrong-up
    cull boundary — immaterial post-F22. Renderer health VERIFIED
    non-vacuous: near pass 33 draw calls/frame live; R1 determinism + R5
    straddler byte-zero diffs are real. · §6 (may NOT touch acceptance
    logic) + F9/F10/F11 routing precedent + standing damage protocol. ·
    Evidence: notes/reports/M1F.md §4–6 (verbatim gate output + both probe
    transcripts). · Source: brief §6; directive items 4–5.

47. 2026-10-16 · 1F/tools · game/tools/diag-m1f-core.mjs, game/tools/
    diag-m1f-browser.mjs (created) · Read-only forensic probes cited as
    evidence in M1F.md §6: Node replication of the verbatim 1F boot/spawn/
    walk/cull arithmetic (WALL_SECONDS env to extend the walk), and a
    Playwright page probe of the rig module singletons (camera health,
    stats sampling) against a dev server. No engine or canon content. ·
    User pre-authorization 2026-10-15 for committing diag tooling. ·
    Evidence: M1F.md §6. · Source: diag-m1b…m1e precedent.

48. 2026-10-16 · 1F/ruling · game/src/test/Milestone1F_TestHarness.tsx ·
    Lead ruling 2026-10-16 (F22–F26 + D-1/D-2) applied EXACTLY: F22 —
    `const o = core.getOrigin()` hoisted to the top of applyRenderState
    (single declaration), horizon-cull up replaced by the absolute radial
    `((px+o.x)/L, (py+o.y)/L, (pz+o.z)/L)`, L = hypot(px+o.x, py+o.y,
    pz+o.z); nothing else in the loop changed. F23 — `flips === 40` →
    `=== 21` + detail clause "(21 = 20 threshold crossings + 1
    initial-state correction — deterministic, no thrash)";
    `maxSlope <= 0.00011` → `<= 0.00015`. F24 — the canary term →
    `astroMesh.children.length === 8` (other terms unchanged per ruling).
    F25 — the canon walkFwd IIFE replaced by the 24-azimuth × {25…800 m}
    corridor scan (score = max slopeFromNormal, tie-break max |Δh|;
    rotation axis SPAWN_DIR × t; SAT_A/B/C formulas unchanged after it;
    LIVE_SECONDS untouched). F26 — geoMin/geoMax reset at the WARMUP→LIVE
    transition + geo capture condition LIVE-only. D-1/D-2 — `$` restored
    and paren repaired in R2's detail string. TSC_EXIT=0 BUILD_EXIT=0
    unpiped. · Lead ruling 2026-10-16 items 1–6. · Evidence: second gate
    output (M1F.md §9.2); Node verification (M1F.md §9.1). · Source: Lead
    ruling 2026-10-16.

49. 2026-10-16 · 1F/routing-2 · (NO code change — second gate FAILED on
    R2/R4/R5; THREE NEW ROUTES, all evidence-backed) · Post-fix gate:
    badges ["PASS","FAIL","PASS","FAIL","FAIL"]; regression 1A–1E GREEN
    ("5 passed (3.9m)"). VINDICATED: F22 live-path (9 active instances, Sun
    +47.7° ACTIVE, ideal footprint ≈1,381 px), F23 (R3 PASS: 21 flips,
    0.14/km ≤ 0.15), F26 (geometries constant at 49), D-1/D-2. ROUTED:
    **F27** — lookAt convention mismatch: quatFromFrameInto builds columns
    (fwd, up, fwd×up) = X-forward frame (sphericalFrame:113–123), so the
    harness-local lookAtQuatInto poses (R2 sun, R3 silhouette, R5
    straddle, live TP boom) aim the three.js camera along local −Z =
    −(fwd×up), ~90° from the target, while projectDirectionInto implements
    the documented −Z convention — the Sun RENDERS but on the opposite
    side of the ±42 px scan window (0 px/999 evidence; probe diag-m1f-r2
    .mjs vs the REAL modules: behind=true px=py=0; +0.5° → 69,294 px;
    proposed one-line fix quatFromFrameInto(right, up) VERIFIED dead-center
    640.00/360.00). **F28** — identityOk's second term
    `sky.bodies.length === 11` structurally false: the pool boot-allocates
    capacity-24 slots (length is ALWAYS 24); 11 was the author's ACTIVE
    count; actual active at suite = 9 (7 catalog + 2 probes = R2's "9 live
    instances"). R4 fails solely on this term (heaps 0/0; children === 8
    true). Proposed `=== 24`; Lead's call. **F25c** — per the ruling's own
    conditional: best corridor az 330° at 42.2° > 40° → Node-measured 600 s
    sim = 0 crossings (max bubble component 686.1 < 1,024; 1,321 m path /
    478 m net; 69.7°/72.7° walls beyond 1.2 km; SAT_B at 2.8 km across
    them) → STOP and route, no LIVE_SECONDS self-calibration. Also
    disclosed: R3's silhouette sub-clause sampled a corner window (8 star
    px) — vacuous until F27; R5's straddle byte-zero diffs remain valid
    determinism but likely never framed satB. · §6 + item 9's
    paste-raw-numbers demand + F25c's stop condition. · Evidence:
    notes/reports/M1F.md §9 (verbatim output + probe transcripts). ·
    Source: Lead ruling 2026-10-16 items 4c, 9.

50. 2026-10-16 · 1F/tools · game/tools/diag-m1f-r2.mjs (created) ·
    Read-only convention probe against the REAL sphericalFrame +
    impostorMath modules: replicates lookAtQuatInto verbatim, projects the
    look-target through projectDirectionInto (behind=true, px=py=0 — the
    mismatch), and verifies the proposed right-axis fix (dead-center
    640.00/360.00, behind=false). Evidence for route F27. · User
    pre-authorization 2026-10-15 for diag tooling. · Evidence: M1F.md
    §9.3. · Source: diag tooling precedent.

51. 2026-10-17 · 1F/ruling-3 · game/src/test/Milestone1F_TestHarness.tsx ·
    F27 APPLIED (Lead ruling round 2→3): inside lookAtQuatInto only, the
    quatFromFrameInto call now passes (rx, ry, rz, upx, upy, upz, out) —
    RIGHT instead of fwd — plus the one-line comment "three.js camera
    basis: X=right, Y=up, −Z=forward (F27)". right/up′ computations,
    sphericalFrame, projectDirectionInto, all four call sites, and every
    threshold untouched. · Harness-local authorial defect: quatFromFrameInto
    builds columns (f, u, f×u) so passing (fwd, up′) made local +X the
    forward; a three.js camera looks along local −Z = −(fwd×up) ≈ 90° off
    target while the R2/R3 ground truth (projectDirectionInto) uses −Z.
    With (right, up′), column 2 = right×up′ = −fwd so −Z = fwd — the
    standard lookAt basis (Lead-verified algebra). · Evidence: round-2 gate
    R2 footprint 0 px/center 999 px; Node round-3 (diag-m1f-r2.mjs against
    the REAL edited function): all four poses (TP boom, R2 Sun, R3
    silhouette, R5 SAT_B) project 640.00/360.00 behind=false, 0.000 px
    offset; browser: R2 PASS (footprint 105.5%, center 0.71 px). · Source:
    Lead ruling 2026-10-17 item 3 F27.

52. 2026-10-17 · 1F/ruling-3 · game/src/test/Milestone1F_TestHarness.tsx ·
    F28 APPLIED: identityOk second term only — sky.bodies.length === 11 →
    sky.bodies.length === IMPOSTOR_CAPACITY, with IMPOSTOR_CAPACITY
    imported from the existing SkyImpostorPool module (no literal 24).
    instanceMatrix term, children.length === 8 term (F24), and both heap
    bounds untouched. · The canon pool boot-allocates the full capacity-24
    slot array (bodies.length is ALWAYS 24); 11 was the author's
    active-count expectation (actual 9) — a visibility property R2 already
    audits, not a GC-canary identity. Replaces a never-satisfiable term
    with its stated intent ("pool mesh/attributes/bodies … never
    re-allocated"); does not loosen the gate; same pattern as F24. ·
    Evidence: round-2 R4 failed solely on this term (heaps 0/0, children
    === 8 true); round-3 browser R4 PASS (heaps 0 B/0 B). · Source: Lead
    ruling 2026-10-17 item 3 F28.

53. 2026-10-17 · 1F/ruling-3 · game/src/test/Milestone1F_TestHarness.tsx ·
    F25d APPLIED (user decision, option A of the F25c escalation): the
    walkFwd corridor-scan ARCS widened from [25..800] (7 arcs) to
    [25..2600] (16 arcs, +200 m steps above 800), and the F25 comment now
    reads "flattest 2,600 m corridor (F25d — covers the full walk to SAT_B
    at 2,400 m + margin)". The 24 azimuths at 15°, max-slope score,
    |Δh| tie-break, SAT_A/B/C formulas, SPAWN_DIR/spawn scan,
    LIVE_SECONDS=120, rebases >= 2, the 40° gate, and every R5 term
    untouched. · Selection-input change, not a threshold change: the 800 m
    horizon picked a corridor that runs into ≥69.7° walls before SAT_B at
    2,400 m; the scan now optimizes the full walk. · Evidence: Node
    diag-m1f-core.mjs with F25d ARCS — best 5: az 345° 67.5°, az 270°
    71.0°, az 255° 71.2°, az 120° 71.4°, az 150° 71.6°; SELECTED az 345°
    (67.5° > 40° → MEASURE); 600 s sim 0 crossings (locals max 371.8,
    934.5 m path, 118.8 m net; straight line spawn→SAT_B max slope 80.6°
    at ~863 m) → branch (iii): edit kept, gate run anyway, routed as
    F25e. · Source: Lead ruling 2026-10-17 item 3 F25d.

54. 2026-10-17 · 1F/tools · game/tools/diag-m1f-core.mjs, game/tools/
    diag-m1f-r2.mjs, game/tools/diag-m1f-details.mjs (created) ·
    diag-m1f-core.mjs: ARCS mirrored to the F25d 16-arc list verbatim +
    round-3 instrumentation (crossing timestamps in wall/sim clocks,
    SAT_B distance/bearing from spawn, max slope along the spawn→SAT_B
    straight line, F25d branch determination (i)/(ii)/(iii)).
    diag-m1f-r2.mjs REWRITTEN to execute the REAL edited harness
    lookAtQuatInto — extracted verbatim from the harness source at runtime
    into a self-cleaning temp .ts loaded through the registered TS loader
    (no local copy can drift) — plus a verbatim boot/warmup/LIVE replica
    so the four suite poses (TP boom, R2 Sun, R3 silhouette, R5 SAT_B)
    use real geometry; also prints the Sun disk r/ideal-footprint numbers
    and (F29) the R3 parallax + R5 straddle-ray clearance math.
    diag-m1f-details.mjs created: read-only DOM scrape of the five
    .test-row badge/label/detail strings (per-row evidence the gate spec
    does not print). · Read-only diag tooling, user-pre-authorized
    2026-10-15. · Evidence: M1F.md §10 (probe transcripts). · Source: Lead
    ruling 2026-10-17 items 4b, 4c + diag tooling precedent.

55. 2026-10-17 · 1F/bookkeeping · notes/STATE.md · B-1 APPLIED: the 1F
    ledger row now reads the round-2 ruling as committed in 0b2fae8 (was
    "commit pending"); ANCHOR moved df1e04f → 0b2fae8 (last pushed,
    Lead-verified state); Approval Ledger rows added — F27 APPROVED, F28
    APPROVED, F25c ESCALATED → resolved by the user as option A, F25d
    APPROVED. · Lead instruction item 3 B-1. · Evidence: git log 0b2fae8;
    STATE.md approval ledger. · Source: Lead ruling 2026-10-17 item 3 B-1.

56. 2026-10-17 · 1D/tools (NO harness change) · game/tools/
    diag-m1d-details.mjs, game/tools/diag-m1d-dive.mjs (created) ·
    Read-only evidence probes for the round-3 regression's m1d row-2
    failure (diveGrounded false): details probe scrapes the five 1D
    .test-row strings verbatim; dive probe polls the FLIGHT panel
    SEQUENCE/ALT through DIVE→CRUISE and shows the ship skimming the
    ~900 m mountain at 65.57 m AGL then timing out at the 45 s cap
    still airborne (~386 m AGL, 78 m/s) — approved run landed (3.38 m).
    All printed row-2 numbers match the approved gate to the digit
    (264.7/10.30/rebases 8/geo 151/0 B); 1D files byte-identical to
    e830759; failure is FPS-dependent (variable-step dive vs wall-scaled
    cap) on this session's slower Chrome — classified environment-soft
    per the M1A row-5 precedent, NO code changed, routed to the Lead. ·
    Read-only diag tooling, user-pre-authorized 2026-10-15. · Evidence:
    M1F.md §10.5. · Source: brief §7 regression rule + M1A row-5
    environment-soft precedent.
