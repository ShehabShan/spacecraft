/**
 * ============================================================================
 *  AERODYNAMICS — DRAG GOVERNOR, LIFT, STABILITY DAMPING (FLOAT64)
 *  Milestone 1D · Spec 01.3 (governor), 02.4 (exponential drag map)
 * ============================================================================
 *  Pure core. Zero allocation in every function.
 *
 *  THE GOVERNOR (Spec 01.3): the structural restriction curve
 *      v_safe(alt) = sqrt( a_struct / (betaQ · rho(alt)) )
 *  is the speed at which quadratic drag deceleration equals the airframe
 *  limit a_struct. Entering the atmosphere faster than the local v_safe,
 *  the exact exponential drag map mathematically forces the ship down onto
 *  the curve — no clamping, no discontinuity, no overshoot (see the map's
 *  A-stability proof in the M1D analysis).
 *
 *  DERIVED CONSTANT (flagged for Lead review — see M1D analysis §1.5):
 *  betaQ = 3.2e-3 m²/kg is not free: it is derived from the M1D acceptance
 *  gate (2,000 m/s entry, <= 400 m/s at 1,000 m altitude) via the vertical-
 *  dive integral  ln(v2/v1) = −betaQ·rho0·H·(e^(−h2/H) − e^(−h1/H)), which
 *  demands betaQ >= 2.52e-3 before gravity; 3.2e-3 carries 27% margin.
 *  Physical equivalence: betaQ = C_d·A / (2m) ≈ 0.35 · 22 m² / 2400 kg.
 */


export interface AeroParams {
  name: string;
  /** Ship mass, kg (lift/force conversions; the drag map is acceleration-based). */
  mass: number;
  /** Quadratic drag coefficient betaQ = C_d·A/(2m), m²/kg. DERIVED (see header). */
  betaQ: number;
  /** Linear (laminar) drag coefficient, Spec 02.4 k-form. */
  betaL: number;
  /** Structural deceleration limit for the v_safe curve, m/s². */
  aStruct: number;
  /** Wing area, m². */
  wingArea: number;
  /** Lift-curve slope, per rad. */
  clAlpha: number;
  /** Stall onset angle, rad. */
  alphaCrit: number;
  /** C¹ stall rolloff softness, rad. */
  stallSoftness: number;
  /** Attitude-loop damping: c = base + qScale·min(q/qRef, qClamp). */
  baseDamping: number;
  qDamping: number;
  qRef: number;      // Pa
  qClamp: number;
}


/** M1D test ship. */
export const SHIP_AERO: AeroParams = {
  name: 'M1D test ship',
  mass: 1200,
  betaQ: 3.2e-3,
  betaL: 0.012,
  aStruct: 90,
  wingArea: 14,
  clAlpha: 2.2,
  alphaCrit: 0.30,
  stallSoftness: 0.12,
  baseDamping: 3.0,
  qDamping: 10.0,
  qRef: 20000,
  qClamp: 4,
};


/** Governor curve v_safe(alt) = sqrt(a_struct / (betaQ·rho)). Infinity in vacuum. */
export function safeSpeedAt(aero: AeroParams, rho: number): number {
  if (rho <= 0) return Number.POSITIVE_INFINITY;
  return Math.sqrt(aero.aStruct / (aero.betaQ * rho));
}


/**
 * Spec 02.4 k-form:  k = betaQ·rho·|v_rel| + betaL·rho   [1/s]
 */
export function dragK(aero: AeroParams, rho: number, speedRel: number): number {
  return aero.betaQ * rho * speedRel + aero.betaL * rho;
}


/**
 * THE EXACT EXPONENTIAL MAP (Spec 02.4): v_rel_new = v_rel · exp(−k·dt).
 * A-stable, sign-preserving, monotone for ALL k, dt > 0 — velocity can
 * never overshoot, bounce, or reverse. For frozen k this is the exact flow;
 * for the quadratic term it decays at least as fast as the continuum
 * (e^(−x) <= 1/(1+x)) — always on the safe side.
 */
export function exponentialDragFactor(
  aero: AeroParams, rho: number, speedRel: number, dt: number,
): number {
  return Math.exp(-dragK(aero, rho, speedRel) * dt);
}


/** Instantaneous drag deceleration magnitude = k·|v| = betaQ·rho·v² + betaL·rho·v. */
export function dragDecel(aero: AeroParams, rho: number, speedRel: number): number {
  return dragK(aero, rho, speedRel) * speedRel;
}


/**
 * Lift coefficient with C¹ stall: linear C_lα·α below alphaCrit, smooth
 * 1/(1+((|α|−αc)/s)²) rolloff above (never negative, never discontinuous).
 */
export function liftCoefficient(aero: AeroParams, alpha: number): number {
  const a = alpha < 0 ? -alpha : alpha;
  let cl = aero.clAlpha * alpha;
  if (a > aero.alphaCrit) {
    const t = (a - aero.alphaCrit) / aero.stallSoftness;
    cl *= 1 / (1 + t * t);
  }
  return cl;
}


/** Lift acceleration magnitude: ½·rho·v²·C_l·S / m, m/s². */
export function liftAccel(
  aero: AeroParams, rho: number, speedRel: number, cl: number,
): number {
  return 0.5 * rho * speedRel * speedRel * cl * aero.wingArea / aero.mass;
}


/**
 * Attitude-loop damping. Grows with dynamic pressure: at high q the control
 * surfaces bite AND aerodynamic damping rises — response gets faster and
 * more damped simultaneously (see M1D analysis §1.3). Feeds the exact
 * exponential tracker in FlightController — no oscillatory mode exists.
 */
export function controlDamping(aero: AeroParams, qDyn: number): number {
  const s = qDyn / aero.qRef;
  return aero.baseDamping + aero.qDamping * (s < aero.qClamp ? s : aero.qClamp);
}
