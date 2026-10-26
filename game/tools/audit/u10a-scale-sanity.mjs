// A1-U10a probe — Design_specs scale sanity (read-only; reads spec + catalog text only).
// Run from game/: node tools/audit/u10a-scale-sanity.mjs   (exit 0 = probe ran; findings are printed)
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url);
const spec02 = readFileSync(new URL('Design_specs/02_PHYSICS_AND_SCALE.txt', root), 'utf8').split(/\r?\n/);
const cat = readFileSync(new URL('game/src/core/orbit/celestialData.ts', root), 'utf8');

// 1. Blank formulas in spec 02: lines whose value/formula slot is empty.
const blanks = [];
spec02.forEach((l, i) => {
  const t = l.trim();
  if (/exactly \.$|is +high\)|= +game-seconds|fixed +logic|radius of \.$|fixed at +\(|^\*\s*$|\(\)[: ]/.test(t) || /:\s*$/.test(t) && /Radius|Distance|Range|Placement|Equation|Curve|Example/.test(t))
    blanks.push(`${i + 1}: ${t}`);
});
console.log(`SPEC02 blank-formula lines: ${blanks.length}`); blanks.forEach(b => console.log('  ' + b));

// 2. Catalog radii vs real mean radii (IAU/NASA fact sheets, km).
const REAL = { sun: 695700, mercury: 2439.7, venus: 6051.8, earth: 6371.0, moon: 1737.4, mars: 3389.5,
  phobos: 11.27, jupiter: 69911, io: 1821.6, saturn: 58232, titan: 2574.7, uranus: 25362,
  titania: 788.4, neptune: 24622, triton: 1353.4, pluto: 1188.3, charon: 606.0 };
const A_REAL = { moon: 384400, phobos: 9376, io: 421700, titan: 1221870, titania: 435910, triton: 354759, charon: 19591 };
const bodies = {};
for (const m of cat.matchAll(/id: '(\w+)'[\s\S]*?radiusGame: ([\d.]+)(?:, orbitRadiusGame: ([\d.]+))?[\s\S]*?surfaceGravity: ([\d.]+)/g))
  bodies[m[1]] = { R: +m[2], a: m[3] ? +m[3] : null, g: +m[4] };
const E = bodies.earth;
console.log('\nbody      R_game    scale(1:x)  exponent p vs Earth  (p=1 linear, p=0.5 sqrt)  sqrtRule R');
for (const [id, b] of Object.entries(bodies)) {
  if (!REAL[id]) continue;
  const scale = REAL[id] * 1000 / b.R;
  const p = id === 'earth' ? NaN : Math.log(b.R / E.R) / Math.log(REAL[id] / REAL.earth);
  const sq = E.R * Math.sqrt(REAL[id] / REAL.earth);
  console.log(`${id.padEnd(9)} ${b.R.toFixed(1).padStart(8)}  ${scale.toFixed(0).padStart(9)}  ${isNaN(p) ? '   —' : p.toFixed(3).padStart(6)}  ${sq.toFixed(1).padStart(9)}`);
}
console.log('\nmoon orbit radius: a_game/R_parent_game vs real a/R_parent');
const parent = { moon: 'earth', phobos: 'mars', io: 'jupiter', titan: 'saturn', titania: 'uranus', triton: 'neptune', charon: 'pluto' };
for (const [id, pid] of Object.entries(parent)) {
  const b = bodies[id], P = bodies[pid]; if (!b?.a || !P) continue;
  console.log(`${id.padEnd(8)} game ${(b.a / P.R).toFixed(2).padStart(7)}  real ${(A_REAL[id] / REAL[pid]).toFixed(2).padStart(7)}  ratio ${((b.a / P.R) / (A_REAL[id] / REAL[pid])).toFixed(3)}`);
}

// 3. Play moon implied scale (moonConfig R=1364.5, g=1.62, eye 1.62, jump 4.2, sprint 6.5).
const R = 1364.5, g = 1.62, mu = g * R * R, h = 1.62, vj = 4.2, vs = 6.5, Rr = 1737.4e3;
const muE = E.g * E.R * E.R;
console.log(`\nplay moon: mu=${mu.toFixed(0)}  g(R)=${(mu / R / R).toFixed(4)}  mu_moon/mu_earth game=${(mu / muE).toFixed(5)} real=0.01230`);
console.log(`  v_circ=${Math.sqrt(g * R).toFixed(1)} m/s (real 1680)  v_esc=${Math.sqrt(2 * g * R).toFixed(1)} m/s (real 2380)`);
console.log(`  horizon@eye ${h} m = ${Math.sqrt(2 * R * h).toFixed(1)} m (real ${(Math.sqrt(2 * Rr * h)).toFixed(0)} m)`);
console.log(`  curvature drop over 100 m = ${(100 * 100 / (2 * R)).toFixed(2)} m (real ${(1e4 / (2 * Rr) * 1000).toFixed(2)} mm)`);
console.log(`  jump apex = ${(vj * vj / (2 * g)).toFixed(2)} m; sprint/v_circ = ${(vs / Math.sqrt(g * R) * 100).toFixed(1)} %`);
const T = 2 * Math.PI * Math.sqrt(bodies.moon.a ** 3 / muE);
console.log(`  Earth–Moon period from game mu_earth = ${T.toFixed(0)} s (catalog comment 3,072 s)`);
process.exit(0);