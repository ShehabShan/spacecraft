/**
 * F2fcea — rebuilt m1f R5 gate, row R5a (ADR-025). Page `?page=m1fR5`.
 * WHY: the shipped R5 row requires "rebases ≥ 2" from an autopilot that steers toward
 * SAT_B, a point 400 m ABOVE a tangent 2,400 m away; the walker parks at its nadir
 * (~1,374 m of arc), so the row is red by fixture (A1-U03-5). Its Sun-continuity term
 * is sampled only on rebase frames, so 0 rebases gives 0 samples and a pass (A1-U03-6).
 * R5a drives the REAL SimulationCore along a scripted, continuous, non-teleporting
 * great-circle surface route (4,000 m at sprint 6.5 m/s, the U27 control that crosses
 * ≥ 2 lattice shifts) and checks every tick against an independent f64 lattice oracle
 * that imports nothing from the engine. Mutants: `?mut=nadir` (route stops at the
 * shipped fixture's nadir arc), `?mut=skew` (a rebase listener nudges the live,
 * writable origin, A1-U11-3), `?mut=teleport` (300 m jump mid-route).
 * The straddler A/B with a coverage assertion is R5b (F2fceb), not this row.
 */
import { useEffect, useState } from 'react';
import { SimulationCore, FIXED_DT } from '../core/simulation/SimulationCore';

const MUT = new URLSearchParams(window.location.search).get('mut') ?? '';
// Pinned fixture. WHY: R = shipped moon radius 1,364.5 m + 180 m terrain (the U27 grid's
// middle height). Start +X, tangent (0,1,1)/√2: an independent sweep of the oracle gives 0 shifts
// over the shipped nadir arc and 2 over 4,000 m (a (1,1,1) start gave 2 even on the nadir arc, so
// the nadir mutant could not discriminate). The start is >1,024 from the zero origin, so one warm
// tick at rest settles the origin first and only shifts AFTER it are counted as walking shifts.
const R = 1364.5 + 180;
const SPEED = 6.5;                                       // sprint, m/s (shipped KCC)
const ROUTE_M = MUT === 'nadir' ? 1374.391 : 4000;       // nadir arc at 180 m (U27 K2d recheck)
const TELEPORT_AT = 2000, TELEPORT_M = 300;
// Independent oracle constants (NOT imported from precisionMath, on purpose).
const LAT = 256, TRIG = 1024;
type Row = { pass: boolean; detail: string };
type V = { x: number; y: number; z: number };

const s2 = 1 / Math.sqrt(2);
const U: V = { x: 1, y: 0, z: 0 }, Wt: V = { x: 0, y: s2, z: s2 };   // start dir, tangent (U·Wt = 0)
function routeInto(s: number, o: V): V {
  const th = s / R, c = Math.cos(th), n = Math.sin(th);
  o.x = R * (c * U.x + n * Wt.x); o.y = R * (c * U.y + n * Wt.y); o.z = R * (c * U.z + n * Wt.z);
  return o;
}
const maxAbs = (x: number, y: number, z: number): number => Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
const isLattice = (v: number): boolean => Number.isInteger(v / LAT);

function rowR5a(): Row {
  const core = new SimulationCore();
  const p0 = routeInto(0, { x: 0, y: 0, z: 0 });
  const e = core.registerEntity('walker', { absPos: { x: p0.x, y: p0.y, z: p0.z }, velocity: { x: 0, y: 0, z: 0 } });
  const events: Array<{ count: number; d: V; o: V }> = [];
  core.onRebase((ev) => {
    events.push({ count: ev.count, d: { ...ev.delta }, o: { ...ev.newOrigin } });
    if (MUT === 'skew') core.getOrigin().x += 1;          // live, writable origin (A1-U11-3)
  });
  let rb0 = core.stats.rebaseCount;
  const oo: V = { x: 0, y: 0, z: 0 };                     // oracle origin (core starts at 0,0,0)
  let oracleShifts = 0;
  const tgt: V = { x: 0, y: 0, z: 0 };
  const prevAbs: V = { ...p0 }, prevLoc: V = { x: p0.x, y: p0.y, z: p0.z };
  const ticks = Math.ceil(ROUTE_M / (SPEED * FIXED_DT));
  const stepMax = SPEED * FIXED_DT * (1 + 1e-9) + 1e-9;
  let originMis = 0, latticeBad = 0, localOver = 0, f32Bad = 0, celF32Bad = 0, stepBad = 0, identBad = 0;
  let maxLocal = 0, maxStep = 0, maxIdent = 0, minClear = Infinity;
  const cel = core.getCelestialStates();
  let jump = 0;
  for (let k = 0; k <= ticks; k++) {
    if (k === 1) {   // warm tick done: count only walking shifts from here
      rb0 = core.stats.rebaseCount; oracleShifts = 0; events.length = 0;
      originMis = latticeBad = localOver = f32Bad = celF32Bad = stepBad = identBad = 0; maxLocal = maxStep = maxIdent = 0; minClear = Infinity;
    }
    let s = Math.min(ROUTE_M, k * SPEED * FIXED_DT);
    if (MUT === 'teleport' && jump === 0 && s >= TELEPORT_AT) jump = TELEPORT_M;   // permanent 300 m offset
    s += jump;
    routeInto(s, tgt);
    core.setVelocity('walker', (tgt.x - e.absPos.x) / FIXED_DT, (tgt.y - e.absPos.y) / FIXED_DT, (tgt.z - e.absPos.z) / FIXED_DT);
    const evBefore = events.length;
    core.tick();
    const a = e.absPos, O = core.getOrigin();
    // oracle: strict > TRIG on the max axis, snap per axis to the nearest LAT point
    if (maxAbs(a.x - oo.x, a.y - oo.y, a.z - oo.z) > TRIG) {
      oo.x = LAT * Math.floor(a.x / LAT + 0.5); oo.y = LAT * Math.floor(a.y / LAT + 0.5); oo.z = LAT * Math.floor(a.z / LAT + 0.5);
      oracleShifts++;
    }
    if (O.x !== oo.x || O.y !== oo.y || O.z !== oo.z) originMis++;
    if (!isLattice(O.x) || !isLattice(O.y) || !isLattice(O.z)) latticeBad++;
    const lx = a.x - O.x, ly = a.y - O.y, lz = a.z - O.z;
    const m = maxAbs(lx, ly, lz);
    if (m > maxLocal) maxLocal = m;
    if (m > TRIG) localOver++;
    if (TRIG - m < minClear) minClear = TRIG - m;
    const L = e.localPosF32;
    if (L[0] !== Math.fround(lx) || L[1] !== Math.fround(ly) || L[2] !== Math.fround(lz)) f32Bad++;
    for (let i = 0; i < cel.length; i++) {
      const c = cel[i];
      if (c.localPosF32[0] !== Math.fround(c.absPos.x - O.x) || c.localPosF32[1] !== Math.fround(c.absPos.y - O.y) ||
        c.localPosF32[2] !== Math.fround(c.absPos.z - O.z)) celF32Bad++;
    }
    // continuity: no world step beyond sprint·dt; across a rebase the f64 local step = world step − Δ exactly
    const st = Math.hypot(a.x - prevAbs.x, a.y - prevAbs.y, a.z - prevAbs.z);
    if (st > maxStep) maxStep = st;
    if (st > stepMax) stepBad++;
    let dx = 0, dy = 0, dz = 0;
    for (let j = evBefore; j < events.length; j++) { dx += events[j].d.x; dy += events[j].d.y; dz += events[j].d.z; }
    const id = maxAbs((lx - prevLoc.x) - (a.x - prevAbs.x) + dx, (ly - prevLoc.y) - (a.y - prevAbs.y) + dy, (lz - prevLoc.z) - (a.z - prevAbs.z) + dz);
    if (id > maxIdent) maxIdent = id;
    if (id > 1e-9) identBad++;
    prevAbs.x = a.x; prevAbs.y = a.y; prevAbs.z = a.z; prevLoc.x = lx; prevLoc.y = ly; prevLoc.z = lz;
  }
  const shifts = core.stats.rebaseCount - rb0;
  const deltasOk = events.every((v) => isLattice(v.d.x) && isLattice(v.d.y) && isLattice(v.d.z) && (v.d.x !== 0 || v.d.y !== 0 || v.d.z !== 0));
  const countsOk = events.length === shifts && events.every((v, i) => v.count === rb0 + i + 1);
  const fails: string[] = [];
  if (shifts < 2) fails.push(`shifts ${shifts} < 2`);
  if (shifts !== oracleShifts) fails.push(`shifts ${shifts} ≠ oracle ${oracleShifts}`);
  if (!countsOk) fails.push('event samples ≠ shifts');
  if (!deltasOk) fails.push('Δ not a non-zero 256 multiple');
  if (originMis) fails.push(`origin ≠ oracle on ${originMis} ticks`);
  if (latticeBad) fails.push(`origin off-lattice on ${latticeBad} ticks`);
  if (localOver) fails.push(`local > 1,024 on ${localOver} ticks`);
  if (f32Bad || celF32Bad) fails.push(`f32 locals ≠ fround(abs−O): focus ${f32Bad}, celestial ${celF32Bad}`);
  if (stepBad) fails.push(`world step > sprint·dt on ${stepBad} ticks (max ${maxStep.toFixed(3)} m)`);
  if (identBad) fails.push(`local-step identity broken on ${identBad} ticks`);
  const ds = events.map((v) => `(${v.d.x},${v.d.y},${v.d.z})`).join(' ');
  return {
    pass: fails.length === 0,
    detail: `${shifts} shifts on a ${ROUTE_M} m continuous route (${ticks} ticks, oracle ${oracleShifts}); Δ ${ds || 'none'}; ` +
      `max local ${maxLocal.toFixed(3)} m (clearance ${minClear.toFixed(3)}); max step ${maxStep.toFixed(4)} m; ` +
      `identity max ${maxIdent.toExponential(1)} m; f32 focus/celestial mismatches ${f32Bad}/${celF32Bad} over ${cel.length} celestials; ` +
      `fails: [${fails.join('; ')}];`,
  };
}

export default function M1fR5Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    try {
      const r5a = rowR5a();
      const res: Array<[string, Row]> = [['R5a rebase lattice on a continuous route', r5a]];
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR5Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR5Gate] acceptance ${res.every((x) => x[1].pass) ? 'PASSED' : 'FAILED'}${MUT ? ` (mut=${MUT})` : ''}`);
    } catch (err) {
      console.log(`[M1fR5Gate] acceptance FAILED (exception ${String(err)})`);
    }
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R5 rebuilt gate (F2fcea, ADR-025){MUT ? ` — mutant ${MUT}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}