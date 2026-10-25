// A1-U27b2: independent gate-sensitivity controls, not a browser/GPU test.
// Run from game/: node --expose-gc tools/audit/u27b2-k2a-recheck.mjs
// Source gates are extracted unchanged. Fakes isolate their measurement contract;
// original probes separately replay real dynamics. No production edits.
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import fs from 'node:fs'
import ts from 'typescript'
import inspector from 'node:inspector/promises'

if (!globalThis.gc) throw Error('Run with --expose-gc')
const texts = Object.fromEntries(['B','C','D','E','F'].map(k =>
  [k, fs.readFileSync(`src/test/Milestone1${k}_TestHarness.tsx`, 'utf8')]))
let checks = 0
function check(name, ok, data) {
  checks++
  console.log(JSON.stringify({check:name,ok,...data}))
  if (!ok) throw Error(name)
}
const js = s => ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
function slice(s,a,b) {
  const i=s.indexOf(a), j=s.indexOf(b,i+a.length)
  if(i<0||j<0) throw Error('Missing source anchor '+a)
  return s.slice(i,j)
}
function fn(s,name) {
  const file=ts.createSourceFile('h.tsx',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
  const n=file.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name)
  if(!n) throw Error(name)
  return n.getText(file)
}
function heap(vals) {
  if(vals===null) return null
  let i=0
  return {get usedJSHeapSize(){if(i>=vals.length)throw Error('heap read overflow');return vals[i++]}}
}
const vec=()=>({x:0,y:1,z:0})
function fakeKcc(mut) {
  const k={absPos:vec(),absVel:vec(),pLocal:vec(),up:vec(),fwd:vec(),
    input:{},telemetry:{},integrity:{nanEvents:0},resetIntegrityStats(){},
    teleportSurface(){},teleportAbs(){},attachVehicle(){},detachVehicle(){},
    integrateTick(){mut?.(k)}}
  return k
}
const eFactory=new Function('kcc','suite','heapApi','FLAT_SITE','R','staticProv','quatFromFrameInto',
  js(fn(texts.E,'runZeroGcBurn'))+';return runZeroGcBurn();')
function eRun(mut,values=null) {
  const k=fakeKcc(mut),suite={burn:{}}
  const r=eFactory(k,suite,heap(values),vec(),5000,
    {pos:vec(),vel:vec(),quat:{},angVel:vec()},()=>{})
  return {pass:r.pass,...suite.burn}
}
const bBody=slice(texts.B,'  const canary = BODIES.map','  /* ---- T5:')
const bFactory=new Function('BODIES','core','performance','BURN_TICKS','HEAP_LIMIT',
  'const results={};'+js(bBody)+';return results["zero-gc"];')
function bRun(mut,values=null) {
  const bodies=[{absPos:vec(),localPosF32:new Float32Array(3)}]
  const perf=values===null?{}:{memory:heap(values)}
  return bFactory(bodies,{tick(){mut?.(bodies[0])}},perf,20000,1048576)
}
const fBody=slice(texts.F,'  /* -- R4: zero-GC','  /* -- R5:')
const fFactory=new Function('sky','astroMesh','heapApi','applyRenderState',
  `const results={},rigCamNear={},RIG={driver:{},poseOverride:null},probe={};
   const stars={},earthMesh={},probeMeshA={},probeMeshB={},satA={},satB={},satC={};
   const drv={},gl={},scene={},IMPOSTOR_CAPACITY=2;
   function updateProbes(){} function executePassesLocal(){}
   ${js(fBody)}
   return results['zero-gc'];`)
function fRun(mut,values=null) {
  const sky={mesh:{instanceMatrix:{}},stars:{},material:{},bodies:[{},{}]}
  const astro={children:new Array(8)}
  return fFactory(sky,astro,heap(values),()=>mut?.(sky,astro))
}
const dBody=slice(texts.D,'  /* -- T4: zero-GC physics tick','  /* -- T5:')
const dFactory=new Function('burnResult','const results={};'+js(dBody)+';return results["zero-gc"];')
const dRun=v=>dFactory({heapDelta:v,identityOk:true,nanEvents:0,ticks:20000,contacts:0})
check('stable identities pass',eRun().pass && bRun().pass && fRun().pass && dRun(0).pass)
check('m1e canary DOES catch runtime replacement',!eRun(k=>{k.up={...k.up}}).pass)
check('m1b canary catches absPos replacement',!bRun(k=>{k.absPos={...k.absPos}}).pass)
check('m1f same-shaped replacement bypasses canary',
  fRun((sky)=>{sky.mesh={instanceMatrix:{}};sky.bodies=[{},{}]}).pass)
check('m1f shape failure is detectable',!fRun((_s,a)=>{a.children=[]}).pass)
for(const [label,delta] of [['missing',-1],['negative',-5000000],['zero',0],['large',5000001]]) {
  const values=label==='missing'?null:[10000000,10000000+delta]
  const got={e:eRun(null,values).pass,b:bRun(null,values).pass,
    f:fRun(null,values===null?null:[...values,...values]).pass,d:dRun(delta).pass}
  check('heap clauses '+label,Object.values(got).every(v=>v===(label!=='large')),{got})
}
check('exact heap limits accepted',
 eRun(null,[0,1048576]).pass && bRun(null,[0,1048576]).pass &&
 fRun(null,[0,262144,0,4194304]).pass && dRun(1048576).pass)
check('one byte above heap limits rejected',
 !eRun(null,[0,1048577]).pass && !bRun(null,[0,1048577]).pass &&
 !fRun(null,[0,262145,0,4194304]).pass && !fRun(null,[0,262144,0,4194305]).pass && !dRun(1048577).pass)
let allocations=0,sink=null
const garbage=()=>{sink=new Array(512).fill(++allocations+0.5)}
const garbageResults={e:eRun(garbage).pass,b:bRun(garbage).pass,f:fRun(garbage).pass}
check('known transient allocations pass missing-measurement gates',
 Object.values(garbageResults).every(Boolean)&&allocations===53000,
 {got:garbageResults,allocations,doubleSlots:allocations*512})
sink=null

// Real pool, worker-free fixture. An injected pump allocation bypasses the
// constructor-only counter. Incoming transfers/GPU upload are NOT simulated.
const {TerrainMeshPool}=await import('../../src/render/TerrainMeshPool.ts')
const {TEST_PLANET}=await import('../../src/core/terrain/terrainField.ts')
const p=new TerrainMeshPool({meshCount:1,workerCount:0,workerPoolSets:1,maxBatch:1,inFlightPerWorker:1,params:TEST_PLANET})
const counterStart=p.counters.bootBufferAllocs
const cBody=slice(texts.C,'  const disposeDelta =','  const A = metrics.audits;')
const cGate=new Function('pool','metrics','disposeCalls','sceneRemoveCalls',cBody+'return {zeroDispose,allocDelta};')
const cg=()=>cGate(p,{disposeStart:0,removeStart:0,allocStart:counterStart},0,0)
check('pool no-allocation control',cg().zeroDispose)
const orig=p.pump.bind(p),buffers=[]
p.pump=()=>{buffers.push(new Float32Array(1024));orig()}
for(let i=0;i<1000;i++)p.pump()
const observed=cg()
check('pool runtime buffer allocations invisible',observed.zeroDispose&&observed.allocDelta===0&&buffers.length===1000,
 {...observed,constructedBuffers:buffers.length,retainedBytes:buffers.reduce((s,a)=>s+a.byteLength,0)})
p.counters.bootBufferAllocs++
check('pool counter wiring control',!cg().zeroDispose)
buffers.length=0

// Independent allocation observer. Keep collected samples explicitly; otherwise
// the sampler can turn into another retained-memory observer. Scope bytes to
// workload functions, excluding inspector/heap reads. Statistical, not exact.
const session=new inspector.Session();session.connect()
await session.post('HeapProfiler.enable')
const ring=new Array(16).fill(null),held=[]
function preallocated(n){for(let i=0;i<n;i++)ring[i&15]=i}
function transient(n){for(let i=0;i<n;i++)ring[i&15]=new Array(512).fill(i+0.5)}
function retained(n){for(let i=0;i<n;i++)held.push(new Array(512).fill(i+0.5))}
preallocated(30000);transient(30000);retained(1000)
held.length=0;ring.fill(null);gc()
async function measure(f,n) {
  gc();const h0=process.memoryUsage().heapUsed
  await session.post('HeapProfiler.startSampling',{samplingInterval:1024,
    includeObjectsCollectedByMinorGC:true,includeObjectsCollectedByMajorGC:true})
  f(n);ring.fill(null);gc()
  const h1=process.memoryUsage().heapUsed
  const {profile}=await session.post('HeapProfiler.stopSampling')
  let bytes=0
  function walk(node,inside=false) {
    inside ||= node.callFrame.functionName===f.name
    if(inside)bytes+=node.selfSize
    for(const c of node.children)walk(c,inside)
  }
  walk(profile.head)
  return {workload:f.name,n,postGcHeapDelta:h1-h0,sampledAllocationBytes:bytes}
}
const clean=await measure(preallocated,10000),churn=await measure(transient,10000),leak=await measure(retained,5000)
console.log(JSON.stringify({allocationObserver:{clean,churn,leak}}))
check('observer preallocated control',clean.sampledAllocationBytes<65536)
check('observer detects collected transient allocation',churn.sampledAllocationBytes>30000000)
check('post-GC delta hides transient churn',Math.abs(churn.postGcHeapDelta)<1048576)
check('retention control detectable',leak.postGcHeapDelta>10000000&&leak.sampledAllocationBytes>10000000)
held.length=0;session.disconnect()
console.log(`U27b2 independent: ${checks}/${checks} checks passed`)