/**
 * ============================================================================
 *  MILESTONE 1D — FLIGHT DYNAMICS & AERODYNAMIC GOVERNOR (R3F HARNESS)
 * ============================================================================
 *  SCENARIO: interactive + scripted flight over the M1C Earth-scale planet
 *  (R = 5,000 m, μ = 9.81·5000², ρ0 = 1.225, H_s = 1,200 m, H_atm = 8 km).
 *
 *  PIPELINE (per frame — M1A canonical order preserved, zero locked files
 *  modified):
 *    1. flightController.update(dt)  — Spec 01.1 steps 5–7 (f64 kinematic
 *       ship; write-through into the M1A entity's absPos/velocity)
 *    2. core.advance(dt)             — M1A/M1B: macro rails, 256 m lattice
 *       rebasing on the ship (focus entity), f32 local extraction
 *    3. adapter.update()             — ship mesh at f32 locals
 *    4. terrainGroup.position = −O   — the SAME exact Δ applied to all M1C
 *       terrain chunks in the same frame (seamless rebase proof)
 *    5. M1C LOD controller + pool.pump() with the ABSOLUTE f64 ship position
 *
 *  AUTOMATED SEQUENCE (auto-arms after streaming warmup):
 *    DIVE  — the SPEC-CANONICAL M1D gate: teleport to 10 km, dive straight
 *            down at 2,000 m/s, chunk streaming FROZEN (the "worker delay"
 *            is the entire dive): governor must force <= 400 m/s by 1,000 m
 *            altitude; DDA must prevent any terrain penetration.
 *    CRUISE— 30 s autopilot cruise ~320 m/s at 2,500 m MSL with streaming
 *            active: exercises M1A rebasing + M1C pooling in flight.
 *    BURN  — 20,000 synchronous ticks on a headless controller: identity
 *            canary + heap-delta zero-GC proof.
 *
 *  ACCEPTANCE ROWS:
 *   [T1] Atmosphere model: monotone C∞ decay to vacuum, sound speed, Mach,
 *        and the rotating-atmosphere wind law (52 m/s equator unit check).
 *   [T2] Governor dive (Spec 05): <= 400 m/s @ 1,000 m; never below terrain
 *        with streaming frozen; grounded contact resolved analytically.
 *   [T3] Drag continuity: no hard clamping — airborne per-tick |Δv| bounded,
 *        zero velocity reversals, speed trace crosses 400 smoothly.
 *   [T4] State identity + no NaN over the physics-tick burn (allocation is
 *        gated in Node by tools/test-alloc-loops.mjs — F1bcb, ADR-005).
 *   [T5] M1A/M1C integration: rebases fire, geometries absolutely constant,
 *        chunks stream, ship f32 locals <= 1,024 m, terrain offset exact.
 */


import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SimulationCore } from '../core/simulation/SimulationCore';
import { FloatingOriginAdapter } from '../render/FloatingOriginAdapter';
import {
  GRID_N, TEST_PLANET, initTerrainField, terrainHeight,
  chunkArcWidth, chunkKey, gridCoord,
} from '../core/terrain/terrainField';
import { faceCubePointInto, spherifyInto, type Vec3Out } from '../core/terrain/spherify';
import { mulberry32 } from '../core/terrain/noise';
import { TerrainMeshPool } from '../render/TerrainMeshPool';
import {
  EARTHSCALE_FLIGHT, FlightController, quatFromBasisInto, type Quat,
} from '../core/physics/flightController';
import {
  EARTHSCALE_ATMOSPHERE, atmosphereVelocityInto, densityAt, machNumber,
  speedOfSoundAt, type Vec3Out as AVec3,
} from '../core/physics/atmosphere';


/* ============================================================================
 * 1. DEV-TIME PATCHES — dispose / scene.remove call counters
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
 * 2. BOOT SINGLETONS (all allocation sanctioned HERE, never in the loop)
 * ==========================================================================*/
const R = TEST_PLANET.radius;
initTerrainField(TEST_PLANET);


const core = new SimulationCore();
const adapter = new FloatingOriginAdapter(core);


const MESH_COUNT = 144;
const WORKER_COUNT = 2;
const WORKER_POOL_SETS = 96;
const pool = new TerrainMeshPool({
  meshCount: MESH_COUNT,
  workerCount: WORKER_COUNT,
  workerPoolSets: WORKER_POOL_SETS,
  maxBatch: 6,
  inFlightPerWorker: 12,
  params: TEST_PLANET,
});


const flight = new FlightController(EARTHSCALE_FLIGHT);
const burnCtrl = new FlightController(EARTHSCALE_FLIGHT); // headless (T4)


/* -- scripted-sequence fixed start states (computed once, boot) ------------ */
function normalizedInto(x: number, y: number, z: number, out: Vec3Out): Vec3Out {
  const l = Math.sqrt(x * x + y * y + z * z);
  out.x = x / l; out.y = y / l; out.z = z / l;
  return out;
}
const cruiseDir: Vec3Out = normalizedInto(0.58, 0.42, 0.70, { x: 0, y: 0, z: 0 });
const cruiseTan: Vec3Out = normalizedInto(-cruiseDir.z, 0, cruiseDir.x, { x: 0, y: 0, z: 0 });
const CRUISE_ALT = 2500;
const CRUISE_SPEED = 320;
const _bootQ: Quat = { x: 0, y: 0, z: 0, w: 1 };
function setCruiseState(c: FlightController): void {
  quatFromBasisInto(cruiseTan.x, cruiseTan.y, cruiseTan.z,
    cruiseDir.x, cruiseDir.y, cruiseDir.z, _bootQ);
  c.teleport(
    cruiseDir.x * (R + CRUISE_ALT), cruiseDir.y * (R + CRUISE_ALT), cruiseDir.z * (R + CRUISE_ALT),
    cruiseTan.x * CRUISE_SPEED, cruiseTan.y * CRUISE_SPEED, cruiseTan.z * CRUISE_SPEED,
    _bootQ,
  );
  c.input.pitch = 0; c.input.roll = 0; c.input.yaw = 0; c.input.throttle = 0.9;
}
setCruiseState(flight);


/* -- ship entity in the M1A core (kinematic: the controller owns motion) -- */
const SHIP_ID = 'm1d-ship';
const shipState = core.registerEntity(SHIP_ID, {
  absPos: { x: flight.pos.x, y: flight.pos.y, z: flight.pos.z },
  velocity: { x: flight.vel.x, y: flight.vel.y, z: flight.vel.z },
  dynamic: false, // Spec 01.3: kinematic body in the f64 core
});
core.setFocusEntity(SHIP_ID);
flight.attachWriteThrough(shipState.absPos, shipState.velocity);


/* -- headless burn start over low terrain (deterministic search at boot) -- */
const burnDir: Vec3Out = { x: 0, y: 0, z: 0 };
(function findBurnSite(): void {
  const cand: Vec3Out = { x: 0, y: 0, z: 0 };
  for (let k = 0; k < 256; k++) {
    const a = k * 2.399963229728653; // golden-angle spiral
    normalizedInto(Math.cos(a) * (0.9 - 0.7 * (k / 256)), 0.35 + 0.5 * (k / 256), Math.sin(a) * (0.9 - 0.7 * (k / 256)), cand);
    if (terrainHeight(cand.x, cand.y, cand.z) < 120) {
      burnDir.x = cand.x; burnDir.y = cand.y; burnDir.z = cand.z;
      return;
    }
  }
  burnDir.x = 0; burnDir.y = 1; burnDir.z = 0;
})();
const burnTan: Vec3Out = normalizedInto(-burnDir.z, 0, burnDir.x, { x: 0, y: 0, z: 0 });
quatFromBasisInto(burnTan.x, burnTan.y, burnTan.z, burnDir.x, burnDir.y, burnDir.z, _bootQ);
burnCtrl.teleport(
  burnDir.x * (R + 600), burnDir.y * (R + 600), burnDir.z * (R + 600),
  burnTan.x * 260, burnTan.y * 260, burnTan.z * 260, _bootQ,
);


/* ============================================================================
 * 3. M1C QUADTREE + LOD CONTROLLER (reused; camera = absolute f64 ship pos)
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
          const width = chunkArcWidth(L);
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy] = {
            face: f, level: L, ix, iy, key: chunkKey(f, L, ix, iy),
            cx: dir.x, cy: dir.y, cz: dir.z,
            ox: dir.x * rr, oy: dir.y * rr, oz: dir.z * rr,
            width, brad: width * 0.75 + HEIGHT_SLACK,
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


const camPos = { x: 0, y: 0, z: 0 };
let camUX = 0, camUY = 0, camUZ = 0, horizonDot = 0;
const candNodes: QNode[] = [];
const candDist = new Float64Array(64);
let candCount = 0;


function clearSubtree(n: QNode): void {
  n.desired = false;
  if (n.level < MAX_LEVEL) {
    for (let c = 0; c < 4; c++) clearSubtree(childOf(n, c));
  }
}
function visitNode(n: QNode): boolean {
  const vis =
    n.ox * camUX + n.oy * camUY + n.oz * camUZ + n.brad >= horizonDot - HORIZON_MARGIN;
  if (!vis) { clearSubtree(n); return false; }
  const dx = camPos.x - n.ox, dy = camPos.y - n.oy, dz = camPos.z - n.oz;
  const dNode = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const splitD = SPLIT_K * n.width;
  if (n.split && dNode > MERGE_K * splitD) n.split = false;
  if (!n.split && n.level < MAX_LEVEL && dNode < splitD) n.split = true;
  if (n.split && n.level < MAX_LEVEL) {
    let any = false;
    for (let c = 0; c < 4; c++) { if (visitNode(childOf(n, c))) any = true; }
    n.desired = !any;
    return true;
  }
  n.desired = true;
  if (n.activeRec < 0 && n.pendingRec < 0 && candCount < 64) {
    candNodes[candCount] = n;
    candDist[candCount] = dNode;
    candCount++;
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
  const camR = Math.sqrt(camPos.x * camPos.x + camPos.y * camPos.y + camPos.z * camPos.z);
  camUX = camPos.x / camR; camUY = camPos.y / camR; camUZ = camPos.z / camR;
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
        for (let c = 0; c < 4; c++) {
          if (nodeHasData(childOf(node, c))) { childData = true; break; }
        }
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
      } else {
        rec.unwanted = 0;
      }
    }
  }
  for (let a = 1; a < candCount; a++) {
    const d = candDist[a];
    const n = candNodes[a];
    let b = a - 1;
    while (b >= 0 && candDist[b] > d) {
      candDist[b + 1] = candDist[b];
      candNodes[b + 1] = candNodes[b];
      b--;
    }
    candDist[b + 1] = d;
    candNodes[b + 1] = n;
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
 * 4. STATIC SCENE CONTENT (boot-only allocation)
 * ==========================================================================*/
const sceneRoot = new THREE.Group();
const terrainGroup = new THREE.Group();       // ALL planet-fixed content; position = −O
sceneRoot.add(terrainGroup);
const sunLight = new THREE.DirectionalLight(0xfff1de, 1.9);
sunLight.position.set(0.45, 0.65, 0.61).normalize().multiplyScalar(10000);
sceneRoot.add(sunLight);
sceneRoot.add(new THREE.AmbientLight(0x33465e, 0.55));
const shellMesh = new THREE.Mesh(
  new THREE.SphereGeometry(R - 900, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x0d141c, roughness: 1 }),
);
terrainGroup.add(shellMesh);
(function stars(): void {
  const COUNT = 1400, RAD = 15000;
  const pos = new Float32Array(COUNT * 3);
  const rand = mulberry32(0x5eed1d);
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


/* -- ship model (forward = +X body) ---------------------------------------- */
const shipGroup = new THREE.Group();
const engineMat = new THREE.MeshStandardMaterial({
  color: '#9fe0ff', emissive: '#2fa8e0', emissiveIntensity: 0.6, roughness: 0.3,
});
(function buildShip(): void {
  const hull = new THREE.MeshStandardMaterial({ color: '#c9d6e4', metalness: 0.75, roughness: 0.32 });
  const wing = new THREE.MeshStandardMaterial({ color: '#8fa4b8', metalness: 0.6, roughness: 0.4 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 5.4, 16), hull);
  nose.rotation.z = -Math.PI / 2;
  shipGroup.add(nose);
  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 14, 10),
    new THREE.MeshStandardMaterial({
      color: '#7fd4ff', emissive: '#1e7fb8', emissiveIntensity: 1.1, roughness: 0.15,
    }),
  );
  cockpit.position.set(0.55, 0.42, 0);
  shipGroup.add(cockpit);
  const w1 = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 3.1), wing);
  w1.position.set(-1.2, 0, 0);
  shipGroup.add(w1);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.3, 0.1), wing);
  fin.position.set(-1.9, 0.65, 0);
  shipGroup.add(fin);
  const engine = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), engineMat);
  engine.position.set(-2.85, 0, 0);
  shipGroup.add(engine);
  const pl = new THREE.PointLight('#7fd4ff', 30, 90, 2);
  pl.position.set(-3.4, 0, 0);
  shipGroup.add(pl);
})();
sceneRoot.add(shipGroup);


/* ============================================================================
 * 5. INPUT (keyboard; Spec 00.1 — keyboard + mouse only)
 * ==========================================================================*/
const keys: Record<string, boolean> = {};
let userPaused = false;
const IGNORED = new Set(['F5', 'F12']);
window.addEventListener('keydown', (e) => {
  if (IGNORED.has(e.key)) return;
  keys[e.code] = true;
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyP') userPaused = !userPaused;
  if (e.code === 'KeyR' && script.phase === 'DONE') {
    setCruiseState(flight);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });


function readUserInput(): void {
  const f = flight.input;
  f.pitch = (keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0);
  f.roll = (keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0);
  f.yaw = (keys['KeyD'] ? 1 : 0) - (keys['KeyA'] ? 1 : 0);
  const thr = (keys['KeyW'] ? 1 : 0) - (keys['KeyS'] ? 1 : 0);
  f.throttle = Math.max(0, Math.min(1, f.throttle + thr * 0.8 * 0.016));
}
function autopilot(targetAlt: number): void {
  const t = flight.telemetry;
  const f = flight.input;
  f.pitch = Math.max(-0.7, Math.min(0.7, -t.climbRate / 60 - (t.altMSL - targetAlt) / 300));
  f.roll = 0; f.yaw = 0; f.throttle = 0.9;
}


/* ============================================================================
 * 6. SCRIPTED SEQUENCE STATE MACHINE + ACCEPTANCE DATA CAPTURE
 * ==========================================================================*/
type Phase = 'WARMUP' | 'DIVE' | 'CRUISE' | 'BURN' | 'DONE';
const script = {
  phase: 'WARMUP' as Phase,
  warmElapsed: 0, simElapsed: 0,
  streamingFrozen: false,
  // dive capture
  diveAlt: new Float64Array(4096), diveSpeed: new Float64Array(4096), diveCount: 0,
  divePrevAlt: Number.POSITIVE_INFINITY,
  diveSpeedAt1000: -1, diveMaxSpeed: 0, diveMinPostAGL: Number.POSITIVE_INFINITY,
  diveGrounded: false, diveContactSpeed: 0, diveTicks: 0,
  // cruise capture
  cruiseRebase0: 0, cruiseRecv0: 0, cruiseRebases: 0, cruiseReceived: 0,
  // integration capture
  geoMin: Number.POSITIVE_INFINITY, geoMax: 0, offsetErrMax: 0,
};
const CK_ALTS = [8000, 6000, 4000, 3000, 2000, 1500, 1000, 500, 250];
const ckSpeed = new Float64Array(CK_ALTS.length);
let ckCount = 0;


function diveObserver(c: FlightController): void {
  const t = c.telemetry;
  if (t.grounded) return;
  if (script.divePrevAlt > 1000 && t.altMSL <= 1000 && script.diveSpeedAt1000 < 0) {
    script.diveSpeedAt1000 = t.groundSpeed;
  }
  script.divePrevAlt = t.altMSL;
  if (t.groundSpeed > script.diveMaxSpeed) script.diveMaxSpeed = t.groundSpeed;
  if (t.altMSL < 20000 && script.diveCount < script.diveAlt.length) {
    script.diveAlt[script.diveCount] = t.altMSL;
    script.diveSpeed[script.diveCount] = t.groundSpeed;
    script.diveCount++;
  }
  if (t.altAGL < script.diveMinPostAGL) script.diveMinPostAGL = t.altAGL;
}


function startDive(): void {
  quatFromBasisInto(0, -1, 0, 1, 0, 0, _bootQ); // nose straight down, up = +X
  flight.teleport(0, R + 10000, 0, 0, -2000, 0, _bootQ);
  flight.input.pitch = 0; flight.input.roll = 0; flight.input.yaw = 0;
  flight.input.throttle = 0;
  flight.resetIntegrityStats();
  script.phase = 'DIVE';
  script.simElapsed = 0;
  script.diveTicks = 0;
  script.streamingFrozen = true;          // the "worker delay" IS the dive
  script.diveCount = 0;
  script.divePrevAlt = Number.POSITIVE_INFINITY;
  script.diveSpeedAt1000 = -1;
  script.diveMaxSpeed = 0;
  script.diveMinPostAGL = Number.POSITIVE_INFINITY;
  script.diveGrounded = false;
  script.diveContactSpeed = 0;
  flight.tickObserver = diveObserver;
}


function startCruise(): void {
  flight.tickObserver = null;
  script.diveGrounded = flight.telemetry.grounded;
  script.diveContactSpeed = 0;
  setCruiseState(flight);
  script.phase = 'CRUISE';
  script.simElapsed = 0;
  script.streamingFrozen = false;
  script.cruiseRebase0 = core.stats.rebaseCount;
  script.cruiseRecv0 = pool.counters.received;
}


function runBurn(): void {
  // canary + heap before
  const canary = {
    c: burnCtrl, pos: burnCtrl.pos, vel: burnCtrl.vel, quat: burnCtrl.quat,
    ang: burnCtrl.angVel, input: burnCtrl.input, tele: burnCtrl.telemetry,
    integ: burnCtrl.integrity,
  };
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  const heap0 = mem !== undefined ? mem.usedJSHeapSize : -1;
  burnCtrl.resetIntegrityStats();
  quatFromBasisInto(burnTan.x, burnTan.y, burnTan.z, burnDir.x, burnDir.y, burnDir.z, _bootQ);
  burnCtrl.teleport(
    burnDir.x * (R + 600), burnDir.y * (R + 600), burnDir.z * (R + 600),
    burnTan.x * 260, burnTan.y * 260, burnTan.z * 260, _bootQ,
  );
  const BURN_TICKS = 20000;
  for (let k = 0; k < BURN_TICKS; k++) {
    // deterministic input program (module scalars — zero allocation)
    const f = burnCtrl.input;
    f.pitch = 0.25 * Math.sin(0.0007 * k);
    f.roll = 0.3 * Math.sin(0.00043 * k + 1);
    f.yaw = 0.1 * Math.cos(0.00031 * k);
    f.throttle = 0.55 + 0.35 * Math.sin(0.0002 * k);
    burnCtrl.integrateFlight(1 / 60);
  }
  const heap1 = mem !== undefined ? mem.usedJSHeapSize : -1;
  burnResult.identityOk =
    burnCtrl.pos === canary.pos && burnCtrl.vel === canary.vel &&
    burnCtrl.quat === canary.quat && burnCtrl.angVel === canary.ang &&
    burnCtrl.input === canary.input && burnCtrl.telemetry === canary.tele &&
    burnCtrl.integrity === canary.integ;
  burnResult.heapDelta = heap0 >= 0 ? heap1 - heap0 : -1;
  burnResult.ticks = BURN_TICKS;
  burnResult.contacts = burnCtrl.integrity.contacts;
  burnResult.nanEvents = burnCtrl.integrity.nanEvents;
  evaluateSuite();
  script.phase = 'DONE';
  setCruiseState(flight); // hand over in stable forward flight
}


const burnResult = {
  identityOk: false, heapDelta: -1, ticks: 0, contacts: 0, nanEvents: 0,
};


/* ============================================================================
 * 7. STORES (mutation + version — zero snapshot allocation)
 * ==========================================================================*/
const tele = {
  version: 0, fps: 0, frameMs: 0,
  mode: 'SUBSONIC', throttle: 0, airspeed: 0, groundSpeed: 0, climb: 0,
  altMSL: 0, altAGL: 0, mach: 0, q: 0, gLoad: 0, peakG: 0,
  rho: 0, sound: 0, vSafe: 0, governor: false, dragN: 0, dragA: 0, liftA: 0, press: 0,
  originX: 0, originY: 0, originZ: 0, rebases: 0, localMax: 0,
  active: 0, pending: 0, inFlight: 0, geometries: 0, heapMB: 0, recvRate: 0,
  ddaSamples: 0, contacts: 0,
  phase: 'WARMUP' as Phase, countdown: 0,
};
const teleListeners = new Set<() => void>();
let lastTeleMs = -1e9;
function subTele(cb: () => void): () => void { teleListeners.add(cb); return () => teleListeners.delete(cb); }


type TestKey = 'atmosphere' | 'governor-dive' | 'drag-continuity' | 'zero-gc' | 'integration';
interface TestResult { pass: boolean; detail: string; }
interface SuiteState { version: number; done: boolean; results: Partial<Record<TestKey, TestResult>>; }
let suiteState: SuiteState = { version: 0, done: false, results: {} };
const suiteListeners = new Set<() => void>();
function publishSuite(next: Partial<SuiteState>): void {
  suiteState = { ...suiteState, ...next, version: suiteState.version + 1 };
  suiteListeners.forEach((l) => l());
}
function subSuite(cb: () => void): () => void { suiteListeners.add(cb); return () => suiteListeners.delete(cb); }


/* -- rolling transfer rate -------------------------------------------------- */
const rate = { lastT: 0, recv0: 0, recv: 0 };
function updateRates(nowMs: number): void {
  if (nowMs - rate.lastT >= 1000) {
    rate.recv = pool.counters.received - rate.recv0;
    rate.recv0 = pool.counters.received;
    rate.lastT = nowMs;
  }
}


/* ============================================================================
 * 8. SUITE EVALUATION
 * ==========================================================================*/
const heapApi = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory ?? null;


function evaluateSuite(): void {
  const results: Partial<Record<TestKey, TestResult>> = {};


  /* -- T1: atmosphere model ------------------------------------------------ */
  {
    let monotone = true;
    let prev = densityAt(EARTHSCALE_ATMOSPHERE, 0);
    for (let alt = 250; alt <= 24000; alt += 250) {
      const d = densityAt(EARTHSCALE_ATMOSPHERE, alt);
      if (!(d < prev)) { monotone = false; break; }
      prev = d;
    }
    const r0 = densityAt(EARTHSCALE_ATMOSPHERE, 0);
    const r8 = densityAt(EARTHSCALE_ATMOSPHERE, 8000);
    const r24 = densityAt(EARTHSCALE_ATMOSPHERE, 24000);
    const a0 = speedOfSoundAt(EARTHSCALE_ATMOSPHERE, 0);
    const a8 = speedOfSoundAt(EARTHSCALE_ATMOSPHERE, 8000);
    const m1 = machNumber(EARTHSCALE_ATMOSPHERE, 0, a0);
    const wind: AVec3 = { x: 0, y: 0, z: 0 };
    atmosphereVelocityInto(0.0104, 5000, 0, 0, wind);
    const windMag = Math.sqrt(wind.x * wind.x + wind.y * wind.y + wind.z * wind.z);
    const pass = monotone && r0 === 1.225 && r8 <= 0.0025 && r24 < 1e-6
      && a0 > 335 && a0 < 345 && a8 < a0 && Math.abs(m1 - 1) < 1e-9
      && Math.abs(windMag - 52) < 1e-9;
    results['atmosphere'] = {
      pass,
      detail:
        `ρ(0) = ${r0} kg/m³, strictly monotone to ${r24.toExponential(1)} at 24 km ` +
        `(ρ(8 km) = ${r8.toExponential(2)} = 0.13% of surface — vacuum asymptote, ` +
        `C∞ law ρ = ρ₀e^(−h/1200), no cutoff discontinuity). a(0) = ${a0.toFixed(1)} → ` +
        `a(8 km) = ${a8.toFixed(1)} m/s; Mach(340 m/s @ SL) = ${m1.toFixed(9)}; ` +
        `rotating-atmosphere law |Ω×p| = ${windMag.toFixed(6)} m/s at the equator ` +
        `(spec's 52 m/s example, Ω = 0.0104 rad/s).`,
    };
  }


  /* -- T2: SPEC-CANONICAL GOVERNOR DIVE ------------------------------------ */
  {
    // extract checkpoints from the trace
    ckCount = 0;
    for (let a = 0; a < CK_ALTS.length; a++) {
      for (let i = 0; i < script.diveCount; i++) {
        if (script.diveAlt[i] <= CK_ALTS[a]) { ckSpeed[a] = script.diveSpeed[i]; ckCount++; break; }
      }
    }
    const v1000 = script.diveSpeedAt1000;
    const pass = v1000 > 150 && v1000 <= 400
      && script.diveMaxSpeed >= 1980
      && script.diveMinPostAGL >= -1e-6
      && script.diveGrounded
      && flight.integrity.minPostTickAGL >= -1e-6;
    results['governor-dive'] = {
      pass,
      detail:
        `2,000 m/s vertical dive from 10 km with chunk streaming FROZEN for the entire ` +
        `descent: speed at 1,000 m altitude = ${v1000 > 0 ? v1000.toFixed(1) : 'n/a'} m/s ` +
        `(gate ≤ 400; peak ${script.diveMaxSpeed.toFixed(0)} m/s — gravity overshoot ` +
        `${(script.diveMaxSpeed - 2000).toFixed(1)} m/s during exo entry, recovered by drag). ` +
        `Analytic DDA held the ship at/above the surface on every tick ` +
        `(min post-tick AGL ${Math.max(0, script.diveMinPostAGL).toFixed(2)} m); ` +
        `${script.diveGrounded ? 'ground contact resolved analytically (LANDED)' : 'contact: see trace'} ` +
        `with ${flight.integrity.contacts} contact events — zero dependence on Web Workers.`,
    };
  }


  /* -- T3: drag continuity (no hard clamping) ------------------------------ */
  {
    const maxDv = flight.integrity.maxDeltaVAirborne;
    const rev = flight.integrity.reversals;
    // smooth crossing of 400: find trace samples bracketing 400
    let crossOk = true;
    for (let i = 1; i < script.diveCount; i++) {
      const a = script.diveSpeed[i - 1], b = script.diveSpeed[i];
      if (a >= 400 && b < 400 && a - b > 8) { crossOk = false; break; }
    }
    const pass = maxDv <= 12 && rev === 0 && crossOk
      && flight.integrity.nanEvents === 0;
    results['drag-continuity'] = {
      pass,
      detail:
        `Max airborne |Δv| per tick = ${maxDv.toFixed(2)} m/s (bound 12 — peak ` +
        `entry decel ≈ 63 g ≈ 10.4 m/s per tick at the ρ·v² maximum near ` +
        `2.5–3 km, transiently above a_struct BY DESIGN while the governor ` +
        `pulls v onto v_safe; a hard clamp would show hundreds); velocity ` +
        `reversals: ${rev} (the exponential map preserves direction by construction); ` +
        `the 400 m/s crossing is smooth across consecutive trace samples; NaN events: ` +
        `${flight.integrity.nanEvents}. The 2,000 m/s hard cap is a C¹ thrust fade on ` +
        `[1,880, 2,000] — never a velocity clamp.`,
    };
  }


  /* -- T4: zero-GC physics tick -------------------------------------------- */
  {
    // WHY (F1bcb, ADR-005): the heap-delta clause is retired — usedJSHeapSize deltas hide
    // transient churn (A1-U27b2). Allocation is gated by tools/test-alloc-loops.mjs (ADR-003);
    // this row keeps only what it can really check.
    const pass = burnResult.identityOk && burnResult.nanEvents === 0;
    results['zero-gc'] = {
      pass,
      detail:
        `${burnResult.ticks.toLocaleString()} synchronous integrateFlight ticks on a headless ` +
        `controller (DDA active, ${burnResult.contacts} terrain contacts): every state object ` +
        `identity preserved ${burnResult.identityOk ? '✓' : 'FAILED'}; ` +
        `NaN events ${burnResult.nanEvents}. Per-tick allocation is not measured here: ` +
        `node --expose-gc tools/test-alloc-loops.mjs (sampling heap profiler).`,
    };
  }


  /* -- T5: M1A / M1C integration ------------------------------------------- */
  {
    const rebases = script.cruiseRebases;
    const received = script.cruiseReceived;
    const geoConst = script.geoMin === script.geoMax && script.geoMin > 0;
    const localOk = core.stats.focusMaxLocalPostTick <= 1024 + 1e-6;
    const offsetOk = script.offsetErrMax <= 1e-9;
    const pass = rebases >= 5 && received >= 40 && geoConst && localOk && offsetOk;
    results['integration'] = {
      pass,
      detail:
        `30 s cruise at ${CRUISE_SPEED} m/s: ${rebases} origin shifts (256 m lattice, ` +
        `Δ f32-exact), ${received} chunks streamed through the M1C Transferable pool, ` +
        `renderer geometries constant at ${script.geoMin} (min === max across dive + cruise ` +
        `+ burn), ship f32 locals max ${core.stats.focusMaxLocalPostTick.toFixed(1)} m ≤ 1,024, ` +
        `terrain-group offset tracks −O to ${script.offsetErrMax.toExponential(0)} m. ` +
        `Ship is a kinematic f64 entity written through to the M1A core; no locked file modified.`,
    };
  }


  publishSuite({ done: true, results });
  const allPass = (['atmosphere', 'governor-dive', 'drag-continuity', 'zero-gc', 'integration'] as TestKey[])
    .every((k) => results[k]?.pass === true);
  console.log(
    `[Milestone1D] acceptance ${allPass ? 'PASSED' : 'FAILED'} — ` +
      `v@1000m=${script.diveSpeedAt1000.toFixed(1)} maxDv=${flight.integrity.maxDeltaVAirborne.toFixed(2)} ` +
      `rebases=${script.cruiseRebases} recv=${script.cruiseReceived} geo=${script.geoMin} ` +
      `burnHeap=${burnResult.heapDelta}B`,
  );
}


/* ============================================================================
 * 9. SCENE COMPONENT — the frame loop
 * ==========================================================================*/
const _camQ = new THREE.Quaternion();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const frameStats = { frames: 0, ms: 0 };


function Scene() {
  const { scene, gl } = useThree();
  const primed = useRef(2);


  useEffect(() => {
    // pool meshes live under terrainGroup so ONE transform (position = −O)
    // rebases all planet-fixed content. (TerrainMeshPool.attach only uses
    // Object3D.add — the cast satisfies the locked M1C signature.)
    pool.attach(terrainGroup as unknown as THREE.Scene);
    adapter.bind(SHIP_ID, shipGroup);
    pool.primeAll();
    shellMesh.frustumCulled = false;   // F12: register the static shell during
    primed.current = 2;                // priming — it first enters view at the
    return () => { adapter.unbind(SHIP_ID); };  // dive nadir, after the window opens
  }, [scene, gl]);


  useFrame((state, delta) => {
    if (primed.current > 0) {
      primed.current--;
      if (primed.current === 0) {
        pool.unprimeAll();
        shellMesh.frustumCulled = true;   // F12: restore normal culling
      }
    }
    const dt = delta > 0.1 ? 0.1 : delta;
    const nowMs = performance.now();


    /* -- (1) scripted phase machine: inputs + time scale ------------------ */
    let timeScale = 1;
    if (script.phase === 'WARMUP') {
      script.warmElapsed += dt;
      autopilot(CRUISE_ALT);
      const ready = (pool.activeCount() >= 50 && script.warmElapsed > 2.5)
        || script.warmElapsed > 8;
      if (ready) startDive();
    } else if (script.phase === 'DIVE') {
      timeScale = 4;
      script.simElapsed += dt * 4;
      // WHY (F2d, ADR-009): the 45 s deadline counts PHYSICS ticks run, not requested time —
      // below ~20 fps the 0.1 s clamp + 6 substeps shed time, so a requested-time deadline
      // ended the dive airborne and T2 failed on slow machines (A1-U05-2).
      if (flight.telemetry.grounded || script.diveTicks / 60 > 45) startCruise();
    } else if (script.phase === 'CRUISE') {
      timeScale = 4;
      script.simElapsed += dt * 4;
      autopilot(CRUISE_ALT);
      if (script.simElapsed >= 30) {
        script.cruiseRebases = core.stats.rebaseCount - script.cruiseRebase0;
        script.cruiseReceived = pool.counters.received - script.cruiseRecv0;
        script.phase = 'BURN';
        runBurn(); // synchronous → evaluateSuite() → DONE
      }
    } else if ((script.phase as Phase) === 'DONE') {
      readUserInput();
    }
    const scripted = script.phase !== 'DONE' && script.phase !== 'WARMUP'
      ? (script.phase as Phase) !== 'DONE' : false;


    /* -- (2) FLIGHT (Spec 01.1 steps 5–7) ---------------------------------- */
    if (!userPaused && script.phase !== 'BURN') {
      const ran = flight.update(dt * timeScale, timeScale > 1 ? 6 : 5);
      if (script.phase === 'DIVE') script.diveTicks += ran;
    }


    /* -- (3) M1A/M1B core: rails, 256 m rebasing, f32 extract -------------- */
    if (!userPaused) core.advance(dt);


    /* -- (4) render extract: ship + terrain group offset -------------------- */
    adapter.update();
    const o = core.getOrigin();
    terrainGroup.position.set(-o.x, -o.y, -o.z);
    const offErr = Math.abs(terrainGroup.position.x + o.x)
      + Math.abs(terrainGroup.position.y + o.y)
      + Math.abs(terrainGroup.position.z + o.z);
    if (offErr > script.offsetErrMax) script.offsetErrMax = offErr;


    /* -- (5) chase camera (hard-locked to the ship local + body frame) ----- */
    const lp = shipState.localPosF32;
    _camQ.set(flight.quat.x, flight.quat.y, flight.quat.z, flight.quat.w);
    shipGroup.quaternion.copy(_camQ);
    _v1.set(-26, 9, 0).applyQuaternion(_camQ);
    state.camera.position.set(lp[0] + _v1.x, lp[1] + _v1.y, lp[2] + _v1.z);
    _v2.set(0, 1, 0).applyQuaternion(_camQ);
    state.camera.up.copy(_v2);
    _v3.set(36, 3, 0).applyQuaternion(_camQ);
    state.camera.lookAt(lp[0] + _v3.x, lp[1] + _v3.y, lp[2] + _v3.z);
    engineMat.emissiveIntensity = 0.3 + flight.input.throttle * 1.6;
    // altitude fog (mutated in place — zero allocation)
    const alt = flight.telemetry.altMSL;
    const fog = scene.fog as THREE.Fog | null;
    if (fog !== null) {
      fog.near = 500 + alt * 0.75;
      fog.far = Math.min(30000, 2600 + alt * 2.4);
    }


    /* -- (6) M1C streaming with the ABSOLUTE f64 ship position ------------- */
    camPos.x = flight.pos.x; camPos.y = flight.pos.y; camPos.z = flight.pos.z;
    if (!userPaused && !script.streamingFrozen && script.phase !== 'BURN') {
      updateController();
      pool.pump();
    }


    /* -- (7) window metrics + throttled telemetry --------------------------- */
    if (script.phase !== 'BURN') {
      const geo = state.gl.info.memory.geometries;
      if (primed.current === 0) {
        if (geo < script.geoMin) script.geoMin = geo;
        if (geo > script.geoMax) script.geoMax = geo;
      }
    }
    const frameMs = delta * 1000;
    frameStats.frames++;
    frameStats.ms += frameMs;
    if (frameStats.frames >= 30) {
      tele.fps = (frameStats.frames * 1000) / Math.max(frameStats.ms, 1e-6);
      tele.frameMs = frameStats.ms / frameStats.frames;
      frameStats.frames = 0;
      frameStats.ms = 0;
    }
    updateRates(nowMs);
    if (nowMs - lastTeleMs >= 100) {
      lastTeleMs = nowMs;
      const t = flight.telemetry;
      tele.mode = t.mode; tele.throttle = flight.input.throttle;
      tele.airspeed = t.airspeed; tele.groundSpeed = t.groundSpeed; tele.climb = t.climbRate;
      tele.altMSL = t.altMSL; tele.altAGL = t.altAGL; tele.mach = t.mach;
      tele.q = t.qDyn; tele.gLoad = t.gLoad; tele.peakG = t.peakG;
      tele.rho = t.rho; tele.sound = t.soundSpeed;
      tele.vSafe = Number.isFinite(t.vSafe) ? t.vSafe : 0;
      tele.governor = t.governorActive;
      tele.dragN = t.dragForceN; tele.dragA = t.dragDecel; tele.liftA = t.liftAccel;
      tele.press = t.pressure;
      tele.originX = o.x; tele.originY = o.y; tele.originZ = o.z;
      tele.rebases = core.stats.rebaseCount;
      tele.localMax = core.stats.focusMaxLocalPostTick;
      tele.active = pool.activeCount(); tele.pending = pool.pendingCount();
      tele.inFlight = pool.inFlightTotal();
      tele.geometries = state.gl.info.memory.geometries;
      tele.heapMB = heapApi !== null ? (heapApi.usedJSHeapSize ?? 0) / 1048576 : 0;
      tele.recvRate = rate.recv;
      tele.ddaSamples = flight.integrity.ddaSamples;
      tele.contacts = flight.integrity.contacts;
      tele.phase = script.phase;
      tele.countdown = script.phase === 'DIVE'
        ? Math.max(0, 45 - script.diveTicks / 60)
        : script.phase === 'CRUISE' ? Math.max(0, 30 - script.simElapsed)
        : script.phase === 'WARMUP' ? Math.max(0, 8 - script.warmElapsed) : 0;
      tele.version++;
      teleListeners.forEach((l) => l());
    }
  });


  return <primitive object={sceneRoot} />;
}


/* ============================================================================
 * 10. HUD
 * ==========================================================================*/
const TEST_ORDER: Array<{ id: TestKey; label: string }> = [
  { id: 'atmosphere', label: 'Density decays smoothly surface → vacuum' },
  { id: 'governor-dive', label: 'Governor dive: ≤ 400 m/s @ 1,000 m, no ground clip (spec gate)' },
  { id: 'drag-continuity', label: 'Drag limits velocity continuously — no hard clamping' },
  { id: 'zero-gc', label: 'Physics-tick burn: state identity + no NaN (allocation: Node gate)' },
  { id: 'integration', label: 'M1A Floating Origin + M1C streaming integration' },
];


function FlightPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">FLIGHT</span>
        <span className={tele.governor ? 'chip warn' : 'chip'}>
          {tele.mode}{tele.governor ? ' · GOVERNOR' : ''}
        </span>
      </div>
      <div className="kv"><span className="k">MODE / THROTTLE</span><span className="v">{tele.mode} · {(tele.throttle * 100).toFixed(0)}%</span></div>
      <div className="kv"><span className="k">AIRSPEED / GS</span><span className="v">{tele.airspeed.toFixed(1)} / {tele.groundSpeed.toFixed(1)} m/s</span></div>
      <div className="kv"><span className="k">V-SAFE (GOVERNOR)</span><span className="v">{tele.vSafe > 0 ? tele.vSafe.toFixed(0) : '∞'} m/s</span></div>
      <div className="kv"><span className="k">ALT MSL / AGL</span><span className="v">{tele.altMSL.toFixed(0)} / {tele.altAGL.toFixed(0)} m</span></div>
      <div className="kv"><span className="k">CLIMB / MACH</span><span className="v">{tele.climb.toFixed(1)} m/s · {tele.mach.toFixed(2)}</span></div>
      <div className="kv"><span className="k">G / PEAK G</span><span className="v">{tele.gLoad.toFixed(1)} · {tele.peakG.toFixed(1)}</span></div>
      <div className="kv"><span className="k">SEQUENCE</span><span className="v">{tele.phase}{tele.countdown > 0 ? ` · ${tele.countdown.toFixed(0)}s` : ''}{userPaused ? ' · PAUSED' : ''}</span></div>
    </div>
  );
}


function AtmoPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">ATMOSPHERE & AERO</span></div>
      <div className="kv"><span className="k">ρ / P</span><span className="v">{tele.rho.toExponential(2)} kg/m³ · {(tele.press / 1000).toFixed(2)} kPa</span></div>
      <div className="kv"><span className="k">DYNAMIC PRESSURE q</span><span className="v">{(tele.q / 1000).toFixed(2)} kPa</span></div>
      <div className="kv"><span className="k">DRAG</span><span className="v">{(tele.dragN / 1000).toFixed(1)} kN · {tele.dragA.toFixed(1)} m/s²</span></div>
      <div className="kv"><span className="k">LIFT</span><span className="v">{tele.liftA.toFixed(1)} m/s²</span></div>
      <div className="kv"><span className="k">SPEED OF SOUND</span><span className="v">{tele.sound.toFixed(1)} m/s</span></div>
    </div>
  );
}


function SystemsPanel() {
  useSyncExternalStore(subTele, () => tele.version);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">ORIGIN · STREAMING · MEMORY</span></div>
      <div className="kv"><span className="k">FPS / FRAME</span><span className="v">{tele.fps.toFixed(0)} · {tele.frameMs.toFixed(2)} ms</span></div>
      <div className="kv"><span className="k">ORIGIN O (f64)</span><span className="v">{tele.originX} / {tele.originY} / {tele.originZ}</span></div>
      <div className="kv"><span className="k">REBASES / MAX LOCAL</span><span className="v">{tele.rebases} · {tele.localMax.toFixed(0)} m ≤ 1,024</span></div>
      <div className="kv"><span className="k">CHUNKS ACT/PEND/FLIGHT</span><span className="v">{tele.active} / {tele.pending} / {tele.inFlight}</span></div>
      <div className="kv"><span className="k">TRANSFER RATE</span><span className="v">{tele.recvRate} chunks/s</span></div>
      <div className="kv"><span className="k">GL GEOMETRIES</span><span className="v">{tele.geometries} (constant)</span></div>
      <div className="kv"><span className="k">JS HEAP</span><span className="v">{tele.heapMB > 0 ? `${tele.heapMB.toFixed(1)} MB` : 'N/A'}</span></div>
      <div className="kv"><span className="k">DDA SAMPLES / CONTACTS</span><span className="v">{tele.ddaSamples.toLocaleString()} · {tele.contacts}</span></div>
    </div>
  );
}


function DivePanel() {
  const s = useSyncExternalStore(subSuite, () => suiteState.version);
  void s;
  const rows: Array<{ a: number; v: number }> = [];
  for (let i = 0; i < CK_ALTS.length && i < ckCount; i++) {
    rows.push({ a: CK_ALTS[i], v: ckSpeed[i] });
  }
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">DIVE TRACE — 2,000 m/s ENTRY</span></div>
      {rows.length === 0
        ? <div className="note">auto-captured during the scripted dive…</div>
        : rows.map((r) => (
          <div className="kv" key={r.a}>
            <span className="k">ALT {r.a.toLocaleString()} m</span>
            <span className={r.a === 1000 ? 'v hl' : 'v'}>{r.v.toFixed(1)} m/s{r.a === 1000 ? '  ← GATE ≤ 400' : ''}</span>
          </div>
        ))}
    </div>
  );
}


function SuitePanel() {
  useSyncExternalStore(subSuite, () => suiteState.version);
  const results = suiteState.results;
  const done = suiteState.done;
  const passed = TEST_ORDER.every((e) => results[e.id]?.pass === true);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">AUTOMATED ACCEPTANCE</span>
        <span className={done ? (passed ? 'chip pass' : 'chip fail') : 'chip run'}>
          {done ? (passed ? 'ALL PASS' : 'FAIL') : script.phase === 'DONE' ? 'EVAL' : 'RUNNING'}
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
                {r ? r.detail : 'sequence: warmup → dive → cruise → burn…'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="btnrow">
        <button className="btn" onClick={() => {
          publishSuite({ done: false, results: {} });
          script.phase = 'WARMUP';
          script.warmElapsed = 0;
          script.geoMin = Number.POSITIVE_INFINITY;
          script.geoMax = 0;
          setCruiseState(flight);
        }}>RE-RUN ACCEPTANCE</button>
      </div>
    </div>
  );
}


function Hud() {
  return (
    <>
      <div className="hud-col left">
        <FlightPanel />
        <AtmoPanel />
        <SystemsPanel />
      </div>
      <div className="hud-col right">
        <SuitePanel />
        <DivePanel />
      </div>
    </>
  );
}


/* ============================================================================
 * 11. ROOT
 * ==========================================================================*/
const M1D_CSS = `
.m1d-root { position: fixed; inset: 0; overflow: hidden; background: #04070c;
  font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  color: #cfe0ee; }
.m1d-canvas { position: absolute; inset: 0; }
.hud-col { position: absolute; top: 14px; display: flex; flex-direction: column;
  gap: 10px; width: 344px; pointer-events: none; }
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
.v.hl { color: #ffd08a; }
.chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.08em;
  color: #7fd4ff; border: 1px solid rgba(127, 212, 255, 0.4); white-space: nowrap; }
.chip.warn { color: #ffd08a; border-color: rgba(255, 176, 84, 0.55); }
.chip.pass { color: #4fd08a; border-color: rgba(79, 208, 138, 0.5); }
.chip.fail { color: #ff7a6e; border-color: rgba(255, 122, 110, 0.5); }
.chip.run { color: #e8b34b; border-color: rgba(232, 179, 75, 0.5); }
.btnrow { display: flex; gap: 6px; margin-top: 8px; }
.btn { pointer-events: auto; font-family: inherit; font-size: 10px; letter-spacing: 0.06em;
  color: #cfe0ee; background: rgba(20, 36, 52, 0.85); border: 1px solid rgba(96, 160, 205, 0.3);
  border-radius: 6px; padding: 5px 10px; cursor: pointer; }
.btn:hover { background: rgba(40, 70, 98, 0.9); }
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
.note { font-size: 10px; color: #587187; line-height: 1.5; }
.legend { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: #587187; letter-spacing: 0.08em; pointer-events: none; }
`;


export default function Milestone1DTestHarness() {
  return (
    <div className="m1d-root">
      <style>{M1D_CSS}</style>
      <div className="m1d-canvas">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 62, near: 0.5, far: 42000, position: [0, 9000, 9000] }}
        >
          <color attach="background" args={[0x060a10]} />
          <fog attach="fog" args={[0x070b12, 800, 8000]} />
          <Scene />
        </Canvas>
      </div>
      <Hud />
      <div className="legend">
        ↑/↓ PITCH · ←/→ ROLL · A/D YAW · W/S THROTTLE · R RESET · P PAUSE — EARTH-SCALE PLANET · EXPONENTIAL DRAG GOVERNOR · ANALYTIC DDA COLLISION
      </div>
    </div>
  );
}
