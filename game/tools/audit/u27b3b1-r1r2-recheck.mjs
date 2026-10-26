// A1 U27b3b1: actual source-extracted R1/R2 predicates, independent controls.
// Run from game/: node tools/audit/u27b3b1-r1r2-recheck.mjs
// No GPU: buffer submission and conditional predicates only, not a browser verdict.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
register('./u27b1-ts-loader.mjs', import.meta.url);
const IM = await import('../../src/core/render/impostorMath.ts');
const SF = await import('../../src/core/physics/sphericalFrame.ts');
const TF = await import('../../src/core/terrain/terrainField.ts');
const RIG = await import('../../src/render/MultiCameraRig.tsx');
const {SkyImpostorPool} = await import('../../src/render/SkyImpostorPool.ts');

const source = readFileSync(new URL('../../src/test/Milestone1F_TestHarness.tsx', import.meta.url),'utf8');
const ast = ts.createSourceFile('h.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const run = ast.statements.find(n=>ts.isFunctionDeclaration(n) && n.name.text==='runSuite');
const blocks = run.body.statements.filter(ts.isBlock);
assert.ok(blocks.length >= 2);
const emit = s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function before(block,variable) {
  const i=block.statements.findIndex(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)===variable));
  assert.ok(i>0,`missing boundary ${variable}`);
  return block.statements.slice(0,i).map(n=>n.getText(ast)).join('\n');
}
function predicate(block) {
  const text=block.getText(ast);
  const matches=[...text.matchAll(/pass:\s*([^\n]+),\s*\n/g)];
  assert.equal(matches.length,1);
  return matches[0][1];
}
const r1src=before(blocks[0],'frozenA');
const r2src=before(blocks[1],'oS');
assert.ok(r1src.includes('const pairs:'));
assert.ok(r2src.includes('for (let rank'));
function compile(body,env) {
  return new Function(...Object.keys(env),emit(body))(...Object.values(env));
}
let checks=0;
function check(label,condition,detail={}) {
  assert.ok(condition,label+' '+JSON.stringify(detail)); checks++;
  console.log('PASS',label,JSON.stringify(detail));
}
const fixtureTruth=Array.from({length:6},(_,i)=>({id:`body-${i}`,distance:100000*(i+1),radius:1000+200*i}));
function skyFixture() {
  const sky=new SkyImpostorPool(0);
  fixtureTruth.forEach((b,i)=>sky.setBody(i,b.id,0,0,0,-1,Math.asin(b.radius/b.distance),b.distance,1,1,1,1,true));
  sky.update(0,0,0,0,0,0,1,0,0,1);
  return sky;
}
function actualR2(sky,coverage=1,centerErr=0) {
  const seen=new Set();
  const bodies=sky.bodies.map((b,i)=>new Proxy(b,{get(t,k){if(k==='alpha')seen.add(i);return t[k];}}));
  const result=compile(`${r2src}\nreturn {maxThetaErr,maxPosErr,audited,pass:${predicate(blocks[1])}};`,
    {...IM,sky:{mesh:sky.mesh,bodies},drv:{x:0,y:0,z:0},coverage,centerErr});
  return {...result,seen:[...seen]};
}
// On-axis silhouette from submitted matrix and shader inputs. True radius/distance
// fixture is separate from mutable pool metadata; no engine geometry helper used.
function observeSky(sky) {
  const order=[...fixtureTruth].sort((a,b)=>b.distance-a.distance);
  const a=sky.mesh.geometry.getAttribute('aDisk').array;
  const m=sky.mesh.instanceMatrix.array;
  let angleError=0,directionError=0;
  for(let rank=0;rank<sky.mesh.count;rank++) {
    const o=16*rank, x=m[o+12],y=m[o+13],z=m[o+14],D=Math.hypot(x,y,z);
    const scale=Math.hypot(m[o],m[o+1],m[o+2]);
    const diskPlaneRadius=scale*a[2*rank+1]/a[2*rank];
    const theta=Math.atan(diskPlaneRadius/D);
    angleError=Math.max(angleError,Math.abs(theta-Math.asin(order[rank].radius/order[rank].distance)));
    directionError=Math.max(directionError,Math.atan2(Math.hypot(x,y),-z));
  }
  return {angleError,directionError,pass:sky.mesh.count===6 && angleError<1e-6 && directionError<1e-6};
}
let sky=skyFixture(), r=actualR2(sky), obs=observeSky(sky);
check('R2 clean submitted geometry accepted by both',r.pass&&obs.pass,{r,obs});
check('R2 repeats one slot six times',r.audited===6&&r.seen.length===1&&r.seen[0]===0,r);
const mutations={
  'quad scale doubled':s=>{for(let i=0;i<6;i++){const a=s.mesh.instanceMatrix.array;for(const j of [0,1,2,4,5,6])a[16*i+j]*=2;}},
  'disk attribute enlarged 10%':s=>{s.mesh.geometry.getAttribute('aDisk').array[1]*=1.1;},
  'instance translated 100m':s=>{s.mesh.instanceMatrix.array[12]+=100;},
  'non-first input radius wrong':s=>{s.bodies[5].theta*=1.5;s.update(0,0,0,0,0,0,1,0,0,1);},
};
for(const [name,mutate] of Object.entries(mutations)) {
  sky=skyFixture();mutate(sky);r=actualR2(sky);obs=observeSky(sky);
  check(`R2 false accept: ${name}`,r.pass&&!obs.pass,{r,obs});
}
sky=skyFixture();sky.bodies[0].stagedPX+=1;r=actualR2(sky);
check('R2 cached position corruption DOES fail',!r.pass&&r.maxPosErr===1,r);
sky=skyFixture();sky.bodies[0].alpha=0.5;r=actualR2(sky);
check('R2 first-slot fade DOES fail',!r.pass&&r.maxThetaErr>1e-6,r);
sky=skyFixture();sky.mesh.count=5;
check('R2 insufficient-count control fails',!actualR2(sky).pass);
sky=skyFixture();
check('R2 absent-Sun pixel scalars fail',!actualR2(sky,0,999).pass);
check('R2 displaced-Sun pixel scalar fails',!actualR2(sky,1,2).pass);

const moon={name:'audit Moon',radius:1364.5,seed:20240119,continentFreq:2.3,continentAmp:95,maskFreq:3.7,mountainFreq:6.5,mountainAmp:230,detailFreq:22,detailAmp:16};
TF.initTerrainField(moon);
function actualR1(records,determinismDiff=0) {
  return compile(`${r1src}\nreturn {pairs,layeredMin,singleMin,pass:${predicate(blocks[0])}};`,{
    ...IM,...SF,...TF,probe:{forcedD:0},updateProbes(){},PROBE_GAP:2500,
    kcc:{spinPhase:0},_qS:{x:0,y:0,z:0,w:1},_vB:{x:0,y:0,z:0},
    pool:{records},earthVec:{x:38850,y:0,z:0},earthDist:38850,EARTH_R:5000,HEIGHT_SLACK:420,determinismDiff
  });
}
// Independent projective depth spacing: exact normalized-depth difference rather
// than the engine's differential depthResolution helper.
function depthSteps(camera,z,gap) {
  const depth=v=>camera.far/(camera.far-camera.near)-camera.far*camera.near/((camera.far-camera.near)*v);
  return Math.abs(depth(z+gap)-depth(z))*2**24;
}
const object=new THREE.Object3D();object.layers.mask=RIG.MID_BIT;
function observedPair() {
  const cam=RIG.rigCamMid,z=233000,gap=2500;
  const visible=(object.layers.mask&cam.layers.mask)!==0&&z>=cam.near&&z+gap<=cam.far;
  const steps=depthSteps(cam,z,gap);
  return {visible,steps,pass:visible&&steps>10};
}
let analytic=actualR1([]), pair=observedPair();
check('R1 clean pair accepted by analytic and independent depth oracle',analytic.pass&&pair.pass,{analytic,pair});
const oldNear=RIG.rigCamMid.near,oldFar=RIG.rigCamMid.far;
RIG.rigCamMid.near=0.01;RIG.rigCamMid.far=1e7;
pair=observedPair();r=actualR1([]);
check('R1 ignores actual degraded camera planes',r.pass&&!pair.pass&&pair.steps<1,{r,pair});
RIG.rigCamMid.near=oldNear;RIG.rigCamMid.far=oldFar;
object.layers.mask=RIG.NEAR_BIT;pair=observedPair();
check('R1 ignores wrong object pass mask',actualR1([]).pass&&!pair.pass,pair);
object.layers.mask=RIG.MID_BIT;
check('R1 determinism predicate still detects differing bytes',!actualR1([],1).pass);
check('R1 empty coverage substitutes fabricated pair',analytic.pairs[1].layered===1e9&&analytic.pairs[1].gap===30000);

// Independent conservative field bound, not the unproven MAX_TERRAIN_H=360.
// Each simplex term <= sqrt(2)*r*(0.6-r²)^4, maximized at r²=0.6/9.
// Four terms *32, normalized positive fBm weights; mask in[0,1].
const rmax=Math.sqrt(0.6/9);
const noiseBound=128*Math.SQRT2*rmax*(0.6-rmax*rmax)**4;
const ridgeBound=Math.max(1,(noiseBound-1)**2);
const heightBound=noiseBound*(95+16)+ridgeBound*230;
const originBound=1364.5+heightBound;
const rawGapBound=originBound-5000-420;
check('R1 Earth term impossible even under conservative noise bound',rawGapBound<0,{noiseBound,ridgeBound,heightBound,originBound,rawGapBound});
const records=[];let maxOrigin=0;
for(let level=0;level<=5;level++)for(let face=0;face<6;face++)for(let ix=0;ix<2**level;ix++)for(let iy=0;iy<2**level;iy++){
  const p={x:0,y:0,z:0};TF.chunkOriginInto(face,level,ix,iy,p);
  maxOrigin=Math.max(maxOrigin,Math.hypot(p.x,p.y,p.z));
  records.push({state:2,level,originX:p.x,originY:p.y,originZ:p.z});
}
r=actualR1(records);
check('R1 real generated chunk origins still hit sentinel',records.length===8190&&maxOrigin<=originBound&&r.pairs[1].layered===1e9,{records:records.length,maxOrigin,earthPair:r.pairs[1]});
const artificial=[{state:2,level:12,originX:10000,originY:0,originZ:0}];
r=actualR1(artificial);
check('R1 out-of-domain positive-gap control reaches branch',r.pairs[1].gap>0&&r.pairs[1].gap<5000&&r.pairs[1].layered!==1e9,r.pairs[1]);
// Collinear observer fixture: independent 1D near-limb separation. Not a claim
// about real horizon pixels or all angular overlaps.
const observer=-1400,chunk=1400,earth=38850,nearLimb=earth-5000;
const gap=(nearLimb-observer)-(chunk-observer+420+0.75*TF.chunkArcWidth(12));
r=actualR1([{state:2,level:12,originX:chunk,originY:0,originZ:0}]);
check('R1 common-observer fixture has real separation but sentinel output',gap>30000&&r.pairs[1].layered===1e9,{observerRelativeGap:gap,reportedGap:r.pairs[1].gap});
console.log(`SUMMARY ${checks}/${checks} independent checks passed; no GPU/browser verdict.`);