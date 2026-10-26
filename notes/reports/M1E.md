# MILESTONE 1E REPORT — The Spherical Astronaut (assembly brief §8.6)

Date: 2026-10-16 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**FINAL: GATE GREEN — `[Milestone1E] acceptance PASSED` (6/6 rows), plus the
full 1A/1B/1C/1D regression PASSED in the same serial run: `5 passed
(1.9m)`, PLAYWRIGHT_EXIT=0.** The road here took three ruling rounds and two
authorized core edits — F14 (the structurally dead jump) and F18 (the
launch-tick compose/embed phase mismatch it exposed) — with every fix
verified in Node FIRST and the browser agreeing number-for-number. The
spec-canonical Coriolis jump is green: **0.75 cm west (theory 1.69 cm,
window 0.6–6), cross-track 1.18 cm, airborne 1.02 s, planted to 0 m/s
relative in 1 tick, zero skating.**

## 1. Extraction & at-extraction work (unchanged)

3/3 blocks verbatim (sphericalFrame 249, astronautKCC 1096, harness 1526 =
2871 lines); zero parenthetical matches. F13 applied (`0x51ope5` →
`0x5109e5`); F1 ratified vacuous as-extracted (zero `require(`; top-level
import already present); two strict-TS §6 repairs ratified (write-through
null-guard per the 1D erratum pattern; `Math.SQRT1_3` → `1/Math.sqrt(3)` —
the constant does not exist). F2 remains EXPECTED at 1G.

## 2. All nine rulings applied (commits in order)

| Fix | Commit | What | Verdict |
|---|---|---|---|
| F14 (core #1) | 7947369 | jump consumption relocated after the mode dispatch (canon cleared `input.jump` before `_groundedTick` read it) | jumps fire everywhere; zero-gc holds identities/heap/NaN with live jumps |
| F15 | e689d4c | vehicle-verify composes the PARENT-frame offset (conjugate-rotate (0,2,0) at attach quat) | vehicleErr 0.2565 (constant 2·2·sin 3.69°) → **0.0e+0** |
| F16a/b/c | e689d4c | budget 13,600 + cap 140,000; up bound cos(0.06) + "(bound 3.44°)"; corner print radians·180/π | face-walk PASS: 2 face changes, corner 0.82°, up 2.145° |
| F17a/b | e689d4c | direct `hypot(pLocal)−5000` alt reads; STEEP recalibrated (freq 3.0, amp 2200, detail 8·3) + scanFor 8-compass uniformity gate | slope rows PASS; **FINAL mountainAmp = 2200** (moderate@49 25.9°, steep@12 60.2°, cliff@4 73.2°; >70° = 17.96% of sphere; escalation not needed) |
| $-strip | e689d4c | `$` restored at the slope-step detail | prints vEnd correctly |
| **F18 (core #2)** | 37a4c9e | launch composes P **and** velocity at θ_prev (optional `_composeGrounded` phase param; `_flightTick(dt, launchTick)`; `_sweep(…, launchTick)` guards the tick-start embed check with `!launchTick`) | coriolis airborne 61 ticks, 0.75 cm west |
| F19 | 7d77e52 | deorbit cap 20,000 → 26,000 | landed at tick 22,307 |
| F20 | 7d77e52 | `resetIntegrityStats()` first in runSlopeStep + 'n/a (never airborne)' print | cliff criterion clean; F17c relaxation MOOT |

**F18 rationale (on record per the ruling):** every normal flight tick's
start position corresponds to θ_prev; the launch compose at θ_new
corresponded to NO physical instant and double-counted one tick of
transport (the 0.87 m phantom = the observed −85.22 cm). The mandatory
guard: launch AGL is EXACTLY groundClearance by construction, so the embed
check's `AGL < clearance` would be decided by the compose/decompose
round-trip error (~3e-14 m) — a deterministic-but-unknown-sign ulp coin
flip per site/engine; the check exists for prior-tick transients and is
semantically inapplicable at launch. Mid-sweep sampling is untouched (the
launch segment ascends monotonically). **1G note: re-grep the §3.5 patch
application against BOTH moved/edited regions (F14 line + F18 signatures);
they do not overlap the patch, but verify during application.**

## 3. Node verification FIRST (ruling 4b — `game/tools/diag-m1e-core.mjs`)

```
coriolis: airTicks=61 (48–78; 2u/g≈61) west=0.75 cm (0.6–6) perp=1.18 cm (<1.2)
          theory=1.69 cm settle=1 tick(s) (1–2) maxSettle=0.0000 (<0.02)
state-machine: zeroOk=true rcsDv=2.3999 budgetUsed=2.4000 yaw=0.5002
          surfaceTick=8526 landed=true landingTick=22307 (<26000)
          vehicleErr=0.0e+0 (<1e-9) detachDv=0.0e+0 (<1e-6) nan=0
slope (a): 26° climbGain=4.90 (expected 4.37, need >0.7×) slide=0.000 (<0.05)
          groundedUp=true groundedDown=true
slope (b): 60° t30=5 (0–30) vMid=5.3 vEnd=10.3 (accel) downRatio=1.00 (>0.9)
          uphillNet=0.11 (<0.3)
slope (c): 73° cliffNet=0.02 (<0.5) minAGL=+Infinity (n/a — never airborne)
slope-step final minAGL after reset+rows: +Infinity
```

## 4. Browser gate — verbatim (single serial run, all five pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.8s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 14.8 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.0s)
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=53130 parentVerts=9727 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
  ✓  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)
[m1d gate] acceptance line: [Milestone1D] acceptance PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=46 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  4 e2e/m1d.spec.ts:6:1 › M1D — Flight & Aerodynamic Governor acceptance (14.8s)
[m1e gate] acceptance line: [Milestone1E] acceptance PASSED
[m1e gate] badges: ["PASS","PASS","PASS","PASS","PASS","PASS"]
  ✓  5 e2e/m1e.spec.ts:8:1 › M1E — Spherical Astronaut acceptance (24.0s)

  5 passed (1.9m)
```

Per-row details (verbatim DOM scrape):

- **face-walk PASS** — `13.6 km great-circle walk through the (1,1,1)/√3
  cube CORNER (closest approach 0.82°): 2 face changes; max per-tick up
  rotation 2.145° (bound 3.44°), fwd 2.388° (bound 5.2°) — no yaw snaps;
  fwd⊥up max 3.3e-16 (no gimbal degeneracy); quaternion norm dev 2.2e-16;
  min AGL Infinity m. Holonomy of a great circle = 2π ≡ identity — the
  frame is pole/face-singularity-free.`
- **slope-step PASS** — `26° slope: climbed 4.9 m uphill in 2.5 s (expected
  ≈ 4.4 m, slide 0.000 m/s, grounded 150/150), descended with snap-down
  holding grounding 150/150 · 60° slope: slide initiated at tick 5,
  accelerated 10.3 m/s downhill (displacement 100% downhill: 1.00); uphill
  SPRINT net progress 0.11 m in 1.5 s (unimpeded would be 12 m) — dual
  step rule blocks · 73° cliff: net uphill progress 0.02 m over 1.5 s of
  sprint into the face (min AGL n/a (never airborne) m — penetration-free)
  (engineered field swapped + restored inside one synchronous block).`
- **state-machine PASS** — `ZERO-G entered 1 tick beyond the 30 km gravity
  range (Spec 02.3 fade); RCS burn Δv 2.400 m/s, propellant 2.400 m/s of
  the 25 m/s pack; attitude yaw 0.500 rad (finite frame rotation); deorbit
  fell back through the hysteresis band (SURFACE at tick 8526) and landed
  analytically; VEHICLE parented compose tracked the moving platform to
  0.0e+0 m over 600 ticks, detach velocity inherited to 0.0e+0 m/s; NaN
  events 0.`
- **zero-gc PASS** — `30,000 synchronous ticks on the live controller (walk
  + jumps + slides → zero-G → RCS maneuvers → deorbit landing → vehicle
  attach/detach): every state object identity preserved ✓; heap Δ 0 B
  (limit 1 MB); NaN events 0. …` — **with F14 live (real jumps), per the
  ruling's item-8 note.**
- **coriolis PASS (SPEC-CANONICAL)** — `SPEC-CANONICAL TEST: vertical jump
  (u = 5 m/s) at the equator of the 52 m/s planet (Ω = 0.0104). Landed
  0.75 cm WEST (theory (4/3)Ωu³/g² = 1.69 cm — pure inertial integration,
  angular momentum conserved); cross-track residual 1.18 cm; airborne 1.02 s
  (2u/g ≈ 1.02 s); post-touchdown relative speed planted to < 0.02 m/s
  within 1 tick(s) and held (max 0.000 m/s over 32 ticks) — zero skating.
  The launch/landing planet-frame comparison also validates the R(θ)
  compose/decompose round-trip across a 53 m transport displacement.`
- **integration PASS** — `20 s live trek at 4× (80 s sim, ~4.8 km absolute
  incl. the 52 m/s transport): 4 origin shifts (every Δ an exact multiple
  of 256, f32-exact); 187 chunks streamed through the M1C pool; renderer
  geometries constant at 154 (min === max); astronaut f32 locals max
  1022 m ≤ 1,032; spinning terrain group tracked −O to 0e+0 m; entity
  write-through verbatim (0 misses). Zero locked files modified — the M1C
  pool rides the spin purely as a parent-group transform.`

## 5. Ratified observations (ruling item 6, on record)

F1 vacuous as-extracted (ESM intent satisfied; F2 still expected at 1G) ·
F13 applied · both strict-TS repairs legitimate · field calibration GREEN
under the original bounds on the recalibrated field · the burn's in-sweep
transient sits within the Lipschitz bound and no row asserts it · ledgers
append-only.

## 6. Changes

CHANGES.md #33–41. Commits this milestone: caad62c (extraction + wiring) ·
783c4a6 (first diagnosis) · 7947369 (F14, core #1) · e689d4c (F15–F17 +
$-strip) · dd3e97a (field probe) · 2d7bf7f + ff751a4 (re-run attribution) ·
37a4c9e (F18, core #2) · 7d77e52 (F19/F20) · this commit (final report +
ledgers). Canon untouched throughout; every typecheck/build/gate exit code
observed unpiped (final: TSC_EXIT=0, BUILD_EXIT=0, PLAYWRIGHT_EXIT=0).

## 7. Lead eyeball (optional)

`npm run dev` → `?page=m1e`: SPACE jumps (F14/F18 live — jump, arc, west
Coriolis drift, clean plant); T zero-G drop with RCS return; walking/
sprinting on the 52 m/s equator with the surface-normal camera; face-seam
crossings pop-free; steep ridges slide while uphill sprint dies against the
dual rule.

## Status

**GATE GREEN · AWAITING LEAD APPROVAL (§8.7).** On approval: 1E → APPROVED;
begin 1F per the §8 loop (read Milestone 1F.txt, extract 4 blocks, F3,
impostorMath purity check, ?page=m1f, gate 150 s + full regression, report,
STOP).
