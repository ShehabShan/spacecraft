import { register } from 'node:module'
register('./ts-resolve-loader.mjs', import.meta.url)

// R2-residual attribution probe: does lookAtQuatInto (harness-local helper,
// replicated verbatim) + quatFromFrameInto (real module) aim the camera at
// the target under projectDirectionInto's -Z convention (real module)?
// Decisive for: sun footprint 0 px (window ±42 px) and R3's 8-px window.
const { quatFromFrameInto } = await import('../src/core/physics/sphericalFrame.ts')
const { projectDirectionInto } = await import('../src/core/render/impostorMath.ts')

function lookAtQuatInto(ex, ey, ez, tx, ty, tz, ux, uy, uz, out) {
  let fx = tx - ex, fy = ty - ey, fz = tz - ez
  const fl = Math.hypot(fx, fy, fz) || 1
  fx /= fl; fy /= fl; fz /= fl
  let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux
  const rl = Math.hypot(rx, ry, rz) || 1
  rx /= rl; ry /= rl; rz /= rl
  const upx = ry * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - ry * fx
  quatFromFrameInto(fx, fy, fz, upx, upy, upz, out)
}

const sunDir = { x: -0.5714, y: 0, z: 0.8207 }       // Node-measured at t=0
const eye = { x: 137.2, y: 316.8, z: 1363.9 }        // abs driver-ish (end pose)
const q = { x: 0, y: 0, z: 0, w: 1 }
const out = { px: 0, py: 0, behind: false }

lookAtQuatInto(eye.x, eye.y, eye.z, eye.x + sunDir.x, eye.y + sunDir.y, eye.z + sunDir.z, 0, 1, 0, q)
console.log(`sun-pose quat = (${q.x.toFixed(4)}, ${q.y.toFixed(4)}, ${q.z.toFixed(4)}, ${q.w.toFixed(4)})`)
projectDirectionInto(sunDir.x, sunDir.y, sunDir.z, q, (62 * Math.PI) / 180, 1280 / 720, 1280, 720, out)
console.log(`sun projection: px=${out.px.toFixed(1)} py=${out.py.toFixed(1)} behind=${out.behind}  (expect ~640/~360)`)

// margin: how far off-center can the rendered sun be before the ±2r=±42 px
// window misses it? project a direction rotated by k degrees about Y:
for (const deg of [0.5, 1, 2, 4]) {
  const a = (deg * Math.PI) / 180
  const dx = sunDir.x * Math.cos(a) + sunDir.z * Math.sin(a)
  const dz = -sunDir.x * Math.sin(a) + sunDir.z * Math.cos(a)
  projectDirectionInto(dx, sunDir.y, dz, q, (62 * Math.PI) / 180, 1280 / 720, 1280, 720, out)
  console.log(`  dir +${deg}deg yaw -> px=${out.px.toFixed(1)} py=${out.py.toFixed(1)} behind=${out.behind}`)
}

// R3 silhouette pose: probe direction (harness formula, replicated)
const earthDir = { x: 0.9847, y: 0, z: -0.1742 }
let px2 = earthDir.y * sunDir.z - earthDir.z * sunDir.y
let py2 = earthDir.z * sunDir.x - earthDir.x * sunDir.z
let pz2 = earthDir.x * sunDir.y - earthDir.y * sunDir.x
const l2 = Math.hypot(px2, py2, pz2) || 1
px2 /= l2; py2 /= l2; pz2 /= l2
let dx = px2 * 0.5 + sunDir.x * -0.35
let dy = py2 * 0.5 + 0.6
let dz = pz2 * 0.5 + sunDir.z * -0.35
const dl = Math.hypot(dx, dy, dz)
dx /= dl; dy /= dl; dz /= dl
lookAtQuatInto(eye.x, eye.y, eye.z, eye.x + dx, eye.y + dy, eye.z + dz, 0, 1, 0, q)
projectDirectionInto(dx, dy, dz, q, (62 * Math.PI) / 180, 1280 / 720, 1280, 720, out)
console.log(`probe-pose projection: px=${out.px.toFixed(1)} py=${out.py.toFixed(1)} behind=${out.behind}  (expect ~640/~360)`)

// PROPOSED FIX VERIFICATION (for the route): pass RIGHT as the frame's first
// axis — quatFromFrameInto builds columns (X, Y, X×Y); with X=right=f×u and
// Y=up, X×Y = back, so local −Z = fwd (three.js camera convention).
function lookAtQuatFixed(ex, ey, ez, tx, ty, tz, ux, uy, uz, out) {
  let fx = tx - ex, fy = ty - ey, fz = tz - ez
  const fl = Math.hypot(fx, fy, fz) || 1
  fx /= fl; fy /= fl; fz /= fl
  let rx = fy * uz - fz * uy, ry = fz * ux - fx * uz, rz = fx * uy - fy * ux
  const rl = Math.hypot(rx, ry, rz) || 1
  rx /= rl; ry /= rl; rz /= rl
  const upx = ry * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - ry * fx
  quatFromFrameInto(rx, ry, rz, upx, upy, upz, out)
}
console.log('\nPROPOSED FIX (quatFromFrameInto(right, up)):')
lookAtQuatFixed(eye.x, eye.y, eye.z, eye.x + sunDir.x, eye.y + sunDir.y, eye.z + sunDir.z, 0, 1, 0, q)
projectDirectionInto(sunDir.x, sunDir.y, sunDir.z, q, (62 * Math.PI) / 180, 1280 / 720, 1280, 720, out)
console.log(`  sun projection: px=${out.px.toFixed(2)} py=${out.py.toFixed(2)} behind=${out.behind}  (expect ~640.0/~360.0)`)
lookAtQuatFixed(eye.x, eye.y, eye.z, eye.x + dx, eye.y + dy, eye.z + dz, 0, 1, 0, q)
projectDirectionInto(dx, dy, dz, q, (62 * Math.PI) / 180, 1280 / 720, 1280, 720, out)
console.log(`  probe projection: px=${out.px.toFixed(2)} py=${out.py.toFixed(2)} behind=${out.behind}`)
