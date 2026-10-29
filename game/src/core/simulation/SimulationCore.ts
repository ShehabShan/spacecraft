/**
 * ============================================================================
 *  SIMULATION CORE — PURE TYPESCRIPT, FLOAT64, ZERO-GC FIXED TICK
 *  Milestone 1A + 1B · Spec 00.2, 01.1, 02.6
 * ============================================================================
 *  Pure core: this file must never import three / react / rapier.
 *
 *  CANONICAL TICK ORDER (Spec 01.1), as implemented:
 *    STEP 1  Macro Update (f64): simTime += dt·macroTimeScale;
 *            KeplerRail.evaluate(simTime)              [M1B — NEW]
 *    (a)     Integrate dynamic entities (f64)          [M1A — dynamics
 *            stand-in; forces + Rapier arrive in later milestones]
 *    (b)     Bubble refresh test (focus vs 1,024 m)    [01.1 step 2]
 *    (c)     Conditional rebase (exact 256 m Δ)        [01.1 step 4]
 *    (d)     Render extract: f32 locals for entities AND celestials
 *            (celestial locals extracted HERE — after any rebase — never
 *            during the macro step)                    [01.1 step 8]
 *
 *  TWO-TIER TIME (Spec 00.2 / 02.6):
 *    - simTime (MACRO): advances dt·macroTimeScale per tick. Drives the
 *      closed-form Kepler rails ONLY. Default scale 30 (catalog timeScale).
 *      PAUSE (scale 0) freezes orbits but never the micro clock.
 *    - stats.simTime (MICRO, M1A contract unchanged): advances dt at exactly
 *      1× — the 60 Hz physics clock. Never scaled, never diluted.
 *    Both clocks have a single writer (this tick) — desynchronization is
 *    impossible by construction.
 *
 *  M1A NO-REGRESSION GUARANTEE: every M1A member (entity registry, focus,
 *  256 m lattice rebasing, rebase events, substep governor, stats) is
 *  retained verbatim; the 1B suite re-executes the full M1A acceptance
 *    against this updated core as proof.
 *
 *  ZERO-GC AUDIT of tick(): identical to M1A (field writes, boot-allocated
 *  scratch, one reused RebaseEvent, indexed for-loops) plus the macro step,
 *  which is itself allocation-free (see KeplerRail). Allocation per tick: 0.
 */


import type {
  EntityId,
  EntityState,
  RebaseEvent,
  RebaseListener,
  SimulationStats,
  Vec3f64,
} from '../types';
import { calculateOrigin, copy, shouldRebase, sub } from '../math/precisionMath';
import type { CelestialState } from '../orbit/types';
import { KeplerRail } from '../orbit/KeplerRail';
import { CELESTIAL_CONFIGS } from '../orbit/celestialData';
import { Vec3d } from '../physics/sphericalFrame'; // WHY (T5 S1bbbb): class-backed scratch, see Vec3d


/** Fixed logic timestep (Spec 02.6): 1 tick = 1/60 game-seconds. */
export const FIXED_DT = 1 / 60;
/** Max fixed ticks per rendered frame (Spec 02.6): shed load, never dilate. */
export const MAX_SUBSTEPS = 5;
/** Wall-clock clamp per advance() call — tab-switch / stall guard. */
export const MAX_ADVANCE_DT = 0.25;
/** Seconds per sim-day (time jumps are expressed in days). */
export const SECONDS_PER_DAY = 86400;


export interface RegisterEntityOptions {
  absPos: Vec3f64;
  velocity?: Vec3f64;
  dynamic?: boolean;
}


export class SimulationCore {
  /* ------------------------------ M1A: entities ------------------------- */
  private _entities: EntityState[] = [];
  private _entityIndex = new Map<EntityId, number>();
  private _focusId: EntityId | null = null;
  private _origin: Vec3f64 = new Vec3d(0, 0, 0);


  private _focusLocal: Vec3f64 = new Vec3d(0, 0, 0);
  private _candidateOrigin: Vec3f64 = new Vec3d(0, 0, 0);


  private readonly _rebaseEvent: RebaseEvent = {
    oldOrigin: new Vec3d(0, 0, 0),
    newOrigin: new Vec3d(0, 0, 0),
    delta: new Vec3d(0, 0, 0),
    count: 0,
  };


  private _listeners: RebaseListener[] = [];
  private _accumulator = 0;


  public readonly stats: SimulationStats = {
    tickCount: 0,
    rebaseCount: 0,
    simTime: 0, // MICRO clock (M1A semantics — 1× real time)
    focusMaxLocalPostTick: 0,
    shedSeconds: 0,
  };


  /* ------------------------------ M1B: macro ---------------------------- */
  /** MACRO clock, Float64 seconds. Drives the Kepler rails at 30× default.
   *  Negative values are a valid closed-form domain (reverse jumps past 0). */
  private _simTime = 0;
  /** Macro time scale (Spec 02.6). 0 = orbits paused; micro never pauses. */
  private _macroTimeScale = 1;
  /** Closed-form celestial rails (topologically ordered). */
  private readonly _rail: KeplerRail;
  /** id -> celestial state (render-extract lookup for the adapter). */
  private readonly _celestialIndex = new Map<string, CelestialState>();


  constructor(rail?: KeplerRail) {
    this._rail = rail ?? new KeplerRail(CELESTIAL_CONFIGS);
    const states = this._rail.states;
    for (let i = 0; i < states.length; i++) {
      this._celestialIndex.set(states[i].config.id, states[i]);
    }
    // Seed valid positions/locals before the first tick (mirrors the M1A
    // registerEntity seeding contract).
    this._rail.evaluate(0);
    this._extractCelestialLocals();
  }


  /* =======================================================================
   * M1B — TWO-TIER TIME CONTROL
   * ===================================================================== */


  /** MACRO sim time (seconds). Read-only for consumers. */
  get simTime(): number {
    return this._simTime;
  }


  get macroTimeScale(): number {
    return this._macroTimeScale;
  }


  /** The celestial rail (read-only access for telemetry / tests). */
  get rail(): KeplerRail {
    return this._rail;
  }


  /**
   * Set the macro time scale (0 = paused). Throws on negative/non-finite.
   * The micro 60 Hz clock is NEVER affected (Spec 02.6: never dilate).
   */
  setTimeScale(scale: number): void {
    if (!Number.isFinite(scale) || scale < 0) {
      throw new Error(`[SimulationCore] invalid macro time scale: ${scale}`);
    }
    this._macroTimeScale = scale;
  }


  /**
   * Set MACRO sim time to an exact double and evaluate the rails
   * synchronously (plus the f32 celestial extract).
   *
   * EXACT-RESTORE CONTRACT: because rail evaluation is a pure deterministic
   * function of simTime, restoring a previously saved double reproduces
   * every celestial position BIT-IDENTICALLY. This is the hook the M1G
   * save/load pipeline will rely on.
   */
  setSimTime(t: number): void {
    if (!Number.isFinite(t)) {
      throw new Error(`[SimulationCore] invalid simTime: ${t}`);
    }
    this._simTime = t;
    this._rail.evaluate(t);
    this._extractCelestialLocals();
  }


  /**
   * Jump forward by whole sim-days. From anchor 0 this is exactly
   * bit-reversible by reverse(days) (0 + D = D and D − D = 0 are exact in
   * IEEE-754). From arbitrary anchors the ±D round trip is bounded by
   * 1 ulp of simTime (~2e-7 m of position); exact restoration from any
   * anchor is via setSimTime with a saved double. See the 1B suite.
   */
  fastForward(simDays: number): void {
    this.setSimTime(this._simTime + simDays * SECONDS_PER_DAY);
  }


  /** Jump backward by whole sim-days. May legitimately go below 0. */
  reverse(simDays: number): void {
    this.setSimTime(this._simTime - simDays * SECONDS_PER_DAY);
  }


  /* ----------------------- celestial accessors -------------------------- */


  getCelestialStates(): readonly CelestialState[] {
    return this._rail.states;
  }


  getCelestialState(id: string): CelestialState | null {
    return this._rail.getState(id);
  }


  /** Render-extract for celestials: f64 subtract, then single f32 narrowing.
   *  Zero allocation. Called from tick step (d) — always AFTER any rebase. */
  private _extractCelestialLocals(): void {
    const states = this._rail.states;
    const o = this._origin;
    for (let i = 0; i < states.length; i++) {
      const s = states[i];
      s.localPosF32[0] = s.absPos.x - o.x;
      s.localPosF32[1] = s.absPos.y - o.y;
      s.localPosF32[2] = s.absPos.z - o.z;
    }
  }


  /* =======================================================================
   * M1A — ENTITY REGISTRY (verbatim, no regression)
   * ===================================================================== */


  registerEntity(id: EntityId, options: RegisterEntityOptions): EntityState {
    if (this._entityIndex.has(id)) {
      throw new Error(`[SimulationCore] entity '${id}' is already registered`);
    }
    const absPos: Vec3f64 = {
      x: options.absPos.x,
      y: options.absPos.y,
      z: options.absPos.z,
    };
    const v = options.velocity;
    const velocity: Vec3f64 = {
      x: v !== undefined ? v.x : 0,
      y: v !== undefined ? v.y : 0,
      z: v !== undefined ? v.z : 0,
    };
    const state: EntityState = {
      id,
      absPos,
      velocity,
      localPosF32: new Float32Array(3),
      dynamic: options.dynamic !== false,
    };
    state.localPosF32[0] = absPos.x - this._origin.x;
    state.localPosF32[1] = absPos.y - this._origin.y;
    state.localPosF32[2] = absPos.z - this._origin.z;


    this._entityIndex.set(id, this._entities.length);
    this._entities.push(state);
    if (this._focusId === null) {
      this._focusId = id;
    }
    return state;
  }


  unregisterEntity(id: EntityId): boolean {
    const idx = this._entityIndex.get(id);
    if (idx === undefined) {
      return false;
    }
    const last = this._entities.length - 1;
    if (idx !== last) {
      const moved = this._entities[last];
      this._entities[idx] = moved;
      this._entityIndex.set(moved.id, idx);
    }
    this._entities.pop();
    this._entityIndex.delete(id);
    if (this._focusId === id) {
      this._focusId = this._entities.length > 0 ? this._entities[0].id : null;
    }
    return true;
  }


  setVelocity(id: EntityId, vx: number, vy: number, vz: number): boolean {
    const state = this.getEntityState(id);
    if (state === null) {
      return false;
    }
    state.velocity.x = vx;
    state.velocity.y = vy;
    state.velocity.z = vz;
    return true;
  }


  setFocusEntity(id: EntityId): void {
    if (!this._entityIndex.has(id)) {
      throw new Error(`[SimulationCore] cannot focus unknown entity '${id}'`);
    }
    this._focusId = id;
  }


  getFocusEntityId(): EntityId | null {
    return this._focusId;
  }


  getEntityState(id: EntityId): EntityState | null {
    const i = this._entityIndex.get(id);
    return i === undefined ? null : this._entities[i];
  }


  getOrigin(): Vec3f64 {
    return this._origin;
  }


  getAbsPosition(id: EntityId): Vec3f64 | null {
    const e = this.getEntityState(id);
    return e === null ? null : e.absPos;
  }


  /**
   * Unified render-extract lookup: M1A entities FIRST, then celestials.
   * (Entity precedence documented; ids are namespaced in practice.)
   * This is what lets the M1A FloatingOriginAdapter bind planets and moons
   * with ZERO changes.
   */
  getLocalPositionF32(id: EntityId): Float32Array | null {
    const i = this._entityIndex.get(id);
    if (i !== undefined) {
      return this._entities[i].localPosF32;
    }
    const c = this._celestialIndex.get(id);
    return c !== undefined ? c.localPosF32 : null;
  }


  getEntityCount(): number {
    return this._entities.length;
  }


  onRebase(listener: RebaseListener): () => void {
    this._listeners.push(listener);
    return () => {
      const i = this._listeners.indexOf(listener);
      if (i >= 0) {
        this._listeners.splice(i, 1);
      }
    };
  }


  private _emitRebase(): void {
    const listeners = this._listeners;
    for (let i = 0; i < listeners.length; i++) {
      try {
        listeners[i](this._rebaseEvent);
      } catch (err) {
        console.error('[SimulationCore] rebase listener threw', err);
      }
    }
  }


  /* ----------------------- fixed-step governor -------------------------- */


  advance(dtRealSeconds: number): void {
    if (!Number.isFinite(dtRealSeconds) || dtRealSeconds <= 0) {
      return;
    }
    const dt = dtRealSeconds > MAX_ADVANCE_DT ? MAX_ADVANCE_DT : dtRealSeconds;
    this._accumulator += dt;
    let steps = 0;
    while (this._accumulator >= FIXED_DT && steps < MAX_SUBSTEPS) {
      this.tick();
      this._accumulator -= FIXED_DT;
      steps++;
    }
    if (this._accumulator >= FIXED_DT) {
      this.stats.shedSeconds += this._accumulator;
      this._accumulator = 0;
    }
  }


  /* =======================================================================
   * THE CANONICAL FIXED TICK — dt = 1/60 s, allocation-free.
   * ===================================================================== */


  tick(): void {
    const entities = this._entities;
    const count = entities.length;
    const origin = this._origin;


    // -- STEP 1: MACRO UPDATE (Float64, closed-form Kepler rails) ----------
    // One evaluation per tick regardless of time scale (Spec 00.2): the
    // 30x (or 1000x) macro clock cannot melt the CPU because the rails are
    // analytic functions of simTime, never integrated.
    this._simTime += FIXED_DT * this._macroTimeScale;
    this._rail.evaluate(this._simTime);


    // -- (a) INTEGRATE — Float64: P <- P + V·dt ----------------------------
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      if (e.dynamic) {
        e.absPos.x += e.velocity.x * FIXED_DT;
        e.absPos.y += e.velocity.y * FIXED_DT;
        e.absPos.z += e.velocity.z * FIXED_DT;
      }
    }


    // -- (b) BUBBLE REFRESH TEST — focus entity vs the 1,024 m trigger ----
    const focus = this._focus();
    if (focus !== null) {
      sub(focus.absPos, origin, this._focusLocal);
      if (shouldRebase(this._focusLocal)) {
        // -- (c) CONDITIONAL REBASE — exact 256 m lattice Δ ---------------
        calculateOrigin(focus.absPos, this._candidateOrigin);
        const ev = this._rebaseEvent;
        copy(ev.oldOrigin, origin);
        ev.delta.x = this._candidateOrigin.x - origin.x;
        ev.delta.y = this._candidateOrigin.y - origin.y;
        ev.delta.z = this._candidateOrigin.z - origin.z;
        copy(ev.newOrigin, this._candidateOrigin);
        copy(origin, this._candidateOrigin);
        this.stats.rebaseCount++;
        ev.count = this.stats.rebaseCount;
        this._emitRebase();
      }
    }


    // -- (d) RENDER EXTRACT — p_local_f32 = Float32(P_abs − O) ------------
    // Entities first (M1A), then celestials. Celestial locals are extracted
    // HERE — after any rebase above — never during the macro step, so no
    // interleave can publish stale locals.
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      e.localPosF32[0] = e.absPos.x - origin.x;
      e.localPosF32[1] = e.absPos.y - origin.y;
      e.localPosF32[2] = e.absPos.z - origin.z;
    }
    const celestials = this._rail.states;
    for (let i = 0; i < celestials.length; i++) {
      const c = celestials[i];
      c.localPosF32[0] = c.absPos.x - origin.x;
      c.localPosF32[1] = c.absPos.y - origin.y;
      c.localPosF32[2] = c.absPos.z - origin.z;
    }


    if (focus !== null) {
      const lp = focus.localPosF32;
      const m = Math.max(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2]));
      if (m > this.stats.focusMaxLocalPostTick) {
        this.stats.focusMaxLocalPostTick = m;
      }
    }


    this.stats.tickCount++;
    this.stats.simTime += FIXED_DT; // MICRO clock — always 1× (M1A contract)
  }


  private _focus(): EntityState | null {
    if (this._focusId === null) {
      return null;
    }
    const i = this._entityIndex.get(this._focusId);
    return i === undefined ? null : this._entities[i];
  }
}
