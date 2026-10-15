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
