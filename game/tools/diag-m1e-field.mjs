import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// F17b calibration probe — run with this file as the entry.
const {
  initTerrainField, terrainNormalInto,
} = await import('../src/core/terrain/terrainField.ts')
const { mulberry32 } = await import('../src/core/terrain/noise.ts')

const _n = { x: 0, y: 0, z: 0 }
const _t = { x: 0, y: 0, z: 0 }
const _p = { x: 0, y: 0, z: 0 }

function slopeDegAt(d) {
  terrainNormalInto(d.x, d.y, d.z, _n)
  const c = _n.x * d.x + _n.y * d.y + _n.z * d.z
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI
}

function uniformAround(d, nb) {
  const eps = 3 / 5000
  let ux = 0, uy = 0, uz = 0
  if (Math.abs(d.y) <= Math.abs(d.x) && Math.abs(d.y) <= Math.abs(d.z)) uy = 1
  else if (Math.abs(d.x) <= Math.abs(d.z)) ux = 1
  else uz = 1
  let e1x = uy * d.z - uz * d.y, e1y = uz * d.x - ux * d.z, e1z = ux * d.y - uy * d.x
  const m = Math.hypot(e1x, e1y, e1z) || 1
  e1x /= m; e1y /= m; e1z /= m
  const e2x = d.y * e1z - d.z * e1y, e2y = d.z * e1x - d.x * e1z, e2z = d.x * e1y - d.y * e1x
  const c = Math.cos(eps), sn = Math.sin(eps)
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4
    const bx = Math.cos(a) * e1x + Math.sin(a) * e2x
    const by = Math.cos(a) * e1y + Math.sin(a) * e2y
    const bz = Math.cos(a) * e1z + Math.sin(a) * e2z
    const l = Math.hypot(d.x * c + bx * sn, d.y * c + by * sn, d.z * c + bz * sn) || 1
    _p.x = (d.x * c + bx * sn) / l
    _p.y = (d.y * c + by * sn) / l
    _p.z = (d.z * c + bz * sn) / l
    if (!nb(_p, slopeDegAt(_p))) return false
  }
  return true
}

function scanFor(pred, tries, rand, nb) {
  for (let i = 0; i < tries; i++) {
    const u = rand() * 2 - 1
    const th = rand() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    _t.x = Math.cos(th) * s; _t.y = u; _t.z = Math.sin(th) * s
    const slope = slopeDegAt(_t)
    if (pred(_t, slope) && (nb === undefined || uniformAround(_t, nb))) {
      return { tries: i + 1, slopeDeg: slope, d: { x: _t.x, y: _t.y, z: _t.z } }
    }
  }
  return null
}

for (const amp of [2200, 2400, 2600, 2800]) {
  initTerrainField({
    name: 'M1E engineered slopes', radius: 5000, seed: 777,
    continentFreq: 1.2, continentAmp: 40,
    maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: amp,
    detailFreq: 8, detailAmp: 3,
  })
  // Slope distribution over 20k uniform samples (independent stream).
  const hr = mulberry32(0xca1e5)
  const bins = { '<5°': 0, '5–18°': 0, '18–28°': 0, '28–45°': 0, '45–52°': 0, '52–68°': 0, '68–70°': 0, '>70°': 0 }
  let minS = 90, maxS = 0
  for (let i = 0; i < 20000; i++) {
    const u = hr() * 2 - 1, th = hr() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    _t.x = Math.cos(th) * s; _t.y = u; _t.z = Math.sin(th) * s
    const sl = slopeDegAt(_t)
    if (sl < minS) minS = sl
    if (sl > maxS) maxS = sl
    if (sl < 5) bins['<5°']++
    else if (sl < 18) bins['5–18°']++
    else if (sl < 28) bins['18–28°']++
    else if (sl < 45) bins['28–45°']++
    else if (sl < 52) bins['45–52°']++
    else if (sl < 68) bins['52–68°']++
    else if (sl < 70) bins['68–70°']++
    else bins['>70°']++
  }
  console.log(`\n=== mountainAmp ${amp} — slope distribution (20k samples): min ${minS.toFixed(1)}° max ${maxS.toFixed(1)}°`)
  for (const k in bins) console.log(`    ${k.padEnd(8)} ${(bins[k] / 200).toFixed(2)}%`)
  // Harness-order scan with the canon stream + uniformity gates.
  const rand = mulberry32(0x5109e5)
  const moderate = scanFor((_d, s) => s > 18 && s < 28, 20000, rand, (_d, s) => s < 35)
  const steep = scanFor((_d, s) => s > 52 && s < 68, 20000, rand, (_d, s) => s > 45)
  const cliff = scanFor((_d, s) => s > 70, 20000, rand, (_d, s) => s > 60)
  const fmt = (r) => r === null ? 'NOT FOUND' : `found @ try ${r.tries} (slope ${r.slopeDeg.toFixed(1)}°)`
  console.log(`    moderate: ${fmt(moderate)}`)
  console.log(`    steep:    ${fmt(steep)}`)
  console.log(`    cliff:    ${fmt(cliff)}`)
  if (cliff !== null) {
    console.log(`FINAL mountainAmp = ${amp}`)
    break
  }
  if (amp === 2800) console.log('NO CLIFF SITES AT 2800 — route to Lead')
}
