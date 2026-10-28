/**
 * F2fcea — rebuilt m1f R5 gate, row R5a (ADR-025). Page `?page=m1fR5`.
 * WHY: the shipped R5 row requires "rebases ≥ 2" from an autopilot that steers toward
 * SAT_B, a point 400 m ABOVE a tangent 2,400 m away; the walker parks at its nadir
 * (~1,374 m of arc), so the row is red by fixture (A1-U03-5). Its Sun-continuity term
 * is sampled only on rebase frames, so 0 rebases gives 0 samples and a pass (A1-U03-6).
 * R5a drives the REAL SimulationCore along a scripted, continuous, non-teleporting
 * great-circle surface route (4,000 m at sprint 6.5 m/s, the U27 control that crosses
 * ≥ 2 lattice shifts) and checks every tick against an independent f64 lattice oracle
 * that imports nothing from the engine. Mutants: `?mut=nadir` (route stops at the
 * shipped fixture's nadir arc), `?mut=skew` (a rebase listener nudges the live,
 * writable origin, A1-U11-3), `?mut=teleport` (300 m jump mid-route).
 * R5b (F2fceb, ADR-025 amendment) is the straddler A/B through `executePasses` with a
 * coverage floor, a 1 m sensitivity control and the production `layerMaskFor` NEAR|MID
 * check, plus Sun continuity rendered and checked on EVERY frame of a real rebase sequence.
 * Mutants: `?mut=offframe` (Sat B behind the camera: 0 px), `?mut=single` (Sat B forced to
 * one layer), `?mut=sunstale` (the Sun's local position is never rebased).
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SimulationCore, FIXED_DT } from '../core/simulation/SimulationCore';
import { RIG, executePasses, layerMaskFor, rigCamNear, rigCamMid, rigCamFar, NEAR_BIT, MID_BIT, NEAR_MID_THRESHOLD } from '../render/MultiCameraRig';
import { SkyImpostorPool } from '../render/SkyImpostorPool';

const MUT = new URLSearchParams(window.location.search).get('mut') ?? '';
// Pinned fixture. WHY: R = shipped moon radius 1,364.5 m + terrain h ∈ {0, 180, 360} m (the U27
// grid heights). Start +X, tangent (0,1,1)/√2: an independent sweep of the oracle gives 0 shifts
// over the shipped nadir arc and 2 over 4,000 m (a (1,1,1) start gave 2 even on the nadir arc, so
// the nadir mutant could not discriminate). The start is >1,024 from the zero origin, so one warm
// tick at rest settles the origin first and only shifts AFTER it are counted as walking shifts.
const HEIGHTS: Array<[number, number]> = [[0, 1278.304], [180, 1374.391], [360, 1459.296]];   // terrain h, nadir arc (U27 K2d recheck)
const SPEED = 6.5;                                       // sprint, m/s (shipped KCC)
const TELEPORT_AT = 2000, TELEPORT_M = 300;
// Independent oracle constants (NOT imported from precisionMath, on purpose).
const LAT = 256, TRIG = 1024;
type Row = { pass: boolean; detail: string };
type V = { x: number; y: number; z: number };

const s2 = 1 / Math.sqrt(2);
const U: V = { x: 1, y: 0, z: 0 }, Wt: V = { x: 0, y: s2, z: s2 };   // start dir, tangent (U·Wt = 0)
function routeInto(R: number, s: number, o: V): V {
  const th = s / R, c = Math.cos(th), n = Math.sin(th);
  o.x = R * (c * U.x + n * Wt.x); o.y = R * (c * U.y + n * Wt.y); o.z = R * (c * U.z + n * Wt.z);
  return o;
}
const maxAbs = (x: number, y: number, z: number): number => Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
const isLattice = (v: number): boolean => Number.isInteger(v / LAT);

function rowR5aAt(h: number, nadir: number): Row {
  const R = 1364.5 + h, ROUTE_M = MUT === 'nadir' ? nadir : 4000;   // nadir mutant = shipped fixture's arc
  const core = new SimulationCore();
  const p0 = routeInto(R, 0, { x: 0, y: 0, z: 0 });
  const e = core.registerEntity('walker', { absPos: { x: p0.x, y: p0.y, z: p0.z }, velocity: { x: 0, y: 0, z: 0 } });
  const events: Array<{ count: number; d: V; o: V }> = [];
  core.onRebase((ev) => {
    events.push({ count: ev.count, d: { ...ev.delta }, o: { ...ev.newOrigin } });
    if (MUT === 'skew') core.getOrigin().x += 1;          // live, writable origin (A1-U11-3)
  });
  let rb0 = core.stats.rebaseCount;
  const oo: V = { x: 0, y: 0, z: 0 };                     // oracle origin (core starts at 0,0,0)
  let oracleShifts = 0;
  const tgt: V = { x: 0, y: 0, z: 0 };
  const prevAbs: V = { ...p0 }, prevLoc: V = { x: p0.x, y: p0.y, z: p0.z };
  const ticks = Math.ceil(ROUTE_M / (SPEED * FIXED_DT));
  const stepMax = SPEED * FIXED_DT * (1 + 1e-9) + 1e-9;
  let originMis = 0, latticeBad = 0, localOver = 0, f32Bad = 0, celF32Bad = 0, stepBad = 0, identBad = 0;
  let maxLocal = 0, maxStep = 0, maxIdent = 0, minClear = Infinity;
  const cel = core.getCelestialStates();
  let jump = 0;
  for (let k = 0; k <= ticks; k++) {
    if (k === 1) {   // warm tick done: count only walking shifts from here
      rb0 = core.stats.rebaseCount; oracleShifts = 0; events.length = 0;
      originMis = latticeBad = localOver = f32Bad = celF32Bad = stepBad = identBad = 0; maxLocal = maxStep = maxIdent = 0; minClear = Infinity;
    }
    let s = Math.min(ROUTE_M, k * SPEED * FIXED_DT);
    if (MUT === 'teleport' && jump === 0 && s >= TELEPORT_AT) jump = TELEPORT_M;   // permanent 300 m offset
    s += jump;
    routeInto(R, s, tgt);
    core.setVelocity('walker', (tgt.x - e.absPos.x) / FIXED_DT, (tgt.y - e.absPos.y) / FIXED_DT, (tgt.z - e.absPos.z) / FIXED_DT);
    const evBefore = events.length;
    core.tick();
    const a = e.absPos, O = core.getOrigin();
    // oracle: strict > TRIG on the max axis, snap per axis to the nearest LAT point
    if (maxAbs(a.x - oo.x, a.y - oo.y, a.z - oo.z) > TRIG) {
      oo.x = LAT * Math.floor(a.x / LAT + 0.5); oo.y = LAT * Math.floor(a.y / LAT + 0.5); oo.z = LAT * Math.floor(a.z / LAT + 0.5);
      oracleShifts++;
    }
    if (O.x !== oo.x || O.y !== oo.y || O.z !== oo.z) originMis++;
    if (!isLattice(O.x) || !isLattice(O.y) || !isLattice(O.z)) latticeBad++;
    const lx = a.x - O.x, ly = a.y - O.y, lz = a.z - O.z;
    const m = maxAbs(lx, ly, lz);
    if (m > maxLocal) maxLocal = m;
    if (m > TRIG) localOver++;
    if (TRIG - m < minClear) minClear = TRIG - m;
    const L = e.localPosF32;
    if (L[0] !== Math.fround(lx) || L[1] !== Math.fround(ly) || L[2] !== Math.fround(lz)) f32Bad++;
    for (let i = 0; i < cel.length; i++) {
      const c = cel[i];
      if (c.localPosF32[0] !== Math.fround(c.absPos.x - O.x) || c.localPosF32[1] !== Math.fround(c.absPos.y - O.y) ||
        c.localPosF32[2] !== Math.fround(c.absPos.z - O.z)) celF32Bad++;
    }
    // continuity: no world step beyond sprint·dt; across a rebase the f64 local step = world step − Δ exactly
    const st = Math.hypot(a.x - prevAbs.x, a.y - prevAbs.y, a.z - prevAbs.z);
    if (st > maxStep) maxStep = st;
    if (st > stepMax) stepBad++;
    let dx = 0, dy = 0, dz = 0;
    for (let j = evBefore; j < events.length; j++) { dx += events[j].d.x; dy += events[j].d.y; dz += events[j].d.z; }
    const id = maxAbs((lx - prevLoc.x) - (a.x - prevAbs.x) + dx, (ly - prevLoc.y) - (a.y - prevAbs.y) + dy, (lz - prevLoc.z) - (a.z - prevAbs.z) + dz);
    if (id > maxIdent) maxIdent = id;
    if (id > 1e-9) identBad++;
    prevAbs.x = a.x; prevAbs.y = a.y; prevAbs.z = a.z; prevLoc.x = lx; prevLoc.y = ly; prevLoc.z = lz;
  }
  const shifts = core.stats.rebaseCount - rb0;
  const deltasOk = events.every((v) => isLattice(v.d.x) && isLattice(v.d.y) && isLattice(v.d.z) && (v.d.x !== 0 || v.d.y !== 0 || v.d.z !== 0));
  const countsOk = events.length === shifts && events.every((v, i) => v.count === rb0 + i + 1);
  const fails: string[] = [];
  if (shifts < 2) fails.push(`shifts ${shifts} < 2`);
  if (shifts !== oracleShifts) fails.push(`shifts ${shifts} ≠ oracle ${oracleShifts}`);
  if (!countsOk) fails.push('event samples ≠ shifts');
  if (!deltasOk) fails.push('Δ not a non-zero 256 multiple');
  if (originMis) fails.push(`origin ≠ oracle on ${originMis} ticks`);
  if (latticeBad) fails.push(`origin off-lattice on ${latticeBad} ticks`);
  if (localOver) fails.push(`local > 1,024 on ${localOver} ticks`);
  if (f32Bad || celF32Bad) fails.push(`f32 locals ≠ fround(abs−O): focus ${f32Bad}, celestial ${celF32Bad}`);
  if (stepBad) fails.push(`world step > sprint·dt on ${stepBad} ticks (max ${maxStep.toFixed(3)} m)`);
  if (identBad) fails.push(`local-step identity broken on ${identBad} ticks`);
  const ds = events.map((v) => `(${v.d.x},${v.d.y},${v.d.z})`).join(' ');
  return {
    pass: fails.length === 0,
    detail: `h ${h} m: ${shifts} shifts on a ${ROUTE_M} m continuous route (${ticks} ticks, oracle ${oracleShifts}); Δ ${ds || 'none'}; ` +
      `max local ${maxLocal.toFixed(3)} m (clearance ${minClear.toFixed(3)}); max step ${maxStep.toFixed(4)} m; ` +
      `identity max ${maxIdent.toExponential(1)} m; f32 focus/celestial mismatches ${f32Bad}/${celF32Bad} over ${cel.length} celestials; ` +
      `fails: [${fails.join('; ')}];`,
  };
}

// WHY: three terrain heights so the verdict does not rest on one fixture radius (K2d); the oracle
// sweep gives 0 shifts on every nadir arc and 2/2/3 over 4,000 m.
function rowR5a(): Row {
  const r = HEIGHTS.map(([h, n]) => rowR5aAt(h, n));
  return { pass: r.every((x) => x.pass), detail: r.map((x) => x.detail).join(' | ') };
}

/* ---- R5b (F2fceb, ADR-025 amendment): straddler A/B with coverage + Sun on every frame ---- */
const W = 1280, H = 720, FOV = 62, SW = 160, SH = 90, RAD = Math.PI / 180;
const SAT_R = 60, SAT_MIN_PX = 200;                      // Sat B radius (m), coverage floor (px)
// WHY: the 4,000 m route is R5a's h 0 control (2 lattice shifts), so the Sun is checked across 2 rebase frames.
const SUN_TH = 0.06, SUN_SPEED = 50, SUN_ROUTE = 4000;   // Sun impostor θ (rad); camera route m/s, m
const SUN_DIR_TOL = 1e-5, SUN_CTR_TOL = 1;               // rad; px
type Part = { fails: string[]; text: string };

function pxDiff(a: Uint8Array, b: Uint8Array): { bytes: number; px: number } {
  let bytes = 0, px = 0;
  for (let i = 0; i < a.length; i += 4) {
    let d = 0;
    for (let j = 0; j < 4; j++) if (a[i + j] !== b[i + j]) d++;
    bytes += d; if (d) px++;
  }
  return { bytes, px };
}

// WHY: the shipped A/B (A1-U03-5/-6) compared three renders of a Sat B that could be off-screen,
// so 0 differing bytes proved nothing. Here Sat B straddles 2,400 m in front of the camera, a
// Near-only occluder sits in front of it and a Mid-only backdrop behind it (so a wrong pass order
// or a missing depth clear changes pixels), and the row requires Sat B to cover > SAT_MIN_PX px
// (auto vs Sat-B-hidden) and a 1 m shift to change pixels before the byte-exact A/B counts.
function straddlePart(gl: THREE.WebGLRenderer): Part {
  const scene = new THREE.Scene();
  const geo = new THREE.SphereGeometry(1, 48, 32);
  const mk = (c: number, r: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c }));
    m.scale.setScalar(r); m.position.set(x, y, z); m.updateMatrixWorld(true); scene.add(m);
    const d = Math.hypot(x, y, z);
    return { m, dn: d - r, df: d + r };
  };
  const sat = mk(0xd04030, SAT_R, 0, 0, MUT === 'offframe' ? 2400 : -2400);   // offframe: behind the camera, same depth range
  const occ = mk(0x30c050, 15, 15, 5, -2200);
  const bak = mk(0x3050d0, 260, 200, 0, -3000);
  const satLaw = layerMaskFor(sat.dn, sat.df);
  sat.m.layers.mask = MUT === 'single' ? (satLaw & MID_BIT) : satLaw;
  occ.m.layers.mask = layerMaskFor(occ.dn, occ.df);
  bak.m.layers.mask = layerMaskFor(bak.dn, bak.df);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const render = (): Uint8Array => {
    const b = new Uint8Array(W * H * 4);
    RIG.poseOverride = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    gl.setRenderTarget(rt); executePasses(gl, scene); gl.setRenderTarget(null);
    RIG.poseOverride = null;
    gl.readRenderTargetPixels(rt, 0, 0, W, H, b);
    return b;
  };
  const assigned = sat.m.layers.mask;
  const auto = render(), again = render();
  sat.m.layers.mask = NEAR_BIT; const near = render();
  sat.m.layers.mask = MID_BIT; const mid = render();
  sat.m.layers.mask = assigned;
  sat.m.visible = false; const hidden = render(); sat.m.visible = true;
  sat.m.position.x += 1; sat.m.updateMatrixWorld(true); const shifted = render();
  sat.m.position.x -= 1; sat.m.updateMatrixWorld(true);
  rt.dispose(); geo.dispose();
  const dN = pxDiff(auto, near), dM = pxDiff(auto, mid), rep = pxDiff(auto, again);
  const cov = pxDiff(auto, hidden).px, sens = pxDiff(auto, shifted).px;
  const f = (H / 2) / Math.tan((FOV / 2) * RAD), ideal = Math.PI * (f * SAT_R / 2400) ** 2;
  const BOTH = NEAR_BIT | MID_BIT;
  const fails: string[] = [];
  if (!(sat.dn < NEAR_MID_THRESHOLD && sat.df > NEAR_MID_THRESHOLD)) fails.push('Sat B does not straddle 2,400 m');
  if (satLaw !== BOTH) fails.push(`layerMaskFor(Sat B) ${satLaw} ≠ NEAR|MID ${BOTH}`);
  if (assigned !== BOTH) fails.push(`Sat B assigned mask ${assigned} ≠ NEAR|MID ${BOTH}`);
  if (occ.m.layers.mask !== NEAR_BIT || bak.m.layers.mask !== MID_BIT) fails.push(`fixture masks occluder ${occ.m.layers.mask} backdrop ${bak.m.layers.mask}`);
  if (cov <= SAT_MIN_PX) fails.push(`Sat B ${cov} px ≤ ${SAT_MIN_PX}`);
  if (sens === 0) fails.push('1 m shift changes 0 px (instrument blind)');
  if (dN.bytes || dM.bytes) fails.push(`forced-Near/forced-Mid differ from auto by ${dN.bytes}/${dM.bytes} bytes`);
  if (rep.bytes) fails.push(`repeat render differs by ${rep.bytes} bytes`);
  return {
    fails,
    text: `Sat B d_n ${sat.dn.toFixed(1)} d_f ${sat.df.toFixed(1)} law ${satLaw} assigned ${assigned}; coverage ${cov} px (ideal disc ${ideal.toFixed(0)}, floor ${SAT_MIN_PX}); ` +
      `1 m shift ${sens} px; auto vs forced-Near ${dN.bytes} B, vs forced-Mid ${dM.bytes} B, repeat ${rep.bytes} B of ${W * H * 4}`,
  };
}

// WHY: the shipped Sun-continuity term was sampled only on rebase frames, so a walk with 0 rebases
// had 0 samples and passed (A1-U03-6). Here a real SimulationCore camera flies the R5a route
// (h 0) at 50 m/s and EVERY tick is rendered (far pass, Sun impostor from the f32 locals the
// shipped staging consumes) and checked against an origin-free f64 oracle. The Sun is the frame
// origin, ~1.4 km away, so a missed rebase (Δ ≥ 256 m) moves it by ≥ 0.18 rad — a hard signal.
function sunPart(gl: THREE.WebGLRenderer): Part {
  const scene = new THREE.Scene();
  const sky = new SkyImpostorPool(0);
  scene.add(sky.mesh);
  const rt = new THREE.WebGLRenderTarget(SW, SH);
  const buf = new Uint8Array(SW * SH * 4);
  const core = new SimulationCore();
  const R = 1364.5;
  const p0 = routeInto(R, 0, { x: 0, y: 0, z: 0 });
  const e = core.registerEntity('flyer', { absPos: { x: p0.x, y: p0.y, z: p0.z }, velocity: { x: 0, y: 0, z: 0 } });
  let reb = 0;
  core.onRebase(() => { reb++; });
  const sun = core.getCelestialStates().find((c) => c.config.id === 'sun');
  if (!sun) return { fails: ['no Sun celestial state'], text: 'Sun: none' };
  core.tick();                                           // warm tick at rest settles the origin
  const O0 = { ...core.getOrigin() }, rb0 = core.stats.rebaseCount;
  const vUp = new THREE.Vector3(0, -s2, s2);             // route-plane normal: ⟂ every camera→Sun direction
  const vEye = new THREE.Vector3(), vT = new THREE.Vector3(), vS = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qi = new THREE.Quaternion();
  const tgt: V = { x: 0, y: 0, z: 0 };
  const frames = Math.ceil(SUN_ROUTE / (SUN_SPEED * FIXED_DT));
  let samples = 0, rebaseFrames = 0, dirBad = 0, pxBad = 0, ctrBad = 0, rebaseOk = 0;
  let maxDir = 0, maxCtr = 0, minPx = Infinity, dMin = Infinity, dMax = 0;
  const nm = rigCamNear.layers.mask, mm = rigCamMid.layers.mask;
  for (let k = 1; k <= frames; k++) {
    routeInto(R, Math.min(SUN_ROUTE, k * SUN_SPEED * FIXED_DT), tgt);
    core.setVelocity('flyer', (tgt.x - e.absPos.x) / FIXED_DT, (tgt.y - e.absPos.y) / FIXED_DT, (tgt.z - e.absPos.z) / FIXED_DT);
    reb = 0;
    core.tick();
    const a = e.absPos, L = e.localPosF32, S = sun.localPosF32;
    // render side: the Sun relative to the camera from f32 locals (sunstale: the Sun never rebased)
    let sx = S[0] - L[0], sy = S[1] - L[1], sz = S[2] - L[2];
    if (MUT === 'sunstale') {
      sx = Math.fround(sun.absPos.x - O0.x) - L[0]; sy = Math.fround(sun.absPos.y - O0.y) - L[1]; sz = Math.fround(sun.absPos.z - O0.z) - L[2];
    }
    const sl = Math.hypot(sx, sy, sz) || 1; sx /= sl; sy /= sl; sz /= sl;
    // oracle: f64 absolute positions, no origin anywhere
    let ox = sun.absPos.x - a.x, oy = sun.absPos.y - a.y, oz = sun.absPos.z - a.z;
    const dSun = Math.hypot(ox, oy, oz); ox /= dSun; oy /= dSun; oz /= dSun;
    dMin = Math.min(dMin, dSun); dMax = Math.max(dMax, dSun);
    m4.lookAt(vEye.set(0, 0, 0), vT.set(ox, oy, oz), vUp); q.setFromRotationMatrix(m4); qi.copy(q).invert();
    vS.set(sx, sy, sz).applyQuaternion(qi);
    sky.setBody(0, 'sun', 1, sx, sy, sz, SUN_TH, dSun, 1, 0.93, 0.78, 1, true);
    sky.update(L[0], L[1], L[2], q.x, q.y, q.z, q.w, vS.x, vS.y, vS.z);
    // staged instance direction (what is drawn) vs the oracle
    const b0 = sky.bodies[0];
    const gx = b0.stagedPX - L[0], gy = b0.stagedPY - L[1], gz = b0.stagedPZ - L[2], gl2 = Math.hypot(gx, gy, gz) || 1;
    const cx = (gy * oz - gz * oy) / gl2, cy = (gz * ox - gx * oz) / gl2, cz = (gx * oy - gy * ox) / gl2;
    const err = Math.atan2(Math.hypot(cx, cy, cz), (gx * ox + gy * oy + gz * oz) / gl2);
    RIG.poseOverride = { x: L[0], y: L[1], z: L[2], qx: q.x, qy: q.y, qz: q.z, qw: q.w };
    rigCamNear.layers.mask = 0; rigCamMid.layers.mask = 0;   // far pass only (ADR-019)
    gl.setRenderTarget(rt); executePasses(gl, scene); gl.setRenderTarget(null);
    rigCamNear.layers.mask = nm; rigCamMid.layers.mask = mm; RIG.poseOverride = null;
    gl.readRenderTargetPixels(rt, 0, 0, SW, SH, buf);
    let n = 0, px = 0, py = 0;
    for (let r = 0; r < SH; r++) for (let x = 0; x < SW; x++) {
      const i = (r * SW + x) * 4;
      if (buf[i] > 165 && buf[i + 1] > 120) { n++; px += x + 0.5; py += (SH - 1 - r) + 0.5; }   // rows bottom-up
    }
    const ctr = n > 0 ? Math.hypot(px / n - SW / 2, py / n - SH / 2) : Infinity;
    samples++;
    if (err > maxDir) maxDir = err;
    if (n < minPx) minPx = n;
    if (n > 0 && ctr > maxCtr) maxCtr = ctr;
    const bad = err > SUN_DIR_TOL || n === 0 || ctr > SUN_CTR_TOL;
    if (err > SUN_DIR_TOL) dirBad++;
    if (n === 0) pxBad++;
    else if (ctr > SUN_CTR_TOL) ctrBad++;
    if (reb > 0) { rebaseFrames++; if (!bad) rebaseOk++; }
  }
  rt.dispose(); sky.mesh.geometry.dispose(); sky.material.dispose();
  const shifts = core.stats.rebaseCount - rb0;
  const fails: string[] = [];
  if (!(frames > 0 && samples === frames)) fails.push(`samples ${samples} ≠ frames ${frames}`);
  if (rebaseFrames < 1) fails.push('0 rebase frames');
  if (dirBad) fails.push(`Sun dir err > ${SUN_DIR_TOL} rad on ${dirBad} of ${frames} frames`);
  if (pxBad) fails.push(`Sun 0 px on ${pxBad} frames`);
  if (ctrBad) fails.push(`Sun centroid > ${SUN_CTR_TOL} px on ${ctrBad} frames`);
  return {
    fails,
    text: `Sun: ${frames} frames, ${samples} samples, ${rebaseFrames} rebase frames (${shifts} shifts, ${rebaseOk} clean); ` +
      `d_sun ${dMin.toFixed(0)}–${dMax.toFixed(0)} m; max dir err ${maxDir.toExponential(2)} rad; Sun px min ${minPx}; max centroid err ${maxCtr.toFixed(2)} px`,
  };
}

function rowR5b(gl: THREE.WebGLRenderer): Row {
  for (const c of [rigCamNear, rigCamMid, rigCamFar]) { c.fov = FOV; c.aspect = W / H; c.updateProjectionMatrix(); }
  const a = straddlePart(gl), b = sunPart(gl);
  const fails = [...a.fails, ...b.fails];
  return { pass: fails.length === 0, detail: `${a.text} | ${b.text}; fails: [${fails.join('; ')}];` };
}

export default function M1fR5Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    try {
      const r5a = rowR5a();
      const canvas = document.createElement('canvas');
      const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
      gl.setPixelRatio(1); gl.setSize(W, H, false);
      const r5b = rowR5b(gl);
      const res: Array<[string, Row]> = [['R5a rebase lattice on a continuous route', r5a], ['R5b straddler A/B and Sun on every frame', r5b]];
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR5Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR5Gate] acceptance ${res.every((x) => x[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
    } catch (err) {
      console.log(`[M1fR5Gate] acceptance FAILED (exception ${String(err)})`);
    }
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R5 rebuilt gate (F2fcea/F2fceb, ADR-025){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}