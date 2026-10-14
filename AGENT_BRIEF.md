# ZCODE AGENT BRIEF — SOLARIS ENGINE ASSEMBLY (MILESTONES 1A–1G)

You are a build engineer assembling a locked, milestone-gated WebGL2 space-exploration
engine. Work at maximum care: the code is unusual BY DESIGN and is documented as such.

## 1. MISSION

The complete engine already exists as code inside seven canon documents. Your job is NOT
to write it: it is to (a) scaffold the project no milestone delivers, (b) extract the
canon code verbatim by script, (c) wire each milestone's test harness into a runnable
page, and (d) prove each milestone's automated acceptance suite passes — one milestone
at a time, reporting and waiting for Lead approval between milestones. You never invent
engine code and never reinterpret the design.

## 2. CANON, READING ORDER, PRECEDENCE, AND LEAD DECISIONS

### 2.1 Repository and reading order
- Repo: github.com/ShehabShan/spacecraft — clone it; all work happens inside the clone.
- READ-ONLY canon (never edit, never delete, never commit changes to):
  - `Design_specs/00_VISION_AND_RULES.txt` … `05_MILESTONES_AND_TESTS.txt` — design law.
  - `Milestone/Milestone 1A.txt` … `Milestone 1G.txt` — the seven deliverable documents
    (each contains reasoning, a compliance map, code files under `### N. \`path\``
    headers, a test harness, and verification notes).
- Reading order: this brief first → Design_specs/00 (Laws) and 05 (acceptance gates) →
  skim 01–04 → then, per milestone, that milestone's .txt in full (including the
  reasoning sections — they explain why the code is the way it is).

### 2.2 Conflict precedence (in order)
1. RATIFIED DECISIONS in §2.3–2.5 — Lead-approved exceptions and values. FINAL.
2. The Laws in Design_specs (especially 00 §3).
3. The acceptance tests (Design_specs/05 + each harness's built-in suite).
4. The milestone code (a strong baseline, fixable only with evidence, §6).
If you find a spec-vs-code conflict that §2.3–2.5 does not cover: STOP, cite file and
section, propose options, ask the Lead. Never resolve it yourself. Never "fix" canon to
match a spec clause that §2.3 explicitly overrides.

### 2.3 RATIFIED DEVIATIONS (final — never change these to match Design_specs)
1. 1F Background camera: a scaled staged space [500, 10,000] m with angular
   preservation (s = D·tan θ) instead of Spec 04.1's literal [200 km, 10,000 km] Far
   band. (Milestone 1F.txt, analysis §1.1–1.2)
2. 1F mesh↔impostor handoff: hysteresis flip at 240/220 km, fade window [225, 236] km.
   The spec's 250 km is a camera boundary that no longer exists as a mesh boundary.
   (1F analysis §1.3)
3. 1F straddler rule: Spec 04.2's outer-layer rule PLUS inner-layer persistence while
   coverage overlaps — required because terrain chunks (r > 400 m) would clip Mid-only
   at 2.4 km. (1F analysis §1.2)
4. 1F local-bubble convention: moon = bubble center, Sun-parallel axes, the 583 km rail
   offset carried in Float64 for sky geometry only; macro timeScale 0 in that harness.
   (1F analysis preamble)
5. SUN_ORBITAL_MU = 274 · 20000² = 1.096e11 m³/s² (catalog gives the Sun gameplay
   surfaceGravity 0; Kepler's Third Law needs an orbital μ). Defined in
   src/core/orbit/celestialData.ts. FINAL.
6. 1B epoch spread: golden-angle M0 instead of real-date arrangements (Spec 00.4
   out-of-scope). (celestialData.ts)
7. Catalog data beats formula regeneration wherever they disagree by rounding (e.g.,
   Mercury radiusGame 3105.7). NEVER re-derive catalog constants from the Section 02
   compression formulas. (celestialData.ts header)
8. 1D speed cap: 2,000 m/s enforced as a C¹ thrust fade on [1,880, 2,000] m/s plus a
   NaN-guard rescale at 2,025 — never a velocity clamp. (flightController.ts)
9. 1G acceptance scenario: save/restore of the walking ASTRONAUT, not Spec 05's diving
   ship (no ship exists in that harness); the restore machinery is body-agnostic and
   the isomorphism proof is stronger. Diving-ship save is Stage 2. (Milestone 1G.txt)
10. 1G hydration gate: "leaf chunk under the player is active" instead of Rapier
    `intersectionsWithShape == EMPTY`. Rapier is deferred (§2.4); the swap point is
    documented there.

### 2.4 Rapier: DEFERRED — hooks only, do not implement
Do not install @react-three/rapier or any physics library. The analytic collision
systems (1D DDA sweep, 1E analytic KCC) are the verified design; adding Rapier now
would invalidate the acceptance proofs. Hook points, for the record only:
- src/core/simulation/SimulationCore.ts → tick(): the Forces / world.step / Write-back
  slots marked dormant in the file header (Spec 01.1 steps 5–7).
- src/core/types.ts → RebaseEvent: exact-Δ translation of Rapier bodies on rebase.
- src/render/TerrainMeshPool.ts → bindRecord() and records at state === 2: Active-state
  heightfield colliders (Spec 01.5 state 4).
- src/test/Milestone1G_TestHarness.tsx → tickHydration(), HYDRATING phase: the
  production Spec 01.6 step-4 gate.
- src/core/physics/astronautKCC.ts: the analytic sweep IS the Spec 01.4 "relative
  walking displacement" domain; Rapier never owns the KCC.

### 2.5 RATIFIED CONSTANTS (final)
- SHIP_AERO (src/core/physics/aerodynamics.ts): betaQ = 3.2e-3 m²/kg (derived from the
  ≤ 400 m/s @ 1,000 m dive gate with 27% margin), betaL = 0.012, aStruct = 90 m/s²,
  mass = 1,200 kg.
- KCC step/slope rule (src/core/physics/astronautKCC.ts, _tryMove): a move climbs iff
  Δh ≤ 0.55 m AND Δh/arc ≤ tan 50°; slide above 45° slope (μk = 0.6); snap-down
  ≤ 0.45 m. The dual rule makes walkability a property of terrain, not speed.
- The 1G astronautKCC patch (Milestone 1G.txt §3.5) is final and strictly append-only.

### 2.6 Blank formulas in Design_specs/02 — where the implemented truth lives
The spec's formula blanks are not bugs to fill from spec text; the working versions are
in code. Do not re-derive or "restore" them into the specs or the code:
- Compression formulas (planet radius, sun distance, moon orbit, gravity range):
  precomputed in celestialData.ts RAW table — catalog wins (§2.3.7).
- μ = g·R² with the C¹ 75–100% range fade: celestialData.ts + sphericalFrame.ts
  (gravityInto / rangeFade).
- ρ(alt) = ρ₀·e^(−max(alt,0)/H_s), ρ₀ = 1.225, H_s = 1,200 m: atmosphere.ts densityAt().
- Drag: k = βq·ρ·|v_rel| + βl·ρ; v_rel·e^(−k·dt): aerodynamics.ts dragK /
  exponentialDragFactor.
- Governor: v_safe = √(aStruct/(βq·ρ)): aerodynamics.ts safeSpeedAt().
- Tick: FIXED_DT = 1/60, MAX_SUBSTEPS = 5, shed-don't-dilate (SimulationCore.ts,
  flightController.ts, astronautKCC integrateTick).
- The 1D acceptance blank reads: "force the ship to ≤ 400 m/s by 1,000 m altitude."
  The number is 400 m/s (the harness predicts 310–345 m/s actual arrival).
- Portal placement/trigger (Spec 02.5): NOT IMPLEMENTED — a coverage gap (§2.7).

### 2.7 Coverage gaps (absent BY DESIGN — do not treat as bugs, do not add them)
Portals (02.5) · Rapier physics step (§2.4) · dormancy state 4 Active colliders (01.5)
· ship↔astronaut EVA transition (the KCC VEHICLE mode exists and is tested with a
synthetic platform; real boarding is Stage 2) · multiple landable bodies (terrainField
planet parameters are module singletons — ONE body's field per page; this drives the
page-navigation rule in §3) · meteor/shed visuals (the shed MECHANISM exists via
shedSeconds) · per Spec 00.4: damage, audio, fuel, jetpack, swimming/climbing/flying,
asteroid belts, comets, real-date arrangements · the integrated game scene
(astronaut + terrain + sky rig + saves on one page) — Stage 2, NOT part of the 1A–1G
gates.

## 3. SETUP (you create ALL of this — no milestone delivers it)

### 3.1 Layout
Work inside the repo clone. Default (propose alternatives in your opening report only
if you see a concrete problem):
```
/                     Design_specs/  Milestone/   (read-only canon, untouched)
/game                 Vite app you create
  /src                extracted canon code (exact tree from the milestone docs)
  /src/main.tsx       entry: reads ?page=, dynamic-imports EXACTLY ONE harness
  /src/App.tsx        default menu page with plain <a href="?page=m1a">… links
  /tools/extract.mjs  extraction script (§4)
  /e2e                Playwright specs
  /notes/CHANGES.md   change log (§6)
```
Create the app with: `npm create vite@latest game -- --template react-ts` (run from the
repo root), then adjust per below. Package manager: npm only.

### 3.2 CRITICAL navigation rule
Page switching MUST be full page loads (menu links are plain `<a href="?page=…">`),
and main.tsx must import ONLY the selected harness via a static map of
page → () => import(…) (so Vite can code-split and only the selected module ever
executes). Three reasons, all structural: (1) terrainField is a module singleton — one
planet's field per page; (2) each harness spawns Web Workers that nothing tears down;
(3) every harness monkey-patches THREE prototypes at module scope — loading several
harness modules in one page stacks the patches. Full reloads make all three moot.

### 3.3 Dependencies (exact; nothing else without asking the Lead)
- react 18.2.0, react-dom 18.2.0, @types/react ^18.2, @types/react-dom ^18.2
- three 0.165.0, @types/three 0.165.0
- @react-three/fiber ^8.15.0  — v8, NOT v9 (v9 requires React 19)
- zustand ^4.4.0
- devDependencies: typescript ~5.4.0 (≥ 4.9 REQUIRED — celestialData.ts uses
  `satisfies`), vite ^5.2.0, @vitejs/plugin-react ^4.2.0, playwright ^1.44.0
  (Playwright is Lead-approved dev tooling; it is never a runtime dependency)
- Explicitly forbidden: @react-three/rapier; any other runtime library.
- scripts: dev, build (vite build), preview, typecheck (tsc --noEmit), test
  (playwright test)

### 3.4 tsconfig (game/)
target ES2020; lib ["ES2020","DOM","DOM.Iterable"]; module ESNext; moduleResolution
bundler; jsx react-jsx; strict true; skipLibCheck true; noUnusedLocals FALSE;
noUnusedParameters FALSE (canon contains deliberate `void x` canary/scratch patterns —
the flags must be off); noEmit; isolatedModules; types ["vite/client"]; include ["src"].

### 3.5 Vite and workers
Stock vite.config.ts with the react plugin only. Worker bundling is NATIVE via the
canon pattern `new URL('../workers/terrainWorker.ts', import.meta.url)` with
{type:'module'} — no worker plugin. BUT src/render/ and src/workers/ MUST remain
siblings exactly as documented, or the worker URL breaks.

### 3.6 Entry files
- index.html: standard Vite root.
- main.tsx: render WITHOUT React.StrictMode (the harnesses use module singletons;
  StrictMode double-mounts and will corrupt them).
- One cosmetic-only allowance: if sky/impostor shading looks washed out under three's
  color management, you may set outputColorSpace: LinearSRGBColorSpace. Visual tuning
  never touches acceptance math; log it in CHANGES.md.

### 3.7 Playwright config (game/playwright.config.ts)
testDir e2e; baseURL http://localhost:4173; webServer: `npm run build && npx vite
preview --port 4173`; use: { channel: 'chrome', headless: true } — Chrome is required
(WebGL2 for 1F's A/B renders; performance.memory for heap rows; IndexedDB for 1G);
timeout 300_000; workers: 1 (serial — GPU and Web Workers do not parallelize safely).
One test per page: goto `/?page=m1X`, collect console messages, wait for the line
matching `\[Milestone1X\] acceptance (PASSED|FAILED)` (per-milestone wait budgets:
1A 30 s, 1B 20 s, 1C 150 s, 1D 120 s, 1E 90 s, 1F 150 s, 1G 360 s), assert PASSED,
and scrape all `.badge` element texts for the per-row report. If Chrome or WebGL2 is
unavailable in your environment: STOP and tell the Lead rather than substituting a
browser silently.

## 4. EXTRACTION (scripted, verbatim, never retyped)

Write `tools/extract.mjs` (plain Node, no deps). Usage: `node tools/extract.mjs 1A`
… `1G` — incremental, one milestone per invocation, matching the gated workflow.

Algorithm, per milestone .txt:
1. Read the file; strip BOM; normalize CRLF → LF.
2. Find headings matching /^###\s+\d+\.\s+`([^`]+)`\s*$/ where the captured path
   matches /^src\/.+\.(ts|tsx)$/. This deliberately skips non-path headings such as
   the "### 1.1 …" and "### 1.4 …" analysis headings (e.g., in Milestone 1C.txt).
3. For each match, capture the NEXT fenced code block (``` … ```) and write it
   VERBATIM — byte-for-byte, no reformatting, no re-typing, no "improvements" — to
   game/<path>.
4. Special cases:
   - 1A's src/core/simulation/SimulationCore.ts is written at 1A time and OVERWRITTEN
     by 1B's when you run `extract 1B` (1B is a strict superset; its own suite has an
     M1A-regression row proving compatibility). The 1B run's report must note the
     overlay.
   - Milestone 1G.txt: ALSO capture the fenced block following the heading containing
     "3.5" and "Appendix" (the astronautKCC persistence patch). Write it to
     tools/patches/kcc-m1g-patch.txt — it is NOT a standalone file. You apply it BY
     HAND during milestone 1G, following the block's own internal separator comments:
     the module-scope parts (PersistentPlayerState, makePersistentPlayerState,
     modeToCode/codeToMode) go after the existing imports; the two methods
     (capturePersistentStateInto, restorePersistentState) are appended INSIDE the
     AstronautKCC class body before its closing brace. Log the application.
   - Defensive: if Milestone 1F.txt contains any block for
     src/render/layeredCameras.ts, DISCARD it and note it in the report (a truncated
     earlier attempt; the Lead confirmed the canon copy is the complete delivery, so
     this should not trigger — but check and report either way).
5. Verify and print a report: per milestone — blocks found, target paths, line counts.
   Expected block counts: 1A→6, 1B→5, 1C→6, 1D→4, 1E→3, 1F→4, 1G→4 (+1 staged patch)
   = 32 blocks, 31 unique files (SimulationCore extracted twice; 1B wins).
   If any heading's fenced block is missing or unbalanced (truncation): STOP and
   report the location to the Lead. Never invent missing code.

PRE-AUTHORIZED FIXES — the ONLY content edits allowed at extraction time. Apply after
the verbatim write; log each in notes/CHANGES.md:
- F1  src/test/Milestone1E_TestHarness.tsx: replace the
  `require('../core/terrain/terrainField')` shim inside slopeFromNormal with a
  top-level ESM `import { terrainNormalInto } from '../core/terrain/terrainField'`
  (delete the shim indirection; identical behavior — require() does not exist in ESM).
- F2  src/test/Milestone1G_TestHarness.tsx: the same require-shim replacement in its
  slopeDegAt helper.
- F3  src/test/Milestone1F_TestHarness.tsx: (a) delete the dead slopeDegAt stub
  function; (b) replace the vestigial sun-trace rebase-marking block with a per-frame
  module-counter comparison against core.stats.rebaseCount (a two-line fix flagged at
  delivery; the suite's rebase assertion reads position jumps either way).
- F4  src/core/physics/flightController.ts: delete the leftover line
  `const _segP0x: number[] = [0];` (the live state is the `let segP0x…` module block).
- F5  src/test/Milestone1C_TestHarness.tsx: delete the `void m;` guard line in the
  WIREFRAME button's onClick.
Anything beyond F1–F5 follows the change policy (§6).

## 5. NON-NEGOTIABLE RULES (from Design_specs 00 §3 and this brief)

- src/core/** must import NOTHING from three / react / @react-three/fiber / rapier.
  (src/core/render/impostorMath.ts is pure — it imports only from
  core/physics/sphericalFrame; verify this holds.)
- Zero-GC: all buffers and pools are boot-allocated; no per-frame allocation in tick
  loops; no geometry.dispose() and no scene.remove() mid-flight — the harnesses
  monkey-patch and COUNT these; the counts must stay 0 during their windows.
- 256 m origin lattice: O = 256·floor(P/256 + 0.5); rebase trigger max|local| > 1024 m;
  local coordinates are ALWAYS computed as Float64 subtraction then narrowed — never
  f32 arithmetic on large coordinates.
- The canonical tick order (Spec 01.1) as implemented in SimulationCore.tick().
- No Euler-angle (yaw/pitch accumulator) state for the astronaut — parallel-transport
  frame only.
- Out-of-scope features get hooks only (§2.4); coverage gaps (§2.7) are never filled.
- No new libraries without asking the Lead (approved list in §3.3).

## 6. CHANGE POLICY

The milestone code is a strong baseline, not scripture — but every change needs
evidence and a log entry.
You MAY fix (each with a notes/CHANGES.md entry):
- build errors, type errors, broken imports, environment/scaffolding issues;
- wiring between milestones;
- bugs PROVEN by a failing acceptance row (paste the failing output, explain the root
  cause, apply the minimal fix).
You may NOT:
- refactor, restyle, reformat, or "simplify" canon code;
- change formulas, constants, thresholds, tick order, or acceptance logic;
- touch the acceptance tests or the Laws (only HOW they are met may change, never WHAT
  they demand);
- deduplicate the per-harness quadtree/LOD controllers — each harness re-declares
  ~200 lines BY DESIGN for independent regression;
- edit anything under Design_specs/ or Milestone/ (read-only; notes files REFERENCE
  them, never modify them).
The RATIFIED items in §2.3–2.5 are Lead decisions and final. If you believe one is
wrong, or hit a conflict they do not cover: STOP, cite files and sections, propose
options, ask the Lead.
notes/CHANGES.md entry format: date · milestone · file · what · why · evidence (error
or failing output) · source (Milestone .txt § or Design_specs §).

## 7. PER-MILESTONE PLAN (1A → 1G, in order)

All seven harnesses are SELF-CONTAINED (each constructs its own SimulationCore,
terrain pool, and scene), so "wiring" means: extraction + page registration + build.
Every harness auto-runs its acceptance suite on mount and logs
`[Milestone1X] acceptance PASSED|FAILED` to the console; per-row PASS/FAIL badges
appear in the DOM (.badge elements).

1A — Floating Origin. Source: Milestone 1A.txt. Files: src/core/types.ts,
  src/core/math/precisionMath.ts, src/core/simulation/SimulationCore.ts (the 1A
  version for now), src/store/useGameStore.ts, src/render/FloatingOriginAdapter.ts,
  src/test/Milestone1A_TestHarness.tsx. Depends on: nothing. Wiring: full scaffolding
  (§3), extract script, page switcher. Gate: console PASSED within ~10 s; 5 rows.
  Machine-verifiable: all rows. NOTE: row 5 (frame-time stability) is
  machine-dependent — if it alone fails under CI load, report it as
  environment-soft with evidence; do not change code to make it pass. Lead eyeball
  (optional): grid streaming continuity at 2,000 m/s.

1B — Kepler Rails & Two-Tier Time. Source: Milestone 1B.txt. Files:
  src/core/orbit/types.ts, KeplerRail.ts, celestialData.ts; SimulationCore.ts
  (OVERLAYS 1A's); the harness. Depends on: 1A. Gate: PASSED within ~5 s; 5 rows —
  row 5 is the M1A regression, proving the overlay broke nothing. ALSO re-run the 1A
  page. Machine: all rows (the heap row needs Chrome; it degrades gracefully
  elsewhere). Lead eyeball (optional): the orbit map and ±60-day jumps.

1C — Terrain & Zero-GC Pool. Source: Milestone 1C.txt. Files:
  src/core/terrain/spherify.ts, noise.ts, terrainField.ts;
  src/workers/terrainWorker.ts; src/render/TerrainMeshPool.ts; the harness. Depends
  on: nothing from 1A/1B, but requires the worker pipeline. Wiring: verify Vite
  actually bundles/spawns the workers — symptom if broken: zero chunks ever arrive,
  warmup times out at 8 s, and the seam/geometry rows fail; check worker construction
  FIRST when debugging. Gate: PASSED within ~150 s (a 60 s flight window); 4 rows.
  Machine: all rows (the seam check is bitwise-computed, not visual). Lead eyeball
  (optional): seams and wireframe once.

1D — Flight & Aerodynamic Governor. Source: Milestone 1D.txt. Files:
  src/core/physics/atmosphere.ts, aerodynamics.ts, flightController.ts; the harness
  (which also uses the 1C terrain modules and the 1A/1B core, adapter, and pool).
  Apply F4. Gate: PASSED within ~120 s; 5 rows; the spec-gate row is the dive:
  2,000 m/s vertical entry with streaming FROZEN must arrive at ≤ 400 m/s by 1,000 m
  altitude with zero terrain penetration. Machine: all rows. Lead eyeball (optional):
  the dive.

1E — Spherical Astronaut. Source: Milestone 1E.txt. Files:
  src/core/physics/sphericalFrame.ts, astronautKCC.ts; the harness (uses 1C terrain
  + core + pool). Apply F1. Gate: PASSED within ~90 s; 6 rows, including the
  spec-canonical Coriolis jump (numeric: lands ~1.8 cm west, settles to 0 m/s
  relative within 2 ticks). Machine: all rows. Lead eyeball (optional): walking,
  jumping, the zero-G drop (T key).

1F — 3-Camera Layers & Sky Impostors. Source: Milestone 1F.txt (the complete
  delivery — Lead-confirmed). Files: src/core/render/impostorMath.ts,
  src/render/SkyImpostorPool.ts, src/render/MultiCameraRig.tsx; the harness (uses 1C
  terrain, 1B core, 1E sphericalFrame). Apply F3. Verify impostorMath.ts contains no
  three imports (pure-core rule). Gate: PASSED within ~150 s; 5 rows — the spec's
  "pixel difference identically zero" is implemented as machine byte-diff A/B renders
  and needs real WebGL2 (§3.7). Machine: all rows. Lead eyeball (optional): the
  Earthrise composition and the probe crossfade.

1G — IndexedDB Save Pipeline. Source: Milestone 1G.txt. Files:
  src/core/persistence/BinaryStateSerializer.ts, IndexedDBProvider.ts, SaveManager.ts;
  the harness; PLUS the staged §3.5 KCC patch applied by hand to
  src/core/physics/astronautKCC.ts per §4.4. Apply F2. MANDATORY regression: after
  patching the KCC, re-run the FULL 1E gate — the patch is append-only and must not
  disturb it; this re-run is part of 1G's gate, not optional. Gate: PASSED within
  ~360 s (IndexedDB works headless in Chromium); 6 rows. Machine: all rows. Lead
  eyeball (optional): the Moon rewinding on load, and the corrupt-save rejection.

Regression rule at EVERY gate: re-run all previously passed pages as well (fully
automated, ≤ ~8 min total). A previously green suite turning red is a break you
introduced — fix it under §6 before reporting.

## 8. THE PER-MILESTONE LOOP

For each milestone, in this exact order:
1. Run `node tools/extract.mjs 1X` and include its report.
2. Apply that milestone's pre-authorized fixes (F1–F5 as applicable).
3. Register the page in the switcher.
4. `npm run typecheck` and `npm run build`; fix issues per §6, logging each.
5. Run the milestone's Playwright gate plus the full regression of prior pages.
6. Write the MILESTONE REPORT containing: files created (with the extraction
   report's line counts); the ACTUAL test output pasted verbatim (the suite console
   line and the per-row badges scraped from the DOM); every change made (linked to
   its CHANGES.md entry); open questions; and the Lead-eyeball items. Never claim a
   pass without pasting the real output. Never mark an environment-soft failure as a
   pass either — report it exactly as observed.
7. STOP and wait for the Lead's approval. Do not begin the next milestone.
8. On approval: git commit in the repo (message: "M1X: extracted, gates green").
   Ask the Lead before pushing to GitHub.

## 9. YOUR FIRST ACTION (before any code)

1. Read this brief in full. Read Design_specs/00 and 05; skim 01–04.
2. Write one short paragraph summarizing your understanding of the project and this
   brief (mission, precedence, the loop, the hard stops).
3. Propose: the project structure (anchored on §3.1), the scaffolding plan, the
   extraction-script design, the Playwright gate design, and your git branch
   strategy (default: work on a branch; ask before pushing).
4. STOP. No code of any kind until the Lead approves.

HARD STOPS (always, at any phase): a truncated or unbalanced code block in canon · a
spec-vs-code conflict not covered by §2.3–2.5 · any impulse to change a formula,
constant, threshold, or acceptance test · any new library · Chrome or WebGL2
unavailable for headless runs · any doubt about whether a change is authorized —
when in doubt, stop and ask the Lead.
```

## 10. MULTI-SESSION RESUME PROTOCOL (appended; Lead-ratified)

This project runs across MANY fresh agent sessions with NO shared memory. The
repo is the only continuity. State carriers:
- AGENT_BRIEF.md (root) — this contract. FROZEN: amendments only by the Lead,
  logged in §10.4.
- notes/STATE.md — single source of truth for progress + the NEXT ACTION
  pointer. Tracked in git (never gitignored).
- notes/CHANGES.md — change log (§6).
- notes/reports/M1X.md — every milestone report (§8.6) is WRITTEN TO THIS
  FILE, not only pasted in chat. Evidence must outlive its session.

10.1 STATE.md sections (maintain exactly): NEXT ACTION (one line, the exact
next step — the most important line) · MILESTONE LEDGER (status per
milestone: NOT STARTED / EXTRACTED / GATE RUN / GATE GREEN·AWAITING LEAD /
APPROVED(commit) + report link) · IN-FLIGHT (current milestone, last
completed action, open debug notes — symptom, hypothesis, what was tried;
written BEFORE attempting anything risky) · APPROVAL LEDGER (every Lead
decision with date) · SESSION LOG (one row per session ending in a handoff
note) · ANCHOR (last commit hash this state describes).

10.2 Write discipline — update STATE.md at: completion of each §8 loop step;
every hard stop; immediately before a session ends (final handoff note);
when recording a Lead approval. Commit STATE.md together with the work it
describes. A session that ends without a handoff note violates protocol —
the next session's reconciliation handles it but must report the gap.

10.3 Fresh-session bootstrap (the ONLY entry procedure):
1. Read AGENT_BRIEF.md, notes/STATE.md, notes/CHANGES.md, and the current
   milestone's notes/reports/ file if present.
2. Reconcile: git log --oneline -10, git status, and the filesystem must
   agree with STATE.md. Hard evidence (commits, files, reports) outranks
   STATE.md prose. Minor drift: trust evidence, repair STATE.md, note the
   repair. Suspected lost/uncommitted work: STOP and ask the Lead.
3. Report ≤5 sentences: current state, exact NEXT ACTION, discrepancies.
4. Resume the §8 loop at NEXT ACTION. Do NOT re-run the §9 opening report;
   do NOT redo approved work; do NOT re-ask anything in the APPROVAL LEDGER.

10.4 Brief amendment log:
- §10 appended (this protocol). Lead-ratified.
- §4.2 regex OVERRIDE, Lead-approved in chat: headings may carry an optional
  trailing parenthetical — use
  /^###\s+\d+\.\s+`([^`]+)`(?:\s+\([^)]*\))?\s*$/
  with the path gate unchanged. Must match exactly one parenthetical heading
  across all canon (1B's SimulationCore); log every parenthetical match in
  the extraction report and stop if any other appears.
- F6 pre-authorized fix RATIFIED (scope strictly limited): repair ONLY each
  harness's acceptance-verdict console.log interpolation — insert the missing
  `$` and change NOTHING else. Reference forms: 1B/1C/1D/1E
  `[Milestone1X] acceptance ${allPass ? 'PASSED' : 'FAILED'}`; 1F/1G use
  `${all ? …}`. FORBIDDEN: badge detail strings, HUD strings, any CSS
  template literal (CSS uses bare `{` legitimately). If a gate line differs
  in ANY other way: STOP and paste the exact extracted source to the Lead.
- §8.8 COMMIT & PUSH POLICY AMENDED: commit after every §8 loop step with
  labeled messages, after every §10.2 checkpoint, and at session wind-down;
  pushing branch m1-assembly to origin is PRE-AUTHORIZED after every commit.
  NEVER push to main, never force-push, never stage Design_specs/ or
  Milestone/.
- F7 RATIFIED (Lead ruling 2026-10-14): 1B canon syntax defects are canon
  authorship errors ($-stripping transcription corruption), not extraction
  failures. F7a (badge detail, extracted L466 = canon 1734) and F7b
  (HUD fmtSimTime ternary + else, extracted L998–999 = canon 2266–2267)
  applied to the extracted harness; the Lead applies the identical lines to
  the canon themselves. SYSTEMIC PRE-SCAN RULE (alongside F6): classify as
  canon defect → route to the Lead, never F6-repair: (a) any backtick
  immediately followed by `{` inside a TS code block (in this codebase that
  fingerprint is always a stripped `$` — verify context, then route);
  (b) any single-armed ternary adjacent to a template literal. Known
  cosmetic $-strips in 1A/1B stat strings: authorized to restore ON
  ENCOUNTER, logged, verdict-neutral — do not hunt proactively.
- F8 ISSUED (Lead ruling 2026-10-14): 1C's missing acceptance verdict is
  canon truncation (content absent, not $-stripped). The Lead will author a
  1C canon-patch addendum rebuilding the verdict on the five documented
  criteria; the assembler must NOT synthesize it and must supply the
  verbatim tail (~80 lines) of the 1C harness code block in the next report
  so the addendum matches extracted variable names. 1C stays gated until the
  addendum lands.
