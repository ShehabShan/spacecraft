// M1D details probe (read-only): after the suite settles, scrape the five
// .test-row badge + label + detail strings verbatim from the DOM.
// Usage: node tools/diag-m1d-details.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`))

await page.goto('http://localhost:4173/?page=m1d')
await page.waitForFunction(
  () => {
    const bs = document.querySelectorAll('.badge')
    return bs.length === 5 && [...bs].every((b) => b.textContent !== '·····')
  },
  null,
  { timeout: 120_000, polling: 1000 },
)
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.test-row')).map((r) => ({
    badge: r.querySelector('.badge')?.textContent?.trim(),
    label: r.querySelector('.test-label')?.textContent?.trim(),
    detail: r.querySelector('.test-detail')?.textContent?.trim(),
  })),
)
for (const r of rows) {
  console.log(`\n=== ${r.badge} — ${r.label}`)
  console.log(`    ${r.detail}`)
}
await browser.close()
