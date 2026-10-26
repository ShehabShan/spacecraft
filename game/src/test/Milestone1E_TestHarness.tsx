/**
 * ============================================================================
 *  MILESTONE 1E — THE SPHERICAL ASTRONAUT (R3F TEST HARNESS)
 * ============================================================================
 *  PLANET: the M1C Earth-scale test body (R = 5,000 m, μ = 9.81·5000²,
 *  gravityRange = 30 km per Spec 02.2) SPINNING at Ω = 0.0104 rad/s — the
 *  spec's exact "52 m/s at the equator" — about +Y. All terrain (M1C pool,
 *  planet-frame chunk origins, LOD quadtree) lives under ONE spinning group
 *  at position −O; the M1C pool is completely untouched (spin is a parent
 *  transform; chunk data stays planet-frame and seam-bit-exact).
 *
 *  PIPELINE per frame (M1A canonical order; zero locked files modified):
 *    1. kcc.update(dt·ts)      — astronaut physics (f64, writes through to
 *       the M1A entity: absPos/absVel)
 *    2. core.advance(dt·ts)    — M1A/M1B: rails + 256 m lattice rebasing on
 *       the astronaut (focus entity) + f32 local extraction
 *    3. adapter.update()       — astronaut mesh at f32 locals
 *    4. spinGroup: position −O, quaternion = spin(θ)
 *    5. mesh orientation = spin(θ) ⊗ frameQuat (parallel-transported frame)
 *    6. camera (TP/FP, surface-normal aligned, boom terrain clamp)
 *    7. M1C LOD controller fed the PLANET-FRAME camera (spinInv·P) + pump
 *
 *  AUTOMATED SUITE (auto-arms after streaming warmup):
 *   [R1] Face-boundary walk (headless, 11.6 km great circle through a cube
 *        CORNER): >= 2 face changes, per-tick frame deltas bounded, fwd ⊥ up
 *        to 1e-9, quaternion norm to 1e-12, penetration-free.
 *   [R2] Slope/step on an engineered steep field (params swapped + restored
 *        inside one synchronous block — the renderer never samples mid-swap):
 *        moderate slope climbs cleanly; > 52° slides downhill, uphill
 *        sprint is blocked (dual step rule); cliff face fully blocks.
 *   [R3] State machine: ZERO-G entry at 31 km, RCS burn (Δv + budget),
 *        attitude rotation, deorbit fall, SURFACE re-entry, landing; VEHICLE
 *        attach/detach with exact parented compose + velocity inheritance.
 *   [R4] 30,000-tick burn on the live controller (walk, jumps, zero-G, RCS,
 *        vehicle) — identity canary + no NaN. Allocation is gated in Node by
 *        tools/test-alloc-loops.mjs (F1bcb, ADR-005).
 *   [R5] SPEC-CANONICAL CORIOLIS JUMP: vertical jump at the equator of the
 *        52 m/s planet — lands WEST by ~(4/3)Ωu³/g² ≈ 1.8 cm and settles to
 *        0 m/s relative within 2 ticks (no skating).
 *   [R6] Integration: 20 s live trek at 4× — rebases fire (Δ = N·256 exact),
 *        geometries constant, chunks stream, f32 locals bounded, terrain
 *        group offset exact, entity write-through verbatim.
 */


import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SimulationCore } from '../core/simulation/SimulationCore';
import { FloatingOriginAdapter } from '../render/FloatingOriginAdapter';
import {
  GRID_N, TEST_PLANET, initTerrainField, terrainHeight, terrainNormalInto,
  chunkArcWidth, chunkKey, gridCoord, type TerrainParams,
} from '../core/terrain/terrainField';
import { faceCubePointInto, spherifyInto, type Vec3Out } from '../core/terrain/spherify';
import { mulberry32 } from '../core/terrain/noise';
import { TerrainMeshPool } from '../render/TerrainMeshPool';
import {
  AstronautKCC, EARTHSCALE_ASTRONAUT,
} from '../core/physics/astronautKCC';
import {
  quatFromFrameInto, quatMulInto, rotateAboutAxisInto, rotateByQuatConjInto,
  signedAngleAbout, spinQuatInto, transportVelocityInto,
  type Quat, type Vec3,
} from '../core/physics/sphericalFrame';


/* ============================================================================
 * 1. DEV-TIME PATCHES — dispose / scene.remove counters
 * ==========================================================================*/
const origGeoDispose = THREE.BufferGeometry.prototype.dispose;
const origMatDispose = THREE.Material.prototype.dispose;
const origTexDispose = THREE.Texture.prototype.dispose;
const origSceneRemove = THREE.Scene.prototype.remove;
let disposeCalls = 0;
let sceneRemoveCalls = 0;
THREE.BufferGeometry.prototype.dispose = function (this: THREE.BufferGeometry) {
  disposeCalls++; return origGeoDispose.apply(this, arguments as unknown as []);
};
THREE.Material.prototype.dispose = function (this: THREE.Material) {
  disposeCalls++; return origMatDispose.apply(this, arguments as unknown as []);
};
THREE.Texture.prototype.dispose = function (this: THREE.Texture) {
  disposeCalls++; return origTexDispose.apply(this, arguments as unknown as []);
};
THREE.Scene.prototype.remove = function (this: THREE.Scene) {
  sceneRemoveCalls++; return origSceneRemove.apply(this, arguments as unknown as []);
};


/* ============================================================================
 * 2. BOOT SINGLETONS
 * ==========================================================================*/
const R = TEST_PLANET.radius;
initTerrainField(TEST_PLANET);


const core = new SimulationCore();
const adapter = new FloatingOriginAdapter(core);


const MESH_COUNT = 144;
const pool = new TerrainMeshPool({
  meshCount: MESH_COUNT,
  workerCount: 2,
  workerPoolSets: 96,
  maxBatch: 6,
  inFlightPerWorker: 12,
  params: TEST_PLANET,
});


const kcc = new AstronautKCC(EARTHSCALE_ASTRONAUT);
// Face-walk controller: climbing-unrestricted (T1 tests ORIENTATION; the
// slope/block mechanics are R2's job on the engineered field).
const T1_CFG = {
  ...EARTHSCALE_ASTRONAUT,
  stepHeight: 60, snapDistance: 60,
  slideAngleDeg: 89, maxWalkSlopeDeg: 89,
};
const kccT1 = new AstronautKCC(T1_CFG);


const ASTRO_ID = 'm1e-astronaut';
const astroState = core.registerEntity(ASTRO_ID, {
  absPos: { x: 0, y: 0, z: 0 }, dynamic: false,
});
core.setFocusEntity(ASTRO_ID);
kcc.attachWriteThrough(astroState.absPos, astroState.velocity);


/* -- boot site scans -------------------------------------------------------- */
interface Site { x: number; y: number; z: number; slopeDeg: number; }
function slopeDegAt(d: Vec3): number {
  terrainNormalInto(d.x, d.y, d.z, _scanN);
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
const _scanN: Vec3 = { x: 0, y: 0, z: 0 };
const _scanT: Vec3 = { x: 0, y: 0, z: 0 };


/* F17b (Lead ruling 2026-10-16): local-uniformity gate — a scan hit
   qualifies only if all 8 compass probes at 3 m arc (3/5000 rad) are
   class-consistent (moderate < 35°, steep > 45°, cliff > 60°). */
const _scanP: Vec3 = { x: 0, y: 0, z: 0 };
function uniformAround(d: Vec3, nb: (d: Vec3, slope: number) => boolean): boolean {
  const eps = 3 / 5000;
  // Pole-safe tangent frame: cross d with the least-aligned world axis.
  let ux = 0, uy = 0, uz = 0;
  if (Math.abs(d.y) <= Math.abs(d.x) && Math.abs(d.y) <= Math.abs(d.z)) uy = 1;
  else if (Math.abs(d.x) <= Math.abs(d.z)) ux = 1;
  else uz = 1;
  let e1x = uy * d.z - uz * d.y, e1y = uz * d.x - ux * d.z, e1z = ux * d.y - uy * d.x;
  const m = Math.hypot(e1x, e1y, e1z) || 1;
  e1x /= m; e1y /= m; e1z /= m;
  const e2x = d.y * e1z - d.z * e1y, e2y = d.z * e1x - d.x * e1z, e2z = d.x * e1y - d.y * e1x;
  const c = Math.cos(eps), sn = Math.sin(eps);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const bx = Math.cos(a) * e1x + Math.sin(a) * e2x;
    const by = Math.cos(a) * e1y + Math.sin(a) * e2y;
    const bz = Math.cos(a) * e1z + Math.sin(a) * e2z;
    const l = Math.hypot(d.x * c + bx * sn, d.y * c + by * sn, d.z * c + bz * sn) || 1;
    _scanP.x = (d.x * c + bx * sn) / l;
    _scanP.y = (d.y * c + by * sn) / l;
    _scanP.z = (d.z * c + bz * sn) / l;
    if (!nb(_scanP, slopeDegAt(_scanP))) return false;
  }
  return true;
}


function scanFor(
  pred: (d: Vec3, slope: number) => boolean, tries: number, rand: () => number,
  nb?: (d: Vec3, slope: number) => boolean,
): Site | null {
  for (let i = 0; i < tries; i++) {
    const u = rand() * 2 - 1;
    const th = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    _scanT.x = Math.cos(th) * s; _scanT.y = u; _scanT.z = Math.sin(th) * s;
    const slope = slopeDegAt(_scanT);
    if (pred(_scanT, slope) && (nb === undefined || uniformAround(_scanT, nb))) {
      return { x: _scanT.x, y: _scanT.y, z: _scanT.z, slopeDeg: slope };
    }
  }
  return null;
}


/** Flat equatorial site (|y| < 0.06, slope < 0.6°, locally level). */
function findFlatEquatorSite(): Site {
  const rand = mulberry32(0x5eed1e);
  for (let i = 0; i < 40000; i++) {
    const th = rand() * Math.PI * 2;             // equator band
    const yy = (rand() * 2 - 1) * 0.05;
    const s = Math.sqrt(1 - yy * yy);
    _scanT.x = Math.cos(th) * s; _scanT.y = yy; _scanT.z = Math.sin(th) * s;
    if (slopeDegAt(_scanT) > 0.6) continue;
    const h0 = terrainHeight(_scanT.x, _scanT.y, _scanT.z);
    let ok = true;
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI * 0.5 + 0.4;
      const ex = Math.cos(a) * 0.0004, ez = Math.sin(a) * 0.0004;
      const l = Math.sqrt((_scanT.x + ex) ** 2 + _scanT.y ** 2 + (_scanT.z + ez) ** 2);
      const hx = terrainHeight((_scanT.x + ex) / l, _scanT.y / l, (_scanT.z + ez) / l);
      if (Math.abs(hx - h0) > 0.15) { ok = false; break; }
    }
    if (ok) return { x: _scanT.x, y: _scanT.y, z: _scanT.z, slopeDeg: slopeDegAt(_scanT) };
  }
  return { x: 1, y: 0, z: 0, slopeDeg: 0 };
}
const FLAT_SITE = findFlatEquatorSite();
kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);


/** T1 great circle: through +X and (0,1,1)/√2 — passes exactly through the
 *  (1,1,1)/√3 cube CORNER at φ=45°, then the +Y/−X boundary at φ=135°. */
const GC_C: Vec3 = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
function gcPoint(phi: number, out: Vec3): Vec3 {
  out.x = Math.cos(phi);
  out.y = Math.sin(phi) * Math.SQRT1_2;
  out.z = Math.sin(phi) * Math.SQRT1_2;
  return out;
}
const T1_START: Vec3 = gcPoint(10 * Math.PI / 180, { x: 0, y: 0, z: 0 });
const CORNER: Vec3 = { x: 1 / Math.sqrt(3), y: 1 / Math.sqrt(3), z: 1 / Math.sqrt(3) };


/* ============================================================================
 * 3. M1C QUADTREE + LOD CONTROLLER (identical to M1C/M1D; camera input is
 *    the PLANET-FRAME camera because the terrain group spins).
 * ==========================================================================*/
const MAX_LEVEL = 4;
const SPLIT_K = 2.0, MERGE_K = 1.45, GRACE_FRAMES = 45;
const ACTIVATIONS_PER_FRAME = 3, TOTAL_INFLIGHT_CAP = 24;
const HORIZON_MARGIN = 150, HEIGHT_SLACK = 900;


interface QNode {
  face: number; level: number; ix: number; iy: number; key: number;
  cx: number; cy: number; cz: number;
  ox: number; oy: number; oz: number;
  width: number; brad: number;
  parent: QNode | null;
  split: boolean; desired: boolean;
  activeRec: number; pendingRec: number;
}
const LEVEL_OFFSETS = [0, 1, 5, 21, 85];
const FACE_NODES: QNode[][] = [];
(function buildNodes(): void {
  const dir: Vec3Out = { x: 0, y: 0, z: 0 };
  for (let f = 0; f < 6; f++) {
    const arr: QNode[] = new Array(341);
    for (let L = 0; L <= MAX_LEVEL; L++) {
      const D = GRID_N << L;
      const cnt = 1 << L;
      for (let ix = 0; ix < cnt; ix++) {
        for (let iy = 0; iy < cnt; iy++) {
          const u = gridCoord(ix * GRID_N + (GRID_N >> 1), D);
          const v = gridCoord(iy * GRID_N + (GRID_N >> 1), D);
          faceCubePointInto(f, u, v, dir);
          spherifyInto(dir.x, dir.y, dir.z, dir);
          const h = terrainHeight(dir.x, dir.y, dir.z);
          const rr = R + h;
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy] = {
            face: f, level: L, ix, iy, key: chunkKey(f, L, ix, iy),
            cx: dir.x, cy: dir.y, cz: dir.z,
            ox: dir.x * rr, oy: dir.y * rr, oz: dir.z * rr,
            width: chunkArcWidth(L), brad: chunkArcWidth(L) * 0.75 + HEIGHT_SLACK,
            parent: null, split: false, desired: false,
            activeRec: -1, pendingRec: -1,
          };
        }
      }
    }
    for (let L = 1; L <= MAX_LEVEL; L++) {
      const cnt = 1 << L;
      for (let ix = 0; ix < cnt; ix++) {
        for (let iy = 0; iy < cnt; iy++) {
          const pc = 1 << (L - 1);
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy].parent =
            arr[LEVEL_OFFSETS[L - 1] + (ix >> 1) * pc + (iy >> 1)];
        }
      }
    }
    FACE_NODES.push(arr);
  }
})();
function childOf(n: QNode, c: number): QNode {
  const L1 = n.level + 1;
  const cnt = 1 << L1;
  return FACE_NODES[n.face][LEVEL_OFFSETS[L1]
    + (n.ix * 2 + (c >> 1)) * cnt + (n.iy * 2 + (c & 1))];
}
function nodeHasData(n: QNode): boolean {
  if (n.activeRec >= 0) return true;
  if (n.pendingRec >= 0 && pool.records[n.pendingRec].state === 2) return true;
  return false;
}
const camPlanet: Vec3 = { x: 0, y: 0, z: 0 };   // planet-frame camera
let camUX = 0, camUY = 0, camUZ = 0, horizonDot = 0;
const candNodes: QNode[] = [];
const candDist = new Float64Array(64);
let candCount = 0;
function clearSubtree(n: QNode): void {
  n.desired = false;
  if (n.level < MAX_LEVEL) for (let c = 0; c < 4; c++) clearSubtree(childOf(n, c));
}
function visitNode(n: QNode): boolean {
  const vis = n.ox * camUX + n.oy * camUY + n.oz * camUZ + n.brad
    >= horizonDot - HORIZON_MARGIN;
  if (!vis) { clearSubtree(n); return false; }
  const dx = camPlanet.x - n.ox, dy = camPlanet.y - n.oy, dz = camPlanet.z - n.oz;
  const dNode = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const splitD = SPLIT_K * n.width;
  if (n.split && dNode > MERGE_K * splitD) n.split = false;
  if (!n.split && n.level < MAX_LEVEL && dNode < splitD) n.split = true;
  if (n.split && n.level < MAX_LEVEL) {
    let any = false;
    for (let c = 0; c < 4; c++) if (visitNode(childOf(n, c))) any = true;
    n.desired = !any;
    return true;
  }
  n.desired = true;
  if (n.activeRec < 0 && n.pendingRec < 0 && candCount < 64) {
    candNodes[candCount] = n; candDist[candCount] = dNode; candCount++;
  }
  return true;
}
function updateController(): void {
  const recs = pool.records;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.state === 2 && rec.owner !== null) {
      const n = rec.owner as QNode;
      if (n.pendingRec === i) { n.pendingRec = -1; n.activeRec = i; }
    }
  }
  const camR = Math.sqrt(camPlanet.x ** 2 + camPlanet.y ** 2 + camPlanet.z ** 2);
  camUX = camPlanet.x / camR; camUY = camPlanet.y / camR; camUZ = camPlanet.z / camR;
  horizonDot = (R * R) / camR;
  candCount = 0;
  for (let f = 0; f < 6; f++) visitNode(FACE_NODES[f][0]);
  const pressure = pool.freeCount() < 6;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    const node = rec.owner as QNode | null;
    if (node === null) continue;
    if (rec.state === 2) {
      if (node.desired) { rec.unwanted = 0; continue; }
      if (node.split) {
        let childData = false;
        for (let c = 0; c < 4; c++)
          if (nodeHasData(childOf(node, c))) { childData = true; break; }
        if (childData) rec.mesh.visible = false;
      }
      let keep = false;
      if (node.split) {
        for (let c = 0; c < 4; c++) {
          const ch = childOf(node, c);
          if (ch.desired && !nodeHasData(ch)) { keep = true; break; }
        }
      } else {
        const p = node.parent;
        if (p !== null && p.desired && !nodeHasData(p)) keep = true;
      }
      if (keep && !pressure) { rec.unwanted = 0; continue; }
      rec.unwanted++;
      if (rec.unwanted >= GRACE_FRAMES || pressure) {
        pool.release(i);
        if (node.activeRec === i) node.activeRec = -1;
        rec.owner = null;
      }
    } else if (rec.state === 1) {
      if (!node.desired && !node.split) {
        rec.unwanted++;
        if (rec.unwanted >= GRACE_FRAMES) {
          pool.release(i);
          if (node.pendingRec === i) node.pendingRec = -1;
          rec.owner = null;
        }
      } else rec.unwanted = 0;
    }
  }
  for (let a = 1; a < candCount; a++) {
    const d = candDist[a], n = candNodes[a];
    let b = a - 1;
    while (b >= 0 && candDist[b] > d) {
      candDist[b + 1] = candDist[b]; candNodes[b + 1] = candNodes[b]; b--;
    }
    candDist[b + 1] = d; candNodes[b + 1] = n;
  }
  let activated = 0;
  for (let a = 0; a < candCount && activated < ACTIVATIONS_PER_FRAME; a++) {
    if (pool.inFlightTotal() >= TOTAL_INFLIGHT_CAP) break;
    if (pool.freeCount() <= 2) break;
    const n = candNodes[a];
    const recIdx = pool.acquire(n.face, n.level, n.ix, n.iy, n.ox, n.oy, n.oz);
    if (recIdx < 0) break;
    pool.records[recIdx].owner = n;
    n.pendingRec = recIdx;
    activated++;
  }
}


/* ============================================================================
 * 4. STATIC SCENE (boot-only allocation)
 * ==========================================================================*/
const sceneRoot = new THREE.Group();
const spinGroup = new THREE.Group();          // ALL planet-fixed content
sceneRoot.add(spinGroup);
const sunLight = new THREE.DirectionalLight(0xfff1de, 1.9);
sunLight.position.set(0.45, 0.65, 0.61).normalize().multiplyScalar(10000);
sceneRoot.add(sunLight);
sceneRoot.add(new THREE.AmbientLight(0x33465e, 0.55));
spinGroup.add(new THREE.Mesh(
  new THREE.SphereGeometry(R - 900, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x0d141c, roughness: 1 }),
));
(function stars(): void {
  const COUNT = 1400, RAD = 15000;
  const pos = new Float32Array(COUNT * 3);
  const rand = mulberry32(0x5eed1e);
  for (let i = 0; i < COUNT; i++) {
    const u = rand() * 2 - 1, t = rand() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    pos[i * 3] = Math.cos(t) * s * RAD;
    pos[i * 3 + 1] = u * RAD;
    pos[i * 3 + 2] = Math.sin(t) * s * RAD;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sceneRoot.add(new THREE.Points(g, new THREE.PointsMaterial({
    color: 0xaec6dc, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0.75, fog: false, depthWrite: false,
  })));
})();


/* -- astronaut mesh (body frame: +X forward, +Y up) ------------------------- */
const astroMesh = new THREE.Group();
(function buildAstronaut(): void {
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.7 });
  const visorM = new THREE.MeshStandardMaterial({
    color: 0x7fd4ff, emissive: 0x1e7fb8, emissiveIntensity: 0.9, roughness: 0.2,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.52), suit);
  torso.position.set(0, 1.02, 0);
  astroMesh.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 12), suit);
  helmet.position.set(0.04, 1.52, 0);
  astroMesh.add(helmet);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.3), visorM);
  visor.position.set(0.24, 1.53, 0);
  astroMesh.add(visor);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.44, 0.4), dark);
  pack.position.set(-0.3, 1.1, 0);
  astroMesh.add(pack);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), suit);
    leg.position.set(0, 0.36, s * 0.14);
    astroMesh.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.16, 0.16), suit);
    arm.position.set(0.1, 1.12, s * 0.34);
    astroMesh.add(arm);
  }
})();
sceneRoot.add(astroMesh);


/* ============================================================================
 * 5. INPUT (keyboard + pointer-lock mouse)
 * ==========================================================================*/
const keys: Record<string, boolean> = {};
let userPaused = false;
let camFirstPerson = false;
let mouseDX = 0, mouseDY = 0;
const SENS = 0.0022;
window.addEventListener('keydown', (e) => {
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'KeyP') userPaused = !userPaused;
  if (e.code === 'KeyV') camFirstPerson = !camFirstPerson;
  if (e.code === 'Space') kcc.input.jump = true;
  if (e.code === 'KeyR') kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
  if (e.code === 'KeyT') {
    // Interactive zero-G drop: 31 km above the current site, small tangent.
    const p = kcc.pLocal;
    const l = Math.hypot(p.x, p.y, p.z);
    kcc.teleportAbs(p.x / l * 31000, p.y / l * 31000, p.z / l * 31000, 0, 0, -20);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== null) {
    mouseDX += e.movementX;
    mouseDY += e.movementY;
  }
});


function readUserInput(): void {
  const f = kcc.input;
  f.moveF = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  f.moveR = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  f.sprint = !!keys['ShiftLeft'] || !!keys['ShiftRight'];
  f.crouch = !!keys['KeyC'];
  f.turnRate = 0;
  if (kcc.mode === 'ZERO-G') {
    f.rcsF = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
    f.rcsU = (keys['Space'] ? 1 : 0) - (keys['KeyC'] ? 1 : 0);
    f.rcsR = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  } else {
    f.rcsF = 0; f.rcsU = 0; f.rcsR = 0;
  }
}


/* ============================================================================
 * 6. CAMERA STATE (TP orbit offset relative to the character frame; the
 *    auto-turn compensation keeps the orbit fixed in the tangent plane).
 * ==========================================================================*/
const cam = { yawOffset: 0.6, pitch: 0.35, dist: 7.5 };
const camState = { locked: false };


/* ============================================================================
 * 7. STORES
 * ==========================================================================*/
const tele = {
  version: 0, fps: 0, frameMs: 0,
  mode: 'SURFACE', grounded: true, crouched: false,
  relSpeed: 0, slideSpeed: 0, transport: 0, absSpeed: 0,
  altMSL: 0, altAGL: 0, slope: 0, face: 0,
  upX: 0, upY: 1, upZ: 0, gX: 0, gY: 0, gZ: 0, gMag: 9.81,
  rcs: 25, spin: 0, day: 0,
  originX: 0, originY: 0, originZ: 0, rebases: 0, localMax: 0,
  active: 0, pending: 0, inFlight: 0, geometries: 0, heapMB: 0,
  phase: 'WARMUP', countdown: 0,
};
const teleListeners = new Set<() => void>();
let lastTeleMs = -1e9;
function subTele(cb: () => void): () => void {
  teleListeners.add(cb); return () => teleListeners.delete(cb);
}


type TestKey = 'face-walk' | 'slope-step' | 'state-machine' | 'zero-gc'
  | 'coriolis' | 'integration';
interface TestResult { pass: boolean; detail: string; }
interface SuiteState {
  version: number; done: boolean;
  results: Partial<Record<TestKey, TestResult>>;
}
let suiteState: SuiteState = { version: 0, done: false, results: {} };
const suiteListeners = new Set<() => void>();
function publishSuite(next: Partial<SuiteState>): void {
  suiteState = { ...suiteState, ...next, version: suiteState.version + 1 };
  suiteListeners.forEach((l) => l());
}
function subSuite(cb: () => void): () => void {
  suiteListeners.add(cb); return () => suiteListeners.delete(cb);
}
const heapApi = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory ?? null;


/* ============================================================================
 * 8. HEADLESS SUITE (rows R1–R5 run in one synchronous block; the renderer
 *    never samples mid-field-swap because JS is single-threaded).
 * ==========================================================================*/
const suite = {
  started: false,
  face: {
    ticks: 0, faceChanges: 0, pathLen: 0,
    minUpDot: 1, minFwdDot: 1, maxOrtho: 0, maxQuatDev: 0,
    minCornerAngle: 1, minAGL: Number.POSITIVE_INFINITY, orthoOk: true,
  },
  coriolis: {
    westDrift: 0, perpDrift: 0, airTicks: 0, settleTicks: 0,
    maxSettleSpeed: 0, predicted: 0, ok: false,
  },
  burn: { identityOk: false, heapDelta: -1, ticks: 0, nan: 0 },
  slope: { climbGain: 0, slideMax: 0, uphillNet: 0, cliffNet: 0, ok: false },
  sm: { rcsDv: 0, budgetUsed: 0, yawAngle: 0, vehicleErr: 0, detachDv: 0, ok: false },
};


const _qA: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _vA: Vec3 = { x: 0, y: 0, z: 0 };
const _vB: Vec3 = { x: 0, y: 0, z: 0 };
const _vC: Vec3 = { x: 0, y: 0, z: 0 };
const _vD: Vec3 = { x: 0, y: 0, z: 0 };


function runFaceWalk(): TestResult {
  const F = suite.face;
  kccT1.teleportSurface(T1_START.x, T1_START.y, T1_START.z);
  kccT1.resetIntegrityStats();
  kccT1.autoTurnEnabled = false;
  const inp = kccT1.input;
  inp.moveF = 1; inp.moveR = 0; inp.sprint = true; inp.crouch = false;
  inp.jump = false; inp.turnRate = 0;
  let px = kccT1.pLocal.x, py = kccT1.pLocal.y, pz = kccT1.pLocal.z;
  const maxTicks = 140_000;
  while (F.pathLen < 13_600 && F.ticks < maxTicks) {
    // Great-circle steering: target tangent t = normalize(c × d).
    const p = kccT1.pLocal;
    const l = Math.hypot(p.x, p.y, p.z);
    _vA.x = GC_C.y * (p.z / l) - GC_C.z * (p.y / l);
    _vA.y = GC_C.z * (p.x / l) - GC_C.x * (p.z / l);
    _vA.z = GC_C.x * (p.y / l) - GC_C.y * (p.x / l);
    const tl = Math.hypot(_vA.x, _vA.y, _vA.z);
    _vA.x /= tl; _vA.y /= tl; _vA.z /= tl;
    const a = signedAngleAbout(kccT1.fwd.x, kccT1.fwd.y, kccT1.fwd.z,
      _vA.x, _vA.y, _vA.z, kccT1.up.x, kccT1.up.y, kccT1.up.z);
    inp.turnRate = Math.max(-2.5, Math.min(2.5, a * 3));
    kccT1.integrateTick(1 / 60);
    F.ticks++;
    const nx = kccT1.pLocal.x, ny = kccT1.pLocal.y, nz = kccT1.pLocal.z;
    F.pathLen += Math.hypot(nx - px, ny - py, nz - pz);
    px = nx; py = ny; pz = nz;
    // Frame smoothness (dot with previous tick's frame).
    const ud = kccT1.up.x * _vB.x + kccT1.up.y * _vB.y + kccT1.up.z * _vB.z;
    const fd = kccT1.fwd.x * _vC.x + kccT1.fwd.y * _vC.y + kccT1.fwd.z * _vC.z;
    if (F.ticks > 1) {
      if (ud < F.minUpDot) F.minUpDot = ud;
      if (fd < F.minFwdDot) F.minFwdDot = fd;
    }
    _vB.x = kccT1.up.x; _vB.y = kccT1.up.y; _vB.z = kccT1.up.z;
    _vC.x = kccT1.fwd.x; _vC.y = kccT1.fwd.y; _vC.z = kccT1.fwd.z;
    const ortho = Math.abs(kccT1.fwd.x * kccT1.up.x + kccT1.fwd.y * kccT1.up.y +
      kccT1.fwd.z * kccT1.up.z);
    if (ortho > F.maxOrtho) F.maxOrtho = ortho;
    kccT1.frameQuatInto(_qA);
    const qn = Math.sqrt(_qA.x ** 2 + _qA.y ** 2 + _qA.z ** 2 + _qA.w ** 2);
    const dev = Math.abs(qn - 1);
    if (dev > F.maxQuatDev) F.maxQuatDev = dev;
    const cd = kccT1.pLocal.x * CORNER.x + kccT1.pLocal.y * CORNER.y +
      kccT1.pLocal.z * CORNER.z;
    const cl = Math.hypot(kccT1.pLocal.x, kccT1.pLocal.y, kccT1.pLocal.z);
    const cang = Math.acos(Math.max(-1, Math.min(1, cd / cl)));
    if (cang < F.minCornerAngle) F.minCornerAngle = cang;
  }
  F.faceChanges = kccT1.integrity.faceChanges;
  F.minAGL = kccT1.integrity.minAGL;
  const pass =
    F.faceChanges >= 2 &&
    F.minUpDot > Math.cos(0.06) &&
    F.minFwdDot > Math.cos(0.09) &&
    F.maxOrtho < 1e-9 &&
    F.maxQuatDev < 1e-12 &&
    F.minCornerAngle < 0.06 &&
    F.minAGL > -0.05 &&
    F.pathLen > 11_000;
  const deg = (r: number) => ((Math.acos(Math.max(-1, Math.min(1, r))) * 180) / Math.PI);
  return {
    pass,
    detail:
      `${(F.pathLen / 1000).toFixed(1)} km great-circle walk through the (1,1,1)/√3 ` +
      `cube CORNER (closest approach ${((F.minCornerAngle * 180) / Math.PI).toFixed(2)}°): ` +
      `${F.faceChanges} face changes; max per-tick up rotation ${deg(F.minUpDot).toFixed(3)}° ` +
      `(bound 3.44°), fwd ${deg(F.minFwdDot).toFixed(3)}° (bound 5.2°) — no yaw snaps; ` +
      `fwd⊥up max ${F.maxOrtho.toExponential(1)} (no gimbal degeneracy); quaternion norm ` +
      `dev ${F.maxQuatDev.toExponential(1)}; min AGL ${F.minAGL.toFixed(3)} m. ` +
      `Holonomy of a great circle = 2π ≡ identity — the frame is pole/face-singularity-free.`,
  };
}


function runCoriolisJump(): TestResult {
  const C = suite.coriolis;
  kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
  kcc.autoTurnEnabled = true;
  const inp = kcc.input;
  inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.crouch = false;
  inp.turnRate = 0; inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0;
  for (let i = 0; i < 5; i++) kcc.integrateTick(1 / 60);   // settle plant
  const lx = kcc.pLocal.x, ly = kcc.pLocal.y, lz = kcc.pLocal.z;
  // Launch up (character up ≈ radial on the flat site) — record for the
  // tilt-drift prediction (jump is along up, not exactly radial).
  const upx = kcc.up.x, upy = kcc.up.y, upz = kcc.up.z;
  const rl = Math.hypot(lx, ly, lz);
  const rx = lx / rl, ry = ly / rl, rz = lz / rl;
  inp.jump = true;
  let airTicks = 0;
  for (let i = 0; i < 240; i++) {
    kcc.integrateTick(1 / 60);
    if (kcc.grounded) break;
    airTicks++;
  }
  C.airTicks = airTicks;
  const T = airTicks / 60;
  // Predicted tilt drift: u·(up − (up·r̂)r̂)·T (jump along the blended up).
  const upd = upx * rx + upy * ry + upz * rz;
  _vA.x = (upx - upd * rx) * 5 * T;
  _vA.y = (upy - upd * ry) * 5 * T;
  _vA.z = (upz - upd * rz) * 5 * T;
  // Planet-frame drift, tilt-corrected.
  _vB.x = kcc.pLocal.x - lx - _vA.x;
  _vB.y = kcc.pLocal.y - ly - _vA.y;
  _vB.z = kcc.pLocal.z - lz - _vA.z;
  transportVelocityInto(EARTHSCALE_ASTRONAUT.spinOmega, lx, ly, lz, _vC);
  const tl = Math.hypot(_vC.x, _vC.y, _vC.z) || 1;
  _vD.x = -_vC.x / tl; _vD.y = -_vC.y / tl; _vD.z = -_vC.z / tl;  // WEST
  C.westDrift = _vB.x * _vD.x + _vB.y * _vD.y + _vB.z * _vD.z;
  const wmag = Math.abs(C.westDrift);
  _vA.x = _vB.x - C.westDrift * _vD.x;
  _vA.y = _vB.y - C.westDrift * _vD.y;
  _vA.z = _vB.z - C.westDrift * _vD.z;
  C.perpDrift = Math.hypot(_vA.x, _vA.y, _vA.z);
  const g = EARTHSCALE_ASTRONAUT.planetMu / (rl * rl);
  C.predicted = (4 / 3) * EARTHSCALE_ASTRONAUT.spinOmega * 125 / (g * g);
  // Settle: no skating — relative speed to 0 within 2 ticks, stays 0.
  let settleTicks = -1, maxSettle = 0;
  for (let i = 0; i < 32; i++) {
    kcc.integrateTick(1 / 60);
    if (i >= 1) {
      if (settleTicks < 0 && kcc.telemetry.relSpeed < 0.02) settleTicks = i;
      if (settleTicks >= 0 && kcc.telemetry.relSpeed > maxSettle)
        maxSettle = kcc.telemetry.relSpeed;
    }
  }
  C.settleTicks = settleTicks;
  C.maxSettleSpeed = maxSettle;
  const pass =
    C.westDrift > 0.006 && C.westDrift < 0.06 &&
    C.perpDrift < 0.012 &&
    airTicks > 48 && airTicks < 78 &&
    settleTicks >= 1 && settleTicks <= 2 &&
    maxSettle < 0.02;
  return {
    pass,
    detail:
      `SPEC-CANONICAL TEST: vertical jump (u = 5 m/s) at the equator of the ` +
      `52 m/s planet (Ω = 0.0104). Landed ${(C.westDrift * 100).toFixed(2)} cm WEST ` +
      `(theory (4/3)Ωu³/g² = ${(C.predicted * 100).toFixed(2)} cm — pure inertial ` +
      `integration, angular momentum conserved); cross-track residual ` +
      `${(C.perpDrift * 100).toFixed(2)} cm; airborne ${T.toFixed(2)} s (2u/g ≈ 1.02 s); ` +
      `post-touchdown relative speed planted to < 0.02 m/s within ${settleTicks} tick(s) ` +
      `and held (max ${maxSettle.toFixed(3)} m/s over 32 ticks) — zero skating. The ` +
      `launch/landing planet-frame comparison also validates the R(θ) compose/decompose ` +
      `round-trip across a 53 m transport displacement.`,
  };
}


function runStateMachine(): TestResult {
  const S = suite.sm;
  const inp = kcc.input;
  inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.crouch = false;
  inp.turnRate = 0; inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0;
  // (1) ZERO-G entry beyond the gravity range (30 km).
  const p = kcc.pLocal;
  const l = Math.hypot(p.x, p.y, p.z);
  kcc.teleportAbs(p.x / l * 31000, p.y / l * 31000, p.z / l * 31000, 0, 0, 0);
  kcc.integrateTick(1 / 60);
  const zeroOk = kcc.mode === 'ZERO-G';
  // (2) RCS burn: 2 s prograde at 1.2 m/s².
  const b0 = kcc.telemetry.rcsBudget;
  const f0 = { ...kcc.fwd };
  inp.rcsF = 1;
  for (let i = 0; i < 120; i++) kcc.integrateTick(1 / 60);
  inp.rcsF = 0;
  const v = Math.hypot(kcc.absVel.x, kcc.absVel.y, kcc.absVel.z);
  S.rcsDv = v;
  S.budgetUsed = b0 - kcc.telemetry.rcsBudget;
  // (3) Attitude: 0.5 rad/s yaw for 1 s.
  inp.turnRate = 0.5;
  for (let i = 0; i < 60; i++) kcc.integrateTick(1 / 60);
  inp.turnRate = 0;
  S.yawAngle = Math.acos(Math.max(-1, Math.min(1,
    kcc.fwd.x * f0.x + kcc.fwd.y * f0.y + kcc.fwd.z * f0.z)));
  // (4) Deorbit: 30 m/s inward, fall, re-enter, land.
  const P = kcc.absPos;
  const pl = Math.hypot(P.x, P.y, P.z);
  kcc.teleportAbs(P.x, P.y, P.z, (-30 * P.x) / pl, (-30 * P.y) / pl, (-30 * P.z) / pl);
  let surfaceTick = -1, landed = false;
  for (let i = 0; i < 26_000; i++) {   // F19 (Lead ruling 2026-10-16): 20_000 was under the ≈22,400-tick free-fall
    kcc.integrateTick(1 / 60);
    if (surfaceTick < 0 && kcc.mode === 'SURFACE') surfaceTick = i;
    if (kcc.grounded) { landed = true; break; }
  }
  // (5) VEHICLE: synthetic hovering platform on a circle.
  const prov = {
    pos: { x: 0, y: 0, z: 0 } as Vec3,
    vel: { x: 0, y: 0, z: 0 } as Vec3,
    quat: { x: 0, y: 0, z: 0, w: 1 } as Quat,
    angVel: { x: 0, y: 0.05, z: 0 } as Vec3,
  };
  const W = 0.05, A = 800, ALT = R + 1200;
  const drivePlatform = (t: number): void => {
    prov.pos.x = A * Math.cos(W * t);
    prov.pos.y = ALT;
    prov.pos.z = A * Math.sin(W * t);
    prov.vel.x = -A * W * Math.sin(W * t);
    prov.vel.y = 0;
    prov.vel.z = A * W * Math.cos(W * t);
    const vl = Math.hypot(prov.vel.x, prov.vel.z);
    quatFromFrameInto(prov.vel.x / vl, prov.vel.y, prov.vel.z / vl,
      prov.pos.x / Math.hypot(A, ALT), prov.pos.y / Math.hypot(A, ALT),
      prov.pos.z / Math.hypot(A, ALT), prov.quat);
  };
  drivePlatform(0);
  // F15 (Lead ruling 2026-10-16): attachVehicle stores the offset in the
  // PARENT frame (vehOffset = R_att⁻¹·(0,2,0)); the independent check must
  // compose that same parent-frame vector — the world-space (0,2,0) it used
  // was a constant 0.2565 m error (2·2·sin(3.69°), the attach up-tilt).
  const offP: Vec3 = { x: 0, y: 0, z: 0 };
  rotateByQuatConjInto(prov.quat, 0, 2, 0, offP);
  kcc.teleportAbs(prov.pos.x, prov.pos.y + 2, prov.pos.z,
    prov.vel.x, prov.vel.y, prov.vel.z);
  kcc.attachVehicle(prov);
  let maxErr = 0;
  for (let i = 1; i <= 600; i++) {
    drivePlatform(i / 60);
    kcc.integrateTick(1 / 60);
    // Independent compose check.
    const q = prov.quat;
    const off = offP;
    const ex = q.w * (2 * (q.y * off.z - q.z * off.y)) +
      (q.y * (2 * (q.x * off.y - q.y * off.x)) -
        q.z * (2 * (q.z * off.x - q.x * off.z))) + off.x;
    const ey = q.w * (2 * (q.z * off.x - q.x * off.z)) +
      (q.z * (2 * (q.y * off.z - q.z * off.y)) -
        q.x * (2 * (q.x * off.y - q.y * off.x))) + off.y;
    const ez = q.w * (2 * (q.x * off.y - q.y * off.x)) +
      (q.x * (2 * (q.z * off.x - q.x * off.z)) -
        q.y * (2 * (q.y * off.z - q.z * off.y))) + off.z;
    const err = Math.max(
      Math.abs(kcc.absPos.x - (prov.pos.x + ex)),
      Math.abs(kcc.absPos.y - (prov.pos.y + ey)),
      Math.abs(kcc.absPos.z - (prov.pos.z + ez)));
    if (err > maxErr) maxErr = err;
  }
  S.vehicleErr = maxErr;
  drivePlatform(10);
  const dvx = prov.vel.x + (prov.angVel.y * (kcc.absPos.z - prov.pos.z));
  const dvy = prov.vel.y;
  const dvz = prov.vel.z - (prov.angVel.y * (kcc.absPos.x - prov.pos.x));
  kcc.detachVehicle();
  S.detachDv = Math.hypot(
    kcc.absVel.x - dvx, kcc.absVel.y - dvy, kcc.absVel.z - dvz);
  kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
  const pass = zeroOk && Math.abs(S.rcsDv - 2.4) < 0.05 &&
    Math.abs(S.budgetUsed - 2.4) < 0.05 && Math.abs(S.yawAngle - 0.5) < 0.01 &&
    surfaceTick >= 0 && landed && S.vehicleErr < 1e-9 && S.detachDv < 1e-6 &&
    kcc.integrity.nanEvents === 0;
  return {
    pass,
    detail:
      `ZERO-G entered 1 tick beyond the 30 km gravity range (Spec 02.3 fade); ` +
      `RCS burn Δv ${S.rcsDv.toFixed(3)} m/s, propellant ${(S.budgetUsed).toFixed(3)} m/s ` +
      `of the 25 m/s pack; attitude yaw ${S.yawAngle.toFixed(3)} rad (finite frame ` +
      `rotation); deorbit fell back through the hysteresis band (SURFACE at tick ` +
      `${surfaceTick}) and landed analytically; VEHICLE parented compose tracked the ` +
      `moving platform to ${S.vehicleErr.toExponential(1)} m over 600 ticks, detach ` +
      `velocity inherited to ${S.detachDv.toExponential(1)} m/s; NaN events 0.`,
  };
}


function runZeroGcBurn(): TestResult {
  const B = suite.burn;
  const canary = {
    pos: kcc.absPos, vel: kcc.absVel, pl: kcc.pLocal,
    up: kcc.up, fwd: kcc.fwd, input: kcc.input,
    tele: kcc.telemetry, integ: kcc.integrity,
  };
  const mem = heapApi;
  const heap0 = mem !== null ? mem.usedJSHeapSize : -1;
  kcc.resetIntegrityStats();
  const inp = kcc.input;
  const BURN = 30_000;
  for (let i = 0; i < BURN; i++) {
    if (i < 10_000) {
      if (i === 0) kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
      inp.moveF = Math.sin(0.001 * i);
      inp.moveR = Math.cos(0.0013 * i);
      inp.sprint = i % 2000 < 1000;
      inp.turnRate = 0.3 * Math.sin(0.0007 * i);
      if (i % 2500 === 100) inp.jump = true;
      inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0;
    } else if (i < 20_000) {
      if (i === 10_000) {
        const p = kcc.pLocal;
        const l = Math.hypot(p.x, p.y, p.z);
        kcc.teleportAbs(p.x / l * 31000, p.y / l * 31000, p.z / l * 31000, 0, 0, 0);
      }
      inp.moveF = 0; inp.moveR = 0; inp.jump = false;
      inp.rcsF = Math.sin(0.002 * i);
      inp.rcsU = Math.cos(0.0017 * i);
      inp.rcsR = Math.sin(0.0011 * i);
      inp.turnRate = 0.4 * Math.sin(0.0009 * i);
    } else {
      if (i === 20_000) {
        const p = kcc.pLocal;
        const l = Math.hypot(p.x, p.y, p.z);
        kcc.teleportAbs(p.x / l * 5800, p.y / l * 5800, p.z / l * 5800,
          -40 * p.x / l, -40 * p.y / l, -40 * p.z / l);
      }
      if (i === 25_000) {
        kcc.teleportAbs(800, R + 1202, 0, 0, 0, 40);
        staticProv.pos.x = 800; staticProv.pos.y = R + 1200; staticProv.pos.z = 0;
        staticProv.vel.x = 0; staticProv.vel.y = 0; staticProv.vel.z = 40;
        quatFromFrameInto(0, 0, 1, 0, 1, 0, staticProv.quat);
        staticProv.angVel.x = 0; staticProv.angVel.y = 0; staticProv.angVel.z = 0;
        kcc.attachVehicle(staticProv);
      }
      if (i === 26_000) kcc.detachVehicle();
      inp.rcsF = 0; inp.rcsU = 0; inp.rcsR = 0; inp.jump = false;
      inp.moveF = Math.sin(0.0015 * i);
      inp.moveR = Math.sin(0.0009 * i + 1);
      inp.sprint = i % 3000 < 1500;
      inp.turnRate = 0.2 * Math.sin(0.0006 * i);
    }
    kcc.integrateTick(1 / 60);
  }
  const heap1 = mem !== null ? mem.usedJSHeapSize : -1;
  B.identityOk =
    kcc.absPos === canary.pos && kcc.absVel === canary.vel &&
    kcc.pLocal === canary.pl && kcc.up === canary.up &&
    kcc.fwd === canary.fwd && kcc.input === canary.input &&
    kcc.telemetry === canary.tele && kcc.integrity === canary.integ;
  B.heapDelta = heap0 >= 0 ? heap1 - heap0 : -1;
  B.ticks = BURN;
  B.nan = kcc.integrity.nanEvents;
  kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
  // WHY (F1bcb, ADR-005): the heap-delta clause is retired — usedJSHeapSize deltas hide
  // transient churn (A1-U27b2). Allocation is gated by tools/test-alloc-loops.mjs (ADR-003);
  // this row keeps only what it can really check.
  return {
    pass: B.identityOk && B.nan === 0,
    detail:
      `${B.ticks.toLocaleString()} synchronous ticks on the live controller ` +
      `(walk + jumps + slides → zero-G → RCS maneuvers → deorbit landing → vehicle ` +
      `attach/detach): every state object identity preserved ` +
      `${B.identityOk ? '✓' : 'FAILED'}; ` +
      `NaN events ${B.nan}. Per-tick allocation is not measured here: ` +
      `node --expose-gc tools/test-alloc-loops.mjs (sampling heap profiler).`,
  };
}
const staticProv = {
  pos: { x: 0, y: 0, z: 0 } as Vec3,
  vel: { x: 0, y: 0, z: 0 } as Vec3,
  quat: { x: 0, y: 0, z: 0, w: 1 } as Quat,
  angVel: { x: 0, y: 0, z: 0 } as Vec3,
};


function runSlopeStep(): TestResult {
  kcc.resetIntegrityStats();   // F20 (Lead ruling 2026-10-16): measure only this row's window
  const S = suite.slope;
  // Engineered steep field (deterministic; swapped + restored inside this
  // synchronous block — the renderer never samples mid-swap).
  const STEEP: TerrainParams = {
    name: 'M1E engineered slopes',
    radius: 5000, seed: 777,
    continentFreq: 1.2, continentAmp: 40,
    maskFreq: 1.05, mountainFreq: 3.0, mountainAmp: 2200,
    detailFreq: 8, detailAmp: 3,
  };
  initTerrainField(STEEP);
  const rand = mulberry32(0x5109e5);
  const moderate = scanFor((_d, s) => s > 18 && s < 28, 20000, rand,
    (_d, s) => s < 35);
  const steep = scanFor((_d, s) => s > 52 && s < 68, 20000, rand,
    (_d, s) => s > 45);
  const cliff = scanFor((_d, s) => s > 70, 20000, rand,
    (_d, s) => s > 60);
  const results: string[] = [];
  let ok = true;


  const downhillAt = (d: Vec3, out: Vec3): void => {
    terrainNormalInto(d.x, d.y, d.z, _scanN);
    const gm = 9.81;
    _vA.x = -gm * d.x; _vA.y = -gm * d.y; _vA.z = -gm * d.z;
    const dn = _vA.x * _scanN.x + _vA.y * _scanN.y + _vA.z * _scanN.z;
    out.x = _vA.x - dn * _scanN.x;
    out.y = _vA.y - dn * _scanN.y;
    out.z = _vA.z - dn * _scanN.z;
    const l = Math.hypot(out.x, out.y, out.z) || 1;
    out.x /= l; out.y /= l; out.z /= l;
  };


  // (a) Moderate slope: clean climb + clean descent (step-up + snap-down).
  if (moderate !== null) {
    kcc.teleportSurface(moderate.x, moderate.y, moderate.z);
    downhillAt(moderate, _vB);
    kcc.fwd.x = -_vB.x; kcc.fwd.y = -_vB.y; kcc.fwd.z = -_vB.z;  // face uphill
    const inp = kcc.input;
    inp.moveF = 1; inp.moveR = 0; inp.sprint = false; inp.crouch = false;
    inp.turnRate = 0; inp.jump = false;
    // F17a (Lead ruling 2026-10-16): direct altitude read — teleportSurface
    // does not refresh telemetry; the old telemetry-sourced alt0 was stale
    // pre-swap cross-field contamination.
    const alt0 = Math.hypot(kcc.pLocal.x, kcc.pLocal.y, kcc.pLocal.z) - 5000;
    let groundedAll = true, maxSlide = 0;
    for (let i = 0; i < 150; i++) {
      kcc.integrateTick(1 / 60);
      if (!kcc.grounded) groundedAll = false;
      if (kcc.telemetry.slideSpeed > maxSlide) maxSlide = kcc.telemetry.slideSpeed;
    }
    S.climbGain = Math.hypot(kcc.pLocal.x, kcc.pLocal.y, kcc.pLocal.z) - 5000 - alt0;
    S.slideMax = maxSlide;
    const slopeRad = (moderate.slopeDeg * Math.PI) / 180;
    const expected = 4 * Math.sin(slopeRad) * 2.5;
    const climbOk = groundedAll && S.climbGain > 0.7 * expected && maxSlide < 0.05;
    // Descent (snap-down holds grounding).
    inp.moveF = -1;
    let descGrounded = true;
    for (let i = 0; i < 150; i++) {
      kcc.integrateTick(1 / 60);
      if (!kcc.grounded) descGrounded = false;
    }
    ok = ok && climbOk && descGrounded;
    results.push(
      `${moderate.slopeDeg.toFixed(0)}° slope: climbed ${S.climbGain.toFixed(1)} m ` +
      `uphill in 2.5 s (expected ≈ ${expected.toFixed(1)} m, slide ${maxSlide.toFixed(3)} m/s, ` +
      `grounded 150/150), descended with snap-down holding grounding ` +
      `${descGrounded ? '150/150' : 'FAILED'}`);
  } else { ok = false; results.push('moderate site not found'); }


  // (b) Steep slope: slide initiates, accelerates downhill; uphill sprint blocked.
  if (steep !== null) {
    kcc.teleportSurface(steep.x, steep.y, steep.z);
    const inp = kcc.input;
    inp.moveF = 0; inp.moveR = 0; inp.sprint = false; inp.turnRate = 0; inp.jump = false;
    let t30 = -1, vMid = 0, vEnd = 0;
    const sx = kcc.pLocal.x, sy = kcc.pLocal.y, sz = kcc.pLocal.z;
    downhillAt(steep, _vB);
    for (let i = 0; i < 120; i++) {
      kcc.integrateTick(1 / 60);
      if (t30 < 0 && kcc.telemetry.slideSpeed > 0.5) t30 = i;
      if (i === 60) vMid = kcc.telemetry.slideSpeed;
    }
    vEnd = kcc.telemetry.slideSpeed;
    const dx = kcc.pLocal.x - sx, dy = kcc.pLocal.y - sy, dz = kcc.pLocal.z - sz;
    const downDot = dx * _vB.x + dy * _vB.y + dz * _vB.z;
    // Uphill sprint into the slope (blocked by the dual step rule).
    kcc.teleportSurface(steep.x, steep.y, steep.z);
    kcc.fwd.x = -_vB.x; kcc.fwd.y = -_vB.y; kcc.fwd.z = -_vB.z;
    inp.moveF = 1; inp.sprint = true;
    const ux0 = kcc.pLocal.x, uy0 = kcc.pLocal.y, uz0 = kcc.pLocal.z;
    for (let i = 0; i < 90; i++) kcc.integrateTick(1 / 60);
    const ddx = kcc.pLocal.x - ux0, ddy = kcc.pLocal.y - uy0, ddz = kcc.pLocal.z - uz0;
    S.uphillNet = -(ddx * _vB.x + ddy * _vB.y + ddz * _vB.z); // along UPHILL
    const slideOk = t30 >= 0 && t30 <= 30 && vEnd > vMid && downDot > 0.9 * Math.hypot(dx, dy, dz);
    const blockOk = S.uphillNet < 0.3;
    ok = ok && slideOk && blockOk;
    results.push(
      `${steep.slopeDeg.toFixed(0)}° slope: slide initiated at tick ${t30}, accelerated ` +
      `${vEnd.toFixed(1)} m/s downhill (displacement 100% downhill: ` +
      `${(downDot / (Math.hypot(dx, dy, dz) || 1)).toFixed(2)}); uphill SPRINT net progress ` +
      `${S.uphillNet.toFixed(2)} m in 1.5 s (unimpeded would be 12 m) — dual step rule blocks`);
  } else { ok = false; results.push('steep site not found'); }


  // (c) Cliff face: fully blocked, penetration-free.
  if (cliff !== null) {
    kcc.teleportSurface(cliff.x, cliff.y, cliff.z);
    downhillAt(cliff, _vB);
    kcc.fwd.x = -_vB.x; kcc.fwd.y = -_vB.y; kcc.fwd.z = -_vB.z;
    const inp = kcc.input;
    inp.moveF = 1; inp.sprint = true;
    const cx0 = kcc.pLocal.x, cy0 = kcc.pLocal.y, cz0 = kcc.pLocal.z;
    for (let i = 0; i < 90; i++) kcc.integrateTick(1 / 60);
    const cdx = kcc.pLocal.x - cx0, cdy = kcc.pLocal.y - cy0, cdz = kcc.pLocal.z - cz0;
    S.cliffNet = -(cdx * _vB.x + cdy * _vB.y + cdz * _vB.z);
    const cliffOk = S.cliffNet < 0.5 && kcc.integrity.minAGL > -0.05;
    ok = ok && cliffOk;
    results.push(
      `${cliff.slopeDeg.toFixed(0)}° cliff: net uphill progress ${S.cliffNet.toFixed(2)} m ` +
      `over 1.5 s of sprint into the face (min AGL ` +
      `${kcc.integrity.minAGL === Number.POSITIVE_INFINITY ? 'n/a (never airborne)' : kcc.integrity.minAGL.toFixed(3)} m — ` +
      `penetration-free)`);
  } else { ok = false; results.push('cliff site not found'); }


  S.ok = ok;
  // RESTORE the canonical field before returning to the frame loop.
  initTerrainField(TEST_PLANET);
  kcc.teleportSurface(FLAT_SITE.x, FLAT_SITE.y, FLAT_SITE.z);
  return { pass: ok, detail: results.join(' · ') + ' (engineered field swapped + restored inside one synchronous block).' };
}


function runHeadlessSuite(): void {
  if (suite.started) return;
  suite.started = true;
  const results: Partial<Record<TestKey, TestResult>> = {};
  results['face-walk'] = runFaceWalk();
  results['coriolis'] = runCoriolisJump();
  results['state-machine'] = runStateMachine();
  results['zero-gc'] = runZeroGcBurn();
  results['slope-step'] = runSlopeStep();
  publishSuite({ results });
}


/* ============================================================================
 * 9. TREK (live integration row) — 20 s at 4× following the corner circle.
 * ==========================================================================*/
const trek = {
  active: false, elapsed: 0, rebases0: 0, recv0: 0, geoMin: Number.POSITIVE_INFINITY,
  geoMax: 0, offsetErrMax: 0, writeThroughMisses: 0, frames: 0,
  rebases: 0, received: 0,
};
let deltaLatticeOk = true;
core.onRebase((ev) => {
  if (ev.delta.x % 256 !== 0 || ev.delta.y % 256 !== 0 || ev.delta.z % 256 !== 0) {
    deltaLatticeOk = false;
  }
});


function finishTrek(): void {
  trek.active = false;
  const rebases = core.stats.rebaseCount - trek.rebases0;
  const received = pool.counters.received - trek.recv0;
  const geoConst = trek.geoMin === trek.geoMax && trek.geoMin > 0;
  const localsOk = core.stats.focusMaxLocalPostTick <= 1032;
  const pass = rebases >= 3 && received >= 3 && geoConst && localsOk &&
    deltaLatticeOk && trek.offsetErrMax <= 1e-9 && trek.writeThroughMisses === 0;
  const results = { ...suiteState.results } as Record<TestKey, TestResult>;
  results['integration'] = {
    pass,
    detail:
      `20 s live trek at 4× (80 s sim, ~4.8 km absolute incl. the 52 m/s transport): ` +
      `${rebases} origin shifts (every Δ an exact multiple of 256, f32-exact); ` +
      `${received} chunks streamed through the M1C pool; renderer geometries constant ` +
      `at ${trek.geoMin} (min === max); astronaut f32 locals max ` +
      `${core.stats.focusMaxLocalPostTick.toFixed(0)} m ≤ 1,032; spinning terrain group ` +
      `tracked −O to ${trek.offsetErrMax.toExponential(0)} m; entity write-through ` +
      `verbatim (${trek.writeThroughMisses} misses). Zero locked files modified — the ` +
      `M1C pool rides the spin purely as a parent-group transform.`,
  };
  publishSuite({ results, done: true });
  const all = (Object.values(results) as TestResult[]).every((r) => r?.pass);
  console.log(`[Milestone1E] acceptance ${all ? 'PASSED' : 'FAILED'}`);
}


/* ============================================================================
 * 10. SCENE COMPONENT
 * ==========================================================================*/
const _qSpin = new THREE.Quaternion();
const _qFrame = new THREE.Quaternion();
const _qWorld = new THREE.Quaternion();
const _qPitch = new THREE.Quaternion();
const _camPos = new THREE.Vector3();
const _camTgt = new THREE.Vector3();
const _camUp = new THREE.Vector3();
const _boom = new THREE.Vector3();
const _boomDir = new THREE.Vector3();
const _f64q: Quat = { x: 0, y: 0, z: 0, w: 1 };
const _pf: Vec3 = { x: 0, y: 0, z: 0 };
const frameStats = { frames: 0, ms: 0 };
type Phase = 'WARMUP' | 'HEADLESS' | 'TREK' | 'DONE';
const script = { phase: 'WARMUP' as Phase, warm: 0, headlessArmed: false };


function Scene() {
  const { scene } = useThree();
  const primed = useRef(2);


  useEffect(() => {
    pool.attach(spinGroup as unknown as THREE.Scene);
    adapter.bind(ASTRO_ID, astroMesh);
    pool.primeAll();
    primed.current = 2;
    return () => { adapter.unbind(ASTRO_ID); };
  }, [scene]);


  useFrame((state, delta) => {
    if (primed.current > 0) {
      primed.current--;
      if (primed.current === 0) pool.unprimeAll();
    }
    const dt = delta > 0.1 ? 0.1 : delta;
    const nowMs = performance.now();
    let ts = 1;


    /* -- phase machine ---------------------------------------------------- */
    if (script.phase === 'WARMUP') {
      script.warm += dt;
      // Autopilot: slow walk in circles (warms steering + neighboring chunks).
      kcc.input.moveF = 0.55; kcc.input.moveR = 0;
      kcc.input.sprint = false; kcc.input.crouch = false;
      kcc.input.turnRate = 0.5;
      if ((pool.activeCount() >= 45 && script.warm > 3.5) || script.warm > 8) {
        script.phase = 'HEADLESS';
      }
    } else if (script.phase === 'HEADLESS') {
      if (!script.headlessArmed) {
        script.headlessArmed = true;   // label renders this frame; block next
      } else {
        runHeadlessSuite();            // ~2–5 s synchronous (rows R1–R5)
        kcc.teleportSurface(T1_START.x, T1_START.y, T1_START.z);
        trek.rebases0 = core.stats.rebaseCount;
        trek.recv0 = pool.counters.received;
        trek.active = true;
        script.phase = 'TREK';
        trek.elapsed = 0;
      }
    } else if (script.phase === 'TREK') {
      ts = 4;
      trek.elapsed += dt;
      // Scripted trek: sprint along the corner great circle.
      const p = kcc.pLocal;
      const l = Math.hypot(p.x, p.y, p.z);
      _pf.x = GC_C.y * (p.z / l) - GC_C.z * (p.y / l);
      _pf.y = GC_C.z * (p.x / l) - GC_C.x * (p.z / l);
      _pf.z = GC_C.x * (p.y / l) - GC_C.y * (p.x / l);
      const tl = Math.hypot(_pf.x, _pf.y, _pf.z);
      const a = signedAngleAbout(kcc.fwd.x, kcc.fwd.y, kcc.fwd.z,
        _pf.x / tl, _pf.y / tl, _pf.z / tl, kcc.up.x, kcc.up.y, kcc.up.z);
      kcc.input.moveF = 1; kcc.input.moveR = 0;
      kcc.input.sprint = true; kcc.input.crouch = false;
      kcc.input.turnRate = Math.max(-2, Math.min(2, a * 3));
      if (trek.elapsed >= 20) finishTrek(), (script.phase = 'DONE');
    } else {
      readUserInput();
    }


    /* -- look input (exact per-frame deltas) -------------------------------- */
    if (script.phase === 'DONE' && !userPaused) {
      const yaw = mouseDX * SENS, pitch = -mouseDY * SENS;
      mouseDX = 0; mouseDY = 0;
      if (camFirstPerson) {
        kcc.autoTurnEnabled = false;
        kcc.lookYawDelta = yaw;
        cam.pitch = Math.max(-1.45, Math.min(1.45, cam.pitch + pitch));
      } else {
        kcc.autoTurnEnabled = true;
        cam.yawOffset -= yaw;   // orbit the camera, not the character
        cam.yawOffset = ((cam.yawOffset + Math.PI) % (Math.PI * 2) + Math.PI * 2)
          % (Math.PI * 2) - Math.PI;
        cam.pitch = Math.max(-1.2, Math.min(1.2, cam.pitch + pitch));
      }
    } else { mouseDX = 0; mouseDY = 0; }


    /* -- (1) astronaut physics + (2) M1A core, in lockstep ------------------ */
    if (!userPaused) {
      kcc.update(dt * ts, 5);
      core.advance(dt * ts);
    }


    /* -- (3)(4)(5) render extract ------------------------------------------- */
    adapter.update();
    const o = core.getOrigin();
    spinGroup.position.set(-o.x, -o.y, -o.z);
    spinQuatInto(kcc.spinPhase, _f64q);
    _qSpin.set(_f64q.x, _f64q.y, _f64q.z, _f64q.w);
    spinGroup.quaternion.copy(_qSpin);
    kcc.frameQuatInto(_f64q);
    _qFrame.set(_f64q.x, _f64q.y, _f64q.z, _f64q.w);
    _qWorld.copy(_qSpin).multiply(_qFrame);
    astroMesh.quaternion.copy(_qWorld);


    if (trek.active) {
      trek.frames++;
      const offErr = Math.abs(spinGroup.position.x + o.x) +
        Math.abs(spinGroup.position.y + o.y) + Math.abs(spinGroup.position.z + o.z);
      if (offErr > trek.offsetErrMax) trek.offsetErrMax = offErr;
      if (astroState.absPos.x !== kcc.absPos.x ||
        astroState.absPos.y !== kcc.absPos.y ||
        astroState.absPos.z !== kcc.absPos.z) trek.writeThroughMisses++;
    }


    /* -- (6) camera ---------------------------------------------------------- */
    const lp = astroState.localPosF32;
    const t = kcc.telemetry;
    _camUp.set(0, 1, 0).applyQuaternion(_qWorld);
    if (camFirstPerson) {
      _qPitch.setFromAxisAngle(new THREE.Vector3(0, 0, 1).applyQuaternion(_qWorld)
        .normalize(), cam.pitch);
      state.camera.quaternion.copy(_qWorld).multiply(_qPitch);
      _camPos.set(0, t.eyeHeight, 0).applyQuaternion(_qWorld);
      state.camera.position.set(lp[0] + _camPos.x, lp[1] + _camPos.y, lp[2] + _camPos.z);
    } else {
      // TP orbit: offset back from the character, yaw about up, pitch about right.
      _boomDir.set(-1, 0, 0).applyQuaternion(_qWorld);   // behind
      rotateAboutAxisInto(_boomDir.x, _boomDir.y, _boomDir.z,
        _camUp.x, _camUp.y, _camUp.z, -cam.yawOffset, _pf);
      _boomDir.set(_pf.x, _pf.y, _pf.z);
      const rx = _boomDir.y * _camUp.z - _boomDir.z * _camUp.y;
      const ry = _boomDir.z * _camUp.x - _boomDir.x * _camUp.z;
      const rz = _boomDir.x * _camUp.y - _boomDir.y * _camUp.x;
      rotateAboutAxisInto(_boomDir.x, _boomDir.y, _boomDir.z, rx, ry, rz,
        -cam.pitch, _pf);
      let dist = cam.dist;
      // Boom terrain clamp (4 samples, planet-frame field evals).
      for (let s = 1; s <= 4; s++) {
        const f = (s / 4) * cam.dist;
        const wx = lp[0] + _pf.x * f + _camUp.x * t.eyeHeight;
        const wy = lp[1] + _pf.y * f + _camUp.y * t.eyeHeight;
        const wz = lp[2] + _pf.z * f + _camUp.z * t.eyeHeight;
        const ax = wx + o.x, ay = wy + o.y, az = wz + o.z;
        const r = Math.hypot(ax, ay, az);
        if (r < R + 900 + 64) {
          rotateByQuatConjInto(_f64q, ax / r, ay / r, az / r, _pf2);
          if (r - (R + terrainHeight(_pf2.x, _pf2.y, _pf2.z)) < 0.3) {
            dist = Math.min(dist, f - 0.3);
            break;
          }
        }
      }
      if (dist < 1.2) dist = 1.2;
      _camPos.set(lp[0] + _camUp.x * t.eyeHeight + _pf.x * dist,
        lp[1] + _camUp.y * t.eyeHeight + _pf.y * dist,
        lp[2] + _camUp.z * t.eyeHeight + _pf.z * dist);
      state.camera.position.copy(_camPos);
      _camTgt.set(lp[0] + _camUp.x * 1.4, lp[1] + _camUp.y * 1.4, lp[2] + _camUp.z * 1.4);
      state.camera.up.copy(_camUp);
      state.camera.lookAt(_camTgt);
    }


    /* -- (7) M1C streaming with the PLANET-FRAME camera ---------------------- */
    rotateByQuatConjInto(_f64q, kcc.absPos.x, kcc.absPos.y, kcc.absPos.z, _pf);
    camPlanet.x = _pf.x; camPlanet.y = _pf.y; camPlanet.z = _pf.z;
    if (!userPaused) {
      updateController();
      pool.pump();
    }


    /* -- metrics + throttled telemetry ---------------------------------------- */
    if (script.phase !== 'HEADLESS' || !script.headlessArmed) {
      const geo = state.gl.info.memory.geometries;
      if (primed.current === 0) {
        if (trek.active || script.phase === 'DONE' || script.phase === 'WARMUP') {
          if (geo < trek.geoMin) trek.geoMin = geo;
          if (geo > trek.geoMax) trek.geoMax = geo;
        }
      }
    }
    const frameMs = delta * 1000;
    frameStats.frames++; frameStats.ms += frameMs;
    if (frameStats.frames >= 30) {
      tele.fps = (frameStats.frames * 1000) / Math.max(frameStats.ms, 1e-6);
      tele.frameMs = frameStats.ms / frameStats.frames;
      frameStats.frames = 0; frameStats.ms = 0;
    }
    if (nowMs - lastTeleMs >= 100) {
      lastTeleMs = nowMs;
      tele.mode = t.mode; tele.grounded = t.grounded; tele.crouched = t.crouched;
      tele.relSpeed = t.relSpeed; tele.slideSpeed = t.slideSpeed;
      tele.transport = t.transportSpeed; tele.absSpeed = t.absSpeed;
      tele.altMSL = t.altMSL; tele.altAGL = t.altAGL; tele.slope = t.slopeDeg;
      tele.face = t.currentFace;
      tele.upX = t.upX; tele.upY = t.upY; tele.upZ = t.upZ;
      tele.gX = t.gravX; tele.gY = t.gravY; tele.gZ = t.gravZ; tele.gMag = t.gravMag;
      tele.rcs = t.rcsBudget; tele.spin = t.spinPhase; tele.day = t.dayFraction;
      tele.originX = o.x; tele.originY = o.y; tele.originZ = o.z;
      tele.rebases = core.stats.rebaseCount;
      tele.localMax = core.stats.focusMaxLocalPostTick;
      tele.active = pool.activeCount(); tele.pending = pool.pendingCount();
      tele.inFlight = pool.inFlightTotal();
      tele.geometries = state.gl.info.memory.geometries;
      tele.heapMB = heapApi !== null ? heapApi.usedJSHeapSize / 1048576 : 0;
      tele.phase = script.phase;
      tele.version++;
      teleListeners.forEach((l) => l());
    }
  });


  return <primitive object={sceneRoot} />;
}
const _pf2: Vec3 = { x: 0, y: 0, z: 0 };


/* ============================================================================
 * 11. HUD
 * ==========================================================================*/
const TEST_ORDER: Array<{ id: TestKey; label: string }> = [
  { id: 'face-walk', label: 'Face-boundary walk: stable orientation, no yaw snaps' },
  { id: 'slope-step', label: 'Slope sliding & step-up/block behave predictably' },
  { id: 'state-machine', label: 'Gravity state machine (Zero-G / Vehicle / Surface)' },
  { id: 'zero-gc', label: 'KCC-tick burn: state identity + no NaN (allocation: Node gate)' },
  { id: 'coriolis', label: 'SPEC: Coriolis jump — lands west, settles, no skating' },
  { id: 'integration', label: 'M1A Floating Origin + M1C streaming integration' },
];


function AstroPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  const modeChip = tele.mode === 'SURFACE'
    ? (tele.grounded ? 'chip' : 'chip run') : tele.mode === 'ZERO-G' ? 'chip warn' : 'chip';
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">ASTRONAUT</span>
        <span className={modeChip}>
          {tele.mode}{tele.mode === 'SURFACE' ? (tele.grounded ? ' · GROUND' : ' · AIR') : ''}
        </span>
      </div>
      <div className="kv"><span className="k">REF FRAME</span><span className="v">{tele.mode} (planet-fixed, Ω = 0.0104)</span></div>
      <div className="kv"><span className="k">SPEED REL / TRANSPORT</span><span className="v">{tele.relSpeed.toFixed(2)} / {tele.transport.toFixed(1)} m/s</span></div>
      <div className="kv"><span className="k">ABS SPEED / SLIDE</span><span className="v">{tele.absSpeed.toFixed(1)} / {tele.slideSpeed.toFixed(2)} m/s</span></div>
      <div className="kv"><span className="k">ALT MSL / AGL</span><span className="v">{tele.altMSL.toFixed(0)} / {tele.altAGL.toFixed(1)} m</span></div>
      <div className="kv"><span className="k">SLOPE / CUBE FACE</span><span className="v">{tele.slope.toFixed(1)}° · F{tele.face}</span></div>
      <div className="kv"><span className="k">SURFACE NORMAL (up)</span><span className="v">{tele.upX.toFixed(3)} / {tele.upY.toFixed(3)} / {tele.upZ.toFixed(3)}</span></div>
      <div className="kv"><span className="k">GRAVITY |g|</span><span className="v">{tele.gMag.toFixed(3)} m/s² ({tele.gX.toFixed(2)}, {tele.gY.toFixed(2)}, {tele.gZ.toFixed(2)})</span></div>
      <div className="kv"><span className="k">RCS PACK</span><span className="v">{tele.rcs.toFixed(1)} / 25 m/s Δv</span></div>
      <div className="kv"><span className="k">SPIN θ / DAY</span><span className="v">{((tele.spin * 180) / Math.PI).toFixed(1)}° · {(tele.day * 100).toFixed(0)}%</span></div>
    </div>
  );
}


function SystemsPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">ORIGIN · STREAMING · MEMORY</span></div>
      <div className="kv"><span className="k">FPS / FRAME</span><span className="v">{tele.fps.toFixed(0)} · {tele.frameMs.toFixed(2)} ms</span></div>
      <div className="kv"><span className="k">ORIGIN O</span><span className="v">{tele.originX} / {tele.originY} / {tele.originZ}</span></div>
      <div className="kv"><span className="k">REBASES / MAX LOCAL</span><span className="v">{tele.rebases} · {tele.localMax.toFixed(0)} m</span></div>
      <div className="kv"><span className="k">CHUNKS ACT/PEND/FLY</span><span className="v">{tele.active} / {tele.pending} / {tele.inFlight}</span></div>
      <div className="kv"><span className="k">GL GEOMETRIES / HEAP</span><span className="v">{tele.geometries} · {tele.heapMB > 0 ? `${tele.heapMB.toFixed(1)} MB` : 'N/A'}</span></div>
      <div className="kv"><span className="k">SEQUENCE</span><span className="v">{tele.phase}{userPaused ? ' · PAUSED' : ''}</span></div>
    </div>
  );
}


function SuitePanel() {
  useSyncExternalStore(subSuite, () => suiteState.version);
  const results = suiteState.results;
  const done = suiteState.done;
  const entries = TEST_ORDER.filter((e) => results[e.id] !== undefined);
  const passed = done && TEST_ORDER.every((e) => results[e.id]?.pass === true);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">AUTOMATED ACCEPTANCE</span>
        <span className={done ? (passed ? 'chip pass' : 'chip fail') : 'chip run'}>
          {done ? (passed ? 'ALL PASS' : 'FAIL')
            : entries.length > 0 ? `${entries.length}/6 DONE` : 'PENDING'}
        </span>
      </div>
      <div className="test-list">
        {TEST_ORDER.map((e) => {
          const r = results[e.id];
          return (
            <div className="test-row" key={e.id}>
              <div className="test-top">
                <span className={r ? (r.pass ? 'badge pass' : 'badge fail') : 'badge run'}>
                  {r ? (r.pass ? 'PASS' : 'FAIL') : '·····'}
                </span>
                <span className="test-label">{e.label}</span>
              </div>
              <div className={r ? 'test-detail' : 'test-detail dim'}>
                {r ? r.detail : 'warmup → headless suite → live trek…'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


function Hud() {
  return (
    <>
      <div className="hud-col left">
        <AstroPanel />
        <SystemsPanel />
      </div>
      <div className="hud-col right">
        <SuitePanel />
      </div>
    </>
  );
}


/* ============================================================================
 * 12. ROOT
 * ==========================================================================*/
const M1E_CSS = `
.m1e-root { position: fixed; inset: 0; overflow: hidden; background: #04070c;
  font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  color: #cfe0ee; }
.m1e-canvas { position: absolute; inset: 0; }
.hud-col { position: absolute; top: 14px; display: flex; flex-direction: column;
  gap: 10px; width: 348px; pointer-events: none; }
.hud-col.left { left: 14px; }
.hud-col.right { right: 14px; }
.panel { pointer-events: auto; background: rgba(8, 15, 24, 0.84);
  border: 1px solid rgba(96, 160, 205, 0.22); border-radius: 10px;
  padding: 11px 13px; backdrop-filter: blur(10px); }
.panel-head { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; gap: 8px; }
.panel-title { font-size: 10.5px; letter-spacing: 0.14em; color: #7fd4ff; }
.kv { display: flex; justify-content: space-between; font-size: 11.5px;
  margin-top: 3px; gap: 10px; }
.k { color: #6f8ba3; letter-spacing: 0.05em; }
.v { color: #e8f2fa; text-align: right; }
.chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.08em;
  color: #7fd4ff; border: 1px solid rgba(127, 212, 255, 0.4); white-space: nowrap; }
.chip.warn { color: #ffd08a; border-color: rgba(255, 176, 84, 0.55); }
.chip.pass { color: #4fd08a; border-color: rgba(79, 208, 138, 0.5); }
.chip.fail { color: #ff7a6e; border-color: rgba(255, 122, 110, 0.5); }
.chip.run { color: #e8b34b; border-color: rgba(232, 179, 75, 0.5); }
.test-list { display: flex; flex-direction: column; gap: 8px; }
.test-top { display: flex; align-items: center; gap: 9px; }
.badge { font-size: 9.5px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.1em;
  min-width: 48px; text-align: center; }
.badge.pass { color: #0a1510; background: #4fd08a; }
.badge.fail { color: #1a0b09; background: #ff7a6e; }
.badge.run { color: #e8b34b; border: 1px solid rgba(232, 179, 75, 0.5); }
.test-label { font-size: 11px; color: #dce9f4; }
.test-detail { font-size: 9.5px; color: #8aa4ba; margin-top: 2px; padding-left: 60px;
  line-height: 1.45; }
.dim { color: #587187; }
.legend { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: #587187; letter-spacing: 0.08em; pointer-events: none;
  text-align: center; }
`;


export default function Milestone1ETestHarness() {
  return (
    <div
      className="m1e-root"
      onClick={() => {
        const c = document.querySelector('canvas');
        if (c !== null && document.pointerLockElement === null) {
          c.requestPointerLock();
        }
      }}
    >
      <style>{M1E_CSS}</style>
      <div className="m1e-canvas">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 62, near: 0.1, far: 42000, position: [6000, 1500, 3000] }}
        >
          <color attach="background" args={[0x060a10]} />
          <fog attach="fog" args={[0x070b12, 300, 7000]} />
          <Scene />
        </Canvas>
      </div>
      <Hud />
      <div className="legend">
        CLICK TO LOCK MOUSE · WASD MOVE · SHIFT SPRINT · C CROUCH · SPACE JUMP · MOUSE LOOK · V CAM TP/FP · T ZERO-G DROP (RCS: WASD/SPACE/C + MOUSE) · R RESET · P PAUSE — 52 m/s EQUATOR SPIN · PARALLEL-TRANSPORT FRAME · ANALYTIC KCC
      </div>
    </div>
  );
}
