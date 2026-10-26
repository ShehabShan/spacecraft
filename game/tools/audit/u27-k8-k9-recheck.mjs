/**
 * U27b4bbbb independent recheck; run from game/.
 * Uses real submitted matrices/attributes and live rig transforms, not old probe FK.
 * Assertions describe both defects and responsive controls; --self-test-failure
 * deliberately adds a failing assertion to verify nonzero process status.
 */
import { build } from 'esbuild';
import * as T from 'three';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const game = process.cwd();
const output = path.join(game, 'node_modules/.cache/u27-k8-k9.bundle.mjs');
await build({
  stdin: {contents: `
    export {SkyImpostorPool} from './render/SkyImpostorPool';
    export {ProceduralAnimator,gaitBeta} from './play/character/ProceduralAnimator';
    export {createTelemetry,sampleTelemetry} from './play/character/CharacterTelemetry';
    export {initTerrainField,terrainNormalInto} from './core/terrain/terrainField';
    export {MOON_PARAMS} from './play/world/moonConfig';
  `, resolveDir: path.join(game, 'src'), loader: 'ts'},
  bundle: true, platform: 'node', format: 'esm', outfile: output, jsx: 'automatic',
  external: ['three','react','react-dom','@react-three/fiber','zustand'], logLevel: 'error'
});
const M = await import(pathToFileURL(output).href);
const rad = x => x*Math.PI/180, deg = x => x*180/Math.PI;
const dir = b => new T.Vector3(Math.sin(rad(b)),0,-Math.cos(rad(b)));
const clamp = x => Math.max(-1,Math.min(1,x));
const angle = (a,b) => Math.atan2(new T.Vector3().crossVectors(a,b).length(),a.dot(b));
let total=0, passed=0;
function check(name,condition,data) {
  total++; if(condition) passed++;
  console.log(JSON.stringify({name,pass:!!condition,...(data===undefined?{}:{data})}));
}
function poolFor(bodies) {
  const p = new M.SkyImpostorPool(0);
  bodies.forEach((b,i) => {
    const d=dir(b.beta);
    p.setBody(i,String(i),1,d.x,d.y,d.z,rad(b.theta),b.dist,1,1,1,1,true);
  });
  p.update(0,0,0,0,0,0,1,0,0,1);
  return p;
}
function matrix(p,rank) { const m=new T.Matrix4(); p.mesh.getMatrixAt(rank,m); return m; }
function dispose(p) {p.mesh.geometry.dispose(); p.material.dispose();p.stars.geometry.dispose();p.stars.material.dispose();}
function rayPlane(p,rank,ray,mat=matrix(p,rank)) {
  const inv=mat.clone().invert();
  const eye=new T.Vector3().applyMatrix4(inv), step=ray.clone().transformDirection(inv);
  const hit=eye.clone().addScaledVector(step,-eye.z/step.z);
  const attr=p.mesh.geometry.getAttribute('aDisk');
  const coverageCoordinate=Math.hypot(hit.x,hit.y)*attr.getX(rank)/attr.getY(rank);
  const world=hit.clone().applyMatrix4(mat);
  return {inside:coverageCoordinate<0.99,coverageCoordinate,viewDepth:-world.z,rayDistance:world.dot(ray)};
}
function sphereHit(b,ray) {
  const c=dir(b.beta).multiplyScalar(b.dist), radius=b.dist*Math.sin(rad(b.theta));
  const projection=c.dot(ray), discriminant=projection*projection-c.lengthSq()+radius*radius;
  return discriminant<0 ? Infinity : projection-Math.sqrt(discriminant);
}
function faceDirection(m,beta) {
  const c=new T.Vector3(), q=new T.Quaternion(), s=new T.Vector3();
  m.decompose(c,q,s); q.setFromUnitVectors(new T.Vector3(0,0,1),dir(beta).negate());
  return new T.Matrix4().compose(c,q,s);
}
// U15-3: tangent cone from sphere quadratic, actual shader half-coverage boundary.
for(const theta of [1,3.68,7.39]) for(const beta of [0,30,45]) {
  const p=poolFor([{beta,theta,dist:100000}]), m=matrix(p,0), d=dir(beta);
  const a=p.mesh.geometry.getAttribute('aDisk'), radius=a.getY(0)/a.getX(0);
  let worst=0, corrected=0, xmin=Infinity,xmax=-Infinity;
  const aligned=faceDirection(m,beta);
  for(let i=0;i<720;i++) {
    const phi=2*Math.PI*i/720;
    const local=new T.Vector3(radius*Math.cos(phi),radius*Math.sin(phi),0);
    const r=local.clone().applyMatrix4(m).normalize();
    worst=Math.max(worst,Math.abs(angle(r,d)-rad(theta)));
    corrected=Math.max(corrected,Math.abs(angle(local.clone().applyMatrix4(aligned).normalize(),d)-rad(theta)));
    const x=r.x/-r.z; xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);
  }
  const referenceWidth=Math.tan(rad(beta+theta))-Math.tan(rad(beta-theta));
  const ratio=(xmax-xmin)/referenceWidth;
  check(`U15-3 real matrix cone theta${theta} beta${beta}`,beta===0?worst<1e-6:worst>rad(theta)*0.1,
    {maxAngularErrorDeg:deg(worst),screenWidthRatio:ratio});
  check(`U15-3 line-of-sight orientation control theta${theta} beta${beta}`,corrected<1e-6,{maxAngularErrorDeg:deg(corrected)});
  dispose(p);
}
// U15-4: same ray hits both actual disks; real disjoint spheres unequivocally near-first.
for(const [bn,bf,inverted] of [[30,31,true],[20,21,true],[0,1,false],[30,29,false]]) {
  const near={beta:bn,theta:3.68,dist:100000},far={beta:bf,theta:1,dist:300000};
  const p=poolFor([near,far]), ray=dir((bn+bf)/2);
  const f=rayPlane(p,0,ray),n=rayPlane(p,1,ray);
  const realNear=sphereHit(near,ray),realFar=sphereHit(far,ray);
  check(`U15-4 shared ray ${bn}/${bf}`,n.inside&&f.inside&&Number.isFinite(realNear)&&Number.isFinite(realFar)&&realNear<realFar,
    {near:n,far:f,realNear,realFar});
  check(`U15-4 depth result ${bn}/${bf}`,(f.viewDepth<n.viewDepth)===inverted&&p.material.depthTest&&p.material.depthWrite);
  dispose(p);
}
{
  const near={beta:30,theta:8,dist:100000},far={beta:36,theta:1,dist:300000};
  const p=poolFor([near,far]),ray=dir(36);
  const n=rayPlane(p,1,ray,faceDirection(matrix(p,1),30)),f=rayPlane(p,0,ray,faceDirection(matrix(p,0),36));
  check('U15-4 orientation-only control is insufficient for large disk',n.inside&&f.inside&&f.rayDistance<n.rayDistance&&sphereHit(near,ray)<sphereHit(far,ray),{near:n,far:f});
  check('U15-4 small half-angle does not cross rank at its limb',9555/Math.cos(rad(3.68))<9600,
    {criticalHalfAngleDeg:deg(Math.acos(9555/9600)),smallLimbDistance:9555/Math.cos(rad(3.68))});
  dispose(p);
}
// U24-1: real animator update + actual mesh bottom vertices. Root moves at supplied speed
// on an ideal flat surface; this isolates pose correctness, not KCC/terrain contact.
function actor() {
  const an=new M.ProceduralAnimator(),root=new T.Group();root.position.y=0.02;root.add(an.root);
  return {an,root};
}
function sole(an,side) {
  const mesh=an.rig.joints['foot'+side].children.find(x=>x.isMesh);
  const pos=mesh.geometry.getAttribute('position'),pts=[];
  for(let i=0;i<pos.count;i++) if(pos.getY(i)<-0.49)
    pts.push(new T.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
  return {minY:Math.min(...pts.map(p=>p.y)),maxY:Math.max(...pts.map(p=>p.y)),
    centre:pts.reduce((a,b)=>a.add(b),new T.Vector3()).multiplyScalar(1/pts.length),
    normal:new T.Vector3(0,1,0).transformDirection(mesh.matrixWorld)};
}
for(const speed of [0,1,3.2,5,6.5]) {
  const {an,root}=actor(),t=M.createTelemetry();t.speed=speed;t.inputMag=speed?1:0;
  const dt=1/240;
  let low=Infinity,high=-Infinity,count=0,slide=0,shiftedLow=Infinity;
  const start={},last={};
  for(let i=0;i<1440;i++) {
    an.update(t,dt);root.position.x+=speed*dt;root.updateMatrixWorld(true);
    if(i<480)continue;
    for(const [side,offset] of [['R',0],['L',0.5]]) {
      const phase=(an.phase+offset)%1;
      const stance=speed===0||phase<M.gaitBeta(speed);
      if(!stance){delete start[side];delete last[side];continue;}
      const ft=sole(an,side);low=Math.min(low,ft.minY);high=Math.max(high,ft.maxY);count++;
      if(start[side]===undefined||phase<(last[side]??0))start[side]=ft.centre.x;
      slide=Math.max(slide,Math.abs(ft.centre.x-start[side]));last[side]=phase;
      // Vertical-only positive control leaves horizontal slide unchanged.
      root.position.y+=0.25;root.updateMatrixWorld(true);
      const shifted=sole(an,side);
      if(Math.abs(shifted.centre.x-ft.centre.x)>1e-9)throw new Error('vertical-control changed horizontal position');
      shiftedLow=Math.min(shiftedLow,shifted.minY);
      root.position.y-=0.25;root.updateMatrixWorld(true);
    }
  }
  check(`U24-1 live rig speed${speed}`,speed===0?Math.abs(low)<1e-6&&Math.abs(high)<1e-6:
    (speed===1?low<-.01:high>(speed===3.2?.03:speed===5?.08:.13)),
    {state:an.stateName,soleMinM:low,soleMaxM:high,horizontalStanceDriftM:slide,samples:count});
  check(`U24-1 horizontal-only gate blind speed${speed}`,slide<.01&&shiftedLow>.2,
    {offsetControlMinM:shiftedLow});
  an.dispose();
}
// U24-3: actual terrain normal -> sampleTelemetry -> live animator -> world sole normal.
// Rotate KCC frame away from a real field normal by known angles; no fabricated
// normal injected into sampler. Tilt expressed relative to kcc.up, not world radial.
M.initTerrainField(M.MOON_PARAMS);
const raw={x:0,y:0,z:0};M.terrainNormalInto(0,1,0,raw);
const normal=new T.Vector3(raw.x,raw.y,raw.z).normalize();
const f0=new T.Vector3(1,0,0).addScaledVector(normal,-normal.x).normalize();
const r0=new T.Vector3().crossVectors(f0,normal).normalize();
for(const kind of ['side','forward']) for(const tilt of [-10,0,10]) {
  const axis=kind==='side'?f0:r0;
  const rot=new T.Quaternion().setFromAxisAngle(axis,rad(tilt));
  const up=normal.clone().applyQuaternion(rot),forward=f0.clone().applyQuaternion(rot),right=new T.Vector3().crossVectors(forward,up).normalize();
  const kcc={grounded:true,telemetry:{relSpeed:0,slopeDeg:Math.abs(tilt),slideSpeed:0},pLocal:{x:0,y:M.MOON_PARAMS.radius,z:0},
    up, fwd:forward,input:{sprint:false},integrity:{lastLandingRelSpeed:0}};
  const ctrl={inputMag:0,jumpedThisFrame:false,landedThisFrame:false,spinOmega:0};
  const t=M.createTelemetry();M.sampleTelemetry(kcc,ctrl,{crouch:false},1/60,t);
  const {an,root}=actor();root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(forward,up,right));
  for(let i=0;i<120;i++)an.update(t,1/60);
  root.updateMatrixWorld(true);
  const errors=['R','L'].map(s=>deg(angle(sole(an,s).normal,normal)));
  check(`U24-3 actual normal chain ${kind}${tilt}`,kind==='side'&&tilt!==0?Math.min(...errors)>19:Math.max(...errors)<.01,
    {telemetryFwd:t.slopeFwdDeg,telemetrySide:t.slopeSideDeg,errorsDeg:errors});
  if(kind==='side'&&tilt!==0) {
    t.slopeSideDeg=-t.slopeSideDeg;
    for(let i=0;i<120;i++)an.update(t,1/60);
    root.updateMatrixWorld(true);
    const corrected=['R','L'].map(s=>deg(angle(sole(an,s).normal,normal)));
    // Idle knee bend conjugates the ankle's roll by the shank pitch.
    // Geometric reference from leg length/idle drop, not a fitted error bound.
    const h=Math.acos((0.8-0.02)/0.8), a=rad(tilt);
    const expectedNormal=new T.Vector3(-Math.sin(a)*Math.cos(h),
      Math.sin(h)**2+Math.cos(a)*Math.cos(h)**2,
      Math.sin(h)*Math.cos(h)*(1-Math.cos(a)));
    const desiredNormal=new T.Vector3(-Math.sin(a),Math.cos(a),0);
    const expectedResidual=deg(angle(expectedNormal,desiredNormal));
    check(`U24-3 sign-only control improves but not exact ${tilt}`,
      corrected.every(e=>Math.abs(e-expectedResidual)<1e-4)&&expectedResidual<0.5,
      {errorsDeg:corrected,expectedResidualDeg:expectedResidual});
    // A world-normal geometric alignment control proves the measurement can reach zero.
    for(const side of ['R','L']) {
      const foot=an.rig.joints['foot'+side];
      const worldQ=foot.getWorldQuaternion(new T.Quaternion());
      const adjustment=new T.Quaternion().setFromUnitVectors(sole(an,side).normal,normal);
      foot.quaternion.copy(foot.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(adjustment.multiply(worldQ)));
    }
    root.updateMatrixWorld(true);
    check(`U24-3 normal alignment control ${tilt}`,['R','L'].every(s=>deg(angle(sole(an,s).normal,normal))<.01));
  }
  an.dispose();
}
if(process.argv.includes('--self-test-failure'))check('deliberate assertion failure',false);
console.log(JSON.stringify({summary:{passed,total}}));
process.exitCode=passed===total?0:1;