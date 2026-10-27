/**
 * ADR-015 catalog scale laws (F3abbbbba): ONE radius law, ONE distance law and ONE time
 * scale, applied to the sourced real data (`realBodyData.ts`, `spinLaw.ts`), plus the
 * quantities derived from them (orbital μ of the host, gravityRange, portalDist).
 * Boot-only (allocates). Pure core: no three/react imports.
 * Not yet consumed by `celestialData.ts` — wiring is F3abbbbbb (STATE.md NEXT ACTION).
 */
import { REAL_BODY_DATA } from './realBodyData';
import { realOrbitSeconds } from './spinLaw';

// WHY: the anchors are Lead ledger rulings (2026-10-22: keep the small play Moon, keep the big
// Earth in the Moon sky, realistic day/year order), not fits — ADR-015.
export const MOON_RADIUS_GAME_M = 1364.5;
export const EARTH_ORBIT_GAME_M = 600000;
export const EARTH_ANGLE_FROM_MOON_RAD = 2 * Math.atan(5000 / 38850);
// WHY: saturating radius law — linear radius puts Io inside the big-Earth-scaled Jupiter (ADR-015).
export const RADIUS_SATURATION_KM = 20000;
/** One time scale for every orbit and spin: T_game = T_real / TIME_SCALE. */
export const TIME_SCALE = 360;
export const MIN_PORTAL_DIST_M = 80000;

function realRadiusKm(id: string): number {
  const b = REAL_BODY_DATA[id];
  if (b === undefined) throw new Error(`[scaleLaw] no real data for '${id}'`);
  return b.radiusKm;
}
function realAKm(id: string): number {
  const o = REAL_BODY_DATA[id]?.orbit;
  if (o === undefined || o === null) throw new Error(`[scaleLaw] no real orbit for '${id}'`);
  return o.aKm;
}

const R_MOON_KM = realRadiusKm('moon');
/** k in R_game = k·R/(1 + R/R_c), chosen so the Moon keeps 1,364.5 m. */
export const RADIUS_K_M_PER_KM = (MOON_RADIUS_GAME_M * (1 + R_MOON_KM / RADIUS_SATURATION_KM)) / R_MOON_KM;

export function radiusGameFromKm(rKm: number): number {
  return (RADIUS_K_M_PER_KM * rKm) / (1 + rKm / RADIUS_SATURATION_KM);
}

const A_EARTH_KM = realAKm('earth');
const MOON_ORBIT_GAME_M = radiusGameFromKm(realRadiusKm('earth')) / Math.tan(EARTH_ANGLE_FROM_MOON_RAD / 2);
/** q in a_game = 600,000·(a/a_Earth)^q, chosen so Earth spans 14.7° in the Moon sky (≈0.491234). */
export const DISTANCE_EXPONENT = Math.log(MOON_ORBIT_GAME_M / EARTH_ORBIT_GAME_M) / Math.log(realAKm('moon') / A_EARTH_KM);

/** Same law for heliocentric planets and planet-centred moons (one distance law). */
export function distanceGameFromKm(aKm: number): number {
  return EARTH_ORBIT_GAME_M * Math.pow(aKm / A_EARTH_KM, DISTANCE_EXPONENT);
}

export function periodGameSeconds(id: string): number | null {
  const t = realOrbitSeconds(id);
  return t === null ? null : t / TIME_SCALE;
}

// WHY: with a and T both set by laws, the host μ that makes the rail move at the law rate is
// derived (Kepler III, 4π²a³/T²) — no longer g·R² of the parent (ADR-015 consequence).
export function hostMuFromOrbit(a: number, T: number): number {
  return (4 * Math.PI * Math.PI * a * a * a) / (T * T);
}

/** Documented catalog rule: max(6·R, 1.3·a of the farthest moon); recon session 120 matched all 16 rows. */
export function gravityRangeFor(radiusGame: number, farthestMoonA: number): number {
  return Math.max(6 * radiusGame, 1.3 * farthestMoonA);
}
export function portalDistFor(gravityRange: number): number {
  return Math.max(MIN_PORTAL_DIST_M, 1.5 * gravityRange);
}

export interface ScaledBody {
  id: string;
  radiusGame: number;
  /** Game semi-major axis around the parent (or the Sun), m; 0 for the Sun. */
  a: number;
  /** Game orbit period, s; null for the Sun. */
  T: number | null;
  muHost: number | null;
  gravityRange: number;
  portalDist: number;
}

export interface ScaleInput {
  id: string;
  parentId: string | null;
  type: string;
}

/** Applies the laws to a catalog body list (ids, parents, types). Boot-only. */
export function deriveScaledBodies(bodies: readonly ScaleInput[]): Record<string, ScaledBody> {
  const out: Record<string, ScaledBody> = {};
  for (const b of bodies) {
    const star = b.type === 'star';
    const a = star ? 0 : distanceGameFromKm(realAKm(b.id));
    const T = star ? null : periodGameSeconds(b.id);
    out[b.id] = {
      id: b.id, radiusGame: radiusGameFromKm(realRadiusKm(b.id)), a, T,
      muHost: T === null ? null : hostMuFromOrbit(a, T), gravityRange: 0, portalDist: MIN_PORTAL_DIST_M,
    };
  }
  for (const b of bodies) {
    const s = out[b.id];
    if (b.type === 'star') continue; // the Sun keeps gravityRange 0 (catalog convention)
    let far = 0;
    for (const m of bodies) if (m.parentId === b.id) far = Math.max(far, out[m.id].a);
    s.gravityRange = gravityRangeFor(s.radiusGame, far);
    s.portalDist = portalDistFor(s.gravityRange);
  }
  return out;
}