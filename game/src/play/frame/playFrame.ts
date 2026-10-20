// T1 per-frame pipeline (plan §4.3, B4b): stages 6, 8 (static camera), 9, 10.
// Stages 1–5, 7 and 11 are empty slots filled by B5–B8. Zero allocation per
// frame: all scratch is created once in createPlayFrame.
import {
  rotateByQuatConjInto, rotateByQuatInto, spinQuatInto, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { setDriverPose } from '../../render/MultiCameraRig';
import type { MoonWorld } from '../world/moonWorld';
import { applySkyState } from '../world/skyState';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';

export function quatMulInto(a: Quat, b: Quat, out: Quat): Quat {
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  out.x = x; out.y = y; out.z = z; out.w = w;
  return out;
}

/** Builds the MultiCameraRig onFrame callback for one world. */
export function createPlayFrame(w: MoonWorld, cam: ThirdPersonCamera): (delta: number) => void {
  const qS: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qF: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qW: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const off: Vec3 = { x: 0, y: 0, z: 0 };
  const camP: Vec3 = { x: 0, y: 0, z: 0 };
  return function playFrame(_delta: number): void {
    const { core, kcc } = w;
    // 1 clock · 2 input · 3 camera pre-step · 4 controller · 5 simulate — B5/B7
    // 6. render extraction (spin composed ONCE here, §4.4 / K1)
    const o = core.getOrigin();
    spinQuatInto(kcc.spinPhase, qS);
    w.spinGroup.position.set(-o.x, -o.y, -o.z);
    w.spinGroup.quaternion.set(qS.x, qS.y, qS.z, qS.w);
    w.adapter.update();
    const alp = w.astroState.localPosF32;
    w.characterRoot.position.set(alp[0], alp[1], alp[2]);
    kcc.frameQuatInto(qF);
    quatMulInto(qS, qF, qW);
    w.characterRoot.quaternion.set(qW.x, qW.y, qW.z, qW.w);
    // 7 telemetry + animation — B6
    // 8. camera post-step (static pose; spring arm/smoothing in B7)
    cam.poseInto(kcc);
    rotateByQuatInto(qS, cam.offsetPlanet.x, cam.offsetPlanet.y, cam.offsetPlanet.z, off);
    quatMulInto(qS, cam.quatPlanet, qW);
    const dx = alp[0] + off.x, dy = alp[1] + off.y, dz = alp[2] + off.z;
    setDriverPose(dx, dy, dz, qW.x, qW.y, qW.z, qW.w);
    // 9. sky + layers
    applySkyState(w, dx, dy, dz, qW.x, qW.y, qW.z, qW.w);
    // 10. LOD + streaming — every phase (camera position, planet frame)
    rotateByQuatConjInto(qS, kcc.absPos.x + off.x, kcc.absPos.y + off.y, kcc.absPos.z + off.z, camP);
    w.lod.update(camP.x, camP.y, camP.z);
    w.pool.pump();
    // 11 HUD — B5
  };
}