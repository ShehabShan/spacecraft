// T1 play sky + layer state (plan §6.2 port map, B4a). applySkyState = the M1F
// harness applyRenderState (~810–914) minus the probe slots 9/10, the probe
// meshes, the satellites, RIG.maskOverride and RIG.stats. Zero allocation per
// call (AGENT_BRIEF §3): every scratch below is module-private and boot-made.
import type * as THREE from 'three';
import type { SimulationCore } from '../../core/simulation/SimulationCore';
import type { AstronautKCC } from '../../core/physics/astronautKCC';
import { chunkArcWidth } from '../../core/terrain/terrainField';
import {
  rotateByQuatConjInto, spinQuatInto,
  type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import {
  bodyGeometryInto, elevationAngle, fullyBelowHorizon, thetaEdge,
  type SkyGeometry,
} from '../../core/render/impostorMath';
import { SKY_UPDATE_IO, type SkyImpostorPool } from '../../render/SkyImpostorPool';
import type { ChunkRecord } from '../../render/TerrainMeshPool';
import { MID_BIT, NEAR_BIT, layerMaskFor } from '../../render/MultiCameraRig';
import { HEIGHT_SLACK } from './moonConfig';
import { Vec3d, Quatd, hypot3 } from '../../core/physics/sphericalFrame'; // WHY (T5 S1bbbb): class-backed scratch, see Vec3d

// WHY: harness CAT_BODIES (~794–804) verbatim — impostor slots 0–8. Slots
// 9/10 were the M1F probe pair (test-only, excluded per §6.2).
export const PLAY_BODIES: ReadonlyArray<{
  slot: number; id: string; radius: number; color: readonly [number, number, number]; kind: number;
}> = [
  { slot: 0, id: 'sun', radius: 20000, color: [1.0, 0.87, 0.62], kind: 1 },
  { slot: 1, id: 'mercury', radius: 3105.7, color: [0.62, 0.57, 0.52], kind: 0 },
  { slot: 2, id: 'venus', radius: 4870.3, color: [0.92, 0.82, 0.60], kind: 0 },
  { slot: 3, id: 'mars', radius: 2649.3, color: [0.80, 0.45, 0.30], kind: 0 },
  { slot: 4, id: 'jupiter', radius: 16640.2, color: [0.86, 0.70, 0.52], kind: 2 },
  { slot: 5, id: 'saturn', radius: 15120.4, color: [0.90, 0.82, 0.62], kind: 2 },
  { slot: 6, id: 'uranus', radius: 9980.5, color: [0.62, 0.85, 0.87], kind: 2 },
  { slot: 7, id: 'neptune', radius: 9835.4, color: [0.38, 0.50, 0.86], kind: 0 },
  { slot: 8, id: 'pluto', radius: 2160.8, color: [0.79, 0.72, 0.64], kind: 0 },
];
export const EARTH_R = 5000;

/** Everything applySkyState reads; built once by createMoonWorld. */
export interface SkyCtx {
  core: SimulationCore;
  kcc: AstronautKCC;
  sky: SkyImpostorPool;
  pool: { readonly records: readonly ChunkRecord[] };
  moonAbs: Vec3;          // moon rail position (frozen rails, t = 0)
  earthVec: Vec3;         // Earth − Moon, f64
  earthDist: number;
  earthMesh: THREE.Object3D;
  glow: THREE.Object3D;
  characterRoot: THREE.Object3D;
}

/** Layer counts of the last call (read-only; HUD/debug use). */
export const skyStats = { near: 0, mid: 0, written: 0 };

const _qS: Quat = new Quatd(0, 0, 0, 1);
const _qCam: Quat = new Quatd(0, 0, 0, 1);
const _vA: Vec3 = new Vec3d(0, 0, 0);
// WHY (T5 S1bbbb): a class owns its hidden class, so the per-body double stores stay unboxed (see Vec3d).
class SkyGeo implements SkyGeometry { dirX = 0; dirY = 0; dirZ = 0; dist = 0; theta = 0 }
const _geo: SkyGeometry = new SkyGeo();
const sunGeom: SkyGeometry = new SkyGeo();

/** Apply impostors, anchors and layer masks for a driver pose (render-local
 *  position p, camera quat q). Zero allocation. */
export function applySkyState(
  c: SkyCtx, px: number, py: number, pz: number, qx: number, qy: number, qz: number, qw: number,
): void {
  const io = SKY_POSE_IO;
  io[0] = px; io[1] = py; io[2] = pz; io[3] = qx; io[4] = qy; io[5] = qz; io[6] = qw;
  applySkyStateIo(c, io);
}

/** Driver-pose input slots for applySkyStateIo: [px, py, pz, qx, qy, qz, qw]. */
export const SKY_POSE_IO = new Float64Array(7);

/** applySkyState with the pose in Float64Array slots (layout SKY_POSE_IO).
 *  WHY (T5 S1bbbbba): doubles passed as arguments to a non-inlined call box a
 *  HeapNumber each at the call site; the hot frame path uses this form. */
export function applySkyStateIo(c: SkyCtx, pose: Float64Array): void {
  const px = pose[0], py = pose[1], pz = pose[2];
  const qx = pose[3], qy = pose[4], qz = pose[5], qw = pose[6];
  // F22: horizon-cull up = ABSOLUTE radial normalize(O + local).
  const o = c.core.getOrigin();
  const upL = hypot3(px + o.x, py + o.y, pz + o.z) || 1; // WHY (T5 S1bbbb): 3-arg Math.hypot boxes per call
  const obsX = c.moonAbs.x + o.x + px;
  const obsY = c.moonAbs.y + o.y + py;
  const obsZ = c.moonAbs.z + o.z + pz;
  let written = 0;
  for (let i = 0; i < PLAY_BODIES.length; i++) {
    const cb = PLAY_BODIES[i];
    const st = c.core.getCelestialState(cb.id);
    if (st === null) continue;
    bodyGeometryInto(obsX, obsY, obsZ, st.absPos.x, st.absPos.y, st.absPos.z, cb.radius, _geo);
    const el = elevationAngle(_geo.dirX, _geo.dirY, _geo.dirZ, (px + o.x) / upL, (py + o.y) / upL, (pz + o.z) / upL);
    const cull = fullyBelowHorizon(el, _geo.theta, 0.03);
    c.sky.setBody(cb.slot, cb.id, cb.kind, _geo.dirX, _geo.dirY, _geo.dirZ,
      _geo.theta, _geo.dist, cb.color[0], cb.color[1], cb.color[2], 1, !cull);
    if (!cull) written++;
    if (i === 0) { sunGeom.dirX = _geo.dirX; sunGeom.dirY = _geo.dirY; sunGeom.dirZ = _geo.dirZ; sunGeom.theta = _geo.theta; sunGeom.dist = _geo.dist; }
  }
  // WHY: the harness allocated `{x,y,z,w} as Quat` here every call; a module
  // scratch keeps the zero-GC invariant (B4a decision).
  _qCam.x = qx; _qCam.y = qy; _qCam.z = qz; _qCam.w = qw;
  const sunCam = rotateByQuatConjInto(_qCam, sunGeom.dirX, sunGeom.dirY, sunGeom.dirZ, _vA);
  const su = SKY_UPDATE_IO;
  su[0] = px; su[1] = py; su[2] = pz; su[3] = qx; su[4] = qy; su[5] = qz; su[6] = qw;
  su[7] = sunCam.x; su[8] = sunCam.y; su[9] = sunCam.z;
  c.sky.updateIo(su);
  c.sky.stars.position.set(px, py, pz);
  const sunBody = c.sky.bodies[0];
  c.glow.position.set(sunBody.stagedPX, sunBody.stagedPY, sunBody.stagedPZ);
  c.glow.quaternion.set(qx, qy, qz, qw);
  const gs = (sunBody.stageD + 60) * Math.tan(thetaEdge(sunGeom.theta * 2.4));
  c.glow.scale.set(gs, gs, 1);

  // -- layer assignment (Spec 04.2) ------------------------------------------
  skyStats.near = 0; skyStats.mid = 0;
  c.earthMesh.position.set(c.earthVec.x - o.x, c.earthVec.y - o.y, c.earthVec.z - o.z);
  assignObject(c.earthMesh, c.earthDist - EARTH_R, c.earthDist + EARTH_R);

  // WHY: §6.2 port gotcha — the harness computed _qS inside the (removed)
  // satellites block; the terrain loop below depends on it, so it stays here.
  spinQuatInto(c.kcc.spinPhase, _qS);
  const qSx = _qS.x, qSy = _qS.y, qSz = _qS.z, qSw = _qS.w;
  const recs = c.pool.records;
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    if (rec.state !== 2) { rec.mesh.layers.mask = 0; continue; }
    // WHY (T5 S1b): rotateByQuatInto inlined into locals. Storing doubles into the shared
    // {x,y,z} scratch _vB boxed a HeapNumber per field (~4.7 KB/frame over 96 records);
    // same arithmetic order as rotateByQuatInto, so the result is bit-identical.
    const vx = rec.originX, vy = rec.originY, vz = rec.originZ;
    const tx = 2 * (qSy * vz - qSz * vy);
    const ty = 2 * (qSz * vx - qSx * vz);
    const tz = 2 * (qSx * vy - qSy * vx);
    const rx = vx + qSw * tx + (qSy * tz - qSz * ty);
    const ry = vy + qSw * ty + (qSz * tx - qSx * tz);
    const rz = vz + qSw * tz + (qSx * ty - qSy * tx);
    const brad = chunkArcWidth(rec.level) * 0.75 + HEIGHT_SLACK;
    const dx = rx - o.x - px, dy = ry - o.y - py, dz = rz - o.z - pz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    assignObject(rec.mesh, d - brad, d + brad);
  }
  // character: Foreground always
  c.characterRoot.layers.mask = NEAR_BIT;
  skyStats.near++;
  skyStats.written = written;
}

function assignObject(obj: THREE.Object3D, dn: number, df: number): void {
  const mask = layerMaskFor(dn, df);
  obj.layers.mask = mask;
  if ((mask & NEAR_BIT) !== 0) skyStats.near++;
  if ((mask & MID_BIT) !== 0) skyStats.mid++;
}