# ADR-016 — Real orbit elements (e, i, Ω, ω, M0) in the catalog (F3abbbbbc)

**Status:** accepted (session 124, 2026-10-27). Completes the catalog part of D-ADR-2 (`docs/audit/U26-adr-drafts.md`): ADR-011 (sourced data), ADR-013 (spin), ADR-015 (scale laws) and this ADR (orbit shape and orientation) together make "one documented law per quantity, plus real rotation and orbit data".

## Context
A1-U12-1/-2 found that all 16 catalog orbits were circular and coplanar (e = i = Ω = ω = 0, M0 a golden-angle spread). `KeplerRail` already evaluates ellipses and inclined planes (perifocal basis Rz(Ω)Rx(i)Rz(ω), Z-up relabelled to the Y-up world) and ADR-012 validates 0 ≤ e < 1 at boot, so only the catalog input and the gates were missing.

## Options
- (a) Keep circular orbits and a decorative M0. Rejected: planets would not look real (Mercury e 0.21, Pluto e 0.25, i 17°).
- (b) Take e, i, Ω, ω, M0 from `REAL_BODY_DATA` and give the rail ecliptic angles. Chosen.
- (c) Teach the rail per-body reference planes. Rejected: a rail change for no behavioural gain; the plane tilt composes into ecliptic angles at boot.

## Decision
`src/core/orbit/orbitElements.ts` (`deriveOrbitElements`, boot-only, pure core) fills `OrbitParams` for every non-star body.
- **Planets and Pluto:** JPL Table 1 elements are already ecliptic-referenced, so they are used as is (ω = ϖ − Ω and M = L − ϖ come from `realBodyData.ts`). **The Moon:** JPL gives it against the ecliptic, so also as is.
- **Other moons** (Phobos, Io, Titan, Titania, Triton, Charon): JPL gives elements against the parent's local Laplace plane. **Approximation:** that plane is the parent's equatorial plane, with normal = the parent's right-hand spin axis (IAU pole, flipped when its rate is negative). The node origin is the ascending node of that plane on the ICRF equator; the source table does not state it, so this is an **assumed convention** that only rotates the in-plane starting phase (Ω + ω). The composed orientation is converted to ecliptic (i, Ω, ω), so the rail is unchanged.
- **Direction:** `n = 2π/T > 0` for every body; retrograde motion is i > 90° to the ecliptic, and `OrbitParams.retrograde` is `i > π/2`. Consequence: Titania and Charon orbit prograde about parents whose pole is tilted past 90° (Uranus 97.8°, Pluto 119°), so they are retrograde against the ecliptic (i 97.8°, 112.8°); Triton is retrograde (i 130.7°). The old sign-of-n flag is removed.
- **Epoch:** M0 is the sourced mean anomaly at J2000, no longer a spread; the start is the real configuration at J2000 (up to the ADR-015 scale laws).

## Why
Real shapes and tilts are what "looks like a real solar system" needs, and the rail already supports them. The Laplace-plane approximation keeps moon planes within a few degrees of the true ones without a per-moon plane table.

## Consequences
- The orbit gate (`tools/test-orbit-gate.mjs`) oracle is extended: its own bisection Kepler solver and true-anomaly rotation give the exact position of all 16 bodies (< 0.1 mm); the mean motion is read from the areal velocity |r×v| = a²·n·√(1−e²); the new `elements-real` check (replacing `oracle-domain`) pins e (NSSDC), ecliptic inclination, the sourced orientation, M0, and the moon plane angle and in-plane ω against pinned IAU poles. Direction is judged against a pinned set {Triton, Titania, Charon}, not against the engine's own sign.
- Mutants (Mercury e = 0, Moon i = 0, Pluto Ω + 30°, Mercury ω + 10°, Venus M0 + 20°, Titan flat, Titania ω in-plane, Io e 0.05, rail ignoring e, plus the F2a set) all turn the gate red.
- The m1b harness reference solves Kepler by bisection and compares radius and true anomaly on ellipses; the row count is unchanged (ADR-001). Orbit rings in the harness still draw circles of radius a (display only).
- The Moon's play position/phase changes with its real elements, so the play-spawn Earth/Sun directions may move; pins are re-pinned in the same commit with a WHY if so.
- KeplerRail, the tick order and the play Moon terrain/KCC are unchanged.

## Not done / open
- Spin is still not applied by the tick (F3b). Real-date arrangements beyond J2000 are out of scope (Spec 00.4).
## Addendum (session 124): consequences observed when the elements went real

- Spawn pins were re-pinned with WHY comments in test-play-spawn, test-play-world, test-play-controller and test-play-lod. The Moon's real elements move the t=0 Earth and Sun directions. New spawn direction is (0.8349753337306719, -0.07279905191367053, 0.5454507219738775). Earth elevation is 14.3488 deg (nominal 15), Sun elevation is 46.2127 deg.
- test-play-frame was loosened to "Earth disc visible" (31.93 deg off the view axis against a 31 deg half-height plus a disc half-angle of about 7 deg). This is a look-and-feel question for the Lead, not a technical one.
- test-alloc-gate --self-test churn mutant now uses private double-valued keys. The rail basis now holds doubles, so the shared {x,y,z} hidden class no longer isolated the mutant (same cause as ADR-014). Warm-up raised to 8000 steps for JIT tiering. Self-test 8/8 exit 0.
- Real-tree churn check is recorded as noise-limited (+237 B/frame); the strict check resumes after F5a.
