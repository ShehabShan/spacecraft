# A1-U13 — SimulationCore (tick order, fixed step, clocks, shedding)

- Unit: U13 · Branch `a1-engine-audit` @ 75f43fe · Session 68 (2026-10-23) · READ-ONLY
- Files read in full: `game/src/core/simulation/SimulationCore.ts` (486). Also read the
  callers' accumulator code: `play/controller/PlayerController.ts:75–90`,
  `play/frame/playFrame.ts:80–110`, `play/world/moonWorld.ts:60–110, 145`.
- Specs: `Design_specs/01_ARCHITECTURE.txt` §1 (canonical tick order, lines 8–16),
  `02_PHYSICS_AND_SCALE.txt` §6 (lines 61–64), `00_VISION_AND_RULES.txt` lines 13, 39.
- Probes (real core, nothing written):
  - `node --expose-gc tools/audit/u13-simulation-core.mjs` → **PROBE_EXIT=0**, controls 4/4
  - `node --expose-gc tools/audit/u13b-lockstep-gc.mjs` → **PROBE_EXIT=0**
  - GC scaling: `node --trace-gc` on 1e6 / 4e6 ticks after a 20k warm-up (an inline script; the counts are given in A1-U13-7)

## Claims written before reading the code
1. Tick order follows spec 01.1: macro rails → bubble test → **parented compose** (astronaut
   planet-local × the planet's rotation rail) → rebase → forces → step → write-back → extract.
2. Fixed step 1/60 s; at most 5 substeps per frame; if still behind, **shed load** (fewer
   visuals / freeze far physics) — never dilate the timestep (spec 02 §6).
3. Every stream of frames ≥ 12 fps runs game time at exactly 1×; the accumulator keeps the
   sub-tick remainder so time is never lost.
4. Rendering between ticks needs an interpolation factor (accumulator / dt), or a 144 Hz
   display shows uneven motion.
5. Macro clock = 30 × micro clock, both drift-free over a long session; scale 0 freezes
   orbits only.
6. One logical clock: anything that ticks the KCC must tick the core the same number of times.
7. "Allocation per tick: 0" (header comment).

## Findings

### A1-U13-1 — The tick has no parented-compose step: the player world is detached from the solar system
- Severity: S1     Confidence: confirmed (missing step) / likely (consequence)
- Category: engine + spec
- Location: `core/simulation/SimulationCore.ts:398–470` @ 75f43fe (tick); spec `01_ARCHITECTURE.txt` §1 step 3
- Claim: spec 01.1 step 3 composes the astronaut's planet-local position with the planet's
  rotation rail to get its absolute position, every tick, inside the core.
- Evidence: the tick runs macro → `P += V·dt` (plain absolute Euler) → bubble → rebase → extract.
  No entity has a parent body. Nothing in `src/core` reads a celestial's `absPos` for an
  entity: grep `parent|compose` in `src/core` hits only `astronautKCC.ts`, which composes
  against its own private spin phase, not a rail. Both places that put a player on a body
  freeze the sky to make this work: `play/world/moonWorld.ts:67` and
  `Milestone1F_TestHarness.tsx:113` call `core.setTimeScale(0)`. Together with A1-U12-1
  (no body rotates), the core cannot represent "a player standing on a moving, rotating Moon".
- Impact: the goal (AGENT_BRIEF §13: every body orbits and rotates in real time, with the
  player on it) is not reachable with this tick. Un-freezing the sky in play would move the
  Moon along its rail (~1 km/s around Earth) while the astronaut stays at the world origin.
- Proposed fix: add body-relative entity state (parent id + local f64 pose) and a compose step
  between the macro update and the bubble test, using the rotation rails from the A1-U12-1 fix.
  This is an architecture change → U26 verdict + ADR. It touches no RATIFIED item directly.
- Fix task size: more than one session. Split: (a) entity parent field + translation-only
  compose, (b) rotation-rail compose after A1-U12-1, (c) KCC spin source switched to the rail.

### A1-U13-2 — Controller and core accumulators drift apart at 144 Hz (16.7 % of frames)
- Severity: S1     Confidence: confirmed (mismatch) / likely (visible jitter)
- Category: play + engine
- Location: `play/controller/PlayerController.ts:81` (`acc >= TICK - 1e-9`) vs
  `core/simulation/SimulationCore.ts:387` (`acc >= FIXED_DT`, no tolerance); both are driven
  from `play/frame/playFrame.ts:98–99` with the same `clock.dt`
- Claim: one clock — the KCC and the core tick the same number of times every frame
  (playFrame comment: "then the core on the same dt").
- Evidence: `u13b-lockstep-gc.mjs`, controller accumulator copied verbatim, 36,000 frames:
  `L.hz144 mismatchFrames=5999 (16.664%) maxLag=1`; `L.rAF144q` (0.1 ms quantised timestamps)
  `1999 (5.55%)`; 60/90/120 Hz and jittered 60 Hz: 0 mismatches. Separately, `P1.hz144` shows
  the core alone makes 599 ticks in 10 s of 1/144 frames, where the controller makes 600.
- Impact: on 1 in 6 frames at 144 Hz, the KCC has moved one tick but the core has not yet
  extracted `localPosF32` or tested for a rebase. The character mesh is placed from the core
  locals (`playFrame.ts:105–106`), while the camera reads `kcc.absPos` directly
  (`ThirdPersonCamera.ts:105`). So the character can lag the camera by 1 tick (≈ 0.11 m at
  sprint 6.5 m/s). To confirm: a playFrame probe at 144 Hz that compares `characterRoot` with
  the KCC local every frame.
- Proposed fix: a single accumulator. Either the play frame computes the tick count once and
  calls `kcc` + `core.tick()` n times, or the core's `advance()` returns n and the controller
  follows it. Not RATIFIED.
- Fix task size: fits one session (including a lockstep row in test-play-frame).

### A1-U13-3 — Below 12 fps the game runs in slow motion; the spec's load shedding does not exist and `shedSeconds` under-counts
- Severity: S2     Confidence: confirmed
- Category: engine + spec + doc
- Location: `SimulationCore.ts:381–394` (`advance`); header "shed load, never dilate" (:53)
- Claim: spec 02 §6 says that after 5 substeps the engine should *shed load* (drop meteor
  visuals, freeze distant physics) rather than dilate time. The stat name `shedSeconds`
  suggests it measures that.
- Evidence (`u13-simulation-core.mjs` P2, 60 s of wall time): 12–30 fps → gameRate 1.0;
  11 fps 0.917; 10 fps 0.833; 5 fps 0.417; 1 fps 0.083. The code never reduces work; it
  discards wall time, which dilates the whole game. The accounting is incomplete: the
  `MAX_ADVANCE_DT` 0.25 s clamp is not counted (`P2.fps2 shedSeconds=20 unaccounted=30`;
  `P2b.stall2s shed=0.167 unaccounted=1.75`). The shed branch also zeroes the sub-tick
  remainder (`P2c.spike0.1 shed=0.0167`).
- Impact: on a slow machine the whole game slows down instead of degrading visuals, and the
  telemetry hides how much time was lost. Dropping time is a reasonable spiral-of-death
  guard, but it is not what the spec or the comment describes.
- Proposed fix: count the clamp excess in a separate `droppedSeconds` stat and keep the
  sub-tick remainder when shedding. Document "time drop below 12 fps" as the chosen policy
  (or add real load shedding later) and fix the comment. Not RATIFIED.
- Fix task size: fits one session.

### A1-U13-4 — No interpolation factor: 58 % of frames at 144 Hz render with no new tick
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `SimulationCore.ts:96` (`_accumulator` is private, no getter); the render extract runs only in `tick()`
- Claim: a fixed-step loop rendered at a higher rate needs `alpha = acc / dt` to interpolate.
- Evidence: P1 ticks-per-frame histograms: 144 Hz `{0: 841, 1: 599}`; 75 Hz `{0: 150, 1: 600}`;
  240 Hz `{0: 1800, 1: 600}`. Nothing in `play/frame` or the controller interpolates
  (grep `alpha|interp`: 0 hits).
- Impact: on any display faster than 60 Hz, moving objects advance in uneven 0- or 1-tick
  steps per displayed frame (judder).
- Proposed fix: expose `get alpha()` and interpolate the render extract between the previous
  and current f64 pose (keep a `prevAbsPos`). Not RATIFIED.
- Fix task size: fits one session (core + play extract; m1a regression).

### A1-U13-5 — A rebase listener that unsubscribes during the emit makes the next listener miss the event
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `SimulationCore.ts:350–357` (`onRebase` unsubscribe uses `splice`) + `:360–368` (`_emitRebase` indexed loop)
- Claim: every subscribed listener receives each rebase event exactly once.
- Evidence: P5 — L1 unsubscribes itself on the first event: `firstRebaseCalls=L1,L3`
  (L2 is skipped); second event: `L2,L3`.
- Impact: any one-shot rebase listener (e.g. a future "after first rebase" hook) silently
  costs another listener one rebase delta, and a missed delta puts an object 256·k m off.
  No current caller unsubscribes during the emit (only the harnesses subscribe).
- Proposed fix: iterate a snapshot length backwards, or defer removals until the emit ends.
- Fix task size: fits one session (tiny).

### A1-U13-6 — `moonWorld` ticks the core directly at boot and on every respawn
- Severity: S3     Confidence: confirmed
- Category: play
- Location: `play/world/moonWorld.ts:101–106` (`syncEntity` → `core.tick()`), `:145` (respawn)
- Claim: only `advance()` drives the clocks (single writer).
- Evidence: each respawn adds one macro step and one micro tick (`tickCount`, `stats.simTime`
  +1/60 s) outside the frame's accumulator. P6: if the entity were `dynamic`, the copied KCC
  velocity would also be integrated (0.108 m at 6.5 m/s). In play the entity is
  `dynamic: false` (`moonWorld.ts:76`), so only the clocks are affected.
- Impact: negligible now. Once the sky moves (A1-U13-1) it becomes a drift source, because
  each respawn advances the orbits by a hidden step.
- Proposed fix: a core method `refreshExtract()` (rebase test + extract, no clock advance)
  for re-seeding. Not RATIFIED.
- Fix task size: fits one session (together with A1-U13-2).

### A1-U13-7 — "Allocation per tick: 0" is not exact (≈ 1.6 B/tick, GC count grows with N)
- Severity: S3     Confidence: likely (cause not isolated)
- Category: engine + doc
- Location: header `SimulationCore.ts:35–37`
- Claim: the tick allocates nothing.
- Evidence: `u13b` heap deltas over 1e6 ticks (after gc + 20k warm-up): stub rail, no entity
  9 KB (0.009 B/tick); paused real rail 10 KB; one entity, no rebase 1,536 KB (1.57 B/tick);
  real rail at 30× 1,681 KB (1.72 B/tick). `--trace-gc` counts after warm-up, 1e6 → 4e6
  ticks: empty loop 2 → 1; real rail 4 → 15; entity 6 → 17. The count scales with N, so this
  is not start-up noise. There is no `new` in the tick source; the likely cause is V8 boxing
  of double field writes (entity `absPos` literals, rail state). To confirm: run
  `--trace-gc-verbose` or diff heap snapshots over 1e6 entity-only ticks.
- Impact: ≈ 100 B/s at 60 Hz, i.e. a minor scavenge every few hours of play, so frame time is
  unaffected. It matters only because the zero-GC invariant (AGENT_BRIEF §3) is stated as
  exact, and heap-delta gates (A1-U09-1) cannot tell the difference.
- Proposed fix: none needed for performance. Reword the claim to "no source-level
  allocation", or store positions in a `Float64Array` (unboxed by construction), which a U26
  state-model rework may want anyway.
- Fix task size: fits one session (if done at all).

## Checked, no issue
- Integrate-then-rebase order. It differs from spec 01.1, which tests the bubble before the
  physics step, but it is the better order: the post-tick local stays bounded at the trigger
  even for a mover covering 1,000 m per tick (P8 `focusMaxLocalPostTick=1024`, 656 rebases).
  Celestial locals are extracted after any rebase, as the comment says.
- 60 Hz gives exactly 600 ticks in 10 s; 12–30 fps runs game time at exactly 1× (P1, P2).
- `advance()` ignores NaN, ±∞, 0 and negatives (P4: 0 ticks); `setTimeScale` rejects −1, NaN and ∞.
- Macro clock over 1e7 ticks (46 h of play): error 0 at 30×, −17 µs at 1×, −3.3 ms at 1,000×.
  The micro clock error is −17 µs after 46 h. All negligible.
- Pause (scale 0) freezes `simTime` and keeps the micro clock running. The rails are still
  evaluated every tick (100/100), costing ≈ 0.5 µs/tick — harmless.
- Two clocks, each with a single writer inside the core. The only writer outside the frame
  accumulator is the one in A1-U13-6.
- Tick cost with the real 16-body rail plus one entity: 0.51 µs/tick (P7).

## Seeds for later units
- U16/U17 (KCC): the KCC spin phase is integrated per `kcc.update`. Because of A1-U13-2 the
  KCC and core tick counts differ, so the spin phase and the core clock can drift apart too.
- U22/U23 (play): when fixing A1-U13-2, add a lockstep row (KCC ticks == core ticks per frame)
  to test-play-frame. Check what else reads core locals vs `kcc.absPos` in the same frame.
- U26 (architecture): A1-U13-1 + A1-U12-1 decide the entity/state model (body-relative
  entities, rotation rails, interpolated extract, `Float64Array` state).