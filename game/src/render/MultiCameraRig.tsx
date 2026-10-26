/**
 * ============================================================================
 *  MULTI-CAMERA RIG — THE 3-PASS LAYERED RENDERER (SPEC 04.1, VERBATIM)
 *  Milestone 1F
 * ============================================================================
 *  FOREGROUND [0.1, 3000] layer 0 · MIDGROUND [2000, 3e5] layer 1 ·
 *  BACKGROUND (scaled impostor space) [500, 10,000] layer 2.
 *
 *  THE LOOP (spec law):
 *      gl.autoClear = false;
 *      gl.clear(true, true, false);   // color + depth — ONCE, before the
 *                                     // Background pass (color clear ONLY
 *                                     // here, per the milestone rules)
 *      gl.render(scene, camFar);      // Background: impostors, stars, glow
 *      gl.clearDepth();               // depth-only trigger
 *      gl.render(scene, camMid);      // Midground: planet meshes, far terrain
 *      gl.clearDepth();               // depth-only trigger
 *      gl.render(scene, camNear);     // Foreground: astronaut, near terrain
 *
 *  CO-LOCATION: all three cameras share one driver pose (position from the
 *  M1A f32 focus locals via the FloatingOriginAdapter, orientation from the
 *  harness camera controller) — identical view matrices make layer handoffs
 *  pixel-invariant (the byte-exact A/B acceptance depends on this).
 *
 *  BACKGROUND TRAP: scene.background MUST be null — a background Color makes
 *  three's WebGLBackground force-clear the target on EVERY render(), which
 *  would wipe the Background pass when Midground renders. The rig owns the
 *  clear color explicitly.
 *
 *  ZERO-GC: cameras, stats, and the A/B machinery are boot/module-allocated;
 *  executePasses() allocates nothing. The component renders null — zero
 *  React churn. R3F's automatic render is disabled by useFrame priority 1.
 */


import { useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';


export const NEAR_BIT = 1;   // layer 0
export const MID_BIT = 2;    // layer 1
export const FAR_BIT = 4;    // layer 2


/** Spec 04.2 Near/Mid threshold (the only mesh-straddler boundary in this
 *  architecture — the Mid/Far boundary is the mesh↔impostor handoff). */
export const NEAR_MID_THRESHOLD = 2400;
export const MID_FAR_LIMIT = 300000;


export const NEAR_PLANES: readonly [number, number] = [0.1, 3000];
export const MID_PLANES: readonly [number, number] = [2000, 300000];
export const BG_PLANES: readonly [number, number] = [500, 10000];


export const CLEAR_COLOR = 0x04070c;
export const DEFAULT_FOV = 62;


/* -- the rig (module scope: harness + acceptance suite need direct access) - */


export const rigCamNear = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 9, NEAR_PLANES[0], NEAR_PLANES[1]);
export const rigCamMid = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 9, MID_PLANES[0], MID_PLANES[1]);
export const rigCamFar = new THREE.PerspectiveCamera(DEFAULT_FOV, 16 / 9, BG_PLANES[0], BG_PLANES[1]);
rigCamNear.layers.set(0);
rigCamMid.layers.set(1);
rigCamFar.layers.set(2);


export interface RigStats {
  clearDepthCalls: number;
  colorClears: number;
  passRenders: number;
  nearCalls: number;
  midCalls: number;
  farCalls: number;
  nearObjects: number;
  midObjects: number;
  farObjects: number;
}


export const RIG = {
  /** Driver pose — position is the M1A f32 focus locals (exact f32 values
   *  carried as doubles), quaternion f64->f32. Written by the harness. */
  driver: { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 },
  /** Synthetic pose for A/B renders (null = use driver). */
  poseOverride: null as null | { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number },
  /** Assignment override for A/B renders: this object's mask is forced. */
  maskOverride: null as null | { object: THREE.Object3D; mask: number },
  stats: {
    clearDepthCalls: 0, colorClears: 0, passRenders: 0,
    nearCalls: 0, midCalls: 0, farCalls: 0,
    nearObjects: 0, midObjects: 0, farObjects: 0,
  } as RigStats,
};


export function setDriverPose(
  x: number, y: number, z: number,
  qx: number, qy: number, qz: number, qw: number,
): void {
  RIG.driver.x = x; RIG.driver.y = y; RIG.driver.z = z;
  RIG.driver.qx = qx; RIG.driver.qy = qy; RIG.driver.qz = qz; RIG.driver.qw = qw;
}


/**
 * Spec 04.2 assignment rule (single code path for meshes):
 *   Near bit while the sphere intrudes the Near band; Mid bit while it
 *   intrudes the Mid band. Straddlers always carry the OUTER bit; the inner
 *   bit persists while coverage overlaps (proven redundant at the toggle —
 *   the byte-exact A/B acceptance exercises exactly this).
 */
export function layerMaskFor(dn: number, df: number): number {
  let m = 0;
  if (dn < NEAR_MID_THRESHOLD) m |= NEAR_BIT;
  if (df > NEAR_MID_THRESHOLD && dn < MID_FAR_LIMIT) m |= MID_BIT;
  return m;
}


/** THE spec-verbatim pass sequence. Pure render — advances nothing. */
export function executePasses(gl: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pose = RIG.poseOverride ?? RIG.driver;
  const cams = [rigCamNear, rigCamMid, rigCamFar];
  for (let i = 0; i < 3; i++) {
    const c = cams[i];
    c.position.set(pose.x, pose.y, pose.z);
    c.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
    c.updateMatrixWorld(true);
  }
  gl.autoClear = false;
  gl.setClearColor(CLEAR_COLOR, 1);
  gl.clear(true, true, false);           // color + depth, once (Background)
  RIG.stats.colorClears++;


  const s = RIG.stats;
  let before = gl.info.render.calls;
  gl.render(scene, rigCamFar);
  s.farCalls = gl.info.render.calls - before; s.passRenders++;
  before = gl.info.render.calls;
  gl.clearDepth();                       // DEPTH-ONLY TRIGGER
  s.clearDepthCalls++;
  gl.render(scene, rigCamMid);
  s.midCalls = gl.info.render.calls - before; s.passRenders++;
  before = gl.info.render.calls;
  gl.clearDepth();                       // DEPTH-ONLY TRIGGER
  s.clearDepthCalls++;
  gl.render(scene, rigCamNear);
  s.nearCalls = gl.info.render.calls - before; s.passRenders++;
}


/**
 * A/B instrument: apply a state mutation, render the full 3-pass sequence
 * into a boot-allocated target, read pixels into a boot-allocated buffer.
 * Deterministic (same scene state + co-located cameras + non-MSAA target).
 */
export function renderAB(
  gl: THREE.WebGLRenderer, scene: THREE.Scene,
  target: THREE.WebGLRenderTarget, pixels: Uint8Array,
  apply: () => void,
): void {
  apply();
  gl.setRenderTarget(target);
  executePasses(gl, scene);
  gl.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
  gl.setRenderTarget(null);
}


/* -- the R3F component ------------------------------------------------------ */


export interface MultiCameraRigProps {
  /** The harness frame callback (simulation, assignment, pool update).
   *  Runs BEFORE executePasses every frame. */
  onFrame?: (delta: number, gl: THREE.WebGLRenderer, scene: THREE.Scene) => void;
}


export function MultiCameraRig({ onFrame }: MultiCameraRigProps) {
  const { gl, scene, size } = useThree();


  useEffect(() => {
    gl.autoClear = false;
    gl.setClearColor(CLEAR_COLOR, 1);
    scene.background = null;   // CRITICAL: a background Color force-clears
    scene.fog = null;          // every render() and would wipe the BG pass.
    gl.info.autoReset = false;
    return () => { gl.autoClear = true; gl.info.autoReset = true; };
  }, [gl, scene]);


  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    rigCamNear.aspect = aspect; rigCamMid.aspect = aspect; rigCamFar.aspect = aspect;
    rigCamNear.updateProjectionMatrix();
    rigCamMid.updateProjectionMatrix();
    rigCamFar.updateProjectionMatrix();
  }, [size]);


  useFrame((_state, delta) => {
    gl.info.reset();
    if (onFrame !== undefined) onFrame(delta, gl, scene);
    executePasses(gl, scene);
  }, 1); // priority > 0 disables R3F's automatic render — the rig owns output


  return null;
}
