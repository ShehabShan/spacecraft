# A1-U14 — Terrain field (noise, spherify, terrainField)

- Unit: A1 U14 · Session 69 · 2026-10-23 · auditor: PromptQL bot (VM v2, 2 vCPU / 4 GB)
- Code @ 50c9eb8: `game/src/core/terrain/noise.ts` (134), `spherify.ts` (112), `terrainField.ts` (232), read in full.
  Consumers read at the cited lines: `core/physics/astronautKCC.ts`, `core/physics/flightController.ts`,
  `play/world/moonConfig.ts`, `play/world/MoonLod.ts`, `test/Milestone1E_TestHarness.tsx`.
- Spec: `Milestone/*1C*.txt` §1.1 (spherify distortion table) and §1.2 Steps 1–3 (seam proof, ε choice), grep only.
- Probes (new, READ-ONLY, import the real core; references written from math in the probe):
  - `node tools/audit/u14-terrain-field.mjs` → PROBE_EXIT=0, controls 4/4 (7.8 s)
  - `node tools/audit/u14b-normals-gc.mjs` → PROBE_EXIT=0
  - `node --trace-gc tools/audit/u14b-normals-gc.mjs gc` → TRACE_EXIT=0 (1,990 scavenges over the run)

## Claims written before probing
1. Height bound: with |noise3| ≤ 1, |h| ≤ continentAmp + mountainAmp + detailAmp; every consumer's
   `maxTerrainHeight` / `HEIGHT_SLACK` must be ≥ the real max of the field it is used with.
2. Determinism: same seed → bit-identical h and n after any re-init sequence.
3. Seams: every cube-face edge vertex evaluates to identical direction bits from both faces, at every level.
4. Spherify: exact unit norm up to rounding; inverse round-trips; the spec's "√2 linear (area 2×)" variation.
5. Normals: the central-difference normal approximates the true surface normal and is "smooth in d" (spec Step 3).
6. Zero-GC: "The height/normal functions perform zero allocation" (terrainField.ts:23–24).

## Findings

### A1-U14-1 — Fixed ε = 0.002 rad is too coarse for the detail octaves: normals and slopes are wrong by degrees
- Severity: S1     Confidence: confirmed
- Category: engine + spec
- Location: `core/terrain/terrainField.ts:145` (`NORMAL_EPS = 0.002`) @ 50c9eb8; Milestone 1C §1.2 Step 3.
- Claim: "ε = 0.002 rad ≈ 10 m of arc at R = 5000 against a shortest feature wavelength of ~300 m samples the
  field cleanly"; the normal is an O(ε²) approximation of the surface normal.
- Evidence (`u14-terrain-field.mjs` P7, 20,000 random directions per field; reference = gradient normal with
  ε = 2e-6 rad, independent tangent basis):
  - The ε is fixed in radians, so its arc shrinks with R (Moon 2.73 m) while the detail octaves reach
    frequency detailFreq·4: shortest wavelength ≈ R / (4·detailFreq) = 78 m (test planet), 15.5 m (play Moon),
    not ~300 m.
  - Engine vs reference, angle error: test planet p50 1.18°, p99 41.6°; **play Moon p50 3.16°, p99 59.6°**;
    STEEP p50 0.07°, p99 49.6°.
  - Slope error (engine − reference): Moon p1 −22.5°, p99 +11.8°. True slope > 45° reported ≤ 45°:
    733 / 9,973 on the Moon, 568 / 5,967 on the test planet.
  - Not converged (`u14b` C1): halving ε moves the Moon normal p50 2.28°, p90 7.57°, p99 31.8°; ε/2 → ε/4 still
    p50 0.59°. The re-implementation of the engine formula matches the engine to 1.7e-6° (so this is the
    formula, not the probe).
- Impact: the KCC step/slope rule (`astronautKCC.ts:739`, ratified) and slide decisions read this normal
  (`astronautKCC.ts:355, 648, 759, 979`), as do spawn (`spawn.ts:18`) and the mesh shading
  (`terrainWorker.ts:154`). On the play Moon a "walkable" verdict can be off by ~20° in 1 % of places, and the
  shading normal does not match the rendered geometry.
- Proposed fix: make ε an arc length tied to the field (e.g. ε_arc ≈ ¼ of the shortest wavelength, so
  ε = R⁻¹·R/(16·detailFreq)), or compute the analytic simplex gradient (Gustavson's noise3 has a closed-form
  derivative; fBm sums it). Keep the "pure function of d" property either way, so seams stay bit-exact.
  Not a ratified item, but the KCC slope rule's behaviour will change — re-run m1e and the play tests.
- Fix task size: fits one session (analytic gradient + probe re-run).

### A1-U14-2 — The normal depends on a tangent-frame choice that flips on 6 planes: up to 37° jumps
- Severity: S2     Confidence: confirmed
- Category: engine + spec
- Location: `terrainField.ts:174–178` (reference axis = least |component|); Milestone 1C §1.2 Step 3
  ("smooth in d").
- Claim: the normal is smooth in d.
- Evidence: `u14-terrain-field.mjs` P7: two directions 2e-12 apart on either side of the |dx| = |dy| plane
  (play Moon) give normals up to **37.4°** apart. `u14b` C1: the same ε with the other frame differs by
  p50 0.78°, p99 13.5° (Moon), 0.48 % of directions > 15°. Because the ε-chords are finite, the result depends
  on the chord directions.
- Impact: visible shading creases and slope-verdict jumps along the 6 planes |x|=|y|, |y|=|z|, |x|=|z|.
  Seams are still bit-exact (the normal is still a pure function of d), so this is not a seam break.
- Proposed fix: the analytic gradient of U14-1 removes the frame dependence entirely; a smaller ε alone only
  shrinks it.
- Fix task size: same task as U14-1.

### A1-U14-3 — `maxTerrainHeight` / `HEIGHT_SLACK` are hand-typed, and the m1e slope suite breaks its own: STEEP reaches 2,216 m vs 900 m
- Severity: S1     Confidence: confirmed (bound violation); likely (effect on the m1e verdict)
- Category: test + engine
- Location: `test/Milestone1E_TestHarness.tsx:958–965` (STEEP, mountainAmp 2200) with `kcc = new
  AstronautKCC(EARTHSCALE_ASTRONAUT)` (:112), `maxTerrainHeight: 900` (`astronautKCC.ts:122`); the bound is used
  at `astronautKCC.ts:902` (sweep band early-out) and `:1092` (AGL telemetry); `HEIGHT_SLACK = 900`
  (m1e :237). No code derives either value from the field parameters.
- Claim: `maxTerrainHeight` is an upper bound of the terrain the KCC walks (the sweep early-out and AGL rely on it).
- Evidence (`u14-terrain-field.mjs` P2, 600,000 Fibonacci directions + hill climb):
  - STEEP: hMax 2,215.7 m; **14.4 % of the sphere (45 km²) lies above 900 m**. `u14b` C2: of the slope sites the
    m1e scan looks for, 5 % (moderate), 23 % (steep) and **47 % (cliff)** lie above 900 m.
  - Production fields are inside their bounds: test planet hMax 763 m vs 900; play Moon 284 m vs 360
    (HEIGHT_SLACK 420).
  - noise3 |max| = 0.979 (2 M samples + hill climb), so the amplitude sum is a safe bound: 1,022 m (test
    planet — above the 900 m in use, so 900 is empirical, not proven), 341 m (Moon), 2,243 m (STEEP).
- Impact: above R + 900 + 2·sweepGap the KCC skips its terrain sweep (`:902–912`), so the m1e slope rows test the
  KCC partly outside its precondition; any fast move there can tunnel, and AGL telemetry is wrong. Any future body
  with taller relief silently gets the same failure.
- Proposed fix: export `terrainHeightBound(params) = continentAmp + mountainAmp + detailAmp` (proved by the
  noise range) and derive `maxTerrainHeight`, `HEIGHT_SLACK` and the flight DDA band from it; assert at
  `initTerrainField` time. In the m1e fix, build the STEEP KCC with that bound.
- Fix task size: fits one session.

### A1-U14-4 — Spherify distortion is misstated: linear variation 2×, not √2; `chunkArcWidth` is not conservative
- Severity: S3     Confidence: confirmed
- Category: doc + engine
- Location: `spherify.ts:146–149`; Milestone 1C §1.1 table; `terrainField.ts:105–109` (`chunkArcWidth`,
  "conservative"); `MoonLod.ts:73` (`brad = 0.75·width + HEIGHT_SLACK`).
- Evidence (`u14-terrain-field.mjs` P5/P6):
  - |∂p/∂u| along u matches the spec table (0.7071 / 1.0 / 0.7071), but the spec reads one direction only.
    The Jacobian singular values range 0.50 (corner) to 1.00 (edge midpoint, across the edge): **linear 2.0×,
    area 1.33×** (spec: √2 and 2×). Gnomonic: linear 3.0×, area 5.2× (spec 2.12×, 4.5×). Spherify still wins.
  - Edge-midpoint anisotropy 1.73 (cells are stretched 1.7:1 there).
  - Real chunk side / `chunkArcWidth`: 0.74–1.27 at L8 (1.20 at L4) — edge chunks are up to 27 % wider than the
    "conservative" width; centre-to-vertex angle / (0.75·width) up to 1.038 (L8), 1.012 (L4).
- Impact: small. The LOD split distance is up to 20–27 % short for edge chunks; `brad` under-covers by ≤ 4 %
  before HEIGHT_SLACK, which dominates at the levels in use (MAX_LEVEL 4), so culling stays safe.
- Proposed fix: correct the comment and spec claim; use the measured max side (×1.27) if the width must be
  conservative.
- Fix task size: trivial; fold into another terrain fix.

### A1-U14-5 — `terrainHeight` and `terrainNormalInto` are not allocation-free in V8
- Severity: S2     Confidence: likely
- Category: engine
- Location: `terrainField.ts:23–24` (claim), `:128–203`.
- Evidence (`u14b` C3, 2 M calls each after a 200 k warm-up, GC events via PerformanceObserver):
  baseline trig loop 3.5 / 1e6 calls; noise3 15; **terrainHeight 180; terrainNormalInto 461**. The engine code
  makes no explicit allocation, so the garbage is likely V8 heap-number boxing (doubles written into the
  `{x,y,z}` scratch objects or read from the mutable module `P`).
- Impact: the KCC calls these several times per tick and the worker per vertex; the zero-GC invariant
  (AGENT_BRIEF §3) is not met by the terrain path. Same class as A1-U13-7 and A1-U09-1.
- To confirm: `node --heap-prof` / `--trace-gc-object-stats` on the C3 loop, or replace the scratch objects with
  `Float64Array(3)` in a probe copy and see the GC count drop to baseline.
- Proposed fix: Float64Array scratch + hoisted param scalars; measure before/after (§13 safeguard 4).
- Fix task size: fits one session.

### A1-U14-6 — `chunkKey` collides from level 9; seeds alias; one active field per thread
- Severity: S3     Confidence: confirmed
- Category: engine
- Location: `terrainField.ts:91–93`, `noise.ts:32,44`, `terrainField.ts:72–79`.
- Evidence (`u14-terrain-field.mjs` P6/P3): `chunkKey(0,9,1,0) === chunkKey(0,9,0,256) = 590,080` (ix/iy ≥ 256
  spill into the level bits; level ≥ 16 spills into the face). MAX_LEVEL is 4 everywhere, so latent.
  Seeds go through `>>> 0`: 1, 1.9 and 1 + 2³² give identical noise; −1 = 2³²−1. The field is a module
  singleton: after `initTerrainField(TEST_PLANET)` a Moon query returns the test planet's height (−43.98 m vs
  −12.42 m) — m1e relies on a synchronous swap-and-restore (:965/:1087).
- Impact: a deeper LOD or a second terrained body (the §13 goal has many) needs a wider key and a field object
  per body.
- Proposed fix: key = ((face·32 + level)·2^L + ix)·2^L + iy with L ≤ 20 (< 2^53); make the field an object
  passed to the KCC/worker/LOD instead of a module global (input to U26).
- Fix task size: fits one session (key); the field object belongs to the U26 architecture work.

## Checked, no issue
- Determinism: re-init sequence Moon → TEST → STEEP → Moon gives bit-identical heights (2,000 dirs) and normals.
- Seams: all 24 face edges, levels 0/4/8/12 (12,312 edge samples, corners included): 0 bit mismatches between
  faces. U × V = C on all 6 faces.
- Spherify: unit norm error ≤ 2.2e-16 (1 ulp); inverse round trip ≤ 4.8e-12 over 200,000 points incl. near-edge.
- Engine normal formula = its documented formula (independent re-implementation, 1.7e-6°).
- noise3 range |n| ≤ 0.979; fBm/ridged normalisation correct; perm indexing in range.
- Production height bounds hold: test planet 763 m < 900, play Moon 284 m < 360 (margin 21 %), hMin −422 / −81 m.

## Seeds for later units
- U16/U17 (KCC): re-check the slope rule with a converged normal (U14-1) — the ratified 45° rule is applied to
  a noisy input; check the sweep early-out against U14-3.
- U18 (flight): the DDA band uses `maxTerrainHeight` too (`flightController.ts:524, 623, 694`).
- U20 (worker): per-vertex normals inherit U14-1/2; worker GC inherits U14-5.
- U26: one terrain field per thread (U14-6) blocks multiple terrained bodies.