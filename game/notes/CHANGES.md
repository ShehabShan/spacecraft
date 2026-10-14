# CHANGES.md — Solaris Engine Assembly (game/)

Change log per assembly brief §6. Format:
date · milestone · file · what · why · evidence · source.

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
