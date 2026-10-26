/**
 * SPIN LAW — game spin period, spin axis and prime meridian for every catalog body (F3abba, ADR-013).
 *
 * WHY: A1-U12-1 found that no body rotates; the catalog had no spin, pole or prime meridian.
 * This module derives them from REAL_BODY_DATA (ADR-011). It is DATA ONLY: nothing in the tick
 * reads `CelestialConfig.spin` until the frame tree lands (F3b), so engine behaviour is unchanged.
 *
 * TIME LAW (one rule): the game keeps every body's REAL ratio of spin period to orbit period.
 *   spinGame = T_orbitGame · (spinReal / T_orbitReal)
 * The orbit periods themselves stay what the rail derives from the game μ and a (F3abbb re-chooses
 * them), so the game has no single global time scale yet; the ratio law is what keeps the sky in
 * the real order (Lead ruling 2026-10-22: a day much shorter than a year).
 * Two exceptions, both real physics, so they are exact rather than ratio-approximate:
 *  - LOCK: a body whose real spin is within LOCK_TOLERANCE of a real orbit period is tidally
 *    locked to it, and its game spin period EQUALS that game orbit period (its own orbit: the
 *    Moon, Phobos, Io, Titan, Titania, Triton, Charon; a moon's orbit: Pluto–Charon). A ratio
 *    of 1.0008 would turn the Moon's face 0.3° per orbit, and it would drift away from Earth.
 *  - SUN: no orbit, so it uses Earth's ratio (spinGame = T_earthGame · spinReal / T_earthReal).
 * Known approximation: moon systems have their own game time scale (A1-U10), so e.g. Phobos
 * orbits slower than Mars spins in the game (real: faster). F3abbb re-chooses orbit times.
 *
 * AXIS: IAU pole (RA, Dec, ICRF) → J2000 ecliptic (rotate by the obliquity ε about x) → world
 * (KeplerRail's map: world = (x_e, z_e, −y_e), Y = ecliptic north). The stored axis is the
 * right-hand rotation axis: the IAU pole flipped when Ẇ < 0 (Venus, Uranus, Titania, Triton).
 * W0 is the IAU prime-meridian angle at J2000, measured about that axis (sign follows the flip).
 */
import { REAL_BODY_DATA, realSiderealSpinSeconds } from './realBodyData';
import type { SpinParams } from './types';

const DEG = Math.PI / 180;

/** J2000 mean obliquity of the ecliptic, deg (IAU 1976; Explanatory Supplement 3rd ed.). */
export const OBLIQUITY_J2000_DEG = 23.4392911;
/** Sun GM, km³/s² (NAIF `gm_de440.tpc`, BODY10_GM). Planet orbit periods: Kepler-3 on aKm. */
export const GM_SUN_KM3S2 = 1.32712440041279e11;
/** Moon sidereal orbit periods, days (JPL SSD "Planetary Satellite Mean Elements", sep.html). */
export const MOON_SIDEREAL_DAYS: Readonly<Record<string, number>> = {
  moon: 27.322, phobos: 0.319, io: 1.769, titan: 15.945, titania: 8.706, triton: 5.877, charon: 6.387,
};
/** |spinReal / T_orbitReal − 1| below this = tidally locked (real locks are ≤ 0.1 %; Venus is 8 %). */
export const LOCK_TOLERANCE = 0.01;

/** Real sidereal orbit period of a body, seconds; null for the Sun. */
export function realOrbitSeconds(id: string): number | null {
  const o = REAL_BODY_DATA[id].orbit;
  if (o === null) return null;
  const moonDays = MOON_SIDEREAL_DAYS[id];
  if (moonDays !== undefined) return moonDays * 86400;
  return 2 * Math.PI * Math.sqrt((o.aKm * o.aKm * o.aKm) / GM_SUN_KM3S2);
}

/** IAU pole (deg, ICRF) → unit vector in the world frame. Boot-only (allocates). */
export function poleToWorld(raDeg: number, decDeg: number): { x: number; y: number; z: number } {
  const ra = raDeg * DEG, dec = decDeg * DEG, eps = OBLIQUITY_J2000_DEG * DEG;
  const xq = Math.cos(dec) * Math.cos(ra), yq = Math.cos(dec) * Math.sin(ra), zq = Math.sin(dec);
  const ce = Math.cos(eps), se = Math.sin(eps);
  const xe = xq, ye = yq * ce + zq * se, ze = -yq * se + zq * ce;
  return { x: xe, y: ze, z: -ye };
}

export interface SpinInput {
  id: string;
  parentId: string | null;
  /** Game orbit period, s (null for the Sun). */
  T: number | null;
}

function ratioOff(a: number, b: number): number { return Math.abs(a / b - 1); }

/** Derive SpinParams for every body (boot-only). Throws if a body is missing real data. */
export function deriveSpins(bodies: readonly SpinInput[]): Record<string, SpinParams> {
  const byId = new Map(bodies.map((b) => [b.id, b]));
  const out: Record<string, SpinParams> = {};
  for (const b of bodies) {
    const real = REAL_BODY_DATA[b.id];
    if (real === undefined) throw new Error(`[spinLaw] no real data for '${b.id}'`);
    const spinReal = realSiderealSpinSeconds(b.id);
    const orbitReal = realOrbitSeconds(b.id);
    let period: number;
    let lockedTo: string | null = null;
    const lockChild = bodies.find((c) => c.parentId === b.id && c.T !== null
      && ratioOff(spinReal, realOrbitSeconds(c.id) as number) < LOCK_TOLERANCE);
    if (orbitReal !== null && b.T !== null && ratioOff(spinReal, orbitReal) < LOCK_TOLERANCE) {
      period = b.T; lockedTo = b.id;                       // synchronous with its own orbit
    } else if (lockChild !== undefined) {
      period = lockChild.T as number; lockedTo = lockChild.id; // mutual lock (Pluto–Charon)
    } else if (orbitReal !== null && b.T !== null) {
      period = b.T * (spinReal / orbitReal);
    } else {
      const earth = byId.get('earth');
      if (earth === undefined || earth.T === null) throw new Error('[spinLaw] Sun needs Earth');
      period = earth.T * (spinReal / (realOrbitSeconds('earth') as number));
    }
    const sgn = real.orientation.pmRate < 0 ? -1 : 1;
    const p = poleToWorld(real.orientation.poleRA, real.orientation.poleDec);
    const axis = { x: sgn * p.x, y: sgn * p.y, z: sgn * p.z };
    out[b.id] = { period, axis, W0: sgn * real.orientation.pmW0 * DEG, retrograde: axis.y < 0, lockedTo };
  }
  return out;
}

