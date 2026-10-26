# MILESTONE 1D REPORT — Flight & Aerodynamic Governor (assembly brief §8.6)

Date: 2026-10-15 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**FINAL: GATE GREEN — `[Milestone1D] acceptance PASSED` (5/5 rows), plus the
full 1A/1B/1C regression PASSED in the same serial run: `4 passed (1.5m)`.**
Two authorial acceptance-calibration defects were found by the first gate
run, ruled on (F11/F12), applied, and verified; the physics and the RATIFIED
β_q = 3.2e-3 were vindicated throughout.

## 1. Extraction report (verbatim from `node tools/extract.mjs 1D`)

```
[extract 1D] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1D.txt
  src/core/physics/atmosphere.ts — 120 lines
  src/core/physics/aerodynamics.ts — 136 lines
  src/core/physics/flightController.ts — 751 lines
  src/test/Milestone1D_TestHarness.tsx — 1175 lines
[extract 1D] 4 block(s) written verbatim (2182 code lines).
```

4/4 blocks; **zero parenthetical matches** (invariant intact).

## 2. F4, erratum + strict-TS fixes, and the standing rule

- **F4 applied**: deleted the dead `const _segP0x: number[] = [0];` line
  (canon 622 / extracted 249); the live `let segP0x…` module block follows.
- **ERRATUM (my process error, ratified on the record):** commit 02b313c's
  message claimed "typecheck clean" — false; the pipe masked tsc's exit.
  Actual result: 3 strict-TS errors — the first canon strict-mode failures
  (1A–1C were clean). All three fixed minimally as legitimate §6 type-error
  repairs, runtime-neutral: (a) write-through guard extended to
  `_wtPos !== null && _wtVel !== null` (canon 740 — TS cannot narrow one
  property from the other; both are set together in attachWriteThrough);
  (b)+(c) `(script.phase as Phase)` casts at the two 'DONE' comparisons
  (canon 1971/1974 — runBurn() legitimately sets DONE mid-chain, invisible
  to TS property narrowing). Commit dc55895.
- **STANDING RULE (Lead-ratified, §10.4):** typecheck/build commands must
  run with UNPIPED exit codes; any commit message claiming "clean" must be
  backed by observed exit 0 in the transcript. All subsequent runs in this
  report comply (TSC_EXIT=0 / BUILD_EXIT=0 / PLAYWRIGHT_EXIT=0 observed).

## 3. First gate run — FAILED 2 rows; both diagnosed and ruled (F11/F12)

```
[m1d gate] [Milestone1D] acceptance FAILED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=49 geo=150 burnHeap=0B
           badges ["PASS","PASS","FAIL","PASS","FAIL"]
```

**F11 — drag-continuity (maxDv 10.30 vs bound 8).** Independent integration
of the dive with the ratified β_q=3.2e-3 gives v@1km =
2000·e^(−4.704·0.4322) = **262 m/s** (observed 264.7) and peak per-tick Δv
≈ **10.3–10.4 m/s** — ρ·v² maximizes near 2.5–3 km at ≈ 620 m/s² ≈ 63 g,
transiently above a_struct BY DESIGN (the governor pulls v onto v_safe;
v_safe is not a decel ceiling). The author's prose ("~17 g = 2.8 m/s/tick",
arrival "310–345", "+0.2% overshoot") was mutually inconsistent with the
shipped constant — also corrected on the record: at the 10 km start
g = μ/r² = 9.81/9 = 1.09 m/s² < entry drag 3.79 m/s², so the ship
decelerates from tick 1 (peak 1,999.96 → displays 2,000.0, exactly as
observed). Reversals 0, NaN 0, smooth 400-crossing were already green.
**Applied:** bound 8 → 12; detail prose replaced with the corrected
physics (extracted string was intact — no F6 restoration needed).

**F12 — integration (geometries 150→151 mid-run).** MutationObserver trace
pinned the step to exactly the dive start: at 10 km looking down the nadir,
the far shell sphere (angular radius arcsin(4100/15000) = 15.9° ≪ half-fov
31°) entered the frustum for the FIRST time and registered mid-window;
canon's primeAll documents "all geometries registered BEFORE the window"
but covered only pool meshes. **Applied:** shell captured as module const
`shellMesh`; `frustumCulled = false` after `pool.primeAll()`; restored to
`true` at unprime. Expected constant 151 = 144 pool + shell + stars + 5
ship meshes; 1C's approved 145 NOT retro-changed (its shell never enters
view). Commit 51fefcb; TSC_EXIT=0 BUILD_EXIT=0 observed unpiped.

## 4. FINAL gate output (verbatim; single serial run, all four pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.7s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 16.2 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.1s)
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=54582 parentVerts=9131 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
  ✓  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)
[m1d gate] acceptance line: [Milestone1D] acceptance PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=48 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  4 e2e/m1d.spec.ts:6:1 › M1D — Flight & Aerodynamic Governor acceptance (14.8s)

  4 passed (1.5m)
```

1D rows: atmosphere PASS (ρ(0)=1.225 exact; |Ω×p| = 52.000000 m/s exact;
a(0)=340.3) · **governor-dive PASS (the spec gate: 264.7 m/s ≤ 400 at
1,000 m with streaming FROZEN; min post-tick AGL 3.38 m; LANDED, 4
contacts, zero worker dependence)** · drag-continuity PASS (maxDv 10.30 ≤
12; 0 reversals; 0 NaN; smooth 400-crossing) · zero-gc PASS (20,000 ticks,
identities ✓, heap 0 B) · integration PASS (8 rebases, 48 chunks, locals
1022.8 ≤ 1,024, offset error 0, **geometries constant at 151**).

Post-fix probe verification (MutationObserver, game/tools/diag-m1d.mjs):
**geo = 151 from the first tracked frame (t=331 ms) through warmup, the
dive nadir, HYPERSONIC·GOVERNOR, SUPERSONIC·GOVERNOR, LANDED, and DONE —
never moves.** Probe kept in game/tools/ as dev tooling.

## 5. Changes (full entries in notes/CHANGES.md, #27–31)

Extraction 4/4 + F4 (02b313c) · erratum + 3 strict-TS type-only fixes
(dc55895) · wiring (e88db74) · routed diagnosis (613db69, 841babf) · F11 +
F12 applied (51fefcb) · final gates green (this commit). Canon untouched
throughout.

## 6. Lead eyeball (optional)

`npm run dev` → `?page=m1d`: the scripted dive plunges from 10 km at
2,000 m/s — GOVERNOR chip lights below ~6.2 km, the dive-trace panel fills
(8,000 m: 1,991 → 1,000 m: 264.7 → LANDED), the ship lands analytically on
frozen terrain. After DONE: free flight (↑/↓ pitch, ←/→ roll, A/D yaw, W/S
throttle, P pause, R reset) — pull hard at 300 m/s and feel lift curve the
trajectory; rebases fire silently every ~1,024 m; geometries never move.

## Status

GATE GREEN · AWAITING LEAD APPROVAL (§8.7). On approval: 1D → APPROVED;
begin 1E per the §8 loop — read Milestone 1E.txt in full, extract 3 blocks,
apply F1 (require-shim → ESM import in the harness), wire ?page=m1e,
gate (90 s) + full regression, report, STOP.
