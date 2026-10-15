# MILESTONE 1C REPORT — Web Worker Terrain & Zero-GC Pool (assembly brief §8.6)

Date: 2026-10-15 · Branch: m1-assembly (pushed per amended §8.8) · Canon: untouched (diff vs ea112ec = 0)

**FINAL: GATE GREEN — `[Milestone1C] acceptance PASSED` (4/4 rows), plus 1A/1B
regression PASSED (5/5 each) in the same serial run: `3 passed (1.2m)`.**
Two canon defects were found by the first gate run, diagnosed to root cause,
ruled on by the Lead (F10a/F10b), applied, and verified — full chain below.

## 1. Extraction report (verbatim from `node tools/extract.mjs 1C`)

```
[extract 1C] canon: /Users/th28/Test-Plugin/personal/three.js game/Milestone/Milestone 1C.txt
  src/core/terrain/spherify.ts — 112 lines
  src/core/terrain/noise.ts — 134 lines
  src/core/terrain/terrainField.ts — 232 lines
  src/workers/terrainWorker.ts — 253 lines
  src/render/TerrainMeshPool.ts — 447 lines
  src/test/Milestone1C_TestHarness.tsx — 1002 lines
[extract 1C] 6 block(s) written verbatim (2180 code lines).
```

6/6 blocks; **zero parenthetical matches** (invariant intact — 1B's
SimulationCore remains the only one ever). Worker bundling verified: Vite
emitted `dist/assets/terrainWorker-*.js` as its own chunk (native
`new URL('../workers/terrainWorker.ts', import.meta.url)` resolution;
src/render/ and src/workers/ siblings intact).

## 2. Ruled patches applied at extraction time (in the ruled order)

1. **1C-CP ITEM 2**: canon 1894 `seamless': {` → `'seamless': {` (family-B
   quote loss; canon line corrected from the earlier 1902 estimate).
2. **1C-CP ITEM 1**: verdict console.log differed STRUCTURALLY from the
   addendum → whole-statement replacement per the application rule; result
   byte-equal to notes/patches/1C-CP.md ITEM 1.
3. **F5**: `void m;` no-op guard line deleted from the WIREFRAME onClick.

Typecheck immediately after: CLEAN.

## 3. First gate run — FAILED on `seamless`; two defects diagnosed (routed, then ruled)

```
[m1c gate] [Milestone1C] acceptance FAILED — geo=145 dispose=0 remove=0 pairs=693 parentVerts=0 nrmMismatch=0 maxPosDev=2.0e-5 heap/frame=0B
           badges ["PASS","PASS","FAIL","PASS"]     (1A/1B regression GREEN)
```

**Defect A (F10a) — self-test compared unit outputs against RAW non-unit
corner inputs.** `SPHERIFY ROUND-TRIP: 4.2e-1` (criterion < 1e-12). Node repro
on the extracted spherify.ts: all 2048 random unit directions round-trip at
1.1e-13 (the closed-form inverse is correct); only the four raw diagonal
corners fail, by exactly 1 − 1/√3 = 4.226e-1 — `sphereToCubeInto` normalizes
defensively per its own documented contract, so the comparison can never
pass as written. Lead ruling: authorial, harness-only; compare against the
NORMALIZED input; criterion and probes unchanged.

**Defect B (F10b) — worker request-array detach race (the starvation).**
Evidence chain (Worker.postMessage/onmessage interception, zero canon
contact): ACTIVE collapsed 24→5→2 while PENDING clogged at 140 and FREE
pinned at 2; worker 1 received 0 of 117 requests; dispatch stopped entirely
at ~24 s with inflight=0; message counts balanced (252=252, drops 0) — the
loss was invisible at count level. Root cause in canon terrainWorker.ts: the
request array was transferred home on the FIRST chunk response while the
batch loop still read it → detached reads returned undefined for entries
2..n → those requests silently vanished → records stranded → pool exhausted
→ the `freeCount() <= 2` activation gate deadlocked → LOD collapse → the
seam audit never saw adjacent-level pairs (parentVerts=0). Lead ruling:
authorial; transfer the array ONLY on the LAST response of the batch
(chunk or drop path); main thread unchanged (already `m.a !== undefined`
-gated); preserve (a) every request returns its array, (b) ≤1 array in
flight per worker, (c) zero per-chunk allocation, (d) payload/contract
unchanged.

**Fixes applied** (commits 9b4afdf): F10a normalizes the comparison target
in `check()`; F10b replaces `first`-flag logic with `const last = k === n-1`
gating both the chunk and drop paths. Typecheck + build clean.

## 4. Post-fix verification (probe evidence, per ruling item 3)

`game/tools/diag-m1c.mjs` over 40 s (fresh instance):

```
[5s]  act=93/94  recv=12/s  wfree=3/96 | pairs=0      parentVerts=0      rt=1.1e-13
[10s] act=94/96  recv=6/s   wfree=1/96 | pairs=6,006  parentVerts=1,197  rt=1.1e-13
[20s] act=96/96  recv=21/s  wfree=0/96 | pairs=15,543 parentVerts=2,818  rt=1.1e-13
[30s] act=78/96  recv=6/s   wfree=6/96 | pairs=22,836 parentVerts=3,931  rt=1.1e-13
[40s] act=94/96  recv=22/s  wfree=2/96 | pairs=35,178 parentVerts=6,061  rt=1.1e-13
[F10b] req msgs=555 chunks req'd=1093 maxBatch=3 resps=1093 drops=432
```

- ACTIVE stable plateau (tens of chunks; transient dips recover immediately)
  ✔ · dispatch never stalls with pending>0 (recv 6–22/s sustained) ✔ ·
  parentVerts > 0 and climbing ✔ · roundtripErr 1.1e-13 (F10a, exactly the
  Node prediction) ✔ · req'd 1093 = resps 1093 (no lost requests) ✔.
- **Observation (routed, no fix requested): worker 1 stays idle**
  (its free-set count never leaves 96; drops=432 are worker 0's pool-dry
  path). Mechanism: canon's pump loop calls dispatchBatch(0) first each
  frame; at this workload the shared queue depth (≤ maxBatch 6) is drained
  entirely by worker 0, so worker 1 never dispatches. Efficiency artifact
  only — throughput, plateau, and every acceptance row pass with margin.
  An optional canon change (least-in-flight-first dispatch) is available if
  the Lead wants worker parity; not required by any criterion.

## 5. The 145-vs-146 item (ruling item 4) — closed as authorial miscount

**145 is the true count for this page.** The far shell sphere
(`SphereGeometry(R−900)`, radius 4100) is **frustum-culled every frame of
the flight**: the camera pitch is a constant arctan(260/√(900²+260²)) =
15.52° below horizontal with half-fov 31° → the frustum's bottom plane sits
46.52° below horizontal; the shell center lies at the nadir (90°); the
shell's angular radius from the camera is arcsin(4100/6500) = 39.12°, which
falls 4.36° short of reaching the bottom plane (43.48° gap). The whole
sphere stays below the frustum for the entire orbit → it never draws → it
never registers in renderer.info. 144 pool meshes (all force-drawn by
primeAll) + the starfield Points = **145 exactly**, constant across 3,600+
frames. No wiring defect; no change made (the row asserts constancy, not a
number); the author's "144 + shell + stars = 146" double-counted a shell
that legitimately never enters the view.

## 6. FINAL gate output (verbatim; single serial run, all three pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.4s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 26.4 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.0s)
[m1c gate] acceptance line: [Milestone1C] acceptance PASSED — geo=145 dispose=0 remove=0 pairs=53064 parentVerts=9592 nrmMismatch=0 maxPosDev=8.1e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","PASS","PASS"]
  ✓  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)

  3 passed (1.2m)
```

1C rows: geo-constant PASS (145 across the 60 s window) · zero-dispose PASS
(dispose 0, remove 0, buffer allocs frozen at 576) · seamless PASS (53,064
same-level pairs + 9,592 parent/child T-junctions compared BITWISE with 0
normal mismatches; maxPosDev 8.1e-5 m ≪ 5e-3; round-trip 1.1e-13 < 1e-12) ·
heap-flat PASS (0 B/frame).

## 7. Changes (full entries in notes/CHANGES.md, #22–26)

Extraction 6/6 verbatim (2cd69a1) · 1C-CP ITEM 2→1 + F5 at extraction (2cd69a1)
· wiring + first gate + diagnosis routed (1b44099, f1d66a8) · F10a + F10b
applied per ruling (9b4afdf) · final gates green (this commit). Canon
untouched throughout.

## 8. Lead eyeball (optional)

`npm run dev` in game/ → http://localhost:5173/?page=m1c — terrain streaming
continuously at 2,000 m/s (~4 chunk crossings/s), LOD rings splitting ahead
and merging behind with hysteresis; WIREFRAME + PAUSE to inspect skirts (no
cracks, no normal seams); the GL geometry counter never moves; worker
free-set counts oscillate in a narrow band (worker 0) — note worker 1 idle
per §4.

## Status

GATE GREEN · AWAITING LEAD APPROVAL (§8.7). On approval: 1C → APPROVED;
begin 1D (read Milestone 1D.txt in full, extract 4 blocks, apply F4, wire
?page=m1d, gate 120 s + full regression, report, STOP).
