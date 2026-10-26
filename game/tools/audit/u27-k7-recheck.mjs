/** A1 U27b4bbba: independent K7 checks; no production-file edits.
 * Run from game/: node tools/audit/u27-k7-recheck.mjs [--self-test-fail]
 * Synthetic terrain is an in-memory dependency substitution, not game terrain.
 */
import { register } from 'node:module';
import { build } from 'esbuild';
register('./u27-k7-loader.mjs', import.meta.url);
const noop2d = new Proxy({}, {get: (_t,k) => k === 'canvas' ? undefined : () => ({addColorStop(){}})});
globalThis.document = {createElement: () => ({width:0,height:0,style:{},getContext:()=>noop2d,addEventListener(){},removeEventListener(){}})};
const K = await import('../../src/core/physics/astronautKCC.ts');
const TF = await import('../../src/core/terrain/terrainField.ts');
const MC = await import('../../src/play/world/moonConfig.ts');
const {createMoonWorld} = await import('../../src/play/world/moonWorld.ts');
const {createPlayFrame} = await import('../../src/play/frame/playFrame.ts');
const {ThirdPersonCamera} = await import('../../src/play/camera/ThirdPersonCamera.ts');
const {RIG} = await import('../../src/render/MultiCameraRig.tsx');
const T = 1/60, DEG = 180/Math.PI, R = MC.MOON_R;
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const len=a=>Math.hypot(a.x,a.y,a.z);
const unit=a=>{const l=len(a);return {x:a.x/l,y:a.y/l,z:a.z/l}};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const angle=(a,b)=>Math.atan2(len(cross(a,b)),dot(a,b))*DEG;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const qangle=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w)))*DEG;
const quant=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(p*a.length))];
let count=0; const failures=[];
function check(name,value){count++;console.log(`${value?'PASS':'FAIL'} ${name}`);if(!value)failures.push(name)}
const info=(name,value)=>console.log(name+' '+JSON.stringify(value));

// Independent surface prescription h = R*m*longitude; analytic normal from its gradient.
// Source code's normal approximation is excluded from this fixture.
globalThis.__k7Surface={R,m:0};
const synthetic=`
export function terrainHeight(x,y,z){const {R,m}=globalThis.__k7Surface;return R*m*Math.atan2(x,y);}
export function terrainNormalInto(x,y,z,out){
 const {R,m}=globalThis.__k7Surface, h=terrainHeight(x,y,z), r=R+h, s=x*x+y*y;
 const gx=R*m*y/(r*s), gy=-R*m*x/(r*s);
 const a=x-gx,b=y-gy,c=z,l=Math.hypot(a,b,c);
 out.x=a/l;out.y=b/l;out.z=c/l;return out;
}`;
const bundled=await build({entryPoints:['src/core/physics/astronautKCC.ts'],bundle:true,write:false,platform:'node',format:'esm',logLevel:'error',
 plugins:[{name:'analytic-surface',setup(b){
 b.onResolve({filter:/terrainField$/},()=>({path:'surface',namespace:'k7'}));
 b.onLoad({filter:/.*/,namespace:'k7'},()=>({contents:synthetic,loader:'js'}));
 }}]});
const SK=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
function climb(slope,w,speed){
 globalThis.__k7Surface.m=Math.tan(slope/DEG);
 const cfg={...MC.MOON_ASTRONAUT,upBlendWeight:w},k=new SK.AstronautKCC(cfg);
 k.teleportSurface(0,1,0);
 const f=unit({x:k.up.y,y:-k.up.x,z:0}); Object.assign(k.fwd,f);
 const d={x:f.x*speed*T,y:f.y*speed*T,z:0};
 const theta=Math.atan2(d.x,R+cfg.groundClearance+d.y);
 const rise=R*Math.tan(slope/DEG)*theta, horizontal=R*theta;
 const accepted=k._tryMove(d.x,d.y,0,R,R+cfg.groundClearance);
 return {slope,w,speed,accepted,trueSlope:Math.atan2(rise,horizontal)*DEG,
   oracle:rise<=cfg.stepHeight && (rise<=0.001 || rise/horizontal<=Math.tan(50/DEG))};
}
const slopes=[];
for(const slope of [0,40,49,51,55,60]) for(const w of [0,.65]) for(const speed of [1.5,3.2,6.5]) slopes.push(climb(slope,w,speed));
info('slopeMatrix',slopes);
check('36 analytic cases have finite exact prescribed slopes',slopes.length===36 && slopes.every(x=>Math.abs(x.trueSlope-x.slope)<1e-9));
check('shallow slopes accepted by implementation and oracle',slopes.filter(x=>x.slope<50).every(x=>x.accepted&&x.oracle));
check('51/55 degree climbs accepted at default blend at all three speeds',slopes.filter(x=>x.w===.65&&[51,55].includes(x.slope)).every(x=>x.accepted&&!x.oracle));
check('60 degrees blocked; radial-frame control rejects every >50 degree case',slopes.filter(x=>x.slope===60 || (x.w===0&&x.slope>50)).every(x=>!x.accepted&&!x.oracle));
// Exercise integrateTick too, not only a private predicate.
globalThis.__k7Surface.m=Math.tan(55/DEG);
const walk=new SK.AstronautKCC({...MC.MOON_ASTRONAUT,slideAngleDeg:90});
walk.teleportSurface(0,1,0); Object.assign(walk.fwd,unit({x:walk.up.y,y:-walk.up.x,z:0}));
Object.assign(walk._vCtl,{x:walk.fwd.x*3.2,y:walk.fwd.y*3.2,z:0});walk.input.moveF=1;
walk.update(T);info('controlled55DegreeTick',walk.pLocal);
check('full KCC tick climbs 55 degree analytic surface with slide isolated',walk.grounded&&walk.pLocal.x>0.01&&walk.pLocal.y>R+.02);
// Flat-surface landing falsifies the universal "every landing snaps" wording.
globalThis.__k7Surface.m=0;
const flat=new SK.AstronautKCC(MC.MOON_ASTRONAUT);flat.teleportAbs(0,R+1,0,0,-1,0);
let flatSnap=NaN;
for(let i=0;i<180;i++){const up={...flat.up};flat.update(T);if(flat.grounded){flatSnap=angle(up,flat.up);break}}
check('flat radial landing is continuous (not every landing snaps)',Number.isFinite(flatSnap)&&flatSnap<1e-8);

// Real Moon radial drops: independent directions, no random normal oracle.
TF.initTerrainField(MC.MOON_PARAMS);
const sites=[];
for(let i=0;i<512&&sites.length<32;i++){
 const y=1-2*(i+.5)/512, a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y);
 const d={x:r*Math.cos(a),y,z:r*Math.sin(a)},k=new K.AstronautKCC(MC.MOON_ASTRONAUT);
 k.teleportSurface(d.x,d.y,d.z);
 const tilt=angle(k.up,d);
 if(tilt>12&&tilt<25)sites.push(d);
}
function drop(d,w=.65){
 const k=new K.AstronautKCC({...MC.MOON_ASTRONAUT,upBlendWeight:w});
 const rr=R+TF.terrainHeight(d.x,d.y,d.z)+1;
 k.teleportAbs(d.x*rr,d.y*rr,d.z*rr,-d.x,-d.y,-d.z);
 for(let i=0;i<240;i++){
 const up={...k.up};k.update(T);
 if(k.grounded)return {snap:angle(up,k.up),ticks:i+1,nan:k.integrity.nanEvents};
 }return null;
}
const drops=sites.map(d=>drop(d)), radial=sites.map(d=>drop(d,0));
info('realDrops',{n:drops.length,min:Math.min(...drops.map(d=>d?.snap??NaN)),median:quant(drops.map(d=>d.snap),.5),max:Math.max(...drops.map(d=>d.snap)),radialMax:Math.max(...radial.map(d=>d?.snap??NaN)),witness:sites[0]});
check('32 independent real-terrain drops land with no NaNs',drops.length===32&&drops.every(d=>d&&d.nan===0));
check('sloped contacts snap over 10 degrees',drops.every(d=>d.snap>10));
check('zero-blend controls remove the orientation snap',radial.every(d=>d&&d.snap<1e-6));

function fakePool(){return {records:[],acquire:()=>-1,release(){},freeCount:()=>0,inFlightTotal:()=>0,pump(){},disposeAll(){}}}
function world(d=sites[0]){
 const w=createMoonWorld({spawnOverride:d,makePool:fakePool});
 const cam=new ThirdPersonCamera();cam.reset(w.kcc,w.earthDir);
 const st={phase:'PLAYING',dispatch(){},toggleHud(){},setLoad(){},setHud(){}};
 const inp={moveX:0,moveY:0,sprint:false,crouch:false,jumpPressed:false,lookDX:0,lookDY:0,zoomDelta:0,
 toggleCamEdge:false,respawnEdge:false,pauseEdge:false,toggleHudEdge:false,clearEdges(){},exitLock(){}};
 const frame=createPlayFrame(w,cam,{input:inp,store:{getState:()=>st},now:()=>0});
 frame(0);
 return {w,cam,inp,frame};
}
function seedDrop(w){
 const d=unit(w.kcc.pLocal),rr=len(w.kcc.pLocal)+1;
 w.kcc.teleportAbs(d.x*rr,d.y*rr,d.z*rr,-d.x,-d.y,-d.z);
 Object.assign(w.astroState.absPos,w.kcc.absPos);Object.assign(w.astroState.velocity,w.kcc.absVel);
 w.core.tick();
}
const landingWorld=world();
seedDrop(landingWorld.w);
let visible=null;
for(let i=0;i<240;i++){
 const {w,cam,frame}=landingWorld;
 const beforeUp={...w.kcc.up},beforeQ=w.characterRoot.quaternion.clone(),beforeCam={...cam.quatPlanet};
 frame(T);
 if(w.kcc.grounded){
 visible={up:angle(beforeUp,w.kcc.up),root:qangle(beforeQ,w.characterRoot.quaternion),camera:qangle(beforeCam,cam.quatPlanet)};
 break;
 }
}
info('actualPlayFrameLanding',visible);
check('real play root directly transmits landing snap',visible&&visible.root>10&&visible.up>10);
check('real TP camera orientation also jumps at this landing',visible&&visible.camera>5);
landingWorld.w.dispose();

function timing(hz,matched=false){
 const {w,cam,inp,frame}=world({x:0,y:1,z:0});
 // Exact sphere is a fixture control: same genuine terrain service with zero amplitudes.
 TF.initTerrainField({...MC.MOON_PARAMS,continentAmp:0,mountainAmp:0,detailAmp:0});
 w.kcc.teleportSurface(0,1,0);
 Object.assign(w.astroState.absPos,w.kcc.absPos);w.core.tick();cam.reset(w.kcc,{x:1,y:0,z:0});
 if(matched) w.core.advance=()=>{for(let j=0;j<frame.lastTicks;j++)w.core.tick()};
 inp.moveY=1;inp.sprint=true;
 let mismatch=0,stale=0,maxError=0,maxAnchorError=0,maxWriteError=0,maxMatchedError=0,kt=0,ct=0;
 for(let i=0;i<hz*10;i++){
 const before=w.core.stats.tickCount;frame(1/hz);const n=w.core.stats.tickCount-before;
 kt+=frame.lastTicks;ct+=n;if(n!==frame.lastTicks)mismatch++;
 const p=w.kcc.absPos,o=w.core.getOrigin(),trueLocal={x:p.x-o.x,y:p.y-o.y,z:p.z-o.z};
 const error=dist(w.characterRoot.position,trueLocal);
 maxError=Math.max(maxError,error);if(error>.001)stale++;
 if(n===frame.lastTicks)maxMatchedError=Math.max(maxMatchedError,error);
 maxWriteError=Math.max(maxWriteError,dist(w.astroState.absPos,p));
 const root=w.characterRoot.position,off=cam.offsetPlanet;
 maxAnchorError=Math.max(maxAnchorError,dist(RIG.driver,{x:root.x+off.x,y:root.y+off.y,z:root.z+off.z}));
 }
 const result={hz,matched,kt,ct,mismatch,stale,maxError,maxMatchedError,maxAnchorError,maxWriteError};
 w.dispose();return result;
}
const timingResults=[timing(60),timing(120),timing(144),timing(144,true)];
info('actualPlayFrameTiming',timingResults);
check('60/120Hz have no tick disagreement or millimetre stale extract',timingResults.slice(0,2).every(r=>r.mismatch===0&&r.stale===0));
check('144Hz real pipeline disagrees and extracts stale positions',timingResults[2].mismatch>200&&timingResults[2].stale>90&&timingResults[2].maxError>.1);
check('write-through stays current (no duplicate dynamic integration)',timingResults.every(r=>r.maxWriteError===0));
check('matched tick scheduling removes mismatch and large stale errors',timingResults[3].mismatch===0&&timingResults[3].stale===0&&timingResults[3].maxError<.0001);
check('camera driver shares character extract anchor: not a direct KCC anchor',timingResults.every(r=>r.maxAnchorError<1e-10));
check('matching frames differ from f64 truth only by sub-mm narrowing',timingResults.every(r=>r.maxMatchedError<.0001));
if(process.argv.includes('--self-test-fail'))check('deliberate runner failure',false);
console.log(`RESULT ${count-failures.length}/${count}`);
if(failures.length)process.exitCode=1;