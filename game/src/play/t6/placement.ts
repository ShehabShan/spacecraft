// T6 C1 (plan §4.2): placement reservations. Set pieces and the lander reserve discs
// (Moon-fixed centre, radius in metres); boulder scatter skips any reserved point.
// WHY (T6 C1): Float64 storage — Moon-fixed coordinates are ~1.7e6 m, where Float32 keeps
// only ~0.1 m (brief §3 floating origin). Boot-time reservations, fixed capacity.

export const PLACEMENT_CAP = 64;

export class PlacementReservations {
  private readonly c = new Float64Array(PLACEMENT_CAP * 3);
  private readonly r2 = new Float64Array(PLACEMENT_CAP);
  private readonly ids: string[] = [];

  get count(): number { return this.ids.length; }

  /** Reserves a disc; returns its index. Throws on a full table or a duplicate id. */
  reserve(id: string, x: number, y: number, z: number, radiusM: number): number {
    if (this.ids.length >= PLACEMENT_CAP) throw new Error(`placement table full (${PLACEMENT_CAP})`);
    if (this.ids.includes(id)) throw new Error(`placement '${id}' already reserved`);
    if (!(radiusM > 0)) throw new Error(`placement '${id}': radius must be > 0`);
    const i = this.ids.length;
    this.c[i * 3] = x; this.c[i * 3 + 1] = y; this.c[i * 3 + 2] = z;
    this.r2[i] = radiusM * radiusM;
    this.ids.push(id);
    return i;
  }

  /** True when the Moon-fixed point lies inside any reserved disc (3-D distance). */
  isReserved(x: number, y: number, z: number): boolean {
    const c = this.c, r2 = this.r2;
    for (let i = 0, n = this.ids.length; i < n; i++) {
      const dx = x - c[i * 3], dy = y - c[i * 3 + 1], dz = z - c[i * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < r2[i]) return true;
    }
    return false;
  }

  idAt(i: number): string { return this.ids[i]; }

  clear(): void { this.ids.length = 0; }
}