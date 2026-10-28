/**
 * F2fcda — rebuilt m1f R4 (zero-GC) gate, row R4a: boot-object identity (ADR-024). Page `?page=m1fR4`.
 * WHY: the shipped R4 builds a canary object and never compares it (`void canary.cams`); its
 * identity clause is shape-only (instanceMatrix defined, bodies.length = 24, 8 children), so a
 * same-shaped replacement passes (A1-U03-4). R4a snapshots the REAL references of the shipped
 * SkyImpostorPool + MultiCameraRig boot objects, drives the shipped frame path (setBody/update,
 * layerMaskFor, executePasses), and compares every reference with `===`, plus the GPU resource
 * counts. Allocation and retention are separate properties (U27b2 K2a): they are R4b/R4c (F2fcdb),
 * measured by a CDP sampling profiler the spec drives; identity is never offered as proof of zero-GC.
 * Mutants (burn-time, at iteration 1500): `?mut=replace` swaps bodies[5] for a same-shaped clone
 * (the exact A1-U03-4 case); `?mut=realloc` swaps the aDisk attribute's Float32Array for a new one
 * of the same length. Both must turn R4a red while the shipped shape predicate still holds.
 */
import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { IMPOSTOR_CAPACITY, SkyImpostorPool } from '../render/SkyImpostorPool';
import { RIG, executePasses, layerMaskFor, rigCamFar, rigCamMid, rigCamNear } from '../render/MultiCameraRig';

const Q = new URLSearchParams(window.location.search);
const MUT = Q.get('mut') ?? '';
type Row = { pass: boolean; detail: string };
const W = 640, H = 360, FOV = 62, PROBE_R = 1800;
const PURE_N = 3000, RENDER_N = 300, MUT_AT = 1500;
const IDS: string[] = [];
for (let i = 0; i < IMPOSTOR_CAPACITY; i++) IDS.push(`body-${i}`);

function unit(x: number, y: number, z: number): THREE.Vector3 { return new THREE.Vector3(x, y, z).normalize(); }

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

function rowR4a(gl: THREE.WebGLRenderer): Row {
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
  rt.dispose(); probe.geometry.dispose(); (probe.material as THREE.Material).dispose();
  return {
    pass: changed.length === 0 && gpuOk && before.length > 0,
    detail: `${before.length} boot references compared with === after ${PURE_N.toLocaleString()} pure frames ` +
      `(24× setBody + update + layerMaskFor + driver pose) and ${RENDER_N} executePasses renders: ` +
      `${changed.length === 0 ? '0 changed' : `${changed.length} changed [${changed.join(', ')}]`}; ` +
      `GPU geometries ${geo0}→${geo1}, textures ${tex0}→${tex1}, programs ${prog0}→${prog1}; ` +
      `shipped shape predicate ${shippedShape ? 'holds' : 'fails'}.` + (MUT ? ` [mut=${MUT}]` : ''),
  };
}

export default function M1fR4Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    const gl = new THREE.WebGLRenderer({ canvas, antialias: false });
    gl.setPixelRatio(1); gl.setSize(W, H, false);
    try {
      const res: Array<[string, Row]> = [['R4a boot identity', rowR4a(gl)]];
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR4Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR4Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
    } catch (e) {
      console.log(`[M1fR4Gate] acceptance FAILED (exception ${String(e)})`);
    }
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R4 rebuilt gate (F2fcda, ADR-024){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}