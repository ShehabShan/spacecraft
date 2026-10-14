# MILESTONE 1B REPORT — Kepler Rails & Two-Tier Time (assembly brief §8.6)

Date: 2026-10-14 · Branch: m1-assembly (pushed after every step per amended §8.8) · Canon: untouched

## Step 0 — F6 PRE-SCAN (read-only, all seven canon Milestone .txt files)

Question: is the `$` before the acceptance-verdict interpolation
(`{allPass ? 'PASSED' : 'FAILED'}` / `{all ? …}`) present or stripped?

| MS | Canon verdict line (line # in .txt) | Form | Verdict `$`? | F6 action needed |
|----|--------------------------------------|------|--------------|------------------|
| 1A | 1399–1403 | `` `[Milestone1A] acceptance ${allPass ? 'PASSED' : 'FAILED'} — ` + … `` | **PRESENT** | none (trailing stats `{ticks}`/`{f2(avg)}` are stripped — outside F6 scope; see M1A.md O1) |
| 1B | 1923–1927 | `` `[Milestone1B] acceptance ${allPass ? 'PASSED' : 'FAILED'} in ${elapsed.toFixed(1)} ms — ` + … `` | **PRESENT** | none for the verdict (trailing stats `{errRoundTrip…}`/`{identityOk…}`/`{rebaseDelta}` stripped — outside scope) |
| 1C | 1917–1920 | `` `[Milestone1C] acceptance {metrics.geoMin}` + … `` | **NO VERDICT EXISTS** | **STOP item — beyond F6, Lead decision required before the 1C gate** (see below) |
| 1D | 1904–1908 | `` `[Milestone1D] acceptance ${allPass ? 'PASSED' : 'FAILED'} — ` + … `` | **PRESENT** | none (all stat interpolations intact too) |
| 1E | 2549 | `` console.log(`[Milestone1E] acceptance ${all ? 'PASSED' : 'FAILED'}`) `` | **PRESENT** | none — note: uses the `${all ? …}` form (the Lead's reference put 1E with the allPass forms; no repair needed either way) |
| 1F | 2153 | `` console.log(`[Milestone1F] acceptance ${all ? 'PASSED' : 'FAILED'}`) `` | **PRESENT** | none |
| 1G | 1798 | `` console.log(`[Milestone1G] acceptance ${all ? 'PASSED' : 'FAILED'}`) `` | **PRESENT** | none |

**Summary:** no milestone has a stripped `$` on the VERDICT interpolation —
F6's `$`-insertion repair is not required anywhere. The stripping damage hit
only trailing stat strings (1A, 1B — outside F6 scope) and, in 1C, destroyed
the verdict line itself.

### 1C anomaly — exact extracted canon source (verbatim, Milestone 1C.txt:1915–1921)

```typescript
  const allPass = geoConst && zeroDispose && seamsOk && heapOk;
  console.log(
    `[Milestone1C] acceptance {metrics.geoMin}` +
    ` dispose={removeDelta} pairs=${A.pairs}` +
    ` parentVerts={A.nrmMismatch}` +
    ` maxPosDev={heapPerFrame.toFixed(0)}B`,
  );
}
```

Facts (byte-verified, `cat -et`): the token `PASSED` appears **zero** times
in the entire 1C canon file; the verdict interpolation
`${allPass ? 'PASSED' : 'FAILED'}` does not exist in this statement at all;
the stat keys are shuffled relative to their values
(`dispose={removeDelta}`, `parentVerts={A.nrmMismatch}`,
`maxPosDev={heapPerFrame…}`). F6 authorizes ONLY inserting a missing `$` —
it cannot fabricate the missing verdict, so per the ratification's stop
clause this is pasted here for the Lead. **Consequence if unrepaired:** the
1C gate regex `\[Milestone1C\] acceptance (PASSED|FAILED)` can never match →
the 1C Playwright gate would time out at its 150 s budget. This does NOT
block 1B; it must be decided before Milestone 1C begins.

## Milestone 1B execution

### Step 1 — Extraction (verbatim report from `node tools/extract.mjs 1B`)

```
[extract 1B] parenthetical-branch match: line 772 → src/core/simulation/SimulationCore.ts
[extract 1B] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1B.txt
  src/core/orbit/types.ts — 105 lines
  src/core/orbit/KeplerRail.ts — 254 lines
  src/core/orbit/celestialData.ts — 261 lines
  src/core/simulation/SimulationCore.ts — 486 lines  [OVERLAY: replaced previous extraction]
  src/test/Milestone1B_TestHarness.tsx — 1287 lines
[extract 1B] 5 block(s) written verbatim (2393 code lines).
```

The parenthetical invariant HELD: exactly one match, the sanctioned 1B
SimulationCore overlay. Overlay verified: 395 → 486 lines;
`setSimTime` (L171), `fastForward` (L188), `reverse` (L194),
`getCelestialStates` (L202) all present.

### Step 2 — F6 check (verdict console.log)

Extracted verdict line (L655):
`` `[Milestone1B] acceptance ${allPass ? 'PASSED' : 'FAILED'} in ${elapsed.toFixed(1)} ms — ` ``
The verdict token carries its `$` — **NO F6 repair required or applied.**
The trailing stats (`{errRoundTrip…}`, `{identityOk…}`, `{rebaseDelta}`) are
stripped but out of F6 scope; the gate regex matches the prefix regardless.

### Step 3 — F7 applied (Lead ruling 2026-10-14)

- F7a (one character): extracted L466 → `` `${maxPosErr > 0 ? ` @ ${worstBody}` : ' — bit-exact'}); ` `` — inserted `$` before `{maxPosErr`. Cascades L470/TS1109 and L661/TS1128 cleared.
- F7b (content supplied): extracted L998 → `` const p2 = (v: number): string => (v < 10 ? `0${v}` : `${v}`); `` and L999 `$` restored on `{d}`/`{p2(m)}`. TS1005 cleared.
- Typecheck: CLEAN. Build: CLEAN (1B harness chunk `Milestone1B_TestHarness-BnZHsr1B.js` 22.57 kB).
- Canon-side: the Lead applies the identical lines to Milestone 1B.txt (L1734, L2266, L2267) — assembler never edits Milestone/.

### Step 4 — Gates: 1A regression PASS, 1B gate deadlocked (canon bug) — F9 requested

**1A regression page: PASSED** (with the overlaid 1B core):

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.4s)
```

(Note: the first combined run reported 1A failed too — first-run contention;
the clean re-run above is the verdict. 1A stays green on the overlaid core.)

**1B gate: TIMEOUT — no verdict line ever logged.** Symptom chain
(diagnosed with a DOM/console probe, `game/tools/diag-m1b.mjs`):

```
[dom] { "m1bRoot": true, "canvas": true,
        "badges": ["·····","·····","·····","·····","·····"],
        "chips": ["30× MACRO", "RUNNING", "30×"] }
[main thread] RESPONSIVE        (page.evaluate(1+1) returned — NOT a hang)
```

The harness mounts, frames render, the suite is marked started (chip
RUNNING) — and `runSuite()` **returns before executing a single test**.

Root cause — canon self-deadlock in Milestone 1B.txt (extraction is
byte-verbatim; both sites verified in canon):

```typescript
    // canon ~2226 (auto-run in useFrame):
    if (!suiteAutoStarted && state.clock.elapsedTime > 0.75) {
      suiteAutoStarted = true;
      publishSuite({ started: true });   // ← sets started=true, done=false
      runSuite();                        // ← guard below returns immediately
    }

    // canon ~1656 (runSuite head):
    function runSuite(): void {
      if (suiteState.started && !suiteState.done) {
        return; // synchronous suite — no reentrancy
      }
```

The pre-publish satisfies the reentrancy guard, so the suite never runs on
the auto path; the RE-RUN button is equally dead (same guard, same state:
`started && !done` forever). No test executes; no verdict can ever be
logged; the gate regex can never match. 1C–1G scanned: they do not use this
`publishSuite({started})`-then-`runSuite()` pattern (different store
mechanisms) — the deadlock is 1B-only.

**F9 proposal (minimal, acceptance-neutral — Lead authorization requested):**
delete the single line `publishSuite({ started: true });` from the auto-run
block (canon 2228 / extracted L933) in the extracted harness. Effect:
auto-start → `runSuite()` passes the guard (initial `started=false`) → runs
synchronously → publishes `{started, results, done}` once, at completion.
The RE-RUN button then passes the guard because `done=true`. The guard
itself, the suite body, the results, and every acceptance criterion remain
byte-verbatim. (Alternative: reorder to `runSuite(); publishSuite({started: true});` — same effect, two-line move; deleting is smaller.)

### 1C findings for F8 (supplied with this report per the ruling)

Two files persisted verbatim (read-only sed from canon):
- `notes/reports/M1C-canon-tail.txt` — the REQUESTED literal last 80 lines
  of the harness code block (canon 2245–2324, ends at the closing fence):
  HUD right column, M1C_CSS, ROOT component.
- `notes/reports/M1C-canon-suite-tail.txt` — SUPPLEMENT: canon 1800–1945,
  the suite results-assembly through the anomalous verdict `console.log`
  (1916–1921) and the telemetry store head, so 1C-CP can match extracted
  variable names (`metrics`, `A`, `disposeDelta`, `removeDelta`,
  `allocDelta`, `heapPerFrame`, `heapAvailable`, `allPass`, `publishSuite`,
  TestKey rows 'geo-constant' | 'zero-dispose' | 'seamless' | 'heap-flat').

**Additional 1C canon defect found (route to Lead):** canon 1902 reads
`` seamless': { `` — the results-object key lost its OPENING quote (syntax
error; the extraction will not compile regardless of the verdict addendum).
Distinct from the verdict truncation; needs its own line in the 1C-CP
addendum (or a separate ruling).
