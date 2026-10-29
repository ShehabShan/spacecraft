// T6 C1 (plan §4.2): the per-world bundle of T6 registration points, created by
// createMoonWorld and exposed as `world.t6` to scene contributors and playFrame.
import { FrameHooks } from './frameHooks';
import { FootEventRing } from './footEvents';
import { PlacementReservations } from './placement';

export interface T6Hooks {
  readonly frameHooks: FrameHooks;
  readonly footEvents: FootEventRing;
  readonly placement: PlacementReservations;
}

export function createT6Hooks(): T6Hooks {
  return { frameHooks: new FrameHooks(), footEvents: new FootEventRing(), placement: new PlacementReservations() };
}