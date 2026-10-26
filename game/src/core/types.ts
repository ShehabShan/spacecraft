/**
 * ============================================================================
 *  CORE TYPES — PURE FLOAT64 SIMULATION DOMAIN
 *  Milestone 1A · Spec 00.3 / 01.1
 * ============================================================================
 *  HARD BOUNDARY (Spec 01.1): nothing under src/core/ may import from
 *  'three', 'react', '@react-three/fiber', '@react-three/rapier' or any other
 *  renderer/physics library. The simulation core is pure TypeScript running
 *  on 64-bit doubles.
 *
 *  Data leaves this domain in exactly three forms:
 *    (a) plain numbers (origin components, stats),
 *    (b) core-owned Float32Array(3) render-extract buffers (written by the
 *        core each tick at canonical step 8, read-only for consumers),
 *    (c) the reused RebaseEvent (consumed synchronously).
 */


/** Entity handle. Opaque string key, stable for the entity's lifetime. */
export type EntityId = string;


/**
 * Minimal 3-component double-precision vector. Deliberately a plain object:
 * monomorphic shapes, hidden-class friendly, and free of any library type.
 */
export interface Vec3f64 {
  x: number;
  y: number;
  z: number;
}


/**
 * Per-entity simulation state. Every field is OWNED and mutated in place by
 * the SimulationCore — the Zero-GC mandate means these objects are allocated
 * once at registration and never replaced.
 */
export interface EntityState {
  id: EntityId;


  /** Absolute position in the Sun frame, metres, Float64. Core-written. */
  absPos: Vec3f64;


  /** Absolute velocity, m/s, Float64. Core-written when dynamic. */
  velocity: Vec3f64;


  /**
   * LOCAL Float32 render coordinates relative to the floating origin
   * (canonical tick step 8 / Phase-2 step (d)):
   *     localPosF32[i] = Float32(absPos[i] - origin[i])
   * The subtraction happens in Float64; the typed-array store performs the
   * single, lattice-lossless narrowing to Float32. NEVER the reverse order.
   *
   * Allocated exactly once at registration. Written for EVERY entity on
   * EVERY tick — static entities included — so consumers never need to
   * apply per-object delta translation after a rebase: locals are simply
   * recomputed against the new origin.
   */
  localPosF32: Float32Array;


  /**
   * Dynamic entities integrate P += V·dt each tick. Static entities only
   * get their local coordinates refreshed (their locals still change when
   * the origin shifts — that is correct and expected).
   */
  dynamic: boolean;
}


/**
 * Emitted after every origin shift.
 *
 * ZERO-GC CONTRACT: the SimulationCore reuses ONE pre-allocated event object
 * for the entire session. Listeners must consume it synchronously and copy
 * any field they intend to retain past the callback.
 *
 * FUTURE HOOK (Spec 00.4): `delta` is the exact translation that later
 * milestones will apply to Rapier bodies and procedural chunk origins
 * (Spec 01.1 step 4) — bit-exact in f32 by the power-of-two lattice proof.
 */
export interface RebaseEvent {
  oldOrigin: Vec3f64;
  newOrigin: Vec3f64;
  /** newOrigin − oldOrigin. Always an exact multiple of 256 m per axis. */
  delta: Vec3f64;
  /** 1-based ordinal of this rebase since core construction. */
  count: number;
}


export type RebaseListener = (event: RebaseEvent) => void;


/**
 * Live counters. Mutated in place by the core every tick — read-only for
 * consumers. Kept as a plain object so reads are allocation-free.
 */
export interface SimulationStats {
  /** Fixed ticks executed (1 tick = 1/60 s). */
  tickCount: number;
  /** Total origin shifts since construction. */
  rebaseCount: number;
  /** Accumulated simulated seconds (sum of the fixed dt). Float64. */
  simTime: number;
  /**
   * Running maximum, over all ticks so far, of the FOCUS entity's largest
   * local-axis magnitude — sampled from the Float32 buffer AFTER step (d).
   * Structurally bounded by the 1,024 m trigger:
   *   no rebase this tick  -> max-axis local <= 1024 (strict trigger),
   *   rebase this tick     -> max-axis local <= 128 (half the 256 m lattice).
   */
  focusMaxLocalPostTick: number;
  /**
   * Simulated seconds deliberately discarded by the fixed-step governor once
   * the 5-substep budget is exhausted (Spec 02.6: shed load, never dilate).
   */
  shedSeconds: number;
}
