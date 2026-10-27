// F2fcca evidence: analytic facts the rebuilt R3 gate (ADR-023) is designed around.
// Controller copied verbatim from game/src/test/Milestone1F_TestHarness.tsx §5 (lines 603-622).
const HARD = 240000, SOFT = 220000, LO = 225000, HI = 236000;
const fade = d => d <= LO ? 0 : d >= HI ? 1 : ((t) => t * t * (3 - 2 * t))((d - LO) / (HI - LO));
const next = (d, m) => (m && d > HARD) ? false : (!m && d < SOFT) ? true : m;
function sweep(step) {
  const out = {};
  for (const dir of ['down', 'up']) {
    let mesh = dir === 'down' ? false : true, holeLo = null, holeHi = null, holes = 0, doubles = 0, dimMax = 0;
    const a = dir === 'down' ? 300000 : 200000, b = dir === 'down' ? 200000 : 300000, s = dir === 'down' ? -step : step;
    for (let d = a; dir === 'down' ? d >= b : d <= b; d += s) {
      mesh = next(d, mesh);
      const imp = fade(d), am = 1 - imp;
      const meshVis = mesh && am > 0.01, impVis = imp > 0.01;
      if (!meshVis && !impVis) { holes++; holeLo = holeLo === null ? d : Math.min(holeLo, d); holeHi = holeHi === null ? d : Math.max(holeHi, d); }
      if (meshVis && am >= 0.99 && impVis && imp >= 0.99) doubles++;
      const cov = (meshVis ? am : 0) + (impVis ? imp : 0);   // drawn opacity of the object
      dimMax = Math.max(dimMax, 1 - Math.min(1, cov));
    }
    out[dir] = { holes, hole: holeLo === null ? 'none' : `[${holeLo}, ${holeHi}] m (${holeHi - holeLo} m)`, doubles, maxDim: dimMax.toFixed(3) };
  }
  return out;
}
console.log('rendered-rule sweep, 1 m steps:', JSON.stringify(sweep(1)));
console.log('rendered-rule sweep, 10 m steps:', JSON.stringify(sweep(10)));
console.log('tautological shipped rule (mesh = 1 - imp, state ignored): holes are unsatisfiable for imp in [0,1]');
// expected probe disk radius/area on a 1280x720, fov 62 deg target (R = 1800 m)
const f = 360 / Math.tan(31 * Math.PI / 180);
for (const d of [205000, 222000, 225000, 228000, 232000, 236000, 245000, 290000]) {
  const r = f * Math.tan(Math.asin(1800 / d));
  console.log(`d=${d} m  r=${r.toFixed(2)} px  area=${(Math.PI * r * r).toFixed(1)} px  ring(2*pi*r)=${(2 * Math.PI * r).toFixed(1)} px`);
}
// predicted drawn coverage (sum of drawn alphas, capped at 1) at the R3b sample distances,
// with the state reached by walking the sweep in 1 m steps from the far end
const SAMPLES = [205000, 222000, 224000, 228000, 232000, 238000, 245000, 290000];
for (const dir of ['down', 'up']) {
  let mesh = dir === 'down' ? false : true; const cov = {};
  const a = dir === 'down' ? 300000 : 200000, s = dir === 'down' ? -1 : 1;
  for (let i = 0; i <= 100000; i++) {
    const d = a + s * i; mesh = next(d, mesh);
    if (SAMPLES.includes(d)) {
      const imp = fade(d), am = 1 - imp;
      const c = (mesh && am > 0.01 ? am : 0) + (imp > 0.01 ? imp : 0);
      cov[d / 1000 + 'km'] = Math.min(1, c).toFixed(3) + (Math.abs(1 - Math.min(1, c)) > 0.25 ? ' FAIL' : ' ok');
    }
  }
  console.log(`predicted R3b coverage (${dir}):`, JSON.stringify(cov));
}