// One-off diagnostic (scaffolding): MutationObserver on the 1D HUD's
// GL-GEOMETRIES kv + phase chip — records every commit through the run.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))

await page.addInitScript(() => {
  window.__geoSeries = []
  const install = () => {
    const panels = Array.from(document.querySelectorAll('.panel'))
    const sys = panels.find((x) => x.querySelector('.panel-title')?.textContent?.startsWith('ORIGIN'))
    const fl = panels.find((x) => x.querySelector('.panel-title')?.textContent === 'FLIGHT')
    if (!sys || !fl) {
      setTimeout(install, 200)
      return
    }
    const geoKv = Array.from(sys.querySelectorAll('.kv')).find((r) =>
      r.querySelector('.k')?.textContent?.startsWith('GL GEOMETRIES'))
    const phaseKv = fl.querySelector('.chip')
    const record = () => {
      const geo = geoKv.querySelector('.v')?.textContent?.trim()
      const phase = phaseKv?.textContent?.trim()
      const s = window.__geoSeries
      const last = s[s.length - 1]
      if (!last || last.geo !== geo || last.phase !== phase) {
        s.push({ t: performance.now().toFixed(0), geo, phase })
      }
    }
    new MutationObserver(record).observe(sys, { subtree: true, childList: true, characterData: true })
    new MutationObserver(record).observe(fl, { subtree: true, childList: true, characterData: true })
    record()
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 300))
  } else {
    setTimeout(install, 300)
  }
})

await page.goto('http://localhost:4173/?page=m1d', { waitUntil: 'load' })
await page.waitForFunction(() => {
  const panels = Array.from(document.querySelectorAll('.panel'))
  const p = panels.find((x) => x.querySelector('.panel-title')?.textContent === 'FLIGHT')
  return p?.textContent?.includes('DONE') ?? false
}, { timeout: 90_000, polling: 200 })

const series = await page.evaluate(() => window.__geoSeries ?? [])
console.log(`transitions recorded: ${series.length}`)
for (const s of series) console.log(`  t=${s.t}ms  geo=${s.geo}  phase=${s.phase}`)
await browser.close()
