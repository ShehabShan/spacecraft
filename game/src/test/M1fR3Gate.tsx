/**
 * F2fccba — rebuilt m1f R3 (mesh↔impostor handoff) gate, row R3a (ADR-023). Page `?page=m1fR3`.
 * WHY: the shipped R3 row cannot fail (A1-U03-2: holes/doubles counted with mesh = 1 − imp,
 * meshState ignored). R3a sweeps the SHIPPED controller (`./m1fHandoff`, imported, not copied)
 * under the RENDERED draw rules of Milestone1F_TestHarness `applyRenderState`:
 *   mesh drawn iff meshState && alphaMesh > 0.01; impostor drawn iff alphaImp > 0.01.
 * It is RED by design until F8a fixes A1-U03-1. The spec pins the known-red vector.
 * Positive control `?ctl=ref` (test-only, not F8a's design): the mesh stays drawn while
 * alphaImp < 0.99, which must turn R3a PASS (proves the row can go green).
 * F2fccbb adds R3b/R3c (GPU) and the mutants on this page.
 */
import { useEffect, useState } from 'react';
import { handoffFade, handoffNextState } from './m1fHandoff';

const CTL = new URLSearchParams(window.location.search).get('ctl') ?? '';
type Row = { pass: boolean; detail: string };
type Dir = 'down' | 'up';

/** Rendered-rule drawn state for one sample (harness applyRenderState rules). */
function drawn(d: number, mesh: boolean): { meshVis: boolean; impVis: boolean; am: number; imp: number } {
  const imp = handoffFade(d), am = 1 - imp;
  const meshVis = (CTL === 'ref' ? (mesh || imp < 0.99) : mesh) && am > 0.01;
  return { meshVis, impVis: imp > 0.01, am, imp };
}

/** Collects contiguous hole bands per direction (deduplicated across trips). */
class Bands {
  private open: Record<Dir, [number, number] | null> = { down: null, up: null };
  readonly set: Record<Dir, Set<string>> = { down: new Set(), up: new Set() };
  readonly count: Record<Dir, number> = { down: 0, up: 0 };
  hit(dir: Dir, d: number, hole: boolean): void {
    const o = this.open[dir];
    if (hole) {
      this.count[dir]++;
      if (o) { o[0] = Math.min(o[0], d); o[1] = Math.max(o[1], d); } else this.open[dir] = [d, d];
    } else if (o) this.close(dir);
  }
  close(dir: Dir): void {
    const o = this.open[dir];
    if (o) { this.set[dir].add(`[${Math.round(o[0])}, ${Math.round(o[1])}] m`); this.open[dir] = null; }
  }
  text(dir: Dir): string { return this.count[dir] === 0 ? '0 holes' : `${this.count[dir]} holes in ${[...this.set[dir]].join(', ')}`; }
}

function rowR3a(): Row {
  // (1) unit sweep: 20 round trips over [200, 300] km, 1 m steps, state carried across trips.
  // Initial state MESH at 300 km (as the shipped row): the first descending sample corrects it,
  // so a thrash-free controller makes exactly 21 flips (20 threshold crossings + 1).
  const sw = new Bands();
  let mesh = true, flips = 0, doubles = 0, maxDim = 0;
  for (let trip = 0; trip < 20; trip++) {
    const dir: Dir = trip % 2 === 0 ? 'down' : 'up';
    for (let s = 0; s <= 100000; s++) {
      const d = dir === 'down' ? 300000 - s : 200000 + s;
      const next = handoffNextState(d, mesh);
      if (next !== mesh) { flips++; mesh = next; }
      const r = drawn(d, mesh);
      sw.hit(dir, d, !r.meshVis && !r.impVis);
      if (r.meshVis && r.am >= 0.99 && r.impVis && r.imp >= 0.99) doubles++;
      const cov = (r.meshVis ? r.am : 0) + (r.impVis ? r.imp : 0);
      maxDim = Math.max(maxDim, 1 - Math.min(1, cov));
    }
    sw.close(dir);
  }
  // (2) live triangle, frame-stepped at 60 Hz exactly as the harness updateProbes:
  // 320 → 190 → 320 km, 24 s each way, two full periods, meshState carried.
  const lv = new Bands();
  let lmesh = true, lt = 0, prevD = 320000, prevDir: Dir = 'down';
  for (let f = 0; f < 2 * 48 * 60; f++) {
    lt += 1 / 60;
    const ph = (lt % 48) / 24, tri = ph < 1 ? ph : 2 - ph;
    const d = 320000 - tri * 130000;
    const dir: Dir = d <= prevD ? 'down' : 'up';
    if (dir !== prevDir) { lv.close(prevDir); prevDir = dir; }   // a band never spans a turn
    lmesh = handoffNextState(d, lmesh);
    const r = drawn(d, lmesh);
    lv.hit(dir, d, !r.meshVis && !r.impVis);
    prevD = d;
  }
  lv.close('down'); lv.close('up');
  const holes = sw.count.down + sw.count.up, liveHoles = lv.count.down + lv.count.up;
  const pass = holes === 0 && liveHoles === 0 && doubles === 0 && flips === 21 && maxDim <= 0.01;
  return {
    pass,
    detail:
      `sweep (20 round trips, 1 m steps, rendered rules): down: ${sw.text('down')}; up: ${sw.text('up')}; ` +
      `${doubles} doubles; ${flips} flips (need 21); max drawn-coverage dimming ${maxDim.toFixed(3)} (tol 0.010). ` +
      `live 60 Hz triangle (2 periods): down: ${lv.text('down')}; up: ${lv.text('up')}.` +
      (CTL ? ` [ctl=${CTL}]` : ''),
  };
}

export default function M1fR3Gate() {
  const [rows, setRows] = useState<Array<[string, Row]> | null>(null);
  useEffect(() => {
    try {
      const res: Array<[string, Row]> = [['R3a state-coupled sweep', rowR3a()]];
      setRows(res);
      for (const [k, r] of res) console.log(`[M1fR3Gate] ${k}: ${r.pass ? 'PASS' : 'FAIL'} — ${r.detail}`);
      console.log(`[M1fR3Gate] acceptance ${res.every((e) => e[1].pass) ? 'PASSED' : 'FAILED'}${CTL ? ` (ctl=${CTL})` : ''}`);
    } catch (e) {
      console.log(`[M1fR3Gate] acceptance FAILED (exception ${String(e)})`);
    }
  }, []);
  return (
    <div style={{ fontFamily: 'monospace', padding: 16 }}>
      <h3>m1f R3 rebuilt gate (F2fccba, ADR-023){CTL ? ` — control ${CTL}` : ''}</h3>
      {rows === null ? <p>running…</p> : rows.map(([k, r]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <span className="badge">{r.pass ? 'PASS' : 'FAIL'}</span> {k}
          <div className="test-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}