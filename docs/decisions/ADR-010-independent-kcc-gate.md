# ADR-010 — Independent m1e KCC gate (F2e)

**Status:** accepted (session 114, 2026-10-26) · **Task:** F2e · **Findings:** A1-U04-1, A1-U04-3, A1-U04-4 (K2c)

## Context
m1e R5 subtracts the character's blended-up tilt from the jump drift, but the KCC launches along the terrain normal. At zero spin this reports −0.97 cm of "drift" with no rotation at all. R5 also never compares its own prediction: −1 m, 100 m and NaN all pass (A1-U04-1). R1 and R2 keep `integrity.minAGL = Infinity` while grounded, so a 0.10 m sink after a tick passes both rows (A1-U04-3). R1's raw per-tick forward-change bound (0.09 rad) mixes steering, frame transport and error, so 87 injected 4° yaw snaps pass (A1-U04-4). The recheck is `docs/audit/U27b3b2b1-m1e-recheck.md`.

## Options
1. Rewrite R1/R2/R5 inside the browser harness. Truth would still come from KCC telemetry, and the ADR-001 row contract (E6) would be touched.
2. Add a Node gate that bundles the real KCC, spherical frame and terrain field. Truth comes from pinned literals, an independent RK4 integrator and independent per-tick geometry, and mutants are source rewrites (the ADR-006…009 pattern).
3. Change core telemetry so grounded ticks write `minAGL`. That changes engine semantics to make an existing row able to fail, and the row would still read the engine's own number.

## Decision
Option 2. **Gate: `game/tools/test-kcc-gate.mjs`**, 13 checks. The harness and the engine are unchanged.

| Check | Truth |
|---|---|
| `profile-pinned` | `EARTHSCALE_ASTRONAUT` R 5000, μ 245,250,000, range 30,000, Ω 0.0104, jump 5 m/s, clearance 0.02 m |
| `jump-smooth-truth` | Smooth sphere (test-only rewrite: height 0, radial normal), launch at +X on the equator. The KCC landing (tangential, planet frame) is within 4 mm of an independent inertial RK4 (h = 1e-4 s, bisected contact against the rotating surface). The truth's west drift is in 1.5–2.2 cm. Measured: KCC 1.920 cm, truth 2.018 cm, error 0.98 mm; the flat-g closed form (4/3)Ωu³/g² is 1.80 cm |
| `jump-smooth-converges` | At dt = 1/240 the error is below half the 1/60 error (0.25 mm vs 0.98 mm), so the residual is discretisation |
| `jump-smooth-zero-spin`, `jump-smooth-reversed` | Ω = 0 gives 0 west drift (KCC and truth); −Ω gives exactly the negated drift (< 1e-6 m) |
| `jump-real-truth`, `jump-real-converges` | A real 6.67° site (deterministic scan, 4–8°, locally planar). The truth launches along the real terrain normal and lands on the rotating real terrain, so the tilt is part of the trajectory instead of being subtracted. Error ≤ 15 mm at 1/60 (measured 9.9 mm; the launch carries ≈ 0.4 m/s downhill), and 1.6 mm at 1/240 |
| `clearance-walk-corner`, `clearance-walk-steep` | Every tick observed (observation count = tick count, all finite). The clearance is \|p\| − R − h(p̂), computed by the gate. Grounded ticks must equal 0.02 m within 1e-6 m and airborne ticks must be ≥ 0. Measured deviation ≤ 1.7e-11 m |
| `frame-walk-corner`, `frame-walk-steep` | Every tick, absPos = R_y(ω·t)·pLocal within 1e-6 m (measured 9.4e-9 m) |
| `yaw-walk-corner`, `yaw-walk-steep` | Every tick, expected fwd = minimal rotation of fwd from up₀ to up₁, then the commanded yaw about up₁. The residual must be ≤ 0.5·δ² + 1e-9 rad, where δ is the tick's up rotation. Measured: max 0.0152°, worst residual/δ² = 0.250 |

The walks are a 30,000-tick (4.76 km) steered great-circle walk from 10° through the (1,1,1)/√3 corner region, using the climb-unrestricted R1 config, and a 6,000-tick turning sprint on a 25–40° site under the ratified rules.

`--self-test` runs 8 mutants, and each must turn its named checks red:
- `launch-along-up-tilt` — launch along the blended up instead of the normal (the U04-1 artefact);
- `launch-compose-theta-new`;
- `transport-velocity-x2`;
- `sink-0.10m-tick-1000` (the U04-3 sink);
- `compose-at-theta-prev`;
- `yaw-snap-4deg` every 1,000 ticks (the U04-4 snap);
- `yaw-snap-8deg`;
- `yaw-creep-0.05deg-per-tick`.

A rewrite that matches nothing exits 2. The three production source hashes must be unchanged afterwards. `--deliberate` adds a no-op case and must exit 1.

## Why
- The truth sits outside the KCC. The integrator, contact search and geometry are the gate's own code, and they share only the terrain height and normal service. A wrong compose, transport or launch direction cannot validate itself.
- The yaw bound is derived, not prescribed. `transportFrameInto` is a projection (U15-1), which differs from minimal rotation at second order in δ. The measured coefficient is 0.25, so K = 0.5 keeps 2× headroom, while a 4° snap (0.07 rad on δ ≈ 1e-3) exceeds the bound by orders of magnitude. The U04 report's 1e-6 rad residual is not used (recheck: not derived).
- The clearance check observes the state the KCC actually holds after each tick. A finite reading is therefore guaranteed, with no new engine telemetry.

## Consequences
- The browser rows R1/R2/R5 keep their ADR-001 count (m1e 6) and their old predicates. This gate is the trustworthy check for these three claims, and the m1e rows remain smoke tests.
- The gate does not adjudicate projection vs parallel transport (U15-1, the F3d scope); it bounds the residual at the measured order. If F3d makes the frame a true minimal rotation, the coefficient falls and K may be tightened by ADR.
- F3d (KCC on body-local state), F6a/F6b (slope rule, landing easing) and F5a/F5b (terrain service) must keep this gate green. A refactor of the rewritten lines breaks the self-test loudly (exit 2); update the rewrite strings then.
- Finite samples refute; they do not prove global no-penetration.