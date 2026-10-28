// T3 S3 frame-time A/B (plan §8 S3: "frame time not worse than the T1 baseline").
// T1 B13 recorded no frame-time number (test-play-perf checks heap only), so the
// baseline is the pre-change tree built and served beside the candidate.
// Runs are interleaved A,B,A,B… in headless Chrome + SwiftShader (CPU raster, so
// it is a relative measure only). Each run loads /?page=play&autoplay=1 (optionally
// &spawn=), waits for the terrain to stream, then records rAF intervals.
// Usage: node tools/check-play-frametime.mjs <outDir> name=url name=url [runs] [spawn x,y,z]
// Exit 0 iff the last build's median is ≤ the first build's median × 1.05.
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'
import path from 'node:path'

const [outDir, ...rest] = process.argv.slice(2)
const builds = rest.filter((a) => a.includes('=')).map((a) => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)] })
const nums = rest.filter((a) => !a.includes('='))
const runs = Number(nums[0] ?? 3)
const spawn = nums[1] ?? null
const SETTLE_MS = 15000, SAMPLE_MS = 8000

const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] }

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const res = Object.fromEntries(builds.map(([n]) => [n, []]))
let errors = 0
for (let r = 0; r < runs; r++) {
  for (const [name, url] of builds) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    page.on('pageerror', (e) => { errors++; console.log(`  ${name} pageerror: ${e.message}`) })
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('favicon')) { errors++; console.log(`  ${name} console: ${m.text()}`) } })
    await page.goto(`${url}/?page=play&autoplay=1${spawn ? `&spawn=${spawn}` : ''}`)
    await page.waitForSelector('canvas', { timeout: 30000 })
    await page.waitForTimeout(SETTLE_MS)
    const iv = await page.evaluate((ms) => new Promise((done) => {
      const out = []; let last = performance.now(); const t0 = last
      const f = (t) => { out.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else done(out) }
      requestAnimationFrame(f)
    }), SAMPLE_MS)
    const tag = spawn ? 'rim' : 'spawn'
    if (r === 0) await page.screenshot({ path: path.join(outDir, `${name}-${tag}.png`) })
    iv.shift()
    const m = median(iv), p95 = pct(iv, 0.95)
    res[name].push({ run: r, frames: iv.length, median: m, p95, mean: iv.reduce((a, b) => a + b, 0) / iv.length })
    console.log(`[${name}] run ${r}: ${iv.length} frames, median ${m.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms`)
    await page.close()
  }
}
await browser.close()
const summary = {}
for (const [name] of builds) {
  const meds = res[name].map((x) => x.median)
  summary[name] = { medianOfRunMedians: median(meds), runs: res[name] }
  console.log(`[${name}] median of run medians ${median(meds).toFixed(2)} ms (runs ${meds.map((v) => v.toFixed(2)).join(', ')})`)
}
const base = summary[builds[0][0]].medianOfRunMedians, cand = summary[builds[builds.length - 1][0]].medianOfRunMedians
const ratio = cand / base
const pass = ratio <= 1.05 && errors === 0
console.log(`ratio ${builds[builds.length - 1][0]}/${builds[0][0]} = ${ratio.toFixed(3)} (bound 1.05); errors ${errors} → ${pass ? 'PASS' : 'FAIL'}`)
writeFileSync(path.join(outDir, `frametime-${spawn ? 'rim' : 'spawn'}.json`), JSON.stringify({ spawn, runs, SETTLE_MS, SAMPLE_MS, summary, ratio, errors, pass }, null, 1))
process.exit(pass ? 0 : 1)