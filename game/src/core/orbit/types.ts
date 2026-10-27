/**
 * ============================================================================
 *  ORBITAL TYPES — PURE FLOAT64 CELESTIAL DOMAIN
 *  Milestone 1B · Spec 00.2 (two-tier time), 01.1 (macro update), 02.2/02.3
 * ============================================================================
 *  HARD BOUNDARY: no imports from three / react / rapier anywhere in
 *  src/core/. All orbital quantities are 64-bit doubles (TypeScript number).
 *
 *  CONVENTIONS:
 *   - World frame: Sun frame, Y-up ("ecliptic" = XZ plane, north = +Y).
 *   - Angles in radians. Prograde motion is counter-clockwise seen from +Y.
 *   - Retrograde orbits are encoded as a NEGATIVE mean motion n (exactly
 *     equivalent to inclination 180°, cheaper to evaluate).
 */


/** Verbatim Section 03 body classifications. */
export type BodyType = 'star' | 'planet' | 'gas_giant' | 'moon';


/**
 * Keplerian orbital elements (deliverable struct) plus boot-derived
 * kinematic constants. `a, e, i, Omega, omega, M0, T` are the classical
 * elements; `n`, `muHost` are precomputed for zero-allocation evaluation.
 *
 * Catalog orbits carry the real e, i, Omega, omega, M0 (F3abbbbbc, ADR-016; derived by
 * `orbitElements.ts` from REAL_BODY_DATA). `n` is always positive: retrograde motion is i > 90 deg.
 * (Real-date starting arrangements remain out of scope per Spec 00.4.)
 */
export interface OrbitParams {
  /** Semi-major axis, metres. */
  a: number;
  /** Eccentricity, dimensionless, [0, 1). */
  e: number;
  /** Inclination, radians. */
  i: number;
  /** Longitude of the ascending node Ω, radians. */
  Omega: number;
  /** Argument of periapsis ω, radians. */
  omega: number;
  /** Mean anomaly at epoch M0, radians. (Deterministic spread; real epoch
   *  arrangement is a deferred feature per Spec 00.4.) */
  M0: number;
  /** Orbital period, seconds — T = 2π·√(a³/μ_host) (Kepler's Third Law). */
  T: number;
  /** Mean motion, rad/s — n = √(μ_host/a³) > 0 (retrograde = i > 90°, ADR-016). */
  n: number;
  /** Host gravitational parameter, m³/s² (parent planet μ, or SUN_ORBITAL_MU). */
  muHost: number;
  /** True when the orbit is retrograde (e.g. Triton per Section 03 facts). */
  retrograde: boolean;
}


/** Static definition of one celestial body — catalog data + derived orbit. */
/** Spin of a body (F3abba, ADR-013; derived by `spinLaw.ts`; read by the frame tree from F3b). */
export interface SpinParams {
  /** Sidereal spin period, game seconds (> 0). */
  period: number;
  /** Unit right-hand spin axis in the world frame. */
  axis: { x: number; y: number; z: number };
  /** IAU prime-meridian angle at J2000 about `axis`, rad. */
  W0: number;
  /** Axis points below the ecliptic (axis.y < 0): retrograde spin. */
  retrograde: boolean;
  /** Body whose orbit period this spin equals (tidal / mutual lock), else null. */
  lockedTo: string | null;
}

export interface CelestialConfig {
  id: string;
  name: string;
  type: BodyType;
  /** Parent body id (null for the Sun). Parents always precede children. */
  parentId: string | null;
  /** True game radius, metres (Spec 02.1 — 1 unit = 1 m). */
  radiusGame: number;
  /** Real surface gravity, m/s². Gameplay μ = surfaceGravity · radiusGame². */
  surfaceGravity: number;
  /** Sphere of influence, metres (Spec 02.2 formula 4). */
  gravityRange: number;
  /** Portal distance, metres (Spec 02.5). Unused by rails; carried as canon. */
  portalDist: number;
  atmosphereHeight: number;
  /** μ = g_real · R_game² (Spec 02.3). ZERO for the Sun (gameplay gravity
   *  only — the Sun exerts no gameplay gravity; orbital μ is separate). */
  mu: number;
  /** HUD fun facts (Spec 02.3: real mass is NEVER used for gravity). */
  facts: Record<string, string>;
  /** Null for the Sun (fixed at the origin). */
  orbit: OrbitParams | null;
  spin: SpinParams;
}


/**
 * Runtime celestial state. Allocated ONCE at boot (Zero-GC mandate) and
 * mutated in place by KeplerRail.evaluate(). Consumers treat as read-only.
 */
export interface CelestialState {
  config: CelestialConfig;
  /** Index into the rail's topologically ordered state array; −1 = root. */
  parentIndex: number;
  /** Absolute Sun-frame position, Float64. Rail-written every evaluation. */
  absPos: { x: number; y: number; z: number };
  /**
   * LOCAL Float32 render coordinates relative to the floating origin,
   * extracted at canonical step 8 (AFTER any rebase in step 4) by
   * SimulationCore: localPosF32[i] = Float32(absPos[i] − origin[i]).
   */
  localPosF32: Float32Array;
  /** Orbital speed via vis-viva: √(μ(2/r − 1/a)), m/s. Zero for the Sun. */
  orbitalSpeed: number;
  /** Perifocal basis, world frame (boot-precomputed from i, Ω, ω). */
  basisP: { x: number; y: number; z: number };
  basisQ: { x: number; y: number; z: number };
  /** Semi-minor axis b = a·√(1−e²), boot-precomputed. */
  semiMinor: number;
}
