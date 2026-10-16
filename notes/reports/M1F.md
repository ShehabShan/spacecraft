# MILESTONE 1F REPORT — 3-Camera Layers & Sky Impostors (assembly brief §8.6)

Date: 2026-10-16 · Branch: m1-assembly · Canon: untouched (diff vs ea112ec = 0)

**STATUS: GATE FAILED — 1/5 rows PASS — ALL FOUR FAILURES ROOT-CAUSED AND
ROUTED (F22–F26 below); NO unauthorized acceptance-logic changes applied.**
Full 1A–1E regression GREEN in the same serial run: `5 passed (3.9m)`; only
the 1F row failed (`1 failed, 5 passed`). The single passing row (R1
depth-compositing) is a REAL pass — verified non-vacuous by browser probe
(near pass draws 33 objects/frame; frozen A/B frames carry real content).

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

## Status

**GATE FAILED · ROUTED (F22–F26 + D-1/D-2) · AWAITING LEAD RULING (§8.7).**
On ruling: apply authorized fixes, re-run the 1F gate + full 1A–1E
regression, update this report, commit + push, stop at the approval gate.
