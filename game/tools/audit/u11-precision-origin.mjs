// A1-U11 probe — precision + floating origin (READ-ONLY audit; imports the REAL
// src/core + src/render modules, mutates nothing under src/).
// Run: cd game && node tools/audit/u11-precision-origin.mjs ; echo PROBE_EXIT=$?
// Claims are written from IEEE-754 / the spec (Milestone 1A §1.1) BEFORE the code
// is trusted; each probe prints OK/FINDING and the script exits 1 only if a
// CONTROL fails (i.e. the probe itself is broken).
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)

const PM = await import('../../src/core/math/precisionMath.ts')
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts')
const { FloatingOriginAdapter } = await import('../../src/render/FloatingOriginAdapter.ts')
const THREE = await import('three')

let controlFail = 0
const ctl = (name, ok) => { console.log(`CONTROL ${ok ? 'OK  ' : 'FAIL'} ${name}`); if (!ok) controlFail++ }
const out = (tag, name, detail) => console.log(`${tag} ${name}: ${detail}`)
const f32 = Math.fround
const ulp32 = (x) => { const a = Math.abs(f32(x)); if (a === 0) return 2 ** -149; const e = Math.floor(Math.log2(a)); return 2 ** (e - 23) }
let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31

// ---- P1: lattice exactness of O and Δ (claim: O ≡ 0 mod 256 exactly; fround(Δ) === Δ)
{
  let oBad = 0, dBadSmall = 0, firstBadDelta = null
  for (let i = 0; i < 200000; i++) {
    const s = 10 ** (rnd() * 13) // 1 m .. 1e13 m
    const p = { x: (rnd() * 2 - 1) * s, y: (rnd() * 2 - 1) * s, z: 0 }
    const o = PM.calculateOrigin(p)
    if (o.x % 256 !== 0 || o.y % 256 !== 0) oBad++
    const q = { x: (rnd() * 2 - 1) * s, y: 0, z: 0 }
    const d = PM.calculateOrigin(q).x - o.x
    if (f32(d) !== d) { if (Math.abs(d) < 2 ** 32) dBadSmall++; else if (firstBadDelta === null || Math.abs(d) < firstBadDelta) firstBadDelta = Math.abs(d) }
  }
  out(oBad === 0 ? 'OK' : 'FINDING', 'P1a O multiple of 256', `bad=${oBad}/200000 over |P| ≤ 1e13 m`)
  out(dBadSmall === 0 ? 'OK' : 'FINDING', 'P1b fround(Δ)===Δ for |Δ| < 2^32 m', `bad=${dBadSmall}`)
  out('NOTE', 'P1c smallest non-f32-exact |Δ| seen', `${firstBadDelta?.toExponential(3)} m (theory: > 2^32 = ${(2 ** 32).toExponential(3)} m)`)
  ctl('P1 control: Δ = 2^32+256 is NOT f32-exact', f32(2 ** 32 + 256) !== 2 ** 32 + 256)
  // catalog: worst Δ when the focus jumps between any two bodies (t = 0 rails)
  const core = new SimulationCore()
  const st = core.getCelestialStates()
  let maxD = 0, pair = ''
  for (const a of st) for (const b of st) {
    const da = Math.abs(PM.calculateOrigin(a.absPos).x - PM.calculateOrigin(b.absPos).x)
    if (da > maxD) { maxD = da; pair = `${a.config.id}->${b.config.id}` }
  }
  out(f32(maxD) === maxD ? 'OK' : 'FINDING', 'P1d catalog worst body-to-body Δ (x axis)', `${maxD} m (${pair}); f32-exact=${f32(maxD) === maxD}; "|k2−k1| < 2^16" premise holds=${maxD / 256 < 2 ** 16}`)
  const realPluto = 5.906e12
  const dReal = PM.calculateOrigin({ x: realPluto, y: 0, z: 0 }).x - PM.calculateOrigin({ x: 1.496e11, y: 0, z: 0 }).x
  out('NOTE', 'P1e real-scale Earth->Pluto Δ', `${dReal.toExponential(4)} m f32-exact=${f32(dReal) === dReal}; f64 ulp at real Pluto = ${(2 ** (Math.floor(Math.log2(realPluto)) - 52)).toExponential(2)} m`)
}

// ---- P2: post-rebase local range (claim, types.ts + spec: symmetric [−128, +128])
{
  const edge = 127.99999999999998
  const o = PM.calculateOrigin({ x: edge, y: 128, z: -128 })
  out('NOTE', 'P2a round-half-up edges', `p=${edge} -> O=${o.x} local=${edge - o.x}; p=128 -> O=${o.y} local=${128 - o.y}; p=-128 -> O=${o.z} local=${-128 - o.z}`)
  let mn = 0, mx = 0
  for (let i = 0; i < 200000; i++) { const p = (rnd() * 2 - 1) * 4e6; const l = p - PM.calculateOrigin({ x: p, y: 0, z: 0 }).x; mn = Math.min(mn, l); mx = Math.max(mx, l) }
  out(mx < 128 && mn >= -128.0000001 ? 'OK' : 'FINDING', 'P2b sampled local range', `[${mn.toFixed(6)}, ${mx.toFixed(6)}] — half-open [−128, 128), worst edge −128 − 3e-14`)
}

// ---- P3: is the power-of-two lattice load-bearing? render error f32(P−O) − (P−O)
// for lattices 256 / 300 / 1000π with the same strict 1024 trigger, diagonal 2 km/s focus
{
  const run = (L) => {
    let O = { x: 0, y: 0, z: 0 }, P = { x: 3.77e6 + 0.123, y: -1.9e6 + 0.456, z: 7.1e5 + 0.789 }
    O = { x: L * Math.floor(P.x / L + 0.5), y: L * Math.floor(P.y / L + 0.5), z: L * Math.floor(P.z / L + 0.5) }
    let maxErr = 0, maxPop = 0, rebases = 0, prevRender = null
    for (let t = 0; t < 36000; t++) {
      P.x += 1414 / 60; P.y += 1000 / 60; P.z -= 700 / 60
      if (Math.max(Math.abs(P.x - O.x), Math.abs(P.y - O.y), Math.abs(P.z - O.z)) > 1024) {
        O = { x: L * Math.floor(P.x / L + 0.5), y: L * Math.floor(P.y / L + 0.5), z: L * Math.floor(P.z / L + 0.5) }; rebases++
      }
      const lx = f32(P.x - O.x), ly = f32(P.y - O.y), lz = f32(P.z - O.z)
      maxErr = Math.max(maxErr, Math.abs(lx - (P.x - O.x)), Math.abs(ly - (P.y - O.y)), Math.abs(lz - (P.z - O.z)))
      const rx = lx + O.x // reconstructed world position (f64) — a pop shows as a jump error
      if (prevRender !== null) maxPop = Math.max(maxPop, Math.abs((rx - prevRender) - 1414 / 60))
      prevRender = rx
    }
    return { maxErr, maxPop, rebases }
  }
  const res = { 256: run(256), 300: run(300), '1000pi': run(1000 * Math.PI) }
  for (const [k, v] of Object.entries(res)) out('NOTE', `P3 lattice ${k}`, `rebases=${v.rebases} max|f32(P−O)−(P−O)|=${v.maxErr.toExponential(2)} m max per-tick x pop=${v.maxPop.toExponential(2)} m`)
  const worst = Math.max(res[300].maxErr, res['1000pi'].maxErr)
  out(worst < 1.3e-4 ? 'FINDING' : 'OK', 'P3 non-power-of-two lattices render as exactly as 256', `worst non-2^n err ${worst.toExponential(2)} m vs 256: ${res[256].maxErr.toExponential(2)} m (bound ulp(1774)/2 = ${(ulp32(1774) / 2).toExponential(2)} m)`)
  ctl('P3 control: f32 BEFORE subtract at 3.77e6 m errs ≥ 0.01 m', Math.abs((f32(3.77e6 + 0.123) - f32(3.77e6 - 256)) - (0.123 + 256)) >= 0.01)
}

// ---- P4: real SimulationCore — teleports, stale locals, focus fallback
{
  const core = new SimulationCore(); core.setTimeScale(0)
  const a = core.registerEntity('a', { absPos: { x: 0, y: 0, z: 0 }, dynamic: false })
  const b = core.registerEntity('b', { absPos: { x: 5e6, y: 0, z: 0 }, dynamic: false })
  core.setFocusEntity('a'); core.tick()
  let worst = 0
  for (const j of [1025, 3000, 1e5, 3.77e6, -2e7]) { a.absPos.x = j + 77.5; core.tick(); worst = Math.max(worst, Math.abs(a.localPosF32[0])) }
  out(worst <= 128 ? 'OK' : 'FINDING', 'P4a post-tick focus local after teleports up to 2e7 m', `max ${worst} m (≤128 expected); stats.focusMaxLocalPostTick=${core.stats.focusMaxLocalPostTick}`)
  a.absPos.x += 5000; const stale = a.localPosF32[0]; const o0 = core.getOrigin().x
  out('NOTE', 'P4b locals between an absPos write and the next tick', `local still ${stale} m while true local is ${a.absPos.x - o0} m (stale until tick())`)
  core.tick()
  const reg = core.registerEntity('c', { absPos: { x: 9e5, y: 0, z: 0 }, dynamic: false })
  out('NOTE', 'P4c registerEntity seeds locals vs current origin', `c local=${reg.localPosF32[0]} (origin ${core.getOrigin().x})`)
  const oBefore = core.getOrigin().x; const rcBefore = core.stats.rebaseCount
  core.unregisterEntity('a'); const nf = core.getFocusEntityId(); core.tick()
  out(nf !== null ? 'FINDING' : 'OK', 'P4d unregistering the focus silently re-focuses entities[0]', `new focus='${nf}', origin ${oBefore} -> ${core.getOrigin().x} (+${core.stats.rebaseCount - rcBefore} rebase) with no focus-change signal`)
}

// ---- P5: adapter visibility after unregister -> re-register (claim: "hidden, never destroyed")
{
  const core = new SimulationCore(); core.setTimeScale(0)
  core.registerEntity('ship', { absPos: { x: 10, y: 0, z: 0 } })
  const ad = new FloatingOriginAdapter(core); const obj = new THREE.Object3D(); ad.bind('ship', obj)
  core.tick(); ad.update(); const v0 = obj.visible
  core.unregisterEntity('ship'); ad.update(); const v1 = obj.visible
  core.registerEntity('ship', { absPos: { x: 20, y: 0, z: 0 } }); core.tick(); ad.update()
  out(obj.visible ? 'OK' : 'FINDING', 'P5 adapter re-shows a re-registered entity', `visible ${v0} -> ${v1} -> ${obj.visible}; position.x=${obj.position.x} (updated while hidden)`)
  ctl('P5 control: unregister hides', v0 === true && v1 === false)
}

// ---- P6: getOrigin()/getOriginReadonly() alias the live origin
{
  const core = new SimulationCore(); core.setTimeScale(0)
  const e = core.registerEntity('f', { absPos: { x: 0, y: 0, z: 0 } }); core.setFocusEntity('f')
  const ad = new FloatingOriginAdapter(core)
  const ro = ad.getOriginReadonly(); ro.x += 100 // a consumer "reading" the origin
  e.absPos.x = 5000; let d = null; core.onRebase((ev) => { d = ev.delta.x }); core.tick()
  out(core.getOrigin().x % 256 !== 0 || d % 256 !== 0 ? 'FINDING' : 'OK', 'P6 readonly origin is writable and corrupts the lattice', `after ro.x += 100: next Δ=${d}, origin=${core.getOrigin().x} (mod 256 = ${core.getOrigin().x % 256})`)
}

// ---- P7: f32 precision of celestial locals (impostor input)
{
  const core = new SimulationCore(); core.setTimeScale(0)
  core.registerEntity('o', { absPos: { x: 0, y: 0, z: 0 } }); core.tick()
  let mx = 0, id = ''
  for (const c of core.getCelestialStates()) { const m = Math.max(...[0, 1, 2].map((i) => Math.abs(c.localPosF32[i]))); if (m > mx) { mx = m; id = c.config.id } }
  out('NOTE', 'P7 farthest celestial local', `${id} ${mx.toExponential(4)} m, f32 ulp ${ulp32(mx)} m`)
}

console.log(`U11 probe done; control failures: ${controlFail}`)
process.exit(controlFail === 0 ? 0 : 1)