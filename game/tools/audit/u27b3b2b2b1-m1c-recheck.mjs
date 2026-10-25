// A1-U27b3b2b2b1: CPU seam-data and exact T3 predicate review, not a GPU test.
// Run from game/: node tools/audit/u27b3b2b2b1-m1c-recheck.mjs
import { register } from 'node:module';
register('../ts-resolve-loader.mjs', import.meta.url);
import { readFileSync } from 'node:fs';
import { transformSync, build } from 'esbuild';
import assert from 'node:assert/strict';

const src = new URL('../../src/', import.meta.url);
const H = readFileSync(new URL('test/Milestone1C_TestHarness.tsx', src), 'utf8');
const TF = await import(new URL('core/terrain/terrainField.ts', src));
const SP = await import(new URL('core/terrain/spherify.ts', src));
const NZ = await import(new URL('core/terrain/noise.ts', src));
const N = 32, W = 35;
assert.equal(TF.GRID_N, N); assert.equal(TF.GRID_W, W);
const results = [];
function check(id, ok, evidence) {
  results.push({ id, ok: !!ok, evidence });
  console.log(JSON.stringify(results.at(-1)));
}
function between(start, end) {
  const a = H.indexOf(start), b = H.indexOf(end, a);
  assert(a >= 0 && b > a, `missing slice ${start}`);
  return H.slice(a, b);
}
// Complete production T3 predicate, including the round-trip clause.
const expression = H.match(/const seamsOk = ([\s\S]*?);/)[1];
const metrics = { audits: {}, roundtripErr: 0 };
const pool = { records: [] };
const js = transformSync(between('function posArr(', 'const WINDOW_SECONDS'), { loader: 'ts' }).code;
const auditSeams = new Function('GRID_N', 'GRID_W', 'metrics', 'pool', js + '\nreturn auditSeams;')(N, W, metrics, pool);
const verdict = new Function('metrics', 'const A=metrics.audits; return ' + expression);
const selfTest = between('(function spherifySelfTest()', '/* -- static scene content');
new Function('metrics', 'mulberry32', 'sphereToCubeInto', 'faceCubePointInto', 'spherifyInto',
  transformSync(selfTest, { loader: 'ts' }).code)(
  metrics, NZ.mulberry32, SP.sphereToCubeInto, SP.faceCubePointInto, SP.spherifyInto);
const roundtrip = metrics.roundtripErr;
function gate(records, roundtripErr = roundtrip) {
  metrics.audits = { run: 0, pairs: 0, parentVerts: 0, maxPosDev: 0, nrmMismatch: 0 };
  metrics.roundtripErr = roundtripErr; pool.records = records;
  auditSeams();
  return { ...metrics.audits, roundtripErr, pass: verdict(metrics) };
}
// Explicit chart convention; never imports production FACE_C/U/V or gridCoord.
// Expected topology is independently enumerated in Cartesian coordinates below.
function cube(face, u, v) {
  switch (face) {
    case 0: return [1, v, -u]; case 1: return [-1, v, u];
    case 2: return [u, 1, -v]; case 3: return [u, -1, v];
    case 4: return [u, v, 1]; case 5: return [-u, v, -1];
    default: throw Error('bad face');
  }
}
function coordinate(r, i, j) {
  return cube(r.face, 2 * (r.ix * N + i - 1) / (N * 2 ** r.level) - 1,
    2 * (r.iy * N + j - 1) / (N * 2 ** r.level) - 1);
}
const layout = [];
for (let f = 0; f < 6; f++) for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
  if (f === 5 && x === 0 && y === 0) {
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) layout.push({ face:f, level:2, ix:a, iy:b });
  } else layout.push({ face:f, level:1, ix:x, iy:y });
}
function record(info, p, n, origin = [0, 0, 0]) {
  return { ...info, state:2, originX:origin[0], originY:origin[1], originZ:origin[2],
    geometry:{ attributes:{ position:{ array:p }, normal:{ array:n } } } };
}
const pos = r => r.geometry.attributes.position.array;
const nrm = r => r.geometry.attributes.normal.array;
const clone = records => records.map(r => record(r, pos(r).slice(), nrm(r).slice(), [r.originX,r.originY,r.originZ]));
// Unrelated analytic sphere fixture (radial normalization, not production terrain).
const sphere = layout.map(info => {
  const p = new Float32Array(W*W*3), n = new Float32Array(W*W*3);
  for (let j=1;j<=N+1;j++) for (let i=1;i<=N+1;i++) {
    const c=coordinate(info,i,j), length=Math.hypot(...c), k=(j*W+i)*3;
    for(let a=0;a<3;a++){n[k+a]=c[a]/length;p[k+a]=5000*c[a]/length;}
  }
  return record(info,p,n);
});
// Real worker module, bundled in memory. No edits to production files; no worker
// concurrency, transfer-detachment, renderer or live LOD claims.
const messages=[];
globalThis.self={postMessage:m=>messages.push(m),onmessage:null};
const workerBuild=await build({entryPoints:[new URL('workers/terrainWorker.ts',src).pathname],
  bundle:true,write:false,format:'esm',platform:'node'});
await import('data:text/javascript;base64,'+Buffer.from(workerBuild.outputFiles[0].text).toString('base64'));
self.onmessage({data:{t:'init',params:TF.TEST_PLANET,sets:layout.length}});
TF.initTerrainField(TF.TEST_PLANET);
const real=layout.map((info,key)=>{
  messages.length=0;
  self.onmessage({data:{t:'req',a:new Float64Array([1,key,info.face,info.level,info.ix,info.iy])}});
  assert.equal(messages.length,1); const m=messages[0]; assert.equal(m.t,'chunk');
  const o={x:0,y:0,z:0};TF.chunkOriginInto(info.face,info.level,info.ix,info.iy,o);
  return record(info,m.p,m.n,[o.x,o.y,o.z]);
});
// Identity from integer/dyadic parameter coordinates, never from rounded positions.
const groups=new Map();
layout.forEach((r,ri)=>{
  for(let j=1;j<=N+1;j++) for(let i=1;i<=N+1;i++){
    const c=coordinate(r,i,j), key=c.join(',');
    if(!groups.has(key))groups.set(key,{c,refs:[]});
    groups.get(key).refs.push({ri,k:(j*W+i)*3});
  }
});
const shared=[...groups.values()].filter(g=>g.refs.length>1);
function oracle(records){
  let samePairs=0,crossPairs=0,sameNormalBad=0,crossNormalBad=0,samePositionBad=0,crossPositionBad=0,maxPosition=0;
  const bits=records.map(r=>new Uint32Array(nrm(r).buffer,nrm(r).byteOffset,nrm(r).length));
  for(const g of shared)for(let a=0;a<g.refs.length;a++)for(let b=a+1;b<g.refs.length;b++){
    const A=g.refs[a],B=g.refs[b],ra=records[A.ri],rb=records[B.ri],cross=ra.face!==rb.face;
    let bad=false,dev=0;
    const oa=[ra.originX,ra.originY,ra.originZ],ob=[rb.originX,rb.originY,rb.originZ];
    for(let k=0;k<3;k++){
      bad ||= bits[A.ri][A.k+k]!==bits[B.ri][B.k+k] || !Number.isFinite(nrm(ra)[A.k+k]) || !Number.isFinite(nrm(rb)[B.k+k]);
      dev=Math.max(dev,Math.abs(pos(ra)[A.k+k]+oa[k]-pos(rb)[B.k+k]-ob[k]));
    }
    maxPosition=Math.max(maxPosition,dev);
    if(cross){crossPairs++;if(bad)crossNormalBad++;if(!Number.isFinite(dev)||dev>0.005)crossPositionBad++;}
    else {samePairs++;if(bad)sameNormalBad++;if(!Number.isFinite(dev)||dev>0.005)samePositionBad++;}
  }
  return {samePairs,crossPairs,sameNormalBad,crossNormalBad,samePositionBad,crossPositionBad,maxPosition};
}
const expectedEdges=[];
for(let variable=0;variable<3;variable++)for(const s of [-1,1])for(const t of [-1,1]){
  const c=[0,0,0],fixed=[0,1,2].filter(a=>a!==variable);
  c[variable]=-0.75;c[fixed[0]]=s;c[fixed[1]]=t;
  expectedEdges.push(groups.get(c.join(',')));
}
const expectedCorners=[];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])expectedCorners.push(groups.get([x,y,z].join(',')));
check('topology-12-edges-8-corners',
  expectedEdges.length===12 && expectedEdges.every(g=>g && new Set(g.refs.map(v=>layout[v.ri].face)).size===2) &&
  expectedCorners.length===8 && expectedCorners.every(g=>g && new Set(g.refs.map(v=>layout[v.ri].face)).size===3),
  {edges:expectedEdges.map(g=>g?.c),corners:expectedCorners.map(g=>g?.c)});
function mutate(records,g,kind,allOnFace=true){
  const out=clone(records),first=g.refs[0],face=layout[first.ri].face;
  const targets=allOnFace?g.refs.filter(v=>layout[v.ri].face===face):[first];
  for(const {ri,k}of targets){
    if(kind==='normal')for(let a=0;a<3;a++)nrm(out[ri])[k+a]*=-1;
    else pos(out[ri])[k]+=1;
  }
  return out;
}
// The raw analytic chart can spell zero as -0 on one face. Verify the strict
// bit oracle catches exactly that benign fixture difference before canonicalizing
// synthetic normals to +0. Production worker arrays are NEVER canonicalized.
let rawBitPairs=0, signedZeroPairs=0;
for(const g of shared)for(let a=0;a<g.refs.length;a++)for(let b=a+1;b<g.refs.length;b++){
  const A=g.refs[a],B=g.refs[b];
  const na=nrm(sphere[A.ri]),nb=nrm(sphere[B.ri]);
  const ba=new Uint32Array(na.buffer),bb=new Uint32Array(nb.buffer);
  let mismatch=false,onlyZeros=true;
  for(let k=0;k<3;k++)if(ba[A.k+k]!==bb[B.k+k]){
    mismatch=true;onlyZeros &&= na[A.k+k]===0 && nb[B.k+k]===0;
  }
  if(mismatch){rawBitPairs++;if(onlyZeros)signedZeroPairs++;}
}
check('strict-bit-oracle-signed-zero-control',rawBitPairs>0 && rawBitPairs===signedZeroPairs,
  {rawBitPairs,signedZeroPairs});
for(const r of sphere)for(let k=0;k<nrm(r).length;k++)if(nrm(r)[k]===0)nrm(r)[k]=0;
for(const [name,records] of [['sphere',sphere],['worker',real]]){
  const b=gate(records),truth=oracle(records);
  check(name+'-baseline',b.pass && truth.crossPairs>0 && truth.sameNormalBad===0 &&
    truth.crossNormalBad===0 && truth.samePositionBad===0 && truth.crossPositionBad===0,{gate:b,truth});
  for(const [kind,fixtures] of [['edge',expectedEdges],['corner',expectedCorners]]){
    for(const g of fixtures){
      const changed=mutate(records,g,'normal'),a=gate(changed),t=oracle(changed);
      check(name+'-'+kind+'-normal-'+g.c.join(','),a.pass && t.crossNormalBad>0 && t.sameNormalBad===0,{gate:a,truth:t});
    }
  }
  for(const g of expectedEdges){
    const changed=mutate(records,g,'position'),a=gate(changed),t=oracle(changed);
    check(name+'-edge-position-'+g.c.join(','),a.pass && t.crossPositionBad>0 && t.samePositionBad===0,{gate:a,truth:t});
  }
  const same=shared.find(g=>g.refs.length===2 &&
    layout[g.refs[0].ri].face===layout[g.refs[1].ri].face &&
    layout[g.refs[0].ri].level===layout[g.refs[1].ri].level);
  const tj=shared.find(g=>g.refs.length===2 &&
    layout[g.refs[0].ri].face===layout[g.refs[1].ri].face &&
    Math.abs(layout[g.refs[0].ri].level-layout[g.refs[1].ri].level)===1);
  assert(same&&tj);
  for(const [kind,g]of [['same',same],['tjunction',tj]])for(const fault of ['normal','position']){
    const changed=mutate(records,g,fault,false),a=gate(changed),t=oracle(changed);
    check(name+'-control-'+kind+'-'+fault,!a.pass && (fault==='normal'?t.sameNormalBad>0:t.samePositionBad>0),{gate:a,truth:t});
  }
}
check('empty-records-reject',!gate([]).pass,gate([]));
check('missing-tjunction-reject',!gate(real.filter(r=>r.level===1)).pass,gate(real.filter(r=>r.level===1)));
check('roundtrip-control-reject',!gate(real,1e-6).pass,gate(real,1e-6));
// Chart calibration against each real vertex's world direction. Height is not
// independently verified here; normalization removes its radial contribution.
let maxDirectionError=0;
real.forEach(r=>{
  for(let j=1;j<=N+1;j++)for(let i=1;i<=N+1;i++){
    const c=coordinate(r,i,j),[x,y,z]=c,k=(j*W+i)*3;
    const d=[x*Math.sqrt(1-y*y/2-z*z/2+y*y*z*z/3),
      y*Math.sqrt(1-z*z/2-x*x/2+z*z*x*x/3),
      z*Math.sqrt(1-x*x/2-y*y/2+x*x*y*y/3)];
    const p=[pos(r)[k]+r.originX,pos(r)[k+1]+r.originY,pos(r)[k+2]+r.originZ],len=Math.hypot(...p);
    maxDirectionError=Math.max(maxDirectionError,...d.map((v,a)=>Math.abs(v-p[a]/len)));
  }
});
check('worker-chart-calibration',maxDirectionError<1e-7,{vertices:real.length*(N+1)**2,maxDirectionError});
console.log(JSON.stringify({summary:{passed:results.filter(r=>r.ok).length,total:results.length},node:process.version}));
if(results.some(r=>!r.ok))process.exitCode=1;