// T1 character telemetry (plan §5.2, §8.6): KCC + controller → animation
// signals, refilled in place every frame (zero-GC). B6 shipped the record type
// and factory; B7a adds sampleTelemetry with the §5.2 signature.
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import type { Vec3 } from '../../core/physics/sphericalFrame';
import { terrainNormalInto } from '../../core/terrain/terrainField';
import { kccVertSpeed, type ControlInput, type PlayerController } from '../controller/PlayerController';

export interface CharacterTelemetry {
  grounded: boolean; speed: number; vertSpeed: number; slopeDeg: number;
  sliding: boolean; sprint: boolean; crouch: boolean; inputMag: number;
  jumped: boolean; landed: boolean; landingSpeed: number; airTime: number; dt: number;
  slopeFwdDeg: number; slopeSideDeg: number; // §8.6 additive amendment
}

/** Boot-only: one record per world, refilled in place every frame (zero-GC). */
export function createTelemetry(): CharacterTelemetry {
  return {
    grounded: true, speed: 0, vertSpeed: 0, slopeDeg: 0,
    sliding: false, sprint: false, crouch: false, inputMag: 0,
    jumped: false, landed: false, landingSpeed: 0, airTime: 0, dt: 0,
    slopeFwdDeg: 0, slopeSideDeg: 0,
  };
}

const _n: Vec3 = { x: 0, y: 0, z: 0 };
const DEG = 180 / Math.PI;

/** Stage 7 (after postSimulate). Zero allocation. */
export function sampleTelemetry(kcc: AstronautKCC, ctrl: PlayerController,
  inp: ControlInput, dt: number, out: CharacterTelemetry): void {
  const g = kcc.grounded, t = kcc.telemetry;
  out.grounded = g;
  out.speed = t.relSpeed;
  out.vertSpeed = g ? 0 : kccVertSpeed(kcc, ctrl.spinOmega);
  out.slopeDeg = g ? t.slopeDeg : 0;
  out.sliding = g && t.slideSpeed > 0.25;
  out.crouch = inp.crouch;
  out.sprint = kcc.input.sprint && !inp.crouch;
  out.inputMag = ctrl.inputMag;
  out.jumped = ctrl.jumpedThisFrame;
  // WHY (B7a): the controller owns the landings-counter diff (it also needs it
  // for landing recovery), so telemetry reads its edge instead of a 2nd counter.
  out.landed = ctrl.landedThisFrame;
  out.landingSpeed = kcc.integrity.lastLandingRelSpeed;
  out.airTime = g ? 0 : out.airTime + dt;
  out.dt = dt;
  if (g) {
    // §8.6: ground normal vs kcc.up, resolved on fwd / right; + = uphill ahead/right.
    const p = kcc.pLocal, l = Math.hypot(p.x, p.y, p.z) || 1;
    terrainNormalInto(p.x / l, p.y / l, p.z / l, _n);
    const u = kcc.up, f = kcc.fwd;
    const rx = f.y * u.z - f.z * u.y, ry = f.z * u.x - f.x * u.z, rz = f.x * u.y - f.y * u.x;
    const nu = _n.x * u.x + _n.y * u.y + _n.z * u.z;
    const nf = _n.x * f.x + _n.y * f.y + _n.z * f.z;
    const nr = _n.x * rx + _n.y * ry + _n.z * rz;
    out.slopeFwdDeg = Math.atan2(-nf, nu) * DEG;
    out.slopeSideDeg = Math.atan2(-nr, nu) * DEG;
  } else { out.slopeFwdDeg = 0; out.slopeSideDeg = 0; }
}