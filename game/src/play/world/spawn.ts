// T1 play spawn (plan §6.1, B2). findEarthriseSpawn = the M1F harness
// findSpawn search (~157–221) VERBATIM, so play and M1F spawn at the same
// deterministic site; the ?spawn= parse is split out as parseSpawnOverride.
// Requires initTerrainField(MOON_PARAMS) to have run (the world does it, B4).
import { terrainHeight, terrainNormalInto } from '../../core/terrain/terrainField';
import { mulberry32 } from '../../core/terrain/noise';
import type { Vec3 } from '../../core/physics/sphericalFrame';

export interface SpawnSite {
  dir: Vec3;            // unit, planet (moon-fixed) frame
  score: number;        // harness score (slope·40 + 4-probe height deviation)
  earthElevDeg: number; // Earth elevation above the local horizon at spawn
}

const _scanT: Vec3 = { x: 0, y: 0, z: 0 };
const _scanN: Vec3 = { x: 0, y: 0, z: 0 };
export function slopeFromNormal(d: Vec3): number {
  terrainNormalInto(d.x, d.y, d.z, _scanN);
  const c = _scanN.x * d.x + _scanN.y * d.y + _scanN.z * d.z;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

// WHY: takes sunDir as well as earthDir (plan §5.2 listed earthDir only) —
// the verbatim search rotates Earth 75° about earth×sun, so both are inputs.
// Boot-only (~159 ms, allocates freely); never call per frame.
export function findEarthriseSpawn(earthDir: Vec3, sunDir: Vec3): SpawnSite {
  // Rotate the Earth direction 75° toward the sun side: Earth near horizon.
  let ax = earthDir.y * sunDir.z - earthDir.z * sunDir.y;
  let ay = earthDir.z * sunDir.x - earthDir.x * sunDir.z;
  let az = earthDir.x * sunDir.y - earthDir.y * sunDir.x;
  const al = Math.hypot(ax, ay, az) || 1;
  ax /= al; ay /= al; az /= al;
  const c = Math.cos((75 * Math.PI) / 180), s = Math.sin((75 * Math.PI) / 180);
  const rx = earthDir.x * c + (ay * earthDir.z - az * earthDir.y) * s;
  const ry = earthDir.y * c + (az * earthDir.x - ax * earthDir.z) * s;
  const rz = earthDir.z * c + (ax * earthDir.y - ay * earthDir.x) * s;
  const rl = Math.hypot(rx, ry, rz);
  const base = { x: rx / rl, y: ry / rl, z: rz / rl };
  const rand = mulberry32(0x7f1a);
  let best: Vec3 = base; let bestScore = Infinity;
  for (let i = 0; i < 24000; i++) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    const jitter = 0.02 + 0.1 * rand();
    const cx = base.x + Math.cos(th) * q * jitter;
    const cy = base.y + u * jitter;
    const cz = base.z + Math.sin(th) * q * jitter;
    const cl = Math.hypot(cx, cy, cz);
    _scanT.x = cx / cl; _scanT.y = cy / cl; _scanT.z = cz / cl;
    const slope = slopeFromNormal(_scanT);
    if (slope < 0.01) continue;
    const h0 = terrainHeight(_scanT.x, _scanT.y, _scanT.z);
    let dev = 0;
    for (let k = 0; k < 4; k++) {
      const a = k * 1.57 + 0.4;
      const ex = Math.cos(a) * 0.0006, ez = Math.sin(a) * 0.0006;
      const el = Math.hypot(_scanT.x + ex, _scanT.y, _scanT.z + ez);
      dev = Math.max(dev, Math.abs(
        terrainHeight((_scanT.x + ex) / el, _scanT.y / el, (_scanT.z + ez) / el) - h0));
    }
    const score = slope * 40 + dev;
    if (score < bestScore) { bestScore = score; best = { x: _scanT.x, y: _scanT.y, z: _scanT.z }; }
    if (score < 0.35) break;
  }
  const e = best.x * earthDir.x + best.y * earthDir.y + best.z * earthDir.z;
  return { dir: best, score: bestScore, earthElevDeg: (Math.asin(Math.max(-1, Math.min(1, e))) * 180) / Math.PI };
}

// ?spawn=x,y,z — moon-fixed direction override (normalized), as the harness
// manual-testing override (Lead-approved round 7). Invalid → warn + null.
export function parseSpawnOverride(search: string): Vec3 | null {
  const spawnParam = new URLSearchParams(search).get('spawn');
  if (spawnParam === null) return null;
  const parts = spawnParam.split(',').map(Number);
  const l = parts.length === 3 ? Math.hypot(parts[0], parts[1], parts[2]) : 0;
  if (parts.every((v) => Number.isFinite(v)) && l > 0) {
    return { x: parts[0] / l, y: parts[1] / l, z: parts[2] / l };
  }
  console.warn(`[play] ?spawn="${spawnParam}" invalid — falling back to the search spawn`);
  return null;
}