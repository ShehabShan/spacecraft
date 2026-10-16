// M1D dive-timing probe (read-only): polls the FLIGHT panel through
// WARMUP→DIVE→CRUISE and records (t, SEQUENCE, countdown, MSL/AGL, GS) —
// the SEQUENCE countdown displays 45 − simElapsed during DIVE, so its
// wall-clock rate measures the harness sim clock, and the AGL at the
// DIVE→CRUISE transition distinguishes GROUNDED from CAP-TIMEOUT.
// Usage: node tools/diag-m1d-dive.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'

// E-1: DIAG_CHROME_ARGS lets the same read-only probe test a
// hardware-accelerated launch (e.g. '--use-angle=vulkan') without touching
// the pinned playwright config (which E-1 forbids editing).
const EXTRA_ARGS = (process.env.DIAG_CHROME_ARGS ?? '').split(' ').filter(Boolean)
if (EXTRA_ARGS.length > 0) console.log(`launch args: ${EXTRA_ARGS.join(' ')}`)
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: EXTRA_ARGS })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto('http://localhost:4173/?page=m1d')
await page.waitForFunction(() => document.querySelectorAll('.panel').length > 0, null, { timeout: 30_000 })

const samples = await page.evaluate(async () => {
  const out = []
  let rafCount = 0
  let rafing = true
  const rafLoop = () => { if (rafing) { rafCount++; requestAnimationFrame(rafLoop) } }
  requestAnimationFrame(rafLoop)
  const rafT0 = performance.now()
  let renderer = null
  try {
    const c = document.querySelector('canvas')
    const gl2 = c?.getContext('webgl2') ?? c?.getContext('webgl')
    if (gl2 !== null && gl2 !== undefined) {
      const ext = gl2.getExtension('WEBGL_debug_renderer_info')
      renderer = ext !== null
        ? gl2.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl2.getParameter(gl2.RENDERER)
    }
  } catch { renderer = 'unavailable' }
  const read = () => {
    const panels = Array.from(document.querySelectorAll('.panel'))
    const fl = panels.find((x) => x.querySelector('.panel-title')?.textContent === 'FLIGHT')
    if (!fl) return null
    const kv = Object.fromEntries(
      Array.from(fl.querySelectorAll('.kv')).map((r) => [
        r.querySelector('.k')?.textContent?.trim(), r.querySelector('.v')?.textContent?.trim(),
      ]),
    )
    const mode = fl.querySelector('.chip')?.textContent?.trim() ?? ''
    return {
      t: performance.now().toFixed(0), seq: kv['SEQUENCE'] ?? '', mode,
      alt: kv['ALT MSL / AGL'] ?? '', v: kv['AIRSPEED / GS'] ?? '',
    }
  }
  for (let i = 0; i < 1200; i++) {
    const s = read()
    if (s !== null) {
      const last = out[out.length - 1]
      const cruiseCount = out.filter((x) => x.seq.startsWith('CRUISE')).length
      if (!last || last.seq !== s.seq || i % 5 === 0 || cruiseCount < 5) out.push(s)
      if (cruiseCount >= 8) break
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  rafing = false
  const fpsMean = (rafCount * 1000) / Math.max(1, performance.now() - rafT0)
  return { out, renderer, fpsMean, fpsN: rafCount }
})
console.log(`WEBGL UNMASKED_RENDERER: ${samples.renderer}`)
console.log(`mean FPS on ?page=m1d: ${Number.isFinite(samples.fpsMean) ? samples.fpsMean.toFixed(1) : 'n/a'} (${samples.fpsN} frames)`)
for (const s of samples.out) console.log(`  t=${s.t}ms  [${s.seq}]  ${s.mode}  ALT=${s.alt}  v=${s.v}`)
await browser.close()
