// T1 play controller (plan §5.2, §9.2, §9.3, §9.5). The ONLY writer of
// `kcc.input` (plus `autoTurnEnabled` / `lookYawDelta`). Camera-relative WASD,
// play-layer jump buffer (Q5), hard-landing recovery scale, respawn reset.
// Planet-frame math, zero allocation per step (module scratch only).
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import {
  rotateByQuatConjInto, spinQuatInto, transportVelocityInto, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { MOON_ASTRONAUT, PLAY_TUNING } from '../world/moonConfig';

/** What the controller needs from InputState (the test drives a plain stub). */
export interface ControlInput {
  moveX: number; moveY: number; sprint: boolean; crouch: boolean;
  jumpPressed: boolean; lookDX: number;
}
/** What the controller needs from the camera: the planet-frame heading (⊥ up). */
export interface HeadingSource { readonly heading: Vec3 }

const _qS: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _tv: Vec3 = { x: 0, y: 0, z: 0 };
const _rv: Vec3 = { x: 0, y: 0, z: 0 };
const _h: Vec3 = { x: 0, y: 0, z: 0 };

/** Relative (spin-frame) velocity along kcc.up — §5.2 vertSpeed. Zero-alloc. */
export function kccVertSpeed(kcc: AstronautKCC, omega: number): number {
  const a = kcc.absPos, v = kcc.absVel, u = kcc.up;
  transportVelocityInto(omega, a.x, a.y, a.z, _tv);
  spinQuatInto(kcc.spinPhase, _qS);
  rotateByQuatConjInto(_qS, v.x - _tv.x, v.y - _tv.y, v.z - _tv.z, _rv);
  return _rv.x * u.x + _rv.y * u.y + _rv.z * u.z;
}

/** §8.2 Land duration, reused for the §9.3 hard-landing recovery window. */
export function landDuration(landingSpeed: number): number {
  const t = 0.10 + 0.04 * landingSpeed;
  return t < 0.12 ? 0.12 : t > 0.40 ? 0.40 : t;
}

export class PlayerController {
  firstPerson = false;
  /** Raised by postSimulate on the frame the KCC launched (read by sampleTelemetry). */
  jumpedThisFrame = false;
  /** Raised by postSimulate on the frame integrity.landings advanced. */
  landedThisFrame = false;
  /** |(moveX, moveY)| clamped to 1 (telemetry inputMag). */
  inputMag = 0;
  /** Seconds left in the jump buffer (§9.3). */
  buffer = 0;
  /** Seconds left of hard-landing recovery (move scale landRecoverScale). */
  recoverT = 0;
  private wasGrounded: boolean;
  private lastLandings: number;

  constructor(
    readonly kcc: AstronautKCC,
    readonly tuning: typeof PLAY_TUNING = PLAY_TUNING,
    readonly spinOmega: number = MOON_ASTRONAUT.spinOmega,
  ) {
    this.wasGrounded = kcc.grounded;
    this.lastLandings = kcc.integrity.landings;
  }

  private acc = 0;

  /** Stage start: clears the per-frame edges (jumped / landed are OR-ed over ticks). */
  beginFrame(): void { this.jumpedThisFrame = false; this.landedThisFrame = false; }

  /** Stages 4+5 (KCC part): fixed 1/60 ticks, each = step → kcc.update(1/60, 1)
   *  → postSimulate. Returns the tick count (≤ maxSubsteps; the excess is shed
   *  like the KCC's own accumulator). dt = clock.dt (0 when frozen → 0 ticks).
   *  WHY (B7a decision): the KCC auto-turns `fwd` every tick, so moveF/moveR
   *  computed once per frame go stale on multi-tick frames (measured: 10 cm
   *  drift at 30 Hz over the §9.6 script). Re-deriving them per tick keeps
   *  vDes = d·speed exactly and the outcome frame-rate independent. */
  simulate(inp: ControlInput, cam: HeadingSource, dt: number, maxSubsteps = 5): number {
    if (!(dt > 0)) return 0;
    const TICK = 1 / 60;
    this.acc += dt > 0.25 ? 0.25 : dt;
    let n = 0;
    // WHY: 1e-9 s tolerance — summed 1/144 frames otherwise lose a tick to rounding.
    while (this.acc >= TICK - 1e-9 && n < maxSubsteps) {
      this.step(inp, cam, TICK);
      this.kcc.update(TICK, 1);
      this.postSimulate();
      this.acc -= TICK; n++;
    }
    if (this.acc >= TICK) this.acc = 0; // shed (spiral-of-death guard)
    if (this.acc < 0) this.acc = 0;
    return n;
  }

  /** One tick of input mapping: input + camera heading → kcc.input. */
  step(inp: ControlInput, cam: HeadingSource, dt: number): void {
    const k = this.kcc, ki = k.input, u = k.up, f = k.fwd, T = this.tuning;
    this.wasGrounded = k.grounded;
    // heading re-projected onto the current up plane (local copy; §9.4 transport)
    const h0 = cam.heading, hd = h0.x * u.x + h0.y * u.y + h0.z * u.z;
    let hx = h0.x - u.x * hd, hy = h0.y - u.y * hd, hz = h0.z - u.z * hd;
    const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
    hx /= hl; hy /= hl; hz /= hl;
    const h = _h; h.x = hx; h.y = hy; h.z = hz;
    // §9.2: d = h·moveY + c·moveX with c = h × up (= the KCC's fwd × up convention)
    const cx = h.y * u.z - h.z * u.y, cy = h.z * u.x - h.x * u.z, cz = h.x * u.y - h.y * u.x;
    const my = inp.moveY, mx = inp.moveX;
    let dx = h.x * my + cx * mx, dy = h.y * my + cy * mx, dz = h.z * my + cz * mx;
    const dl = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dl > 1) { dx /= dl; dy /= dl; dz /= dl; }
    const im = Math.sqrt(mx * mx + my * my);
    this.inputMag = im > 1 ? 1 : im;
    // moveF = d·fwd, moveR = d·(fwd × up) — the KCC rebuilds vDes = d·speed exactly
    const rx = f.y * u.z - f.z * u.y, ry = f.z * u.x - f.x * u.z, rz = f.x * u.y - f.y * u.x;
    let mF = dx * f.x + dy * f.y + dz * f.z;
    let mR = dx * rx + dy * ry + dz * rz;
    if (this.recoverT > 0) {
      // WHY (§9.3): a hard landing absorbs — half input for the Land window.
      mF *= T.landRecoverScale; mR *= T.landRecoverScale;
      this.recoverT = Math.max(0, this.recoverT - dt);
    }
    ki.moveF = mF; ki.moveR = mR;
    // WHY (§9.2): sprint only with real stick input, never from standing.
    ki.sprint = inp.sprint && this.inputMag > 0.5;
    ki.crouch = inp.crouch;
    ki.turnRate = 0;
    k.autoTurnEnabled = !this.firstPerson;
    // WHY (§9.4): FP mouse yaw turns the body; sign = the camera orbit's
    // (a = −dx·sens turns toward heading × up, i.e. right for dx > 0).
    if (this.firstPerson && inp.lookDX !== 0) { k.lookYawDelta += -inp.lookDX * T.lookSens; inp.lookDX = 0; }
    // §9.3 jump buffer (play layer, Q5). WHY: jump is re-derived every frame
    // (not latched) so a stale flag from a 0-substep frame cannot outlive the buffer.
    if (inp.jumpPressed) { this.buffer = T.jumpBufferS; inp.jumpPressed = false; }
    ki.jump = this.buffer > 0 && k.grounded && !inp.crouch;
    this.buffer = Math.max(0, this.buffer - dt);
  }

  /** After each kcc tick: launch + landing detection (edges OR into the frame). */
  postSimulate(): void {
    const k = this.kcc;
    if (this.wasGrounded && !k.grounded && kccVertSpeed(k, this.spinOmega) > 0.5) {
      this.buffer = 0; this.jumpedThisFrame = true; k.input.jump = false;
    }
    const L = k.integrity.landings;
    if (L !== this.lastLandings) {
      this.lastLandings = L;
      this.landedThisFrame = true;
      const s = k.integrity.lastLandingRelSpeed;
      if (s > this.tuning.hardLandingSpeed) this.recoverT = landDuration(s);
    }
    this.wasGrounded = k.grounded;
  }

  /** Respawn (§9.3): after the KCC placement — clears buffer, edges, inputs. */
  reset(): void {
    const ki = this.kcc.input;
    ki.moveF = 0; ki.moveR = 0; ki.jump = false; ki.sprint = false; ki.turnRate = 0;
    this.buffer = 0; this.recoverT = 0; this.inputMag = 0; this.acc = 0;
    this.jumpedThisFrame = false; this.landedThisFrame = false;
    this.wasGrounded = this.kcc.grounded;
    this.lastLandings = this.kcc.integrity.landings;
  }
}