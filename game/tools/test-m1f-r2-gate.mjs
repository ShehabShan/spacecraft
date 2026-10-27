// F2fcab self-test (ADR-021): builds the game, serves it, and runs ?page=m1fR2
// unmutated (must PASS both rows) and with each mutant (its row must turn red).
// Run from game/: node tools/test-m1f-r2-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4182'
const CASES = [
  { mut: '', expect: { 'R2a angular law': 'PASS', 'R2b far-pass Sun footprint': 'PASS', 'R2c composite Sun visibility': 'PASS' }, verdict: 'PASSED' },
  { mut: 'theta', expect: { 'R2a angular law': 'FAIL', 'R2b far-pass Sun footprint': 'FAIL' }, verdict: 'FAILED' },
  { mut: 'pose', expect: { 'R2b far-pass Sun footprint': 'FAIL' }, verdict: 'FAILED' },
  // F2fcabb: R2c mutants. horizon = clearance proof bypassed at an occluded site; noray = raycast skipped, camera clamped into the mesh
  { mut: 'horizon', expect: { 'R2c composite Sun visibility': 'FAIL' }, verdict: 'FAILED' },
  { mut: 'noray', expect: { 'R2c composite Sun visibility': 'FAIL' }, verdict: 'FAILED' },
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
    page.on('console', (m) => { if (m.text().startsWith('[M1fR2Gate]')) lines.push(m.text()) })
    page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR2Gate\] acceptance/.test(m.text()), timeout: 60_000 }).then((m) => m.text()).catch(() => 'NONE')
    await page.goto(`http://localhost:${PORT}/?page=m1fR2${c.mut ? `&mut=${c.mut}` : ''}`)
    const verdict = await v
    let good = verdict.includes(`acceptance ${c.verdict}`)
    for (const [row, want] of Object.entries(c.expect)) {
      if (!lines.some((l) => l.startsWith(`[M1fR2Gate] ${row}: ${want}`))) good = false
    }
    console.log(`case mut=${c.mut || 'none'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'}`)
    lines.forEach((l) => console.log(`  ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)