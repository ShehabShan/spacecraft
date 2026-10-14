import type { ComponentType } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// EXACTLY ONE harness module may execute per page (assembly brief §3.2):
// terrainField is a module singleton, each harness spawns workers nothing
// tears down, and each harness monkey-patches THREE prototypes at module
// scope. Page switching is therefore a FULL load via plain <a href="?page=…">
// links; this static map lets Vite code-split every harness into its own
// chunk so unselected modules never execute.
const pages: Record<string, () => Promise<{ default: ComponentType }>> = {
  m1a: () => import('./test/Milestone1A_TestHarness'),
}

const page = new URLSearchParams(window.location.search).get('page') ?? ''
const load = pages[page]
const root = createRoot(document.getElementById('root')!)

// NO React.StrictMode: harnesses are module singletons and StrictMode's
// double-mount corrupts them (assembly brief §3.6).
if (load) {
  load().then((mod) => root.render(<mod.default />))
} else {
  root.render(<App />)
}
