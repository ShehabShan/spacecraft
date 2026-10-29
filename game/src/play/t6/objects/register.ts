// T6 Objects track scene contributor (plan §4.2, §5.5). Empty until the track builds it.
import type { SceneContributor } from '../sceneContributors';

export const objectsContributor: SceneContributor = { id: 'objects', mount() {}, dispose() {} };