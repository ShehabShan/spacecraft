// A1-U08-7 independent callback timeline vs verbatim m1a capture/verdict.
// cd game && node tools/audit/u27b3b2b2b2b2a-m1a-timing-recheck.mjs [--self-test]
// Synthetic callback timing, NOT a real browser/GPU performance measurement.
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync, writeFileSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts');

const src = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const H = readFileSync(join(src, 'test/Milestone1A_TestHarness.tsx'), 'utf8');
const sha = s => createHash('sha256').update(s).digest('hex');
const checks = [];
function check(name, ok, detail) {
  checks.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail ?? '')}`);
}
function anchor(text) {
  const i = H.indexOf(text);
  if (i < 0 || H.indexOf(text, i + text.length) >= 0) throw Error(`Nonunique/missing anchor ${text}`);
  return i;
}
const a = anchor('const TEST = {');
const b = H.lastIndexOf('/*', anchor(' * LIVE FRAME STATISTICS'));
const c = anchor('    if (!test.finished) {\n      if (test.warmup > 0) {');
const terminator = '        finalizeTest();\n      }\n    }\n';
const d = anchor(terminator) + terminator.length;
const e = anchor('    const rebaseBefore = core.stats.rebaseCount;');
const f = anchor('    // (2) RENDER EXTRACT');
const factory = `
export function make(core, shipState, sink) {
 const TEST_DISTANCE_M=10000, REBASE_THRESHOLD=1024, ORIGIN_LATTICE=256;
 const useGameStore={getState:()=>({completeTest:r=>{sink.rows=r}})};
 const console={log:s=>{sink.log=s}};
 ${H.slice(a,b)}
 return {test, finalizeTest, frame(delta) {
 ${H.slice(e,f)}
 const frameMs=delta*1000;
 ${H.slice(c,d)}
 return rebasedThisFrame;
 }};
}`;
const scratch = mkdtempSync(join(tmpdir(), 'u27-timing-'));
writeFileSync(join(scratch, 'factory.mjs'), transformSync(factory, { loader:'ts', format:'esm' }).code);
const { make } = await import(pathToFileURL(join(scratch, 'factory.mjs')).href);
console.log('SOURCE', JSON.stringify({harness:sha(H), core:sha(readFileSync(join(src,'core/simulation/SimulationCore.ts'))),
  slices:[[a,b],[e,f],[c,d]].map(pair=>pair.map(i=>H.slice(0,i).split('\n').length))}));

// Calibrate interval semantics against the installed, lockfile-pinned clock.
// Only its external clock is supplied; time-difference arithmetic is unchanged.
const game=resolve(src,'..');
const clockSource=readFileSync(join(game,'node_modules/three/src/core/Clock.js'),'utf8');
const clockBody=clockSource.replace('export { Clock };','return Clock;');
if(clockBody===clockSource) throw Error('Clock export anchor');
let now=0;
const Clock=new Function('performance',clockBody)({now:()=>now});
const clock=new Clock(false);
clock.start();
now=1000/60;
const beforeWork=clock.getDelta()*1000;
now+=80; // simulated synchronous work AFTER the current getDelta
const savedBeforeWork=beforeWork;
now+=1000/60;
const afterWork=clock.getDelta()*1000;
check('actual Clock charges work to following sample',
  Math.abs(savedBeforeWork-1000/60)<1e-10 && Math.abs(afterWork-(80+1000/60))<1e-10,
  {beforeWork,afterWork,sha256:sha(clockSource)});
const dist=join(game,'node_modules/@react-three/fiber/dist');
const fiberName=readdirSync(dist).find(n=>/^events-.*\.esm\.js$/.test(n));
if(!fiberName) throw Error('R3F events source missing');
const fiber=readFileSync(join(dist,fiberName),'utf8');
const sample=fiber.indexOf('let delta = state.clock.getDelta();');
const deliver=fiber.indexOf('subscription.ref.current(subscription.store.getState(), delta, frame);',sample);
const render=fiber.indexOf('state.gl.render(state.scene, state.camera)',sample);
check('installed R3F samples before useFrame before render',sample>=0 && deliver>sample && render>deliver,
  {file:fiberName,sha256:sha(fiber)});

// Expectations use an independent event timeline: callback k starts at t[k],
// injected work is done AFTER that timestamp, delaying the next callback.
// The test receives dt only, never our work labels or the oracle results.
const cadence = 1000/60;
const rows = ['abs-distance','local-bound','rebase-count','delta-lattice','frame-stability'];
const near = (a,b) => Math.abs(a-b)<1e-8;
function replay(name, {ms=cadence, at=()=>undefined, work=()=>0, finish=false}={}) {
  const core=new SimulationCore();
  const ship=core.registerEntity('ship',{absPos:{x:0,y:0,z:0},velocity:{x:2000,y:0,z:0},dynamic:true});
  core.setFocusEntity('ship');
  const sink={}, h=make(core,ship,sink), trace=[];
  let pending=0, clock=0;
  for(let k=1;k<=3000 && !h.test.finished;k++) {
    const interval=at(k)??(ms+pending);
    clock+=interval;
    const before=h.test.frameCount;
    const rebased=h.frame(interval/1000);
    const workMs=work({k,rebased});
    trace.push({k,callbackStartMs:clock,interval,rebased,workMs,stored:h.test.frameCount>before});
    pending=workMs;
  }
  if(!sink.rows) throw Error(`${name}: no verdict`);
  const counted=trace.filter(r=>r.stored).slice(20).map(r=>r.k);
  // Independent all-observation oracle: one 20-callback warmup, no time censor.
  const observed=trace.filter(r=>r.k>20);
  const worst=Math.max(...observed.map(r=>r.interval));
  const avg=observed.reduce((s,r)=>s+r.interval,0)/observed.length;
  const nextIntervals=trace.filter((r,i)=>i>0 && trace[i-1].rebased && r.k>20);
  const attributedWorst=Math.max(0,...nextIntervals.map(r=>r.interval));
  const verdict=rows.map(k=>sink.rows[k].pass?'P':'F').join('');
  const result={name,verdict,callbacks:trace.length,stored:h.test.frameCount,evaluated:counted.length,
    oracle:{worst,avg,pass:avg<=20 && worst<=48,attributedWorst},
    dropped:observed.filter(r=>!r.stored).map(r=>({k:r.k,ms:r.interval})),
    detail:sink.rows['frame-stability'].detail};
  console.log('CASE',JSON.stringify(result));
  if(finish) return {core,h,sink,trace,result};
  return {trace,result,counted};
}
const base=replay('60Hz');
check('baseline all rows pass',base.result.verdict==='PPPPP',base.result);
check('collector drops first20 then evaluator drops another20',base.counted[0]===41,base.counted.slice(0,3));
for(const [name,ms,pass] of [['144Hz',1000/144,true],['50Hz',20,true],['30Hz',1000/30,false]]) {
  const r=replay(name,{ms});
  check(`${name} expected T5`,(r.result.verdict[4]==='P')===pass,r.result.verdict);
}
for(const [value,pass] of [[48,true],[48.001,false],[200,false],[249.999,false],[250,true],[250.001,true],[1000,true]]) {
  const r=replay(`one interval ${value}ms @60`,{at:k=>k===60?value:undefined});
  check(`boundary ${value}`, (r.result.verdict[4]==='P')===pass &&
    r.result.dropped.length===(value>=250?1:0),r.result);
}
const early=replay('200ms at callback30',{at:k=>k===30?200:undefined});
check('second warmup hides observed200ms',early.result.verdict==='PPPPP' &&
  !early.counted.includes(30) && !early.result.oracle.pass,early.result);
const later=replay('200ms at callback41',{at:k=>k===41?200:undefined});
check('callback41 bad timing detected',later.result.verdict[4]==='F',later.result);
const freezes=replay('three1s freezes',{at:k=>[60,120,180].includes(k)?1000:undefined});
check('three1s freezes false accept',freezes.result.verdict==='PPPPP' &&
  freezes.result.dropped.length===3 && !freezes.result.oracle.pass,freezes.result);
for(const total of [40,80,300]) {
  const r=replay(`${total}ms interval after every rebase`,{work:({rebased})=>rebased?total-cadence:0});
  const next=r.trace.filter((x,i)=>i>0 && r.trace[i-1].rebased);
  check(`${total}ms causally constructed next interval`,next.length===9 &&
    next.every(x=>near(x.interval,total)),next.map(x=>({k:x.k,interval:x.interval,rebased:x.rebased})));
  check(`${total}ms harness disposition`,r.result.verdict[4]===(total===80?'F':'P'),r.result);
  check(`${total}ms attribution misses work`,near(r.result.oracle.attributedWorst,total) &&
    r.result.detail.includes('worst rebase-frame 16.67 ms'),r.result.detail);
}
// Direct verdict sensitivity: no workload change, only diagnostic buffer poison.
// This intentionally bypasses capture to isolate whether the scalar is consulted.
const diag=replay('diagnostic sensitivity seed',{finish:true});
diag.h.test.finished=false;
diag.h.test.rebaseFrameTimes[0]=9999;
diag.h.test.rebaseFrameCount=1;
diag.h.finalizeTest();
check('rebaseWorst is not in predicate',diag.sink.rows['frame-stability'].pass &&
  diag.sink.rows['frame-stability'].detail.includes('9999.00 ms'),diag.sink.rows['frame-stability']);
if(process.argv.includes('--self-test')) check('deliberate false assertion proves nonzero exit',false);
console.log(`SUMMARY ${checks.filter(Boolean).length}/${checks.length}`);
process.exitCode=checks.every(Boolean)?0:1;