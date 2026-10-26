// Read-only K2d recheck. Run from game/: node tools/audit/u27-k2d-recheck.mjs
// Independent sphere path geometry; actual precision/core functions; exact
// extracted dive initializer/observer/predicate; no production source writes.
import { register } from 'node:module'
register('../ts-resolve-loader.mjs', import.meta.url)
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
const FC = await import('../../src/core/physics/flightController.ts')
const TF = await import('../../src/core/terrain/terrainField.ts')
const PM = await import('../../src/core/math/precisionMath.ts')
const { SimulationCore } = await import('../../src/core/simulation/SimulationCore.ts')
const h1f = readFileSync(new URL('../../src/test/Milestone1F_TestHarness.tsx', import.meta.url), 'utf8')
const h1d = readFileSync(new URL('../../src/test/Milestone1D_TestHarness.tsx', import.meta.url), 'utf8')
let count = 0, failed = 0
function check(name, ok, evidence) {
  count++; if (!ok) failed++
  console.log(JSON.stringify({name, ok: !!ok, evidence}))
}
function slice(src, a, b) {
  const i = src.indexOf(a), j = src.indexOf(b, i + a.length)
  if (i < 0 || j < 0) throw Error(`missing source anchor: ${a} / ${b}`)
  return src.slice(i, j)
}
check('shipped R5 anchors', /walkFwd.x \* 2400 \+ SPAWN_DIR.x \* 400/.test(h1f)
  && /pass: rebases >= 2 && localsOk/.test(h1f)
  && /SAT_B.x - p.x/.test(h1f)
  && /spinOmega: 0.0005/.test(h1f), 'tangent target, threshold2, steering, spin')
const R = 1364.5
function point(sd, fwd, h, t, longPath = false, spin = 0.0005) {
  const radius = R + h
  const limit = longPath ? 4000 / radius : Math.atan2(2400, radius + 400)
  const a = Math.min(6.5 * t / radius, limit)
  const x = radius * (sd[0]*Math.cos(a) + fwd[0]*Math.sin(a))
  const y = radius * (sd[1]*Math.cos(a) + fwd[1]*Math.sin(a))
  const z = radius * (sd[2]*Math.cos(a) + fwd[2]*Math.sin(a))
  const w = spin*t
  return { x: x*Math.cos(w)+z*Math.sin(w), y, z: -x*Math.sin(w)+z*Math.cos(w) }
}
function pathTrace(sd, fwd, h, longPath = false, spin = 0.0005, realCore = false) {
  const p0 = point(sd, fwd, h, 0, longPath, spin)
  let o = PM.calculateOrigin(p0), shifts = 0
  const events = []
  let core, entity, start
  if (realCore) {
    core = new SimulationCore(); core.setTimeScale(0)
    entity = core.registerEntity('audit', {absPos: p0, dynamic: false})
    core.setFocusEntity('audit'); core.tick(); start = core.stats.rebaseCount
  }
  for (let n=1; n<=1456; n++) {
    const t=n*0.5, p=point(sd,fwd,h,t,longPath,spin)
    if (Math.max(Math.abs(p.x-o.x),Math.abs(p.y-o.y),Math.abs(p.z-o.z))>1024) {
      o=PM.calculateOrigin(p); shifts++; events.push(t)
    }
    if (realCore) { Object.assign(entity.absPos,p); core.tick() }
  }
  return {shifts,events,coreShifts:realCore?core.stats.rebaseCount-start:null}
}
const hist={}, longHist={}, witnesses=[]
// Deterministic latitude/longitude/heading grid, independent of original LCG.
for (const h of [0,180,360]) {
  hist[h]=[0,0,0,0]; longHist[h]=[0,0,0,0]
  for (const y of [-0.8,-0.4,0,0.4,0.8]) for(let k=0;k<12;k++) for(let j=0;j<8;j++){
    const az=k*Math.PI/6, b=j*Math.PI/4, c=Math.sqrt(1-y*y)
    const sd=[c*Math.cos(az),y,c*Math.sin(az)]
    const e=[-Math.sin(az),0,Math.cos(az)], n=[-y*Math.cos(az),c,-y*Math.sin(az)]
    const fw=e.map((v,i)=>v*Math.cos(b)+n[i]*Math.sin(b))
    const a=pathTrace(sd,fw,h), l=pathTrace(sd,fw,h,true)
    hist[h][Math.min(3,a.shifts)]++;longHist[h][Math.min(3,l.shifts)]++
    if(a.shifts>=2 && witnesses.length<3) witnesses.push({sd,fw,h,...a})
  }
}
console.log(JSON.stringify({sphereGrid:{cases:1440,hist,longHist,witnesses}}))
check('long surface path produces >=2 rebase control',
  Object.values(longHist).some(h=>h[2]+h[3]>0), longHist)
check('short nadir path reduces >=2 frequency',
  Object.keys(hist).every(h=>hist[h][2]+hist[h][3] < longHist[h][2]+longHist[h][3]), hist)
const ref=pathTrace([1,0,0],[0,0,1],180,true,0.0005,true)
check('independent origin count calibrated to actual core',ref.shifts===ref.coreShifts && ref.shifts>=2,ref)
const staticRef=pathTrace([1,0,0],[0,0,1],180,false,0)
check('short unspun path control at most one shift',staticRef.shifts<=1,staticRef)
for (const h of [0,180,360]) {
  const r=R+h, a=Math.atan2(2400,r+400)
  const sat=[r+400,2400], at=[r*Math.cos(a),r*Math.sin(a)]
  const tangent=[-Math.sin(a),Math.cos(a)]
  const projection=(sat[0]-at[0])*tangent[0]+(sat[1]-at[1])*tangent[1]
  check(`target has zero tangential drive at nadir h${h}`,Math.abs(projection)<1e-9,
    {height:h,satRadius:Math.hypot(...sat),surfaceArc:r*a,baseRadiusArc:R*a,projection})
}

// Exact initializer and observer plus extracted T2 predicate. Schedule order
// follows rendered harness: increment requested timer, transition check, update.
TF.initTerrainField(TF.TEST_PLANET)
const obs=slice(h1d,'function diveObserver(', '\n\nfunction startDive(')
const init=slice(h1d,'function startDive(', '\n\nfunction startCruise(')
const expr=slice(h1d,'    const v1000 = script.diveSpeedAt1000;', "\n    results['governor-dive']")
const make = new Function('flight','R','_bootQ','quatFromBasisInto','script',
  transformSync(obs+'\n'+init+'\nfunction verdict(){\n'+expr+'\nreturn pass;\n}',{loader:'ts'}).code+
  '\nreturn {startDive,verdict};')
check('frame scheduling source anchors',
 h1d.includes('const dt = delta > 0.1 ? 0.1 : delta;') &&
 h1d.includes('script.simElapsed += dt * 4;') &&
 h1d.includes('if (flight.telemetry.grounded || script.simElapsed > 45) startCruise();') &&
 h1d.includes('flight.update(dt * timeScale, timeScale > 1 ? 6 : 5);'), 'clamp -> requested-time check -> update')
function dive(fps, tickDeadline=false) {
 const c=new FC.FlightController(FC.EARTHSCALE_FLIGHT)
 const s={diveAlt:new Float64Array(4096),diveSpeed:new Float64Array(4096)}
 const m=make(c,TF.TEST_PLANET.radius,{x:0,y:0,z:0,w:1},FC.quatFromBasisInto,s)
 m.startDive()
 let ticks=0,frames=0
 for(;frames<10000;frames++){
   const dt=Math.min(1/fps,0.1)
   s.simElapsed+=dt*4
   if(c.telemetry.grounded || (tickDeadline?ticks/60:s.simElapsed)>45)break
   ticks+=c.update(dt*4,6)
 }
 s.diveGrounded=c.telemetry.grounded
 const pass=m.verdict()
 const badMin=s.diveMinPostAGL;s.diveMinPostAGL=-1
 const sinkRejected=!m.verdict();s.diveMinPostAGL=badMin
 // Compare complete pre-contact samples, not just scalar verdict.
 const trace=Array.from(s.diveAlt.slice(0,s.diveCount)).map((a,i)=>[a,s.diveSpeed[i]])
 return {fps,tickDeadline,pass,frames,ticks,physicsTime:ticks/60,requested:s.simElapsed,
   grounded:c.telemetry.grounded,altAGL:c.telemetry.altAGL,v1000:s.diveSpeedAt1000,sinkRejected,trace}
}
const runs=[dive(60),dive(30),dive(15),dive(10),dive(15,true),dive(10,true)]
for(const {trace,...r} of runs)console.log(JSON.stringify({dive:r,traceSamples:trace.length}))
check('60/30 fps unchanged T2 pass',runs[0].pass&&runs[1].pass)
check('15/10 fps requested deadline fails airborne',runs.slice(2,4).every(r=>!r.pass&&!r.grounded))
check('tick-time deadline controls restore T2',runs.slice(4).every(r=>r.pass&&r.sinkRejected))
check('all grounded runs identical precontact trajectory',
 [runs[1],...runs.slice(4)].every(r=>JSON.stringify(r.trace)===JSON.stringify(runs[0].trace)))
check('timed-out trajectory is identical baseline prefix',
 runs.slice(2,4).every(r=>JSON.stringify(r.trace)===JSON.stringify(runs[0].trace.slice(0,r.trace.length))))
if(process.argv.includes('--self-test-failure')) check('deliberate failure propagation',false)
console.log(JSON.stringify({checks:count,passed:count-failed,failed}))
process.exit(failed?1:0)