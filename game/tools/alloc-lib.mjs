// Shared allocation-gate instrument (ADR-002 / ADR-003): V8 sampling heap profiler with
// objects collected by minor AND major GC included, plus a gc-bracketed retained clause.
// WHY: post-GC heap deltas cannot see transient churn (A1-U09-1, U27b2). Used by
// tools/test-alloc-loops.mjs; tools/test-alloc-gate.mjs carries the same logic inline
// (F1ba) and is folded onto this module when the harness rows are retired (F1bc).
import inspector from 'node:inspector/promises'
import v8 from 'node:v8'

export const ALLOC_BUDGET_B_PER_FRAME = 64
export const RETAIN_BUDGET_B_PER_FRAME = 8

// WHY (F1bc, ADR-004): the retained clause counts the JS-object heap only. code_space and
// trusted_space hold JIT code + bytecode/feedback metadata that V8 tiering adds after a
// workload switch and frees later (walk→idle read 6–10 B/frame there; old_space 0.12).
// A per-frame object leak lands in new/old space and is still counted.
const CODE_SPACES = new Set(['code_space', 'code_large_object_space', 'trusted_space',
  'trusted_large_object_space', 'shared_trusted_space', 'shared_trusted_large_object_space'])
export function objectHeapUsed() {
  let s = 0
  for (const sp of v8.getHeapSpaceStatistics()) if (!CODE_SPACES.has(sp.space_name)) s += sp.space_used_size
  return s
}

export async function createInstrument({ bundleUrl, modOf }) {
  const session = new inspector.Session(); session.connect()
  await session.post('HeapProfiler.enable')
  async function sampled(fn) {
    await session.post('HeapProfiler.startSampling', { samplingInterval: 32,
      includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
    fn()
    const { profile } = await session.post('HeapProfiler.stopSampling')
    return profile
  }
  function attribute(profile) {
    const byFn = new Map(); let total = 0
    const walk = (n, bf) => {
      const cf = n.callFrame
      const b = cf.url === bundleUrl ? `${modOf(cf.lineNumber)}:${cf.functionName || '(anon)'}@${cf.lineNumber + 1}` : bf
      if (n.selfSize > 0) {
        total += n.selfSize
        const k = b ?? `(outside bundle) ${cf.functionName || '(anon)'}`
        byFn.set(k, (byFn.get(k) ?? 0) + n.selfSize)
      }
      for (const c of n.children) walk(c, b)
    }
    walk(profile.head, null)
    return { total, byFn }
  }
  async function measure(step, { N, warm = 2000, rounds = 3 }) {
    for (let i = 0; i < warm; i++) step()
    const a = attribute(await sampled(() => { for (let i = 0; i < N; i++) step() }))
    const raw = []
    for (let r = 0; r < rounds; r++) {
      globalThis.gc(); globalThis.gc()
      const h0 = objectHeapUsed()
      for (let i = 0; i < N; i++) step()
      globalThis.gc(); globalThis.gc()
      raw.push((objectHeapUsed() - h0) / N)
    }
    const sorted = [...raw].sort((x, y) => x - y)
    const allocB = a.total / N, retainedB = sorted[Math.floor(sorted.length / 2)]
    const verdict = allocB <= ALLOC_BUDGET_B_PER_FRAME && retainedB <= RETAIN_BUDGET_B_PER_FRAME ? 'PASS' : 'FAIL'
    const top = [...a.byFn.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => `${(v / N).toFixed(1)} B ${k}`)
    return { allocB, retainedB, retainedRaw: raw, verdict, top }
  }
  // calibration against known allocation rates (exit-2 material if broken)
  async function calibrate() {
    const ring = new Array(16)
    const ctlNoop = (n) => { let s = 0; for (let i = 0; i < n; i++) s += Math.sqrt(i); return s }
    const ctlObj = (n) => { for (let i = 0; i < n; i++) ring[i & 15] = { x: i, y: i, z: i } }
    const ctlF64 = (n) => { for (let i = 0; i < n; i++) ring[i & 15] = new Float64Array(16) }
    for (let i = 0; i < 5; i++) { ctlNoop(1e5); ctlObj(1e5); ctlF64(1e4) }
    const pr = await sampled(() => { ctlNoop(2e5); ctlObj(2e5); ctlF64(2e4) })
    const want = (name) => { let s = 0; const w = (n) => { if (n.callFrame.functionName === name) s += n.selfSize; n.children.forEach(w) }; w(pr.head); return s }
    const cal = { noop: want('ctlNoop') / 2e5, obj3: want('ctlObj') / 2e5, f64x16: want('ctlF64') / 2e4 }
    cal.ok = cal.noop < 0.5 && cal.obj3 >= 16 && cal.obj3 <= 64 && cal.f64x16 >= 128
    return cal
  }
  return { sampled, attribute, measure, calibrate }
}

// known-bad frame wrappers (plain objects: the sampler under-counts typed-array payloads)
const churnRing = new Array(8)
const leakBox = []
export function withMutant(step, mutant) {
  if (mutant === 'churn') return () => { step(); for (let k = 0; k < 4; k++) churnRing[k] = { x: k, y: k, z: k } }
  if (mutant === 'leak') return () => { step(); leakBox.push({ a: 0, b: 0 }) }
  return step
}