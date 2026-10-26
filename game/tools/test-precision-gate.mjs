#!/usr/bin/env node
// F2ba — m1a precision/rebase gate (closes A1-U08-5, A1-U08-6). Decision record: ADR-007.
//   node tools/test-precision-gate.mjs                         every check must PASS on production
//   node tools/test-precision-gate.mjs --self-test [--deliberate]  every mutant must turn its checks red
// Pattern (ADR-006): truth from raw inputs + pinned facts only; each mutant is a FRESH module
// bundle built from patched source in memory; the production source files are never written.
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')

// ---- pinned independent facts (change only with an ADR in the same commit) ----------------
const LATTICE = 256      // Phase-2 rule 2: O = 256 · floor(P/256 + 0.5), per axis
const THRESHOLD = 1024   // Phase-2 rule 3: rebase iff max-axis |P − O| > 1024 (STRICT)
const DT = 1 / 60        // Spec 02.6 fixed tick
const pinnedOrigin = (v) => LATTICE * Math.floor(v / LATTICE + 0.5)
const AX = ['x', 'y', 'z']
const EPS = 2 ** -30     // exactly representable next to 1024 (f64 ulp there is 2^-42)

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const SRC = path.join(game, 'src')
const FILES = {
  pm: path.join(SRC, 'core', 'math', 'precisionMath.ts'),
  sc: path.join(SRC, 'core', 'simulation', 'SimulationCore.ts'),
}
const hashOf = () => Object.values(FILES).map((f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')).join(',')
const PRODUCTION = hashOf()

async function load(name, patches = []) {
  const outfile = path.join(game, 'node_modules', '.cache', `f2b-precision-${name}.bundle.mjs`)
  const applied = new Set()
  await build({
    stdin: { contents: `export { SimulationCore } from './core/simulation/SimulationCore';`, resolveDir: SRC, loader: 'ts' },
    bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'error',
    plugins: [{ name: 'mutant', setup(b) {
      b.onLoad({ filter: /(precisionMath|SimulationCore)\.ts$/ }, async (a) => {
        let src = fs.readFileSync(a.path, 'utf8')
        patches.forEach(([file, re, to, n], i) => {
          if (path.resolve(a.path) !== FILES[file]) return
          const m = src.match(re)?.length ?? 0
          if (m !== n) throw new Error(`mutant ${name}: ${re} matched ${m}x, expected ${n}x`)
          src = src.replace(re, to); applied.add(i)
        })
        return { contents: src, loader: 'ts' }
      })
    } }],
  })
  if (applied.size !== patches.length) throw new Error(`mutant ${name}: only ${applied.size}/${patches.length} patches applied`)
  return import(pathToFileURL(outfile).href + `?v=${name}`)
}

// ---- oracle: replays the pinned rules on raw inputs ----------------------------------------
class Oracle {
  constructor() { this.O = { x: 0, y: 0, z: 0 }; this.ents = []; this.count = 0 }
  add(e) { this.ents.push({ p: { ...e.p }, v: { x: 0, y: 0, z: 0, ...e.v }, dyn: e.dyn !== false }) }
  tick() {
    for (const e of this.ents) if (e.dyn) for (const a of AX) e.p[a] += e.v[a] * DT
    const f = this.ents[0]
    if (Math.max(...AX.map((a) => Math.abs(f.p[a] - this.O[a]))) > THRESHOLD) {
      this.O = { x: pinnedOrigin(f.p.x), y: pinnedOrigin(f.p.y), z: pinnedOrigin(f.p.z) }
      this.count++
    }
  }
  local(i, a) { return Math.fround(this.ents[i].p[a] - this.O[a]) }
}

// ---- scenarios -----------------------------------------------------------------------------
const st = (p) => ({ p, dyn: false })
const SCENARIOS = []
for (const a of AX) for (const s of [1, -1]) {
  const at = (v) => ({ x: 0, y: 0, z: 0, [a]: s * v })
  SCENARIOS.push({ name: `edge-${s > 0 ? '+' : '-'}${a}-1024`, as: 'trigger-boundary', ticks: 1, ents: [st(at(1024))] })
  SCENARIOS.push({ name: `edge-${s > 0 ? '+' : '-'}${a}-1024+eps`, as: 'trigger-boundary', ticks: 1, ents: [st(at(1024 + EPS))] })
}
SCENARIOS.push({ name: 'edge-corner-1024', as: 'trigger-boundary', ticks: 1, ents: [st({ x: 1024, y: -1024, z: 1024 })] })
for (const [n, x] of [['tie+1152', 1152], ['tie-1152', -1152], ['below-tie', 1152 - 1e-7], ['tie+3200', 3200], ['tie-5248', -5248]]) {
  SCENARIOS.push({ name: n, as: 'tie-rounding', ticks: 1, ents: [st({ x, y: 0, z: 1152 })] })
}
SCENARIOS.push({ name: 'fly-x-2000', ticks: 300, ents: [{ p: { x: 0, y: 0, z: 0 }, v: { x: 2000 } }] })
SCENARIOS.push({ name: 'fly-diagonal', ticks: 600, celestials: true, ents: [{ p: { x: 3.3, y: -7.1, z: 0.25 }, v: { x: 1700.3, y: -911.7, z: 452.25 } }, { p: { x: 400.5, y: 10, z: -90 }, v: { x: 1690, y: -900, z: 460 } }] })
SCENARIOS.push({ name: 'fly-negative-fast', ticks: 240, ents: [{ p: { x: 0, y: 0, z: 0 }, v: { x: -7300.1, y: 3100, z: 0 } }, { p: { x: -12.5, y: 33, z: 7 }, dyn: false }] })
SCENARIOS.push({ name: 'au-static', ticks: 3, celestials: true, ents: [st({ x: 149597870700 + 300.7, y: -22e9 + 17.3, z: 5e9 + 0.123 }), st({ x: 149597870700 + 800.95, y: -22e9 - 60.2, z: 5e9 + 3.248 })] })
SCENARIOS.push({ name: 'au-fly', ticks: 180, celestials: true, ents: [{ p: { x: 1e11 + 0.5, y: 2e10, z: -3e10 }, v: { x: 30000.3, y: -1234.5, z: 777.7 } }] })

function evaluate(S) {
  const R = {}
  const put = (id, ok, detail) => { const r = (R[id] ??= { ok: true, detail: 'ok', n: 0 }); r.n++; if (!ok && r.ok) { r.ok = false; r.detail = detail } }
  for (const sc of SCENARIOS) {
    const core = new S.SimulationCore(), or = new Oracle(), evs = []
    core.onRebase((ev) => evs.push({ d: AX.map((a) => ev.delta[a]), n: AX.map((a) => ev.newOrigin[a]) }))
    sc.ents.forEach((e, i) => { core.registerEntity(`e${i}`, { absPos: e.p, velocity: e.v && { x: 0, y: 0, z: 0, ...e.v }, dynamic: e.dyn }); or.add(e) })
    const originId = sc.as ?? 'origin-exact'
    for (let t = 0; t < sc.ticks; t++) {
      const before = evs.length
      core.tick(); or.tick()
      const where = `${sc.name}@t${t + 1}`
      const O = core.getOrigin()
      put(originId, AX.every((a) => O[a] === or.O[a]) && core.stats.rebaseCount === or.count,
        `${where} origin (${AX.map((a) => O[a])}) #${core.stats.rebaseCount} vs truth (${AX.map((a) => or.O[a])}) #${or.count}`)
      sc.ents.forEach((_, i) => {
        const s = core.getEntityState(`e${i}`)
        put('abs-f64-exact', AX.every((a) => s.absPos[a] === or.ents[i].p[a]), `${where} e${i} absPos`)
        const bad = AX.findIndex((a, k) => s.localPosF32[k] !== or.local(i, a))
        put('locals-exact', bad < 0, bad < 0 ? '' : `${where} e${i}.${AX[bad]} ${s.localPosF32[bad]} vs ${or.local(i, AX[bad])} (err ${Math.abs(s.localPosF32[bad] - or.local(i, AX[bad]))} m)`)
      })
      const lp = core.getEntityState('e0').localPosF32
      const m = Math.max(Math.abs(lp[0]), Math.abs(lp[1]), Math.abs(lp[2]))
      put('post-tick-bound', m <= THRESHOLD && core.stats.focusMaxLocalPostTick <= THRESHOLD, `${where} focus max-axis local ${m} (stat ${core.stats.focusMaxLocalPostTick}) > ${THRESHOLD}`)
      if (evs.length > before) put('recentre', m <= LATTICE / 2, `${where} focus local ${m} > ${LATTICE / 2} right after rebase`)
      for (const ev of evs.slice(before)) {
        // f32-exactness of Δ is the m1a T4 claim; it holds by construction only for |Δ| ≤ 2^32
        // (256 · 2^24). Beyond that (first rebase at AU range) Δ is f64-exact and never narrowed —
        // locals come from f64(P − O). ADR-007 §2.
        put('lattice-delta', ev.d.every((d) => d % LATTICE === 0 && (Math.abs(d) > 2 ** 32 || Math.fround(d) === d)) && ev.n.every((v, k) => v === O[AX[k]]),
          `${where} Δ (${ev.d}) newOrigin (${ev.n})`)
      }
      if (sc.celestials) {
        for (const c of core.rail.states) {
          const bad = AX.findIndex((a, k) => c.localPosF32[k] !== Math.fround(c.absPos[a] - or.O[a]))
          put('celestial-locals-exact', bad < 0, bad < 0 ? '' : `${where} ${c.id}.${AX[bad]} ${c.localPosF32[bad]} vs ${Math.fround(c.absPos[AX[bad]] - or.O[AX[bad]])}`)
        }
      }
    }
  }
  return R
}

// ---- mutants: [label, source patches, checks that must turn red] ---------------------------
const RX = /(\w+\.localPosF32\[\d\] = \w+\.absPos\.[xyz]) - origin\./g
const MUTANTS = [
  ['threshold-1023', [['pm', /REBASE_THRESHOLD = 1024;/g, 'REBASE_THRESHOLD = 1023;', 1]], ['trigger-boundary']],
  ['threshold-2048', [['pm', /REBASE_THRESHOLD = 1024;/g, 'REBASE_THRESHOLD = 2048;', 1]], ['trigger-boundary', 'post-tick-bound']],
  ['trigger-non-strict', [['pm', /maxAxisAbs\(pLocal\) > REBASE_THRESHOLD/g, 'maxAxisAbs(pLocal) >= REBASE_THRESHOLD', 1]], ['trigger-boundary']],
  ['lattice-128', [['pm', /ORIGIN_LATTICE = 256;/g, 'ORIGIN_LATTICE = 128;', 1]], ['tie-rounding', 'origin-exact']],
  ['lattice-512', [['pm', /ORIGIN_LATTICE = 256;/g, 'ORIGIN_LATTICE = 512;', 1]], ['origin-exact', 'recentre']],
  ['origin-floor-no-half', [['pm', /\/ ORIGIN_LATTICE \+ 0\.5\)/g, '/ ORIGIN_LATTICE)', 3]], ['tie-rounding', 'origin-exact', 'recentre']],
  ['early-f32-rounding', [['sc', /(\w+)\.localPosF32\[(\d)\] = \1\.absPos\.([xyz]) - origin\.\3;/g, '$1.localPosF32[$2] = Math.fround($1.absPos.$3) - Math.fround(origin.$3);', 6]], ['locals-exact', 'celestial-locals-exact']],
  ['stale-locals-pre-rebase-origin', [
    ['sc', /const origin = this\._origin;/g, 'const origin = this._origin; const __stale = { x: origin.x, y: origin.y, z: origin.z };', 1],
    ['sc', RX, '$1 - __stale.', 6]], ['locals-exact', 'celestial-locals-exact', 'post-tick-bound']],
]
if (DELIB) MUTANTS.push(['deliberate-identity', [], ['locals-exact']])

let exit = 0
const show = (label, R) => { for (const [id, r] of Object.entries(R)) console.log(`  ${r.ok ? 'PASS' : 'FAIL'} ${label} ${id} (${r.n} obs) — ${r.detail}`) }
try {
  const R0 = evaluate(await load('production'))
  const ids = Object.keys(R0)
  if (!SELF) {
    show('baseline', R0)
    const pass = ids.filter((k) => R0[k].ok).length
    console.log(`PRECISION GATE ${pass === ids.length ? 'PASS' : 'FAIL'} ${pass}/${ids.length}`)
    exit = pass === ids.length ? 0 : 1
  } else {
    const rows = []
    const baseGreen = ids.every((k) => R0[k].ok)
    rows.push(['baseline-green', baseGreen, `${ids.filter((k) => R0[k].ok).length}/${ids.length}`])
    if (!baseGreen) show('baseline', R0)
    for (const [label, patches, must] of MUTANTS) {
      const R = evaluate(await load(label, patches))
      const red = ids.filter((k) => !R[k].ok)
      rows.push([label, must.every((k) => R[k] && !R[k].ok), `red: ${red.join(',') || 'none'} (must: ${must.join(',')})`])
    }
    rows.push(['production-source-unchanged', hashOf() === PRODUCTION, ''])
    for (const [l, ok, d] of rows) console.log(`${ok ? 'PASS' : 'FAIL'} ${l} ${d}`)
    const n = rows.filter((r) => r[1]).length
    console.log(`SELF-TEST ${n === rows.length ? 'PASS' : 'FAIL'} ${n}/${rows.length}`)
    exit = n === rows.length ? 0 : 1
  }
} catch (err) {
  console.error('PRECISION GATE BROKEN', err?.stack ?? err)
  exit = 2
}
process.exit(exit)