// T1 animator seam (plan §5.2, §7.5, K13) — THE GLB seam. The controller,
// camera and frame pipeline import only this interface type; a future
// GltfAnimator (GLTFLoader + AnimationMixer) implements the same members.
import type * as THREE from 'three';
import type { CharacterTelemetry } from './CharacterTelemetry';
import type { AnimDtSource as DtSource } from './animStateMachine';
import { buildAstronautRig, disposeAstronautRig, JOINTS, type AstronautRig } from './AstronautRig';

export interface CharacterAnimator {
  readonly root: THREE.Object3D;      // feet contact = origin, +Y up, −Z facing
  readonly stateName: string;         // HUD/debug
  update(t: Readonly<CharacterTelemetry>, dt: number): void;
  /** update() reading dt from `src` (T5 S1bbbbbbb, F5a: the play frame passes
   *  its PlayClock so no double argument boxes at this call boundary). */
  updateFrom(t: Readonly<CharacterTelemetry>, src: DtSource): void;
  setVisible(v: boolean): void;       // false in first person
  dispose(): void;
}

/**
 * Identity-pose animator: the B6–B8 placeholder until ProceduralAnimator
 * (B9). WHY (K13): two implementations behind one interface from B6 on keep
 * the seam honest — nothing outside src/play/character may need joints.
 */
export class RestAnimator implements CharacterAnimator {
  readonly rig: AstronautRig;
  readonly root: THREE.Object3D;
  readonly stateName = 'Rest';

  constructor(rig?: AstronautRig) {
    this.rig = rig ?? buildAstronautRig();
    this.root = this.rig.root;
  }

  update(_t: Readonly<CharacterTelemetry>, _dt: number): void {
    // Rest pose = identity on every joint (§7.1) + rest hips height. Writes
    // in place — no allocation.
    const j = this.rig.joints;
    for (let i = 0; i < JOINTS.length; i++) j[JOINTS[i]].quaternion.set(0, 0, 0, 1);
    j.hips.position.y = this.rig.restHipsY;
  }

  /** The rest pose ignores dt. */
  updateFrom(t: Readonly<CharacterTelemetry>, _src: DtSource): void { this.update(t, 0); }

  setVisible(v: boolean): void { this.root.visible = v; }

  dispose(): void { disposeAstronautRig(this.rig); }
}