# A1 — ENGINE AUDIT (read-only) — PLAN

- Task: **A1** · Branch: `a1-engine-audit` (cut from `t1-playable-moon` @ 256d77d)
- Stage: **BUILDING** (plan READY 7/7; Lead execute order 2026-10-21, APPROVAL LEDGER)
- Last updated: 2026-10-26
- **Resume at the FIRST UNCHECKED BOX** (§5). Default one unit/session/commit; rechecks may batch related findings per §6.5.
- Binding rules for this task: AGENT_BRIEF.md §11 AUDIT MODE.

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

## 1. Goal
Find out, with evidence, what is wrong in the SOLARIS specs, engine, play layer and
test gates. The specs were written by GLM 5.3 and the engine by GLM 5.3 Flash
(Lead, 2026-10-21). Deliver `docs/audit/FINDINGS.md`: ranked findings, each with a
repro and a proposed fix task sized to fit one 50-OLU session. The Lead triages
the findings at the LEAD GATE.

Yardstick (AGENT_BRIEF §13): judge everything against the project goal — a
real-looking solar system where every planet and moon rotates and orbits in real
time, on an optimised, flexible engine that can take future features (e.g. alien
combat) without a rewrite. Recommending a major rework is acceptable when it is
clearly better.

## 2. Scope IN
- Test gates first, so later fixes can be trusted: `game/src/test/*`,
  `game/e2e/*`, `game/playwright.config.ts`, `game/tools/test-play-*.mjs`.
  - Question for every row: can it fail when the property it claims is broken?
- Specs: `Design_specs/*.txt` and `Milestone/*.txt`.
  - Check physics and math against first principles, and against real data where
    the spec claims real data.
- Engine: `game/src/core/**`, `game/src/render/**`, `game/src/workers/**`.
- Play layer: `game/src/play/**`, `game/src/store/**`, routing (`main.tsx`,
  `App.tsx`).
- Cross-cutting invariants (AGENT_BRIEF §3). Audit whether each one holds AND
  whether it is a good rule.
- New, independent probes written from the spec or physics, never from the code
  under test. They live in `game/tools/audit/`.

## 3. Scope OUT
- Any edit to `game/src/**`, `game/e2e/**`, `game/playwright.config.ts`,
  `Milestone/**`, `Design_specs/**`. Fixes happen in later tasks F1, F2, … after the
  Lead triages.
- Re-litigating T1's design. Audit the T1 play code as code; T1's Q1–Q8 rulings
  stand unless a finding shows they rest on a defect.
- MS 1G (deferred). Performance tuning beyond flagging a measured problem.

## 4. Affected modules
Written: `docs/A1-plan.md`, `docs/audit/**`, `game/tools/audit/**` (new files only),
`notes/task.md`, `notes/STATE.md`. Read: everything listed in §2.

## 5. Steps (audit units — in order; recheck batching per §6.5)
Every unit writes `docs/audit/Uxx-<slug>.md` per §6.3. Each unit's **Verification**
is §6.4 plus the unit's own evidence line. Line counts are given so a session can
see that the unit fits its budget.

### Phase A — Gate health (do these first)
- [x] **U01 m1f baseline diagnosis** — DONE (`docs/audit/U01-m1f-baseline.md`: real defect, not env; R2 regressed at 3057899) (needs an 8 GB VM; at most 3 m1f runs)
  - Run `npx playwright test e2e/m1f.spec.ts` on the unedited tree and capture
    **R2's full detail string**. Session 46 recorded R3's detail but not R2's.
  - Classify the cause:
    - (i) the Sun was culled at the suite pose. `LIVE_SECONDS = 120` is wall
      time (harness ~1394), so the end pose may depend on machine speed (see
      `notes/reports/M1F.md` §15.4);
    - (ii) the MSAA render target readback was blank under SwiftShader;
    - (iii) a real defect.
  - Evidence: badges plus the R2/R3 detail strings from each run, and the
    Sun elevation at the suite pose (logged by a probe page or a console
    read, not by a harness edit).
  - Also answer T1-B11's blocker: is the baseline red because of the
    environment, yes or no?
- [x] **U02 m1f R1 + R2 validity** — DONE (`docs/audit/U02-m1f-r1r2-validity.md`: R1 + R2(a) cannot fail on their claims; only R2(b) is a real check) (`Milestone1F_TestHarness.tsx` R1/R2 blocks, ~981–1180; Milestone 1F grep)
  - Seeds:
    - The R2 θ audit compares `diskTheta(alpha=1)` with θ, so it can never
      fail.
    - The doc comment says ±12% / 1 px, but the code checks ±15% / 1.5 px.
    - `abRender` returns its last buffer after 6 retries without flagging it.
    - Can R1's single-camera counterfactual distinguish a broken layering?
- [x] **U03 m1f R3 + R4 + R5 validity** — DONE (`docs/audit/U03-m1f-r3r4r5-validity.md`: R3 hole/double are tautologies hiding a real 5.6 km descending handoff hole; R3(c) window saturated; R4 canary unused; R5 ≥2 rebases unreachable by the SAT_B fixture) (harness ~1180–1300, R4/R5 blocks; `m1fStraddle.ts`; M1F.md §12–§15 as claims)
  - Seeds:
    - R3's threshold went from 45 to 8 (round 6b). Is it now testing the
      fixture instead of the handoff?
    - R4's heap rows got longer warm-ups.
    - R5: independently verify the claim that its spawn corridor is
      "unmeetable" (§15.3). Is the gate wrong, or the terrain, or the KCC?
- [x] **U04 m1e harness validity** — DONE (`docs/audit/U04-m1e-harness-validity.md`: R5 Coriolis passes on a mis-measured 0.75 cm (true ≈1.9 cm; KCC physics fine); penetration clauses vacuous; R1 misses 4° yaw snaps; R4 canary tautological + heap verdict GC-dependent) (`Milestone1E_TestHarness.tsx` 1,570; `e2e/m1e.spec.ts`; Milestone 1E grep)
- [x] **U05a m1d reading pass** — DONE (`docs/audit/U05a-m1d-harness-reading.md`: harness + flightController tick/DDA read; 8 probe seeds, no findings yet — session cut short, Lead low balance)
- [x] **U05b m1d harness probes + findings** — DONE (`docs/audit/U05-m1d-harness-validity.md`: T1 cannot fail on C∞/Mach/wind claims; T2 verdict fps-dependent (15 fps FAIL); T4 heap clause = GC noise + passes negatives; T4 canary + T5 offset tautological) (`game/tools/audit/u05-m1d-validity.mjs`)
- [x] **U05c m1d DDA penetration + analytic dive + remaining reads** — DONE (`docs/audit/U05-m1d-harness-validity.md` §U05c: T2 passes with an endpoint-only sweep; DDA no-clip proof assumes slope 1.2, measured 6.4; a_struct exceeded 6.9×; g-load excludes drag; v@1000 confirmed by RK4) (DDA mutation: coarsen `DDA_MAX_GAP` / disable `_sweepTerrain` — can T2 or minPostTickAGL fail?; independent drag+gravity integration for v@1000; read flightController 60–355 + 580–750, aerodynamics.ts, atmosphere.ts, harness 1000–1182, Milestone 1D grep; append to `docs/audit/U05-m1d-harness-validity.md`)
- [x] **U06 m1c harness validity** — DONE (`docs/audit/U06-m1c-harness-validity.md`: T3 never compares the 12 cube-face seams — inverted face-edge normals pass; level-gap-2 T-junctions occur and are unaudited; T2 alloc clause zero by construction; T4 heap N/A/negative passes; harness LOD leaves merged children desired; engine seams + skirts clean) (`Milestone1C_TestHarness.tsx` 1,006; Milestone 1C grep)
- [x] **U07 m1b harness validity** — DONE (`docs/audit/U07-m1b-harness-validity.md`: no row checks the orbital time scale (n×2 passes all 5 rows; Kepler-3 is a tautology); T1 reference re-uses the rail basis — reversed orbit direction passes all rows; zero-gc verdict GC-dependent; vis-viva clause an identity and skips moons; log line prints literal `{…}`; period table stale ≤ 11 s) (`Milestone1B_TestHarness.tsx` 1,286; Milestone 1B grep; `game/tools/audit/u07-m1b-validity.mjs`)
- [x] **U08a m1a harness rows + m1b spec mutations** — DONE (`docs/audit/U08-e2e-spec-sensitivity.md`: m1b spec passes on pageerror, console.error, placeholder badges, dropped row, TS type error; m1a T2–T4 read the engine's own constants — thresholds 900–1100 and lattices 64–1000 pass all rows; f32-before-subtract and stale static beacons pass; T5 drops ≥250 ms stalls and flags the wrong rebase frame; verdict/detail text literal `{…}`) (`game/tools/audit/u08-spec-sensitivity.sh`, `u08-spec-mutate.mjs`, `u08-m1a-validity.mjs`)
- [x] **U08b e2e mutation runs for m1a, m1c–m1f + plumbing** — DONE (A1-U08-9: `ERR` badges with a PASSED line pass m1a/c/d/e, incl. a really red m1d row; pageerror passes m1a/c/e; A1-U08-10: m1f no verdict in 240 s on 2 vCPU/4 GB; port-in-use and `npm test` propagation fine; `game/tools/audit/u08b-spec-sensitivity.sh`, `u08b-spec-mutate.mjs`) (all `e2e/*.spec.ts`; `playwright.config.ts`; scope = "Not yet checked" in `docs/audit/U08-e2e-spec-sensitivity.md`)
  - Parameterise `u08-spec-sensitivity.sh` per spec (harness path + mutation anchors) and run m1a, m1c–m1f.
  - Badge-text-change mutation; port-in-use; `npm test` failure propagation; global 300 s timeout vs m1f.
- [x] **U09 play-layer Node tests** (`game/tools/test-play-*.mjs`, `check-play-*.mjs`) — DONE (`docs/audit/U09-play-node-tests.md`: heap rows measure after gc() and cannot see per-frame allocation — ~4 KB/frame of garbage passes perf 19/19 (S1); controller camera row red from a cold h0, not a leak — warm-up makes it green 4/4 (S2); only perf checks the §13.2 trend clause (S2); buffer bracket [0.10, 0.20) (S3); vacuous no-gc row + output format (S3); check-play-* NOT RUN, no chromium; `game/tools/audit/u09-play-node-validity.mjs`)
  - Assertions vs the claims in `docs/T1-plan.md` §13.
  - Flaky heap rows: is each one a real leak or a bad bound?

### Phase B — Specs
- [x] **U10a Design_specs 02 + catalog/play scale** — DONE (`docs/audit/U10-design-specs-scale.md`: spec 02 lost every formula (9 empty slots); catalog radii follow two laws — Mars < Mercury, Charon/Titania > Moon; Earth 14.7° wide in the Moon sky (real 1.9°); play Moon 1:1,273 with real g — horizon 66 m, relief 26 % of R; `game/tools/audit/u10a-scale-sanity.mjs`)
- [x] **U10b Design_specs cross-spec sanity** — DONE (`docs/audit/U10-design-specs-scale.md` §U10b: speed cap has no frame — every planet outruns 2,000 m/s at 30× (S1); day longer than a year (S2); spec 05 1B "real-world positions" impossible (S2); gravityRange ≠ SOI, Sun has no range (S2); atmospheres up to 160 % of R (S2); specs built on Rapier (S2); 4× S3; look-and-feel question on orbit speed; `game/tools/audit/u10b-cross-spec.mjs`) (specs 00, 01, 03, 04, 05 in full, ~355 lines)
  - Do the specs contradict each other (and spec 02)?
  - Floating-origin lattice (256 m / rebase 1,024 m) vs body scale (Moon R 1,364.5 m); 30× time scale vs orbit periods; gravityRange vs SOI/Hill; atmosphere heights; artistic Sun 20,000 m and portalDist 80,000 m.
  - Append to `docs/audit/U10-design-specs-scale.md` (findings A1-U10-5…).

### Phase C — Engine core (spec grep per module: see the table in §6.2)
- [x] **U11 precision + floating origin** — DONE (`docs/audit/U11-precision-floating-origin.md`: adapter never re-shows a re-registered entity (S2); unregistering the focus silently re-focuses entities[0] and rebases there (S2); live writable origin breaks Δ (S3); power-of-two rationale overstated — render exactness comes from subtract-then-narrow order, Δ f32-exact to 2^32 m (S3); lattice, order, ≤128 post-tick bound clean; `game/tools/audit/u11-precision-origin.mjs`) (`core/math/precisionMath.ts` 170, `core/types.ts` 123, `render/FloatingOriginAdapter.ts` 118; Milestone 1A)
- [x] **U12 orbits + catalog** — DONE (`docs/audit/U12-orbits-catalog.md`: no body rotates — no spin rail, pole or prime meridian; the only spin is a KCC-private integrated scalar (S1); rail accepts e ≥ 1 / a < 0 and goes NaN silently (S2); all 16 orbits circular + coplanar (S2); Newton exit never met at e ≥ 0.9999, accuracy fine (S3); wrapAngle range [−π, π) (S3); Triton g 8 % off its mass fact (S3); catalog = spec 03 except moon portalDist (U10-12); `game/tools/audit/u12-orbits-catalog.mjs`) (`core/orbit/celestialData.ts` 261, `KeplerRail.ts` 254, `types.ts` 105; Milestone 1B)
  - Check Kepler solver convergence and edge cases (e → 1, M near π).
  - Check that catalog values match their stated sources.
  - Does every body also ROTATE (sidereal period, obliquity, prime meridian),
    not just orbit? The goal requires both.
- [x] **U13 SimulationCore** — DONE (`docs/audit/U13-simulation-core.md`: the tick has no parented-compose step — the play world only works with the sky frozen (S1); controller + core accumulators disagree on 16.7 % of 144 Hz frames (S1); below 12 fps the game slows down, no load shedding, `shedSeconds` misses the 0.25 s clamp (S2); no interpolation alpha (S2); a self-unsubscribing rebase listener skips the next one (S2); `moonWorld` ticks the core directly (S3); ≈1.6 B/tick, not 0 (S3); integrate-then-rebase order, clocks, guards clean; `game/tools/audit/u13-simulation-core.mjs`, `u13b-lockstep-gc.mjs`) (`core/simulation/SimulationCore.ts` 486)
  - Is the tick order correct? Check fixed-step accumulation, the
    spiral-of-death guard and time-scale handling.
- [x] **U14 terrain field** — DONE (`docs/audit/U14-terrain-field.md`: fixed ε 0.002 rad normals wrong by degrees on the Moon — p50 3.2°, p99 60°, not converged (S1); m1e STEEP field reaches 2,216 m vs KCC maxTerrainHeight 900 — bounds hand-typed (S1); normal frame flips → 37° jumps (S2); height/normal path allocates (S2, likely); spherify distortion 2× not √2, chunkArcWidth not conservative (S3); chunkKey collides at L9, seed aliasing, singleton field (S3); seams/determinism/inverse clean; `game/tools/audit/u14-terrain-field.mjs`, `u14b-normals-gc.mjs`) (`core/terrain/noise.ts` 134, `spherify.ts` 112, `terrainField.ts` 232; Milestone 1C)
  - Check determinism, seams, the max-height bound and the spherify
    distortion.
- [x] **U15 spherical frame + impostor math** — DONE (`docs/audit/U15-spherical-frame-impostor.md`: "parallel transport" is Gram-Schmidt projection, not reversible — up jitter turns into heading drift (S2); below-horizon cull allowance 0.03 rad < eye dip 0.049–0.17 rad (S2); camera-facing impostor quads squash big bodies up to 31 % off-axis (S1); staged-rank occlusion inverts off-axis (S1); unclamped tan law (S3); header numbers wrong (S3); `game/tools/audit/u15-frame-impostor.mjs`, `u15b-occlusion-flip.mjs`) (`core/physics/sphericalFrame.ts` 249, `core/render/impostorMath.ts` 171)
  - Is parallel transport correct? Does drift accumulate? Is the projection
    correct?
- [x] **U16 astronautKCC part 1** — DONE (`docs/audit/U16-astronautkcc-part1.md`: the ratified 50° walk limit is really ≈56–59° because the ratio is measured along the tilted fwd (S1); on the spin-phase wrap tick the sweep samples a whole turn — 66 % false landings (S1); grounded velocity is commanded, not realised (S2); the NaN guard keeps a NaN vCtl, so the controller stays dead (S2); jump along the ε-normal, up to 4.1 m/s sideways (S2); stepHeight never binds (S3); slide 45° and walk 50° bands overlap (S3); `game/tools/audit/u16-kcc-step-rule.mjs`, `u16b-kcc-wrap-nan-blocked.mjs`) (`core/physics/astronautKCC.ts` lines 1–560)
  - Covers config, ground probe, step/slope rule (ratified) and sweeps.
- [x] **U17 astronautKCC part 2** — DONE (`docs/audit/U17-astronautkcc-part2.md`: airborne/zero-G up blends to the WORLD radial (S1, latent at Ω=0); vehicle tick writes up/fwd in world frame (S2); every landing snaps the frame up to 51° (S1); slide stops 15–28× harder than μk·g (S2); airborne altAGL off up to 56 m (S2); landing drops strafe (S2); 3× S3 — the C¹ cap is not in the KCC, moved to U18; `game/tools/audit/u17-kcc-part2.mjs`) (lines 560–1114)
  - Covers jump/landing, sliding, airborne flight, the C¹ speed cap
    (ratified) and integrity.
- [x] **U18 flightController** — DONE (`docs/audit/U18-flight-controller.md`: yaw and roll mirrored — body +Z = X×Y is right, not left, so D/→ steer left (S1); the C¹ cap also fades retro thrust — no braking near 2,000 m/s (S1, RATIFIED); planet spin splits air/LANDED (rotating) from terrain/gravity (inertial) — parked ship slides 179 m/10 s (S1, latent); NaN input latches angVel, observer sees NaN (S2); 2,025 rescale reachable on Jupiter/Saturn/Uranus/Neptune (S2); telemetry pressure ignores tempFloor (S3); `game/tools/audit/u18-flight-controller.mjs`) (`core/physics/flightController.ts` 750; Milestone 1D)
  - Includes the C¹ 2,000 m/s thrust fade (RATIFIED; moved here from U17, A1-U17-9) and the frame-convention check seeded by A1-U17-1.
- [x] **U19 aerodynamics + atmosphere** — DONE (`docs/audit/U19-aero-atmosphere.md`: atmosphere not hydrostatic — H 1,200 m implies g 68.9 (7× planet), HUD dP/dh 6.3–7.1× ρg (S2); governor slow arrival only for Earth ρ0·H — real ρ0: Mars 1,865 m/s, Pluto 2,014 m/s at terrain, Venus never lands (S1, T2); any touchdown speed lands — 124 m/s → LANDED in one tick (S1, T2); one profile for every body, catalog atmosphereHeight unused, no cruise/boost regime (S1, T2); lift ungoverned 112.5 > a_struct 90 (S2); lift step at 15 m/s (S3); doc errors (S3); two look-and-feel questions to the Lead; `game/tools/audit/u19-aero-atmosphere.mjs`) (`aerodynamics.ts` 136, `atmosphere.ts` 120; Milestone 1B/1D)
  - Lead 2026-10-23: also check the T2 requirement (notes/task.md): per-body real atmospheres (catalog `atmosphereHeight` is unused; one EARTHSCALE profile), manual atmosphere-affected landing, 2,000 m/s as deep-space-only.

### Phase D — Render + workers
- [x] **U20 terrain meshing + worker** — DONE (`docs/audit/U20-terrain-meshing-worker.md`: the "free set always exists" bound is wrong — 144 meshes on 96 sets drop requests and the LOD keeps dead `pendingRec`s, holes on 5,843/7,200 frames, 194 nodes fake data, no gate reads `drops`; play/1F safe only at meshCount = sets (S1); worker 0 does almost all generation, 94/16 (S2); receive-path garbage unmeasured (S3); `game/tools/audit/u20-mesh-pool-worker.mjs`) (`render/TerrainMeshPool.ts` 447, `workers/terrainWorker.ts` 256)
  - Check LOD cracks, pool exhaustion and worker message races.
- [x] **U21 camera rig + sky impostors** — DONE (`docs/audit/U21-camera-rig-sky-impostors.md`: mesh↔impostor handoff + hysteresis exist only in the 1F harness, play has no swap (S1); Near pass paints over Mid-only objects in the 2,400–3,000 m overlap (S2, RATIFIED bands); meshes past 300 km clipped or drawn by no pass (S2); impostor fade shrinks an opaque disk instead of fading (S2); 3× S3; `game/tools/audit/u21-camera-sky.mjs`) (`render/MultiCameraRig.tsx` 217, `render/SkyImpostorPool.ts` 326; Milestone 1F)
  - Are the layered bands (ratified) right? Check the depth handoff and the
    hysteresis.

### Phase E — Play layer
- [x] **U22 play world** — DONE (`docs/audit/U22-play-world.md`: drawn terrain ≠ collision terrain — L4 4.19 m mesh vs analytic height, edge-midpoint |err| p50 0.22 / p99 3.9 / max 12.9 m, diagonals max 26 m (S1); LOD selects 125 leaves for 96 meshes at the spawn — 31 holes 1.0–1.9 km, terrain-occluded at the eye, loading gate blind (S2); brad 1.5–2.2× the real extent (S3); spawn early exit unreachable, 24,000 iterations always, tangent-less roughness probes (S3); `game/tools/audit/u22-play-world.mjs`) (`play/world/*` ~720)
  - Check the boot, LOD, spawn and sky state.
- [x] **U23 controller, camera, input, frame** — DONE (`docs/audit/U23-controller-camera-input-frame.md`: below 12 fps the game runs slow — PlayClock 0.1 s + 5 substeps, 10 fps 0.83×, 5 fps 0.42× (S2); FP yaw moves on 600/1440 frames at 144 Hz (tick cadence) (S2); camera clears the analytic height but the drawn L4 mesh is > 0.4 m higher at 22.9 % of edge midpoints, up to 6.25 m (S2, likely); 4-point boom cut misses ridges — pivot hidden on 0.58 % of poses, up to 2.19 m (S2); heading ∥ up → zero heading, no movement (S3); wheel deltaMode ignored (S3); signs NOT mirrored, 12–144 fps independent, analytic clearance 0.400 m clean; `game/tools/audit/u23-controller-camera.mjs`) (`play/controller`, `play/camera`, `play/input`, `play/frame` ~750)
- [x] **U24 character** — DONE (`docs/audit/U24-character.md`: stance foot floats 9–14 cm at run/sprint and sinks/scrapes 1.6–1.8 cm at a crawl — row 15 checks horizontal slide only (S1); slope-foot roll inverted, 19.6° against a 10° cross-slope — row 17c restates the code (S1); crouch-walk slides 5 cm/step (S2); landing within 0.12 s of launch loses Land (S2); GLB seam facing/clearance rig-private (S3); crest launch reported as jumped (S3, suspected); `game/tools/audit/u24-character.mjs`) (`play/character/*` ~716)
  - Check the rig pivots, the animation state machine, blending and the
    GLB-swap interface.

### Phase F — Cross-cutting + consolidation
- [x] **U25 invariants + UI sweep** — DONE (`docs/audit/U25-invariants-ui-sweep.md`: play frame allocates ≈10.5 KB/frame, 72–78 % in the core terrain height path, test-play-perf blind (S1); debug HUD lat/lon from tilted up, up to 39° off (S2); 3× S3; core purity, page rule, Euler clean; `game/tools/audit/u25-alloc-sampler.mjs`)
  - Grep audit: does `src/core` import nothing from three, react or physics
    libraries?
  - Find per-frame allocations in tick paths, Euler accumulators, and
    violations of the page rule.
  - Skim `play/ui/*`, `store/*`, `main.tsx`, `App.tsx`.
- [x] **U26 architecture fitness vs the goal** (AGENT_BRIEF §13) — DONE (`docs/audit/U26-architecture-fitness.md` + `docs/audit/U26-adr-drafts.md` D-ADR-1..8: method KEEP (rails, f64 core, floating origin, analytic terrain/KCC, layered cameras, workers); gates REWORK first; reference frames REWORK (state model, S1); catalog/time/entity/terrain/render/play REFACTOR; terrain field per-thread singleton silently re-points actors (S2); ≈740 walking actors per 4 ms; `game/tools/audit/u26-architecture-fitness.mjs`, `u26b-terrain-singleton-walk.mjs`)
  - Can this architecture deliver a real-looking, real-time solar system at good
    fps AND extend to new features (combat, AI entities, vehicles)?
  - Check the entity/state model, render pipeline, scale/precision strategy,
    worker use and extension points, using U01–U25's findings.
  - Verdict per area: keep / refactor / rework, each with a draft ADR.
- [x] **U27a consolidated findings index** — DONE (`docs/audit/FINDINGS.md`: 167 findings indexed (1 S0, 54 S1, 66 S2, 46 S3), all 55 S0/S1 merged into clusters K1–K9, ranked by severity × confidence, with cross-cluster dependencies; extractor `game/tools/audit/u27-findings-index.py`. S0/S1 repros NOT re-run.)
- [x] **U27b1 K1 handoff re-check** — DONE (`docs/audit/U27b1-k1-recheck.md`; A1-U03-1 S0 + A1-U21-3 S1 re-confirmed with scope qualifications; original repros exit 0; independent probe 11/11; source unchanged). Reviewer: platform-reported GPT-6 Astra. Historical-majority model provenance remains unverified; this box certifies K1 evidence, not completion of that overall cross-model condition.
- [x] **U27b2 K2a zero-GC / heap gate re-check** — DONE (`docs/audit/U27b2-k2a-recheck.md`; A1-U03-4, U04-5, U05-3, U06-2, U07-3, U09-1 reviewed: five re-confirmed, U04-5 canary subclaim refuted, S1 retained; independent 19/19 ×3; 8/55 reviewed). Historical-majority model condition still unverified.
  - Re-run repros; independently test whether the claimed allocation property can fail. Record commands, exits, controls and dispositions in FINDINGS.md.
- [x] **U27b3a K2b e2e plumbing re-check** — DONE (`docs/audit/U27b3a-k2b-recheck.md`; A1-U08-1/-2/-9 re-confirmed S1; original m1a/m1b/m1d repros; unchanged six specs × nine independent fixtures, 54/54 expected dispositions ×2, including 30 false accepts per run; 11/55 reviewed). Historical-majority model condition remains unverified.
- [x] **U27b3b1 K2c m1f R1/R2 row-validity re-check** — DONE (`docs/audit/U27b3b1-k2c-r1r2-recheck.md`; A1-U02-1/-2/-3 re-confirmed S1 with scope qualifications; original 9/9, independent 20/20 ×2; 14/55 reviewed). Historical-majority model condition remains unverified.
- [x] **U27b3b2a K2c m1f R3 re-check** — DONE (`docs/audit/U27b3b2a-k2c-r3-recheck.md`; U03-2/-3 re-confirmed S1 with qualifications; original 22/22, independent 26/26 ×2; 16/55 reviewed). Original M1/M2 fail flips/slope, empty pixel masks fail; bright-background masks still falsely accept. No fresh GPU verdict; historical-majority model condition remains unverified.
- [x] **U27b3b2b1 K2c m1e re-check** — DONE (`docs/audit/U27b3b2b1-m1e-recheck.md`; U04-1/-3/-4 re-confirmed S1 with qualifications: reference sphere is not exact terrain truth, sink faults pass, 4° yaw snaps pass, loop not closed; original 20/21 exit 1 from unrelated R4 GC trial; independent 28/28 ×2 exit 0; 19/55 reviewed). Historical-majority model condition remains unresolved.
- [x] **U27b3b2b2a K2c m1d re-check** — DONE (`docs/audit/U27b3b2b2a-m1d-recheck.md`; U05-1/-7 re-confirmed S1 with qualifications: atmosphere discontinuity/altitude/sign mutants pass; literal endpoint sweep passes T2 but tunnels through a constructed ridge and 22/4096 real-terrain paths, baseline catches selected witnesses; original 10/11 + 9/10 exit 0, independent 26/26 ×2 exit 0; 21/55 reviewed). No browser verdict; historical-majority provenance unresolved.
- [x] **U27b3b2b2b1 m1c seam-gate re-check** — DONE (`docs/audit/U27b3b2b2b1-m1c-recheck.md`; U06-1 re-confirmed S1 with qualifications: all 12 edges/eight corners unaudited, 64 false accepts across two fixtures, responsive same-face/T-junction controls; real worker 818 cross-face pairs clean; original 14/14, independent 80/80 twice exit 0; 22/55 reviewed). No browser verdict; historical-majority provenance unresolved.
- [x] **U27b3b2b2b2a m1b orbital-gate re-check** — DONE (`docs/audit/U27b3b2b2b2a-m1b-recheck.md`; U07-1/-2 retain S1 with qualifications: wrong rates/reversed directions pass all five extracted rows, independent raw-input oracle rejects; day-jump, period-ratio and T3 shape controls fail as expected; original 23/23 exit 0, independent 32/32 twice exit 0, deliberate self-test exit 1; 24/55 reviewed). No browser verdict; historical-majority provenance unresolved.
- [x] **U27b3b2b2b2b1 m1a precision/rebase gate re-check** — DONE (`docs/audit/U27b3b2b2b2b1-m1a-recheck.md`; U08-5/-6 retain S1 with qualifications: wrong triggers/lattices, early rounding, stale/zero locals falsely pass; exact-origin/boundary/local truth rejects; T2 indirectly reads focus locals; AU errors are stress fixtures, catalog Earth 600000 m. Original16/18 exit0 controls OK; independent50/50 twice exit0; deliberate self-test50/51 exit1; 26/55 reviewed, K2c complete). Historical-majority provenance unresolved.
- [x] **U27b3b2b2b2b2a m1a timing/stall gate re-check** — DONE (`docs/audit/U27b3b2b2b2b2a-m1a-timing-recheck.md`; U08-7 retains S1 with qualifications: ≥250 ms intervals hidden, current callback tags preceding interval, double warmup skips 40 callbacks; 40 ms PASS matches numeric budgets, 80 ms FAIL control; original16/18 controls OK exit0, independent27/27 twice exit0, self-test27/28 exit1; 27/55 reviewed). Synthetic timing only; historical-majority provenance unresolved.
- [x] **U27b3b2b2b2b2b remaining K2d gate re-checks** — DONE (`docs/audit/U27-k2d-recheck.md`): U03-5 fixture limitation confirmed but universal impossibility withdrawn; U05-2 FPS deadline failure confirmed, replay-order correction; U01-1 browser R2 failure re-confirmed; spinGroup suppression localized, centroid still fails; historical cause unbisected. Independent 14/14 twice exit0, deliberate14/15 exit1; 30/55 reviewed. Lead 2026-10-25 permits related rechecks batched within 50 OLU; per-finding evidence retained. Historical-majority provenance unresolved.
- [x] **U27b4a K3 reference-frame re-check batch** — DONE (`docs/audit/U27-k3-recheck.md`): seven findings retain S1 with qualifications; U10 speed frames/interception, U12 shared vs private spin, U13 existing Moon-centred sky composition, U16 equivalent-phase false landings, U17 wrong-frame up, U18 rotating contact mismatch, U26 synthesis. Originals exit0; independent29/29 twice exit0, deliberate29/30 exit1; 37/55 reviewed.
- [x] **U27b4ba K4 terrain re-check batch** — DONE (`docs/audit/U27-k4-recheck.md`): five S1 findings retained with qualifications; actual worker mesh mismatch, convergence-qualified normal error, STEEP sweep-bound failure, false DDA slope bound, worker drop/stale ownership. Independent19/19 twice exit0, deliberate19/20 exit1; originals exit0 (U05c9/10 rejects false bound); 42/55 reviewed. No browser verdict or certified global noise/slope bound.
- [x] **U27b4bba K5/K6 allocation + flight re-check batch** — DONE (`docs/audit/U27-k5-recheck.md`, `U27-k6-recheck.md`): six S1 retained with qualifications; 10–11KB/frame Node allocation, retention gate responsive to leaks not churn; mirrored yaw/roll, weak/absent retro thrust, density-only arrival sensitivity, radial-impact outcome and missing body selection. Independent K5 19/19 twice, K6 23/23 twice exit0; deliberate failures exit1. 48/55 reviewed. Not real-planet simulations; oblique contacts need not land; no browser performance claim.
- [x] **U27b4bbba K7 movement/timing re-checks** — DONE (`docs/audit/U27-k7-recheck.md`): U16-1/U17-3/U13-2 retain S1 with qualifications; analytic 51/55° false accepts, real landing orientation reaches character/camera, actual 144Hz pipeline stale by 0.1083m. Flat landing disproves “every”; camera shares stale anchor, not simply ahead. Independent17/17 twice exit0, deliberate17/18 exit1; 51/55 reviewed.
- [x] **U27b4bbbb K8–K9 four-finding re-checks** — DONE (`docs/audit/U27-k8-k9-recheck.md`): U15-3/-4 and U24-1/-3 retain S1 with corrections; actual matrix cone/common-ray depth defects, live rig stance-height and telemetry-to-sole roll mismatch. Independent48/48 twice exit0, deliberate48/49 exit1; original probes exit0, unchanged animation115/115 exit0. 55/55 evidence reviewed. No GPU verdict; model-majority condition still unresolved (U05b Opus5.5 confirmed, not majority).
  - All U27b parts: use a different model than most original audit units; record the model in SESSION LOG. U27b1 verified its current model and one prior SOLARIS model, not the historical majority; establish that provenance before declaring overall cross-model completion.
  - Re-run every S0/S1 repro cluster by cluster (`FINDINGS.md` §3), recording probe commands/exits and re-confirmed / changed / refuted per finding. No untouched cluster is implicitly signed off by a shared probe's output.
- [ ] **U27c fix tasks + Lead summary → LEAD GATE**
  - Carry/resolve the historical model-majority prerequisite explicitly; 55/55 findings have recheck evidence, but majority attribution is not independently verified. Do not make an unqualified cross-model-completion claim.
  - Propose fix tasks F1, F2, … in dependency order, gates (K2) before engine. Each one is sized to fit a single 50-OLU session or is split until it does.
  - Add a plain-language summary for the Lead. U10a/U10b are already ruled on (2026-10-22 APPROVAL LEDGER), as is U19 (2026-10-23); apply those rulings, never re-ask. Collect remaining U16/U17 look-and-feel questions. Ask no technical choices (§13).
  - Set the stage to LEAD GATE and STOP.

## 6. Method (binds every unit)

### 6.1 Session procedure
1. Run AGENT_BRIEF §5 (read, reconcile, report in ≤5 sentences). Then read only
   §6 here and your unit.
2. Read the unit's files fully. For specs, grep the module name and read only
   the matching passages. **Never read a whole `Milestone/*.txt` file**; each is
   1.9k–3.0k lines.
3. Derive the expected behaviour from physics, math or the spec **before** reading
   how the code does it. Write the claim down first.
4. Confirm or refute each suspicion with a probe in `game/tools/audit/`. Copy the
   loading pattern of the existing `game/tools/test-play-*.mjs` files. Record each
   command and its UNPIPED exit code.
5. Write `docs/audit/Uxx-<slug>.md`. Include a **"checked, no issue"** list so no
   later session redoes that coverage.
6. Check the box, update the tracker row and repoint STATE.md NEXT ACTION. Add a
   SESSION LOG row. Commit and push (AGENT_BRIEF §6).

### 6.2 Where each module is specified (grep hit counts per Milestone file)
| Module | 1A | 1B | 1C | 1D | 1E | 1F | 1G |
|---|---|---|---|---|---|---|---|
| precisionMath / FloatingOrigin | 7 / 7 | 1 / 4 | – / – | – / 2 | – / 3 | – / 3 | – / 2 |
| KeplerRail / celestialData / atmosphere | – | 18 / 5 / 22 | – | – / – / 37 | – | – | – |
| noise / spherify / terrainField / TerrainMeshPool | – | – | 15 / 15 / 7 / 9 | 5 / 3 / 2 / 3 | 3 / 2 / 3 / 3 | 4 / 2 / 3 / 2 | 1 / 3 / 3 / 2 |
| SimulationCore | 15 | 10 | – | 2 | 3 | 2 | 7 |
| sphericalFrame / astronautKCC | – | – | – | – | 3 / 2 | 2 / 1 | 2 / 5 |
| flightController / aerodynamics | – | – | – | 3 / 2 | – | – | – |
| impostorMath / MultiCameraRig / SkyImpostorPool | – | – | – | – | – | 4 / 7 / 7 | – |

### 6.3 Finding template (one block per finding in `docs/audit/Uxx-*.md`)
```
### A1-Uxx-n — <one-line title>
- Severity: S0 | S1 | S2 | S3     Confidence: confirmed | likely | suspected
- Category: spec | engine | play | test | doc
- Location: <file>:<line> @ <commit>   (and spec file + passage if relevant)
- Claim: what the spec/comment/test says should hold
- Evidence: what actually holds — probe command, output, exit code
- Impact: what goes wrong for the game or for the gate
- Proposed fix: smallest correct change + whether it touches a RATIFIED item
- Fix task size: fits one 50-OLU session? (if not: how to split)
```

Severity scale:
- **S0**: wrong physics or math that corrupts state, a crash, or a gate that cannot
  fail while it hides a defect.
- **S1**: wrong behaviour visible in play, a broken invariant, or a gate that
  under-tests its claim.
- **S2**: an edge case, a fragility or a misleading doc/comment.
- **S3**: a note or improvement.

A finding marked `suspected` must say what evidence would confirm it.

### 6.4 Verification (every unit)
- `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` is
  empty. This proves the unit stayed read-only.
- The unit file exists. Every S0/S1 finding carries a runnable repro or an exact
  code citation, and every probe's exit code is recorded.

### 6.5 Budget rule (Lead, 2026-10-21: 50 OLU per session; quality over quantity)
- Default: one unit per session; start wrapping up at about 40 OLU.
- **Lead recheck amendment (2026-10-26, reiterating 2026-10-25):** for all remaining rechecks, prefer multiple related findings in one session/checkpoint when they fit the 50-OLU total. Reuse prior evidence and probes; avoid redoing the original audit. The Lead reports the original review was by Opus 5.5; this supports targeted rechecking, not automatic confirmation. Keep per-finding evidence, responsive controls and honest qualifications. Around 40 OLU stop expanding scope and reserve the balance for writing, verification, one commit and push; split only unfinished scope. This recheck-specific directive supersedes the one-unit default, not the read-only boundary.
- If a unit will not finish, commit what is done as `Uxxa`. Add an unchecked
  `Uxxb` box directly below it, with the remaining scope written out, and repoint
  NEXT ACTION to it. Never leave work uncommitted.
- Fewer, solid findings beat many weak ones. Do not pad. A unit with zero
  findings and a thorough "checked, no issue" list is a valid outcome.

## 7. Risks & open decisions
- **Auditor bias.** One model can share another's blind spots. The cross-model
  review at U27 mitigates this; the Lead may order more.
- **Findings may invalidate the 1A–1F approvals.** That is expected. Record it as a
  finding; do not reopen milestones in A1.
- **RATIFIED items** (KCC step/slope, C¹ cap, camera bands, impostor hysteresis,
  `celestialData` constants) may be flagged. Changing them happens in a
  fix task under AGENT_BRIEF §13 (ADR + evidence).
- **Environment.** m1f/m1e need an 8 GB VM and run one at a time; SwiftShader may
  differ from hardware WebGL. U01 decides how much that matters.
- **T1 resume point.** B11 waits on U01's verdict and on the Lead.