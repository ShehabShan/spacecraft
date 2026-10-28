# ADR-025 — Rebuilt m1f R5 (M1A integration) gate design

- Status: ACCEPTED (F2fcea, session 140, 2026-10-28). R5a is implemented; R5b is F2fceb.
- Task: F2f (U27c §2), findings A1-U03-5 (S1, K2d; re-checked in `docs/audit/U27-k2d-recheck.md`) and A1-U03-6 (S2).

## Context
The shipped R5 (`Milestone1F_TestHarness.tsx` `runSuite`, "R5: M1A integration") has two defects:
- "rebases ≥ 2" is unreachable by its own fixture. The autopilot steers at SAT_B, which is 400 m
  above a straight tangent 2,400 m from spawn, so the walker parks at its nadir. That nadir is about
  1,374 m of arc away at 180 m of terrain. The U27 re-check found 0–1 shifts in a 1,440-case grid,
  and 2 or more shifts in every case of a 4,000 m surface-path control.
- Sun continuity is sampled only on rebase frames, so 0 rebases gives 0 samples and a pass.
  The straddler A/B never checks that Sat B covers any pixel, so 0 differing bytes is also the
  result when Sat B is off-screen or occluded.

R5 stays waived (Lead, 2026-10-20), and shipped harness rows are never edited.

## Options
1. Move SAT_B onto the surface in the shipped harness. Rejected: that edits a shipped row, and the
   rendered walk still depends on terrain, steering and frame rate (K2d).
2. Use a new page `?page=m1fR5` with one row per property:
   - R5a: rebase lattice on a scripted, continuous, non-teleporting surface route. It runs the real
     `SimulationCore` and is checked every tick against an independent f64 oracle.
   - R5b: straddler A/B, with a Sat B coverage assertion, a check that `layerMaskFor` returns both
     bits, and Sun continuity on every frame.

## Decision
Option 2, split per §12. F2fcea delivers R5a, the spec and the self-test; F2fceb delivers R5b.

R5a (`game/src/test/M1fR5Gate.tsx`):
- **Route.** A great circle of radius 1,364.5 + h m, run at each U27 grid height h ∈ {0, 180, 360} m (all three must pass), starting at +X with tangent (0,1,1)/√2.
  It runs 4,000 m at sprint speed 6.5 m/s, which is 36,924 ticks. Each tick, the walker's velocity
  is set so that it lands exactly on the route point.
- **Warm tick.** One warm tick at rest settles the origin first, because the start is more than
  1,024 m from the zero origin. Only shifts after the warm tick are counted.
- **Oracle.** It imports nothing from the engine: a strict max-axis > 1,024 trigger, then a per-axis
  snap to the nearest point of the 256 m lattice.
- **Checks.** Every one of these must hold:
  - shifts ≥ 2, and shifts equal the oracle count;
  - the number of rebase events equals the shift count;
  - every Δ is a non-zero multiple of 256, and the origin is on the lattice and equal to the
    oracle's on every tick;
  - max-axis local ≤ 1,024;
  - the focus f32 locals and all 17 celestial f32 locals equal `fround(abs − O)` exactly;
  - the world step per tick ≤ sprint·dt;
  - the f64 local step equals the world step − ΣΔ, to within 1e-9 m.
- **Mutants.**
  - `nadir`: the route stops at the shipped nadir arc for that height (1,278.304 / 1,374.391 / 1,459.296 m). It fails on "shifts 0 < 2".
  - `skew`: a rebase listener nudges the live, writable origin by 1 m (A1-U11-3). It fails on
    the oracle, lattice, Δ and identity checks.
  - `teleport`: a permanent 300 m jump mid-route. It fails on "world step on 1 tick".
- **Why this start.** A start at (1,1,1)/√3 gave 2 shifts even on the nadir arc, so the nadir mutant
  could not tell the shipped fixture from a passing one. An independent sweep of the oracle
  (`evidence/F2f/cea/route-oracle-sweep.mjs`) picked the start at +X instead: 0 shifts on the nadir
  arc and 2 over 4,000 m.

## Why
- The lattice and the continuity properties are pure core arithmetic, so they need no autopilot or
  terrain. A scripted route makes the verdict independent of fixture, frame rate and process (K2d).
- The every-tick oracle and the count-equality checks remove the zero-sample pass (A1-U03-6).

## Consequences
- R5a PASS at all three heights: 2 / 2 / 3 shifts over 4,000 m, each equal to the oracle. The nadir mutant gives 0 shifts at every height.
- The spec `game/e2e/m1f-r5.spec.ts` has `expectedRows` 1, which F2fceb bumps to 2.
- The self-test is `game/tools/test-m1f-r5-gate.mjs` on port 4185.
- R5a does not check the rendered sky. That check (Sun continuity on every frame) is part of R5b.
- The shipped R5 stays waived and unedited. Retiring it is for the F2f close-out.
