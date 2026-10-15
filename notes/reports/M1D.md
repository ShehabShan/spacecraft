# MILESTONE 1D REPORT — Flight & Aerodynamic Governor (assembly brief §8.6)

Date: 2026-10-15 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**STATUS: GATE RUN — FAILED on 2 of 5 rows (drag-continuity, integration);
both diagnosed to root cause and routed to the Lead (F11/F12). The three
passing rows include the SPEC-CANONICAL dive gate. Regression 1A/1B/1C:
GREEN. No unauthorized fixes.**

## 1. Extraction report (verbatim from `node tools/extract.mjs 1D`)

```
[extract 1D] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1D.txt
  src/core/physics/atmosphere.ts — 120 lines
  src/core/physics/aerodynamics.ts — 136 lines
  src/core/physics/flightController.ts — 751 lines
  src/test/Milestone1D_TestHarness.tsx — 1175 lines
[extract 1D] 4 block(s) written verbatim (2182 code lines).
```

4/4 expected blocks; **zero parenthetical matches** (invariant intact).
β_q = 3.2e-3 extracted verbatim (RATIFIED constant — not a tunable).

## 2. F4 + erratum (process note)

- **F4 applied**: deleted the single dead line `const _segP0x: number[] = [0];`
  (canon 622 / extracted 249); the live `let segP0x…` module block follows.
- **ERRATUM (my process error, on the record):** commit 02b313c's message
  says "typecheck clean" — false; the pipe masked tsc's exit. Actual result:
  **3 strict-TS errors — the first canon strict-mode failures** (1A–1C were
  clean). All three fixed minimally as §6 MAY-fix ("type errors"), type-only,
  runtime-neutral: (a) write-through guard extended to `this._wtPos !== null
  && this._wtVel !== null` (canon 740 — TS cannot narrow one property from
  the other; both are set together in attachWriteThrough); (b)+(c)
  `(script.phase as Phase)` casts at the two `'DONE'` comparisons (canon
  1971/1974 — runBurn() legitimately sets DONE mid-chain, invisible to TS
  property narrowing). Typecheck + build re-verified with UNPIPED exit
  codes (0/0). Commit dc55895 carries the fixes and this erratum.

## 3. Gate output (verbatim) — first run

```
[m1a gate] [Milestone1A] acceptance PASSED — badges ["PASS"×5]   ✓ (5.7s)
[m1b gate] [Milestone1B] acceptance PASSED in 17.6 ms — badges ["PASS"×5]   ✓ (1.1s)
[m1c gate] [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=54384 parentVerts=8481 nrmMismatch=0 maxPosDev=9.4e-5 heap/frame=0B   ✓ (1.1m)
[m1d gate] [Milestone1D] acceptance FAILED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=49 geo=150 burnHeap=0B
           badges ["PASS","PASS","FAIL","PASS","FAIL"]   ✘ (14.8s)  — 3 passed
```

## 4. Row-by-row verdicts

- **atmosphere PASS** — ρ(0)=1.225 exactly; strictly monotone to 2.5e-9 at
  24 km; a(0)=340.3 → a(8 km)=308.1 m/s; Mach=1.000000000;
  **|Ω×p| = 52.000000 m/s exact** (spec's equator example).
- **governor-dive PASS (THE spec gate)** — 2,000 m/s vertical entry from
  10 km with streaming FROZEN: **v@1,000 m = 264.7 m/s ≤ 400** (34% margin);
  peak 2,000 m/s; **min post-tick AGL 3.38 m ≥ 0**; ground contact resolved
  analytically (LANDED, 4 contacts) with ZERO chunks — the DDA no-clip
  guarantee held against frozen streaming exactly as designed.
- **zero-gc PASS** — 20,000 synchronous ticks: identities ✓, heap Δ = 0 B,
  NaN 0.
- **drag-continuity FAIL — F11 routed**: maxDv = 10.30 vs the author's
  bound 8. Reversals 0, NaN 0, smooth 400-crossing — the no-clamp evidence
  itself is perfect. The bound is miscalibrated: independent integration of
  the dive with the ratified β_q=3.2e-3 gives v@1km = 2000·e^(−4.704·0.4322)
  = **262 m/s** (observed 264.7 — matches), and peak per-tick Δv =
  max v·(1−e^(−k·dt)) ≈ **10.3–10.4 m/s** (~60 g at the ρ·v² max near
  3–4 km). Entry intentionally overshoots v_safe (the governor then pulls v
  onto the curve — by design), so peak decel > aStruct is physics, not a
  clamp; the author's prose (arrival 310–345, "peak ~17 g = 2.8 m/s/tick",
  "+0.2% overshoot" — observed peak exactly 2,000.0 since ρ(10 km) drag
  already exceeds gravity) is mutually inconsistent with the shipped β_q.
  **F11 proposal: raise the airborne |Δv| bound to 12** (tight, 15% over
  the theoretical 10.4) **or 16** (3× margin, matching the author's own
  8/2.8 ratio); the no-clamp criterion (a clamp would show hundreds) is
  untouched either way.
- **integration FAIL — F12 routed**: rebases 8 ≥ 5 ✓, chunks 49 ≥ 40 ✓,
  locals 1022.8 ≤ 1,024 ✓, offset error 0e+0 ✓ — the failing sub-criterion
  is geoConst. MutationObserver trace on the HUD:
  ```
  t=339ms  geo=150  SUBSONIC          (warmup cruise — shell culled)
  t=2724ms geo=151  EXO-ATM           (dive start — shell ENTERS the frustum)
  …151 constant through SUPERSONIC/GOVERNOR/SUBSONIC → DONE
  ```
  The static shell sphere (radius 4100, in terrainGroup) registers MID-RUN:
  at the dive the camera looks straight down the nadir from ~15 km, the
  shell's angular radius is arcsin(4100/15000) = 15.9° ≪ half-fov 31°, so
  it renders for the first time → geometries step 150 → 151 → geoMin(150)
  ≠ geoMax(151). canon's primeAll() documents the intent ("all pool
  geometries registered BEFORE the acceptance window") but covers only pool
  meshes — the static shell was missed. **F12 proposal (harness-only,
  ~2 lines): prime the static shell during the 2 primed frames
  (frustumCulled = false, restored by unprimeAll-time) — mirrors primeAll's
  documented intent, count becomes constant at 151 (144 pool + shell +
  stars + 5 ship meshes), criterion unchanged.** (145/146 precedent: the
  row asserts constancy, never a number.)

## 5. Changes

CHANGES.md #27–30 (extraction, F4, erratum + strict-TS fixes, routed
diagnosis). Canon untouched throughout.

## 6. Lead eyeball (optional)

`npm run dev` → `?page=m1d`: the scripted dive lights the GOVERNOR chip
below ~6.2 km; the dive-trace panel fills with the deceleration profile;
the ship lands analytically on frozen terrain. After DONE: free flight
(↑/↓ pitch, W/S throttle) — lift curves the trajectory at 300 m/s, rebases
fire silently every ~1,024 m.

## Status

STOPPED — awaiting Lead rulings F11 (T3 Δv bound) and F12 (T5 shell
priming). On authorization: apply, re-run the 1D gate + full regression,
finalize this report, commit per cadence, push, STOP at the approval gate.
