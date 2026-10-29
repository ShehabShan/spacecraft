// T1 B3 (plan §5 MoonLod sketch, §12.2 B3, risk K2): the M1F quadtree + LOD
// controller as a class. Harness `Milestone1F_TestHarness.tsx` lines 274–434
// are ported BY VALUE (the harness is never imported, K10). The constants and
// the split/merge/release/activation algorithm are byte-for-byte; the only
// change is module globals → instance fields (`this.`), with read-only
// references aliased to locals of the same name so the bodies diff cleanly.
// Additive (§10.3): `residentAround` (loading-gate fraction), `isSelectedLeaf`
// and `stats`.
import {
  GRID_N, terrainHeight, chunkArcWidth, chunkKey, gridCoord,
} from '../../core/terrain/terrainField';
import { faceCubePointInto, spherifyInto, type Vec3Out } from '../../core/terrain/spherify';
import type { TerrainMeshPool } from '../../render/TerrainMeshPool';
import { HEIGHT_SLACK } from './moonConfig';
import { Vec3d, hypot3 } from '../../core/physics/sphericalFrame';

// WHY: harness 274–277 verbatim (K2: copied, not re-derived).
export const LOD = {
  MAX_LEVEL: 4, SPLIT_K: 2.0, MERGE_K: 1.45, GRACE_FRAMES: 45,
  ACTIVATIONS_PER_FRAME: 3, TOTAL_INFLIGHT_CAP: 24, HORIZON_MARGIN: 150,
} as const;
const {
  MAX_LEVEL, SPLIT_K, MERGE_K, GRACE_FRAMES,
  ACTIVATIONS_PER_FRAME, TOTAL_INFLIGHT_CAP, HORIZON_MARGIN,
} = LOD;

export interface QNode {
  face: number; level: number; ix: number; iy: number; key: number;
  ox: number; oy: number; oz: number; width: number; brad: number;
  parent: QNode | null; split: boolean; desired: boolean;
  activeRec: number; pendingRec: number;
}
export const LEVEL_OFFSETS = [0, 1, 5, 21, 85];
export const NODES_PER_FACE = 341;

/** The pool surface the controller uses; `TerrainMeshPool` satisfies it
 *  structurally, and the Node test (`test-play-lod`) supplies a fake. */
export type LodPool = Pick<TerrainMeshPool,
  'records' | 'acquire' | 'release' | 'freeCount' | 'inFlightTotal'>;

export class MoonLod {
  /** FACE_NODES: 6 faces × 341 nodes, boot-built (terrain field must be
   *  initialised before construction — node origins sample terrainHeight). */
  readonly faces: QNode[][] = [];
  readonly stats = { active: 0, pending: 0, candidates: 0 };
  private readonly pool: LodPool;
  private readonly R: number;
  // WHY (T5 S1bbbbbbb, F5a): Vec3d, not a `{x,y,z}` literal (its shared hidden
  // class boxes every double store, T5 S1bbbba).
  private readonly camPlanet = new Vec3d(0, 0, 0);
  /** Camera position (planet frame) slots read by `updateIo`. */
  readonly camIo = new Float64Array(3);
  private camUX = 0; private camUY = 0; private camUZ = 0; private horizonDot = 0;
  private readonly candNodes: QNode[] = [];
  private readonly candDist = new Float64Array(64);
  private candCount = 0;

  constructor(pool: LodPool, radius: number) {
    this.pool = pool;
    this.R = radius;
    const R = radius;
    const FACE_NODES = this.faces;
    // ---- harness buildNodes() (285–316) ----
    const dir: Vec3Out = { x: 0, y: 0, z: 0 };
    for (let f = 0; f < 6; f++) {
      const arr: QNode[] = new Array(341);
      for (let L = 0; L <= MAX_LEVEL; L++) {
        const D = GRID_N << L, cnt = 1 << L;
        for (let ix = 0; ix < cnt; ix++) for (let iy = 0; iy < cnt; iy++) {
          const u = gridCoord(ix * GRID_N + (GRID_N >> 1), D);
          const v = gridCoord(iy * GRID_N + (GRID_N >> 1), D);
          faceCubePointInto(f, u, v, dir);
          spherifyInto(dir.x, dir.y, dir.z, dir);
          const rr = R + terrainHeight(dir.x, dir.y, dir.z);
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy] = {
            face: f, level: L, ix, iy, key: chunkKey(f, L, ix, iy),
            ox: dir.x * rr, oy: dir.y * rr, oz: dir.z * rr,
            width: chunkArcWidth(L), brad: chunkArcWidth(L) * 0.75 + HEIGHT_SLACK,
            parent: null, split: false, desired: false, activeRec: -1, pendingRec: -1,
          };
        }
      }
      for (let L = 1; L <= MAX_LEVEL; L++) {
        const cnt = 1 << L, pc = 1 << (L - 1);
        for (let ix = 0; ix < cnt; ix++) for (let iy = 0; iy < cnt; iy++) {
          arr[LEVEL_OFFSETS[L] + ix * cnt + iy].parent =
            arr[LEVEL_OFFSETS[L - 1] + (ix >> 1) * pc + (iy >> 1)];
        }
      }
      FACE_NODES.push(arr);
    }
  }

  // ---- harness childOf (317–320) ----
  childOf(n: QNode, c: number): QNode {
    const FACE_NODES = this.faces;
    const L1 = n.level + 1, cnt = 1 << L1;
    return FACE_NODES[n.face][LEVEL_OFFSETS[L1] + (n.ix * 2 + (c >> 1)) * cnt + (n.iy * 2 + (c & 1))];
  }
  // ---- harness nodeHasData (321–325) ----
  nodeHasData(n: QNode): boolean {
    const pool = this.pool;
    if (n.activeRec >= 0) return true;
    if (n.pendingRec >= 0 && pool.records[n.pendingRec].state === 2) return true;
    return false;
  }
  // ---- harness clearSubtree (332–335) ----
  private clearSubtree(n: QNode): void {
    n.desired = false;
    if (n.level < MAX_LEVEL) for (let c = 0; c < 4; c++) this.clearSubtree(this.childOf(n, c));
  }
  // ---- harness visitNode (336–359) ----
  private visitNode(n: QNode): boolean {
    const camPlanet = this.camPlanet, candNodes = this.candNodes, candDist = this.candDist;
    if (n.ox * this.camUX + n.oy * this.camUY + n.oz * this.camUZ + n.brad < this.horizonDot - HORIZON_MARGIN) {
      this.clearSubtree(n); return false;
    }
    const dx = camPlanet.x - n.ox, dy = camPlanet.y - n.oy, dz = camPlanet.z - n.oz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const sd = SPLIT_K * n.width;
    if (n.split && d > MERGE_K * sd) n.split = false;
    if (!n.split && n.level < MAX_LEVEL && d < sd) n.split = true;
    if (n.split && n.level < MAX_LEVEL) {
      let any = false;
      for (let c = 0; c < 4; c++) if (this.visitNode(this.childOf(n, c))) any = true;
      n.desired = !any;
      return true;
    }
    n.desired = true;
    if (n.activeRec < 0 && n.pendingRec < 0 && this.candCount < 64) {
      candNodes[this.candCount] = n; candDist[this.candCount] = d; this.candCount++;
    }
    return true;
  }

  /** Harness `camPlanet = …; updateLOD()` (1501–1504). Camera position in
   *  the PLANET frame (caller conjugates by the spin quat). Zero-alloc in
   *  steady state. Does not pump the pool (the frame loop does, §7). */
  update(camPlanetX: number, camPlanetY: number, camPlanetZ: number): void {
    const io = this.camIo; io[0] = camPlanetX; io[1] = camPlanetY; io[2] = camPlanetZ;
    this.updateIo();
  }

  /** update() reading the camera from `camIo`.
   *  WHY (T5 S1bbbbbbb, F5a): playFrame writes the slots, so no double argument
   *  crosses this non-inlined call (it would box per frame). */
  updateIo(): void {
    const camPlanet = this.camPlanet, cio = this.camIo;
    camPlanet.x = cio[0]; camPlanet.y = cio[1]; camPlanet.z = cio[2];
    // ---- harness updateLOD (360–434) ----
    const pool = this.pool, R = this.R, FACE_NODES = this.faces;
    const candNodes = this.candNodes, candDist = this.candDist;
    const recs = pool.records;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      if (rec.state === 2 && rec.owner !== null) {
        const n = rec.owner as QNode;
        if (n.pendingRec === i) { n.pendingRec = -1; n.activeRec = i; }
      }
    }
    const cr = hypot3(camPlanet.x, camPlanet.y, camPlanet.z) || 1; // WHY (T5 S1bbbbbbb): 3-arg Math.hypot boxes; hypot3 bit-identical
    this.camUX = camPlanet.x / cr; this.camUY = camPlanet.y / cr; this.camUZ = camPlanet.z / cr;
    this.horizonDot = (R * R) / cr;
    this.candCount = 0;
    for (let f = 0; f < 6; f++) this.visitNode(FACE_NODES[f][0]);
    const pressure = pool.freeCount() < 6;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const node = rec.owner as QNode | null;
      if (node === null) continue;
      if (rec.state === 2) {
        if (node.desired) { rec.unwanted = 0; continue; }
        if (node.split) {
          let cd = false;
          for (let c = 0; c < 4; c++) if (this.nodeHasData(this.childOf(node, c))) { cd = true; break; }
          if (cd) rec.mesh.visible = false;
        }
        let keep = false;
        if (node.split) {
          for (let c = 0; c < 4; c++) {
            const ch = this.childOf(node, c);
            if (ch.desired && !this.nodeHasData(ch)) { keep = true; break; }
          }
        } else {
          const p = node.parent;
          if (p !== null && p.desired && !this.nodeHasData(p)) keep = true;
        }
        if (keep && !pressure) { rec.unwanted = 0; continue; }
        rec.unwanted++;
        if (rec.unwanted >= GRACE_FRAMES || pressure) {
          pool.release(i);
          if (node.activeRec === i) node.activeRec = -1;
          rec.owner = null;
        }
      } else if (rec.state === 1) {
        if (!node.desired && !node.split) {
          rec.unwanted++;
          if (rec.unwanted >= GRACE_FRAMES) {
            pool.release(i);
            if (node.pendingRec === i) node.pendingRec = -1;
            rec.owner = null;
          }
        } else rec.unwanted = 0;
      }
    }
    for (let a = 1; a < this.candCount; a++) {
      const d = candDist[a], n = candNodes[a];
      let b = a - 1;
      while (b >= 0 && candDist[b] > d) { candDist[b + 1] = candDist[b]; candNodes[b + 1] = candNodes[b]; b--; }
      candDist[b + 1] = d; candNodes[b + 1] = n;
    }
    let act = 0;
    for (let a = 0; a < this.candCount && act < ACTIVATIONS_PER_FRAME; a++) {
      if (pool.inFlightTotal() >= TOTAL_INFLIGHT_CAP) break;
      if (pool.freeCount() <= 2) break;
      const n = candNodes[a];
      const idx = pool.acquire(n.face, n.level, n.ix, n.iy, n.ox, n.oy, n.oz);
      if (idx < 0) break;
      pool.records[idx].owner = n;
      n.pendingRec = idx;
      act++;
    }
    // ---- end harness body; additive stats (read-only pass) ----
    let active = 0, pending = 0;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      if (rec.owner === null) continue;
      if (rec.state === 2) active++; else if (rec.state === 1) pending++;
    }
    this.stats.active = active; this.stats.pending = pending; this.stats.candidates = this.candCount;
  }

  /** True when `n` is in the currently selected leaf set: `desired` and every
   *  ancestor split-and-not-desired. WHY: the harness never clears `desired`
   *  on the children of a node that merges (they keep stale `true`), so the
   *  flag alone over-counts; the ancestry walk is the exact selection. */
  isSelectedLeaf(n: QNode): boolean {
    if (!n.desired) return false;
    for (let p = n.parent; p !== null; p = p.parent) if (!p.split || p.desired) return false;
    return true;
  }

  /** Loading gate (§10.3): fraction in [0, 1] of the selected leaves whose
   *  centre lies within the angular radius radiusM / R of `dir` that have a
   *  resident mesh (`nodeHasData`). 0 when no such leaf is selected yet. */
  residentAround(dirX: number, dirY: number, dirZ: number, radiusM: number): number {
    const dl = Math.hypot(dirX, dirY, dirZ) || 1;
    const ux = dirX / dl, uy = dirY / dl, uz = dirZ / dl;
    const cosMax = Math.cos(radiusM / this.R);
    let total = 0, resident = 0;
    for (let f = 0; f < 6; f++) {
      const arr = this.faces[f];
      for (let i = 0; i < arr.length; i++) {
        const n = arr[i];
        if (!this.isSelectedLeaf(n)) continue;
        const ol = Math.hypot(n.ox, n.oy, n.oz) || 1;
        if ((n.ox * ux + n.oy * uy + n.oz * uz) / ol < cosMax) continue;
        total++;
        if (this.nodeHasData(n)) resident++;
      }
    }
    return total === 0 ? 0 : resident / total;
  }
}