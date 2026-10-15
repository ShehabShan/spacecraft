/**
 * ============================================================================
 *  ATMOSPHERE — BAROMETRIC MODEL, SOUND SPEED, MACH, DYNAMIC PRESSURE
 *  Milestone 1D · Spec 02.4 (density law), 02.2 catalog (atmosphereHeight)
 * ============================================================================
 *  Pure core: no renderer/physics library imports. All Float64.
 *
 *  DENSITY (Math is Law — Spec 02.4):
 *      rho(alt) = rho0 * exp( -max(alt, 0) / H_scale )
 *  C∞-smooth, strictly monotone, decaying to vacuum asymptotically
 *  (rho(24 km) = 2.5e-9 kg/m^3). The catalog atmosphereHeight (8,000 m for
 *  Earth-scale) is a MODE boundary (exo-atmospheric flag / boost rules /
 *  fog), NOT a density cutoff — no discontinuity exists anywhere.
 *
 *  THERMODYNAMICS (sound speed only — the density law is isothermal by
 *  spec; a 6.5 K/km lapse feeding a(h) = sqrt(gamma·Rs·T) changes a(8 km)
 *  from 340 -> 308 m/s and differs from the exact non-isothermal density
 *  by < 2%, which the spec's exponential absorbs by design).
 *
 *  TRANSPORT WIND (Spec 02.4): v_rel is relative to the ROTATING atmosphere:
 *      v_atm = Ω × p     (planet spin about +Y; M1D harness uses Ω = 0 so
 *                         the M1C terrain mesh stays static; the math is
 *                         unit-verified against the spec's 52 m/s equator.)
 */


export interface AtmosphereProfile {
  name: string;
  /** Surface density, kg/m^3. */
  rho0: number;
  /** Scale height H_s, m. */
  scaleHeight: number;
  /** Catalog atmosphere height, m (mode boundary; density law extends past). */
  atmosphereHeight: number;
  /** Ratio of specific heats / specific gas constant (sound speed). */
  gamma: number;
  rSpecific: number;
  /** Thermodynamic model for a(h). */
  tempSeaLevel: number;
  lapseRate: number;   // K per m
  tempFloor: number;   // stratosphere floor, K
}


/** Earth-scale test atmosphere (R = 5,000 m planet, Spec 02.1/02.4). */
export const EARTHSCALE_ATMOSPHERE: AtmosphereProfile = {
  name: 'Earth-scale (M1D)',
  rho0: 1.225,
  scaleHeight: 1200,
  atmosphereHeight: 8000,
  gamma: 1.4,
  rSpecific: 287.05,
  tempSeaLevel: 288.15,
  lapseRate: 0.0065,
  tempFloor: 210.0,
};


/** Spec 02.4 density law. Zero allocation. */
export function densityAt(p: AtmosphereProfile, alt: number): number {
  if (alt <= 0) return p.rho0;
  return p.rho0 * Math.exp(-alt / p.scaleHeight);
}


/** Static temperature with lapse + floor, K. */
export function temperatureAt(p: AtmosphereProfile, alt: number): number {
  const t = p.tempSeaLevel - p.lapseRate * (alt > 0 ? alt : 0);
  return t < p.tempFloor ? p.tempFloor : t;
}


/** Speed of sound a(h) = sqrt(gamma · Rs · T), m/s. */
export function speedOfSoundAt(p: AtmosphereProfile, alt: number): number {
  return Math.sqrt(p.gamma * p.rSpecific * temperatureAt(p, alt));
}


/** Mach number of the AIR-relative speed. */
export function machNumber(p: AtmosphereProfile, alt: number, speedRel: number): number {
  return speedRel / speedOfSoundAt(p, alt);
}


/** Dynamic pressure q = ½·rho·v_rel², Pa. */
export function dynamicPressure(p: AtmosphereProfile, alt: number, speedRel: number): number {
  return 0.5 * densityAt(p, alt) * speedRel * speedRel;
}


/** Barometric pressure P = rho·Rs·T, Pa (HUD instrument). */
export function pressureAt(p: AtmosphereProfile, alt: number): number {
  return densityAt(p, alt) * p.rSpecific * temperatureAt(p, alt);
}


/** Mode boundary: above the catalog atmosphere height. */
export function isExoatmospheric(p: AtmosphereProfile, alt: number): boolean {
  return alt >= p.atmosphereHeight;
}


export interface Vec3Out { x: number; y: number; z: number; }


/**
 * Rotating-atmosphere transport velocity: v_atm = Ω × p with Ω = (0, Ω, 0).
 *      v_atm = ( Ω·p.z, 0, −Ω·p.x )
 * Equator check (spec example): Ω = 0.0104 rad/s, p = (5000,0,0)
 *      => |v_atm| = 52 m/s exactly.
 * Zero allocation.
 */
export function atmosphereVelocityInto(
  spinRadPerSec: number, px: number, py: number, pz: number, out: Vec3Out,
): Vec3Out {
  out.x = spinRadPerSec * pz;
  out.y = 0;
  out.z = -spinRadPerSec * px;
  return out;
}
