# A1-U26 — Architecture fitness vs the goal (AGENT_BRIEF §13)

Unit: U26 · Session 83 · 2026-10-25 · audited at `6496d01` (read-only).

**Question.** Can this architecture deliver a real-looking, real-time solar system
(every body orbits and rotates) at good fps, and take later features (combat, AI
entities, vehicles, new bodies) without a rewrite?

**Method.** I wrote the claims first, from §13 and the design (a scalable entity
layer, per-body frames, one clock, a shared terrain service, extensible frame
stages). I read the code that carries each claim and measured the structural
limits with two probes on the real core code:
- `game/tools/audit/u26-architecture-fitness.mjs` (output in `U26-probe-output.txt`; PROBE_EXIT=0, controls 2/2);
- `game/tools/audit/u26b-terrain-singleton-walk.mjs` (output in `U26b-probe-output.txt`; PROBE_EXIT=0).

Both are run from `game/` with `node --expose-gc tools/audit/<file>.mjs`.

I then weighed the U01–U25 findings per area. Timings come from a single run on a
2 vCPU VM under Node 24. Treat them as orders of magnitude, not benchmarks.

## 1. Verdict per area

| Area | Verdict | Basis | Draft ADR |
|---|---|---|---|
| Test gates (harness pages, e2e, play Node tests) | **REWORK first** | U01–U09, U25-1. Many rows cannot fail on their claims, so no later fix can be trusted until it has a gate that a mutant turns red. | D-ADR-1 |
| Orbits: analytic Kepler rails | **KEEP**, then extend | U12: the solver and periods are clean, and the cost is O(1) at any time scale. Missing: spin, eccentricity/inclination use, and boot validation (U12-1/2). | D-ADR-2, D-ADR-3 |
| Catalog / scale laws | **REFACTOR** | U10: two radius laws, day > year, and the Moon at 0.71 of Earth's Hill radius. Fixing this changes RATIFIED constants. | D-ADR-2 |
| Reference frames / state model | **REWORK** (A1-U26-2, S1) | There is no frame tree. Body spin is private to the KCC, and the play page freezes the sky. | D-ADR-3 |
| Precision: f64 core + 256 m floating origin | **KEEP** | U11: the lattice, the narrowing order and the Pluto ulp are clean. Only adapter edge cases remain (U11-1/2). | — |
| Time stepping | **REFACTOR** | U13-2/3/4, U23-1/2: two accumulators, no render alpha, slow-down below 12 fps. | D-ADR-4 |
| Entity model | **REFACTOR** (A1-U26-3) | It scales (probe B), but an entity holds position and velocity only. | D-ADR-5 |
| Terrain field + height service | **REFACTOR** (A1-U26-1) | One field per thread. Drawn terrain ≠ collision terrain (U22-1). The height path is the main source of garbage (U25-1). | D-ADR-6 |
| Physics method: analytic KCC + sweeps, no Rapier | **KEEP** | Cheap (probe C) and deterministic across instances (probe D). The defects are local (U16–U18). | — |
| Render: layered Near/Mid/Far cameras, impostors | **KEEP the structure**, refactor the parts | U21/U15/U22: handoff, pass order, quad shape and budgets are local defects. The banding itself is sound for WebGL2. | D-ADR-7 |
| Workers | **KEEP**, fix the budgets | U20: drops when meshes > sets, and worker 0 does almost all the work. Physics stays on the main thread, which fits the measured cost. | D-ADR-7 |
| Play layer: frame pipeline, world, rig | **REFACTOR** (A1-U26-4) | Hand-ordered moon-only frame and module-level rig cameras. | D-ADR-8 |

**Overall.** The *method* is right for the goal. Analytic rails, a Float64 core
with a floating origin, an analytic terrain field, an analytic KCC, layered
cameras and worker meshing are all the cheap, exact, scalable choices a real-time
solar system needs. No area calls for a new library or a rewrite from scratch.

What is missing is the *state model* that ties these parts together: rotating
body frames, a richer entity record, and per-body terrain. Most of the U12–U19
frame bugs come from that gap. It is one REWORK, done in session-sized steps; the
other areas are REFACTORs.

**Fix order** (for U27): gates → catalog laws + body frames/spin → one clock with
interpolation → terrain instance + height service (zero-GC) → controllers ported
to the new frames, then T2 → render handoff, budgets and impostors → play
scheduler and multi-body World.

## 2. Findings

### A1-U26-1 — Terrain field is a per-thread singleton: a second body's init silently re-points every live actor
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `game/src/core/terrain/terrainField.ts:72` (`let P`), `:76` `initTerrainField`; `game/src/core/terrain/noise.ts:25-27` (`perm`, `activeSeed`); consumers `astronautKCC.ts:351/650/713`, `flightController.ts`, `ThirdPersonCamera.ts`, `CharacterTelemetry.ts`, `MoonLod.ts`, `spawn.ts` @ 6496d01
- Claim (§13 goal): every planet and moon is a place. Approaching a body from orbit, or a vehicle on a second body, means more than one surface is live at a time.
- Evidence:
  - u26 part A: the same direction reads h = −10.29 m (Moon), −122.9 m after `initTerrainField(TEST_PLANET)`, and −10.29 m again after re-init. The free functions follow whichever body was initialised last.
  - u26b: a KCC walking on the Moon is 0.020 m above the Moon ground. After a second `initTerrainField` and 60 ticks it is **0.711 m below** the Moon ground (AGL −0.280 against the wrong field), with mode SURFACE and nanEvents 0. No error is raised.
  - A standing KCC does not re-sample, so it shows 0 m drift (part A). The fault is silent until the actor moves.
- Impact: multi-body play cannot be added without touching every consumer. Mixing two bodies on one thread corrupts contact with no signal. Workers repeat the same singleton (`terrainWorker.ts:62`).
- Proposed fix: a `TerrainField` instance per body (params + noise tables), passed to every consumer and to worker init. The free functions become wrappers during the port. See D-ADR-6.
- Fix task size: 2 sessions — (a) the instance plus a core wrapper port with a bit-identical regression; (b) consumers and the worker.

### A1-U26-2 — No reference-frame model: bodies have no spin, actors have no parent frame (synthesis of U12-1, U13-1, U17-1/2, U18-3)
- Severity: S1     Confidence: confirmed (code citation + the cited units' repros)
- Category: engine
- Location: `SimulationCore.ts:400-477`: tick = rail.evaluate → P += V·dt → rebase → extract, with no frame or spin step. `moonWorld.ts` `core.setTimeScale(0)`. The KCC's private `spinOmega` (`astronautKCC.ts:602`). `playFrame.ts` stage 6 composes `kcc.spinPhase` into a THREE group @ 6496d01
- Claim (§13): "every planet and moon rotates and orbits, computed in real time".
- Evidence: the core has no rotation state for any body (U12-1). Only the KCC integrates a spin, and the play world needs the macro clock frozen to stand on the Moon (U13-1). Each module picks its own frame, and the results are already measured:
  - airborne up mixes the world and planet frames (43.9° at θ = π/2, U17-1);
  - a parked vehicle drifts by θ (U17-2);
  - a parked ship slides 178.6 m in 10 s under spin (U18-3).
- Impact: the core goal (rotating and orbiting bodies with walkable surfaces) cannot be switched on without these bugs going live. Every new actor type (vehicle, NPC, alien) would re-implement the frame math.
- Proposed fix: a core-owned frame tree. Each body gets its rail position plus an analytic spin quaternion. Actors carry `frameId` plus body-local f64 state, and one compose step yields world and render positions. Switching sphere of influence is an explicit state conversion. See D-ADR-3. This touches RATIFIED items only through the catalog (D-ADR-2).
- Fix task size: no single session. Split it:
  - (a) spin data + analytic body quaternion + gate;
  - (b) frame tree + compose in tick + gate;
  - (c) KCC on body-local state;
  - (d) flight + SOI switch;
  - (e) unfreeze the play clock.

### A1-U26-3 — Core entity record is position/velocity only; physics lives outside the core and writes through
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `core/types.ts` `EntityState`; `SimulationCore.ts:231-263` `registerEntity`; `astronautKCC.ts:285` `attachWriteThrough`, `:431`; `moonWorld.ts` boot seed + manual `core.tick()` (B4c fix) @ 6496d01
- Claim: the core is the entity layer that combat, AI and vehicles register into and query.
- Evidence:
  - u26 B: the entity fields are exactly `id|absPos|velocity|localPosF32|dynamic`. There is no orientation, frame, kind or controller hook.
  - The KCC and flight controller run outside the tick and copy their position in. The play boot needs a hand seed plus an extra tick to avoid rendering inside the Moon (STATE row 34), and the core ticks are ordered by the caller (U13-6).
  - Scaling is fine: 9.4 ns per entity at N = 1,000 (9.4 µs/tick) and 27 ns at N = 10,000 (270 µs/tick, 1.6 % of a frame). The flat-array design holds; only its contents are too thin.
- Impact: an AI or weapon system cannot ask the core "where does entity X face, and in which frame". Each controller has its own state copy, and the order of copies is a source of one-tick lag (U13-2).
- Proposed fix: add quat, `frameId`, kind, and a `step(dt)` hook that the core calls in tick order. Retire write-through. See D-ADR-5. No library needed.
- Fix task size: 1 session (after A1-U26-2b).

### A1-U26-4 — Play frame and rig are single-world, hand-ordered and module-global: no extension seam
- Severity: S2     Confidence: confirmed
- Category: play
- Location: `play/frame/playFrame.ts` (11 hard-coded stages over one `MoonWorld`, one `kcc`, one `ctrl`); `render/MultiCameraRig.tsx:64-66` (module-level `rigCamNear/Mid/Far`); `astronautKCC.ts` / `flightController.ts` module scratch, including `let segP0x…segLen` DDA state @ 6496d01
- Claim: new features (vehicles, enemies, more bodies) plug in without editing the frame.
- Evidence:
  - Every stage names the moon world's fields directly (`w.kcc`, `w.spinGroup`, `w.lod`, `w.pool`). Adding an actor or a body means editing the frame function, and the rig cameras exist once per page.
  - The module scratch is safe when instances run one after another: in u26 D, two KCCs interleaved tick by tick leave actor A **bit-identical** to running alone (Δ = 0 m). It is unsafe only for re-entrant use. Flight's DDA state lives in module `let`s between `_sweepTerrain` and `_resolveContact`.
- Impact: every feature task edits the same 150-line function, and ordering bugs come back (U13). It is not a blocker today.
- Proposed fix: an ordered system list with registration, and a `World` holding N bodies and N actors. Move rig cameras onto the rig instance and flight DDA state onto the instance. Port the 11 stages 1:1 first, with a bit-identical replay check. See D-ADR-8.
- Fix task size: 2 sessions — (a) scheduler port + replay check; (b) World with N bodies/actors.

### A1-U26-5 — CPU is not the binding constraint; allocation and the height-query count are
- Severity: S3     Confidence: confirmed (measured, single machine)
- Category: engine
- Location: probe u26 C; U25-1
- Evidence:
  - `terrainHeight` takes 0.505 µs per call. One walking Moon KCC tick takes 5.4 µs (about 10.7 height calls), so roughly **740 walking actors fit in 4 ms per 60 Hz tick**. A 10k-entity core tick takes 270 µs.
  - The play frame's ≈10.5 KB/frame of garbage (U25-1) comes from the same height path. A future crowd of NPCs therefore costs GC pressure long before it costs CPU.
- Impact: future NPC and alien counts are bounded by the zero-GC gap, not by compute. The architecture has headroom.
- Proposed fix: fold into D-ADR-6 (an allocation-free height service with a per-frame cache), gated by the U25 sampler.
- Fix task size: inside the D-ADR-6 sessions.

## 3. Checked, no issue
- Entity storage scales linearly: dense array + `Map` index, swap-remove unregister, ns-scale per entity up to 10k (probe B).
- Kepler rails cost one closed-form evaluation per tick regardless of time scale (`SimulationCore.ts:405-407`). This fits "computed in real time" for all 17 celestials.
- The KCC/flight module scratch is deterministic across sequential instances (probe D bit-identical). Multiple actors per thread work today.
- Terrain field re-init is deterministic: the same params give the same heights (control A.restoreDeterministic ok). Per-thread state is *repeatable*, only *shared*.
- Core purity holds (U25), so the core can move into a worker later if a physics budget ever needs it. No such need is measured today.
- No physics library is needed for the goal: the measured analytic KCC cost leaves wide headroom (probe C), consistent with AGENT_BRIEF §3.
- The floating-origin design (256 m lattice, f64-subtract-then-narrow) is adequate for a full solar system (U11: Pluto ulp 0.25 m).

## 4. Questions for the Lead
None this unit. All choices above are technical (§13). The look-and-feel rulings
they depend on (U10a/U10b scale and orbit speed, U19 atmosphere and landing) are
already in the APPROVAL LEDGER.