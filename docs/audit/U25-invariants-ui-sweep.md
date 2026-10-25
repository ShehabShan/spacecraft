# A1-U25 — Invariants + UI sweep

Unit: `docs/A1-plan.md` Phase F, U25 · Session 82 · 2026-10-25 · audited @ `82c5906` (branch `a1-engine-audit`)
Scope: `src/core` import purity, per-frame allocation in tick paths, Euler accumulators, the page rule, and a skim of `play/ui/*`, `play/input/*`, `store/*`, `main.tsx`, `App.tsx` and `play/frame/playFrame.ts`.
Probe: `game/tools/audit/u25-alloc-sampler.mjs`, run from `game/` as `node --expose-gc --max-semi-space-size=64 tools/audit/u25-alloc-sampler.mjs`, **PROBE_EXIT=0**. Output: `docs/audit/U25-probe-output.txt`.

## Claims (written before probing)
1. `src/core/**` imports nothing from three, react, @react-three/fiber, physics libraries or DOM globals (AGENT_BRIEF §3).
2. Zero-GC: "NO per-frame allocation in tick loops" (§3). The specific claims are:
   - `useGameStore.ts:19`: "the render-extract pass allocate[s] zero bytes per frame".
   - `hudPublisher.ts` header: "nothing is allocated … Zero allocation per call".
   - `test-play-perf.mjs` header: "heap delta ≈ 0" over 10,000 shell frames.

   The physics expectation: a frame that only re-uses boot buffers allocates about 0 B. A small, bounded UI boundary is allowed (≤ 10 Hz).
3. Orientation is never an Euler accumulator: no yaw/pitch/roll scalars integrated into an orientation.
4. Page rule: exactly one harness or game module per page, a static `?page=` map, full page loads, and no harness imported from game code.
5. The HUD lat/lon shows the player's position on the body. Latitude and longitude are a property of the position radial, not of the body tilt.
6. The UI shell honours its §10.2 phase table, every listener detaches, and input allocates nothing per event.

## Method
The probe drives the **real** shell `playFrame`, using the same esbuild bundle, stub pool, `createMoonWorld`, camera and scripted walk/sprint/turn/jump drive as `tools/test-play-perf.mjs`. It warms up for 20,000 frames at 144 Hz, then runs two measurements:

- **A** — the V8 sampling heap profiler (`node:inspector`, `HeapProfiler.startSampling` with `includeObjectsCollectedByMinorGC/MajorGC`, 32 B interval). This counts *transient* garbage that a post-gc heap read cannot see. Bytes are attributed to the playFrame stage on the stack and to the deepest bundle function, using esbuild's `// src/...` module markers.
- **A0** — a profiler-off cross-check: the `heapUsed` delta over 1,000-frame batches, with no gc inside a batch. A batch in which `heapUsed` fell had a GC run inside it and is discarded.

**Controls** (`cal.*`):
| Control | Measured | Result |
|---|---|---|
| noop loop | 0.00 B/iter | ok |
| `new Float64Array(16)` | 200.4 B | ok |
| `{x,y,z}` literal | 48.3 B/iter | FAIL against my 16–48 B band, by 0.3 B (header + 3 boxed doubles). The control still separates zero from allocation, so it does not change any finding. |

A first heapUsed-delta-per-call design was discarded because its controls failed: `process.memoryUsage()` itself allocates about 448 B, so per-call deltas are meaningless.

## Findings

### A1-U25-1 — The play frame allocates ≈10.5 KB per frame (≈1.5 MB/s at 144 Hz); 72–78 % is in the core terrain height path; the zero-GC gate cannot see it
- Severity: S1     Confidence: confirmed (Node 24 / V8). The same engine runs in Chrome. Firefox is not measured.
- Category: engine | play | test
- Location:
  - Allocation sites:
    - `game/src/core/terrain/terrainField.ts:128` (`terrainHeight`) and `sampleSurfaceInto`
    - `game/src/core/terrain/noise.ts:61` (`noise3`)
  - Reached from:
    - `play/camera/ThirdPersonCamera.ts` `poseInto` (clearance and boom cut)
    - `play/character/CharacterTelemetry.ts` `sampleTelemetry`
    - `play/controller/PlayerController.ts` `simulate` → KCC
  - The gate: `game/tools/test-play-perf.mjs:87,94` calls `gc()` before each `heapUsed` sample.
  - Commit: @ 82c5906.
- Claim: there is no per-frame allocation in tick loops (AGENT_BRIEF.md:51). `useGameStore.ts:19` says the render-extract pass allocates zero bytes. test-play-perf "heap delta ≈ 0" is taken as proof of §11.5 zero allocation.
- Evidence (`U25-probe-output.txt`):
  - Totals:
    | Run | Sampling profiler (A) | heapUsed, profiler off (A0) |
    |---|---|---|
    | walk | 11,127 B/frame (1,565 KB/s) | 10,410 B/frame, range 10,062–11,141 |
    | idle | 10,268 B/frame (1,444 KB/s) | 10,449 B/frame |

    The two independent methods agree within 7 %.
  - Per stage (walk, B/frame):
    | Stage | B/frame |
    |---|---|
    | `cam.poseInto` | 5,523 |
    | `ctrl.simulate` | 2,283 |
    | `sampleTelemetry` | 2,213 |
    | `ProceduralAnimator.update` | ≈480 |
    | playFrame own body | 460 |
    | `applySkyState` | 197 |
    | `preStep` | 69 |
    | `MoonLod.update` | 52 |
  - Per function (walk, deepest bundle frame, B/frame):
    | Function | B/frame |
    |---|---|
    | `terrainHeight` | 4,148 |
    | `sampleSurfaceInto` | 2,363 |
    | `noise3` | 2,159 |
    | `poseInto` own | 852 |
    | `blendPose` | 194 |
    | KCC `_groundedTick` / `_fillTelemetry` / `integrateTick` / `_sweep` | ≈80–140 each |

    The three terrain functions total 8,670 of 11,127 B (78 %). In the idle run they are 72 %.
  - Idle costs the same as walking. The allocation scales with the number of height queries per frame (camera and telemetry probe every frame), not with motion.
  - Earlier units read or suspected this: A1-U14-5 (height/normal path, 180/461 GC per 1e6 calls) and A1-U09-1 (heap rows read after gc). This probe measures the frame-level total and shows where it comes from.
- Impact:
  - About 1.5 MB/s of young-generation garbage at 144 Hz, plus more for each future height consumer (vehicles, NPCs, combat). This drives a scavenge every few seconds, and scavenges are a frame-time jitter source. The magnitude in a browser frame is not measured here.
  - The zero-GC invariant in §3 is false in shipped play code, and the only gate meant to prove it (test-play-perf heap rows) passes by construction.
  - The ratified "Zero-GC" invariant has no working check.
- Proposed fix:
  1. Gate first (§13 safeguard 3): add a sampling-profiler or `--max-semi-space-size` no-gc row to test-play-perf, with a budget such as ≤ 64 B/frame outside the UI boundary.
  2. Then find the allocation inside `terrainHeight`/`noise3`. The likely causes are heap-number boxing of non-SMI doubles kept in module or object fields, or temporary arrays; check with `--trace-deopt` or by reading the 1,013/1,155 bundle lines.
  3. Fix it in core, or add a per-frame height-sample cache shared by camera, telemetry and KCC.

  This touches no RATIFIED constant.
- Fix task size: the gate plus diagnosis fit one session. The core terrain fix needs one more session, with m1c/m1e/m1f regression.

### A1-U25-2 — Debug HUD latitude/longitude come from the tilted body `up`, not from the position — up to 33–39° (~900 m) off
- Severity: S2     Confidence: confirmed
- Category: play
- Location: `game/src/play/ui/hudPublisher.ts:60-61` (`b.lat = asin(t.upY)`, `b.lon = atan2(t.upX, t.upZ)`) @ 82c5906
- Claim: the comment "Planet frame; the spin axis is +Y" implies a geographic lat/lon of the player.
- Evidence: over 8,000 frames of the scripted drive (probe D, spin phase 0, so the planet frame equals the world frame here):
  - Grounded on 4,931 frames, the angle between `kcc.up` and the position radial is p50 21.1°, p90 29.0°, p99 35.7°, max 36.1°. An earlier run gave a max of 40.8°.
  - The HUD latitude error reaches 33.0° (earlier run 39.0°) and the longitude error 31.7°.
  - The play Moon radius is ≈1,320 m, so 1° is 23 m and the error is about 760–900 m of displayed position.
  - The grounded `up` follows the terrain normal and the U17 snap, so it is not the radial.
- Impact: the debug HUD reports a wrong location, so it is useless for spawn or bug reports that quote lat/lon. The HUD is OFF by default in production (`HUD_DEFAULT_VISIBLE` = DEV).
- Proposed fix: compute lat/lon from `absPos` rotated into the planet frame (conjugate spin quaternion), not from `up`. This is play-local.
- Fix task size: under 5 OLU, with one test-play-perf row.

### A1-U25-3 — `HudPublisher` comment "nothing is allocated": the real zustand `setHud` costs ≈297 B per publish
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `game/src/play/ui/hudPublisher.ts` header (B10 decision), with `playStore.ts` `setHud`
- Evidence: probe C, 20,000 publishes alternating the two boot buffers, measured 296.9 B/publish. This is zustand's `set` merge object plus the listener notification, about 3 KB/s at the 10 Hz throttle.
- Impact: none for frame time. This is the sanctioned UI boundary. The comment overstates the result, and test-play-perf uses a fake `setHud`, so the gate never sees it.
- Proposed fix: reword the comment to say "the publisher allocates nothing; the store write costs ≈300 B at ≤ 10 Hz".

### A1-U25-4 — The menu (`App.tsx`) lists play and m1a–m1d only; the m1e/m1f regression pages are not linked
- Severity: S3     Confidence: confirmed
- Category: play
- Location: `game/src/App.tsx` `PAGES`; `main.tsx` maps m1a–m1f and play
- Impact: the two regression pages most used by A1/T1 (1E KCC, 1F handoff) are reachable only by typing `?page=m1e`/`?page=m1f`. This is a discoverability issue, not a correctness issue.
- Proposed fix: add the two rows to the menu.

### A1-U25-5 — A terrain worker error never reaches the ERROR phase (documented deferral)
- Severity: S3     Confidence: confirmed
- Category: play
- Location: `game/src/play/PlayPage.tsx` passes no `workers` to `attachShellRuntime` (B5c `// WHY:`); `render/TerrainMeshPool.ts:101` keeps `workers` private
- Evidence: `shellRuntime.ts` wires `error` → `fatal` only for the targets it is given, and PlayPage passes `{ canvas, doc }`.
- Impact: a dead worker leaves permanent terrain holes with no overlay or message. Worker 0 does almost all generation (A1-U20-2), which raises the chance this matters.
- Proposed fix: expose a read-only `onWorkerError` hook on TerrainMeshPool and pass it through. This is a shared-module edit and needs the m1c/m1f regression.

## Checked, no issue
- **Core purity**, across the 15 files under `src/core`: noise, spherify, terrainField, atmosphere, aerodynamics, sphericalFrame, astronautKCC, flightController, impostorMath, SimulationCore, KeplerRail, celestialData, orbit/types, types, precisionMath.
  - A grep for non-relative imports found 0 hits (GREP_EXIT=1).
  - A grep for dynamic `import()` or `require` found 0 hits.
  - Every relative import resolves inside `src/core`.
  - There are no uses of `window`, `document`, `performance`, `globalThis`, `navigator`, `requestAnimationFrame`, `setTimeout` or `Date.now`.
- **Page rule**:
  - `main.tsx` has a static lazy map (m1a–m1f, play), a single `createRoot`, and no StrictMode.
  - Nothing outside `main.tsx` imports a `Milestone1X_TestHarness`, and `play`, `render`, `store`, `core` and `workers` import nothing from `test/`.
  - No THREE prototype patches exist outside `test/`.
  - The only `new Worker` is in the `TerrainMeshPool` constructor.
  - Menu links are full-load `<a href>`.
- **Euler accumulators**:
  - There is no `THREE.Euler`, `setFromEuler` or `rotation +=` anywhere outside `test/`.
  - KCC look deltas (`lookYawDelta`/`lookPitchDelta`) are consumed each frame as finite rotations about the frame axes and then zeroed.
  - The camera heading is a unit vector rotated about `up` (`rotateAboutAxisInto` and renormalise).
  - The camera `pitch` is a clamped orbit-elevation scalar, not an orientation integrator, which is acceptable.
  - "Semi-implicit Euler" in flightController names the integrator, not angles.
  - (The transport is projection, not true parallel transport; that is already A1-U15-1.)
- **InputState**:
  - Handlers are bound once, the held set is a `Uint8Array`, and there is no per-event allocation.
  - K3: the first post-lock delta is dropped and later deltas are clamped to 200 px.
  - Keys are accepted only while locked, and auto-repeat produces no extra edges.
  - Keyup is always processed, and a lock change or blur clears held keys and pending look.
  - `detach` removes every listener.
- **playStore**: `nextPhase` is a pure table, ERROR is terminal, and there is one `set()` per transition. `setLoad`/`setPhase` skip no-op writes.
- **shellRuntime and PlayShell**:
  - Every listener is detached in the returned closure.
  - Visibility "hidden" pauses and releases the lock.
  - Context loss calls `preventDefault` and then dispatches fatal.
  - The PlayShell overlay passes pointer events through only in PLAYING.
  - The Overlays Resume cool-down is 1,000 ms measured from `pausedAtMs` (K3).
- **useGameStore**:
  - It is used only by the M1A harness (and by type imports).
  - The throttled 10 Hz snapshot allocation is its documented, sanctioned boundary.
  - The play HUD uses its own publisher.
- **HUD publish rate**: the FPS EMA is time-constant based and the publish throttle is ≤ 10/s. test-play-perf rows were not re-run because the source was unchanged since U09.

## Seeds for U26 / U27
- Zero-GC has no working gate anywhere: test-play-perf and the m1X heap clauses are post-gc (A1-U04, U05b, U06, U07, U08a, U09-1). Treat "gate first" as a dependency of every performance fix task.
- The analytic terrain height is the hot shared service. Camera, telemetry and KCC each query it every frame, and vehicles, NPCs and combat will add more. U26 should weigh a per-frame shared height/normal sampler with a fixed budget against per-consumer queries. This also relates to A1-U22-1 (drawn terrain ≠ collision terrain).
- About 460 B/frame is attributed to the playFrame body itself. This is probably the inlined THREE `.set` calls or `adapter.update`, and it was not diagnosed here.
- The HUD and any future gameplay UI need a planet-frame position service, not `up`-derived values (A1-U25-2).

## Verification
- `npm ci` → CI_EXIT=0.
- Probe → PROBE_EXIT=0. Controls 2/3; the obj3 band edge is explained above.
- `git diff --quiet 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` → RO_DIFF_EXIT=0 (empty; the unit stayed read-only).
- No Lead question this unit.