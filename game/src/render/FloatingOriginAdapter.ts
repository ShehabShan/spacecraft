/**
 * ============================================================================
 *  FLOATING ORIGIN ADAPTER — THREE.JS BRIDGE (RENDER EXTRACT)
 *  Milestone 1A · Spec 01.1 step 8, Spec 04.2 / 04.3 discipline
 * ============================================================================
 *  This is the FIRST place three.js appears in the data path. It is the only
 *  module permitted to translate core state into scene-graph state.
 *
 *  DESIGN RULES:
 *  - Bindings are created at boot (setup path). update() is called ONCE per
 *    frame, imperatively, inside the rAF/useFrame loop BEFORE
 *    renderer.render — never from React effects (Spec 04.2: effects lag one
 *    frame and cause pops).
 *  - update() allocates NOTHING: index loops over dense parallel arrays
 *    (Map iteration allocates an iterator per call — banned in hot paths).
 *  - The f32 values written by the core flow untouched into Object3D
 *    positions: the entire chain from (P − O) in f64 to the GPU stays
 *    bit-identical.
 *  - No dispose(), no scene.remove() mid-flight (Spec 04.3): an entity that
 *    is unregistered simply has its object hidden, never destroyed.
 */


import * as THREE from 'three';
import type { EntityId, Vec3f64 } from '../core/types';
import type { SimulationCore } from '../core/simulation/SimulationCore';


export class FloatingOriginAdapter {
  private readonly _core: SimulationCore;


  /** Dense parallel arrays — the zero-iteration-allocation binding table. */
  private readonly _ids: EntityId[] = [];
  private readonly _objects: THREE.Object3D[] = [];
  private readonly _index = new Map<EntityId, number>();


  constructor(core: SimulationCore) {
    this._core = core;
  }


  /**
   * Bind an entity id to a scene object. Setup path (allocation allowed).
   * Idempotent: re-binding replaces the object in place (React StrictMode
   * double-mount safe) instead of growing the table.
   */
  bind(id: EntityId, object: THREE.Object3D): void {
    const existing = this._index.get(id);
    if (existing !== undefined) {
      this._objects[existing] = object;
      return;
    }
    this._index.set(id, this._ids.length);
    this._ids.push(id);
    this._objects.push(object);
  }


  /** Unbind (swap-remove). Setup/teardown path. */
  unbind(id: EntityId): boolean {
    const idx = this._index.get(id);
    if (idx === undefined) {
      return false;
    }
    const last = this._ids.length - 1;
    if (idx !== last) {
      this._ids[idx] = this._ids[last];
      this._objects[idx] = this._objects[last];
      this._index.set(this._ids[idx], idx);
    }
    this._ids.pop();
    this._objects.pop();
    this._index.delete(id);
    return true;
  }


  /**
   * SINGLE DOWNSTREAM PASS — call once per frame after SimulationCore.advance().
   * Copies the core-owned f32 locals into Object3D positions. Zero allocation.
   */
  update(): void {
    const ids = this._ids;
    const objects = this._objects;
    for (let i = 0; i < ids.length; i++) {
      const local = this._core.getLocalPositionF32(ids[i]);
      const obj = objects[i];
      if (local === null) {
        // Entity was unregistered: hide, never dispose (Zero-GC mandate).
        obj.visible = false;
        continue;
      }
      // f32-exact values assigned untouched — no transform math here.
      obj.position.set(local[0], local[1], local[2]);
    }
  }


  /** Current origin copied into a caller-owned Vector3 (no allocation). */
  copyOriginInto(out: THREE.Vector3): THREE.Vector3 {
    const o = this._core.getOrigin();
    out.set(o.x, o.y, o.z);
    return out;
  }


  /** Read-only origin passthrough (plain f64 numbers). */
  getOriginReadonly(): Vec3f64 {
    return this._core.getOrigin();
  }


  get boundCount(): number {
    return this._ids.length;
  }
}
