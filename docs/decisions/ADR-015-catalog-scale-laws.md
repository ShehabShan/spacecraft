# ADR-015 — Catalog scale laws: one radius law, one distance law, one time scale (F3abbbba)

**Status:** accepted (session 119, 2026-10-27). These laws are chosen and verified here. Wiring them into `celestialData.ts` is F3abbbbb. Promotes the law part of D-ADR-2 (`docs/audit/U26-adr-drafts.md`).

## Context
A1-U10-2 found that the catalog radii follow two compression laws, so Mars is smaller than Mercury, and Charon and Titania are bigger than the Moon. A1-U10-6 found that a day (604 s) is longer than a year (294 s). A1-U12-1 found that the catalog has no inclination or eccentricity. D-ADR-2 chose this remedy: derive the catalog from real data, with one documented law per quantity. The 2026-10-22 ledger rulings are binding:
- keep the small play Moon (R 1,364.5 m, real g);
- keep the oversized Earth in the Moon sky (14.7°);
- the sky moves in the real order: a day is much shorter than a year, and bodies are slow enough to fly to.

Real inputs come from `REAL_BODY_DATA` (ADR-011).

## Options
- **Radius:** (a) linear, anchored on the Moon (1:1,273). (b) Power law. (c) Saturating law R_g = k·R/(1+R/Rc).
  - (a) with any single distance law that keeps the big Earth puts Io inside Jupiter and makes the Sun ~550 km.
  - (b) cannot keep small bodies proportional and giants small at the same time.
- **Distance:** a single power law a_g = 600 km·(a/a_Earth)^q. The anchor (Earth's heliocentric 600 km) is kept from the current play scale. q is fixed by the 14.7° ruling.
- **Time:** (a) keep μ = g·R_game² and the 30× default, which gives each system its own clock. (b) One scale S: T_game = T_real/S for every orbit and every spin.

## Decision
- **Radius law:** R_g = k·R/(1+R/20,000 km), k = 0.853594 m/km. k is chosen so that the Moon is exactly 1,364.5 m.
- **Distance law:** a_g = 600,000 m·(a/a_Earth)^0.491234. q is chosen so that Earth subtends 14.667° from the Moon's orbit.
- **Time law:** T_game = T_real/360 for every orbit, played at 1×.
  - The spin law (ADR-013) keeps real spin/orbit ratios, so spins follow automatically (Earth day 239 s).
  - Under one time scale, the orbit μ is derived as 4π²a³/T². Surface gravity stays the real g.

## Why
The engine-independent probe `game/tools/audit/f3abbbba-scale-laws.mjs` uses pinned real literals. It shows 8/8 PASS, exit 0 twice with identical output:
- Moon 1,364.5 m.
- Earth 14.667° in the Moon sky.
- Radius order equals the real order for all 17 bodies (Mars 2,474 > Mercury 1,856; Charon 501 and Titania 648 < Moon).
- The Sun is largest (16,595 m vs Jupiter 13,276 m).
- Every moon periapsis is ≥ 2.06 parent radii (Phobos is the tightest).
- Mercury's perihelion is 18 Sun radii out.
- Year/day = 366.3.
- The fastest body (Io) moves at 496 m/s at 1×, under the 2,000 m/s ship cap, so every body can be caught.

`--control` runs the same checks on the old hand-tuned catalog. It fails with 6/8, exit 1: radius order is broken and the day is longer than the year.

## Consequences
- In `celestialData.ts`, every radius, distance and period changes (RATIFIED constants, changed under this ADR). gravityRange and portalDist are re-derived by their documented formulas.
- The macro default goes from 30× to 1×.
- The orbit gate's `SUN_MU` / g·R² pins are replaced by S = 360 and these law constants. Its oracle is extended to ellipses and inclined orbits (ADR-016, F3abbbbb).
- The play Moon terrain, its KCC and the 14.7° look are unchanged.
- Earth's radius becomes 4,124 m, and its Moon distance becomes 32,047 m. The angle is preserved.
- **Approximation:** the radius law compresses the giants (Jupiter is 3.2× Earth, not 11×), so that moons sit outside their parents at a playable distance scale. This is documented as a look-and-feel tradeoff inside the existing rulings.