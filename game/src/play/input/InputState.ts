// T1 play input (plan §5.2, §9.1, §10.2, K3; B5a). DOM code only — no THREE,
// no React. Listeners write plain fields; the frame loop reads them (stage 2/4)
// and calls clearEdges() at the end of the frame. Zero allocation per event.

/** Minimal DOM surface used here (lets test-play-shell drive it headless). */
export interface InputTarget {
  addEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
  removeEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
  requestPointerLock?: () => unknown;
}
export interface InputDoc {
  addEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
  removeEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
  pointerLockElement: unknown;
  exitPointerLock?: () => void;
}
export interface InputWin {
  addEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
  removeEventListener(type: string, fn: (ev: any) => void, opts?: any): void;
}

// WHY: K3 — Chrome/Firefox emit movementX/Y spikes of hundreds of px on the
// event after a lock change; the first event is dropped and every event is
// clamped. 200 px at lookSens 0.0022 is 0.44 rad — a fast but real flick.
export const MOUSE_EVENT_CLAMP_PX = 200;

const enum K { W, A, S, D, SHIFT_L, SHIFT_R, C, COUNT }

export class InputState {
  moveX = 0; moveY = 0;               // D−A, W−S
  sprint = false; crouch = false;
  jumpPressed = false;                // latched edge, cleared by the controller
  lookDX = 0; lookDY = 0;             // accumulated movementX/Y while locked
  zoomDelta = 0;                      // accumulated wheel deltaY (additive, §9.1)
  toggleCamEdge = false; respawnEdge = false; pauseEdge = false; toggleHudEdge = false; // H (§10.5)
  pointerLocked = false;
  /** Set on every lock change; the shell runtime (B5b) consumes it. */
  lockChanged = false;

  private readonly held = new Uint8Array(K.COUNT);
  private dropNextMouse = true;
  private el: InputTarget | null = null;
  private doc: InputDoc | null = null;
  private win: InputWin | null = null;

  // Bound once (no per-attach closures beyond these).
  private readonly onKeyDown = (ev: KeyboardEvent): void => this.key(ev, true);
  private readonly onKeyUp = (ev: KeyboardEvent): void => this.key(ev, false);
  private readonly onBlur = (): void => this.clearHeld();
  private readonly onMouseMove = (ev: MouseEvent): void => {
    if (!this.pointerLocked) return;
    if (this.dropNextMouse) { this.dropNextMouse = false; return; }
    this.lookDX += clamp(ev.movementX || 0, MOUSE_EVENT_CLAMP_PX);
    this.lookDY += clamp(ev.movementY || 0, MOUSE_EVENT_CLAMP_PX);
  };
  private readonly onWheel = (ev: WheelEvent): void => {
    if (!this.pointerLocked) return;
    this.zoomDelta += ev.deltaY || 0;
  };
  private readonly onLockChange = (): void => {
    const locked = this.doc !== null && this.el !== null && this.doc.pointerLockElement === this.el;
    this.pointerLocked = locked;
    this.lockChanged = true;
    // WHY: §10.2 — held keys are cleared on every lock change (keyups that
    // happened while unlocked were never seen); pending look is discarded.
    this.clearHeld();
    this.lookDX = 0; this.lookDY = 0; this.zoomDelta = 0;
    this.dropNextMouse = true;
  };

  attach(el: InputTarget, doc: InputDoc = document as unknown as InputDoc,
    win: InputWin = window as unknown as InputWin): void {
    if (this.el) this.detach();
    this.el = el; this.doc = doc; this.win = win;
    win.addEventListener('keydown', this.onKeyDown);
    win.addEventListener('keyup', this.onKeyUp);
    win.addEventListener('blur', this.onBlur);
    doc.addEventListener('mousemove', this.onMouseMove);
    doc.addEventListener('pointerlockchange', this.onLockChange);
    el.addEventListener('wheel', this.onWheel, { passive: true });
    this.pointerLocked = doc.pointerLockElement === el;
  }

  detach(): void {
    const { el, doc, win } = this;
    if (win) {
      win.removeEventListener('keydown', this.onKeyDown);
      win.removeEventListener('keyup', this.onKeyUp);
      win.removeEventListener('blur', this.onBlur);
    }
    if (doc) {
      doc.removeEventListener('mousemove', this.onMouseMove);
      doc.removeEventListener('pointerlockchange', this.onLockChange);
    }
    if (el) el.removeEventListener('wheel', this.onWheel, { passive: true });
    this.el = null; this.doc = null; this.win = null;
    this.pointerLocked = false;
    this.clearHeld(); this.clearEdges();
  }

  /** Must run inside a user-gesture handler (click), per browser rules. */
  requestLock(): void {
    const el = this.el;
    if (!el || !el.requestPointerLock) return;
    // WHY: Chrome returns a Promise that rejects during the ~1 s re-lock
    // refusal; the pointerlockerror event already reports it (§10.2 row).
    const r = el.requestPointerLock() as { catch?: (f: () => void) => void } | undefined;
    if (r && typeof r.catch === 'function') r.catch(() => {});
  }

  exitLock(): void {
    if (this.doc && this.doc.exitPointerLock && this.pointerLocked) this.doc.exitPointerLock();
  }

  /** End of frame: edges fire for exactly one frame (jumpPressed is latched). */
  clearEdges(): void {
    this.toggleCamEdge = false; this.respawnEdge = false;
    this.pauseEdge = false; this.toggleHudEdge = false;
    this.lockChanged = false;
  }

  clearHeld(): void {
    this.held.fill(0);
    this.jumpPressed = false;
    this.derive();
  }

  private key(ev: KeyboardEvent, down: boolean): void {
    const code = ev.code;
    // WHY: Space/arrows scroll the page; suppressed only while playing.
    if (this.pointerLocked && (code === 'Space' || code.startsWith('Arrow'))) ev.preventDefault?.();
    if (!down) { this.setHeld(code, 0); return; }
    // WHY: §9.1 — keys are read only while locked; auto-repeat never makes
    // a second edge (one edge per physical press).
    if (!this.pointerLocked || ev.repeat) return;
    if (this.setHeld(code, 1)) return;
    switch (code) {
      case 'Space': this.jumpPressed = true; break;
      case 'KeyV': this.toggleCamEdge = true; break;
      case 'KeyR': this.respawnEdge = true; break;
      case 'KeyP': this.pauseEdge = true; break;
      case 'KeyH': this.toggleHudEdge = true; break;
    }
  }

  /** Returns true when `code` is a held-set key. */
  private setHeld(code: string, v: 0 | 1): boolean {
    let k: number;
    switch (code) {
      case 'KeyW': k = K.W; break;
      case 'KeyA': k = K.A; break;
      case 'KeyS': k = K.S; break;
      case 'KeyD': k = K.D; break;
      case 'ShiftLeft': k = K.SHIFT_L; break;
      case 'ShiftRight': k = K.SHIFT_R; break;
      case 'KeyC': k = K.C; break;
      default: return false;
    }
    this.held[k] = v;
    this.derive();
    return true;
  }

  private derive(): void {
    const h = this.held;
    this.moveX = h[K.D] - h[K.A];
    this.moveY = h[K.W] - h[K.S];
    this.sprint = h[K.SHIFT_L] === 1 || h[K.SHIFT_R] === 1;
    this.crouch = h[K.C] === 1;
  }
}

function clamp(v: number, m: number): number { return v > m ? m : v < -m ? -m : v; }