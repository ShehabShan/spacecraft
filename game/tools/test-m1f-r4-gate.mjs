// F2fcda self-test (ADR-024): builds the game, serves it, and runs ?page=m1fR4 unmutated (R4a must
// PASS with 0 changed references) and with each mutant (R4a must FAIL naming exactly the replaced
// reference while the shipped shape predicate still holds — the A1-U03-4 blind spot made visible).
// Run from game/: node tools/test-m1f-r4-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4184'
const A = 'R4a boot identity'
const CASES = [
  { mut: '', verdict: 'PASSED', want: 'PASS', re: /: 0 changed; GPU geometries (\d+)→\1, textures (\d+)→\2, programs (\d+)→\3; shipped shape predicate holds\./ },
  { mut: 'replace', verdict: 'FAILED', want: 'FAIL', re: /: 1 changed \[bodies\[5\]\]; .*shipped shape predicate holds\. \[mut=replace\]/ },
  { mut: 'realloc', verdict: 'FAILED', want: 'FAIL', re: /: 1 changed \[attr aDisk\.array\]; .*shipped shape predicate holds\. \[mut=realloc\]/ },
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
    page.on('console', (m) => { if (m.text().startsWith('[M1fR4Gate]')) lines.push(m.text()) })
    page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR4Gate\] acceptance/.test(m.text()), timeout: 90_000 }).then((m) => m.text()).catch(() => 'NONE')
    await page.goto(`http://localhost:${PORT}/?page=m1fR4${c.mut ? `&mut=${c.mut}` : ''}`)
    const verdict = await v
    const row = lines.find((l) => l.startsWith(`[M1fR4Gate] ${A}: ${c.want}`)) ?? ''
    const good = verdict.includes(`acceptance ${c.verdict}`) && c.re.test(row) && !lines.some((l) => l.startsWith('pageerror'))
    console.log(`case mut=${c.mut || 'none'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'}`)
    lines.forEach((l) => console.log(`  ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)