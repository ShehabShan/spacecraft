# T3 — BETTER MOON (PLAYABLE TERRAIN) — PLAN

- Task: T3 · Branch: `t3-better-moon` (cut from `main` @ e0bc76d, session 147)
- Stage: BUILDING (the Lead's 2026-10-28 order is the execute order; there is no plan gate)
- Last updated: 2026-10-28 (session 147)
- Resume at the FIRST UNCHECKED BOX (planning item or build step).

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

## 1. Goal
Make the play Moon (`/?page=play`) playable. It needs broad, flat, mare-like plains
that you can walk and run across. Rolling highlands and crater-rim and basin-ring
mountains stay, but they no longer cover the map. Every harness and gate moon must
stay exactly as it is.

## 2. Current-state findings (verified, session 147)
- The height field is `terrainHeight(d)` in `game/src/core/terrain/terrainField.ts`:
  fBm continents + ridged mountains under a low-frequency mask + fine detail. Its
  parameters are the 10-field `TerrainParams`, set by `initTerrainField(params)` on the
  main thread and, by message, in every worker (`terrainWorker.ts:200`). The KCC
  (`astronautKCC.ts`) calls `terrainHeight`/`terrainNormalInto` directly.
- The play Moon is `MOON_PARAMS` in `game/src/play/world/moonConfig.ts` (R 1,364.5 m,
  seed 20240119, mountainAmp 230). The harness, m1fR2 and diag moons are by-value
  COPIES and do not import `MOON_PARAMS`, and m1c/m1d/m1e/kcc-gate use `TEST_PLANET`.
  So a play-only change cannot move them.
- `MOON_PARAMS` consumers that will see a change: test-play-spawn (pins the 9 values
  and `Object.keys(P).length === 10`, plus the spawn), test-kcc-default-trace (moon
  trace at line 76), alloc-idle-probe, test-alloc-gate, and test-play-controller,
  -frame, -lod, -perf, -rig, -shell and -world.
- Baseline probe (20k Fibonacci directions, `MOON_PARAMS`): slope <5° 0.9% ·
  5–10° 2.4% · 10–15° 3.9% · 15–30° 19.7% · 30–45° 25.1% · 45–50° 7.2% ·
  ≥50° **40.9%**. The KCC walk limit is 50° and slide begins at 45°. Height range is
  −77.6…+244.4 m (bound `MAX_TERRAIN_H` 360). Cost is ~2.2 µs per `terrainHeight`.
  The root cause is that the ridged mountain term at mask ≈1 covers most of the
  sphere, and on a 1.36 km-radius body a 230 m amplitude gives steep slopes everywhere.
- Mesh: `MoonLod` MAX_LEVEL 4 gives finest chunks of ~134 m at 32 quads (~4.2 m vertex
  spacing). `NORMAL_EPS` is 0.002 rad (~2.7 m on this Moon). Features smaller than
  ~8 m radius cannot be resolved.

## 3. Design (decided by the session per the Lead's delegation; ADR-028 at S1)
- **Opt-in profile.** `TerrainParams` gains an optional `moon?: MoonProfile` made of
  plain numbers and number arrays, so it is structured-cloneable to workers.
  `terrainHeight` keeps its current expression byte-for-byte when `P.moon` is
  undefined, so `TEST_PLANET` and every harness copy are bit-identical. A hash pin is
  taken on the unedited tree before the edit.
- **Mare basins.** The profile defines an explicit list of large circular basins, each
  with a unit direction, an angular radius and a rim height. A smooth basin mask
  `m(d)` (smoothstep over a shore band) blends between the highland height and a flat
  mare floor. The floor is a constant level plus small low-amplitude detail, giving
  near-flat but not glass-flat ground. A raised rim and ring (Gaussian in angular
  distance, outside the shore) makes the basin-ring mountains. Target mare coverage is
  ~30% of the surface, between the real Moon's ~16% global and ~31% near side, because
  playability comes first. Basin 0 sits under the deterministic spawn base direction
  (S2 records it as a literal).
- **Craters.** Procedural and table-free: a cube-face cell grid at two scales (large
  and small). Each cell hashes to zero or one crater with a jittered centre and a
  radius, and a sample evaluates its 3×3 cell neighbourhood. The crater profile is a
  parabolic bowl (depth ≈0.18·r, so the wall slope is ≤ ~20°) plus a Gaussian raised
  rim (≈0.05·r). The minimum radius is 8 m. Density is lower on mare and higher on
  highlands. The function is pure and zero-GC, so it stays bit-identical across chunks,
  LODs and workers, and seams are preserved.
- **Highlands.** The existing field with the ridged mountain term scaled down by a
  profile factor gives rolling cratered uplands. Tall relief comes from basin rims and
  large crater rims, not continuous ridges.
- Heights must stay within ±(`MAX_TERRAIN_H` − 20 m). The engine invariants hold
  (pure core, zero-GC, no new library).

### 3.1 Feasibility (P0 quality, session 147)
Probe: `docs/audit/evidence/T3/P0/feasibility-probe.mjs`. It is a standalone prototype
with no game code edited; logs are `feasibility-probe.log` and `feasibility-probe.run2.log`.
- **Default-path pins** (taken on the unedited tree; SHA-256 of `terrainHeight` Float64
  bytes on 4,096 Fibonacci directions). S1's gate must reproduce both exactly:
  - `TEST_PLANET` `412ed993c2fe088cc1f2f65116c9330ec4ddbe49a477f7a4e2d49b676a755e02`
  - harness MOON (the `MOON_PARAMS` values) `b7403bae174f81c8a8be7ddd587ab16445cfc33cfc06815f76d293a794a170b6`
- **S1 starting candidate "G-prune":**
  - Basins: 7 with radii 0.62/0.52/0.45/0.40/0.36/0.32/0.28 rad × 1.15, placed without
    overlap by `mulberry32(0x7a3e)`, with basin 0 at (0,0,1); S2 rotates it under the spawn.
  - Shore: smoothstep width 0.08 rad.
  - Rim: Gaussian with σ 0.05 rad at r + 0.024, amplitude 25 + 45·r/0.62 m.
  - Mare floor: −25 m + fBm(freq 8)·1.2 m.
  - Highlands: `MOON_PARAMS` with mountainAmp ×0.12 and detailAmp ×0.35, blended by (1 − mask) and skipped at mask 1.
  - Craters: on a 3D cell lattice in two layers:
    - F 9, occupancy 0.55, r 18–60 m;
    - F 32, occupancy 0.45, r 8–16 m.
  - Crater profile: bowl depth 0.18·r, rim 0.05·r, damped ×(1 − 0.9·mask) on mare.
  - Pruning: chord distance, cell-box prune and a basin-cone prune.
- **Results** (20k directions):
  - Slope: <5° 32.6% · <45° 92.3% · ≥50° 3.9% · ≥30° 29.1%.
  - Mare: 33.0% of the surface (94% of it <5°).
  - Height: −72…+165 m.
  - Cost: 1.98× baseline in run 1.

  For comparison, the baseline is <5° 0.9% · <45° 51.8% · ≥50° 40.9%. Every §8 S1 target
  passes. The cost (≤2×) is the tight one. Two lessons from the probe:
  - The floor must be low-frequency: freq 22 / 3 m left only 38% of the mare under 5°.
  - Craters dominate the cost: without craters the cost is 1.20×.

## 4. Scope IN
- `MoonProfile` type and opt-in evaluation in `terrainField.ts` (basins, craters,
  softened highlands), with `// WHY:` comments.
- `MOON_PARAMS.moon` for the play Moon, with basin 0 under the spawn.
- Re-pinning the play tests and the moon half of `test-kcc-default-trace` with ADR
  evidence. No threshold is loosened.
- A new gate, `game/tools/test-moon-profile.mjs`, with `--self-test` mutants.
- Mare/highland shading (a darker basalt floor), if it fits S3.

## 5. Scope OUT
- `TEST_PLANET`, the harness and m1fR2 moon copies, and every m1c/m1d/m1e/m1f-r row
  or threshold. KCC constants and defaults. LOD constants.
- Rocks or boulder meshes, regolith textures, new libraries, F3b and 1G.

## 6. Affected modules
- `game/src/core/terrain/terrainField.ts` (profile type and evaluation)
- `game/src/play/world/moonConfig.ts` (`MOON_PARAMS.moon`)
- `game/src/play/world/spawn.ts` (only if the spawn needs a flatness term; S2 decides)
- Shading, S3: the play terrain material (`game/src/play/world/moonWorld.ts` /
  `game/src/render/TerrainMeshPool.ts`)
- Tests: new `game/tools/test-moon-profile.mjs`; re-pins in `tools/test-play-spawn.mjs`
  and `tools/test-kcc-default-trace.mjs`, plus any other play test whose pins move
- Process and docs: `docs/decisions/ADR-028-moon-terrain-profile.md`,
  `notes/CHANGES.md`, `notes/task.md`, `notes/STATE.md`

## 7. Steps (one commit each; verify per §8)
- [x] **P0** Plan (this file), branch cut, tracker and STATE.md.
- [x] **S1** (session 147: gate 13/13, self-test 4/4, cost 1.88×; ADR-028. The candidate lives in the gate, not in `moonConfig`. S2 moves it to `MOON_PARAMS.moon` and flips the gate assertion that `MOON_PARAMS.moon` is unset.) Core Moon profile in `terrainField.ts` plus the new gate
  `tools/test-moon-profile.mjs` and ADR-028. It is not yet wired to play: the gate
  evaluates a candidate profile object defined in the gate and `moonConfig` (exported
  but unused until S2).
- [x] **S2** (session 148: spawn on mare, slope 0.01°, max 3.24° within 60 m; gate 16/16 on the real `MOON_PARAMS`; ADR-028 amendment 1) Wire `MOON_PARAMS.moon` into play. Place basin 0 under the spawn base
  direction. Re-pin test-play-spawn (field count 11, new spawn) and the moon trace of
  test-kcc-default-trace (TEST_PLANET pins unchanged), with an ADR-028 amendment and
  evidence. Run all nine play Node tests, `e2e/play.spec.ts` and the build.
- [ ] **S3** Look: darker mare albedo from the basin mask (shader or vertex attribute),
  plus a crater-rim readability check. Screenshots via check-play-b4…b9, and test-play-perf.
- [ ] **S4** Close-out: the full §13 matrix (tsc, build, play Node tests,
  kcc-default-trace, kcc-gate, play.spec, m1e, m1f-r with R5 waived). Then the Lead's
  play acceptance and a fast-forward into `main`.

## 8. Verification per step
- **S1** `node tools/test-moon-profile.mjs` must print PASS and exit 0. Over 20k
  Fibonacci directions with the candidate profile it checks:
  - slope <5° ≥ 30%;
  - slope <45° ≥ 85%;
  - slope ≥50° ≤ 5%;
  - mare (mask > 0.9) between 25% and 40%;
  - mountains present: slope ≥30° ≥ 3% and max h ≥ 150 m;
  - |h| ≤ `MAX_TERRAIN_H` − 20;
  - cost ≤ 2× the baseline sample cost, measured in the same run;
  - default path bit-identical: the SHA-256 of `TEST_PLANET` and the harness MOON
    heights on 4,096 directions equals the pin taken before the edit;
  - determinism: two inits give identical hashes.

  `--self-test` mutants (profile off, mare radius 0, crater depth ×10, a default-path
  perturbation) must each exit 1. Also: `npm run typecheck` exit 0, and
  test-kcc-default-trace and test-kcc-gate exit 0 unchanged.
- **S2** The §8 S1 targets on the real `MOON_PARAMS`, plus at the spawn: slope <5°
  and every sample within 60 m below 15°. All nine play Node tests, kcc-default-trace
  (re-pinned) and kcc-gate exit 0; `npx playwright test e2e/play.spec.ts` exit 0;
  `npm run build` exit 0.
- **S3** check-play-b4/b5/b6/b7/b9 exit 0 and screenshots stored under
  `docs/audit/evidence/T3/`; test-play-perf exit 0, with frame time not worse than the
  T1 baseline.
- **S4** Every command above exit 0, plus m1e 6×PASS and the m1f-r pins (R3 and R4
  pinned, R5 waived), and the Lead's play-test.

## 9. Risks & open decisions
- **Moving trace pins (expected).** The moon trace of test-kcc-default-trace and the
  play spawn pins will change at S2. Mitigation: re-pin only with the ADR-028
  amendment and before/after evidence; `TEST_PLANET` pins must not move.
- **Worker build cost.** Craters evaluate 2 scales × 9 cells per sample. Mitigation:
  the S1 cost gate (≤2×), early-outs on cell distance, and no allocation.
- **Small features against normals and mesh.** Features under ~8 m alias against the
  4.2 m mesh and 2.7 m normal epsilon. Mitigation: a minimum crater radius of 8 m.
- **Rims near the spawn causing slides.** The S2 spawn-neighbourhood check covers this.
- **Height bound.** `MAX_TERRAIN_H` feeds the KCC, camera and LOD bounds. The gate
  enforces the margin, and no constant changes.
- **Open decisions:** none for the Lead. The design is delegated (task definition,
  2026-10-28), and look-and-feel is limited to mare darkening, which is decided by
  realism.