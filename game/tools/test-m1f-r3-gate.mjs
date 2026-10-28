// F2fccba/F2fccbba self-test (ADR-023): builds the game, serves it, and runs ?page=m1fR3 unmutated
// (must be the pinned known-red vector), with the test-only positive control ?ctl=ref, and with the
// mutants meshhide/noimp. Each case checks every row's badge AND a detail regex, so a mutant must
// move the result to its own predicted place. F2fccbbb adds R3c and the mutants shift/scale/bright.
// ctl=ref: R3a PASS; R3b may fail ONLY the impostor-only samples (finding F2fccbb-1: the impostor
// draws ~1.35x the mesh area), which proves the hole check goes green wherever the controller acts.
// Run from game/: node tools/test-m1f-r3-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4183'
const A = 'R3a state-coupled sweep', B = 'R3b rendered coverage'
const CASES = [
  { q: '', verdict: 'FAILED', rows: {
    [A]: ['FAIL', /sweep .*down: \d+ holes in \[220000, 2256\d\d\] m; up: 0 holes;/],
    [B]: ['FAIL', /fails: down \[290, 245, 238, 228, 224, 222\] km; up \[238, 245, 290\] km\./] } },
  { q: 'ctl=ref', verdict: 'FAILED', rows: {
    [A]: ['PASS', /down: 0 holes; up: 0 holes; 0 doubles; 21 flips/],
    [B]: ['FAIL', /fails: down \[290, 245, 238\] km; up \[245, 290\] km\./] } },
  { q: 'mut=meshhide', verdict: 'FAILED', rows: {
    [A]: ['FAIL', /up: \d+ holes in \[200000, 2256\d\d\] m;/],
    [B]: ['FAIL', /fails: down \[[^\]]*205\] km; up \[205, /] } },
  { q: 'mut=noimp', verdict: 'FAILED', rows: {
    [A]: ['FAIL', /down: \d+ holes in \[220000, 300000\] m;/],
    [B]: ['FAIL', /fails: down \[290, 245, 238, 232, 228, 224, 222\] km;/] } },
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
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR3Gate\] acceptance/.test(m.text()), timeout: 90_000 }).then((m) => m.text()).catch(() => 'NONE')
    await page.goto(`http://localhost:${PORT}/?page=m1fR3${c.q ? `&${c.q}` : ''}`)
    const verdict = await v
    let good = verdict.includes(`acceptance ${c.verdict}`) && !lines.some((l) => l.startsWith('pageerror'))
    for (const [row, [want, re]] of Object.entries(c.rows)) {
      const l = lines.find((x) => x.startsWith(`[M1fR3Gate] ${row}: ${want}`))
      if (!l || !re.test(l)) { good = false; console.log(`  mismatch on ${row} (want ${want} ${re})`) }
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