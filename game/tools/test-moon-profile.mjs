import { register } from 'node:module'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
register('./ts-resolve-loader.mjs', import.meta.url)

// T3 S1 gate (docs/T3-plan.md §8 S1, ADR-028): the opt-in Moon profile in
// terrainField.ts. Checks the playability targets on the S1 candidate (plan
// §3.1 "G-prune"), the default-path bit-identity pins taken on the pre-T3 tree,
// determinism, structured-clone safety and the cost budget.
// Prints `[test-moon-profile] PASS n/n` (exit 0) or the failures (exit 1).
// `--self-test` runs the mutants (profile off, mare radius 0, crater depth ×10,
// default-path perturbation); each must exit 1. `--mutant=<name>` runs one.
const TF = await import('../src/core/terrain/terrainField.ts')
const NZ = await import('../src/core/terrain/noise.ts')
const MC = await import('../src/play/world/moonConfig.ts')

const args = process.argv.slice(2)
const MUTANTS = ['off', 'r0', 'deep', 'default']
if (args.includes('--self-test')) {
  const self = fileURLToPath(import.meta.url); let caught = 0
  for (const m of MUTANTS) {
    const r = spawnSync(process.execPath, [self, `--mutant=${m}`], { encoding: 'utf8' })
    const ok = r.status === 1; if (ok) caught++
    const why = (r.stdout.split('\n').find(l => l.includes('FAIL')) || '').slice(0, 160)
    console.log(`[test-moon-profile] mutant ${m}: exit ${r.status} ${ok ? 'caught' : 'NOT CAUGHT'} ${why}`)
  }
  console.log(`[test-moon-profile] SELF-TEST ${caught === MUTANTS.length ? 'PASS' : 'FAIL'} ${caught}/${MUTANTS.length}`)
  process.exit(caught === MUTANTS.length ? 0 : 1)
}
const MUT = (args.find(a => a.startsWith('--mutant=')) || '').slice(9)
if (MUT && !MUTANTS.includes(MUT)) { console.log(`unknown mutant ${MUT}`); process.exit(2) }

const fails = []; let n = 0
const ok = (cond, msg) => { n++; if (!cond) fails.push(msg) }

// ---- fixtures ---------------------------------------------------------------
// Pre-T3 harness/play moon values (by value, so S2's MOON_PARAMS.moon can't move it).
const HARNESS_MOON = { name: 'M1F Moon (catalog)', radius: 1364.5, seed: 20240119, continentFreq: 2.3,
  continentAmp: 95, maskFreq: 3.7, mountainFreq: 6.5, mountainAmp: 230, detailFreq: 22, detailAmp: 16 }
// WHY: SHA-256 of terrainHeight Float64 bytes on 4,096 Fibonacci dirs, taken on the
// UNEDITED tree (docs/audit/evidence/T3/P0/feasibility-probe.log, plan §3.1).
const PIN_TEST_PLANET = '412ed993c2fe088cc1f2f65116c9330ec4ddbe49a477f7a4e2d49b676a755e02'
const PIN_HARNESS_MOON = 'b7403bae174f81c8a8be7ddd587ab16445cfc33cfc06815f76d293a794a170b6'

// Basin placement = the P0 probe's makeBasins (non-overlap, mulberry32(0x7a3e)), flat.
function makeBasins(radii, seed) {
  const rnd = NZ.mulberry32(seed), out = [{ d: [0, 0, 1], r: radii[0] }]
  for (let k = 1; k < radii.length; k++) {
    let best = null
    for (let t = 0; t < 4000; t++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, q = Math.sqrt(1 - u * u)
      const d = [Math.cos(th) * q, u, Math.sin(th) * q]
      if (out.every(o => Math.acos(Math.min(1, d[0] * o.d[0] + d[1] * o.d[1] + d[2] * o.d[2])) > (o.r + radii[k]) * 0.9 + 0.08)) { best = d; break }
    }
    out.push({ d: best || [0, 1, 0], r: radii[k] })
  }
  return out.flatMap(o => [o.d[0], o.d[1], o.d[2], o.r])
}
const RADII = [0.62, 0.52, 0.45, 0.40, 0.36, 0.32, 0.28].map(r => r * (MUT === 'r0' ? 0 : 1.15))
const DEPTH = 0.18 * (MUT === 'deep' ? 10 : 1)
const CAND = {
  ...HARNESS_MOON, name: 'T3 S1 candidate G-prune',
  mountainAmp: HARNESS_MOON.mountainAmp * 0.12, detailAmp: HARNESS_MOON.detailAmp * 0.35,
  moon: {
    basins: makeBasins(RADII, 0x7a3e), shoreWidth: 0.08, rimSigma: 0.05, rimOffset: 0.024,
    rimAmp0: 25, rimAmpPerRad: 45 / 0.62, floorHeight: -25, floorFreq: 8, floorAmp: 1.2,
    mareCraterDamp: 0.9,
    craters: [9, 0.55, 18, 60, DEPTH, 0.05, 0x51a7, 32, 0.45, 8, 16, DEPTH, 0.05, 0x3c91],
  },
}
if (MUT === 'off') delete CAND.moon

function fibDir(i, N) {
  const y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), th = Math.PI * (3 - Math.sqrt(5)) * i
  return [Math.cos(th) * r, y, Math.sin(th) * r]
}
function heightHash(params) {
  TF.initTerrainField(params)
  const h = createHash('sha256'), b = new Float64Array(1)
  for (let i = 0; i < 4096; i++) { const [x, y, z] = fibDir(i, 4096); b[0] = TF.terrainHeight(x, y, z); h.update(new Uint8Array(b.buffer)) }
  return h.digest('hex')
}

// ---- 1. default path bit-identical ----------------------------------------
const TP = MUT === 'default' ? { ...TF.TEST_PLANET, detailAmp: TF.TEST_PLANET.detailAmp + 1e-9 } : TF.TEST_PLANET
const hTP = heightHash(TP), hHM = heightHash(HARNESS_MOON)
ok(hTP === PIN_TEST_PLANET, `TEST_PLANET hash ${hTP.slice(0, 12)}… != pin ${PIN_TEST_PLANET.slice(0, 12)}…`)
ok(hHM === PIN_HARNESS_MOON, `harness MOON hash ${hHM.slice(0, 12)}… != pin ${PIN_HARNESS_MOON.slice(0, 12)}…`)
ok(MC.MOON_PARAMS.moon === undefined, 'MOON_PARAMS.moon must stay unset until S2')

// ---- 2. determinism + structured clone (worker path) ----------------------
const hC1 = heightHash(CAND), hC2 = heightHash(TF.TEST_PLANET) && heightHash(CAND), hC3 = heightHash(structuredClone(CAND))
ok(hC1 === hC2, 'candidate hash differs across re-init')
ok(hC1 === hC3, 'candidate hash differs after structuredClone (worker params)')

// ---- 3. playability targets (20k Fibonacci dirs, real normals) ------------
TF.initTerrainField(CAND)
const N = 20000, nrm = { x: 0, y: 0, z: 0 }
let lt5 = 0, lt45 = 0, ge50 = 0, ge30 = 0, mare = 0, hmin = 1e9, hmax = -1e9
for (let i = 0; i < N; i++) {
  const [x, y, z] = fibDir(i, N), h = TF.terrainHeight(x, y, z)
  if (h < hmin) hmin = h; if (h > hmax) hmax = h
  TF.terrainNormalInto(x, y, z, nrm)
  const s = Math.acos(Math.max(-1, Math.min(1, nrm.x * x + nrm.y * y + nrm.z * z))) * 180 / Math.PI
  if (s < 5) lt5++; if (s < 45) lt45++; if (s >= 50) ge50++; if (s >= 30) ge30++
  if (TF.moonMareMask(x, y, z) > 0.9) mare++
}
const pc = v => 100 * v / N, HB = MC.MAX_TERRAIN_H - 20
ok(pc(lt5) >= 30, `slope <5° ${pc(lt5).toFixed(1)}% < 30%`)
ok(pc(lt45) >= 85, `slope <45° ${pc(lt45).toFixed(1)}% < 85%`)
ok(pc(ge50) <= 5, `slope ≥50° ${pc(ge50).toFixed(1)}% > 5%`)
ok(pc(mare) >= 25 && pc(mare) <= 40, `mare ${pc(mare).toFixed(1)}% outside 25–40%`)
ok(pc(ge30) >= 3, `slope ≥30° ${pc(ge30).toFixed(1)}% < 3% (no mountains)`)
ok(hmax >= 150, `max h ${hmax.toFixed(1)} m < 150 m (no mountains)`)
ok(Math.max(-hmin, hmax) <= HB, `|h| ${Math.max(-hmin, hmax).toFixed(1)} m > bound ${HB} m`)

// ---- 4. cost (best of 3, same run) ----------------------------------------
function cost(params) {
  TF.initTerrainField(params); let acc = 0, best = Infinity
  for (let i = 0; i < 5000; i++) { const [x, y, z] = fibDir(i, 5000); acc += TF.terrainHeight(x, y, z) }
  for (let rep = 0; rep < 3; rep++) {
    const t0 = performance.now()
    for (let i = 0; i < N; i++) { const [x, y, z] = fibDir(i, N); acc += TF.terrainHeight(x, y, z) }
    best = Math.min(best, performance.now() - t0)
  }
  return [best * 1e6 / N, acc]
}
const [cBase] = cost(HARNESS_MOON), [cCand] = cost(CAND), ratio = cCand / cBase
ok(ratio <= 2.0, `cost ${ratio.toFixed(2)}× baseline > 2.0×`)

console.log(`[test-moon-profile] ${MUT ? `mutant=${MUT} ` : ''}<5° ${pc(lt5).toFixed(1)}% · <45° ${pc(lt45).toFixed(1)}% · ` +
  `≥50° ${pc(ge50).toFixed(1)}% · ≥30° ${pc(ge30).toFixed(1)}% · mare ${pc(mare).toFixed(1)}% · h ${hmin.toFixed(1)}..${hmax.toFixed(1)} m · ` +
  `cost ${cCand.toFixed(0)}/${cBase.toFixed(0)} ns = ${ratio.toFixed(2)}× · candidate ${hC1.slice(0, 12)}…`)
if (fails.length) { for (const f of fails) console.log(`[test-moon-profile] FAIL ${f}`); console.log(`[test-moon-profile] FAIL ${n - fails.length}/${n}`); process.exit(1) }
console.log(`[test-moon-profile] PASS ${n}/${n}`)