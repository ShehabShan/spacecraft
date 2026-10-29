// T1 B10: playFrame stage 11 HUD publisher (plan §10.5, §11.2 row 11, §11.3).
// WHY (B10 decision): play-local instead of store/useGameStore's
// createTelemetryPublisher — that one writes the TEST store's telemetry shape
// through fresh object literals on a performance.now() clock. This keeps its
// 100 ms throttle but publishes PlayHud from two boot buffers used alternately
// (zustand sees a new reference, nothing is allocated) on accumulated RAW frame
// delta, so it is deterministic headless (test-play-perf) and still reads in
// LOADING / PAUSED. Zero allocation per call.
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import { makeHud, type PlayHud } from './playStore';

export interface HudSink { setHud(h: PlayHud): void }

/** Raw frame delta (s, every phase) and sim dt (s, PLAYING only); PlayClock has both. */
export interface HudClock { readonly delta: number; readonly dt: number }

/** Class-backed cell for the numeric-arg `step` wrapper (unboxed double fields). */
class HudClockCell implements HudClock { delta = 0; dt = 0; }

/** §10.5 controls-hint fade: 8 s of PLAYING or 20 m walked, whichever first. */
export const HUD_HINT_SECONDS = 8;
export const HUD_HINT_METRES = 20;
const DEG = 180 / Math.PI;

export class HudPublisher {
  /** FPS exponential average (τ = tauS) from the raw frame delta. */
  fps = 0;
  publishes = 0;
  /** Simulated PLAYING time and grounded distance — drive the hint fade. */
  playTime = 0;
  walked = 0;
  hintOn = true;
  private readonly bufs: PlayHud[] = [makeHud(), makeHud()];
  private idx = 0;
  private since = Infinity;

  constructor(readonly minIntervalS = 0.1, readonly tauS = 0.5) {}

  /** Returns true when this call published (≤ 1 / minIntervalS per second). */
  step(delta: number, simDt: number, kcc: AstronautKCC, stateName: string,
    firstPerson: boolean, sink: HudSink): boolean {
    const c = this._clockCell; c.delta = delta; c.dt = simDt;
    return this.stepFrom(c, kcc, stateName, firstPerson, sink);
  }

  private readonly _clockCell = new HudClockCell();

  /** step() reading the raw frame delta and the sim dt from `clock` once.
   *  WHY (T5 S1bbbbbbb, F5a): playFrame passes its PlayClock, so no double
   *  argument crosses this non-inlined call (it would box per frame). */
  stepFrom(clock: HudClock, kcc: AstronautKCC, stateName: string,
    firstPerson: boolean, sink: HudSink): boolean {
    const delta = clock.delta, simDt = clock.dt;
    if (delta > 0) {
      const inst = 1 / delta;
      // WHY: time-constant EMA (α = 1 − e^(−Δ/τ)) so the reading settles in
      // the same wall time at 30, 60 or 144 Hz.
      this.fps = this.fps === 0 ? inst : this.fps + (1 - Math.exp(-delta / this.tauS)) * (inst - this.fps);
      this.since += delta;
    }
    const t = kcc.telemetry;
    if (simDt > 0) {
      this.playTime += simDt;
      if (kcc.grounded) this.walked += t.relSpeed * simDt;
      // The hint latches off; it returns only on the pause overlay (§10.5).
      if (this.hintOn && (this.playTime >= HUD_HINT_SECONDS || this.walked >= HUD_HINT_METRES)) this.hintOn = false;
    }
    if (this.since < this.minIntervalS) return false;
    this.since = 0;
    const b = this.bufs[this.idx];
    this.idx ^= 1;
    b.speed = t.relSpeed;
    b.state = stateName;
    b.grounded = kcc.grounded;
    b.fps = this.fps;
    // Planet frame; the spin axis is +Y (sphericalFrame.spinQuatInto).
    const uy = t.upY > 1 ? 1 : t.upY < -1 ? -1 : t.upY;
    b.lat = Math.asin(uy) * DEG;
    b.lon = Math.atan2(t.upX, t.upZ) * DEG;
    b.altAGL = t.altAGL;
    b.hintOn = this.hintOn;
    b.firstPerson = firstPerson;
    sink.setHud(b);
    this.publishes++;
    return true;
  }
}