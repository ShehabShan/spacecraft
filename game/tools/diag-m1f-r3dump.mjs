// M1F R3 dump probe (read-only, round-6 addendum): load ?page=m1f, wait for
// the suite to settle, print the harness's R3DUMP lines verbatim, then
// classify the differing pixels per the addendum rules:
//   r_disk = max r over differing px (measured from the dump itself)
//   SHADING: r <= r_disk - 2   EDGE: |r - r_disk| <= 2
//   EDGE binned into 24 x 15-deg azimuth bins: uniform ring = >= 16 bins
//   occupied; directional arc = < 12 bins, contiguous, one-sided (<180 deg)
//   net one-sided = |I - M| over EDGE px (sign: impostor-larger / mesh-larger)
// Usage: node tools/diag-m1f-r3dump.mjs   (expects vite preview on :4173)
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
const lines = []
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

const dump = lines.filter((l) => l.startsWith('R3DUMP'))
console.log('=== R3DUMP verbatim ===')
for (const l of dump) console.log(l)
const hdr = dump.find((l) => l.startsWith('R3DUMP hdr'))
const px = dump
  .filter((l) => l.startsWith('R3DUMP px'))
  .map((l) => {
    const dx = Number(l.match(/dx=(-?[\d.]+)/)[1])
    const dy = Number(l.match(/dy=(-?[\d.]+)/)[1])
    const r = Number(l.match(/r=([\d.]+)/)[1])
    const side = l.match(/side=([MI])/)[1]
    return { dx, dy, r, side }
  })

if (px.length === 0) {
  console.log('CLASSIFICATION: no differing pixels (sym = 0)')
  process.exit(0)
}
const rDisk = Math.max(...px.map((p) => p.r))
const shading = px.filter((p) => p.r <= rDisk - 2)
const edge = px.filter((p) => Math.abs(p.r - rDisk) <= 2)
const NET = edge.filter((p) => p.side === 'I').length - edge.filter((p) => p.side === 'M').length

// 24 azimuth bins about the centre
const bins = Array.from({ length: 24 }, () => 0)
for (const p of edge) {
  const az = ((Math.atan2(p.dy, p.dx) * 180) / Math.PI + 360) % 360
  bins[Math.floor(az / 15)]++
}
const occupied = bins.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0)
// minimal circular arc covering all occupied bins = 24 - largest circular gap
let largestGap = 0
if (occupied.length > 0) {
  const N = 24
  for (let k = 0; k < occupied.length; k++) {
    const cur = occupied[k]
    const nxt = occupied[(k + 1) % occupied.length]
    const gap = ((nxt - cur + N) % N) || N
    largestGap = Math.max(largestGap, gap)
  }
}
const arcSpanBins = occupied.length === 0 ? 0 : 24 - (occupied.length === 1 ? 23 : largestGap)
// one-sided: all differing px within a <180-deg half-plane about the centre
// (projection on the EDGE mean-differ direction; all-strictly-one-side test)
let maxProj = 0, minProj = 0
const meanAz = edge.length > 0
  ? Math.atan2(edge.reduce((s, p) => s + p.dy, 0), edge.reduce((s, p) => s + p.dx, 0))
  : 0
const ux = Math.cos(meanAz), uy = Math.sin(meanAz)
for (const p of px) {
  const t = p.dx * ux + p.dy * uy
  maxProj = Math.max(maxProj, t); minProj = Math.min(minProj, t)
}
const oneSidedAll = minProj >= 0 || maxProj <= 0   // all px on one side of the centre line

const uniform = occupied.length >= 16
const arc = occupied.length < 12 && arcSpanBins < 12 && oneSidedAll
const dominant = shading.length > edge.length ? 'SHADING' : edge.length > shading.length ? 'EDGE' : 'TIE'

console.log('=== CLASSIFICATION (round-6 addendum rules) ===')
console.log(`r_disk(max r over differing px)=${rDisk.toFixed(2)}  differing=${px.length}`)
console.log(`SHADING (r <= r_disk-2 = ${(rDisk - 2).toFixed(2)}): ${shading.length} px`)
console.log(`EDGE (|r-r_disk| <= 2): ${edge.length} px  net one-sided I-M=${NET >= 0 ? '+' : ''}${NET} (${NET >= 0 ? 'impostor-larger' : 'mesh-larger'})`)
console.log(`EDGE azimuth bins occupied=${occupied.length}/24 [${bins.map((n) => (n > 0 ? 1 : 0)).join('')}] contiguous-arc-span=${arcSpanBins} bins`)
console.log(`uniform ring (>=16 bins)=${uniform}  directional arc (<12 bins, contiguous, one-sided)=${arc}`)
console.log(`dominant=${dominant} (SHADING ${shading.length} vs EDGE ${edge.length})`)
let route
if (dominant === 'SHADING') route = 'SHADING-dominant -> threshold rung > 45 -> > 8'
else if (dominant === 'EDGE' && uniform && NET >= 6) route = 'EDGE+uniform+net>=6 -> larger-fixture rung (232 km -> ~75 km); sign above'
else if (dominant === 'EDGE' && arc) route = 'EDGE+directional arc -> STOP and report (Lead decision)'
else if (dominant === 'TIE') route = 'mixed/tie -> rung of the DOMINANT count only (counts equal: report, no defined route)'
else route = 'EDGE-dominant but neither uniform+net>=6 nor directional arc -> NO DEFINED ROUTE -> STOP and report'
console.log(`ROUTE: ${route}`)
