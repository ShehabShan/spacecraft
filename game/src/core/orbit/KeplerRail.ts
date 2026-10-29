/**
 * ============================================================================
 *  KEPLER RAIL — CLOSED-FORM ORBITAL EVALUATION (PURE FLOAT64, ZERO-GC)
 *  Milestone 1B · Spec 00.2 (macro rails), 01.1 step 1, 02.6 (time scales)
 * ============================================================================
 *  P = F(elements; simTime) is a pure closed-form function:
 *   - O(1) cost at ANY t (t = 0, t = +60 days, t = −10 years) — which is why
 *     30x (or 1000x) macro time costs exactly one evaluation per tick.
 *   - Positions lie exactly on the orbit by construction: zero energy drift,
 *     no integrator, no accumulation.
 *   - Deterministic bit-for-bit: same simTime double -> same position bits.
 *     This is the foundation of the 1B reversibility acceptance proof.
 *
 *  ZERO-GC AUDIT of evaluate(): scalar arithmetic, field writes into
 *  boot-allocated state objects, indexed for-loops over a dense array.
 *  The only "scratch" needed is two stack scalars (px, py) — the perifocal
 *  basis, semi-minor axis, and parent links are all boot-precomputed.
 *  Allocation count per evaluation: 0.
 */


import type { CelestialConfig, CelestialState } from './types';
import { Vec3d } from '../physics/sphericalFrame';


export const TWO_PI = Math.PI * 2;


/**
 * Reduce an angle to (−π, π]. Deterministic (pure IEEE arithmetic) — the
 * rail and any independent reference that uses the identical expression
 * produce bit-identical results. Angles reach ~3.7e3 rad after a 60-day
 * jump; reducing before sin/cos keeps trig arguments well-conditioned.
 */
export function wrapAngle(M: number): number {
  return M - TWO_PI * Math.round(M / TWO_PI);
}


/**
 * Solve Kepler's equation  M = E − e·sin(E)  for the eccentric anomaly E.
 * Newton–Raphson with the classical two-branch starter. Deterministic
 * iterate sequence for identical (M, e) — a hard requirement for the
 * reversibility proof (same input -> same output bits).
 *
 * Domain: elliptical orbits, e ∈ [0, ~0.95], M pre-wrapped to (−π, π].
 * Exit: |ΔE| < 1e-15 (double-precision floor for these magnitudes) or 24
 * iterations (boot-domain verification asserts residual ≤ 1e-12 rad).
 */
export function solveKeplerE(M: number, e: number): number {
  let E = e < 0.8 ? M + e * Math.sin(M) : (M >= 0 ? Math.PI : -Math.PI);
  for (let k = 0; k < 24; k++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const dE = f / fp;
    E -= dE;
    if (dE < 1e-15 && dE > -1e-15) {
      break;
    }
  }
  return E;
}


/** Kepler's Third Law: T = 2π·√(a³/μ) — the mandated period derivation. */
export function computeOrbitalPeriod(a: number, mu: number): number {
  return TWO_PI * Math.sqrt((a * a * a) / mu);
}


/**
 * Mean motion magnitude: |n| = √(μ/a³). Algebraically identical to 2π/T
 * (and computed without the double rounding of the 2π round-trip).
 * The caller applies the retrograde sign.
 */
export function meanMotion(mu: number, a: number): number {
  return Math.sqrt(mu / (a * a * a));
}


/**
 * Boot validation of one orbit's elements (F3aba, A1-U12-2).
 * WHY: the elliptic solver and semiMinor = a·√(1−e²) are only defined for
 * 0 ≤ e < 1 and a > 0; before F3aba an e ≥ 1 / a ≤ 0 / NaN element produced
 * a NaN state silently every tick. Reject at boot with the body id instead.
 * Boot path only (throws, allocates the message) — never called per tick.
 */
export function validateOrbit(id: string, o: CelestialConfig['orbit'] & object): void {
  const fields: readonly (readonly [string, number])[] = [
    ['a', o.a], ['e', o.e], ['i', o.i], ['Omega', o.Omega], ['omega', o.omega],
    ['M0', o.M0], ['T', o.T], ['n', o.n], ['muHost', o.muHost],
  ];
  for (let k = 0; k < fields.length; k++) {
    if (!Number.isFinite(fields[k][1])) {
      throw new Error(`[KeplerRail] body '${id}': orbit.${fields[k][0]} is not finite (${fields[k][1]})`);
    }
  }
  if (!(o.a > 0)) throw new Error(`[KeplerRail] body '${id}': orbit.a must be > 0 (got ${o.a})`);
  if (!(o.e >= 0 && o.e < 1)) {
    throw new Error(`[KeplerRail] body '${id}': orbit.e must be in [0, 1) — elliptic rail only (got ${o.e})`);
  }
  if (!(o.muHost > 0)) throw new Error(`[KeplerRail] body '${id}': orbit.muHost must be > 0 (got ${o.muHost})`);
  if (!(o.T > 0)) throw new Error(`[KeplerRail] body '${id}': orbit.T must be > 0 (got ${o.T})`);
}


export class KeplerRail {
  /** Topologically ordered: parents strictly before children. */
  private readonly _states: CelestialState[] = [];
  private readonly _byId = new Map<string, CelestialState>();


  constructor(configs: readonly CelestialConfig[]) {
    // Boot-time topological insertion. Restart-scan: each pass places the
    // first body whose parent is resolved (or null); a full pass with no
    // placement means a cycle or unknown parent id -> hard error. O(n²)
    // worst case, n = 17, boot path only.
    const pending: CelestialConfig[] = configs.slice();
    while (pending.length > 0) {
      let placed = false;
      for (let i = 0; i < pending.length; i++) {
        const cfg = pending[i];
        if (cfg.parentId === null || this._byId.has(cfg.parentId)) {
          this._addBody(cfg);
          pending.splice(i, 1);
          placed = true;
          break;
        }
      }
      if (!placed) {
        throw new Error(
          '[KeplerRail] celestial hierarchy contains a cycle or an unknown parentId',
        );
      }
    }
  }


  get states(): readonly CelestialState[] {
    return this._states;
  }


  getState(id: string): CelestialState | null {
    return this._byId.get(id) ?? null;
  }


  /* -----------------------------------------------------------------------
   * Boot-time body construction (allocation sanctioned here ONLY).
   * -------------------------------------------------------------------- */
  private _addBody(cfg: CelestialConfig): void {
    let parentIndex = -1;
    if (cfg.parentId !== null) {
      const parent = this._byId.get(cfg.parentId);
      if (parent === undefined) {
        throw new Error(`[KeplerRail] unknown parent '${cfg.parentId}'`);
      }
      parentIndex = this._states.indexOf(parent);
    }


    const state: CelestialState = {
      config: cfg,
      parentIndex,
      absPos: new Vec3d(), // WHY (T5 S1bbbb): Vec3d, not a literal (boxed double stores)
      localPosF32: new Float32Array(3), // the ONE per-body buffer allocation
      orbitalSpeed: 0,
      basisP: new Vec3d(1, 0, 0),
      basisQ: new Vec3d(0, 0, -1),
      semiMinor: 0,
    };


    if (cfg.orbit !== null) {
      const o = cfg.orbit;
      validateOrbit(cfg.id, o);
      // Standard perifocal basis (Z-up convention):
      //   p̂ = Rz(Ω)·Rx(i)·Rz(ω)·(1,0,0),  q̂ = ...·(0,1,0)
      const cO = Math.cos(o.Omega), sO = Math.sin(o.Omega);
      const ci = Math.cos(o.i), si = Math.sin(o.i);
      const cw = Math.cos(o.omega), sw = Math.sin(o.omega);
      const pzx = cO * cw - sO * sw * ci;
      const pzy = sO * cw + cO * sw * ci;
      const pzz = sw * si;
      const qzx = -cO * sw - sO * cw * ci;
      const qzy = -sO * sw + cO * cw * ci;
      const qzz = cw * si;
      // Relabel Z-up -> Y-up world: (x, y, z)_zu -> (x, z, −y)_yu.
      // Identity elements yield p̂ = (1,0,0), q̂ = (0,0,−1) EXACTLY:
      // prograde motion is counter-clockwise viewed from +Y.
      state.basisP.x = pzx; state.basisP.y = pzz; state.basisP.z = -pzy;
      state.basisQ.x = qzx; state.basisQ.y = qzz; state.basisQ.z = -qzy;
      state.semiMinor = o.a * Math.sqrt(1 - o.e * o.e);
    }


    this._states.push(state);
    this._byId.set(cfg.id, state);
  }


  /* -----------------------------------------------------------------------
   * THE MACRO EVALUATION — P(elements; t), zero allocation.
   *
   * Expression shapes here are load-bearing for the acceptance suite's
   * bit-exact comparison: the independent reference evaluator deliberately
   * mirrors them (wrapAngle(M0 + n·t), a·(cosE − e), parent + (px·p̂ + py·q̂)).
   * Do not "simplify" these lines without updating the reference.
   * -------------------------------------------------------------------- */
  evaluate(simTime: number): void {
    const states = this._states;
    const count = states.length;
    for (let k = 0; k < count; k++) {
      const s = states[k];
      const o = s.config.orbit;


      if (o === null) {
        // Fixed body (the Sun): root -> origin; otherwise pinned to parent.
        const parent = s.parentIndex >= 0 ? states[s.parentIndex] : null;
        if (parent !== null) {
          s.absPos.x = parent.absPos.x;
          s.absPos.y = parent.absPos.y;
          s.absPos.z = parent.absPos.z;
        } else {
          s.absPos.x = 0; s.absPos.y = 0; s.absPos.z = 0;
        }
        s.orbitalSpeed = 0;
        continue;
      }


      // Mean anomaly (wrapped for conditioning; deterministic).
      const M = wrapAngle(o.M0 + o.n * simTime);
      // Eccentric anomaly — exact for circular orbits (e < 1e-12 fast path:
      // E = M, and a·(cosE − 0) === a·cosE exactly).
      let E: number;
      if (o.e < 1e-12) {
        E = M;
      } else {
        E = solveKeplerE(M, o.e);
      }
      const cosE = Math.cos(E);
      const sinE = Math.sin(E);


      // Perifocal plane coordinates — the only scratch: two scalars.
      const px = o.a * (cosE - o.e);
      const py = s.semiMinor * sinE;


      // World-frame offset via the boot-precomputed basis.
      const P = s.basisP;
      const Q = s.basisQ;
      const ox = px * P.x + py * Q.x;
      const oy = px * P.y + py * Q.y;
      const oz = px * P.z + py * Q.z;


      // Hierarchical composition — parent is already evaluated this pass
      // (topological order). For planets the parent is the Sun at exactly
      // (0,0,0), so `0 + ox === ox` keeps the composition bit-exact.
      const parent = s.parentIndex >= 0 ? states[s.parentIndex] : null;
      if (parent !== null) {
        s.absPos.x = parent.absPos.x + ox;
        s.absPos.y = parent.absPos.y + oy;
        s.absPos.z = parent.absPos.z + oz;
      } else {
        s.absPos.x = ox;
        s.absPos.y = oy;
        s.absPos.z = oz;
      }


      // Vis-viva speed: v = √(μ(2/r − 1/a)), r = a(1 − e·cosE).
      // Exact for e = 0 (r === a, 2/a − 1/a === 1/a in IEEE arithmetic).
      const r = o.a * (1 - o.e * cosE);
      s.orbitalSpeed = Math.sqrt(o.muHost * (2 / r - 1 / o.a));
    }
  }
}
