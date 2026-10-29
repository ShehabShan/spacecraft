// T6 C1: the play world's lights, moved unchanged out of createMoonWorld (plan §4.1).
// Owned by the Light track from C1 on (colour, shadows, low sun, plan §5.3).
import * as THREE from 'three';
import type { Vec3 } from '../../core/physics/sphericalFrame';

/** Adds the sun, Earthshine and ambient lights to `root` (values and order as of T5/T4). */
export function addMoonLights(root: THREE.Group, sunDir: Vec3, earthDir: Vec3): void {
  const sunLight = new THREE.DirectionalLight(0xfff1de, 2.2);
  sunLight.position.set(sunDir.x * 8000, sunDir.y * 8000, sunDir.z * 8000);
  const earthLight = new THREE.DirectionalLight(0x8fb4e8, 0.28);
  earthLight.position.set(earthDir.x * 8000, earthDir.y * 8000, earthDir.z * 8000);
  root.add(sunLight, sunLight.target, earthLight, earthLight.target,
    new THREE.AmbientLight(0x2a3850, 0.5));
}