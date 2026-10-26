// One-off diagnostic (scaffolding): scrape the 1E suite DOM after the run —
// per-row badge + label + FULL detail text — read-only observation.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))
page.on('console', (m) => {
  const t = m.text()
  if (t.includes('[Milestone1E]') || m.type() === 'error') console.log(`[console] ${t}`)
})

const done = page.waitForEvent('console', {
  predicate: (m) => /\[Milestone1E\] acceptance (PASSED|FAILED)/.test(m.text()),
  timeout: 120_000,
})
await page.goto('http://localhost:4173/?page=m1e', { waitUntil: 'load' })
await done
await page.waitForTimeout(1500)

const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.test-row')).map((r) => ({
    badge: r.querySelector('.badge')?.textContent?.trim(),
    label: r.querySelector('.test-label')?.textContent?.trim(),
    detail: r.querySelector('.test-detail')?.textContent?.trim(),
  })),
)
for (const r of rows) {
  console.log(`\n=== [${r.badge}] ${r.label}`)
  console.log(`    ${r.detail}`)
}
const sys = await page.evaluate(() => {
  const panels = Array.from(document.querySelectorAll('.panel'))
  const p = panels.find((x) => x.querySelector('.panel-title')?.textContent?.startsWith('ORIGIN'))
  return p?.textContent?.replace(/\s+/g, ' ') ?? ''
})
console.log(`\n[systems] ${sys}`)
await browser.close()
