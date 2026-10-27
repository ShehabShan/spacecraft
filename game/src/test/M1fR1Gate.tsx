/**
 * F2fcb — rebuilt m1f R1 depth-compositing gate (ADR-022). Page `?page=m1fR1`.
 * WHY: every clause of the shipped R1 row passes by construction (A1-U02-2: literal
 * pairs and literal planes; A1-U02-3: Earth/terrain pair always hits a 1e9 sentinel;
 * A1-U02-4: a frozen-frame diff cannot see z-fighting). This page drives R1 from
 * scene state: pinned fixture pairs are placed in front of the rig camera, their pass
 * comes from the production `layerMaskFor` on their view-depth range, the planes are
 * read from the rig cameras at run time, and the verdict is RENDERED through
 * `executePasses`, with a rendered single-camera counterfactual that must fuse.
 * Mutants: `?mut=planes` (Mid camera gets the single-camera planes 0.01/1e7) and
 * `?mut=assign` (probe pair forced onto the Near layer only).
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { RIG, executePasses, layerMaskFor, rigCamNear, rigCamMid, rigCamFar, NEAR_BIT, MID_BIT, FAR_BIT, CLEAR_COLOR } from '../render/MultiCameraRig';

const W = 1280, H = 720, FOV = 62;
const DEPTH_BITS = 24;                 // WebGLRenderTarget default depth renderbuffer = DEPTH_COMPONENT24 (three 0.165)
const RATIO_MIN = 10, WIN = 30, CF_N = 0.01, CF_F = 1e7, CF_MAX = 0.5;
const MUT = new URLSearchParams(window.location.search).get('mut') ?? '';
const tY = Math.tan((FOV * Math.PI) / 360), tX = tY * (W / H);
type Row = { pass: boolean; detail: string };
type Part = { z: number; depth?: number; halfPx?: number; sphereR?: number; color: number };
// Pinned fixture: three pairs, front (must win) and back, at a screen x (NDC) on the view axis plane.
// WHY: the shipped literals are kept as the cases (probe, boots/ground, Earth vs hill), but each
// is now a real object in the scene, so pass, planes and depth come from what the rig renders.
const PAIRS: Array<{ name: string; ndcX: number; front: Part; back: Part; probe?: boolean }> = [
  { name: 'probe pair 2.5 km gap @233 km', ndcX: -0.5, probe: true,
    front: { z: 233000, halfPx: 64, color: 0xff0000 }, back: { z: 235500, halfPx: 80, color: 0x00ff00 } },
  { name: 'boots/ground 20 mm gap @1.7 m', ndcX: 0,
    front: { z: 1.7, halfPx: 64, color: 0x0000ff }, back: { z: 1.72, halfPx: 80, color: 0xffff00 } },
  { name: 'horizon hill (straddler) vs Earth', ndcX: 0.5,
    front: { z: 2300, depth: 400, halfPx: 64, color: 0xff00ff }, back: { z: 45000, sphereR: 5000, color: 0x00ffff } },
];
const CAMS: Array<[number, THREE.PerspectiveCamera, string, number]> = [   // bit, camera, name, pass order
  [FAR_BIT, rigCamFar, 'Far', 0], [MID_BIT, rigCamMid, 'Mid', 1], [NEAR_BIT, rigCamNear, 'Near', 2],
];

/** Depth step of a 2^bits window-depth buffer at view depth z for planes (n, f). */
const depthStep = (z: number, n: number, f: number): number => (z * z * (f - n)) / (f * n * 2 ** DEPTH_BITS);
const passes = (m: number): string => CAMS.filter((c) => m & c[0]).map((c) => c[2]).join('+') || 'none';
const lastPass = (m: number): number => Math.max(-1, ...CAMS.filter((c) => m & c[0]).map((c) => c[3]));

function makeMesh(p: Part, ndcX: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: p.color });
  let geo: THREE.BufferGeometry, zc: number;
  if (p.sphereR) { geo = new THREE.SphereGeometry(p.sphereR, 48, 24); zc = p.z + p.sphereR; }
  else {
    const half = ((p.halfPx ?? 64) / (W / 2)) * tX * p.z;
    geo = p.depth ? new THREE.BoxGeometry(2 * half, 2 * half, p.depth) : new THREE.PlaneGeometry(2 * half, 2 * half);
    zc = p.z + (p.depth ?? 0) / 2;
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(ndcX * tX * zc, 0, -zc);
  m.updateMatrixWorld(true);
  return m;
}
/** View-depth range of a mesh for the camera at the origin looking down −Z. */
function depthRange(m: THREE.Mesh): [number, number] {
  const b = new THREE.Box3().setFromObject(m);
  return [-b.max.z, -b.min.z];
}
/** Screen rectangle (px) of a mesh's bounding box, camera at the origin looking down −Z. */
function screenRect(m: THREE.Mesh): [number, number, number, number] {
  const b = new THREE.Box3().setFromObject(m);
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
    const px = ((x / -z) / tX * 0.5 + 0.5) * W, py = (0.5 - (y / -z) / tY * 0.5) * H;
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
  }
  return [x0, x1, y0, y1];
}

async function runGate(gl: THREE.WebGLRenderer): Promise<Array<[string, Row]>> {
  const scene = new THREE.Scene();
  for (const [, c] of CAMS) { c.aspect = W / H; c.fov = FOV; c.updateProjectionMatrix(); }
  if (MUT === 'planes') { rigCamMid.near = CF_N; rigCamMid.far = CF_F; rigCamMid.updateProjectionMatrix(); }
  const built = PAIRS.map((p) => {
    const front = makeMesh(p.front, p.ndcX), back = makeMesh(p.back, p.ndcX);
    // WHY: the back object draws AFTER the front one, so a fused depth buffer (LessEqual) shows it.
    front.renderOrder = 0; back.renderOrder = 1;
    for (const m of [front, back]) {
      const [dn, df] = depthRange(m);
      m.layers.mask = MUT === 'assign' && p.probe ? NEAR_BIT : layerMaskFor(dn, df);
      scene.add(m);
    }
    return { p, front, back };
  });

  // ---- R1a: scene-driven depth separation (analytic, from the rig's live planes) ----
  const aParts: string[] = [];
  let aPass = true;
  for (const { p, front, back } of built) {
    const [fn, ff] = depthRange(front), [bn, bf] = depthRange(back);
    const fm = front.layers.mask, bm = back.layers.mask;
    const inside = (m: THREE.Mesh, dn: number, df: number): boolean =>
      CAMS.some(([bit, c]) => (m.layers.mask & bit) !== 0 && c.near <= dn && df <= c.far);
    const fr = screenRect(front), br = screenRect(back);
    const overlap = Math.max(0, Math.min(fr[1], br[1]) - Math.max(fr[0], br[0])) * Math.max(0, Math.min(fr[3], br[3]) - Math.max(fr[2], br[2]));
    const gap = bn - ff;
    let txt = `${p.name}: front ${passes(fm)} [${fn.toFixed(2)}, ${ff.toFixed(2)}] m, back ${passes(bm)} [${bn.toFixed(2)}, ${bf.toFixed(2)}] m`;
    let ok = true;
    if (overlap <= 0) { ok = false; txt += ', n/a: no angular overlap (FAIL)'; }
    if (!inside(front, fn, ff) || !inside(back, bn, bf)) { ok = false; txt += ', an object lies outside the planes of every pass it is assigned to (FAIL)'; }
    const shared = fm & bm;
    let minRatio = Infinity;
    for (const [bit, c, name] of CAMS) {
      if (!(shared & bit)) continue;
      const r = gap / depthStep(bn, c.near, c.far);
      txt += `, ${name} [${c.near}, ${c.far}] gap/δ ${r >= 100 ? Math.round(r).toLocaleString() : r.toFixed(4)}`;
      minRatio = Math.min(minRatio, r);
    }
    if (shared === 0) {
      const order = lastPass(fm) > lastPass(bm);
      txt += `, separate passes (pass order ${order ? 'puts front last' : 'puts BACK last (FAIL)'})`;
      if (!order) ok = false;
    } else if (!(minRatio > RATIO_MIN)) { ok = false; txt += ` < ${RATIO_MIN} (FAIL)`; }
    aParts.push(txt);
    if (!ok) aPass = false;
  }

  // ---- R1b: rendered layering, sub-pixel jitter, determinism, single-camera counterfactual ----
  const rt = new THREE.WebGLRenderTarget(W, H);
  const buf = new Uint8Array(W * H * 4), buf0 = new Uint8Array(W * H * 4);
  const pxRad = (2 * tX) / W;
  const render = (jx: number, jy: number, cf: THREE.PerspectiveCamera | null): void => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(jy * pxRad, jx * pxRad, 0));
    gl.setRenderTarget(rt);
    if (cf) {
      cf.quaternion.copy(q); cf.updateMatrixWorld(true);
      gl.autoClear = false; gl.setClearColor(CLEAR_COLOR, 1); gl.clear(true, true, false);
      gl.render(scene, cf);
    } else {
      RIG.poseOverride = { x: 0, y: 0, z: 0, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
      executePasses(gl, scene);
      RIG.poseOverride = null;
    }
    gl.setRenderTarget(null);
    gl.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  };
  /** Fraction of the window around the front object's centre that shows exactly the front colour. */
  const frontFrac = (i: number): number => {
    const { p, front } = built[i];
    const r = screenRect(front), cx = Math.round((r[0] + r[1]) / 2), cy = Math.round((r[2] + r[3]) / 2);
    const cr = (p.front.color >> 16) & 255, cg = (p.front.color >> 8) & 255, cb = p.front.color & 255;
    let hit = 0, tot = 0;
    for (let y = cy - WIN; y < cy + WIN; y++) for (let x = cx - WIN; x < cx + WIN; x++) {
      const k = ((H - 1 - y) * W + x) * 4;   // readback rows are bottom-up
      tot++;
      if (Math.abs(buf[k] - cr) < 40 && Math.abs(buf[k + 1] - cg) < 40 && Math.abs(buf[k + 2] - cb) < 40) hit++;
    }
    return hit / tot;
  };
  const JIT: Array<[number, number]> = [[0, 0], [0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]];
  const minFrac = PAIRS.map(() => 1);
  for (const [jx, jy] of JIT) {
    render(jx, jy, null);
    if (jx === 0 && jy === 0) buf0.set(buf);
    PAIRS.forEach((_, i) => { minFrac[i] = Math.min(minFrac[i], frontFrac(i)); });
  }
  render(0, 0, null);
  let diff = 0;
  for (let k = 0; k < buf.length; k++) if (buf[k] !== buf0[k]) diff++;
  const cf = new THREE.PerspectiveCamera(FOV, W / H, CF_N, CF_F);
  cf.layers.enableAll();
  render(0, 0, cf);
  const cfFrac = PAIRS.map((_, i) => frontFrac(i));
  const layeredOk = minFrac.every((f) => f === 1);
  const cfFused = cfFrac[0] < CF_MAX;
  const bPass = layeredOk && diff === 0 && cfFused;
  rt.dispose();

  return [
    ['R1a depth separation from scene state', {
      pass: aPass,
      detail: `${aParts.join(' · ')}. Pass from layerMaskFor on the view-depth range, planes read from the rig cameras; every pair must overlap on screen, fit a pass, and keep gap/δ > ${RATIO_MIN} (δ for a ${DEPTH_BITS}-bit buffer) in every shared pass.`,
    }],
    ['R1b rendered layering', {
      pass: bPass,
      detail: `executePasses at ${JIT.length} poses (0 and ±0.25 px yaw/pitch): front-colour share of a ${2 * WIN}×${2 * WIN} px window, worst pose: ${PAIRS.map((p, i) => `${p.name} ${(minFrac[i] * 100).toFixed(2)}%`).join(', ')} (100% required). ` +
        `Determinism: ${diff} differing bytes across two identical renders. ` +
        `Single camera n=${CF_N}, f=${CF_F}, all layers, back drawn last: ${PAIRS.map((p, i) => `${p.name} ${(cfFrac[i] * 100).toFixed(2)}%`).join(', ')}; the probe pair must fuse (< ${CF_MAX * 100}%) ${cfFused ? 'and does' : '— it does NOT, so the pair is not discriminating (FAIL)'}.`,
    }],
  ];
}

export default function M1fR1Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    void (async () => { try {
      const res = await runGate(gl);
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR1Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR1Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
    } catch (e) {
      console.log(`[M1fR1Gate] acceptance FAILED (exception ${String(e)})`);
    } })();
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R1 rebuilt gate (F2fcb, ADR-022){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}