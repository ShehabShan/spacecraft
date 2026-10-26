# U27b4bba — K5 allocation re-check

Session 99 · 2026-10-26 · base `029488c` · A1 read-only.

## Claims recorded before the new probe
- Allocation and retained heap are different quantities. Garbage collected before
  a heap sample is absent from that sample; a retention gate can reject leaks
  without proving zero transient allocation.
- A warmed arithmetic/preallocated-buffer control should approach zero sampled
  bytes; escaping temporary arrays must register, including objects collected
  during measurement. A deliberately retained growing array must fail a retention
  budget.
- Re-check U25-1 on the unchanged play-frame workload. Count allocations beneath
  `playFrame`, not profiler setup or output; source attribution is runtime evidence,
  not proof of a particular boxing/optimisation mechanism.
- A heap-growth cross-check is valid only for intervals without GC. Reject every
  interval overlapping an observed GC, including intervals with positive growth.
- Node with fake pool/store/document is not a browser render or frame-time result.
  No measured optimisation, browser allocation rate or stutter claim follows.

## Disposition: A1-U25-1 retained S1, confirmed with scope corrections

Category: engine / play / test. Locations at `029488c`:
`game/src/play/frame/playFrame.ts:7,56` explicitly claims zero allocation;
`core/terrain/terrainField.ts:23–24,128,153` and `core/terrain/noise.ts:61`
contain the terrain claim and sampled functions; `tools/test-play-perf.mjs:87,94,97–104`
collects post-GC retained heap and applies delta/trend budgets.
The older report's `useGameStore` comment is not evidence about shipped play:
that store is used by the M1A harness. The playFrame header is the relevant claim.

### Reproduction and controls
New probe: `game/tools/audit/u27-k5-recheck.mjs`. It reuses the unchanged
`test-play-perf.mjs` boot/drive prefix (real world/KCC/controller/camera/animator,
fake worker pool/document/store) but builds an independent measuring instrument.
Generated fixture/bundle files stay in ignored `node_modules/.cache`.
20,000 warm-up frames precede measurement; the sampling profiler includes
minor/major-GC-collected objects and a forced collection before stopping.
Only allocation beneath `playFrame` is counted in the reported frame total.

| Measurement | Independent run 2 | Independent run 3 |
|---|---:|---:|
| Sample interval 64 B: bytes/frame | 11,076.93 | 11,086.35 |
| Sample interval 512 B: bytes/frame | 10,318.38 | 10,273.20 |
| Terrain-stack fraction, interval 64 | 75.32% | 75.47% |
| Terrain-stack fraction, interval 512 | 76.26% | 76.35% |
| Profiler-off, GC-free median bytes/frame | 11,375.94 | 11,376.03 |
| GC-free 500-frame batches accepted | 8/8 | 8/8 |

The two sample intervals use successive portions of the drive, not identical
poses; agreement is approximate, not a statistical confidence interval. Terrain
includes descendants of the height/normal/noise functions; this is stack
attribution, not proof that all bytes originate in explicit allocations there.

Negative controls (integer arithmetic/preallocated Uint32Array) read essentially
zero; escaping 32-element arrays read approximately 320 B/operation, including
collected garbage. The real forced-GC control confirms GC events are visible.
The profiler-off cross-check rejects intervals overlapping any observed GC,
not just negative heap deltas; a synthetic overlap control tests that distinction.
Heap reads themselves have small overhead, amortised across 500 frames.

The exact existing retention predicates accept bounded temporary churn
(about 2.8 KB retained delta) but reject a growing live heap (about 21 MB).
The unchanged full performance test still **passes 19/19**, heap delta −12,984 B,
trend −519 B/1,000 frames. This is a false acceptance **as an allocation gate**,
not a claim that its retention assertions are intrinsically useless or always pass.

### Failed controls preserved
- Original U25 probe exits 0 despite controls 2/3: `{x,y,z}` reads 48.3 B,
  outside its overly narrow ≤48 B band. It is supporting evidence, not the
  independent pass criterion.
- New run 1 exits 1, 17/19: sqrt arithmetic reads 16.27 B/iteration and the
  floating-point typed-array control 1.27 B at one interval. A “no explicit new”
  control cannot be assumed allocation-free on this runtime.
- The new probe switched those controls to integer XOR/Uint32 writes, without
  widening their <1 B bounds. Runs 2 and 3 pass all 19. The failed run is retained.
  The deliberately failed assertion produces 19/20 and exit 1.

### Impact and proposed fix
The zero-allocation invariant fails for this warmed Node fixture; its rate is
roughly 10–11 KB/frame, not an exact universal constant. This does not establish
Chrome/Firefox/browser allocation, garbage-collection pause duration, or visible
stutter. Sharing V8 does not equate browser and Node optimisation decisions.
Idle allocation is supported by the unchanged original rerun, not a separate
independent idle workload in this unit.

First add separate calibrated allocation and retained-growth gates, preserving
the current test until the independent gate lands. Then diagnose the measured
terrain path and measure before/after on the same fixture and a browser workload.
Do not select caching, boxing changes, a 64 B/frame production threshold or
`--max-semi-space-size` alone as a fix from this evidence. Root cause and an
acceptable UI allocation budget remain fix-task decisions.
Size: one session for the gate/diagnosis, another for a demonstrated allocation
fix with relevant terrain/KCC regressions. No ratified constant changed here.

## Checked, no issue / limits
- Controls distinguish reused storage, transient garbage and retained leakage.
- Independent probe exits nonzero on assertion failures.
- Warmed player state remains finite.
- No browser, GPU, worker-receive or real store publication costs measured.
- Original U25's negative-delta-only GC rejection is insufficient; positive heap
  growth does not imply no collection. The replacement instrument observes GC.
- K2a's previously reviewed findings are not counted again.

## Commands and observed exits
All commands below run from `game/`; logs are in `docs/audit/evidence/U27-k5/`.
Every exit was captured directly after the command, without a pipeline.

| Command | Exit / observed result | Log |
|---|---|---|
| `npm ci` | 0 | `npm-ci.txt` |
| `node --expose-gc --max-semi-space-size=64 tools/audit/u25-alloc-sampler.mjs` | 0; controls 2/3; walk 11,198.7 B/frame, idle 10,367.3 | `original-u25.txt` |
| `node --expose-gc tools/test-play-perf.mjs` | 0; 19/19 | `perf-baseline.txt` |
| `node --expose-gc --max-semi-space-size=64 tools/audit/u27-k5-recheck.mjs` (initial) | 1; 17/19 | `independent-1.txt` |
| same command (final, twice) | 0, 0; 19/19 each | `independent-2.txt`, `independent-3.txt` |
| same command with `--self-test-fail` | 1; 19/20, deliberate failure only | `self-test.txt` |
| `npm run typecheck` | 0 | `typecheck.txt` |
| `npm run build` | 0; chunk-size warning, not error | `build.txt` |

Protected diff from `256d77d` is empty (exit 0); final write-scope verification
is in `verification.txt`. Node 24.22.0; VM 2 vCPU / 4 GB.
Reviewer `gpt-6-astra` is platform-usage-confirmed. Opus 5.5 originals are
Lead-attested; historical per-unit provenance remains independently unverified.
This and [K6](U27-k6-recheck.md) form one checkpoint unit, **U27b4bba**.
