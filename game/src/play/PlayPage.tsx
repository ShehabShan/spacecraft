// T1 play page, B1 stub: route + chunk only. The world, Canvas and shell
// arrive in B4/B5 (§12). Nothing under src/play may import the harness tree
// (src/test, §4.1) — the K10 leakage grep in §15.3 enforces it.
export default function PlayPage(): JSX.Element {
  return (
    <main style={{ position: 'fixed', inset: 0, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 16, background: '#04070c', color: '#cfe0ee',
      fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
      <div style={{ color: '#7fd4ff', letterSpacing: '0.08em' }}>
        SOLARIS — PLAY (booting…)
      </div>
      <a href="/" style={{ color: '#aec6dc' }}>← menu</a>
    </main>
  )
}