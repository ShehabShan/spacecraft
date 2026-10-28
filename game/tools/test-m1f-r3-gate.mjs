// F2fccba/F2fccbba self-test (ADR-023): builds the game, serves it, and runs ?page=m1fR3 unmutated
// (must be the pinned known-red vector), with the test-only positive control ?ctl=ref, and with the
// mutants meshhide/noimp/shift/scale/bright. Each case checks every row's badge AND a detail regex, so
// a mutant must move the result to its own predicted place. R3c (F2fccbbb) is red today (finding
// F2fccbb-1: impostor 88 px vs mesh ~68 px), so its mutants are told apart by their FAIL REASONS:
// shift adds centroid (Δc 3 px), scale inflates the impostor area, bright gives sym 0 but fails both
// area bounds (A1-U03-3's masquerade is caught), meshhide/noimp zero one side.
// ctl=ref: R3a PASS; R3b may fail ONLY the impostor-only samples (finding F2fccbb-1: the impostor
// draws ~1.35x the mesh area), which proves the hole check goes green wherever the controller acts.
// Run from game/: node tools/test-m1f-r3-gate.mjs   (exit 0 = all as expected, 1 = not)
import { spawn, spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = '4183'
const A = 'R3a state-coupled sweep', B = 'R3b rendered coverage', C = 'R3c silhouette A/B'
const A0 = ['FAIL', /sweep .*down: \d+ holes in \[220000, 2256\d\d\] m; up: 0 holes;/]
const B0 = ['FAIL', /fails: down \[290, 245, 238, 228, 224, 222\] km; up \[238, 245, 290\] km\./]
const C0 = ['FAIL', /imp 88 px .*Δc 0\.\d\d px, repeat identical; .*fails: \[228\(imp-area,sym\) 232\(imp-area,sym\) 236\(imp-area,sym\)\]\./]
const CASES = [
  { q: '', verdict: 'FAILED', rows: { [A]: A0, [B]: B0, [C]: C0 } },
  { q: 'ctl=ref', verdict: 'FAILED', rows: {
    [A]: ['PASS', /down: 0 holes; up: 0 holes; 0 doubles; 21 flips/],
    [B]: ['FAIL', /fails: down \[290, 245, 238\] km; up \[245, 290\] km\./], [C]: C0 } },
  { q: 'mut=meshhide', verdict: 'FAILED', rows: {
    [A]: ['FAIL', /up: \d+ holes in \[200000, 2256\d\d\] m;/],
    [B]: ['FAIL', /fails: down \[[^\]]*205\] km; up \[205, /],
    [C]: ['FAIL', /mesh 0 imp 88 px .*fails: \[228\(mesh-area,imp-area,sym,centroid\) /] } },
  { q: 'mut=noimp', verdict: 'FAILED', rows: {
    [A]: ['FAIL', /down: \d+ holes in \[220000, 300000\] m;/],
    [B]: ['FAIL', /fails: down \[290, 245, 238, 232, 228, 224, 222\] km;/],
    [C]: ['FAIL', /imp 0 px .*fails: \[228\(imp-area,sym,centroid\) 232\(imp-area,sym,centroid\) 236\(imp-area,sym,centroid\)\]\./] } },
  { q: 'mut=shift', verdict: 'FAILED', rows: { [A]: A0, [B]: B0,
    [C]: ['FAIL', /imp 88 px .*Δc 3\.\d\d px.*fails: \[228\(imp-area,sym,centroid\) 232\(imp-area,sym,centroid\) 236\(imp-area,sym,centroid\)\]\./] } },
  { q: 'mut=scale', verdict: 'FAILED', rows: { [A]: A0, [B]: B0,
    [C]: ['FAIL', /228: mesh \d+ imp 1[5-9]\d px .*fails: \[228\(imp-area,sym\) 232\(imp-area,sym\) 236\(imp-area,sym\)\]\./] } },
  { q: 'mut=bright', verdict: 'FAILED', rows: { [A]: A0, [B]: B0,
    [C]: ['FAIL', /mesh 2304 imp 2304 px .*sym 0\/.*fails: \[228\(mesh-area,imp-area\) 232\(mesh-area,imp-area\) 236\(mesh-area,imp-area\)\]\./] } },
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