import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)

// A1-U02 audit probe (read-only; no harness/engine edit). Tests whether the
// m1f R1 (depth-compositing) and R2 (impostor-angular) suite checks can FAIL
// when the property they claim is broken. Replicas below copy the harness
// loops VERBATIM (Milestone1F_TestHarness.tsx @ 29905e1, lines cited) and run
// them against the REAL SkyImpostorPool / impostorMath / terrainField / rails.
// Prints facts + `[u02] CONFIRMED n/n` when every audit expectation holds;
// exit 1 if any expectation is refuted.
import { readFileSync } from 'node:fs'
const THREE = await import('three')
const { SkyImpostorPool } = await import('../../src/render/SkyImpostorPool.ts')
const im = await import('../../src/core/render/impostorMath.ts')
const { initTerrainField, chunkArcWidth } = await import('../../src/core/terrain/terrainField.ts')
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts')
const { thetaEdge, quadHalfSize, depthResolution } = im

const facts = []; let n = 0
const expect = (cond, msg) => { n++; facts.push(`${cond ? 'OK ' : 'REFUTED'} ${msg}`) }
const log = (s) => console.log(s)

/* ---------------------------------------------------------------- R1 ---- */
const MOON = { name: 'M1F Moon (catalog)', radius: 1364.5, seed: 20240119,
  continentFreq: 2.3, continentAmp: 95, maskFreq: 3.7,
  mountainFreq: 6.5, mountainAmp: 230, detailFreq: 22, detailAmp: 16 }
initTerrainField(MOON)
const R = 1364.5, MAX_H = 360, HEIGHT_SLACK = 420, EARTH_R = 5000
const core = new SimulationCore(); core.setTimeScale(0)
const es = core.getCelestialState('earth'), ms = core.getCelestialState('moon')
const earthVec = { x: es.absPos.x - ms.absPos.x, y: es.absPos.y - ms.absPos.y, z: es.absPos.z - ms.absPos.z }
const earthDist = Math.hypot(earthVec.x, earthVec.y, earthVec.z)
log(`[R1] earthDist (moon centre -> Earth centre) = ${earthDist.toFixed(1)} m; EARTH_R ${EARTH_R}`)

// harness 1041-1054 VERBATIM gap rule, swept over EVERY reachable chunk origin
// (|origin| in [0, R+MAX_H], all directions incl. dense near the Earth line), levels 0..14
let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) >>> 0) / 4294967296)
let samples = 0, positive = 0, qualifiedAngle = 0, maxGap = -Infinity
const eDir = { x: earthVec.x / earthDist, y: earthVec.y / earthDist, z: earthVec.z / earthDist }
for (let level = 0; level <= 14; level++) {
  for (let k = 0; k < 20000; k++) {
    let dx, dy, dz
    if (k % 2 === 0) { dx = eDir.x + (rnd() - 0.5) * 0.2; dy = eDir.y + (rnd() - 0.5) * 0.2; dz = eDir.z + (rnd() - 0.5) * 0.2 }
    else { dx = rnd() * 2 - 1; dy = rnd() * 2 - 1; dz = rnd() * 2 - 1 }
    const l = Math.hypot(dx, dy, dz) || 1, rad = rnd() * (R + MAX_H)
    const v = { x: dx / l * rad, y: dy / l * rad, z: dz / l * rad }
    const ex = v.x - earthVec.x, ey = v.y - earthVec.y, ez = v.z - earthVec.z
    const d = Math.sqrt(ex * ex + ey * ey + ez * ez)
    const chunkAng = Math.atan((chunkArcWidth(level) * 0.75 + HEIGHT_SLACK) / d)
    const between = Math.acos(Math.max(-1, Math.min(1,
      (v.x * earthVec.x + v.y * earthVec.y + v.z * earthVec.z) / ((Math.hypot(v.x, v.y, v.z) || 1e-30) * earthDist))))
    samples++
    if (between > chunkAng + Math.asin(EARTH_R / earthDist)) continue
    qualifiedAngle++
    const gap = Math.max(0, (earthDist - EARTH_R) - (d + chunkArcWidth(level) * 0.75 + HEIGHT_SLACK))
    maxGap = Math.max(maxGap, (earthDist - EARTH_R) - (d + chunkArcWidth(level) * 0.75 + HEIGHT_SLACK))
    if (gap > 0) positive++
  }
}
log(`[R1] verbatim Earth/horizon rule: ${samples} chunk samples, ${qualifiedAngle} pass the angular test, ${positive} give gap > 0; max raw gap ${maxGap.toFixed(1)} m`)
log(`[R1] analytic bound: gap <= |origin| - EARTH_R - HEIGHT_SLACK - 0.75*w <= ${(R + MAX_H - EARTH_R - HEIGHT_SLACK).toFixed(1)} m < 0`)
expect(positive === 0, 'R1(b) Earth/horizon term can NEVER find a qualifying chunk (always falls to the 1e9 sentinel)')

// What the term was meant to measure: observer-relative depth gap (observer on the surface,
// chunk within the 0.62 rad cap; Earth near limb vs chunk far extent), ratio in the Mid pass.
const obs = { x: eDir.x * (R + 2), y: eDir.y * (R + 2), z: eDir.z * (R + 2) }
const obsEarth = Math.hypot(earthVec.x - obs.x, earthVec.y - obs.y, earthVec.z - obs.z)
let worstObsRatio = Infinity
for (const chunkDist of [2000, 5000, 20000]) for (const level of [6, 8, 10]) {
  const gap = (obsEarth - EARTH_R) - (chunkDist + chunkArcWidth(level) * 0.75 + HEIGHT_SLACK)
  if (gap > 0) worstObsRatio = Math.min(worstObsRatio, gap / depthResolution(obsEarth, 2000, 300000))
}
log(`[R1] observer-relative intent (obs->Earth ${obsEarth.toFixed(0)} m): worst Mid-pass ratio ${Math.round(worstObsRatio).toLocaleString()}x (spec table expects ~600,000x)`)

// pairs (a) and (c) are pure literals (harness 1024-1066): their ratios do not depend on scene state
const ra = 2500 / depthResolution(233000, 2000, 300000), sa = 2500 / depthResolution(233000, 0.01, 1e7)
const rc = 0.02 / depthResolution(1.7, 0.1, 3000), sc = 0.02 / depthResolution(1.7, 0.01, 1e7)
log(`[R1] literal pairs: probe layered ${ra.toFixed(1)} single ${sa.toFixed(4)} · boots layered ${rc.toFixed(1)} single ${sc.toFixed(1)}`)
expect(Math.min(ra, rc) > 10 && Math.min(sa, sc) < 1, 'R1 layeredMin>10 && singleMin<1 hold from literals alone (no scene input)')
// planes in the harness are typed literals, not read from the rig
const rigSrc = readFileSync(new URL('../../src/render/MultiCameraRig.tsx', import.meta.url), 'utf8')
const harnessSrc = readFileSync(new URL('../../src/test/Milestone1F_TestHarness.tsx', import.meta.url), 'utf8')
const usesRigPlanes = /depthResolution\([^)]*(MID_PLANES|NEAR_PLANES)/.test(harnessSrc)
log(`[R1] rig MID_PLANES ${/MID_PLANES[^=]*=\s*\[([^\]]*)\]/.exec(rigSrc)[1]} / NEAR_PLANES ${/NEAR_PLANES[^=]*=\s*\[([^\]]*)\]/.exec(rigSrc)[1]}; harness reads them: ${usesRigPlanes}`)
expect(!usesRigPlanes, 'R1 pair audit uses hard-coded planes (2000,300000)/(0.1,3000), not the rig constants or object layer masks')

/* ---------------------------------------------------------------- R2 ---- */
const sky = new SkyImpostorPool()
const truth = [] // slot -> f64 theta fed in
const CAT = [['sun', 20000, 1], ['mercury', 3105.7, 0], ['venus', 4870.3, 0], ['mars', 2649.3, 0],
  ['jupiter', 16640.2, 2], ['saturn', 15120.4, 2], ['uranus', 9980.5, 2], ['neptune', 9835.4, 0], ['pluto', 2160.8, 0]]
for (let i = 0; i < CAT.length; i++) {
  const th = 0.035 / (1 + i * 0.7), dist = 1e8 * (1 + i)
  const a = 0.3 + i * 0.7, b = 0.2 + i * 0.4
  const l = Math.hypot(Math.cos(a), Math.sin(a), Math.sin(b))
  sky.setBody(i, CAT[i][0], CAT[i][2], Math.cos(a) / l, Math.sin(a) / l, Math.sin(b) / l, th, dist, 1, 1, 1, 1, true)
  truth[i] = th
}
sky.setBody(9, 'probe-a', 3, 0, 0.6, 0.8, 0.0077, 233000, 1, 1, 1, 0.4, true); truth[9] = 0.0077
sky.setBody(10, 'probe-b', 3, 0, 0.8, 0.6, 0.0069, 233000, 1, 1, 1, 0.6, true); truth[10] = 0.0069
const drv = { x: 321.25, y: 812.5, z: -97.75 }
const doUpdate = () => sky.update(drv.x, drv.y, drv.z, 0, 0, 0, 1, 0, 0, 1)

function replicaR2a() { // harness 1094-1122 VERBATIM (minus void'd dead lines)
  let maxThetaErr = 0, maxPosErr = 0, audited = 0; const ids = new Set()
  for (let rank = 0; rank < sky.mesh.count; rank++) {
    for (let s = 0; s < sky.bodies.length; s++) {
      const b = sky.bodies[s]
      if (!b.active) continue
      if (Math.abs(b.stagedPX - 0) + Math.abs(b.stagedPY - 0) + Math.abs(b.stagedPZ - 0) === 0) continue
      const diskTheta = Math.atan(Math.tan(b.theta) * b.alpha)
      const e2 = Math.abs(diskTheta - b.theta)
      if (e2 > maxThetaErr) maxThetaErr = e2
      const px = drv.x + b.dirX * b.stageD, py = drv.y + b.dirY * b.stageD, pz = drv.z + b.dirZ * b.stageD
      const pe = Math.max(Math.abs(px - b.stagedPX), Math.abs(py - b.stagedPY), Math.abs(pz - b.stagedPZ))
      if (pe > maxPosErr) maxPosErr = pe
      audited++; ids.add(b.id)
      break
    }
  }
  return { maxThetaErr, maxPosErr, audited, ids: [...ids], pass: maxThetaErr < 1e-6 && maxPosErr < 1e-9 && audited > 5 }
}
// Independent check from the WRITTEN GPU data: aDisk.y = tan(disk θ) (f32), instance matrix
function independentR2a() {
  const dA = sky.mesh.geometry.getAttribute('aDisk').array
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
  let maxDisk = 0, maxEdge = 0
  // rank -> body: by the pool's documented order (trueDist descending among active)
  const order = sky.bodies.map((b, i) => [b, i]).filter(([b]) => b.active).sort((x, y) => y[0].trueDist - x[0].trueDist)
  for (let rank = 0; rank < sky.mesh.count; rank++) {
    const [b, slot] = order[rank]
    const thDisk = Math.atan(dA[rank * 2 + 1])
    const want = Math.atan(Math.tan(truth[slot]) * b.alpha)
    maxDisk = Math.max(maxDisk, Math.abs(thDisk - want))
    sky.mesh.getMatrixAt(rank, m); m.decompose(p, q, sc)
    const D = Math.hypot(p.x - drv.x, p.y - drv.y, p.z - drv.z)
    maxEdge = Math.max(maxEdge, Math.abs(Math.atan(sc.x / D) - thetaEdge(truth[slot])))
  }
  return { maxDisk, maxEdge }
}
doUpdate()
const base = replicaR2a(), baseInd = independentR2a()
log(`[R2a] baseline replica: audited ${base.audited} over mesh.count ${sky.mesh.count}; distinct bodies audited [${base.ids}]; maxThetaErr ${base.maxThetaErr.toExponential(1)}; maxPosErr ${base.maxPosErr.toExponential(1)}; pass ${base.pass}`)
log(`[R2a] baseline independent (from written aDisk/instance matrix): disk θ err ${baseInd.maxDisk.toExponential(2)} rad; edge θ err ${baseInd.maxEdge.toExponential(2)} rad`)
expect(base.ids.length === 1 && base.audited === sky.mesh.count, `R2(a) audits ONE body ${sky.mesh.count}x ("${base.ids[0]}"), not every instance`)

// Mutation M1: corrupt what the GPU receives (disk radii x2, quad scales x2)
const dA = sky.mesh.geometry.getAttribute('aDisk').array
for (let r = 0; r < sky.mesh.count; r++) dA[r * 2 + 1] *= 2
const tm = new THREE.Matrix4(), tS = new THREE.Matrix4().makeScale(2, 2, 1)
for (let r = 0; r < sky.mesh.count; r++) { sky.mesh.getMatrixAt(r, tm); tm.multiply(tS); sky.mesh.setMatrixAt(r, tm) }
const m1 = replicaR2a(), m1Ind = independentR2a()
log(`[R2a] M1 (written disk radius + quad x2): replica err ${m1.maxThetaErr.toExponential(1)} pass ${m1.pass}; independent disk err ${m1Ind.maxDisk.toExponential(2)} edge err ${m1Ind.maxEdge.toExponential(2)}`)
expect(m1.pass === true && m1Ind.maxDisk > 1e-3, 'R2(a) still PASSES with every rendered disk 2x too large (independent check catches it)')

// Mutation M2: wrong upstream θ (Sun fed 1.5x its true angular radius)
sky.setBody(0, 'sun', 1, sky.bodies[0].dirX, sky.bodies[0].dirY, sky.bodies[0].dirZ, truth[0] * 1.5, sky.bodies[0].trueDist, 1, 1, 1, 1, true)
doUpdate()
const m2 = replicaR2a(), m2Ind = independentR2a()
log(`[R2a] M2 (Sun θ fed 1.5x truth): replica err ${m2.maxThetaErr.toExponential(1)} pass ${m2.pass}; independent disk err ${m2Ind.maxDisk.toExponential(2)}`)
expect(m2.pass === true && m2Ind.maxDisk > 1e-3, 'R2(a) still PASSES with the Sun 1.5x oversized (compares b.theta to itself)')
sky.setBody(0, 'sun', 1, sky.bodies[0].dirX, sky.bodies[0].dirY, sky.bodies[0].dirZ, truth[0], sky.bodies[0].trueDist, 1, 1, 1, 1, true)

// Mutation M3: a faded probe (alpha 0.4/0.6) is never reached: loop breaks at slot 0
doUpdate()
const m3 = replicaR2a()
expect(m3.ids.indexOf('probe-a') < 0 && m3.ids.indexOf('probe-b') < 0, 'R2(a) never audits slots 1..10 while slot 0 is active (the only path to e2>0 is alpha!=1 on the FIRST active slot)')

// R2(b) tolerances: header comment vs code vs spec
const hdr = /±(\d+)% coverage, ±(\d+(?:\.\d+)?) px center/.exec(harnessSrc)
const code = /coverage > ([\d.]+) && coverage < ([\d.]+) && centerErr < ([\d.]+)/.exec(harnessSrc)
log(`[R2b] header: ±${hdr[1]}% / ±${hdr[2]} px · code: (${code[1]}, ${code[2]}) / < ${code[3]} px`)
expect(hdr[1] === '12' && hdr[2] === '1' && code[1] === '0.85' && code[3] === '1.5', 'R2 header claims ±12%/±1 px; code enforces ±15%/<1.5 px')

// abRender quiesce guard: pool counters change only inside worker onmessage callbacks
const poolSrc = readFileSync(new URL('../../src/render/TerrainMeshPool.ts', import.meta.url), 'utf8')
const recv = poolSrc.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => /counters\.(received|swaps)\s*(\+\+|\+=)/.test(l)).map(([i]) => i)
log(`[abRender] pool counter mutations at TerrainMeshPool.ts lines ${recv} (onWorkerMessage 334 / bindRecord 360 — worker callback path only)`)
expect(recv.length === 2, 'quiesce counters mutate only on the async worker-message path')

for (const f of facts) log(f)
const refuted = facts.filter((f) => f.startsWith('REFUTED')).length
log(`[u02] ${refuted === 0 ? 'CONFIRMED' : 'REFUTED'} ${n - refuted}/${n}`)
process.exit(refuted === 0 ? 0 : 1)