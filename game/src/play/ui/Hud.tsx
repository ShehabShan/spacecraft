// T1 B10: the in-play HUD (plan §10.5). Pure presentation over usePlayStore:
// `hud` arrives at ≤ 10 Hz from HudPublisher (stage 11), `hudVisible` is the
// H toggle. Every element is pointer-events: none so the canvas keeps clicks.
import type { CSSProperties } from 'react';
import { usePlayStore } from './playStore';
import { CONTROLS_HINT } from './Overlays';

const FONT = 'ui-monospace, Menlo, Consolas, monospace';
const base: CSSProperties = {
  position: 'absolute', pointerEvents: 'none', userSelect: 'none', fontFamily: FONT,
  fontSize: 13, color: '#dfe9f3', textShadow: '0 1px 2px rgba(0,0,0,0.9)', whiteSpace: 'pre',
};
const hintStyle: CSSProperties = {
  ...base, bottom: 18, left: '50%', transform: 'translateX(-50%)', fontSize: 12,
  color: '#aec6dc', background: 'rgba(2, 6, 12, 0.45)', padding: '5px 12px', borderRadius: 4,
  transition: 'opacity 0.8s',
};
const statusStyle: CSSProperties = { ...base, bottom: 18, left: 18 };
const debugStyle: CSSProperties = { ...base, top: 14, right: 16, textAlign: 'right', fontSize: 12, color: '#b9c9d8' };
const dotStyle: CSSProperties = {
  ...base, top: '50%', left: '50%', width: 4, height: 4, marginLeft: -2, marginTop: -2,
  borderRadius: 2, background: 'rgba(223, 233, 243, 0.85)',
};

export function Hud() {
  const hud = usePlayStore((s) => s.hud);
  const debug = usePlayStore((s) => s.hudVisible);
  return (
    <div data-hud style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div data-hud-hint style={{ ...hintStyle, opacity: hud.hintOn ? 1 : 0 }}>{CONTROLS_HINT}</div>
      <div data-hud-status style={statusStyle}>
        {hud.speed.toFixed(1)} m/s · <span data-hud-state>{hud.state}</span> · {hud.grounded ? 'grounded' : 'airborne'}
      </div>
      {debug && (
        <div data-hud-debug style={debugStyle}>
          {`${hud.fps.toFixed(0)} FPS\nlat ${hud.lat.toFixed(2)}°  lon ${hud.lon.toFixed(2)}°\nAGL ${hud.altAGL.toFixed(2)} m`}
        </div>
      )}
      {hud.firstPerson && <div data-hud-dot style={dotStyle} />}
    </div>
  );
}