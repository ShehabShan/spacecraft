# A1-U06 — m1c harness validity (`?page=m1c`)

Unit U06 of `docs/A1-plan.md` covers the gate health of the Milestone 1C page: worker terrain, the zero-GC pool, seamless normals and the heap. The audit was done at commit `e52885c` and is read-only (AGENT_BRIEF §11).

- Files read: `game/src/test/Milestone1C_TestHarness.tsx` (1,006 lines, all of it), `game/e2e/m1c.spec.ts`, `game/src/workers/terrainWorker.ts`, `game/src/render/TerrainMeshPool.ts` (lines 1–372), `game/src/core/terrain/terrainField.ts` (lines 1–232), `game/src/core/terrain/spherify.ts` (lines 55–84) and `game/playwright.config.ts`.
- Spec: `Milestone/Milestone 1C.txt`, read by grep only (seam, skirt, T-junction, heap passages).
- Probe: `game/tools/audit/u06-m1c-validity.mjs`, run from `game/` as `node tools/audit/u06-m1c-validity.mjs`. Observed **PROBE_EXIT=0, SUMMARY 14/14 confirmed**.
  - The probe runs the **real** `terrainWorker.ts` in Node: esbuild strips the types, `self` is stubbed, and real `init` + `req` messages are sent. It produces 215 real chunks.
  - The harness seam audit (`posArr`…`auditSeams`, :419–503) and the LOD traversal (constants, `buildNodes`, `childOf`, `nodeHasData`, `updateFlight`, `clearSubtree`, `visitNode`) are **sliced verbatim** from the harness source.
  - An independent truth check keys every chunk vertex by its exact dyadic cube point and compares **every** pair of chunks that share that point. The comparison is bitwise on normals and within 5e-3 m on position, for same-face and cross-face pairs alike.

## Gate rows vs their claims

| Row | Claim (harness header :11–20) | Can it fail on its claim? | Evidence |
|---|---|---|---|
| T1 geo-constant | `renderer.info.memory.geometries` is constant in flight | **Yes.** `geoMin === geoMax && geoMin > 0` | It also works together with the patched `dispose` (:55–70). |
| T2 zero-dispose | zero dispose/remove **and** zero main-thread buffer allocations | **Partly.** The dispose/remove counts are real. The allocation clause cannot fail (A1-U06-2). | static: the only write is `TerrainMeshPool.ts:137` |
| T3 seamless | bitwise normals on **every** shared edge, same-level **and** T-junctions | **Same-face only.** Controls are caught, but the cube-face seams are never compared (A1-U06-1), and level gaps ≥ 2 are never compared (A1-U06-4). | SEAM-CTRL-SAME / SEAM-CTRL-TJ caught; XFACE-BLIND passes |
| T4 heap-flat | heap growth < 1 KB/frame | **Weakly.** It passes on N/A or a negative delta, and Chrome reports bucketed memory (A1-U06-5). | static |

## Findings

### A1-U06-1 — T3 never compares the 12 cube-face seams; inverted face-edge normals still PASS
- **Severity:** S1   **Confidence:** confirmed
- **Category:** test
- **Location:** `game/src/test/Milestone1C_TestHarness.tsx:487` (`if (rb.state !== 2 || ra.face !== rb.face) continue;`) @ e52885c. The claim is at :15–16 ("bitwise normal equality on every shared edge across chunks"). Spec: `Milestone 1C.txt` :34 ("corners are bitwise-consistent across all three faces").
- **Claim:** every shared edge has bitwise-equal normals, including the face seams and corners the spec argues for.
- **Evidence:**
  - Scene S2 holds all 24 level-1 chunks. The audit compares 792 vertex pairs, which is exactly 6 faces × 4 same-face edges × 33. The truth check finds **816 cross-face shared-vertex pairs that the audit never touches** (XFACE-UNAUDITED).
  - Scene S3 is S2 plus one split, so the `parentVerts ≥ 4` clause holds and the baseline passes.
  - Mutation: invert the normals of all 260 face-0 boundary vertices. The audit still reports **pass=true, nrmMismatch 0**, while the truth check counts crossMis = 273 (XFACE-BLIND).
  - Two controls show the audit is otherwise live. A 1e-6 change to one same-level edge normal is caught (nrmMismatch 1), and the same change at a T-junction is caught (nrmMismatch 3).
- **Impact:** the claim most specific to a spherified cube — that the seams between cube faces are seamless — is not tested at all. A regression in `FACE_C/U/V`, `spherifyInto` or the face orientation would ship green. The real engine is clean today (A1-U06-checked-1); the gap is in the gate, not the terrain.
- **Proposed fix:** replace the same-face adjacency match with the truth method used here. Key edge vertices by their exact f64 cube point (dyadic, so the comparison is exact) and compare every chunk pair that shares a key. The rule must have no face filter and no level-difference limit, which also closes A1-U06-4. Keep the two controls as self-tests. This touches no RATIFIED item.
- **Fix task size:** one session (harness-only, about 40 lines plus a mutation self-test).

### A1-U06-2 — T2 "zero main-thread buffer allocations" is zero by construction
- **Severity:** S1   **Confidence:** confirmed
- **Category:** test
- **Location:**
  - `game/src/render/TerrainMeshPool.ts:137` — `this.counters.bootBufferAllocs += 4;` is the only write, inside the constructor (:119).
  - Harness `:544–545` — `allocDelta = pool.counters.bootBufferAllocs - metrics.allocStart`.
  - Header `:13–14` ("zero main-thread buffer allocations (pool counter)") @ e52885c.
- **Claim:** the flight loop allocates no main-thread buffers.
- **Evidence:** the probe's static scan (T2-ALLOC-CONST) finds exactly one write to the counter: line 137, between the constructor (@119) and `onWorkerMessage` (@334). Nothing in flight can raise it, so `allocDelta` is 0 whatever the arrival path does. The arrival path itself receives fresh typed-array views each message (structured-clone envelopes; `pa.array = m.p` at :366), and these are not counted.
- **Impact:** a third of T2's verdict is a constant. A future change that allocates `Float32Array`s per chunk on the main thread would still report "allocations: 0". Only T4, which is itself weak (A1-U06-5), could notice it.
- **Proposed fix:** count the real thing. Either (a) patch `Float32Array` / `Uint16Array` constructors in the harness for the window, the same way `dispose` is patched, or (b) assert that every bound `.array.buffer` belongs to the boot-time set of worker transfer buffers (identity check). Rename the detail so it does not claim more than it measures. Harness-only change.
- **Fix task size:** one session, together with A1-U06-5.

### A1-U06-3 — The harness LOD merge leaves children `desired`; parent and children chunks can coexist for seconds
- **Severity:** S2   **Confidence:** confirmed (desired-set state), likely (visible overlap)
- **Category:** test (harness controller; it is not the play-layer LOD)
- **Location:** `Milestone1C_TestHarness.tsx:307` (merge `n.split = false`), `:315` (`n.desired = true`), `:290–296` (`clearSubtree`, which is called only for below-horizon nodes at :302), `:349` (`if (node.desired) { rec.unwanted = 0; continue; }`) @ e52885c.
- **Claim:** the LOD rings "split ahead and merge behind with hysteresis" (spec :2344). After a merge, only the merged node should be desired.
- **Evidence:**
  - A 66 s replay at 60 fps of the verbatim traversal, sampled every 6th frame between 6 s and 66 s (600 samples).
  - In **600/600 samples** some desired nodes have a non-split ancestor. That is up to **84 nodes** at once (all of them level 3/4), and a single stale node stays desired for up to **3.4 s**.
  - A merge never calls `clearSubtree`, so a child stays desired until it drops below the horizon.
  - The eviction pass keeps any record whose node is desired (:349). The stale children are therefore never released while their merged parent is also desired and drawn.
- **Impact:**
  - The finer and coarser chunks overlap behind the camera, which can cause z-fighting or popping.
  - Pool slots are wasted: up to 84 of 144.
  - Pool pressure rises, and pressure triggers forced evictions (`pressure = freeCount() < 6`).
  - T1–T4 cannot see any of this.
  - The visible overlap is `likely`, not confirmed: it needs a browser frame capture behind the camera, or the probe extended to run the record logic.
- **Proposed fix:** call `clearSubtree` on the children when a node merges (at :307), or in the `!n.split` branch before `n.desired = true`.
- **Fix task size:** small. Fold it into the A1-U06-1 session. Before porting this controller to a game page, check that the play-layer LOD does not share the defect (U22).

### A1-U06-4 — Neighbours two levels apart occur in flight and are never audited (no 2:1 balance)
- **Severity:** S2   **Confidence:** confirmed
- **Category:** test / engine (design)
- **Location:** `Milestone1C_TestHarness.tsx:493–497` compares only `level ± 1`. `visitNode` :298–323 has no restricted-quadtree rule @ e52885c.
- **Claim:** T3 covers "parent/child T-junctions" on every shared edge.
- **Evidence:** in the same replay, same-face live leaves are adjacent with a **level gap of 2** in 25 of 600 samples (54 pair-samples; the max gap is 2), against 27,095 gap-1 pair-samples. The audit's `else if` chain skips these pairs completely.
- **Impact:** the T-junctions with the largest gaps are exactly the ones left unchecked. The geometry is fine today: skirts cover even gap 3 (A1-U06-checked-3). But a smaller skirt or a rougher terrain preset would crack where the gate cannot look.
- **Proposed fix:** the A1-U06-1 keyed comparison covers any level gap. Optionally, add an explicit 2:1 balance rule to the controller, or assert the current skirt-coverage margin for gaps up to the observed maximum. No ratified item is affected.
- **Fix task size:** included in A1-U06-1.

### A1-U06-5 — T4 heap guard passes on N/A and on any negative delta; memory is bucketed
- **Severity:** S2   **Confidence:** confirmed (predicate), likely (bucketing effect)
- **Category:** test
- **Location:** `Milestone1C_TestHarness.tsx:557` (`const heapOk = !heapAvailable || heapPerFrame <= 1024;`), `game/playwright.config.ts` (no `--enable-precise-memory-info`, no `--js-flags=--expose-gc`) @ e52885c.
- **Claim:** heap growth stays under 1 KB/frame averaged over the window.
- **Evidence:** the predicate is true whenever `performance.memory` is absent or `heapPerFrame ≤ 1024`, and a GC in the last 2 s makes the delta negative. It averages only the first 4 and last 4 samples of about 120 (0.5 s cadence). This is the same pattern as A1-U03 (R4), A1-U04 (R4) and A1-U05 (T4); U04/U05 showed such verdicts flip with GC timing. It was not re-probed in a browser here.
- **Impact:** the only row that could catch per-frame garbage is decided by GC timing. Combined with A1-U06-2, the "Zero-GC Pool" title has no reliable gate.
- **Proposed fix:** use one shared heap-guard helper for all milestone pages:
  - force a GC before the first and last sample (`--js-flags=--expose-gc`, `gc()`);
  - fit a regression slope over all samples;
  - fail on N/A in CI;
  - launch Chrome with `--enable-precise-memory-info`.
- **Fix task size:** one session for a shared helper used by m1c/m1d/m1e/m1f.

### A1-U06-6 — heap-flat detail string prints a literal template expression
- **Severity:** S3   **Confidence:** confirmed
- **Category:** test / doc
- **Location:** `Milestone1C_TestHarness.tsx:590`: `` `heap growth {(heapDelta / 1024).toFixed(1)} KB over ` `` (missing `$`) @ e52885c.
- **Evidence:** a source match in the probe (T4-DETAIL-TEMPLATE). The badge text shows `{(heapDelta / 1024).toFixed(1)}` instead of a number.
- **Impact:** the total growth figure is never shown to a reviewer, so cosmetic only.
- **Proposed fix:** add `$`.
- **Fix task size:** trivial; include it with A1-U06-5.

## Checked, no issue (do not redo)
1. **Engine seams are clean, including cross-face and corners.** Across the scenes S1/S2/S3:
   - 948 same-face pairs and 818 cross-face shared-vertex pairs have **0** bitwise normal mismatches;
   - the maximum f64-reconstructed position deviation is **1.2e-4 m**, against a 5e-3 tolerance;
   - the real worker output was used throughout.

   `terrainNormalInto` is a pure function of direction, and the face-corner `√(1/3)` argument holds in practice.
2. **The seam audit's same-face logic is correct.**
   - The parent/child index mapping (fine line `F.ix·N` vs coarse `(C.ix+1)·2N`; `jc` is an integer because `j−1` is even) matches the truth check on S1: 140 T-junction vertices, 0 mismatches.
   - Both controls are caught.
3. **Skirts close every measured T-junction gap.** On real chunks with 6 random sites per case, the worst fine-above-chord / fine-below-chord gaps against the covering skirt are:

   | Case | Fine above chord | Fine below chord |
   |---|---|---|
   | L1+1 | 103.8 / 490.9 m | 47.0 / 800 m |
   | L1+2 | 78.2 / 245.4 m | 81.2 / 800 m |
   | L1+3 | **103.8 / 122.7 m** (thinnest margin, 15 %) | 67.6 / 800 m |
   | L2+1 | 42.7 / 245.4 m | 28.6 / 490.9 m |
   | L2+2 | 58.4 / 122.7 m | 34.1 / 490.9 m |
   | L3+1 | 35.8 / 122.7 m | 13.8 / 245.4 m |

   Zero gaps are uncovered. The observed gap 2 has at least a 52 % margin.
4. **Precision:** f32 chunk-local coordinates (|local| ≲ 4 km, ulp ≈ 4.9e-4 m) are an order of magnitude inside the 5e-3 position tolerance.
5. **Spherify boot self-test (:191–221):** the round-trip target is correctly the *normalized* input (comment F10a). The 1e-12 bound is reasonable for f64.
6. **`gridCoord` (`2g/D − 1`, D a power of two) is exact,** so the key-by-cube-point truth method is valid.
7. **T1 + T2 dispose/remove counters are real.** The prototype patches (:55–70) are installed before any pool construction, and `geoMin/geoMax` are sampled every frame of the window.
8. **e2e `m1c.spec.ts`** fails on a FAILED line, on no badges, and on any FAIL badge. It does not fail on `pageerror` (it only logs it). That fault is common to every spec and is left to U08 (e2e plumbing).

## Probe log (unpiped exit code)
```
$ cd game && node tools/audit/u06-m1c-validity.mjs ; echo PROBE_EXIT=$?
... SEAM-BASE, SEAM-CTRL-SAME, SEAM-CTRL-TJ, XFACE-UNAUDITED, XFACE-TRUTH-CLEAN,
    XFACE-BASE, XFACE-BLIND, LOD-STALE-DESIRED, LOD-2TO1, TJ-SKIRT-COVERS,
    T2-ALLOC-CONST, T4-HEAP-WEAK, T4-DETAIL-TEMPLATE, T3-FACE-SKIP: CONFIRMED
[u06] SUMMARY 14/14 confirmed
PROBE_EXIT=0
```