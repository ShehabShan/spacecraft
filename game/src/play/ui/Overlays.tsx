// T1 B5c: the four shell overlays (plan §10.1–§10.4). Pure presentation: each
// overlay reads only the props PlayShell passes from usePlayStore; actions go
// back through callbacks (lock request, reload). The frame loop never touches
// React — the store is the only bridge (§4.2).
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

/** Re-lock refusal window after an exit (Chrome ≈ 1 s, §10.2 / K3). */
export const RESUME_COOLDOWN_MS = 1000;

const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const backdrop: CSSProperties = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 14,
  color: '#dfe9f3', fontFamily: FONT, fontSize: 14, textAlign: 'center',
  background: 'rgba(2, 6, 12, 0.55)', userSelect: 'none',
};
const title: CSSProperties = { fontSize: 22, letterSpacing: 2 };
const btn: CSSProperties = {
  fontFamily: FONT, fontSize: 14, padding: '8px 22px', color: '#0b1520',
  background: '#aec6dc', border: 'none', borderRadius: 4, cursor: 'pointer',
};
const note: CSSProperties = { fontSize: 12, color: '#8fa6bb' };

export const CONTROLS_HINT =
  'WASD move · Shift sprint · Space jump · C crouch · V camera · R respawn · H HUD · Esc/P pause';

function Panel({ phase, children, onClick }: { phase: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div data-overlay={phase} style={{ ...backdrop, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {children}
    </div>
  );
}

export function LoadingOverlay({ progress }: { progress: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return (
    <Panel phase="LOADING">
      <div style={title}>Loading moon…</div>
      <div style={{ width: 260, height: 6, background: '#1d2a37', borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#aec6dc', borderRadius: 3 }} />
      </div>
      <div style={note}>terrain {pct}%</div>
    </Panel>
  );
}

export function ClickToPlayOverlay({ timedOut, lockHint, onPlay }:
  { timedOut: boolean; lockHint: boolean; onPlay: () => void }) {
  return (
    <Panel phase="CLICK_TO_PLAY" onClick={onPlay}>
      <div style={title}>Click to play</div>
      <div style={note}>{CONTROLS_HINT}</div>
      {timedOut && <div style={note}>Terrain is still streaming — distant detail may pop in.</div>}
      {lockHint && <div style={note}>The browser refused the mouse lock — click again.</div>}
    </Panel>
  );
}

const perfNow = (): number => performance.now();

export function PauseOverlay({ pausedAtMs, lockHint, onResume, now = perfNow }:
  { pausedAtMs: number; lockHint: boolean; onResume: () => void; now?: () => number }) {
  const [ready, setReady] = useState(() => now() - pausedAtMs >= RESUME_COOLDOWN_MS);
  useEffect(() => {
    // WHY: Chrome refuses requestPointerLock for ~1 s after an exit; a Resume
    // click inside that window would fail with pointerlockerror, so the button
    // stays disabled until the cool-down measured from pausedAtMs ends (K3).
    const left = RESUME_COOLDOWN_MS - (now() - pausedAtMs);
    if (left <= 0) { setReady(true); return; }
    setReady(false);
    const id = setTimeout(() => setReady(true), left);
    return () => clearTimeout(id);
  }, [pausedAtMs, now]);
  return (
    <Panel phase="PAUSED">
      <div data-paused-at={pausedAtMs} style={title}>Paused</div>
      <button data-resume style={{ ...btn, opacity: ready ? 1 : 0.45, cursor: ready ? 'pointer' : 'default' }}
        disabled={!ready} onClick={(e) => { e.stopPropagation(); if (ready) onResume(); }}>
        Resume
      </button>
      {lockHint && <div style={note}>Click again to resume.</div>}
      <div style={note}>{CONTROLS_HINT}</div>
      <a href="/" style={{ color: '#aec6dc', fontSize: 12 }}>← menu</a>
    </Panel>
  );
}

export function ErrorOverlay({ text }: { text: string }) {
  return (
    <Panel phase="ERROR">
      <div style={title}>Something went wrong</div>
      <div style={note}>{text || 'Unknown error'}</div>
      <button style={btn} onClick={() => window.location.reload()}>Reload</button>
      <a href="/" style={{ color: '#aec6dc', fontSize: 12 }}>← menu</a>
    </Panel>
  );
}