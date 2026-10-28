// F2fcda/F2fcdb self-test (ADR-024): builds the game, serves it, and runs ?page=m1fR4 driven by the
// CDP driver (tools/r4-cdp-driver.mjs) unmutated and with each mutant, plus once WITHOUT the driver.
// Each case pins all three rows (verdict + detail regex), so mutants are told apart by fail reasons:
//   none     R4a PASS, R4b FAIL [render] only (finding F2fcdb-1), R4c PASS
//   replace  R4a FAIL [bodies[5]]  (A1-U03-4: the shipped shape predicate still holds)
//   realloc  R4a FAIL [attr aDisk.array]
//   churn    R4b FAIL [pure, render] (4 escaping objects/frame), R4c PASS (transient, not retained)
//   leak     R4c FAIL (one retained object/frame), R4b also over on pure
//   nodriver R4b and R4c FAIL "instrument missing" (a missing instrument is never N/A)
// Run from game/: node tools/test-m1f-r4-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { driveR4 } from './r4-cdp-driver.mjs'

const PORT = '4184'
const A = 'R4a boot identity', B = 'R4b allocation', C = 'R4c retention'
const A0 = ['PASS', /: 0 changed; GPU geometries (\d+)→\1, textures (\d+)→\2, programs (\d+)→\3; shipped shape predicate holds\./]
const B0 = ['FAIL', /B\/iter \(ok\); .*fails: \[render\];/]
const BPR = ['FAIL', /B\/iter \(ok\); .*fails: \[pure, render\];/]
const C0 = ['PASS', /B\/iter \(ok, ≥ 12\); .*pure median -?\d\.\d B\/frame/]
const CASES = [
  { mut: '', drive: true, rows: { [A]: A0, [B]: B0, [C]: C0 } },
  { mut: 'replace', drive: true, rows: { [A]: ['FAIL', /: 1 changed \[bodies\[5\]\]; .*shipped shape predicate holds\./], [B]: B0, [C]: C0 } },
  { mut: 'realloc', drive: true, rows: { [A]: ['FAIL', /: 1 changed \[attr aDisk\.array\]; .*shipped shape predicate holds\./], [B]: B0, [C]: C0 } },
  { mut: 'churn', drive: true, rows: { [A]: A0, [B]: BPR, [C]: C0 } },
  { mut: 'leak', drive: true, rows: { [A]: A0, [B]: BPR, [C]: ['FAIL', /B\/iter \(ok, ≥ 12\); GC-bracketed heap trend: pure median (1[2-9]|[2-9]\d)\.\d B\/frame/] } },
  { mut: '', drive: false, q: '&wait=3000', rows: { [A]: A0, [B]: ['FAIL', /instrument missing/], [C]: ['FAIL', /instrument missing/] } },
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
    const v = page.waitForEvent('console', { predicate: (m) => /\[M1fR4Gate\] acceptance/.test(m.text()), timeout: 240_000 }).then((m) => m.text()).catch(() => 'NONE')
    const t0 = Date.now()
    await page.goto(`http://localhost:${PORT}/?page=m1fR4${c.mut ? `&mut=${c.mut}` : ''}${c.q ?? ''}`)
    if (c.drive) await driveR4(page)
    const verdict = await v
    let good = verdict.includes('acceptance FAILED') && !lines.some((l) => l.startsWith('pageerror'))
    for (const [name, [want, re]] of Object.entries(c.rows)) {
      const row = lines.find((l) => l.startsWith(`[M1fR4Gate] ${name}: ${want}`)) ?? ''
      if (!re.test(row)) { good = false; console.log(`  mismatch on ${name} (want ${want} ${re})`) }
    }
    console.log(`case mut=${c.mut || 'none'}${c.drive ? '' : ' (no driver)'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
    lines.forEach((l) => console.log(`  ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)