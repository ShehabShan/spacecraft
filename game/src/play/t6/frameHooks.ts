// T6 C1 (plan §4.2): frame hooks — named slots that playFrame runs at fixed points of the
// canonical stage order (never reordered): afterTelemetry (after stage 7), afterCamera
// (after stage 8), beforeRender (after stage 10).
// WHY (T6 C1, brief §3 zero-GC): each slot is a boot-allocated fixed-length array; hooks
// register at boot (scene-contributor mount), and run() is an index loop that allocates nothing.
import type { CharacterTelemetry } from '../character/CharacterTelemetry';

/** A hook gets the shared read-only telemetry and the frame dt (clock.dt; 0 unless PLAYING). */
export type FrameHookFn = (telem: Readonly<CharacterTelemetry>, dt: number) => void;

/** Hooks per slot. A track that needs more asks the integration session (plan §4.1). */
export const FRAME_HOOK_CAP = 8;

const noop: FrameHookFn = () => {};

export class FrameHookList {
  private readonly fns: FrameHookFn[] = new Array<FrameHookFn>(FRAME_HOOK_CAP).fill(noop);
  private n = 0;
  constructor(readonly slot: string) {}

  get count(): number { return this.n; }

  /** Boot-time only. Throws when the slot is full, so overflow is loud, not silent. */
  add(fn: FrameHookFn): void {
    if (this.n >= FRAME_HOOK_CAP) throw new Error(`frame hook slot '${this.slot}' full (${FRAME_HOOK_CAP})`);
    this.fns[this.n++] = fn;
  }

  /** Teardown: drops every hook (scene-contributor dispose runs before world teardown). */
  clear(): void {
    for (let i = 0; i < this.n; i++) this.fns[i] = noop;
    this.n = 0;
  }

  run(telem: Readonly<CharacterTelemetry>, dt: number): void {
    const fns = this.fns, n = this.n;
    for (let i = 0; i < n; i++) fns[i](telem, dt);
  }
}

export class FrameHooks {
  readonly afterTelemetry = new FrameHookList('afterTelemetry');
  readonly afterCamera = new FrameHookList('afterCamera');
  readonly beforeRender = new FrameHookList('beforeRender');
  clear(): void { this.afterTelemetry.clear(); this.afterCamera.clear(); this.beforeRender.clear(); }
}