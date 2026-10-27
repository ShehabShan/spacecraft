/**
 * ============================================================================
 *  CELESTIAL CATALOG — per-body identity + ADR-015 scale laws
 * ============================================================================
 *  This file holds only what is NOT derivable: id, name, type, parent,
 *  surfaceGravity, atmosphereHeight, facts, retrograde-orbit flag.
 *  Everything geometric/temporal comes from the sourced real data
 *  (`realBodyData.ts`) through the three ADR-015 laws in `scaleLaw.ts`
 *  (one radius law, one distance law, one time scale T_game = T_real / 360):
 *   - radiusGame, a, T, muHost = 4*pi^2*a^3/T^2, gravityRange, portalDist
 *   - n        = +-2*pi/T                              (negative for retrograde)
 *   - mu_body  = surfaceGravity * radiusGame^2         (Spec 02.3; KCC gravity)
 *  The Sun keeps gravityRange 0 (gameplay convention).
 *  Orbits are circular and coplanar here; real e/i/Omega/omega/M0 are F3abbbbbc.
 * ============================================================================
 */


import type { BodyType, CelestialConfig, OrbitParams } from './types';
import { TWO_PI } from './KeplerRail';
import { deriveSpins } from './spinLaw';
import { deriveScaledBodies } from './scaleLaw';
import { deriveOrbitElements } from './orbitElements';


/**
 * Deterministic epoch spread (golden angle). Real-date starting
 * arrangements are OUT OF SCOPE per Spec 00.4 — this is the documented
 * placeholder that keeps bodies from clustering at t = 0.
 */


interface RawCatalogEntry {
  id: string;
  name: string;
  type: BodyType;
  parentId?: string;
  surfaceGravity: number;
  atmosphereHeight: number;
  facts: Record<string, string>;
}


/** Catalog identity; geometry and timing derive from the ADR-015 laws. */
const RAW: RawCatalogEntry[] = [
  {
    id: 'sun', name: 'Sun', type: 'star',
    surfaceGravity: 0, atmosphereHeight: 3000,
    facts: { mass: '1.989e30 kg', temp: '5,778 K' },
  },
  {
    id: 'mercury', name: 'Mercury', type: 'planet',
    surfaceGravity: 3.7, atmosphereHeight: 0,
    facts: { mass: '3.301e23 kg', temp: '430 C' },
  },
  {
    id: 'venus', name: 'Venus', type: 'planet',
    surfaceGravity: 8.87, atmosphereHeight: 6000,
    // facts.rotation 'Retrograde' = SPIN, not orbit — no effect on rails.
    facts: { mass: '4.867e24 kg', temp: '471 C', rotation: 'Retrograde' },
  },
  {
    id: 'earth', name: 'Earth', type: 'planet',
    surfaceGravity: 9.81, atmosphereHeight: 8000,
    facts: { mass: '5.972e24 kg', temp: '15 C' },
  },
  {
    id: 'moon', name: 'Moon', type: 'moon', parentId: 'earth',
    surfaceGravity: 1.62, atmosphereHeight: 0,
    facts: { mass: '7.342e22 kg', temp: '-53 C' },
  },
  {
    id: 'mars', name: 'Mars', type: 'planet',
    surfaceGravity: 3.71, atmosphereHeight: 2000,
    facts: { mass: '6.39e23 kg', temp: '-65 C' },
  },
  {
    id: 'phobos', name: 'Phobos', type: 'moon', parentId: 'mars',
    surfaceGravity: 0.0057, atmosphereHeight: 0,
    facts: { mass: '1.06e16 kg' },
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'gas_giant',
    surfaceGravity: 24.79, atmosphereHeight: 12000,
    facts: { mass: '1.898e27 kg', temp: '-110 C' },
  },
  {
    id: 'io', name: 'Io', type: 'moon', parentId: 'jupiter',
    surfaceGravity: 1.796, atmosphereHeight: 0,
    facts: { mass: '8.93e22 kg' },
  },
  {
    id: 'saturn', name: 'Saturn', type: 'gas_giant',
    surfaceGravity: 10.44, atmosphereHeight: 15000,
    facts: { mass: '5.683e26 kg', temp: '-140 C' },
  },
  {
    id: 'titan', name: 'Titan', type: 'moon', parentId: 'saturn',
    surfaceGravity: 1.35, atmosphereHeight: 2000,
    facts: { mass: '1.345e23 kg' },
  },
  {
    id: 'uranus', name: 'Uranus', type: 'gas_giant',
    surfaceGravity: 8.69, atmosphereHeight: 8000,
    facts: { mass: '8.681e25 kg', temp: '-195 C' },
  },
  {
    id: 'titania', name: 'Titania', type: 'moon', parentId: 'uranus',
    surfaceGravity: 0.379, atmosphereHeight: 0,
    facts: { mass: '3.5e21 kg' },
  },
  {
    id: 'neptune', name: 'Neptune', type: 'gas_giant',
    surfaceGravity: 11.15, atmosphereHeight: 8000,
    facts: { mass: '1.024e26 kg', temp: '-200 C' },
  },
  {
    id: 'triton', name: 'Triton', type: 'moon', parentId: 'neptune',
    surfaceGravity: 0.717, atmosphereHeight: 100,
    facts: { mass: '2.14e22 kg', orbit: 'Retrograde' },
  },
  {
    id: 'pluto', name: 'Pluto', type: 'planet',
    surfaceGravity: 0.62, atmosphereHeight: 0,
    facts: { mass: '1.303e22 kg', temp: '-225 C' },
  },
  {
    id: 'charon', name: 'Charon', type: 'moon', parentId: 'pluto',
    surfaceGravity: 0.288, atmosphereHeight: 0,
    facts: { mass: '1.586e21 kg' },
  },
];


// WHY: radius/orbit/range come from the ADR-015 laws applied to sourced real data (boot-only).
const SCALED = deriveScaledBodies(RAW.map((r) => ({ id: r.id, parentId: r.parentId ?? null, type: r.type })));
const ELEMENTS = deriveOrbitElements(RAW.map((r) => ({ id: r.id, parentId: r.parentId ?? null, type: r.type })));


/**
 * Fully derived celestial configs, in catalog (hierarchical) order.
 * KeplerRail's constructor topologically verifies this ordering.
 */
const BASE_CONFIGS = RAW.map((raw) => {
  const sc = SCALED[raw.id];
  // Spec 02.3: μ = g_real · R_game². (Real mass is NEVER used — facts only.)
  const mu = raw.surfaceGravity * sc.radiusGame * sc.radiusGame;


  let orbit: OrbitParams | null = null;
  if (raw.type !== 'star' && sc.T !== null && sc.muHost !== null && sc.a > 0) {
    // WHY: T and a are set by the ADR-015 laws; muHost = 4π²a³/T² is derived so Kepler III holds by construction.
    const nMag = TWO_PI / sc.T;
    // WHY (ADR-016): real e/i/Omega/omega/M0 from REAL_BODY_DATA. n is always positive;
    // retrograde motion (Triton) comes from i > 90 deg, not from the sign of n.
    const el = ELEMENTS[raw.id];
    orbit = {
      a: sc.a,
      e: el.e,
      i: el.i,
      Omega: el.Omega,
      omega: el.omega,
      M0: el.M0,
      T: sc.T,
      n: nMag,
      muHost: sc.muHost,
      retrograde: el.i > Math.PI / 2,
    };
  }


  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    parentId: raw.parentId ?? null,
    radiusGame: sc.radiusGame,
    surfaceGravity: raw.surfaceGravity,
    gravityRange: sc.gravityRange,
    portalDist: sc.portalDist,
    atmosphereHeight: raw.atmosphereHeight,
    mu,
    facts: raw.facts,
    orbit,
  } satisfies Omit<CelestialConfig, 'spin'>;
});

// WHY: spin needs every body's game orbit period (locks, Sun reference), so it is a second pass (ADR-013).
const SPINS = deriveSpins(BASE_CONFIGS.map((c) => ({ id: c.id, parentId: c.parentId, T: c.orbit ? c.orbit.T : null })));

export const CELESTIAL_CONFIGS: CelestialConfig[] = BASE_CONFIGS.map((c) => ({ ...c, spin: SPINS[c.id] }));


/** Body count served by this catalog (asserted by the 1B suite: 17). */
export const CELESTIAL_COUNT = CELESTIAL_CONFIGS.length;
