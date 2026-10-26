// K3 targeted recheck. No source mutation; independent matrices/finite differences,
// equivalent-phase controls and body-fixed clearance. Run from game/ with Node.
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
register('../ts-resolve-loader.mjs', import.meta.url);
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts');
const { KeplerRail } = await import('../../src/core/orbit/KeplerRail.ts');
const { CELESTIAL_CONFIGS: configs } = await import('../../src/core/orbit/celestialData.ts');
const { AstronautKCC, EARTHSCALE_ASTRONAUT: K } = await import('../../src/core/physics/astronautKCC.ts');
const { FlightController, EARTHSCALE_FLIGHT: F } = await import('../../src/core/physics/flightController.ts');
const TF = await import('../../src/core/terrain/terrainField.ts');
const dt = 1/60, tau = 2*Math.PI;
let total=0, failed=0;
function check(name, condition, evidence) {
  total++; if (!condition) failed++;
  console.log(JSON.stringify({name,pass:!!condition,evidence}));
}
const len = p => Math.hypot(p.x,p.y,p.z);
const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const scale = (p,s) => ({x:p.x*s,y:p.y*s,z:p.z*s});
const unit = p => scale(p,1/len(p));
const ry = (t,p) => ({x:Math.cos(t)*p.x+Math.sin(t)*p.z,y:p.y,z:-Math.sin(t)*p.x+Math.cos(t)*p.z});
const angle = (a,b) => Math.atan2(Math.hypot(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),a.x*b.x+a.y*b.y+a.z*b.z)*180/Math.PI;
const keys = o => Object.keys(o).filter(k=>/spin|pole|meridian|orientation|quaternion/i.test(k));
const rail = new KeplerRail(configs);
rail.evaluate(0);
check('U12 no rotation fields in actual public rail/config states',
  rail.states.length===17 && rail.states.every(s=>keys(s).length===0 && keys(s.config).length===0),
  rail.states.map(s=>({id:s.config.id,keys:Object.keys(s)})));
const oldEarth={...rail.getState('earth').absPos};
rail.evaluate(10);
check('U12 responsive orbital translation control',len(sub(rail.getState('earth').absPos,oldEarth))>1000,len(sub(rail.getState('earth').absPos,oldEarth)));
check('oracle rotation/inverse control',len(sub(ry(-.7,ry(.7,{x:4,y:3,z:8})),{x:4,y:3,z:8}))<1e-12);

// Circular catalog derivative uses raw a,n,M0 (not rail output orbitalSpeed).
function snapshots(t){rail.evaluate(t);return Object.fromEntries(rail.states.map(s=>[s.config.id,{...s.absPos}]));}
const eps=.001, minus=snapshots(-30*eps), plus=snapshots(30*eps), nominal=[];
for(const c of configs.filter(c=>c.orbit)){
 const o=c.orbit, v=scale(sub(plus[c.id],minus[c.id]),1/(2*eps));
 const pv=c.parentId===null?{x:0,y:0,z:0}:scale(sub(plus[c.parentId],minus[c.parentId]),1/(2*eps));
 const expected=30*o.a*Math.abs(o.n);
 nominal.push({id:c.id,parent:c.parentId,parentRelative30:expected,sunFrame30:len(v),relError:Math.abs(len(sub(v,pv))-expected)/expected});
}
console.log('U10_SPEEDS '+JSON.stringify(nominal));
check('U10 independent finite differences agree with parent-relative a*n*30',nominal.every(v=>v.relError<1e-6));
check('U10 Earth/Moon exceed 2000 in stated 30x parent frame',
 nominal.find(v=>v.id==='earth').parentRelative30>12000 && nominal.find(v=>v.id==='moon').parentRelative30>2300);
check('U10 counterexamples to every moon parent-relative exceeds 2000',
 nominal.find(v=>v.id==='phobos').parentRelative30<2000 && nominal.find(v=>v.id==='charon').parentRelative30<2000);
check('U10 all 16 absolute derivatives at epoch exceed 2000',nominal.length===16 && nominal.every(v=>v.sunFrame30>2000));
rail.evaluate(0);
check('U10 orbitalSpeed is unscaled parent-relative, not world derivative',
 Math.abs(rail.getState('earth').orbitalSpeed*30-nominal.find(v=>v.id==='earth').parentRelative30)<1e-7);

// General core contract, not an assertion that play uses heliocentric entities.
for(const rate of [0,30]){
 const core=new SimulationCore(), initial={...core.getCelestialState('moon').absPos};
 core.setTimeScale(rate);
 const offset={x:1365,y:0,z:0};
 const e=core.registerEntity('surface-marker',{absPos:add(initial,offset),dynamic:false});
 for(let i=0;i<60;i++)core.tick();
 const final=core.getCelestialState('moon').absPos;
 const error=len(sub(e.absPos,add(final,offset)));
 check(`U13 core marker has no automatic parenting scale${rate}`,rate===0?error<1e-10:error>1000,{error,fields:Object.keys(e)});
 if(rate===30){
  const at0=snapshots(0), at30=snapshots(30);
  const staleError=len(sub(sub(at0.earth,at0.moon),sub(at30.earth,at30.moon)));
  check('U13 cached Earth-Moon vector diverges after unfreeze',staleError>1000,{staleEarthVectorError:staleError});
 }
}
const world=readFileSync('src/play/world/moonWorld.ts','utf8'),sky=readFileSync('src/play/world/skyState.ts','utf8');
check('U13 play already uses ad-hoc moon-centred observer translation',
 world.includes('moonAbs: moonState.absPos') && sky.includes('c.moonAbs.x + o.x + px'));
check('U13 freeze and zero-spin remain explicit current play defaults',
 world.includes('core.setTimeScale(0)') && readFileSync('src/play/world/moonConfig.ts','utf8').includes('MOON_SPIN_OMEGA = 0'));

// Equivalent ±2π phases describe exactly the same physical fixture.
TF.initTerrainField(TF.TEST_PLANET);
const w=K.spinOmega, lo=-w*dt/2, hi=tau+lo;
let mismatches=0, minMirrorAGL=Infinity, minPhysicalPathAGL=Infinity, worstPositionDifference=0, sample=null;
for(let i=0;i<128;i++){
 const y=1-2*(i+.5)/128, a=i*Math.PI*(3-Math.sqrt(5));
 const d={x:Math.sqrt(1-y*y)*Math.cos(a),y,z:Math.sqrt(1-y*y)*Math.sin(a)};
 const p=ry(lo,scale(d,K.planetRadius+TF.terrainHeight(d.x,d.y,d.z)+5));
 const v={x:w*p.z,y:0,z:-w*p.x};
 function tickAt(phase){
  const k=new AstronautKCC(K); k._theta=phase;
  k.teleportAbs(p.x,p.y,p.z,v.x,v.y,v.z);k.integrateTick(dt);return k;
 }
 const k0=tickAt(lo),k1=tickAt(hi);
 if(k0._grounded!==k1._grounded){
  mismatches++;
  const b=unit(ry(-k0.spinPhase,k0.absPos));
  const agl=len(k0.absPos)-K.planetRadius-TF.terrainHeight(b.x,b.y,b.z);
  minMirrorAGL=Math.min(minMirrorAGL,agl);
  // Independent true-phase samples on the pre-contact drift segment.
  // Both equivalent-phase instances start with identical p,v and gravity.
  for(let j=0;j<=64;j++){
   const s=j/64, point=add(p,scale(sub(k0.absPos,p),s));
   const local=unit(ry(-(lo+w*dt*s),point));
   minPhysicalPathAGL=Math.min(minPhysicalPathAGL,len(point)-K.planetRadius-TF.terrainHeight(local.x,local.y,local.z));
  }
  const gap=len(sub(k0.absPos,k1.absPos));worstPositionDifference=Math.max(worstPositionDifference,gap);
  if(!sample)sample={i,wrappedLanded:k1._grounded,mirrorLanded:k0._grounded,mirrorAGL:agl,positionDifference:gap};
 }
}
check('U16 equivalent phases produce different landings',mismatches>20,{mismatches,total:128,minMirrorAGL,worstPositionDifference,sample});
check('U16 non-wrapping counterparts remain above terrain',minMirrorAGL>4);
check('U16 independent true-phase sampled path remains clear',minPhysicalPathAGL>4,{minPhysicalPathAGL,samplesPerMismatch:65});
const phaseStep=((hi+w*dt)%tau)-hi;
check('U16 phase delta differs from physical increment by -2pi',Math.abs(phaseStep-w*dt+tau)<1e-12,{phaseStep,physical:w*dt});
check('U16 phase-equivalence oracle control',len(sub(ry(lo,{x:5,y:7,z:3}),ry(hi,{x:5,y:7,z:3})))<1e-12);

// One zero-G tick at a constant nonzero phase isolates coordinate mismatch,
// independent of terrain, accumulated gravity and moving-target effects.
for(const phase of [0,Math.PI/2,-Math.PI/2]){
 const cfg={...K,spinOmega:0}, d=unit({x:1,y:.2,z:.1});
 const p=ry(phase,scale(d,40000)), k=new AstronautKCC(cfg);
 k._theta=phase;k.teleportAbs(p.x,p.y,p.z,0,0,0);
 const before={...k.up};k.integrateTick(dt);
 const err=angle(k.up,d), worldDrift=angle(before,unit(p));
 check(`U17 constant-phase one-tick body-up mismatch ${phase}`,phase===0?err<1e-8:err>.3,{err,worldDrift,mode:k.mode});
 const b=1-Math.exp(-dt/cfg.airborneUpTau);
 const worldBlend=unit(add(scale(before,1-b),scale(unit(p),b)));
 check(`U17 measured blend matches world-radial fault ${phase}`,len(sub(k.up,worldBlend))<1e-12);
}
{
 const k=new AstronautKCC({...K,spinOmega:0});k._theta=Math.PI/2;
 k.teleportAbs(0,40000,0,0,0,0);k.integrateTick(dt);
 check('U17 spin-axis fixed-vector control',angle(k.up,{x:0,y:1,z:0})<1e-8);
}

// U18 actual final contact state vs independently rotated BODY terrain.
// World displacement by itself is not proof of slipping on a rotating body.
function parked(omega,flat){
 TF.initTerrainField(flat?{...TF.TEST_PLANET,continentAmp:0,mountainAmp:0,detailAmp:0}:TF.TEST_PLANET);
 const h=TF.terrainHeight(1,0,0),r=F.planetRadius+h+3.2;
 const ship=new FlightController({...F,planetSpin:omega});
 ship.teleport(r,0,0,0,0,-omega*r,{x:0,y:0,z:-Math.SQRT1_2,w:Math.SQRT1_2});
 let contacts=0,maxContactHeightMismatch=0;
 for(let i=1;i<=600;i++){
  ship.integrateFlight(dt);
  if(ship.telemetry.grounded){
   contacts++;
   const direction=unit(ship.pos),bodyDirection=ry(-omega*i*dt,direction);
   const mismatch=TF.terrainHeight(direction.x,direction.y,direction.z)-TF.terrainHeight(bodyDirection.x,bodyDirection.y,bodyDirection.z);
   maxContactHeightMismatch=Math.max(maxContactHeightMismatch,Math.abs(mismatch));
  }
 }
 const direction=unit(ship.pos), bodyDirection=ry(-omega*10,direction);
 return {contacts,maxContactHeightMismatch,worldArc:angle(direction,{x:1,y:0,z:0})*Math.PI/180*F.planetRadius,
   bodyArc:angle(bodyDirection,{x:1,y:0,z:0})*Math.PI/180*F.planetRadius,airspeed:ship.telemetry.airspeed};
}
const rotating=parked(.0104,false),still=parked(0,false),sphere=parked(.0104,true);
check('U18 rotating nonuniform terrain disagrees at real contact ticks',rotating.contacts>0 && rotating.maxContactHeightMismatch>1,rotating);
check('U18 zero-spin control matches terrain frame',still.maxContactHeightMismatch<1e-10 && still.worldArc<.01,still);
check('U18 spherical height is rotationally invariant control',sphere.contacts>0 && sphere.maxContactHeightMismatch<1e-10,sphere);
check('U26 synthesis supported by missing body rotation/entity parent plus frame witnesses',mismatches>20 && rotating.maxContactHeightMismatch>1);
if(process.argv.includes('--self-test-fail'))check('deliberate assertion failure',false);
console.log(`SUMMARY ${total-failed}/${total}`);
process.exitCode=failed?1:0;