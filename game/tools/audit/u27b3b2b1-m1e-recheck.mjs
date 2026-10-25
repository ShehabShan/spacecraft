// A1 read-only audit. Run from game/: node tools/audit/u27b3b2b1-m1e-recheck.mjs
// Extract the actual gate, but use geometric observations and controlled faults,
// not its telemetry, to decide whether the claimed property was violated.
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import * as esbuild from 'esbuild';
const K = await import('../../src/core/physics/astronautKCC.ts');
const T = await import('../../src/core/terrain/terrainField.ts');
const S = await import('../../src/core/physics/sphericalFrame.ts');
const N = await import('../../src/core/terrain/noise.ts');
const src = readFileSync(new URL('../../src/test/Milestone1E_TestHarness.tsx', import.meta.url), 'utf8');
function slice(a, b, includeLine = false) {
  assert.equal(src.split(a).length, 2, `unique ${a}`);
  assert.equal(src.split(b).length, 2, `unique ${b}`);
  const start = src.indexOf(a), end = src.indexOf(b);
  assert(end > start);
  return src.slice(start, includeLine ? src.indexOf('\n', end) : end);
}
const boot = slice('const kcc = new AstronautKCC(EARTHSCALE_ASTRONAUT);', 'const CORNER: Vec3', true)
  .replace(/const ASTRO_ID[\s\S]*?kcc\.attachWriteThrough\(astroState\.absPos, astroState\.velocity\);/, '');
const rows = slice('const suite = {', 'function runHeadlessSuite');
const deps = { ...S, ...T, ...N, ...K, R: T.TEST_PLANET.radius, heapApi: null };
const factory = new Function(...Object.keys(deps), esbuild.transformSync(boot + rows, {loader:'ts'}).code +
  '\nreturn {kcc,kccT1,suite,FLAT_SITE,T1_START,runFaceWalk,runSlopeStep,runCoriolisJump};');
function make(omega) {
  T.initTerrainField(T.TEST_PLANET);
  const d = {...deps};
  // Keep the harness measurement axis unchanged for the zero-spin control.
  if (omega !== undefined) d.AstronautKCC = class extends K.AstronautKCC {
    constructor(cfg) { super({...cfg, spinOmega:omega}); }
  };
  return factory(...Object.values(d));
}
const tests = [];
function check(name, ok, evidence) {
  tests.push({name, pass:!!ok});
  console.log(JSON.stringify({name, pass:!!ok, evidence}));
}
const arr = p => [p.x,p.y,p.z];
const dot = (a,b) => a.reduce((s,x,i)=>s+x*b[i],0);
const norm = a => Math.hypot(...a);
const unit = a => a.map(x=>x/norm(a));
const sub = (a,b) => a.map((x,i)=>x-b[i]);
const angle = (a,b) => Math.acos(Math.max(-1,Math.min(1,dot(unit(a),unit(b)))));
const deg = x=>x*180/Math.PI;
function clearance(k) {
  const p=arr(k.pLocal), r=norm(p), d=p.map(x=>x/r);
  return r-T.TEST_PLANET.radius-T.terrainHeight(...d);
}
function hook(k, after) {
  const f=k.integrateTick.bind(k); let n=0;
  k.integrateTick=dt=>{f(dt); after(k,++n);};
}
function sink(k, depth) {
  const factor=1-depth/norm(arr(k.pLocal));
  for(const key of ['x','y','z']) {k.pLocal[key]*=factor; k.absPos[key]*=factor;}
}
function yaw(k, radians) {
  const a=arr(k.fwd), u=arr(k.up), c=Math.cos(radians), s=Math.sin(radians);
  const cross=[u[1]*a[2]-u[2]*a[1],u[2]*a[0]-u[0]*a[2],u[0]*a[1]-u[1]*a[0]];
  ['x','y','z'].forEach((key,i)=>k.fwd[key]=a[i]*c+cross[i]*s+u[i]*dot(u,a)*(1-c));
  return deg(angle(a,arr(k.fwd)));
}
// Whole-row controls: no telemetry/predicate edits for geometric fault cases.
for (const row of ['face','slope']) {
  for (const fault of ['none','sink','finite-negative']) {
    const m=make(), k=row==='face'?m.kccT1:m.kcc;
    let min=Infinity, air=0, injections=0;
    hook(k,(k,n)=>{
      if(fault==='sink' && n===(row==='face'?1000:550)) {sink(k,.1); injections++;}
      if(fault==='finite-negative') k.integrity.minAGL=-.1;
      min=Math.min(min,clearance(k)); if(!k.grounded) air++;
    });
    const r=row==='face'?m.runFaceWalk():m.runSlopeStep();
    const e={pass:r.pass,minGeometricAGL:min,reportedMinAGL:String(k.integrity.minAGL),air,injections,
      ticks:k.integrity.ticks,detail:r.detail};
    check(`${row}-${fault}`, fault==='finite-negative' ? !r.pass :
      r.pass && (fault==='sink'?min<-.079 && injections===1:min>.019),e);
    if(row==='face'&&fault==='none') {
      const endSeparation=deg(angle(arr(m.T1_START),arr(k.pLocal)));
      check('face-not-closed',endSeparation>100,{endSeparationDegrees:endSeparation,pathLength:m.suite.face.pathLen});
      check('face-no-grounded-samples',k.integrity.minAGL===Infinity&&air===0,{air,reported:String(k.integrity.minAGL)});
    }
  }
}
for (const degrees of [4,8]) {
  const m=make(); let injected=0, smallest=Infinity,largest=0;
  hook(m.kccT1,(k,n)=>{if(n%1000===0){
    const actual=yaw(k,degrees*Math.PI/180); injected++;
    smallest=Math.min(smallest,actual); largest=Math.max(largest,actual);
  }});
  const r=m.runFaceWalk();
  check(`yaw-${degrees}-degrees`,(degrees===4?r.pass:!r.pass)&&injected>0&&Math.abs(smallest-degrees)<1e-8,
    {rowPass:r.pass,injected,smallest,largest,maximumTotalFwdDelta:deg(Math.acos(m.suite.face.minFwdDot))});
}
// Record actual launch/landing geometry independently of C.westDrift.
function jump(omega, predictionOverride) {
  const m=make(omega), k=m.kcc; let launch=null, landing=null;
  if(predictionOverride!==undefined) Object.defineProperty(m.suite.coriolis,'predicted',{
    get:()=>predictionOverride,set:()=>{},configurable:true
  });
  const original=k.integrateTick.bind(k);
  k.integrateTick=dt=>{
    if(k.input.jump && k.grounded) {
      const p=arr(k.pLocal), radial=unit(p), normal={x:0,y:0,z:0};
      T.terrainNormalInto(...radial,normal);
      launch={p,radial,normal:arr(normal),up:arr(k.up)};
    }
    const wasGrounded=k.grounded;
    original(dt);
    if(!wasGrounded && k.grounded && !landing) landing=arr(k.pLocal);
  };
  const result=m.runCoriolisJump();
  assert(launch && landing);
  const {p,radial,normal,up}=launch, west=unit([-p[2],0,p[0]]);
  const raw=dot(sub(landing,p),west), seconds=m.suite.coriolis.airTicks/60;
  const corrected=dir=>raw-5*seconds*dot(sub(dir,radial.map(x=>x*dot(dir,radial))),west);
  return {rowPass:result.pass,C:{...m.suite.coriolis},launch,rawWest:raw,
    correctedUp:corrected(up),correctedNormal:corrected(normal)};
}
const base=jump(), zero=jump(0);
console.log(JSON.stringify({jumpBase:base,jumpZero:zero}));
check('jump-baseline',base.rowPass,base.C);
check('independent-measurement-agrees',Math.abs(base.correctedUp-base.C.westDrift)<1e-9,
  {independent:base.correctedUp,gate:base.C.westDrift});
check('zero-spin-up-artefact',Math.abs(zero.correctedUp)>.009,
  {upCorrected:zero.correctedUp,normalCorrected:zero.correctedNormal});
check('normal-correction-reduces-artefact',Math.abs(zero.correctedNormal)<.001&&
  Math.abs(zero.correctedNormal)<Math.abs(zero.correctedUp)/10,zero);
check('launch-normal-differs-from-up',angle(base.launch.normal,base.launch.up)>1e-3,
  {degrees:deg(angle(base.launch.normal,base.launch.up))});
for(const predicted of [-1,100,NaN]) {
  const m=jump(undefined,predicted);
  check(`prediction-${String(predicted)}-ignored`,m.rowPass,{predicted:String(predicted),C:m.C});
}
// Source-extracted R5 predicate: mutate one measured variable at a time.
const jumpText=slice('function runCoriolisJump(): TestResult {','function runStateMachine(): TestResult {');
const predicate=jumpText.match(/const pass =([\s\S]*?);/)[1];
const gate=new Function('C','airTicks','settleTicks','maxSettle',`return ${predicate};`);
for(const [name,key,value] of [['west-negative','westDrift',-.01],['west-high','westDrift',.061],
 ['cross-track','perpDrift',.013],['airtime','airTicks',48],['settle','settleTicks',3],['skating','maxSettleSpeed',.021]]) {
  const c={...base.C,[key]:value};
  check(`r5-reject-${name}`,!gate(c,c.airTicks,c.settleTicks,c.maxSettleSpeed),c);
}
// Independent RK4 spherical radial-launch reference (NOT terrain-normal truth).
// No KCC, quaternion, integrator, or harness prediction helper is used here.
function radialReference(omega,dt) {
  const mu=K.EARTHSCALE_ASTRONAUT.planetMu,r0=norm(base.launch.p),u=5;
  let state=[r0,0,0,u,0,-omega*r0],t=0;
  const deriv=y=>{
    const r=Math.hypot(...y.slice(0,3)), g=-mu/r**3;
    return [y[3],y[4],y[5],g*y[0],g*y[1],g*y[2]];
  };
  const add=(y,k,h)=>y.map((v,i)=>v+h*k[i]);
  const step=(y,h)=>{
    const a=deriv(y),b=deriv(add(y,a,h/2)),c=deriv(add(y,b,h/2)),d=deriv(add(y,c,h));
    return y.map((v,i)=>v+h*(a[i]+2*b[i]+2*c[i]+d[i])/6);
  };
  for(let n=0;n<100000;n++) {
    const prev=state,next=step(state,dt);
    if(t>.5 && Math.hypot(...next.slice(0,3))<=r0) {
      let lo=0,hi=dt;
      for(let i=0;i<30;i++){const mid=(lo+hi)/2;
        if(Math.hypot(...step(prev,mid).slice(0,3))>r0)lo=mid;else hi=mid;
      }
      const h=(lo+hi)/2; state=step(prev,h);t+=h;
      // inverse y-axis rotation; at launch +X, west is +Z
      const west=state[0]*Math.sin(omega*t)+state[2]*Math.cos(omega*t);
      return {t,west};
    }
    state=next;t+=dt;
  }
  throw new Error('reference did not land');
}
const omega=K.EARTHSCALE_ASTRONAUT.spinOmega;
const a=radialReference(omega,.0002),b=radialReference(omega,.0001),z=radialReference(0,.0002),neg=radialReference(-omega,.0002);
check('radial-reference-converges',Math.abs(a.west-b.west)<1e-7,{a,b});
check('radial-reference-zero-spin',Math.abs(z.west)<1e-12,z);
check('radial-reference-reverses',Math.abs(a.west+neg.west)<1e-10,{a,neg});
check('radial-reference-scale',b.west>.018&&b.west<.020,{
  radialSphere:b,gate:base.C.westDrift,spinDifference:base.correctedUp-zero.correctedUp,
  note:'Different launch direction and contact surface; not exact KCC error or physics sign-off.'
});
console.log(JSON.stringify({summary:{passed:tests.filter(x=>x.pass).length,total:tests.length},tests}));
process.exitCode=tests.every(x=>x.pass)?0:1;