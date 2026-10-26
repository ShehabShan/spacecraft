// M1F browser probe (read-only): after the suite settles, inspect the rig
// module singletons in the LIVE page — camera projection/matrix health,
// driver pose NaN scan, per-pass draw-call stats across frames, and the
// frustum test of a point 5 m dead-ahead of each camera.
// Usage: node tools/diag-m1f-browser.mjs   (expects dev server on :4174)
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))

await page.goto('http://localhost:4174/?page=m1f')
// wait until all 5 badges have evaluated (suite done)
await page.waitForFunction(
  () => {
    const bs = document.querySelectorAll('.badge')
    return bs.length === 5 && [...bs].every((b) => b.textContent !== '·····')
  },
  null,
  { timeout: 240_000, polling: 1000 },
)
console.log('[probe] suite done; inspecting rig module singletons')

const report = await page.evaluate(async () => {
  const rig = await import('/src/render/MultiCameraRig.tsx')
  const { rigCamNear, rigCamMid, rigCamFar, RIG } = rig
  const out = {}
  out.driver = { ...RIG.driver }
  out.driverNaN = ['x', 'y', 'z', 'qx', 'qy', 'qz', 'qw'].some((k) => !Number.isFinite(RIG.driver[k]))
  // manual mat4 apply (column-major, like three): out = M·v with w-divide
  const apply = (e, x, y, z) => {
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12]
    const cy = e[1] * x + e[5] * y + e[9] * z + e[13]
    const cz = e[2] * x + e[6] * y + e[10] * z + e[14]
    const cw = e[3] * x + e[7] * y + e[11] * z + e[15]
    return cw === 0 ? { x: cx, y: cy, z: cz, w: cw } : { x: cx / cw, y: cy / cw, z: cz / cw, w: cw }
  }
  out.cameras = {}
  for (const [name, c] of [['near', rigCamNear], ['mid', rigCamMid], ['far', rigCamFar]]) {
    const pe = [...c.projectionMatrix.elements]
    const mw = [...c.matrixWorld.elements]
    const mwi = [...c.matrixWorldInverse.elements]
    const fwd = [-mw[8], -mw[9], -mw[10]]
    const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1
    const p5 = apply(pe, ...(() => {
      const v = apply(mwi, c.position.x + (fwd[0] / fl) * 5, c.position.y + (fwd[1] / fl) * 5, c.position.z + (fwd[2] / fl) * 5)
      return [v.x, v.y, v.z]
    })())
    out.cameras[name] = {
      aspect: c.aspect, near: c.near, far: c.far,
      projNaN: pe.some((x) => Number.isNaN(x)),
      matrixNaN: mw.some((x) => Number.isNaN(x)),
      proj00: pe[0], proj11: pe[5],
      point5mAhead: { x: +p5.x.toFixed(3), y: +p5.y.toFixed(3), z: +p5.z.toFixed(3) },
      layersMask: c.layers.mask,
    }
  }
  // sample per-pass stats across 6 frames
  out.statSamples = []
  for (let i = 0; i < 6; i++) {
    await new Promise((r) => setTimeout(r, 120))
    out.statSamples.push({
      far: RIG.stats.farCalls, mid: RIG.stats.midCalls, near: RIG.stats.nearCalls,
      passRenders: RIG.stats.passRenders,
    })
  }
  const canvas = document.querySelector('canvas')
  out.canvas = canvas ? { w: canvas.clientWidth, h: canvas.clientHeight } : null
  out.badges = [...document.querySelectorAll('.badge')].map((b) => b.textContent)
  return out
})
console.log(JSON.stringify(report, null, 2))
console.log('[probe] console tail:')
for (const l of lines.slice(-6)) console.log(`  ${l}`)
await browser.close()
