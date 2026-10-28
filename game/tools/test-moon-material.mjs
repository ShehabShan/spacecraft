// T3 S3 gate (ADR-029): the play terrain material's mare mask.
// 1. injectMoonShader on the real three ShaderLib.standard sources: both
//    markers replaced once, missing markers throw.
// 2. A JS mirror of the injected vertex math (moon-fixed dir + smoothstep) equals
//    terrainField `moonMareMask` on 20,000 random directions and on the spawn.
// 3. Frame recovery: for random spin quats and origins, conj(qS)·(world + o)
//    returns the moon-fixed point placed by spinGroup = T(−o)·R(qS).
// 4. setFrame keeps uniform object identity (allocation-free per frame).
// --self-test: mutants (no conj, wrong shore, mask min instead of max) must fail.
// Run: node tools/test-moon-material.mjs [--self-test]
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
import * as THREE from 'three'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-moon-material.bundle.mjs')
await build({
  stdin: {
    contents: `export * from './play/world/moonMaterial'; export * from './core/terrain/terrainField';
      export { MOON_PARAMS } from './play/world/moonConfig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, external: ['three'], logLevel: 'error',
})
const M = await import(pathToFileURL(out).href)

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function randDir(r) { for (;;) { const x = 2 * r() - 1, y = 2 * r() - 1, z = 2 * r() - 1, l = Math.hypot(x, y, z)
  if (l > 1e-3 && l <= 1) return [x / l, y / l, z / l] } }

// JS mirror of VERT_BODY. `mut` selects a deliberate defect for --self-test.
function shaderMask(mat, shore, wx, wy, wz, o, qc, mut) {
  let px = wx + o[0], py = wy + o[1], pz = wz + o[2]
  const q = mut === 'noconj' ? [-qc[0], -qc[1], -qc[2], qc[3]] : qc
  const tx = 2 * (q[1] * pz - q[2] * py), ty = 2 * (q[2] * px - q[0] * pz), tz = 2 * (q[0] * py - q[1] * px)
  let dx = px + q[3] * tx + (q[1] * tz - q[2] * ty)
  let dy = py + q[3] * ty + (q[2] * tx - q[0] * tz)
  let dz = pz + q[3] * tz + (q[0] * ty - q[1] * tx)
  const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l
  const w = mut === 'shore' ? shore * 1.5 : shore
  let mask = mut === 'min' ? 1 : 0
  for (let i = 0; i < mat.basinCount; i++) {
    const b = mat.basins[i]
    const c = dx * b.x + dy * b.y + dz * b.z
    // mirror of the shader cos culls (uMoonBasinCos), recomputed from w here
    if (mut !== 'min') {
      if (c <= Math.cos(b.w)) continue
      if (c >= Math.cos(b.w - w)) { mask = 1; break }
    }
    let s = (Math.acos(Math.min(c, 1)) - (b.w - w)) / w; s = s < 0 ? 0 : s > 1 ? 1 : s
    const mk = 1 - s * s * (3 - 2 * s)
    mask = mut === 'min' ? Math.min(mask, mk) : Math.max(mask, mk)
  }
  return mask
}

function run(mut) {
  const fails = []; let n = 0
  const ok = (c, msg) => { n++; if (!c) fails.push(msg) }
  const P = M.MOON_PARAMS, R = P.radius
  M.initTerrainField(P)
  // 1. injection on the real three sources
  const sh = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader }
  M.injectMoonShader(sh)
  ok(sh.vertexShader.includes('vMoonMare = mMask') && sh.vertexShader.includes('#include <begin_vertex>'), 'vertex injected, begin_vertex kept')
  ok(sh.fragmentShader.includes('uMoonMareAlbedo, vMoonMare') && sh.fragmentShader.includes('#include <color_fragment>'), 'fragment injected, color_fragment kept')
  ok(sh.vertexShader.split('#include <begin_vertex>').length === 2, 'begin_vertex appears once')
  let threw = false; try { M.injectMoonShader({ vertexShader: 'void main(){}', fragmentShader: 'void main(){}' }) } catch { threw = true }
  ok(threw, 'missing markers throw')
  // 2. mirror == moonMareMask (identity frame)
  const mat = M.createMoonTerrainMaterial(P.moon)
  ok(mat.basinCount === P.moon.basins.length / 4 && mat.basinCount <= M.MOON_MAX_BASINS, `basin count ${mat.basinCount}`)
  const r = rng(0x5e3), I = [0, 0, 0, 1], Z = [0, 0, 0]
  let maxErr = 0, mare = 0, shoreN = 0
  for (let k = 0; k < 20000; k++) {
    const [x, y, z] = randDir(r)
    const ref = M.moonMareMask(x, y, z)
    const got = shaderMask(mat, P.moon.shoreWidth, x * R, y * R, z * R, Z, I, mut)
    maxErr = Math.max(maxErr, Math.abs(ref - got))
    if (ref > 0.5) mare++; if (ref > 0 && ref < 1) shoreN++
  }
  let cosErr = 0
  for (let i = 0; i < mat.basinCount; i++) {
    const b = mat.basins[i], cb = mat.basinCos[i]
    cosErr = Math.max(cosErr, Math.abs(cb.x - Math.cos(b.w)), Math.abs(cb.y - Math.cos(b.w - P.moon.shoreWidth)))
  }
  ok(cosErr < 1e-12 && mat.basinCos[mat.basinCount].x > 1, `basinCos bounds (max |Δ| ${cosErr}), unused slot never inside`)
  ok(maxErr < 1e-9, `mirror vs moonMareMask max |Δ| ${maxErr.toExponential(2)} (bound 1e-9)`)
  ok(shoreN > 100, `shore samples ${shoreN} > 100 (the band is exercised)`)
  console.log(`  mare (mask>0.5) ${(100 * mare / 20000).toFixed(1)}% of 20,000 dirs; shore ${shoreN}; max |Δ| ${maxErr.toExponential(2)}`)
  // 3. frame recovery: world = R(qS)·m − o
  let maxFrame = 0
  for (let k = 0; k < 2000; k++) {
    const [x, y, z] = randDir(r), h = R + 400 * (r() - 0.5)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...randDir(r)), 2 * Math.PI * r())
    const o = [2048 * (r() - 0.5), 2048 * (r() - 0.5), 2048 * (r() - 0.5)]
    const wv = new THREE.Vector3(x * h, y * h, z * h).applyQuaternion(q)
    const qc = [-q.x, -q.y, -q.z, q.w]
    const got = shaderMask(mat, P.moon.shoreWidth, wv.x - o[0], wv.y - o[1], wv.z - o[2], o, qc, mut)
    maxFrame = Math.max(maxFrame, Math.abs(got - M.moonMareMask(x, y, z)))
  }
  ok(maxFrame < 1e-9, `frame recovery max |Δ| ${maxFrame.toExponential(2)} over 2,000 spun/rebased poses`)
  // spawn sits on mare floor (ADR-028 am. 1)
  const b0 = mat.basins[0]
  ok(shaderMask(mat, P.moon.shoreWidth, b0.x * R, b0.y * R, b0.z * R, Z, I, mut) === 1, 'basin 0 centre (spawn base) is full mare')
  // 4. setFrame: allocation-free, writes the conjugate
  const u0 = mat.material.onBeforeCompile; const sh2 = { uniforms: {}, ...THREE.ShaderLib.standard }
  const s2 = { uniforms: {}, vertexShader: sh2.vertexShader, fragmentShader: sh2.fragmentShader }
  u0.call(mat.material, s2)
  const oRef = s2.uniforms.uMoonOrigin.value, qRef = s2.uniforms.uMoonSpinConj.value
  for (let i = 0; i < 1000; i++) mat.setFrame(i, -i, 2 * i, 0.1, 0.2, 0.3, 0.927)
  ok(s2.uniforms.uMoonOrigin.value === oRef && s2.uniforms.uMoonSpinConj.value === qRef, 'setFrame keeps uniform identity')
  ok(oRef.x === 999 && oRef.y === -999 && oRef.z === 1998, 'setFrame writes the origin')
  ok(qRef.x === -0.1 && qRef.y === -0.2 && qRef.z === -0.3 && qRef.w === 0.927, 'setFrame writes conj(qS)')
  ok(s2.uniforms.uMoonMareAlbedo.value === M.MOON_MARE_ALBEDO && M.MOON_MARE_ALBEDO > 0 && M.MOON_MARE_ALBEDO < 1, 'mare albedo factor in (0,1)')
  ok(mat.material.customProgramCacheKey() === 'solaris-moon-mare-v1', 'program cache key')
  // no profile → no basins, mask 0
  const flat = M.createMoonTerrainMaterial(undefined)
  ok(flat.basinCount === 0, 'no Moon profile → 0 basins')
  return { n, fails }
}

if (process.argv.includes('--self-test')) {
  let bad = 0
  const base = run(null); if (base.fails.length) { console.log('baseline FAIL', base.fails); bad++ }
  for (const m of ['noconj', 'shore', 'min']) {
    const r = run(m); const caught = r.fails.length > 0
    console.log(`mutant ${m}: ${caught ? 'caught' : 'MISSED'} (${r.fails.length} fails)`); if (!caught) bad++
  }
  console.log(`test-moon-material self-test ${bad === 0 ? 'PASS 4/4' : 'FAIL'}`); process.exit(bad === 0 ? 0 : 1)
}
const { n, fails } = run(null)
for (const f of fails) console.log('FAIL ' + f)
console.log(`test-moon-material ${fails.length === 0 ? 'PASS' : 'FAIL'} ${n - fails.length}/${n}`)
process.exit(fails.length === 0 ? 0 : 1)