/**
 * REAL ORBIT ELEMENTS — inclination, eccentricity, node, periapsis and epoch phase of every catalog
 * orbit, in the world frame the KeplerRail uses (F3abbbbbc, ADR-016).
 *
 * WHY: A1-U12-1 found that every catalog orbit was circular and coplanar (e = i = Ω = ω = 0, M0 a
 * golden-angle spread). `REAL_BODY_DATA` (ADR-011) carries the sourced elements; this module turns
 * them into `OrbitParams` angles. Boot-only (allocates); pure core: no three/react imports.
 *
 * FRAMES. The rail's elements are referenced to the J2000 ecliptic (Z-up in the rail's own
 * convention, relabelled to the Y-up world by KeplerRail). The sourced elements are not all
 * ecliptic-referenced:
 *  - planets and Pluto: ecliptic already (JPL Table 1) -> used as is.
 *  - the Moon: JPL gives it against the ecliptic -> used as is (`ECLIPTIC_MOONS`).
 *  - every other moon: JPL gives it against the parent's local Laplace plane. APPROXIMATION: the
 *    Laplace plane is taken as the parent's equatorial plane, with normal = the parent's
 *    right-hand spin axis (IAU pole, flipped when the pole rate is negative). Moons orbit in the
 *    sense of the parent's rotation, so this makes Titania (i 0.1) prograde about Uranus and
 *    Triton (i 157.3) retrograde about Neptune, matching the PCK moon spin rates.
 *  - the plane's reference direction (node origin) is the ascending node of the plane on the
 *    ICRF equator (x = ẑ_eq × N). This is an ASSUMED convention (the table does not state it); it
 *    only rotates the initial phase of Ω + ω within the plane.
 * The composed orientation is re-expressed as ecliptic (i', Ω', ω') so the rail needs no change.
 */
import { REAL_BODY_DATA } from './realBodyData';
import { OBLIQUITY_J2000_DEG, poleToWorld } from './spinLaw';

const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;

/** Moons whose sourced elements are already ecliptic-referenced (JPL sep.html: Earth's Moon). */
export const ECLIPTIC_MOONS: ReadonlySet<string> = new Set(['moon']);

type V3 = [number, number, number];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function unit(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
}

export interface DerivedElements {
  e: number;
  /** Inclination to the ecliptic, rad, [0, π]. */
  i: number;
  Omega: number;
  omega: number;
  /** Mean anomaly at J2000, rad, in (−π, π]. */
  M0: number;
}

/** Right-hand spin axis of a body in the ecliptic Z-up frame. */
function spinAxisEcliptic(id: string): V3 {
  const o = REAL_BODY_DATA[id].orientation;
  const w = poleToWorld(o.poleRA, o.poleDec); // world = (x_e, z_e, −y_e)
  const s = o.pmRate < 0 ? -1 : 1;
  return [s * w.x, -s * w.z, s * w.y];
}

/** Reference-plane frame (x, y, normal) in the ecliptic Z-up frame for a body's sourced elements. */
function planeFrame(id: string, parentId: string | null): { x: V3; y: V3; z: V3 } {
  const orbit = REAL_BODY_DATA[id].orbit;
  if (orbit === null) throw new Error(`[orbitElements] '${id}' has no real orbit`);
  if (orbit.plane === 'ecliptic' || ECLIPTIC_MOONS.has(id)) {
    return { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
  }
  if (parentId === null) throw new Error(`[orbitElements] laplace-plane body '${id}' needs a parent`);
  const eps = OBLIQUITY_J2000_DEG * DEG;
  const zEq: V3 = [0, Math.sin(eps), Math.cos(eps)]; // ICRF equator normal in the ecliptic frame
  const n = spinAxisEcliptic(parentId);
  const xn = cross(zEq, n);
  const x: V3 = Math.hypot(xn[0], xn[1], xn[2]) < 1e-12 ? [1, 0, 0] : unit(xn);
  return { x, y: cross(n, x), z: n };
}

function wrap(a: number): number {
  return a - TWO_PI * Math.round(a / TWO_PI);
}

/** Ecliptic-referenced elements for one body from its sourced (plane-referenced) elements. */
export function deriveElements(id: string, parentId: string | null): DerivedElements {
  const orbit = REAL_BODY_DATA[id]?.orbit;
  if (orbit === undefined || orbit === null) throw new Error(`[orbitElements] no real orbit for '${id}'`);
  const O = orbit.node * DEG, inc = orbit.i * DEG, w = orbit.argPeri * DEG;
  const cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
  const cw = Math.cos(w), sw = Math.sin(w);
  // Perifocal basis in the reference-plane frame (same Rz(Ω)Rx(i)Rz(ω) convention as KeplerRail).
  const p: V3 = [cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si];
  const q: V3 = [-cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si];
  const f = planeFrame(id, parentId);
  const lift = (v: V3): V3 => [
    f.x[0] * v[0] + f.y[0] * v[1] + f.z[0] * v[2],
    f.x[1] * v[0] + f.y[1] * v[1] + f.z[1] * v[2],
    f.x[2] * v[0] + f.y[2] * v[1] + f.z[2] * v[2],
  ];
  const P = lift(p), Q = lift(q);
  const h = unit(cross(P, Q));
  const sinI = Math.hypot(h[0], h[1]);
  let i2: number, O2: number, w2: number;
  if (sinI < 1e-12) {
    // Degenerate node: put it on +x. i = 0 -> P = (cosω, sinω); i = π -> P = (cosω, −sinω).
    O2 = 0;
    if (h[2] > 0) { i2 = 0; w2 = Math.atan2(P[1], P[0]); } else { i2 = Math.PI; w2 = Math.atan2(-P[1], P[0]); }
  } else {
    i2 = Math.acos(Math.max(-1, Math.min(1, h[2])));
    O2 = Math.atan2(h[0], -h[1]);
    const nd: V3 = [Math.cos(O2), Math.sin(O2), 0];
    w2 = Math.atan2(dot(cross(h, nd), P), dot(nd, P));
  }
  return { e: orbit.e, i: i2, Omega: O2, omega: w2, M0: wrap(orbit.M0 * DEG) };
}

/** Elements for every non-star body of a catalog list. Boot-only. */
export function deriveOrbitElements(
  bodies: readonly { id: string; parentId: string | null; type: string }[],
): Record<string, DerivedElements> {
  const out: Record<string, DerivedElements> = {};
  for (const b of bodies) {
    if (b.type === 'star') continue;
    out[b.id] = deriveElements(b.id, b.parentId);
  }
  return out;
}