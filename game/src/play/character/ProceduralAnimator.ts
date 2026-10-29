// T1 B9 procedural animator (plan §8.2–§8.6, §12.2 B9a/B9b). Evaluates the
// pose for the state AnimStateMachine picks: Idle and the shared gait(v)
// Walk/Run (B9a), JumpLaunch / JumpRise / Fall / Land / Slide and the §8.6
// slope ankle terms (B9b), the crouch weight and the soft-landing dip.
// PlayPage still mounts RestAnimator until B9c.
// Pose math is pure f64 (no THREE math); THREE is touched only in the
// write-out. Boot-only allocation — `update` allocates nothing.
import type * as THREE from 'three';
import type { CharacterAnimator } from './CharacterAnimator';
import type { CharacterTelemetry } from './CharacterTelemetry';

import { buildAstronautRig, disposeAstronautRig, JOINTS, RIG_DIMS, type AstronautRig, type JointName } from './AstronautRig';
import { ANIM_TUNING, AnimState, AnimStateMachine, AnimDtCell, createLegPose, legDrop, LEG, type AnimDtSource, type AnimStateId, type LegPose } from './animStateMachine';

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
const TAU = 2 * Math.PI, RAD = Math.PI / 180;
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
  ps: number, A: number, beta: number, add: LegPose, sp: number, sr: number): number {
  let th: number, kn: number, an: number, w = 1;
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
    w = 1 - su;   // §8.6 stance weight: 1 in stance, fading to 0 mid-swing
  }
  // Crouch / soft dip are additive legDrop angles (all X — they commute);
  // the §8.6 slope pitch (X) / roll (Z) ride on the ankle, stance-weighted.
  setX(b, hip, th + add.hip); setX(b, knee, -(kn + add.knee));
  setZX(b, ankle, an + add.ankle + w * sp, w * sr);
  return th;
}

/**
 * §8.3 shared Walk/Run PoseFn — one formula for both, so Walk ↔ Run never
 * pops and the phase never resets. `addD` = additive pelvis drop (crouch +
 * soft dip), `chestAdd` = additive −X chest lean. `scratch` is a boot LegPose.
 */
export function gaitPose(b: PoseBuffer, speed: number, p: number, addD: number,
  chestAdd: number, scratch: LegPose, sp = 0, sr = 0): void {
  restInto(b);
  const v = clamp(speed, 0, G.vMax), A = gaitAmp(v), beta = gaitBeta(v), k = v / G.vMax;
  legDrop(addD, scratch);
  const thR = gaitLeg(b, J.upperLegR, J.lowerLegR, J.footR, frac(p), A, beta, scratch, sp, sr);
  const thL = gaitLeg(b, J.upperLegL, J.lowerLegL, J.footL, frac(p + 0.5), A, beta, scratch, sp, sr);
  const s2 = Math.sin(TAU * p);
  b.hipsY = RIG_DIMS.hipsY - G.bobBase + G.bobAmp * k * Math.abs(s2) - scratch.D;
  setX(b, J.upperArmR, -G.armCounter * thR); setX(b, J.upperArmL, -G.armCounter * thL);
  const elbow = G.elbowBase + G.elbowPerV * k;
  setX(b, J.lowerArmR, elbow); setX(b, J.lowerArmL, elbow);
  setX(b, J.chest, -(G.leanBase + G.leanPerV * k) - chestAdd);
  setY(b, J.spine, G.twist * s2);
}

/** Writes a legDrop solution to both legs (+ per-side hip offsets) and the
 *  §8.6 slope ankle pitch sp / roll sr (both feet in stance, weight 1). */
function dropLegs(b: PoseBuffer, leg: LegPose, hipR: number, hipL: number, sp: number, sr: number): void {
  setX(b, J.upperLegR, leg.hip + hipR); setX(b, J.lowerLegR, -leg.knee); setZX(b, J.footR, leg.ankle + sp, sr);
  setX(b, J.upperLegL, leg.hip + hipL); setX(b, J.lowerLegL, -leg.knee); setZX(b, J.footL, leg.ankle + sp, sr);
  b.hipsY = leg.hipsY;
}

/** §8.3 Idle: breathing chest, suit-bulk arm abduction, legDrop(0.02). */
export function idlePose(b: PoseBuffer, time: number, addD: number, chestAdd: number, scratch: LegPose,
  sp = 0, sr = 0): void {
  restInto(b);
  dropLegs(b, legDrop(G.idleDrop + addD, scratch), 0, 0, sp, sr);
  setX(b, J.chest, -G.idleBreath * Math.sin(TAU * G.idleBreathHz * time) - chestAdd);
  setZX(b, J.upperArmR, 0, G.idleAbd); setZX(b, J.upperArmL, 0, -G.idleAbd);
}

/** §8.4–§8.5 pose literals (rad, m, s). */
export const AIR = {
  launchDipU: 0.4, launchDipD: 0.10, launchDipChest: 0.20, launchDipArm: -0.5,
  launchAnkle: -0.35, launchArm: 1.2,
  riseHip: 0.6, riseLead: 0.15, riseKnee: 1.0, riseAnkle: 0.2, riseArm: 0.6, riseAbd: 0.25,
  fallT0: 0.15, fallRamp: 0.5, fallAbd: 1.1, fallElbow: 0.3, fallHip: 0.2, fallKnee: 0.35,
  fallFlail: 0.08, fallFlailHz: 0.6,
  landPerSpeed: 0.04, landMin: 0.03, landMax: 0.30, landPeakU: 0.3, landChest: 0.6, landArm: 0.3,
  slideD: 0.15, slideLead: 0.35, slideTrail: -0.20, slideAbd: 0.7, slideChest: 0.10,
  slopeMax: 20 * Math.PI / 180,
} as const;
const P = AIR;
const smooth = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
/** §8.4 Land drop depth from the landing speed. */
export const landDepth = (landingSpeed: number) => clamp(P.landPerSpeed * landingSpeed, P.landMin, P.landMax);

/** §8.4 JumpLaunch at progress u = timeInState / tLaunch ∈ [0,1]. */
export function launchPose(b: PoseBuffer, u: number, scratch: LegPose): void {
  restInto(b);
  const leg = legDrop(P.launchDipD, scratch);
  // WHY (B9b decision): the dip (first 40 %) is a held pose — the 0.05 s
  // blend-in eases into it; the extension then smoothsteps every angle from
  // the dip values to its targets, so the dip → extension seam is C⁰.
  const k = u <= P.launchDipU ? 0 : smooth((u - P.launchDipU) / (1 - P.launchDipU)), r = 1 - k;
  const hip = leg.hip * r, knee = leg.knee * r, ankle = leg.ankle * r + P.launchAnkle * k;
  setX(b, J.upperLegR, hip); setX(b, J.lowerLegR, -knee); setX(b, J.footR, ankle);
  setX(b, J.upperLegL, hip); setX(b, J.lowerLegL, -knee); setX(b, J.footL, ankle);
  b.hipsY = leg.hipsY + (RIG_DIMS.hipsY - leg.hipsY) * k;
  setX(b, J.chest, -P.launchDipChest * r);
  const arm = P.launchDipArm + (P.launchArm - P.launchDipArm) * k;
  setX(b, J.upperArmR, arm); setX(b, J.upperArmL, arm);
}

/** §8.4 JumpRise tuck (R leg leads by 0.15 rad, split ±0.075 about 0.6). */
export function risePose(b: PoseBuffer): void {
  restInto(b);
  const h = P.riseLead * 0.5;
  setX(b, J.upperLegR, P.riseHip + h); setX(b, J.upperLegL, P.riseHip - h);
  setX(b, J.lowerLegR, -P.riseKnee); setX(b, J.lowerLegL, -P.riseKnee);
  setX(b, J.footR, P.riseAnkle); setX(b, J.footL, P.riseAnkle);
  setZX(b, J.upperArmR, P.riseArm, P.riseAbd); setZX(b, J.upperArmL, P.riseArm, -P.riseAbd);
}

/** §8.4 Fall: arms out + legs reaching, weighted by clamp((airTime − 0.15)/0.5). */
export function fallPose(b: PoseBuffer, airTime: number, time: number): void {
  restInto(b);
  const w = clamp((airTime - P.fallT0) / P.fallRamp, 0, 1);
  setZX(b, J.upperArmR, 0, P.fallAbd * w); setZX(b, J.upperArmL, 0, -P.fallAbd * w);
  setX(b, J.lowerArmR, P.fallElbow * w); setX(b, J.lowerArmL, P.fallElbow * w);
  setX(b, J.upperLegR, P.fallHip * w); setX(b, J.upperLegL, P.fallHip * w);
  setX(b, J.lowerLegR, -P.fallKnee * w); setX(b, J.lowerLegL, -P.fallKnee * w);
  setZX(b, J.chest, 0, P.fallFlail * w * Math.sin(TAU * P.fallFlailHz * time));
}

/** §8.4 Land at progress u = timeInState / T_land: ease out to D over the
 *  first 30 %, then smoothstep recovery to 0. Returns the current drop d. */
export function landDrop(u: number, D: number): number {
  if (u < P.landPeakU) { const x = u / P.landPeakU; return D * (1 - (1 - x) * (1 - x)); }
  return D * (1 - smooth((u - P.landPeakU) / (1 - P.landPeakU)));
}
export function landPose(b: PoseBuffer, u: number, D: number, addD: number, chestAdd: number,
  scratch: LegPose, sp: number, sr: number): void {
  restInto(b);
  const d = landDrop(u, D);
  dropLegs(b, legDrop(d + addD, scratch), 0, 0, sp, sr);
  const ratio = D > 0 ? d / D : 0;
  setX(b, J.chest, -P.landChest * d / P.landMax - chestAdd);
  setX(b, J.upperArmR, P.landArm * ratio); setX(b, J.upperArmL, P.landArm * ratio);
}

/** §8.5 Slide: frozen stride, legDrop(0.15), R leads / L trails, arms out, lean back. */
export function slidePose(b: PoseBuffer, addD: number, chestAdd: number, scratch: LegPose,
  sp: number, sr: number): void {
  restInto(b);
  dropLegs(b, legDrop(P.slideD + addD, scratch), P.slideLead, P.slideTrail, sp, sr);
  setZX(b, J.upperArmR, 0, P.slideAbd); setZX(b, J.upperArmL, 0, -P.slideAbd);
  setX(b, J.chest, P.slideChest - chestAdd);
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
  /** Pose inputs refreshed from telemetry each update (public for tests). */
  airTime = 0;
  /** §8.4 Land depth D, fixed at Land entry from landingSpeed. */
  landD: number = P.landMin;
  /** §8.6 slope ankle pitch / roll (rad, clamped ±20°). */
  slopeP = 0;
  slopeR = 0;
  private readonly leg = createLegPose();
  private readonly objs: THREE.Object3D[];

  constructor(rig?: AstronautRig) {
    this.rig = rig ?? buildAstronautRig();
    this.root = this.rig.root;
    this.objs = JOINTS.map((n) => this.rig.joints[n]);
  }

  get stateName(): string { return this.sm.stateName; }

  update(t: Readonly<CharacterTelemetry>, dt: number): void {
    const c = this._dtCell; c.dt = dt; this.updateFrom(t, c);
  }

  private readonly _dtCell = new AnimDtCell();

  /** update() reading dt from `src` once.
   *  WHY (T5 S1bbbbbbb, F5a): playFrame passes its PlayClock, so no double
   *  argument crosses this non-inlined call (it would box per frame). */
  updateFrom(t: Readonly<CharacterTelemetry>, src: AnimDtSource): void {
    const dt = src.dt;
    const sm = this.sm, tr0 = sm.transitions;
    sm.stepFrom(t, src);
    if (sm.transitions !== tr0) {
      // WHY (§8.2 Interrupt): freeze last frame's blended output as `prev`
      // so a transition fired mid-blend restarts from what is on screen.
      this.prevIsSnap = sm.interrupted;
      if (sm.interrupted) copyPose(this.snap, this.out);
      if (sm.state === AnimState.Land) this.landD = landDepth(t.landingSpeed);
    }
    this.time += dt;
    this.airTime = t.airTime;
    this.slopeP = clamp(t.slopeFwdDeg * RAD, -P.slopeMax, P.slopeMax);
    // §8.6: the roll follows the terrain (Rz −slopeSide), not mirrored by side.
    this.slopeR = clamp(-t.slopeSideDeg * RAD, -P.slopeMax, P.slopeMax);
    // §8.5: the stride phase is frozen while sliding.
    if (sm.state !== AnimState.Slide) this.phase = frac(this.phase + dt * gaitFreq(clamp(t.speed, 0, G.vMax)));
    this.evalState(this.cur, sm.state, t.speed, this.progress(sm.state, sm.timeInState));
    if (sm.blend >= 1) copyPose(this.out, this.cur);
    else {
      // WHY (B9b decision): a timed prev state (JumpLaunch / Land) is
      // evaluated at its end (u = 1) — the pose it handed over from.
      const a = this.prevIsSnap ? this.snap : this.evalState(this.prev, sm.prev, t.speed, 1);
      blendPose(this.out, a, this.cur, sm.blend);
    }
    this.writeOut();
  }

  /** Progress u ∈ [0,1] of the timed states (JumpLaunch, Land); 0 otherwise. */
  progress(s: AnimStateId, timeInState: number): number {
    if (s === AnimState.JumpLaunch) return Math.min(1, timeInState / ANIM_TUNING.tLaunch);
    if (s === AnimState.Land) { const d = this.sm.landDuration; return d > 0 ? Math.min(1, timeInState / d) : 1; }
    return 0;
  }

  /** PoseFn dispatch (§8.3–§8.6). `u` = timed-state progress (see `progress`). */
  evalState(b: PoseBuffer, s: AnimStateId, speed: number, u: number): PoseBuffer {
    const sm = this.sm, sp = this.slopeP, sr = this.slopeR;
    const addD = G.crouchDrop * sm.crouchW + sm.softDipD, chestAdd = G.crouchLean * sm.crouchW;
    switch (s) {
      case AnimState.Walk: case AnimState.Run: gaitPose(b, speed, this.phase, addD, chestAdd, this.leg, sp, sr); break;
      case AnimState.JumpLaunch: launchPose(b, u, this.leg); break;
      case AnimState.JumpRise: risePose(b); break;
      case AnimState.Fall: fallPose(b, this.airTime, this.time); break;
      case AnimState.Land: landPose(b, u, this.landD, addD, chestAdd, this.leg, sp, sr); break;
      case AnimState.Slide: slidePose(b, addD, chestAdd, this.leg, sp, sr); break;
      default: idlePose(b, this.time, addD, chestAdd, this.leg, sp, sr);
    }
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