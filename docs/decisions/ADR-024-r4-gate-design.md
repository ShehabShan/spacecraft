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