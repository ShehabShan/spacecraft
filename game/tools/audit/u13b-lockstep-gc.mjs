// A1-U13 probe part 2 — controller vs core accumulator lockstep; per-tick allocation isolation (READ-ONLY).
// Run from game/:  node --expose-gc tools/audit/u13b-lockstep-gc.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts')
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(5)) : String(x))
const stubRail = () => ({ states: [], evaluate() {}, getState() { return null } })
// Verbatim copy of PlayerController.simulate accumulator logic (PlayerController.ts:75-90 @ 75f43fe)
const ctrlAcc = () => { let acc = 0; return (dt, max = 5) => { if (!(dt > 0)) return 0; const T = 1 / 60; acc += dt > 0.25 ? 0.25 : dt; let n = 0; while (acc >= T - 1e-9 && n < max) { acc -= T; n++ } if (acc >= T) acc = 0; if (acc < 0) acc = 0; return n } }
const runs = {
  hz144: () => 1 / 144,
  hz120: () => 1 / 120,
  hz90: () => 1 / 90,
  hz60: () => 1 / 60,
  rAF144q: (i) => (Math.round((i + 1) * 1000 / 144 * 10) - Math.round(i * 1000 / 144 * 10)) / 10000, // 0.1 ms quantised timestamps
  rAF60jit: (i) => (16.6667 + ((i * 7919) % 11 - 5) * 0.2) / 1000,
}
for (const [name, gen] of Object.entries(runs)) {
  const c = new SimulationCore(stubRail()); const ctl = ctrlAcc()
  let diffFrames = 0, maxLag = 0, lag = 0, frames = 36000
  for (let i = 0; i < frames; i++) { const dt = gen(i); const t0 = c.stats.tickCount; const nc = ctl(dt); c.advance(dt); const nk = c.stats.tickCount - t0; if (nc !== nk) diffFrames++; lag += nc - nk; if (Math.abs(lag) > maxLag) maxLag = Math.abs(lag) }
  p(`L.${name}`, `frames=${frames} mismatchFrames=${diffFrames} (${f(100 * diffFrames / frames)}%) finalLag=${lag} maxLag=${maxLag}`)
}
// GC isolation: which tick component allocates?
async function measure(label, c, n = 1e6) {
  for (let i = 0; i < 20000; i++) c.tick()
  globalThis.gc(); let g = 0; const o = new PerformanceObserver((l) => { g += l.getEntries().length }); o.observe({ entryTypes: ['gc'] })
  const h0 = process.memoryUsage().heapUsed
  for (let i = 0; i < n; i++) c.tick()
  const h1 = process.memoryUsage().heapUsed
  await new Promise((r) => setTimeout(r, 50)); o.disconnect()
  p(`G.${label}`, `gcEvents=${g} heapDelta_KB=${f((h1 - h0) / 1024)} bytesPerTick=${f((h1 - h0) / n)} rebases=${c.stats.rebaseCount}`)
}
{ const c = new SimulationCore(stubRail()); await measure('stubRail_noEntity', c) }
{ const c = new SimulationCore(stubRail()); c.registerEntity('e', { absPos: { x: 10, y: 0, z: 0 }, velocity: { x: 1, y: 0, z: 0 } }); await measure('stubRail_entity_noRebase', c) }
{ const c = new SimulationCore(stubRail()); c.registerEntity('e', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: 3000, y: 0, z: 0 } }); await measure('stubRail_entity_rebases', c) }
{ const c = new SimulationCore(); c.setTimeScale(30); await measure('realRail_noEntity', c) }
{ const c = new SimulationCore(); c.setTimeScale(0); await measure('realRail_paused', c) }
{ // control: empty loop must show ~0
  globalThis.gc(); let g = 0; const o = new PerformanceObserver((l) => { g += l.getEntries().length }); o.observe({ entryTypes: ['gc'] })
  const h0 = process.memoryUsage().heapUsed; let s = 0; for (let i = 0; i < 1e6; i++) s += i; const h1 = process.memoryUsage().heapUsed
  await new Promise((r) => setTimeout(r, 50)); o.disconnect(); p('G.control_emptyLoop', `gcEvents=${g} heapDelta_KB=${f((h1 - h0) / 1024)} s=${s > 0}`)
}