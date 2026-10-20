// T1 B5b: DOM-event → §10.2 event glue (plan §10.2, K3, K11). InputState owns
// keys/mouse; this module owns the events that change the PHASE and are not
// input: lock acquired/lost, lock refused, tab hidden, context lost, worker
// error. Targets are injectable so test-play-shell runs it on a fake DOM.
import type { PlayStoreState } from './playStore';
import type { InputState } from '../input/InputState';

export interface EvTarget {
  addEventListener(type: string, fn: (ev: any) => void): void;
  removeEventListener(type: string, fn: (ev: any) => void): void;
}
export interface ShellDoc extends EvTarget {
  pointerLockElement: unknown;
  visibilityState: string;
}
export interface ShellTargets {
  canvas: EvTarget;
  doc: ShellDoc;
  /** Terrain workers; an `error` on any of them is fatal (§10.2). */
  workers?: readonly EvTarget[];
}
export interface PlayStoreLike { getState(): PlayStoreState }

/** Attaches the listeners; returns the detach function (unmount). */
export function attachShellRuntime(t: ShellTargets, input: InputState, store: PlayStoreLike,
  now: () => number = () => performance.now()): () => void {
  const { canvas, doc } = t;
  const workers = t.workers ?? [];
  const onLock = (): void => {
    store.getState().dispatch(doc.pointerLockElement === canvas ? 'lockAcquired' : 'lockLost', now());
  };
  const onLockError = (): void => { store.getState().dispatch('lockError', now()); };
  const onVis = (): void => {
    if (doc.visibilityState !== 'hidden') return;
    store.getState().dispatch('hidden', now());
    // WHY: a hidden tab pauses AND releases the lock, so the player resumes
    // through the same click path as after Esc (K3).
    input.exitLock();
  };
  const onCtxLost = (ev: { preventDefault?: () => void }): void => {
    ev?.preventDefault?.();
    store.getState().dispatch('fatal', now(), 'WebGL context lost');
    input.exitLock();
  };
  const onWorkerError = (ev: { message?: string }): void => {
    store.getState().dispatch('fatal', now(), `Terrain worker error${ev?.message ? ': ' + ev.message : ''}`);
    input.exitLock();
  };
  doc.addEventListener('pointerlockchange', onLock);
  doc.addEventListener('pointerlockerror', onLockError);
  doc.addEventListener('visibilitychange', onVis);
  canvas.addEventListener('webglcontextlost', onCtxLost);
  for (const w of workers) w.addEventListener('error', onWorkerError);
  return () => {
    doc.removeEventListener('pointerlockchange', onLock);
    doc.removeEventListener('pointerlockerror', onLockError);
    doc.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('webglcontextlost', onCtxLost);
    for (const w of workers) w.removeEventListener('error', onWorkerError);
  };
}