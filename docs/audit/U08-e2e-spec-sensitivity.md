# A1-U08 — m1a harness + e2e plumbing (DONE)

**Status: DONE (U08a sessions 60–61, U08b session 62, 2026-10-22).** Session 62 ran the generic mutations against m1a and m1c–m1f and checked the plumbing (findings A1-U08-9..10). Session 60 ran the e2e mutation runs for `e2e/m1b.spec.ts` (findings A1-U08-1..4). Session 61 reviewed the m1a harness rows (findings A1-U08-5..8). The mutation runs for the other specs and the plumbing checks are the U08b scope; see "Not yet checked".

Plan question (`docs/A1-plan.md` U08): do the specs fail on a wrong badge, a missing badge, a timeout and a page error?

## Method

Probe: `pre-t4:game/tools/audit/u08-spec-sensitivity.sh` and `pre-t4:game/tools/audit/u08-spec-mutate.mjs`.

- The script copies `game/` (without node_modules, dist and test-results) to a scratch directory, `/tmp/u08lab`, and symlinks node_modules. The repo tree is never edited.
- For each mutation it restores the original `src/test/Milestone1B_TestHarness.tsx` and applies ONE mutation with `u08-spec-mutate.mjs`.
- It then runs the REAL `e2e/m1b.spec.ts` under the REAL `playwright.config.ts`: Chrome channel, with `npm run build && vite preview` as the webServer.
- Each exit code is recorded unpiped (`echo $?` after a redirect only) to `/tmp/u08out/<mutation>.exit`.
- Environment: PromptQL VM v2 (2 vCPU / 4 GB), Chrome at `/opt/google/chrome/chrome`. The whole run took 75.6 s.

## Results (m1b spec)

| Mutation | What it injects | Spec exit | Caught? |
|---|---|---|---|
| baseline | none | 0 | (control: passes, 5 × PASS) |
| badgefail | row `m1a-regression` forced `pass:false`, verdict line forced PASSED | 1 | ✅ line 28 `no FAIL badge may remain` |
| timeout | suite never auto-runs (`elapsedTime > 1e9`) | 1 | ✅ `waitForEvent` 20 000 ms timeout |
| pageerror | uncaught `throw` right after `publishSuite` | 0 | ❌ captured as `pageerror: U08-injected pageerror`, never asserted |
| consoleerror | `console.error` before the verdict line | 0 | ❌ captured in the transcript, never asserted |
| norows | verdict PASSED, `results: {}` published | 0 | ❌ badges `["·····"×5]` |
| droprow | one TEST_ORDER row removed | 0 | ❌ 4 badges instead of 5 |
| typeerror | `const x: number = 'not a number'` in the harness | 0 | ❌ `vite build` does not type-check; `tsc --noEmit` on the same copy exits 2 (TS2322, line 388); clean-tree `tsc` exits 0 |

## Findings

### A1-U08-1 — Page errors and console errors are collected but never asserted
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** gate sensitivity
- **Location:** `game/e2e/m1b.spec.ts:7-8, 26-28`. The same pattern is in m1a/m1c/m1d/m1e/m1f (grep: the `pageerror` listener and the three identical `expect` lines).
- **Claim:** the specs fail on a page error.
- **Evidence:** the `pageerror` and `consoleerror` mutations both exit 0. Each injected error appears only in the printed transcript.
- **Impact:** a harness that throws after (or before, if the verdict still prints) its verdict passes the gate.
- **Proposed fix:** after the verdict, `expect(consoleLines.filter(l => /^(pageerror|error):/.test(l))).toEqual([])`.
- **Fix size:** XS (2 lines per spec).

### A1-U08-2 — A missing result passes: placeholder badges and dropped rows are not detected
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** gate sensitivity
- **Location:** `game/e2e/m1b.spec.ts:21, 27-28`; `game/src/test/Milestone1B_TestHarness.tsx:1127-1128` (placeholder `·····` uses the same `.badge` class).
- **Claim:** the specs fail on a missing badge.
- **Evidence:** `norows` passes with five `·····` badges; `droprow` passes with 4 badges. The spec only checks `length > 0` and the absence of the substring `FAIL`.
- **Impact:** the gate passes whenever the harness prints PASSED, whatever the rows show.
- **Proposed fix:** `expect(badges).toEqual(Array(N).fill('PASS'))` with N being each milestone's row count.
- **Fix size:** XS.

### A1-U08-3 — The gate trusts the harness's own PASSED line, which carries no cross-checkable values
- **Severity:** S2 · **Confidence:** high (citation) · **Category:** gate design
- **Location:** `game/e2e/m1b.spec.ts:26`; `Milestone1B_TestHarness.tsx:654-659` (literal `{…}`, see A1-U07-5).
- **Claim:** the e2e gate independently verifies the acceptance result.
- **Evidence:** the line-26 assertion is `toContain('PASSED')`. The `badgefail` mutation shows that the badge check is the only independent signal, and A1-U08-2 shows that signal is weak.
- **Impact:** combined with A1-U08-2, the gate passes whenever the harness prints PASSED.
- **Proposed fix:** fix A1-U08-2, plus print the real values in the verdict line (A1-U07-5).
- **Fix size:** XS.

### A1-U08-4 — The gate build does not type-check, and there is no CI
- **Severity:** S2 · **Confidence:** high (repro) · **Category:** build plumbing
- **Location:** `game/playwright.config.ts:16` (`npm run build && npx vite preview`); `game/package.json:8` (`"build": "vite build"`); no `.github/workflows`.
- **Claim:** a passing gate implies a type-correct build.
- **Evidence:** the `typeerror` mutation exits 0. `npx tsc --noEmit -p .` on the same copy exits 2.
- **Impact:** type errors reach a green gate unless someone runs `npm run typecheck` by hand.
- **Proposed fix:** set the webServer command to `npm run typecheck && npm run build && npx vite preview --port 4173`, or `"build": "tsc --noEmit && vite build"`.
- **Fix size:** XS.

## m1a harness row validity (session 61)

Probe: `pre-t4:game/tools/audit/u08-m1a-validity.mjs`. Command: `cd game && node tools/audit/u08-m1a-validity.mjs`, **PROBE_EXIT=0**, 16/18 checks confirmed, 5/5 controls OK.

- It runs the REAL `SimulationCore` in Node. Mutants are generated copies of `SimulationCore.ts` and `precisionMath.ts` written to `/tmp/u08m/<name>/`; the repo tree is not edited.
- The acceptance code is sliced VERBATIM from `Milestone1A_TestHarness.tsx` @ fb541e0. Slice A is lines 106–281 (`TEST`, `test`, the `onRebase` listener and `finalizeTest`). Slice B is lines 462–485 (the per-frame capture block of `useFrame`).
- Frame deltas are synthetic streams, so T5 can be tested at any frame rate.
- Each mutant runs twice. The first run is **as shipped**: the harness reads the mutated `REBASE_THRESHOLD` / `ORIGIN_LATTICE`, exactly as its `import` does. The second run is **spec-const**: the Milestone 1A values (1,024 m bound, 256 m lattice) are hard-wired.

Expected behaviour, derived first from Milestone 1A §1 (line 88) and the brief §3:
- Rebase when max|local| > 1,024 m, onto O = 256·round(P/256).
- Exactly 9 rebases, at ticks 31, 62, 93, 123, 154, 185, 216, 246, 277, each with Δ = (1024, 0, 0).
- Locals are a Float64 subtraction, then narrowing to f32.
- Static beacons shift by −Δ.
- No stutter on a rebase frame.

Controls (each must behave as shown):

| Control | Result |
|---|---|
| C1 baseline | PPPPP, 9 rebases |
| C2 v = 1,000 m/s | T1 F, T3 F |
| C3 no rebase (threshold 1e9, spec-const) | T2 F, T3 F, T4 F |
| C4 30 Hz stream | T5 F |
| C5 200 ms stall per rebase | T5 F |

### A1-U08-5 — m1a rows T2–T4 cannot detect a wrong rebase threshold or a wrong lattice
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** test
- **Location:** `game/src/test/Milestone1A_TestHarness.tsx` @ fb541e0. `TEST.LOCAL_BOUND_M: REBASE_THRESHOLD` and `TEST.LATTICE_M: ORIGIN_LATTICE` (lines 106–120); T2/T3/T4 in `finalizeTest` (lines 186–203). Spec: Milestone 1A line 88 ("exactly 9 … ticks 31, 62, … 277; every Δ = exactly (1024, 0, 0)").
- **Claim:** T2 proves the 1,024 m local bound, T3 the rebase count, and T4 the 256 m lattice.
- **Evidence:**
  - **Threshold sweep.** Rebase thresholds 900, 960, 1000, 1023, 1024, 1025 and 1100 all pass all five rows as shipped. With the spec bound hard-wired, 900–1025 still pass.
  - **T2 is self-referential.** Its bound is the engine's own trigger constant, and `focusMaxLocalPostTick` is sampled after the rebase in the same tick. T2 therefore passed for every threshold mutant (512 to 2048). Only "no rebasing at all" fails it (C3).
  - **T3 checks the count, not the timing.** The spec names the exact ticks, but threshold 900 rebases at ticks 27, 58, … 273 (9 rebases) and passes.
  - **T4 reads the engine's own lattice constant.**
    - Lattices 64, 128 and 512 pass all rows as shipped and with the spec constants. In a +x run at 2,000 m/s every trigger lands at a local of 1,024–1,057 m, so Δ is always 1,024 = 4·256.
    - Lattices 300 and 1000 pass all rows as shipped (Δ = 900 and 1000). They fail T4 only when 256 is hard-wired.
  - **Independent truth.** One tick at P = (1100.3, −1300.7, 50) gives O = (1152, −1280, 0) for lattice 128, which is off the 256 lattice. The axis-aligned harness scenario never shows this.
- **Impact:** a regression in the floating-origin constants or in `calculateOrigin` passes the 1A gate, and so does any later rework of the floating origin.
- **Proposed fix:** in the fix task, add the following, all with the bound and lattice written as spec literals, not imports:
  - assert the 9 exact trigger ticks and Δ = (1024, 0, 0);
  - add an off-axis, off-lattice leg (e.g. velocity (1400, −900, 600) from a non-lattice start) that checks `O % 256 === 0` on every axis and `|local| ≤ 128` straight after each shift.
  - This touches no RATIFIED item.
- **Fix size:** S (one session).

### A1-U08-6 — m1a never checks the precision invariant or the static beacons it renders as "the signature visual proof"
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** test
- **Location:** `Milestone1A_TestHarness.tsx` @ fb541e0, header lines 9–24 and `BEACONS` (lines 71–75); `SimulationCore.ts` `tick()` step (d) (lines 444–450). No row reads `localPosF32` of any entity.
- **Claim (brief §3):** locals are always a Float64 subtraction, then narrowing. Per the header, static beacons shift by −Δ on every rebase while their absolute positions never move.
- **Evidence:**
  - **`f32extract` mutant.** `local = fround(P) − fround(O)` narrows before subtracting, which breaks the §3 invariant. It passes PPPPP. At 10 km from the origin the error is below an f32 ulp, so the run cannot see it.
  - **The same mutant 1 AU from the Sun.** The real core has a local error of 0 m; the mutant has 24 m. The probe's `M1A-F32-FAR` line printed NOT-CONFIRMED only because its pass bound (> 100 m) was set too high. The bug is still visible. At 1 AU the f32 spacing is 2¹⁴ = 16,384 m, and `fround(P) − fround(O)` is always a multiple of it. Just after a shift |P − O| ≤ 128 m: when P and O round to the same grid point the whole local is lost (error = |P − O|, up to 128 m), and when they straddle a grid boundary the local comes out as ±16,384 m. The worst-case error is therefore about one f32 spacing, ≈ 16 km, not 128 m (corrected in session 62).
  - **`staticStale` mutant.** Static entities are never re-extracted after a rebase. It passes PPPPP, while the beacons render 9,216 m from their true local position.
  - **Real core.** The beacon locals are exact: max error 0 m (`M1A-BEACON-OK`).
- **Impact:** the 1A gate does not protect the invariant the whole engine rests on. The game runs at 1.5·10¹¹ m from the Sun, where this mutant puts the focus up to one f32 spacing (≈ 16 km) off.
- **Proposed fix:**
  - Add a row that compares each entity's `localPosF32` with `Math.fround(absPos − O)` after every rebase, for the ship and all beacons.
  - Add a far-origin leg that starts the ship at a heliocentric offset (≈ 1 AU) and requires a local error < 1 mm.
- **Fix size:** S.

### A1-U08-7 — m1a T5 cannot see the worst stutters, and its "rebase frame" is the wrong frame
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** test
- **Location:** `Milestone1A_TestHarness.tsx` @ fb541e0. `frameMs < 250` exclusion (line 466); `rebasedThisFrame` (lines 402–404) and its use (line 468); T5 verdict (lines 226–227), from which `rebaseWorst` is absent.
- **Claim:** T5 shows a stable 60 FPS and that "origin shifts cost no stutter frame".
- **Evidence:**
  - **Long stalls are dropped.** A 300 ms stall on every rebase (9 stalls) passes PPPPP, and so do three 1 s freezes. Frames ≥ 250 ms are removed from the record, so the stalls that would matter most are exactly the ones T5 never sees.
  - **Shorter stalls are caught.** A 200 ms stall per rebase does fail (C5).
  - **Wrong frame flagged.** A 40 ms hitch on the frame after every rebase passes. Its detail still reads "worst rebase-frame 16.67 ms". The rebase runs inside `core.advance(delta)`, so the frame flagged as the rebase frame is the one whose delta came *before* the rebase; any cost of the rebase shows up in the next frame's delta.
  - **`rebaseWorst` is unused by the verdict.** It is computed but not part of T5.
  - **Display rate changes the verdict.** 144 Hz and 50 Hz pass; 30 Hz fails (C4). The verdict is wall-clock and depends on the machine; compare A1-U05-2 for m1d T2 and the SwiftShader note in A1-plan §7.
- **Impact:** a rebase that causes a hitch passes the gate, while a slow but correct machine fails it.
- **Proposed fix:**
  - Count frames ≥ 250 ms as failures, or report them separately; do not drop them.
  - Attribute a rebase to the next frame's delta, or time `advance()` itself with `performance.now()` around the call.
  - Put the attributed rebase-frame worst into the verdict.
  - Judge the cost of the shift itself, not the display rate.
- **Fix size:** S.

### A1-U08-8 — m1a console verdict line and four of the five row details print literal template text
- **Severity:** S2 · **Confidence:** high (repro) · **Category:** test
- **Location:** `Milestone1A_TestHarness.tsx` @ fb541e0, `finalizeTest` detail strings (lines 236–266) and the verdict line (lines 271–276). Each has a missing `$` before `{`. This is the same defect class as A1-U07-5 (m1b).
- **Evidence:**
  - The probe's captured verdict line is `[Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms`. It carries no position, maxLocal or frame-time value, and its labels do not match its fields.
  - Four of the five details contain literal text, for example `@ tick {simTime.toFixed(3)} s of 60 Hz sim)` and `avg {avg > 0 ? Math.round(1000 / avg) : 0} FPS)`. Others are `{TEST.REBASE_MAX}` and `{rebaseCount}`.
- **Impact:** the e2e gate (A1-U08-3) has only this line to scrape, and it carries no checkable value; the HUD shows unreadable detail text.
- **Proposed fix:** add the missing `$` characters, and print the real P.x, maxLocal and avg/worst in the verdict line.
- **Fix size:** XS.

## Checked, no issue
- Wrong badge with PASSED verdict (`badgefail`) → caught by line 28.
- Harness never reaches a verdict (`timeout`) → caught: `TimeoutError: page.waitForEvent: Timeout 20000ms exceeded`.
- Clean tree: m1b passes with 5 × PASS and no page errors; `tsc --noEmit` exits 0.
- All six specs (m1a–m1f) carry byte-identical assertion lines; only the `waitForEvent` timeout differs: 30/20/150/120/90/240 s. Found by grep, not by mutation run.

- m1a (session 61): the engine's rebase ticks are exactly the spec's 31, 62, 93, 123, 154, 185, 216, 246, 277, each Δ = (1024, 0, 0) (Milestone 1A line 88).
- m1a: the real core's static beacon locals are exact after the last rebase (error 0 m). Its far-origin local error at 1 AU is 0 m (the f64 subtraction narrows exactly).
- m1a: a 10th rebase does not slip through T3. No threshold mutant produced 10 rebases and passed (`M1A-T3-WINDOW` not confirmed); lattice 300 gave 10 rebases and passed only because T4 reads the mutated lattice (A1-U08-5).
- m1a: T1 and T3 fail at 1,000 m/s (C2); T2, T3 and T4 fail with rebasing disabled (C3); T5 fails at 30 Hz and on a 200 ms stall per rebase (C4, C5). The rows are not constant.

## U08b — mutation runs for m1a, m1c–m1f and plumbing (session 62)

Probe: `pre-t4:game/tools/audit/u08b-spec-sensitivity.sh` (parameterised runner, `PLAN="m1a:baseline,badgefail …"`) and `pre-t4:game/tools/audit/u08b-spec-mutate.mjs` (generic regex anchors shared by every harness: the verdict ternary `${X ? 'PASSED' : 'FAILED'}`, the badge text `r.pass ? 'PASS' : 'FAIL'`, and the `[Milestone1X] acceptance` console.log). Same scratch-copy method as U08a (`/tmp/u08blab`; repo tree untouched); REAL specs under the REAL `playwright.config.ts`. A dry run applied all five mutations to all five harnesses. Environment: VM v2, 2 vCPU / 4 GB.

Mutations: `badgefail` = verdict forced PASSED + every badge `FAIL` (control); `badgeerr` = verdict forced PASSED + every badge `ERR`; `pageerror` = uncaught throw scheduled before the verdict line; `nolog` = verdict tag renamed, so no recognisable line.

| Spec | baseline | badgefail | badgeerr | pageerror | nolog |
|---|---|---|---|---|---|
| m1a | 0 (14 s) | 1 ✅ | **0 ❌** | **0 ❌** | 1 ✅ (30 s wait) |
| m1c | 0 (69 s) | 1 ✅ | **0 ❌** | **0 ❌** | – |
| m1d | **1** (50 s) | 1 | **0 ❌** | 1 (inconclusive: baseline already red) | – |
| m1e | 0 (34 s) | 1 ✅ | **0 ❌** | **0 ❌** | – |
| m1f | **1** (247 s, `waitForEvent` 240 000 ms timeout) | not run | not run | not run | – |

- m1d baseline is red on this VM: `[Milestone1D] acceptance FAILED — … maxDv=10.30`, badges `PASS,FAIL,PASS,PASS,PASS` (row 2 governor-dive). This is the fps-dependent T2 verdict already reported in U05b, not a new defect.
- A1-U08-1 (page errors never asserted) is now confirmed by repro on m1a, m1c and m1e, not just by grep.

### A1-U08-9 — The badge check only rejects the literal text "FAIL"; any other failing badge passes
- **Severity:** S1 · **Confidence:** high (repro on 4 specs) · **Category:** test
- **Location:** `e2e/m1a.spec.ts`…`m1f.spec.ts` @ 67220eb, the `not.toContain('FAIL')` assertion (m1a line 30; same line in all six).
- **Claim (brief §3.7):** the gate asserts that every row passed.
- **Evidence:** `badgeerr` (verdict line PASSED, every badge `ERR`) exits 0 on m1a, m1c, m1d and m1e. On m1d the governor-dive row is genuinely failing on this VM, and the spec still passes once the badge reads `ERR` and the verdict says PASSED.
- **Impact:** a harness that renames its badge text, or renders an error state other than `FAIL`, passes the gate. Combined with A1-U08-2/3, the spec only proves that the word `FAIL` is absent.
- **Proposed fix:** assert `badges` equals `Array(N).fill('PASS')`, with N = the harness's row count exported by the page (or a fixed per-spec constant).
- **Fix size:** XS.

### A1-U08-10 — The m1f gate did not reach a verdict within 240 s on a 2 vCPU / 4 GB VM
- **Severity:** S3 · **Confidence:** medium (one run; cause not isolated) · **Category:** test / env
- **Location:** `e2e/m1f.spec.ts` @ 67220eb (`waitForEvent` 240 000 ms); `playwright.config.ts` `timeout: 300_000`.
- **Evidence:** the clean-tree m1f run ended `TimeoutError: page.waitForEvent: Timeout 240000ms exceeded`; wall 247 s. The harness's live walk alone is 120 s wall plus a multi-second synchronous suite. The per-test timeout leaves 60 s of margin over the 240 s wait. The webServer build runs before the test and does not count against it.
- **Impact:** the m1f gate result depends on the machine; on a small runner it is red without any defect. A1-plan §7 already asks for the 8 GB VM for m1e and m1f.
- **Proposed fix:** document the minimum runner for m1f in the spec header, or log a heartbeat and the elapsed time so a timeout can be told apart from a hang.
- **Fix size:** XS.

### Plumbing checked, no issue
- **Port already in use:** with port 4173 occupied, the m1a run exits 1 with `http://localhost:4173 is already used … set reuseExistingServer:true` — loud and correct.
- **`npm test` failure propagation:** `npm test -- e2e/m1a.spec.ts e2e/m1b.spec.ts` with m1a `badgefail` reports `1 failed, 1 passed` and exits 1.
- **Missing verdict line:** `nolog` on m1a fails at the 30 s `waitForEvent` timeout (as `timeout` did on m1b).

## Not yet checked (residual, not blocking)
- m1f mutation runs (badgefail/badgeerr/pageerror) on the 8 GB VM. The m1f assertion lines are byte-identical to the other five specs, so the results above are expected to carry over.
