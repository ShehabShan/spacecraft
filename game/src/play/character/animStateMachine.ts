// T1 B8 animation state machine (plan §8.1, §8.2, §5.2). Picks the animation
// state from CharacterTelemetry; ProceduralAnimator (B9) evaluates the poses.
// Pure TS: no THREE, no core imports (telemetry is a type-only import), so the
// machine is Node-testable and allocation-free (`tools/test-play-anim.mjs`).
import type { CharacterTelemetry } from './CharacterTelemetry';

// WHY (§5.2): an `as const` object, not a `const enum` — esbuild's
// isolatedModules mode cannot inline a const enum across files.
export const AnimState = {
  Idle: 0, Walk: 1, Run: 2, JumpLaunch: 3, JumpRise: 4, Fall: 5, Land: 6, Slide: 7,
} as const;
export type AnimStateId = typeof AnimState[keyof typeof AnimState];
export const ANIM_STATE_NAMES = ['Idle', 'Walk', 'Run', 'JumpLaunch', 'JumpRise', 'Fall', 'Land', 'Slide'] as const;

/** §8.2 table literals (seconds, m/s). */
export const ANIM_TUNING = {
  tLaunch: 0.12,          // JumpLaunch duration
  riseVert: 0.5,          // vertSpeed split JumpRise / Fall
  coyoteS: 0.15,          // un-jumped airTime held as a ground state
  landSoft: 1.0,          // landingSpeed ≤ this skips Land (soft dip instead)
  landBase: 0.10, landPerSpeed: 0.04, landMin: 0.12, landMax: 0.40, // T_land
  runIn: 5.0, runOut: 4.5,                    // Walk/Run hysteresis
  walkIn: 0.30, walkOutSpeed: 0.15, walkOutInput: 0.1, // Idle/Walk hysteresis
  slideOffS: 0.10,        // `sliding` false this long → leave Slide
  minDwell: 0.08,         // every state except the timed JumpLaunch / Land
  crouchEaseS: 0.15,      // crouch weight w_c ease time
  softDipD: 0.03, softDipS: 0.10, // soft-landing additive legDrop + decay
} as const;

/** Blend-in time per state, indexed by AnimStateId (§8.2 "Blend-in"). */
export const BLEND_IN: readonly number[] = [0.30, 0.20, 0.20, 0.05, 0.15, 0.25, 0.04, 0.20];

// WHY (B8): leg lengths are restated here instead of importing RIG_DIMS —
// AstronautRig pulls THREE + MultiCameraRig, and this module must stay pure.
// test-play-anim asserts LEG === RIG_DIMS (d0 = upperLeg + lowerLeg, §8.1).
export const LEG = { d0: 0.80, L: 0.40, hipsY: 0.92, maxDrop: 0.30 } as const;

/** Output of `legDrop`: angles (rad, flexion magnitudes) + rest-relative X quaternions. */
export interface LegPose {
  D: number; hip: number; knee: number; ankle: number; hipsY: number;
  /** [hip, knee, ankle] × xyzw — hip +X, knee −X, ankle +X (§7.1 signs). */
  q: Float64Array;
}
export function createLegPose(): LegPose {
  return { D: 0, hip: 0, knee: 0, ankle: 0, hipsY: LEG.hipsY, q: new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]) };
}

function setQx(q: Float64Array, o: number, a: number): void {
  q[o] = Math.sin(a * 0.5); q[o + 1] = 0; q[o + 2] = 0; q[o + 3] = Math.cos(a * 0.5);
}

/**
 * §8.1 two-bone leg solver for a pelvis drop D (clamped to [0, 0.30] m).
 * WHY: knee = 2·hip and ankle = hip make the X rotations sum to 0, so the
 * sole stays flat and the ankle stays directly under the hip. Zero-GC.
 */
export function legDrop(D: number, out: LegPose): LegPose {
  const d = D < 0 ? 0 : D > LEG.maxDrop ? LEG.maxDrop : D;
  const c = (LEG.d0 - d) / (2 * LEG.L);
  const hip = Math.acos(c > 1 ? 1 : c);
  out.D = d; out.hip = hip; out.knee = 2 * hip; out.ankle = hip; out.hipsY = LEG.hipsY - d;
  setQx(out.q, 0, hip); setQx(out.q, 4, -2 * hip); setQx(out.q, 8, hip);
  return out;
}

const S = AnimState, K = ANIM_TUNING;

export class AnimStateMachine {
  state: AnimStateId = S.Idle;
  prev: AnimStateId = S.Idle;
  timeInState = 0;
  /** 0→1 crossfade prev→state, smoothstep(timeInState / blendTime). */
  blend = 1;
  blendTime: number = BLEND_IN[S.Idle];
  /** True only on the step whose transition fired while blend < 1 (§8.2
   *  Interrupt): the animator copies its current output into `snap`. */
  interrupted = false;
  /** T_land, fixed at Land entry from landingSpeed. */
  landDuration = 0;
  /** Crouch weight w_c (§8.2: a weight, not a state). */
  crouchW = 0;
  transitions = 0;
  private slideOffT = 0;
  private softDipT: number = K.softDipS;

  get stateName(): string { return ANIM_STATE_NAMES[this.state]; }

  /** Current soft-landing additive pelvis drop (m) for `legDrop`. */
  get softDipD(): number { return K.softDipD * (1 - this.softDipT / K.softDipS); }

  step(t: Readonly<CharacterTelemetry>, dt: number): void {
    this.interrupted = false;
    this.timeInState += dt;
    const r = dt / K.crouchEaseS;
    if (t.crouch) this.crouchW = Math.min(1, this.crouchW + r);
    else this.crouchW = Math.max(0, this.crouchW - r);
    this.slideOffT = t.sliding ? 0 : this.slideOffT + dt;
    this.softDipT = (t.landed && t.landingSpeed <= K.landSoft) ? 0 : Math.min(K.softDipS, this.softDipT + dt);

    const next = this.decide(t);
    if (next !== this.state) {
      const s = this.state;
      // WHY (B8): JumpLaunch / Land are edge-driven (jumped / landed last one
      // frame), so they override the 0.08 s dwell or the edge would be lost.
      const event = next === S.JumpLaunch || next === S.Land;
      const free = s === S.JumpLaunch || s === S.Land || this.timeInState >= K.minDwell;
      if (event || free) this.enter(next, t);
    }
    const x = this.blendTime > 0 ? Math.min(1, this.timeInState / this.blendTime) : 1;
    this.blend = x * x * (3 - 2 * x);
  }

  private enter(next: AnimStateId, t: Readonly<CharacterTelemetry>): void {
    if (this.blend < 1) this.interrupted = true;
    this.prev = this.state; this.state = next;
    this.timeInState = 0; this.blend = 0; this.blendTime = BLEND_IN[next];
    if (next === S.Land) {
      const d = K.landBase + K.landPerSpeed * t.landingSpeed;
      this.landDuration = d < K.landMin ? K.landMin : d > K.landMax ? K.landMax : d;
    }
    this.transitions++;
  }

  /** §8.2 table: the first row whose entry holds, subject to the current exit rule. */
  private decide(t: Readonly<CharacterTelemetry>): AnimStateId {
    const s = this.state;
    if (t.jumped && s !== S.JumpLaunch) return S.JumpLaunch;          // prio 1, from any state
    switch (s) {
      case S.JumpLaunch:
        if (this.timeInState < K.tLaunch) return s;
        if (t.grounded) return this.onGround(t, S.Idle);
        return t.vertSpeed > K.riseVert ? S.JumpRise : S.Fall;
      case S.Land:
        if (this.timeInState < this.landDuration) return s;
        return this.onGround(t, s);
      case S.JumpRise:
        if (t.grounded) return this.onGround(t, S.Idle);
        return t.vertSpeed <= K.riseVert ? S.Fall : s;
      case S.Fall:
        return t.grounded ? this.onGround(t, S.Idle) : s;
      default:
        return this.onGround(t, s);
    }
  }

  /** Ground-state rows (Land prio 2, coyote hold, Slide, Run, Walk, Idle). */
  private onGround(t: Readonly<CharacterTelemetry>, from: AnimStateId): AnimStateId {
    if (t.landed && t.landingSpeed > K.landSoft) return S.Land;
    if (!t.grounded) {
      // WHY (B8 decision): past the coyote grace an un-jumped airborne body is
      // Fall even while still rising (crest launch) — JumpRise is entered only
      // from JumpLaunch, and holding a gait in mid-air reads as a bug.
      return t.airTime > K.coyoteS ? S.Fall : from;
    }
    if (t.sliding) return S.Slide;
    if (from === S.Slide && this.slideOffT < K.slideOffS) return S.Slide;
    const v = t.speed;
    if (from === S.Run ? v >= K.runOut : v >= K.runIn) return S.Run;
    const moving = from === S.Walk || from === S.Run;
    if (moving ? !(v < K.walkOutSpeed && t.inputMag < K.walkOutInput) : v >= K.walkIn) return S.Walk;
    return S.Idle;
  }
}