// F2fcea self-test (ADR-025): builds the game, serves it, and runs ?page=m1fR5
// unmutated (R5a must PASS) and with each mutant (R5a must turn red for the named reason).
// Run from game/: node tools/test-m1f-r5-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4185'
const ROW = 'R5a rebase lattice on a continuous route'
const CASES = [
  { mut: '', want: 'PASS', reason: /fails: \[\];/, verdict: 'PASSED' },
  // nadir = route stops at the shipped SAT_B nadir arc (A1-U03-5): fewer than 2 shifts
  { mut: 'nadir', want: 'FAIL', reason: /shifts 0 < 2/, verdict: 'FAILED' },
  // skew = rebase listener nudges the writable origin by 1 m (A1-U11-3)
  { mut: 'skew', want: 'FAIL', reason: /origin ≠ oracle on \d+ ticks; origin off-lattice/, verdict: 'FAILED' },
  // teleport = 300 m jump mid-route
  { mut: 'teleport', want: 'FAIL', reason: /world step > sprint·dt on 1 ticks/, verdict: 'FAILED' },
]
const b = spawnSync('npx', ['vite', 'build'], { encoding: 'utf8' })
console.log(`build EXIT=${b.status}`)
if (b.status !== 0) { console.log(b.stderr.slice(-2000)); process.exit(1) }
const srv = spawn('npx', ['vite', 'preview', '--port', PORT, '--strictPort'], { detached: true, stdio: 'ignore' })
let ok = true
try {
  for (let i = 0; ; i++) {
    try { if ((await fetch(`http://localhost:${PORT}/`)).ok) break } catch {}
    if (i > 120) throw new Error('preview server did not start')
    await new Promise((r) => setTimeout(r, 500))
  }
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  for (const c of CASES) {
    const page = await browser.newPage()
    const lines = [], errors = []
    page.on('console', (m) => { if (m.text().startsWith('[M1fR5Gate]')) lines.push(m.text()); if (m.type() === 'error') errors.push(m.text()) })
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR5Gate\] acceptance/.test(m.text()), timeout: 60_000 }).then((m) => m.text()).catch(() => 'NONE')
    await page.goto(`http://localhost:${PORT}/?page=m1fR5${c.mut ? `&mut=${c.mut}` : ''}`)
    const verdict = await v
    const row = lines.find((l) => l.startsWith(`[M1fR5Gate] ${ROW}: `)) ?? ''
    const good = verdict.includes(`acceptance ${c.verdict}`) && row.startsWith(`[M1fR5Gate] ${ROW}: ${c.want}`) && c.reason.test(row) && errors.length === 0
    console.log(`case mut=${c.mut || 'none'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'}`)
    lines.forEach((l) => console.log(`  ${l}`)); errors.forEach((l) => console.log(`  ERROR ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)