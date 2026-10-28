# Change log — see AGENT_BRIEF.md §6 for policy

(Solaris Engine Assembly; relocated from game/notes/ to the repo-root notes/
tree by the §10 multi-session protocol install — the state carriers live at
the repo root. Format: date · milestone · file · what · why · evidence · source.)

No canon file (Design_specs/, Milestone/) is ever modified; entries below
touch only scaffolding created by this assembly (brief §3) and, where
applicable, code fixes proven by failing acceptance output.

---

## 2026-10-28 — §1 LEAN READ code rule (Lead ruling, docs only)
- `AGENT_BRIEF.md` §1 LEAN READ (+1 bullet), `notes/STATE.md` APPROVAL LEDGER (+1 row) · why: the code-reading rule lived only in the session starter prompt; moving it into the brief lets that prompt shrink · source: Lead, 2026-10-28.

## 2026-10-28 — §6 END REPORT (Lead ruling, docs only)
- `AGENT_BRIEF.md` §6 (+1 bullet), `notes/STATE.md` APPROVAL LEDGER (+1 row) · why: end-of-session reports ran long because only the start report was capped (§5 step 3, ≤5 sentences) · source: Lead, 2026-10-28.

## 2026-10-28 — §12 OLU use (Lead ruling, docs only)
- `AGENT_BRIEF.md` §12 (+4 bullets), `notes/STATE.md` APPROVAL LEDGER (+1 row) · why: sessions ended at ~25–35 of 50 OLU because units were cut small and the ~40 wrap-up was read as a stop line; the Lead ruled the ~40 mark only reserves ~10 OLU for commit + push · evidence: SESSION LOG stop figures (rows 34–46, 117–136), bot 37d496cf olu_usage ledger (session 138 ≈28 OLU) · source: Lead, 2026-10-28.

## 2026-10-27 — F2fcaba (session 131b): rebuilt m1f R2 gate, rows R2a + R2b
- `game/src/test/M1fR2Gate.tsx` (new page `?page=m1fR2`), `game/src/main.tsx` (+1 static-map entry), `game/e2e/m1f-r2.spec.ts` (new), `game/tools/test-m1f-r2-gate.mjs` (new mutant self-test) · F2f/U27c §2 · why: the shipped m1f R2 row mixes the angular law with Sun visibility at an unchecked pose (ADR-019/020) · evidence `docs/audit/evidence/F2f/cab/` · ADR-021 (amended). No production code, shipped harness row or shipped spec changed.

## 2026-10-27 — F2fa (session 127): m1f R2 bisect
- `game/tools/audit/f2fa-m1f-observe.mjs` (new, read-only observer), `f2fa-observe-both.sh`, `f2fa-r2-bisect.sh` · bisect A1-U01-1 · why: the shipped m1f spec's 240 s wait expires before `c0ae8bf` reaches a verdict on the bot VM (262 s) · evidence `docs/audit/evidence/F2f/a/` (first bad commit for R2 = `3057899`, confirmed) · ADR-018. No harness, spec or production code changed.


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

57. 2026-10-17 · 1F/F30-gate · game/tools/diag-m1f-core.mjs (rewritten) ·
    F30 Node-first gate BEFORE any harness edit: corridorFor/spawnEligible/
    findSpawn mirrored verbatim (as they would land in the harness) + old-
    acceptance pass for comparison + split counters + timed clean pass +
    the full ruled report (candidates/checked/pass(1)/pass(1)+(2), chosen
    index+score, angular distance, Earth elevation old vs new, Sun
    elevation both poses, corridor az+slope, min LOS margin, 600 s KCC
    sim, findSpawn ms). RESULT: GATE FAILS — 24,000 candidates, pass(1)=0
    (the ±0.12 rad ≈ ±160 m jitter patch has NO ≤40° corridor over
    2,600 m), pass(1)+(2)=0, nothing ever replaces best (lazy check ×24,000
    → 32,078 ms), fallback=base with LOS fail −10.6 m at f=0.025; Sun
    ACTIVE both poses; fallback walk 0 crossings/locals 656.3. Per the
    ruling's own stop: F30 harness edit NOT applied; route F30x. ·
    Read-only diag tooling + the ruling's stop condition. · Evidence:
    M1F.md §11.1. · Source: Lead ruling round 4 item 3 F30.

58. 2026-10-17 · 1F/ruling-4 · game/src/test/Milestone1F_TestHarness.tsx ·
    F31 APPLIED: (a) the probe impostor feed computes, per probe, the f64
    vector from the camera to the mesh's actual position
    (PROBE_DIR·d − o − pose) and feeds dir = v/|v|, θ = asin(min(1,
    PROBE_R/|v|)), dist = |v| to sky.setBody (probe B with dB/PROBE_R2) —
    replacing the fixed PROBE_DIR, the d-based θ and d; (b) the R3
    silhouette block aims the lookAt at the probe's ACTUAL position and
    centres the window on the same observer-relative direction. Untouched
    as ruled: the dA/dB drive, all hysteresis/alpha/fade paths, the mesh
    placement, R3 thresholds and the ±80 px window, impostorMath.ts. ·
    The mesh and the impostor are two representations of ONE object; the
    fixed direction only held for an eye at the bubble centre (round-3
    Node: 2.97 px parallax = 64% of a disk radius). · Evidence: TSC/BUILD
    exit 0; Node alignment 0.000 px (gate ≤ 0.25), both radii 4.635 px
    from the true 232,700 m; browser R3 sym 47.69% → 22.22% of a 90-px
    disk (aim fixed; residual rasterization/shading phase noise routed
    F32, do-not-patch honored). · Source: Lead ruling round 4 item 3 F31.

59. 2026-10-17 · 1D/tools (E-1; NO 1D harness/spec/config change) ·
    game/tools/diag-m1d-dive.mjs (extended), game/tools/diag-m1f-details
    .mjs (DIAG_PAGE parameter) · E-1 evidence probes: the dive probe now
    reports the WebGL UNMASKED_RENDERER string and mean FPS (rAF counter)
    and accepts DIAG_CHROME_ARGS for a hardware-accelerated session
    WITHOUT touching the pinned playwright config (E-1 forbids config
    edits). RESULTS: config default = SwiftShader (software) 19.8 FPS on
    ?page=m1d — the ship deterministically misses grounding (4/4 runs);
    --use-angle=vulkan = ANGLE (AMD Radeon Graphics (RADV RENOIR)) 59.8
    FPS — the ship GROUNDS before the 45 s cap (approved-run behavior).
    The machine HAS a GPU; the pinned config cannot reach it headless.
    m1d NOT passed in the full regression (pinned config) — environment
    classification stands, no code change anywhere (1D harness, e2e
    specs, config, 1D code all untouched). User one-liner: cd game &&
    npx playwright test (on a machine whose Chrome defaults to hardware
    WebGL). FPS backlog note recorded in STATE.md (do NOT fix). ·
    Read-only diag tooling, user-pre-authorized 2026-10-15. · Evidence:
    M1F.md §11.3. · Source: Lead ruling round 4 item 3 E-1.

60. 2026-10-17 · 1F/bookkeeping · notes/STATE.md · B-2 APPLIED: Approval
    Ledger rows — F30 APPROVED, F31 APPROVED, E-1 RULED, F25e/F29a/F29b
    RESOLVED-BY F30/F31, "user delegated F25e/F29/m1d to Lead
    (2026-10-17)"; ANCHOR → bbeb4f4; 1D FPS backlog note section added
    (do-NOT-fix, deferred fixed-step review); NEXT ACTION = await Lead
    ruling on F30x/F32/E-1; session row 9. · Lead instruction item 3 B-2.
    · Evidence: STATE.md. · Source: Lead ruling round 4 item 3 B-2.

61. 2026-10-18 · 1F/F30x-gate · game/tools/diag-m1f-core.mjs (extended) ·
    F30x Node-first gate BEFORE any harness edit, per the round-5 ruling:
    jitter span parameterized (ladder 0.28 → 0.45 → 0.58 = the 0.60 rad
    hard ceiling), Earthrise guard inside spawnEligible
    (`elev = asin(clamp(earthDir·dir))` required within [8°,22°], then the
    authorized fallback [5°,25°]), break-at-first-eligible cost rule,
    failure-classification counters (elev/corridor/LOS), and two
    diag-only surveys (625-site domain survey over the full 0.62 rad
    cap; 2,294-site global sweep). RESULT: GATE FAILS AT EVERY RUNG —
    eligible=0 with failCorr = EVERY in-band candidate (failLos never
    reached); chosen index −1; fallback=base unchanged (corridor az 150°
    @ 65.7°, LOS −10.6 m at f=0.025, cost ~20 s); Sun ACTIVE both poses.
    Surveys: 0 of 625 cap sites ≤40° (min 48.7°, at Earth elev 15.91°);
    0 of 2,294 moon sites ≤40° (global min 42.9° at Earth elev −7.55°,
    band-best 49.7°) — the ≤40° corridor over 2,600 m is UNMEETABLE on
    this terrain field; the domain is NOT the binding constraint. Per
    the ruling's own hard stop: the spawn harness edit was NOT applied;
    routed to the Lead (options: SAT_B retarget / corridor-threshold
    ruling / different scenario). · Read-only diag tooling + the
    ruling's stop condition. · Evidence: M1F.md §12.1 (verbatim ladder +
    surveys). · Source: Lead ruling round 5 §2 (Fix 1) + §5 hard stops.

62. 2026-10-18 · 1F/ruling-5 · game/src/test/Milestone1F_TestHarness.tsx ·
    F32 APPLIED, rung 1: the A/B render target `samples: 0` → `samples:
    4` (single line; the impostor limb is authored for MSAA —
    SkyImpostorPool alphaToCoverage was a deterministic no-op on the
    samples:0 target, inflating the impostor disk ~0.33 px, F32 cause
    #1). Nothing measured changed: threshold >45, ±80 px window, <3%
    criterion, 232 km fixture, masks, poses. TSC_EXIT=0 BUILD_EXIT=0
    unpiped. Evidence: R3 sym 22.22% → 17.78% of the 90-px disk; R1
    determinism 0 differing bytes; R2 footprint 105.5% → 99.1% (inside
    ±15%). · MSAA addresses the A2C no-op + hard-edge phase noise; the
    ruling's Fix 2 rung 1. · Evidence: M1F.md §12.2. · Source: Lead
    ruling round 5 §3 (Fix 2).

63. 2026-10-18 · 1F/ruling-5 · game/src/test/Milestone1F_TestHarness.tsx ·
    F32 ladder rung 2: `samples: 4` → `samples: 8` (per the ruling's own
    escalation "if sym% is still ≥ 3 after samples:4"). RESULT: R3 sym
    17.78% — IDENTICAL to samples:4 → MSAA saturated; the residual is
    the limb isophote (cause #3) + phase, sample-count-insensitive.
    Still ≥3% → STOP per the ladder; metric/threshold/window/fixture
    untouched; samples:8 kept as the final rung state. TSC_EXIT=0
    BUILD_EXIT=0 unpiped. R1 determinism 0 bytes; R2 99.1%. · The
    ruling's Fix 2 rung 2 + its stop. · Evidence: M1F.md §12.2 (rung
    table). · Source: Lead ruling round 5 §3 (Fix 2 ladder + stop).

64. 2026-10-18 · 1F/bookkeeping · notes/STATE.md · B-3 APPLIED: 1F
    ledger row → GATE RUN ×5 — FAILED, BOTH ROUND-5 FIXES STOPPED (F30x
    hard stop pre-harness + F32 ladder saturation); IN-FLIGHT rewritten
    with the survey numbers; Approval Ledger rows — round-5 ruling
    RECORDED (Fix 1 consolidated F30x: NOT APPLIED per its stop; Fix 2
    MSAA ladder: applied to rung 2, stopped per its ladder), round-5
    execution row; SESSION LOG row 10 + handoff note; NEXT ACTION =
    await Lead ruling on the R5 spawn geometry + the R3 residual
    (options in M1F.md §12.1/§12.2); ANCHOR → a8b25fa. · Lead
    instruction item 6. · Evidence: STATE.md. · Source: Lead ruling
    round 5 §4.6 + §10.2 protocol.

65. 2026-10-18 · 1F/round-6-TrackB · game/src/test/Milestone1F_TestHarness.tsx,
    game/tools/diag-m1f-r3dump.mjs (created) · R3DUMP emitted from WITHIN
    the R3 classification loop exactly as the addendum prescribed
    (per-differing-pixel dx/dy from the projected centre + side M/I;
    radii header meshR/impR area-derived + max-lit; between the last
    abRender and the state restore; no new renders) + read-only
    classification probe (SHADING r ≤ r_disk−2 vs EDGE |r−r_disk| ≤ 2;
    24×15° azimuth bins; uniform-ring/directional-arc; net one-sided
    I−M; dominance + route). Verdict-neutral console-only emission.
    Track A NOT executed — the base round-6 directive is not on record
    in this session (repo reconciled: HEAD 779fcaf clean, no foreign
    commits, no directive persisted; only the addendum's ARCS-wording
    clarification is known). · Lead round-6 addendum items 1–2 ("do that
    and no further"). · Evidence: M1F.md §13.1. · Source: Lead round-6
    addendum.

66. 2026-10-18 · 1F/round-6-TrackB · (no harness behavior change) ·
    CLASSIFICATION RESULT + STOP: 16 differing px, ALL impostor-lit-only
    at the outer rim (r 4.0–5.66 px vs meshR 5.41), SHADING 0 / EDGE 16,
    net one-sided +16 (impostor-larger), ring over 14/24 bins spanning
    21 bins (~315°) — by the addendum's letter NEITHER defined EDGE route
    (uniform ≥16 bins; arc <12 bins) → NO DEFINED ROUTE → STOPPED before
    any rung (no threshold, fixture, window, or metric change).
    Substance: the §11.2 cause-#1 signature — uniform +0.45 px impostor
    radius excess persisting at samples:8 through the coverage/AA-profile
    channel; the ≥16-bin criterion is structurally unreachable at n=16
    (uniform expectation ≈ 12 bins); the fixture rung's best case is
    ~5.4–5.8% ≥ 3% (arithmetic in M1F.md §13.3). Routed to the Lead:
    supply the base directive (Track A) + rule on the gap signature. ·
    The addendum's own routing table (no row for this signature) + the
    brief's §6/§5 stop discipline. · Evidence: M1F.md §13.2–13.3. ·
    Source: Lead round-6 addendum item 3.

67. 2026-10-18 · 1F/bookkeeping · notes/STATE.md · B-4 APPLIED: IN-FLIGHT
    → round-6 Track B state (dump done, stopped at the routing gap,
    Track A blocked); Approval Ledger rows — round-6 addendum RECORDED +
    round-6 execution row; SESSION LOG row 11 + handoff; NEXT ACTION =
    Lead to supply the base round-6 directive + rule on the gap
    signature; ANCHOR → 21408a3. · Lead addendum (applies whether or not
    round-6 work has started) + §10.2. · Evidence: STATE.md. · Source:
    Lead round-6 addendum + §10 protocol.

68. 2026-10-19 · 1F/round-6b-F1 · game/src/test/Milestone1F_TestHarness.tsx ·
    F1 APPLIED (Lead-chosen primary fix): R3 silhouette classification
    threshold 45 → 8 on both masks (meshOnly[i] > 8 / impOnly[i] > 8) —
    the >45 cutoff sat inside the mesh's own dim-limb shading band
    (9..45) while the impostor's analytic edge steps cleanly to
    background, producing the one-sided 16-px rim excess; nothing else
    changed (<3% criterion, ±80 px window, 232 km fixture, masks, poses,
    samples:8, hysteresis clauses, R1/R2/R4/R5 untouched). R3DUMP
    per-pixel line extended with the pixel's raw byte values mv=/iv=
    (verdict-neutral, diag-only) + probe parser updated. TSC_EXIT=0
    BUILD_EXIT=0 unpiped. Evidence: R3 sym 17.78% → 0.82% of the 122-px
    disk; R3 badge PASS in three solo gate runs; V1 curve, V2 histograms,
    V3 sweep, V4 control, V5 repeatability, V6 stray audit, V7 gate +
    regression in M1F.md §14. · Lead round-6b directive §2. · Evidence:
    M1F.md §14.1–14.7. · Source: Lead round-6b directive item 2 (F1).

69. 2026-10-19 · 1F/tools · game/tools/diag-m1f-r3val.mjs (created) ·
    Validation tooling for the directive's extensive-testing mandate:
    captures a full m1f suite run's R3RAW (per-window byte dump for V1/
    V2/V6) + R3SWEEP (V3 fade-band sweep) + R3BIAS (V4 negative control)
    lines to /tmp/r3val-raw.log and classifies offline (--analyze mode);
    V3/V4 emitters lived in a TEMP harness patch for the capture run
    ONLY (bias hook at the probe-A sky.setBody feed rotating the
    observer-relative direction by b/599.14 rad; sweep over the 6 fade-
    band distances) — REVERTED before commit, absent from dist
    (grep=0). Results: V1 plateau t∈[2,12] at sym=1 (0.82%), degradation
    from t=16, t=45 reproduces round-6's 17.78% 1:1; V2 — mesh has a
    12-px dim-limb tail in 9..45, impostor 0 (mechanism documentary);
    V3 — 0.00–4.00% across the whole fade band; V4 — 1 px bias →
    17.21%, 2 px → 28.69% (meter NOT blind); V6 — 43 strays ALL
    symmetric (zero sym contribution, conservative totA dilution).
    Worklog of failed methods (parser off-by-one caught pre-report;
    pkill self-match; tool timeout) in M1F.md §14.8. · Read-only diag
    tooling, user-pre-authorized 2026-10-15 + this directive's §3/§5. ·
    Evidence: M1F.md §14.1–14.6, §14.8. · Source: Lead round-6b
    directive §3 (V1–V6) + §5 (method discipline).

70. 2026-10-19 · 1F/bookkeeping · notes/STATE.md · B-5 APPLIED: 1F ledger
    row → round 6b (R3 GREEN via F1, fully validated; R5 excluded/
    awaiting Track A ruling); IN-FLIGHT rewritten; Approval Ledger rows
    — round-6b directive RECORDED + execution row; SESSION LOG row 12 +
    handoff; NEXT ACTION = Lead ruling on Track A (R5 spawn geometry;
    round-6 base directive text still not on record); ANCHOR → 20156a0.
    · Lead round-6b directive §6. · Evidence: STATE.md. · Source: Lead
    round-6b directive item 6 + §10.2.

71. 2026-10-19 · 1F/tools · game/tools/diag-m1f-r7.mjs (created),
    notes/reports/evidence/M1F-r7-walks.json (created) · Round-7 Track A
    Node instrument per the Lead directive: staged walk-outcome site
    search (A screen 2,425 sites over the 0.62 rad cap + old-stream
    top-up; B/C ranked-pool + 0.5° refinement walks; D calibration
    ladder; E/F falsification + selector cost; T per-10 s trace; W
    fresh-process single walk; X extended-wall; GATE merge + verdict).
    Walk replica = verbatim harness driver (teleportSurface, 3.5 s
    warmup, LIVE 120 wall s ts=6/5 substeps sprint-to-SAT_B autopilot).
    INSTRUMENT FINDINGS: (1) back-to-back teleports in one process
    contaminate walks (fixed: one walk per fresh process; calibrated —
    fresh base walk reproduces the core diag exactly: locals 656.3,
    dist 996.5, net 788.2, LOS −10.6 m @ f0.025, Sun 29.9A/−2.9A);
    (2) avgV is commanded speed, not progress. RESULT: 0 of 429 unique
    admissible-site walks reaches ≥2 crossings within the frozen LIVE
    (29 reach exactly 1; 7 otherwise fully admissible); extended-wall
    probes put the 2nd crossing at ~300–326 s on 5 sites, all of which
    then fail the Sun-at-suite-pose audit (−37.5°..−41°C after 1,800
    sim s); falsification cases (old spawn, base) FAIL as required;
    corridor slope does not predict walk outcome (no sufficient screen —
    §2(c)(ii) inadmissible; (i) boot-prohibitive; (iii) moot). GATE: NO
    WINNER → STOP per §2(b)/§3, NO harness edit. Options quantified in
    M1F.md §15.7 (recommendation: rebases ≥ 2 → ≥ 1, a gate-term ruling).
    · Read-only diag tooling + evidence file. · Evidence: M1F.md §15.1–
    §15.7. · Source: Lead round-7 directive (Track A re-issue) §2–§3.

72. 2026-10-19 · 1F/bookkeeping · notes/STATE.md · B-6 APPLIED: 1F ledger
    row → round 7 (Track A Node gate FAIL 0/429, STOP, options routed);
    IN-FLIGHT rewritten; Approval Ledger rows — round-7 directive
    RECORDED (base Track A text satisfied by the re-issue) + execution
    row; SESSION LOG row 13 + handoff; NEXT ACTION = Lead ruling on the
    R5 option menu (recommendation (a): rebases ≥ 1 with 7 admissible
    sites); ANCHOR → the ledger commit. · Lead round-7 directive §6 +
    §10.2. · Evidence: STATE.md. · Source: Lead round-7 directive §6.

73. 2026-10-19 · 1F/manual-testing · game/src/test/Milestone1F_TestHarness.tsx ·
    Lead-approved manual-observation overrides (verdict-neutral when
    absent): (1) `?manual=1` — the phase machine starts at DONE instead
    of WARMUP, so readUserInput (WASD/Shift/Space/V) is live from page
    load and the WARMUP/LIVE autopilot phases + the suite never run (no
    acceptance console line; badges stay ·····); (2) `?spawn=x,y,z` — a
    normalized moon-fixed direction replacing the findSpawn result (the
    24,000-candidate search is skipped when present; invalid input
    warns and falls back to the search). NOTHING else touched: the
    autopilot, physics, KCC, SAT_A/B/C derivation, walkFwd, and every
    acceptance row are byte-identical when the params are absent
    (verified live: default page still boots into WARMUP). Purpose: the
    Lead walks the terrain by hand to understand the R5 autopilot stall;
    not an acceptance path. TSC_EXIT=0 BUILD_EXIT=0 unpiped; live
    verified (manual=1 → SEQUENCE DONE, no suite line; default →
    WARMUP). · Lead approval in chat 2026-10-19. · Evidence: this
    entry + live probe. · Source: Lead directive (manual-testing
    overrides).

74. 2026-10-19 · 1F/F-01..F-12 batch · game/src/test/Milestone1F_TestHarness.tsx ·
    F-01 (P0 render/sky): observer for Sun/catalog bodies now `moonAbs + O + p`
    (was `+ p`; +O from getOrigin, matches horizon up and probe path; 3 lines).
    F-02 (P0 render/layers): assignObjectMesh distance now `|R·C − O − p|`
    (was `|R·C − p|`, threads O via getOrigin; fixes terrain/sat Near/Mid/Far
    banding post-rebase). F-03 (P0 test/R5 straddle): pose rebuilt in the
    rendered frame `T=R·SAT_B−O`, `S=R·spawn−O`, `dir=norm(T−S)`, `pose=T−dir·2400`,
    up=normalize(O+pose) (was moon-fixed SAT_B−dir·2400, up 0,1,0). F-12 (P1
    test/suite): Sun/probe suite poses now use render-local `drv−O` and radial
    up (was absolute drv, up 0,1,0). F-07 (P2 live/FPS): LIVE now runs a
    fixed-step 1/60 accumulator with ts=6 (was variable `dt·ts`; walk outcome
    FPS-independent, diag replica parity). Diag/tool fixes mirrored:
    src/test/m1fStraddle.ts — shared straddle helper (harness+diag import).
    · F-01/F-02 no-op at O=0, so pre-rebase rows unchanged. · Evidence:
    TSC_EXIT=0; diag r7 stages A (2393-site lattice) + GATE smoke. · Source:
    Lead issue batch F-01..F-12 (m1-assembly c0ae8bf review).
75. 2026-10-19 · 1F/F-04..F-08/F-05 diag · game/tools/diag-m1f-r7.mjs ·
    F-04 (P1 tools/diag LOS): losClear now builds the rendered straddle pose
    via the shared m1fStraddle helper and un-rotates samples by R⁻¹ before
    terrainHeight (was unrotated moon-fixed ray; now matches harness F-03).
    F-06 (P1 KCC+diag): walkReplica resets leaked KCC spin phase `_theta`/
    `_thetaPrev`/`lookYawDelta` at each walk (tool-side; teleportSurface core
    unchanged — core API change would need a ruling). F-05 (P1 GATE): merge
    keeps freshest `fresh:` label then newest mtime and rejects `net>dist+1`
    (was first-seen wins; now kept/replaced/rejected counts). F-08 (P2 diag
    stall): walkReplica now also tracks `avgProgress`/`stallProgressS` (Δ net
    over 5 s window) and `net/sim` alongside legacy avgV/stallS. F-11 (P3
    docs): M1F.md §15 report count fix: 409→400 zero-crossing, 7→6 admissible
    (net>200 filter). · Evidence: TSC_EXIT=0, node --check, gate smoke. ·
    Source: same batch.
76. 2026-10-19 · 1F/F-11 docs · notes/reports/M1F.md §15.2 · Report counts:
    409→400 zero-crossing (400+29=429), 7→6 admissible 1-crossing sites under
    the coded `net>200` filter (7 matches `net>0` and includes legacy #1454;
    6 fresh). · Notes-only. · F-11.
77. 2026-10-20 · T1/B1 · game/src/main.tsx, game/src/App.tsx,
    game/src/play/PlayPage.tsx (new) · Route stub: `play` entry in the
    static `pages` map (own Vite chunk); menu gets PLAY as the first row,
    title `SOLARIS — PLAY / MILESTONE HARNESSES`; PlayPage = stub (no three,
    no Canvas). · WHY: T1 plan §12 B1/§15 — first build step after the
    execute order. · Evidence: TSC_EXIT=0, BUILD_EXIT=0, CANON_EXIT=0,
    SHARED_EXIT=0, 1 PlayPage-*.js chunk, K10 grep exit 1, headless-Chrome
    manual pass (menu/stub/back-link/m1a). · Source: Lead execute order.
78. 2026-10-20 · T1/B2 · game/src/play/world/moonConfig.ts (new),
    game/src/play/world/spawn.ts (new), game/tools/test-play-spawn.mjs (new) ·
    Play moon constants copied by value from the M1F harness (MOON params,
    MU, heights, KCC config A2 with spinOmega 0 per Q8, pool opts) +
    PLAY_TUNING; findEarthriseSpawn = harness findSpawn verbatim (takes
    earthDir + sunDir), parseSpawnOverride (`[play]` prefix). No runtime
    effect (not imported by PlayPage yet). · WHY: T1 plan §12 B2, §6.1, Q8.
    · Evidence: test-play-spawn PASS 70/70 (×2), spawn (0.320588, −0.036825,
    0.946503) pinned 1e-9, slope 0.41°, Earth 8.67°, Sun 36.41°; TSC/BUILD/
    CANON/SHARED exit 0; K10 grep exit 1. · Source: Lead execute order.

79. 2026-10-20 · T1/B3 · game/src/play/world/MoonLod.ts (new),
    game/tools/test-play-lod.mjs (new) · M1F quadtree + LOD controller
    (harness 274–434) ported by value as class MoonLod: constants copied,
    algorithm byte-for-byte, module state → fields; additive residentAround
    (§10.3 fraction), isSelectedLeaf, stats, LodPool type. No runtime effect
    (not imported by PlayPage yet). · WHY: T1 plan §12.2 B3, §10.3, risk K2.
    · Evidence: test-play-lod PASS 40/40 (341 nodes/face, 2,046 total,
    MAX_LEVEL 4 at spawn, stable over 100 updates, 0 changes under ±0.5 m
    jitter, residentAround 0 → 1, heap −6,552 B over 1,000 updates);
    test-play-spawn PASS 70/70; TSC/BUILD/CANON/SHARED exit 0; K10 grep
    exit 1; K2 diff 134/157 verbatim. · Source: Lead execute order.

80. 2026-10-21 · T1/B4a · game/src/play/world/skyState.ts (new),
    game/src/play/world/moonWorld.ts (new), game/tools/test-play-world.mjs
    (new) · applySkyState = harness applyRenderState (810–914) minus probes,
    satellites, RIG.maskOverride/RIG.stats, spinQuatInto kept before the
    terrain loop (§6.2 gotcha), per-call Quat literal → module scratch;
    createMoonWorld §6.3 steps 1–9 (optional makePool for Node), dispose
    §6.4, respawnPlayer. No runtime effect (not imported by PlayPage yet).
    · WHY: T1 plan §12.2 B4 → B4a, §6.2–§6.4. · Evidence: test-play-world
    PASS 23/23 (spawn pin 1e-9, KCC at surface, scene graph, NEAR_BIT on
    characterRoot + all 20 resident records within 300 m, Earth mask ≠ 0,
    Sun active, heap 16 KB/1,000 calls, respawn 0 m); test-play-lod 40/40;
    test-play-spawn 70/70; TSC/BUILD exit 0; K10 grep clean.
    · Source: Lead execute order.

81. 2026-10-21 · T1/B4b · game/src/play/camera/ThirdPersonCamera.ts (new),
    game/src/play/frame/playFrame.ts (new), game/tools/test-play-frame.mjs
    (new), game/src/play/world/moonWorld.ts (astroState exposed) · static
    third-person camera (reset(kcc, toward), planet-frame boom with the
    harness 4-sample terrain clamp + height clamp, harness lookAtQuatInto)
    and createPlayFrame stages 6/8/9/10 (spin composed once, setDriverPose
    with boot scratch, applySkyState, lod.update + pool.pump every frame).
    No runtime effect (not imported by PlayPage yet). · WHY: T1 plan §12.2
    B4 → B4b, §4.3, §9.4, K1. · Evidence: test-play-frame PASS (finite unit
    driver pose, boom 7.000 m, Earth in front hemisphere 28.9° off-axis, Sun
    active, lod/pump 60/60, residentAround 1, heap < 64 KB / 10,000 frames);
    test-play-world 23/23; TSC/BUILD exit 0; K10 grep clean.
    · Source: Lead execute order.

82. 2026-10-21 · T1/B4c · game/src/play/PlayPage.tsx (rewritten from the B1
    stub), game/src/play/world/moonWorld.ts, game/tools/test-play-world.mjs,
    game/tools/check-play-b4.mjs (new) · PlayPage mounts the world: Canvas
    (harness props) + Scene (pool attach/primeAll, unprimeAll after 2
    frames, `<primitive sceneRoot>`, `MultiCameraRig onFrame`); world/camera/
    frame built once in useMemo, `world.dispose()` on unmount. `PlayPool`
    gains attach/primeAll/unprimeAll. Boot entity sync in `createMoonWorld`
    and `respawnPlayer` (copy KCC abs pos/vel into the core entity, one
    `core.tick()` at time scale 0 → origin on the spawn lattice).
    · Why: plan §12.2 B4 → B4c; the KCC write-through only runs in
    `kcc.update`, which nothing calls before B5, so the entity stayed at the
    moon centre and the camera rendered from inside the moon. · Evidence:
    MT2 via check-play-b4 — terrain streams around the spawn, Earth in view,
    0 non-favicon errors; MT16 — m1f&manual=1 boots, 0 errors; test-play-world
    27/27 (4 new sync rows), frame 12/12, lod 40/40, spawn 70/70 (all with
    --expose-gc); TSC/BUILD exit 0; K10 grep 0 hits. · Source: Lead execute
    order.

83. 2026-10-21 · T1/B5a · game/src/play/ui/playStore.ts (new),
    game/src/play/input/InputState.ts (new), game/tools/test-play-shell.mjs
    (new) · play shell store (PlayPhase incl. ERROR, PlayEvent, PlayHud, pure
    nextPhase for the §10.2 table, usePlayStore.dispatch with side-fields) and
    InputState (§9.1 key map, held set, repeat-ignored edges, locked-only
    reads, blur/lock-change clears, first-delta drop + 200 px clamp, wheel
    zoomDelta, attach/detach with injectable DOM). No runtime effect (not
    imported yet). · WHY: T1 plan §12.2 B5 → B5a, §4.2, §5.2, §9.1, §10.2, K3.
    · Evidence: test-play-shell PASS 72/72 (every §10.2 row, reachable set =
    5 phases, store side-fields, fake-DOM input rows, 6 listeners attached /
    0 after detach, heap < 64 KB over 300,000 events); world 27/27, frame
    12/12, lod 40/40, spawn 70/70; TSC/BUILD exit 0; K10 grep 0 hits.
    · Source: Lead execute order.

84. 2026-10-21 · T1/B5b · game/src/play/frame/shellStages.ts (new),
    game/src/play/ui/shellRuntime.ts (new), game/src/play/frame/playFrame.ts,
    game/src/play/ui/playStore.ts, game/tools/test-play-shell.mjs · stage 1
    clock (dt = 0 unless PLAYING, one dt = 0 frame per resume, 0.1 s clamp),
    stage 2 edges (P → pauseKey + exitLock, R → respawnPlayer dt = 0, H →
    toggleHud), stage 11 loading gate (two consecutive residentAround = 1.0
    or 15 s real-time timeout, ≤10 Hz setLoad, 0.25 s per-frame hitch cap);
    shell runtime maps pointerlockchange/pointerlockerror/visibilitychange/
    webglcontextlost/worker error to dispatch; store gains hudVisible. Shell
    stages run only when createPlayFrame gets the optional shell arg, so
    PlayPage is unchanged until B5c. · WHY: T1 plan §12.2 B5 → B5b, §4.3,
    §10.2, §10.3, K3, K11. · Evidence: test-play-shell PASS 101/101 (gate
    0.5→1.0→1.0 ready on the 2nd 1.0; stuck 0.9 → timeout at 15.0000 s;
    one dt = 0 per resume; hidden → PAUSED + exitLock; 5 listeners / 0 after
    detach; shell frame heap < 64 KB over 10,000 frames); frame 12/12, world
    27/27, lod 40/40, spawn 70/70; TSC/BUILD exit 0; K10 grep 0 hits.
    · Source: Lead execute order.

85. 2026-10-21 · T1/B5c · game/src/play/ui/Overlays.tsx (new),
    game/src/play/ui/PlayShell.tsx (new), game/src/play/PlayPage.tsx,
    game/tools/check-play-b5.mjs (new) · loading / click-to-play / pause
    (1.0 s Resume cool-down from pausedAtMs, ← menu) / error + Reload
    overlays selected by store phase; PlayPage attaches InputState and the
    shell runtime to the canvas and passes { input, store } to
    createPlayFrame · Why: plan §12.2 B5c (§10.1–§10.4), closes B5; no
    worker-error hook (pool workers private, shared-module edit not worth
    it in V1) · Evidence: check-play-b5 B5_EXIT=0 (C1–C6 PASS); shell
    101/101, frame 12/12, world 27/27, lod 40/40, spawn 70/70; TSC/BUILD
    exit 0; K10 grep 0 hits. · Source: Lead execute order.

86. 2026-10-21 · T1/B6 · game/src/play/character/AstronautRig.ts (new),
    game/src/play/character/CharacterAnimator.ts (new),
    game/src/play/character/CharacterTelemetry.ts (new),
    game/src/play/world/moonWorld.ts, game/src/play/frame/playFrame.ts,
    game/tools/test-play-rig.mjs (new), game/tools/check-play-b6.mjs (new)
    · articulated block astronaut per §7.2/§7.3 (17 pivot groups, 20 meshes
    on 3 shared unit geometries + 4 materials, all NEAR_BIT, static meshes
    matrixAutoUpdate off, rig.root Ry(−π/2) + −groundClearance);
    CharacterAnimator interface + RestAnimator (identity pose) behind the
    K13 seam; telemetry record type + boot factory (sampleTelemetry in B7);
    createMoonWorld mounts the rig under characterRoot as world.animator and
    disposes it; playFrame stage 7 calls animator.update · Why: plan §12.2
    B6 (§5.2, §7, K13) · Evidence: test-play-rig PASS 97/97 (every §7.6 row;
    in-world sole contact −0.0000 m, visor·fwd 0.904; RestAnimator heap
    < 64 KB over 10,000 updates; 7/7 dispose events); world 27/27, frame
    12/12, shell 101/101, lod 40/40, spawn 70/70; TSC/BUILD exit 0;
    check-play-b5 B5_EXIT=0, check-play-b6 B6_EXIT=0; K10 grep 0 hits.
    · Source: Lead execute order.

87. 2026-10-21 · T1/B7a · game/src/play/controller/PlayerController.ts (new),
    game/src/play/character/CharacterTelemetry.ts (sampleTelemetry added),
    game/tools/test-play-controller.mjs (new)
    · camera-relative WASD → kcc.input (§9.2; moveF/moveR on the KCC's own
    fwd × up right), sprint gated on inputMag > 0.5, play-layer jump buffer
    0.12 s (§9.3, Q5), hard-landing recovery (landRecoverScale over the §8.2
    T_land), reset(); per-tick `simulate()` (step → kcc.update(1/60,1) →
    postSimulate) for frame-rate independence; sampleTelemetry per §5.2/§8.6.
    · why: plan step B7a (B7 split, session 39). · evidence: controller
    PASS 29/29 (D·right 1.000000; heading err 1e-17 rad; walk 3.200 / sprint
    6.500 m/s; 180° facing within 2° at 0.800 s, no overshoot; buffer 0.10 s
    → relaunch +1 tick, 0.20 s → none; frame-rate 480/480/480 ticks, Δ 0.000
    mm; heap Δ 22.7 KB / 10k frames); rig 97, world 27, frame 12, shell 101,
    lod 40, spawn 70 all PASS; TSC/BUILD exit 0. No core edit.
    · Source: Lead execute order.
88. 2026-10-21 · T1/B7b · game/src/play/camera/ThirdPersonCamera.ts (completed),
    game/src/play/world/moonConfig.ts (PLAY_TUNING.camZoomSens additive),
    game/tools/test-play-controller.mjs (part 2)
    · §9.4 camera: preStep (parallel transport, raw orbit a = −dx·lookSens about
    up, pitch clamp ±1.2, multiplicative zoom clamped [1.2, 12], V enter/exit
    with the one-shot body yaw and autoTurn toggle), poseInto(kcc, dt) with a
    planet-frame pivot lag offset (camPosTau), 4-sample terrain cut, instant
    shrink / camBoomTau regrow, height clamp, FP eye pose; reset → TP.
    · Why: plan step B7b (decisions in the plan's B7b build notes).
    · Evidence: test-play-controller PASS 57/57 (orbit sign/angle, clamps,
    spring arm, walk lag within 3 % of v·dt/(e^{dt/τ}−1), rebase step mismatch
    0.30 mm ≤ 1 mm, FP enter/yaw/exit, frozen pose bit-identical, real-terrain
    orbit min clearance 0.400 m ≥ 0.35, min boom 1.35 m, camera heap 26.9 KB /
    10k); rig 97, world 27, frame 12, shell 101, lod 40, spawn 70 PASS; TSC/BUILD
    exit 0. No core edit.
    · Source: Lead execute order.
89. 2026-10-21 · T1/B7c · game/src/play/frame/playFrame.ts (stages 3/4+5/7/8
    wired), game/src/play/PlayPage.tsx (opt-in ?probe=1 probe),
    game/tools/test-play-frame.mjs (B7c rows), game/tools/check-play-b7.mjs (new)
    · FIRST PLAYABLE: camera pre-step (PLAYING only), per-tick controller
    simulate + core.advance on clock.dt, sampleTelemetry, lagged camera pose,
    respawn through ctrl.reset + cam.reset with dt = 0, FP hides the rig.
    · Why: plan step B7c (decisions in the plan's B7c build notes).
    · Evidence: test-play-frame PASS 23/23 (first PLAYING frame 0 ticks; W 2 s
    120 ticks → 5.959 m; Space airborne, lands; 120 PAUSED frames bit-identical;
    resume 0 substeps; respawn 0 ticks, spawn·dir > 0.999999; shell-path heap
    non-growing); check-play-b7 PASS (PLAYING → PAUSED, W moved, airborne, paused
    drift 0 m, sim time frozen, 0 errors); check-play-b5/b6 PASS; controller 57,
    rig 97, world 27, shell 101, lod 40, spawn 70 PASS; TSC/BUILD exit 0; K10
    grep 0 hits. No core edit.
    · Source: Lead execute order.
90. 2026-10-21 · T1/B8 · game/src/play/character/animStateMachine.ts (new),
    game/tools/test-play-anim.mjs (new)
    · Animation state machine: AnimState ids, AnimStateMachine.step (§8.2
    table + exit rules, blend-in, smoothstep blend, hysteresis, dwell, coyote
    hold, slide-off, soft dip, crouch weight, T_land, interrupt flag) and the
    §8.1 legDrop two-bone solver. Pure TS, zero allocation; nothing on screen.
    · Why: plan step B8 (decisions in the plan's B8 build notes).
    · Evidence: test-play-anim PASS 48/48 (§8.7 sequences, hysteresis 0
    transitions, solver table to 0.1°, sole·up > 0.9999, unit quaternions,
    heap < 64 KB / 10k steps); rig 97, controller 57, frame 23 PASS; TSC/BUILD
    exit 0; CANON_EXIT 0; no core/render edit.
    · Source: Lead execute order.
91. 2026-10-21 · T1/B9a · game/src/play/character/ProceduralAnimator.ts (new),
    game/tools/test-play-anim.mjs (rows 14–18)
    · Procedural animator core: PoseBuffer (f32 JOINTS·4 + hipsY), boot
    prev/cur/snap/out, per-joint slerp crossfade by sm.blend, interrupt snap,
    Idle and the shared gait(v) Walk/Run (§8.3 asin no-slide stance), crouch
    weight + soft dip as additive legDrop, joint write-out. Air/Land/Slide fall
    back to Idle (B9b); PlayPage unchanged (B9c).
    · Why: plan step B9a. Decisions (plan B9a build notes): swing ankle =
    knee − θ + 0.25·sin(πu) (the literal popped 34° at stance boundaries);
    β clamped [0.22, 0.65]; Walk/Run pop row sampled at 600 Hz.
    · Evidence: test-play-anim PASS 75/75 (foot slide 0.0000 cm at v=1, < 1 cm
    at v ∈ {2,4,8}; β table; phase error 1e-16; max joint step 1.39° per
    1/600 s; heap ≈ 0 over 10k updates); rig 97, world 27, frame 23, shell 101,
    lod 40, spawn 70 PASS; controller 57/57 on re-run (camera-heap row flaky,
    also fails on a44eee6); TSC/BUILD exit 0. No core/render edit.
    · Source: Lead execute order.
92. 2026-10-21 · T1/B9b · game/src/play/character/ProceduralAnimator.ts,
    game/tools/test-play-anim.mjs (rows 17b–17d)
    · Air, landing and slide poses: JumpLaunch dip → extension, JumpRise tuck,
    Fall arms-out ramped by airTime, Land absorb + recovery (D =
    clamp(0.04·landingSpeed, 0.03, 0.30)), Slide (frozen stride), §8.6 slope
    ankle pitch/roll (±20°, stance-weighted); timed-state progress u; Land D
    fixed at entry. PlayPage unchanged (B9c).
    · Why: plan step B9b. Decisions in the plan's B9b build notes (end-pose
    blend-out of timed states, C⁰ launch seam, interrupt row = transition
    frame with an Idle→Walk control).
    · Evidence: test-play-anim PASS 115/115; rig 97, world 27, frame 23,
    shell 101, lod 40, spawn 70 PASS; controller 57/57 on re-run; TSC/BUILD
    exit 0. No core/render edit.
    · Source: Lead execute order.
93. 2026-10-21 · T1/B9c · game/src/play/world/moonWorld.ts,
    game/src/play/frame/playFrame.ts (comment), game/tools/test-play-rig.mjs
    (world-animator row), game/tools/check-play-b9.mjs (new)
    · What: `createMoonWorld` mounts `ProceduralAnimator` (same rig, same
    CharacterAnimator seam) instead of `RestAnimator`; the page now animates
    Idle/Walk/Run/JumpLaunch/JumpRise/Fall/Land/Slide from real KCC telemetry.
    · Why: plan step B9c (closes B9). Swap in the world, not PlayPage (one
    mount point); state name via the ?probe=1 probe until B10's HUD.
    · Evidence: check-play-b9 PASS (Idle → Walk; JumpLaunch → JumpRise → Fall
    → Land → Idle, 4.98 sim s; 0 errors); check-play-b7 PASS; anim 115, rig 97,
    world 27, frame 23, shell 101, lod 40, spawn 70, controller 57 PASS;
    TSC/BUILD exit 0. No core/render edit.
    · Source: Lead execute order.

- 2026-10-21 · T1 B10 · `game/src/play/ui/hudPublisher.ts` (new), `ui/Hud.tsx` (new), `ui/playStore.ts`, `ui/PlayShell.tsx`, `frame/playFrame.ts`, `tools/test-play-perf.mjs` (new), `tools/test-play-shell.mjs`, `tools/test-play-frame.mjs` · HUD (controls hint with 8 s / 20 m fade, speed/state/grounded, H debug FPS/lat/lon/AGL, FP dot) published at ≤ 10 Hz from two boot buffers; the heap rows in test-play-perf and test-play-shell now warm up for 20,000 frames · plan §10.5 / §11.5 B10 · evidence: test-play-perf PASS 19/19 ×3, all play Node tests PASS, TSC/BUILD/CANON exit 0; `--jitless` heap flat (the creep is V8 tiering metadata) · source: session 45

- 2026-10-26 · F1a · `game/e2e/gate.ts` (new), `game/e2e/m1a…m1f.spec.ts`, `game/index.html`, `game/tools/test-e2e-plumbing.mjs` (new) · the six specs now call one strict gate (verdict PASSED, no pageerror/console.error, exact TEST_ORDER row count A5 B5 C4 D5 E6 F5, every badge exactly `PASS`); `index.html` declares an empty `data:` icon so Chrome's `/favicon.ico` request (the 404 console.error on the m1a/m1b baselines) no longer happens; new 60-run fixture regression gate · why: A1-U08-1/-2/-9 (K2b) false passes, ADR-001 · evidence: `docs/audit/evidence/F1a/` — gate 60/60 twice exit 0, pre-F1a specs (6ce1d08) 24/60 exit 1, real m1a+m1b exit 0 with runtime errors [] · source: Lead F1a execute order 2026-10-26, session 104

- 2026-10-26 · F1b (F1ba) · `game/tools/test-alloc-gate.mjs` (new), `docs/decisions/ADR-002-allocation-gate.md` (new) · new allocation gate for the real play frame: V8 sampling heap profiler with minor+major-GC objects (≤ 64 B/frame) plus a gc-bracketed retained clause (≤ 8 B/frame), self-calibrating, with churn (≈400 B/frame) and leak (≈50 B/frame) mutants and a self-test; no game code changed · why: A1-U09-1 / A1-U25-1 (K2a) — post-GC heap deltas cannot see transient allocation (U27b2), ADR-002 · evidence: `docs/audit/evidence/F1b/` — self-test 8/8 twice exit 0, deliberate 8/9 exit 1, current tree walk 10,527 / idle 10,728 B/frame GATE FAIL exit 1 (expected until F5a) · source: U27c §2 F1b row

- 2026-10-26 · F1b (F1bb) · `game/tools/alloc-lib.mjs` (new), `game/tools/test-alloc-loops.mjs` (new), `docs/decisions/ADR-003-harness-loop-allocation-gate.md` (new) · sampling-heap allocation gate for the m1b/m1d/m1e burn loops (SimulationCore.tick, FlightController.integrateFlight, AstronautKCC.integrateTick) with leak and churn mutants; no game code changed, no old rows retired · why: A1-U03-4/U04-5/U05-3/U06-2/U07-3 (K2a), ADR-003 · evidence: `docs/audit/evidence/F1b/loops/` — self-test 8/8 exit 0; tree: core.tick 9.5 B/tick PASS, integrateFlight 585 B FAIL, integrateTick 5,483 B FAIL; play idle retained 6.1–9.3 B/frame (unsettled) · source: U27c §2 F1b row, session 106

- 2026-10-26 · F1b (F1bca) · `game/tools/alloc-lib.mjs` (`objectHeapUsed`), `game/tools/test-alloc-gate.mjs`, `game/tools/alloc-idle-probe.mjs` (new), `docs/decisions/ADR-004-retained-object-heap.md` (new), ADR-002 open item · retained clause counts the JS-object heap and excludes code/trusted spaces; no game code changed, budgets unchanged · why: ADR-002 open item — idle retained 6–9 B/frame was V8 tiering (code_space/trusted_space), object heap +0.12 B/frame; ADR-004 · evidence: `docs/audit/evidence/F1b/idle-retained/` — gate retained walk 0.00/0.15, idle 0.08/0.03 (GATE FAIL on allocation, expected until F5a/F7a); gate self-test 8/8 exit 0, deliberate exit 1, loops self-test exit 0; leak mutants still +40 B retained → FAIL · source: STATE NEXT ACTION F1bc (1), session 107

- 2026-10-26 · F1b (F1bcb) · `game/src/test/Milestone1B_TestHarness.tsx` (T4), `Milestone1C_TestHarness.tsx` (T2), `Milestone1D_TestHarness.tsx` (T4), `Milestone1E_TestHarness.tsx` (zero-gc), `game/tools/test-play-perf.mjs`, `docs/decisions/ADR-005-retire-heap-delta-rows.md` (new) · removed the usedJSHeapSize-delta clauses (m1b/m1d/m1e) and the boot-only `bootBufferAllocs` clause (m1c T2); rows kept with their identity canary / NaN / dispose checks, row counts unchanged; test-play-perf post-gc rows relabelled as leak checks; m1c heap-flat and m1f R4 unchanged (browser-only, no CDP sampler yet; 1F parked) · why: those clauses cannot fail on churn (A1-U06-2, U27b2); the Node gates of ADR-002/003 replace them (§13 safeguard 3 met for m1b/m1d/m1e); ADR-005 · evidence: `docs/audit/evidence/F1b/retire/` (exits.txt) · source: STATE NEXT ACTION F1bcb, session 108

- 2026-10-26 · F2a · `game/tools/test-orbit-gate.mjs` (new), `docs/decisions/ADR-006-independent-orbit-gate.md` (new) · independent raw-element orbit gate for the m1b rail: position, measured mean motion, direction against the pinned Triton-retrograde fact, period, first return, derived n/T/muHost/retrograde tables, Kepler III period ratio on measured sibling rates, day clock; `--self-test` with 10 mutants · why: every m1b row reads the rail's own derived n/T/basis, so n×1.01, n×2 and reversed orbits passed (A1-U07-1/-2, K2c) · evidence: `docs/audit/evidence/F2a/` (gate 9/9 exit 0 ×2, self-test 12/12 exit 0 ×2, deliberate exit 1, plumbing 60/60 exit 0, alloc-loops self-test 0, typecheck 0, build 0, playwright m1b 0) · source: U27c §2 row F2a. No game source changed.

- 2026-10-26 · F2b · `game/tools/test-precision-gate.mjs` (new), `docs/decisions/ADR-007-independent-precision-gate.md` (new) · independent m1a precision/rebase/timing gate on the real SimulationCore: exact spec trigger ticks 31…277 + Δ (1024,0,0), off-axis off-lattice origins vs a raw-f64 oracle every tick (|local| ≤ 128 post-shift), strict-trigger boundary cases, bit-exact `localPosF32 = fround(f64(abs − O))` for every entity and celestial, 1 AU far-origin error < 1 mm, and timed `advance()` calls (≤ 16 ms each, ≥ 250 ms counted not dropped; rebasing call + next ≤ 4 ms; min of 3 runs); `--self-test` with 15 source-rewrite mutants on fresh bundles; no game code changed, m1a browser rows unchanged (A5, ADR-001) · why: A1-U08-5/-6 (K2c), A1-U08-7 (K2d) — T2/T4 read the engine's own constants, no row reads locals, T5 drops ≥ 250 ms frames and flags the wrong frame · evidence: `docs/audit/evidence/F2b/` — gate 7/7 exit 0 twice, self-test 17/17 exit 0 twice, `--deliberate` 17/18 exit 1 · source: U27c §2 row F2b

- 2026-10-26 · F2c · `game/tools/test-seam-gate.mjs` (new), `docs/decisions/ADR-008-independent-seam-gate.md` (new), `AGENT_BRIEF.md` §5/§10 (process) · independent m1c cross-face seam gate on the real terrain worker: exact 12-edge/8-corner coverage from a pinned chart, Float32 normal bits and ≤ 5 mm positions across faces plus same-face/T-junction seams, chart direction and outward unit normals, two layouts; `--self-test` with the 32 recheck edge/corner fixtures, 6 controls and 4 worker source mutants; no game code changed, m1c browser rows unchanged · why: m1c T3 skips every different-face pair, so 64 edge/corner faults passed (A1-U06-1, K2c) · evidence: `docs/audit/evidence/F2c/` — gate 14/14 exit 0 twice, self-test 42/42 exit 0 twice, `--deliberate` 42/43 exit 1 · source: U27c §2 row F2c

- 2026-10-26 · F2d · `game/tools/test-flight-gate.mjs` (new), `docs/decisions/ADR-009-independent-flight-gate.md` (new), `game/src/test/Milestone1D_TestHarness.tsx` (DIVE deadline + countdown) · independent m1d gate: pinned density/Mach/wind law, constructed-ridge and 4,096 seeded real-terrain grazing ticks scored by an interior-clearance oracle, governor dive on a physics-time deadline at 60/30/15/10 fps with an identical trace; harness DIVE ends at `diveTicks/60 > 45` instead of requested time · why: T1 passed density-step/sea-level-Mach/reversed-wind faults, T2 passed an endpoint-only sweep, and the requested-time deadline failed T2 below ~20 fps (A1-U05-1/-7/-2) · evidence: `docs/audit/evidence/F2d/` (gate 12/12 ×2, self-test 8/8 ×2, deliberate exit 1, playwright m1d 1 → 0, all regressions exit 0) · source: U27c §2 F2d, rechecks U27b3b2b2a + U27-k2d

- 2026-10-26 · F2e · `game/tools/test-kcc-gate.mjs` (new), `docs/decisions/ADR-010-independent-kcc-gate.md` (new), `game/tools/audit/f2e-regress.sh` (new, regression runner) · independent m1e KCC gate: vertical-jump Coriolis on a smooth sphere and on a real sloped site against its own inertial RK4 (launch along the real normal, contact on the rotating terrain), zero/reversed-spin controls, dt convergence; finite clearance, abs/local frame and yaw residual (minimal-rotation transport + commanded yaw, ≤ 0.5·δ²) on every tick of two real-terrain walks; `--self-test` with 8 source-rewrite mutants · why: R5 subtracted the blended-up tilt and ignored its prediction (A1-U04-1), R1/R2 never observed grounded clearance (A1-U04-3), R1 passed 4° yaw snaps (A1-U04-4) · evidence: `docs/audit/evidence/F2e/` (exits.txt) · source: U27c §2 row F2e, recheck U27b3b2b1. No game source changed.
- 2026-10-26 · F3aa · `game/src/core/orbit/realBodyData.ts` (new), `game/tools/test-real-body-data.mjs` (new), `docs/decisions/ADR-011-real-body-reference-data.md` (new) · sourced real table (IAU PCK pole/prime meridian/spin rate, JPL planet + satellite mean elements, NSSDC Pluto elements, PCK mean radii) for all 17 bodies; independent gate 63 checks + 10 mutants · why: A1-U12-1 / D-ADR-2 need a real input for the scale laws and the frame tree; data only, nothing in the tick reads it · evidence: `docs/audit/evidence/F3a/` (gate 63/63 exit 0 twice, self-test 10/10 exit 0, orbit gate 9/9, tsc/build exit 0) · source: session 115
- 2026-10-26 · F3aba · `game/src/core/orbit/KeplerRail.ts` (`validateOrbit`, called in `_addBody`), `game/tools/test-rail-validation.mjs` (new), `game/tools/audit/f3aba-regress.sh` (new), `docs/decisions/ADR-012-rail-boot-validation.md` (new) · boot validation of orbit elements: finite a/e/i/Ω/ω/M0/T/n/μ, a > 0, 0 ≤ e < 1, μ > 0, T > 0; throws naming the body; boot path only, tick unchanged · why: e ≥ 1 / a ≤ 0 / NaN gave a silent NaN state every tick (A1-U12-2); F3abb's derived catalog needs a loud failure · evidence: `docs/audit/evidence/F3a/aba/` (gate 35/35 exit 0 twice, self-test 6/6 exit 0 twice, deliberate exit 1, all regressions exit 0 except test-play-controller 56/57, which is pre-existing — same failure on the unedited tree twice) · source: U27c §2 F3a, ADR-012
- 2026-10-26 · F3abba · `game/src/core/orbit/spinLaw.ts` (new), `game/src/core/orbit/types.ts` (`SpinParams`, `CelestialConfig.spin`), `game/src/core/orbit/celestialData.ts` (second pass `deriveSpins`), `game/tools/test-spin-law.mjs` (new), `game/tools/audit/f3abba-regress.sh` (new), `docs/decisions/ADR-013-spin-time-law.md` (new) · spin period, right-hand spin axis, prime meridian W0, retrograde flag and lock target for all 17 bodies; time law keeps each body's real spin/orbit ratio, tidal locks exact, Sun on Earth's ratio; data only, nothing in the tick reads it · why: no body rotates (A1-U12-1); F3b's frame tree needs spin data; ledger 2026-10-22 asks for a day much shorter than a year · evidence: `docs/audit/evidence/F3a/abba/` (exits.txt: spin-law PASS ×2, self-test 7/7, deliberate exit 1; all regressions exit 0 except test-play-controller 56/57, pre-existing, and alloc-loops `--self-test` EXIT=2 — NEW, open blocker: calibration `cal.obj3` 96.1 B vs 48.3 on the unedited tree) · source: U27c §2 F3a, ADR-013
- 2026-10-27 · F3abbba · `game/tools/alloc-lib.mjs` (`calibrate` ctlObj), `game/tools/test-alloc-gate.mjs` (ctlObj), `game/tools/audit/f3abbba-shape-probe.mjs` (new), `game/tools/audit/f3abbba-regress.sh` (new), `docs/decisions/ADR-014-alloc-calibration-private-shape.md` (new) · the allocation-gate calibration control writes `{calX, calY, calZ}` instead of `{x, y, z}`; window, budgets, mutants unchanged · why: once any double `{x,y,z}` exists in the isolate (F3abba `spin.axis`) V8's shared map turns its fields to boxed doubles and the integer control read 96.1 B/iter (allowed 16–64) → false exit 2 · evidence: probe old control 48.4/48.3/96.1 (fresh/int/double), fixed 48.3–48.4 all modes; alloc-loops `--self-test` EXIT=0 ×3, alloc-gate `--self-test` EXIT=0, unfixed alloc-gate `--self-test` EXIT=2; runner exits `docs/audit/evidence/F3a/abbba/exits.txt` · source: V8 field-representation tracking (session 118 probe)

- 2026-10-27 · F3abbbba · `game/tools/audit/f3abbbba-scale-laws.mjs` (new), `docs/decisions/ADR-015-catalog-scale-laws.md` (new) · chose one radius law, one distance law and one time scale for the catalog · A1-U10-2/-6, U12-1, D-ADR-2, ledger 2026-10-22 rulings · probe 8/8 exit 0 twice, `--control` exit 1 (`docs/audit/evidence/F3a/abbbba/`) · REAL_BODY_DATA (ADR-011). No game code changed.
- 2026-10-27 · F3abbbbba · `game/src/core/orbit/scaleLaw.ts` (new), `game/tools/test-scale-law.mjs` (new), `game/tools/audit/f3abbbbba-regress.sh` (new) · the ADR-015 radius/distance/time laws and the derived host μ (4π²a³/T²), gravityRange and portalDist as a boot-only pure-core module; not imported by the catalog yet · why: F3a / A1-U10-2/-6, U12-1, D-ADR-2; the wiring is F3abbbbbb · gate 11/11 exit 0 twice, `--self-test` 12/12 exit 0 twice, `--deliberate` exit 1; typecheck/build exit 0 (`docs/audit/evidence/F3a/abbbbba/`) · ADR-015, REAL_BODY_DATA (ADR-011)
- 2026-10-27 · F3abbbbbb · `game/src/core/orbit/celestialData.ts`, `game/src/core/simulation/SimulationCore.ts` (`_macroTimeScale` 30→1), `game/tools/test-orbit-gate.mjs`, `game/src/test/Milestone1B_TestHarness.tsx`, `game/tools/test-play-spawn.mjs` (Sun elevation pin), `game/tools/audit/f3abbbbbb-regress.sh` (new), `docs/decisions/ADR-015` (addendum) · wired the ADR-015 scale laws into the catalog at 1× · A1-U10-2/-6, U12-1, D-ADR-2 · orbit gate 9/9 + self-test 12/12, scale-law 11/11, spin/rail/real-body/kcc/flight/seam/precision gates, play suites, typecheck, build, e2e-plumbing, playwright m1b all exit 0 (`docs/audit/evidence/F3a/abbbbbb/`) · ADR-015 addendum

2026-10-27 · F3abbbbbc · game/src/core/orbit/{orbitElements,celestialData,types}.ts, game/tools/test-orbit-gate.mjs, test-alloc-gate.mjs, test-play-*.mjs, Milestone1B_TestHarness.tsx, docs/decisions/ADR-016 · real orbit elements wired in; oracle extended; spawn pins re-pinned · bodies were circular and flat with M0 = index x golden angle · docs/audit/evidence/F3a/abbbbbc/ · session 124

- 2026-10-27 · F3a-follow-up (2) · `game/src/play/camera/ThirdPersonCamera.ts` (new `frameToward`), `game/src/play/world/moonConfig.ts` (`PLAY_TUNING.camSpawnAimAbove` 13°), `game/src/play/PlayPage.tsx`, `game/src/play/frame/playFrame.ts` (respawn), `game/tools/test-play-frame.mjs`, `game/tools/audit/f3afu2-regress.sh` (new), `docs/decisions/ADR-017` · spawn/respawn camera pitched so the Earth sits 13° above the view axis (topocentric aim); old `< 31°` row restored + 13° ± 1.5° / above-axis / respawn-pitch rows · Lead ruling 2026-10-27: Earth was 31.93° off axis at spawn · test-play-frame 26/26 exit 0 (Earth 12.99°), full regress `docs/audit/evidence/F3a/fu2/` · ADR-017, session 126

- 2026-10-27 · F2fba · `game/tools/audit/f2fb-make-variant.py` (new, audit tool only; no game code changed) · builds a 3057899 worktree with one batch hunk reverted to its c0ae8bf text · attribute the m1f R2 regression (A1-U01-1) · R2 cause = F-12 Sun-pose position `drv − O`; up vector innocent; 6 observer runs `docs/audit/evidence/F2f/b/` · ADR-018 method, session 128
- 2026-10-27 · F2fbba · game/tools/audit/f2fb-make-variant.py · new `F12diag` variant: diagnostic-only A/B renders after the m1f R2 verdict (layer masks, group visibility, absolute pose) · find what hides the Sun at the render-local pose · docs/audit/evidence/F2f/bb/ (2 runs, observer exit 0) · ADR-019

- 2026-10-27 · F2f (F2fbbb, session 130) · `game/tools/audit/f2fb-make-variant.py` · new variant `F12ray` (F12diag + a read-only post-verdict sightline probe: spin-law check, heightfield march, Sun-azimuth horizon, Raycaster, boom clearance) · to decide whether the R2(b) terrain occlusion is a frame bug or real · evidence `docs/audit/evidence/F2f/bbb/` (×2 identical: horizon 61° > Sun 33°, spinGroup error 0) · ADR-020

- 2026-10-27 · F2f (F2fcabb, session 132) · `game/src/test/M1fR2Gate.tsx`, `game/e2e/m1f-r2.spec.ts`, `game/tools/test-m1f-r2-gate.mjs` · new row R2c (composite Sun visibility with real terrain via TerrainMeshPool at a pose proven clear by analytic horizon march + mesh raycast; camera raised 5 m steps ≤ 200 m, else FAIL "sightline not clear"), mutants `?mut=horizon` and `?mut=noray`; spec expects 3 rows; self-test 5 cases · completes the rebuilt R2 gate (ADR-020/021) · evidence `docs/audit/evidence/F2f/cabb/` (self-test exit 0 ×2, spec exit 0 badges PASS×3, typecheck exit 0) · ADR-021 amendment

- 2026-10-27 · F2f (F2fcb, session 133) · `game/src/test/M1fR1Gate.tsx`, `game/e2e/m1f-r1.spec.ts`, `game/tools/test-m1f-r1-gate.mjs`, `game/src/main.tsx` (static-map entry `m1fR1`) · new rebuilt R1 gate page: R1a depth separation from scene state (pass from `layerMaskFor`, planes read from the rig cameras, screen overlap required, n/a = FAIL, gap/δ > 10 for a 24-bit buffer) and R1b rendered layering (`executePasses` at 5 sub-pixel poses with 100% front share, determinism, rendered single-camera counterfactual that must fuse the probe pair); mutants `?mut=planes` and `?mut=assign` · the shipped R1 passes by construction (A1-U02-2/-3/-4) · evidence `docs/audit/evidence/F2f/cb/` (self-test exit 0 ×2, spec exit 0, typecheck exit 0) · ADR-022

- 2026-10-27 · F2f (F2fccba, session 135) · `game/src/test/m1fHandoff.ts` (new), `game/src/test/Milestone1F_TestHarness.tsx` §5, `game/src/test/M1fR3Gate.tsx` (new), `game/src/main.tsx` (static-map entry `m1fR3`), `game/e2e/m1f-r3.spec.ts` (new), `game/tools/test-m1f-r3-gate.mjs` (new), `game/tools/audit/{u03-r3r4r5-validity,u27b3b2a-r3-recheck,u27b1-k1-recheck}.mjs` · handoff controller moved verbatim into a pure module (harness imports + re-exports, rows untouched); rebuilt R3 gate row R3a (state-coupled sweep under the rendered draw rules, live 60 Hz triangle) with positive control `?ctl=ref`; spec pins the known-red vector; audit tools read the moved module · why: A1-U03-2 (shipped R3 counters ignore meshState and cannot fail), ADR-023 · evidence: `docs/audit/evidence/F2f/ccb/` (spec ×2 exit 0, self-test ×2 exit 0, shipped m1f spec badges unchanged, R5 waived) · source: U27c §2 F2f row, ADR-023

- 2026-10-28 · F2f (F2fccbba, session 136) · `game/src/test/M1fR3Gate.tsx`, `game/e2e/m1f-r3.spec.ts`, `game/tools/test-m1f-r3-gate.mjs` · new GPU row R3b: isolated rendered coverage at 205–290 km in each direction, using the shipped SkyImpostorPool and executePasses, measured as area vs a full-opacity mesh reference, n/a = FAIL; mutants `?mut=meshhide` and `?mut=noimp`; `?ctl=ref` changed to an opaque swap; spec pins `['FAIL','FAIL']` and the measured R3b fail set · why: ADR-023 R3b; finding F2fccbb-1 (the impostor draws ~1.35× the mesh area and ~2.57× its luminance) · evidence: `docs/audit/evidence/F2f/ccbb/` (self-test ×2 exit 0, spec ×2 exit 0, tsc exit 0) · source: U27c §2 F2f row, ADR-023

- 2026-10-28 · F2f (F2fccbbb, session 137) · `game/src/test/M1fR3Gate.tsx`, `game/e2e/m1f-r3.spec.ts`, `game/tools/test-m1f-r3-gate.mjs` · new GPU row R3c: mesh-only vs impostor-only silhouette A/B at 228/232/236 km on the shared R3b fixture (`makeFixture`), with areas bounded ±25% of π·r², sym ≤ 0.5·2πr, centroid ≤ 0.5 px and a byte-identical repeat; mutants `?mut=shift`/`scale`/`bright`; spec pin → ['FAIL','FAIL','FAIL'] · why: ADR-023, A1-U03-3 (the shipped R3(c) compared a saturated window and passed vacuously) · evidence `docs/audit/evidence/F2f/ccbbb/` (self-test ×2 and spec ×2 exit 0, tsc exit 0; R3c measured FAIL from finding F2fccbb-1, impostor 88 px vs mesh ~68 px) · source ADR-023 amendment F2fccbbb

- 2026-10-28 · F2f (F2fcda, session 138) · `game/src/test/M1fR4Gate.tsx`, `game/src/main.tsx` (map entry `m1fR4`), `game/e2e/m1f-r4.spec.ts`, `game/tools/test-m1f-r4-gate.mjs` · new page `?page=m1fR4`, row R4a: 75 boot references of the shipped SkyImpostorPool/MultiCameraRig objects compared with === after 3,000 pure frames + 300 executePasses renders, plus gl.info geometry/texture/program counts; mutants `?mut=replace` (same-shaped bodies[5]) and `?mut=realloc` (new aDisk array) · why: A1-U03-4 (the shipped R4 canary is never compared and its shape predicate passes a same-shaped replacement); ADR-024 · evidence `docs/audit/evidence/F2f/cda/` (self-test ×2 exit 0, spec exit 0, tsc exit 0) · source: U27c §2 F2f row, ADR-024

- 2026-10-28 · F2f (F2fcdb, session 139) · `game/src/test/M1fR4Gate.tsx`, `game/tools/r4-cdp-driver.mjs` (new), `game/e2e/m1f-r4.spec.ts`, `game/tools/test-m1f-r4-gate.mjs` · rows R4b (CDP sampling allocation incl. GC-collected objects, calibrated, budget 64 B/frame) and R4c (GC-bracketed retained trend, calibrated, |x| ≤ 8 B/frame). The page exposes its burn as `window.__r4`, and a missing driver = FAIL. Mutants churn/leak and a no-driver case were added. Spec pin ['PASS','FAIL','PASS'] · why: ADR-024, A1-U03-4/K2a (the shipped R4 heap clauses could not see churn and passed on missing/negative readings) · evidence `docs/audit/evidence/F2f/cdb/` (self-test ×2 + spec exit 0, tsc exit 0; R4b measured red on render: finding F2fcdb-1) · source ADR-024 amendment F2fcdb

- 2026-10-28 · F2f (F2fcea, session 140) · `game/src/test/M1fR5Gate.tsx` (new), `game/src/main.tsx` (map entry `m1fR5`), `game/e2e/m1f-r5.spec.ts` (new), `game/tools/test-m1f-r5-gate.mjs` (new) · new page `?page=m1fR5`, row R5a. The real SimulationCore walks a scripted, continuous 4,000 m great-circle route, checked every tick against an independent f64 lattice oracle: shift count, Δ, origin, local bound, f32 locals for the focus and 17 celestials, step bound, local-step identity. Mutants nadir/skew/teleport. · why: shipped R5 "rebases ≥ 2" is unreachable by its overhead-target fixture (A1-U03-5), and its continuity term passes on 0 samples (A1-U03-6) · evidence `docs/audit/evidence/F2f/cea/` (self-test ×2 exit 0, spec exit 0) · source ADR-025

- 2026-10-28 · F2f (F2fcea quality, session 140) · `game/src/test/M1fR5Gate.tsx`, `game/tools/test-m1f-r5-gate.mjs` · R5a runs at terrain heights 0/180/360 m (R = 1,364.5 + h), all must pass; the self-test requires each mutant reason at all three heights · why: the verdict should not rest on one fixture radius (K2d) · evidence `docs/audit/evidence/F2f/cea/*-3h-*` (self-test ×2 exit 0, spec exit 0, oracle sweep 0 shifts at every nadir arc, 2/2/3 at 4,000 m) · source ADR-025
