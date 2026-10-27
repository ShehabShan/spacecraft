# TASK TRACKER — PHASE 2 MAIN DEVELOPMENT (contract: AGENT_BRIEF.md)

Single source of truth for WHAT is being built and WHERE it stands. A fresh session
resumes from: this file + the active task's `docs/<task>-plan.md` + `notes/STATE.md`
NEXT ACTION. The first UNCHECKED BOX (planning item or build step) is always the
starting point.

## TRACKER
| Task | Branch | Plan status | Build status | Step progress | Last commit | Blockers |
|------|--------|-------------|--------------|---------------|-------------|----------|
| T1 playable moon | `t1-playable-moon` | READY (7/7 sections; Q1–Q8 ruled 2026-10-20) — `docs/T1-plan.md` | PAUSED 2026-10-21 for A1 (Lead) — was IN PROGRESS | plan 7/7 · build 10/13 (B4 = B4a–B4c; B5 = B5a–B5c; B7 = B7a–B7c; B9 = B9a–B9c) — PLAYABLE + ANIMATED + HUD (B10 done: HUD + zero-allocation proof) · B10 browser b9/b7 re-run PASS (session 46) · next: B11 core edit (coyoteTime / airControl) — BLOCKED at its baseline | 1283545 | B11 baseline m1f R2 FAIL on the unedited tree (R3 flaky) — Lead ruling needed (plan B11 options a/b/c) — A1-U01: baseline red is NOT environmental (R2 likely regressed at 3057899 (not bisected); `docs/audit/U01-m1f-baseline.md`) |
| A1 engine audit (read-only) | `a1-engine-audit` | READY (7/7; authored 2026-10-21) — `docs/A1-plan.md` | DONE — accepted by the Lead 2026-10-26, merged into `main` | build 27/27 units (U27 = U27a, U27b1–U27b2, U27b3a, U27b3b1, U27b3b2a, U27b3b2b1, U27b3b2b2a, U27b3b2b2b1, U27b3b2b2b2a, U27b3b2b2b2b1, U27b3b2b2b2b2a–U27b3b2b2b2b2b, U27b4a, U27b4ba, U27b4bba, U27b4bbba–U27b4bbbb, U27c; U05 = U05a–U05c; U08 = U08a–U08b; U10 = U10a–U10b; U01 done: R2 red = real regression, likely at 3057899 (not bisected), not env; U02 done: R1 and R2(a) cannot fail on their claims, R2(b) is the only real check; U03 done: handoff renders nothing for 5.6 km on descent and R3 cannot see it (S0), R3(c) saturated, R4 canary unused, R5 ≥2 rebases unreachable by the SAT_B fixture — not terrain/KCC; U04 done: m1e R5 Coriolis passes on a mis-measured 0.75 cm (−0.97 cm tilt artefact; true ≈1.9 cm, KCC physics fine), R1/R2 penetration clauses vacuous (minAGL never written grounded), R1 misses 4° yaw snaps, R4 canary tautological + heap verdict GC-dependent) ; U05a done: m1d reading pass, 8 probe seeds; U05b done: T1 cannot fail on C∞/Mach/wind claims (S1), T2 verdict fps-dependent — 15 fps FAIL (S1), T4 heap clause GC noise + passes negatives (S1), T4 canary + T5 offset tautological (S2) ; U05c done: T2 passes with an endpoint-only / 16× coarser DDA sweep and minPostTickAGL is blind to tunnelling (S1), DDA no-clip proof rests on slope bound 1.2 vs measured 6.4 (S1), a_struct exceeded 6.9× in the governed dive (S2), g-load excludes drag (S2), v@1000 264.7 confirmed by independent RK4 (266.0) ; U06 done: T3 never compares the 12 cube-face seams (260 inverted face-edge normals pass; engine itself clean, 816 cross-face pairs 0 mismatches) (S1), T2 "zero buffer allocations" counter written only in the pool constructor (S1), level-gap-2 neighbours unaudited (S2), T4 heap N/A/negative passes (S2), harness LOD merge leaves children desired up to 84 nodes / 3.4 s (S2), skirts cover all T-junction gaps (gap 3 margin 15 %) ; U07 done: no m1b row checks the orbital time scale — every mean motion ×2 passes all 5 rows, Kepler-3 ratio a tautology (S1), T1 "independent" reference re-uses the rail basis/semiMinor — every orbit reversed passes all rows (S1), zero-gc heap clause passes N/A/negative, verdict flips F/P between runs (S1), vis-viva clause an identity + skips moons (S2), console line/T3 detail print literal `{…}` (S2), celestialData period table stale ≤ 11 s (S2), Moon at 0.71 Earth Hill radius (S3); engine periods/spin/vis-viva/solver/T5 lattice clean ; U08a done: m1b spec passes on pageerror, console.error, placeholder badges, dropped row and TS type error (S1/S1/S2/S2); m1a T2–T4 read the engine constants — thresholds 900–1100 and lattices 64–1000 pass all rows (S1), f32-before-subtract (24 m at 1 AU) and stale static beacons (9.2 km) pass (S1), T5 drops ≥250 ms stalls + flags the wrong rebase frame (S1), verdict/detail text literal `{…}` (S2); engine rebase ticks/Δ match the spec ; U08b done: `ERR` badges with a PASSED line pass m1a/c/d/e — the badge check only rejects the text FAIL (S1), page errors pass m1a/c/e (A1-U08-1 repro), m1f no verdict in 240 s on 2 vCPU/4 GB (S3), port-in-use + npm test propagation fine; m1f mutations residual (8 GB VM) ; U09 done: play heap rows read heapUsed after gc() so ~4 KB/frame of transient garbage passes perf 19/19 — zero-GC claim untested (S1), controller camera row flaky from a cold h0 not a leak (warm-up → green 4/4) (S2), only perf checks the §13.2 no-monotonic-growth clause (S2), jump-buffer bracket [0.10, 0.20) (S3), vacuous no-gc row + FAIL-count format (S3); check-play-* NOT RUN (no chromium) ; U10a done: spec 02 lost every formula (9 empty slots) (S2), catalog radii follow two compression laws — Mars < Mercury, Charon/Titania > Moon (S2), Earth 14.7° wide in the Moon sky vs 1.9° real, no common moon-orbit law (S2), play Moon 1:1,273 with real g — horizon 66 m, relief 26 % of R (S2, look-and-feel question to Lead); μ, period 3,072 s, play = catalog clean ; U10b done: speed cap has no frame — Earth 12.8 km/s, Moon 2.4 km/s at 30× vs 2,000 m/s cap (S1); day 604 s > year 294 s (S2); spec 05 1B real-world positions impossible (S2); gravityRange/Hill 0.12–13.96, Sun range 0 (S2); atmospheres 62–160 % of R (S2); specs assume Rapier (S2); rebase wording, moon portals, two GC bars, Sun 3.8° (S3); orbit-speed look-and-feel question to Lead ; U11 done: FloatingOriginAdapter never re-shows a re-registered entity (S2); unregistering the focus re-focuses entities[0] and rebases there (S2); getOrigin/getOriginReadonly live + writable — Δ 5020 observed (S3); 2^8 rationale overstated, render exactness = f64-subtract-then-narrow order, Δ f32-exact to 2^32 m, lattice must be ≤ 2× trigger (S3); lattice/order/≤128 bound/zero-alloc/Pluto ulp 0.25 m clean ; U12 done: no body rotates — no spin rail/pole/prime meridian in catalog, rail or SimulationCore; only spin is the KCC-private integrated spinOmega (m1f Moon 0.24× lock rate) (S1); rail accepts e ≥ 1 / a < 0 → NaN state, no boot validation (S2); all 16 orbits circular + coplanar (Pluto, Uranus system) (S2); Newton exit never met at e ≥ 0.9999 but error ≤ 2.2e-14 rad (S3); wrapAngle [−π, π) not (−π, π] (S3); Triton g 0.717 vs 0.779 (S3); solver ≤ 1.5e-15 vs bisection to e 0.999, catalog = spec 03 clean ; U13 done: the tick has no parented-compose step — the play world needs the sky frozen (moonWorld setTimeScale(0)) (S1); PlayerController (1e-9 tolerance) and core accumulators disagree on 16.7 % of 144 Hz frames, character can lag the camera 1 tick (S1); below 12 fps the game slows (10 fps → 0.83×), no load shedding, shedSeconds misses the 0.25 s clamp (S2); no interpolation alpha — 58 % of 144 Hz frames have 0 ticks (S2); self-unsubscribing rebase listener skips the next (S2); moonWorld syncEntity/respawn tick the core directly (S3); ≈1.6 B/tick, GC count grows with N (S3); integrate-then-rebase order, clocks, guards clean ; U14 done: fixed ε 0.002 rad normals under-resolve the detail octaves — play Moon normal error p50 3.2°, p99 60°, ε/2 still moves p90 7.6°, 7 % of >45° slopes read ≤45° (S1); m1e STEEP field reaches 2,216 m (14 % of the sphere) while its KCC uses maxTerrainHeight 900 — no bound derived from params (S1); normal tangent-frame flip → 37° jumps on 6 planes (S2); terrainHeight/terrainNormalInto 180/461 GC per 1e6 calls (S2, likely); spherify linear variation 2× not √2, chunkArcWidth up to 27 % short (S3); chunkKey collides at L9, seeds alias, singleton field (S3); seams 0 mismatches L0–L12, determinism, inverse, production bounds clean ; U15 done: transportFrameInto is Gram-Schmidt projection, not parallel transport — round trips drift the heading (3.2° up jitter → 0.089°/cycle, 37° flip → 12.5°), 1 km Moon walk endpoints 429 m apart vs minimal rotation (S2); fullyBelowHorizon 0.03 rad allowance < Moon eye dip 0.049 (1.6 m)–0.17 (20 m) rad, real horizon below it on 63/1800 azimuths (S2); camera-facing impostor quads: radial extent 0.87 θ at 30°, 0.70 θ at 46° off-axis — Earth (7.4°) squashed, R2 blind (S1); staged-rank depth = D·cosβ so far bodies draw over near ones 0.47° apart at 30° (S1); tan law unclamped, θ ≥ 1.48 → negative quad (S3); header numbers wrong (S3); spin/quat/canonical tangent/diskFraction/depthResolution clean ; U16 done: the ratified 50° walk limit is really ≈56–59° — the ratio clause divides Δh by the move along the tilted fwd (blended up 0.65); max accepted true secant 58.7–59.0°; the w=0 mutant holds 50.0° (S1); the spin-phase wrap `% 2π` gives a sweep dTheta of −2π on the wrap tick → 1,971/3,000 false landings from 5 m up vs 0 off the wrap (S1, latent in play at ω=0); grounded absVel is the commanded vCtl, not the realised motion — velocity vs displacement 16° median, 73° max, path 1.24× the set speed on slopes (S2); the NaN guard does not restore vCtl/vSlide, so one NaN input freezes the player (nanEvents 1→301) (S2); jump along the ε-normal — horizontal kick p50 3.4 m/s, direction error p99 73° (S2); the stepHeight clause never binds (max Δh 0.129 m/tick) (S3); slide 45° and walk 50° bands overlap (S3); two look-and-feel questions to the Lead in the report ; U17 done: airborne/zero-G up re-aligns toward the WORLD radial while up is planet-frame — 43.9° tilt at θ=π/2, zero-G 92.8° off in 10 s (S1, latent at Ω=0); vehicle tick writes world-frame up — parked vehicle drifts by θ (34° in 60 s) (S2); every landing snaps up p50 18.8°, max 50.8° in one tick on the play Moon (S1); slide grip τ stops slides at 14.6–26.8 m/s² vs μk·g 0.97 (S2); airborne altAGL vs take-off height — up to 56 m off, 3,851 ticks below 0 (S2); landing plant drops strafe (3.2→0) + non-tangent vCtl (S2); dead normal-kill, dead `cliff`, C¹ cap not in KCC → U18 (S3) ; U18 done: yaw/roll mirrored — body +Z = X×Y is right, D/→ steer left (S1); C¹ cap fades retro thrust — from 1,999 m/s retro cannot reach 1,880 in 60 s (S1, RATIFIED); planet spin: air/LANDED rotating vs terrain/gravity inertial — parked ship slides 178.6 m in 10 s at Ω=0.0104 (S1, latent); one NaN input → angVel NaN, frozen 301/301, observer sees NaN (S2); 2,025 rescale reachable on 4 giants (S2); telemetry pressure no tempFloor, negative at 50 km (S3) ; U19 done: atmosphere not hydrostatic — H 1,200 m implies g 68.9 m/s² (7× planet), HUD pressure gradient 6.3–7.1× ρg (S2); governor slow arrival holds only for Earth ρ0·H — same code with real ρ0: Mars hits terrain at 1,865 m/s, Pluto 2,014 m/s, Venus no contact in 100 s at 118 g (S1, T2); any touchdown speed lands — 25/57/124 m/s all LANDED in the contact tick, no crash/touchdown telemetry (S1, T2); one EARTHSCALE profile for every body, catalog atmosphereHeight unused, no cruise/boost regime, Titan/Pluto/Triton/Sun catalog values off real (S1, T2); lift ungoverned — 112.5 m/s² at sea-level v_safe > a_struct 90 (S2); lift gate step 1.06 m/s² at 15 m/s (S3); M1D v_safe table 2 km row wrong, "<2 %" lapse claim holds only ≤2 km, v_safe omits βL (S3); stall C¹, lift direction/AoA, wind, sound speed clean ; U20 done: "free set always exists" bound wrong — 144 meshes on 96 sets → worker drops, LOD keeps dead pendingRec: holes on 5,843/7,200 frames, 194 nodes fake data, no gate reads drops; play/1F safe only at meshCount = sets (S1); worker 0 does ~all generation 94/16 (S2); receive-path garbage unmeasured (S3); cancel paths, F10b, rings 28/48, same-size upload clean ; U21 done: mesh↔impostor handoff + hysteresis live only in the 1F harness — engine pool has an alpha nobody computes, play passes α=1 and Earth is always a mesh (S1); Near pass drawn last paints straddlers over Mid-only objects in 2,400–3,000 m — 21,168 inverted cases, 0 with Near far = 2,400 (S2, RATIFIED); dn<3e5<df cut by the Mid far plane, dn≥3e5 mask 0, no mesh on FAR (S2); impostor fade = disk radius ×α, opaque — at α=0.5 75 % of the disk is only the half-opaque mesh (S2); executePasses allocates 40 vs 2 GC/2M (S3); stars/glow drawn after impostors, comments wrong (S3); Near δ 3.4–5.4 m at the band end (S3); pass order, co-location, BG staging clean ; U22 done: drawn terrain ≠ collision terrain — L4 4.19 m mesh vs analytic height, edge-midpoint |err| p50 0.22 / p99 3.9 / max 12.9 m, diagonals max 26 m, feet sink/float (S1); LOD selects 125 leaves for 96 meshes at the spawn — 31 holes at 1.0–1.9 km with no fallback, terrain-occluded at the eye, residentAround 1.0 blind (S2); brad 1.5–2.2× real extent (S3); spawn early exit unreachable + tangent-less roughness probes (S3); terrain −81/+283 m inside the shell and MAX_TERRAIN_H, horizon cull sound, earthrise spawn deterministic clean ; U23 done: below 12 fps the game runs slow — PlayClock 0.1 s clamp + 5 substeps shed time, 10 fps 0.83×, 5 fps 0.42× (S2); FP yaw updates at the 60 Hz tick (600/1440 frames at 144 Hz) while pitch is per frame (S2); camera clearance uses analytic height while the drawn L4 mesh is > 0.4 m above it at 22.9 % of edge midpoints, max 6.25 m (S2, likely); 4-point boom cut misses ridges — pivot occluded on 35/6000 poses, 2.19 m deep (S2); heading ∥ up collapses to 0, no movement (S3); wheel deltaMode ignored (S3); play signs not mirrored, 12–144 fps independent, analytic clearance clean ; U24 done: stance foot floats 9–14 cm at run/sprint, sinks 1.6 cm at a crawl, gate checks horizontal slide only (S1); slope-foot roll sign inverted, 19.6° against a 10° cross-slope (S1); crouch-walk slides 5 cm (S2); landing inside JumpLaunch lost (S2); GLB seam facing rig-private (S3); crest launch = jumped (S3 suspected); pitch, solver, blend, interrupt, rig clean ; U25 done: play frame allocates ≈10.5 KB/frame (1.5 MB/s at 144 Hz) — 72–78 % inside core terrainHeight/noise3/sampleSurfaceInto via camera poseInto + sampleTelemetry + KCC; test-play-perf post-gc heap rows blind (S1); debug HUD lat/lon from tilted up, not position — up to 33–39° (~900 m) (S2); zustand setHud ≈300 B/publish vs "nothing allocated" (S3); menu omits m1e/m1f (S3); worker error never reaches ERROR (S3); core purity, page rule, no Euler accumulators, InputState/playStore/shellRuntime/overlays clean ; U26 done: architecture method KEEP (Kepler rails, f64 core + floating origin, analytic terrain/KCC, layered cameras, terrain workers — ≈740 walking actors per 4 ms, sequential multi-KCC bit-identical); gates REWORK first; no reference-frame model — bodies do not spin, actors not parented, play freezes the sky (S1, synthesis); terrain field is a per-thread singleton — a 2nd body's init sinks a walking Moon KCC 0.71 m with no error (S2); entity = pos/vel only, physics writes through (S2); playFrame + module rig cameras = no extension seam (S2); draft ADRs D-ADR-1..8 in docs/audit/U26-adr-drafts.md ; U27a done: docs/audit/FINDINGS.md — 167 findings indexed (1 S0 / 54 S1 / 66 S2 / 46 S3), 55 S0/S1 merged into clusters K1–K9 (K1 harness-only handoff S0; K2 30 gate findings; K3 no reference frames; K4 terrain truth; K5 allocation; K6 flight; K7 KCC; K8 impostor projection; K9 feet), U27b1 done: K1 U03-1/U21-3 re-confirmed, 2/55 S0/S1 reviewed; independent probe 11/11, source unchanged · U27b2 done: K2a six reviewed (five re-confirmed, U04-5 canary subclaim refuted; all S1 retained), 8/55 reviewed; independent 19/19 ×3, heap-vs-allocation remedy corrected ; U27b3a done: K2b U08-1/-2/-9 re-confirmed S1; original repros + all six unchanged specs against nine fixtures, 54/54 expected dispositions ×2 (30 false accepts per run), 11/55 reviewed · U27b3b1 done: K2c U02-1/-2/-3 re-confirmed S1 with qualifications (cached position/fade can fail; no GPU claim); original 9/9, independent 20/20 ×2; 14/55 reviewed · U27b3b2a done: U03-2/-3 re-confirmed S1 with qualifications (original M1/M2 fail other clauses; empty masks fail; background masks falsely accept); original 22/22, independent 26/26 ×2; 16/55 reviewed · U27b3b2b1 done: U04-1/-3/-4 re-confirmed S1 with qualifications (radial reference not exact terrain truth; sink faults and 4° yaw snaps pass); original 20/21 exit 1 from unrelated R4 GC trial, independent 28/28 ×2 exit 0; 19/55 reviewed · U27b3b2b2a done: U05-1/-7 re-confirmed S1 with qualifications; T1 accepts density/Mach/wind faults, literal endpoint sweep passes T2 but tunnels 22/4096 real-terrain paths; baseline catches selected witnesses; original 10/11 + 9/10 exit 0, independent 26/26 ×2 exit 0; 21/55 reviewed · U27b3b2b2b1 done: U06-1 re-confirmed S1 with qualifications; 12 edges/eight corners + position faults falsely accepted, 64 cases across two fixtures; real worker 818 cross-face pairs clean; original 14/14, independent 80/80 twice exit 0; 22/55 reviewed · U27b3b2b2b2a done: U07-1/-2 retain S1 with qualifications; wrong rates/directions falsely pass, independent raw-input oracle rejects, day-jump/ratio/shape controls respond; original 23/23, independent 32/32 twice exit 0; 24/55 reviewed · U27b3b2b2b2b1 done: U08-5/-6 retain S1 with qualifications; wrong trigger/lattice and early/stale/zero locals pass, independent boundaries/origins/precision reject; T2 indirectly reads locals, AU stress is not catalog scale; original16/18 controls OK exit0, independent50/50 twice exit0, self-test50/51 exit1; 26/55 reviewed, K2c complete ; U27b3b2b2b2b2a done: U08-7 retains S1 with qualifications; ≥250 ms stalls hidden, attribution precedes work, double warmup; 40 ms PASS meets budgets, 80 ms FAIL control; original16/18 controls OK exit0, independent27/27 twice exit0, self-test27/28 exit1; 27/55 reviewed · U27b3b2b2b2b2b done: three K2d checks in one Lead-authorized batch; U03-5 universal impossibility withdrawn, fixture issue retained; U05-2 FPS failure confirmed with corrected scheduling; U01-1 Sun test fails again; spinGroup hiding restores coverage but centroid still fails, first bad commit unbisected; independent14/14 twice exit0, self-test14/15 exit1, originalU03 22/22 and U05 10/11 exit0; 30/55 reviewed · U27b4a done: seven K3 frame findings retain S1 with corrections; independent29/29 twice exit0, deliberate29/30 exit1; 37/55 reviewed · U27b4ba done: five K4 S1 findings retained with qualifications; worker triangles differ by metres, normals remain wrong at converged sites, STEEP bound skips real crossing, slope1.2 refuted (no baseline tunnel proved), dropped request retains stale ownership; independent19/19 twice exit0, deliberate19/20 exit1; 42/55 reviewed · U27b4bba done: six K5/K6 findings retain S1 with qualifications; Node10–11KB/frame transient allocation, retention tests catch leaks not churn; mirrored yaw/roll, retro fade, density-only arrival, radial impact outcomes, missing body selection. K5 independent19/19 twice, K6 23/23 twice exit0; deliberate failures exit1; 48/55 reviewed · U27b4bbba done: three K7 S1 retained with qualifications; analytic over-limit acceptance, real landing snap reaches root/camera, real144Hz stale extract0.1083m; flat landing clean, camera shares stale anchor. Originals exit0, independent17/17 twice0, deliberate17/18 exit1; 51/55 reviewed · U27b4bbbb done: four K8/K9 S1 retained with corrections; real matrix cone/common-ray depth and live rig contact/roll defects. Independent48/48 twice0, deliberate48/49 exit1; original probes0, unchanged animation115/115 exit0. 55/55 evidence reviewed · U27c done: 27 one-session fix tasks F1a–F10b in dependency order (gates first) in `docs/audit/U27c-fix-tasks.md`, coverage checker 55/55 exit 0; Lead summary + 4 look-and-feel questions in `docs/audit/U27c-lead-summary.md`; model-majority prerequisite QUALIFIED (not claimed); next: STOP at LEAD GATE — Lead accepts/reorders, names 1F for F2f, orders F1a (Q1–Q4 answered 2026-10-26, ledger) | bd079fe | none — Lead attested 2026-10-26: originals Opus 5.5, rechecks gpt-6-astra (cross-model condition met) |
| F1a e2e plumbing | `f1a-e2e-plumbing` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 104) — fast-forwarded into `main`; ADR-001 | 1/1 · gate `game/tools/test-e2e-plumbing.mjs` 60/60 | 6ce1d08 | — |
| F1b allocation gate | `f1b-allocation-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2; split per §12 into F1ba (play frame), F1bb (harness-loop gate), F1bc (retire old rows) → F1bca (idle-retained item) + F1bcb (row retirement) | DONE 2026-10-26 (sessions 105–108; ADR-002..005) — fast-forwarded into `main` | 4/4 · gates `tools/test-alloc-gate.mjs` + `tools/test-alloc-loops.mjs` (self-tests exit 0); blind heap-delta/boot-counter clauses retired from m1b/m1c/m1d/m1e (row counts unchanged); allocation still red (play ≈10.5 KB/frame, integrateFlight 585 B/tick, integrateTick 5,483 B/tick — expected until F5a/F7a); open: CDP sampler for m1c heap-flat / m1f R4 | e9dcf06 | — |
| F2a m1b orbit gate | `f2a-orbit-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 109; ADR-006) — fast-forwarded into `main` | 1/1 · gate `game/tools/test-orbit-gate.mjs` 9/9 exit 0 twice; `--self-test` 12/12 exit 0 twice (n×1.01, n×2, reversed-via-n, reversed-via-basisQ, Triton sign, common μ×4, Jupiter n×1.001, Earth T×2, Earth +1 m, fastForward×2 all red); `--deliberate` exit 1 | ae9acf7 | — |
| F2b m1a precision/rebase/timing gate | `f2b-precision-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 111; ADR-007) — fast-forwarded into `main` | 1/1 · gate `game/tools/test-precision-gate.mjs` 7/7 exit 0 twice; `--self-test` 17/17 exit 0 twice (thresholds 900/1023/1025/non-strict, lattices 128/300/512/floor, f32-before-subtract, stale static/celestial locals, 300 ms stall per rebase, 3×1 s freeze, 40 ms hitch on/after rebase all red); `--deliberate` exit 1 | 83272db | — |
| F2c m1c seam gate | `f2c-seam-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 112; ADR-008) — fast-forwarded into `main` | 1/1 · gate `game/tools/test-seam-gate.mjs` 14/14 exit 0 twice (L0 + 27-chunk mixed layout on the real worker: 12 edges × 31/63 points, 8 corners × 3 faces, 818 cross-face pairs 0 normal-bit mismatches, max 0.120 mm); `--self-test` 42/42 exit 0 twice (12 edge-normal, 8 corner-normal, 12 edge-position recheck fixtures, 4 same-face/T-junction controls, 2 missing-chunk controls, 4 worker source mutants all red); `--deliberate` exit 1 | bcdc980 | — |
| F2d m1d gate | `f2d-m1d-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 113; ADR-009) — fast-forwarded into `main` | 1/1 · gate `game/tools/test-flight-gate.mjs` 12/12 exit 0 twice (pinned density/Mach/wind law, constructed-ridge + 4,096 real-terrain grazing paths scored on the interior, dive on a physics-time deadline at 60/30/15/10 fps, identical trace); `--self-test` 8/8 exit 0 twice (density step 4 km, sea-level Mach, no temp floor, reversed wind, ρ0 drift, endpoint-only sweep, sweep removed, requested-time 15/10 fps schedule all red); `--deliberate` exit 1; harness DIVE deadline → tick time (playwright m1d exit 1 → 0) | 61fae86 | — |
| F2e m1e KCC gate | `f2e-m1e-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2 (one session) | DONE 2026-10-26 (session 114; ADR-010) — fast-forwarded into `main` | 1/1 · gate `game/tools/test-kcc-gate.mjs` 13/13 exit 0 twice (smooth-sphere jump vs independent inertial RK4: KCC 1.920 cm vs truth 2.018 cm west, err 0.98 mm, 1/240 0.25 mm; zero-spin 0, reversed exact; real 6.67° site along the true normal err 9.9 mm; every-tick finite clearance on a 30,000-tick corner walk + 6,000-tick steep turn, dev ≤ 1.7e-11 m; abs = R_y(ωt)·pLocal ≤ 9.4e-9 m; yaw residual after minimal-rotation transport + commanded yaw ≤ 0.5·δ², measured 0.25·δ²); `--self-test` 8/8 exit 0 twice (up-tilt launch, compose θ_new, transport ×2, 0.10 m sink, compose θ_prev, 4°/8° snaps, 0.05°/tick creep all red); `--deliberate` exit 1; harness + engine unchanged | b8cfe20 | — |
| F3a catalog scale laws + rotation data | `f3a-catalog` | defined in `docs/audit/U27c-fix-tasks.md` §2; split per §12 into F3aa (sourced real data + gate) and F3ab → F3aba (rail boot validation) + F3abb → F3abba (spin fields + time law) + F3abbb → F3abbba (alloc calibration fix) + F3abbbb → F3abbbba (scale laws chosen, ADR-015) + F3abbbbb → F3abbbbba (law module + gate) + F3abbbbbb (wire laws into the catalog, 1×, orbit-gate pins incl. period-ratio, m1b Kepler-3 clause) + F3abbbbbc (real e/i/Ω/ω, elliptic/inclined oracle ADR-016, D-ADR-2 in full) | DONE (sessions 115–125; ADR-011…ADR-016; Lead confirmed complete 2026-10-27, ff-merged into `main` session 125) | complete (Lead-confirmed; tracker read 6/8 before F3abbbbbc) · F3aa done: `src/core/orbit/realBodyData.ts` + gate `tools/test-real-body-data.mjs` 63/63 · F3aba done: `validateOrbit` in KeplerRail + gate `tools/test-rail-validation.mjs` 35/35 exit 0, `--self-test` 6/6 exit 0 · F3abba done: `spinLaw.ts` + `CelestialConfig.spin`, gate `tools/test-spin-law.mjs` PASS, `--self-test` 7/7 · F3abbba done: alloc calibration control on private keys, alloc-loops/alloc-gate `--self-test` EXIT=0 · F3abbbba done: laws R_g = k·R/(1+R/20,000 km), a_g ∝ a^0.491234, T_real/360; probe 8/8 exit 0 ×2, control exit 1 (ADR-015) · F3abbbbba done: `src/core/orbit/scaleLaw.ts` (ADR-015 laws + derived μHost/gravityRange/portalDist, not yet consumed) + gate `tools/test-scale-law.mjs` 11/11 exit 0 ×2, `--self-test` 12/12 exit 0 ×2 · next: F3abbbbbb · F3abbbbbb DONE (session 123, ADR-015 addendum): catalog wired to scale laws at 1×; F3abbbbbc DONE (session 124, ADR-016): real e/i/Omega/omega/M0 in celestialData via orbitElements.ts, orbit gate rewritten with independent oracle 9/9 + self-test 22/22; next: ff-merge F3a into main (see F3a-follow-ups) | 7e550b2 | — (F2f unblocked by the Lead 2026-10-26; it runs after F3a merges). Fixed: alloc-loops `--self-test` blocker (F3abbba, ADR-014). Fixed 7e550b2 (session 125): test-play-controller, was 56/57 (camera heap delta ≈97 KB/10k frames) fails on the unedited tree too — pre-existing |
| F3a-follow-ups (added by session 124, not started) | `f3a-catalog` | (1) DONE session 125: Lead confirmed, F3a fast-forwarded into `main`, both branches pushed; (2) DONE session 126 (Lead ruled re-pin, 2026-10-27): spawn/respawn camera `frameToward` puts the Earth 13° above the view axis (was 31.93°); spawn site unchanged; old `< 31°` frame row restored; ADR-017, evidence `docs/audit/evidence/F3a/fu2/`; (3) DONE session 125: regress re-run on 764f839, every non-deliberate check exit 0, evidence in `docs/audit/evidence/F3a/abbbbbc-verify/` (`abbbbbc/exits.txt` left as committed, stale); (4) restore the strict real-tree churn check in test-alloc-gate after F5a; (5) DONE session 125: camera heap delta check was a JIT-warm-up flake (9/14 fails on both trees); 2000-frame warm-up added, 14/14 exit 0; (6) confirm the node-origin convention for non-planet moons (ASSUMED ascending node on the ICRF equator, ADR-016) against a source | OPEN — (2) done and merged; (4) waits for F5a, (6) not blocking; F2f is next (Lead) | 4/6 | 81be6d8 | — |
| F2f m1f gates R1–R5 rebuilt + R2 bisect | `f2f-m1f-gate` | defined in `docs/audit/U27c-fix-tasks.md` §2; Lead directive naming 1F (ledger, session 115b); split per §12 into F2fa (bisect A1-U01-1), F2fb → F2fba (attribute inside 3057899) + F2fbb → F2fbba (pass-level mechanism + pose decision) + F2fbbb (why terrain lies on the Sun sightline), F2fc → F2fcaa (R2 gate design, ADR-021) + F2fcab (R2 gate implementation), then new R1–R5 gates as new files (later units) | IN PROGRESS — F2fa DONE session 127 (ADR-018); F2fba DONE session 128; F2fbba DONE session 129 (ADR-019); F2fbbb DONE session 130 (ADR-020); F2fcaa DONE session 131 (ADR-021, design only) | F2fa 1/1: first bad commit for R2 = `3057899` CONFIRMED (parent `c0ae8bf` R2 PASS ×2, footprint 99.1%; `3057899` R2 FAIL ×2, footprint 0 px); evidence `docs/audit/evidence/F2f/a/` · F2fba DONE: R2 cause = F-12 Sun-pose POSITION (`sunPose` = render-local `drv − O` instead of absolute `drv`); the radial-up change is innocent — `F12sunPos` R2 PASS ×2, `F12sunUp` R2 FAIL ×2 (0 px), whole-hunk revert PASS ×2; tool `tools/audit/f2fb-make-variant.py`; evidence `docs/audit/evidence/F2f/b/` · F2fbba DONE: at the local pose the far pass draws the Sun 1,371 px, the NEAR-pass terrain overdraws it (terrain hidden → 1,371; astronaut hidden → 0); absolute pose passes by accident (camera ‖O‖≈1.38 km off the render-local scene); correct pose = render-local; new R2 reads the far pass only (ADR-019); evidence `docs/audit/evidence/F2f/bb/` · F2fbbb DONE: the occlusion is REAL — spinGroup matches the spin law exactly (0°, 0 m), camera 0.6 m above ground on a 2.51 m boom, terrain horizon toward the Sun 61° at 41 m > Sun 33°; render correct, R2(b) pose was never checked for a clear sightline; rebuilt R2 = far-pass footprint + composite check at a horizon-verified pose (ADR-020); side: mesh surface ~0.5 m above the analytic heightfield near the camera (harness boom clamp); evidence `docs/audit/evidence/F2f/bbb/` · F2fcaa DONE: R2 gate design (new page `?page=m1fR2` + `e2e/m1f-r2.spec.ts`, rows R2a angular law / R2b far-pass footprint / R2c composite at a horizon+raycast-verified pose, 4 mutants) · next: F2fcab (implement the R2 gate per ADR-021) | 3a2d629 | R5 waiver stays until the Lead lifts it; 1F rows PARKED except under the 115b directive |
| T2 atmospheres + manual landing + cruise speed | (not cut) | NOT STARTED — defined 2026-10-23 (Lead); no plan yet | NOT STARTED | — | — | Starts only on a Lead order; gap audited by A1-U19 (docs/audit/U19-aero-atmosphere.md: A1-U19-1..4 are T2 prerequisites; Lead look-and-feel rulings 2026-10-23: thin glowing atmosphere; soft/hard/crash landing) |


Note: "Last commit" = the commit BEFORE the newest checkpoint (a file cannot
contain its own hash); current HEAD: `git log -1`.

## PARKED (carried from phase 1 — resume ONLY by a Lead directive naming the item)
| Item | State | Note |
|------|-------|------|
| MS 1F | RULING PENDING | Round-7 option menu at `notes/reports/M1F.md` §15.7 (recommendation (a): rebase gate ≥ 2 → ≥ 1). Do not touch 1F code without a directive naming 1F. |
| MS 1G | DEFERRED (ignored) | Explicitly out of scope — "much later" per Lead, 2026-10-19. Do not start or plan. |

## TASK DEFINITIONS

### A1 — ENGINE AUDIT (read-only) — DONE (accepted 2026-10-26)
Why: specs by GLM 5.3, engine by GLM 5.3 Flash (Lead, 2026-10-21); several gates
looked tuned-to-pass (R2 tautological θ audit, R2 comment/code tolerance mismatch,
R3 threshold 45→8, R5 waived) and the m1f baseline is red on the unedited tree.
Goal: evidence-backed findings on specs, engine, play layer and tests, sized into
later fix tasks. READ-ONLY (AGENT_BRIEF.md §11). Plan: `docs/A1-plan.md` (27 units;
Lead 2026-10-25/26 prefers related rechecks batched within a 50-OLU session with wrap-up/push reserve). Ends at a LEAD GATE: the Lead triages
`docs/audit/FINDINGS.md`; then fix tasks F1, F2, … are planned; T1 resumes after
the Lead decides when.

### T2 — PER-BODY ATMOSPHERES, MANUAL LANDING, DEEP-SPACE CRUISE SPEED — NOT STARTED
Source: Lead, 2026-10-23 (session 74, chat). Requirement:
1. Every planet and moon that has a real atmosphere gets one in the flight model, with
   its own real-world-based profile (density, scale height, temperature/sound speed).
   Bodies with no real atmosphere get vacuum.
2. Atmosphere affects landing (drag/lift/heating as the model supports). Landing is
   NOT automatic: the player flies the ship down to the surface of a planet or moon.
3. The 2,000 m/s figure is a DEEP-SPACE speed only: for travel between bodies through
   space without a portal. The ship reaches it only when far enough from a body.
   The planning session DECIDES the cruise speed and the distance/regime rule
   (e.g. near-body limit vs deep-space limit) and records it as an ADR (Lead delegated).
Known state @ 8b23b52 (evidence: grep, session 74):
- `celestialData.ts` has an `atmosphereHeight` per body (Venus 6000, Earth 8000,
  Mars 2000, Jupiter 12000, Saturn 15000, Titan 2000, Uranus 8000, Neptune 8000,
  Triton 100; Mercury/Moon/Phobos/Io/Titania/Pluto/Charon 0), but NOTHING in
  physics reads it (only `celestialData.ts` + `types.ts` mention it).
- The flight model uses ONE profile, `EARTHSCALE_ATMOSPHERE` (atmosphere.ts:46),
  as the FlightController default (flightController.ts:139) for every body.
- The C1 2,000 m/s cap applies everywhere on inertial |v| and also fades retro
  thrust (A1-U18-2); the spin frame split A1-U18-3 affects landing. Fix these within T2 or before it.
- Check the catalog against real data (e.g. Pluto has a thin real atmosphere but 0 here).
Order: planned by a FRESH session after A1 U19 (which audits this gap), and built
only on the Lead's execute order (phase-2 Lead gate).
Lead look-and-feel rulings (2026-10-23, A1-U19 Q1/Q2 — defaults accepted; never re-ask):
- Atmosphere: a thin, glowing shell that clearly looks thin from space (a few percent of
  the body's radius), but thick enough that the player feels the air slow the ship on descent.
- Touchdown: under ~5 m/s clean landing; 5–15 m/s hard landing with camera shake; faster =
  crash (short explosion, then respawn in orbit above the body). Exact numbers: planning ADR.

### T1 — PLAYABLE MOON
Task type: new game page (the first GAME page, not a test harness). Branch:
`t1-playable-moon` (cut from `m1-assembly` @ 3057899 — "branch m1-assembly" in
the source brief refers to that branch point). All work on this branch.

**Product (V1 — free-roam movement playground).** A standalone, playable moon
game at `/?page=play`, listed in the menu. The player controls a visible
third-person character on the procedural moon surface and can walk, run/
sprint, jump, fall, and slide on steep slopes (existing KCC behavior).
Movement must FEEL like a real game (Unreal/ROBLOX-style third-person) with
proper movement animation: idle, walk, run, jump launch/rise, fall, landing,
slope slide. No combat, objectives, inventory, quests, sound, or saves in V1 —
testing and polish follow the first playable build.

**Verified current state (trust the code over this text; re-verify before
planning — note discrepancies in the plan).** The repo contains test
harnesses, not a game shell:
- Routing: `game/src/main.tsx` static map `m1a..m1f`; one module per page,
  full page loads (module singletons + THREE prototype patches). `App.tsx`
  menu lists only m1a–m1d.
- The closest foundation is `game/src/test/Milestone1F_TestHarness.tsx` and
  its hidden manual mode `?page=m1f&manual=1` (WASD / Shift sprint / Space
  jump / C crouch / V cam TP-FP / R reset / P pause, click pointer-lock),
  which already has: moon terrain params (R = 1364.5, g = 1.62 m/s²,
  maxTerrainHeight 360), a moon-configured AstronautKCC (walk 3.2, sprint
  6.5, crouch 1.5, jump 4.2, accelTau 0.15, slope limits, sliding, airborne
  inertial flight, landing sweep), SimulationCore with frozen sky
  (`setTimeScale(0)`), FloatingOriginAdapter, TerrainMeshPool streaming
  (96 meshes, 2 workers) + quadtree LOD, SkyImpostorPool, MultiCameraRig
  three-pass renderer, and a TP/FP camera driver (boomed camera, 4-sample
  terrain clearance).
- The astronaut is a STATIC group of boxes (`buildAstronaut`, ~line 577) —
  no skeleton, rig, animation system, GLB/FBX assets, or GLTF import.
- Airborne flight is inertial (no generic air control; ZERO-G RCS is
  separate). Jump buffering: verify in KCC. Coyote time: does NOT exist.

**Architecture decision the plan must make (recommend ONE after comparing).**
- Option A — extract a shared moon bootstrap from the M1F harness used by
  both harness and play page. One source of truth, less drift; risk:
  touching the acceptance harness can regress the 1F gate.
- Option B — new play page under `game/src/play/` with a minimal duplicated
  boot, reusing core/render modules. Zero risk to the harness, fastest path;
  risk: temporary duplication of world setup.
Do NOT copy the ~1,800-line harness wholesale: the plan must identify
exactly which code is reusable, which must be extracted, which rewritten.

**Character + animation (the heart of the task).** V1 character: a
self-contained articulated astronaut built in-engine (ROBLOX-like block
proportions) replacing the static box group. The plan must specify:
- Joint hierarchy with correct pivots: root/feet, pelvis, spine/torso, head,
  upper/lower arms ×2, upper/lower legs ×2, feet. Materials + scale suited
  to third-person view; how the rig attaches under the floating-origin
  render-local hierarchy and composes with the moon spin.
- A procedural animation state machine driven by KCC telemetry — relSpeed,
  grounded, vertical velocity (absVel), slopeDeg, input magnitude + sprint,
  landing events (`integrity.lastLandingRelSpeed`). States + transitions:
  Idle, Walk, Run, Jump launch, Jump rise, Apex/fall, Land, Slide. How poses
  blend (crossfade times, weights), stride frequency scaling with speed,
  practical foot-slide minimization; jump/fall poses: crouch anticipation,
  extended launch, tucked rise, arms-out fall, landing crouch + recovery.
- A clean `CharacterAnimator` interface so a future GLB (GLTFLoader from
  three/examples is in node_modules; AnimationMixer + clips) can replace the
  procedural rig WITHOUT rewriting the controller. V1 must not depend on
  obtaining an external asset.

**Controller + game feel.** The plan must cover:
- Camera-relative WASD: the KCC moves along its own fwd/right — the play
  layer computes the desired tangent direction from camera yaw, rotates the
  character toward it, and drives moveF/moveR/turnRate correctly.
- Third-person camera: mouse orbit, boomed/spring-arm follow, terrain
  collision + minimum distance, smoothed position/rotation, FP toggle.
- Jump feel: use the KCC's jump buffering (verify first); add play-layer
  coyote time; landing recovery; OPTIONAL limited air control — prefer an
  opt-in KCC config field whose default (0/off) preserves acceptance
  behavior over changing existing defaults.
- Sprint behavior + speed tuning; slope behavior + sliding; pause/resume
  must not advance physics; fixed-step simulation (frame-rate-independent
  feel); respawn to spawn point.
- Identify exactly which behaviors belong in the play controller vs the
  core KCC, and which core changes are acceptance-safe.

**World + presentation.** Scenic, walkable spawn (the existing Earthrise
spawn is a candidate — evaluate whether its corridor suits free roam); keep
terrain streaming + floating origin; REMOVE test-only probes, satellites,
acceptance HUD, autopilot; evaluate reusing MultiCameraRig unchanged (keep
the three-pass renderer if terrain/sky need it); minimal HUD (controls hint,
optional speed/coords/FPS, pause overlay, loading state while terrain warms
up); menu entry + routing; pointer lock + click-to-play overlay; performance:
smooth at typical desktop frame rates, avoid per-frame allocations.

**Hard constraints (all bind).**
- Do NOT modify Design_specs/ or Milestone/. Do NOT change M1F acceptance
  rows, thresholds, or R5/F-09/F-10 behavior (1F is PARKED — its R5 gap is a
  known test-coverage/ruling issue, not a reason to change the game design;
  R5 FAIL is WAIVED = PASS in T1 verification, Lead directive 2026-10-20).
- The play page must NOT import Milestone1F_TestHarness.tsx (module
  singletons + test-only code would execute). Keep the page additive and
  independently loadable.
- Reuse core/render modules — never reimplement physics, terrain, sky, or
  floating origin. Preserve frame-rate-independent physics.
- Character animation must be visible and driven by real movement state,
  not a canned loop. V1 free-roam only. Clean GLB-swap path required.

**Required structure of `docs/T1-plan.md`** (in addition to the standard
schema header + PLANNING CHECKLIST, the finished plan must contain, in
order): 1 executive summary (recommended architecture + why) · 2 assumptions
and open questions · 3 current-state findings (verified repo facts) ·
4 architecture (module/data-flow diagram, text) · 5 file-by-file change plan
(new + edited files, purpose, key exports/APIs) · 6 world bootstrap plan
(exact reuse/extraction strategy + exclusions) · 7 character rig
specification (hierarchy, dimensions, pivots, materials) · 8 animation state
machine (TABLE: states, entry conditions, exit conditions, pose drivers,
blend times) · 9 controller + camera plan (input mapping, movement math,
jump/fall/landing, camera behavior, KCC touchpoints) · 10 game shell + HUD
plan (route, menu, loading, pointer lock, pause, respawn) · 11 performance
plan (allocations, terrain/LOD, render passes, budgets) · 12 implementation
phases (ordered, incremental, each with a playable/verifiable outcome +
acceptance checks) · 13 verification plan (typecheck, build, manual test
matrix, optional Playwright smoke, M1F regression check) · 14 risk register
(risk, impact, mitigation) · 15 first coding step (the single smallest
change to begin after plan approval). Specific enough that a coding model
can start file creation without making architectural decisions from scratch
— include function/class names, data structures, pseudocode where useful;
do NOT write the full implementation.

**Reference facts.** Verify from `game/`: `npm run typecheck`, `npm run
build`, `npm run dev`, `npx playwright test e2e/m1f.spec.ts` (do not
break). Routes: menu `http://localhost:5173/` · existing manual scene
`?page=m1f&manual=1` · target `?page=play`. 1F-harness line anchors: moon
setup/KCC config ~100 · spawn search ~170 · terrain LOD/quadtree ~330 ·
static scene + astronaut ~440–598 · input/camera ~650–780 · layer
assignment/sky ~840+ · frame loop/manual mode ~1380+ · HUD ~1580+.

**Stage.** Plan: `docs/T1-plan.md` — NOT YET WRITTEN. The planning session:
read the repository first and verify every path/API/assumption against the
source (the code wins over this definition on any conflict — note the
discrepancy in the plan); author the plan INCREMENTALLY per the schema
below (PLANNING CHECKLIST items; the 15 required sections are the "Steps"
item's content); NO game-code changes during planning — only the plan
document + process files; on completion set plan status READY and STOP at
the LEAD GATE.

## PLAN FILE SCHEMA (every `docs/<task>-plan.md` follows this exactly)
Audit plans (A-tasks) use audit units (Uxx, default one per session; recheck batches per active plan) instead of build
steps; see `docs/A1-plan.md`.
- Header: task id · branch · stage (PLANNING / READY / BUILDING / DONE) ·
  last-updated date · "resume at the FIRST UNCHECKED BOX (planning item or
  build step)".
- PLANNING CHECKLIST — at the top of the file, created on the FIRST planning
  commit (file starts as header + empty checklist):
  [ ] Goal · [ ] Scope IN · [ ] Scope OUT · [ ] Affected modules · [ ] Steps ·
  [ ] Verification per step · [ ] Risks & open decisions.
  Sections are then drafted, checked off, committed, pushed — planning is
  INCREMENTAL and multi-session, exactly like building. Status lifecycle:
  NOT STARTED → IN PROGRESS (n/m sections) → READY. On completion: set plan
  status READY, repoint STATE.md NEXT ACTION, and STOP at the LEAD GATE
  (AGENT_BRIEF.md §4).
- Goal: 1–3 sentences.
- Scope IN / Scope OUT: bulleted, concrete.
- Affected modules: file paths.
- Steps: an ORDERED checklist; each step is small enough to verify and commit in
  one segment, and states its own verification (command + expected evidence).
- Risks & open decisions: anything needing a Lead ruling.
- A box is DONE when: checked + verification passed (where applicable) + the
  commit that carries it — which ALSO carries the tracker row + STATE.md NEXT
  ACTION update — is pushed. A box is the commit unit (AGENT_BRIEF.md §4/§6).

## HOW TO RESUME A TASK MIDWAY (fresh session — full procedure in AGENT_BRIEF.md §5)
1. Read `AGENT_BRIEF.md` (the phase-2 contract above all else). A1 also binds
   §11 AUDIT MODE, §12 SESSION BUDGET and §13 GOAL & DECISION AUTHORITY.
2. Here: find the ACTIVE task row (any row whose stage is not DONE).
3. Open its `docs/<task>-plan.md`: the FIRST UNCHECKED BOX is the starting point —
   a planning-checklist item while the plan is IN PROGRESS, a build step once
   building (if the plan is READY but no execute order is on record, you are at
   the LEAD GATE — do not build; report and wait).
4. `notes/STATE.md` NEXT ACTION confirms or overrides (it binds).
5. Reconcile `git log --oneline -15` + `git status` vs tracker; evidence wins;
   repair drift and note the repair in the SESSION LOG.
6. Continue (planning or building); commit+push per completed segment — each
   commit carries its checkbox + tracker row + STATE.md NEXT ACTION update
   (AGENT_BRIEF.md §6); session end adds the SESSION LOG handoff note.
