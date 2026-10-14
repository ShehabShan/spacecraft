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

### Step 3 — ⛔ STOP: canon syntax defects beyond F6 scope (typecheck fails)

`npm run typecheck` on the verbatim 1B harness fails with 3 syntax errors:

```
src/test/Milestone1B_TestHarness.tsx(470,3): error TS1109: Expression expected.
src/test/Milestone1B_TestHarness.tsx(661,1): error TS1128: Declaration or statement expected.
src/test/Milestone1B_TestHarness.tsx(998,53): error TS1005: ':' expected.
```

Both root causes are in F6-FORBIDDEN strings (badge detail / HUD), pasted
byte-exact from the extracted file (= canon; extraction fidelity verified):

**Defect A** — extracted L466 (canon Milestone 1B.txt:1734), badge detail of
`results['closed-form']`:
```typescript
      `{maxPosErr > 0 ? ` @ ${worstBody}` : ' — bit-exact'}); ` +
```
Missing `$` before `{maxPosErr` — the brace parses as an object literal and
the nested backtick derails the parse (errors at 470/661 are cascades of
this line). Intended form: `` `${maxPosErr > 0 ? ` @ ${worstBody}` : ' — bit-exact'}); ` ``.
Repair = ONE character (`$`). In a badge detail string → F6-forbidden → Lead
authorization requested.

**Defect B** — extracted L998 (canon 2266), HUD helper `fmtSimTime`:
```typescript
  const p2 = (v: number): string => (v < 10 ? `0{v}`);
```
TWO defects: missing `$` in `` `0{v}` `` AND the ternary has **no else
branch** (error 998,53). A `$`-insert alone cannot fix this line; an else
branch must be supplied (obvious intent: zero-pad-2 helper →
`: \`${v}\`` or `: String(v)`). HUD string → F6-forbidden, and the missing
else branch is content not present anywhere in the file → Lead must supply
or confirm the form. (The following return line's `{d}` / `{p2(m)}` are also
stripped — cosmetic once B parses; the HUD clock would render literal braces
unless those two `$` are restored too.)

**Impact:** `vite build` fails as a whole → neither the 1B gate nor the 1A
regression page can run. No code changes were made; the extracted harness
remains byte-verbatim. Extraction quality is NOT in question — the defects
are in the canon document itself.

**Requested decision (proposed F7):** authorize minimal repairs to exactly
these two lines in the EXTRACTED harness (canon untouched):
- F7a: L466 — insert `$` before `{maxPosErr`.
- F7b: L998 — `` `0{v}` `` → `` `0${v}` `` and add `: \`${v}\`` as the
  ternary else; optionally also restore `$` on `{d}`/`{p2(m)}` in L999's
  HUD clock format (cosmetic).
Everything else stays verbatim (incl. the stripped trailing verdict stats
and `moonNames += \`{s.config.name}\``, both harmless literals).
