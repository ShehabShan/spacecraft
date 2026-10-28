# ADR-024 — Rebuilt m1f R4 (zero-GC) gate design

- Status: ACCEPTED (F2fcda, session 138, 2026-10-28). R4a is implemented; R4b/R4c are F2fcdb.
- Task: F2f (U27c §2), finding A1-U03-4 (S1, K2a; re-confirmed in `docs/audit/U27b2-k2a-recheck.md`).

## Context
The shipped R4 (`Milestone1F_TestHarness.tsx` `runSuite`, "R4: zero-GC") has three defects:
- It builds a `canary` object and then only does `void canary.cams`, so the canary is never compared.
  The identity clause is shape-only: `instanceMatrix !== undefined`, `bodies.length === 24`, and
  8 astronaut children. A same-shaped replacement passes.
- Its two heap clauses use unforced `performance.memory` snapshots, and they pass on `delta < 0`.
  A missing API reads as `-1`, so it passes too.
- U27b2 (K2a) showed that a heap snapshot can neither see transient churn that is collected inside
  the burn nor prove zero allocation. Identity, allocation and retention are separate properties.

ADR-005 keeps the shipped R4 until an independent browser sampling gate exists (safeguard 3).

## Options
1. Patch the shipped row. This is rejected because shipped rows are never edited (F2f rule).
2. Build one new row that combines identity and heap deltas. This is rejected because it repeats K2a.
3. Use a new page `?page=m1fR4` with one row per property:
   - R4a: boot-object identity compared with `===`, plus GPU resource counts.
   - R4b: allocation during the burn, measured by a CDP `HeapProfiler.startSampling` profiler that
     includes objects collected by minor and major GC. It is calibrated with a preallocated control
     and an escaping-transient control. A missing instrument is FAIL, not N/A.
   - R4c: retention, measured with a GC-bracketed heap trend (`HeapProfiler.collectGarbage`).

## Decision
Option 3, split per §12 into two units:
- F2fcda (this ADR's first unit): R4a, the spec and the self-test.
- F2fcdb: R4b and R4c.

R4a (`game/src/test/M1fR4Gate.tsx`) works as follows:
- It builds an isolated scene with the shipped `SkyImpostorPool` (mesh, stars, 24 bodies) and a
  probe mesh, then does one warm-up render.
- It snapshots 75 references, which cover every object the shipped canary names and more:
  - the pool mesh, geometry, material, uniforms and `uSunCam`;
  - the `instanceMatrix` and its array;
  - each of `aColor`/`aDisk`/`aKind` and its array, and the 24 bodies;
  - the private scratch `_m/_p/_s/_q/_order` and the star attributes;
  - the three rig cameras and their matrices;
  - `RIG.driver`/`RIG.stats` and the scene children.
- It drives the shipped frame path for 3,000 pure frames, the same count as the shipped burn. Each
  frame is 24× `setBody`, `update`, `layerMaskFor` and a driver-pose write.
- It then runs 300 `executePasses` renders.
- It compares every reference with `===` and requires `gl.info` geometries, textures and programs
  to be unchanged.
- A missing or `null` reference is a change.

The mutants act at iteration 1500 of the burn:
- `?mut=replace` replaces `bodies[5]` with a same-shaped clone, which is the exact A1-U03-4 case.
- `?mut=realloc` gives `aDisk` a new `Float32Array` of the same length.

Each mutant must turn R4a red, name exactly the replaced reference, and report that the shipped
shape predicate still holds.

## Why
Identity is the one R4 property a browser page can decide on its own. It catches the replacement
pattern the shipped row is blind to. Putting allocation in R4a would claim more than the instrument
can see (U27b2 remedy 2). R4b needs CDP, so the spec/self-test, not the page, must drive it.

## Consequences
- The spec `e2e/m1f-r4.spec.ts` requires 1 PASS row today. F2fcdb raises `expectedRows` to 3.
- R4a does not certify zero allocation. The shipped R4 stays as a known-blind row until R4b lands,
  and only then can it be retired (ADR-005, safeguard 3).
- R5 stays waived.
- Evidence: `docs/audit/evidence/F2f/cda/`.

## Amendment (F2fcdb, session 139, 2026-10-28): R4b and R4c implemented
- **Driver.** The page exposes `window.__r4` with these members:
  - `burn(n, render)` runs the same fixture frame as R4a; with `render` set, it also runs `executePasses`.
  - `cal(kind, n)` runs the known-rate controls.
  - `post(m)` hands back the measurements.
  The page owns budgets and verdicts. `game/tools/r4-cdp-driver.mjs` measures over CDP, and the spec and the self-test both use it. If nothing is posted within `?wait=` (default 150 s), R4b/R4c FAIL "instrument missing".
- **R4b.** `HeapProfiler.startSampling` (interval 32, objects collected by minor and major GC included) samples the warmed burn: 3,000 pure frames and 300 render frames. The budget is 64 B/frame (same as `alloc-lib.mjs`). Calibration requires noop < 0.5, obj3 16–64 and f64x16 ≥ **64** B/iter. That last bound is lower than node's 128 because Chrome keeps the 128-byte backing store off the V8 heap: it measured 112–113. The row reports a per-clause fail list.
- **R4c.** The trend is 2× `HeapProfiler.collectGarbage` → `Runtime.getHeapUsage` around 3 rounds: pure 10,000 frames and render 600, each after one unmeasured warm round (the first render round measured 37 B/frame of cache fill). The budget is median |x| ≤ 8 B/frame. A large negative reading fails, unlike the shipped R4's `delta < 0`. Calibration is a retained {a,b} control, which must read ≥ 12 B/iter (measured 24.3).
- **Mutant holders.** They are published on `window.__r4hold`, because the first build's minifier removed write-only pushes.
- **Measured.** R4a PASS; R4b FAIL on render only; R4c PASS.
- **Finding F2fcdb-1.** The shipped `executePasses` render path allocates ~1.6 KB/frame: three.js `setFromProjectionMatrix` ~730 B, render internals ~230 B and MultiCameraRig ~187 B are the top sampled sites. The cause is not isolated. The pure frame path is ~54 B/frame. The spec pins ['PASS','FAIL','PASS'] with `fails: [render]`; fixing F2fcdb-1 flips it to all-PASS.
- **Mutants.** `churn` (4 escaping objects/frame) turns R4b red on pure as well, while R4c stays green. `leak` (one retained object/frame) turns R4c red at ~24 B/frame.
- **Retiring the shipped R4.** It may now be retired (safeguard 3 is met), but that is left to the F2f close-out.
- **Evidence.** `docs/audit/evidence/F2f/cdb/`.
