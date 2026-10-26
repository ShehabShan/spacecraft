// A1 U27b3b2b2b2b1: shipped m1a predicates vs independent literal-spec oracles.
// Usage (game/): node tools/audit/u27b3b2b2b2b1-m1a-recheck.mjs [--self-test]
// No production writes; all generated mutants live in a unique /tmp directory.
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
import { Object3D } from 'three';
import { FloatingOriginAdapter } from '../../src/render/FloatingOriginAdapter.ts';

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const scratch = mkdtempSync(join(tmpdir(), 'u27-m1a-'));
const H = readFileSync(join(src, 'test/Milestone1A_TestHarness.tsx'), 'utf8');
const PM = readFileSync(join(src, 'core/math/precisionMath.ts'), 'utf8');
const SC = readFileSync(join(src, 'core/simulation/SimulationCore.ts'), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
console.log('SOURCE', JSON.stringify({ harness: sha(H), precision: sha(PM), core: sha(SC) }));
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: !!ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${detail === undefined ? '' : JSON.stringify(detail)}`);
}
function once(s, from, to) {
  if (s.split(from).length !== 2) throw Error(`Expected unique anchor: ${from}`);
  return s.replace(from, to);
}
const axes = ['x', 'y', 'z'];
const vec = a => Object.fromEntries(axes.map((x, i) => [x, a[i]]));
const arr = p => axes.map(a => p[a]);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b); // ±0 geometrically equivalent
const expectedOrigin = p => p.map(v => 256 * Math.round(v / 256));
const maxAbs = a => Math.max(...a.map(Math.abs));
const rowNames = ['abs-distance', 'local-bound', 'rebase-count', 'delta-lattice', 'frame-stability'];

// Extract the real verdict and capture blocks; expected truth below imports no
// production origin helpers/constants and does not read harness telemetry.
const start = H.indexOf('const TEST = {');
const end = H.lastIndexOf('/*', H.indexOf(' * LIVE FRAME STATISTICS'));
const frameStart = H.indexOf('    if (!test.finished) {\n      if (test.warmup > 0) {');
const terminator = '        finalizeTest();\n      }\n    }\n';
const frameEnd = H.indexOf(terminator, frameStart) + terminator.length;
if (start < 0 || end <= start || frameStart < end || frameEnd <= frameStart) throw Error('slice anchors');
const factory = `
export function make(core, shipState, REBASE_THRESHOLD, ORIGIN_LATTICE, sink) {
const TEST_DISTANCE_M=10_000;
const useGameStore={getState:()=>({completeTest:r=>{sink.rows=r}})};
${H.slice(start, end)}
return {test, finalizeTest, frame(delta) {
const before=core.stats.rebaseCount;
core.advance(delta);
const rebasedThisFrame=before!==core.stats.rebaseCount;
const frameMs=delta*1000;
${H.slice(frameStart, frameEnd)}
return test.finished;
}};
}`;
writeFileSync(join(scratch, 'factory.mjs'), transformSync(factory, { loader: 'ts', format: 'esm' }).code);
const { make } = await import(pathToFileURL(join(scratch, 'factory.mjs')).href);
console.log('EXTRACTION', JSON.stringify({
  verdictLines: [H.slice(0, start).split('\n').length, H.slice(0, end).split('\n').length],
  captureLines: [H.slice(0, frameStart).split('\n').length, H.slice(0, frameEnd).split('\n').length]
}));
function imports(code, dir, redirect) {
  return code.replace(/from '(\.\.?\/[^']+)'/g, (_, p) =>
    `from '${redirect && p.endsWith('math/precisionMath') ? redirect : pathToFileURL(resolve(dir, p) + '.ts').href}'`);
}
async function variant(name, { threshold = 1024, lattice = 256, extract = null, inclusive = false } = {}) {
  let pm = once(PM, 'export const REBASE_THRESHOLD = 1024;', `export const REBASE_THRESHOLD = ${threshold};`);
  pm = once(pm, 'export const ORIGIN_LATTICE = 256;', `export const ORIGIN_LATTICE = ${lattice};`);
  if (inclusive) pm = once(pm, '> REBASE_THRESHOLD', '>= REBASE_THRESHOLD');
  let sc = SC;
  for (let i = 0; i < 3; i++) {
    const original = `e.localPosF32[${i}] = e.absPos.${axes[i]} - origin.${axes[i]};`;
    if (extract === 'early') sc = once(sc, original, `e.localPosF32[${i}] = Math.fround(e.absPos.${axes[i]}) - Math.fround(origin.${axes[i]});`);
    if (extract === 'zero') sc = once(sc, original, `e.localPosF32[${i}] = 0;`);
    if (extract === 'huge') sc = once(sc, original, `e.localPosF32[${i}] = 2048;`);
    if (extract === 'stale' && i === 0) sc = once(sc, original, `if (!e.dynamic) continue;\n${original}`);
  }
  const pmPath = join(scratch, name + '-pm.ts'), scPath = join(scratch, name + '-core.ts');
  writeFileSync(pmPath, imports(pm, join(src, 'core/math')));
  writeFileSync(scPath, imports(sc, join(src, 'core/simulation'), pathToFileURL(pmPath).href));
  const mod = await import(pathToFileURL(scPath).href);
  return { name, threshold, lattice, Core: mod.SimulationCore };
}
const base = await variant('baseline');
const variants = [base];
for (const t of [900, 1023, 1025, 1100, 2048]) variants.push(await variant('threshold-' + t, { threshold: t }));
for (const l of [64, 128, 300, 512, 1000]) variants.push(await variant('lattice-' + l, { lattice: l }));
for (const extract of ['early', 'stale', 'zero', 'huge']) variants.push(await variant(extract, { extract }));
const inclusive = await variant('inclusive', { inclusive: true });
const byName = n => variants.find(m => m.name === n);
const specTicks = Array.from({ length: 9 }, (_, i) => Math.floor(3072 * (i + 1) / 100) + 1);

function flight(m, { literalConstants = false, speed = 2000 } = {}) {
  const core = new m.Core();
  const ship = core.registerEntity('ship', { absPos: vec([0, 0, 0]), velocity: vec([speed, 0, 0]), dynamic: true });
  core.setFocusEntity('ship');
  const beacons = [[2000, 80, 220], [5000, 80, -220], [8000, 80, 220]].map((p, i) =>
    core.registerEntity('b' + i, { absPos: vec(p), dynamic: false }));
  const entities = [ship, ...beacons], initialStatic = beacons.map(e => arr(e.absPos));
  const adapter = new FloatingOriginAdapter(core), objects = entities.map(e => {
    const o = new Object3D(); adapter.bind(e.id, o); return o;
  });
  const events = [];
  core.onRebase(ev => events.push({ tick: core.stats.tickCount + 1, origin: arr(ev.newOrigin), delta: arr(ev.delta) }));
  const sink = {}, h = make(core, ship, literalConstants ? 1024 : m.threshold, literalConstants ? 256 : m.lattice, sink);
  let dynamicError = 0, staticError = 0, adapterError = 0, shiftsChecked = 0;
  const logs = [], oldLog = console.log;
  console.log = (...s) => logs.push(s.join(' '));
  try {
    for (let i = 0; i < 1000; i++) {
      const before = core.stats.rebaseCount;
      const done = h.frame(1 / 60);
      adapter.update();
      const origin = arr(core.getOrigin());
      for (let j = 0; j < entities.length; j++) {
        const e = entities[j];
        const truth = arr(e.absPos).map((p, k) => Math.fround(p - origin[k]));
        const error = maxAbs(truth.map((p, k) => e.localPosF32[k] - p));
        if (j === 0) dynamicError = Math.max(dynamicError, error); else staticError = Math.max(staticError, error);
        adapterError = Math.max(adapterError, maxAbs(objects[j].position.toArray().map((p, k) => p - truth[k])));
      }
      if (core.stats.rebaseCount !== before) shiftsChecked++;
      if (done) break;
    }
  } finally { console.log = oldLog; }
  if (!sink.rows) throw Error('harness did not finish');
  const result = {
    rows: rowNames.map(k => sink.rows[k].pass ? 'P' : 'F').join(''),
    ticks: events.map(e => e.tick), deltas: events.map(e => e.delta),
    dynamicError, staticError, adapterError, shiftsChecked, maxLocal: core.stats.focusMaxLocalPostTick,
    staticUnmoved: same(initialStatic, beacons.map(e => arr(e.absPos)))
  };
  return result;
}
const runs = {};
for (const m of variants) {
  runs[m.name] = flight(m);
  console.log('FLIGHT', m.name, JSON.stringify(runs[m.name]));
}
check('baseline all rows + exact analytic trace', runs.baseline.rows === 'PPPPP' &&
  same(runs.baseline.ticks, specTicks) && runs.baseline.deltas.every(d => same(d, [1024, 0, 0])));
check('baseline all entity locals/adapter every tick and nine shifts', runs.baseline.dynamicError === 0 &&
  runs.baseline.staticError === 0 && runs.baseline.adapterError === 0 && runs.baseline.shiftsChecked === 9 && runs.baseline.staticUnmoved);
for (const t of [900, 1023, 1025, 1100]) {
  const r = runs['threshold-' + t];
  check('wrong threshold accepted ' + t, r.rows === 'PPPPP');
}
// Some constants produce the same sampled trace. Test boundary cases separately.
check('early threshold timing wrong despite count nine', !same(runs['threshold-900'].ticks, specTicks) && runs['threshold-900'].ticks.length === 9);
for (const l of [64, 128, 300, 512, 1000]) check('wrong lattice accepted ' + l, runs['lattice-' + l].rows === 'PPPPP');
check('T3 allows ten shifts', runs['lattice-300'].ticks.length === 10 && runs['lattice-300'].rows === 'PPPPP');
check('different threshold can fail count', runs['threshold-2048'].rows[2] === 'F');
const fixed = flight(byName('threshold-1100'), { literalConstants: true });
check('literal bound rejects 1100', fixed.rows[1] === 'F', fixed.rows);
for (const l of [64, 128, 512]) check('literal constants alone insufficient ' + l, flight(byName('lattice-' + l), { literalConstants: true }).rows === 'PPPPP');
for (const l of [300, 1000]) check('literal delta lattice rejects ' + l, flight(byName('lattice-' + l), { literalConstants: true }).rows[3] === 'F');
const slow = flight(base, { speed: 1000 });
check('distance/trace control responds', slow.rows[0] === 'F' && slow.rows[2] === 'F', slow.rows);

function stationary(m, point) {
  const core = new m.Core();
  const ship = core.registerEntity('ship', { absPos: vec(point), dynamic: true });
  core.setFocusEntity('ship'); core.tick();
  const origin = arr(core.getOrigin()), local = [...ship.localPosF32];
  const truth = point.map((p, i) => Math.fround(p - origin[i]));
  return { origin, local, rebases: core.stats.rebaseCount, error: maxAbs(local.map((p, i) => p - truth[i])) };
}
const off = [1100.3, -1300.7, 50];
check('off-axis baseline nearest256', same(stationary(base, off).origin, expectedOrigin(off)));
for (const l of [64, 128, 300, 512, 1000]) {
  const s = stationary(byName('lattice-' + l), off);
  check('off-axis oracle rejects lattice ' + l, !same(s.origin, expectedOrigin(off)), s);
}
const coarse = stationary(byName('lattice-512'), off);
check('modulo256 is not nearest256', coarse.origin.every(v => v % 256 === 0) && maxAbs(off.map((p, i) => p - coarse.origin[i])) > 128);
let boundaryCases = 0, boundaryErrors = 0;
for (let ax = 0; ax < 3; ax++) for (const sign of [-1, 1]) for (const magnitude of [1024 - 1 / 1024, 1024, 1024 + 1 / 1024]) {
  const p = [0, 0, 0]; p[ax] = sign * magnitude;
  const s = stationary(base, p), shouldShift = magnitude > 1024;
  boundaryCases++;
  if (s.rebases !== Number(shouldShift) || !same(s.origin, shouldShift ? expectedOrigin(p) : [0, 0, 0])) boundaryErrors++;
}
check('strict trigger baseline 18 signed-axis boundaries', boundaryCases === 18 && boundaryErrors === 0, { boundaryCases, boundaryErrors });
check('boundary oracle detects inclusive trigger', stationary(inclusive, [1024, 0, 0]).rebases === 1);
for (const t of [900, 1023, 1025, 1100]) {
  const p = t < 1024 ? [1024, 0, 0] : [1024 + 1 / 1024, 0, 0];
  check('boundary oracle detects threshold ' + t, stationary(byName('threshold-' + t), p).rebases !== Number(maxAbs(p) > 1024));
}
for (const y of [-384, -128, 128, 384]) {
  const p = [1100.3, y, -1300.7], s = stationary(base, p);
  check('nearest-cell signed tie ' + y, same(s.origin, expectedOrigin(p)) && maxAbs(p.map((v, i) => v - s.origin[i])) <= 128);
}
check('early-f32 fault falsely accepted', runs.early.rows === 'PPPPP' && runs.early.dynamicError > 0, runs.early.dynamicError);
check('stale beacons falsely accepted and adapter propagates', runs.stale.rows === 'PPPPP' && runs.stale.staticError === 9216 && runs.stale.adapterError === 9216 && runs.stale.staticUnmoved);
check('zero locals falsely accepted despite bounded telemetry', runs.zero.rows === 'PPPPP' && runs.zero.dynamicError > 1000 && runs.zero.staticError >= 8000);
check('large wrong locals do fail T2', runs.huge.rows[1] === 'F', runs.huge.rows);
const spacing = 2 ** 14;
const midpoint = (Math.floor(1.496e11 / spacing) + 0.5) * spacing;
// 600,000 m is the catalog Earth's orbit scale, not a real-world AU.
// This is a constructed precision fixture at that scale, not a live play pose.
const catalogScalePoint = [600000 + 1000.37, 0, 0];
const catalogGood = stationary(base, catalogScalePoint);
const catalogBad = stationary(byName('early'), catalogScalePoint);
check('catalog-scale baseline precision', catalogGood.error === 0, catalogGood);
check('catalog-scale early rounding rejected', catalogBad.error > .001, catalogBad);
const farCases = [
  [1.496e11 + 1000.37, 0, 0],
  [midpoint - 64, midpoint + 64, -midpoint - 64],
  [midpoint + 64, -midpoint + 64, -midpoint + 64]
];
for (let i = 0; i < farCases.length; i++) {
  const p = farCases[i], good = stationary(base, p), bad = stationary(byName('early'), p);
  const exactError = maxAbs(good.local.map((v, j) => v - (p[j] - good.origin[j])));
  check('far-origin baseline oracle ' + i, good.error === 0 && exactError < .001 && same(good.origin, expectedOrigin(p)), { p, good, exactError });
  check('far-origin early rounding rejected ' + i, bad.error > (i ? 16000 : 20), bad);
}
if (process.argv.includes('--self-test')) check('intentional failing assertion verifies exit propagation', false);
console.log(`SUMMARY ${checks.filter(c => c.ok).length}/${checks.length}`);
process.exitCode = checks.every(c => c.ok) ? 0 : 1;