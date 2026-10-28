/**
 * F2fccba/F2fccbb — rebuilt m1f R3 (mesh↔impostor handoff) gate (ADR-023). Page `?page=m1fR3`.
 * WHY: the shipped R3 row cannot fail (A1-U03-2: holes/doubles counted with mesh = 1 − imp,
 * meshState ignored). R3a sweeps the SHIPPED controller (`./m1fHandoff`, imported, not copied)
 * under the RENDERED draw rules of Milestone1F_TestHarness `applyRenderState`:
 *   mesh drawn iff meshState && alphaMesh > 0.01; impostor drawn iff alphaImp > 0.01.
 * R3b renders the same states on the GPU (shipped SkyImpostorPool + MultiCameraRig passes) in an
 * isolated scene and measures drawn coverage against a full-opacity mesh reference.
 * It is RED by design until F8a fixes A1-U03-1. The spec pins the known-red vector.
 * Positive control `?ctl=ref` (test-only, not F8a's design): see `drawn`.
 * Mutants `?mut=meshhide` (mesh never drawn) / `?mut=noimp` (impostor never drawn) prove the
 * rows see each representation. R3c (silhouette A/B) is a later unit.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { handoffFade, handoffNextState } from './m1fHandoff';
import { SkyImpostorPool } from '../render/SkyImpostorPool';
import { CLEAR_COLOR, RIG, executePasses, layerMaskFor, rigCamFar, rigCamMid, rigCamNear } from '../render/MultiCameraRig';

const Q = new URLSearchParams(window.location.search);
const CTL = Q.get('ctl') ?? '';
const MUT = Q.get('mut') ?? '';
type Row = { pass: boolean; detail: string };
type Dir = 'down' | 'up';
type V3 = { x: number; y: number; z: number };

/** Rendered-rule drawn state for one sample (harness applyRenderState rules). */
function drawn(d: number, mesh: boolean): { meshVis: boolean; impVis: boolean; am: number; imp: number } {
  const imp = handoffFade(d);
  // WHY (F2fccbb): the reference control is an opaque swap. The shipped impostor fades by shrinking
  // its disk radius (SkyImpostorPool `aDisk.y = tan θ · alpha`), so a cross-fade that keeps alphaMesh
  // = 1 − alphaImp cannot reach full coverage on the GPU; the control keeps the mesh fully opaque
  // until the impostor is at ≥ 0.99. It only proves the rows can go green; F8a designs the fix.
  const am = CTL === 'ref' ? (mesh || imp < 0.99 ? 1 : 0) : 1 - imp;
  let meshVis = (CTL === 'ref' ? (mesh || imp < 0.99) : mesh) && am > 0.01;
  let impVis = imp > 0.01 && !(CTL === 'ref' && meshVis);
  if (MUT === 'meshhide') meshVis = false;
  if (MUT === 'noimp') impVis = false;
  return { meshVis, impVis, am, imp };
}

/** Collects contiguous hole bands per direction (deduplicated across trips). */
class Bands {
  private open: Record<Dir, [number, number] | null> = { down: null, up: null };
  readonly set: Record<Dir, Set<string>> = { down: new Set(), up: new Set() };
  readonly count: Record<Dir, number> = { down: 0, up: 0 };
  hit(dir: Dir, d: number, hole: boolean): void {
    const o = this.open[dir];
    if (hole) {
      this.count[dir]++;
      if (o) { o[0] = Math.min(o[0], d); o[1] = Math.max(o[1], d); } else this.open[dir] = [d, d];
    } else if (o) this.close(dir);
  }
  close(dir: Dir): void {
    const o = this.open[dir];
    if (o) { this.set[dir].add(`[${Math.round(o[0])}, ${Math.round(o[1])}] m`); this.open[dir] = null; }
  }
  text(dir: Dir): string { return this.count[dir] === 0 ? '0 holes' : `${this.count[dir]} holes in ${[...this.set[dir]].join(', ')}`; }
}

function rowR3a(): Row {
  // (1) unit sweep: 20 round trips over [200, 300] km, 1 m steps, state carried across trips.
  // Initial state MESH at 300 km (as the shipped row): the first descending sample corrects it,
  // so a thrash-free controller makes exactly 21 flips (20 threshold crossings + 1).
  const sw = new Bands();
  let mesh = true, flips = 0, doubles = 0, maxDim = 0;
  for (let trip = 0; trip < 20; trip++) {
    const dir: Dir = trip % 2 === 0 ? 'down' : 'up';
    for (let s = 0; s <= 100000; s++) {
      const d = dir === 'down' ? 300000 - s : 200000 + s;
      const next = handoffNextState(d, mesh);
      if (next !== mesh) { flips++; mesh = next; }
      const r = drawn(d, mesh);
      sw.hit(dir, d, !r.meshVis && !r.impVis);
      if (r.meshVis && r.am >= 0.99 && r.impVis && r.imp >= 0.99) doubles++;
      const cov = (r.meshVis ? r.am : 0) + (r.impVis ? r.imp : 0);
      maxDim = Math.max(maxDim, 1 - Math.min(1, cov));
    }
    sw.close(dir);
  }
  // (2) live triangle, frame-stepped at 60 Hz exactly as the harness updateProbes:
  // 320 → 190 → 320 km, 24 s each way, two full periods, meshState carried.
  const lv = new Bands();
  let lmesh = true, lt = 0, prevD = 320000, prevDir: Dir = 'down';
  for (let f = 0; f < 2 * 48 * 60; f++) {
    lt += 1 / 60;
    const ph = (lt % 48) / 24, tri = ph < 1 ? ph : 2 - ph;
    const d = 320000 - tri * 130000;
    const dir: Dir = d <= prevD ? 'down' : 'up';
    if (dir !== prevDir) { lv.close(prevDir); prevDir = dir; }   // a band never spans a turn
    lmesh = handoffNextState(d, lmesh);
    const r = drawn(d, lmesh);
    lv.hit(dir, d, !r.meshVis && !r.impVis);
    prevD = d;
  }
  lv.close('down'); lv.close('up');
  const holes = sw.count.down + sw.count.up, liveHoles = lv.count.down + lv.count.up;
  const pass = holes === 0 && liveHoles === 0 && doubles === 0 && flips === 21 && maxDim <= 0.01;
  return {
    pass,
    detail:
      `sweep (20 round trips, 1 m steps, rendered rules): down: ${sw.text('down')}; up: ${sw.text('up')}; ` +
      `${doubles} doubles; ${flips} flips (need 21); max drawn-coverage dimming ${maxDim.toFixed(3)} (tol 0.010). ` +
      `live 60 Hz triangle (2 periods): down: ${lv.text('down')}; up: ${lv.text('up')}.` +
      (CTL ? ` [ctl=${CTL}]` : '') + (MUT ? ` [mut=${MUT}]` : ''),
  };
}

/* -- R3b: isolated GPU coverage (ADR-023) ----------------------------------------------------- */
// Probe geometry pinned from the M1F harness literals (not imported: the harness has boot-time
// side effects). WHY: the gate must render the same object the harness hands off.
const W = 1280, H = 720, FOV = 62, PROBE_R = 1800, WIN = 24;
const R3B_KM = [205, 222, 224, 228, 232, 238, 245, 290];
const COV_TOL = 0.25, AREA_TOL = 0.25;
const unit = (x: number, y: number, z: number): V3 => { const l = Math.hypot(x, y, z); return { x: x / l, y: y / l, z: z / l }; };
const DIR = unit(0.15, 0.25, -0.95);          // probe direction from the camera (render-local origin)
const SUN = unit(0.15, -0.05, 0.95);          // lights the camera-facing hemisphere (dot ≈ 0.89)
const BG = new THREE.Color(CLEAR_COLOR);
const BG_SUM = Math.round(BG.r * 255) + Math.round(BG.g * 255) + Math.round(BG.b * 255);

/** The harness probe material (makeProbeMaterial), copied verbatim as a fixture. */
function probeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(SUN.x, SUN.y, SUN.z) },
      uColor: { value: new THREE.Color(0xc96f4a) },
      uOpacity: { value: 1 },
    },
    transparent: true,
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uSun; uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec3 n = normalize(vN);
        float lam = clamp(dot(n, uSun), 0.0, 1.0);
        float limb = pow(clamp(dot(n, normalize(vV)), 0.0, 1.0), 0.4);
        vec3 col = uColor * (0.05 + 0.95 * lam * limb);
        gl_FragColor = vec4(pow(col, vec3(0.4545)), uOpacity);
      }`,
  });
}

/** v rotated by conj(q), f64 (camera-space direction). */
function rotConj(q: THREE.Quaternion, v: V3): V3 {
  const ux = -q.x, uy = -q.y, uz = -q.z, w = q.w;
  const tx = 2 * (uy * v.z - uz * v.y), ty = 2 * (uz * v.x - ux * v.z), tz = 2 * (ux * v.y - uy * v.x);
  return { x: v.x + w * tx + (uy * tz - uz * ty), y: v.y + w * ty + (uz * tx - ux * tz), z: v.z + w * tz + (ux * ty - uy * tx) };
}

/** Ideal projected disk radius (px) of the probe at distance d, on the pinned camera. */
const idealR = (d: number): number => Math.tan(Math.asin(PROBE_R / d)) / Math.tan((FOV * Math.PI) / 360) * (H / 2);

/** Rendered draw state at each R3b sample, reached by walking the sweep from the far end. */
function sampleStates(): Record<Dir, Array<{ km: number; mesh: boolean }>> {
  const out: Record<Dir, Array<{ km: number; mesh: boolean }>> = { down: [], up: [] };
  let mesh = true;
  for (let d = 300000; d >= 200000; d--) {
    mesh = handoffNextState(d, mesh);
    if (d % 1000 === 0 && R3B_KM.includes(d / 1000)) out.down.push({ km: d / 1000, mesh });
  }
  for (let d = 200000; d <= 300000; d++) {
    mesh = handoffNextState(d, mesh);
    if (d % 1000 === 0 && R3B_KM.includes(d / 1000)) out.up.push({ km: d / 1000, mesh });
  }
  return out;
}

async function rowR3b(gl: THREE.WebGLRenderer): Promise<Row> {
  const scene = new THREE.Scene();
  const sky = new SkyImpostorPool(0);
  const mat = probeMaterial();
  const probe = new THREE.Mesh(new THREE.SphereGeometry(PROBE_R, 96, 64), mat);
  probe.frustumCulled = false;
  scene.add(sky.mesh, probe);
  for (const c of [rigCamNear, rigCamMid, rigCamFar]) { c.aspect = W / H; c.fov = FOV; c.updateProjectionMatrix(); }
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3(DIR.x, DIR.y, DIR.z), new THREE.Vector3(0, 1, 0)));
  const sc = rotConj(q, SUN);
  const rt = new THREE.WebGLRenderTarget(W, H);
  const buf = new Uint8Array(W * H * 4);

  const render = (d: number, meshVis: boolean, am: number, impVis: boolean, imp: number): { lum: number; area: number } => {
    probe.position.set(DIR.x * d, DIR.y * d, DIR.z * d);
    probe.visible = meshVis;
    mat.uniforms.uOpacity.value = am;
    mat.depthWrite = am > 0.95;                                  // harness rule
    probe.layers.mask = meshVis ? layerMaskFor(d - PROBE_R, d + PROBE_R) : 0;
    sky.setBody(0, 'probe-a', 3, DIR.x, DIR.y, DIR.z, Math.asin(Math.min(1, PROBE_R / d)), d,
      0.79, 0.44, 0.29, imp, impVis);
    sky.update(0, 0, 0, q.x, q.y, q.z, q.w, sc.x, sc.y, sc.z);
    RIG.poseOverride = { x: 0, y: 0, z: 0, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
    gl.setRenderTarget(rt); executePasses(gl, scene); gl.setRenderTarget(null);
    RIG.poseOverride = null;
    gl.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    let lum = 0, area = 0;
    for (let y = H / 2 - WIN; y < H / 2 + WIN; y++) for (let x = W / 2 - WIN; x < W / 2 + WIN; x++) {
      const i = (y * W + x) * 4;
      lum += Math.max(0, buf[i] + buf[i + 1] + buf[i + 2] - BG_SUM);
      if (buf[i] > 8) area++;                                     // harness silhouette threshold
    }
    return { lum, area };
  };

  const states = sampleStates();
  const refs = new Map<number, { lum: number; area: number }>();
  const parts: string[] = [];
  const failed: Record<Dir, number[]> = { down: [], up: [] };
  let refNote = '', lumRatio = 0;
  for (const km of R3B_KM) {
    const ref = render(km * 1000, true, 1, false, 0);   // full-opacity mesh only
    refs.set(km, ref);
    const ideal = Math.PI * idealR(km * 1000) ** 2;
    refNote += ` ${km}:${ref.area}/${ideal.toFixed(1)}`;
  }
  for (const dir of ['down', 'up'] as Dir[]) {
    const cells: string[] = [];
    for (const s of states[dir]) {
      const d = s.km * 1000, r = drawn(d, s.mesh), ref = refs.get(s.km)!;
      const ideal = Math.PI * idealR(d) ** 2;
      const na = ref.lum <= 0 || Math.abs(ref.area / ideal - 1) > AREA_TOL;
      const got = render(d, r.meshVis, r.am, r.impVis, r.imp);
      // WHY (F2fccbb, ADR-023 amendment): coverage = drawn AREA ÷ reference area. Luminance is not a
      // coverage measure here: at full opacity the shipped impostor is ~2.5× brighter than the mesh
      // (finding F2fccbb-1), so a luminance ratio reports a shading defect as "coverage". The shading
      // mismatch is gated separately (R3c); the luminance ratio is still printed as a diagnostic.
      const cov = ref.area > 0 ? got.area / ref.area : 0;
      if (got.area > 0) lumRatio = Math.max(lumRatio, ref.lum > 0 ? got.lum / ref.lum : 0);
      const ok = !na && Math.abs(cov - 1) <= COV_TOL;
      if (!ok) failed[dir].push(s.km);
      cells.push(`${s.km}:${na ? 'n/a' : cov.toFixed(3)}${ok ? '' : '!'}`);
    }
    parts.push(`${dir} ${cells.join(' ')}`);
  }
  rt.dispose(); probe.geometry.dispose(); mat.dispose();
  const pass = failed.down.length === 0 && failed.up.length === 0;
  return {
    pass,
    detail:
      `drawn area vs full-opacity mesh reference area (tol 1 ± ${COV_TOL}, n/a = FAIL): ${parts.join('; ')}. ` +
      `fails: down [${failed.down.join(', ')}] km; up [${failed.up.join(', ')}] km. ` +
      `reference area px/ideal π·r² (tol ±${AREA_TOL * 100}%):${refNote}. diagnostic max luminance ratio drawn/mesh-ref ${lumRatio.toFixed(3)}.` +
      (CTL ? ` [ctl=${CTL}]` : '') + (MUT ? ` [mut=${MUT}]` : ''),
  };
}

export default function M1fR3Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    void (async () => { try {
      const res: Array<[string, Row]> = [['R3a state-coupled sweep', rowR3a()], ['R3b rendered coverage', await rowR3b(gl)]];
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR3Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      const tag = [CTL ? `ctl=${CTL}` : '', MUT ? `mut=${MUT}` : ''].filter(Boolean).join(', ');
      console.log(`[M1fR3Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${tag ? ` (${tag})` : ''}`);
    } catch (e) {
      console.log(`[M1fR3Gate] acceptance FAILED (exception ${String(e)})`);
    } })();
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R3 rebuilt gate (F2fccb, ADR-023){CTL ? ` — control ${CTL}` : ''}{MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}