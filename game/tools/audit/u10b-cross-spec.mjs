// A1-U10b probe — Design_specs cross-spec sanity (read-only; reads spec + engine text only).
// Run from game/: node tools/audit/u10b-cross-spec.mjs   (exit 0 = probe ran; numbers are printed)
// Every number is derived from the catalog (celestialData.ts = spec 03 verbatim) and the
// engine constants grepped below; nothing in game/src is imported or modified.
import { readFileSync } from 'node:fs';
const root = new URL('../../../', import.meta.url);
const rd = (p) => readFileSync(new URL(p, root), 'utf8');
const cat = rd('game/src/core/orbit/celestialData.ts');
const sim = rd('game/src/core/simulation/SimulationCore.ts');
const kcc = rd('game/src/core/physics/astronautKCC.ts');
const pm = rd('game/src/core/math/precisionMath.ts');
const fc = rd('game/src/core/physics/flightController.ts');
const spec04 = rd('Design_specs/04_THREEJS_ADAPTER.txt');

// ---- catalog parse (one chunk per `id: '<name>'`)
const B = {};
for (const chunk of cat.split(/id: '/).slice(1)) {
  const id = chunk.match(/^(\w+)'/)[1];
  const num = (k) => { const m = chunk.match(new RegExp(k + ': ([\\d.]+)')); return m ? +m[1] : undefined; };
  const par = chunk.match(/parentId: '(\w+)'/);
  if (num('radiusGame') === undefined) continue;
  B[id] = { R: num('radiusGame'), D: num('distanceFromSun'), a: num('orbitRadiusGame'), g: num('surfaceGravity'),
    range: num('gravityRange'), atm: num('atmosphereHeight'), portal: num('portalDist'), parent: par ? par[1] : null };
}
const ids = Object.keys(B);
console.log(`catalog bodies parsed: ${ids.length}`);

// ---- engine constants (grep, not import)
const TS = +sim.match(/_macroTimeScale = (\d+)/)[1];
const SPIN = +kcc.match(/spinOmega: ([\d.]+)/)[1];
const SPIN_ON_SIMTIME = /_theta[^\n]*simTime|simTime[^\n]*_theta/.test(kcc);
const REB = +pm.match(/REBASE_THRESHOLD = (\d+)/)[1];
const CAP = +fc.match(/hardCapSpeed: (\d+)/)[1];
const MU_SUN = 274 * 20000 * 20000; // celestialData header: the one derived constant
console.log(`engine: macroTimeScale ${TS}, KCC spinOmega ${SPIN} rad/s (spin phase on simTime? ${SPIN_ON_SIMTIME}), rebase ${REB} m, hard cap ${CAP} m/s, mu_sun ${MU_SUN.toExponential(4)}`);

const mu = (id) => (id === 'sun' ? MU_SUN : B[id].g * B[id].R ** 2);
const host = (id) => (B[id].parent ?? 'sun');
const dist = (id) => (B[id].a ?? B[id].D);

// ---- 1. rail kinematics in REAL (play) seconds under the 30x macro clock
console.log('\n[1] rails at 30x, real-time view (v and centripetal accel of each body on its rail)');
console.log('body      host     T_sim[s]  T_play[s]  v_play[m/s]  a_play[m/s2]  a_play/g_body  hostGravityAtBody[m/s2]');
for (const id of ids) {
  if (id === 'sun') continue;
  const r = dist(id), m = mu(host(id));
  const T = 2 * Math.PI * Math.sqrt(r ** 3 / m), v = Math.sqrt(m / r), acc = m / r ** 2;
  const hostRange = host(id) === 'sun' ? 0 : B[host(id)].range;
  const gHost = r < 0.75 * hostRange ? acc : r < hostRange ? NaN : 0; // spec 02.3: no Sun gravity at all (range 0)
  console.log(`${id.padEnd(9)} ${host(id).padEnd(8)} ${T.toFixed(0).padStart(8)} ${(T / TS).toFixed(1).padStart(10)} ${(v * TS).toFixed(0).padStart(12)} ${(acc * TS * TS).toFixed(1).padStart(13)} ${(acc * TS * TS / B[id].g).toFixed(1).padStart(14)} ${String(Number.isNaN(gHost) ? 'fade zone' : gHost.toFixed(4)).padStart(24)}`);
}

// ---- 2. day vs year / month
const dayPlay = 2 * Math.PI / SPIN;
const Tearth = 2 * Math.PI * Math.sqrt(B.earth.D ** 3 / MU_SUN) / TS;
const Tmoon = 2 * Math.PI * Math.sqrt(B.moon.a ** 3 / mu('earth')) / TS;
console.log(`\n[2] Earth day (spin ${SPIN} on real dt) = ${dayPlay.toFixed(0)} s play; Earth year = ${Tearth.toFixed(0)} s play; Moon month = ${Tmoon.toFixed(0)} s play`);
console.log(`    days per year = ${(Tearth / dayPlay).toFixed(3)} (real 365.25); days per month = ${(Tmoon / dayPlay).toFixed(3)} (real 29.5)`);
console.log(`    if spin ran on simTime (30x) instead: equator speed ${(SPIN * TS * B.earth.R).toFixed(0)} m/s, days/year ${(Tearth * TS * SPIN / (2 * Math.PI)).toFixed(2)}`);

// ---- 3. gravityRange vs Hill sphere and Laplace SOI
console.log('\n[3] gravityRange vs Hill r_H = d(mu/3mu_host)^(1/3) and Laplace SOI = d(mu/mu_host)^(2/5)');
for (const id of ids) {
  if (id === 'sun') continue;
  const d = dist(id), q = mu(id) / mu(host(id));
  const hill = d * Math.cbrt(q / 3), soi = d * q ** 0.4;
  console.log(`${id.padEnd(9)} range ${String(B[id].range).padStart(9)}  Hill ${hill.toFixed(0).padStart(7)}  SOI ${soi.toFixed(0).padStart(7)}  range/Hill ${(B[id].range / hill).toFixed(2)}  range/R ${(B[id].range / B[id].R).toFixed(2)}`);
}

// ---- 4. atmospheres (spec 02.4 "shallow"; real Karman ~100 km on 6,371 km = 1.6 % R)
console.log('\n[4] atmosphereHeight / R');
for (const id of ids) if (B[id].atm > 0) console.log(`${id.padEnd(9)} h ${String(B[id].atm).padStart(6)}  R ${String(B[id].R).padStart(8)}  h/R ${(B[id].atm / B[id].R * 100).toFixed(1)} %`);

// ---- 5. period ratios game vs real (spec 05 1B "exact real-world relative positions")
const REAL_T_YR = { mercury: 0.2408, venus: 0.6152, mars: 1.8809, jupiter: 11.862, saturn: 29.457, uranus: 84.011, neptune: 164.79, pluto: 247.94 };
console.log('\n[5] orbital period ratio T/T_earth: game (Kepler on catalog distances) vs real');
for (const [id, real] of Object.entries(REAL_T_YR)) {
  const game = (B[id].D / B.earth.D) ** 1.5;
  console.log(`${id.padEnd(9)} game ${game.toFixed(3).padStart(7)}  real ${real.toFixed(3).padStart(8)}  game/real ${(game / real).toFixed(3)}`);
}
console.log(`    60 days (5,184,000 s simTime) = ${(5184000 / (Tearth * TS)).toFixed(1)} Earth orbits; M0 = index·golden angle (no ephemeris): ${/GOLDEN_ANGLE/.test(cat)}`);

// ---- 6. lattice / physics bubble vs the smallest bodies
const bub = 2000;
console.log('\n[6] 2 km physics bubble (spec 00/01) and rebase vs body size');
for (const id of ['moon', 'phobos', 'charon']) {
  const R = B[id].R, half = bub / (2 * R);
  const frac = half >= 1 ? 1 : (1 - Math.cos(2 * Math.asin(half))) / 2;
  console.log(`${id.padEnd(7)} R ${R}  circumference ${(2 * Math.PI * R).toFixed(0)} m  bubble covers ${(frac * 100).toFixed(1)} % of the surface  diameter/rebase ${(2 * R / REB).toFixed(2)}`);
}

// ---- 7. camera bands (spec 04) vs thresholds (spec 05 1F) and world size
const bands = [...spec04.matchAll(/(Far|Mid|Near): ([\d.,]+)(k?m) – ([\d.,]+)km/g)].map(m => [m[1], +m[2].replace(/,/g, '') * (m[3] === 'km' ? 1000 : 1), +m[4].replace(/,/g, '') * 1000]);
console.log('\n[7] camera bands', JSON.stringify(bands));
const maxSep = Math.max(...ids.filter(i => B[i].D).map(i => B[i].D)) * 2;
console.log(`    near/mid overlap contains 2.4 km: ${2400 > bands.find(b => b[0] === 'Mid')[1] && 2400 < bands.find(b => b[0] === 'Near')[2]}; mid/far overlap contains 250 km: ${250e3 > bands.find(b => b[0] === 'Far')[1] && 250e3 < bands.find(b => b[0] === 'Mid')[2]}; max body separation ${(maxSep / 1000).toFixed(0)} km < far ${bands.find(b => b[0] === 'Far')[2] / 1000} km: ${maxSep < bands.find(b => b[0] === 'Far')[2]}`);

// ---- 8. portals: catalog moons have no portalDist in spec 03; code value
const spec03 = rd('Design_specs/03_DATA_AND_CELESTIALS.txt');
const moonIds = ids.filter(i => B[i].parent);
const specMoonPortal = moonIds.filter(i => new RegExp(`"${i}": \\{[^}]*portalDist`).test(spec03));
console.log(`\n[8] moons with portalDist in spec 03: ${specMoonPortal.length}/${moonIds.length}; in code: ${moonIds.map(i => i + '=' + B[i].portal).join(' ')}`);
console.log(`    portalDist = max(80000, 1.5·range) for planets: ${ids.filter(i => B[i].D && i !== 'sun').every(i => Math.abs(B[i].portal - Math.max(80000, 1.5 * B[i].range)) < 0.05)}`);
// ---- 9. gravity-range overlaps between a moon and its host (spec 02.3: vectors summed)
console.log('\n[9] moon range reaching the host surface (near-side pull of the moon on the host surface)');
for (const id of moonIds) {
  const p = B[id].parent, gap = B[id].a - B[p].R, rng = B[id].range;
  const pull = gap < rng ? (mu(id) / gap ** 2) * (gap < 0.75 * rng ? 1 : NaN) : 0;
  console.log(`${id.padEnd(8)} host ${p.padEnd(8)} moon-centre→host-surface ${gap.toFixed(0).padStart(6)} m  range ${String(rng).padStart(8)}  reaches host surface: ${gap < rng}  host-centre inside moon range: ${B[id].a < rng}  near-side pull ${Number.isNaN(pull) ? 'fade zone' : (pull / B[p].g * 100).toFixed(2) + ' % of host g'}`);
}
// ---- 10. Sun apparent size from Earth (spec 02.2 "artistic 20,000 m") and Sun/Jupiter radius ratio
const sunDeg = 2 * Math.atan(B.sun.R / B.earth.D) * 180 / Math.PI;
console.log(`\n[10] Sun from Earth ${sunDeg.toFixed(2)} deg (real 0.53); Sun/Jupiter radius ${(B.sun.R / B.jupiter.R).toFixed(2)} (real 9.95)`);
