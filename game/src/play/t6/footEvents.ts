// T6 C1 (plan §4.2): foot events — a boot-allocated ring of foot-plant, lift-off, jump and
// landing events. The animator is the only producer (C3 wires it); Audio and Surface consume.
// WHY (T6 C1, brief §3 zero-GC): struct-of-arrays typed buffers, no per-event objects. Each
// consumer keeps its own cursor (a sequence number); `seq` counts every push ever made, so
// a consumer that falls more than FOOT_EVENT_CAP behind skips to oldest() and loses the rest.

export const FootEventKind = { Plant: 0, LiftOff: 1, Jump: 2, Land: 3 } as const;
export type FootEventKind = typeof FootEventKind[keyof typeof FootEventKind];

/** Foot index: 0 left, 1 right, 2 both (jump / landing). */
export const FOOT_LEFT = 0, FOOT_RIGHT = 1, FOOT_BOTH = 2;

export const FOOT_EVENT_CAP = 64;

export class FootEventRing {
  readonly kind = new Uint8Array(FOOT_EVENT_CAP);
  readonly foot = new Uint8Array(FOOT_EVENT_CAP);
  /** Render-local position (m), xyz interleaved. */
  readonly pos = new Float32Array(FOOT_EVENT_CAP * 3);
  /** Horizontal speed at the event (m/s). */
  readonly speed = new Float32Array(FOOT_EVENT_CAP);
  /** Vertical impact speed (m/s); 0 except for Land. */
  readonly landingSpeed = new Float32Array(FOOT_EVENT_CAP);
  /** Total pushes so far; the next event's sequence number. */
  seq = 0;

  push(kind: FootEventKind, foot: number, x: number, y: number, z: number, speed: number, landingSpeed: number): void {
    const i = this.seq % FOOT_EVENT_CAP;
    this.kind[i] = kind; this.foot[i] = foot;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.speed[i] = speed; this.landingSpeed[i] = landingSpeed;
    this.seq++;
  }

  /** Oldest sequence number still held. */
  oldest(): number { return this.seq > FOOT_EVENT_CAP ? this.seq - FOOT_EVENT_CAP : 0; }

  /** Buffer index of a held sequence number (seq in [oldest(), this.seq)). */
  index(seq: number): number { return seq % FOOT_EVENT_CAP; }
}