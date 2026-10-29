// T1 B5b: pure, DOM-free halves of playFrame stages 1 (clock) and 11 (loading
// gate), split out so test-play-shell drives them headless (§10.3, §10.7).
// Zero allocation per call.
import type { PlayPhase } from '../ui/playStore';

/** Largest dt handed to the simulation per frame (s). */
export const MAX_FRAME_DT = 0.1;

/**
 * Stage 1 clock. dt = 0 unless PLAYING; the first PLAYING frame after any
 * other phase is also dt = 0 (`resumedThisFrame`) so a resume never lurches.
 */
export class PlayClock {
  dt = 0;
  /** Raw frame delta (s) of the last step(), every phase (HUD FPS readout).
   *  WHY (T5 S1bbbbbbb, F5a): hot callees read dt/delta from the clock (a
   *  DtSource) instead of taking them as boxed double arguments. */
  delta = 0;
  resumedThisFrame = false;
  private wasPlaying = false;

  step(phase: PlayPhase, delta: number): number {
    this.delta = delta;
    if (phase !== 'PLAYING') {
      this.wasPlaying = false; this.resumedThisFrame = false; this.dt = 0;
      return 0;
    }
    if (!this.wasPlaying) {
      this.wasPlaying = true; this.resumedThisFrame = true; this.dt = 0;
      return 0;
    }
    this.resumedThisFrame = false;
    // WHY (B5b decision): clamp to 0.1 s — a stalled frame (GC, tab jank)
    // must not inject a huge step; B7's fixed-step accumulator sits below.
    this.dt = delta > MAX_FRAME_DT ? MAX_FRAME_DT : delta < 0 ? 0 : delta;
    return this.dt;
  }

  /** Stage 2 edges (respawn, pause) zero this frame's dt. */
  forceZero(): void { this.dt = 0; }
}

export type GateEvent = 'ready' | 'timeout' | null;

/**
 * Stage 11 loading gate (§10.3): 'ready' on the second CONSECUTIVE frame with
 * residentAround = 1.0, or 'timeout' once `timeoutS` of real time elapsed.
 * `publishDue()` throttles store writes to ≤ `hz`.
 */
export class LoadingGate {
  elapsed = 0;
  progress = 0;
  done = false;
  private ones = 0;
  private sincePublish = Infinity;

  constructor(readonly timeoutS: number, readonly hz = 10) {}

  step(dtReal: number, frac: number): GateEvent {
    if (this.done) return null;
    // WHY: a first frame after a long shader compile can report seconds of
    // delta; cap it so one hitch cannot fire the timeout by itself.
    const d = dtReal > 0.25 ? 0.25 : dtReal < 0 ? 0 : dtReal;
    this.elapsed += d; this.sincePublish += d;
    this.progress = frac;
    this.ones = frac >= 1 ? this.ones + 1 : 0;
    if (this.ones >= 2) { this.done = true; return 'ready'; }
    if (this.elapsed >= this.timeoutS) { this.done = true; return 'timeout'; }
    return null;
  }

  publishDue(): boolean {
    if (this.done || this.sincePublish >= 1 / this.hz) { this.sincePublish = 0; return true; }
    return false;
  }

  reset(): void {
    this.elapsed = 0; this.progress = 0; this.done = false; this.ones = 0; this.sincePublish = Infinity;
  }
}