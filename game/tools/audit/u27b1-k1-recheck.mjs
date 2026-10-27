// A1 U27b1: independent no-missing-representation oracle, real pool + source-extracted
// harness update/apply functions. No tracked source edits; controls are in memory.
// Run from game/: node tools/audit/u27b1-k1-recheck.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
import ts from 'typescript';
import * as THREE from 'three';
register('./u27b1-ts-loader.mjs', import.meta.url);
const IM = await import('../../src/core/render/impostorMath.ts');
const SF = await import('../../src/core/physics/sphericalFrame.ts');
const R = await import('../../src/render/MultiCameraRig.tsx');
const { SkyImpostorPool } = await import('../../src/render/SkyImpostorPool.ts');
const { PLAY_BODIES, applySkyState } = await import('../../src/play/world/skyState.ts');

const text = readFileSync(new URL('../../src/test/Milestone1F_TestHarness.tsx', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('../../src/test/m1fHandoff.ts', import.meta.url), 'utf8') // F2fccba: controller moved to m1fHandoff.ts (ADR-023);
const ast = ts.createSourceFile('h.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = new Set(['HANDOFF_D_HARD', 'HANDOFF_D_SOFT', 'HANDOFF_FADE_LO', 'HANDOFF_FADE_HI',
  'probe', 'handoffFade', 'handoffNextState', 'updateProbes', 'applyRenderState', 'assignObject']);
const declarations = ast.statements.filter(n => {
  if (ts.isFunctionDeclaration(n)) return names.has(n.name?.text);
  if (ts.isVariableStatement(n)) return n.declarationList.declarations.some(d => names.has(d.name.getText(ast)));
  return false;
});
assert.equal(declarations.length, names.size, 'extraction anchors must all exist');
const source = declarations.map(n => n.getText(ast).replace(/^export /, '')).join('\n');
const emit = src => ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
let checks = 0;
function check(label, cond, detail = '') {
  assert.ok(cond, `${label}: ${detail}`); checks++; console.log(`PASS ${label}${detail ? ': ' + detail : ''}`);
}
function mesh() {
  const o = new THREE.Object3D();
  o.material = { uniforms: { uOpacity: { value: 1 } }, depthWrite: true };
  return o;
}
function fixture(mode = 'shipped') {
  const sky = new SkyImpostorPool(0);
  const probeMeshA = mesh(), probeMeshB = mesh();
  const env = {
    sky, probeMeshA, probeMeshB, core: { getOrigin: () => ({x:0,y:0,z:0}) },
    moonState: { absPos: {x:0,y:0,z:0} }, CAT_BODIES: [],
    PROBE_DIR: {x:0,y:0,z:-1}, PROBE_GAP: 2500, PROBE_R: 1800, PROBE_R2: 1600,
    SLOT_PROBE_A: 9, SLOT_PROBE_B: 10,
    sunGeom: {dirX:0,dirY:0,dirZ:1,theta:0.01,dist:1e6},
    ...IM, ...SF, layerMaskFor: R.layerMaskFor, RIG: R.RIG,
    _vA: {x:0,y:0,z:0}, _vB: {x:0,y:0,z:0}, _qS: {x:0,y:0,z:0,w:1},
    _geo: {}, glow: new THREE.Object3D(), earthMesh: mesh(), earthVec: {x:0,y:0,z:-39000},
    earthDist: 39000, EARTH_R: 5000, assignStats: {near:0,mid:0,far:0,dual:0},
    kcc: {spinPhase:0}, assignSpinObject() {}, satA:{},satB:{},satC:{},SAT_A:{},SAT_B:{},SAT_C:{},SAT_R:26,
    pool: {records:[]}, HEIGHT_SLACK:360, astroMesh:mesh(), NEAR_BIT:R.NEAR_BIT, MID_BIT:R.MID_BIT,
  };
  let src = source;
  if (mode === 'coverage-control') {
    for (const id of ['A','B']) {
      const anchor = `probe.meshState${id} && probe.alphaMesh${id} > 0.01`;
      assert.ok(src.includes(anchor)); src = src.replace(anchor, `probe.alphaMesh${id} > 0.01`);
    }
  }
  const mod = new Function(...Object.keys(env), emit(src) +
    '\nreturn {probe, updateProbes, applyRenderState, handoffFade, handoffNextState};')(...Object.values(env));
  function at(d) {
    mod.probe.forcedD = d; mod.updateProbes(0);
    mod.applyRenderState(0,0,0,0,0,0,1);
    const A = {state:mod.probe.meshStateA, mesh:probeMeshA.visible && probeMeshA.layers.mask !== 0,
      imp:sky.bodies[9].active, alpha:sky.bodies[9].alpha};
    const B = {state:mod.probe.meshStateB, mesh:probeMeshB.visible && probeMeshB.layers.mask !== 0,
      imp:sky.bodies[10].active, alpha:sky.bodies[10].alpha};
    // Fixture has no catalog slots: actual GPU instance count must match the two probe flags.
    assert.equal(sky.mesh.count, Number(A.imp) + Number(B.imp));
    return {d,A,B,instances:sky.mesh.count};
  }
  return { ...mod, at };
}
function sweep(f, start, end, step) {
  const holes = [];
  for (let d = start; step > 0 ? d <= end : d >= end; d += step) {
    const r = f.at(d);
    if (!r.A.mesh && !r.A.imp) holes.push(d);
  }
  return holes;
}
// Independent invariant: mesh draw eligibility OR active instance, NOT alpha complement.
const inbound = fixture(), outbound = fixture();
const down = sweep(inbound, 300000, 200000, -100);
const up = sweep(outbound, 200000, 300000, 100);
check('inbound missing representation', down.length === 57, JSON.stringify({count:down.length,min:Math.min(...down),max:Math.max(...down)}));
check('outbound coverage control', up.length === 0);
const fixed = sweep(fixture('coverage-control'), 300000, 200000, -100);
check('in-memory coverage control removes hole', fixed.length === 0, 'not a production fix or a silhouette proof');

let lo = 0, hi = 1;
for (let i=0; i<64; i++) { const t=(lo+hi)/2; if (t*t*(3-2*t) <= 0.01) lo=t; else hi=t; }
const edge = 225000 + 11000 * (lo+hi)/2;
const f = fixture(); f.at(300000);
const samples = [edge+0.001,edge-0.001,225000,222000,220000,219999.999].map(d=>f.at(d));
console.log('BOUNDARIES', JSON.stringify({edge, width:edge-220000, samples},null,2));
check('upper boundary bracket', samples[0].A.imp && !samples[1].A.imp);
check('strict lower boundary', !samples[4].A.mesh && !samples[4].A.imp && samples[5].A.mesh);
const at222 = fixture(); at222.at(300000); const r222 = at222.at(222000);
check('both real pool instances absent at 222km', !r222.A.mesh && !r222.B.mesh && r222.instances===0);
const historyA = fixture(); historyA.at(200000);
const historyB = fixture(); historyB.at(300000);
check('same distance depends on history', historyA.at(223000).A.mesh && !historyB.at(223000).A.mesh);

// Execute the actual R3(a) block, not a retyped implementation.
const gateSrc = text.slice(text.indexOf('let holes = 0, doubles = 0, flips = 0, maxSlope = 0;'),
  text.indexOf('// (b) live trace validation'));
assert.ok(gateSrc.includes('m = 1 - imp'));
const gate = new Function('handoffFade','handoffNextState', emit(gateSrc) +
  '\nreturn {holes,doubles,flips,maxSlope};')(f.handoffFade,f.handoffNextState);
console.log('R3A', JSON.stringify(gate));
check('shipped R3a accepts while draw oracle rejects', gate.holes===0 && gate.doubles===0 && gate.flips===21 && gate.maxSlope<=0.00015 && down.length>0);

// Production integration: call REAL applySkyState with a minimal dependency fixture.
// All body positions above local horizon; move their distances through the band.
// Spies record supplied alpha and body ids; no GPU/browser claims.
const calls=[], position={x:0,y:1,z:0};
const world = {
  core:{getOrigin:()=>({x:0,y:0,z:0}),getCelestialState:()=>({absPos:position})},
  kcc:{spinPhase:0},sky:{
    setBody(...args){calls.push({id:args[1],distance:args[7],alpha:args[11],active:args[12]});},
    update(){},stars:new THREE.Object3D(),bodies:[{stagedPX:0,stagedPY:0,stagedPZ:0,stageD:9600}]
  },pool:{records:[]},moonAbs:{x:0,y:0,z:0},earthVec:{x:0,y:39000,z:0},earthDist:39000,
  earthMesh:new THREE.Object3D(),glow:new THREE.Object3D(),characterRoot:new THREE.Object3D(),
};
for (const d of [320000,240000,232000,223000,219000,190000,223000,320000]) {
  position.y=d+1;
  applySkyState(world,0,1,0,0,0,0,1);
}
check('production always supplies alpha=1', calls.length===72 && calls.every(c=>c.alpha===1));
check('Earth and Moon absent from impostor slots', PLAY_BODIES.length===9 && !calls.some(c=>['earth','moon'].includes(c.id)));
check('Earth remains assigned as mesh', world.earthMesh.visible && world.earthMesh.layers.mask===R.MID_BIT);
console.log('PRODUCTION',JSON.stringify({calls:calls.length,ids:[...new Set(calls.map(c=>c.id))],alphas:[...new Set(calls.map(c=>c.alpha))]}));
console.log(`PASS ${checks}/${checks}; oracle rejects shipped inbound coverage, accepts controls. No WebGL pixels sampled.`);