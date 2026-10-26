// T1 B5c: the DOM layer over the canvas (plan §10.1). Picks the overlay for
// the current phase; PLAYING shows the HUD (B10). Clicks call
// InputState.requestLock() inside the user gesture — the resulting
// pointerlockchange drives the phase through shellRuntime (§10.2).
import { usePlayStore } from './playStore';
import type { InputState } from '../input/InputState';
import { Hud } from './Hud';
import { ClickToPlayOverlay, ErrorOverlay, LoadingOverlay, PauseOverlay } from './Overlays';

export function PlayShell({ input }: { input: InputState }) {
  const phase = usePlayStore((s) => s.phase);
  const loadProgress = usePlayStore((s) => s.loadProgress);
  const loadTimedOut = usePlayStore((s) => s.loadTimedOut);
  const lockHint = usePlayStore((s) => s.lockHint);
  const pausedAtMs = usePlayStore((s) => s.pausedAtMs);
  const errorText = usePlayStore((s) => s.errorText);
  const lock = (): void => input.requestLock();
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