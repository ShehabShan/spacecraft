# A1-U27b2 — K2a allocation and heap-gate re-check

- Scope: A1-U03-4, U04-5, U05-3, U06-2, U07-3, U09-1 only.
- Base: `36106c8`, branch `a1-engine-audit`, session 86.
- Read-only audit: no production, harness or existing probe changes.

## Expected behaviour (recorded before inspecting the implementations)

A gate claiming zero transient allocation must reject a workload that allocates
objects on every iteration even if those objects become unreachable and are
collected before measurement. Live-heap retention, transient allocation, buffer
identity and GPU resource counts are different properties, not substitutes.
An unavailable measurement must be reported as unavailable, not affirmative proof.
A counter used to detect allocations must observe the allocation sites whose
absence it certifies. A negative heap delta can be evidence of collection, not
evidence of no intervening allocations.

Controls: no-allocation/preallocated workload; known escaping transient allocation
whose lifetime is shorter than the measured interval; retained allocation; missing
measurement; deliberate identity change where a canary claims to observe it.
Extract actual gate predicates where practical rather than rewriting them.
Separate gate sensitivity from claims about present production allocation rates.
## Verdict

**Six findings reviewed; five re-confirmed, one corrected in part. All retain S1.**
Together with U27b1 this is **8/55 S0/S1 reviewed, 47 pending**. No new finding
IDs or severity changes. Original reports are preserved; this review supersedes
the specific overstatements and proposed remedies listed below.

| Finding | Disposition | Evidence / qualification |
|---|---|---|
| A1-U03-4 | Re-confirmed | Actual m1f R4 passes replacement of mesh and bodies with same-shaped objects, and passes missing/negative heap measurements. Its canary is not compared. |
| A1-U04-5 | **Changed: heap defect confirmed; “identity canary cannot fail” refuted** | Actual m1e R4 **fails** when `up` is replaced. TypeScript `readonly` does not enforce runtime identity. The canary detects selected identity changes, not unrelated transient allocations. |
| A1-U05-3 | Re-confirmed | Actual m1d T4 predicate accepts missing/negative deltas. Real-controller replay with one extra object per tick passes 3/3; baseline exceeds the bound 2/3. |
| A1-U06-2 | Re-confirmed | Actual pool with an injected pump allocation retains 1,000 new buffers (4,096,000 bytes), yet actual T2 reports `allocDelta = 0`. Counter-increment control fails as expected. |
| A1-U07-3 | Re-confirmed | Real-core original replay passes with missing measurement or negative deltas despite churn; large retained leak fails. Independent identity-replacement control also fails, so that part of the gate is meaningful. |
| A1-U09-1 | Re-confirmed | Real perf test still passes 19/19 with ~4 KB/frame transient garbage; retained-object mutant fails. An independent observer detects ~41.6 MB transient allocation while post-GC heap change is near zero. |

### Corrected interpretation and remedies

1. **K2a is not one identical implementation error.** Browser m1b/d/e/f use
   before/after heap snapshots without explicit forced GC in these burns. Play
   Node tests force GC before reading retained heap. The m1c T2 counter measures
   constructor allocations only. All under-test their allocation claims, through
   different mechanisms.
2. **Do not implement the forced-GC remedies suggested in U04, U05 or U07 as
   allocation detectors.** GC on both sides, `--jitless`, a retained-heap trend,
   or retrying negative deltas cannot count collected transient objects.
   They may help a separately named retention check. U09's raw GC-count or
   unsynchronised heap-rise alternatives also need calibration and workload
   scoping before use as acceptance gates.
3. A snapshot threshold can catch sufficiently large retained growth; it neither
   proves zero allocation nor proves absence of all leaks. Negative deltas are
   valid heap observations, not missing data, and should not be printed as N/A.
4. The U03 source literal at harness line 857 is an allocation *expression*,
   not independent proof that V8 materialises it after optimisation. This unit
   does not measure that specific expression or certify K5's production rate.
5. U07's missing-API mutant creates 64 KiB typed-array backing stores per call;
   these are not ordinary on-heap payloads. Its live-heap mutant actually uses
   `Array(2048)` of doubles: 327,680,000 payload bytes over the 20,000-tick burn,
   not the “same 1.3 GB” printed by the original probe. Either violates a zero-
   allocation claim; do not conflate external buffer memory with JS heap bytes.
6. The original U09 probe exits 0 with **10/11**, not 11/11: its unrelated cold-
   camera failure did not recur (0/4 red). This does not refute U09-1. Likewise
   U05 exits 0 with 10/11; the unrelated T3-2 expectation is already disclaimed
   in its report. Exit 0 alone is not an all-findings-confirmed result.

## Independent evidence

New probe: `game/tools/audit/u27b2-k2a-recheck.mjs`.

The TypeScript AST extracts the complete m1e `runZeroGcBurn`; anchored slices
extract actual m1b T4, m1f R4, m1d T4 and m1c T2 expressions. Types are stripped
without changing the gates. Lightweight controller/render fakes isolate the
measurement contract. They do **not** replace the real-dynamics replay provided
by the original probes and do not simulate GPU output.

**19/19 checks, exit 0 on three runs** (`independent.log`,
`independent-repeat.log`, `independent-final.log`):

- Stable identity control passes; m1e `up` and m1b `absPos` replacement fail.
- m1f same-shaped mesh/bodies replacement passes; deleting the required child
  count fails. Thus it has a shape check, not the claimed identity check.
- All four heap predicates pass missing, negative and zero readings; reject
  5,000,001-byte deltas. Exact thresholds pass; one byte above fails (m1b/d/e
  1,048,576; m1f pure 262,144 and render 4,194,304).
- Fake-tick burns allocate 53,000 escaping `Array(512)` objects across m1e/b/f
  while the missing-measurement gates stay green. This is a gate-sensitivity
  control, not an engine allocation estimate.
- Real `TerrainMeshPool`, one mesh and no workers: a wrapper around `pump()`
  adds 1,000 `Float32Array(1024)` buffers. The actual zero-dispose predicate
  still passes with counter delta 0. Artificially incrementing the counter
  fails: the predicate is wired, but its instrument misses these allocations.
  Worker transfer and WebGL upload are deliberately outside this fixture.

### Independent allocation observer

Node inspector `HeapProfiler.startSampling`, interval 1,024 bytes, explicitly
includes objects collected by **both minor and major GC**. Samples are attributed
only to the warmed workload functions; inspector/heap-read overhead is excluded
from that attribution. Each measurement forces GC after its workload, before
stopping the profiler. The controls have broad bounds, not exact object-size
assumptions. Final run:

| Control | Iterations | Sampled allocated bytes | Post-GC heap change |
|---|---:|---:|---:|
| Preallocated numeric writes | 10,000 | 0 | −14,120 |
| Transient `Array(512)` double payload | 10,000 | 41,606,176 | −520 |
| Retained `Array(512)` double payload | 5,000 | 20,943,792 | 20,772,800 |

Across the three runs, transient samples were 41.56–41.66 MB and retained-heap
changes were −2,000…+2,040 bytes. The observer sees churn that post-GC snapshots
erase. Sampling is statistical and 0 sampled bytes is not proof of universally
zero allocation. These are calibration workloads, not production benchmarks.

## Original repro results

Logs and machine-readable exits: [U27b2-evidence](U27b2-evidence/).
Every command ran in `game/` unless noted; return codes captured directly from
the process, with no pipeline. The first staged `git diff --cached --check`
returned 2 for trailing whitespace in two captured logs; only trailing whitespace
was normalised in `typecheck.log` and `u07.log` before the final check.

| Command | Exit | Relevant result |
|---|---:|---|
| `npm ci` | 0 | 93 packages; npm reports 1 moderate/1 high vulnerability and esbuild install-script warning. No dependency edits. |
| `node tools/audit/u03-r3r4r5-validity.mjs` | 0 | 22/22; R4 static observations reproduced. Its pixel evidence is a historical U01 log, not a new capture. |
| `node tools/audit/u04-m1e-validity.mjs` | 0 | 21/21 in original script; extra garbage deltas −26,568 / −1,465,216 / +193,720 B all pass. Its readonly inference is corrected above. |
| `node --expose-gc tools/audit/u05-m1d-validity.mjs` | 0 | 10/11; baseline deltas 496,272 / 1,191,856 / 1,644,024 B; mutant 613,008 / 658,312 / 500,424 B. |
| `node tools/audit/u06-m1c-validity.mjs` | 0 | 14/14; constructor-only counter reproduced. Other findings not signed off here. |
| `node tools/audit/u07-m1b-validity.mjs` | 0 | 23/23, controls OK; live churn F/P/P; retained large leak fails. |
| `node tools/audit/u09-play-node-validity.mjs` | 0 | 10/11; baseline and both transient mutants pass 19/19, retained mutant child exit 1 (2 failed rows of 19). |
| `node --expose-gc tools/audit/u27b2-k2a-recheck.mjs` ×3 | 0 each | 19/19 independent checks each. Final run after simplifying a redundant baseline expression. |
| `npm run typecheck` | 0 | No diagnostics. |
| `npm run build` | 0 | Successful; existing >500 kB chunk warning. |
| Root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0 | Empty protected-source diff. |

U09 perf heap deltas: baseline −7,960 B; ~400 B/frame mutant −8,392 B;
~4 KB/frame mutant −7,856 B. Whole-run scavenge counts 102/103/113 are ancillary,
not a calibrated gate. Original probes were not modified; their unrelated
outputs are not new sign-off on other clusters.

## Source and specification anchors

All citations against `36106c8`; source is unchanged since `256d77d`.

- `Milestone1F_TestHarness.tsx:1268–1316`: entire R4 block; canary unused,
  shape checks and two heap thresholds.
- `Milestone1E_TestHarness.tsx:867–943`: entire R4 burn; actual reference
  comparisons at 923–927 and heap acceptance at 932.
- `Milestone1D_TestHarness.tsx:546–584,731–748`: burn measurement and T4 verdict.
- `Milestone1B_TestHarness.tsx:573–610`: canary, burn and heap acceptance.
- `TerrainMeshPool.ts:119–158,276–281`: boot buffers/counter and pump;
  counter increment at 137 is the sole increment. `Milestone1C_TestHarness.tsx:
  541–545` computes T2 from that counter.
- `tools/test-play-perf.mjs:80–104`: warm-up, post-GC samples, delta and trend.
  Other play heap rows located in anim/controller/frame/lod/rig/shell/world use
  the same post-GC pattern; only perf mutants were rerun for this finding.
- Targeted spec passages (not whole files): Milestone 1B:58,100; 1C:67;
  1D:86,1167; 1E:74,1482–1483; 1F:92–108.
- `docs/T1-plan.md:1727–1733,2595–2596`: explicitly conflates post-GC heap
  flatness with zero allocation. The tests implement this flawed criterion;
  the plan's criterion also needs correction in a later fix task.

## Checked, no issue within this scope

- The checked heap thresholds and m1c counter predicate can reject out-of-bound
  observations; their wiring is not universally dead.
- m1b and m1e canaries catch the selected identity mutations.
- Large retained growth is detected by the existing perf test.
- The independent observer distinguishes preallocated, transient and retained
  controls across repeated runs.
- Typecheck/build pass and protected source remains untouched.

No browser suite, GPU frame, worker-transfer measurement, or present production
allocation-rate measurement was performed. Browser noise magnitudes remain
environment-dependent; Node shims do not establish Chromium failure rates.

## Draft ADR — separate allocation, retention and identity gates

**Context:** K2a conflates different memory properties. Some original audit
remedies would repeat the defect. A1 permits audit proposals, not implementation.

**Options:** retain heap deltas as the sole gate; force GC around them; or retain
a clearly named retention check and add independent allocation-sensitive,
identity, and buffer-allocation instruments.

**Decision:** propose the third option. Calibrate allocation profiling with
preallocated and escaping transient controls, including collected objects.
Instrument targeted buffer constructors/sites independently of the pool's own
counter. Keep meaningful identity checks. Missing instrumentation means
unverified, not a zero-allocation pass.

**Why:** observed ~41.6 MB churn disappears from post-GC deltas. m1c's counter
cannot observe new runtime allocations, while m1e's real canary is worth keeping.

**Consequences:** future K2a fixes must land the independent checks before
retiring gates, split instrumentation from per-harness integration as needed,
and calibrate thresholds/runtime versions. Do not claim statistical sampling
proves exact zero, or that JS-heap accounting covers external backing stores.
No thresholds or production behaviour are changed here. This draft remains in
`docs/audit/` because `docs/decisions/` is outside A1's write allowlist.

## Provenance and handoff

Session 86, 2026-10-25; VM v2 2 vCPU/4 GB, Node v24.22.0. Platform `llm_usage`
identifies **GPT-6 Astra (`gpt-6-astra`, OpenAI)**; evidence saved in
`U27b2-evidence/environment.json`. This matches U27b1. As previously recorded,
the historical-majority model provenance is **not established**; this unit
certifies evidence review, not completion of the overall cross-model condition.

Resume **U27b3**, remaining K2 gate checks (K2b, then K2c/K2d), splitting into
session-sized subcluster units before execution where needed. K3–K9 and U27c
remain ahead. No tracker drift was found at bootstrap.
