// F2fccba self-test (ADR-023): builds the game, serves it, and runs ?page=m1fR3 unmutated
// (must be the pinned known-red R3a FAIL) and with the test-only positive control ?ctl=ref
// (must turn R3a PASS, proving the row can go green). F2fccbb adds R3b/R3c and the mutants
// meshhide/noimp/shift/scale/bright.
// Run from game/: node tools/test-m1f-r3-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4183'
const CASES = [
  { q: '', expect: { 'R3a state-coupled sweep': 'FAIL' }, verdict: 'FAILED', detail: /down: \d+ holes in \[220000, 2256\d\d\] m; up: 0 holes;/ },
  { q: 'ctl=ref', expect: { 'R3a state-coupled sweep': 'PASS' }, verdict: 'PASSED', detail: /down: 0 holes; up: 0 holes; 0 doubles; 21 flips/ },
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
    const lines = []
    page.on('console', (m) => { if (m.text().startsWith('[M1fR3Gate]')) lines.push(m.text()) })
    page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR3Gate\] acceptance/.test(m.text()), timeout: 60_000 }).then((m) => m.text()).catch(() => 'NONE')
    await page.goto(`http://localhost:${PORT}/?page=m1fR3${c.q ? `&${c.q}` : ''}`)
    const verdict = await v
    let good = verdict.includes(`acceptance ${c.verdict}`) && !lines.some((l) => l.startsWith('pageerror'))
    for (const [row, want] of Object.entries(c.expect)) {
      const l = lines.find((x) => x.startsWith(`[M1fR3Gate] ${row}: ${want}`))
      if (!l || !c.detail.test(l)) good = false
    }
    console.log(`case ${c.q || 'none'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'}`)
    lines.forEach((l) => console.log(`  ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)