// A1 U27b3b2a: source-extracted R3 predicates and independently designed controls.
// Run from game/: node tools/audit/u27b3b2a-r3-recheck.mjs
// No renderer/GPU is run. Synthetic RGBA inputs test the real classification
// loop; supplied symPct values isolate the scalar/trace clauses.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../../src/test/Milestone1F_TestHarness.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('h.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const nodes=[];
function visit(n){nodes.push(n);ts.forEachChild(n,visit);}
visit(ast);
const emit=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
function compile(text,env){return new Function(...Object.keys(env),emit(text))(...Object.values(env));}
function fn(name){
  const found=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
  assert.equal(found.length,1,name);
  return found[0].getText(ast).replace(/^export /,'');
}
const run=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='runSuite');
const r3=run.body.statements.filter(ts.isBlock).find(n=>n.getText(ast).includes("results['handoff'] ="));
assert.ok(r3);
function varIndex(name){const i=r3.statements.findIndex(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast)===name));assert.ok(i>=0,name);return i;}
const scalars=r3.statements.slice(0,varIndex('savedD')).map(n=>n.getText(ast)).join('\n');
const pixels=r3.statements.slice(varIndex('win'),varIndex('symPct')+1).map(n=>n.getText(ast)).join('\n');
const assignments=nodes.filter(n=>ts.isBinaryExpression(n)&&n.left.getText(ast)==="results['handoff']");
assert.equal(assignments.length,1);
const passExpr=assignments[0].right.properties.find(n=>n.name?.getText(ast)==='pass').initializer.getText(ast);
const constants=ast.statements.filter(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(ast).startsWith('HANDOFF_'))).map(n=>n.getText(ast).replace(/^export /,'')).join('\n');
const helpers=compile(constants+'\n'+fn('handoffFade')+'\n'+fn('handoffNextState')+'\nreturn {handoffFade,handoffNextState};',{});
const traceCall=nodes.filter(n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='live.probeTrace.push');
assert.equal(traceCall.length,1);
const meshExprs=nodes.filter(n=>ts.isBinaryExpression(n)&&n.left.getText(ast)==='probeMeshA.visible'&&n.right.getText(ast).includes('probe.meshStateA'));
assert.equal(meshExprs.length,1);
const skyCalls=nodes.filter(n=>ts.isCallExpression(n)&&n.expression.getText(ast)==='sky.setBody'&&n.arguments[1]?.getText(ast)==="'probe-a'");
assert.equal(skyCalls.length,1);
const impExpr=skyCalls[0].arguments.at(-1).getText(ast);
function unit(trace,symPct=0,overrides={}){
  return compile(scalars+`\nreturn {holes,doubles,flips,maxSlope,liveHoles,crossedLo,crossedHi,pass:(${passExpr})};`,
    {...helpers,...overrides,live:{probeTrace:trace},symPct});
}
function makeTrace(mutator=()=>{}){
  const probe={t:0,dA:320000,dB:322500,meshStateA:true,meshStateB:true,alphaMeshA:1,alphaImpA:0,alphaMeshB:1,alphaImpB:0,forcedD:-1};
  const update=compile(fn('updateProbes')+'\nreturn updateProbes;',{...helpers,probe,PROBE_GAP:2500});
  const live={probeTrace:[]};
  const record=compile(`return ()=>{${traceCall[0].getText(ast)};};`,{live,probe});
  const draw=compile(`return ()=>({mesh:${meshExprs[0].right.getText(ast)},imp:${impExpr},m:probe.alphaMeshA,i:probe.alphaImpA});`,{probe});
  let holes=0,doubles=0,downHoles=0,upHoles=0;
  for(let trip=0;trip<20;trip++){
    const down=trip%2===0;
    for(let s=0;s<=200;s++){
      probe.forcedD=down?300000-500*s:200000+500*s;
      update(0);record();
      const submitted=draw();mutator(submitted,probe);
      if(!submitted.mesh&&!submitted.imp){holes++;if(down)downHoles++;else upHoles++;}
      if(submitted.mesh&&submitted.imp&&submitted.m>=.99&&submitted.i>=.99)doubles++;
    }
  }
  return {trace:live.probeTrace,observed:{holes,doubles,downHoles,upHoles}};
}
let count=0;
function check(name,ok,detail={}){assert.ok(ok,name+' '+JSON.stringify(detail));count++;console.log('PASS',name,JSON.stringify(detail));}
const base=makeTrace(),b=unit(base.trace);
check('actual R3 scalar/trace conjunction accepts complementary baseline with supplied matching silhouette',b.pass&&b.holes===0&&b.doubles===0&&b.flips===21,b);
check('source draw predicates expose inbound omissions absent from scalar trace',base.observed.downHoles===120&&base.observed.upHoles===0&&b.liveHoles===0,base.observed);
check('trace omits state/visibility',base.trace.length===4020&&base.trace.every(f=>Object.keys(f).sort().join(',')==='d,imp,mesh'));
for(const [name,mutation,key] of [
  ['both submissions hidden',r=>{r.mesh=false;r.imp=false;},'holes'],
  ['both submissions full',r=>{r.mesh=true;r.imp=true;r.m=1;r.i=1;},'doubles']
]){
  const data=makeTrace(mutation),r=unit(data.trace);
  check('unobserved draw mutation: '+name,r.pass&&data.observed[key]===4020,{gate:r,observed:data.observed});
}
const brokenTrace=base.trace.map(f=>({...f}));brokenTrace[0].mesh=0;brokenTrace[0].imp=0;
check('non-complementary live trace DOES fail',!unit(brokenTrace).pass&&unit(brokenTrace).liveHoles===1,unit(brokenTrace));
check('missing low crossing DOES fail',!unit(base.trace.filter(f=>f.d>=226000)).pass);
check('missing high crossing DOES fail',!unit(base.trace.filter(f=>f.d<=234000)).pass);
check('frozen mesh-state control DOES fail flips',!unit(base.trace,0,{handoffNextState:()=>true}).pass,unit(base.trace,0,{handoffNextState:()=>true}));
check('step fade control DOES fail slope',!unit(base.trace,0,{handoffFade:d=>d<230000?0:1}).pass,unit(base.trace,0,{handoffFade:d=>d<230000?0:1}));
// The original M1/M2 only demonstrate counter blindness, not a full R3 pass.
const M1=unit(base.trace,0,{handoffNextState:(d,m)=>m&&d>200000?false:!m&&d<180000?true:m});
const M2=unit(base.trace,0,{handoffFade:()=>0});
check('original M1 rejected elsewhere (flip control)',!M1.pass&&M1.holes===0,M1);
check('original M2 rejected elsewhere (slope control)',!M2.pass&&M2.holes===0,M2);

const W=1280,H=720,cx=W/2,cy=H/2;
const radius=(H/2)/Math.tan(62*Math.PI/360)*Math.tan(Math.asin(1800/232000));
const area=Math.PI*radius*radius;
function image(background=0,dx=0,scale=1,hasDisk=true){
  const out=new Uint8Array(W*H*4);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=(y*W+x)*4;
    out[i]=hasDisk&&Math.hypot(x-cx-dx,y-cy)<=radius*scale?200:background;
    out[i+3]=255;
  }
  return out;
}
function classify(a,b){
  return compile(pixels+`\nreturn {totA,nA,nB,sym,symPct,meshR,impR,pass:symPct<3};`,
    {meshOnly:a,impOnly:b,AB_W:W,AB_H:H,_proj:{px:cx,py:cy},console:{log(){}}});
}
// Independent sanity observer is a proposed fixture check, not production code.
// On-axis binary fixtures only: allow pixel rasterization with a 25% area band.
function sane(r){return r.nA>=area*.75&&r.nA<=area*1.25&&r.nB>=area*.75&&r.nB<=area*1.25&&r.symPct<3;}
const disk=image(),empty=image(0,0,1,false);
let r=classify(disk,disk);
check('isolated equal disks accepted and have plausible geometric area',r.pass&&sane(r),{radius,area,...r});
r=classify(disk,empty);check('isolated missing disk DOES fail',!r.pass&&!sane(r),r);
r=classify(disk,image(0,2));check('isolated shifted disk DOES fail',!r.pass&&!sane(r),r);
r=classify(disk,image(0,0,2));check('isolated doubled radius DOES fail',!r.pass&&!sane(r),r);
r=classify(empty,empty);check('two empty masks correctly rejected (not a tautology)',!r.pass&&r.symPct===100,r);
r=classify(image(8,0,1,false),image(8,0,1,false));check('threshold boundary red=8 rejected',!r.pass,r);
for(const background of [9,90]){
  r=classify(image(background,0,1,false),image(background,0,1,false));
  check(`uniform background ${background} falsely accepted`,r.pass&&r.totA===25600&&!sane(r),r);
}
for(const [name,other] of [
  ['target absent',image(90,0,1,false)],
  ['target shifted 20px',image(90,20)],
  ['target radius doubled',image(90,0,2)]
]){
  r=classify(image(90),other);
  check('bright-background false accept: '+name,r.pass&&r.sym===0&&!sane(r),r);
}
const withDarkHole=image(90,0,1,false);
for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(Math.hypot(x-cx,y-cy)<=radius)withDarkHole[(y*W+x)*4]=0;
r=classify(image(90,0,1,false),withDarkHole);
check('large background also dilutes nonzero target-sized difference below 3%',r.pass&&r.sym>0&&!sane(r),r);
r=classify(disk,disk);
check('full extracted conjunction responds to bad silhouette scalar',unit(base.trace,r.symPct).pass&&!unit(base.trace,100).pass);
const historical=readFileSync(new URL('../../../docs/audit/U01-evidence/gate-run1.log',import.meta.url),'utf8');
const hdr=historical.match(/R3DUMP hdr centre=\(([\d.]+),([\d.]+)\) meshR=([\d.]+) impR=([\d.]+) meshRmax=([\d.]+) impRmax=([\d.]+) totA=(\d+) sym=(\d+)/);
check('historical U01 dump records all 25600 mask pixels, zero difference',!!hdr&&+hdr[7]===25600&&+hdr[8]===0,{header:hdr?.[0],freshGPU:false});
console.log(`PASS ${count}/${count}; source-extracted predicates, synthetic byte inputs, historical pixel evidence only`);