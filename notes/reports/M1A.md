# MILESTONE 1A REPORT — Floating Origin (assembly brief §8.6)

Date: 2026-10-14 · Branch: m1-assembly · Canon: untouched (git diff vs ea112ec = empty)

**Gate: GREEN — `[Milestone1A] acceptance PASSED`, all 5 rows PASS, first run,
zero canon edits. No pre-authorized fixes (F1–F5) apply to 1A.**

## 1. Extraction report (verbatim from `node tools/extract.mjs 1A`)

```
[extract 1A] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1A.txt
  src/core/types.ts — 123 lines
  src/core/math/precisionMath.ts — 170 lines
  src/core/simulation/SimulationCore.ts — 395 lines
  src/store/useGameStore.ts — 156 lines
  src/render/FloatingOriginAdapter.ts — 118 lines
  src/test/Milestone1A_TestHarness.tsx — 766 lines
[extract 1A] 6 block(s) written verbatim (1728 code lines).
```

6/6 expected blocks found and balanced. Zero parenthetical-branch matches (the
§10.4/§4.2 invariant holds; the one sanctioned match is reserved for 1B's
SimulationCore). No layeredCameras discard (1F defensive case did not trigger).
BOM stripped, CRLF→LF normalized (0 CR bytes verified in extracted files).
Canon quirks preserved byte-exact — see observation O1.

## 2. Wiring

- Scaffolded `game/` via `npm create vite` (react-ts), pinned to the exact
  §3.3 stack: react/react-dom 18.2.0, three 0.165.0, @react-three/fiber
  8.18.0 (v8 line, NOT v9), zustand ^4.4, TS ~5.4, Vite 5.4.21,
  playwright 1.64.0. No rapier; nothing unapproved.
- `?page=m1a` registered in the static switcher map (`src/main.tsx`); menu
  uses plain `<a>` full loads; NO React.StrictMode. Build emits the harness
  as its own 828 kB chunk — unselected modules never execute.
- `playwright.config.ts` + `e2e/m1a.spec.ts` per §3.7 (chrome channel,
  headless, serial workers, 300 s timeout, webServer build+preview :4173,
  1A budget 30 s). Imports use `playwright/test`: the single approved
  `playwright` package ships that subpath and the runner CLI, so
  @playwright/test was NOT added (CHANGES.md entry 6).

## 3. ACTUAL test output (verbatim)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1a gate] page console transcript:
  error: Failed to load resource: the server responded with a status of 404 (Not Found)
  log: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (6.1s)

  1 passed (12.7s)
```

Per-row badges in order: abs-distance PASS · local-bound PASS · rebase-count
PASS (9 rebases — exactly the canon-predicted count and tick positions
31…277) · delta-lattice PASS · frame-stability PASS (no environment-soft
caveat needed).

## 4. Changes

Scaffolding entries 1–6 in notes/CHANGES.md. Zero changes to extracted canon
code. Canon verified untouched: `git diff ea112ec -- Design_specs Milestone`
is empty.

## 5. Observations & open questions

- **O1 (observation, no change made):** canon 1A harness detail strings
  contain template interpolations missing their `$` (e.g. `P.x={ticks}`,
  `{simTime.toFixed(3)}`, `maxLocal={f2(avg)}ms` — visible in the pasted
  acceptance line). Syntactically valid literals, purely cosmetic; the
  acceptance prefix and all five row evaluations use real values; the gate
  regex matches. Extracted verbatim. Flagged for the Lead: canon source
  (Milestone/ 1A.txt ~lines 1366–1402) could be corrected only by the Lead.
- **O2 (cosmetic):** one console 404 — Chrome auto-requests /favicon.ico.
  Harmless.
- **Watch items closed:** Node v25 ran Vite 5.4 build/preview + headless
  Chrome gate cleanly; the space in the repo path caused zero issues through
  scaffold, install, build, test.

## 6. Lead eyeball (optional)

`npm run dev` in `game/` → http://localhost:5173/?page=m1a — the 256 m grid
streaming past at 2,000 m/s with no slide at any origin shift is the visual
floating-origin proof (rebases pulse ~every 0.52 s; `O mod 256` pinned at 0).

## Status

GATE GREEN · AWAITING LEAD APPROVAL (§8.7). On approval: commit
"M1A: extracted, gates green" and proceed to 1B (SimulationCore overlay +
1A regression re-run).
