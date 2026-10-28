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
  m1b: () => import('./test/Milestone1B_TestHarness'),
  m1c: () => import('./test/Milestone1C_TestHarness'),
  m1d: () => import('./test/Milestone1D_TestHarness'),
  m1e: () => import('./test/Milestone1E_TestHarness'),
  m1f: () => import('./test/Milestone1F_TestHarness'),
  m1fR2: () => import('./test/M1fR2Gate'), // F2fcab rebuilt R2 gate (ADR-021)
  m1fR1: () => import('./test/M1fR1Gate'), // F2fcb rebuilt R1 gate (ADR-022)
  m1fR3: () => import('./test/M1fR3Gate'), // F2fccba rebuilt R3 gate (ADR-023)
  m1fR4: () => import('./test/M1fR4Gate'), // F2fcda rebuilt R4 gate (ADR-024)
  play: () => import('./play/PlayPage'),
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
