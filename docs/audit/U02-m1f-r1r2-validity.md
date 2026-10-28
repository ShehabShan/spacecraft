# A1-U02 — m1f R1 + R2 validity

- Unit: A1-U02 (`docs/A1-plan.md` §5) · Commit audited: `29905e1` · Session: 51 (2026-10-22)
- Question: can R1 (depth-compositing) and R2 (impostor-angular) **fail** when the property each one claims is broken?
- Files read in full: `game/src/test/Milestone1F_TestHarness.tsx` lines 20–34, 794–930 and 981–1160; `game/src/render/SkyImpostorPool.ts` (update/setBody, shaders); `game/src/core/render/impostorMath.ts` (thetaEdge, quadHalfSize, depthResolution, projectDirectionInto); `game/src/render/MultiCameraRig.tsx` (planes, renderAB); `game/src/render/TerrainMeshPool.ts` 330–380.
- Milestone 1F grep: lines 882–887 (row claims), 1813–1931 (the same suite code, spec-authored), and the table at 2555–2563.
- Probe: `pre-t4:game/tools/audit/u02-r1r2-validity.mjs`, run under Node with no harness edit. It copies the R1(b) and R2(a) loops verbatim, runs them against the real `SkyImpostorPool`, `impostorMath`, `terrainField` and rails, and adds an independent check that reads the written GPU data. Result: `[u02] CONFIRMED 9/9`, `PROBE_EXIT=0`.

## Verdict
| Row part | Can it fail on its claim? | Evidence |
|---|---|---|
| R1 pair audit, (a) probe pair and (c) boots | **No.** Both are literals. | `layeredMin` = 1,555.5 and `singleMin` = 0.0077 come from constants alone. |
| R1(b) Earth vs horizon | **No.** It is structurally dead. | Of 300,000 chunk samples, 0 qualify. Analytic bound: gap ≤ −3,695 m. It always prints the 1e9 sentinel. |
| R1 frozen-frame determinism | Only for non-determinism, not for z-fighting. | See A1-U02-4. |
| R2(a) per-instance θ and position | **No.** It is a tautology and it audits one body. | It passes with every rendered disk at 2× and with the Sun at 1.5× its true size. |
| R2(b) Sun readback | **Yes.** It is a real check. | It has been red since 3057899 (U01). Its tolerance is mis-documented (A1-U02-5). |

**Net:** R1's pass reduces to `determinismDiff === 0`, and R2's pass reduces to R2(b) plus `audited > 5`. In practice, R2(b) is the only part of either row that can catch the defect it claims to detect.

## Findings

### A1-U02-1 — R2(a)'s per-instance θ/position audit cannot fail, and it audits only one body
- Severity: S1 (S0 if a later unit finds a θ defect that it hid)     Confidence: confirmed
- Category: test (and spec: the same code is in Milestone 1F ~1900–1931)
- Location: `game/src/test/Milestone1F_TestHarness.tsx:1094-1122` @ 29905e1
- Claim: "every instance's rendered θ matches the f64 truth to 1e-6 rad" (header :28; Milestone 1F :885).
- Evidence:
  - (i) The error is computed as `diskTheta = atan(tan(b.theta)·b.alpha)` vs `b.theta` (:1109–1110). Both sides are the same JS f64 field that the harness itself wrote via `setBody` (:830). The value the GPU receives, `aDisk.y` (Float32, `SkyImpostorPool.ts:285`), and the instance matrix are never read. The error is therefore 0 whenever alpha = 1, whatever is drawn.
  - (ii) The position check recomputes `drv + dir·stageD`, which is the same formula as the pool's (`SkyImpostorPool.ts:276-278`). It is 0 by construction.
  - (iii) The inner loop `break`s at the first active slot on every rank. In the probe: `audited 11 over mesh.count 11; distinct bodies audited [sun]`. `audited > 5` is satisfied by repeats.
  - (iv) Mutation M1 doubles every written disk radius and quad scale. The replica still passes (err 0.0e+0). The independent read of the written data reports 3.49e-2 rad.
  - (v) Mutation M2 feeds the Sun 1.5× its true θ. The replica still passes. The independent check reports 1.75e-2 rad.
  - (vi) The lines computing `err` and `te` (:1104–1108) are dead (`void`).
- Impact: a wrong angular size for any body (bad catalog radius, distance or staging law) goes green. The row label "Impostors preserve exact angular scale" (Milestone 1F :2369) is unproven.
- Proposed fix: rewrite R2(a) to iterate ranks once and map each rank to its body by the pool's documented order (trueDist descending).
  - Compare `atan(aDisk.y[rank])` and `atan(scale/D)` from `getMatrixAt` against an θ = asin(r/dist) **computed independently from the rails**, not from `b.theta`.
  - Count distinct bodies.
  - The probe's `independentR2a()` is a template: baseline errors are 8.6e-10 rad (disk) and 2.7e-9 rad (edge), so 1e-6 is a fair tolerance.
  - It touches no RATIFIED item.
- Fix task size: fits one session (harness R2(a) block plus a mutation self-test).

### A1-U02-2 — R1's pair audit runs on constants: `layeredMin > 10 && singleMin < 1` is true by construction
- Severity: S1     Confidence: confirmed
- Category: test (spec: Milestone 1F ~1840–1880, same code)
- Location: `Milestone1F_TestHarness.tsx:1024-1032, 1058-1069, 1078` @ 29905e1
- Claim: "z-fighting eliminated: analytic pair audit (layered ratios vs the single-camera counterfactual)" (:25–26).
- Evidence:
  - Pair (a) is the literal `gap 2500, z 233000`, and pair (c) is the literal `0.02 m @ 1.7 m`.
  - The planes are typed literals `(2000,300000)` and `(0.1,3000)`. They are not read from `MID_PLANES` or `NEAR_PLANES` (probe: `harness reads them: false`), and not from any object's actual `layers.mask`.
  - The probe reproduces the gate's numbers from the literals alone: probe 1,555.5 / 0.0077 and boots 11,610.9. Pair (b) is dead (A1-U02-3).
  - So the pass stays green if the rig's planes change, if `assignObject` puts an object in the wrong pass, or if two passes overlap.
- Impact: R1 cannot detect a broken layering. The "single-camera counterfactual" is arithmetic that is never rendered, so it shows only that one formula is smaller than another.
- Proposed fix: drive the audit from scene state. For each pair of objects whose pass-assigned depth ranges and angular extents overlap after `applyRenderState`:
  - read the pass from `obj.layers.mask`, the planes from the rig cameras, and z from the object's actual distance;
  - add a rendered counterfactual: force one pass and A/B a known coplanar pair;
  - add a mutation self-test: swap the Mid planes, and the row must go red.
- Fix task size: one session for the scene-driven audit; the rendered counterfactual may need a second (split F-a/F-b).

### A1-U02-3 — R1(b) "Earth vs horizon terrain" is structurally dead (frame error); it always prints the 1e9 sentinel
- Severity: S1     Confidence: confirmed
- Category: test (spec: Milestone 1F :1849–1869; the spec table :2562 claims "Earth/horizon ~600,000×")
- Location: `Milestone1F_TestHarness.tsx:1035-1056` @ 29905e1
- Claim: Earth (Mid) vs angularly overlapping horizon chunks keeps a depth gap ≫ δ(z).
- Evidence:
  - `d` is the distance from the chunk origin to Earth's centre in the **moon-centred** frame. The angle test also uses the moon centre, not the observer.
  - `gap = (earthDist − 5000) − (d + 0.75·w + 420)`. Because d ≥ earthDist − |origin| and |origin| ≤ R + 360 = 1,724.5 m, gap ≤ 1,724.5 − 5,000 − 420 < 0 for every chunk at every level.
  - Probe: `300000 chunk samples, 149787 pass the angular test, 0 give gap > 0; max raw gap -3698.6 m`.
  - `minRatio` therefore always stays `Infinity`, and `:1055` substitutes `1e9 / 30 km`. This matches U01's `30.0 km gap, ratio 1,000,000,000`.
  - The spec's ~600,000× figure was never produced by this code.
- Impact: the one scene-dependent R1 pair tests nothing, on every run and every machine. Whether hills occlude Earth correctly in the Mid pass (the spec's "eyeball" claim, :2566) is unverified by the gate.
- Proposed fix: compute observer-relative depths (observer = drv + O, which is what `assignObjectMesh` does at :922–925). Test angular overlap from the observer. Replace the sentinel with an explicit `n/a (0 chunks overlap)` that does not pass silently.
  - For scale: an observer-relative estimate gives ≈ 289,000× (probe), still ≫ 10. The fixed term should pass on the real geometry.
- Fix task size: fits one session. Fix it together with A1-U02-2.

### A1-U02-4 — R1's frozen-frame determinism half cannot detect z-fighting
- Severity: S2     Confidence: likely
- Category: test
- Location: `Milestone1F_TestHarness.tsx:1071-1076` @ 29905e1
- Claim: "frozen-frame temporal determinism (two renders byte-identical)" is part of "z-fighting eliminated".
- Evidence: the two renders use identical state; the second `apply` is empty. A rasterizer given identical inputs produces identical depth-test outcomes, including the "wrong" ones, so coplanar z-fighting is byte-stable between them. Z-fighting appears as shimmer only when the camera or depth inputs change. The diff can detect only real non-determinism (async worker swaps, uninitialised targets).
- Would confirm: render a known coplanar pair twice under a forced single camera (n = 0.01, f = 1e7) and observe 0 differing bytes.
- Impact: with A1-U02-2 and A1-U02-3, no part of R1 tests its title.
- Proposed fix: keep it, but relabel it "determinism". Add a sub-pixel camera-jitter A/B on a straddling pair, where a z-fight flips pixels and a clean layering does not.
- Fix task size: small; part of the R1 fix task.

### A1-U02-5 — R2's tolerances are documented three different ways
- Severity: S2     Confidence: confirmed
- Category: doc / spec
- Location: harness header `:28-30` and pass `:1150`; detail string `:1156-1157`; Milestone 1F `:885-887` vs `:2563`
- Claim / evidence:
  - The harness header and the spec header both say "±12% coverage, ±1 px center".
  - The code, the detail string and the spec acceptance table all use 85–115% and < 1.5 px (probe: `header ±12% / ±1 px · code (0.85, 1.15) / < 1.5 px`).
  - The spec is self-inconsistent, and the code followed the looser figure.
- Impact: a reader trusting the header believes R2(b) is tighter than it is. No evidence shows the loosening was tuned to pass: R2(b) has been red at 0 px since 3057899.
- Proposed fix: the fix task picks one figure with a stated reason (MSAA 8× limb AA on a 21 px radius disk) and makes the header, code and detail agree.
- Fix task size: trivial; fold it into the R2 fix task.

### A1-U02-6 — `abRender`'s quiesce guard is vacuous, and its fallthrough comment is false
- Severity: S3     Confidence: confirmed
- Category: test
- Location: `Milestone1F_TestHarness.tsx:999-1011` @ 29905e1
- Evidence:
  - `poolStable()` reads `pool.counters.received` and `swaps`. These mutate only at `TerrainMeshPool.ts:340` and `:377`, inside `onWorkerMessage` and `bindRecord`, which are reached only from the worker `onmessage` callback (:180).
  - `runSuite` is synchronous, and JavaScript runs to completion, so no message can land during `renderAB`. The guard therefore always returns on attempt 1, and the 6-retry path is dead.
  - If it were reached, it would return the last buffer silently. The comment "determinism check will flag instability" holds only for R1's pair; the R2(b), R3(c) and R5 readbacks have no such check.
- Impact: no false result today. The guard gives a false sense of protection if the suite ever becomes async.
- Proposed fix: delete the loop or make it return a flag that the callers assert. Fix the comment.
- Fix task size: trivial.

## Checked, no issue
- `depthResolution(z,n,f) = (f−n)z²/(f·n·2²⁴)` (`impostorMath.ts:130`) is the correct 24-bit perspective depth step.
- The harness R1 plane literals equal the rig constants today: `MID_PLANES [2000, 300000]`, `NEAR_PLANES [0.1, 3000]` (`MultiCameraRig.tsx:52-53`). The defect is that they are not linked (A1-U02-2), not that they are wrong.
- `SkyImpostorPool.update` writes disk and edge data consistent with the f64 θ. Independently re-read from `aDisk` and the instance matrix, the errors are 8.6e-10 rad (disk) and 2.7e-9 rad (edge), which is f32 narrowing only. The staging law `s = D·tan θe` is implemented as stated (`impostorMath.ts:73-81`).
- `projectDirectionInto` (`impostorMath.ts:150-167`) is a correct pinhole projection (view = q*·d, NDC = (x/fwd)/tanX).
- R2(b) is a genuine readback check that can fail. It is red since 3057899 (U01); the cause is out of U02 scope.
- The F-12 Sun pose (harness `:1123-1127`, drv−O with radial up) differs from the spec's pose (Milestone 1F ~1933, world drv with up (0,1,0)). This is consistent with U01's regression finding, and it is not re-audited here.

## Commands and exit codes (unpiped)
| Command | Exit |
|---|---|
| `node tools/audit/u02-r1r2-validity.mjs` (from `game/`) → `[u02] CONFIRMED 9/9` | `PROBE_EXIT=0` |
| `git diff --quiet 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | recorded in the commit's VERIFIED |