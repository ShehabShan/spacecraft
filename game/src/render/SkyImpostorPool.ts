/**
 * ============================================================================
 *  SKY IMPOSTOR POOL — FIXED-SIZE INSTANCED BACKGROUND LAYER
 *  Milestone 1F · Spec 04.3 discipline (boot allocation, in-place writes)
 * ============================================================================
 *  One InstancedMesh (capacity 24) + a 1,400-star Points cloud + the Sun
 *  glow quad factory — ALL allocated at boot. Per frame the pool writes
 *  instance matrices and instanced attributes IN PLACE from Float64 inputs
 *  (direction, θ, staged distance) using module-level scratch objects.
 *  Zero allocation in update(); zero new THREE.Vector3/Matrix4 anywhere in
 *  the frame path (acceptance-instrumented).
 *
 *  SHADING: camera-space Lambert phase (per-instance sphere normal
 *  reconstructed from the disk UV), limb darkening, thin rim; the sun is
 *  emissive; gas giants get latitudinal bands; kind 3 (handoff demo probe)
 *  shares its shading model EXACTLY with the probe's 3D mesh material so
 *  the mesh↔impostor swap is shading-continuous as well as silhouette-exact.
 *
 *  DEPTH: instances are staggered stagedDistanceForRank(rank) with ≥45 m
 *  gaps against ~1 cm of Background depth resolution; rank order = true
 *  distance (farthest staged deepest). Stars sit at 9,700 m behind all
 *  impostors, depthWrite off, drawn first.
 */


import * as THREE from 'three';
import {
  BG_STAGE_D_MAX, quadHalfSize, stagedDistanceForRank, thetaEdge,
} from '../core/render/impostorMath';


export const IMPOSTOR_CAPACITY = 24;
/** Shared input slots for SkyImpostorPool.updateIo: [drvX, drvY, drvZ, qx, qy, qz, qw,
 *  sunCamX, sunCamY, sunCamZ]. Boot-made; callers fill it, then call updateIo. */
export const SKY_UPDATE_IO = new Float64Array(10);


/* -- shared GLSL (the probe mesh reuses FRAG_BODY verbatim) --------------- */


const IMPOSTOR_VERT = /* glsl */`
attribute vec3 aColor;
attribute vec2 aDisk;    // x: tan(thetaEdge), y: tan(thetaDisk)
attribute float aKind;   // 0 planet · 1 sun · 2 gas giant · 3 probe/demo
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vDisk;
varying float vKind;
void main() {
  vUv = uv * 2.0 - 1.0;
  vColor = aColor; vDisk = aDisk; vKind = aKind;
  #ifdef USE_INSTANCING
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  #else
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #endif
}`;


/** Shared shading body — the probe mesh material emits the identical model. */
export const IMPOSTOR_FRAG_BODY = /* glsl */`
  vec3 shadeDisk(vec2 uvPlane, vec2 disk, vec3 baseColor, float kind, vec3 sunCam) {
    float r = length(uvPlane) * disk.x;             // tan(angular offset)
    float aa = fwidth(r);
    float cov = clamp((disk.y - r) / aa + 0.5, 0.0, 1.0);
    if (cov <= 0.001) discard;
    vec3 n = normalize(vec3(uvPlane.x * disk.x, uvPlane.y * disk.x, 1.0));
    float lam = clamp(dot(n, normalize(sunCam)), 0.0, 1.0);
    float limb = pow(clamp(n.z, 0.0, 1.0), 0.4);
    vec3 col;
    if (kind < 0.5) {
      col = baseColor * (0.03 + 0.97 * lam * limb);
      col += baseColor * 0.30 * pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0) * (0.2 + 0.8 * lam);
    } else if (kind < 1.5) {
      col = baseColor * (0.80 + 0.20 * limb);
    } else if (kind < 2.5) {
      float band = 0.82 + 0.18 * sin(n.y * 11.0 + 0.7 * sin(n.y * 23.0 + 1.3));
      col = baseColor * band * (0.03 + 0.97 * lam * limb);
    } else {
      col = baseColor * (0.05 + 0.95 * lam * limb);   // probe: matches mesh shader
    }
    gl_FragColor = vec4(pow(col, vec3(0.4545)), cov);
    return vec3(0.0);
  }`;


const IMPOSTOR_FRAG = /* glsl */`
precision highp float;
uniform vec3 uSunCam;
varying vec2 vUv;
varying vec3 vColor;
varying vec2 vDisk;
varying float vKind;
${IMPOSTOR_FRAG_BODY}
void main() { shadeDisk(vUv, vDisk, vColor, vKind, uSunCam); }`;


/* -- body slots (boot-allocated; mutated in place) ------------------------- */


export interface ImpostorBody {
  id: string;
  active: boolean;
  /** True unit direction (f64) — refreshed by the owner each frame. */
  dirX: number; dirY: number; dirZ: number;
  /** True angular radius (f64). */
  theta: number;
  /** True distance (f64) — drives occlusion rank. */
  trueDist: number;
  colorR: number; colorG: number; colorB: number;
  kind: number;
  /** Fade alpha from the handoff controller (0..1). */
  alpha: number;
  /** Staging results (f64, written by update — read by tests/telemetry). */
  stageD: number;
  halfSize: number;
  stagedPX: number; stagedPY: number; stagedPZ: number;
}


function makeBody(i: number): ImpostorBody {
  return {
    id: `slot-${i}`, active: false,
    dirX: 1, dirY: 0, dirZ: 0, theta: 0, trueDist: Infinity,
    colorR: 1, colorG: 1, colorB: 1, kind: 0, alpha: 1,
    stageD: BG_STAGE_D_MAX, halfSize: 0,
    stagedPX: 0, stagedPY: 0, stagedPZ: 0,
  };
}


export class SkyImpostorPool {
  readonly mesh: THREE.InstancedMesh;
  readonly bodies: ImpostorBody[] = [];
  readonly stars: THREE.Points;
  readonly material: THREE.ShaderMaterial;


  /** Scratch — boot-allocated; the ONLY Vector3/Matrix4/Quaternion the
   *  frame path ever touches, and never re-allocated (canary-proven). */
  private readonly _m = new THREE.Matrix4();
  private readonly _p = new THREE.Vector3();
  private readonly _s = new THREE.Vector3();
  private readonly _q = new THREE.Quaternion();
  private readonly _order: number[] = [];


  constructor(starCount = 1400, starRadius = 9700) {
    for (let i = 0; i < IMPOSTOR_CAPACITY; i++) this.bodies.push(makeBody(i));


    const geometry = new THREE.PlaneGeometry(2, 2);
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(IMPOSTOR_CAPACITY * 3), 3);
    const aDisk = new THREE.InstancedBufferAttribute(new Float32Array(IMPOSTOR_CAPACITY * 2), 2);
    const aKind = new THREE.InstancedBufferAttribute(new Float32Array(IMPOSTOR_CAPACITY), 1);
    aColor.setUsage(THREE.DynamicDrawUsage);
    aDisk.setUsage(THREE.DynamicDrawUsage);
    aKind.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aColor', aColor);
    geometry.setAttribute('aDisk', aDisk);
    geometry.setAttribute('aKind', aKind);


    this.material = new THREE.ShaderMaterial({
      vertexShader: IMPOSTOR_VERT,
      fragmentShader: IMPOSTOR_FRAG,
      uniforms: { uSunCam: { value: new THREE.Vector3(0, 0, 1) } },
      transparent: false,
      alphaToCoverage: true,   // exact MSAA limb; no-op (deterministic) on the A/B target
      depthWrite: true,
    });
    this.mesh = new THREE.InstancedMesh(geometry, this.material, IMPOSTOR_CAPACITY);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;          // instances span the whole sky
    this.mesh.layers.mask = 4;                // FAR / Background layer only
    this.mesh.count = 0;
    this.mesh.renderOrder = 0;


    this.stars = SkyImpostorPool.buildStars(starCount, starRadius);
  }


  private static buildStars(count: number, radius: number): THREE.Points {
    // Deterministic PRNG (module-local copy of the seeded mulberry32 pattern).
    let a = 0x51f15e3d >>> 0;
    const rand = (): number => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = rand() * 2 - 1;
      const th = rand() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      pos[i * 3] = Math.cos(th) * s * radius;
      pos[i * 3 + 1] = u * radius;
      pos[i * 3 + 2] = Math.sin(th) * s * radius;
      const b = 0.45 + 0.55 * rand() * rand();
      col[i * 3] = b * (0.85 + 0.15 * rand());
      col[i * 3 + 1] = b * 0.92;
      col[i * 3 + 2] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 1.8, sizeAttenuation: false, vertexColors: true,
      transparent: true, opacity: 0.9, depthWrite: false, fog: false,
    }));
    points.frustumCulled = false;
    points.layers.mask = 4;      // Background only
    points.renderOrder = -10;    // drawn first within the pass
    return points;
  }


  /** Configure a slot (owner code; f64 inputs). */
  setBody(
    i: number, id: string, kind: number,
    dirX: number, dirY: number, dirZ: number,
    theta: number, trueDist: number,
    r: number, g: number, b: number, alpha: number, active: boolean,
  ): void {
    const s = this.bodies[i];
    s.id = id; s.kind = kind;
    s.dirX = dirX; s.dirY = dirY; s.dirZ = dirZ;
    s.theta = theta; s.trueDist = trueDist;
    s.colorR = r; s.colorG = g; s.colorB = b;
    s.alpha = alpha; s.active = active;
  }


  /**
   * THE frame update: rank by true distance (insertion sort on a boot array
   * — zero allocation), stage, compose matrices, write attributes in place.
   * All inputs are numbers; positions computed in f64, narrowed once at the
   * typed-array/matrix writes. Driver pose = the M1A f32 locals (already
   * lattice-exact); camera quaternion and sun direction in camera space f64.
   */
  update(
    drvX: number, drvY: number, drvZ: number,
    qx: number, qy: number, qz: number, qw: number,
    sunCamX: number, sunCamY: number, sunCamZ: number,
  ): void {
    const io = SKY_UPDATE_IO;
    io[0] = drvX; io[1] = drvY; io[2] = drvZ; io[3] = qx; io[4] = qy; io[5] = qz; io[6] = qw;
    io[7] = sunCamX; io[8] = sunCamY; io[9] = sunCamZ;
    this.updateIo(io);
  }

  /** update() with its 10 inputs in a Float64Array (layout SKY_UPDATE_IO).
   *  WHY (T5 S1bbbbba): a double passed as an argument to a non-inlined call is
   *  boxed into a fresh HeapNumber at the call site (~16 B each, standalone probe);
   *  typed-array slots carry the same f64 values unboxed. */
  updateIo(io: Float64Array): void {
    const drvX = io[0], drvY = io[1], drvZ = io[2];
    const qx = io[3], qy = io[4], qz = io[5], qw = io[6];
    const sunCamX = io[7], sunCamY = io[8], sunCamZ = io[9];
    // 1. collect active indices
    const order = this._order;
    let n = 0;
    for (let i = 0; i < IMPOSTOR_CAPACITY; i++) {
      if (this.bodies[i].active) order[n++] = i;
    }
    // 2. insertion sort by trueDist DESCENDING (farthest = deepest stage)
    for (let a = 1; a < n; a++) {
      const v = order[a];
      const dv = this.bodies[v].trueDist;
      let b = a - 1;
      while (b >= 0 && this.bodies[order[b]].trueDist < dv) {
        order[b + 1] = order[b]; b--;
      }
      order[b + 1] = v;
    }
    // 3. stage + write
    this._q.set(qx, qy, qz, qw);
    const colorAttr = this.mesh.geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute;
    const diskAttr = this.mesh.geometry.getAttribute('aDisk') as THREE.InstancedBufferAttribute;
    const kindAttr = this.mesh.geometry.getAttribute('aKind') as THREE.InstancedBufferAttribute;
    const cA = colorAttr.array as Float32Array;
    const dA = diskAttr.array as Float32Array;
    const kA = kindAttr.array as Float32Array;
    for (let rank = 0; rank < n; rank++) {
      const s = this.bodies[order[rank]];
      const D = stagedDistanceForRank(rank);
      const tE = thetaEdge(s.theta);
      const half = quadHalfSize(D, tE);
      // f64 placement, single narrowing at the writes
      const px = drvX + s.dirX * D;
      const py = drvY + s.dirY * D;
      const pz = drvZ + s.dirZ * D;
      this._p.set(px, py, pz);
      this._s.set(half, half, 1);
      this._m.compose(this._p, this._q, this._s);
      this.mesh.setMatrixAt(rank, this._m);
      cA[rank * 3] = s.colorR; cA[rank * 3 + 1] = s.colorG; cA[rank * 3 + 2] = s.colorB;
      dA[rank * 2] = Math.tan(tE);
      dA[rank * 2 + 1] = Math.tan(s.theta) * s.alpha;  // alpha fades the disk radius in
      kA[rank] = s.kind;
      s.stageD = D; s.halfSize = half;
      s.stagedPX = px; s.stagedPY = py; s.stagedPZ = pz;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    colorAttr.needsUpdate = true;
    diskAttr.needsUpdate = true;
    kindAttr.needsUpdate = true;
    const u = this.material.uniforms.uSunCam.value as THREE.Vector3;
    u.set(sunCamX, sunCamY, sunCamZ);
  }


  /** Boot-time glow quad factory (owner positions it per frame). */
  static makeGlowQuad(size: number): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,205,0.95)');
    grad.addColorStop(0.22, 'rgba(255,214,140,0.42)');
    grad.addColorStop(0.55, 'rgba(255,190,110,0.10)');
    grad.addColorStop(1, 'rgba(255,180,100,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(canvas),
        transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, fog: false,
      }),
    );
    mesh.scale.set(size, size, 1);
    mesh.frustumCulled = false;
    mesh.layers.mask = 4;
    mesh.renderOrder = -5;   // after stars, before planet impostors
    return mesh;
  }
}
