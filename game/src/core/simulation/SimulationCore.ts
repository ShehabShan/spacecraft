/**
 * ============================================================================
 *  SIMULATION CORE — PURE TYPESCRIPT, FLOAT64, ZERO-GC FIXED TICK
 *  Milestone 1A · Spec 00.3, 01.1 (canonical tick order), 02.6 (substeps)
 * ============================================================================
 *  Pure core: this file must never import three / react / rapier.
 *
 *  CANONICAL TICK ORDER (Spec 01.1) — M1A-implemented subset, per Phase 2:
 *    step (a)  Integrate: P += V·dt in Float64        [01.1 step 5 stand-in]
 *    step (b)  Bubble refresh test (focus vs 1,024 m) [01.1 step 2]
 *    step (c)  Conditional rebase (exact 256 m Δ)     [01.1 step 4]
 *    step (d)  Render extract: f32 locals, all entities [01.1 step 8]
 *
 *  DORMANT BY DESIGN — no stubs written (Spec 05 pacing):
 *    [01.1 step 1] Macro Kepler rails ........ M1B
 *    [01.1 step 3] Parented state compose .... M1E
 *    [01.1 step 6] Rapier physics step ....... M1D+
 *    [01.1 step 7] f32 -> f64 write-back ..... M1D+
 *
 *  ZERO-GC AUDIT of tick(): field writes on owned objects, writes into
 *  boot-allocated scratch vectors, one pre-allocated (reused) RebaseEvent,
 *  stores into boot-allocated Float32Array buffers, indexed for-loops over
 *  dense arrays (no iterators, no closures, no spreads). Allocation count
 *  per tick: 0. The only allocations this class ever performs happen inside
 *  registerEntity / onRebase (setup paths).
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


/** Fixed logic timestep (Spec 02.6): 1 tick = 1/60 game-seconds. */
export const FIXED_DT = 1 / 60;
/** Max fixed ticks per rendered frame (Spec 02.6): shed load, never dilate. */
export const MAX_SUBSTEPS = 5;
/** Wall-clock clamp per advance() call — tab-switch / stall guard. */
export const MAX_ADVANCE_DT = 0.25;


export interface RegisterEntityOptions {
  /** Absolute spawn position, Sun frame, metres. Cloned into core storage. */
  absPos: Vec3f64;
  /** Initial absolute velocity, m/s. Defaults to (0,0,0). */
  velocity?: Vec3f64;
  /** Dynamic entities integrate; static entities only refresh locals. Default true. */
  dynamic?: boolean;
}


export class SimulationCore {
  /* -------------------------------------------------------------------------
   * Entity storage — dense array + index map. Grown only by registerEntity
   * (setup path). The tick iterates by index: Map iteration allocates an
   * iterator object per call and is therefore banned in the hot loop.
   * ---------------------------------------------------------------------- */
  private _entities: EntityState[] = [];
  private _entityIndex = new Map<EntityId, number>();


  /**
   * The entity whose local coordinates drive the rebase trigger (Spec 01.1
   * step 2: "the PLAYER has crossed a 256 m lattice boundary"). Static
   * world entities may legitimately carry locals far beyond 1,024 m — only
   * the focus entity's bound is guaranteed.
   */
  private _focusId: EntityId | null = null;


  /** Current floating origin, Sun frame, Float64. Exact multiple of 256 m. */
  private _origin: Vec3f64 = { x: 0, y: 0, z: 0 };


  /* -------------------------------------------------------------------------
   * Pre-allocated scratch — created once at construction, reused every tick.
   * ---------------------------------------------------------------------- */
  /** focus.absPos − origin, recomputed each tick (Float64 only). */
  private _focusLocal: Vec3f64 = { x: 0, y: 0, z: 0 };
  /** Candidate origin during step (c). */
  private _candidateOrigin: Vec3f64 = { x: 0, y: 0, z: 0 };


  /** THE single reused event (Zero-GC). See types.ts contract. */
  private readonly _rebaseEvent: RebaseEvent = {
    oldOrigin: { x: 0, y: 0, z: 0 },
    newOrigin: { x: 0, y: 0, z: 0 },
    delta: { x: 0, y: 0, z: 0 },
    count: 0,
  };


  /** Listener registry. Mutated only via onRebase (setup/teardown path). */
  private _listeners: RebaseListener[] = [];


  /** Fixed-step governor accumulator (wall-clock seconds). */
  private _accumulator = 0;


  /** Live telemetry. Mutated in place; treat as read-only. */
  public readonly stats: SimulationStats = {
    tickCount: 0,
    rebaseCount: 0,
    simTime: 0,
    focusMaxLocalPostTick: 0,
    shedSeconds: 0,
  };


  /* -------------------------------------------------------------------------
   * Entity registry — registering / updating / removing (setup paths)
   * ---------------------------------------------------------------------- */


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
      // The ONE per-entity allocation of the entire session (Zero-GC mandate).
      localPosF32: new Float32Array(3),
      dynamic: options.dynamic !== false,
    };
    // Seed locals immediately so the render side has valid data before the
    // first tick (f64 subtraction, then the store narrows to f32).
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


  /** Swap-remove keeps the dense array compact with no per-tick cost. */
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


  /** Update an entity's velocity in place (writes into owned storage). */
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


  /* -------------------------------------------------------------------------
   * Zero-allocation getters.
   * READ-ONLY CONTRACT: these return internal live references so that hot
   * consumers never allocate. Callers must treat the returned objects and
   * typed arrays as frozen; the core is the sole writer.
   * ---------------------------------------------------------------------- */


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


  getLocalPositionF32(id: EntityId): Float32Array | null {
    const e = this.getEntityState(id);
    return e === null ? null : e.localPosF32;
  }


  getEntityCount(): number {
    return this._entities.length;
  }


  /* -------------------------------------------------------------------------
   * Rebase event system
   * ---------------------------------------------------------------------- */


  /** Subscribe; returns an unsubscribe function. Setup/teardown path only. */
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
      // try/catch is free in V8 when nothing throws; it protects later
      // listeners from a broken one.
      try {
        listeners[i](this._rebaseEvent);
      } catch (err) {
        console.error('[SimulationCore] rebase listener threw', err);
      }
    }
  }


  /* -------------------------------------------------------------------------
   * FIXED-STEP GOVERNOR (Spec 02.6)
   * Accumulates wall-clock time, runs whole 1/60 s ticks, hard-caps at 5
   * substeps per frame. If still behind after the budget, the backlog is
   * SHED (counted in stats.shedSeconds) — the timestep is never dilated and
   * the loop can never death-spiral.
   * ---------------------------------------------------------------------- */


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
      // Over budget: discard the pending backlog rather than dilating time.
      this.stats.shedSeconds += this._accumulator;
      this._accumulator = 0;
    }
  }


  /* -------------------------------------------------------------------------
   * THE CANONICAL FIXED TICK — dt = 1/60 s, allocation-free.
   * ---------------------------------------------------------------------- */


  tick(): void {
    const entities = this._entities;
    const count = entities.length;
    const origin = this._origin;


    // -- (a) INTEGRATE — Float64: P <- P + V·dt ----------------------------
    // M1A stand-in for the dynamics stages; forces & the Rapier step arrive
    // in later milestones and are intentionally absent here.
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      if (e.dynamic) {
        e.absPos.x += e.velocity.x * FIXED_DT;
        e.absPos.y += e.velocity.y * FIXED_DT;
        e.absPos.z += e.velocity.z * FIXED_DT;
      }
    }


    // -- (b) BUBBLE REFRESH TEST — focus entity vs the 1,024 m trigger ----
    // Local coordinates are computed AND tested in Float64. Never narrow
    // before the subtraction — that is where precision dies (see the proof
    // in precisionMath.ts).
    const focus = this._focus();
    if (focus !== null) {
      sub(focus.absPos, origin, this._focusLocal);
      if (shouldRebase(this._focusLocal)) {
        // -- (c) CONDITIONAL REBASE — exact 256 m lattice Δ ---------------
        // Degenerate rebases are impossible: |P − O| > 1024 implies the
        // nearest lattice point to P is NOT O, so Δ ≠ 0 always.
        calculateOrigin(focus.absPos, this._candidateOrigin);
        const ev = this._rebaseEvent;
        copy(ev.oldOrigin, origin);
        // Δ = O_new − O_old: exact in f64 AND bit-exact after fround (proof
        // in precisionMath.ts). This is the value future milestones will use
        // to translate Rapier bodies and chunk origins.
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
    // Recomputed for EVERY entity (statics included) on EVERY tick, so the
    // render side never has to apply per-object delta translation after a
    // rebase — it just reads fresh, already-correct locals.
    for (let i = 0; i < count; i++) {
      const e = entities[i];
      // Float64 subtraction first; the typed-array store performs the single
      // correctly-rounded narrowing to Float32.
      e.localPosF32[0] = e.absPos.x - origin.x;
      e.localPosF32[1] = e.absPos.y - origin.y;
      e.localPosF32[2] = e.absPos.z - origin.z;
    }


    // Track the focus bound from the f32 buffer (post-tick sample — the
    // value the acceptance invariant governs).
    if (focus !== null) {
      const lp = focus.localPosF32;
      const m = Math.max(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2]));
      if (m > this.stats.focusMaxLocalPostTick) {
        this.stats.focusMaxLocalPostTick = m;
      }
    }


    this.stats.tickCount++;
    this.stats.simTime += FIXED_DT;
  }


  /** Resolve the focus entity (null when the registry is empty). */
  private _focus(): EntityState | null {
    if (this._focusId === null) {
      return null;
    }
    const i = this._entityIndex.get(this._focusId);
    return i === undefined ? null : this._entities[i];
  }
}
