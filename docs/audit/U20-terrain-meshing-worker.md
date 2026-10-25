# A1-U20 — Terrain meshing + worker (`TerrainMeshPool.ts`, `terrainWorker.ts`)

- Session 77, 2026-10-25, @ d91378f. READ-ONLY (AGENT_BRIEF §11).
- Read in full: `game/src/render/TerrainMeshPool.ts` (447) and `game/src/workers/terrainWorker.ts` (256). Also read: `play/world/MoonLod.ts` 15–230, the pool configs of every caller, and the pending/active bookkeeping in the m1c/m1e harnesses.
- Spec: Milestone 1C, grep only (seeds came from U06 / U14).
- Probe: `game/tools/audit/u20-mesh-pool-worker.mjs`, run with `node tools/audit/u20-mesh-pool-worker.mjs` → **PROBE_EXIT=0, controls 4/4**. The full output is in `docs/audit/U20-probe-output.txt`.
  - The probe imports the REAL pool and the REAL worker module, one module instance per fake `Worker`, plus the REAL `MoonLod`.
  - Every message crosses `structuredClone(m, {transfer})`, so buffers really detach.
  - Workers are FIFO with a configurable reply latency of 0, 2 or 3 frames.
  - The flight is a 120 s schedule at 60 fps: a cubic descent from 3R, a surface traverse, then a 600 m hop. It runs on the Moon and on TEST_PLANET.
  - Run 1 crashed on a probe bug: too few fake worker instances were pre-loaded. That was fixed and rerun. Run 2 printed `NaN` for the generation timer because the probe read `a[0]` after the worker had transferred `a`. That was fixed too. Neither bug touched any game code.

## Claims written before reading the code
1. Every request gets exactly one answer, and the owner of a request learns its outcome.
2. A buffer set lives in one place at a time, and no set is lost or duplicated.
3. When pool meshes ≤ total worker sets, a free set always exists.
4. Load is spread across the workers.
5. Uploads are same-size `bufferSubData` calls with no main-thread allocation, except where measured.

## Findings

### A1-U20-1 — "A free set always exists" is wrong: with 144 meshes on 96 sets the worker drops requests, and the LOD keeps a dead `pendingRec`, so terrain holes persist
- Severity: S1     Confidence: confirmed (real pool + worker + MoonLod at the 144/96 config); likely for the m1c/m1d/m1e pages themselves (their controller is the harness copy, and browser timing differs)
- Category: engine
- Location (@ d91378f):
  - The claim: `TerrainMeshPool.ts:16–18` and `terrainWorker.ts:234–235`.
  - The drop path: `TerrainMeshPool.ts:348–353` sets `state = 0`, leaves `owner` set, and never tells the owner.
  - The LOD side: `MoonLod.ts:125` (a candidate only if `pendingRec < 0`), `:99` and `:145`. The harnesses do the same at `Milestone1C_TestHarness.tsx:332/381/410` and `Milestone1E_TestHarness.tsx:337/380/402`.
  - The configs: `Milestone1C_TestHarness.tsx:80–84`, `1D:97–103` and `1E:101–107` use 144 meshes with `workerPoolSets` 96. `moonConfig.ts:44–46` (play) and `1F:118–119` use 96/96.
- Claim: "the per-worker in-flight cap (12) is far below the worker pool (96) so a free set always exists"; the drop branch "cannot happen".
- Evidence:
  - The sets a worker has out = sets bound to its active meshes + sets in flight. Being under the in-flight cap does not bound that sum.
  - A1-U20-2 sends nearly every chunk to worker 0. Once 96 chunks are bound there, request 97 finds `setPool` empty and is dropped.
  - Probe P1: 120 distinct chunks into a 144-mesh pool with 96 sets per worker, latency 0. Result: 24 drops, active 96, bound 96/0. With 144 sets the same run has 0 drops and 120 active (control).
  - Probe P3 (LOD flight), drops / frames where a SELECTED leaf sits on a dead request / nodes whose dead `pendingRec` now points to another node's ACTIVE record:

| config (meshes/sets, latency) | Moon | TEST_PLANET |
|---|---|---|
| 96/96, 0 and 2 | 0 drops · 0/7,200 · 0 | 0 drops · 0/7,200 · 0 |
| 144/96, 0 | 320 · 5,897/7,200 · 0 | 471 · 5,722/7,200 · 0 |
| 144/96, 2 | 296 · 5,843/7,200 · 194 | 407 · 5,696/7,200 · 313 |
| 144/144, 0 and 2 | 0 · 0/7,200 · 0 | 0 · 0/7,200 · 0 |

  - A dropped node is never requested again, because `pendingRec ≥ 0` keeps it out of the candidate list. The result is a permanent hole until the node leaves the selection.
  - When the freed record is re-acquired and goes active, the stale node's `nodeHasData()` returns true (`MoonLod.ts:99`). The parent then hides or releases its own mesh, so the hole also gets the parent's cover removed.
  - No gate reads `counters.drops`: a grep finds it only inside the pool, and `workerFree` is shown only as telemetry text (`1C:764`).
- Impact:
  - In the 1C/1D/1E configuration the terrain is likely full of holes most of the time.
  - Play and 1F are safe only because `meshCount == workerPoolSets`, an invariant that is neither documented nor asserted. Any future increase in `meshCount` (a larger view, higher LOD, a second body) breaks it.
  - This fits U06's result that no m1c row can see holes (A1-U06-1).
- Proposed fix:
  1. Pick the worker by free sets: `workerFree[w] − inFlight[w] > 0` (see A1-U20-2).
  2. On `drop`, put the record back in the queue (it is still `state 1`) instead of freeing it. Or free it and clear the owner's `pendingRec` through an owner callback.
  3. Assert `meshCount ≤ workerCount · workerPoolSets` at boot.
  4. Add a gate row that fails when `drops > 0`.
  - None of these is a RATIFIED item.
- Fix task size: one session (pool change + gate row + rerun of this probe as the regression).

### A1-U20-2 — No load balancing: `pump()` always fills worker 0 first, so one worker does almost all the generation
- Severity: S2     Confidence: confirmed
- Category: engine (performance)
- Location: `TerrainMeshPool.ts:276–281` (`w = 0..` order) and `:412–421`. Worker 1 receives work only while worker 0 is at its in-flight cap of 12. The LOD activates at most 3 chunks per frame (`MoonLod.ts:19`).
- Claim: two workers parallelise generation (1C design, 2 workers).
- Evidence (P3, maximum sets bound per worker over the flight):
  - Moon 96/96: 94/0 at latency 0, 94/16 at latency 2.
  - TEST 144/144: 142/0 at latency 0, 141/22 at latency 2.
  - P1 at latency 3 balances 60/60 only because worker 0 hits its in-flight cap.
  - Generation costs 2.92 ms per chunk in Node (11,598 chunks), so one worker gives about 340 chunks/s.
- Impact:
  - The second worker is mostly idle, so streaming throughput is close to one worker's.
  - This matters for the T2 arrival speed (U19 seed): fast descents need more than 3 chunks per frame.
  - This imbalance is also the trigger for A1-U20-1.
- Proposed fix: choose the least-loaded worker by `inFlight` plus bound sets, or round-robin. Measure the frame time before and after (AGENT_BRIEF §13 safeguard 4).
- Fix task size: together with A1-U20-1, one session.

### A1-U20-3 — Header and comment drift: the request array rides the LAST response; the allocation budget ignores the receive path; the ring bound is undocumented
- Severity: S3     Confidence: confirmed (text); suspected (receive-path allocation size)
- Category: doc
- Location: `terrainWorker.ts:10–11` says that `a` "rides the FIRST response", but the code (`:227–231`, the F10b fix) sends it on the LAST. `TerrainMeshPool.ts:18–20` budgets only the `pump()` envelopes at under ~150 B/frame. `:386` says that ring overflow "cannot happen at these rates".
- Evidence:
  - Each `chunk` message deserialises an object, 4 typed-array views and 4 ArrayBuffer wrappers onto the main heap, and none of this is counted.
  - Each `ret` message makes the worker allocate 4 views per set (worker heap; documented).
  - The largest return ring observed is 28 of 48 (P3 TEST 144/144). Pressure eviction in one frame could exceed 48: 96–144 releases are possible. The overflow path still works; it only adds one extra postMessage.
- Confirming evidence for the size: a browser heap sample per received chunk (the probe runs in Node, whose structured-clone path differs).
- Proposed fix: correct the header, budget the receive path, and state the ring bound as `returnCapacity ≥ meshCount` or keep the fallback documented.
- Fix task size: trivial; fold into the A1-U20-1 session.

## Checked, no issue (do not redo)
1. **Same-size upload.** Every swapped array has the boot size (`CHUNK_*_FLOATS`, 6,936 Uint16 indices). Index count 6,936 < 65,536 vertices' range: 1,225 vertices fit Uint16.
2. **Release without `needsUpdate`** (`:264`) is safe: the mesh is invisible and its draw range is 0.
3. **Cancel paths.**
   - Cancel while queued: `dispatchBatch` retires the entry (`:427–430`).
   - Cancel after dispatch: the arrival recycles the record and returns the buffers (`:345–346`).
   - A duplicate key after cancel + re-acquire binds correctly in either arrival order: `findByKey` takes the first pending record, and the other one is answered by its own reply.
4. **Ownership and accounting.**
   - P1 control: `received + drops = dispatched`.
   - No buffer was used after detach in any run; `structuredClone` with transfer would throw on a detached buffer.
   - The F10b "request array on the last response" logic is right.
   - `ret` and `req` stay FIFO on the same port, so returns reach the worker before the next batch.
5. **Precision.** Positions are f64 minus the f64 origin, narrowed once. `mesh.position` is f64 relative to the floating origin. The skirt vertex is rebuilt from the narrowed f32 position plus the f64 origin; the error is below the f32 ulp of a chunk-local value.
6. **Topology.** The shared index buffer, CCW outward winding and skirt ring are identical for every chunk. `computeBoundingSphere` includes the skirt, which only makes it conservative.
7. **Seeds re-checked:**
   - U14 `chunkKey` collision at L9: latent, since MAX_LEVEL is 4 everywhere (A1-U14-6 stands).
   - U06 gap-2 neighbours and skirt margin: unchanged, because the pool and worker add no LOD logic (A1-U06-4 stands).
   - U06-3 stale `desired`: MoonLod documents it and works around it with `isSelectedLeaf` (`MoonLod.ts:220–227`).
8. **Worker message race on `init`.** The `ready` gate drops nothing in practice: `init` is the first message on each port, and ports are FIFO.