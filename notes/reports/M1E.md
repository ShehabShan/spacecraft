# MILESTONE 1E REPORT — The Spherical Astronaut (assembly brief §8.6)

Date: 2026-10-16 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**GATE FAILED — `[Milestone1E] acceptance FAILED` (badges
["FAIL","FAIL","FAIL","PASS","FAIL","PASS"]). Full 1A/1B/1C/1D regression
GREEN in the same serial run.** All four failing rows are diagnosed to root
cause below; every one is an authorial canon defect (dead jump; a wrong
independent-verification compose; two calibration-vs-real-terrain families;
one stale-telemetry measurement), **routed to the Lead with proposed minimal
fixes — nothing touched** (§6: acceptance logic is Lead-only; F9/F10/F11
precedent). Extraction, F13, and two §6 type-error repairs are done and
green; this report requests rulings before any repair.

## 1. Extraction report (verbatim from `node tools/extract.mjs 1E`)

```
[extract 1E] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1E.txt
  src/core/physics/sphericalFrame.ts — 249 lines
  src/core/physics/astronautKCC.ts — 1096 lines
  src/test/Milestone1E_TestHarness.tsx — 1526 lines
[extract 1E] 3 block(s) written verbatim (2871 code lines).
```

3/3 blocks; **zero parenthetical matches** (invariant intact — 1B's
SimulationCore remains the only one).

## 2. F1 / F13 / strict-TS repairs at extraction time (TSC_EXIT=0 unpiped)

- **F13 APPLIED** (pre-authorized): canon ~2377 / extracted 929 —
  `mulberry32(0x51ope5 as unknown as number || 0x5109e5)` (invalid hex, will
  not lex) → `const rand = mulberry32(0x5109e5);` (the fallback value proves
  the intended seed). Grep found exactly one occurrence. No other byte.
- **F1 CHECKED — VACUOUS AS EXTRACTED**: grep for `require(` in the
  extracted harness found **ZERO** occurrences (directive expected exactly
  one). The canon harness calls the top-level imported `terrainNormalInto`
  directly (import block at extracted L50–53 already includes it); there is
  no shim to replace, so F1's ESM intent is satisfied by the canon as
  extracted and the build cannot break from require(). Documented, not
  skipped.
- **Two strict-TS type-error repairs under §6** ("type errors"; 1D erratum
  precedent — type-level only, runtime-neutral; tsc: 6 errors → TSC_EXIT=0
  observed unpiped):
  (a) `astronautKCC.ts` update() write-through guard `if (this._wtPos !==
  null)` → `if (this._wtPos !== null && this._wtVel !== null)` (extracted
  430 = canon ~775; both fields are set together in attachWriteThrough; the
  IDENTICAL pattern was ratified in the 1D erratum, dc55895 fix (a));
  (b) harness L195 `Math.SQRT1_3` (nonexistent Math constant — TS2551 ×3;
  in loose JS it would be `undefined` → NaN → the face-walk corner
  measurement could never update) → `1 / Math.sqrt(3)` ×3 — the author's
  documented intent (unit corner (1,1,1)/√3; 3·(1/√3)² = 1).
- **ROUTED, NOT REPAIRED (standing damage protocol, family A)**: exactly one
  $-strip in all three files — extracted L1015 (canon ~2462–2463), slope-step
  (b) detail string: `` `{vEnd.toFixed(1)} m/s downhill (displacement 100%
  downhill: ` `` missing `$`. Badge-detail class (F6-forbidden);
  verdict-neutral (pass logic reads S.ok, never detail text). Awaiting the
  one-character `$` authorization.
- **astronautKCC.ts is otherwise PRISTINE** (watch 5.f): the ONLY edit is
  the §6 null-guard type fix above; the 1G §3.5 persistence patch is NOT
  applied.

## 3. Gate run — verbatim output (single serial run, all five pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.5s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 26.3 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.0s)
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=54714 parentVerts=9131 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
  ✓  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)
[m1d gate] acceptance line: [Milestone1D] acceptance PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=48 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  4 e2e/m1d.spec.ts:6:1 › M1D — Flight & Aerodynamic Governor acceptance (14.8s)
[m1e gate] acceptance line: [Milestone1E] acceptance FAILED
[m1e gate] badges: ["FAIL","FAIL","FAIL","PASS","FAIL","PASS"]
  ✘  5 e2e/m1e.spec.ts:8:1 › M1E — Spherical Astronaut acceptance (24.0s)

  1 failed
    e2e/m1e.spec.ts:8:1 › M1E — Spherical Astronaut acceptance
  4 passed (1.9m)
```

Per-row detail (verbatim DOM scrape, `game/tools/diag-m1e.mjs`, read-only):

- **[FAIL] face-walk** — `11.6 km great-circle walk through the (1,1,1)/√3
  cube CORNER (closest approach 89.18°): 1 face changes; max per-tick up
  rotation 2.145° (bound 1.15°), fwd 2.388° (bound 5.2°) — no yaw snaps;
  fwd⊥up max 3.3e-16 (no gimbal degeneracy); quaternion norm dev 2.2e-16;
  min AGL Infinity m. Holonomy of a great circle = 2π ≡ identity — the frame
  is pole/face-singularity-free.`
- **[FAIL] slope-step** — `20° slope: climbed 103.3 m uphill in 2.5 s
  (expected ≈ 3.5 m, slide 5.275 m/s, grounded 150/150), descended with
  snap-down holding grounding 150/150 · 53° slope: slide initiated at tick
  8, accelerated {vEnd.toFixed(1)} m/s downhill (displacement 100%
  downhill: 0.00); uphill SPRINT net progress 2.13 m in 1.5 s (unimpeded
  would be 12 m) — dual step rule blocks · 73° cliff: net uphill progress
  0.19 m over 1.5 s of sprint into the face (min AGL -0.091 m —
  penetration-free) (engineered field swapped + restored inside one
  synchronous block).`
- **[FAIL] state-machine** — `ZERO-G entered 1 tick beyond the 30 km gravity
  range (Spec 02.3 fade); RCS burn Δv 2.400 m/s, propellant 2.400 m/s of the
  25 m/s pack; attitude yaw 0.500 rad (finite frame rotation); deorbit fell
  back through the hysteresis band (SURFACE at tick 8526) and landed
  analytically; VEHICLE parented compose tracked the moving platform to
  2.6e-1 m over 600 ticks, detach velocity inherited to 0.0e+0 m/s; NaN
  events 0.`
- **[PASS] zero-gc** — `30,000 synchronous ticks … every state object
  identity preserved ✓; heap Δ 0 B (limit 1 MB); NaN events 0.`
- **[FAIL] coriolis** — `SPEC-CANONICAL TEST: vertical jump (u = 5 m/s) at
  the equator of the 52 m/s planet (Ω = 0.0104). Landed 0.00 cm WEST (theory
  (4/3)Ωu³/g² = 1.69 cm …); cross-track residual 0.00 cm; airborne 0.00 s
  (2u/g ≈ 1.02 s); post-touchdown relative speed planted to < 0.02 m/s
  within 1 tick(s) and held (max 0.000 m/s over 32 ticks) — zero skating. …`
- **[PASS] integration** — `20 s live trek at 4× (80 s sim …): 4 origin
  shifts (every Δ an exact multiple of 256, f32-exact); 182 chunks streamed
  through the M1C pool; renderer geometries constant at 154 (min === max);
  astronaut f32 locals max 1022 m ≤ 1,032; spinning terrain group tracked
  −O to 0e+0 m; entity write-through verbatim (0 misses). …`

## 4. Root-cause diagnoses (all four rows; nothing touched)

### 4.1 coriolis — THE CANON JUMP IS STRUCTURALLY DEAD (authorial order bug)

`airborne 0.00 s` — the jump never launches. In `integrateTick` the input is
consumed **before** the grounded tick can read it:

- canon 812 / extracted `astronautKCC.ts:467`:
  `this.input.jump = false; // consumed (edge-triggered)`
- THEN the mode dispatch calls `_groundedTick` (canon 818–820), which reads
  it at canon 932 / extracted 587: `if (this.input.jump && !this.input.crouch)`.

`input.jump` is therefore ALWAYS false inside `_groundedTick` — no jump can
ever fire (row, burn, or the interactive SPACE/T handling). Evidence chain:
airTicks 0 → westDrift 0.00 → perpDrift 0.00 → settle trivially clean; the
row's math is otherwise intact (its own theory value prints 1.69 cm with the
site's actual g, inside the 0.6–6 cm window the author intended).
**PROPOSAL F14 (Lead to rule):** relocate the single consumption line to
immediately AFTER the mode-dispatch chain in `integrateTick` (consume after
the tick acted — preserves edge-trigger semantics; one line moved, nothing
else). This matches the author's unambiguous intent: the flagged "JUMP —
along the surface normal" branch in `_groundedTick`, the analysis §1.2/§1.3
(jump u = 5 m/s along the vertical), the burn script's `inp.jump = true`
pulses, and the HUD legend ("SPACE JUMP").

### 4.2 state-machine — the harness's VEHICLE verification composes the wrong offset

`vehicleErr 2.6e-1 m` vs bound 1e-9; every other criterion in the row PASSES
(ZERO-G 1 tick ✓, RCS Δv 2.400 ✓, propellant 2.400 ✓, yaw 0.500 ✓, deorbit
SURFACE tick 8526 + landed ✓, detach inheritance **0.0e+0** ✓, NaN 0 ✓).
The KCC is self-consistent and physically correct: `attachVehicle`
(extracted 296–311 = canon 641–656) stores the offset in the PARENT frame
(`vehOffset = R_att⁻¹·(absPos − p.pos)`), and `_vehicleTick` composes
`P = p.pos + R_now·vehOffset` — a rigid attachment that rides the platform's
rotation, consistent with the ω×(P−parentPos) velocity term AND with the
detached-velocity check that PASSES exactly. The harness's independent
check (extracted 786–799) instead composes the WORLD attach offset:
`const off = { x: 0, y: 2, z: 0 }` rotated by the CURRENT quat — i.e. it
assumes `R_att⁻¹·(0,2,0) = (0,2,0)`, true only for R_att = I. With R_att
(fwd = +Z, up = radial at (800, R+1200, 0)): o_p = 2·(0, 0.9918, 0.128), so
|o_p − (0,2,0)| = **0.2565 m — CONSTANT**, matching the observed maxErr
2.6e-1 exactly. **PROPOSAL F15 (Lead to rule):** fix the CHECK, not the KCC
— capture the parent-frame offset at attach time (compose
`R_att⁻¹·(0,2,0)` with the same manual quat formula, then expected =
`p.pos + R_now·off_p`); ~2 lines, verification math only.

### 4.3 face-walk — authorial calibration vs the real M1C field (+ one detail-string bug)

Measured against the canon criteria: pathLen 11.6 km ✓ (11,000) ·
maxOrtho 3.3e-16 ✓ · maxQuatDev 2.2e-16 ✓ · minFwdDot 2.388° ✓ (5.2°) ·
**minCornerAngle 0.0143 rad ✓ (< 0.06 — the walk passes within 0.82° of the
corner: parallel transport and great-circle steering WORK)** ·
**faceChanges 1 ✗ (bound ≥ 2)** · **max up rotation 2.145° ✗ (bound 1.15°)** ·
minAGL +∞ (criterion ✓ — AGL is tracked only in the airborne sweep; the T1
walk never went airborne).

- **faceChanges 1 < 2**: the second face boundary sits at arc 10.06 km along
  the great circle; the 11,600 m pathLen budget counts 3D arc INCLUDING the
  T1 controller's unrestricted vertical climbing (stepHeight 60), so
  mountainous stretches consume budget without angular progress and the walk
  ends at φ ≈ 125° — just short of the second boundary. The author's budget
  assumed a flatter traverse.
- **up rotation 2.145° > 1.15°**: per-tick terrain-normal change on steep
  sections of the real field; the canon analysis (§1.1) bounds the
  curvature term (1.33e-4 rad) but the terrain term is unbounded on
  mountains — the 1.15° (4× analysis margin) is exceeded on ridge crests.
- **Detail-string bug (cosmetic, routed)**: the `deg()` helper
  (extracted 628) applies `acos` — correct for the minUpDot/minFwdDot DOTS —
  but the call at 633 passes the ALREADY-ANGULAR `F.minCornerAngle`
  (radians): printed "closest approach 89.18°" is `acos(0.0143)`; the true
  closest approach is 0.0143 rad ≈ 0.82° and the criterion PASSED.
  One-line detail fix (print `minCornerAngle·180/π`), verdict-neutral.

**PROPOSAL F16 (Lead to rule — acceptance calibration):** raise the pathLen
budget (e.g. 11,600 → ~13,600) or re-scope the face-change expectation, and
raise the up-rotation bound to fit the real field (observed 2.145°);
alternatively re-seed/reroute the walk — assembler takes any ruling.

### 4.4 slope-step — engineered-field dynamics + one stale-telemetry measurement bug

Sites WERE found (no "site not found"): moderate 20°, steep 53°, cliff 73°.
Measured vs criteria:
- (a) moderate: grounded 150/150 up AND down ✓ (snap-down holds), climbGain
  103.3 m "passes" 0.7·expected=2.4 — but see the stale-alt0 bug below;
  **maxSlide 5.275 ✗ (bound 0.05)** — the 10 m walk crosses >45° patches
  near the point-scanned 20° site (the scan is point-wise; the engineered
  field varies wildly under the path — mountainAmp 1300).
- (b) steep: slide initiated tick 8 ✓ (≤ 30); **displacement-downhill ratio
  0.00 ✗** (net displacement ≈ 0 over the 120-tick slide — the slide stalls
  on the wild field; criterion wants > 0.90 of |Δ| downhill); **uphill
  sprint net 2.13 m ✗ (bound 0.3)** — the wall-slide retry lets the sprint
  zigzag around blocked faces and net uphill progress on the meandering
  field. (vEnd is unprintable until the routed $-strip is authorized — it is
  inside the `{vEnd.toFixed(1)}` literal.)
- (c) cliff: net 0.19 ✓ (< 0.5); **minAGL −0.091 ✗ (bound −0.05)** — a
  9.1 cm Lipschitz transient during the airborne cliff transition (gap-limited
  sweep detects it at the next sample and lands; the "post-tick AGL ≥ 0"
  structural guarantee is about tick-END anchoring, not in-sweep transients).
- **Stale-alt0 measurement bug (authorial)**: `alt0` (extracted 958) is read
  from `kcc.telemetry.altMSL` AFTER the field swap + `teleportSurface` — but
  `teleportSurface` does not fill telemetry and nothing ticks in between, so
  alt0 is the value from the last burn tick on TEST_PLANET (pre-swap);
  climbGain 103.3 m is cross-field contamination, not a climb measurement.

**Watch 5.b parameters, as ordered — paste before touching anything:**
```
STEEP TerrainParams (canon 2369–2375): name 'M1E engineered slopes',
  radius 5000, seed 777, continentFreq 1.2, continentAmp 40,
  maskFreq 1.05, mountainFreq 11, mountainAmp 1300,
  detailFreq 40, detailAmp 6
Scan (canon 2377–2380, post-F13): rand = mulberry32(0x5109e5);
  moderate = scanFor((d,s) => s > 18 && s < 28, 20000, rand)
  steep    = scanFor((d,s) => s > 52 && s < 68, 20000, rand)
  cliff    = scanFor((d,s) => s > 70,        20000, rand)
  scanFor: uniform sphere sampling, slopeDegAt = normal-vs-radial angle
```
**PROPOSAL F17 (Lead to rule):** calibration of the row's slide/displacement/
AGL bounds to the field the scan actually produces, plus the alt0 fix
(read `kcc.telemetry.altMSL` after a settle tick, or store the teleport's own
h) — assembler takes any ruling. NOTE: the R2 dual step/slope RULE itself
(RATIFIED §2.5) behaved correctly everywhere it was measured (block at 53°,
cliff hold at 73° with 0.19 m net).

**Watch 5.c VERIFIED**: the steep-field restore survives transcription —
canon 2490–2492 / extracted 1042–1043: `S.ok = ok; // RESTORE the canonical
field… initTerrainField(TEST_PLANET); kcc.teleportSurface(FLAT_SITE…)`. The
green integration row (live trek AFTER the suite: 4 rebases, 182 chunks)
empirically confirms the trek ran on the real planet's field.

## 5. Changes (full entries in notes/CHANGES.md, #33–38)

Extraction 3/3 + F13 + F1-vacuous + 2 §6 type-error fixes + $-strip routed +
?page=m1e wired (caad62c) · gate FAIL + 4 root-cause routings, zero code
changes (this commit). Canon untouched throughout.

## 6. Lead eyeball (optional — after rulings)

`npm run dev` → `?page=m1e`: walking/sprinting on the 52 m/s equator with
the surface-normal camera, face-seam crossings with zero orientation pop,
T = zero-G drop with RCS return. NOTE: SPACE jump is currently dead
(§4.1) — the T-key drop and R reset work; jumping awaits F14.

## Status

GATE FAILED · 4 ROOT CAUSES DIAGNOSED AND ROUTED · AWAITING LEAD RULINGS
(F14 dead-jump relocation; F15 vehicle-verify offset; F16 face-walk
calibration + deg() detail fix; F17 slope-step calibration + stale-alt0;
plus the routed $-strip restoration). On rulings: apply, re-run the 1E gate
+ full regression, update this report, then re-present for approval.
