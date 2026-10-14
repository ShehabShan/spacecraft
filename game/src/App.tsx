const PAGES: Array<{ id: string; label: string }> = [
  { id: 'm1a', label: 'M1A — Core F64 Skeleton & Floating Origin' },
  { id: 'm1b', label: 'M1B — Kepler Rails & Two-Tier Time' },
]

// Menu page. Links are plain <a href> so navigation is a full page load —
// required by the one-harness-per-page rule (assembly brief §3.2).
export default function App() {
  return (
    <main
      style={{
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        background: '#04070c',
        color: '#cfe0ee',
        minHeight: '100vh',
        padding: '3rem 2rem',
        lineHeight: 1.9,
      }}
    >
      <h1 style={{ color: '#7fd4ff', letterSpacing: '0.08em', fontSize: 18 }}>
        SOLARIS ENGINE — MILESTONE HARNESSES
      </h1>
      <p style={{ color: '#587187', fontSize: 12.5 }}>
        Each harness runs on its own page (full load; one module singleton per page).
      </p>
      <ul style={{ listStyle: 'none', padding: 0, fontSize: 14 }}>
        {PAGES.map((p) => (
          <li key={p.id}>
            <a href={`/?page=${p.id}`} style={{ color: '#aec6dc' }}>
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </main>
  )
}
