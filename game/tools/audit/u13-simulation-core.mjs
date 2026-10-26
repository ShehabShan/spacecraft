// A1-U13 probe — SimulationCore fixed step, clocks, shedding, rebase emit (READ-ONLY audit).
// Imports the REAL core. Writes nothing. Run from game/:
//   node --expose-gc tools/audit/u13-simulation-core.mjs   (exit 0 = probe ran)
import { register } from 'node:module'
import { PerformanceObserver } from 'node:perf_hooks'
register('../ts-resolve-loader.mjs', import.meta.url)
const SC = await import('../../src/core/simulation/SimulationCore.ts')
const { SimulationCore, FIXED_DT, MAX_SUBSTEPS, MAX_ADVANCE_DT } = SC
const p = (k, v) => console.log(`${k}=${v}`)
const f = (x) => (Number.isFinite(x) ? Number(x.toPrecision(6)) : String(x))
const stubRail = () => ({ states: [], evaluate() {}, getState() { return null } })
let cOk = 0, cN = 0
const control = (name, cond) => { cN++; if (cond) cOk++; p(`control.${name}`, cond ? 'ok' : 'FAIL') }

// P1 steady 60 Hz and 144 Hz: ticks per frame histogram (render judder without interpolation)
for (const hz of [60, 75, 144, 240]) {
  const c = new SimulationCore(stubRail())
  const hist = {}
  const frames = hz * 10
  for (let i = 0; i < frames; i++) { const t0 = c.stats.tickCount; c.advance(1 / hz); const d = c.stats.tickCount - t0; hist[d] = (hist[d] || 0) + 1 }
  p(`P1.hz${hz}`, `ticks=${c.stats.tickCount} expect=600 hist=${JSON.stringify(hist)} shed=${f(c.stats.shedSeconds)}`)
}
{ const c = new SimulationCore(stubRail()); for (let i = 0; i < 600; i++) c.advance(1 / 60); control('60hz_600_ticks', Math.abs(c.stats.tickCount - 600) <= 1) }

// P2 low fps: game-time rate vs wall clock and shed accounting
for (const fps of [30, 20, 15, 12, 11, 10, 8, 5, 4, 2, 1]) {
  const c = new SimulationCore(stubRail())
  const wall = 60
  const n = Math.round(wall * fps)
  for (let i = 0; i < n; i++) c.advance(1 / fps)
  const game = c.stats.tickCount * FIXED_DT
  const lost = wall - game
  p(`P2.fps${fps}`, `ticks=${c.stats.tickCount} gameRate=${f(game / wall)} lostWall=${f(lost)} shedSeconds=${f(c.stats.shedSeconds)} unaccounted=${f(lost - c.stats.shedSeconds)}`)
}
// P2b single stall: 2 s hitch then normal frames
{ const c = new SimulationCore(stubRail()); c.advance(2.0); p('P2b.stall2s', `ticks=${c.stats.tickCount} shed=${f(c.stats.shedSeconds)} unaccounted=${f(2 - c.stats.tickCount * FIXED_DT - c.stats.shedSeconds)}`) }
// P2c a spike of 0.1 s (between 5/60 and 0.25): leftover sub-tick phase discarded?
{ const c = new SimulationCore(stubRail()); c.advance(0.1); p('P2c.spike0.1', `ticks=${c.stats.tickCount} shed=${f(c.stats.shedSeconds)}`) }
{ const c = new SimulationCore(stubRail()); c.advance(0.09); p('P2c.spike0.09', `ticks=${c.stats.tickCount} shed=${f(c.stats.shedSeconds)}`) }

// P3 clocks: macro accumulated sum vs closed form, micro vs tickCount/60
for (const [N, scale] of [[1e6, 30], [1e7, 30], [1e7, 1], [1e7, 1000]]) {
  const c = new SimulationCore(stubRail()); c.setTimeScale(scale)
  for (let i = 0; i < N; i++) c.tick()
  const exactMacro = N * scale / 60, exactMicro = N / 60
  p(`P3.N${N}.s${scale}`, `macroErr_s=${f(c.simTime - exactMacro)} microErr_s=${f(c.stats.simTime - exactMicro)} playHours=${f(N / 60 / 3600)}`)
}

// P4 pause: scale 0 still evaluates rails every tick (cost) and micro clock advances
{
  let evals = 0
  const rail = { states: [], evaluate() { evals++ }, getState() { return null } }
  const c = new SimulationCore(rail); evals = 0; c.setTimeScale(0)
  for (let i = 0; i < 100; i++) c.tick()
  p('P4.pausedEvalsPer100', `${evals} macro=${c.simTime} micro=${f(c.stats.simTime)}`)
  let threw = 0; for (const v of [-1, NaN, Infinity]) { try { c.setTimeScale(v) } catch { threw++ } }
  control('setTimeScale_rejects_3_bad', threw === 3)
  const t0 = c.stats.tickCount; for (const v of [NaN, -1, 0, Infinity]) c.advance(v)
  p('P4.badAdvanceTicks', c.stats.tickCount - t0)
}

// P5 rebase listener self-unsubscribe during emit: does the next listener get skipped?
{
  const c = new SimulationCore(stubRail())
  c.registerEntity('a', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } })
  const calls = []
  let un1
  un1 = c.onRebase(() => { calls.push('L1'); un1() })
  c.onRebase(() => calls.push('L2'))
  c.onRebase(() => calls.push('L3'))
  c.getEntityState('a').absPos.x = 5000; c.tick()
  p('P5.firstRebaseCalls', calls.join(','))
  calls.length = 0; c.getEntityState('a').absPos.x = 10000; c.tick()
  p('P5.secondRebaseCalls', calls.join(','))
  control('rebase_happened', c.stats.rebaseCount === 2)
}

// P6 direct tick() with a dynamic entity carrying velocity (moonWorld.syncEntity pattern)
{
  const c = new SimulationCore(stubRail()); c.setTimeScale(0)
  const s = c.registerEntity('astro', { absPos: { x: 1364.5, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } })
  s.absPos.x = 1364.5; s.velocity.x = 0; s.velocity.z = 6.5 // sprinting KCC velocity copied in
  c.tick()
  p('P6.directTick', `dynamic=${s.dynamic} entityMovedBy_m=${f(s.absPos.z)} tickCount=${c.stats.tickCount} micro=${f(c.stats.simTime)}`)
}

// P7 zero-GC: real rail, 1 dynamic entity, 1e6 ticks, gc entries + heap delta
{
  const c = new SimulationCore()
  c.setTimeScale(30)
  c.registerEntity('ship', { absPos: { x: 1.5e11, y: 0, z: 0 }, velocity: { x: 3000, y: 0, z: 0 } })
  for (let i = 0; i < 20000; i++) c.tick() // warm-up / tiering
  let gcs = 0
  const obs = new PerformanceObserver((l) => { gcs += l.getEntries().length }); obs.observe({ entryTypes: ['gc'] })
  globalThis.gc?.(); const h0 = process.memoryUsage().heapUsed
  const t0 = performance.now()
  for (let i = 0; i < 1e6; i++) c.tick()
  const ms = performance.now() - t0
  const h1 = process.memoryUsage().heapUsed
  await new Promise((r) => setTimeout(r, 50)); obs.disconnect()
  p('P7.zeroGC', `gcEvents=${gcs} heapDeltaNoGC_KB=${f((h1 - h0) / 1024)} usPerTick=${f(ms * 1000 / 1e6)} rebases=${c.stats.rebaseCount}`)
  // control: a deliberately allocating loop must show GC events
  let g2 = 0; const o2 = new PerformanceObserver((l) => { g2 += l.getEntries().length }); o2.observe({ entryTypes: ['gc'] })
  let sink = 0; for (let i = 0; i < 1e6; i++) { const o = { x: i, y: [i] }; sink += o.y[0] }
  await new Promise((r) => setTimeout(r, 50)); o2.disconnect()
  control('alloc_loop_gcs', g2 > 0 && sink > 0)
}

// P8 rebase vs integration order: max post-tick focus local for a fast mover (|V|·dt over trigger?)
{
  const c = new SimulationCore(stubRail()); c.setTimeScale(0)
  c.registerEntity('fast', { absPos: { x: 0, y: 0, z: 0 }, velocity: { x: 60000, y: 0, z: 0 } }) // 1000 m per tick
  for (let i = 0; i < 1000; i++) c.tick()
  p('P8.fastMover', `focusMaxLocalPostTick=${f(c.stats.focusMaxLocalPostTick)} rebases=${c.stats.rebaseCount}`)
}

p('constants', `FIXED_DT=${f(FIXED_DT)} MAX_SUBSTEPS=${MAX_SUBSTEPS} MAX_ADVANCE_DT=${MAX_ADVANCE_DT} minFpsFullSpeed=${f(1 / (MAX_SUBSTEPS * FIXED_DT))}`)
p('controls', `${cOk}/${cN}`)