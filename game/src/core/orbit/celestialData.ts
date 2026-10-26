/**
 * ============================================================================
 *  CELESTIAL CATALOG — SECTION 03 DATA, VERBATIM CANON
 *  Milestone 1B
 * ============================================================================
 *  Every radius, distance, gravity, range, portal distance, atmosphere
 *  height, and fact is transcribed EXACTLY from 03_DATA_AND_CELESTIALS.json.
 *  Where the Section 02.2 regeneration formulas and the catalog disagree by
 *  rounding (e.g., Mercury radiusGame 3105.7 vs formula 3094), THE CATALOG
 *  WINS — it is the verified canon. The formulas were cross-checked against
 *  the catalog and reproduce every gravityRange and portalDist exactly
 *  (Earth: max(6·5000, 1.3·38850) = 50,505 ✓; Jupiter: 1.5·99,841.2 =
 *  149,761.8 ✓), confirming the interpretation.
 *
 *  DERIVED AT BOOT (setup path — allocation sanctioned):
 *   - μ_body   = surfaceGravity · radiusGame²          (Spec 02.3)
 *   - T        = 2π·√(a³/μ_host)                       (Kepler's Third Law)
 *   - n        = ±√(μ_host/a³)                         (− for retrograde)
 *
 *  ╔════════════════════════════════════════════════════════════════════╗
 *  ║ THE ONE DERIVED CONSTANT — SUN ORBITAL μ (flagged for Lead review)  ║
 *  ╠════════════════════════════════════════════════════════════════════╣
 *  ║ The catalog gives the Sun surfaceGravity: 0 — that is the GAMEPLAY  ║
 *  ║ gravity model (gravityRange: 0; the ship never lands on the Sun).   ║
 *  ║ This milestone mandates T = 2π√(a³/μ_host), which requires an       ║
 *  ║ orbital μ for the Sun. Derivation: apply Section 02.3's own formula ║
 *  ║ with the Sun's REAL surface gravity (274 m/s²) and its artistic     ║
 *  ║ game radius (20,000 m):                                             ║
 *  ║        μ_sun = 274 · 20,000² = 1.096e11 m³/s²                       ║
 *  ║ Resulting dynamics (computed exactly at boot below):                ║
 *  ║   Earth year = 8,821 s (2.45 h sim) = 4.9 min of play at 30×;       ║
 *  ║   60-day fast-forward = 587.7 Earth orbits; Neptune 31.5 h.         ║
 *  ║ A single μ_sun makes Kepler's Third Law hold EXACTLY across all     ║
 *  ║ planets: (T_p/T_e)² = (a_p/a_e)³ (asserted by the 1B suite).        ║
 *  ║ One line to tune if the Lead prefers different pacing.              ║
 *  ╚════════════════════════════════════════════════════════════════════╝
 *
 *  Derived period table (documented values; code computes exactly):
 *   Mercury 4,381 s · Venus 6,963 s · Earth 8,821 s · Mars 12,122 s
 *   Jupiter 30,392 s · Saturn 48,139 s · Uranus 81,144 s · Neptune 113,254 s
 *   Pluto 138,927 s
 *   Moon 3,072 s · Phobos 575 s · Io 634 s · Titan 2,351 s
 *   Titania 1,806 s · Triton 1,395 s (retrograde) · Charon 3,206 s
 */


import type { BodyType, CelestialConfig, OrbitParams } from './types';
import { TWO_PI, computeOrbitalPeriod, meanMotion } from './KeplerRail';
import { deriveSpins } from './spinLaw';


/** Orbital μ of the Sun — see the banner above. */
export const SUN_ORBITAL_MU: number = 274.0 * 20000 * 20000; // 1.096e11


/**
 * Deterministic epoch spread (golden angle). Real-date starting
 * arrangements are OUT OF SCOPE per Spec 00.4 — this is the documented
 * placeholder that keeps bodies from clustering at t = 0.
 */
const GOLDEN_ANGLE = 2.399963229728653;


interface RawCatalogEntry {
  id: string;
  name: string;
  type: BodyType;
  parentId?: string;
  radiusGame: number;
  /** Planets: distance from the Sun (semi-major axis), metres. */
  distanceFromSun?: number;
  /** Moons: orbit radius around the parent, metres. */
  orbitRadiusGame?: number;
  surfaceGravity: number;
  gravityRange: number;
  portalDist: number;
  atmosphereHeight: number;
  facts: Record<string, string>;
  /** True for retrograde ORBITS (Triton). Venus's retrograde is SPIN and
   *  deliberately does NOT set this — spin is parented-compose territory. */
  retrogradeOrbit?: boolean;
}


/** Section 03 catalog — verbatim. */
const RAW: RawCatalogEntry[] = [
  {
    id: 'sun', name: 'Sun', type: 'star',
    radiusGame: 20000, distanceFromSun: 0, surfaceGravity: 0,
    gravityRange: 0, portalDist: 80000, atmosphereHeight: 3000,
    facts: { mass: '1.989e30 kg', temp: '5,778 K' },
  },
  {
    id: 'mercury', name: 'Mercury', type: 'planet',
    radiusGame: 3105.7, distanceFromSun: 376200, surfaceGravity: 3.7,
    gravityRange: 18634.2, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '3.301e23 kg', temp: '430 C' },
  },
  {
    id: 'venus', name: 'Venus', type: 'planet',
    radiusGame: 4870.3, distanceFromSun: 512400, surfaceGravity: 8.87,
    gravityRange: 29221.8, portalDist: 80000, atmosphereHeight: 6000,
    // facts.rotation 'Retrograde' = SPIN, not orbit — no effect on rails.
    facts: { mass: '4.867e24 kg', temp: '471 C', rotation: 'Retrograde' },
  },
  {
    id: 'earth', name: 'Earth', type: 'planet',
    radiusGame: 5000, distanceFromSun: 600000, surfaceGravity: 9.81,
    gravityRange: 50505, portalDist: 80000, atmosphereHeight: 8000,
    facts: { mass: '5.972e24 kg', temp: '15 C' },
  },
  {
    id: 'moon', name: 'Moon', type: 'moon', parentId: 'earth',
    radiusGame: 1364.5, orbitRadiusGame: 38850, surfaceGravity: 1.62,
    gravityRange: 8187, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '7.342e22 kg', temp: '-53 C' },
  },
  {
    id: 'mars', name: 'Mars', type: 'planet',
    radiusGame: 2649.3, distanceFromSun: 741600, surfaceGravity: 3.71,
    gravityRange: 15895.8, portalDist: 80000, atmosphereHeight: 2000,
    facts: { mass: '6.39e23 kg', temp: '-65 C' },
  },
  {
    id: 'phobos', name: 'Phobos', type: 'moon', parentId: 'mars',
    radiusGame: 200.5, orbitRadiusGame: 6020, surfaceGravity: 0.0057,
    gravityRange: 1203, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '1.06e16 kg' },
  },
  {
    id: 'jupiter', name: 'Jupiter', type: 'gas_giant',
    radiusGame: 16640.2, distanceFromSun: 1368600, surfaceGravity: 24.79,
    gravityRange: 99841.2, portalDist: 149761.8, atmosphereHeight: 12000,
    facts: { mass: '1.898e27 kg', temp: '-110 C' },
  },
  {
    id: 'io', name: 'Io', type: 'moon', parentId: 'jupiter',
    radiusGame: 2577.8, orbitRadiusGame: 41200, surfaceGravity: 1.796,
    gravityRange: 15466.8, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '8.93e22 kg' },
  },
  {
    id: 'saturn', name: 'Saturn', type: 'gas_giant',
    radiusGame: 15120.4, distanceFromSun: 1860000, surfaceGravity: 10.44,
    gravityRange: 90722.4, portalDist: 136083.6, atmosphereHeight: 15000,
    facts: { mass: '5.683e26 kg', temp: '-140 C' },
  },
  {
    id: 'titan', name: 'Titan', type: 'moon', parentId: 'saturn',
    radiusGame: 3192.5, orbitRadiusGame: 69400, surfaceGravity: 1.35,
    gravityRange: 19155, portalDist: 80000, atmosphereHeight: 2000,
    facts: { mass: '1.345e23 kg' },
  },
  {
    id: 'uranus', name: 'Uranus', type: 'gas_giant',
    radiusGame: 9980.5, distanceFromSun: 2634000, surfaceGravity: 8.69,
    gravityRange: 59883, portalDist: 89824.5, atmosphereHeight: 8000,
    facts: { mass: '8.681e25 kg', temp: '-195 C' },
  },
  {
    id: 'titania', name: 'Titania', type: 'moon', parentId: 'uranus',
    radiusGame: 2182.2, orbitRadiusGame: 41500, surfaceGravity: 0.379,
    gravityRange: 13093.2, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '3.5e21 kg' },
  },
  {
    id: 'neptune', name: 'Neptune', type: 'gas_giant',
    radiusGame: 9835.4, distanceFromSun: 3290000, surfaceGravity: 11.15,
    gravityRange: 59012.4, portalDist: 88518.6, atmosphereHeight: 8000,
    facts: { mass: '1.024e26 kg', temp: '-200 C' },
  },
  {
    id: 'triton', name: 'Triton', type: 'moon', parentId: 'neptune',
    radiusGame: 2400.1, orbitRadiusGame: 37600, surfaceGravity: 0.717,
    gravityRange: 14400.6, portalDist: 80000, atmosphereHeight: 100,
    facts: { mass: '2.14e22 kg', orbit: 'Retrograde' },
    retrogradeOrbit: true, // catalog fact: retrograde ORBIT -> n < 0
  },
  {
    id: 'pluto', name: 'Pluto', type: 'planet',
    radiusGame: 2160.8, distanceFromSun: 3770000, surfaceGravity: 0.62,
    gravityRange: 12964.8, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '1.303e22 kg', temp: '-225 C' },
  },
  {
    id: 'charon', name: 'Charon', type: 'moon', parentId: 'pluto',
    radiusGame: 1690.4, orbitRadiusGame: 9100, surfaceGravity: 0.288,
    gravityRange: 10142.4, portalDist: 80000, atmosphereHeight: 0,
    facts: { mass: '1.586e21 kg' },
  },
];


/** Host μ for an orbiting body: parent planet μ, or the Sun's orbital μ. */
function hostMuFor(raw: RawCatalogEntry): number {
  if (raw.parentId === undefined) {
    return SUN_ORBITAL_MU;
  }
  const parent = RAW.find((r) => r.id === raw.parentId);
  if (parent === undefined) {
    throw new Error(`[celestialData] unknown parent '${raw.parentId}'`);
  }
  return parent.surfaceGravity * parent.radiusGame * parent.radiusGame;
}


/**
 * Fully derived celestial configs, in catalog (hierarchical) order.
 * KeplerRail's constructor topologically verifies this ordering.
 */
const BASE_CONFIGS = RAW.map((raw, index) => {
  // Spec 02.3: μ = g_real · R_game². (Real mass is NEVER used — facts only.)
  const mu = raw.surfaceGravity * raw.radiusGame * raw.radiusGame;


  const a =
    raw.orbitRadiusGame !== undefined
      ? raw.orbitRadiusGame
      : raw.distanceFromSun !== undefined
        ? raw.distanceFromSun
        : 0;


  let orbit: OrbitParams | null = null;
  if (raw.type !== 'star' && a > 0) {
    const muHost = hostMuFor(raw);
    const T = computeOrbitalPeriod(a, muHost); // T = 2π·√(a³/μ_host)
    const nMag = meanMotion(muHost, a);        // |n| = √(μ/a³)
    orbit = {
      a,
      e: 0,        // catalog supplies a single distance -> circular canon
      i: 0,
      Omega: 0,
      omega: 0,
      M0: (index * GOLDEN_ANGLE) % TWO_PI,
      T,
      n: raw.retrogradeOrbit === true ? -nMag : nMag,
      muHost,
      retrograde: raw.retrogradeOrbit === true,
    };
  }


  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    parentId: raw.parentId ?? null,
    radiusGame: raw.radiusGame,
    surfaceGravity: raw.surfaceGravity,
    gravityRange: raw.gravityRange,
    portalDist: raw.portalDist,
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
