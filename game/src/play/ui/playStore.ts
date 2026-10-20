// T1 play shell store (plan §4.2, §5.2, §10.2; B5a). React READS this store;
// the frame loop writes it through usePlayStore.getState() and never reads
// React state. The §10.2 phase table is the pure function nextPhase() so the
// machine is testable headless (test-play-shell) and has ONE source of truth.
import { create } from 'zustand';

export type PlayPhase = 'LOADING' | 'CLICK_TO_PLAY' | 'PLAYING' | 'PAUSED' | 'ERROR'; // ERROR: §10.2 amendment

/** Shell events — one per §10.2 table row. */
export type PlayEvent =
  | 'ready'        // loading gate satisfied (§10.3)
  | 'timeout'      // loadTimeoutS elapsed while LOADING
  | 'lockAcquired' // pointerlockchange, lock = canvas
  | 'lockLost'     // pointerlockchange, lock released (Esc, alt-tab, browser UI)
  | 'pauseKey'     // P edge
  | 'hidden'       // visibilitychange → hidden
  | 'lockError'    // pointerlockerror
  | 'fatal';       // webglcontextlost or worker error

export interface PlayHud {
  speed: number; state: string; grounded: boolean; fps: number;
  lat: number; lon: number; altAGL: number;
}

/**
 * §10.2 transition table. Any (phase, event) pair not listed returns the
 * input phase unchanged — e.g. a lock acquired while LOADING is ignored, so
 * nothing outside the table is reachable. ERROR is terminal in V1.
 */
export function nextPhase(p: PlayPhase, e: PlayEvent): PlayPhase {
  if (p === 'ERROR') return 'ERROR';
  if (e === 'fatal') return 'ERROR';
  switch (p) {
    case 'LOADING':
      return e === 'ready' || e === 'timeout' ? 'CLICK_TO_PLAY' : p;
    case 'CLICK_TO_PLAY':
      return e === 'lockAcquired' ? 'PLAYING' : p;
    case 'PLAYING':
      return e === 'lockLost' || e === 'pauseKey' || e === 'hidden' ? 'PAUSED' : p;
    case 'PAUSED':
      // lockError stays PAUSED (the overlay shows "Click again to resume").
      return e === 'lockAcquired' ? 'PLAYING' : p;
  }
  return p;
}

export function makeHud(): PlayHud {
  return { speed: 0, state: 'Idle', grounded: true, fps: 0, lat: 0, lon: 0, altAGL: 0 };
}

export interface PlayStoreState {
  phase: PlayPhase;
  loadProgress: number;     // [0, 1] — residentAround fraction (§10.3)
  loadTimedOut: boolean;    // CLICK_TO_PLAY reached by timeout → "terrain still streaming"
  lockHint: boolean;        // last resume attempt hit pointerlockerror
  pausedAtMs: number;       // performance.now() when PAUSED was entered (1.0 s Resume cool-down)
  errorText: string;
  hudVisible: boolean;      // H toggles the HUD (§10.5; B5b)
  hud: PlayHud;
  /** Applies one §10.2 event; returns the resulting phase. */
  dispatch(e: PlayEvent, nowMs?: number, detail?: string): PlayPhase;
  setPhase(p: PlayPhase): void;
  setLoad(p: number): void;
  setHud(h: PlayHud): void;
  toggleHud(): void;
  reset(): void;
}

const INITIAL = {
  phase: 'LOADING' as PlayPhase, loadProgress: 0, loadTimedOut: false, lockHint: false,
  pausedAtMs: 0, errorText: '', hudVisible: true,
};

export const usePlayStore = create<PlayStoreState>((set, get) => ({
  ...INITIAL,
  hud: makeHud(),
  dispatch(e, nowMs = 0, detail = '') {
    const s = get();
    const to = nextPhase(s.phase, e);
    if (to === s.phase) {
      if (e === 'lockError' && to === 'PAUSED' && !s.lockHint) set({ lockHint: true });
      return to;
    }
    // WHY: one set() per transition (setPhase is the only unthrottled write,
    // §5.2); side-fields ride in the same update so React renders once.
    if (to === 'PAUSED') set({ phase: to, pausedAtMs: nowMs, lockHint: false });
    else if (to === 'CLICK_TO_PLAY') set({ phase: to, loadTimedOut: e === 'timeout' });
    else if (to === 'ERROR') set({ phase: to, errorText: detail });
    else set({ phase: to, lockHint: false });
    return to;
  },
  setPhase(p) { if (get().phase !== p) set({ phase: p }); },
  setLoad(p) { if (get().loadProgress !== p) set({ loadProgress: p }); },
  setHud(h) { set({ hud: h }); },
  toggleHud() { set({ hudVisible: !get().hudVisible }); },
  reset() { set({ ...INITIAL, hud: makeHud() }); },
}));