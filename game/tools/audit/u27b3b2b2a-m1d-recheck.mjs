// A1 read-only re-check. Run from game/: node tools/audit/u27b3b2b2a-m1d-recheck.mjs
// WHY: source-extracted predicates avoid a second implementation of the gate;
// independent equations and a constructed ridge provide non-telemetry oracles.
// All source variants are in memory. No renderer, existing probe or game edit.
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { transformSync } from 'esbuild';
import ts from 'typescript';

const H = readFileSync(new URL('../../src/test/Milestone1D_TestHarness.tsx', import.meta.url), 'utf8');
const F = readFileSync(new URL('../../src/core/physics/flightController.ts', import.meta.url), 'utf8');
const AT = await import('../../src/core/physics/atmosphere.ts');
const TF = await import('../../src/core/terrain/terrainField.ts');
const FC = await import('../../src/core/physics/flightController.ts');
const rows = [];
function check(id, ok, evidence) {
  rows.push({ id, pass: Boolean(ok), evidence });
  console.log(JSON.stringify(rows.at(-1)));
}
const js = s => transformSync(s, { loader: 'ts', format: 'esm' }).code;
function slice(a, b) {
  if (H.split(a).length !== 2 || H.split(b).length !== 2) throw Error('ambiguous harness anchor');
  return H.slice(H.indexOf(a), H.indexOf(b));
}
function astFunction(name) {
  const sf = ts.createSourceFile('h.tsx', H, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const matches = sf.statements.filter(n => ts.isFunctionDeclaration(n) && n.name.text === name);
  if (matches.length !== 1) throw Error(`function ${name}`);
  return matches[0].getText(sf);
}
function replaceOnce(s, a, b) {
  if (s.split(a).length !== 2) throw Error(`mutation anchor count: ${a}`);
  return s.replace(a, b);
}
const t1Body = slice('    let monotone = true;', "    results['atmosphere'] = {");
const t2Body = slice('    const v1000 = script.diveSpeedAt1000;', "    results['governor-dive'] = {");
const t1 = new Function('EARTHSCALE_ATMOSPHERE', 'densityAt', 'speedOfSoundAt', 'machNumber', 'atmosphereVelocityInto', js(t1Body) + 'return pass;');
const t2 = new Function('script', 'flight', js(t2Body) + 'return pass;');
const runT1 = (o = {}) => t1(AT.EARTHSCALE_ATMOSPHERE, o.densityAt ?? AT.densityAt,
  o.speedOfSoundAt ?? AT.speedOfSoundAt, o.machNumber ?? AT.machNumber,
  o.atmosphereVelocityInto ?? AT.atmosphereVelocityInto);
console.log(JSON.stringify({node:process.version, hashes: Object.fromEntries(
  [['harness', H], ['flight', F], ['t1', t1Body], ['t2', t2Body]].map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))}));

// Expected numbers are written from the spec, not from implementation results.
const P = {rho0:1.225, scaleHeight:1200, gamma:1.4, rSpecific:287.05,
  tempSeaLevel:288.15, lapseRate:0.0065, tempFloor:210, atmosphereHeight:8000};
const rhoRef = h => 1.225 * Math.exp(-Math.max(h, 0)/1200);
const machRef = (h,v) => v / Math.sqrt(1.4*287.05*Math.max(210,288.15-0.0065*Math.max(h,0)));
const densityStep = (p,h) => AT.densityAt(p,h)*(h>=4000 ? 0.5 : 1);
const machSL = (p,h,v) => v / Math.sqrt(1.4*287.05*288.15);
const reverseWind = (w,x,y,z,out) => Object.assign(out,{x:-w*z,y:0,z:w*x});
check('T1-baseline', runT1(), 'source-extracted predicate');
let densityErr=0, machErr=0;
for (const h of [0,1,999,3999.99,4000.01,8000,16000,24000]) {
  densityErr=Math.max(densityErr,Math.abs(AT.densityAt(P,h)/rhoRef(h)-1));
  machErr=Math.max(machErr,Math.abs(AT.machNumber(P,h,800)-machRef(h,800)));
}
check('equation-controls', densityErr<1e-12 && machErr<1e-12, {densityErr,machErr});
const ratio=densityStep(P,4000.01)/densityStep(P,3999.99), expectedRatio=Math.exp(-0.02/1200);
check('T1-discontinuity-false-accept', runT1({densityAt:densityStep}) && Math.abs(ratio/expectedRatio-1)>0.49,
  {gate:runT1({densityAt:densityStep}),ratio,expectedRatio});
const machActual=machSL(P,8000,800), machExpected=machRef(8000,800);
check('T1-altitude-Mach-false-accept', runT1({machNumber:machSL}) && Math.abs(machActual-machExpected)>0.2,
  {gate:runT1({machNumber:machSL}),machActual,machExpected});
let windErr=0, reverseErr=0;
for(const w of [-0.0104,0,0.0104]) for(const p of [[5000,0,0],[0,0,5000],[0,5000,0],[3000,1000,-4000]]) {
  // Independent general determinant Ω×p, not magnitude.
  const omega=[0,w,0], [x,y,z]=p;
  const expected=[omega[1]*z-omega[2]*y,omega[2]*x-omega[0]*z,omega[0]*y-omega[1]*x];
  const actual=AT.atmosphereVelocityInto(w,x,y,z,{});
  const wrong=reverseWind(w,x,y,z,{});
  windErr=Math.max(windErr,Math.hypot(...['x','y','z'].map((k,i)=>actual[k]-expected[i])));
  reverseErr=Math.max(reverseErr,Math.hypot(...['x','y','z'].map((k,i)=>wrong[k]-expected[i])));
}
check('wind-vector-control', windErr<1e-10, {windErr,poses:12});
check('T1-reverse-wind-false-accept',runT1({atmosphereVelocityInto:reverseWind}) && reverseErr>100,{reverseErr});
check('T1-no-lapse-rejected',!runT1({speedOfSoundAt:()=>Math.sqrt(1.4*287.05*288.15)}),'a8<a0 responds');
check('T1-constant-density-rejected',!runT1({densityAt:()=>1.225}),'monotonicity responds');
check('T1-zero-wind-rejected',!runT1({atmosphereVelocityInto:(w,x,y,z,o)=>Object.assign(o,{x:0,y:0,z:0})}),'magnitude responds');
check('T1-wrong-sea-level-Mach-rejected',!runT1({machNumber:()=>2}),'Mach at h=0 responds');
check('flight-zero-spin',FC.EARTHSCALE_FLIGHT.planetSpin===0,'default fixture only; not all possible FlightController instances');

// A literal two-endpoint sweep, unlike lattice=2 which may hit internal boundaries.
const endpointBody = `{
  const p0=this._prevPos,p1=this.pos;
  segP0x=p0.x;segP0y=p0.y;segP0z=p0.z;
  segDx=p1.x-p0.x;segDy=p1.y-p0.y;segDz=p1.z-p0.z;
  segLen=Math.hypot(segDx,segDy,segDz);
  if(segLen<1e-9)return;
  if(this._sampleAt(0,R,cfg))return;
  this._sampleAt(segLen,R,cfg);
}`;
function changeSweep(s, body) {
  const sf=ts.createSourceFile('f.ts',s,ts.ScriptTarget.Latest,true);
  const c=sf.statements.find(n=>ts.isClassDeclaration(n) && n.name.text==='FlightController');
  const m=c.members.find(n=>n.name?.getText(sf)==='_sweepTerrain');
  if(!m?.body)throw Error('sweep AST absent');
  return s.slice(0,m.body.getStart(sf))+body+s.slice(m.body.end);
}
async function variant(kind, ridge=false) {
  let s=F;
  if(kind==='endpoint') s=changeSweep(s,endpointBody);
  if(kind==='none') s=changeSweep(s,'{}');
  if(kind==='coarse') {
    s=replaceOnce(s,'const DDA_LATTICE = 2048;','const DDA_LATTICE = 64;');
    s=replaceOnce(s,'const DDA_MAX_GAP = 4;','const DDA_MAX_GAP = 64;');
  }
  if(ridge) s=replaceOnce(s,"import { terrainHeight } from '../terrain/terrainField';",
    'function terrainHeight(x:number,y:number,z:number):number { const a=5000*Math.atan2(x,y)/2; return 20*Math.exp(-a*a); }');
  s=s.replace(/from '(\.[^']+)'/g,(_,path)=>`from '${new URL('../../src/core/physics/'+path+'.ts',import.meta.url).href}'`);
  return import('data:text/javascript;base64,'+Buffer.from(js(s)).toString('base64'));
}
const mods={base:FC,endpoint:await variant('endpoint'),coarse:await variant('coarse'),none:await variant('none')};
TF.initTerrainField(TF.TEST_PLANET);
const R=5000;
// Use actual startDive and observer, not the original repro's copied predicate.
const runDive=new Function('FlightController','EARTHSCALE_FLIGHT','quatFromBasisInto','R',transformSync(`
  const flight=new FlightController(EARTHSCALE_FLIGHT);
  const _bootQ={x:0,y:0,z:0,w:1};
  const script={diveAlt:new Float64Array(4096),diveSpeed:new Float64Array(4096)};
  ${astFunction('diveObserver')}
  ${astFunction('startDive')}
  startDive();
  let frames=0;
  while(!flight.telemetry.grounded && frames<676) { flight.update(4/60,6);frames++; }
  script.diveGrounded=flight.telemetry.grounded;
  return {script,flight,frames};
`, {loader:'ts'}).code);
const dives={};
for(const [k,mod] of Object.entries(mods)) {
  const d=dives[k]=runDive(mod.FlightController,mod.EARTHSCALE_FLIGHT,mod.quatFromBasisInto,R);
  check(`T2-dive-${k}`,t2(d.script,d.flight)===(k!=='none'),{
    pass:t2(d.script,d.flight),v1000:d.script.diveSpeedAt1000,minPost:d.flight.integrity.minPostTickAGL,
    contacts:d.flight.integrity.contacts,grounded:d.script.diveGrounded,frames:d.frames});
}
const d=dives.base;
check('T2-negative-observer-rejected',!t2({...d.script,diveMinPostAGL:-0.01},d.flight),'one scalar negative');
check('T2-negative-integrity-rejected',!t2(d.script,{integrity:{minPostTickAGL:-0.01}}),'one scalar negative');
check('T2-no-landing-rejected',!t2({...d.script,diveGrounded:false},d.flight),'grounded responds');
check('T2-too-fast-rejected',!t2({...d.script,diveSpeedAt1000:401},d.flight),'speed responds');

function xyz(p){return [p.x,p.y,p.z];}
function clearance(p,height) {const r=Math.hypot(...p);return r-R-height(...p.map(x=>x/r));}
function samplePath(a,b,height,gap) {
  const n=Math.ceil(Math.hypot(...a.map((x,i)=>b[i]-x))/gap);
  let min=Infinity,at=0;
  for(let j=0;j<=Math.max(1,n);j++){
    const u=j/Math.max(1,n),p=a.map((x,i)=>x+(b[i]-x)*u),c=clearance(p,height);
    if(c<min){min=c;at=u;}
  }
  return {min,at,n};
}
const ridgeRef=(x,y,z)=>20*Math.exp(-Math.pow(2500*Math.atan2(x,y),2));
const ridgeMods={base:await variant('base',true),endpoint:await variant('endpoint',true)};
for(const [name,mod] of Object.entries(ridgeMods)) {
  const cfg={...mod.EARTHSCALE_FLIGHT,planetMu:0,atmosphere:{...P,rho0:0}};
  const c=new mod.FlightController(cfg);
  c.teleport(-15,5010,0,1800,0,0);c.resetIntegrityStats();c.integrateFlight(1/60);
  const a=[-15,5010,0], b=[15,5010,0];
  const dense=samplePath(a,b,ridgeRef,0.025);
  check(`constructed-ridge-${name}`, name==='base'
    ? c.integrity.contacts>0 && c.telemetry.altAGL>2.999
    : c.integrity.contacts===0 && c.integrity.minPostTickAGL>9 && dense.min<-9.99,
    {startAGL:clearance(a,ridgeRef),endAGL:clearance(b,ridgeRef),interior:dense,
      actualEnd:xyz(c.pos),minPost:c.integrity.minPostTickAGL,contacts:c.integrity.contacts});
}
{
  const mod=ridgeMods.base,c=new mod.FlightController({...mod.EARTHSCALE_FLIGHT,planetMu:0,atmosphere:{...P,rho0:0}});
  c.teleport(-15,5030,0,1800,0,0);c.resetIntegrityStats();c.integrateFlight(1/60);
  check('constructed-high-pass-control',c.integrity.contacts===0 && samplePath([-15,5030,0],xyz(c.pos),ridgeRef,0.025).min>9.99,
    {minPost:c.integrity.minPostTickAGL,contacts:c.integrity.contacts});
}

// Independent seeded uniform-sphere + tangent sampling, fresh controller per tick.
// Real terrain oracle shares the field, NOT the DDA samples or its telemetry.
let seed=0x27b205;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const n=Math.hypot(...a);return a.map(x=>x/n);};
let tunnels=0, witness=null;
for(let i=0;i<4096;i++){
  const y=2*rand()-1,phi=2*Math.PI*rand(),r=Math.sqrt(1-y*y);
  const u=[r*Math.cos(phi),y,r*Math.sin(phi)];
  const t0=norm(cross(u,Math.abs(y)<0.9?[0,1,0]:[1,0,0])),t1=cross(u,t0),az=2*Math.PI*rand();
  const tangent=t0.map((x,j)=>x*Math.cos(az)+t1[j]*Math.sin(az));
  const agl=4+20*rand(),speed=800+1100*rand(),dip=-0.12*rand();
  const p=u.map(x=>x*(R+TF.terrainHeight(...u)+agl));
  const v=tangent.map((x,j)=>speed*(x+dip*u[j]));
  const c=new mods.endpoint.FlightController(mods.endpoint.EARTHSCALE_FLIGHT),q={x:0,y:0,z:0,w:1};
  mods.endpoint.quatFromBasisInto(...tangent,...u,q);
  c.teleport(...p,...v,q);c.resetIntegrityStats();c.integrateFlight(1/60);
  if(c.integrity.contacts)continue;
  const b=xyz(c.pos),s=samplePath(p,b,TF.terrainHeight,0.25);
  if(s.min<-0.01 && c.integrity.minPostTickAGL>=0){
    tunnels++;
    if(!witness || s.min<witness.path.min)witness={index:i,p,v,q,b,path:s,
      startAGL:clearance(p,TF.terrainHeight),endAGL:clearance(b,TF.terrainHeight),
      minPost:c.integrity.minPostTickAGL};
  }
}
check('real-terrain-positive-endpoint-tunnels',tunnels>0,{seed:'0x27b205',trials:4096,tunnels});
if(witness){
  const refined=[0.25,0.125,0.0625].map(gap=>({gap,...samplePath(witness.p,witness.b,TF.terrainHeight,gap)}));
  console.log(JSON.stringify({witness,refined}));
  check('witness-positive-endpoints',witness.startAGL>0 && witness.endAGL>0 &&
    Math.abs(witness.endAGL-witness.minPost)<1e-8,
    {start:witness.startAGL,end:witness.endAGL,telemetry:witness.minPost});
  check('witness-refinement',refined.every(x=>x.min<-0.01) && Math.abs(refined[0].min-refined[2].min)<0.1,refined);
  const c=new FC.FlightController(FC.EARTHSCALE_FLIGHT);
  c.teleport(...witness.p,...witness.v,witness.q);c.resetIntegrityStats();c.integrateFlight(1/60);
  check('real-witness-baseline-control',c.integrity.contacts>0 && c.integrity.minPostTickAGL>=-1e-6,
    {contacts:c.integrity.contacts,minPost:c.integrity.minPostTickAGL,actualEnd:xyz(c.pos)});
}
const failed=rows.filter(r=>!r.pass);
console.log(JSON.stringify({summary:{passed:rows.length-failed.length,total:rows.length,failed:failed.map(r=>r.id)}}));
process.exitCode=failed.length ? 1 : 0;