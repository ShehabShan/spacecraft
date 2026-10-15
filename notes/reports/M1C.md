# MILESTONE 1C REPORT — Web Worker Terrain & Zero-GC Pool (assembly brief §8.6)

Date: 2026-10-15 · Branch: m1-assembly (pushed per amended §8.8) · Canon: untouched

**STATUS: GATE RUN — FAILED on the `seamless` row. Two canon defects diagnosed
to root cause with protocol-level proof; both route to the Lead (F10a/F10b
proposals below). No unauthorized fixes applied. 1A/1B regression: GREEN.**

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

6/6 expected blocks; **zero parenthetical matches** (invariant intact — 1B's
SimulationCore remains the only one ever).

## 2. Ruled patches applied at extraction time (in the ruled order)

1. **1C-CP ITEM 2**: canon 1894 `seamless': {` → `'seamless': {` (family-B
   quote loss). NOTE: canon line is **1894**, not 1902 as estimated in
   M1B.md — corrected on the full read.
2. **1C-CP ITEM 1**: the verdict `console.log` differed STRUCTURALLY from the
   addendum text (no `${allPass…}` token at all) → whole-statement
   replacement per the addendum's application rule; result byte-equal to
   notes/patches/1C-CP.md ITEM 1.
3. **F5**: deleted the `void m;` no-op guard line in the WIREFRAME onClick
   (canon's own closing note sanctions it).

`npm run typecheck` immediately after: **CLEAN**. Then `?page=m1c` wired,
build clean — **worker bundling verified: Vite emitted
`dist/assets/terrainWorker-*.js` as its own chunk** (the
`new URL('../workers/terrainWorker.ts', import.meta.url)` path resolved;
src/render/ and src/workers/ siblings intact).

## 3. ACTUAL gate output (verbatim; single serial run, all three pages)

```
[m1a gate] acceptance line: [Milestone1A] acceptance PASSED — P.x={ticks} rebases=9 maxLocal={f2(avg)}ms
[m1a gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  1 e2e/m1a.spec.ts:5:1 › M1A — Floating Origin acceptance (5.4s)
[m1b gate] acceptance line: [Milestone1B] acceptance PASSED in 26.5 ms — …
[m1b gate] badges: ["PASS","PASS","PASS","PASS","PASS"]
  ✓  2 e2e/m1b.spec.ts:5:1 › M1B — Kepler Rails & Two-Tier Time acceptance (1.0s)
[m1c gate] acceptance line: [Milestone1C] acceptance FAILED — geo=145 dispose=0 remove=0 pairs=693 parentVerts=0 nrmMismatch=0 maxPosDev=2.0e-5 heap/frame=0B
[m1c gate] badges: ["PASS","PASS","FAIL","PASS"]
  ✘  3 e2e/m1c.spec.ts:6:1 › M1C — Web Worker Terrain & Zero-GC Pool acceptance (1.1m)
  2 passed (1.3m)
```

Row detail (DOM, verbatim): geo-constant PASS (145 held across 3,601
frames) · zero-dispose PASS (dispose 0, remove 0, buffer allocs frozen at
576) · **seamless FAIL** · heap-flat PASS (0 B/frame). All non-seamless
Zero-GC machinery works: the recycling loop balances, dispose/remove
monkey-patch counts are zero, geometries frozen.

## 4. Defect 1 — harness self-test round-trip vs its own contract (F10a proposal)

`SPHERIFY ROUND-TRIP: 4.2e-1` (suite requires < 1e-12). Node repro against
the extracted `spherify.ts` (dependency-free; `game/tools/diag-spherify.mjs`):

- All 2048 random UNIT directions: max err **1.1e-13** — the closed-form
  inverse is correct.
- The 4 diagonal corners `(1,1,1) (1,1,-1) (1,-1,1) (-1,1,1)`: err exactly
  **4.226e-1 = 1 − 1/√3**.

Root cause: the self-test's `check(x,y,z)` compares the spherified output
(always unit) against the RAW input, but feeds non-unit corners;
`sphereToCubeInto` normalizes defensively per its own documented contract
("Input is normalized defensively"). A unit vector can never equal a
non-unit one — the test cannot pass as written. Authorial defect (test vs
contract mismatch), NOT transcription damage.

**F10a (proposed, harness-only, 1–2 lines):** compare against the
normalized input direction in `check()` (or pre-normalize the 12 fixed
vectors). Demands unchanged: the round-trip criterion stays < 1e-12 on
unit directions.

## 5. Defect 2 — worker request-array detach race (F10b proposal) — the starvation

Evidence chain (probes: HUD dumps, `Worker.prototype.postMessage` +
`onmessage` interception — zero canon contact; `game/tools/diag-m1c.mjs`):

- ACTIVE collapses 24 → 5 → 2 while PENDING clogs at 140 and FREE pins at
  2; transfer rate dies 39/s → 0; `inflight=0` throughout.
- Worker 1 received **0 of 117 requests** (`W1{req:0}`); worker 0 got all;
  batch sizes n=1–3 (never 6); dispatch stops completely at ~24 s.
- Protocol totals balance (252 reqs = 252 resps, drops 0, recycled buffer
  sets ≈ delivered) — the loss is INVISIBLE at the message count level.

Root cause — canon `terrainWorker.ts`, the `m.t === 'req'` handler: the
request array `a` is transferred back to the main thread **on the FIRST
chunk response of the batch** (`msg.a = a; postMessage(…, […, a.buffer])`)
while the loop **continues reading `a`** for batch entries 2..n. Reading a
detached TypedArray yields `undefined`, so every batch entry after the
first is generated with `key/face/level/ix/iy = undefined` — the main
thread can never match those chunks (orphan-recycled) and the REAL request
is silently lost. Its record waits forever; its queue entry is already
consumed. With avg batch n≈2.2, ~half of all requests evaporate → stranded
pendings (140) → pool exhaustion (FREE pinned at 2) → the activation gate
`freeCount() <= 2` deadlocks → LOD collapse → the seam audit finds no
adjacent-level ACTIVE pairs → `parentVerts=0` → `seamless` FAIL.

This ALSO explains why the pipeline still "works" at n=1: single-entry
batches never read a detached array — which is why the warmup reached 24
active and the first audits found 693 same-level pairs with
nrmMismatch=0 (the bit-exact seam math itself is PERFECT: 0 mismatches,
maxPosDev 2.0e-5 ≪ 5e-3).

**F10b (proposed, worker-only, ~3 lines):** make the request array ride the
LAST response of the batch instead of the first
(`if (k === n - 1) { msg.a = a; … }` with the transfer list adjusted). The
main-thread handler is already position-agnostic
(`if (m.a !== undefined) this.reqPools[w].push(m.a)` on both chunk and drop
paths), so the documented ping-pong contract is preserved; all Zero-GC and
ownership properties unchanged. Alternative (larger): read the whole batch
into module-scope scratch before posting anything.

## 6. Observations

- **geo=145 vs the author-expected 146** (144 pool + shell + stars): the row
  only asserts constancy (PASSED), but one static geometry apparently never
  registered. Worth one glance after F10b lands; may simply be the author's
  arithmetic (144 + 1 Points + 1 Mesh = 146 vs measured 145).
- The deferred cosmetic `$`-strips in the 1C verdict line never mattered —
  1C-CP ITEM 1 replaced the whole statement.
- Probes kept for the fix-verification round: `tools/diag-spherify.mjs`,
  `tools/diag-m1c.mjs` (scaffolding only, not engine code).

## 7. Changes

CHANGES.md entries 22–23 (extraction + ruled patches). NO other code
changes — both defects routed, not fixed. Canon untouched
(`git diff ea112ec` on Design_specs/ Milestone/ = empty).

## Status

STOPPED — awaiting Lead rulings F10a (self-test comparison) and F10b
(worker transfer race). On authorization: apply both, re-run typecheck +
build + the 1C gate + full 1A/1B regression, complete this report with the
green output, commit per cadence, push, STOP at the approval gate.
