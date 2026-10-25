// A1 session 93: independent circular-orbit oracle + unchanged m1b suite.
// cd game && node tools/audit/u27b3b2b2b2a-m1b-recheck.mjs [--self-test-fault]
// No source rewriting, no production-config mutation. Every failed assertion exits 1.
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts');
const { KeplerRail, wrapAngle, solveKeplerE } = await import('../../src/core/orbit/KeplerRail.ts');
const { CELESTIAL_CONFIGS } = await import('../../src/core/orbit/celestialData.ts');
const H = readFileSync(new URL('../../src/test/Milestone1B_TestHarness.tsx', import.meta.url), 'utf8');
const start = H.indexOf('function referencePosition(');
const marker = 'publishSuite({ started: true, results, done: true });\n}';
const end = H.indexOf(marker, start);
if (start < 0 || end < start) throw Error('suite extraction anchors changed');
const slice = H.slice(start, end + marker.length);
const js = transformSync(slice, { loader: 'ts', format: 'cjs' }).code;
const runExact = new Function('core', 'wrapAngle', 'solveKeplerE', `
const RAIL = core.rail, BODIES = RAIL.states;
const DAY_SECONDS = 86400, JUMP_DAYS = 60;
const suiteState = {started:false, done:false};
let output;
function publishSuite(p) { output = p; }
${js}
runSuite(); return output.results;
`);
console.log('SOURCE_SHA256', createHash('sha256').update(H).digest('hex'));
console.log('SLICE_SHA256', createHash('sha256').update(slice).digest('hex'));
console.log('ENV', JSON.stringify({node:process.version, performanceMemory:performance.memory ?? null}));
if (performance.memory !== undefined) throw Error('This Node gate-sensitivity fixture requires absent performance.memory; no heap claim.');
const keys = ['closed-form', 'reversibility', 'parenting', 'zero-gc', 'm1a-regression'];
const checks = [];
function check(id, ok, detail = '') {
  checks.push({id, ok:!!ok});
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

// WHY: freeze the physical inputs before constructing any system under test.
// These are literal catalog values (celestialData RAW :80-188 / M1B §1.4),
// NOT imported n/T/muHost/basis. Sun orbital mu is explicitly specified.
const hosts = {
  earth:[9.81,5000], mars:[3.71,2649.3], jupiter:[24.79,16640.2],
  saturn:[10.44,15120.4], uranus:[8.69,9980.5], neptune:[11.15,9835.4],
  pluto:[0.62,2160.8],
};
const raw = [
  ['mercury',376200,null],['venus',512400,null],['earth',600000,null],
  ['moon',38850,'earth'],['mars',741600,null],['phobos',6020,'mars'],
  ['jupiter',1368600,null],['io',41200,'jupiter'],['saturn',1860000,null],
  ['titan',69400,'saturn'],['uranus',2634000,null],['titania',41500,'uranus'],
  ['neptune',3290000,null],['triton',37600,'neptune'],['pluto',3770000,null],
  ['charon',9100,'pluto'],
];
const tau = 2*Math.PI;
const truth = raw.map(([id,a,parent], i) => {
  const mu = parent ? hosts[parent][0]*hosts[parent][1]**2 : 274*20000**2;
  const rate = (id === 'triton' ? -1 : 1)*Math.sqrt(mu/a**3);
  return {id,a,parent,rate,period:tau/Math.abs(rate), phase:((i+1)*2.399963229728653)%tau};
});
function sample(core, t, o) {
  core.setSimTime(t);
  const p = core.rail.getState(o.id).absPos;
  const h = o.parent ? core.rail.getState(o.parent).absPos : {x:0,y:0,z:0};
  return [p.x-h.x,p.y-h.y,p.z-h.z];
}
function oracle(core) {
  const bodies = [];
  for (const o of truth) {
    let maxErrorM = 0;
    for (const t of [0, o.period/8, o.period/4, o.period/2, 0.75*o.period,
      o.period, 1.37*o.period, -0.2*o.period, 60*86400]) {
      const p = sample(core,t,o), theta = o.phase+o.rate*t;
      const ref = [o.a*Math.cos(theta),0,-o.a*Math.sin(theta)];
      maxErrorM = Math.max(maxErrorM,Math.hypot(...p.map((x,i)=>x-ref[i])));
    }
    const t = o.period*0.173, h = o.period/100000;
    const lo=sample(core,t-h,o), p=sample(core,t,o), hi=sample(core,t+h,o);
    const v=hi.map((x,i)=>(x-lo[i])/(2*h));
    const angularMomentumY = p[2]*v[0]-p[0]*v[2];
    const speedRelError = Math.abs(Math.hypot(...v)/(o.a*Math.abs(o.rate))-1);
    const directionOk = Math.sign(angularMomentumY) === (o.id === 'triton' ? -1 : 1);
    // 0.1 mm position tolerance allows differing trig reduction at 60 days.
    // Central-difference sinc error ≈(2π/1e5)^2/6 = 6.6e-10.
    const ok = Number.isFinite(maxErrorM) && maxErrorM < 1e-4 &&
      Number.isFinite(speedRelError) && speedRelError < 1e-7 && directionOk;
    bodies.push({id:o.id, maxErrorM, speedRelError, directionOk, ok});
  }
  return {ok:bodies.every(b=>b.ok), maxErrorM:Math.max(...bodies.map(b=>b.maxErrorM)),
    maxSpeedRelError:Math.max(...bodies.map(b=>b.speedRelError)),
    rejected:bodies.filter(b=>!b.ok).map(b=>b.id),
    wrongDirection:bodies.filter(b=>!b.directionOk).map(b=>b.id), bodies};
}
const productionBefore = JSON.stringify(CELESTIAL_CONFIGS);
function make(configMutation=()=>{}, stateMutation=()=>{}, coreMutation=()=>{}) {
  const cfg=structuredClone(CELESTIAL_CONFIGS);
  configMutation(cfg);
  const rail=new KeplerRail(cfg);
  stateMutation(rail);
  const core=new SimulationCore(rail);
  coreMutation(core);
  return core;
}
function testCase(label, configMutation, stateMutation, coreMutation) {
  const result=runExact(make(configMutation,stateMutation,coreMutation),wrapAngle,solveKeplerE);
  const independent=oracle(make(configMutation,stateMutation,coreMutation));
  const rowPass=Object.fromEntries(keys.map(k=>[k,result[k].pass]));
  console.log('CASE',JSON.stringify({label,rowPass,independent}));
  return {rows:rowPass, independent};
}
const allPass = c=>keys.every(k=>c.rows[k]);
const baseline = testCase('baseline');
check('baseline-gate-5/5',allPass(baseline));
check('baseline-independent-16/16',baseline.independent.ok,{
  maxErrorM:baseline.independent.maxErrorM,maxSpeedRelError:baseline.independent.maxSpeedRelError});
check('oracle-inputs-mapped',truth.every(o=>{
  const c=CELESTIAL_CONFIGS.find(c=>c.id===o.id);
  return c && c.parentId===o.parent && c.orbit.a===o.a &&
    c.orbit.e===0 && c.orbit.i===0 && c.orbit.Omega===0 && c.orbit.omega===0;
}) && CELESTIAL_CONFIGS.length===17);

const cases = [
  ['earth-rate-1pct', cs=>{cs.find(c=>c.id==='earth').orbit.n*=1.01;}, undefined, undefined, 1,0],
  ['all-rates-double', cs=>cs.forEach(c=>{if(c.orbit)c.orbit.n*=2;}), undefined, undefined,16,0],
  ['all-basisQ-reversed',undefined,rail=>rail.states.forEach(s=>{
    for(const k of ['x','y','z'])s.basisQ[k]*=-1;
  }),undefined,16,16],
  ['triton-sign-flipped',cs=>{cs.find(c=>c.id==='triton').orbit.n*=-1;},
    undefined,undefined,1,1],
  ['common-mu-times4',cs=>cs.forEach(c=>{
    if(c.orbit){c.orbit.muHost*=4;c.orbit.n*=2;c.orbit.T/=2;}
  }),undefined,undefined,16,0],
];
for(const [label,cm,sm,km,count,dirs] of cases){
  const c=testCase(label,cm,sm,km);
  check(`${label}-false-accept`,allPass(c));
  check(`${label}-independent-reject`,!c.independent.ok && c.independent.rejected.length===count);
  check(`${label}-direction-count`,c.independent.wrongDirection.length===dirs);
}
const pos = testCase('position-plus1m',undefined,undefined,core=>{
  const ev=core.rail.evaluate.bind(core.rail);
  core.rail.evaluate=t=>{ev(t);core.rail.getState('earth').absPos.x+=1;};
});
check('position-control-T1-reject',!pos.rows['closed-form']);
check('position-control-oracle-reject',!pos.independent.ok);
const clock = testCase('fastForward-double-days',undefined,undefined,core=>{
  const ff=core.fastForward.bind(core);
  core.fastForward=d=>ff(d*2);
});
check('clock-control-T1-reject',!clock.rows['closed-form']);
check('clock-control-T3-reject',!clock.rows['parenting']);
check('clock-control-oracle-scope',clock.independent.ok,'setSimTime oracle does not test fastForward; no global-clock certification');
const table = testCase('earth-T-double',cs=>{cs.find(c=>c.id==='earth').orbit.T*=2;});
check('period-ratio-control-T1-reject',!table.rows['closed-form']);
check('period-table-not-consumed',table.independent.ok,'T metadata corrupted, actual trajectory unchanged');
const moon = testCase('moon-basisP-scaled',undefined,rail=>{
  const s=rail.getState('moon');for(const k of ['x','y','z'])s.basisP[k]*=1.001;
});
check('moon-basis-control-T1-blind',moon.rows['closed-form']);
check('moon-basis-control-T3-reject',!moon.rows['parenting']);
check('moon-basis-control-oracle-reject',!moon.independent.ok);
const shape = testCase('planet-semiminor-scaled',undefined,rail=>{
  for(const s of rail.states)if(s.config.orbit && !s.config.parentId)s.semiMinor*=0.8;
});
check('shape-control-T1-blind',shape.rows['closed-form']);
check('shape-control-T3-reject',!shape.rows['parenting']);
check('shape-control-oracle-reject',!shape.independent.ok);
check('production-configs-unchanged',JSON.stringify(CELESTIAL_CONFIGS)===productionBefore);
if(process.argv.includes('--self-test-fault'))check('intentional-self-test-failure',false);
console.log(`SUMMARY ${checks.filter(c=>c.ok).length}/${checks.length}`);
process.exitCode=checks.every(c=>c.ok)?0:1;