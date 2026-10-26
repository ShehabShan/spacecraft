// A1 K5: independent allocation/retention measurement; no source mutations.
// Run from game: node --expose-gc --max-semi-space-size=64 tools/audit/u27-k5-recheck.mjs
// --self-test-fail adds one deliberate failed assertion; normal errors fail closed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import inspector from 'node:inspector/promises'
import { PerformanceObserver, performance } from 'node:perf_hooks'

const game = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
if (!globalThis.gc) throw new Error('Run with --expose-gc')
const source = fs.readFileSync(path.join(game, 'tools/test-play-perf.mjs'), 'utf8')
const split = '// WHY (B10 decision): 20,000 warm-up frames.'
if (source.split(split).length !== 2) throw new Error('fixture anchor drift')
let fixture = source.split(split)[0]
if (!fixture.includes("path.resolve(here, '..')")) throw new Error('path anchor drift')
fixture = fixture.replace("path.resolve(here, '..')", `path.resolve(here, '../..')`)
  .replace('test-play-perf.bundle.mjs', 'u27-k5-fixture.bundle.mjs')
fixture += '\nexport {frame,drive,st,w,inp,DT};\n'
const cache = path.join(game, 'node_modules/.cache')
fs.mkdirSync(cache, {recursive:true})
const fixturePath = path.join(cache, 'u27-k5-fixture.mjs')
fs.writeFileSync(fixturePath, fixture)
const {frame,drive,w,DT} = await import(pathToFileURL(fixturePath).href)

const checks = []
function check(name, pass, evidence) {
  checks.push({name, pass:!!pass, evidence})
  console.log(JSON.stringify(checks.at(-1)))
}
function measureLine(name, data) { console.log(JSON.stringify({measurement:name,...data})) }
let fi = 0
function runFrames(n) { for(let i=0;i<n;i++){drive(fi++);frame(DT)} }
runFrames(20000)
check('finite warmed player', Number.isFinite(w.kcc.absPos.x), w.kcc.absPos.x)

const session = new inspector.Session()
session.connect()
await session.post('HeapProfiler.enable')
async function profile(fn, interval) {
  await session.post('HeapProfiler.startSampling', {
    samplingInterval:interval,
    includeObjectsCollectedByMinorGC:true,
    includeObjectsCollectedByMajorGC:true
  })
  fn()
  // All transient controls must survive collection in the profile, not the heap.
  globalThis.gc()
  return (await session.post('HeapProfiler.stopSampling')).profile
}
function scopedBytes(profile, rootName) {
  let bytes=0, terrain=0
  const byFunction={}
  const terrainNames=new Set(['terrainHeight','sampleSurfaceInto','noise3',
    'terrainNormalInto','fbm3','ridged3'])
  function visit(n, inside, inTerrain) {
    const name=n.callFrame.functionName
    const on=inside || name===rootName
    const terr=inTerrain || (on && terrainNames.has(name))
    if(on) {
      bytes+=n.selfSize
      if(terr) terrain+=n.selfSize
      byFunction[name]=(byFunction[name]??0)+n.selfSize
    }
    for(const c of n.children) visit(c,on,terr)
  }
  visit(profile.head,false,false)
  return {bytes,terrain,byFunction}
}
const ring = new Array(32)
// Integer controls avoid assuming V8's floating-point boxing/tiering allocates
// nothing. The first probe's sqrt/F64 controls failed; preserve that log.
const reuse = new Uint32Array(256)
let sink=0
function ctlArithmetic(n) {let sum=0;for(let i=0;i<n;i++)sum=(sum^i)|0;sink=sum}
function ctlReuse(n) {for(let i=0;i<n;i++)reuse[i&255]=i}
function ctlTransient(n) {for(let i=0;i<n;i++)ring[i&31]=new Array(32).fill(i+0.125)}
for(let i=0;i<5;i++){ctlArithmetic(100000);ctlReuse(100000);ctlTransient(100000)}
for(const interval of [64,512]) {
  const N=100000
  const p=await profile(()=>{ctlArithmetic(N);ctlReuse(N);ctlTransient(N)},interval)
  const a=scopedBytes(p,'ctlArithmetic').bytes/N
  const r=scopedBytes(p,'ctlReuse').bytes/N
  const t=scopedBytes(p,'ctlTransient').bytes/N
  measureLine('calibration',{interval,arithmeticB:a,reuseB:r,transientB:t})
  check(`arithmetic near zero interval${interval}`,a<1,a)
  check(`preallocated near zero interval${interval}`,r<1,r)
  check(`escaping arrays detected after GC interval${interval}`,t>200&&t<700,t)
}
const frameResults=[]
for(const interval of [64,512]) {
  runFrames(4000)
  const N=2880
  const p=await profile(()=>runFrames(N),interval)
  const s=scopedBytes(p,'playFrame')
  const b=s.bytes/N, frac=s.terrain/s.bytes
  const top=Object.entries(s.byFunction).sort((a,b)=>b[1]-a[1]).slice(0,10)
    .map(([fn,bytes])=>({fn,BperFrame:bytes/N}))
  frameResults.push(b)
  measureLine('frame-profile',{interval,N,BperFrame:b,terrainFraction:frac,top})
  check(`frame transient allocation interval${interval}`,b>1000&&b<100000,b)
  check(`terrain dominates sampled stacks interval${interval}`,frac>0.5,frac)
}
check('two sample intervals agree within 35%',Math.max(...frameResults)/Math.min(...frameResults)<1.35,frameResults)

// Profiler-off cross-check. GC events, not the sign of a heap delta, decide validity.
const gcEvents=[]
const observer=new PerformanceObserver(list=>{
  for(const e of list.getEntries())gcEvents.push({start:e.startTime,end:e.startTime+e.duration,kind:e.detail.kind})
})
observer.observe({entryTypes:['gc']})
const flush=()=>new Promise(resolve=>setTimeout(resolve,30))
function overlaps(events,a,b) {return events.some(e=>e.start<=b&&e.end>=a)}
check('GC filter rejects even positive-growth overlapping interval',
  overlaps([{start:5,end:7}],0,10), {syntheticHeapDelta:5000})
check('GC filter accepts non-overlap',!overlaps([{start:5,end:7}],8,10),null)
runFrames(4000)
globalThis.gc()
await flush()
const batches=[]
for(let batch=0;batch<8;batch++) {
  const a=performance.now()
  const h0=process.memoryUsage().heapUsed
  runFrames(500)
  const h1=process.memoryUsage().heapUsed
  const b=performance.now()
  await flush()
  batches.push({BperFrame:(h1-h0)/500,gc:overlaps(gcEvents,a,b)})
}
const clean=batches.filter(b=>!b.gc).map(b=>b.BperFrame).sort((a,b)=>a-b)
const median=clean[Math.floor(clean.length/2)]
measureLine('heap-no-GC',{batches,accepted:clean.length,median})
check('at least four GC-free batches',clean.length>=4,clean.length)
check('profiler-off allocation agrees broadly',median>1000&&median<100000&&
  Math.abs(median-frameResults[0])/frameResults[0]<0.4,median)
// Actual forced-GC positive control establishes observer support.
const ga=performance.now();globalThis.gc();const gb=performance.now();await flush()
check('real forced GC observed and excluded',overlaps(gcEvents,ga,gb),gcEvents.length)
observer.disconnect()

// Use the exact two existing retention predicates, not an invented zero-GC gate.
const start=source.indexOf('const dh = samples[')
const end=source.indexOf('// §10.7 HUD throttle')
if(start<0||end<start) throw new Error('retention gate anchor drift')
const retentionGate=new Function('samples','ok',source.slice(start,end))
function dispositions(samples) {
  const rows=[]
  retentionGate(samples,(pass,msg)=>rows.push({pass,msg}))
  if(rows.length!==2)throw new Error('expected two original heap rows')
  return rows
}
function retentionSeries(leak) {
  const held=[]
  const samples=[]
  globalThis.gc();samples.push(process.memoryUsage().heapUsed)
  for(let b=0;b<10;b++){
    if(leak) { for(let i=0;i<1000;i++)held.push(new Array(256).fill(i+0.125)) }
    else ctlTransient(1000)
    globalThis.gc();samples.push(process.memoryUsage().heapUsed)
  }
  // Keep the leaky objects alive through the last sample.
  sink=held.length
  return {samples, rows:dispositions(samples),heldCount:held.length}
}
ctlTransient(10000)
const churn=retentionSeries(false),leak=retentionSeries(true)
measureLine('retention-controls',{churn,leak})
check('unchanged retention rows accept bounded transient allocation',churn.rows.every(r=>r.pass),churn.rows)
check('unchanged retention rows reject growing live heap',leak.rows.every(r=>!r.pass),leak.rows)
session.disconnect()
if(process.argv.includes('--self-test-fail'))check('deliberate self-test',false,null)
const failed=checks.filter(c=>!c.pass).length
console.log(`CHECKS ${checks.length-failed}/${checks.length}; FAILURES ${failed}`)
process.exitCode=failed?1:0