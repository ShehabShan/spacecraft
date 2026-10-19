// M1F round-6b validation probe (read-only): drives ?page=m1f through a full
// suite run, captures every R3RAW / R3SWEEP / R3BIAS / R3DUMP console line to
// /tmp/r3val-raw.log, then computes the directive's V1/V2/V6 offline:
//   V1 threshold curve at 232 km: sym/totA/nA/nB/per-side for t in the set
//   V2 rim histograms: mesh vs impostor brightness in the |r - r_disk| <= 2 px
//      annulus (r_disk = area-derived mesh radius at t=8, from the dump)
//   V6 stray audit: lit px (t=8) with r > r_disk + 2, symmetric presence
// V3 (R3SWEEP) and V4 (R3BIAS) lines are captured verbatim (emitted by the
// TEMP harness patch — that patch is reverted and never committed; this probe
// stays useful as the recorded method + analyzer of the captured raw log).
// Usage: node tools/diag-m1f-r3val.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'
import { writeFileSync, readFileSync } from 'node:fs'

// --analyze <file>: offline mode — classify from a previously captured raw
// log (identical parser path; no browser, no re-render).
const ai = process.argv.indexOf('--analyze')
let lines
if (ai !== -1) {
  lines = readFileSync(process.argv[ai + 1], 'utf-8').split('\n')
} else {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  lines = []
  page.on('console', (m) => lines.push(m.text()))
  page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
  await page.goto('http://localhost:4173/?page=m1f')
  await page.waitForFunction(
    () => {
      const bs = document.querySelectorAll('.badge')
      return bs.length >= 4 && [...bs].every((b) => b.textContent !== '·····')
    },
    null,
    { timeout: 240_000, polling: 1000 },
  )
  await browser.close()
  writeFileSync('/tmp/r3val-raw.log', lines.join('\n') + '\n')
}

const sweep = lines.filter((l) => l.startsWith('R3SWEEP'))
const bias = lines.filter((l) => l.startsWith('R3BIAS'))
console.log('=== V3 distance sweep (threshold 8, verbatim) ===')
for (const l of sweep) console.log(l)
console.log('=== V4 negative control (bias, threshold 8, verbatim) ===')
for (const l of bias) console.log(l)

// ---- parse R3RAW windows ----
const W = 160
const m = new Int16Array(W * W), im = new Int16Array(W * W)
let cx = NaN, cy = NaN
for (const l of lines) {
  if (l.startsWith('R3RAW hdr')) {
    cx = Number(l.match(/centre=\(([-\d.]+),([-\d.]+)\)/)[1])
    cy = Number(l.match(/centre=\(([-\d.]+),([-\d.]+)\)/)[2])
  } else if (l.startsWith('R3RAW M y=') || l.startsWith('R3RAW I y=')) {
    const isM = l[6] === 'M'
    const y = Number(l.match(/y=(\d+)/)[1])
    const vals = l.slice(l.indexOf(' ') + 1).trim().split(' ')[2].split(',').map(Number)
    for (let x = 0; x < W; x++) (isM ? m : im)[y * W + x] = vals[x]
  }
}
if (Number.isNaN(cx)) { console.log('NO R3RAW CAPTURED'); process.exit(1) }
console.log(`R3RAW parsed: centre=(${cx},${cy}) win=80`)

const pxAt = (buf, x, y) => buf[y * W + x]
const rad = (x, y) => Math.hypot(Math.floor(cx) - 80 + x - cx, Math.floor(cy) - 80 + y - cy)

// ---- V1 threshold curve ----
console.log('=== V1 threshold curve @232 km (from R3RAW, offline) ===')
console.log('  t   sym  totA   nA   nB  M-only I-only  symPct')
const rows = {}
for (const t of [2, 4, 8, 12, 16, 24, 32, 45]) {
  let sym = 0, totA = 0, nA = 0, nB = 0, mo = 0, io = 0
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const a = pxAt(m, x, y) > t ? 1 : 0, b = pxAt(im, x, y) > t ? 1 : 0
    totA += a; nA += a; nB += b
    if (a !== b) { sym++; if (a === 1) mo++; else io++ }
  }
  rows[t] = { sym, totA, nA, nB, mo, io }
  console.log(`${String(t).padStart(3)} ${String(sym).padStart(5)} ${String(totA).padStart(5)} ${String(nA).padStart(4)} ${String(nB).padStart(4)} ${String(mo).padStart(6)} ${String(io).padStart(7)}  ${(totA > 0 ? (sym / totA) * 100 : 100).toFixed(2)}`)
}

// ---- V2 rim histograms (annulus |r - r_disk| <= 2) ----
const rDisk = Math.sqrt(rows[8].nA / Math.PI)
console.log(`=== V2 rim histograms (annulus |r - ${rDisk.toFixed(2)}| <= 2 px; r_disk = sqrt(nA@t8/pi)) ===`)
const BIN = 16
const hm = Array.from({ length: 256 / BIN }, () => 0), hi = Array.from({ length: 256 / BIN }, () => 0)
let nAnn = 0
const annM = [], annI = []
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
  if (Math.abs(rad(x, y) - rDisk) <= 2) {
    nAnn++
    const mv = pxAt(m, x, y), iv = pxAt(im, x, y)
    if (mv >= 0) { hm[Math.floor(mv / BIN)]++; annM.push(mv) }
    if (iv >= 0) { hi[Math.floor(iv / BIN)]++; annI.push(iv) }
  }
}
const asc = (a) => [...a].sort((p, q) => p - q)
const med = (a) => (a.length === 0 ? NaN : asc(a)[Math.floor(a.length / 2)])
console.log(`annulus px=${nAnn} (mesh-vals ${annM.length}, imp-vals ${annI.length}; -1 = outside framebuffer)`)
console.log(`mesh: min=${Math.min(...annM)} med=${med(annM)} max=${Math.max(...annM)} · <=8: ${annM.filter((v) => v >= 0 && v <= 8).length} · 9..45: ${annM.filter((v) => v > 8 && v <= 45).length} · >45: ${annM.filter((v) => v > 45).length}`)
console.log(`imp : min=${Math.min(...annI)} med=${med(annI)} max=${Math.max(...annI)} · <=8: ${annI.filter((v) => v >= 0 && v <= 8).length} · 9..45: ${annI.filter((v) => v > 8 && v <= 45).length} · >45: ${annI.filter((v) => v > 45).length}`)
console.log('bin(range)     mesh  impostor   [t=8 and t=45 markers]')
for (let b = 0; b < 256 / BIN; b++) {
  const m8 = 8 >= b * BIN && 8 < (b + 1) * BIN ? ' <— t=8' : ''
  const m45 = 45 >= b * BIN && 45 < (b + 1) * BIN ? ' <— t=45' : ''
  console.log(`${String(b * BIN).padStart(3)}-${String(b * BIN + BIN - 1).padStart(3)}     ${String(hm[b]).padStart(5)} ${String(hi[b]).padStart(8)}${m8}${m45}`)
}

// ---- V6 stray audit ----
console.log(`=== V6 stray audit @t=8 (lit px with r > r_disk + 2 = ${(rDisk + 2).toFixed(2)}) ===`)
let strays = 0, symmetric = 0
for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
  const a = pxAt(m, x, y) > 8 ? 1 : 0, b = pxAt(im, x, y) > 8 ? 1 : 0
  const r = rad(x, y)
  if ((a === 1 || b === 1) && r > rDisk + 2) {
    strays++
    if (a === b) symmetric++
    console.log(`  stray dx=${(Math.floor(cx) - 80 + x - cx).toFixed(2)} dy=${(Math.floor(cy) - 80 + y - cy).toFixed(2)} r=${r.toFixed(2)} mv=${pxAt(m, x, y)} iv=${pxAt(im, x, y)} ${a === b ? 'SYMMETRIC' : 'ASYMMETRIC'}${a !== b ? ' <- differs' : ''}`)
  }
}
console.log(`strays=${strays} symmetric=${symmetric} asymmetric=${strays - symmetric}`)
