// T1 per-frame pipeline (plan §4.3). B4b: stages 6, 8 (static camera), 9, 10.
// B5b: stages 1 (clock), 2 (edges) and 11 (loading gate) — active only when a
// `shell` is passed (PlayPage, B5c); without it the frame is B4's static loop
// (test-play-frame). Stages 3–5 and 7 are filled by B6–B8. Zero allocation per
// frame: all scratch is created once in createPlayFrame.
import {
  rotateByQuatConjInto, rotateByQuatInto, spinQuatInto, type Quat, type Vec3,
} from '../../core/physics/sphericalFrame';
import { setDriverPose } from '../../render/MultiCameraRig';
import type { MoonWorld } from '../world/moonWorld';
import { applySkyState } from '../world/skyState';
import type { ThirdPersonCamera } from '../camera/ThirdPersonCamera';
import type { InputState } from '../input/InputState';
import type { PlayStoreLike } from '../ui/shellRuntime';
import { PLAY_TUNING } from '../world/moonConfig';
import { LoadingGate, PlayClock } from './shellStages';
import { createTelemetry } from '../character/CharacterTelemetry';

export function quatMulInto(a: Quat, b: Quat, out: Quat): Quat {
  const w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
  const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
  const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
  out.x = x; out.y = y; out.z = z; out.w = w;
  return out;
}

export interface PlayShellCtx {
  input: InputState;
  store: PlayStoreLike;
  now?: () => number;
}

export interface PlayFrameFn {
  (delta: number): void;
  /** Stage 1 clock (inspected by test-play-shell; B7 reads clock.dt). */
  readonly clock: PlayClock;
  /** Stage 11 loading gate. */
  readonly gate: LoadingGate;
}

/** Builds the MultiCameraRig onFrame callback for one world. */
export function createPlayFrame(w: MoonWorld, cam: ThirdPersonCamera, shell?: PlayShellCtx): PlayFrameFn {
  const qS: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qF: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const qW: Quat = { x: 0, y: 0, z: 0, w: 1 };
  const off: Vec3 = { x: 0, y: 0, z: 0 };
  const camP: Vec3 = { x: 0, y: 0, z: 0 };
  const clock = new PlayClock();
  // WHY (B6): boot telemetry record; B7's sampleTelemetry refills it in place.
  const telem = createTelemetry();
  const gate = new LoadingGate(PLAY_TUNING.loadTimeoutS);
  const now = shell?.now ?? (() => performance.now());
  const fn = function playFrame(delta: number): void {
    const { core, kcc } = w;
    if (shell) {
      const { input, store } = shell;
      const st = store.getState();
      // 1. clock — dt = 0 unless PLAYING, and on the first PLAYING frame
      clock.step(st.phase, delta);
      // 2. edges (InputState only sets them while locked = PLAYING)
      if (input.pauseEdge) {
        // WHY: P pauses through the store first, then releases the lock; the
        // resulting lockLost is a no-op from PAUSED (§10.2).
        st.dispatch('pauseKey', now());
        input.exitLock();
        clock.forceZero();
      }
      if (input.respawnEdge) { w.respawnPlayer(); clock.forceZero(); }
      if (input.toggleHudEdge) st.toggleHud();
    }
    // 3 camera pre-step · 4 controller · 5 simulate (clock.dt) — B7
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
    // 7. telemetry (B7) + animation — B6: RestAnimator holds the rest pose
    telem.dt = clock.dt;
    w.animator.update(telem, clock.dt);
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
    // 11. loading gate (HUD publish arrives in B10)
    if (shell) {
      const st = shell.store.getState();
      if (st.phase === 'LOADING' && !gate.done) {
        // WHY: real delta, not clock.dt — loading time is wall time (§10.3).
        const s = w.spawnDir;
        const ev = gate.step(delta, w.lod.residentAround(s.x, s.y, s.z, PLAY_TUNING.readyRadiusM));
        if (gate.publishDue()) st.setLoad(gate.progress);
        if (ev) st.dispatch(ev, now());
      }
      shell.input.clearEdges();
    }
  } as PlayFrameFn;
  (fn as { clock: PlayClock }).clock = clock;
  (fn as { gate: LoadingGate }).gate = gate;
  return fn;
}