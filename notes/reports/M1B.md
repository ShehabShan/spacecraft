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

(filled in as the loop proceeds — extraction, F6, wiring, gates, output)
