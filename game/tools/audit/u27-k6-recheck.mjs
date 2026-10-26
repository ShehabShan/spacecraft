// A1 K6: independent axes, force isolation, continuum drag and pre-resolution
// contact observations. No source edit. Run: node tools/audit/u27-k6-recheck.mjs
import {register} from 'node:module'
import fs from 'node:fs'
register('../ts-resolve-loader.mjs',import.meta.url)
const FC=await import('../../src/core/physics/flightController.ts')
const TF=await import('../../src/core/terrain/terrainField.ts')
const ATM=await import('../../src/core/physics/atmosphere.ts')
const B=FC.EARTHSCALE_FLIGHT, dt=1/60
const checks=[]
function check(name,pass,evidence){checks.push({name,pass:!!pass,evidence});console.log(JSON.stringify(checks.at(-1)))}
function log(name,data){console.log(JSON.stringify({measurement:name,...data}))}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0)
function rot(q,v){
  // Independent quaternion multiplication, not the controller's basis helper.
  const mul=(a,b)=>[
    a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]
  const a=[q.x,q.y,q.z,q.w]
  return mul(mul(a,[...v,0]),[-a[0],-a[1],-a[2],a[3]]).slice(0,3)
}
const id={x:0,y:0,z:0,w:1}
const vac={...B,planetMu:0,atmosphere:{...B.atmosphere,rho0:0}}
TF.initTerrainField(TF.TEST_PLANET)
check('oracle right-hand rotation calibration',Math.abs(rot({x:0,y:0,z:Math.SQRT1_2,w:Math.SQRT1_2},[1,0,0])[1]-1)<1e-12,null)
for(const angle of [0,0.7]){
  const q={x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}
  const right=rot(q,[0,0,1]),up=rot(q,[0,1,0])
  for(const axis of ['yaw','roll','pitch']){
    const values=[]
    for(const sign of [-1,0,1]){
      const c=new FC.FlightController(vac)
      c.teleport(0,1e6,0,0,0,0,q);c.input[axis]=sign
      for(let i=0;i<30;i++)c.integrateFlight(dt)
      values.push(dot(rot(c.quat,axis==='roll'?[0,1,0]:[1,0,0]),axis==='pitch'?up:right))
    }
    log('control-sign',{angle,axis,values})
    check(`${axis} direction and opposite/neutral controls angle${angle}`,
      Math.abs(values[1])<1e-10 && (axis==='pitch'?values[2]>0.1&&values[0]<-0.1:values[2]<-0.1&&values[0]>0.1),values)
  }
}
function impulse(v,q,alt=1e6) {
  const c=new FC.FlightController(vac)
  c.teleport(0,B.planetRadius+alt,0,v,0,0,q);c.input.throttle=1
  c.integrateFlight(dt)
  return {a:(c.vel.x-v)/dt,lateral:c.vel.z/dt,thrust:c.telemetry.thrustAccel}
}
const retro={x:0,y:1,z:0,w:0}
const sideways={x:0,y:-Math.SQRT1_2,z:0,w:Math.SQRT1_2}
const forces=[1880,1940,1999,2000].map(v=>({v,retro:impulse(v,retro),forward:impulse(v,id),lateral:impulse(v,sideways)}))
log('force-isolation',{forces})
check('below-band full retro braking',Math.abs(forces[0].retro.a+45)<1e-9,forces[0])
check('band fades both forward and retro',Math.abs(forces[1].retro.a+22.5)<1e-9&&Math.abs(forces[1].forward.a-22.5)<1e-9,forces[1])
check('at cap retro and lateral authority vanish',forces[3].retro.a===0&&forces[3].lateral.lateral===0,forces[3])
const braking=new FC.FlightController(vac)
braking.teleport(0,1e6,0,1999,0,0,retro);braking.input.throttle=1
for(let i=0;i<3600;i++)braking.integrateFlight(dt)
check('1999 retro remains above1880 after60s',braking.vel.x>1880,braking.vel.x)
check('cap independent of altitude with vacuum config',
  impulse(1940,retro,2000).a===impulse(1940,retro,20000).a,null)

// Controlled pure quadratic radial dive: closed-form column integral oracle.
TF.initTerrainField({...TF.TEST_PLANET,continentAmp:0,mountainAmp:0,detailAmp:0})
for(const rho0 of [0,0.02,1.225]){
  const cfg={...vac,atmosphere:{...B.atmosphere,rho0},aero:{...B.aero,betaL:0,clAlpha:0}}
  const h0=8000,target=1000,v0=2000,H=1200,beta=0.0032
  const expected=v0*Math.exp(-beta*rho0*H*(Math.exp(-target/H)-Math.exp(-h0/H)))
  const c=new FC.FlightController(cfg)
  c.teleport(0,5000+h0,0,0,-v0,0,id)
  const step=1/240;let steps=0
  while(c.pos.y>5000+target && steps++<120000)c.integrateFlight(step)
  // Evaluate at the actual crossed altitude, avoiding endpoint interpolation bias.
  const h=c.pos.y-5000
  const truth=v0*Math.exp(-beta*rho0*H*(Math.exp(-h/H)-Math.exp(-h0/H)))
  const speed=-c.vel.y,err=Math.abs(speed/truth-1)
  log('quadratic-column',{rho0,h,speed,truth,expectedAt1000:expected,relativeError:err,steps})
  check(`quadratic column matches independent integral rho${rho0}`,h<=target&&h>980&&err<0.01,{speed,truth,err})
}

// Contact wrapper captures the actual post-force velocity before resolution.
// The original probes reported start-of-tick speed instead.
function contactRun(cfg,alt,speed,tangent=0,maxTicks=6000){
  const c=new FC.FlightController(cfg),h=TF.terrainHeight(0,1,0)
  c.teleport(0,cfg.planetRadius+h+alt,0,tangent,-speed,0,id)
  let first=null,startSpeed=0
  const original=c._resolveContact
  c._resolveContact=function(...args){
    if(first===null)first={preSpeed:Math.hypot(this.vel.x,this.vel.y,this.vel.z),inward:-this.vel.y,startSpeed}
    return original.apply(this,args)
  }
  let tick=0
  while(first===null&&tick<maxTicks){
    startSpeed=Math.hypot(c.vel.x,c.vel.y,c.vel.z)
    c.integrateFlight(dt);tick++
  }
  return {first,tick,seconds:tick*dt,mode:c.telemetry.mode,postSpeed:Math.hypot(c.vel.x,c.vel.y,c.vel.z),alt:c.telemetry.altMSL,nan:c.integrity.nanEvents}
}
const impacts=[5,60,140].map(v=>({v,...contactRun(vac,40,v)}))
log('radial-contacts',{impacts})
check('all three radial speeds are erased and LANDED',impacts.every(x=>x.first&&Math.abs(x.first.preSpeed-x.v)<1e-9&&x.mode==='LANDED'&&x.postSpeed===0&&x.nan===0),impacts)
const oblique=contactRun(vac,40,140,20)
log('oblique-control',oblique)
check('not every collision immediately LANDED',oblique.first!==null&&oblique.mode!=='LANDED'&&oblique.postSpeed>3.5,oblique)
// Restore the original test terrain for density-only what-ifs.
TF.initTerrainField(TF.TEST_PLANET)
const cases=[]
for(const rho0 of [0.00008,0.02,1.225,5.3,65]){
  const cfg={...B,atmosphere:{...B.atmosphere,rho0}}
  // Original starts 8000 above MSL, not 8000 above terrain.
  cases.push({rho0,...contactRun(cfg,8000-TF.terrainHeight(0,1,0),2000)})
}
log('density-only-not-real-planets',{cases})
check('thin profiles arrive above1800',cases.slice(0,2).every(c=>c.first?.preSpeed>1800),cases.slice(0,2))
check('denser profiles slow below100',cases.slice(2,4).every(c=>c.first?.preSpeed<100),cases.slice(2,4))
check('rho65 no contact within100s only',cases[4].first===null&&cases[4].seconds===100,cases[4])
const profiles=Object.entries(ATM).filter(([,v])=>v&&typeof v==='object'&&'rho0'in v).map(([k])=>k)
check('one exported default profile',profiles.length===1&&profiles[0]==='EARTHSCALE_ATMOSPHERE',profiles)
const vacuumShip=new FC.FlightController(vac)
vacuumShip.teleport(0,15000,0,100,0,0,id);vacuumShip.integrateFlight(dt)
check('caller can configure actual vacuum',vacuumShip.telemetry.rho===0&&vacuumShip.vel.x===100,vacuumShip.telemetry.rho)
const fcText=fs.readFileSync(new URL('../../src/core/physics/flightController.ts',import.meta.url),'utf8')
check('config accepts profile without catalog selection',
  fcText.includes('atmosphere: AtmosphereProfile')&&!fcText.includes('celestialData')&&!fcText.includes('CELESTIAL_CONFIGS'),null)
if(process.argv.includes('--self-test-fail'))check('deliberate self-test',false,null)
const fail=checks.filter(c=>!c.pass).length
console.log(`CHECKS ${checks.length-fail}/${checks.length}; FAILURES ${fail}`)
process.exitCode=fail?1:0