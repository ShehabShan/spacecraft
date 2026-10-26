# A1-U11 — Precision + floating origin

- Unit: U11 (`docs/A1-plan.md` §5 Phase C) · Session 66 · 2026-10-22 · audited @ dab3ddf
- Read in full: `game/src/core/math/precisionMath.ts` (170), `game/src/core/types.ts` (123),
  `game/src/render/FloatingOriginAdapter.ts` (118). Also read the rebase and extract path of
  `SimulationCore.ts`: register/unregister 231–297, getOrigin/getLocalPositionF32 318–343,
  onRebase/_emitRebase 350–369, advance 372–390 and tick 404–480.
- Spec passages: `Milestone/Milestone 1A.txt` §1.1, a grep for rebase / lattice / fround / Float32 (lines 13–36, 87–101).
- Probe: `game/tools/audit/u11-precision-origin.mjs`. It imports the REAL core and adapter modules and the real `three`, and mutates nothing under `src/`.
  - Run: `cd game && node tools/audit/u11-precision-origin.mjs; echo PROBE_EXIT=$?` → **PROBE_EXIT=0**.
  - Controls: 3/3 OK.
  - Result: 4 FINDING lines (P3, P4d, P5, P6), all analysed below.

## Claims written before trusting the code (from IEEE-754 and Milestone 1A §1.1)
- C1. O = 256·round(P/256) is an exact multiple of 256. Δ = O₂ − O₁ is f32-exact for every |Δ| < 2³² m (m·2⁸ with |m| < 2²⁴). The "|k₂−k₁| < 2¹⁶ / 17-bit" bound in the code and spec is sufficient but not necessary.
- C2. With floor(x+0.5), the post-rebase local lies in [−128, 128), which is half-open.
- C3. Locals must be computed as f64(P − O) and narrowed afterwards. With that order, render error is ≤ ½ ulp₃₂(|local|) whatever the lattice. So the power-of-two lattice matters ONLY to a consumer that translates f32 state by Δ.
- C4. The strict trigger plus nearest-lattice snapping means the post-tick focus local is ≤ 128 m after any jump. This bound needs lattice/2 < trigger, otherwise Δ = 0 rebase loops occur.
- C5. "Hidden, never destroyed" means a binding whose entity comes back must show again.

## Findings

### A1-U11-1 — Adapter never re-shows an entity that is unregistered and registered again
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `game/src/render/FloatingOriginAdapter.ts:88–95` @ dab3ddf
- Claim: the header says "an entity that is unregistered simply has its object hidden, never destroyed" (Zero-GC). That implies the binding survives, so the object reappears when the id is live again.
- Evidence: probe P5 runs with the real `SimulationCore`, the real adapter and a `THREE.Object3D`.
  - Sequence: bind 'ship' → tick + update → unregister → update → register 'ship' again → tick + update.
  - `visible` goes `true → false → false`.
  - `position.x` IS updated to 20 while the object stays hidden.
  - `update()` sets `visible = false` on null and has no path that sets it back to `true`.
- Impact: none in play today. In play the adapter has no bindings; `PlayPage.tsx:25` says "No adapter.bind".
  - Any later despawn and respawn by id makes that object invisible for the rest of the session, with no error.
  - Examples: a vehicle re-entering, a respawned alien, the 1B harness pattern `unregisterEntity('m1a-ship')`.
  - This is a latent defect in an extension point the §13 goal relies on (vehicles, combat).
- Proposed fix: in the non-null branch, set `obj.visible = true`. Or keep a per-binding `hiddenByAdapter` flag so the adapter does not override a visibility the user chose. Add a Node test for the unregister → register cycle. Not a RATIFIED item.
- Fix task size: fits easily in one session (≈ 5 lines + test).

### A1-U11-2 — Unregistering the focus entity silently re-focuses an arbitrary entity, and the origin jumps there
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `game/src/core/simulation/SimulationCore.ts:280–283` (also `registerEntity` 258–260 auto-focuses the first entity) @ dab3ddf
- Claim: rebasing is focus-entity-driven (Milestone 1A, line 87). Focus is meant to be chosen explicitly (`setFocusEntity`).
- Evidence: probe P4d.
  - Entities a, b, c are registered and a is the focus. `unregisterEntity('a')` makes `getFocusEntityId()` return `'c'`. That is `entities[0]` after the swap-remove, so the result depends on registration order.
  - The next `tick()` rebases the origin from −19,994,880 to 900,096: one rebase, with no focus-change signal.
  - When the last entity goes, focus becomes `null`. Rebasing then stops silently (`tick` skips (b)–(c)), so locals can grow without bound.
- Impact: today play has a single entity (`moonWorld.dispose`), so nothing visible.
  - With several entities (player plus vehicle or NPCs), removing the player makes the camera bubble jump to whichever entity happens to sit in slot 0.
  - All near-field state then re-centres there for one frame or more.
  - The origin follows an entity nobody chose, and f32 jitter appears at the real player once it is far from that entity.
- Proposed fix: on unregistering the focus, set `_focusId = null` and emit or log a "focus lost" event. The caller must then call `setFocusEntity`; or allow a configurable fallback id. Make `tick()` warn once when there are entities but no focus. Not RATIFIED.
- Fix task size: one session, together with A1-U11-1 and A1-U11-3 (same files, plus a Node test).

### A1-U11-3 — `getOrigin()` / `getOriginReadonly()` return the live, writable origin; one write breaks the lattice and `RebaseEvent.delta`
- Severity: S3     Confidence: confirmed
- Category: engine
- Location: `SimulationCore.ts:318–320`; `FloatingOriginAdapter.ts:109–112` (the name says "Readonly"; the type is a mutable `Vec3f64`) @ dab3ddf
- Claim: `RebaseEvent.delta` is "always an exact multiple of 256 m per axis" (`types.ts:91`).
- Evidence: probe P6.
  - `getOriginReadonly().x += 100`, then a 5 km move, gives a rebase with **Δx = 5020**. That is not a multiple of 256.
  - Until that rebase every local is offset by 100 m.
  - A grep of the consumers (`playFrame.ts:102`, `skyState.ts:69`, the harnesses) shows they only read today.
- Impact: no current bug; nothing stops a future consumer from corrupting the origin.
- Proposed fix: type both getters as `Readonly<Vec3f64>`. Optionally `Object.freeze` a mirrored copy updated on rebase. That stays zero-GC.
- Fix task size: trivial; bundle with A1-U11-1/2.

### A1-U11-4 — The power-of-two rationale is overstated: render precision does not depend on the lattice, and the Δ bound is conservative
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `precisionMath.ts:118–144` (the "WHY 256 = 2^8 GUARANTEES LOSSLESS" block); `types.ts:84–86`; Milestone 1A §1.1 items 4–5 @ dab3ddf
- Claim: the 2⁸ lattice is what makes the f64→f32 render path lossless ("no phantom momentum"). The proof needs |k₂−k₁| < 2¹⁶ (a 17-bit significand).
- Evidence:
  - P3 runs a 2 km/s diagonal focus at Pluto distance for 36,000 ticks, with the same strict 1,024 m trigger. Max |f32(P−O) − (P−O)| is:
    - 256 m lattice: **3.05e-5 m**
    - 300 m lattice: **3.05e-5 m**, identical
    - 1000π m lattice: 6.10e-5 m. That equals the C3 bound ½·ulp₃₂(1774 m); the larger value comes only from the bigger post-snap locals.
  - Per-tick reconstruction pops are equally small (4.5e-5 m).
  - The exactness that actually matters comes from the f64-subtract-then-narrow ORDER, which the code does correctly.
  - Δ exactness only helps a listener that translates f32 state by Δ. No production `onRebase` listener exists (grep: only `SimulationCore` defines it; play and render subscribe to nothing).
  - P1b shows fround(Δ) === Δ for all sampled |Δ| < 2³² m. P1c: the first failure seen was at 4.35e9 m, above 2³² = 4.29e9 m. So the real bound is |m| < 2²⁴, not 2¹⁶.
  - The 1000π run also shows that the "degenerate rebases are impossible" claim (Milestone 1A line 36) holds only when lattice/2 < trigger. That run made 26,033 rebases, including Δ = 0 every tick.
- Impact: misleading rationale. A later session could believe the lattice protects the render path and skip the subtraction-order rule. That rule is the real protection; U08 already found the m1a gate cannot see an f32-before-subtract regression.
- Proposed fix: keep 256 (it is still the right choice, since it keeps Δ exact for future Rapier/chunk translation). Rewrite the comment as follows:
  - (i) render exactness comes from the order;
  - (ii) Δ is f32-exact for |Δ| < 2³² m;
  - (iii) the lattice must be ≤ 2 × the trigger, or degenerate rebases loop.
- Fix task size: trivial (comment and spec note); bundle with A1-U11-1..3.

## Checked, no issue
- O is an exact multiple of 256 for |P| up to 1e13 m (P1a, 200,000 samples, 0 bad).
- Δ is f32-exact. The catalog's worst body-to-body jump is 4,932,608 m (Saturn→Neptune), so |k₂−k₁| = 19,268 < 2¹⁶ (P1d).
- Subtraction order is f64 then narrow everywhere it matters:
  - `registerEntity` 254–256;
  - tick (d) for entities 445–450;
  - tick (d) for celestials 451–457, which run after the rebase, so no stale-origin interleave.
- Post-tick focus local is ≤ 128 m after teleports up to 2e7 m, including negative ones (P4a: max 78.5 m). The strict `>` trigger matches the spec.
- The post-rebase local range is [−128, 128), half-open (P2a/P2b: p = 128 snaps to O = 256, local −128). This lies inside the spec's closed [−128, +128].
- The rebase is O(1): every local is recomputed from f64 every tick, so no per-object Δ translation exists to get wrong.
- The rebase path allocates nothing (by reading): the event is reused, the scratch vectors `_focusLocal` and `_candidateOrigin` are reused, and listeners use an index loop.
- A listener that throws is caught and logged, so the tick continues.
- `adapter.update()` allocates nothing (index loop over dense arrays). `bind` is idempotent and `unbind` swap-removes correctly.
- Purity: `precisionMath.ts` and `types.ts` import only types.
- f32 precision of celestial locals: the farthest is Pluto at 3.74e6 m with an f32 ulp of 0.25 m. That is 6.7e-8 rad, invisible for impostors (P7).
- **Real-scale outlook (input for U26):** the f64 ulp at real Pluto distance (5.9e12 m) is 1 mm (P1e). So the f64-absolute / f32-local scheme survives a move to real distances. Only the Δ-exactness premise breaks, and no consumer uses it.

## Seeds for later units (not findings here)
- **U13 / U23:** `playFrame` steps the controller (`ctrl.simulate(…, clock.dt, 5)`) and the core (`core.advance(clock.dt)`) with two separate accumulators. If their clamps or shedding differ, KCC positions can run ahead of core locals. P4b shows locals stay stale until the next `tick()`. Check that the two accumulators stay in lockstep.
- **U13:** `moonWorld.syncEntity()` and `respawnPlayer()` call `core.tick()` directly. That adds an extra tick to the macro clock and the micro counters on every respawn.
- **U22:** in play, the `FloatingOriginAdapter` has zero bindings, so `adapter.update()` does nothing. The character is placed directly from `astroState.localPosF32`, and the terrain goes through `spinGroup.position = −O`. Check that the spinGroup path keeps the subtract-then-narrow order. three composes the matrices in f64 and uploads f32.