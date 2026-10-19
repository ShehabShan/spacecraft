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

---

# 11. ROUND 4 — F30 node-first gate FAILED → F30x routed; F31 applied (R3 improved, routed F32); E-1 ruled (no code change) (2026-10-17)

Round-4 execution order honored: F30's Node gate ran BEFORE any harness
edit, failed its own proceed conditions, and the F30 harness edit was NOT
applied (per the ruling's "Otherwise, STOP after committing the diag, and
route F30x"). F31 and E-1 are unconditional rulings and were executed.
Commits: 5c6336b (F30 diag + route), 20c8a5e (F31 + probe), plus the
report/ledger commits.

## 11.1 F30 — Node-first gate: FAIL → F30x (raw numbers)

diag-m1f-core.mjs was rewritten to mirror corridorFor / spawnEligible /
findSpawn VERBATIM (as they would land in the harness) and report every
ruled number. Findings:

- **Candidates evaluated: 24,000** (the loop never breaks because no
  candidate is eligible). **Eligibility lazily checked: all 24,000** —
  with no eligible candidate, `bestScore` never improves, so the lazy
  condition `score < bestScore` fires for every scored candidate.
- **pass(1) = 0.** Not ONE candidate in the jitter domain has a ≤ 40°
  corridor over 2,600 m. The domain is ±0.02–0.12 rad of direction-space
  jitter around the base — an arc patch of ~±160 m on a 1,364.5 m moon —
  and every direction in it hits > 65° terrain within the corridor
  horizon (the old spawn's own best was 67.5°; its neighbours are the
  same mountains).
- **pass(1)+(2) = 0.** No candidate ever replaces best.
- **Chosen candidate: NONE** (index −1). The harness fallback `best =
  base` would ship: dir (0.42311, 0.00000, 0.90608), local slope 12.3°,
  Earth elevation exactly **15.00°** (the canon intent — the old spawn
  had drifted to 8.67°), but corridor az 150° @ **65.7°** and **LOS
  FAIL** (min margin **−10.6 m at f = 0.025** — the straddle pose itself
  ~10 m underground at that spot).
- **findSpawn boot cost: 32,078 ms** (gate ≤ 2,000 ms; 16× over) — a
  direct consequence of 24,000 lazy predicate calls.
- Sun elevation: post-warmup **+29.9° ACTIVE**, suite pose **−2.9°
  ACTIVE** (above the −(θ+0.03) cull line) — these two gate conditions
  PASS. Fallback walk: 0 crossings in 600 sim s; locals 656.3 ≤ 1,024;
  996.5 m path; 788.2 m net. Angular distance old spawn → fallback:
  6.661°.
- **Gate verdict: FAIL** (eligible-exists ✗, ≥2 crossings ✗, cost ✗;
  locals ✓, Sun-at-both-poses ✓✓).

**F30x route.** The predicates cannot find what the domain does not
contain: within F30's constraints (no jitter widening, no new seed, no
SAT_B retarget, no threshold change) there is NO eligible spawn, so the
harness edit cannot proceed. Raw numbers above. Options that require a
new Lead decision: (a) widen the jitter domain (F30 explicitly forbade
this — needs a new ruling); (b) retarget SAT_B to a point the eligible
set can see; (c) lengthen LIVE_SECONDS (gate infrastructure); (d) accept
the corridor being slow (relax rebases — a gate term, needs a ruling);
(e) keep F30's code shape with a different seed (forbidden within F30).
Note (a)+(b) compose naturally: a wider jitter domain plus the existing
F30 predicates would find a genuinely eligible spawn — the predicates
themselves are sound; the domain is the binding constraint.

## 11.2 F31 — applied and verified; R3 improved but still failing → F32

Exact diff (harness): the probe impostor feed now computes, per probe,
the f64 vector from the camera to the mesh's actual position
(`PROBE_DIR·d − o − pose`), and feeds `dir = v/|v|`, `θ = asin(min(1,
R/|v|))`, `dist = |v|` to sky.setBody; the R3 silhouette block aims the
lookAt at the probe's actual position and centres the window on the same
observer-relative direction. Untouched as ruled: the dA/dB drive, all
hysteresis/alpha/fade paths, the mesh placement, R3 thresholds and the
±80 px window, impostorMath.ts. TSC_EXIT=0, BUILD_EXIT=0 (unpiped).

Node verification (diag-m1f-r2.mjs against the REAL edited harness):
- Four poses dead-center (640.00/360.00, behind=false, 0.000 px) — F27
  intact.
- **F31 alignment: mesh centre (640.00, 360.00) vs impostor centre
  (640.00, 360.00) → offset 0.000 px (gate ≤ 0.25 px)**; both disk
  radii 4.635 px, now computed from the TRUE distance (232,700 m).
- Round-3 record preserved for the ledger: pre-F31 parallax 2.97 px =
  64% of a disk radius.

Browser gate: badges ["PASS","PASS","FAIL","PASS","FAIL"].
- R2 PASS (1,460 px / 105.5%, centre 0.71 px) and R4 PASS (heaps 0/0)
  — F27/F28 still vindicated; F31 did not disturb them.
- **R3: silhouette 47.69% of a 130-px disk → 22.22% of a 90-px disk.**
  F31 fixed the aim (totA dropped 130 → 90: the window now contains just
  the probe disk; centres aligned to 0.000 px) — all other R3 clauses
  stay green (21 flips, 0 holes, 0 doubles, 0.14/km, live trace 1,588
  frames 0 holes crossed both edges) — but sym-diff is still > 3%.
- R5: 0 origin shifts (the F30x consequence) + diffMid 500 → **495**
  (same occlusion, ±5 bytes from the changed probe staging); diffNear 0;
  locals 372; geo constant 54; sunJump 0.0 mm (vacuous).

**F32 route (raw numbers; do-not-patch honored).** The residual
22.22% ≈ 20 differing pixels of a 90-px disk (radius ~4.6 px at 232.7
km, 599.14 px/rad). Decomposition:
1. The suite's A/B target is `samples: 0` (canon); alpha-to-coverage is
   therefore a no-op, so the impostor writes FULL RGB through its ~0.66
   px analytic AA band out to cov ≈ 0.001 — its rendered disk is ~0.33
   px LARGER in radius than the mesh's rasterized silhouette.
2. Hard-edge rasterization phase noise: a 96-gon polygon silhouette vs
   the impostor's analytic shader circle, concentric to < 0.01 px but
   sampled by the same pixel grid at ~29 edge pixels — sub-pixel phase
   alone flips a sizable fraction of them.
3. The brightness threshold (> 45) sits at a shading isophote
   (lam·limb ≈ 0.18) near the limb, where the mesh's interpolated
   per-vertex normals and the impostor's analytic normals disagree by
   ~1 px locally.
The shared angular law is exact (sizes agree to 0.4%, centres 0.000 px);
the clause at this disk size measures rasterization/shading phase noise,
not representation fidelity. Options for the Lead: MSAA on the A/B
target (samples > 0 — harness-local), a larger silhouette fixture
distance (the error fraction scales ~1/radius), a 1-px-dilated
comparison set, or comparing alpha/coverage instead of RGB brightness.
None applied (do-not-patch).

## 11.3 E-1 — m1d environment evidence (no code change, honored)

- The machine HAS a GPU: AMD Radeon Vega (Cezanne, RADV RENOIR),
  /dev/dri present, Mesa radeon Vulkan ICD installed.
- **The pinned playwright config's headless Chrome launches WITHOUT GPU
  args and falls back to SwiftShader** (software): UNMASKED_RENDERER =
  `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)
  (0x0000C0DE)), SwiftShader driver)`; mean FPS on ?page=m1d = **19.8**
  (337 frames). This degrades EVERY frame-time-sensitive row and is the
  root cause of the whole session's slowness (1F live trace 1,588–1,603
  frames vs 7,201 in round 2; 1A row 5's new failure, below).
- **A hardware-accelerated session IS reachable with one launch arg**
  (tested via the diag probe's DIAG_CHROME_ARGS — the config itself was
  NOT touched, per E-1): `--use-angle=vulkan` → UNMASKED_RENDERER =
  `ANGLE (AMD, Vulkan 1.4.318 (AMD Radeon Graphics (RADV RENOIR)
  (0x00001638)), radv)`; mean FPS = **59.8** (506 frames); in that
  session the dive ship GROUNDS before the 45 s cap (dive→cruise at
  ~18.5 sim-s — the approved-run behavior), while under SwiftShader it
  deterministically misses grounding (4/4 runs this session).
- notes/reports/M1D.md records no renderer/FPS figures for the approved
  run — nothing further to compare.
- Full regression under the pinned config: m1d FAILED row 2 again
  (`v@1000m=264.7 maxDv=10.30 rebases=7 recv=43 geo=151 burnHeap=0B`) —
  NOT classified as passed.
- Hardware acceleration is therefore AVAILABLE on this machine but
  UNREACHABLE by the pinned config in headless mode. Exact one-line
  command for the user's machine: `cd
  /home/md-shehab-sarar/Websites/spacecraft/game && npx playwright test`
  — on a machine whose Chrome defaults to hardware WebGL this passes as
  pinned. On THIS machine the config would need a one-line addition
  (e.g. `use: { launchOptions: { args: ['--use-angle=vulkan'] } }`) —
  requiring a Lead authorization since E-1 forbids config edits; NOT
  applied.
- Backlog note recorded in STATE.md (do NOT fix): the 1D dive integrates
  variable frame deltas against a wall-scaled 45 s cap, so it is
  FPS-sensitive; a fixed-step review is deferred to a future milestone,
  Lead's call.

## 11.4 1A row 5 — new environment-soft failure this round (no code change)

The full regression also tripped 1A row 5 (frame-time stability):
`worst 44.20 ms across 148 measured frames; worst rebase-frame 33.80 ms
— origin shifts cost no stutter frame`. The brief itself marks row 5
machine-dependent ("if it alone fails under CI load, report it as
environment-soft with evidence; do not change code to make it pass").
All other 1A rows pass (P.x 10,000.000; locals 1,022.667; 9 rebases; Δ
multiples of 256). SwiftShader explains it; no code change.

## 11.5 Gate + regression — verbatim

Gate (solo, budget 240 s):
```
[m1f gate] acceptance line: [Milestone1F] acceptance FAILED
[m1f gate] badges: ["PASS","PASS","FAIL","PASS","FAIL"]
  PLAYWRIGHT_EXIT=1
```

Full regression (same run, pinned config):
```
[m1a] ["PASS","PASS","PASS","PASS","FAIL"]   (row 5 frame time — env-soft)
[m1b] PASSED in 34.5 ms — ["PASS","PASS","PASS","PASS","PASS"]
[m1c] PASSED — geo=145 — ["PASS","PASS","PASS","PASS"]
[m1d] FAILED — v@1000m=264.7 maxDv=10.30 rebases=7 recv=43 geo=151 burnHeap=0B — ["PASS","FAIL","PASS","PASS","PASS"]
[m1e] PASSED — ["PASS","PASS","PASS","PASS","PASS","PASS"]
[m1f] FAILED — ["PASS","PASS","FAIL","PASS","FAIL"]
  3 failed
  3 passed (4.8m)
PLAYWRIGHT_EXIT=1
```

## 11.6 Vindication ledger (round 4)

F27 ✓ (R2 PASS again: 105.5% / 0.71 px) · F28 ✓ (R4 PASS again: heaps
0/0) · F30 predicates ✓ sound but their domain is empty → F30x routed
with the gate-fail numbers (harness edit NOT applied, as ordered) · F31 ✓
(Node alignment 0.000 px ≤ 0.25; R3 sym 47.69% → 22.22%; residual routed
F32) · E-1 ✓ evidence complete (SwiftShader 19.8 FPS vs RADV 59.8 FPS;
hardware grounds the ship; config untouched) · F25e/F29a/F29b resolved-
by F30/F31 per the ruling (F30x outstanding for F29b/F25e's spawn fix).

## Status

**GATE FAILED (round 4) · ROUTED (F30x, F32) · E-1 EVIDENCE COMPLETE ·
AWAITING LEAD RULING (§8.7).** The F30 Node gate failed inside its own
constraints (no eligible spawn exists in the jitter domain) and the
harness was not edited; F31 is applied and vindicated in Node, with the
residual R3 silhouette noise routed F32; E-1 produced the renderer/FPS
evidence and the hardware-acceleration path without touching the pinned
config. NEXT ACTION: await Lead ruling on F30x/F32/E-1. 1G not started.

---

# 12. ROUND 5 — F30x Node gate FAILED at every authorized rung → HARD STOP (harness NOT edited); F32 applied through its ladder (samples 4→8, R3 22.22% → 17.78%, still ≥3% → STOP) (2026-10-18)

Round-5 execution order honored: the F30x Node-first gate ran BEFORE any
harness edit, failed its proceed conditions at every widening rung the
ruling authorized (0.28 → 0.45 → 0.58 span = the 0.60 rad hard ceiling,
Earthrise band [8°,22°] then the authorized fallback [5°,25°]), and the
spawn harness edit was NOT applied per the ruling's "if Node finds NO
eligible candidate: STOP, do not apply, report." Fix 2 is an independent
ruling and was executed through its full ladder (samples:4 → samples:8)
to its own stop. Commits: 439f4d5 (F30x diag + stop), 8289c81 (F32
rung 1), a8b25fa (F32 rung 2).

## 12.1 F30x — Node-first gate: FAIL at every authorized rung → HARD STOP (raw numbers)

diag-m1f-core.mjs extended: jitter span parameter (ladder), Earthrise
guard [8°,22°] → [5°,25°] (authorized fallback), break-at-first-eligible
cost rule (in place; never fires because nothing is eligible), failure
classification counters, plus two diag-only surveys (domain survey over
the full 0.62 rad cap; global sweep over the whole moon). Verbatim final
run ([5°,25°] band, span 0.58):

```
rails: earthDist=38.8 km  sunDist=572.0 km
F30x spawn search: evaluated=24000 (slope<0.01 skipped 0) eligibilityChecked(lazy, score<best)=24000 — failElev=8546 failCorr=15454 failLos=0 — eligible=0
  chosen: index=-1 score=NaN
F30x spawns: old=(0.32059,-0.03683,0.94650) new=(0.42311,0.00000,0.90608) angularDistance=6.661°
  Earth elevation: old=8.67° new=15.00° (canon intent ≈15°)
  new corridor: azimuth=150° maxSlope=65.7° (gate ≤ 40°)
  new LOS pose→SAT_B: clear=false minMargin=-10.6 m at f=0.025
  findSpawn boot cost: 20954 ms (gate ≤ 2,000 ms)
  new spawn: slope=12.314° h=-30.76 m
```

Ladder table (all runs: 24,000 candidates, lazy-checked all, chosen
index −1, fallback = base, Sun ACTIVE both poses every time):

| span (max rad) | band | failElev | failCorr | failLos | eligible |
|---|---|---|---|---|---|
| 0.28 (≈0.30) | [8°,22°] | 5,822 | 18,178 | 0 | **0** |
| 0.45 (≈0.47) | [8°,22°] | 9,735 | 14,265 | 0 | **0** |
| 0.58 (=0.60 ceiling) | [8°,22°] | 11,585 | 12,415 | 0 | **0** |
| 0.58 (=0.60 ceiling) | [5°,25°] | 8,546 | 15,454 | 0 | **0** |

The LOS predicate was NEVER reached (failLos=0 everywhere): every
in-band candidate already failed the corridor predicate. The binding
constraint is NOT the domain size. The two surveys settle it:

```
F30x domain survey: 625 grid sites over the full 0.62 rad cap about base — sites with corridor <= 40°: 0; MIN corridor maxSlope = 48.7° (at 8.20° from base, Earth elev 15.91°)
F30x global sweep: 2294 sites over the whole moon — sites with corridor <= 40°: 0
  global MIN corridor maxSlope = 42.9° (Earth elev -7.55°, 28.9° from base)
  MIN within the [5°,25°] Earthrise band = 49.7° (Earth elev 21.66°, 110.3° from base)
```

- **Domain survey:** 625 sites covering the ENTIRE authorized 0.62 rad
  cap — ZERO sites with a ≤40° corridor over 2,600 m; the best corridor
  anywhere in the domain is 48.7° (at a site with Earth elev 15.91° — a
  perfect Earthrise composition whose flattest corridor is still 48.7°).
- **Global sweep:** 2,294 sites over the WHOLE moon — ZERO sites with a
  ≤40° corridor. Global minimum 42.9° (at Earth elev −7.55°, below the
  horizon — no Earthrise). Inside the [5°,25°] Earthrise band the best
  anywhere is 49.7° (110.3° from base, outside any authorized domain).
- **Route implication for the next ruling:** the corridor predicate
  (≤40° over 2,600 m, i.e. ≤ tan 40° ≈ 0.84 m rise per metre) is
  UNMEETABLE on this terrain field (mountainFreq 6.5, mountainAmp 230 +
  detailAmp 16 at radius 1,364.5 m) — no spawn domain widening can ever
  fix it. The remaining levers are all OUTSIDE this ruling's scope and
  each needs its own decision: (a) SAT_B retarget (round-4 option (b) —
  move the straddle target to a point the eligible set can see), (b) a
  corridor-threshold change (a gate/predicate change — hard stop here),
  (c) a different terrain field for 1F (a scenario change), or (d) drop
  the LOS-guarantee path and keep the old spawn (R5's diffMid stays
  nonzero — not a fix). The ruling's arithmetic premise ("the LOS
  predicate guarantees the R5 straddle ray is clear") remains sound; it
  is the ≤40° input that cannot be satisfied.

**F30x HARD STOP: the spawn harness edit was NOT applied.** walkFwd
still derives from the OLD acceptance spawn (findSpawn at 0.1 span, no
guard, no break), byte-identical to round 4.

## 12.2 F32 — applied through its ladder: samples 4 → 8; R3 22.22% → 17.78% at BOTH rungs → STOP

Exact diff (harness): one line — `abTarget = new THREE.WebGLRenderTarget(
AB_W, AB_H, { samples: 4, depthBuffer: true })` (rung 1, 8289c81), then
`samples: 8` (rung 2, a8b25fa). TSC_EXIT=0, BUILD_EXIT=0 unpiped at both
rungs. Nothing else changed: threshold >45, ±80 px window, <3% criterion,
232 km fixture, masks, poses all untouched.

Rung results (browser gate, each a full solo run):

| rung | R3 sym (of 90-px disk) | R1 determinism | R2 Sun footprint | verdict |
|---|---|---|---|---|
| samples:4 | 17.78% | 0 differing bytes | 1,372 px = 99.1% | still ≥3% |
| samples:8 | **17.78% (identical)** | 0 differing bytes | 99.1% | **STOP** |

- MSAA helped once (22.22% → 17.78%: the A2C no-op relief, F32 cause #1)
  and then SATURATED: samples 4 and 8 produce the IDENTICAL sym-diff —
  the residual 16 differing pixels of the 90-px disk are the limb
  isophote (cause #3: the >45 threshold sits at a shading isophote where
  mesh interpolated normals and the impostor's analytic normals disagree
  by ~1 px locally) plus residual phase, neither of which sample count
  can fix. Watch items held: R1 frozen-frame determinism 0 differing
  bytes at both rungs; R2's Sun footprint moved 105.5% (samples:0) →
  99.1% (MSAA) — INSIDE the ±15% tolerance (round-4's 105.5% was itself
  inside; the movement is the MSAA gamma-resolve on the Sun disk edge).
- Per the ruling's own ladder: still ≥3% after samples:8 → **STOP and
  report — metric, threshold, window, fixture distance all unchanged.**
- Next-ruling options unchanged from §11.2's list minus MSAA: a larger
  silhouette fixture distance (error fraction scales ~1/radius), a 1-px
  dilated comparison set, or comparing alpha/coverage instead of RGB
  brightness — each is a metric/scenario change needing its own ruling.

## 12.3 Gate + full regression — verbatim

Solo gate (samples:8 state; budget 240 s):
```
[m1f gate] acceptance line: [Milestone1F] acceptance FAILED
[m1f gate] badges: ["PASS","PASS","FAIL","PASS","FAIL"]
  PLAYWRIGHT_EXIT=1
```

Per-row details probe (samples:8; FAIL rows verbatim):
```
=== FAIL — Mesh ⇄ impostor handoff: hysteresis, no popping, sub-pixel silhouette
    Unit sweep (20 round trips, 500 m steps): 21 state flips (21 = 20 threshold crossings + 1 initial-state correction — deterministic, no thrash), 0 hole frames, 0 double-full frames, fade slope ≤ 0.14/km (continuous). Hysteresis band [220, 240 km] strictly contains the fade window [225, 236 km] — threshold oscillation can never modulate a partially-faded representation. Live sweep trace: 1590 frames, 0 holes, crossed both fade edges. Silhouette A/B at 232 km (mesh-only vs impostor-only renders): edge symmetric difference 17.78% of the 90-px disk (< 3% — sub-pixel alignment; 96-seg mesh chord error ≈ 0.008 px).

=== FAIL — Floating Origin integration + byte-zero straddler A/B @2,400 m
    0 origin shifts during the live walk (each rebase is an independent Δ-lattice + sky-invariance sample; 1D's cruise row already carries the 8-rebase lattice evidence; every Δ an exact multiple of 256 — the power-of-two lattice proof; f32 locals max 372 m ≤ 1,024); GL geometries constant at 54. Background rebase-invariance: the Sun instance's camera-relative position moved ≤ 0.0 mm across every rebase frame — indistinguishable from normal per-frame apparent parallax (~12 mm/frame at D=9,600 m, d_sun≈600 km); the origin jump itself (Δ up to 1,024 m in absolute local coords) never reaches the sky. Straddler A/B at the 2,400 m boundary (Sat B: d_n ≈ 2,374, d_f ≈ 2,426; renders: auto / forced-Near-only / forced-Mid-only): 0 and 529 differing bytes of 3686400 — identically zero, the Spec-05 pixel-difference demand proven at the layer threshold.
```
R5 note: diffMid 495 (round 4) → 524 (samples:4 run) → 529 (samples:8
run) — the same occlusion event, ±tens of bytes of SwiftShader
rasterization jitter around the blocked-ray pixels; never 0, exactly as
predicted while F30x is stopped (the straddle ray is still blocked; the
spawn fix was the geometric precondition for diffMid = 0).

Full regression (pinned config, same session):
```
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 22.5 ms — ...
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 ...
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
[m1d gate] acceptance line: [Milestone1D] acceptance FAILED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=49 geo=151 burnHeap=0B
[m1d gate] badges: ["PASS","FAIL","PASS","PASS","PASS"]
[m1e gate] acceptance line: [Milestone1E] acceptance PASSED
[m1e gate] badges: ["PASS","PASS","PASS","PASS","PASS","PASS"]
[m1f gate] acceptance line: [Milestone1F] acceptance FAILED
[m1f gate] badges: ["PASS","PASS","FAIL","PASS","FAIL"]
  2 failed
  4 passed (4.3m)
PLAYWRIGHT_EXIT=1
```
- 1A 5/5 GREEN **including row 5 this round** (round 4's frame-time
  failure did not reproduce — consistent with its environment-soft
  classification; no code change either way).
- 1D row 2 env-soft AGAIN per E-1 (diveGrounded false under
  SwiftShader): all measured numbers match the approved gate (v@1000m
  264.7, maxDv 10.30, geo 151, burnHeap 0B; rebases 8 / recv 49 are
  run-dependent counters, both within their row's other clauses — the
  row's FAIL is the grounding clause alone). No code or config change,
  per E-1 and this ruling's regression instruction.
- 1B/1C/1E green; 1F [P,P,F,P,F] as analyzed above.

## 12.4 Vindication ledger (round 5)

F30x ruling premise ✗ (its factual assumption "a widened domain + the
same predicates finds an eligible spawn" is FALSIFIED by the surveys —
the corridor predicate is unmeetable on this moon; the stop condition
fired exactly as written, harness untouched) · F30x cost rule ✓ in
place (never fires — nothing eligible) · Earthrise guard ✓ implemented
+ measured (band [8°,22°] and fallback [5°,25°] both empty of eligible
candidates) · F32 mechanism #1 ✓ VINDICATED (22.22% → 17.78%, the
predicted ~0.33 px A2C relief) · F32 saturation ✓ measured (identical
17.78% at samples 4 and 8 — cause #3 dominant, MSAA-insensitive) · R1
determinism ✓ 0 bytes at both rungs · R2 ✓ footprint 99.1% inside ±15%
· F31 ✓ undisturbed (R3 window still holds just the probe disk, 90 px)
· F27/F28 ✓ still vindicated (R2/R4 PASS) · E-1 ✓ honored (no config
change; 1D row-2 reported env-soft; 1A row 5 recovered on its own).

## Status

**GATE FAILED (round 5) · BOTH FIXES AT THEIR RULING-PRESCRIBED STOPS ·
AWAITING LEAD RULING (§8.7).** F30x hard-stopped BEFORE the harness edit
(no eligible candidate exists at any authorized rung; the surveys prove
the ≤40° corridor over 2,600 m is unmeetable ANYWHERE on this terrain
field — the binding constraint is the predicate vs the terrain, not the
domain). F32 applied through its ladder to saturation (R3 17.78%
identical at samples 4 and 8; still ≥3% → stop; nothing measured
changed). Gate [P,P,F,P,F]; regression 2 failed / 4 passed with 1D row-2
env-soft (E-1) and 1A row 5 recovered. The 1F mission (§1) needs two
decisions this engine cannot make: the R5 spawn geometry (retarget SAT_B
/ corridor threshold / scenario — options in §12.1) and the R3 residual
(fixture distance / dilated comparison / coverage metric — options in
§12.2). 1G not started.

---

# 13. ROUND 6 — Track B dump + classification executed per the Lead addendum; classification lands in a ROUTING GAP → STOPPED before any rung; Track A blocked (base round-6 directive not on record) (2026-10-18)

The round-6 ADDENDUM reached this session; the base round-6 directive it
amends did not (reconciled: HEAD 779fcaf clean, no foreign commits, no
directive persisted anywhere in the repo — notes/patches/ holds only
1C-CP.md). The addendum is self-contained for Track B (it replaces the
classification rules wholesale, specifies the dump site, and restates
both rungs + routing), so Track B step 1 was executed under the
addendum's own authority. Track A exists only as an ARCS-wording
clarification ("the ARCS list (25, 50, 100, ..., 2600 m — 16 arcs, as
coded)") to rules this session has never seen — NOT executed; the Lead
is asked to supply the directive text. Commits: 21408a3 (dump edit +
probe).

## 13.1 The dump (verbatim; harness R3DUMP, emitted from within the
classification loop between the last abRender and the state restore — no
new renders; probe tools/diag-m1f-r3dump.mjs, read-only)

```
R3DUMP px dx=-2.00 dy=-5.00 r=5.39 side=I
R3DUMP px dx=-1.00 dy=-5.00 r=5.10 side=I
R3DUMP px dx=0.00 dy=-5.00 r=5.00 side=I
R3DUMP px dx=1.00 dy=-5.00 r=5.10 side=I
R3DUMP px dx=-4.00 dy=-4.00 r=5.66 side=I
R3DUMP px dx=3.00 dy=-4.00 r=5.00 side=I
R3DUMP px dx=-5.00 dy=-2.00 r=5.39 side=I
R3DUMP px dx=4.00 dy=-2.00 r=4.47 side=I
R3DUMP px dx=-5.00 dy=-1.00 r=5.10 side=I
R3DUMP px dx=4.00 dy=0.00 r=4.00 side=I
R3DUMP px dx=-5.00 dy=1.00 r=5.10 side=I
R3DUMP px dx=4.00 dy=1.00 r=4.12 side=I
R3DUMP px dx=-4.00 dy=3.00 r=5.00 side=I
R3DUMP px dx=3.00 dy=3.00 r=4.24 side=I
R3DUMP px dx=-2.00 dy=4.00 r=4.47 side=I
R3DUMP px dx=1.00 dy=4.00 r=4.12 side=I
R3DUMP hdr centre=(640.00,360.00) meshR=5.41 impR=5.86 meshRmax=90.82 impRmax=90.82 totA=92 sym=16
```
(meshRmax/impRmax hit 90.82 px = a stray lit background pixel inside the
±80 px window present in BOTH masks; the area-derived radii 5.41/5.86
are the disk radii. sym=16 here vs 16/90=17.78% in the gate run — ±2 px
run-to-run jitter, same signature.)

## 13.2 Classification (the addendum's replaced rules, applied verbatim)

```
r_disk(max r over differing px)=5.66  differing=16
SHADING (r <= r_disk-2 = 3.66): 0 px
EDGE (|r-r_disk| <= 2): 16 px  net one-sided I-M=+16 (impostor-larger)
EDGE azimuth bins occupied=14/24 contiguous-arc-span=21 bins
uniform ring (>=16 bins)=false  directional arc (<12 bins, contiguous, one-sided)=false
dominant=EDGE (SHADING 0 vs EDGE 16)
ROUTE: EDGE-dominant but neither uniform+net>=6 nor directional arc -> NO DEFINED ROUTE -> STOP and report
```

**STOPPED before any rung.** The measured signature matches NEITHER
defined EDGE route by the letter: not "uniform ring" (14 bins < 16), not
a "directional arc" (14 bins ≥ 12; span 21 bins ≈ 315°).

## 13.3 Sanity-check vs §11.2 (as the addendum ordered) + two findings the Lead needs

1. **The dump IS the §11.2 cause-#1 signature in substance.** All 16
   differing pixels are impostor-lit-only at the OUTER rim (r 4.0–5.66
   vs meshR 5.41); area-derived radii give a UNIFORM +0.45 px radius
   excess (impR 5.86 − meshR 5.41 = +8.3%); the shell area 2π·5.41·0.45
   ≈ 15.3 px ≈ sym=16 ✓; SHADING = 0 ✓ (the deep-interior isophote
   contributes nothing). Mechanism: the impostor's analytic-AA/coverage
   band writes resolved brightness ≥ 45/255 ≈ 0.18 coverage out to
   ~0.4–0.45 px beyond its geometric rim, while the mesh's edge sits at
   its geometric rim — the same +0.33 px scale excess §11.2 attributed
   to the A2C no-op, PERSISTING at samples:8 through the
   coverage-resolution channel (MSAA fixed the no-op, not the profile
   mismatch at the >45 threshold). Angularly the ring is uniform:
   expected occupancy under uniformity at n=16 is 24·(1−(23/24)^16) ≈
   12.0 bins — observed 14; a directional arc is firmly rejected
   (span 315°). The formal ≥16-bin criterion is STRUCTURALLY UNREACHABLE
   at n=16 (16 pixels can occupy at most 16 bins, and any rim
   collision — guaranteed at this density — drops it below).
2. **The larger-fixture rung cannot reach the criterion from here.**
   sym% ≈ 2·Δr/r_disk. If Δr stays a fixed ~0.45 px band (AA profile in
   pixels): at ~75 km r_disk ≈ 5.41·(232/75) ≈ 16.7 px → sym% ≈ 5.4%.
   If Δr scales with r (fixed angular excess): sym% stays 17.78%. Under
   the Lead's own model (error ∝ 1/radius) the best case is
   17.78%/3.09 ≈ 5.8%. ALL cases ≥ 3% — one rung cannot get there; the
   threshold rung (> 45 → > 8) is the only directed rung that addresses
   the measured mechanism (it re-bases BOTH representations' AA profiles
   to the same ~0.03 coverage line), but the routing gates it on
   SHADING-dominance, which measured 0 px.

**Awaiting the Lead:** (a) the base round-6 directive text — Track A is
wholly unspecified on record (only item 1's ARCS wording is known);
(b) a one-line ruling on the routing gap: whether the EDGE-dominant +
one-sided + statistically-uniform-ring signature (14/24 bins at n=16,
net +16) routes to the threshold rung, the fixture rung, or a new rung.
No rung was applied; no threshold, fixture, window, or metric changed.

## Status

**TRACK B: DUMP + CLASSIFICATION COMPLETE → NO DEFINED ROUTE → STOPPED
PER THE ADDENDUM'S OWN TABLE. TRACK A: BLOCKED — base round-6 directive
not on record in this session.** Harness carries only the verdict-neutral
R3DUMP emission (21408a3); the suite state is otherwise exactly round-5's
(samples:8; gate [P,P,F,P,F]; R3 17.78%). 1G not started.

---

# 14. ROUND 6b — F1 APPLIED (threshold 45 → 8): R3 silhouette PASSES at 0.82% with full validation; V1–V7 complete; F2–F4 not needed; R5 intentionally excluded (2026-10-19)

Directive: R3 only (Track A/R5 explicitly excluded — spawn/walk/SAT/straddler
code untouched). Build on 9d60c3c. Commits: 20156a0 (F1 threshold + dump
values), 8aa94d1 (validation tooling), plus this report's ledger commit.
**R3 badge: PASS (sym 0.82% of the 122-px disk, identical across three solo
gate runs). Finalize criteria ALL hold.**

## 14.0 F1 — the edit (commit 20156a0)

`Milestone1F_TestHarness.tsx` lines 1211-1212: `meshOnly[i] > 45 ? 1 : 0`
→ `> 8`, `impOnly[i] > 45 ? 1 : 0` → `> 8`. Nothing else: <3% criterion,
±80 px window, 232 km fixture, masks, poses, samples:8, hysteresis
clauses, R1/R2/R4/R5 untouched. R3DUMP per-pixel line extended with the
pixel's raw byte values (`mv=`/`iv=`); probe parser updated. TSC_EXIT=0,
BUILD_EXIT=0 (unpiped).

## 14.1 V1 — threshold curve @232 km (from the R3RAW window dump, offline)

```
  t   sym  totA   nA   nB  M-only I-only  symPct
  2     1   122  122  123      0       1  0.82
  4     1   122  122  123      0       1  0.82
  8     1   122  122  123      0       1  0.82
 12     1   122  122  123      0       1  0.82
 16     6   117  117  123      0       6  5.13
 24     7   116  116  123      0       7  6.03
 32    12   109  109  121      0      12  11.01
 45    16    90   90  106      0      16  17.78
```
- A stable plateau t ∈ [2, 12] at sym=1 (0.82%); degradation begins at
  t=16 and reproduces the round-6 signature exactly at t=45 (16 px,
  17.78%, all I-only — matching the round-6 dump 1:1).
- The curve JUSTIFIES t=8 by data: 8 is the largest integer below the
  mesh's own dim-limb shading band (9..45 — see V2), i.e. the deepest
  threshold with headroom above the 0-value background. F2 (re-choosing
  from the curve) is unnecessary — the Lead's chosen 8 IS the curve's
  optimum; not cherry-picked.

## 14.2 V2 — rim histograms (annulus |r − 6.23| ≤ 2 px, r_disk = √(nA@t8/π))

```
annulus px=156 · mesh: min=0 med=0 max=137 · <=8: 134 · 9..45: 12 · >45: 10
              · imp : min=0 med=0 max=225 · <=8: 133 · 9..45: 0  · >45: 23
bin(range)     mesh  impostor
  0- 15       139      133   <— t=8
 16- 31         4        0
 32- 47         4        0   <— t=45
 48- 63         0       10
 64- 79         4        0
 80- 95         1        0
 96-111         1        0
112-127         1        4
128-143         2        0
160-175         0        6
224-239         0        3
```
Documentary mechanism evidence: the MESH has a soft dim-limb shading tail
(12 annulus px in 9..45 — interpolated per-vertex normals), the IMPOSTOR
has none (0 px in 9..45 — its analytic disk steps from ~full brightness
to background). The old t=45 sat INSIDE the mesh's tail: 16 px of the
mesh's own dim limb fell below 45 while the impostor's clean edge stayed
lit → the one-sided +16 px excess. At t=8 both masks' lit sets match to
1 px. (The 10 mesh px >45 vs 23 impostor px >45 in the annulus are the
rim positions where each representation's edge sits; at t=8 the
difference collapses to a single pixel.)

## 14.3 V3 — distance sweep (threshold 8, whole fade band; criterion stays at 232)

```
R3SWEEP d=225 t=8 sym=5 totA=125 nA=125 nB=128 symPct=4.00
R3SWEEP d=228 t=8 sym=0 totA=120 nA=120 nB=120 symPct=0.00
R3SWEEP d=230 t=8 sym=0 totA=120 nA=120 nB=120 symPct=0.00
R3SWEEP d=232 t=8 sym=1 totA=122 nA=122 nB=123 symPct=0.82
R3SWEEP d=235 t=8 sym=4 totA=118 nA=118 nB=122 symPct=3.39
R3SWEEP d=236 t=8 sym=3 totA=117 nA=117 nB=120 symPct=2.56
```
Stable across the band (0–4%), an order of magnitude below the 17.78%
the old threshold produced; the criterion point itself (232) has 3.7×
margin. Reported exactly as observed — the band-edge values (4.00% at
225, 3.39% at 235) are sub-pixel phase at the smallest disk radii and
are NOT criterion points.

## 14.4 V4 — negative control (falsification; REQUIRED and PASSED)

A diag-only bias (TEMP patch, reverted, absent from dist — grep=0 over
the built bundle) rotated the impostor's observer-relative direction by
b·(1/599.14 rad) ≈ b px at 232 km:

```
R3BIAS px=1 t=8 sym=21 totA=122 nA=122 nB=123 symPct=17.21
R3BIAS px=2 t=8 sym=35 totA=122 nA=122 nB=129 symPct=28.69
```
The modified check FAILS loudly at both the 1-px and 2-px biases
(17.21% / 28.69% ≥ 3%) — the meter demonstrably still detects genuine
misalignment; it is not blind at t=8.

## 14.5 V5 — repeatability (3 solo gate runs at the final committed state)

| run | badges | R3 sym | R1 determinism | wall |
|---|---|---|---|---|
| 1 | [P,P,P,P,F] | 0.82% of 122 | 0 differing bytes | 2.4m |
| 2 | [P,P,P,P,F] | 0.82% of 122 | 0 differing bytes | 2.2m |
| 3 | [P,P,P,P,F] | 0.82% of 122 | 0 differing bytes | 2.2m |

sym% identical across runs; wall time well inside the 240 s budget.

## 14.6 V6 — stray-pixel audit @t=8 (r > r_disk + 2 = 8.23 px)

43 lit pixels outside the disk, **ALL 43 SYMMETRIC** (byte-identical in
both masks — background stars/glow rendered identically in the A and B
passes), 0 asymmetric → zero contribution to sym. They DO inflate totA
(the denominator counts mesh-lit pixels including these): totA 122 ≈
disk (~79) + strays (43) — a conservative dilution that only lowers
sym% (disk-only sym would be 1/79 = 1.27%, still <3%). Semantics of
totA unchanged from canon; noted for the record.

## 14.7 V7 — solo gate + full regression (verbatim)

Solo gate (final state; also V5 run 1):
```
[m1f gate] acceptance line: [Milestone1F] acceptance FAILED
[m1f gate] badges: ["PASS","PASS","PASS","PASS","FAIL"]
  PLAYWRIGHT_EXIT=1   (R5 FAIL is the expected, excluded state)
```
Full regression (pinned config):
```
[m1a] PASSED — ["PASS","PASS","PASS","PASS","PASS"]
[m1b] PASSED in 24.6 ms — ["PASS","PASS","PASS","PASS","PASS"]
[m1c] PASSED — geo=145 — ["PASS","PASS","PASS","PASS"]
[m1d] FAILED — v@1000m=264.7 maxDv=10.30 rebases=8 recv=46 geo=151 burnHeap=0B — ["PASS","FAIL","PASS","PASS","PASS"]   (row-2 env-soft per E-1; numbers match the approved gate)
[m1e] PASSED — ["PASS","PASS","PASS","PASS","PASS","PASS"]
[m1f] FAILED — ["PASS","PASS","PASS","PASS","FAIL"]   (R3 PASS via F1; R5 excluded per the directive)
  2 failed
  4 passed (4.2m)
PLAYWRIGHT_EXIT=1
```

## 14.8 Decision log + worklog (every failed method/experiment)

1. **F1 chosen and finalised.** F2 unnecessary (V1: t=8 is the curve's
   optimum — largest threshold below the mesh's 9..45 shading band).
   F3/F4 unnecessary (0.82% with margin; no stacking needed).
2. **FAILED METHOD (caught before reporting):** the first R3RAW parser
   used `l[7]` for the M/I label — off by one (label at col 6) — which
   silently parsed every mesh row into the impostor buffer (V1 showed
   totA=0/100% nonsense). Fixed to `l[6]`, and the analysis re-run
   OFFLINE from the captured raw log (--analyze mode added to the probe)
   — no re-render needed, numbers above are from the same capture.
3. **TOOLING FRICTION (no data impact):** a `pkill -f "vite preview"`
   matched its own shell's command line and killed the compound command
   (empty output with EXIT=0); switched to the `[v]ite` bracket pattern.
   A 10-minute tool timeout killed the first V5 loop after run 1; runs
   2–3 were executed as individual commands. All three runs completed
   and are reported above.
4. **V4 control code hygiene:** the bias hook + sweep IIFE lived in the
   harness ONLY for the capture run (git checkout revert + rebuild +
   grep=0 verification over dist before any commit). The committed
   harness carries ONLY the F1 threshold + the verdict-neutral R3DUMP
   values.

## Status

**R3 SILHOUETTE: PASS (0.82%, margin 3.7×) — F1 APPLIED AND FULLY
VALIDATED (V1–V7). R5 FAILS AS EXPECTED (Track A excluded by the
directive). GATE LINE STILL READS FAILED — per the directive, that is
not a reason to continue.** Finalize criteria: sym 0.82% ≤ 1.5% ✓ · V4
control fails at 1 px and 2 px ✓ · V5 identical across 3 runs ✓ · V7
rows unchanged elsewhere ✓. NEXT: the R5 spawn geometry still awaits its
ruling (Track A). 1G not started.
