// T1 B5c: the DOM layer over the canvas (plan §10.1). Picks the overlay for
// the current phase; PLAYING shows the HUD (B10). Clicks call
// InputState.requestLock() inside the user gesture — the resulting
// pointerlockchange drives the phase through shellRuntime (§10.2).
import { useEffect } from 'react';
import { usePlayStore } from './playStore';
import type { InputState } from '../input/InputState';
import { Hud } from './Hud';
import { ClickToPlayOverlay, ErrorOverlay, LoadingOverlay, PauseOverlay } from './Overlays';

// WHY (T1 B12, Q6): `?autoplay=1` is the test mode for e2e/play.spec.ts.
// Headless browsers cannot reliably grant pointer lock, so a test could not
// leave CLICK_TO_PLAY. Read once at module load; without the parameter
// nothing below runs and the shell is unchanged.
const AUTOPLAY: boolean = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('autoplay') === '1';

export function PlayShell({ input }: { input: InputState }) {
  const phase = usePlayStore((s) => s.phase);
  const loadProgress = usePlayStore((s) => s.loadProgress);
  const loadTimedOut = usePlayStore((s) => s.loadTimedOut);
  const lockHint = usePlayStore((s) => s.lockHint);
  const pausedAtMs = usePlayStore((s) => s.pausedAtMs);
  const errorText = usePlayStore((s) => s.errorText);
  const lock = (): void => input.requestLock();
  useEffect(() => {
    if (!AUTOPLAY || phase !== 'CLICK_TO_PLAY') return;
    // WHY (B12): autoplay stands in for a granted lock. It marks the input
    // as locked so keys are read (§9.1), then sends the same §10.2 event a
    // real pointerlockchange would send. It runs once, from CLICK_TO_PLAY only.
    input.pointerLocked = true;
    usePlayStore.getState().dispatch('lockAcquired', performance.now());
  }, [phase, input]);
  return (
    // WHY: data-phase is the stable hook check-play-b5 reads; pointer events
    // pass through to the canvas only while PLAYING (no overlay mounted).
    <div data-phase={phase} style={{ position: 'absolute', inset: 0, pointerEvents: phase === 'PLAYING' ? 'none' : 'auto' }}>
      {phase === 'PLAYING' && <Hud />}
      {phase === 'LOADING' && <LoadingOverlay progress={loadProgress} />}
      {phase === 'CLICK_TO_PLAY' && <ClickToPlayOverlay timedOut={loadTimedOut} lockHint={lockHint} onPlay={lock} />}
      {phase === 'PAUSED' && <PauseOverlay pausedAtMs={pausedAtMs} lockHint={lockHint} onResume={lock} />}
      {phase === 'ERROR' && <ErrorOverlay text={errorText} />}
    </div>
  );
}