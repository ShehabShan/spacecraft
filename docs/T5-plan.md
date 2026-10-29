# T5 — BIGGER MOON (REAL SIZE) — PLAN

- Task: T5 · Branch: `t5-bigger-moon` (cut from `main` @ 787b9d4, session 156c)
- Stage: BUILDING (0/10; the Lead ordered "execute the T5 plan" on 2026-10-29, session 157b)
- Last updated: 2026-10-29 (session 157b, S1 split)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).
- Source: Lead directive 2026-10-28 (150d, item 2) and ruling (b) (150e), `notes/LEDGER.md`; definition `notes/task.md` §T5; inputs `docs/T5-T6-ideas.md` §0, §1, §6.
- Prerequisites F5a–F5d are folded into T5 as its first build steps (ADR-031).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

## Goal
The play Moon (`?page=play`) gets its real radius, 1,737 km, and real surface gravity, 1.62 m/s², so the ground in front of a walking player reads flat out to the horizon (about 2.4 km at eye height, calc) and distant relief stays visible out to about 100 km. Terrain detail, LOD reach, normals, GPU precision and the gates are rebuilt for that scale, the spawn is re-derived, and frame time and heap show no regression against the 787b9d4 baseline (§13 safeguard 4).

## Scope IN
- **F5a–F5d (U27c §2), first, in dependency order (ADR-031).** Each keeps its U27c §2 definition and verification as its acceptance.
  - F5a: a per-body `TerrainField` instance with an allocation-free height/normal service. It turns the plain alloc-gate green (ADR-002) and carries F3a follow-up (4), the strict real-tree churn check in `test-alloc-gate`.
  - F5b: analytic or level-matched normals instead of the fixed `NORMAL_EPS`, a height bound derived from the params instead of the hand-typed `MAX_TERRAIN_H`/`HEIGHT_SLACK`, and a DDA slope bound from measurement.
  - F5d: mesh pool ≤ worker sets, drop accounting, and an LOD leaf budget with a coarser fallback, built for the lazy quadtree below.
  - F5c: drawn and collision terrain agree near the actor at every LOD, checked again at the final R. Its "lower relief" item is replaced by the crater ladder.
- **Lazy LOD.** The quadtree grows from a boot-allocated node pool, replacing the 341-node-per-face preallocated tree. `MAX_LEVEL` is derived from R (about 15 for quads of about 2 m, calc), split distances reach about 100 km, and the F5d leaf budget caps it. Zero per-frame allocation (brief §3).
- **Terrain profile in metres.** Crater layers sit on a power-law size ladder (N(>D) ∝ D⁻²) from basins of about 50 km down to pits of about 2 m. Each layer has its own lattice and its own prune (chord distance plus cell box, as today), plus metre-scale fBm. Mare rims and floors get km-scale relief. The spawn stays on a flat mare floor. This amends ADR-028.
- **GPU precision.** Every GPU position stays chunk-local or camera-relative at R = 1.737e6 m. The worker already writes Float32 chunk-local positions against a Float64 chunk origin; the step measures the vertex error per LOD level and adds a gate for it.
- **Scale constants.** `MOON_PARAMS.radius` = 1,737,000 m, `MOON_MU` = 1.62·R², KCC `gravityRange`, derived height bounds, the camera clearance probe bounds, and the moonWorld occluder sphere. Earth and Sun framing keep the ruled spawn view (Earth 13° above the view axis, ADR-017).
- **Spawn.** `findEarthriseSpawn` probes and search radius are re-expressed in metres for the real R, and `test-play-spawn` is re-pinned.
- **Gates.** Every re-pin lands replacement-first (§13 safeguard 3) and is listed in its step's commit. Frame time is checked by A/B against 787b9d4 (`check-play-frametime`) and heap by `test-play-perf`. Shared-module edits re-run the `?page=m1X` and m1f-r suites (brief §3).
- Floating-origin rebase (1,024 m) and `MID_FAR_LIMIT` (300 km) are kept, with a check that a whole-Moon view from orbit still composes.

## Scope OUT
- Look and feel, which is T6 (`docs/T5-T6-ideas.md` §2–§5): colour, shadows, Sun height, BRDF, objects (boulders, glowing minerals, crashed lander), character, sound, and a faster travel mode.
- The milestone harness pages (`?page=m1a`…`m1e`, `m1fR1`…`m1fR5`). They keep their own Moon fixtures at R = 1,364.5 m and change only for the F5a service API. They stay regression gates for the shared code.
- The solar-system scale law and catalog (`game/src/core/orbit/scaleLaw.ts`, `celestialData.ts`, F3a, ADR-011…016). The play Moon does not import them.
- KCC obstacle support (T6 boulders and lander need it), physics libraries (brief §3), 1F round 7 and 1G saves (brief §8), T2, F3b (after T6).
- The ratified KCC step/slope rule, C¹ speed cap, camera bands and impostor hysteresis. These change only under an ADR (§13).

## Affected modules
- `game/src/core/terrain/terrainField.ts`: per-body instance (F5a), normals and height bound (F5b), metre profile and crater ladder.
- `game/src/core/terrain/noise.ts`: crater-layer lattices, if needed.
- `game/src/core/terrain/spherify.ts`: cube-sphere mapping at deep levels (precision check).
- `game/src/workers/terrainWorker.ts`: chunk build on the instance, chunk-local positions, per-layer prune.
- `game/src/render/TerrainMeshPool.ts`: pool ≤ worker sets, drop accounting (F5d), worker count (2 or 4).
- `game/src/play/world/MoonLod.ts`: lazy quadtree, node pool, leaf budget, `MAX_LEVEL` from R.
- `game/src/play/world/moonConfig.ts`: R, μ, profile params, derived bounds, KCC config.
- `game/src/play/world/moonWorld.ts`: world build, occluder sphere, LOD wiring.
- `game/src/play/world/spawn.ts`: spawn search at real R.
- `game/src/play/world/skyState.ts`, `game/src/play/world/moonMaterial.ts`: check for scale-dependent terms.
- `game/src/play/camera/ThirdPersonCamera.ts`: clearance probe bounds.
- `game/src/play/PlayPage.tsx`: camera `near` 0.1 / `far` 3,000 m, sized for the small Moon; at about 100 km LOD reach the far plane and depth scheme change (S8).
- `game/src/core/physics/flightController.ts`: DDA sweep lattice `DDA_LATTICE` 2048 cells per face side (2.7–4.9 m arc at today's R; about 0.6–1.2 km at R = 1,737 km, calc) is R-dependent and is derived from R in S7 (shared with the m1d harness, so the harness value stays bit-identical).
- Terrain service consumers (F5a API change only, behaviour unchanged): `game/src/core/physics/astronautKCC.ts`, `game/src/core/physics/flightController.ts`, `game/src/play/controller/PlayerController.ts`, `game/src/play/frame/playFrame.ts`, `game/src/play/character/CharacterTelemetry.ts`, `game/src/test/Milestone1C_TestHarness.tsx`, `game/src/test/Milestone1D_TestHarness.tsx`, `game/src/test/Milestone1E_TestHarness.tsx`, `game/src/test/Milestone1F_TestHarness.tsx`, `game/src/test/M1fR2Gate.tsx`.
- Gates to re-pin or extend: `game/tools/test-play-lod.mjs`, `game/tools/test-play-spawn.mjs`, `game/tools/test-play-world.mjs`, `game/tools/test-moon-profile.mjs`, `game/tools/test-alloc-gate.mjs`, `game/tools/test-kcc-gate.mjs`, `game/tools/test-kcc-default-trace.mjs`, `game/tools/test-seam-gate.mjs`, `game/tools/test-flight-gate.mjs`, `game/tools/check-play-frametime.mjs`, `game/tools/test-play-perf.mjs`, `game/e2e/play.spec.ts`. New gates are named in Steps.
- Docs: ADR-031 (fold), one ADR per significant step decision, `notes/CHANGES.md`.
## Steps (one commit each; verify per the next section)
Each step is one §12 session unit. If a step will not fit in one session, it is split as `<id>a` / `<id>b` (brief §12). Every step commit also checks its box, updates the tracker row and repoints STATE.md NEXT ACTION (brief §6).
- [x] **P0** Plan (this file), ADR-031, tracker and STATE.md (session 157).
- [x] **S1a — F5a part 1: per-body terrain instance.** `TerrainField` becomes an instance created per body: params, Moon tables, scratch vectors and the noise permutation tables move off module scope (`terrainField.ts` P, _bas, _crt, _mask, _rim, _sp, _sm, _cd; `noise.ts` perm, permMod12). `initTerrainField` returns the instance. The module functions stay as thin wrappers over a default instance, so the 35 call sites (S1 baseline) are unchanged and output is bit-identical (`test-moon-profile` SHA-256 pins). A new `test-kcc-gate` row shows that a second body's init leaves the Moon KCC trace bit-identical.
- [x] **S1ba — F5a part 2a: sky and normal scratch.** Root cause of the play.idle churn: V8 boxes a HeapNumber for every double stored into a shared `{x,y,z}` scratch (and for double returns from non-inlined calls). `applySkyState` chunk loop computes the rotation in locals; `terrainNormalInto` uses a Float64Array scratch. Bit-identical (moon-profile SHA pins, KCC traces). Plain alloc-gate 9,778 → 4,854 B/frame idle (`docs/evidence/T5/S1ba.txt`).
- [x] **S1bba — F5a part 2b-1: terrain height path.** `SimplexNoise` and `TerrainField` pass the inner chain's doubles through Float64Array I/O slots (`io`, `_io`) instead of args/returns (noise3/fbm3/ridged3, fieldHeight, basins, craterLayer, moonHeight, sampleSurface); public signatures unchanged. Bit-identical (moon-profile SHA pins 16/16, kcc-gate 14/14). Plain alloc-gate 4,856 → 2,553 B/frame idle (`docs/evidence/T5/S1bba.txt`).
- [x] **S1bbba — F5a part 2b-2a: camera pose path.** `ThirdPersonCamera.poseInto` inlines the spin rotation, reads terrain height through the `TerrainField.io` slots (`heightFromIo`), and builds the camera quat with `lookAtQuatIo` (Float64Array inputs, `quatFromFrameInto` inlined); `Math.hypot` → `hypot3` (`sphericalFrame.ts`, same algorithm as V8's MathHypot, bit-identical on 5e6 triples + edges). Plain alloc-gate 2,537 → 1,913 B/frame idle (`docs/evidence/T5/S1bbba.txt`).
- [x] **S1bbbba — F5a part 2b-2b-1: class-backed vectors.** Root cause of most of the remaining play.idle churn: the `{x,y,z}` object-literal hidden class is shared bundle-wide and generalised to tagged fields, so every double stored into a literal-backed Vec3 boxes a HeapNumber (~48 B per store, standalone probe). New `Vec3d`/`Quatd` classes in `sphericalFrame.ts` own their hidden class and keep unboxed double fields; every boot-allocated numeric `{x,y,z}`/`{x,y,z,w}` in KeplerRail, playFrame, ThirdPersonCamera, skyState (+ `SkyGeo` for `SkyGeometry`), astronautKCC, SimulationCore, PlayerController and CharacterTelemetry uses them; `hypot3` in applySkyState and sampleTelemetry. Constructors only, no arithmetic change: bit-identical. `alloc-lib` churn mutant moved to private keys + doubles (it relied on the polluted map). Plain alloc-gate 1,910 → 1,146 B/frame idle (`docs/evidence/T5/S1bbbba.txt`).
- [x] **S1bbbbba — F5a part 2b-2b-2a: unboxed call boundaries.** Root cause of most of the remaining playFrame/applySkyState churn: a double passed as an ARGUMENT to a non-inlined call is boxed into a fresh HeapNumber at the call site (standalone probe, 7 args under `--no-turbo-inlining`: 130.5 B/call vs 16.5 via Float64Array slots, 16.3 Smi control). `applySkyStateIo` (pose in `SKY_POSE_IO`) and `SkyImpostorPool.updateIo` (`SKY_UPDATE_IO`) take Float64Array slots; the old signatures stay as wrappers for the tests; playFrame inlines its two rotateByQuat calls (same arithmetic order). Bit-identical. Plain alloc-gate 1,146 → 889 B/frame idle, 1,637 → 1,363 walk. Evidence `docs/evidence/T5/S1bbbbba.txt`.
- [x] **S1bbbbbba — F5a part 2b-2b-2b-1: call-boundary recon.** Inlining trace of playFrame and the list of double args it still passes to non-inlined calls; design: hot callees read dt from a `{ readonly dt: number }` source (PlayClock fields) instead of a double arg, numeric forms stay as wrappers until consumers migrate (`docs/evidence/T5/S1bbbbbba.txt`). No code change.
- [x] **S1bbbbbbba — F5a part 2b-2b-2b-2a: dt and LOD call boundaries.** Hot callees read dt from a `DtSource` (PlayClock; `core/simulation/dtSource.ts`, play-local `AnimDtSource` for the animator): `advanceFrom`, `simulateFrom`, `sampleTelemetryFrom`, `updateFrom`/`stepFrom`, `poseFrom`, `HudPublisher.stepFrom` (PlayClock gains `delta`); `MoonLod.updateIo` reads `camIo` slots. Numeric forms stay as wrappers. Bit-identical. Plain alloc-gate 810.9 B/frame idle (890.5 base), 1280.0 walk (`docs/evidence/T5/S1bbbbbbba.txt`).
- [ ] **S1bbbbbbbb — F5a part 2b-2b-2b-2b: zero allocation, rest of play.idle.** Remove the remaining per-frame allocation (playFrame, applySkyState incl. chunkArcWidth/impostorMath/SkyImpostorPool returns, ThirdPersonCamera.poseInto, animStateMachine.step, ProceduralAnimator idlePose/blendPose/writeOut, KCC `_groundedTick`/`_flightTick`, terrainField hash01 returns, KeplerRail wrapAngle), with an ADR-002 amendment if the gate's scope note changes. Migrate the consumers off the wrappers. Restore the strict real-tree churn check in `test-alloc-gate` (F3a follow-up 4). Closes F5a.
- [ ] **S2 — F5b: normals and height bound.** Replace the fixed `NORMAL_EPS` with analytic normals where the profile terms allow, and a level-matched ε elsewhere. Derive the height bound and slack from the params, replacing the hand-typed `MAX_TERRAIN_H` 360 and `HEIGHT_SLACK` 420. Set the DDA slope bound from measurement. Add gate `tools/test-terrain-normals.mjs`. Closes F5b.
- [ ] **S3 — Lazy LOD.** `MoonLod` grows its quadtree from a boot-allocated node pool, replacing the 341-node-per-face preallocated tree. `MAX_LEVEL` is derived from R and the target quad size (about 2 m). At today's R the selected leaf set must equal the old tree's on the pinned camera paths, so play is unchanged. Write the `test-play-lod` replacement pins first (pool size, max level, leaf-set equality), then retire the 341/2,046 pins.
- [ ] **S4 — F5d: pool, drop accounting, leaf budget.** Mesh pool size ≤ worker sets. Every dropped chunk request is counted and its stale ownership removed. A leaf budget falls back to coarser leaves when the request set exceeds it. Closes F5d.
- [ ] **S5 — Metre-scale crater ladder (candidate).** A profile in metres: crater layers on a power-law ladder (N(>D) ∝ D⁻²) from about 50 km down to about 2 m, each layer on its own lattice with its own prune, plus metre-scale fBm and km-scale mare rims and floors. As in T3 S1, the candidate lives in `test-moon-profile` and is evaluated at R = 1,737 km; play is not wired yet. ADR-028 amendment.
- [ ] **S6 — GPU precision gate.** Gate `tools/test-gpu-precision.mjs` measures the worker's Float32 chunk-local vertex error against Float64 positions for every LOD level at R = 1.737e6 m, and checks the cube-sphere mapping (`spherify.ts`) at the deepest level. If a level fails, move it to camera-relative positions in the same step.
- [ ] **S7 — Real size.** `MOON_PARAMS.radius` = 1,737,000 m with the S5 profile wired. `MOON_MU` = 1.62·R². Set the KCC `gravityRange`, derived bounds, occluder sphere and camera clearance bounds for the new R. Derive `DDA_LATTICE` from R so the face cells stay at metre scale (`test-flight-gate` stays green on its own fixture). Re-derive the spawn search in metres; the spawn stays on a mare floor with the ruled Earth framing (ADR-017). Write the replacement pins first (test-play-spawn, test-play-world, test-kcc-default-trace moon trace, `e2e/play.spec.ts`), then retire the old ones, and list every re-pin in the commit.
- [ ] **S8 — F5c and performance at final R.** Drawn and collision terrain agree near the actor at every LOD level. Frame time and heap are measured A/B against 787b9d4. A whole-Moon view from orbit still composes (rebase 1,024 m, `MID_FAR_LIMIT` 300 km). If the frame time is over budget, tune worker count (2 or 4), prune and leaf budget in this step. Closes F5c.
- [ ] **S9 — Close-out.** The full matrix on the S8 commit, then the Lead's play acceptance, then a fast-forward into `main` and push (brief §4).

## Verification per step
**MATRIX (M)**, from `game/`, exit codes unpiped, the same set as the T4 S8 close-out:
- `npx tsc --noEmit` and `npm run build`.
- The nine play Node tests (`node --expose-gc tools/test-play-{anim,controller,frame,lod,perf,rig,shell,spawn,world}.mjs`).
- `test-moon-profile` and `test-moon-material`, both plain and `--self-test`.
- `test-kcc-default-trace` and `test-kcc-gate`.
- The F-gates: orbit, precision, seam, flight, scale-law, rail-validation, real-body-data and spin-law.
- `test-alloc-gate --self-test` and `test-alloc-loops --self-test`.
- `npx playwright test e2e/play.spec.ts e2e/m1e.spec.ts e2e/m1f-r` (R5 waived, R3 at its pinned known-red vector).
- `node tools/check-repo-refs.mjs --max 100000`.
Steps that touch shared terrain, KCC or render code also run `e2e/m1a`…`m1d` (brief §3). Each step commits one evidence summary of at most 5 KB, `docs/evidence/T5/S<n>.txt` (ADR-030; the directory was created with `S1-baseline.txt`), and lists every re-pin in its commit body.

| Step | Step-specific checks (expected) | Plus |
|---|---|---|
| S1a | `test-moon-profile` SHA-256 pins unchanged (bit-identical field). The new `test-kcc-gate` row shows a second body's init leaves the Moon KCC trace bit-identical. Plain `test-alloc-gate` bytes reported, with no rise over the S1 baseline | M + m1a–m1d |
| S1b | Plain `test-alloc-gate.mjs` exits 0, with play.idle per-frame bytes reported before (9,914.0 B/frame, S1 baseline) and after (§13 safeguard 4). The strict churn check is back and green | M + m1a–m1d |
| S2 | `test-terrain-normals` shows converged-site normal error below its bound at every LOD level, with self-test mutants (old fixed ε, under-sized height bound, loosened STEEP bound; from U27b4ba via `game/tools/audit/u27-k4-recheck.mjs`) red. `test-kcc-gate` and `test-kcc-default-trace` stay green, or each re-pin is listed with its cause | M + m1a–m1d |
| S3 | The replacement `test-play-lod` pins pass, with leaf-set equality to the old tree on the pinned paths. `test-play-perf` heap delta is ≈ 0, `test-seam-gate` passes, and `check-play-frametime` A/B against S2 has median ≤ 1.05× | M |
| S4 | The 144-on-96 drop mutant is red and shipped green. Drop counters balance and no stale ownership is left after a stress path. Over budget, the leaf set coarsens rather than dropping (new `test-play-lod` rows). `test-alloc-gate` plain stays 0 | M |
| S5 | `test-moon-profile` candidate rows pass: size-frequency slope within ±10 % of −2 per layer, spawn mare-floor slope < 2° within 60 m, rim relief at km scale, and per-vertex cost ratio against the S4 profile recorded. `--self-test` mutants (flat ladder, missing layer) are red | M |
| S6 | `test-gpu-precision` shows the maximum vertex error at every level below 1 mm (or the camera-relative fix lands and then passes). Its self-test mutant (absolute-coordinate Float32 positions) is red | M |
| S7 | The re-pinned spawn, world, KCC trace and play.spec pass. The spawn slope and Earth framing are recorded. Under §13 safeguard 3, the replacement pin is green in the same commit that retires each old pin | M + m1a–m1d |
| S8 | The F5c agreement gate (triangle vs analytic near the actor, baseline median 0.458 m at L4) passes at every level at final R. `check-play-frametime` A/B against 787b9d4 has median ≤ 1.05× at the spawn and at a rim site, and `test-play-perf` heap delta is ≈ 0. Orbit view composes (screenshot check, not committed) | M + m1a–m1d |
| S9 | Full M on the S8 commit, all green apart from the known reds above. Then the Lead's play acceptance, a fast-forward merge and push | — |

## Risks & open decisions
- **Frame time.** More crater layers cost more per vertex (terrain evaluation already costs 1.88× pre-T3, ADR-028). Mitigations are per-layer prune, the leaf budget and 4 workers. S5 records the cost ratio early, and S8 is the hard gate.
- **Depth precision at about 100 km LOD reach.** `PlayPage.tsx` sets camera `far` = 3,000 m, so terrain beyond 3 km would be clipped at real size. S8 raises the far plane to the LOD reach and checks distant relief for z-fighting (near 0.1 m to far about 100 km is a 10⁶ ratio). A logarithmic or reversed depth buffer is the fallback, decided with an ADR in that step.
- **KCC at real size.** `gravityRange`, snap and sweep bounds were tuned at R = 1,364.5 m. The S7 KCC trace re-pin may surface slope or step behaviour changes. Ratified rules (step/slope, C¹ cap) change only with an ADR (§13).
- **Spawn search cost.** The boot-only search (about 159 ms today) scales with probe count. S7 keeps it boot-only and records its time.
- **Harness pages.** The milestone pages keep R = 1,364.5 m fixtures. If an S1–S4 service change alters them, it is a regression to fix in that step (brief §3).
- **Walk time.** Walking to the horizon takes about 12 minutes at 3.2 m/s (calc). Faster travel is a T6 look-and-feel question (`docs/T5-T6-ideas.md` §5), not T5.
- **Open decisions for the Lead:** none. Real size and real g are ruled (b), and T5 has no open look-and-feel question (`docs/T5-T6-ideas.md` §5).