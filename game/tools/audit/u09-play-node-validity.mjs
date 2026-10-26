// A1-U09 probe: can the play-layer Node tests fail on their claims?
// READ-ONLY w.r.t. game/src: every mutant is a COPY placed under
// node_modules/.cache/u09/ (git-ignored); the real tools/test-play-*.mjs are
// only read, path-rewritten and re-run as child processes.
// Run from game/: `node tools/audit/u09-play-node-validity.mjs; echo PROBE_EXIT=$?`
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..', '..')
const root = path.join(game, 'node_modules', '.cache', 'u09')
fs.rmSync(root, { recursive: true, force: true })
fs.mkdirSync(root, { recursive: true })

const results = []
const rec = (id, expect, got, note) => { results.push({ id, expect, got, ok: expect === got, note }); console.log(`[${id}] expect ${expect} got ${got} ${expect === got ? 'OK' : 'NOT CONFIRMED'} :: ${note}`) }

// A temp "game" dir with its own src copy (mutable) and node_modules/.cache for bundles.
function tempGame(name, srcEdits = []) {
  const g = path.join(root, name)
  fs.cpSync(path.join(game, 'src'), path.join(g, 'src'), { recursive: true })
  fs.mkdirSync(path.join(g, 'node_modules', '.cache'), { recursive: true })
  for (const [file, from, to] of srcEdits) {
    const p = path.join(g, 'src', file); const s = fs.readFileSync(p, 'utf8')
    if (!s.includes(from)) throw new Error(`src anchor missing in ${file}: ${from}`)
    fs.writeFileSync(p, s.replace(from, to))
  }
  return g
}
function mutantTest(script, name, g, edits = []) {
  let s = fs.readFileSync(path.join(game, 'tools', script), 'utf8')
  const anchor = "path.resolve(here, '..')"
  if (!s.includes(anchor)) throw new Error(`path anchor missing in ${script}`)
  s = s.replace(anchor, JSON.stringify(g))
  for (const [from, to] of edits) {
    if (!s.includes(from)) throw new Error(`anchor missing in ${script}: ${from.slice(0, 60)}`)
    s = s.replace(from, to)
  }
  const out = path.join(root, `${name}.mjs`); fs.writeFileSync(out, s); return out
}
function run(file, gc = true, traceGc = false) {
  const r = spawnSync(process.execPath, [...(gc ? ['--expose-gc'] : []), ...(traceGc ? ['--trace-gc'] : []), file], { encoding: 'utf8', cwd: game, timeout: 600000, maxBuffer: 64 << 20 })
  const txt = (r.stdout ?? '') + (r.stderr ?? '')
  return { code: r.status, txt, last: txt.trim().split('\n').filter((l) => /PASS|FAIL/.test(l)).pop() ?? '' }
}
const grab = (txt, tag) => txt.split('\n').filter((l) => l.startsWith(tag)).map((l) => l.slice(tag.length).trim())

const G0 = tempGame('g0')

// ---- 1. test-play-perf: transient per-frame allocation vs the heap rows --------
// Minor-GC (scavenge) counter restricted to the 10 measured chunks: an
// independent allocation detector the test does not have.
const GC_HOOK_TOP = [`const samples = []`, `const samples = []
const __u09gc = []; new (await import('node:perf_hooks')).PerformanceObserver((l) => { for (const e of l.getEntries()) __u09gc.push(e) }).observe({ entryTypes: ['gc'] })
const __w0 = performance.now()`]
const GC_HOOK_END = [`const dh = samples[samples.length - 1] - samples[0]`, `const __w1 = performance.now()
await new Promise((r) => setTimeout(r, 100))
console.log('U09_MINOR_GC ' + __u09gc.filter((e) => e.startTime >= __w0 && e.startTime <= __w1 && (e.detail?.kind ?? e.kind) === 1).length)
const dh = samples[samples.length - 1] - samples[0]`]
const DRIVE = `inp.jumpPressed = c >= 1000 && c < 1006`
const perfVariants = [
  ['perf-control', [], 0, 'unmodified copy'],
  // WHY: on-heap allocations (a Float64Array backing store > 64 B lives off-heap and
  // would not even reach the scavenger); stored to a global so it cannot be elided.
  ['perf-transient', [[DRIVE, DRIVE + '; globalThis.__u09 = [i, i + 1, i + 2, i + 3, i + 4, i + 5, i + 6, i + 7].map((x) => ({ x }))']], 0, '+8 objects + 2 arrays (~400 B) per frame, discarded'],
  ['perf-transient4k', [[DRIVE, DRIVE + '; globalThis.__u09 = new Array(512).fill(i + 0.5)']], 0, '+1 Array(512) of doubles (~4 KB) per frame, discarded'],
  ['perf-leak', [[DRIVE, DRIVE + '; (globalThis.__u09L ??= []).push({ i })']], 1, '+1 small object per frame, retained'],
]
const gcCounts = {}
for (const [name, edits, exp, note] of perfVariants) {
  const r = run(mutantTest('test-play-perf.mjs', name, G0, [GC_HOOK_TOP, GC_HOOK_END, ...edits]), true, true)
  const gcN = (r.txt.match(/Scavenge/g) ?? []).length; gcCounts[name] = gcN
  rec(`P:${name}`, exp, r.code, `${note}; ${r.last.slice(0, 140)}; whole-run scavenges ${gcN}`)
}
// Independent detector: V8 scavenge count over the whole run (--trace-gc).
rec('P:scavenge-detects', true, gcCounts['perf-transient4k'] > gcCounts['perf-control'] + 5,
  `scavenges control ${gcCounts['perf-control']} vs ~400 B/frame ${gcCounts['perf-transient']} vs ~4 KB/frame ${gcCounts['perf-transient4k']}`)

// ---- 2. test-play-controller camera heap row: leak or bad bound? -----------------
const CAM_LOOP = `for (let i = 0; i < 10000; i++) { ci.lookDX = 3; ci.lookDY = (i & 1) ? 2 : -2; r.cam.preStep(r.kcc, ci, r.ctrl); r.cam.poseInto(r.kcc, 1 / 60) }`
const CAM_H0 = `    gc(); const h0m = process.memoryUsage().heapUsed`
const CAM_OK = "    ok(dh < 64 * 1024, `camera heap delta ${dh} B over 10k frames`)"
const chunks = `
    for (let k = 0; k < 6; k++) { gc(); const a = process.memoryUsage().heapUsed; ${CAM_LOOP}; gc(); console.log('U09_CAMCHUNK ' + (process.memoryUsage().heapUsed - a)) }`
const ctlChunks = mutantTest('test-play-controller.mjs', 'ctl-chunks', G0, [[CAM_OK, CAM_OK + chunks]])
const ctlWarm = mutantTest('test-play-controller.mjs', 'ctl-warm', G0, [[CAM_H0, `    ${CAM_LOOP}\n` + CAM_H0]])
const camFirst = [], warmFirst = [], allChunks = []
let chunkFails = 0, warmFails = 0
for (let k = 0; k < 4; k++) {
  const a = run(ctlChunks); const m = a.txt.match(/camera heap delta ([\d.-]+) KB/); camFirst.push(m ? m[1] : '?')
  if (a.code !== 0) chunkFails++
  allChunks.push(grab(a.txt, 'U09_CAMCHUNK').join('/'))
  const b = run(ctlWarm); const mw = b.txt.match(/camera heap delta ([\d.-]+) KB/); warmFirst.push(mw ? mw[1] : '?')
  if (b.code !== 0) warmFails++
}
console.log(`[C] cold first-window KB: ${camFirst.join(', ')} | later 10k chunks (B): ${allChunks.join(' | ')}`)
console.log(`[C] with 10k warm-up, first-window KB: ${warmFirst.join(', ')}`)
rec('C:cold-row-red', true, chunkFails >= 1, `unmodified camera row red in ${chunkFails}/4 runs`)
const later = allChunks.flatMap((s) => s.split('/').slice(1).map(Number))
rec('C:no-steady-leak', true, later.length > 0 && Math.max(...later) < 16 * 1024, `chunks 2–6 max ${Math.max(...later)} B (a leak would repeat the first window)`)
rec('C:warm-row-green', 0, warmFails, `with warm-up the row is red in ${warmFails}/4 runs`)

// ---- 3. controller zero-gc row is vacuous without --expose-gc -----------------
{
  const r = run(path.join(game, 'tools', 'test-play-controller.mjs'), false)
  const vac = /no --expose-gc: not asserted/.test(r.txt)
  rec('Z:vacuous-without-gc', true, vac, `exit ${r.code}; ${r.txt.includes('run with node --expose-gc') ? 'camera row reports missing gc' : ''}`)
}

// ---- 4. functional mutation: does the buffer row see the window length? ---------
{
  const G1 = tempGame('g1', [['play/world/moonConfig.ts', 'jumpBufferS: 0.12', 'jumpBufferS: 0.30']])
  const r = run(mutantTest('test-play-controller.mjs', 'ctl-buf030', G1))
  rec('F:buffer-0.30', 1, r.code, `${(r.txt.match(/buffer 0\.20 s relaunched[^\n]*/) ?? ['(buffer row passed)'])[0]}`)
  const G2 = tempGame('g2', [['play/world/moonConfig.ts', 'jumpBufferS: 0.12', 'jumpBufferS: 0.19']])
  const r2 = run(mutantTest('test-play-controller.mjs', 'ctl-buf019', G2))
  const bufFail = /buffer 0\.(10|20) s/.test(r2.txt.split('test-play-controller FAIL')[1] ?? '')
  rec('F:buffer-0.19', false, bufFail, `0.19 s window is inside the test's [0.10, 0.20) bracket — buffer rows ${bufFail ? 'fail' : 'pass'}`)
}

const bad = results.filter((r) => !r.ok)
console.log(`[u09] ${results.length - bad.length}/${results.length} as expected${bad.length ? ' — NOT CONFIRMED: ' + bad.map((b) => b.id).join(', ') : ''}`)
process.exit(0)