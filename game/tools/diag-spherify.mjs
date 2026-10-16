// One-off diagnostic (scaffolding): replicate the canon spherify boot
// self-test in Node against the EXTRACTED spherify.ts (dependency-free) to
// localize the round-trip failure independent of the browser.
import {
  faceCubePointInto, spherifyInto, sphereToCubeInto,
} from '../src/core/terrain/spherify.ts'

const cc = { face: 0, u: 0, v: 0 }
const pt = { x: 0, y: 0, z: 0 }
const sp = { x: 0, y: 0, z: 0 }

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let maxErr = 0
let worst = ''
function check(x, y, z, tag) {
  sphereToCubeInto(x, y, z, cc)
  faceCubePointInto(cc.face, cc.u, cc.v, pt)
  spherifyInto(pt.x, pt.y, pt.z, sp)
  const e = Math.max(Math.abs(sp.x - x), Math.abs(sp.y - y), Math.abs(sp.z - z))
  if (e > maxErr) {
    maxErr = e
    worst = `${tag}: d=(${x},${y},${z}) -> face=${cc.face} u=${cc.u.toFixed(4)} v=${cc.v.toFixed(4)} -> sp=(${sp.x.toFixed(4)},${sp.y.toFixed(4)},${sp.z.toFixed(4)}) err=${e.toExponential(3)}`
  }
}

const fixed = [
  [1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 0, 0], [0, -1, 0], [0, 0, -1],
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [-1, 1, 1], [1, 0, 1], [0, 1, 1],
]
for (const d of fixed) check(d[0], d[1], d[2], 'fixed')
console.log('[fixed] max err so far:', maxErr.toExponential(3), '|', worst)

const rand = mulberry32(0x1c5eed)
maxErr = 0
worst = ''
let over1e9 = 0
for (let i = 0; i < 2048; i++) {
  const u = rand() * 2 - 1
  const t = rand() * Math.PI * 2
  const s = Math.sqrt(1 - u * u)
  check(Math.cos(t) * s, u, Math.sin(t) * s, `rand#${i}`)
  if (maxErr > 1e-9 && over1e9 === 0) {
    over1e9 = i
    console.log(`[rand] first err > 1e-9 at i=${i}: ${worst}`)
  }
}
console.log('[rand] max err:', maxErr.toExponential(3))
console.log('[rand] worst:', worst)
