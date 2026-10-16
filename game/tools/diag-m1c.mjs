// One-off diagnostic v3 (scaffolding): F10b verification + the 145/146
// geometry investigation. Reads R3F state via the React fiber on #root.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()

await page.addInitScript(() => {
  const st = { reqs: [], resps: [], maxBatch: 0 }
  window.__w = st
  const origPost = Worker.prototype.postMessage
  Worker.prototype.postMessage = function (msg, transfer) {
    if (msg && msg.t === 'req') {
      const n = msg.a?.[0] ?? 0
      if (n > st.maxBatch) st.maxBatch = n
      st.reqs.push(n)
    }
    return origPost.call(this, msg, transfer)
  }
  const d = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')
  Object.defineProperty(Worker.prototype, 'onmessage', {
    set(fn) {
      const w = this
      d.set.call(this, (ev) => {
        const m = ev.data
        if (m && (m.t === 'chunk' || m.t === 'drop')) st.resps.push(m.t)
        return fn.call(w, ev)
      })
    },
    get() { return d.get.call(this) },
  })
})

page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))
await page.goto('http://localhost:4173/?page=m1c', { waitUntil: 'load' })

// --- sample HUD + worker stats for 40 s -----------------------------------
const kv = (title, k) => {
  const p = Array.from(document.querySelectorAll('.panel')).find((x) =>
    x.querySelector('.panel-title')?.textContent?.startsWith(title))
  const row = p && Array.from(p.querySelectorAll('.kv')).find((r) =>
    r.querySelector('.k')?.textContent?.startsWith(k))
  return row ? row.querySelector('.v')?.textContent : '?'
}
for (let t = 5; t <= 40; t += 5) {
  await page.waitForTimeout(5000)
  const d = await page.evaluate(`(() => {
    const kv = ${kv.toString()}
    return {
      phase: kv('FLIGHT','SPEED') ,
      act: kv('CHUNK STREAMING','ACTIVE /'), rate: kv('CHUNK STREAMING','WORKER TRANSFER'),
      wfree: kv('CHUNK STREAMING','WORKER FREE'), swaps: kv('CHUNK STREAMING','BUFFER'),
      pairs: kv('SEAM AUDIT','EDGE'), par: kv('SEAM AUDIT','PARENT'), rt: kv('SEAM AUDIT','SPHERIFY'),
    }
  })()`)
  console.log(
    `[${t}s] act/pending/free=${d.act} recv=${d.rate} wfree=${d.wfree} | ` +
    `seam pairs=${d.pairs} parentVerts=${d.par} rt=${d.rt}`,
  )
}
const w = await page.evaluate(() => window.__w)
console.log(`[F10b] req msgs=${w.reqs.length} chunks req'd=${w.reqs.reduce((s, n) => s + n, 0)} maxBatch=${w.maxBatch} resps=${w.resps.length} drops=${w.resps.filter((r) => r === 'drop').length}`)

// --- 145/146 experiment: which static never registered? --------------------
const exp = await page.evaluate(async () => {
  const rootEl = document.getElementById('root')
  const ckey = Object.keys(rootEl).find((k) => k.startsWith('__reactContainer$'))
  if (!ckey) return { error: 'no react container key' }
  // find a fiber with stateNode.__r3f to reach the store
  let store = null
  const seen = new Set()
  const stack = [rootEl[ckey]]
  while (stack.length && !store) {
    const f = stack.pop()
    if (!f || seen.has(f)) continue
    seen.add(f)
    const sn = f.stateNode
    if (sn && sn.__r3f && sn.__r3f.root && sn.__r3f.root.getState) {
      store = sn.__r3f.root.getState()
      break
    }
    for (const k of ['child', 'sibling', 'return']) if (f[k]) stack.push(f[k])
  }
  if (!store) return { error: 'no r3f store found' }
  const { gl, scene } = store
  const out = { total: gl.info.memory.geometries, statics: [], steps: [] }
  scene.traverse((o) => {
    if (o.geometry) out.statics.push({ type: o.type, geo: o.geometry.uuid, vis: o.visible })
  })
  out.uniqueGeos = new Set(out.statics.map((s) => s.geo)).size
  out.meshCount = out.statics.length
  // identify the two boot statics under the primitive group: a Mesh with
  // SphereGeometry-ish (shell) and a Points (stars)
  let shell = null, stars = null, poolMeshes = []
  scene.traverse((o) => {
    if (o.type === 'Points') stars = o
    else if (o.type === 'Mesh' && o.parent === scene || (o.type === 'Mesh' && o.parent?.type === 'Group' && o.parent?.parent === scene)) {
      // could be pool mesh (parent scene) or shell (parent sceneRoot group)
    }
  })
  scene.traverse((o) => { if (o.type === 'Mesh') poolMeshes.push(o) })
  // shell = the Mesh whose geometry uuid appears once among meshes with a GROUP parent; pool meshes are scene children
  shell = poolMeshes.find((m) => m.parent !== scene && m.parent?.type === 'Group')
  poolMeshes = poolMeshes.filter((m) => m !== shell)
  out.found = { shell: !!shell, stars: !!stars, pool: poolMeshes.length, shellParent: shell?.parent?.type }
  const test = async (obj, name) => {
    for (const m of poolMeshes) m.visible = false
    if (shell && shell !== obj) shell.visible = false
    if (stars && stars !== obj) stars.visible = false
    obj.visible = true
    await new Promise((r) => setTimeout(r, 300)) // several rAF renders
    const n = gl.info.memory.geometries
    out.steps.push(`${name}-only render -> geometries=${n}`)
    return n
  }
  const before = gl.info.memory.geometries
  if (stars) { const n = await test(stars, 'stars'); out.starsBumped = n > before }
  // restore all, then test shell
  for (const m of poolMeshes) m.visible = true
  if (stars) stars.visible = true
  const before2 = gl.info.memory.geometries
  if (shell) { const n = await test(shell, 'shell'); out.shellBumped = n > before2 }
  for (const m of poolMeshes) m.visible = true
  if (shell) shell.visible = true
  if (stars) stars.visible = true
  return out
})
console.log('[145/146]', JSON.stringify(exp, null, 1))
await browser.close()
