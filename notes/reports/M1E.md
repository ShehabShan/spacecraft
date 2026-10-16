# MILESTONE 1E REPORT — The Spherical Astronaut (assembly brief §8.6)

Date: 2026-10-16 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**STATUS: all six rulings (F14, F15, F16a/b/c, F17a/b/c, $-strip) applied
exactly as specified and vindicated where they aimed; the re-run gate is
still RED on THREE REMAINING items — all newly exposed, all diagnosed to
root cause with hard numbers, ALL ROUTED UNTOUCHED per the ruling's
stop-and-route terms.** Full regression 1A/1B/1C/1D GREEN throughout.
F14 is **the project's first core-behavior edit** (flagged, cited, and
isolated in its own commit 7947369); it exposed a second-order core defect
in the coriolis launch path (§5.1).

## 1. Extraction (unchanged from the first report)

`node tools/extract.mjs 1E`: 3/3 blocks verbatim (249 + 1096 + 1526 =
2871 lines); zero parenthetical matches. F1 vacuous as-extracted (zero
`require(`; `terrainNormalInto` already top-level — RATIFIED as-delivered,
ruling item 6). F13 applied (`0x51ope5` → `0x5109e5` — ratified). Two
strict-TS repairs ratified (1D-erratum-pattern null-guard; `Math.SQRT1_3`
→ `1/Math.sqrt(3)`, constant confirmed nonexistent). F2 remains EXPECTED
at 1G.

## 2. The six fixes, applied (commits 7947369, e689d4c; TSC_EXIT=0 BUILD_EXIT=0 unpiped)

- **F14 — FIRST CORE-BEHAVIOR EDIT** (`astronautKCC.ts integrateTick`): the
  jump-consumption line moved from BEFORE the mode dispatch (canon 812) to
  immediately AFTER it, before the hysteresis block. Edge-trigger preserved
  (fires once, next tick, consumed at that tick's end); `_flightTick` never
  reads `input.jump`; airborne presses buffer to the landing tick. Logged
  prominently per the ruling; **1G note: re-grep the §3.5 patch application
  against the moved line (they do not overlap, but verify during
  application).**
- **F15** (`runStateMachine`): the independent VEHICLE check now captures
  the PARENT-FRAME offset once — `rotateByQuatConjInto(prov.quat, 0, 2, 0,
  offP)` at the attach-time quat, before the loop (computed in the harness;
  KCC private state untouched) — and composes that vector; dead
  `const tx…/void tx;` deleted. **Result: vehicleErr 0.0e+0 over 600 ticks
  (was the constant 0.2565 = 2·2·sin(3.69°)) — the ruling's analysis
  confirmed exactly.**
- **F16a**: face-walk budget 11,600 → 13,600 AND tick cap 95,000 → 140,000
  (both changed).
- **F16b**: up-rotation criterion `cos(0.02)` → `cos(0.06)`; detail
  "(bound 1.15°)" → "(bound 3.44°)".
- **F16c**: corner print `deg(F.minCornerAngle)` →
  `(F.minCornerAngle * 180) / Math.PI` (deg() re-applied acos).
- **F17a**: alt0 AND the climbGain end-read both
  `Math.hypot(kcc.pLocal…) − 5000` (telemetry was stale pre-swap).
- **F17b**: STEEP recalibrated per ruling — mountainFreq 3.0, mountainAmp
  2200, detailFreq 8, detailAmp 3 — plus `scanFor(…, nb?)` with
  `uniformAround()`: all 8 compass probes at 3 m arc (3/5000 rad) must be
  class-consistent (moderate < 35°, steep > 45°, cliff > 60°).
- **$-strip**: `$` restored in the slope-step detail string
  (`${vEnd.toFixed(1)}`).

## 3. F17b calibration probe (game/tools/diag-m1e-field.mjs — read-only Node on the extracted terrainField)

Slope distribution on the recalibrated field (20k uniform samples):
min 0.0° / max 85.2° — `<5°` 42.42% · `5–18°` 4.58% · `18–28°` 3.70% ·
`28–45°` 7.95% · `45–52°` 4.14% · `52–68°` 16.23% · `68–70°` 3.02% ·
`>70°` **17.96%**.

Harness-order scan (canon mulberry32(0x5109e5) stream, uniformity gates on):
**moderate found @ try 49 (25.9°) · steep @ try 12 (60.2°) · cliff @ try 4
(73.2°).** **FINAL mountainAmp = 2200** — the +200 escalation to 2,800 was
not needed.

## 4. Re-run gate output (verbatim; single serial run, all five pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.7s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 24.3 ms — maxPosErr={…}m restore={…} heapDelta={…}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.1s)
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=54549 parentVerts=9132 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
  ✓  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)
[m1d gate] acceptance line: [Milestone1D] acceptance PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=48 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  4 e2e/m1d.spec.ts:6:1 › M1D — Flight & Aerodynamic Governor acceptance (14.8s)
[m1e gate] acceptance line: [Milestone1E] acceptance FAILED
[m1e gate] badges: ["PASS","FAIL","FAIL","PASS","FAIL","PASS"]
  ✘  5 e2e/m1e.spec.ts:8:1 › M1E — Spherical Astronaut acceptance (24.0s)

  1 failed  ·  4 passed (1.9m)
```

Per-row details (verbatim DOM scrape, diag-m1e.mjs):

- **[PASS] face-walk** — `13.6 km great-circle walk … (closest approach
  0.82°): 2 face changes; max per-tick up rotation 2.145° (bound 3.44°),
  fwd 2.388° (bound 5.2°) — no yaw snaps; fwd⊥up max 3.3e-16; quaternion
  norm dev 2.2e-16; min AGL Infinity m. …` — **F16 vindicated on every
  sub-item (corner now prints the true 0.82°).**
- **[FAIL] slope-step** — `26° slope: climbed 4.9 m uphill in 2.5 s
  (expected ≈ 4.4 m, slide 0.000 m/s, grounded 150/150), descended with
  snap-down holding grounding 150/150 · 60° slope: slide initiated at tick
  5, accelerated 10.3 m/s downhill (displacement 100% downhill: 1.00);
  uphill SPRINT net progress 0.11 m in 1.5 s (unimpeded would be 12 m) —
  dual step rule blocks · 73° cliff: net uphill progress 0.02 m over 1.5 s
  of sprint into the face (min AGL -0.206 m — penetration-free) …` —
  **F17a/F17b vindicated: every slope criterion PASSES on the new field
  (see §5.3 for the one remaining failure — it is not a slope number).**
- **[FAIL] state-machine** — `ZERO-G entered 1 tick …; RCS burn Δv 2.400
  m/s, propellant 2.400 m/s …; attitude yaw 0.500 rad …; deorbit fell back
  through the hysteresis band (SURFACE at tick 8526) and landed
  analytically; VEHICLE parented compose tracked the moving platform to
  **0.0e+0 m** over 600 ticks, detach velocity inherited to 0.0e+0 m/s;
  NaN events 0.` — **F15 vindicated exactly (0.2565 → 0.0e+0).** The
  remaining failure is the deorbit cap (§5.2).
- **[PASS] zero-gc** — 30,000 ticks **with F14 live (real jumps in the
  burn)**: identities ✓, heap Δ 0 B, NaN 0 — the ruling's item-8 note
  holds; nothing regressed.
- **[FAIL] coriolis** — `… Landed -85.22 cm WEST (theory … 1.69 cm …);
  cross-track residual 1.20 cm; airborne 0.00 s …` — new core defect,
  §5.1.
- **[PASS] integration** — 4 rebases (Δ = N·256), 194 chunks, geometries
  constant at 154, locals 1022 ≤ 1,032, group offset 0e+0, 0 write-through
  misses.

## 5. The three remaining failures — diagnosed, ROUTED UNTOUCHED

All three were exposed BY the fixes (two of them invisible while the jump
was dead); all numbers below come from `game/tools/diag-m1e-core.mjs`, a
Node replication of the exact headless rows against the real extracted core
modules (2d7bf7f).

### 5.1 coriolis — SECOND CORE DEFECT: launch-tick compose/embed phase mismatch (exposed by F14)

With F14 live the jump now fires — and re-lands **within the launch tick**
(Node trace: tick 1 after `inp.jump = true` → `grounded=true`; airTicks 0;
westDrift −85.22 cm; perp 1.20 cm). Mechanism: the launch branch composes
`absPos` at the **advanced** θ_new (integrateTick advanced θ at its top),
then `_flightTick`/`_sweep` treats that fresh position as a PRE-TICK
leftover and its tick-start embed check probes terrain at **θ_prev** — the
probed direction is mis-rotated by exactly Ω·dt (0.867 m at the equator) →
embed hit → `_landAt(…, θ_prev)` re-plants ~0.87 m EAST (recorded as
−85.22 cm "west" — the numbers match analytically). The planet-frame
trajectory is otherwise sound (perp residual 1.20 cm is the tilt-corrected
remnant of that single jump). **Fix options belong to the Lead (this would
be core edit #2):** e.g. compose the launch (position + transport velocity)
at θ_prev — physics-neutral, since only the world-frame bookkeeping
changes and the sweep's θ_prev probe becomes consistent — or probe the
embed check at the compose phase. Expected after fix: airborne ≈ 61 ticks,
west ≈ +1.7 cm (window 0.6–6 cm).

### 5.2 state-machine — deorbit 20,000-tick cap too small (landed=false)

Every criterion passes except `landed`: the free-fall from 31 km (30 m/s
inward) takes ≈ 22,400 ticks analytically; the canon loop caps at 20,000.
Node trace at the cap: **tick 19,999, r = 12,551 m, v = 146 m/s, still
airborne** (hysteresis re-entry at tick 8,526 ✓ as the author designed).
Same class as F16a (budget vs real dynamics) but this cap is acceptance
logic → Lead's call (e.g. 20,000 → 24,000).

### 5.3 slope-step cliff row — minAGL −0.206 is CROSS-ROW CONTAMINATION (outside the conditional window → routed)

The cliff criterion reads `kcc.integrity.minAGL` — a GLOBAL accumulator
that the zero-gc burn (a different row, which PASSES) had already lowered
before `runSlopeStep` ran: Node full-sequence attribution pins the drop to
**burn tick 20,590, mode SURFACE** — the phase-3 deorbit landing bisection
(−0.1119 in Node; −0.206 in the browser — the same transient class, ulp-
level V8 divergence in a chaotic 30,000-tick trajectory). The cliff sprint
itself **never goes airborne**: the verbatim slope-step replication logs
zero minAGL drops through (a) climb, (b) slide (firstAirborneTick = null),
and (c) cliff sprint, and the RATIFIED dual step/slope rule held everywhere
(climb 4.9 m vs 4.37 expected with slide 0.000; slide 5.3 → 10.3 m/s,
ratio 1.00; uphill net 0.11; cliff net 0.02). −0.206 lies OUTSIDE the
pre-authorized [−0.15, −0.05) relaxation window, so per the ruling's
explicit terms this is STOP-AND-ROUTE. The underlying measurement-design
question for the Lead: the criterion intends "the cliff sprint is
penetration-free" but reads an accumulator polluted by the burn's
intentional hard falls — options: per-row minAGL reset at runSlopeStep
entry, a bound outside the conditional range, or a sweep-transient note.

## 6. Ruling item 9 — ledger record

All recorded in the Approval Ledger with dates: F14 (core, dead-jump
relocation — first core-behavior edit), F15 (vehicle-check parent-frame
offset), F16a/b/c, F17a/b/c (incl. the conditional cliff-AGL relaxation and
the 2,200–2,800 mountainAmp calibration range), the L1015 $-strip, the
F1-vacuous ratification, and both strict-TS repairs. Re-run outcome
recorded alongside (three new routings).

## 7. Changes

CHANGES.md #39 (all six fixes + probe, commits 7947369 / e689d4c /
dd3e97a) and #40 (re-run + three routings, no code change, probe
2d7bf7f). Canon untouched throughout; all exit codes observed unpiped
(TSC_EXIT=0, BUILD_EXIT=0, PLAYWRIGHT_EXIT=1).

## 8. Lead eyeball (after the remaining rulings)

`npm run dev` → `?page=m1e`: SPACE now jumps (F14 live); the zero-G drop
(T) with RCS return works; walking/sprinting on the 52 m/s equator with
the surface-normal camera; face-seam crossings with zero orientation pop.
The coriolis row's full flight awaits the §5.1 ruling.

## Status

GATE FAILED · 3 NEW ROOT CAUSES DIAGNOSED AND ROUTED (§5.1 coriolis
launch-phase core defect — exposed by F14; §5.2 deorbit cap; §5.3 cliff-
minAGL cross-row contamination) · ALL SIX PRIOR RULINGS APPLIED AND
VINDICATED · AWAITING LEAD RULINGS. On rulings: apply, re-run the 1E gate +
full regression, update this report, re-present at the approval gate.
