// T1 articulated astronaut (plan §7, B6): a ROBLOX-like block astronaut,
// 1.87 m tall, 17 pivot groups with box meshes hanging below them — no
// skeleton, no skinning, no asset. Every number is binding (§7.2/§7.3);
// only the palette is tunable. Boot-only allocation.
import * as THREE from 'three';
import { NEAR_BIT } from '../../render/MultiCameraRig';

export const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head',
  'upperArmL', 'lowerArmL', 'handL', 'upperArmR', 'lowerArmR', 'handR',
  'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'] as const;
export type JointName = typeof JOINTS[number];

// WHY: §8's pose and IK math reads these — never duplicate the literals.
export const RIG_DIMS = {
  height: 1.87, eyeY: 1.67, hipsY: 0.92,
  hipX: 0.11, hipDrop: 0.06, upperLeg: 0.40, lowerLeg: 0.40, ankleY: 0.06,
  toeZ: -0.19, heelZ: 0.09,
  shoulderX: 0.30, shoulderY: 0.28 /* from chest */, upperArm: 0.30, lowerArm: 0.26, hand: 0.12,
} as const;  // restHipsY === RIG_DIMS.hipsY

export interface AstronautRig {
  root: THREE.Group;                       // characterRoot child; carries the facing yaw fix
  joints: Record<JointName, THREE.Object3D>;  // pivot groups; meshes hang below
  restHipsY: number;
  geometries: THREE.BufferGeometry[]; materials: THREE.Material[];
}

type Mat = 'suit' | 'dark' | 'visor' | 'accent';
type Shape = 'box' | 'sphere' | 'cyl';
/** [shape, size (box w,h,d | sphere r | cyl r,h), centre offset, material] */
type Seg = [Shape, readonly number[], readonly [number, number, number], Mat];

// §7.2 table: joint, parent, pivot offset from parent, segments below it.
// R is +X, L is −X (§7.1).
type JointSpec = [JointName, JointName | null, readonly [number, number, number], readonly Seg[]];
const D = RIG_DIMS;
function limbSpecs(side: 'R' | 'L', sx: number): JointSpec[] {
  return [
    [`upperArm${side}`, 'chest', [sx * D.shoulderX, D.shoulderY, 0], [['box', [0.14, 0.30, 0.14], [0, -0.15, 0], 'suit']]],
    [`lowerArm${side}`, `upperArm${side}`, [0, -D.upperArm, 0], [['box', [0.13, 0.26, 0.13], [0, -0.13, 0], 'suit']]],
    [`hand${side}`, `lowerArm${side}`, [0, -D.lowerArm, 0], [['box', [0.12, 0.12, 0.12], [0, -0.06, 0], 'dark']]],
    [`upperLeg${side}`, 'hips', [sx * D.hipX, -D.hipDrop, 0], [['box', [0.17, 0.40, 0.19], [0, -0.20, 0], 'suit']]],
    [`lowerLeg${side}`, `upperLeg${side}`, [0, -D.upperLeg, 0], [['box', [0.16, 0.40, 0.18], [0, -0.20, 0], 'suit']]],
    // boot: sole at rig y = 0, toe at z −0.19, heel at z +0.09
    [`foot${side}`, `lowerLeg${side}`, [0, -D.lowerLeg, 0], [['box', [0.16, 0.08, 0.28], [0, -0.02, -0.05], 'dark']]],
  ] as JointSpec[];
}
const SPECS: JointSpec[] = [
  ['hips', null, [0, D.hipsY, 0], [['box', [0.36, 0.18, 0.24], [0, 0, 0], 'dark']]],
  ['spine', 'hips', [0, 0.08, 0], [['box', [0.34, 0.20, 0.24], [0, 0.10, 0], 'suit']]],
  ['chest', 'spine', [0, 0.20, 0], [
    ['box', [0.46, 0.34, 0.28], [0, 0.15, 0], 'suit'],
    ['box', [0.20, 0.12, 0.02], [0, 0.18, -0.15], 'accent'],    // chest panel (facing cue)
    ['box', [0.38, 0.46, 0.18], [0, 0.13, 0.23], 'dark'],       // backpack
  ]],
  ['neck', 'chest', [0, 0.32, 0], [['cyl', [0.09, 0.06], [0, 0.03, 0], 'dark']]],
  ['head', 'neck', [0, 0.06, 0], [
    ['sphere', [0.21], [0, 0.08, 0], 'suit'],
    ['box', [0.26, 0.14, 0.06], [0, 0.09, -0.19], 'visor'],
  ]],
  ...limbSpecs('L', -1), ...limbSpecs('R', +1),
];

/** Boot only. `groundClearance` = MOON_ASTRONAUT.groundClearance (§7.4). */
export function buildAstronautRig(groundClearance = 0.02): AstronautRig {
  // WHY (§7.3): three shared unit geometries, sized through mesh.scale.
  const geo: Record<Shape, THREE.BufferGeometry> = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  };
  const mat: Record<Mat, THREE.MeshStandardMaterial> = {
    suit: new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x3a4652, roughness: 0.7 }),
    visor: new THREE.MeshStandardMaterial({
      color: 0x7fd4ff, emissive: 0x1e7fb8, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.1,
    }),
    accent: new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.6 }),
  };

  const root = new THREE.Group();
  root.name = 'rig.root';
  // WHY (§7.4): the KCC rests the body at R + h + groundClearance; without
  // this offset the boots float 2 cm above the terrain.
  root.position.set(0, -groundClearance, 0);
  // WHY (§7.1): characterRoot +X is kcc.fwd (frame quat columns X=fwd,
  // Y=up, Z=right). Ry(−π/2) maps rig −Z (facing) → +X and rig +X (right)
  // → +Z — a proper rotation, no mirroring. Boot-constant; the animator
  // never writes it.
  root.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);

  const joints = {} as Record<JointName, THREE.Object3D>;
  for (const [name, parent, p, segs] of SPECS) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(p[0], p[1], p[2]);
    (parent === null ? root : joints[parent]).add(g);
    joints[name] = g;
    for (const [shape, s, c, m] of segs) {
      const mesh = new THREE.Mesh(geo[shape], mat[m]);
      mesh.name = `${name}:${shape}`;
      if (shape === 'box') mesh.scale.set(s[0], s[1], s[2]);
      else if (shape === 'sphere') mesh.scale.set(s[0], s[0], s[0]);
      else mesh.scale.set(s[0], s[1], s[0]);
      mesh.position.set(c[0], c[1], c[2]);
      // Static under its pivot: compose once, never auto-update (§7.3).
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      g.add(mesh);
    }
  }
  // WHY (§7.3): three.js tests layers per object, not per parent — every
  // mesh must carry NEAR_BIT explicitly (guards a future layer-bit change).
  root.traverse((o) => { o.layers.mask = NEAR_BIT; });
  // WHY (§7.6): Object.keys(joints) must equal JOINTS in order; the build
  // order above is parent-first (legs need hips), so re-key in JOINTS order.
  const ordered = {} as Record<JointName, THREE.Object3D>;
  for (const k of JOINTS) ordered[k] = joints[k];

  return {
    root, joints: ordered, restHipsY: D.hipsY,
    geometries: [geo.box, geo.sphere, geo.cyl],
    materials: [mat.suit, mat.dark, mat.visor, mat.accent],
  };
}

/** Teardown only: detach + dispose the 3 geometries and 4 materials. */
export function disposeAstronautRig(r: AstronautRig): void {
  r.root.removeFromParent();
  for (const g of r.geometries) g.dispose();
  for (const m of r.materials) m.dispose();
}