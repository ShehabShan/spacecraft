/**
 * REAL REFERENCE DATA — orientation, spin and orbital elements of every catalog body (F3a, ADR-011).
 *
 * WHY: A1-U12-1 found that the catalog has no spin, pole, prime meridian, inclination or
 * eccentricity, so no body can rotate and every orbit is circular and coplanar. This table is
 * the single sourced input that the scale laws (F3ab) and the frame tree (F3b) derive from. It is
 * DATA ONLY in F3aa: nothing in the tick reads it yet, so engine behaviour is unchanged.
 *
 * Sources (fetched 2026-10-26; copied verbatim, never re-derived):
 *  - Orientation: NAIF PCK `pck00011.tpc` (IAU WGCCRE), J2000 constant + linear terms only:
 *    poleRA = α0, poleDec = δ0 (deg, ICRF), pmW0 = W0 (deg), pmRate = Ẇ (deg/day). Ẇ < 0 = retrograde spin.
 *  - Planet orbits: JPL "Approximate Positions of the Planets", Table 1 (J2000 ecliptic, 1800–2050):
 *    a (au), e, I, Ω (long. node), ϖ (long. perihelion), L (mean longitude), deg. Earth row = EM barycentre.
 *  - Moon orbits: JPL SSD "Planetary Satellite Mean Elements" (sep.html), local Laplace planes,
 *    epoch 2000-01-01.5 TDB: a (km), e, ω, M, i, node (deg), sidereal period (days).
 *  - Pluto orbit: NSSDC Pluto fact sheet, "Pluto Mean Orbital Elements (J2000)" (same row layout).
 *  - Radii: NAIF PCK `BODYnnn_RADII`, mean of the three axes (km).
 */

export interface RealOrientation {
  poleRA: number;
  poleDec: number;
  pmW0: number;
  /** deg/day; negative = retrograde spin (Venus, Uranus, Triton). */
  pmRate: number;
}

export interface RealOrbit {
  /** 'ecliptic' = J2000 ecliptic (planets); 'laplace' = parent's local Laplace plane (moons). */
  plane: 'ecliptic' | 'laplace';
  /** Semi-major axis, km. */
  aKm: number;
  e: number;
  /** Inclination, deg (> 90 = retrograde orbit). */
  i: number;
  /** Longitude of ascending node Ω, deg. */
  node: number;
  /** Argument of periapsis ω, deg. */
  argPeri: number;
  /** Mean anomaly at epoch, deg. */
  M0: number;
}

export interface RealBodyData {
  /** Mean radius, km. */
  radiusKm: number;
  orientation: RealOrientation;
  orbit: RealOrbit | null;
}

const AU_KM = 149597870.7;

/** Planet row from JPL Table 1: ω = ϖ − Ω, M = L − ϖ. */
function planet(aAu: number, e: number, i: number, L: number, varpi: number, node: number): RealOrbit {
  return { plane: 'ecliptic', aKm: aAu * AU_KM, e, i, node, argPeri: varpi - node, M0: L - varpi };
}
function moon(aKm: number, e: number, argPeri: number, M0: number, i: number, node: number): RealOrbit {
  return { plane: 'laplace', aKm, e, i, node, argPeri, M0 };
}
function rot(poleRA: number, poleDec: number, pmW0: number, pmRate: number): RealOrientation {
  return { poleRA, poleDec, pmW0, pmRate };
}

export const REAL_BODY_DATA: Readonly<Record<string, RealBodyData>> = {
  sun:     { radiusKm: 695700,   orientation: rot(286.13, 63.87, 84.176, 14.1844), orbit: null },
  mercury: { radiusKm: 2439.773, orientation: rot(281.0103, 61.4155, 329.5988, 6.1385108),
             orbit: planet(0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593) },
  venus:   { radiusKm: 6051.8,   orientation: rot(272.76, 67.16, 160.20, -1.4813688),
             orbit: planet(0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255) },
  earth:   { radiusKm: 6371.0084, orientation: rot(0, 90, 190.147, 360.9856235),
             orbit: planet(1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0) },
  moon:    { radiusKm: 1737.4,   orientation: rot(269.9949, 66.5392, 38.3213, 13.17635815),
             orbit: moon(384400, 0.0554, 318.15, 135.27, 5.16, 125.08) },
  mars:    { radiusKm: 3389.527, orientation: rot(317.269202, 54.432516, 176.049863, 350.891982443297),
             orbit: planet(1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891) },
  phobos:  { radiusKm: 11.1667,  orientation: rot(317.67071657, 52.88627266, 35.18774440, 1128.84475928),
             orbit: moon(9375, 0.015, 216.3, 189.7, 1.1, 169.2) },
  jupiter: { radiusKm: 69946,    orientation: rot(268.056595, 64.495303, 284.95, 870.5360000),
             orbit: planet(5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909) },
  io:      { radiusKm: 1821.5,   orientation: rot(268.05, 64.50, 200.39, 203.4889538),
             orbit: moon(421800, 0.004, 49.1, 330.9, 0.0, 0.0) },
  saturn:  { radiusKm: 58300,    orientation: rot(40.589, 83.537, 38.90, 810.7939024),
             orbit: planet(9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448) },
  titan:   { radiusKm: 2574.8,   orientation: rot(39.4827, 83.4279, 186.5855, 22.5769768),
             orbit: moon(1221900, 0.029, 78.3, 11.7, 0.3, 78.6) },
  uranus:  { radiusKm: 25363.67, orientation: rot(257.311, -15.175, 203.81, -501.1600928),
             orbit: planet(19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503) },
  titania: { radiusKm: 788.9,    orientation: rot(257.43, -15.10, 77.74, -41.3514316),
             orbit: moon(436298, 0.002, 184.0, 68.1, 0.1, 29.5) },
  neptune: { radiusKm: 24623,    orientation: rot(299.36, 43.46, 249.978, 541.1397757),
             orbit: planet(30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574) },
  triton:  { radiusKm: 1352.6,   orientation: rot(299.36, 41.17, 296.53, -61.2572637),
             orbit: moon(354800, 0.000, 0.0, 63.0, 157.3, 177.7) },
  pluto:   { radiusKm: 1188.3,   orientation: rot(132.993, -6.163, 302.695, 56.3625225),
             // Pluto is not in JPL Table 1: NSSDC Pluto fact sheet, "Mean Orbital Elements (J2000)".
             orbit: planet(39.48168677, 0.24880766, 17.14175, 238.92881, 224.06676, 110.30347) },
  charon:  { radiusKm: 605,      orientation: rot(132.993, -6.163, 122.695, 56.3625225),
             orbit: moon(19600, 0.000, 0.0, 304.1, 0.0, 0.0) },
};

/** Sidereal spin period in seconds, from the PCK prime-meridian rate (sign dropped). */
export function realSiderealSpinSeconds(id: string): number {
  return (360 / Math.abs(REAL_BODY_DATA[id].orientation.pmRate)) * 86400;
}