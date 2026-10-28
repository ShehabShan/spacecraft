// F2fcdb (ADR-024): the CDP driver for the rebuilt m1f R4 gate rows R4b (allocation) and R4c
// (retention). Used by e2e/m1f-r4.spec.ts and tools/test-m1f-r4-gate.mjs.
// WHY: a browser page cannot see its own transient churn (U27b2 K2a): a post-GC heap reading misses
// objects collected inside the burn. So the driver wraps the page's burn (`window.__r4.burn`) in a
// V8 sampling heap profiler that includes objects collected by minor AND major GC (same settings as
// tools/alloc-lib.mjs), and separately brackets repeated burns with forced GCs for the retained
// trend. The page owns budgets and verdicts; the driver only measures and posts.
export const R4_PLAN = { warmPure: 2000, warmRender: 200, pureN: 3000, renderN: 300, retPureN: 10000, retRenderN: 600, rounds: 3, calN: 200000, calF64N: 20000, retCalN: 20000 }

export async function driveR4(page, plan = R4_PLAN) {
  await page.waitForFunction(() => window.__r4?.ready === true, null, { timeout: 120_000 })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('HeapProfiler.enable')
  const burn = (n, render) => page.evaluate(([a, b]) => window.__r4.burn(a, b), [n, render])
  const cal = (kind, n) => page.evaluate(([a, b]) => window.__r4.cal(a, b), [kind, n])
  const total = (node) => node.selfSize + node.children.reduce((s, c) => s + total(c), 0)
  const topOf = (profile, n) => {
    const by = new Map()
    const walk = (nd) => {
      if (nd.selfSize > 0) {
        const cf = nd.callFrame
        const k = `${cf.functionName || '(anon)'}@${(cf.url || '').split('/').pop() || '?'}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`
        by.set(k, (by.get(k) ?? 0) + nd.selfSize)
      }
      nd.children.forEach(walk)
    }
    walk(profile.head)
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${(v / n).toFixed(1)} B ${k}`)
  }
  async function sampled(run) {
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 32,
      includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true })
    await run()
    const { profile } = await cdp.send('HeapProfiler.stopSampling')
    return profile
  }
  async function heapAfterGc() {
    await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage')
    return (await cdp.send('Runtime.getHeapUsage')).usedSize
  }
  // Warm the burn and the controls so tier-up/IC work is not counted as the frame's allocation.
  await burn(plan.warmPure, false); await burn(plan.warmRender, true)
  for (let i = 0; i < 5; i++) { await cal('noop', 1e5); await cal('obj3', 1e5); await cal('f64x16', 1e4) }
  const per = async (kind, n) => total((await sampled(() => cal(kind, n))).head) / n
  const calib = { noop: await per('noop', plan.calN), obj3: await per('obj3', plan.calN), f64x16: await per('f64x16', plan.calF64N) }
  const pPure = await sampled(() => burn(plan.pureN, false))
  const pRender = await sampled(() => burn(plan.renderN, true))
  const allocPure = total(pPure.head) / plan.pureN, allocRender = total(pRender.head) / plan.renderN
  const top = [...topOf(pPure, plan.pureN).map((s) => `pure ${s}`), ...topOf(pRender, plan.renderN).map((s) => `render ${s}`)]
  // Retention: control first (a known retained object per iteration), then the burns.
  let h0 = await heapAfterGc(); await cal('leak', plan.retCalN)
  const retCal = ((await heapAfterGc()) - h0) / plan.retCalN
  await cal('leakclear', 0)
  const trend = async (n, render) => {
    // WHY: the first render round retained ~37 B/frame (lazy renderer caches filling) and then
    // decayed to 8.7 and 2.2 (F2fcdb run 1). One unmeasured round warms them up before the trend.
    await burn(n, render)
    const out = []
    for (let r = 0; r < plan.rounds; r++) { h0 = await heapAfterGc(); await burn(n, render); out.push(((await heapAfterGc()) - h0) / n) }
    return out
  }
  const retPure = await trend(plan.retPureN, false)
  const retRender = await trend(plan.retRenderN, true)
  const m = { cal: calib, allocPure, allocRender, pureN: plan.pureN, renderN: plan.renderN, top,
    retCal, retPure, retRender, retPureN: plan.retPureN, retRenderN: plan.retRenderN }
  await page.evaluate((x) => window.__r4.post(x), m)
  await cdp.detach()
  return m
}