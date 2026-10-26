/**
 * ============================================================================
 *  GAME STORE — UI TELEMETRY & TEST LIFECYCLE (ZUSTAND)
 *  Milestone 1A
 * ============================================================================
 *  DECOUPLING CONTRACT (protects the 60 Hz loop from React):
 *
 *  1. The simulation/frame loop NEVER reads from or writes to React state on
 *     a per-frame basis. The only store writes in existence are:
 *       (a) the throttled telemetry publisher — hard-capped at 10 Hz,
 *       (b) the one-shot completeTest() lifecycle write.
 *  2. The HUD subscribes with narrow selectors (object identity for the
 *     telemetry snapshot), so it re-renders at most 10x per second. The 3D
 *     scene has ZERO reactive bindings — every transform flows imperatively
 *     through FloatingOriginAdapter inside useFrame, which runs before
 *     renderer.render (Spec 04.2 doctrine).
 *  3. Allocation accounting: ~10 small snapshot objects per second at the
 *     sanctioned UI boundary (versus 60+ if unthrottled). The sim core, the
 *     rebase path, and the render-extract pass allocate zero bytes per frame.
 */


import { create } from 'zustand';
import type { Vec3f64 } from '../core/types';


/** Snapshot published at most 10x per second. Values copied, refs never shared. */
export interface TelemetrySnapshot {
  fps: number;
  frameMsAvg: number;
  frameMsMax: number;
  absPos: Vec3f64;
  localPos: Vec3f64;
  origin: Vec3f64;
  rebaseCount: number;
  speed: number;
  simTime: number;
  tickCount: number;
}


export type TestId =
  | 'abs-distance'
  | 'local-bound'
  | 'rebase-count'
  | 'delta-lattice'
  | 'frame-stability';


export interface TestResult {
  pass: boolean;
  detail: string;
}


export type TestPhase = 'RUNNING' | 'COMPLETE';


interface GameStore {
  telemetry: TelemetrySnapshot;
  testPhase: TestPhase;
  testResults: Partial<Record<TestId, TestResult>>;
  setTelemetry: (snapshot: TelemetrySnapshot) => void;
  completeTest: (results: Record<TestId, TestResult>) => void;
}


const INITIAL_TELEMETRY: TelemetrySnapshot = {
  fps: 0,
  frameMsAvg: 0,
  frameMsMax: 0,
  absPos: { x: 0, y: 0, z: 0 },
  localPos: { x: 0, y: 0, z: 0 },
  origin: { x: 0, y: 0, z: 0 },
  rebaseCount: 0,
  speed: 0,
  simTime: 0,
  tickCount: 0,
};


export const useGameStore = create<GameStore>((set) => ({
  telemetry: INITIAL_TELEMETRY,
  testPhase: 'RUNNING',
  testResults: {},
  setTelemetry: (telemetry) => set({ telemetry }),
  completeTest: (testResults) => set({ testResults, testPhase: 'COMPLETE' }),
}));


/* -- Narrow selectors (re-render scope control) --------------------------- */


export const selectTelemetry = (s: GameStore) => s.telemetry;
export const selectTestPhase = (s: GameStore) => s.testPhase;
export const selectTestResults = (s: GameStore) => s.testResults;


/* ---------------------------------------------------------------------------
 * THROTTLED TELEMETRY PUBLISHER — <= 10 Hz hard ceiling.
 *
 * The publish() signature is deliberately all-scalars: the caller (frame
 * loop) passes raw numbers read from the core's zero-allocation getters, so
 * the call itself allocates nothing. A snapshot object is built ONLY when
 * the 100 ms floor is met. Returns true when the snapshot was published so
 * the caller can reset its windowed FPS accumulators without polling.
 * ------------------------------------------------------------------------- */


export interface TelemetryPublisher {
  publish(
    fps: number,
    frameMsAvg: number,
    frameMsMax: number,
    absX: number, absY: number, absZ: number,
    localX: number, localY: number, localZ: number,
    originX: number, originY: number, originZ: number,
    rebaseCount: number,
    speed: number,
    simTime: number,
    tickCount: number,
  ): boolean;
}


export function createTelemetryPublisher(minIntervalMs = 100): TelemetryPublisher {
  let lastPublishMs = Number.NEGATIVE_INFINITY;
  return {
    publish(
      fps, frameMsAvg, frameMsMax,
      absX, absY, absZ,
      localX, localY, localZ,
      originX, originY, originZ,
      rebaseCount, speed, simTime, tickCount,
    ): boolean {
      const now = performance.now();
      if (now - lastPublishMs < minIntervalMs) {
        return false;
      }
      lastPublishMs = now;
      useGameStore.getState().setTelemetry({
        fps,
        frameMsAvg,
        frameMsMax,
        absPos: { x: absX, y: absY, z: absZ },
        localPos: { x: localX, y: localY, z: localZ },
        origin: { x: originX, y: originY, z: originZ },
        rebaseCount,
        speed,
        simTime,
        tickCount,
      });
      return true;
    },
  };
}
