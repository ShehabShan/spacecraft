# U27b4ba — K4 terrain re-check (five findings)

- Session 98 · 2026-10-26 · base `099ce5b` · branch `a1-engine-audit`.
- Disposition: **all five retain S1**, with the qualifications and remedy corrections below.
  This completes K4, not K5–K9: **42/55 reviewed, 13 pending**.
- Reviewer: `gpt-6-astra`, confirmed by this bot's platform `llm_usage`
  (`U27-k4-evidence/model-meter.json`). The Lead reports Opus 5.5 originals;
  historical per-unit model attribution has not independently been established.
- Bootstrap: integration-routed clone/checkout/pull; HEAD = origin, clean tree.
  Tracker `d8f7b09` correctly named the parent checkpoint. Plan/NEXT ACTION agreed;
  no lost work or tracker drift found. Read brief in full, tracker, plan, NEXT ACTION
  and latest SESSION LOG row before work.
- Read-only: production code, original probes, tests and specs unchanged.
  A1's allowed-path restriction puts the method ADR draft in `docs/audit/`, not
  `docs/decisions/`. No new library or production design is adopted here.

## Method and independence

Claims were written before source inspection in
[`claims-before-source.md`](U27-k4-evidence/claims-before-source.md).
Re-ran the original repros, then wrote
`game/tools/audit/u27-k4-recheck.mjs` with independent radial-gradient,
ray/triangle-plane, geodesic-secant and request-ownership checks.

Read in full: terrainField, noise, spherify, terrainWorker, TerrainMeshPool,
MoonLod, moonConfig. Read the KCC sweep/height/normal consumers, flight sweep and
bound, and exact m1e STEEP literal. Specs were targeted matches only:
`Milestone 1C.txt:50` and `Milestone 1D.txt:72` (never whole milestone files).
Source hashes are in `U27-k4-evidence/source-sha256.json`.

The normal reference queries the real scalar height field, not the production
normal. The geometry check consumes **real worker position and index buffers**,
not a reimplementation of meshing. Worker scheduling is synthetic FIFO with
real `structuredClone` transfers; imported worker contexts have separate pools
but share terrain dependencies in Node. Each scenario uses one parameter set
and finishes before the next: no multi-body isolation claim.

## A1-U22-1 — Drawn mesh differs from collision field

- **S1 · confirmed · play/engine. Re-confirmed with scope qualifications.**
- Location @ `099ce5b`: `MoonLod.ts:18` (L4); `terrainField.ts:33` (32 quads);
  `terrainWorker.ts:81–92,126–162` (indices/positions);
  `astronautKCC.ts:351,713` (analytic height).
- Claim: the rendered surface should coincide with the ground sampled by the
  character, within its 0.02 m clearance.
- Evidence: 18 actual L4 chunks across all six faces, both triangles of each
  interior quad, **36,864 triangle centroids**. Independently intersect the
  centroid's radial ray with the triangle plane and compare radius with R+h(d).
  Absolute discrepancy: median **0.4575 m**, p99 **5.3447 m**, max **21.0815 m**;
  signed analytic-minus-mesh range **−4.9628 to +21.0815 m**.
- Controls: real zero-relief worker mesh gives at most **2.368 mm** chord sag.
  Rough-field vertex discrepancy is at most **28.66 μm** and ray/plane vs centroid
  radius disagreement at most 1.60e−12 m. This is not f32 storage error.
  Original edge/diagonal experiment also reproduced (edge p99 3.887 m; diagonal
  max 25.966 m).
- Impact: substantial geometry disagreement can bury or float a character
  whose foot follows the analytic field. These are sampled geometric witnesses,
  **not** a fresh GPU capture, walk, or measured fraction of player-visible terrain.
- Remedy correction: **bilinear interpolation is not generally the triangulated
  rendered surface**; a collision lookup must use actual triangle topology.
  Band-limiting/deeper LOD needs an explicit geometric error target and pool
  budget. It does not automatically fix every normal issue.
- Fix sizing: independent surface-agreement gate first (one session); choose and
  implement a shared representation/error budget in subsequent session-sized
  fix work. Not a ratified constant change in this audit.

## A1-U14-1 — Coarse angular normal sampling

- **S1 · confirmed at sampled converged sites · engine/spec. Re-confirmed.**
- Location: `terrainField.ts:145,171–203`; `Milestone 1C.txt:50`.
- Claim: ε = 0.002 rad samples the height field cleanly.
- Evidence: reference uses the radial-graph identity
  `normal ∝ d − grad_sphere(h)/(R+h)`, with a different tangent basis.
  Compare reference steps 2e−6 and 5e−7 rad; reject a sample if their angle
  differs by more than 0.05°. Of 4,096 directions, **4,083 qualify**.
  Production/reference error: median **3.1594°**, p99 **63.9932°**, max **132.0505°**.
  A full direction and error witness is in each independent log.
- Controls: flat-field reference and production normals match radial to
  5.14e−12°; deliberately reversed reference is rejected. Original U14
  reproduces Moon median 3.1615°, p99 59.6477° with its different sample.
- Qualification: the **13 nonconvergent samples are excluded**, not called correct
  or erroneous. Ridged noise includes `abs`, so crests may lack a unique
  derivative; two-step convergence is a local numerical check, not a proof of
  differentiability everywhere. The experiment does not isolate detail octaves
  as the sole cause.
- Impact: KCC slope decisions and shading can use a materially different normal.
- Proposed fix: choose an error-controlled normal method (convergence-tested
  differences or derived gradient with a crest policy). Do not adopt the
  original quarter-wavelength ε suggestion without measurement, nor promise
  an analytic derivative makes nonsmooth ridges globally smooth.
- Fix sizing: normal oracle/crest acceptance policy one session; implementation
  and relevant regressions another if needed. Ratified slope behaviour may
  change indirectly; preserve its explicit decision boundary in the fix task.

## A1-U14-3 — Invalid STEEP height bound affects sweep detection

- **S1 · confirmed bound violation and isolated sweep skip · test/engine.**
  Re-confirmed; the sweep impact now has a focused witness.
- Location: `Milestone1E_TestHarness.tsx:112,958–965`;
  `astronautKCC.ts:122,902–912,939–944`.
- Claim: maxTerrainHeight bounds the field used by the collision sweep.
- Evidence: extract the exact STEEP object from the harness. A 20,000-point
  spherical grid has **2,881 heights above 900 m**. Witness height **2,059.2476 m**
  at direction `[-0.9022885849,0.4310458062,0.00865]`.
  Invoke the real `_sweep` from one metre above to one metre below that surface:
  configured 900 m bound skips the crossing; changing only the probe instance's
  bound to 2,243 m restores the landing callback.
- Controls: same segment, terrain and zero spin in both cases. `_landAt` is
  replaced only with a callback observer to isolate detection; no landing
  response or full harness verdict is asserted. Original max search again
  reaches 2,215.7 m.
- Qualification: STEEP exists in a synchronous test block, not the play Moon.
  Its renderer does not draw mid-swap; do **not** infer a STEEP render-culling
  failure merely from HEIGHT_SLACK=900. A sampled production max below a
  configured bound is not proof that the bound holds globally.
- Proposed fix: derive/validate conservative bounds with field parameters and
  use them consistently in collision fixtures. The original amplitude-sum
  remedy assumes noise bounds; sampling |noise|<1 does **not prove** that range.
  `noise.ts` itself says "roughly [−1,1]". Derive a valid bound before using it
  for safety (2,243 here is a successful control, not a certified global bound).
- Fix sizing: bound proof/contract and targeted fixture gate one session; wiring
  consumers another if needed. No ratified value changed.

## A1-U05-8 — DDA slope bound is false, not a proven baseline tunnel

- **S1 · confirmed false premise; production tunnelling still unconfirmed ·
  spec/engine. Re-confirmed with the original distinction preserved.**
- Location: `flightController.ts:59,605–607,623`; `Milestone 1D.txt:72`.
- Claim: a conservative slope bound 1.2 m/m supports the sweep guarantee.
- Evidence: 30,000 independent geodesic secants, each exactly 0.5 m of base-radius
  arc. Maximum **5.9525 m/m**; **3,462** exceed 1.2. Witness heights
  476.2769 and 473.3007 m; both directions logged.
  Flat-field secant is zero. Source-anchor check verifies tested 1.2 is the
  production constant. Original search again gives 6.412 m/m.
- No overclaim: original baseline still has **0/3,000** sampled tunnels.
  Its endpoint/coarse mutants tunnel on eight paths; these do not establish
  that the unmodified sweep tunnels. Neither sampled max is a global bound.
  A bound on penetration alone also does not prove the next sample detects
  every intervening ridge.
- Proposed fix: a conservative segment/surface exclusion bound, or a rigorously
  justified terrain derivative bound with appropriate sampling/error policy.
  **A measured maximum plus a margin is not a mathematical guarantee.**
- Fix sizing: conservative bound/oracle one session, sweep integration and
  adversarial gate another. Preserve this distinction when U27c sizes fixes.

## A1-U20-1 — Set exhaustion silently breaks request ownership

- **S1 · confirmed under controlled scheduling · engine. Re-confirmed.**
- Location: `TerrainMeshPool.ts:16–18,348–353,412–440`;
  `terrainWorker.ts:234–240`; `MoonLod.ts:97–100,125,145–148`.
- Claim: low in-flight count guarantees a free worker set, and a pending node
  eventually owns its result.
- Evidence: two real worker modules, 144 mesh records, 96 sets **per worker**,
  serial 100 requests. Peak in-flight is **one**, yet worker 0 drops four:
  96 active, worker 1's 96 sets unused. Received + dropped = dispatched = 100.
  A dropped node retains pending record 96. Returning two sets and reusing that
  record for a different node makes `nodeHasData(staleNode)` return **true**.
  Independent `state==active AND owner==node` rejects the stale reference.
- Controls: 144 sets per worker, same serial schedule → 100 active, zero drops.
  Original full MoonLod schedules reproduce drops/dead ownership; the latency-3
  direct schedule instead balances 60/60 and has zero drops.
- Qualification: this demonstrates an actual pool/ownership defect, not a fresh
  measurement that browser 1C/1D/1E pages are "full of holes". Timing matters.
  The original MoonLod experiment is not those harness controllers.
- Remedy correction: aggregate capacity is **already 192 > 144** in the failing
  configuration. `meshCount ≤ workerCount × workerPoolSets` alone cannot prevent
  this defect. Track/reserve available sets per worker and represent completion,
  retry/cancellation and ownership explicitly (generation/key as appropriate).
  A raw `drops>0` gate is optional policy; the essential invariant is no lost
  request or stale ownership. A terrain height service alone cannot fix this.
- Fix sizing: ownership/capacity regression gate one session; allocator/retry
  contract and integration another if needed. No production optimisation claim.

## Verification ledger (un-piped exits observed)

Run commands from `game/` unless explicitly marked root. Python subprocess
capture records each process's actual return code; no shell pipeline masks it.

| Command | Observed result | Log under `U27-k4-evidence/` |
|---|---|---|
| `npm ci --no-audit --no-fund` | exit 0, 93 packages; npm install-script warning | Bootstrap action output |
| `node --expose-gc tools/audit/u14-terrain-field.mjs` | exit 0, controls 4/4 | `u14-terrain-field.txt` |
| `node --expose-gc tools/audit/u22-play-world.mjs` | exit 0, controls 4/4 | `u22-play-world.txt` |
| `node --expose-gc tools/audit/u05c-m1d-dda-dive.mjs` | exit 0, 9/10; TERR-2 rejects the false bound, not a clean 10/10 | `u05c-m1d-dda-dive.txt` |
| `node --expose-gc tools/audit/u20-mesh-pool-worker.mjs` | exit 0, controls 4/4 | `u20-mesh-pool-worker.txt` |
| `node tools/audit/u27-k4-recheck.mjs` (twice) | exit 0, **19/19** both | `independent-final.log`, `independent-repeat.log` |
| `node tools/audit/u27-k4-recheck.mjs --self-test-fail` | exit **1**, 19/20, expected failure | `self-test.log` |
| `npm run typecheck` | exit 0 | `typecheck.log` |
| `npm run build` | exit 0; >500 kB chunk warning | `build.log` |
| Root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | exit 0, empty | `protected-diff.log` |
| Root: `git diff --exit-code 099ce5b -- game/tools/audit` before staging | exit 0, existing probes unchanged; new untracked probe checked separately | `old-probe-diff.log` |

Initial independent run was 18/18, exit 0; added only a production-constant
anchor assertion before final repeat/self-test. No browser/GPU regression
verdict claimed. See handoff validation for allowed paths and unchanged prior
probes. No code fix, benchmark optimisation or other cluster is certified.

## Checked, no issue / handoff

- Worker vertex precision and triangle-plane reconstruction controls pass.
- Flat sphere normals and mesh curvature controls pass.
- Independent assertions propagate deliberate failure to exit 1.
- Sufficient-capacity worker schedule closes accounting with no dropped requests.
- Source/spec/protected files and all old probes are untouched.
- Bootstrap tracker parent convention is consistent; no drift repair required.
- NEXT: **U27b4bb**, K5–K9's remaining 13 findings, starting K5 (U25-1 allocations).
  Preserve per-finding evidence and batch only what fits the 50-OLU budget with
  wrap-up reserve. Then U27c fix tasks/Lead summary → LEAD GATE.