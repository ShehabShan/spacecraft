// F2fcea/F2fceb self-test (ADR-025): builds the game, serves it, and runs ?page=m1fR5
// unmutated (R5a and R5b must PASS) and with each mutant. Each mutant must turn exactly
// its own row red for the named reason (R5a reasons must match at all three terrain
// heights, i.e. 3 times) while the other row stays PASS.
// Run from game/: node tools/test-m1f-r5-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4185'
const A = 'R5a rebase lattice on a continuous route'
const B = 'R5b straddler A/B and Sun on every frame'
const OK_A = { want: 'PASS', reason: /fails: \[\];/, n: 3 }
const OK_B = { want: 'PASS', reason: /fails: \[\];$/, n: 1 }
const CASES = [
  { mut: '', verdict: 'PASSED', rows: { [A]: OK_A, [B]: OK_B } },
  // nadir = route stops at the shipped SAT_B nadir arc (A1-U03-5): fewer than 2 shifts
  { mut: 'nadir', verdict: 'FAILED', rows: { [A]: { want: 'FAIL', reason: /shifts 0 < 2/, n: 3 }, [B]: OK_B } },
  // skew = rebase listener nudges the writable origin by 1 m (A1-U11-3)
  { mut: 'skew', verdict: 'FAILED', rows: { [A]: { want: 'FAIL', reason: /origin ≠ oracle on \d+ ticks; origin off-lattice/, n: 3 }, [B]: OK_B } },
  // teleport = 300 m jump mid-route
  { mut: 'teleport', verdict: 'FAILED', rows: { [A]: { want: 'FAIL', reason: /world step > sprint·dt on 1 ticks/, n: 3 }, [B]: OK_B } },
  // offframe = Sat B behind the camera at the same depth range (the shipped vacuous A/B, A1-U03-5)
  { mut: 'offframe', verdict: 'FAILED', rows: { [A]: OK_A, [B]: { want: 'FAIL', reason: /fails: \[Sat B 0 px ≤ 200; 1 m shift changes 0 px/, n: 1 } } },
  // single = Sat B forced to one layer (MID only) instead of the law's NEAR|MID
  { mut: 'single', verdict: 'FAILED', rows: { [A]: OK_A, [B]: { want: 'FAIL', reason: /fails: \[Sat B assigned mask 2 ≠ NEAR\|MID 3\];/, n: 1 } } },
  // rebaseonly = the Sun is sampled only on rebase frames, as the shipped row did (A1-U03-6)
  { mut: 'rebaseonly', verdict: 'FAILED', rows: { [A]: OK_A, [B]: { want: 'FAIL', reason: /fails: \[samples 2 ≠ frames 4800\];/, n: 1 } } },
  // sunstale = the Sun's render-local position is never rebased (A1-U03-6 class)
  { mut: 'sunstale', verdict: 'FAILED', rows: { [A]: OK_A, [B]: { want: 'FAIL', reason: /fails: \[Sun dir err > [\d.e-]+ rad on \d+ of \d+ frames; Sun 0 px on \d+ frames\];/, n: 1 } } },
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
    let good = verdict.includes(`acceptance ${c.verdict}`) && errors.length === 0
    for (const [name, exp] of Object.entries(c.rows)) {
      const row = lines.find((l) => l.startsWith(`[M1fR5Gate] ${name}: `)) ?? ''
      const hits = (row.match(new RegExp(exp.reason.source, 'gm')) ?? []).length
      if (!row.startsWith(`[M1fR5Gate] ${name}: ${exp.want}`) || hits !== exp.n) good = false
    }
    console.log(`case mut=${c.mut || 'none'}: ${good ? 'AS EXPECTED' : 'UNEXPECTED'}`)
    lines.forEach((l) => console.log(`  ${l}`)); errors.forEach((l) => console.log(`  ERROR ${l}`))
    if (!good) ok = false
    await page.close()
  }
  await browser.close()
} catch (e) { console.log(`error: ${e}`); ok = false } finally { try { process.kill(-srv.pid, 'SIGTERM') } catch {} }
console.log(`self-test ${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)