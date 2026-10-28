# ADR-027 — T1 B11: opt-in coyote time and air control in the KCC

Status: accepted (session 144, 2026-10-28) · Task: T1 B11 · Rulings: Q2 (a), Q3 yes (APPROVAL LEDGER 2026-10-20)

## Context
The T1 plan (§5.3, step B11) adds two opt-in fields to `AstronautConfig` in
`game/src/core/physics/astronautKCC.ts`: `coyoteTime` (jump grace after a walk-off)
and `airControl` (airborne steering). The Lead ruled both in, at default 0, with the
play values 0.10 s and 0.3. Risk K8: the KCC default path carries the ratified F14
jump clear and the F18 launch compose, so the edit must leave it bit-identical.

## Options
1. Play-layer velocity kick for coyote (plan option Q2b) — rejected by the plan: it
   bypasses the F18 spin-phase compose.
2. Opt-in KCC fields, logic only behind `> 0` guards (chosen).
3. For air control: steer toward the walk target even with no stick input
   (literal §5.3 formula) vs. steer only with input.

## Decision
- `coyoteTime?`/`airControl?` are optional, read as `cfg.x ?? 0`.
- Coyote: when `_groundedTick` ends airborne without a jump (the cliff path), the
  window opens with the character `up` just left (normal/radial blend, as §5.3).
  In `_flightTick`, a jump press while the window is open removes any fall speed
  along that up and adds `jumpSpeed` along it, rotated at θ_prev (F18). The window
  closes on fire, on expiry, on landing, on teleport and on vehicle attach.
  `PlayerController` accepts the buffered press while `kcc.coyoteLeft > 0` and reads
  the new `kcc.coyoteJumps` counter as the launch edge.
- Air control: only with stick input (|input| ≥ 0.01). The ground-relative
  tangential velocity is steered toward the walk target at `airControl·dt/accelTau`
  per tick, capped at max(sprintSpeed, current tangential speed).

## Why
- Behind `> 0` guards the default path does no new arithmetic, so the harness and
  every existing config stay bit-identical — proven by a hash trace pinned on the
  unedited core.
- Removing the fall speed makes a coyote hop as high as a ground jump, which is the
  point of the grace window; without it the hop is ~70 % of a jump at 0.1 s.
- Input-only air control: a Moon hop lasts ~5 s, and steering toward a zero target
  with no input would brake a running jump to a stop mid-air. The cap keeps steering
  from ever adding speed beyond a sprint, and never brakes a faster launch by itself.

## Consequences
- New tool `game/tools/test-kcc-default-trace.mjs` (96 starts × 1,800 ticks on the
  harness and play configs, fields 0; sha256 pins from 9c4ee90). Re-pin only with
  an ADR that deliberately changes the default path.
- `test-play-controller.mjs` gains B11 checks (coyote fires at 1/60…0.10 s, not at
  0.117 s; coyoteTime 0 never opens; air steer reaches the walk/sprint speed within
  0.2 %; no-input hop byte-identical with airControl 0; zero-GC 20k ticks).
- Measured: air steer settles at 3.204 m/s for walk 3.2 (ballistic arc on a 1,364.5 m
  body feeds ~0.1 % tangential speed); documented as the test tolerance.