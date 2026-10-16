// M1F details probe (read-only): after the suite settles, scrape the five
// .test-row badge + label + detail strings verbatim from the DOM — the
// per-row evidence the routing needs (R3 clause numbers, R5 numbers).
// Usage: node tools/diag-m1f-details.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))

await page.goto('http://localhost:4173/?page=m1f')
await page.waitForFunction(
  () => {
    const bs = document.querySelectorAll('.badge')
    return bs.length === 5 && [...bs].every((b) => b.textContent !== '·····')
  },
  null,
  { timeout: 240_000, polling: 1000 },
)
const rows = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.test-row')).map((r) => ({
    badge: r.querySelector('.badge')?.textContent?.trim(),
    label: r.querySelector('.test-label')?.textContent?.trim(),
    detail: r.querySelector('.test-detail')?.textContent?.trim(),
  })),
)
const chip = await page.evaluate(() => document.querySelector('.panel .chip')?.textContent?.trim())
for (const r of rows) {
  console.log(`\n=== ${r.badge} — ${r.label}`)
  console.log(`    ${r.detail}`)
}
console.log(`\nsuite chip: ${chip}`)
console.log('console tail:')
for (const l of lines.slice(-8)) console.log(`  ${l}`)
await browser.close()
