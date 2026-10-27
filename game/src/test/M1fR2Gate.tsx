/**
 * F2fcab — rebuilt m1f R2 gate, rows R2a + R2b (ADR-021). Page `?page=m1fR2`.
 * WHY: the shipped m1f R2 row mixes the angular-scale claim with a "Sun visible"
 * claim at an unchecked pose (ADR-019/ADR-020). This page checks ONLY the impostor
 * pipeline (SkyImpostorPool staging + MultiCameraRig far pass) against independent
 * f64 truth from pinned literals: its own projection, its own camera basis, a
 * pinned edge law θe = 1.06·θ + 0.0035. Bodies are a pinned fixture, not the
 * harness (whose code is under audit). R2c (composite at a clear sightline) is
 * a later unit. Mutants via `?mut=theta` (θ×1.2 fed to the pool) and `?mut=pose`
 * (staged 1,380 m off the camera, the F2fbba absolute-pose accident).
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { SkyImpostorPool } from '../render/SkyImpostorPool';
import { RIG, executePasses, rigCamNear, rigCamMid, rigCamFar } from '../render/MultiCameraRig';
import { TerrainMeshPool } from '../render/TerrainMeshPool';
import { initTerrainField, terrainHeight, chunkOriginInto, type TerrainParams } from '../core/terrain/terrainField';

const W = 1280, H = 720, FOV = 62;
const EDGE_SCALE = 1.06, EDGE_MARGIN = 0.0035;   // pinned edge law (change only with an ADR)
const TOL_RAD = 1e-6, DIR_TOL = 1e-9, COV_LO = 0.85, COV_HI = 1.15, CTR_TOL = 1.5;
const MUT = new URLSearchParams(window.location.search).get('mut') ?? '';
type Row = { pass: boolean; detail: string };
type V3 = { x: number; y: number; z: number };
type Q = { x: number; y: number; z: number; w: number };

// R2c fixture moon: the M1F harness literals (pinned here, not imported from the harness under audit).
// WHY (F2fcabb, ADR-021): the composite claim needs real terrain, so R2c loads all 96 level-2 chunks
// through TerrainMeshPool. The moon frame IS the render frame (identity spin), so the
// "spin-correct" horizon frame of ADR-021 is trivially the frame the mesh is drawn in.
const MOON: TerrainParams = {
  name: 'm1fR2 fixture moon', radius: 1364.5, seed: 20240119,
  continentFreq: 2.3, continentAmp: 95, maskFreq: 3.7,
  mountainFreq: 6.5, mountainAmp: 230, detailFreq: 22, detailAmp: 16,
};
initTerrainField(MOON);
const CHUNK_LEVEL = 2;                                   // 6 faces × 4 × 4 = 96 chunks = pool size
const RAD = Math.PI / 180;
const SUN_ELEV = 35 * RAD, OCC_ELEV = 10 * RAD, MARGIN = 2 * RAD;
const BASE_H = 2, RAISE_STEP = 5, RAISE_MAX = 200, MARCH = 3000, CLAMP = 0.3;

const unit = (x: number, y: number, z: number): V3 => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };
// Pinned fixture: id, kind (0 planet, 1 sun, 2 gas giant), dir, θ (rad), true distance, colour.
const FIX = [
  { id: 'sun', kind: 1, d: unit(0.6, 0.5, -0.62), th: 0.02, dist: 1.5e11, c: [1, 0.93, 0.78] },
  { id: 'p1', kind: 0, d: unit(-0.3, 0.2, -0.93), th: 0.004, dist: 9e10, c: [0.45, 0.4, 0.35] },
  { id: 'p2', kind: 2, d: unit(0.1, -0.4, -0.9), th: 0.009, dist: 6e11, c: [0.5, 0.42, 0.3] },
  { id: 'p3', kind: 0, d: unit(0.9, 0.1, 0.4), th: 0.0015, dist: 2e11, c: [0.4, 0.3, 0.3] },
  { id: 'p4', kind: 0, d: unit(-0.7, -0.6, 0.3), th: 0.0025, dist: 4e10, c: [0.3, 0.35, 0.45] },
  { id: 'p5', kind: 2, d: unit(0.2, 0.95, 0.1), th: 0.006, dist: 1.2e12, c: [0.4, 0.45, 0.5] },
  { id: 'p6', kind: 0, d: unit(-0.2, 0.1, 0.97), th: 0.001, dist: 3e12, c: [0.35, 0.35, 0.4] },
  { id: 'p7', kind: 0, d: unit(0.5, -0.8, -0.2), th: 0.003, dist: 7e9, c: [0.42, 0.38, 0.36] },
];

/** v rotated by conj(q), f64 (camera-space direction). */
function rotConj(q: Q, v: V3): V3 {
  const ux = -q.x, uy = -q.y, uz = -q.z, w = q.w;
  const tx = 2 * (uy * v.z - uz * v.y), ty = 2 * (uz * v.x - ux * v.z), tz = 2 * (ux * v.y - uy * v.x);
  return { x: v.x + w * tx + (uy * tz - uz * ty), y: v.y + w * ty + (uz * tx - ux * tz), z: v.z + w * tz + (ux * ty - uy * tx) };
}
/** Independent pinhole projection (top-left pixel origin) for a camera looking down −Z. */
function project(q: Q, d: V3): { px: number; py: number } | null {
  const v = rotConj(q, d), f = -v.z;
  if (f <= 1e-9) return null;
  const tY = Math.tan((FOV * Math.PI) / 360), tX = tY * (W / H);
  return { px: ((v.x / f) / tX * 0.5 + 0.5) * W, py: (0.5 - (v.y / f) / tY * 0.5) * H };
}
function lookQuat(eye: V3, tgt: V3, up: V3): Q {
  const m = new THREE.Matrix4().lookAt(new THREE.Vector3(eye.x, eye.y, eye.z), new THREE.Vector3(tgt.x, tgt.y, tgt.z), new THREE.Vector3(up.x, up.y, up.z));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  return { x: q.x, y: q.y, z: q.z, w: q.w };
}
/** Ideal projected area of the disk of angular radius th around d: 128-gon of boundary rays. */
function idealArea(q: Q, d: V3, th: number): number {
  const a = Math.abs(d.x) < 0.9 ? unit(0, d.z, -d.y) : unit(-d.z, 0, d.x);
  const b = { x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x };
  const pts: Array<{ px: number; py: number }> = [];
  for (let k = 0; k < 128; k++) {
    const t = (2 * Math.PI * k) / 128, c = Math.cos(th), s = Math.sin(th);
    const p = project(q, { x: d.x * c + (a.x * Math.cos(t) + b.x * Math.sin(t)) * s, y: d.y * c + (a.y * Math.cos(t) + b.y * Math.sin(t)) * s, z: d.z * c + (a.z * Math.cos(t) + b.z * Math.sin(t)) * s });
    if (p) pts.push(p);
  }
  let A = 0;
  for (let k = 0; k < pts.length; k++) { const p = pts[k], n = pts[(k + 1) % pts.length]; A += p.px * n.py - n.px * p.py; }
  return Math.abs(A) / 2;
}

const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: V3, k: number): V3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a: V3, b: V3): V3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const deg = (r: number): string => (r / RAD).toFixed(2);
const surf = (s: V3): number => MOON.radius + terrainHeight(s.x, s.y, s.z);
/** Unit site direction where the Sun (direction d) stands `e` above the radial horizon, azimuth φ. */
function siteDir(d: V3, e: number, phi: number): V3 {
  const a = Math.abs(d.x) < 0.9 ? unit(0, d.z, -d.y) : unit(-d.z, 0, d.x);
  const b = { x: d.y * a.z - d.z * a.y, y: d.z * a.x - d.x * a.z, z: d.x * a.y - d.y * a.x };
  const c = Math.cos(phi), sn = Math.sin(phi), ce = Math.cos(e), se = Math.sin(e);
  return unit(d.x * se + (a.x * c + b.x * sn) * ce, d.y * se + (a.y * c + b.y * sn) * ce, d.z * se + (a.z * c + b.z * sn) * ce);
}
/** Analytic terrain horizon elevation (rad) seen from planet-relative p in the vertical plane of d:
 *  1 m steps along the sightline, surface point radially under each step, up to MARCH m. */
function horizonElev(p: V3, d: V3): number {
  const u = unit(p.x, p.y, p.z);
  let best = -Math.PI / 2;
  for (let k = 1; k <= MARCH; k++) {
    const q = add(p, scale(d, k)), qn = Math.hypot(q.x, q.y, q.z);
    if (qn > MOON.radius + 420 && dot(q, d) > 0) break;  // above all terrain and climbing
    const t = scale(q, surf(scale(q, 1 / qn)) / qn), v = { x: t.x - p.x, y: t.y - p.y, z: t.z - p.z };
    const e = Math.asin(dot(v, u) / Math.hypot(v.x, v.y, v.z));
    if (e > best) best = e;
  }
  return best;
}
type Footprint = (q: Q, label: string, cam: V3, composite: boolean) => { pass: boolean; text: string };
/** R2c: all three passes with terrain, at a pose whose Sun sightline is PROVEN clear first (ADR-020/021). */
async function compositeRow(scene: THREE.Scene, footprint: Footprint, d: V3): Promise<Row> {
  const tg = new THREE.Group();
  scene.add(tg);
  const pool = new TerrainMeshPool({ meshCount: 96, workerCount: 2, workerPoolSets: 96, maxBatch: 6, inFlightPerWorker: 12, params: MOON });
  pool.attach(tg as unknown as THREE.Scene);
  try {
    const o = { x: 0, y: 0, z: 0 };
    for (let f = 0; f < 6; f++) for (let ix = 0; ix < 4; ix++) for (let iy = 0; iy < 4; iy++) {
      chunkOriginInto(f, CHUNK_LEVEL, ix, iy, o);
      if (pool.acquire(f, CHUNK_LEVEL, ix, iy, o.x, o.y, o.z) < 0) return { pass: false, detail: 'terrain pool full' };
    }
    const t0 = performance.now();
    while (pool.activeCount() < 96) {
      pool.pump();
      if (performance.now() - t0 > 30_000) return { pass: false, detail: `terrain load timeout (${pool.activeCount()}/96 chunks)` };
      await new Promise((r) => setTimeout(r, 16));
    }
    const meshes = pool.records.filter((r) => r.state === 2).map((r) => r.mesh);
    const rc = new THREE.Raycaster();
    const firstHit = (from: V3, dir: V3, far: number): number => {
      rc.set(new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(dir.x, dir.y, dir.z));
      rc.near = 0; rc.far = far;
      const h = rc.intersectObjects(meshes, false);   // DoubleSide: a camera under the mesh hits its back face
      return h.length > 0 ? h[0].distance : -1;
    };
    const occ = MUT === 'horizon';
    let s = siteDir(d, SUN_ELEV, 0), occHz = NaN;
    if (occ) {   // mutant: low Sun, the most occluded of 24 azimuths, clearance proof bypassed
      let best = -9;
      for (let k = 0; k < 24; k++) {
        const c = siteDir(d, OCC_ELEV, (2 * Math.PI * k) / 24), z = horizonElev(scale(c, surf(c) + BASE_H), d);
        if (z > best) { best = z; s = c; }
      }
      occHz = best;
    }
    const g = surf(s);
    tg.position.set(-s.x * g, -s.y * g, -s.z * g);    // site ground at the render origin (floating origin)
    tg.updateMatrixWorld(true);
    const sunE = Math.asin(dot(s, d));
    let H = NaN, hz = NaN, note = '', tries = 0;
    if (MUT === 'noray') {   // mutant: raycast skipped, camera clamped into the mesh, no raise
      const dn = firstHit(scale(s, 600), scale(s, -1), 1200);
      const meshH = 600 - dn;
      tries = 1; hz = horizonElev(scale(s, g + meshH - CLAMP), d);
      note = `raycast skipped; camera clamped ${CLAMP} m under the mesh (mesh ${meshH.toFixed(2)} m above analytic ground)`;
      if (dn >= 0 && hz <= sunE - MARGIN) H = meshH - CLAMP;
    } else if (occ) {
      tries = 1; hz = occHz; H = BASE_H; note = 'clearance proof bypassed';
    } else {
      for (let h = BASE_H; h <= BASE_H + RAISE_MAX; h += RAISE_STEP) {
        tries++;
        hz = horizonElev(scale(s, g + h), d);
        if (hz > sunE - MARGIN) { note = `last reject: horizon ${deg(hz)}°`; continue; }
        const hit = firstHit(scale(s, h), d, MARCH);
        if (hit >= 0) { note = `last reject: mesh hit at ${hit.toFixed(2)} m`; continue; }
        H = h; note = 'horizon march + mesh raycast clear'; break;
      }
    }
    const where = `Sun elev ${deg(sunE)}°, terrain horizon ${deg(hz)}° (margin ≥ 2°)`;
    if (!Number.isFinite(H)) return { pass: false, detail: `sightline not clear after ${tries} pose(s), raise ≤ ${RAISE_MAX} m: ${where}; ${note}` };
    const cam = scale(s, H);
    const fp = footprint(lookQuat(cam, add(cam, d), s), 'composite', cam, true);
    return { pass: fp.pass, detail: `camera ${H.toFixed(2)} m above analytic ground after ${tries} pose(s) (${note}); ${where}; ${fp.text} (tol ±15%, 1.5 px)` };
  } finally {
    pool.disposeAll();
    scene.remove(tg);
  }
}

async function runGate(gl: THREE.WebGLRenderer): Promise<Array<[string, Row]>> {
  const scene = new THREE.Scene();
  const sky = new SkyImpostorPool(0);
  scene.add(sky.mesh);
  FIX.forEach((f, i) => sky.setBody(i, f.id, f.kind, f.d.x, f.d.y, f.d.z, MUT === 'theta' ? f.th * 1.2 : f.th, f.dist, f.c[0], f.c[1], f.c[2], 1, true));
  for (const c of [rigCamNear, rigCamMid, rigCamFar]) { c.aspect = W / H; c.fov = FOV; c.updateProjectionMatrix(); }
  const rt = new THREE.WebGLRenderTarget(W, H);
  const buf = new Uint8Array(W * H * 4);
  const drv: V3 = { x: 37.5, y: 12.25, z: -80 };     // render-local camera position
  const up = unit(0.05, 1, 0.1);
  const sun = FIX[0];

  const stage = (q: Q, cam: V3 = drv): void => {
    const off = MUT === 'pose' ? 1380 : 0;
    const sc = rotConj(q, sun.d);
    sky.update(cam.x + off, cam.y, cam.z, q.x, q.y, q.z, q.w, sc.x, sc.y, sc.z);
  };
  const footprint = (q: Q, label: string, cam: V3 = drv, composite = false): { pass: boolean; text: string } => {
    stage(q, cam);
    RIG.poseOverride = { x: cam.x, y: cam.y, z: cam.z, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
    const nm = rigCamNear.layers.mask, mm = rigCamMid.layers.mask;
    if (!composite) { rigCamNear.layers.mask = 0; rigCamMid.layers.mask = 0; }   // FAR pass only (ADR-019); R2c draws all three
    gl.setRenderTarget(rt); executePasses(gl, scene); gl.setRenderTarget(null);
    rigCamNear.layers.mask = nm; rigCamMid.layers.mask = mm; RIG.poseOverride = null;
    gl.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    let n = 0, sx = 0, sy = 0;
    for (let r = 0; r < H; r++) for (let x = 0; x < W; x++) {
      const i = (r * W + x) * 4;
      if (buf[i] > 165 && buf[i + 1] > 120) { n++; sx += x + 0.5; sy += (H - 1 - r) + 0.5; }   // readback rows are bottom-up
    }
    const p = project(q, sun.d), ideal = idealArea(q, sun.d, sun.th);
    const cov = n / ideal, ctr = n > 0 && p ? Math.hypot(sx / n - p.px, sy / n - p.py) : 999;
    const pass = !!p && cov >= COV_LO && cov <= COV_HI && ctr < CTR_TOL;
    return { pass, text: `${label}: ${n} px vs ideal ${ideal.toFixed(1)} (${(cov * 100).toFixed(1)}%), centre err ${ctr.toFixed(2)} px` };
  };

  // R2a — staging law per instance, at pose A (aimed at the Sun)
  const qA = lookQuat(drv, { x: drv.x + sun.d.x, y: drv.y + sun.d.y, z: drv.z + sun.d.z }, up);
  stage(qA);
  const m = new THREE.Matrix4(), tp = new THREE.Vector3(), tq = new THREE.Quaternion(), ts = new THREE.Vector3();
  const dA = (sky.mesh.geometry.getAttribute('aDisk') as THREE.InstancedBufferAttribute).array as Float32Array;
  let eEdge = 0, eDisk = 0, eTan = 0, eDir = 0, matched = 0, dOk = true;
  FIX.forEach((f, i) => {
    const b = sky.bodies[i];
    for (let r = 0; r < sky.mesh.count; r++) {
      sky.mesh.getMatrixAt(r, m); m.decompose(tp, tq, ts);
      if (Math.abs(tp.x - b.stagedPX) + Math.abs(tp.y - b.stagedPY) + Math.abs(tp.z - b.stagedPZ) > 0.05) continue;
      const tE = EDGE_SCALE * f.th + EDGE_MARGIN;
      eEdge = Math.max(eEdge, Math.abs(Math.atan(ts.x / b.stageD) - tE));
      eTan = Math.max(eTan, Math.abs(Math.atan(dA[r * 2]) - tE));
      eDisk = Math.max(eDisk, Math.abs(Math.atan(dA[r * 2 + 1]) - f.th));
      const u = unit(b.stagedPX - drv.x, b.stagedPY - drv.y, b.stagedPZ - drv.z);
      // atan2(|u×d|, u·d): acos(dot) floors at ~2e-8 rad in f64, far above the 1e-9 tolerance
      const cx = u.y * f.d.z - u.z * f.d.y, cy = u.z * f.d.x - u.x * f.d.z, cz = u.x * f.d.y - u.y * f.d.x;
      eDir = Math.max(eDir, Math.atan2(Math.hypot(cx, cy, cz), u.x * f.d.x + u.y * f.d.y + u.z * f.d.z));
      if (!(b.stageD >= 500 && b.stageD <= 9600)) dOk = false;
      matched++; break;
    }
  });
  const r2a: Row = {
    pass: matched === FIX.length && eEdge < TOL_RAD && eTan < TOL_RAD && eDisk < TOL_RAD && eDir < DIR_TOL && dOk,
    detail: `${matched}/${FIX.length} instances: quad half-angle err ${eEdge.toExponential(1)} rad, edge attr ${eTan.toExponential(1)}, disk θ ${eDisk.toExponential(1)} (tol 1e-6); direction ${eDir.toExponential(1)} rad (tol 1e-9); staged D in [500, 9600]: ${dOk}`,
  };
  // R2b — far-pass Sun footprint, centred and 12° off-axis
  const perp = unit(-sun.d.z, 0, sun.d.x);
  const qB = lookQuat(drv, { x: drv.x + sun.d.x + 0.21 * perp.x, y: drv.y + sun.d.y, z: drv.z + sun.d.z + 0.21 * perp.z }, up);
  const fa = footprint(qA, 'centred'), fb = footprint(qB, 'off-axis');
  const r2b: Row = { pass: fa.pass && fb.pass, detail: `${fa.text}; ${fb.text} (tol ±15%, 1.5 px)` };
  const r2c = await compositeRow(scene, footprint, sun.d);
  rt.dispose();
  return [['R2a angular law', r2a], ['R2b far-pass Sun footprint', r2b], ['R2c composite Sun visibility', r2c]];
}

export default function M1fR2Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    void (async () => { try {
      const res = await runGate(gl);
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR2Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR2Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
    } catch (e) {
      console.log(`[M1fR2Gate] acceptance FAILED (exception ${String(e)})`);
    } })();
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R2 rebuilt gate (F2fcab, ADR-021){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}