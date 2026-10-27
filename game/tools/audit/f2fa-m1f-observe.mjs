// F2fa observer (read-only): run the UNEDITED m1f page of one commit's worktree
// with a long verdict wait. Why: at 3057899^ (c0ae8bf) the shipped spec's 240 s
// budget expired before the harness logged a verdict, so the spec cannot answer
// the bisect question there. This observer builds that worktree, serves it with
// `vite preview`, opens `?page=m1f` in headless Chrome (the same channel and
// headless mode as the shipped playwright.config), and waits up to WAIT seconds
// for `[Milestone1F] acceptance PASSED|FAILED`. It edits nothing in the worktree.
// It prints: progress (phase chip every 30 s), `verdict <line> after <s> s`,
// `badges [...]` and one `detail Rn: ...` line per row.
// Usage: node tools/audit/f2fa-m1f-observe.mjs <worktree>/game <port> <waitSeconds>
// Exit 0 = verdict captured (an observation, not a passing gate); 1 = none.
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const [DIR, PORT = '4180', WAIT = '1200'] = process.argv.slice(2)
if (!DIR) { console.error('usage: <worktree>/game <port> <waitSeconds>'); process.exit(2) }
const waitMs = Number(WAIT) * 1000

const b = spawnSync('npx', ['vite', 'build'], { cwd: DIR, encoding: 'utf8' })
console.log(`build EXIT=${b.status}`)
if (b.status !== 0) { console.log(b.stderr.slice(-2000)); process.exit(1) }

const srv = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], { cwd: DIR, detached: true, stdio: 'ignore' })
const stop = () => { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
let code = 1
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch {}
    if (i > 120) throw new Error('preview server did not start')
    await new Promise((r) => setTimeout(r, 500))
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()
  const lines = []
  page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
  page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
  const t0 = Date.now()
  const verdict = page.waitForEvent('console', {
    predicate: (m) => /\[Milestone1F\] acceptance (PASSED|FAILED)/.test(m.text()), timeout: waitMs,
  }).then((m) => m.text()).catch(() => null)
  await page.goto(`http://localhost:${PORT}/?page=m1f`)
  const tick = setInterval(async () => {
    try {
      const chip = await page.locator('.chip').first().textContent({ timeout: 2000 })
      console.log(`progress t=${((Date.now() - t0) / 1000).toFixed(0)} s chip=${chip}`)
    } catch {}
  }, 30_000)
  const line = await verdict
  clearInterval(tick)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  if (line) {
    await page.waitForTimeout(1500)
    console.log(`verdict ${line} after ${secs} s`)
    console.log(`badges ${JSON.stringify(await page.locator('.badge').allTextContents())}`)
    const det = await page.locator('.test-detail').allTextContents()
    det.forEach((d, i) => console.log(`detail R${i + 1}: ${d}`))
    code = 0
  } else {
    console.log(`verdict NONE after ${secs} s`)
  }
  console.log('console tail:'); for (const l of lines.slice(-15)) console.log(`  ${l}`)
  await browser.close()
} catch (e) {
  console.log(`error ${e.message}`)
} finally { stop() }
process.exit(code)