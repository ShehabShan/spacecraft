// T1 B9a procedural animator (plan §8.2–§8.3, §12.2 B9a). Evaluates the pose
// for the state AnimStateMachine picks: Idle and the shared gait(v) Walk/Run,
// the crouch weight and the soft-landing dip. Air / Land / Slide poses fall
// back to Idle until B9b; PlayPage still mounts RestAnimator until B9c.
// Pose math is pure f64 (no THREE math); THREE is touched only in the
// write-out. Boot-only allocation — `update` allocates nothing.
import type * as THREE from 'three';
import type { CharacterAnimator } from './CharacterAnimator';
import type { CharacterTelemetry } from './CharacterTelemetry';
import { buildAstronautRig, disposeAstronautRig, JOINTS, RIG_DIMS, type AstronautRig, type JointName } from './AstronautRig';
import { AnimState, AnimStateMachine, createLegPose, legDrop, LEG, type AnimStateId, type LegPose } from './animStateMachine';

/** Joint name → slot in PoseBuffer.q (JOINTS order). */
export const JOINT_INDEX = Object.fromEntries(JOINTS.map((n, i) => [n, i])) as Record<JointName, number>;
const J = JOINT_INDEX;

/** One full pose: rest-relative joint quaternions (JOINTS·4, xyzw) + hips height. */
export interface PoseBuffer { q: Float32Array; hipsY: number }
export function createPoseBuffer(): PoseBuffer {
  const q = new Float32Array(JOINTS.length * 4);
  for (let i = 0; i < JOINTS.length; i++) q[i * 4 + 3] = 1;
  return { q, hipsY: RIG_DIMS.hipsY };
}
function restInto(b: PoseBuffer): void {
  const q = b.q;
  for (let o = 0; o < q.length; o += 4) { q[o] = 0; q[o + 1] = 0; q[o + 2] = 0; q[o + 3] = 1; }
  b.hipsY = RIG_DIMS.hipsY;
}
function setX(b: PoseBuffer, j: number, a: number): void {
  const o = j * 4; b.q[o] = Math.sin(a * 0.5); b.q[o + 1] = 0; b.q[o + 2] = 0; b.q[o + 3] = Math.cos(a * 0.5);
}
function setY(b: PoseBuffer, j: number, a: number): void {
  const o = j * 4; b.q[o] = 0; b.q[o + 1] = Math.sin(a * 0.5); b.q[o + 2] = 0; b.q[o + 3] = Math.cos(a * 0.5);
}
/** Rz(z)·Rx(x): flexion about X, then abduction about Z (arms). */
function setZX(b: PoseBuffer, j: number, x: number, z: number): void {
  const sx = Math.sin(x * 0.5), cx = Math.cos(x * 0.5), sz = Math.sin(z * 0.5), cz = Math.cos(z * 0.5);
  const o = j * 4; b.q[o] = cz * sx; b.q[o + 1] = sz * sx; b.q[o + 2] = sz * cx; b.q[o + 3] = cz * cx;
}

/** §8.3 gait literals. */
export const GAIT = {
  fBase: 0.8, fPerV: 0.2, fMin: 0.8, fMax: 2.2,    // phase rate f(v), Hz
  aBase: 0.10, aPerV: 0.075, aMin: 0.10, aMax: 0.60, // hip half-swing A(v), rad
  // WHY (B9a decision): β is clamped to the band §8.3 computes for
  // 0.5–8 m/s. Below ~0.25 m/s S·f/v → ∞ (no stance can be long enough);
  // the clamp keeps a swing phase so the legs still cycle at a crawl.
  betaMin: 0.22, betaMax: 0.65,
  vMax: 8,                    // the v/8 terms' domain (sprint is 6.5)
  bobBase: 0.02, bobAmp: 0.04,
  swingKnee: 0.6, swingAnkle: 0.25, armCounter: 0.8,
  elbowBase: 0.25, elbowPerV: 0.35, leanBase: 0.05, leanPerV: 0.10, twist: 0.05,
  idleBreath: 0.02, idleBreathHz: 0.25, idleAbd: 0.06, idleDrop: 0.02,
  crouchDrop: 0.12, crouchLean: 0.15,
} as const;
const G = GAIT;
const TAU = 2 * Math.PI;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const frac = (x: number) => x - Math.floor(x);

export const gaitFreq = (v: number) => clamp(G.fBase + G.fPerV * v, G.fMin, G.fMax);
export const gaitAmp = (v: number) => clamp(G.aBase + G.aPerV * v, G.aMin, G.aMax);
/** §8.3 no-slide stance fraction β = S·f / v, S = 2·d0·sin A. */
export function gaitBeta(v: number): number {
  if (v <= 1e-6) return G.betaMax;
  return clamp(2 * LEG.d0 * Math.sin(gaitAmp(v)) * gaitFreq(v) / v, G.betaMin, G.betaMax);
}

/** One leg of the gait at side phase ps ∈ [0,1); returns the hip angle θ. */
function gaitLeg(b: PoseBuffer, hip: number, knee: number, ankle: number,
  ps: number, A: number, beta: number, add: LegPose): number {
  let th: number, kn: number, an: number;
  if (ps < beta) {
    // WHY (§8.3): asin makes the foot's hip-relative z exactly linear in
    // time, so with β = S·f/v the stance foot is planted (zero slide flat).
    th = Math.asin(Math.sin(A) * (1 - 2 * ps / beta)); kn = 0; an = -th;
  } else {
    const u = (ps - beta) / (1 - beta), s = u * u * (3 - 2 * u), su = Math.sin(Math.PI * u);
    th = -A + 2 * A * s; kn = (G.swingKnee + A) * su;
    // WHY (B9a decision): §8.3's literal swing ankle 0.25·sin(πu) starts and
    // ends at 0 while the stance ankle −θ ends at ±A — a 34° pop per step at
    // sprint. The swing ankle keeps the foot flat (θ − knee + ankle = 0, the
    // stance law extended) plus the same 0.25·sin(πu) toe-clearance term:
    // C⁰ at both stance boundaries, intent (flat foot + clearance) kept.
    an = kn - th + G.swingAnkle * su;
  }
  // Crouch / soft dip are additive legDrop angles (all X — they commute).
  setX(b, hip, th + add.hip); setX(b, knee, -(kn + add.knee)); setX(b, ankle, an + add.ankle);
  return th;
}

/**
 * §8.3 shared Walk/Run PoseFn — one formula for both, so Walk ↔ Run never
 * pops and the phase never resets. `addD` = additive pelvis drop (crouch +
 * soft dip), `chestAdd` = additive −X chest lean. `scratch` is a boot LegPose.
 */
export function gaitPose(b: PoseBuffer, speed: number, p: number, addD: number,
  chestAdd: number, scratch: LegPose): void {
  restInto(b);
  const v = clamp(speed, 0, G.vMax), A = gaitAmp(v), beta = gaitBeta(v), k = v / G.vMax;
  legDrop(addD, scratch);
  const thR = gaitLeg(b, J.upperLegR, J.lowerLegR, J.footR, frac(p), A, beta, scratch);
  const thL = gaitLeg(b, J.upperLegL, J.lowerLegL, J.footL, frac(p + 0.5), A, beta, scratch);
  const s2 = Math.sin(TAU * p);
  b.hipsY = RIG_DIMS.hipsY - G.bobBase + G.bobAmp * k * Math.abs(s2) - scratch.D;
  setX(b, J.upperArmR, -G.armCounter * thR); setX(b, J.upperArmL, -G.armCounter * thL);
  const elbow = G.elbowBase + G.elbowPerV * k;
  setX(b, J.lowerArmR, elbow); setX(b, J.lowerArmL, elbow);
  setX(b, J.chest, -(G.leanBase + G.leanPerV * k) - chestAdd);
  setY(b, J.spine, G.twist * s2);
}

/** §8.3 Idle: breathing chest, suit-bulk arm abduction, legDrop(0.02). */
export function idlePose(b: PoseBuffer, time: number, addD: number, chestAdd: number, scratch: LegPose): void {
  restInto(b);
  legDrop(G.idleDrop + addD, scratch);
  const q = scratch.q;
  for (let i = 0; i < IDLE_LEGS.length; i += 3) {   // index loop: no iterator alloc
    copy4(b.q, IDLE_LEGS[i] * 4, q, 0); copy4(b.q, IDLE_LEGS[i + 1] * 4, q, 4); copy4(b.q, IDLE_LEGS[i + 2] * 4, q, 8);
  }
  b.hipsY = scratch.hipsY;
  setX(b, J.chest, -G.idleBreath * Math.sin(TAU * G.idleBreathHz * time) - chestAdd);
  setZX(b, J.upperArmR, 0, G.idleAbd); setZX(b, J.upperArmL, 0, -G.idleAbd);
}
const IDLE_LEGS: readonly number[] = [J.upperLegL, J.lowerLegL, J.footL, J.upperLegR, J.lowerLegR, J.footR];
function copy4(d: Float32Array, o: number, s: ArrayLike<number>, u: number): void {
  d[o] = s[u]; d[o + 1] = s[u + 1]; d[o + 2] = s[u + 2]; d[o + 3] = s[u + 3];
}

/** Per-joint shortest-path slerp a→b by t into out (f64 math, normalized). */
export function blendPose(out: PoseBuffer, a: PoseBuffer, b: PoseBuffer, t: number): void {
  const qa = a.q, qb = b.q, qo = out.q;
  for (let o = 0; o < qo.length; o += 4) {
    const ax = qa[o], ay = qa[o + 1], az = qa[o + 2], aw = qa[o + 3];
    let bx = qb[o], by = qb[o + 1], bz = qb[o + 2], bw = qb[o + 3];
    let c = ax * bx + ay * by + az * bz + aw * bw;
    if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
    let wa: number, wb: number;
    if (c > 0.9995) { wa = 1 - t; wb = t; }        // near-identical: lerp + normalize
    else { const th = Math.acos(c), s = Math.sin(th); wa = Math.sin((1 - t) * th) / s; wb = Math.sin(t * th) / s; }
    const x = wa * ax + wb * bx, y = wa * ay + wb * by, z = wa * az + wb * bz, w = wa * aw + wb * bw;
    const n = 1 / Math.hypot(x, y, z, w);
    qo[o] = x * n; qo[o + 1] = y * n; qo[o + 2] = z * n; qo[o + 3] = w * n;
  }
  out.hipsY = a.hipsY + (b.hipsY - a.hipsY) * t;
}
function copyPose(d: PoseBuffer, s: PoseBuffer): void { d.q.set(s.q); d.hipsY = s.hipsY; }

export class ProceduralAnimator implements CharacterAnimator {
  readonly rig: AstronautRig;
  readonly root: THREE.Object3D;
  readonly sm = new AnimStateMachine();
  /** §8.2 boot buffers: prev / cur state poses, frozen interrupt snapshot, output. */
  readonly prev = createPoseBuffer();
  readonly cur = createPoseBuffer();
  readonly snap = createPoseBuffer();
  readonly out = createPoseBuffer();
  /** Gait phase p ∈ [0,1) (§8.3) — one accumulator for Walk and Run. */
  phase = 0;
  time = 0;
  /** True while `prev` is the frozen `snap` (a mid-blend interrupt). */
  prevIsSnap = false;
  private readonly leg = createLegPose();
  private readonly objs: THREE.Object3D[];

  constructor(rig?: AstronautRig) {
    this.rig = rig ?? buildAstronautRig();
    this.root = this.rig.root;
    this.objs = JOINTS.map((n) => this.rig.joints[n]);
  }

  get stateName(): string { return this.sm.stateName; }

  update(t: Readonly<CharacterTelemetry>, dt: number): void {
    const sm = this.sm, tr0 = sm.transitions;
    sm.step(t, dt);
    if (sm.transitions !== tr0) {
      // WHY (§8.2 Interrupt): freeze last frame's blended output as `prev`
      // so a transition fired mid-blend restarts from what is on screen.
      this.prevIsSnap = sm.interrupted;
      if (sm.interrupted) copyPose(this.snap, this.out);
    }
    this.time += dt;
    this.phase = frac(this.phase + dt * gaitFreq(clamp(t.speed, 0, G.vMax)));
    this.evalState(this.cur, sm.state, t.speed);
    if (sm.blend >= 1) copyPose(this.out, this.cur);
    else {
      const a = this.prevIsSnap ? this.snap : this.evalState(this.prev, sm.prev, t.speed);
      blendPose(this.out, a, this.cur, sm.blend);
    }
    this.writeOut();
  }

  /** PoseFn dispatch. B9a: Idle / Walk / Run; every other state → Idle (B9b). */
  evalState(b: PoseBuffer, s: AnimStateId, speed: number): PoseBuffer {
    const sm = this.sm;
    const addD = G.crouchDrop * sm.crouchW + sm.softDipD, chestAdd = G.crouchLean * sm.crouchW;
    if (s === AnimState.Walk || s === AnimState.Run) gaitPose(b, speed, this.phase, addD, chestAdd, this.leg);
    else idlePose(b, this.time, addD, chestAdd, this.leg);
    return b;
  }

  private writeOut(): void {
    const q = this.out.q, o = this.objs;
    for (let i = 0; i < o.length; i++) o[i].quaternion.set(q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]);
    this.rig.joints.hips.position.y = this.out.hipsY;
  }

  setVisible(v: boolean): void { this.root.visible = v; }

  dispose(): void { disposeAstronautRig(this.rig); }
}