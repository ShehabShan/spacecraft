// A1 U27b4ba. Independent geometric/ownership oracles; production modules unedited.
// Run from game: node tools/audit/u27-k4-recheck.mjs [--self-test-fail]
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('../ts-resolve-loader.mjs', import.meta.url);
const TF = await import('../../src/core/terrain/terrainField.ts');
const { MOON_PARAMS: MOON } = await import('../../src/play/world/moonConfig.ts');
const { AstronautKCC, EARTHSCALE_ASTRONAUT: EARTH } = await import('../../src/core/physics/astronautKCC.ts');
const { MoonLod } = await import('../../src/play/world/MoonLod.ts');
let passed=0,total=0;
function check(name,ok,detail={}) { total++; if(ok)passed++; console.log(JSON.stringify({name,ok,...detail})); }
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0), sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const r=Math.hypot(...a);return a.map(x=>x/r)};
const mul=(a,s)=>a.map(x=>x*s), add=(a,b)=>a.map((v,i)=>v+b[i]);
const angle=(a,b)=>Math.atan2(Math.hypot(...cross(a,b)),dot(a,b))*180/Math.PI;
function direction(i,n) { const z=1-2*(i+.5)/n,t=i*Math.PI*(3-Math.sqrt(5));return [Math.sqrt(1-z*z)*Math.cos(t),Math.sqrt(1-z*z)*Math.sin(t),z]; }
const height=d=>TF.terrainHeight(...d);
const quant=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))];
const summary=a=>({n:a.length,p50:quant(a,.5),p99:quant(a,.99),max:Math.max(...a)});
function basis(d) { const t=norm(cross(d,Math.abs(d[2])<.8?[0,0,1]:[0,1,0])); return [t,cross(d,t)]; }
// Radial surface implicit normal n ∝ d - grad_sphere(h)/(R+h), not production chord cross.
function referenceNormal(d,R,e) {
  const [u,v]=basis(d);
  const derivative=t=>(height(add(mul(d,Math.cos(e)),mul(t,Math.sin(e))))-height(add(mul(d,Math.cos(e)),mul(t,-Math.sin(e)))))/(2*e);
  return norm(sub(d,mul(add(mul(u,derivative(u)),mul(v,derivative(v))),1/(R+height(d)))));
}
function actualNormal(d) {const n={x:0,y:0,z:0};TF.terrainNormalInto(...d,n);return [n.x,n.y,n.z]}
const flightSource=readFileSync('src/core/physics/flightController.ts','utf8');
check('U05-8 tested bound matches production source',/const DDA_LIPSCHITZ = 1\.2;/.test(flightSource));
const FLAT={...MOON,name:'audit flat',continentAmp:0,mountainAmp:0,detailAmp:0};
TF.initTerrainField(FLAT);
let flatError=0;
for(let i=0;i<128;i++){const d=direction(i,128);flatError=Math.max(flatError,angle(d,actualNormal(d)),angle(d,referenceNormal(d,MOON.radius,2e-6)))}
check('U14-1 flat-sphere radial control',flatError<1e-7,{maxDeg:flatError});
TF.initTerrainField(MOON);
let errors=[],convergence=[],rejected=0,worst=null;
for(let i=0;i<4096;i++){
  const d=direction(i,4096),r=referenceNormal(d,MOON.radius,2e-6),r2=referenceNormal(d,MOON.radius,5e-7);
  const diff=angle(r,r2);convergence.push(diff);
  if(diff>.05){rejected++;continue}
  const err=angle(actualNormal(d),r2);errors.push(err);
  if(!worst||err>worst.errorDeg)worst={direction:d,errorDeg:err,referenceConvergenceDeg:diff};
}
check('U14-1 convergence-qualified normals disagree',errors.length>3900&&quant(errors,.5)>1&&quant(errors,.99)>20,{errors:summary(errors),convergence:summary(convergence),rejected,worst});
check('U14-1 reversed-normal oracle control',angle(mul(referenceNormal([1,0,0],MOON.radius,5e-7),-1),referenceNormal([1,0,0],MOON.radius,5e-7))>179);

// Read exact STEEP literal, not a duplicated guessed field.
const harness=readFileSync('src/test/Milestone1E_TestHarness.tsx','utf8');
const literal=harness.match(/const STEEP: TerrainParams = (\{[\s\S]*?\n  \});/);
if(!literal)throw Error('STEEP source anchor changed');
const STEEP=Function('return '+literal[1])();
TF.initTerrainField(STEEP);
let high={h:-Infinity},above=0;
for(let i=0;i<20000;i++){const d=direction(i,20000),h=height(d);if(h>900)above++;if(h>high.h)high={d,h}}
check('U14-3 actual STEEP exceeds configured bound',high.h>2000&&EARTH.maxTerrainHeight===900,{high,above,total:20000});
function sweepHit(bound) {
  const k=new AstronautKCC({...EARTH,spinOmega:0,maxTerrainHeight:bound});
  let hit=false;k._landAt=()=>{hit=true};
  const r=STEEP.radius+high.h;
  k._sweep(...mul(high.d,r+1),...mul(high.d,r-1),1/60);
  return hit;
}
check('U14-3 default bound skips a real-height crossing',!sweepHit(900));
check('U14-3 enlarged bound restores detection control',sweepHit(2243));

// Geodesic secant is a direct counterexample to a Lipschitz upper bound.
TF.initTerrainField(TF.TEST_PLANET);
let steepest={slope:0},over=0;
for(let i=0;i<30000;i++){
  const d=direction(i,30000),[u]=basis(d),e=.5/TF.TEST_PLANET.radius;
  const d2=add(mul(d,Math.cos(e)),mul(u,Math.sin(e)));
  const h0=height(d),h1=height(d2),slope=Math.abs(h1-h0)/.5;
  if(slope>1.2)over++;if(slope>steepest.slope)steepest={slope,d,d2,h0,h1,arcM:.5};
}
check('U05-8 geodesic secant refutes 1.2 bound',steepest.slope>4,{steepest,over,n:30000});
TF.initTerrainField({...FLAT,radius:5000});
check('U05-8 flat-field slope control',height(steepest.d)===height(steepest.d2));

// Each worker import has private buffer sets. Dependency singleton shares params:
// finish every scenario before switching params; this does NOT model multibody workers.
let workerSerial=0;
async function context() {
  const ctx={onmessage:null,out:[],postMessage(m,t){this.out.push(structuredClone(m,{transfer:t??[]}))}};
  globalThis.self=ctx;await import(`../../src/workers/terrainWorker.ts?k4=${workerSerial++}`);return ctx;
}
async function chunk(params,face,ix,iy) {
  const ctx=await context();
  ctx.onmessage({data:{t:'init',params,sets:1}});
  const a=new Float64Array([1,TF.chunkKey(face,4,ix,iy),face,4,ix,iy]);
  ctx.onmessage({data:{t:'req',a}});
  const m=ctx.out[0];if(m.t!=='chunk')throw Error('chunk missing');
  const o={x:0,y:0,z:0};TF.chunkOriginInto(face,4,ix,iy,o);return {m,o:[o.x,o.y,o.z]};
}
async function geometry(params) {
  const errors=[],signed=[];let vertexMax=0,rayMax=0;
  for(let face=0;face<6;face++)for(const [ix,iy] of [[3,4],[8,9],[12,11]]){
    const {m,o}=await chunk(params,face,ix,iy),V=id=>[0,1,2].map(k=>o[k]+m.p[3*id+k]);
    for(let j=1;j<=32;j++)for(let i=1;i<=32;i++){
      const offset=((j*34)+i)*6;
      for(let side=0;side<2;side++){
        const [a,b,c]=[0,1,2].map(k=>V(m.i[offset+side*3+k]));
        const centroid=mul(add(add(a,b),c),1/3),d=norm(centroid);
        const normal=cross(sub(b,a),sub(c,a));
        const rayRadius=dot(normal,a)/dot(normal,d);
        rayMax=Math.max(rayMax,Math.abs(rayRadius-Math.hypot(...centroid)));
        const error=params.radius+height(d)-rayRadius;errors.push(Math.abs(error));signed.push(error);
      }
      const v=V(j*35+i),d=norm(v);
      vertexMax=Math.max(vertexMax,Math.abs(params.radius+height(d)-Math.hypot(...v)));
    }
  }
  return {errors:summary(errors),min:Math.min(...signed),max:Math.max(...signed),vertexMax,rayMax};
}
const flatGeometry=await geometry(FLAT);
check('U22-1 real worker sphere has only small chord sag',flatGeometry.errors.max<.01&&flatGeometry.vertexMax<.0001,flatGeometry);
const roughGeometry=await geometry(MOON);
check('U22-1 actual indexed worker triangles mismatch analytic terrain',roughGeometry.errors.p99>1&&roughGeometry.min<-.25&&roughGeometry.max>.25,roughGeometry);
check('U22-1 vertex/plane controls',roughGeometry.vertexMax<.002&&roughGeometry.rayMax<1e-7);

// Serial messages deliberately keep in-flight count low while bound sets accumulate.
const contexts=[];
for(let i=0;i<6;i++)contexts.push(await context());
globalThis.Worker=class {
  constructor(){this.ctx=contexts.shift();this.inbox=[];this.onmessage=null}
  postMessage(m,t){this.inbox.push(structuredClone(m,{transfer:t??[]}))}
  terminate(){}
};
const {TerrainMeshPool}=await import('../../src/render/TerrainMeshPool.ts');
function flush(pool) {
  for(const w of pool.workers){
    for(const data of w.inbox.splice(0))w.ctx.onmessage({data});
    for(const data of w.ctx.out.splice(0))w.onmessage({data});
  }
}
function requests(sets) {
  TF.initTerrainField(MOON);
  const pool=new TerrainMeshPool({meshCount:144,workerCount:2,workerPoolSets:sets,maxBatch:6,inFlightPerWorker:12,params:MOON});
  const lod=new MoonLod(pool,MOON.radius);let lastNode=null,maxInFlight=0;
  for(let i=0;i<100;i++){
    const n=lod.faces[0][85+i],idx=pool.acquire(n.face,n.level,n.ix,n.iy,n.ox,n.oy,n.oz);
    if(idx<0)throw Error('unexpected capacity');
    pool.records[idx].owner=n;n.pendingRec=idx;lastNode=n;
    pool.pump();maxInFlight=Math.max(maxInFlight,pool.inFlightTotal());flush(pool);
  }
  const c={...pool.counters},active=pool.activeCount(),states=pool.records.filter(r=>r.state===2).map(r=>r.key);
  const result={drops:c.drops,received:c.received,dispatched:c.dispatched,active,unique:new Set(states).size,maxInFlight};
  check(`U20-1 accounting sets=${sets}`,c.received+c.drops===100&&c.dispatched===100&&result.unique===active,result);
  if(sets===96){
    check('U20-1 drops despite low in-flight and unused second worker',c.drops===4&&maxInFlight===1&&pool.workerFree[1]===96,result);
    check('U20-1 owner pending remains on freed record',lastNode.pendingRec>=0&&pool.records[lastNode.pendingRec].state===0&&!lod.nodeHasData(lastNode));
    // Free a bound buffer. Lowest free record is reused for a different real L4 node.
    const stale=lastNode,pending=stale.pendingRec;pool.release(0);
    // Reserve record0 with an unsent request, then record96 can be reused.
    const reserve=pool.acquire(1,4,0,0,0,0,0);
    const other=lod.faces[1][86],idx=pool.acquire(other.face,other.level,other.ix,other.iy,other.ox,other.oy,other.oz);
    pool.records[idx].owner=other;other.pendingRec=idx;
    // Return two sets so both new requests can succeed.
    pool.release(1);pool.pump();flush(pool);
    check('U20-1 stale node falsely reports different owners data',idx===pending&&lod.nodeHasData(stale)&&pool.records[idx].owner!==stale,{idx,pending,reserve,state:pool.records[idx].state});
    check('U20-1 ownership-aware control rejects stale data',!(pool.records[pending].state===2&&pool.records[pending].owner===stale));
  } else check('U20-1 sufficient-capacity control',c.drops===0&&active===100);
  pool.disposeAll();
}
requests(96);requests(144);
if(process.argv.includes('--self-test-fail'))check('deliberate failing assertion',false);
console.log(`SUMMARY ${passed}/${total}`);
process.exitCode=passed===total?0:1;