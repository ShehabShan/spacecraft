// One-off diagnostic v3 (scaffolding): the 1B suite starts (chip RUNNING)
// but never finishes and logs nothing — grab the main-thread stack via CDP
// pause to locate the exact hang.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
page.on('console', (m) => console.log(`[${m.type()}] ${m.text().slice(0, 300)}`))
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`))
await page.goto('http://localhost:4173/?page=m1b', { waitUntil: 'load' })
await page.waitForTimeout(6000) // suite auto-runs at ~0.75 s; freeze should be active

const cdp = await page.context().newCDPSession(page)
await cdp.send('Debugger.enable')
const paused = new Promise((resolve) => {
  cdp.on('Debugger.paused', (ev) => resolve(ev))
})
// Prove the main thread is really blocked: a trivial evaluate must time out.
const responsive = await Promise.race([
  page.evaluate(() => 1 + 1).then(() => 'RESPONSIVE'),
  new Promise((r) => setTimeout(() => r('BLOCKED'), 3000)),
])
console.log(`[main thread] ${responsive}`)
await cdp.send('Debugger.pause')
const ev = await Promise.race([
  paused,
  new Promise((r) => setTimeout(() => r(null), 5000)),
])
if (ev === null) {
  console.log('[cdp] no pause event — thread not blockable?')
} else {
  console.log('[cdp] call stack at freeze:')
  for (const f of ev.callFrames.slice(0, 12)) {
    console.log(`  ${f.functionName || '(anon)'}  ${f.url.split('/').pop()}:${f.location.lineNumber + 1}`)
  }
  await cdp.send('Debugger.resume').catch(() => {})
}
await browser.close()
