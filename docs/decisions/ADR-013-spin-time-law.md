# ADR-013 — Spin, pole and prime meridian per body, and the time law that sets them (F3a, part bba)

**Status:** accepted (session 117, 2026-10-26) · **Task:** F3a → F3abb split per §12 into F3abba (this ADR) + F3abbb · **Finding:** A1-U12-1 (K3) · **Promotes:** D-ADR-2 (`docs/audit/U26-adr-drafts.md`), spin/time clause only

## Context
A1-U12-1: no body rotates. `CelestialConfig` had no spin period, spin axis or prime meridian, so the frame tree (F3b) has nothing to rotate. ADR-011 added the real IAU orientation (pole RA/Dec, W0, Ẇ) to `REAL_BODY_DATA`. The 2026-10-22 ledger ruling (A1-U10-5/6) asks for a sky in the real order: a day much shorter than a year, and planets and moons slow enough to fly to.

The game orbit periods `T` are not on one time scale: the rail derives them from the game μ and a, and moon systems have their own scale (A1-U10). Re-choosing orbit times is F3abbb's job.

## Options
1. **One global time scale** (spinGame = spinReal / k). With the orbit periods as they are, a single k would put Earth's day and year out of their real ratio. It cannot be chosen before F3abbb fixes the orbit times.
2. **Keep each body's real spin-to-orbit ratio** (spinGame = T_orbitGame · spinReal / T_orbitReal). This guarantees the real order of day and year for every body, whatever F3abbb does to the orbit times.
3. Hand-pick spin periods. This is not a law, and the brief requires one law per quantity. Rejected.

## Decision
Option 2, in a new boot-only module `game/src/core/orbit/spinLaw.ts` (`deriveSpins`), stored as `CelestialConfig.spin: SpinParams { period, axis, W0, retrograde, lockedTo }`.
- **Time law:** spinGame = T_orbitGame · spinReal / T_orbitReal. Real orbit periods are Kepler-3 on `aKm` with the Sun's GM for planets and JPL SSD sidereal periods for moons.
- **Tidal lock (exact):** if |spinReal / T_orbitReal − 1| < 0.01, the spin period equals the body's own game orbit period. This covers the Moon, Phobos, Io, Titan, Titania, Triton and Charon. Without it, the ratio 1.0008 would turn the Moon's face 0.3° per orbit and it would drift away from Earth.
- **Mutual lock:** if a body's spin matches a child's orbit (Pluto–Charon), its spin period equals that child's game orbit period.
- **Sun:** it has no orbit, so it uses Earth's ratio: spinGame = T_earthGame · spinReal / T_earthReal.
- **Axis:** the IAU pole is rotated from ICRF to the J2000 ecliptic by the obliquity 23.4392911°, then mapped into the world frame (x_e, z_e, −y_e), the same map as `KeplerRail`. The stored axis is the right-hand axis: the IAU pole is flipped when Ẇ < 0 (Venus, Uranus, Titania, Triton). `retrograde` = axis below the ecliptic. W0 = IAU W0 in radians, with the same sign flip.
- The module is **data only**. Nothing in the tick reads `spin` until F3b, so engine behaviour is unchanged.

**Results:** Earth's year is 8,820.7 s with a 24.083 s day (366.26 sidereal days a year) and a 23.44° tilt. The Moon's spin equals its 3,072.3 s orbit. Venus (178.76°), Uranus (97.72°), Titania, Triton, Pluto and Charon are retrograde.

**Gate:** `game/tools/test-spin-law.mjs` bundles the real catalog. Its truth comes from NSSDC values pinned in the gate, not from `spinLaw.ts`. It checks:
- every period > 0, every axis a unit vector, every W0 finite;
- the retrograde set;
- Earth's obliquity 23.44° and the Sun's 7.25° tilt;
- the 7 tidal locks and the Pluto–Charon lock (exact equality);
- the spin/orbit ratio of the 8 planets and the Sun within 0.5 %. Neptune is allowed 1.2 %, because the IAU rate gives 15.966 h and NSSDC 16.11 h; `test-real-body-data.mjs` (ADR-011) uses the same tolerance;
- 366.256 ± 0.5 sidereal days in Earth's year.

**Self-test:** seven source-rewrite mutants must turn the gate red: no retrograde flip, obliquity not applied, axis map not swapped, tidal lock off, mutual lock off, ratio inverted, and the Sun using real seconds. `--deliberate` adds an identity mutant, so the self-test must then fail.

## Consequences
- F3b can rotate each body by `spin.axis`, `spin.W0` and 2π·t / `spin.period`.
- **Known approximation:** with moon systems on their own time scale, Phobos orbits slower than Mars spins (real: faster). F3abbb re-chooses orbit times under one distance/time law, and the spin law follows automatically.
- F3abbb still owes the distance and radius laws, real e/i/Ω/ω on the rails, the orbit-gate oracle beyond circular, zero-inclination orbits (ADR-014), and D-ADR-2 in full.
- **Open regression:** `test-alloc-loops.mjs --self-test` exits 2 on this tree: its calibration control `cal.obj3` reads 96.1 B/iter (allowed 16–64) instead of 48.3 on the unedited tree. The likely cause, not yet verified, is that the new `{x,y,z}` double axis literals change V8's shared hidden class. F3abbb fixes it before F3a merges.
