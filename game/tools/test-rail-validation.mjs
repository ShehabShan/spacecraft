// F3aba rail boot-validation gate (ADR-012): KeplerRail must reject invalid orbit elements at boot.
// WHY: before F3aba an e ≥ 1, a ≤ 0 or non-finite element produced a silent NaN state every tick
// (A1-U12-2). The gate builds the REAL KeplerRail from source; the self-test rebuilds it with the
// validation removed or weakened and requires every mutant to turn the gate red.
//
// Run from game/:
//   node tools/test-rail-validation.mjs                         gate   (exit 0 PASS, 1 FAIL, 2 broken)
//   node tools/test-rail-validation.mjs --self-test [--deliberate]   every mutant must turn the gate red
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const SELF = args.includes('--self-test'), DELIB = args.includes('--deliberate')
const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const railFile = path.join(game, 'src', 'core', 'orbit', 'KeplerRail.ts')

// Bundle the real rail + catalog; `edit` rewrites KeplerRail.ts source text (mutants only).
async function load(tag, edit) {
  const out = path.join(game, 'node_modules', '.cache', `f3aba-rail-${tag}.bundle.mjs`)
  const plugin = {
    name: 'mutate',
    setup(b) {
      b.onLoad({ filter: /KeplerRail\.ts$/ }, () => {
        const src = readFileSync(railFile, 'utf8')
        const next = edit ? edit(src) : src
        if (edit && next === src) throw new Error(`mutant ${tag}: edit did not apply`)
        return { contents: next, loader: 'ts' }
      })
    },
  }
  await build({
    stdin: {
      contents: `export { KeplerRail } from './core/orbit/KeplerRail';
        export { CELESTIAL_CONFIGS } from './core/orbit/celestialData';`,
      resolveDir: path.join(game, 'src'), loader: 'ts',
    },
    bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', plugins: [plugin],
  })
  return import(pathToFileURL(out).href + `?t=${tag}`)
}

// Invalid-element cases, each applied to one real orbiting body (Moon and Triton: a moon and the
// retrograde orbit). Expected: constructor throws and the message names the body.
const BAD = [
  ['e=1', (o) => { o.e = 1 }],
  ['e=1.5', (o) => { o.e = 1.5 }],
  ['e=-0.1', (o) => { o.e = -0.1 }],
  ['e=NaN', (o) => { o.e = NaN }],
  ['a=0', (o) => { o.a = 0 }],
  ['a=-1000', (o) => { o.a = -1000 }],
  ['a=NaN', (o) => { o.a = NaN }],
  ['a=Infinity', (o) => { o.a = Infinity }],
  ['i=NaN', (o) => { o.i = NaN }],
  ['Omega=Infinity', (o) => { o.Omega = Infinity }],
  ['omega=NaN', (o) => { o.omega = NaN }],
  ['M0=NaN', (o) => { o.M0 = NaN }],
  ['n=NaN', (o) => { o.n = NaN }],
  ['muHost=0', (o) => { o.muHost = 0 }],
  ['T=NaN', (o) => { o.T = NaN }],
]
const TARGETS = ['moon', 'triton']
// Boundary values that MUST still boot (validation must not over-reject).
const GOOD = [
  ['e=0', (o) => { o.e = 0 }],
  ['e=0.9999', (o) => { o.e = 0.9999 }],
  ['i=pi (polar-flip edge)', (o) => { o.i = Math.PI }],
  ['M0=-10 (unwrapped)', (o) => { o.M0 = -10 }],
]

function finiteState(rail, t) {
  rail.evaluate(t)
  for (const s of rail.states) for (const k of ['x', 'y', 'z']) if (!Number.isFinite(s.absPos[k])) return false
  return true
}

function runGate(mod) {
  const { KeplerRail, CELESTIAL_CONFIGS } = mod
  const res = []
  const add = (name, ok, detail) => res.push({ name, ok, detail })
  // 1. production catalog boots, every body has a finite state at several times
  try {
    const rail = new KeplerRail(structuredClone(CELESTIAL_CONFIGS))
    const ok = rail.states.length === CELESTIAL_CONFIGS.length && [0, 1e6, -3e7].every((t) => finiteState(rail, t))
    add('production-boots', ok, `${rail.states.length}/${CELESTIAL_CONFIGS.length} bodies, finite at t=0,1e6,-3e7`)
  } catch (e) { add('production-boots', false, String(e.message)) }
  // 2. every invalid element is rejected at boot, naming the body
  for (const id of TARGETS) for (const [label, mut] of BAD) {
    const cfg = structuredClone(CELESTIAL_CONFIGS)
    const body = cfg.find((c) => c.id === id)
    mut(body.orbit)
    let threw = null
    try { new KeplerRail(cfg) } catch (e) { threw = e }
    const ok = threw !== null && threw.message.includes(`'${id}'`)
    add(`reject ${id} ${label}`, ok, threw ? threw.message : 'constructed without error')
  }
  // 3. valid boundary elements still boot and evaluate finite
  for (const [label, mut] of GOOD) {
    const cfg = structuredClone(CELESTIAL_CONFIGS)
    mut(cfg.find((c) => c.id === 'moon').orbit)
    try {
      const rail = new KeplerRail(cfg)
      add(`accept moon ${label}`, finiteState(rail, 12345.6), 'booted, finite')
    } catch (e) { add(`accept moon ${label}`, false, e.message) }
  }
  return res
}

const MUTANTS = [
  ['validation-call-removed', (s) => s.replace('validateOrbit(cfg.id, o);', '')],
  ['e<=1-accepted', (s) => s.replace('o.e >= 0 && o.e < 1', 'o.e >= 0 && o.e <= 1')],
  ['negative-e-accepted', (s) => s.replace('o.e >= 0 && o.e < 1', 'o.e > -1 && o.e < 1')],
  ['a=0-accepted', (s) => s.replace('!(o.a > 0)', '!(o.a >= 0)')],
  ['finite-check-skipped', (s) => s.replace('if (!Number.isFinite(fields[k][1]))', 'if (false)')],
  ['muHost-check-removed', (s) => s.replace("if (!(o.muHost > 0))", 'if (false)')],
]
if (DELIB) MUTANTS.push(['deliberate-identity (must stay green → self-test FAIL)', (s) => s.replace('validateOrbit(cfg.id, o);', 'validateOrbit(cfg.id, o); ')])

try {
  if (!SELF) {
    const res = runGate(await load('real'))
    for (const r of res) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name} — ${r.detail}`)
    const pass = res.filter((r) => r.ok).length
    console.log(`rail-validation gate: ${pass}/${res.length} ${pass === res.length ? 'PASS' : 'FAIL'}`)
    process.exit(pass === res.length ? 0 : 1)
  } else {
    // Evidence of the original defect: without validation, e=1.5 boots and yields NaN positions.
    const unvalidated = await load('nocall', MUTANTS[0][1])
    const cfg = structuredClone(unvalidated.CELESTIAL_CONFIGS)
    cfg.find((c) => c.id === 'moon').orbit.e = 1.5
    const r = new unvalidated.KeplerRail(cfg)
    console.log(`baseline defect (validation removed, moon e=1.5): finite state = ${finiteState(r, 1000)}`)
    let red = 0
    for (const [name, edit] of MUTANTS) {
      const res = runGate(await load(name.replace(/[^a-z0-9]+/gi, '_'), edit))
      const fails = res.filter((x) => !x.ok)
      const isRed = fails.length > 0
      if (isRed) red++
      console.log(`${isRed ? 'RED  ' : 'GREEN'}  mutant ${name} — ${fails.length} failing checks${fails.length ? ` (e.g. ${fails[0].name})` : ''}`)
    }
    console.log(`rail-validation self-test: ${red}/${MUTANTS.length} mutants red ${red === MUTANTS.length ? 'PASS' : 'FAIL'}`)
    process.exit(red === MUTANTS.length ? 0 : 1)
  }
} catch (e) {
  console.error('BROKEN:', e.stack || e)
  process.exit(2)
}