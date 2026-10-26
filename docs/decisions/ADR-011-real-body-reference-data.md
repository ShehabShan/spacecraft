# ADR-011 — Real reference data for spin, pole and orbital elements (F3a, part a)

**Status:** accepted (session 115, 2026-10-26) · **Task:** F3a (split per §12 into F3aa + F3ab) · **Findings:** A1-U12-1 (K3), A1-U10-2/-5 · **Promotes:** D-ADR-2 (`docs/audit/U26-adr-drafts.md`), data half

## Context
A1-U12-1: the catalog has no spin period, pole, prime meridian, inclination or eccentricity. No body rotates, and all 16 orbits are circular and coplanar. D-ADR-2 chose option (b): derive the playable catalog from real data, with one documented law per quantity (distance, radius, time), plus real spin, pole, inclination and eccentricity. A scale law needs a real input to scale. No such input existed in the repo.

## Options
1. Hand-type the new fields straight into `celestialData.ts` next to the game numbers. The real input and the scaled output would be mixed together, so a law could not be audited.
2. Keep a separate, sourced real-data table in the pure core (`realBodyData.ts`), with an independent gate. The scaled catalog (F3ab) is derived from it by named laws.
3. Load an ephemeris or SPICE kernel at runtime. This adds a new library or file loader and a large download for 17 bodies. It is rejected.

## Decision
Option 2. `game/src/core/orbit/realBodyData.ts` is data only. Nothing in the tick reads it yet, so engine behaviour and every existing gate are unchanged.

| Field | Source |
|---|---|
| pole α0/δ0, prime meridian W0, rate Ẇ (deg/day) | NAIF PCK `pck00011.tpc` (IAU WGCCRE), constant and linear terms |
| planet a, e, I, Ω, ϖ, L | JPL "Approximate Positions of the Planets", Table 1 (J2000 ecliptic; Earth row = EM barycentre) |
| Pluto a, e, I, Ω, ϖ, L | NSSDC Pluto fact sheet, "Mean Orbital Elements (J2000)" (Pluto is not in JPL Table 1) |
| moon a, e, ω, M, i, node | JPL SSD Planetary Satellite Mean Elements, local Laplace planes, epoch 2000-01-01.5 TDB |
| mean radius | NAIF PCK `BODYnnn_RADII`, mean of the three axes |

**Gate: `game/tools/test-real-body-data.mjs`**, 63 checks. It uses truth pinned from separate sources (NSSDC sidereal spin and orbit periods, NSSDC radii, real host GM):
- spin period for 11 bodies (0.2 %, Neptune 1.2 %);
- radii (0.2 %);
- Kepler-3 orbit periods from the raw `a` for 9 planets (0.3 %) and 7 moons (0.5 %, with retrograde from i > 90°);
- tidal locks for 6 moons plus Pluto–Charon (spin = orbit, sign follows the parent);
- ranges and the id set.

`--self-test` runs 10 mutants, and all must turn the gate red: Venus spin sign, Earth rate ×1.01, Uranus retrograde lost, Triton prograde, Mars `a` in au as km, Moon `a` ×1.01, Jupiter polar-only radius, Mercury e ≥ 1, pole declination out of range, Charon dropped.

## Why
- A law is auditable only if its input is separate and sourced.
- The table is checked against independent periods, not against itself (A1 lesson K2: a gate must not read the thing it tests).
- Analytic pole and prime-meridian data is all the frame tree (F3b, D-ADR-3) needs for an O(1), exact spin quaternion at any time scale.

## Consequences
- **Pluto pole convention.** The PCK uses the IAU *positive* pole, so Pluto's rate is positive. NSSDC quotes −153.29 h about the north pole. The gate compares magnitude for Pluto only.
- **Neptune.** The IAU rate gives 15.966 h, while the Voyager radio period is 16.11 h. The IAU model is used.
- **F3ab (next) does the rest of this task.** It:
  - derives the scaled catalog by one law per quantity, applying the 2026-10-22 ledger rulings (small Moon, big Earth in the Moon sky, a day much shorter than a year);
  - adds spin period, pole, prime meridian, inclination and eccentricity to `CelestialConfig`;
  - adds boot validation (e ≥ 1, a ≤ 0 and NaN are rejected, A1-U12-2);
  - updates the pinned facts of the orbit gate (ADR-006) in the same commit.