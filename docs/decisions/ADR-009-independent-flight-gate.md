# ADR-009 — Independent m1d flight gate and tick-time dive deadline (F2d)

**Status:** accepted (session 113, 2026-10-26) · **Task:** F2d · **Findings:** A1-U05-1, A1-U05-7 (K2c), A1-U05-2 (K2d)

## Context
m1d T1 passes three faulty atmospheres: a 50 % density step at 4 km, Mach computed from sea-level sound speed at every altitude, and reversed wind. It checks only sampled monotonicity, a few scalars and the wind magnitude (A1-U05-1). T2 passes an endpoint-only terrain sweep, because `minPostTickAGL` reads tick endpoints only (A1-U05-7). T2's 45 s dive deadline counts *requested* time. Below about 20 fps the 0.1 s frame clamp and 6 substeps shed ticks, so the dive ends airborne and T2 fails on slow machines (A1-U05-2). The rechecks are `pre-t4:docs/audit/U27b3b2b2a-m1d-recheck.md` and `pre-t4:docs/audit/U27-k2d-recheck.md`. This session reproduced the U05-2 failure in the real browser: on the 2 vCPU VM, playwright m1d exited 1 with T2 FAIL, minimum post-tick AGL 65.57 m and 0 contacts.

## Options
1. Rewrite T1/T2 inside the browser harness. Its truth would still come from the engine constants, and the strict ADR-001 row contract (D5) would be touched.
2. Add a Node gate that bundles the real atmosphere, flight controller and terrain field. Its truth comes from pinned spec literals and an independent path oracle, and mutants are source rewrites (the ADR-006/007/008 pattern). Separately, fix only the harness dive *deadline*, which is a test-schedule bug rather than a coverage gap.
3. Gate only, and leave the harness deadline as is. m1d would stay red on any slow runner.

## Decision
Option 2.

**Gate: `game/tools/test-flight-gate.mjs`.** It has 12 checks:

| Check | Truth |
|---|---|
| `profile-pinned` | The `EARTHSCALE_ATMOSPHERE` fields equal the pinned spec literals. The flight config uses that profile, R = 5000 and μ = 9.81·R². |
| `density-law` | ρ = 1.225·e^(−max(h,0)/1200) holds at h ≤ 0 and at every 25 m from 25 m to 24 km (relative error < 1e-12). Ratios straddling each mark at ±0.01 m equal e^(−0.02/1200) (< 1e-9). |
| `mach-law` | Mach = v / √(1.4·287.05·max(210, 288.15 − 0.0065h)) holds every 50 m from 0 to 24 km at 100, 800 and 1,900 m/s. This range includes the lapse and the 210 K floor. |
| `wind-vector` | The wind is the signed Ω×p for Ω = (0,ω,0), at 4 spins × 5 poses, using the full vector rather than the magnitude. |
| `ridge-sweep`, `ridge-clear-pass` | A constructed 20 m Gaussian ridge, in vacuum with no gravity. Its endpoints are +10.02 m clear and its midpoint is 10 m below ground. The tick must contact the ridge or keep a clear interior. A path 30 m up must not contact. |
| `real-terrain-grazing` | 4,096 seeded grazing paths (seed 0x27b205) over the real TEST_PLANET field, each on a fresh controller. Every tick is scored by an independent interior oracle with a 0.25 m sample gap. The tick is true if it contacted and ended on or above ground, or if it did not contact and its whole straight path stayed clear. |
| `dive-60/30/15/10` | The harness dive: 2,000 m/s straight down from 10 km, ×4 pacing, ≤ 6 substeps, 0.1 s clamp, and a 45 s deadline in PHYSICS time. Each run must land, with v@1000 within 266.0 ± 6 m/s (the U05c independent RK4), peak ≥ 1,980 m/s, every tick true under the interior oracle, and the end on or above ground. |
| `dive-fps-independent` | The pre-contact altitude/speed trace is identical at all four frame rates. |

`--self-test` runs 8 mutants, and each must turn its named checks red:
- the density step at 4 km;
- sea-level Mach;
- a temperature with no floor;
- reversed wind;
- a ρ0 drift;
- an endpoint-only sweep (an AST body replacement);
- the sweep removed;
- the requested-time deadline schedule at 15/10 fps.

A rewrite that matches nothing exits 2. The production atmosphere, flight controller and terrain-field hashes must be unchanged afterwards. `--deliberate` adds a no-op case and must exit 1.

**Harness:** the DIVE phase deadline is now `script.diveTicks / 60 > 45`, which counts the ticks `flight.update` returned during DIVE. The countdown HUD reads the same value. The rows, the predicates, `simElapsed` (used by cruise) and the badge count are unchanged.

## Why
- Pinned literals and the interior oracle sit outside the engine, so a wrong profile or a sampling regression cannot validate itself.
- The oracle shares only the terrain height field with the engine. It never uses the DDA's sample positions or its telemetry, so endpoint-only telemetry cannot satisfy it.
- The dive physics was already fps-independent: the same 1,076-sample trace landed after 18 s of physics time at every frame rate. Only the deadline's clock was wrong, so changing that clock fixes A1-U05-2 without hiding a physics fault.

## Consequences
- Finite samples cannot prove C∞ smoothness or global no-tunnelling. They can only refute them, and the gate claims nothing more. The density law is clamped at h ≤ 0 by design.
- Nonzero planet spin is checked only at the wind-function level. No spinning-flight fixture exists yet, so integration-level spin transport stays open for the frame-model tasks (F3*).
- F5b (the DDA slope bound) and F7a (flight controls) must keep this gate green. A refactor of the rewritten lines breaks the self-test loudly (exit 2), and the rewrite strings must then be updated.
- ADR-001 row counts are unchanged: m1d still has 5 rows.