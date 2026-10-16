# MILESTONE 1F REPORT — 3-Camera Layers & Sky Impostors (assembly brief §8.6)

Date: 2026-10-16 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**STATUS (round 2): GATE FAILED 2/5+1 — R1 PASS (real) · R3 PASS (F23
vindicated) · R2/R4/R5 routed (F27 lookAt-convention mismatch, F28
capacity-term canary, F25c corridor stop). First-round routes F22–F26 +
D-1/D-2 all applied per the Lead ruling 2026-10-16 and live-path
vindicated; three NEW authorial defects exposed by the fixes are routed
below (§9). NO unauthorized acceptance-logic changes.** Full 1A–1E
regression GREEN in both serial runs (`5 passed (3.9m)`).

## 1. Extraction report (§8 step 1)

`node tools/extract.mjs 1F` → **4/4 blocks verbatim, 2,404 lines**:
`src/core/render/impostorMath.ts` 171 · `src/render/SkyImpostorPool.ts` 326 ·
`src/render/MultiCameraRig.tsx` 217 · `src/test/Milestone1F_TestHarness.tsx`
1,690. **Zero parenthetical matches** (invariant intact — 1B's
SimulationCore remains the only one). **Defensive layeredCameras discard did
NOT trigger** — zero `layeredCameras` matches anywhere in the canon file
(grep-verified), as the Lead expected.

**Purity check (brief §5): PASS.** `impostorMath.ts` has exactly ONE import:
`import { rotateByQuatConjInto, type Quat } from '../physics/sphericalFrame'`
— no three/react/rapier anywhere in the file.

**Prior-session drift (§10.2 note, repaired):** a previous session had run
the extraction and begun F3 application, then died before committing or
updating STATE.md (its IN-FLIGHT still said "Extraction not yet run"). My
re-extraction found the three render/core files byte-identical (sha256
match) but the harness copy differing (partial F3 application, hash
00d95df3… vs verbatim 6d56bb0f…). The re-run overwrote it with the verbatim
baseline and F3 was re-applied from the directive's fully-specified list —
nothing unique was lost (no APFS snapshot/backup existed; noted for the
record).

**F6 pre-check:** the verdict line is intact
(`` `[Milestone1F] acceptance ${all ? 'PASSED' : 'FAILED'}` `` — canon 2153).
Damage-family pre-scan: zero backtick+`{` fingerprints; ONE family-A
cosmetic instance found later in R2's detail string (routed as D-1 below).

## 2. F3 expanded + F21 applications (all matched the described form — no STOP)

- **F3a** — dead `slopeDegAt` stub + `void slopeDegAt;` deleted (was canon
  1015–1025 + 1033).
- **F3c** — `terrainNormalInto` added to the top-level terrainField import;
  the `require()` shim inside `slopeFromNormal` deleted (F1/F2 pattern; F1
  was vacuous in 1E, this one was real — `require(` appeared exactly once).
- **F3b+F21a** — `lastRebaseCount: 0` added to the `live` literal; the
  LIVE-phase trace push now stores CAMERA-RELATIVE offsets
  (`stagedP − drvLocal`) + `rebased: core.stats.rebaseCount !==
  live.lastRebaseCount`, then updates the counter; BOTH vestigial blocks
  deleted (the `extends never ? 0 : 0` vacuous conditional and the
  self-assigning `const st = …` block); bound `sunJump < 0.02` → `< 0.05`;
  detail wording replaced per the directive (with one micro-edit flagged:
  "world position" → "camera-relative position" so the sentence describes
  the measured quantity).
- **F21b** — arithmetic FIRST from extracted constants: `ts = 6` (LIVE only)
  with MAX_SUBSTEPS 5 → both `kcc.update(dt·6, 5)` and `core.advance(dt·6)`
  run exactly 5 ticks/frame in lockstep → effective 5×; LIVE_SECONDS 25 →
  125 s sim; sprint 6.5 m/s → ~810 m ideal ⇒ ~1 rebase crossing vs the
  row's `rebases >= 3` — **< 3 confirmed → calibration applied**:
  LIVE_SECONDS 25 → 120 (600 s sim), criterion `rebases >= 3` → `>= 2`
  with the directive's detail text, Playwright budget 150 s → 240 s.
  (The ideal-sprint premise itself turned out to be terrain-infeasible —
  F25 below.)

## 3. §6 strict-TS/build fixes (type-level, runtime-neutral; logged #44)

tsc found 5 errors → TSC_EXIT=0 after: (a) import list `rigCamFar` →
`rigCamNear` (the directive's known-suspect, confirmed: sole usage is the
R4 canary; `rigCamFar` was imported and never used); (b) `moonState` TS18047
×3 → `!` assertions (boot guard throws on null at module scope; TS cannot
carry the narrowing into `applyRenderState`); (c) the dead 3-arg
`setDriverPose(...)` call deleted (TS2554 — immediately overwritten by the
full 7-arg call; F4 leftover-line pattern); (d) `astroMesh.geometry` TS2339
→ runtime-neutral cast `(astroMesh as unknown as { geometry?: unknown })`
applied ONLY to unblock the build — the asserted expression and its runtime
value (`undefined` — Group has no `.geometry`) are untouched, so the row
fails on the true value; routed as F24. BUILD_EXIT=0; 1F harness emitted as
its own 48.15 kB chunk (`Milestone1F_TestHarness-BxLi97fs.js`).

## 4. Gate output — VERBATIM (single serial run, six pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 28.3 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=52965 parentVerts=9588 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
[m1d gate] acceptance line: [Milestone1D] acceptance PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=49 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1e gate] acceptance line: [Milestone1E] acceptance PASSED
[m1e gate] badges: ["PASS","PASS","PASS","PASS","PASS","PASS"]
[m1f gate] acceptance line: [Milestone1F] acceptance FAILED
[m1f gate] badges: ["PASS","FAIL","FAIL","FAIL","FAIL"]

  1 failed
    e2e/m1f.spec.ts:9:1 › M1F — 3-Camera Layers & Sky Impostors acceptance (2.1m)
  5 passed (3.9m)
```

PLAYWRIGHT_EXIT=1 (the 1F row only; regression 1A–1E fully green). 1F suite
wall time 2.1 m — inside the F21b 240 s budget.

### Per-row details (verbatim DOM scrape)

- **depth-compositing PASS** — `Pair audit (gap vs δ(z) of the assigned
  pass): probeA/probeB @233 km 2.5 km gap, ratio 1,556 · Earth vs horizon
  terrain (Mid) 30.0 km gap, ratio 1,000,000,000 · boots/ground @1.7 m
  (Near) 20 mm gap, ratio 11,611. Layered minimum 1,556× (>10 required).
  Single-camera counterfactual (n=0.01, f=1e7): the probe pair fuses (ratio
  0.0077 < 1 — per-pixel depth lottery at the handoff range; Earth/horizon
  degrades to 3.3×). Frozen-frame determinism: 0 differing bytes across two
  identical renders.` (All within the §4 sanity targets.)
- **impostor-angular FAIL** — `8 live instances: rendered disk θ vs Float64
  truth max err 0.0e+0 rad (law: s = D·tan θ, staged D ≤ 9,600 m, one
  f64→f32 narrowing); staged positions exact to 0.0e+0 m. Sun ground truth
  (1280×720 readback): disk footprint 0 px vs ideal π·r² = {(coverage *
  100).toFixed(1)}%, tol ±15%); center offset 999.00 px vs the independent
  f64 projection (tol 1.5 px). r = 21.0 px from θ = 2.006°.`
- **handoff FAIL** — `Unit sweep (20 round trips, 500 m steps): 21 state
  flips (40 = exactly one per crossing — no thrash), 0 hole frames, 0
  double-full frames, fade slope ≤ 0.14/km (continuous). Hysteresis band
  [220, 240 km] strictly contains the fade window [225, 236 km] — threshold
  oscillation can never modulate a partially-faded representation. Live
  sweep trace: 7199 frames, 0 holes, crossed both fade edges. Silhouette
  A/B at 232 km (mesh-only vs impostor-only renders): edge symmetric
  difference 0.00% of the 8-px disk (< 3% — sub-pixel alignment; 96-seg
  mesh chord error ≈ 0.008 px).`
- **zero-gc FAIL** — `3,000 iterations of the pure frame path (assignment +
  impostor staging + anchors): heap Δ 0 B (limit 256 KB — expected ~0; all
  math in module scratch, no new THREE.Vector3/Matrix4/Quaternion anywhere
  in the path). 300 full 3-pass renders: heap Δ 0 B (limit 4 MB; includes
  three.js internal render allocations — the acknowledged boundary, as
  M1C's structured-clone envelopes). Boot-object identities preserved
  (canary: pool mesh/attributes/bodies, cameras, scene meshes). React
  re-renders during flight: 0 (mutation+version store at ≤10 Hz; the rig
  component renders null).`
- **m1a-integration FAIL** — `0 origin shifts during the live walk (each
  rebase is an independent Δ-lattice + sky-invariance sample; 1D's cruise
  row already carries the 8-rebase lattice evidence; every Δ an exact
  multiple of 256 — the power-of-two lattice proof; f32 locals max 227 m ≤
  1,024); GL geometries constant at 0. Background rebase-invariance: the
  Sun instance's camera-relative position moved ≤ 0.0 mm across every
  rebase frame — indistinguishable from normal per-frame apparent parallax
  (~12 mm/frame at D=9,600 m, d_sun≈600 km); the origin jump itself (Δ up
  to 1,024 m in absolute local coords) never reaches the sky. Straddler A/B
  at the 2,400 m boundary (Sat B: d_n ≈ 2,374, d_f ≈ 2,426; renders: auto /
  forced-Near-only / forced-Mid-only): 0 and 0 differing bytes of 3686400 —
  identically zero, the Spec-05 pixel-difference demand proven at the layer
  threshold.`

HUD at scrape: 60 FPS · passes FAR 3/MID 0/NEAR 0 (stale straddle-pose
stats — see §6) · depth-clears 15,368 · objects 96/3/0 · impostors 4 ·
Earth θ 7.39°/155 px, elev 23.4°/100% · Sun θ 2.00° · probe 302.9 km
IMPOSTOR · origin 512/0/1280 · rebases 1 · max local 227 m · chunks 94/0 ·
geometries 107 · heap 14.8 MB · SEQUENCE DONE.

## 5. ROOT-CAUSE ROUTINGS (nothing touched; awaiting Lead ruling)

All four failures are authorial canon defects in the harness, proven by a
Node replication (`game/tools/diag-m1f-core.mjs` — boot, spawn scan, walk,
cull arithmetic verbatim) plus a live browser probe
(`game/tools/diag-m1f-browser.mjs` — rig module singletons in the settled
page).

### F22 (R2) — horizon-cull "up" is the local-bubble direction, not the radial direction

`applyRenderState` culls a catalog body when
`elevationAngle(bodyDir, px/|p|, py/|p|, pz/|p|) < −(θ + 0.03 rad)` where
`(px,py,pz)` is the driver LOCAL. But local = absPos − O with
|O| ≈ 1,378 m (the 256-lattice origin, comparable to R = 1,364.5) — so
normalize(local) bears no relation to the true horizon up
normalize(O + local). Node-proven at the suite-time pose
(local = (227.0, −35.3, −160.2), |local| = 280.1, O = (512, 0, 1280)):

```
harness up = (0.810, −0.126, −0.572) vs true radial = (0.551, −0.026, 0.834) — 91.6° apart
SUN: harness-elev = −68.9° (true +21.7°), θ = 2.00°  → CULLED
Venus/Mars/Jupiter/Pluto wrongly CULLED (true elev +40.5/+75.5/+26.9/+45.6)
Uranus wrongly ACTIVE (true elev −43.8)   → 2 of 9 catalog bodies active
```

The Sun being culled is exactly R2's failure: the sun-pose A/B render drew
no sun → footprint 0 px, center 999. Cross-checks: HUD "4 instances" = the
surviving catalog bodies + 2 probes; the same defect is already 99.5° off
at spawn (local (−70.3, −49.1, 7.3)); the harness's own TELEMETRY Earth
elevation (+23.4° in the HUD) uses the correct radial (kcc.absPos) — two
inconsistent code paths in one file. **Proposed fix (Lead's call):** up =
normalize(O + local) — `const o = core.getOrigin()` is already read later
in the same function for Earth/probe mesh positioning; hoist it above the
cull. Verdict-relevant for R2 (sun footprint/center clauses) and cosmetic
elsewhere.

### F23 (R3) — unit-sweep calibration: two unreachable clauses (static arithmetic)

- **flips**: the sweep performs 20 trips = 10 round trips = 20 threshold
  crossings, plus exactly one initial-state correction (mesh initialized
  `true` at d = 300 km — already beyond the 240 km hard threshold → flips
  at the first sample). Total = **21, deterministic**; observed 21. The
  criterion `flips === 40` (and the verification table's "40 flips / 20
  round trips") is unreachable as written: the loop needs 40 trips (20
  round trips) with a consistent initial state, or the criterion needs to
  be 21.
- **maxSlope**: the fade is a smoothstep over the 11 km window [225k, 236k]
  → max derivative = 1.5/11,000 = **1.364e-4 per metre**; the bound
  0.00011 is below the true max slope of the canon fade function itself
  (observed 0.00014, printed "0.14/km"). The bound must be ≥ 1.4e-4 (e.g.
  1.5e-4) or the window widened.

All other R3 clauses passed (0 holes, 0 doubles, live trace 7,199 frames
crossing both fade edges, silhouette sym-diff 0.00%).

### F24 (R4) — identityOk reads a nonexistent property (structurally false)

`astroMesh.geometry !== undefined` where astroMesh is a `THREE.Group` —
Groups have no `.geometry`; the canary is false at runtime regardless of
identity health (the F9/F10a class; flagged at typecheck time and routed in
advance in CHANGES #44). Everything real in R4 PASSED: heap Δ **0 B** over
3,000 pure-path iterations AND **0 B** over 300 three-pass renders; the
`§6` cast preserved the runtime value so the row fails truthfully.
**Proposed:** assert a real identity — e.g. `astroMesh.children.length === 8`
(torso/helmet/visor/pack/2 legs/2 arms) or
`astroMesh.children[0].geometry !== undefined`.

### F25 (R5-rebases) — the scripted walk cannot reach a rebase crossing: the terrain ahead is a mountain wall

F21b's arithmetic (600 s sim × sprint 6.5 ≈ 3.9 km) assumed clear ground.
Node-proven: the terrain profile along walkFwd is 68° at 200 m, 78° at
1,200–1,400 m (probe table in §6); the autopilot slogs — 625 m path / 347 m
net over the full 600 s sim (~1 m/s net, v 2–4 m/s, slopeAhead 20–56°) —
the same wall-grind as 1E's uphill-sprint row. Bubble locals peak at
227 m ≪ 1,024 → **0 crossings** (`rebases 0 < 2`). Extending LIVE_SECONDS
further is unbounded without knowing what lies past the wall. Options for
the Lead: redirect the walk (target/direction — SAT_B sits across the
wall), a measured sufficient LIVE_SECONDS (I can extend the Node walk to
measure), or another route of the Lead's design. Spawn scan itself WORKED
(site found, slope 0.412°, params verbatim in the probe: seed 0x7f1a,
24,000 tries, jitter 0.02–0.12, score = slope·40 + dev, break < 0.35) —
not a scan failure, so 5.c does not bind; this is a walk-target
calibration question. Note: F21a's camera-relative sun-trace is live but
unsampled (no rebase frames occurred — sunJump 0.0 mm is vacuous until F25
produces crossings).

### F26 (R5-geo) — geometry-constancy window opens before the first render

The metrics block reads `gl.info.memory.geometries` inside onFrame, which
runs BEFORE executePasses in the same frame — the first WARMUP read is 0
(nothing rendered yet), and pool streaming grows the count during WARMUP →
geoMin = 0 (poisoned), geoMax = 107 (HUD shows 107 stable thereafter) →
`geoConst` false, printed "constant at 0". The F12-class measurement
defect (window timing, not a mid-window registration step). **Proposed
(F20-window-reset shape):** reset geoMin/geoMax at the WARMUP→LIVE
transition — the same block that already resets rebases0/sunTrace/
probeTrace — so constancy is measured over LIVE+DONE where the count is
genuinely constant.

### Routed cosmetics (standing damage protocol)

- **D-1 (family A, R2 detail string, canon 1966):** `vs ideal π·r² =
  {(coverage * 100).toFixed(1)}%` is missing `$` before `{(coverage…}` —
  syntactically valid, verdict-neutral (coverage is asserted in the pass
  clause; only the printed % is broken). New instance → stop-and-route per
  the standing protocol (1E L1015 precedent — one-character restoration on
  authorization). Not caught by the backtick+`{` pre-scan because the
  backtick sits far upstream in the same template literal.
- **D-2 (R2 detail, cosmetic):** unmatched paren `tol ±15%);` in the same
  string (authorial editing artifact; display-only).

### Observations (no change requested)

- **O-1 (R3 silhouette, PASSED but weak):** the mesh-only/impostor-only
  window found only **8 disk pixels** above threshold (expected disk ≈ 68
  px at r ≈ 4.7 px) — the probe direction ("away from Earth and Sun")
  presents a mostly-unlit disk, so the red>45 gate catches a sliver. sym
  -diff 0.00% is real but sampled on 8 px.
- **O-2 (R2 audit breadth):** the per-instance audit intends rank→body
  matching but as written scans bodies[] in slot order and breaks at the
  first active body — one body audited once per rank ("8 live instances" ≈
  one body × mesh.count). Its numbers (θ err 0.0e+0, positions exact) are
  still correct for the body sampled.
- **O-3 (V8/Node walk divergence):** the browser's end-of-walk local
  direction differs slightly from Node's (36,000 ticks of ulp compounding —
  the 1E cliff-row precedent), moving individual bodies across the razor
  -edge (wrong-up) cull boundary: Node ends with 2 catalog active, the
  browser with ~6. The SUN is culled decisively in both (−68.9° vs a −3.7°
  threshold; 0-px readback confirms in-browser). Immaterial once F22 lands
  (the true-up cull boundary is 60°+ away from every body).

## 6. Probe evidence

**Node (`tools/diag-m1f-core.mjs`, verbatim boot/walk/cull replication):**
rails earthDist 38.8 km, sunDist 572.0 km, angle(earth,sun) 134.88° · spawn
slope 0.412°, h −2.31 m · WARMUP 3.5 s → 1 rebase (spawn), locals ≤ 75.3 ·
post-WARMUP cull audit: harness-up 99.5° off true radial (6/9 active,
Mars/Neptune wrongly culled, Saturn wrongly active) · LIVE (120 s wall,
600 s sim): **0 rebases, max bubble-local component 227.0 m, 625.1 m
walked, 346.9 m net** · post-LIVE audit: up 91.6° off, SUN −68.9° → CULLED,
2/9 active · terrain profile along walkFwd: `0 m 0.4° · 200 m 68.4° ·
400 m 69.6° · 600 m 20.8° · 800 m 42.0° · 1000 m 65.5° · 1200 m 78.0° ·
1400 m 78.7° · 1600 m 13.7° · 1800 m 63.1° · 2000 m 67.0° · 2200 m 51.3° ·
2400 m 30.9° · 2600 m 14.9°`.

**Browser (`tools/diag-m1f-browser.mjs`, settled page):** driver pose
finite (no NaN) · all three rig cameras healthy — no NaN in
projection/matrix, aspect 1.7778, proj[0][0] 0.9362 / proj[1][1] 1.6643,
layers masks 1/2/4, a point 5 m dead-ahead projects dead-center · live
per-frame stats (6 samples): **far = 3, mid = 0, near = 33** draw calls,
passRenders incrementing steadily · canvas 1280×720. Conclusion: the 3-pass
renderer is healthy; the HUD's "3/0/0" at gate-scrape time was stale stats
from the suite's final straddler A/B pose (mid = 0 live is legitimate —
Earth out of frame, satB/satC outside the boom camera's fov), and **the
R1 determinism pass and the R5 straddler byte-zero diffs are real proofs,
not vacuous** (the near pass demonstrably draws 33 objects; the straddle
pose renders drew satB in both forced-Near and forced-Mid).

## 7. Changes & commits

CHANGES.md #42–#46 (extraction + drift repair; F3/F21 applications; §6
strict-TS fixes; page wiring; this routing — no code change). Commits this
milestone: 5a17673 (steps 1–4 + report scaffolding) · this commit (gate
result, probes, report, ledgers). Canon untouched throughout; every
typecheck/build/gate exit observed unpiped (TSC_EXIT=0, BUILD_EXIT=0,
PLAYWRIGHT_EXIT=1 on the 1F row only). Diagnostic probes
(diag-m1f-core.mjs, diag-m1f-browser.mjs) committed alongside — read-only
observation tools on the established diag pattern (user pre-authorization
2026-10-15 for committing diag tooling).

## 8. Lead eyeball (optional, once rows pass)

`npm run dev` → `?page=m1f`: the Earthrise composition (Earth 14.8° wide,
23.4° above the lunar horizon — currently correct only in the TELEMETRY
path; the cull itself awaits F22), Jupiter banded, the probe crossfade
every 48 s, the straddler satellite crossing 2,400 m with zero visual
change, and DEPTH-CLEAR TRIGGERS ticking at exactly 2/frame.

## 9. LEAD RULING ROUND — F22–F26 + D-1/D-2 applied (2026-10-16), second gate, three new routes

All seven authorized items applied EXACTLY as ruled: **F22** (origin hoisted
to the top of applyRenderState — single declaration; cull up = absolute
radial `normalize(O + local)` in the sky-bodies loop, nothing else changed)
· **F23** (`flips === 21` + the deterministic-flips detail clause;
`maxSlope <= 0.00015`) · **F24** (`astroMesh.children.length === 8`; other
two canary terms unchanged) · **F25** (the canon walkFwd IIFE replaced by
the 24-azimuth × {25,50,100,200,400,600,800 m} corridor scan, score = max
slope, tie-break max |Δh|; SAT_A/B/C formulas unchanged after it;
LIVE_SECONDS untouched) · **F26** (`geoMin/geoMax` reset at the WARMUP→LIVE
transition; geo capture condition LIVE-only) · **D-1/D-2** (`$` restored +
paren repaired in R2's detail). TSC_EXIT=0 BUILD_EXIT=0, both unpiped.

### 9.1 Node verification FIRST (ruling 8b — diag-m1f-core.mjs)

- **F22 VINDICATED (live path)**: post-WARMUP audit — Sun elev **+36.2° →
  ACTIVE**, 7/9 catalog active (Saturn −25.6°, Uranus −58.3° correctly
  culled); suite-pose audit — Sun **+47.7° ACTIVE**, ideal footprint
  **π·21.0² ≈ 1,381 px**. Exactly the ruling's expectation.
- **F25 corridor scan**: best 5 of 24 azimuths — **az 330°: 42.2°** · az
  195°: 54.4° · az 135°: 56.2° · az 285°: 60.9° · az 120°: 61.9°. SELECTED
  az 330° at **42.2° > the 40° gate → MEASURE branch**: 600 s sim walk on
  the corridor → **0 crossings** (1,321 m path, 478 m net, max bubble-local
  component **686.1** < 1,024; the corridor is clean to ~1.2 km then hits
  69.7°/72.7° walls — SAT_B at 2,400+400 m lies beyond the scanned
  horizon). Per the ruling's own conditional: **STOP and route — no
  self-calibration** (route F25c below).

### 9.2 Second browser gate — verbatim

```
[m1a] PASSED — ["PASS","PASS","PASS","PASS","PASS"]
[m1b] PASSED in 19.8 ms — ["PASS","PASS","PASS","PASS","PASS"]
[m1c] PASSED — geo=145 … — ["PASS","PASS","PASS","PASS"]
[m1d] PASSED — v@1000m=264.7 maxDv=10.30 rebases=8 geo=151 — ["PASS","PASS","PASS","PASS","PASS"]
[m1e] PASSED — ["PASS","PASS","PASS","PASS","PASS","PASS"]
[m1f] acceptance line: [Milestone1F] acceptance FAILED
[m1f] badges: ["PASS","FAIL","PASS","FAIL","FAIL"]
  1 failed · 5 passed (3.9m)          PLAYWRIGHT_EXIT=1 (1F row only)
```

- **R3 PASS (F23 VINDICATED)**: `21 state flips (21 = 20 threshold
  crossings + 1 initial-state correction — deterministic, no thrash), 0
  hole frames, 0 double-full frames, fade slope ≤ 0.14/km (≤ 0.15)… Live
  sweep trace: 7201 frames, 0 holes, crossed both fade edges. Silhouette
  A/B … 0.00% of the 8-px disk` — flips/slope/holes/live clauses all REAL;
  the silhouette sub-clause is vacuous-quality until F27 (window scanned
  the wrong screen region — see below).
- **R2 FAIL, failure mode CHANGED**: `9 live instances` (7 catalog + 2
  probes — the cull fix is live), θ err 0.0e+0, positions exact, D-1 now
  prints `π·r² = 0.0%` correctly — but `disk footprint 0 px … center
  offset 999.00 px … r = 21.0 px from θ = 2.008°`. The Sun is ACTIVE yet
  the readback window (±2r ≈ ±42 px) found nothing → F27.
- **R4 FAIL**: heaps 0 B / 0 B, `children.length === 8` true — fails solely
  on the second term `sky.bodies.length === 11` → F28.
- **R5 FAIL**: `0 origin shifts (< 2)` — F25c; `f32 locals max 687 m ≤
  1,024` ✓ (Node said 686.1 — browser/Node agree); **`GL geometries
  constant at 49`** — F26 VINDICATED (LIVE-only window, constant > 0);
  straddler A/B 0/0 bytes (determinism real; aim quality pending F27).

### 9.3 NEW ROUTES (round 2 — awaiting Lead ruling)

**F27 — lookAt convention mismatch (+Z/X-frame quat vs −Z camera
convention).** PROVEN against the REAL modules (`tools/diag-m1f-r2.mjs`):

```
sun-pose quat = (0.0000, 0.8864, 0.0000, -0.4629)
sun projection: px=0.0 py=0.0 behind=true      (expect ~640/~360!)
  dir +0.5deg yaw -> px=69294.7 …              (target near camera-local X)
probe-pose projection: px=0.0 py=0.0 behind=true
PROPOSED FIX (quatFromFrameInto(right, up)):
  sun projection: px=640.00 py=360.00 behind=false
  probe projection: px=640.00 py=360.00 behind=false
```

Root cause: `quatFromFrameInto` (sphericalFrame:113–123) builds its matrix
with **columns (fwd, up, fwd×up)** — the frame's **+X is the forward**. The
harness-local `lookAtQuatInto` passes (fwd, cameraUp) into it, so every
pose it builds (R2 sun pose, R3 silhouette pose, R5 straddle pose, and the
live TP boom camera in computeDriverPose) is a quat whose local +X points
at the target — a three.js camera with that quaternion looks along its
local −Z = −(fwd×up), i.e. ~90° AWAY from the target. Meanwhile
`projectDirectionInto` (impostorMath, used as the R2/R3 ground truth)
documents and implements the standard **−Z** convention. The Sun renders —
on the opposite side of the frame from the ±42 px window. Consequences: R2
footprint/center clauses blocked; R3's silhouette window sampled a corner
(the 8 "disk" px are stars — clause vacuous until fixed); R5's straddle
renders likely never framed satB (byte-zero diffs remain valid as
determinism, but the Spec-05 layer-threshold proof is weak until aimed);
the live boom camera faces ~90° from the astronaut (cosmetic — Lead
eyeball). **Proposed (verified in Node, one line, harness-local —
sphericalFrame untouched):** in `lookAtQuatInto`, call
`quatFromFrameInto(rx, ry, rz, upx, upy, upz, out)` (RIGHT instead of
fwd) — columns become (right, up, right×up=back), local −Z = fwd; both test
poses then project dead-center.

**F28 — identityOk's second term is structurally false.**
`sky.bodies.length === 11` — but `SkyImpostorPool` boot-allocates the
FULL capacity-24 slot array (`bodies.length === IMPOSTOR_CAPACITY` always);
the author's 11 was the expected ACTIVE count (9 catalog + 2 probes —
canon's own verification table says "11+ instances"), and the actual active
count at suite time is **9** (7 catalog above the corrected horizon + 2
probes — exactly R2's "9 live instances"). R4 now fails solely on this
term (heaps 0/0, `children.length === 8` true). The ruling's F24 fixed the
geometry term and (correctly) left the others — this one is also broken.
**Proposed:** `sky.bodies.length === 24` (the boot-allocated pool IS the
identity being canaried) — or an active-count check if the Lead prefers
semantics; Lead's call.

**F25c — corridor gate failed; routed per the ruling's own conditional.**
Best corridor az 330° at 42.2° > 40° → Node-measured 600 s sim: **0
crossings** (max bubble component 686.1 < 1,024; 1,321 m path / 478 m net;
69.7°/72.7° walls beyond 1.2 km on the corridor; SAT_B at 2.8 km lies
across them). Per item 4c: STOP and route, no LIVE_SECONDS self-calibration.
The scan itself worked exactly as designed (clean corridor to 800 m found
at the first azimuth tried); the structural gap is that the 800 m scan
horizon cannot see the wall at 1.2–1.6 km, and every azimuth's far field
is mountainous (next-best already 54.4°). Options for the Lead: widen the
scan arcs (e.g. to 2,600 m) so the selection optimizes the FULL walk;
retarget SAT_B; accept `rebases >= 1`; or another design. Note R5's
sunJump clause stays vacuous until crossings exist (F21a's measurement is
live and waiting).

### 9.4 Vindication ledger (this round)

F22 live-path ✓ (9 instances; Sun +47.7° ACTIVE; R2's audit clauses all
green) · F23 ✓ (R3 PASS on the real clauses) · F24 term ✓ (R4's remaining
failure is F28's, not F24's) · F26 ✓ (geometries constant at 49) · D-1/D-2
✓ (detail prints correctly) · O-1/O-2 recorded as accepted (O-1's 8-px
window now further explained by F27).

## Status

**GATE FAILED (round 2) · ROUTED (F27, F28, F25c) · AWAITING LEAD RULING
(§8.7).** Round-1 routes F22–F26 + D-1/D-2 applied and live-path vindicated
(R1, R3 green; F26 proven). On the next ruling: apply, re-run the 1F gate +
full 1A–1E regression, update this report, commit + push, stop at the
approval gate.

---

# 10. ROUND 3 — F27/F28/F25d applied (2026-10-17), third gate, vindications + two new routes + one environment-soft regression note

The round-2→3 ruling applied EXACTLY as written, all three items
harness-local: **F27** (lookAtQuatInto only:
`quatFromFrameInto(fx,fy,fz,…)` → `quatFromFrameInto(rx,ry,rz,upx,upy,upz,out)`
+ the one-line comment; sphericalFrame, projectDirectionInto, all four call
sites, every threshold untouched) · **F28** (identityOk second term only:
`sky.bodies.length === 11` → `=== IMPOSTOR_CAPACITY`, imported from the
existing SkyImpostorPool module — no literal 24; other canary terms and both
heap bounds untouched) · **F25d** (the walkFwd IIFE ARCS widened to 16 arcs
reaching 2,600 m + the F25 comment updated to "flattest 2,600 m corridor
(F25d — covers the full walk to SAT_B at 2,400 m + margin)"; the identical
ARCS change mirrored in game/tools/diag-m1f-core.mjs; the 24 azimuths,
max-slope score, |Δh| tie-break, SAT formulas, spawn scan, LIVE_SECONDS,
rebases >= 2, the 40° gate and every R5 term untouched) · **B-1** (STATE.md
1F ledger row reads 0b2fae8 as committed; ANCHOR df1e04f → 0b2fae8;
Approval Ledger rows F27/F28 APPROVED, F25c ESCALATED → user option A,
F25d APPROVED). Commits a6de872 (edits), 74875e5 (B-1), 1c8a2b8/1d76fd0
(probes), 9627eee (CHANGES 51–55).

## 10.1 Typecheck + build (unpiped)

TSC_EXIT=0 · BUILD_EXIT=0. (Fresh session: node_modules was absent;
restored with `npm ci` from the pinned lockfile — environment setup only.
A stray `npx` from the repo ROOT once fetched standalone playwright@1.64.1
and errored "two different versions of @playwright/test"; re-run from
game/ used the pinned project install — no project file changed.)

## 10.2 Node checks FIRST (ruling 4b)

**Poses through the REAL edited harness function** — diag-m1f-r2.mjs was
rewritten to extract lookAtQuatInto VERBATIM from the harness source at
runtime (brace-matched slice written to a self-cleaning temp .ts loaded
through the registered TS loader — no local copy can drift), then run
against the real sphericalFrame + impostorMath modules inside a verbatim
boot/WARMUP/LIVE replica (the suite-time driver pose and sun geometry are
the real end-of-walk values):

| Pose | px | py | behind | centre offset |
|---|---|---|---|---|
| TP boom (astronaut) | 640.00 | 360.00 | false | 0.000 px |
| R2 Sun | 640.00 | 360.00 | false | 0.000 px |
| R3 silhouette (probe) | 640.00 | 360.00 | false | 0.000 px |
| R5 straddle (SAT_B) | 640.00 | 360.00 | false | 0.000 px |

**F27 VERIFIED in Node** — every suite pose now aims its target
dead-center under projectDirectionInto's −Z convention (round 2:
behind=true, px=py=0). Sun disk at suite time: θ=2.004° → r=20.95 px
(pxPerRad=599.14), ideal footprint π·r²=1,379 px (round-2 measured 1,381),
readback window ±2r ≈ ±42 px.

**Corridor + sim (diag-m1f-core.mjs with the F25d ARCS):**

- Best 5 of 24 azimuths: **az 345°: 67.5°** · az 270°: 71.0° · az 255°:
  71.2° · az 120°: 71.4° · az 150°: 71.6°.
- SELECTED az 345°, max slope **67.5° > 40° gate → MEASURE branch**.
- 600 s sim on the selected corridor (120 wall s × 5× effective): **0
  crossings** in the first 120 sim s and over the full 600 sim s; max
  bubble-local component **371.8 m** ≤ 1,024; path 934.5 m; net
  displacement 118.8 m.
- SAT_B from spawn: 2,433.1 m, bearing 9.46° off the walkFwd tangent.
- Straight line spawn → SAT_B: arc 1,279 m, max slope along it **80.6°**
  (worst at ~863 m from spawn).
- **F25d branch: (iii)** — the slope exceeds 40° AND the sim shows 0
  crossings (< 2) within LIVE_SECONDS. Per the ruling: the F25d edit stays
  committed, the gate and regression were still run (F27/F28 needed
  browser verification), and the corridor result is routed as **F25e**
  below. SAT_B, LIVE_SECONDS, rebases and the gate were NOT touched.

## 10.3 Third browser gate — verbatim

```
[m1f] acceptance line: [Milestone1F] acceptance FAILED
[m1f] badges: ["PASS","PASS","FAIL","PASS","FAIL"]
  ✘ M1F — 3-Camera Layers & Sky Impostors acceptance (2.3m)  PLAYWRIGHT_EXIT=1
```

Per-row (verbatim DOM scrape, tools/diag-m1f-details.mjs):

- **R1 PASS** — pair audit 1,556× / 1e9× / 11,611× (min 1,556× > 10);
  single-camera counterfactual 0.0077 (fused); frozen determinism 0
  differing bytes.
- **R2 PASS — F27 VINDICATED**: `9 live instances: rendered disk θ vs
  Float64 truth max err 0.0e+0 rad … Sun ground truth (1280×720 readback):
  disk footprint 1,460 px vs ideal π·r² = 105.5%, (tol ±15%); center
  offset 0.71 px vs the independent f64 projection (tol 1.5 px). r = 21.0
  px from θ = 2.007°.` The Sun is IN the window and centered (round 2:
  0 px / 999 px offset).
- **R3 FAIL — first failure of the silhouette sub-clause WITH real
  content**: unit sweep 21 flips (deterministic), 0 holes, 0 doubles, fade
  slope ≤ 0.14/km, live trace 1,603 frames 0 holes crossed both fade
  edges — all green. `Silhouette A/B at 232 km (mesh-only vs impostor-only
  renders): edge symmetric difference 47.69% of the 130-px disk (< 3%…)`.
  The window now contains the actual probe disk (130 px; round 2: 8
  corner-star px) — F27 made the clause real, and it fails on alignment.
  → **F29** below.
- **R4 PASS — F28 VINDICATED**: heaps 0 B / 0 B, all canary terms true
  (`bodies.length === IMPOSTOR_CAPACITY` = 24, children === 8).
- **R5 FAIL — origin shifts 0 (< 2) as expected under F25d(iii)**, plus a
  NEW fact: `Straddler A/B … 0 and 500 differing bytes` — diffNear = 0 ✓
  but **diffMid = 500** (round 2: 0/0 with the camera aimed 90° away).
  locals max 372 ≤ 1,024 ✓; geometries constant at 54 ✓; sunJump 0.0 mm
  (vacuous — 0 crossings, so the clause is NOT non-vacuous as the ruling
  hoped); "every Δ an exact multiple of 256" vacuously true (no shifts).
  → **F29** below (the 500-byte fact) and **F25e** (the 0 shifts).

## 10.4 NEW ROUTES (round 3 — awaiting Lead ruling)

**F25e — the 2,600 m corridor is WORSE than the 800 m one; branch (iii).
** With the full-walk horizon the scan now sees what the 800 m scan could
not: every azimuth's far field is mountainous. Best corridor az 345° at
67.5° (the round-2 42.2° was a short-horizon artifact — az 330° runs into
the 69.7°/72.7° walls it could not see). The measured 600 s walk on az
345°: 0 crossings, locals 371.8 m, 934.5 m path, 118.8 m net — the KCC
crawls against 48–68° walls (the straight line to SAT_B itself is 80.6°
at its worst). The 40° gate cannot be met by ANY azimuth at this spawn,
so no selection-input change can produce ≥ 2 crossings within
LIVE_SECONDS=120. Options for the Lead (unchanged set, now with
full-horizon numbers): retarget SAT_B; accept rebases >= 1 (canon sets ≥3
— the F21b round already lowered the row to 2); lengthen LIVE_SECONDS
(gate infrastructure); or another design. Nothing was changed — the F25d
edit stays as ruled.

**F29 — the aimed renders are real now, and the two sub-pixel A/B clauses
fail on real geometry.** F27 fixed the aim; the windows now contain the
objects they were authored to measure, and two alignment assumptions that
were vacuously true break:

1. **R3 silhouette (47.69% sym-diff of a 130-px disk, < 3% required).**
   Node math on the same walk replica: the probe MESH is positioned
   bubble-center-relative at PROBE_DIR·232,000, while the impostor is
   staged along the FIXED PROBE_DIR from the OBSERVER. The suite-time
   observer sits 1,348.8 m from the bubble center, so the mesh's true
   apparent direction differs from PROBE_DIR by parallax: the mesh centre
   projects at px=(637.09, 360.61) vs the impostor centre at (640.00,
   360.00) — a **2.97 px offset against disk radii of 4.63/4.65 px (64%
   of a disk radius)**. The author's sub-pixel claim (96-seg chord error
   ≈ 0.008 px) holds only for the silhouette comparison itself; the
   comparison POSE places the eye on the surface, not at the bubble
   center, so the two representations are compared ~3 px apart. The
   browser's 47.69% matches: two ~9-px disks offset by ~3 px share almost
   no edge pixels. (Sizes agree to 0.4% — the angular law is exact; only
   the centre is offset.)
2. **R5 straddler A/B: diffMid = 500 bytes (diffNear = 0).** The straddle
   pose is 23.5 m ABOVE terrain, but the camera→SAT_B ray is **blocked
   mid-path**: worst terrain clearance −4.0 m at 20% along (Node). Pass
   structure explains the asymmetry: the occluding hill is ~487 m from
   the camera — inside the Near band, clipped by the Mid camera's 2,000 m
   near plane. forced-Mid-only shows SAT_B (hill clipped); auto draws the
   hill in the Near pass (which renders LAST) covering SAT_B. Hence
   auto≈forced-Near (0 bytes) and auto≠forced-Mid (500 bytes ≈ 125 px —
   which is also the requested SAT_B framing evidence: the satellite
   RENDERS in the window, dead-centre per the Node pose check, and its
   occlusion footprint is the difference). The Spec-05 byte-zero demand
   at the layer threshold is provable only when the straddle target has
   clear line of sight from the pose; the author's pose (straight line
   from spawn) crosses an 80.6° wall at this spawn.

Note: R5's sunJump clause did NOT fail (0.0 mm, vacuous with 0 crossings)
— the ruling's F29 trigger here is "R3's silhouette clause fails", with
the R5 diffMid fact routed alongside it.

## 10.5 Full regression — verbatim

```
  2 failed
    e2e/m1d.spec.ts:6:1 › M1D — Flight & Aerodynamic Governor acceptance ───────────────────────────
    e2e/m1f.spec.ts:9:1 › M1F — 3-Camera Layers & Sky Impostors acceptance ─────────────────────────
  4 passed (4.3m)
PLAYWRIGHT_EXIT=1
```

- m1a `["PASS","PASS","PASS","PASS","PASS"]` · m1b 5/5 in 22.4 ms ·
  m1c 4/4 (geo=145) · m1e 6/6 — **1A/1B/1C/1E GREEN**.
- m1f FAIL = the gate result above (expected routing).
- **m1d FAILED row 2 (`["PASS","FAIL","PASS","PASS","PASS"]`) —
  environment-soft, NOT a code regression.** Evidence:

  - All 1D-relevant files are byte-identical to the approved commit:
    `git diff e830759..HEAD` over the 1D harness, flightController,
    aerodynamics, atmosphere, SimulationCore, TerrainMeshPool and
    e2e/m1d.spec.ts is EMPTY. Pages are fully isolated (brief §3.2);
    nothing from 1F loads on ?page=m1d.
  - Every printed row-2 number matches the approved gate to the digit:
    v@1000m = 264.7 (≤ 400 ✓), peak 2,000 ✓, maxDv 10.30 (bound 12 ✓),
    rebases 8 ✓, geo 151 ✓, burnHeap 0 B ✓.
  - The failing clause is `script.diveGrounded`: this run the ship never
    touched. Suite detail: `min post-tick AGL 65.57 m; 0 contact events`.
    HUD probe (tools/diag-m1d-dive.mjs): the ship descends the same
    column, skims a ~900 m mountain at 65.57 m, the terrain falls away to
    −44 m, and the 45 s cap fires with the ship still ~386 m AGL at 78
    m/s. Approved run: min AGL 3.38 m, LANDED.
  - Mechanism: the dive integrates `flight.update(dt·4, 6)` per frame
    with dt = REAL frame delta (variable-step), against a wall-scaled
    `simElapsed > 45` cap. The dive profile is therefore FPS-dependent:
    this session the machine renders much slower frames during ReadPixels
    stages (1F live trace 1,603 frames vs 7,201 in round 2 over the same
    120 s; repeated "GPU stall due to ReadPixels" warnings — new Chrome
    install on this host), and the larger frame deltas shift the
    variable-step descent profile by ~60 m at closest approach — enough
    to miss grounding before the cap. Deterministic across two runs
    (full regression + solo re-run, identical numbers 264.7/10.30/65.57).
  - Classification per the M1A row-5 precedent: environment-soft
    machine-dependence of a canon row. NO code changed in response — the
    cap, the integration scheme and the row are canon; §6 forbids
    changing acceptance logic. Routed for a Lead decision (options
    include a re-run on a faster/quieter machine, or a ruling on the
    row's FPS sensitivity).

## 10.6 Vindication ledger (round 3)

F27 ✓✓ (Node: 4/4 poses dead-center through the REAL edited function;
browser: R2 PASS 105.5% coverage, 0.71 px center) · F28 ✓ (browser R4
PASS, heaps 0/0) · F25d ✓ applied as ruled; its conditional resolved to
branch (iii) by the ruling's own Node procedure → F25e · F25's selection
mechanism ✓ (worked exactly as designed, now over the full walk) · D-1/D-2
still green (R2 detail prints correctly) · R3's non-silhouette clauses
remain green (21 flips / 0.14 per km / live trace clean) · R1 green ·
regression 1A/1B/1C/1E green.

## Status

**GATE FAILED (round 3) · ROUTED (F25e, F29) · 1D ENVIRONMENT-SOFT NOTE ·
AWAITING LEAD RULING (§8.7).** F27/F28 vindicated in Node and browser;
F25d applied and resolved to branch (iii) per its own conditional. On the
next ruling: apply, re-run the 1F gate + full 1A–1E regression, update
this report, commit + push, stop at the approval gate. 1G not started.
