// T6 C1 (plan §4.2): scene contributors — `{ id, mount(world), dispose() }`. createMoonWorld
// mounts the manifest after its scene graph is built; world.dispose() disposes them in
// reverse order before the world's own teardown.
// WHY (T6 C1, plan §4.1): the manifest lists all six tracks once, so a track edits only its
// own register.ts and never this file (no merge conflicts between parallel tracks).
import type { MoonWorld } from '../world/moonWorld';
import { lightContributor } from './light/register';
import { surfaceContributor } from './surface/register';
import { characterContributor } from './character/register';
import { objectsContributor } from './objects/register';
import { audioContributor } from './audio/register';
import { worldContributor } from './world/register';

export interface SceneContributor {
  readonly id: string;
  /** Boot only: add meshes, register frame hooks and placements. */
  mount(world: MoonWorld): void;
  /** Release everything mount created (GPU resources, listeners). */
  dispose(): void;
}

/** Mount order. Placement-dependent tracks mount after the ones that reserve (World, Objects). */
export const T6_CONTRIBUTORS: readonly SceneContributor[] = [
  lightContributor, surfaceContributor, characterContributor,
  objectsContributor, audioContributor, worldContributor,
];

/**
 * Mounts `list` in order and returns the teardown that disposes them in reverse.
 * A mount that throws disposes the already-mounted ones (reverse) and rethrows.
 */
export function mountContributors(world: MoonWorld, list: readonly SceneContributor[]): () => void {
  const seen = new Set<string>();
  for (const c of list) {
    if (seen.has(c.id)) throw new Error(`duplicate scene contributor '${c.id}'`);
    seen.add(c.id);
  }
  const mounted: SceneContributor[] = [];
  const unmount = (): void => { while (mounted.length > 0) mounted.pop()!.dispose(); };
  try {
    for (const c of list) { c.mount(world); mounted.push(c); }
  } catch (e) {
    unmount();
    throw e;
  }
  return unmount;
}