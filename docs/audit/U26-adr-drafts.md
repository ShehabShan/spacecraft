# A1-U26 — Draft ADRs (proposals; promoted to `docs/decisions/` by the fix tasks)

A1 is read-only (AGENT_BRIEF §11/§13): these are the session's technical decisions,
written down so U27 and the fix tasks can adopt them. Each fix task copies its draft
to `docs/decisions/ADR-NNN-<slug>.md`, re-checks it against the code of the day, and
records the final form in the same commit as the change.

## D-ADR-1 — Independent gates before any engine fix
- Context: U01–U09 and U25-1 show gates that cannot fail on their claims (time scale, seams, Coriolis, R1–R3, zero-GC).
- Options: (a) patch thresholds in the harnesses; (b) new independent Node gates per claim with a mutant that must fail, harnesses kept as visual demos; (c) rewrite all harnesses.
- Decision: (b).
- Why: a gate is only trusted if a known-bad mutant turns it red; Node gates are fast, deterministic and VM-friendly (no SwiftShader); §13 safeguard 3 (new check lands first).
- Consequences: each fix task starts by landing its gate + mutant proof; the `?page=m1X` pages stay runnable but stop being the acceptance authority for the claims re-gated.

## D-ADR-2 — One scale law for the catalog, with rotation data
- Context: U10 (two radius compression laws, day > year, Moon at 0.71 Earth Hill radius), U12 (no spin/pole/inclination/eccentricity, all orbits circular + coplanar).
- Options: (a) keep hand-tuned table; (b) derive the playable catalog from real data by one documented law per quantity (distance, radius, time) plus real spin period, obliquity, inclination, eccentricity; (c) full 1:1.
- Decision: (b), with the laws chosen in the fix task and recorded with the Lead's look-and-feel rulings already in the APPROVAL LEDGER (U10a/U10b answers).
- Why: "looks real" needs consistent proportions; 1:1 is unplayable in travel time; a law is auditable, a table is not.
- Consequences: `celestialData.ts` constants change (RATIFIED → needs this ADR + evidence); m1b gate rewritten under D-ADR-1 first.

## D-ADR-3 — Body-fixed rotating frames owned by the core
- Context: A1-U26-2; U12-1, U13-1, U17-1/2, U18-3.
- Options: (a) keep inertial world frame and add spin per module; (b) core-owned frame tree: each body has rail position + analytic spin quaternion; actors carry `frameId` + body-local f64 state; one compose step yields world/render positions; (c) everything in each body's frame with no world frame.
- Decision: (b).
- Why: one place for frame math removes the class of mixed-frame bugs; analytic spin keeps it O(1) and exact at any time scale; body-local state keeps surface physics in a non-moving frame (no transport velocity tricks); world frame is still needed for space flight and the floating origin.
- Consequences: KCC drops its private `spinOmega` integration; flight uses the frame of its current body (SOI switch is an explicit event that converts state, conserving world velocity); the floating origin tracks the composed world position of the focus; the play page unfreezes the macro clock. Split over several sessions (see A1-U26-2).

## D-ADR-4 — Fixed tick with render interpolation and explicit, visible slow-down policy
- Context: U13-2/3/4, U23-1/2.
- Options: (a) as now (clamped accumulators, two of them, no alpha); (b) single accumulator owned by the scheduler, render interpolation alpha for actor poses and camera, per-frame look input applied at frame rate, below 12 fps drop simulated time and say so in telemetry; (c) variable dt.
- Decision: (b).
- Why: one clock removes the controller/core disagreement; alpha removes the 0-tick frames at 144 Hz; variable dt breaks the KCC/rail determinism the gates rely on.
- Consequences: the tick order in `SimulationCore.tick()` is kept; the 1/60 s FIXED_DT is kept.

## D-ADR-5 — Core entity record gains orientation, frame and a controller hook
- Context: A1-U26-3.
- Options: (a) keep position-only entities with write-through; (b) add quat, `frameId`, kind, and a `step(dt)` controller hook called by the core in tick order; (c) full ECS library.
- Decision: (b).
- Why: minimal change that lets AI/combat/vehicles query and share state; probe B shows the flat store already scales to 10k entities; a new library is not needed (§3).
- Consequences: write-through and the play boot seed/tick hack go away; controllers become core-scheduled.

## D-ADR-6 — Terrain field as a per-body instance with an allocation-free height service
- Context: A1-U26-1, U14-1/2, U22-1, U25-1.
- Options: (a) keep the singleton; (b) `TerrainField` instance per body (params + noise tables), passed to every consumer and each worker; allocation-free height/normal API with a per-frame query cache; analytic (or level-matched ε) normals; a params-derived max-height bound; collision contact against the same tessellation level that is drawn near the actor, or drawn meshes refined to the collision tolerance near the player.
- Decision: (b).
- Why: multi-body is the goal; the height path is the hottest shared service (camera, telemetry, KCC, future NPCs) and its garbage is the main zero-GC violation.
- Consequences: worker init takes a body id; the free functions become wrappers then are retired; the drawn-vs-collision choice is measured (U22-1 numbers) in the fix task.

## D-ADR-7 — Keep the layered-camera render structure; move handoff into the engine
- Context: U21-1/2/3/4, U15-3/4, U20-1, U22-2.
- Options: (a) as now; (b) keep the Near/Mid/Far bands (RATIFIED) but: mesh↔impostor handoff + hysteresis in `render/` not the 1F harness; Near pass ordering/depth fix; impostors as true projected spheres (screen-space radius from the exact cone, depth from the real distance); mesh pool sized so meshes ≤ worker sets, with drop accounting; LOD leaf budget with coarser fallback; (c) single camera + logarithmic depth.
- Decision: (b).
- Why: bands are a sound WebGL2 answer (no portable reversed-Z); the defects are in pass order, handoff placement and budgets, all local.
- Consequences: camera band numbers unchanged; the 1F harness becomes a client of the engine handoff.

## D-ADR-8 — Ordered system scheduler and a multi-body World in the play layer
- Context: A1-U26-4.
- Options: (a) keep `playFrame` as one function; (b) a fixed-order list of systems with registration (input, controllers, core tick, compose, animation, camera, sky, LOD/stream per body, UI); `World` holds N bodies and N actors; rig cameras owned by a rig instance; (c) a third-party game framework.
- Decision: (b).
- Why: features plug in as systems without editing the frame; order stays explicit and testable; no new library.
- Consequences: port the 11 stages 1:1 first with a bit-identical replay check, then add bodies/actors.