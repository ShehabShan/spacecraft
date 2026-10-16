// M1D dive-timing probe (read-only): polls the FLIGHT panel through
// WARMUP→DIVE→CRUISE and records (t, SEQUENCE, countdown, MSL/AGL, GS) —
// the SEQUENCE countdown displays 45 − simElapsed during DIVE, so its
// wall-clock rate measures the harness sim clock, and the AGL at the
// DIVE→CRUISE transition distinguishes GROUNDED from CAP-TIMEOUT.
// Usage: node tools/diag-m1d-dive.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto('http://localhost:4173/?page=m1d')
await page.waitForFunction(() => document.querySelectorAll('.panel').length > 0, null, { timeout: 30_000 })

const samples = await page.evaluate(async () => {
  const out = []
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
  return out
})
for (const s of samples) console.log(`  t=${s.t}ms  [${s.seq}]  ${s.mode}  ALT=${s.alt}  v=${s.v}`)
await browser.close()
