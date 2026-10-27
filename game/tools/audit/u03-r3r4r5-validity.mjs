// A1-U03 probe (read-only audit; AGENT_BRIEF §11). Checks whether m1f R3/R4/R5
// can fail on their claims. The handoff functions are extracted VERBATIM from
// the harness source text (the .tsx cannot be imported under Node). The
// rendered-visibility rules are copied from the harness lines cited below.
// Expected behaviour is derived from first principles before comparing.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = readFileSync(join(here, '../../src/test/Milestone1F_TestHarness.tsx'), 'utf8') + '\n' + readFileSync(join(here, '../../src/test/m1fHandoff.ts'), 'utf8') // F2fccba: controller moved to m1fHandoff.ts (ADR-023); appended so harness line numbers hold
const lines = SRC.split('\n')
const results = []
const check = (id, cond, msg) => { results.push([id, !!cond, msg]); console.log(`[u03] ${cond ? 'CONFIRMED' : 'NOT-CONFIRMED'} ${id}: ${msg}`) }
const lineOf = (re) => lines.findIndex((l) => re.test(l)) + 1

// ---- verbatim extraction of the handoff state machine (harness §5) ------
const constSrc = SRC.match(/export const HANDOFF_D_HARD[\s\S]*?HANDOFF_FADE_HI = \d+;/)[0].replace(/export /g, '')
const fadeSrc = SRC.match(/export function handoffFade\(d: number\): number \{[\s\S]*?\n\}/)[0]
const nextSrc = SRC.match(/export function handoffNextState\(d: number, mesh: boolean\): boolean \{[\s\S]*?\n\}/)[0]
const strip = (s) => s.replace(/export /g, '').replace(/\(d: number\): number/, '(d)').replace(/\(d: number, mesh: boolean\): boolean/, '(d, mesh)')
const mod = new Function(`${constSrc}\n${strip(fadeSrc)}\n${strip(nextSrc)}\nreturn { HANDOFF_D_HARD, HANDOFF_D_SOFT, HANDOFF_FADE_LO, HANDOFF_FADE_HI, handoffFade, handoffNextState };`)()
console.log(`[u03] extracted: HARD ${mod.HANDOFF_D_HARD} SOFT ${mod.HANDOFF_D_SOFT} FADE [${mod.HANDOFF_FADE_LO}, ${mod.HANDOFF_FADE_HI}]`)

// Verbatim rendered-visibility rules (harness :846 impostor active flag, :875 mesh visible)
const impLine = lineOf(/probe\.alphaImpA > 0\.01\);/), meshLine = lineOf(/probeMeshA\.visible = probe\.meshStateA && probe\.alphaMeshA > 0\.01;/)
check('rules-present', impLine > 0 && meshLine > 0, `impostor active rule at :${impLine}, mesh visible rule at :${meshLine}`)
const rendered = (st) => ({ mesh: st.mesh && st.alphaMesh > 0.01, imp: st.alphaImp > 0.01, alphaMesh: st.alphaMesh, alphaImp: st.alphaImp })

// ---- R3(a) gate loop replica (harness :1166-1180) ------------------------
function gateUnitSweep(fade, next) {
  let holes = 0, doubles = 0, flips = 0, maxSlope = 0, mesh = true, prevA = 1
  for (let trip = 0; trip < 20; trip++) {
    const down = trip % 2 === 0
    for (let s = 0; s <= 200; s++) {
      const d = down ? 300000 - s * 500 : 200000 + s * 500
      const n2 = next(d, mesh); if (n2 !== mesh) { flips++; mesh = n2 }
      const imp = fade(d), m = 1 - imp
      if (m <= 0.01 && imp <= 0.01) holes++
      if (m >= 0.99 && imp >= 0.99) doubles++
      maxSlope = Math.max(maxSlope, Math.abs(imp - prevA) / 500); prevA = imp
    }
  }
  return { holes, doubles, flips, maxSlope }
}
// Independent sweep: same distances, but counts what is actually DRAWN.
function renderedSweep(fade, next, step = 500) {
  let mesh = true, holeM = 0, ghostM = 0, doubleM = 0, holeIv = null, ghostIv = null
  const span = (iv, d) => iv ? [Math.min(iv[0], d), Math.max(iv[1], d)] : [d, d]
  for (let trip = 0; trip < 20; trip++) {
    const down = trip % 2 === 0
    for (let s = 0; s <= 200000 / step; s++) {
      const d = down ? 300000 - s * step : 200000 + s * step
      mesh = next(d, mesh)
      const imp = fade(d)
      const r = rendered({ mesh, alphaMesh: 1 - imp, alphaImp: imp })
      if (!r.mesh && !r.imp) { holeM++; holeIv = span(holeIv, d) }
      // ghost: impostor shown below full opacity with no mesh behind it
      if (!r.mesh && r.imp && imp < 0.99) { ghostM++; ghostIv = span(ghostIv, d) }
      if (r.mesh && r.imp && r.alphaMesh >= 0.99 && r.alphaImp >= 0.99) doubleM++
    }
  }
  return { holeM, ghostM, doubleM, holeIv, ghostIv }
}
const g = gateUnitSweep(mod.handoffFade, mod.handoffNextState)
console.log(`[u03] R3(a) gate replica: holes ${g.holes} doubles ${g.doubles} flips ${g.flips} maxSlope ${g.maxSlope.toExponential(3)}`)
check('R3a-gate-green', g.holes === 0 && g.doubles === 0 && g.flips === 21 && g.maxSlope <= 0.00015, 'gate replica reproduces the PASS numbers')
const rs = renderedSweep(mod.handoffFade, mod.handoffNextState)
console.log(`[u03] R3 independent (rendered) sweep: hole samples ${rs.holeM} over d ${JSON.stringify(rs.holeIv)}; ghost samples ${rs.ghostM} over d ${JSON.stringify(rs.ghostIv)}; double ${rs.doubleM}`)
// Analytic hole edge: impostor drawn iff smoothstep(t) > 0.01 -> t* solves t²(3-2t) = 0.01
let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const t = (lo + hi) / 2; (t * t * (3 - 2 * t) > 0.01) ? hi = t : lo = t }
const holeTop = mod.HANDOFF_FADE_LO + lo * (mod.HANDOFF_FADE_HI - mod.HANDOFF_FADE_LO)
console.log(`[u03] analytic descending hole: d in [${mod.HANDOFF_D_SOFT}, ${holeTop.toFixed(0)}] m (${(holeTop - mod.HANDOFF_D_SOFT).toFixed(0)} m)`)
check('R3-real-hole', rs.holeM > 0 && rs.holeIv[0] >= mod.HANDOFF_D_SOFT && rs.holeIv[1] <= holeTop && rs.holeIv[1] > mod.HANDOFF_FADE_LO - 1,
  `nothing is drawn for descending d in [SOFT ${mod.HANDOFF_D_SOFT}, ${holeTop.toFixed(0)}] (state IMPOSTOR, impostor alpha <= 0.01, mesh hidden)`)
// Ascending direction is a proper crossfade: count hole samples on ascents only
let ascHole = 0; { let mesh = true; for (let d = 200000; d <= 300000; d += 100) { mesh = mod.handoffNextState(d, mesh); const imp = mod.handoffFade(d); const r = rendered({ mesh, alphaMesh: 1 - imp, alphaImp: imp }); if (!r.mesh && !r.imp) ascHole++ } }
check('R3-ascent-clean', ascHole === 0, `ascending 200->300 km (100 m steps) has ${ascHole} hole samples: the defect is one-directional`)
check('R3-ghost', rs.ghostM > 0, 'descending through the fade window the impostor fades out with no mesh (state still IMPOSTOR)')
// Analytic: the hole/double tests use m = 1 - imp, so they are unreachable for ANY fade law.
let unreachable = true
for (let imp = 0; imp <= 1; imp += 1e-4) { const m = 1 - imp; if ((m <= 0.01 && imp <= 0.01) || (m >= 0.99 && imp >= 0.99)) unreachable = false }
check('R3a-tautology', unreachable, 'with m = 1 - imp the hole (both ≤ 0.01) and double (both ≥ 0.99) predicates are unsatisfiable for every imp in [0,1]')
// Mutation M1: a broken handoff that hides the mesh one full band early (switch at 260 km, return at 180 km).
const brokenNext = (d, mesh) => (mesh && d > 200000 ? false : (!mesh && d < 180000 ? true : mesh))
const gm = gateUnitSweep(mod.handoffFade, brokenNext), rm = renderedSweep(mod.handoffFade, brokenNext)
console.log(`[u03] M1 (mesh hidden from 200 km): gate holes ${gm.holes} flips ${gm.flips}; rendered holes ${rm.holeM}`)
check('R3a-M1-hole-invisible', gm.holes === 0 && rm.holeM > g.holes + rs.holeM, 'gate hole counter stays 0 while the rendered hole grows (only flips/2 trips change)')
// Mutation M2: a fade law that is identically 0 (impostor never appears).
const zeroFade = () => 0
const gz = gateUnitSweep(zeroFade, mod.handoffNextState), rz = renderedSweep(zeroFade, mod.handoffNextState)
console.log(`[u03] M2 (impostor never fades in): gate holes ${gz.holes} doubles ${gz.doubles} maxSlope ${gz.maxSlope}; rendered holes ${rz.holeM}`)
check('R3a-M2-hole-invisible', gz.holes === 0 && rz.holeM > 0, 'gate reports 0 holes while the probe vanishes beyond 240 km')

// R3(b) live trace records alphaMeshA = 1 - alphaImpA (harness :643, :1515) -> same tautology
const recLine = lineOf(/live\.probeTrace\.push\(\{ d: probe\.dA, mesh: probe\.alphaMeshA, imp: probe\.alphaImpA \}\);/)
const defLine = lineOf(/probe\.alphaMeshA = 1 - probe\.alphaImpA;/)
check('R3b-tautology', recLine > 0 && defLine > 0, `live trace stores alphaMeshA (:${recLine}) which is defined as 1 - alphaImpA (:${defLine}); meshState is not recorded`)
// Live-sweep exposure: probe triangle 320k->190k->320k, 24 s each way (sim), LIVE ts = 6.
const descentSpeed = 130000 / 24, holeLen = mod.HANDOFF_FADE_LO - mod.HANDOFF_D_SOFT
console.log(`[u03] live sweep: descent ${descentSpeed.toFixed(0)} m/s sim; hole ${holeLen} m -> ${(holeLen / descentSpeed).toFixed(2)} sim s (~${(holeLen / descentSpeed / 6 * 60).toFixed(0)} frames at ts=6, 60 fps) per descent; ${Math.floor(120 * 6 / 48)} descents in 120 wall s`)

// ---- R3(c) silhouette: expected disk vs the recorded window -------------
const PROBE_R = 1800, D = 232000, FOV = 62 * Math.PI / 180, W = 1280, H = 720, win = 80
const f = (H / 2) / Math.tan(FOV / 2)
const rpx = f * Math.tan(Math.asin(PROBE_R / D))
const area = Math.PI * rpx * rpx
console.log(`[u03] R3(c) expected probe disk at 232 km: r ${rpx.toFixed(2)} px, area ${area.toFixed(1)} px; window ${(2 * win) ** 2} px`)
const log = readFileSync(join(here, '../../../docs/audit/U01-evidence/gate-run1.log'), 'utf8')
const m = log.match(/R3DUMP hdr centre=\(([\d.]+),([\d.]+)\) meshR=([\d.]+) impR=([\d.]+) meshRmax=([\d.]+) impRmax=([\d.]+) totA=(\d+) sym=(\d+)/)
check('R3c-log', !!m, 'U01 gate-run1 R3DUMP hdr found')
if (m) {
  const totA = +m[7], sym = +m[8], meshR = +m[3]
  console.log(`[u03] R3(c) recorded (U01 run 1, R3 badge PASS): totA ${totA} sym ${sym} meshR ${meshR} meshRmax ${m[5]}`)
  check('R3c-saturated', totA === (2 * win) ** 2 && meshR > 10 * rpx,
    `every pixel of the ${2 * win}x${2 * win} window is "lit" in BOTH renders (totA ${totA} vs expected disk ~${area.toFixed(0)} px): the A/B compares background, not the probe`)
  // with a saturated window, ANY mesh/impostor mismatch inside it is invisible
  check('R3c-vacuous', sym === 0, 'sym = 0 is forced: both masks are all-ones')
}
// pass condition has no coverage bound
const passLine = lineOf(/liveHoles === 0 && crossedLo && crossedHi && symPct < 3,/)
check('R3c-no-coverage-bound', passLine > 0 && !/totA\s*[<>]/.test(lines.slice(passLine - 3, passLine + 1).join(' ')), `pass (:${passLine}) bounds symPct only; totA is never range-checked against the expected disk`)

// ---- R4 zero-gc ----------------------------------------------------------
const r4Start = lineOf(/\/\* -- R4: zero-GC/), r4End = lineOf(/\/\* -- R5: M1A integration/)
const r4 = lines.slice(r4Start - 1, r4End - 1).join('\n')
check('R4-canary-unused', /void canary\.cams;/.test(r4) && !/canary\.(poolMesh|stars|mat|bodies|astro|earth|pA|pB|sats)/.test(r4),
  'the canary object is built but no field is ever compared (only `void canary.cams`)')
check('R4-negative-pass', /\(pureDelta < 0 \|\| pureDelta <= 262144\) && \(renderDelta < 0 \|\| renderDelta <= 4194304\)/.test(r4),
  'a negative heap delta (a GC during the burn) or a missing performance.memory (-1) PASSES')
check('R4-react-literal', /React re-renders during flight: 0/.test(r4) && !/renderCount|reRender/.test(r4), '"React re-renders during flight: 0" is a string literal, not a measurement')
console.log(`[u03] R4 allowance: ${(262144 / 3000).toFixed(1)} B/iteration pure path; ${(4194304 / 300 / 1024).toFixed(1)} KiB/frame render path`)
// allocation inside the burned path (applyRenderState)
const arsStart = lineOf(/^function applyRenderState\(/)
let arsEnd = arsStart; while (arsEnd < lines.length && !/^\}/.test(lines[arsEnd])) arsEnd++
const allocs = []
for (let i = arsStart; i <= arsEnd; i++) if (/\{ x: qx, y: qy, z: qz, w: qw \}|new THREE\.|= \{ x:/.test(lines[i - 1])) allocs.push(`:${i}`)
check('R4-alloc-in-path', allocs.length > 0, `applyRenderState (:${arsStart}-${arsEnd + 1}) allocates object literals per call at ${allocs.join(', ')} — contradicts the detail "all math in module scratch"`)
const cfgSrc = readFileSync(join(here, '../../playwright.config.ts'), 'utf8')
check('R4-no-precise-memory', !/precise-memory/.test(cfgSrc), 'playwright.config.ts does not pass --enable-precise-memory-info (Chrome then reports bucketed, cached usedJSHeapSize)')

// ---- R5: is ">= 2 rebases" reachable by the autopilot at all? ------------
// SAT_B = spawn + walkFwd*2400 + up*400 (harness :269): a point ABOVE the moon.
// The autopilot (:1416-1426) steers toward SAT_B forever, so the walker can at best
// reach SAT_B's nadir and stop. Bound its moon-fixed excursion from spawn.
const R = 1364.5, HMAX = 360
for (const hs of [0, 180, 360]) {
  const rsp = R + hs
  const satR = Math.hypot(rsp + 400, 2400)
  const nadirAng = Math.atan2(2400, rsp + 400)
  const chordMax = 2 * (R + HMAX) * Math.sin(nadirAng / 2) + HMAX
  const minDist = satR - (R + HMAX)
  console.log(`[u03] R5 spawn h=${hs}: |SAT_B| ${satR.toFixed(0)} m (altitude >= ${minDist.toFixed(0)} m above any terrain), nadir ${(nadirAng * 180 / Math.PI).toFixed(1)}° = ${(R * nadirAng).toFixed(0)} m arc; moon-fixed excursion bound ${chordMax.toFixed(0)} m`)
}
// moon spin in the harness: spinOmega 0.0005 rad/s (:127); LIVE 120 wall s at ts=6 = 720 sim s (+ warmup <= 8 s)
const spinMax = (R + HMAX) * 0.0005 * (720 + 8)
console.log(`[u03] R5 spin displacement bound ${(spinMax).toFixed(0)} m (rotation ${(0.0005 * 728).toFixed(3)} rad)`)
// Two rebases need: first crossing (component > 1024), then post-rebase locals <= 128,
// then another > 896 m of drift on some component -> >= 1024 - l0 + 896 total directed.
const need = 1024 + 896 - 128
const have = 2 * (R + HMAX) * Math.sin(Math.atan2(2400, R + 400) / 2) + HMAX + spinMax
console.log(`[u03] R5 geometric bound: total excursion <= ${have.toFixed(0)} m vs ${need} m needed (most favourable start) -> geometry ALONE does not forbid 2 crossings`)
// Range of the nadir distance floor |SAT_B| - (R + h_nadir) over spawn height 0..360 and nadir height 0..360
const floors = []; for (const hs of [0, 360]) for (const hn of [0, HMAX]) floors.push(Math.hypot(R + hs + 400, 2400) - (R + hn))
check('R5-plateau-is-nadir', Math.min(...floors) <= 1650 && 1650 <= Math.max(...floors),
  `distToSATB can never fall below |SAT_B| - surface = ${Math.min(...floors).toFixed(0)}..${Math.max(...floors).toFixed(0)} m; round-7's #582 plateau (~1,650 m) lies inside this floor range -> consistent with parking/circling under an overhead target`)
// Monte Carlo: IDEAL walker (no terrain, no climb limit, sprint 6.5 m/s on a great circle
// straight to SAT_B's nadir, then parked) + harness spin (+Y, 0.0005 rad/s), M1A rebase rule.
function idealRebases(sd, wf, hs, speed = 6.5, T = 728, dt = 0.1) {
  const rs = R + hs
  const sat = { x: sd.x * rs + wf.x * 2400 + sd.x * 400, y: sd.y * rs + wf.y * 2400 + sd.y * 400, z: sd.z * rs + wf.z * 2400 + sd.z * 400 }
  const sl = Math.hypot(sat.x, sat.y, sat.z), nd = { x: sat.x / sl, y: sat.y / sl, z: sat.z / sl }
  const ang = Math.acos(Math.max(-1, Math.min(1, sd.x * nd.x + sd.y * nd.y + sd.z * nd.z)))
  const P0 = { x: sd.x * rs, y: sd.y * rs, z: sd.z * rs }
  const O = { x: 256 * Math.round(P0.x / 256), y: 256 * Math.round(P0.y / 256), z: 256 * Math.round(P0.z / 256) }
  let rebases = 0
  for (let t = 0; t <= T; t += dt) {
    const a = Math.min(ang, speed * t / rs), f = ang > 0 ? a / ang : 0
    // slerp sd -> nd
    const s0 = Math.sin((1 - f) * ang) / Math.sin(ang), s1 = Math.sin(f * ang) / Math.sin(ang)
    const px = (sd.x * s0 + nd.x * s1) * rs, py = (sd.y * s0 + nd.y * s1) * rs, pz = (sd.z * s0 + nd.z * s1) * rs
    const th = 0.0005 * t, c = Math.cos(th), s = Math.sin(th)
    const X = c * px + s * pz, Y = py, Z = -s * px + c * pz        // rotation about +Y
    if (Math.max(Math.abs(X - O.x), Math.abs(Y - O.y), Math.abs(Z - O.z)) > 1024) {
      O.x = 256 * Math.round(X / 256); O.y = 256 * Math.round(Y / 256); O.z = 256 * Math.round(Z / 256); rebases++
    }
  }
  return rebases
}
let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) >>> 0) / 4294967296)
const hist = [0, 0, 0, 0]; const N = 2000
for (let i = 0; i < N; i++) {
  const u = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), q = Math.sqrt(1 - u * u)
  const sd = { x: q * Math.cos(ph), y: u, z: q * Math.sin(ph) }
  // random tangent
  let ax = Math.abs(sd.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 }
  let e1 = { x: sd.y * ax.z - sd.z * ax.y, y: sd.z * ax.x - sd.x * ax.z, z: sd.x * ax.y - sd.y * ax.x }
  const l1 = Math.hypot(e1.x, e1.y, e1.z); e1 = { x: e1.x / l1, y: e1.y / l1, z: e1.z / l1 }
  const e2 = { x: sd.y * e1.z - sd.z * e1.y, y: sd.z * e1.x - sd.x * e1.z, z: sd.x * e1.y - sd.y * e1.x }
  const b = 2 * Math.PI * rnd(), wf = { x: e1.x * Math.cos(b) + e2.x * Math.sin(b), y: e1.y * Math.cos(b) + e2.y * Math.sin(b), z: e1.z * Math.cos(b) + e2.z * Math.sin(b) }
  hist[Math.min(3, idealRebases(sd, wf, 180))]++
}
console.log(`[u03] R5 ideal-walker Monte Carlo (${N} random spawn/heading, h=180, sprint 6.5 m/s, no terrain): rebases 0:${hist[0]} 1:${hist[1]} 2:${hist[2]} 3+:${hist[3]}`)
check('R5-fixture-limited', (hist[2] + hist[3]) / N < 0.25,
  `even a perfect walker that never slows reaches >= 2 rebases on only ${(100 * (hist[2] + hist[3]) / N).toFixed(1)}% of geometries: the ">= 2" term is limited by where SAT_B is placed (the walk ends at its nadir), not by terrain or KCC`)
// straddler A/B: no assertion that Sat B covers any pixel
const r5 = lines.slice(r4End - 1, lineOf(/publishSuite\(\{ results, done: true \}\);/)).join('\n')
check('R5-no-coverage', /diffNear === 0 && diffMid === 0/.test(r5) && !/satPx|coverage|lit/.test(r5),
  'the straddler A/B passes on 0 differing bytes but never checks that Sat B is visible in the frame (an occluded or off-screen Sat B passes)')
check('R5-sunjump-rebase-only', /if \(!b\.rebased\) continue;/.test(r5), 'Sun continuity is sampled only on rebase frames; with 0-1 rebases it is 0-1 samples')

const ok = results.every((r) => r[1])
console.log(`[u03] ${ok ? 'CONFIRMED' : 'MIXED'} ${results.filter((r) => r[1]).length}/${results.length}`)
process.exit(ok ? 0 : 1)