/**
 * F2fcda/F2fcdb — rebuilt m1f R4 (zero-GC) gate (ADR-024). Page `?page=m1fR4`.
 * WHY: the shipped R4 builds a canary object and never compares it (`void canary.cams`); its
 * identity clause is shape-only (instanceMatrix defined, bodies.length = 24, 8 children), so a
 * same-shaped replacement passes (A1-U03-4). R4a snapshots the REAL references of the shipped
 * SkyImpostorPool + MultiCameraRig boot objects, drives the shipped frame path (setBody/update,
 * layerMaskFor, executePasses), and compares every reference with `===`, plus the GPU resource
 * counts. Allocation and retention are separate properties (U27b2 K2a): R4b/R4c (F2fcdb) are
 * measured by a CDP sampling profiler that the spec/self-test drives (`tools/r4-cdp-driver.mjs`)
 * around the burn this page exposes as `window.__r4`; the page owns the budgets and verdicts.
 * A driver that never posts is a FAIL ("instrument missing"), never N/A.
 * Mutants: `?mut=replace` / `?mut=realloc` (R4a, at iteration 1500); `?mut=churn` (4 escaping
 * {x,y,z} per burn frame: R4b red, R4c green); `?mut=leak` (one retained {a,b} per burn frame: R4c red).
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { IMPOSTOR_CAPACITY, SkyImpostorPool } from '../render/SkyImpostorPool';
import { RIG, executePasses, layerMaskFor, rigCamFar, rigCamMid, rigCamNear } from '../render/MultiCameraRig';

const Q = new URLSearchParams(window.location.search);
const MUT = Q.get('mut') ?? '';
// WHY: the fail-safe wait for the CDP driver; `?wait=` shortens it only for the self-test's no-driver case.
const DRIVER_WAIT_MS = Number(Q.get('wait') ?? '150000');
type Row = { pass: boolean; detail: string };
const W = 640, H = 360, FOV = 62, PROBE_R = 1800;
const PURE_N = 3000, RENDER_N = 300, MUT_AT = 1500;
// Budgets (ADR-024): same per-frame budgets as the node allocation gate (tools/alloc-lib.mjs, ADR-002/003).
const ALLOC_BUDGET_B = 64, RETAIN_BUDGET_B = 8, RETAIN_CAL_MIN_B = 12;
// WHY: in Chrome a 128-byte Float64Array backing store lives off the V8 heap, so the sampler sees
// only the JSTypedArray + JSArrayBuffer headers (~113 B/iter, F2fcdb run 1), not node's ≥ 128.
// The control only has to prove typed-array allocation is visible: ≥ 64 B/iter (ADR-024 amendment).
const CAL_F64_MIN_B = 64;
const IDS: string[] = [];
for (let i = 0; i < IMPOSTOR_CAPACITY; i++) IDS.push(`body-${i}`);

function unit(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).normalize(); }

type Fixture = { scene: THREE.Scene; sky: SkyImpostorPool; probe: THREE.Mesh; rt: THREE.WebGLRenderTarget; frame: (d: number) => void };

function makeFixture(): Fixture {
  const scene = new THREE.Scene();
  const sky = new SkyImpostorPool();
  const probe = new THREE.Mesh(new THREE.SphereGeometry(PROBE_R, 96, 64), new THREE.MeshBasicMaterial({ color: 0xc96f4a }));
  probe.frustumCulled = false;
  scene.add(sky.mesh, sky.stars, probe);
  for (const c of [rigCamNear, rigCamMid, rigCamFar]) { c.aspect = W / H; c.fov = FOV; c.updateProjectionMatrix(); }
  const dir = unit(0.3, 0.2, -1);
  const q = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), dir, new THREE.Vector3(0, 1, 0)));
  const dirs: THREE.Vector3[] = [];
  for (let k = 0; k < IMPOSTOR_CAPACITY; k++) dirs.push(unit(dir.x + 0.6 * Math.cos(k), dir.y + 0.4 * Math.sin(0.7 * k), dir.z));
  const rt = new THREE.WebGLRenderTarget(W, H);
  const frame = (d: number): void => {
    for (let k = 0; k < IMPOSTOR_CAPACITY; k++) {
      const dk = d + 5000 * k, v = dirs[k];
      sky.setBody(k, IDS[k], k === 0 ? 0 : 3, v.x, v.y, v.z, Math.asin(Math.min(1, PROBE_R / dk)), dk, 0.79, 0.44, 0.29, 1, true);
    }
    probe.position.set(dir.x * d, dir.y * d, dir.z * d);
    probe.layers.mask = layerMaskFor(d - PROBE_R, d + PROBE_R);
    sky.update(0, 0, 0, q.x, q.y, q.z, q.w, 0, 0, -1);
    RIG.driver.x = 0; RIG.driver.y = 0; RIG.driver.z = 0;
    RIG.driver.qx = q.x; RIG.driver.qy = q.y; RIG.driver.qz = q.z; RIG.driver.qw = q.w;
  };
  return { scene, sky, probe, rt, frame };
}

/** Every boot reference the shipped R4 canary named (pool mesh/attributes/bodies, cameras, scene meshes) and more. */
function collect(sky: SkyImpostorPool, scene: THREE.Scene, probe: THREE.Mesh): Array<[string, unknown]> {
  const out: Array<[string, unknown]> = [];
  const priv = sky as unknown as Record<string, unknown>;
  out.push(['sky.mesh', sky.mesh], ['sky.mesh.geometry', sky.mesh.geometry], ['sky.material', sky.material],
    ['sky.mesh.material', sky.mesh.material], ['sky.material.uniforms', sky.material.uniforms],
    ['uSunCam.value', sky.material.uniforms.uSunCam.value],
    ['instanceMatrix', sky.mesh.instanceMatrix], ['instanceMatrix.array', sky.mesh.instanceMatrix.array],
    ['sky.bodies', sky.bodies]);
  for (const a of ['aColor', 'aDisk', 'aKind']) {
    const at = sky.mesh.geometry.getAttribute(a) as THREE.BufferAttribute;
    out.push([`attr ${a}`, at], [`attr ${a}.array`, at.array]);
  }
  for (let i = 0; i < sky.bodies.length; i++) out.push([`bodies[${i}]`, sky.bodies[i]]);
  for (const k of ['_m', '_p', '_s', '_q', '_order']) out.push([`scratch ${k}`, priv[k]]);
  const sg = sky.stars.geometry;
  out.push(['sky.stars', sky.stars], ['stars.geometry', sg], ['stars.material', sky.stars.material]);
  for (const a of Object.keys(sg.attributes)) out.push([`stars ${a}`, sg.attributes[a]], [`stars ${a}.array`, (sg.attributes[a] as THREE.BufferAttribute).array]);
  for (const [n, c] of [['near', rigCamNear], ['mid', rigCamMid], ['far', rigCamFar]] as const) {
    out.push([`cam ${n}`, c], [`cam ${n}.projectionMatrix`, c.projectionMatrix], [`cam ${n}.matrixWorld`, c.matrixWorld],
      [`cam ${n}.quaternion`, c.quaternion], [`cam ${n}.position`, c.position]);
  }
  out.push(['RIG.driver', RIG.driver], ['RIG.stats', RIG.stats], ['probe', probe], ['probe.geometry', probe.geometry],
    ['probe.material', probe.material], ['scene.children', scene.children]);
  scene.children.forEach((c, i) => out.push([`scene.children[${i}]`, c]));
  return out;
}

function rowR4a(gl: THREE.WebGLRenderer, fx: Fixture): Row {
  const { scene, sky, probe, rt, frame } = fx;
  // Warm-up frame so lazily created GPU programs/buffers exist before the snapshot.
  frame(300000); gl.setRenderTarget(rt); executePasses(gl, scene); gl.setRenderTarget(null);
  const before = collect(sky, scene, probe);
  const geo0 = gl.info.memory.geometries, tex0 = gl.info.memory.textures, prog0 = gl.info.programs?.length ?? -1;
  for (let i = 0; i < PURE_N; i++) {
    if (i === MUT_AT && MUT === 'replace') sky.bodies[5] = { ...sky.bodies[5] };
    if (i === MUT_AT && MUT === 'realloc') {
      const at = sky.mesh.geometry.getAttribute('aDisk') as THREE.BufferAttribute;
      at.array = new Float32Array(at.array.length); at.needsUpdate = true;
    }
    frame(300000 - (i % 400) * 250);
  }
  gl.setRenderTarget(rt);
  for (let i = 0; i < RENDER_N; i++) { frame(300000 - (i % 400) * 250); executePasses(gl, scene); }
  gl.setRenderTarget(null);
  const after = collect(sky, scene, probe);
  const geo1 = gl.info.memory.geometries, tex1 = gl.info.memory.textures, prog1 = gl.info.programs?.length ?? -1;
  const changed: string[] = [];
  if (after.length !== before.length) changed.push(`ref count ${before.length}→${after.length}`);
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    if (before[i][0] !== after[i][0] || before[i][1] !== after[i][1]) changed.push(before[i][0]);
    if (before[i][1] === undefined || before[i][1] === null) changed.push(`${before[i][0]} missing`);
  }
  const gpuOk = geo0 === geo1 && tex0 === tex1 && prog0 === prog1;
  // Counterfactual: the shipped R4 shape predicate (minus the harness-only astronaut child count).
  const shippedShape = sky.mesh.instanceMatrix !== undefined && sky.bodies.length === IMPOSTOR_CAPACITY;
  return {
    pass: changed.length === 0 && gpuOk && before.length > 0,
    detail: `${before.length} boot references compared with === after ${PURE_N.toLocaleString()} pure frames ` +
      `(24× setBody + update + layerMaskFor + driver pose) and ${RENDER_N} executePasses renders: ` +
      `${changed.length === 0 ? '0 changed' : `${changed.length} changed [${changed.join(', ')}]`}; ` +
      `GPU geometries ${geo0}→${geo1}, textures ${tex0}→${tex1}, programs ${prog0}→${prog1}; ` +
      `shipped shape predicate ${shippedShape ? 'holds' : 'fails'}.` + (MUT ? ` [mut=${MUT}]` : ''),
  };
}

// ---- R4b / R4c: the burn the CDP driver samples around -------------------------------------
// WHY: the mutant objects escape into module-level holders so V8 cannot elide them (escape analysis).
const churnRing: unknown[] = new Array(8);
const leakBox: unknown[] = [];
const calRing: unknown[] = new Array(16);
const calBox: unknown[] = [];
// WHY: the first build dropped every `leakBox.push`/`calBox.push` (a write-only module array is
// dead to the minifier), so the leak mutant and the retention control measured 0. Publishing the
// holders on `window` makes them observable, so the bundle must keep the writes (F2fcdb run 1).
(window as unknown as Record<string, unknown>).__r4hold = { churnRing, leakBox, calRing, calBox };
let burnI = 0;

function burn(gl: THREE.WebGLRenderer, fx: Fixture, n: number, render: boolean): number {
  if (render) gl.setRenderTarget(fx.rt);
  for (let i = 0; i < n; i++) {
    const j = burnI++;
    fx.frame(300000 - (j % 400) * 250);
    if (render) executePasses(gl, fx.scene);
    if (MUT === 'churn') for (let k = 0; k < 4; k++) churnRing[k] = { x: k, y: j & 1023, z: k };
    if (MUT === 'leak') leakBox.push({ a: j & 1023, b: 0 });
  }
  if (render) gl.setRenderTarget(null);
  return n;
}

/** Instrument calibration controls with known allocation rates (same as tools/alloc-lib.mjs). */
function cal(kind: string, n: number): number {
  let s = 0;
  if (kind === 'noop') for (let i = 0; i < n; i++) s += Math.sqrt(i);
  if (kind === 'obj3') for (let i = 0; i < n; i++) calRing[i & 15] = { calX: i & 1023, calY: i & 1023, calZ: i & 1023 };
  if (kind === 'f64x16') for (let i = 0; i < n; i++) calRing[i & 15] = new Float64Array(16);
  if (kind === 'leak') for (let i = 0; i < n; i++) calBox.push({ a: i & 1023, b: 0 });
  if (kind === 'leakclear') calBox.length = 0;
  return s > -1 ? n : 0;
}

/** What the driver posts. Every number is bytes per frame (or per control iteration). */
type Measure = {
  cal: { noop: number; obj3: number; f64x16: number };
  allocPure: number; allocRender: number; pureN: number; renderN: number; top: string[];
  retCal: number; retPure: number[]; retRender: number[]; retPureN: number; retRenderN: number;
};

const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const med = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const f1 = (x: number): string => x.toFixed(1);

function rowR4b(m: Measure | null): Row {
  if (m === null) return { pass: false, detail: 'instrument missing: no CDP sampling profile was posted by the driver (FAIL, not N/A).' + (MUT ? ` [mut=${MUT}]` : '') };
  const c = m.cal;
  const calOk = fin(c.noop) && fin(c.obj3) && fin(c.f64x16) && c.noop < 0.5 && c.obj3 >= 16 && c.obj3 <= 64 && c.f64x16 >= CAL_F64_MIN_B;
  const valsOk = fin(m.allocPure) && fin(m.allocRender) && m.allocPure >= 0 && m.allocRender >= 0;
  // WHY: per-clause fail list so a mutant is told apart from the measured render-path finding
  // (F2fcdb-1) by its fail reasons, the same pattern as the R3 rows (ADR-023).
  const fails: string[] = [];
  if (!calOk) fails.push('calibration');
  if (!valsOk) fails.push('reading');
  if (!(m.allocPure <= ALLOC_BUDGET_B)) fails.push('pure');
  if (!(m.allocRender <= ALLOC_BUDGET_B)) fails.push('render');
  const topR = m.top.filter((s) => s.startsWith('render')).slice(0, 3);
  const topP = m.top.filter((s) => s.startsWith('pure')).slice(0, 3);
  return {
    pass: fails.length === 0,
    detail: `calibration noop ${c.noop?.toFixed(2)} / obj3 ${f1(c.obj3)} / f64x16 ${f1(c.f64x16)} B/iter (${calOk ? 'ok' : 'BROKEN'}); ` +
      `sampled allocation incl. minor+major-GC-collected: pure ${f1(m.allocPure)} B/frame over ${m.pureN}, ` +
      `render ${f1(m.allocRender)} B/frame over ${m.renderN} (budget ${ALLOC_BUDGET_B}); ` +
      `fails: [${fails.join(', ')}]; top: ${[...topP, ...topR].join(' | ') || '—'}.` + (MUT ? ` [mut=${MUT}]` : ''),
  };
}

function rowR4c(m: Measure | null): Row {
  if (m === null) return { pass: false, detail: 'instrument missing: no GC-bracketed heap trend was posted by the driver (FAIL, not N/A).' + (MUT ? ` [mut=${MUT}]` : '') };
  const calOk = fin(m.retCal) && m.retCal >= RETAIN_CAL_MIN_B;
  const ok = (a: number[]): boolean => Array.isArray(a) && a.length >= 3 && a.every(fin);
  const valsOk = ok(m.retPure) && ok(m.retRender);
  const p = valsOk ? med(m.retPure) : NaN, r = valsOk ? med(m.retRender) : NaN;
  // WHY: a GC-bracketed delta may be slightly negative from noise; a large negative reading means the
  // instrument is broken, so it fails like a leak (the shipped R4 passed on any delta < 0, A1-U03-4).
  const within = (x: number): boolean => Math.abs(x) <= RETAIN_BUDGET_B;
  const pass = calOk && valsOk && within(p) && within(r);
  return {
    pass,
    detail: `retention calibration (retained {a,b} control) ${f1(m.retCal)} B/iter (${calOk ? 'ok' : 'BROKEN'}, ≥ ${RETAIN_CAL_MIN_B}); ` +
      `GC-bracketed heap trend: pure median ${f1(p)} B/frame [${(m.retPure ?? []).map(f1).join(', ')}] over ${m.retPureN}, ` +
      `render median ${f1(r)} B/frame [${(m.retRender ?? []).map(f1).join(', ')}] over ${m.retRenderN} (budget |x| ≤ ${RETAIN_BUDGET_B}).` +
      (MUT ? ` [mut=${MUT}]` : ''),
  };
}

const PENDING: Row = { pass: false, detail: 'waiting for the CDP driver…' };

export default function M1fR4Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    const w = window as unknown as Record<string, unknown>;
    let fx: Fixture | null = null;
    try {
      fx = makeFixture();
      const r4a = rowR4a(gl, fx);
      console.log(`[M1fR4Gate] R4a boot identity: ${r4a.pass ? 'PASS' : 'FAIL'} — ${r4a.detail}`);
      setRows([['R4a boot identity', r4a], ['R4b allocation', PENDING], ['R4c retention', PENDING]]);
      let done = false;
      const finalize = (m: Measure | null): void => {
        if (done) return;
        done = true;
        const res: Array<[string, Row]> = [['R4a boot identity', r4a], ['R4b allocation', rowR4b(m)], ['R4c retention', rowR4c(m)]];
        setRows(res);
        for (const [k, r] of res.slice(1)) console.log(`[M1fR4Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
        console.log(`[M1fR4Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
        if (fx) { fx.rt.dispose(); fx.probe.geometry.dispose(); (fx.probe.material as THREE.Material).dispose(); }
      };
      const f = fx;
      w.__r4 = {
        ready: true,
        burn: (n: number, render: boolean) => burn(gl, f, n, render),
        cal: (kind: string, n: number) => cal(kind, n),
        post: (m: Measure) => finalize(m),
      };
      setTimeout(() => finalize(null), DRIVER_WAIT_MS);
    } catch (e) {
      console.log(`[M1fR4Gate] acceptance FAILED (exception ${String(e)})`);
    }
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R4 rebuilt gate (F2fcda/F2fcdb, ADR-024){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r === PENDING ? 'WAIT' : r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}