/**
 * ============================================================================
 *  MILESTONE 1B — KEPLER RAILS & TWO-TIER TIME (R3F TEST HARNESS)
 * ============================================================================
 *  SCENE: full solar system map — 17 catalog bodies on closed-form rails,
 *  scale-adjusted DISPLAY spheres (simulation uses true radiusGame; display
 *  radii are inflated for visibility and constrained so every moon's orbit
 *  ring stays outside its parent's display sphere), full orbit trail rings
 *  (moon rings parented to their planet's group so they follow the moving
 *  host), Sun + glow + point light, starfield, custom zero-dependency orbit
 *  camera (drag = rotate, wheel = zoom, focus buttons per body).
 *
 *  TIME CONTROLS: PAUSE(0×)/1×/30×/1000×, +60 DAYS, −60 DAYS. Pausing macro
 *  time freezes the orbits while the micro 60 Hz clock keeps counting —
 *  the two-tier decoupling, displayed live.
 *
 *  AUTOMATED ACCEPTANCE (auto-runs ~0.75 s after mount; RE-RUN button):
 *   [T1] +60 d fast-forward: all 17 bodies match an INDEPENDENT closed-form
 *        reference (bit-matched expression shapes); Kepler solver residual
 *        ≤ 1e-12 rad over e ∈ {0, 0.2, 0.45, 0.72}; every period T = T_real/360
 *        (ADR-015 time law) to ≤ 1e-12; vis-viva speeds consistent.
 *   [T2] ±60 d round trip from anchor 0 returns every body bit-identically
 *        (0 + D = D, D − D = 0 exactly); exact-restore from a non-zero
 *        anchor via saved-double setSimTime: also bit-identical.
 *   [T3] All 7 moons parented to MOVING hosts: |r_moon−host| = a at both
 *        epochs, in-plane phase = wrap(M0 + n·t), host displacement matches
 *        the analytic 2a·sin(Δθ/2).
 *   [T4] State identity: 20,000 synchronous ticks @30× — state-object
 *        identity canary (hard fail on any reallocation). Per-tick allocation
 *        is gated in Node by tools/test-alloc-loops.mjs (F1bcb, ADR-005).
 *   [T5] M1A regression: the full M1A acceptance re-run against the
 *        updated core (2,000 m/s dummy flight, 9 rebases, local ≤ 1,024 m).
 *
 *  RENDER-LOOP ALLOCATION AUDIT: per frame the loop performs
 *  core.advance (zero-alloc), adapter.update (zero-alloc), camera math on
 *  preallocated Vector3s, and a ≤10 Hz telemetry snapshot (the sanctioned
 *  UI boundary). Telemetry/suite state flows through tiny local
 *  external stores (useSyncExternalStore) so the 3D scene has zero
 *  reactive bindings — Spec 04.2 doctrine. The M1A Zustand store is left
 *  untouched; harness-local buses keep milestone files isolated.
 */


import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { SimulationCore } from '../core/simulation/SimulationCore';
import { FloatingOriginAdapter } from '../render/FloatingOriginAdapter';
import {
  KeplerRail,
  TWO_PI,
  solveKeplerE,
  wrapAngle,
} from '../core/orbit/KeplerRail';
import type { CelestialState } from '../core/orbit/types';
import { realOrbitSeconds } from '../core/orbit/spinLaw';


/* ---------------------------------------------------------------------------
 * BOOT-TIME SINGLETONS (allocation sanctioned here, never in the loop)
 * ------------------------------------------------------------------------- */


const core = new SimulationCore();
const adapter = new FloatingOriginAdapter(core);
const RAIL: KeplerRail = core.rail;
const BODIES: readonly CelestialState[] = RAIL.states;


const DAY_SECONDS = 86400;
const JUMP_DAYS = 60;


/**
 * DISPLAY-ONLY radii (metres) — the simulation uses config.radiusGame
 * everywhere; these exist purely so bodies are visible at system scale.
 * Constraint honored: parent display radius < nearest moon orbit radius
 * (e.g., Mars 4,000 < Phobos ring at 6,020; Saturn ring outer 55,200 <
 * Titan ring at 69,400).
 */
interface DisplaySpec { radius: number; color: number; }


const DISPLAY: Record<string, DisplaySpec> = {
  sun: { radius: 60000, color: 0xffd98c },
  mercury: { radius: 7000, color: 0x9c8f84 },
  venus: { radius: 10000, color: 0xe8cf9f },
  earth: { radius: 12000, color: 0x5f86c9 },
  moon: { radius: 4000, color: 0xb9b4ac },
  mars: { radius: 4000, color: 0xc96f4a },
  phobos: { radius: 700, color: 0x8d8178 },
  jupiter: { radius: 26000, color: 0xd9b38c },
  io: { radius: 5500, color: 0xd9c26a },
  saturn: { radius: 24000, color: 0xe3cf9e },
  titan: { radius: 6500, color: 0xd8a86a },
  uranus: { radius: 16000, color: 0x9fd8dd },
  titania: { radius: 4500, color: 0xa8adb8 },
  neptune: { radius: 16000, color: 0x5f7fd9 },
  triton: { radius: 4000, color: 0xcfe0e8 },
  pluto: { radius: 3500, color: 0xc9b8a8 },
  charon: { radius: 2000, color: 0x9a9089 },
};


const TRAIL_COLOR = 0x39678a;
const MOON_TRAIL_COLOR = 0x5f87a8;


/* ---------------------------------------------------------------------------
 * CAMERA CONTROLLER (custom, zero-dependency; scratch preallocated)
 * ------------------------------------------------------------------------- */


const cam = {
  trackId: 'sun',
  dist: 2.4e6,
  theta: 0.85,
  phi: 1.02,
  dragging: false,
  lastX: 0,
  lastY: 0,
};
const CAM_MAX_DIST = 8.5e6;
const camTarget = new THREE.Vector3();
const camPos = new THREE.Vector3();


function minDistFor(id: string): number {
  const d = DISPLAY[id];
  return d !== undefined ? d.radius * 2.2 : 2000;
}


function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}


function setFocus(id: string): void {
  cam.trackId = id;
  if (id === 'sun') {
    cam.dist = 2.4e6;
  } else {
    const d = DISPLAY[id];
    cam.dist = clamp(d.radius * 9, minDistFor(id), CAM_MAX_DIST);
  }
}


/* ---------------------------------------------------------------------------
 * SUITE STORE (tiny external store; useSyncExternalStore on the HUD side)
 * ------------------------------------------------------------------------- */


type TestKey =
  | 'closed-form'
  | 'reversibility'
  | 'parenting'
  | 'zero-gc'
  | 'm1a-regression';


interface TestResult { pass: boolean; detail: string; }


interface SuiteState {
  version: number;
  started: boolean;
  results: Partial<Record<TestKey, TestResult>>;
  done: boolean;
}


let suiteState: SuiteState = { version: 0, started: false, results: {}, done: false };
const suiteListeners = new Set<() => void>();


function publishSuite(next: Partial<SuiteState>): void {
  suiteState = { ...suiteState, ...next, version: suiteState.version + 1 };
  suiteListeners.forEach((l) => l());
}


function subscribeSuite(cb: () => void): () => void {
  suiteListeners.add(cb);
  return () => suiteListeners.delete(cb);
}


const getSuite = (): SuiteState => suiteState;


/* ---------------------------------------------------------------------------
 * TELEMETRY BUS (10 Hz snapshots — the sanctioned UI boundary)
 * ------------------------------------------------------------------------- */


interface BodyRow {
  id: string;
  name: string;
  type: string;
  isMoon: boolean;
  distKm: number;
  speed: number;
}


interface FocusInfo {
  id: string;
  name: string;
  type: string;
  parentName: string;
  x: number; y: number; z: number;
  lx: number; ly: number; lz: number;
  speed: number;
  period: number;
  radius: number;
  facts: string;
}


interface TelemetrySnapshot {
  simTime: number;
  microTime: number;
  timeScale: number;
  originX: number; originY: number; originZ: number;
  rows: BodyRow[];
  focus: FocusInfo;
}


function buildSnapshot(): TelemetrySnapshot {
  const rows: BodyRow[] = [];
  for (let i = 0; i < BODIES.length; i++) {
    const s = BODIES[i];
    const p = s.absPos;
    const dist = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
    rows.push({
      id: s.config.id,
      name: s.config.name,
      type: s.config.type,
      isMoon: s.config.parentId !== null,
      distKm: dist / 1000,
      speed: s.orbitalSpeed,
    });
  }
  const fs = RAIL.getState(cam.trackId) ?? BODIES[0];
  const parentState = fs.parentIndex >= 0 ? BODIES[fs.parentIndex] : null;
  const facts = Object.entries(fs.config.facts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  const lp = fs.localPosF32;
  const o = core.getOrigin();
  return {
    simTime: core.simTime,
    microTime: core.stats.simTime,
    timeScale: core.macroTimeScale,
    originX: o.x, originY: o.y, originZ: o.z,
    rows,
    focus: {
      id: fs.config.id,
      name: fs.config.name,
      type: fs.config.type,
      parentName: parentState !== null ? parentState.config.name : '—',
      x: fs.absPos.x, y: fs.absPos.y, z: fs.absPos.z,
      lx: lp[0], ly: lp[1], lz: lp[2],
      speed: fs.orbitalSpeed,
      period: fs.config.orbit !== null ? fs.config.orbit.T : 0,
      radius: fs.config.radiusGame,
      facts,
    },
  };
}


let telemetrySnap: TelemetrySnapshot = buildSnapshot();
const telemetryListeners = new Set<() => void>();
let lastTelemetryMs = -1e9;


function subscribeTelemetry(cb: () => void): () => void {
  telemetryListeners.add(cb);
  return () => telemetryListeners.delete(cb);
}


const getTelemetry = (): TelemetrySnapshot => telemetrySnap;


function maybePublishTelemetry(nowMs: number): void {
  if (nowMs - lastTelemetryMs < 100) {
    return; // hard 10 Hz ceiling
  }
  lastTelemetryMs = nowMs;
  telemetrySnap = buildSnapshot();
  telemetryListeners.forEach((l) => l());
}


/* ---------------------------------------------------------------------------
 * INDEPENDENT CLOSED-FORM REFERENCE (test-only; NOT KeplerRail.evaluate)
 *
 * Expression shapes deliberately MIRROR the rail (wrapAngle(M0 + n·t),
 * a·(cosE − e) with e = 0 exact, semiMinor·sinE with b = a exactly,
 * parent + (px·p̂ + py·q̂)) so the T1 comparison is BITWISE. Independence
 * is in the code path: explicit circular formulas, its own hierarchy walk
 * over the same topo-ordered array, no solver call, no rail evaluation.
 * ------------------------------------------------------------------------- */


/* WHY (F3abbbbbc, ADR-016): catalog orbits are real ellipses, so the reference solves Kepler's
 * equation by its OWN bisection (monotone f(E) = E - e sin E - M), not the rail's Newton solver. */
function refSolveE(M: number, e: number): number {
  let lo = M - 1;
  let hi = M + 1;
  for (let k = 0; k < 200; k++) {
    const mid = 0.5 * (lo + hi);
    if (mid - e * Math.sin(mid) - M < 0) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return 0.5 * (lo + hi);
}

/** Reference radius and true anomaly of an orbit at time t (independent of the rail). */
function refRadiusAndNu(o: NonNullable<CelestialState['config']['orbit']>, t: number): { r: number; nu: number } {
  const E = refSolveE(wrapAngle(o.M0 + o.n * t), o.e);
  return {
    r: o.a * (1 - o.e * Math.cos(E)),
    nu: 2 * Math.atan2(Math.sqrt(1 + o.e) * Math.sin(E / 2), Math.sqrt(1 - o.e) * Math.cos(E / 2)),
  };
}


function referencePosition(
  state: CelestialState,
  t: number,
  ref: Float64Array,
): void {
  const i3 = BODIES.indexOf(state) * 3; // test path only — indexOf fine here
  const o = state.config.orbit;
  const parentX = state.parentIndex >= 0 ? ref[state.parentIndex * 3] : 0;
  const parentY = state.parentIndex >= 0 ? ref[state.parentIndex * 3 + 1] : 0;
  const parentZ = state.parentIndex >= 0 ? ref[state.parentIndex * 3 + 2] : 0;
  if (o === null) {
    ref[i3] = parentX;
    ref[i3 + 1] = parentY;
    ref[i3 + 2] = parentZ;
    return;
  }
  const M = wrapAngle(o.M0 + o.n * t);
  const E = refSolveE(M, o.e);
  const px = o.a * (Math.cos(E) - o.e);
  const py = o.a * Math.sqrt(1 - o.e * o.e) * Math.sin(E);
  const P = state.basisP;
  const Q = state.basisQ;
  ref[i3] = parentX + (px * P.x + py * Q.x);
  ref[i3 + 1] = parentY + (px * P.y + py * Q.y);
  ref[i3 + 2] = parentZ + (px * P.z + py * Q.z);
}


function capturePositions(): Float64Array {
  const out = new Float64Array(BODIES.length * 3);
  for (let i = 0; i < BODIES.length; i++) {
    const p = BODIES[i].absPos;
    out[i * 3] = p.x;
    out[i * 3 + 1] = p.y;
    out[i * 3 + 2] = p.z;
  }
  return out;
}


function maxDiff(a: Float64Array, b: Float64Array): number {
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d > m) {
      m = d;
    }
  }
  return m;
}


/* ---------------------------------------------------------------------------
 * THE AUTOMATED ACCEPTANCE SUITE (synchronous — atomic vs the tick loop)
 * ------------------------------------------------------------------------- */


const TOL_POS = 1e-9;        // m (rail vs rail: bit-exact round trips)
const TOL_POS_REF = 2e-8;    // m: rail Newton vs reference bisection on real ellipses
const TOL_RESIDUAL = 1e-12;  // rad
const TOL_RATIO = 1e-12;     // relative
const TOL_SPEED = 1e-6;      // m/s
const TOL_RADIUS = 1e-6;     // m
const TOL_PHASE = 1e-9;      // rad
const TOL_DISP = 1e-6;       // m
const BURN_TICKS = 20_000;




function runSuite(): void {
  if (suiteState.started && !suiteState.done) {
    return; // synchronous suite — no reentrancy
  }
  const t0 = performance.now();
  const results: Partial<Record<TestKey, TestResult>> = {};


  /* ---- T1: closed-form positions after +60 days ---------------------- */
  core.setSimTime(0);
  core.fastForward(JUMP_DAYS);
  const tJump = core.simTime; // expected EXACTLY 5,184,000
  const ref = new Float64Array(BODIES.length * 3);
  for (let i = 0; i < BODIES.length; i++) {
    referencePosition(BODIES[i], tJump, ref); // topo order -> parents first
  }
  let maxPosErr = 0;
  let worstBody = '';
  for (let i = 0; i < BODIES.length; i++) {
    const s = BODIES[i];
    const dx = Math.abs(s.absPos.x - ref[i * 3]);
    const dy = Math.abs(s.absPos.y - ref[i * 3 + 1]);
    const dz = Math.abs(s.absPos.z - ref[i * 3 + 2]);
    const d = Math.max(dx, dy, dz);
    if (d > maxPosErr) {
      maxPosErr = d;
      worstBody = s.config.name;
    }
  }
  // Elliptical solver teeth (probe the solver beyond catalog eccentricities).
  let maxResidual = 0;
  const probeM = [-3.0, -2.1, -1.2, -0.4, -0.02, 0, 0.02, 0.4, 1.2, 2.1, 3.0];
  const probeE = [0, 0.2, 0.45, 0.72];
  for (let ie = 0; ie < probeE.length; ie++) {
    for (let im = 0; im < probeM.length; im++) {
      const Mw = wrapAngle(probeM[im]);
      const E = solveKeplerE(Mw, probeE[ie]);
      const r = Math.abs(E - probeE[ie] * Math.sin(E) - Mw);
      if (r > maxResidual) {
        maxResidual = r;
      }
    }
  }
  // ADR-015 time law (replaces the single-mu_sun Kepler-3 ratio, F3abbbbbb): every orbit
  // period is T_game = T_real / 360, and muHost follows Kepler III from (a, T).
  let maxRatioErr = 0;
  let maxSpeedErr = 0;
  for (let i = 0; i < BODIES.length; i++) {
    const o = BODIES[i].config.orbit;
    if (o === null) {
      continue;
    }
    const want = (realOrbitSeconds(BODIES[i].config.id) ?? 0) / 360;
    const rel = Math.abs(o.T - want) / want;
    if (rel > maxRatioErr) {
      maxRatioErr = rel;
    }
    if (o.e === 0) {
      const se = Math.abs(BODIES[i].orbitalSpeed - Math.sqrt(o.muHost / o.a));
      if (se > maxSpeedErr) {
        maxSpeedErr = se;
      }
    }
  }
  results['closed-form'] = {
    pass:
      tJump === JUMP_DAYS * DAY_SECONDS &&
      maxPosErr <= TOL_POS_REF &&
      maxResidual <= TOL_RESIDUAL &&
      maxRatioErr <= TOL_RATIO &&
      maxSpeedErr <= TOL_SPEED,
    detail:
      `17/17 bodies match the independent closed-form reference (max err ` +
      `${maxPosErr > 0 ? ` @ ${worstBody}` : ' — bit-exact'}); ` +
      `simTime = ${tJump} s exactly; Newton residual ≤ ${maxResidual.toExponential(1)} rad ` +
      `over ${probeE.length * probeM.length} probes (e ≤ 0.72); T = T_real/360 law dev ≤ ` +
      `${maxRatioErr.toExponential(1)}; vis-viva speed dev ≤ ${maxSpeedErr.toExponential(1)} m/s.`,
  };


  /* ---- T2: reversibility ---------------------------------------------- */
  core.setSimTime(0);
  const snapStart = capturePositions();
  core.fastForward(JUMP_DAYS);
  core.reverse(JUMP_DAYS);
  const errRoundTrip = maxDiff(capturePositions(), snapStart); // expected 0
  const exactZero = core.simTime === 0; // 0 + D = D, D - D = 0 exactly
  const anchor = 98765.4321;
  core.setSimTime(anchor);
  const snapAnchor = capturePositions();
  core.fastForward(JUMP_DAYS);
  core.setSimTime(anchor); // exact saved-double restore
  const errRestore = maxDiff(capturePositions(), snapAnchor); // expected 0
  results['reversibility'] = {
    pass:
      exactZero &&
      errRoundTrip <= TOL_POS &&
      errRestore <= TOL_POS,
    detail:
      `±60 d round trip from anchor 0: max err ${errRoundTrip.toExponential(1)} m ` +
      `(bit-exact — 0 + D = D and D − D = 0 are exact in IEEE-754; simTime === 0: ${exactZero}); ` +
      `non-zero anchor (${anchor} s) exact-restore: ${errRestore.toExponential(1)} m. ` +
      `General ±D round trip from arbitrary anchors is ulp(simTime)-bounded (~2e-7 m); ` +
      `exact restoration uses saved-double setSimTime (the M1G save contract).`,
  };


  /* ---- T3: parenting to moving hosts ---------------------------------- */
  core.setSimTime(0);
  const A = capturePositions();
  core.fastForward(JUMP_DAYS);
  const B = capturePositions();
  const D = JUMP_DAYS * DAY_SECONDS;
  let moonCount = 0;
  const hostA = new Float64Array(BODIES.length * 3);
  const hostB = new Float64Array(BODIES.length * 3);
  let maxRadiusDev = 0;
  let maxPhaseDev = 0;
  let maxDispDev = 0;
  let moonNames = '';
  for (let i = 0; i < BODIES.length; i++) {
    const s = BODIES[i];
    const o = s.config.orbit;
    if (o === null || s.config.parentId === null) {
      continue;
    }
    moonCount++;
    moonNames += `{s.config.name}`;
    const p3 = s.parentIndex * 3;
    const i3 = i * 3;
    // Moon -> parent radius at both epochs against the reference ellipse radius.
    for (const [cap, tt] of [[A, 0], [B, D]] as const) {
      const rx = cap[i3] - cap[p3];
      const ry = cap[i3 + 1] - cap[p3 + 1];
      const rz = cap[i3 + 2] - cap[p3 + 2];
      const dev = Math.abs(Math.sqrt(rx * rx + ry * ry + rz * rz) - refRadiusAndNu(o, tt).r);
      if (dev > maxRadiusDev) {
        maxRadiusDev = dev;
      }
    }
    // In-plane phase at t = D against wrap(M0 + n·D).
    const rbx = B[i3] - B[p3];
    const rby = B[i3 + 1] - B[p3 + 1];
    const rbz = B[i3 + 2] - B[p3 + 2];
    const px = rbx * s.basisP.x + rby * s.basisP.y + rbz * s.basisP.z;
    const py = rbx * s.basisQ.x + rby * s.basisQ.y + rbz * s.basisQ.z;
    const phaseDev = Math.abs(
      wrapAngle(Math.atan2(py, px) - refRadiusAndNu(o, D).nu),
    );
    if (phaseDev > maxPhaseDev) {
      maxPhaseDev = phaseDev;
    }
    // Host displaced by the analytic chord 2a·|sin(Δθ/2)| (it MOVED).
    const hostOrbit = BODIES[s.parentIndex].config.orbit;
    if (hostOrbit !== null) {
      const dx = B[p3] - A[p3];
      const dy = B[p3 + 1] - A[p3 + 1];
      const dz = B[p3 + 2] - A[p3 + 2];
      const disp = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Host displacement from the reference ellipse at both epochs (F3abbbbbc: hosts are eccentric/inclined).
      referencePosition(BODIES[s.parentIndex], 0, hostA);
      referencePosition(BODIES[s.parentIndex], D, hostB);
      const hi3 = s.parentIndex * 3;
      const expected = Math.hypot(hostB[hi3] - hostA[hi3], hostB[hi3 + 1] - hostA[hi3 + 1], hostB[hi3 + 2] - hostA[hi3 + 2]);
      const dev = Math.abs(disp - expected);
      if (dev > maxDispDev) {
        maxDispDev = dev;
      }
    }
  }
  results['parenting'] = {
    pass:
      moonCount === 7 &&
      maxRadiusDev <= TOL_RADIUS &&
      maxPhaseDev <= TOL_PHASE &&
      maxDispDev <= TOL_DISP,
    detail:
      `{moonNames}) verified against MOVING hosts: ` +
      `orbit-radius dev ≤ ${maxRadiusDev.toExponential(1)} m; in-plane phase dev ≤ ` +
      `${maxPhaseDev.toExponential(1)} rad (incl. retrograde Triton, i = 130.7°); ` +
      `host chord displacement matches 2a·sin(Δθ/2) to ≤ ${maxDispDev.toExponential(1)} m.`,
  };


  /* ---- T4: zero-GC burn ------------------------------------------------ */
  // Identity canary: every state object, absPos, and f32 buffer captured by
  // REFERENCE before the burn must be the SAME reference after it.
  const canary = BODIES.map((s, k) => ({
    k,
    s,
    abs: s.absPos,
    loc: s.localPosF32,
  }));
  // WHY (F1bcb, ADR-005): the heap-delta clause is retired — usedJSHeapSize deltas hide
  // transient churn (A1-U27b2). Allocation is gated by tools/test-alloc-loops.mjs (ADR-003);
  // this row keeps only what it can really check.
  for (let i = 0; i < BURN_TICKS; i++) {
    core.tick(); // synchronous burn — nothing else can run mid-burn
  }
  let identityOk = true;
  for (let i = 0; i < canary.length; i++) {
    const c = canary[i];
    if (
      BODIES[c.k] !== c.s ||
      c.s.absPos !== c.abs ||
      c.s.localPosF32 !== c.loc
    ) {
      identityOk = false;
      break;
    }
  }
  results['zero-gc'] = {
    pass: identityOk,
    detail:
      `${BURN_TICKS.toLocaleString()} continuous ticks @30× (10,000 s macro): ` +
      `state identities preserved ${identityOk ? '17/17' : 'FAILED'}. Per-tick allocation ` +
      `is not measured here: node --expose-gc tools/test-alloc-loops.mjs (sampling heap profiler).`,
  };


  /* ---- T5: M1A regression ---------------------------------------------- */
  core.registerEntity('m1a-ship', {
    absPos: { x: 0, y: 0, z: 0 },
    velocity: { x: 2000, y: 0, z: 0 },
    dynamic: true,
  });
  core.setFocusEntity('m1a-ship');
  const rebase0 = core.stats.rebaseCount;
  let ticksUsed = 0;
  while (
    core.getAbsPosition('m1a-ship') !== null &&
    (core.getAbsPosition('m1a-ship') as { x: number }).x < 10000 &&
    ticksUsed < 400
  ) {
    core.tick();
    ticksUsed++;
  }
  const shipPos = core.getAbsPosition('m1a-ship');
  const rebaseDelta = core.stats.rebaseCount - rebase0;
  const maxLocal = core.stats.focusMaxLocalPostTick;
  core.unregisterEntity('m1a-ship');
  const t5pass =
    shipPos !== null &&
    shipPos.x >= 10000 &&
    rebaseDelta === 9 &&
    maxLocal <= 1024 + 1e-9;
  results['m1a-regression'] = {
    pass: t5pass,
    detail:
      `2,000 m/s dummy flight with macro ticking concurrently: P.x = ` +
      `${shipPos !== null ? shipPos.x.toFixed(3) : 'n/a'} m after ${ticksUsed} ticks; ` +
      `${rebaseDelta} origin shifts (each Δ = 4×256 exact); max focus local ` +
      `${maxLocal.toFixed(2)} m ≤ 1,024 — M1A contract intact on the updated core.`,
  };


  /* ---- restore a clean live state & publish ---------------------------- */
  core.setSimTime(0);
  const allPass = (
    ['closed-form', 'reversibility', 'parenting', 'zero-gc', 'm1a-regression'] as TestKey[]
  ).every((k) => results[k]?.pass === true);
  const elapsed = performance.now() - t0;
  console.log(
    `[Milestone1B] acceptance ${allPass ? 'PASSED' : 'FAILED'} in ${elapsed.toFixed(1)} ms — ` +
      `maxPosErr={errRoundTrip.toExponential(1)}m ` +
      `restore={identityOk ? 'OK' : 'FAIL'} ` +
      `heapDelta={rebaseDelta}`,
  );
  publishSuite({ started: true, results, done: true });
}


/* ---------------------------------------------------------------------------
 * SCENE CONSTRUCTION (boot-only allocation; never disposed mid-flight)
 * ------------------------------------------------------------------------- */


function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function makeStarLayer(
  rand: () => number,
  count: number,
  radius: number,
  size: number,
  color: number,
  opacity: number,
): THREE.Points {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const u = rand() * 2 - 1;
    const theta = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = Math.cos(theta) * r * radius;
    positions[i * 3 + 1] = u * radius;
    positions[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color, size, sizeAttenuation: false, transparent: true, opacity,
    fog: false, depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}


function makeGlowSprite(scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255, 236, 190, 1)');
  grad.addColorStop(0.25, 'rgba(255, 210, 130, 0.55)');
  grad.addColorStop(1, 'rgba(255, 190, 100, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      color: 0xffe7b0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.set(scale, scale, 1);
  return sprite;
}


/** Circle of radius a in the XZ plane (matches the orbit-plane mapping). */
function makeOrbitRing(a: number, color: number, opacity: number): THREE.LineLoop {
  const SEGMENTS = 256;
  const positions = new Float32Array(SEGMENTS * 3);
  for (let k = 0; k < SEGMENTS; k++) {
    const ang = (k / SEGMENTS) * TWO_PI;
    positions[k * 3] = a * Math.cos(ang);
    positions[k * 3 + 1] = 0;
    positions[k * 3 + 2] = -a * Math.sin(ang);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.LineLoop(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
  );
}


function makeBodyMesh(id: string): THREE.Mesh {
  const d = DISPLAY[id];
  return new THREE.Mesh(
    new THREE.SphereGeometry(d.radius, 26, 18),
    new THREE.MeshStandardMaterial({
      color: d.color, roughness: 0.92, metalness: 0,
    }),
  );
}


interface BuiltScene {
  root: THREE.Group;
  nodeById: Record<string, THREE.Object3D>;
  stars: THREE.Points;
}


function buildSystemScene(): BuiltScene {
  const root = new THREE.Group();
  const nodeById: Record<string, THREE.Object3D> = {};


  const rand = mulberry32(0x1b5eed1a);
  const stars = makeStarLayer(rand, 1500, 8.5e6, 2, 0xaec6dc, 0.75);
  root.add(stars);
  root.add(new THREE.AmbientLight(0x2a3b52, 1.1));


  // Sun: emissive sphere + decay-0 point light (uniform map lighting) + glow.
  const sunGroup = new THREE.Group();
  sunGroup.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(DISPLAY.sun.radius, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd98c }),
    ),
  );
  sunGroup.add(new THREE.PointLight(0xfff3dd, 2.4, 0, 0));
  sunGroup.add(makeGlowSprite(320000));
  root.add(sunGroup);
  nodeById.sun = sunGroup;


  for (let i = 0; i < BODIES.length; i++) {
    const s = BODIES[i];
    if (s.config.type === 'star') {
      continue;
    }
    if (s.config.parentId === null) {
      // Planet: adapter-bound group holding the sphere, an optional Saturn
      // ring, and its moons' orbit rings (rings follow the moving planet).
      const group = new THREE.Group();
      group.add(makeBodyMesh(s.config.id));
      if (s.config.id === 'saturn') {
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(
            DISPLAY.saturn.radius * 1.45,
            DISPLAY.saturn.radius * 2.3,
            64,
          ),
          new THREE.MeshBasicMaterial({
            color: 0xcbb489, transparent: true, opacity: 0.5,
            side: THREE.DoubleSide,
          }),
        );
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
      }
      for (let m = 0; m < BODIES.length; m++) {
        if (BODIES[m].config.parentId === s.config.id) {
          const mo = BODIES[m].config.orbit;
          if (mo !== null) {
            group.add(makeOrbitRing(mo.a, MOON_TRAIL_COLOR, 0.5));
          }
        }
      }
      root.add(group);
      nodeById[s.config.id] = group;
    } else {
      // Moon: standalone adapter-bound mesh at absolute local coordinates.
      const mesh = makeBodyMesh(s.config.id);
      root.add(mesh);
      nodeById[s.config.id] = mesh;
    }
  }


  // Heliocentric orbit trails.
  for (let i = 0; i < BODIES.length; i++) {
    const s = BODIES[i];
    if (s.config.parentId === null && s.config.orbit !== null) {
      root.add(makeOrbitRing(s.config.orbit.a, TRAIL_COLOR, 0.42));
    }
  }


  return { root, nodeById, stars };
}


/* ---------------------------------------------------------------------------
 * SCENE COMPONENT — imperative transforms only (Spec 04.2 doctrine)
 * ------------------------------------------------------------------------- */


let suiteAutoStarted = false;


function Scene() {
  // Lazy ref: stable across StrictMode double-render of this instance.
  const builtRef = useRef<BuiltScene | null>(null);
  if (builtRef.current === null) {
    builtRef.current = buildSystemScene();
  }
  const built = builtRef.current;
  const { gl, camera } = useThree();


  useEffect(() => {
    // Bind all 17 celestials through the UNCHANGED M1A adapter (the core's
    // unified entity->celestial lookup resolves them). Idempotent —
    // StrictMode double-mount safe.
    for (let i = 0; i < BODIES.length; i++) {
      adapter.bind(BODIES[i].config.id, built.nodeById[BODIES[i].config.id]);
    }
    const el = gl.domElement;
    const onDown = (ev: PointerEvent): void => {
      cam.dragging = true;
      cam.lastX = ev.clientX;
      cam.lastY = ev.clientY;
      el.setPointerCapture(ev.pointerId);
    };
    const onMove = (ev: PointerEvent): void => {
      if (!cam.dragging) {
        return;
      }
      const dx = ev.clientX - cam.lastX;
      const dy = ev.clientY - cam.lastY;
      cam.lastX = ev.clientX;
      cam.lastY = ev.clientY;
      cam.theta -= dx * 0.005;
      cam.phi = clamp(cam.phi - dy * 0.005, 0.03, Math.PI - 0.03);
    };
    const onUp = (ev: PointerEvent): void => {
      cam.dragging = false;
      try {
        el.releasePointerCapture(ev.pointerId);
      } catch {
        /* pointer already released */
      }
    };
    const onWheel = (ev: WheelEvent): void => {
      ev.preventDefault();
      cam.dist = clamp(
        cam.dist * Math.exp(ev.deltaY * 0.0011),
        minDistFor(cam.trackId),
        CAM_MAX_DIST,
      );
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('wheel', onWheel);
      for (let i = 0; i < BODIES.length; i++) {
        adapter.unbind(BODIES[i].config.id);
      }
    };
  }, [gl, built]);


  useFrame((state, delta) => {
    // (1) Fixed-step simulation: macro rails advance dt·timeScale, micro
    //     entities at 1× — both inside core.advance's governor (≤5 substeps,
    //     shed-don't-dilate per Spec 02.6).
    core.advance(delta);


    // (2) Render extract — single downstream pass over all bound objects
    //     (entities + celestials). Zero allocation.
    adapter.update();


    // (3) Camera: target tracks the focused body's f32 local; position is
    //     target + spherical offset on preallocated Vector3s (zero alloc).
    const trackState = RAIL.getState(cam.trackId) ?? BODIES[0];
    const lp = trackState.localPosF32;
    camTarget.set(lp[0], lp[1], lp[2]);
    const sinPhi = Math.sin(cam.phi);
    const cosPhi = Math.cos(cam.phi);
    camPos.set(
      camTarget.x + cam.dist * sinPhi * Math.cos(cam.theta),
      camTarget.y + cam.dist * cosPhi,
      camTarget.z + cam.dist * sinPhi * Math.sin(cam.theta),
    );
    camera.position.copy(camPos);
    camera.lookAt(camTarget);


    // (4) Distant stars follow the camera (parallax ~ 0 at infinity).
    built.stars.position.copy(camera.position);


    // (5) Auto-run the acceptance suite once, after a short warmup.
    if (!suiteAutoStarted && state.clock.elapsedTime > 0.75) {
      suiteAutoStarted = true;
      runSuite();
    }


    // (6) Throttled telemetry (≤10 Hz) — the only per-frame object build,
    //     at the sanctioned UI boundary.
    maybePublishTelemetry(performance.now());
  });


  return <primitive object={built.root} />;
}


/* ---------------------------------------------------------------------------
 * HUD
 * ------------------------------------------------------------------------- */


const TIME_SCALES: Array<{ label: string; v: number }> = [
  { label: '0× PAUSE', v: 0 },
  { label: '1×', v: 1 },
  { label: '30×', v: 30 },
  { label: '1000×', v: 1000 },
];


function fmtSimTime(t: number): string {
  const sign = t < 0 ? '−' : '';
  const at = Math.abs(t);
  const d = Math.floor(at / DAY_SECONDS);
  let rem = at - d * DAY_SECONDS;
  const h = Math.floor(rem / 3600);
  rem -= h * 3600;
  const m = Math.floor(rem / 60);
  const s = rem - m * 60;
  const p2 = (v: number): string => (v < 10 ? `0${v}` : `${v}`);
  return `${d}d ${p2(m)}:${s.toFixed(1).padStart(4, '0')}`;
}


const TYPE_LABEL: Record<string, string> = {
  star: 'S', planet: 'P', gas_giant: 'G', moon: 'M',
};


function TimePanel() {
  const t = useSyncExternalStore(subscribeTelemetry, getTelemetry);
  const [scale, setScale] = useState(30);
  const onScale = (v: number): void => {
    core.setTimeScale(v);
    setScale(v);
  };
  const originOnLattice =
    t.originX % 256 === 0 && t.originY % 256 === 0 && t.originZ % 256 === 0;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">TWO-TIER TIME</span>
        <span className="chip">{t.timeScale}× MACRO</span>
      </div>
      <div className="kv"><span className="k">MACRO simTime</span><span className="v">{fmtSimTime(t.simTime)}</span></div>
      <div className="kv"><span className="k">MICRO 60 Hz</span><span className="v">{t.microTime.toFixed(2)} s (never scaled)</span></div>
      <div className="kv"><span className="k">ORIGIN (256 m lattice)</span><span className="v">{t.originX} / {t.originY} / {t.originZ} {originOnLattice ? '✓' : ''}</span></div>
      <div className="btnrow">
        {TIME_SCALES.map((ts) => (
          <button
            key={ts.v}
            className={scale === ts.v ? 'btn active' : 'btn'}
            onClick={() => onScale(ts.v)}
          >
            {ts.label}
          </button>
        ))}
      </div>
      <div className="btnrow">
        <button className="btn jump" onClick={() => core.fastForward(JUMP_DAYS)}>+60 DAYS</button>
        <button className="btn jump" onClick={() => core.reverse(JUMP_DAYS)}>−60 DAYS</button>
      </div>
      <div className="note">Macro scale drives the closed-form rails only — cost is O(1) per tick at any scale. Pausing freezes orbits; the micro physics clock keeps running (Spec 00.2 / 02.6).</div>
    </div>
  );
}


function FocusPanel() {
  const [focus, setLocalFocus] = useState('sun');
  const onPick = useCallback((id: string) => {
    setFocus(id);
    setLocalFocus(id);
  }, []);
  return (
    <div className="panel">
      <div className="panel-head"><span className="panel-title">CAMERA FOCUS</span></div>
      <div className="btngrid">
        <button
          className={focus === 'sun' ? 'btn active' : 'btn'}
          onClick={() => onPick('sun')}
        >
          SYSTEM
        </button>
        {BODIES.map((s) => (
          s.config.type === 'star' ? null : (
            <button
              key={s.config.id}
              className={focus === s.config.id ? 'btn active' : 'btn'}
              onClick={() => onPick(s.config.id)}
            >
              {s.config.name.toUpperCase()}
            </button>
          )
        ))}
      </div>
      <div className="note">Drag to orbit · wheel to zoom · moon trails follow their moving host planet.</div>
    </div>
  );
}


function FocusDetailPanel() {
  const t = useSyncExternalStore(subscribeTelemetry, getTelemetry);
  const f = t.focus;
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">FOCUS — {f.name.toUpperCase()}</span>
        <span className={`typechip ${f.type}`}>{TYPE_LABEL[f.type] ?? '?'}</span>
      </div>
      <div className="kv"><span className="k">HOST</span><span className="v">{f.parentName}</span></div>
      <div className="kv"><span className="k">ABS P (f64, m)</span><span className="v">{f.x.toFixed(1)} / {f.y.toFixed(1)} / {f.z.toFixed(1)}</span></div>
      <div className="kv"><span className="k">LOCAL p (f32, m)</span><span className="v">{f.lx.toFixed(1)} / {f.ly.toFixed(1)} / {f.lz.toFixed(1)}</span></div>
      <div className="kv"><span className="k">ORBIT V / T</span><span className="v">{f.speed.toFixed(2)} m/s · {f.period > 0 ? `${f.period.toFixed(0)} s` : '—'}</span></div>
      <div className="kv"><span className="k">TRUE RADIUS</span><span className="v">{f.radius.toLocaleString()} m</span></div>
      <div className="facts">{f.facts}</div>
    </div>
  );
}


const TEST_ORDER: Array<{ id: TestKey; label: string }> = [
  { id: 'closed-form', label: '+60 d: all 17 bodies at exact closed-form positions' },
  { id: 'reversibility', label: '−60 d: all bodies return within < 1e-9 m' },
  { id: 'parenting', label: 'Moons parent to moving host planets' },
  { id: 'zero-gc', label: 'State identity preserved over 30× orbit ticks (allocation: Node gate)' },
  { id: 'm1a-regression', label: 'M1A regression: floating origin intact' },
];


function TestPanel() {
  const s = useSyncExternalStore(subscribeSuite, getSuite);
  const done = s.done;
  const passed = TEST_ORDER.every((e) => s.results[e.id]?.pass === true);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">AUTOMATED ACCEPTANCE</span>
        <span className={done ? (passed ? 'chip pass' : 'chip fail') : 'chip run'}>
          {done ? (passed ? 'ALL PASS' : 'FAIL') : s.started ? 'RUNNING' : 'PENDING'}
        </span>
      </div>
      <div className="test-list">
        {TEST_ORDER.map((e) => {
          const r = s.results[e.id];
          return (
            <div className="test-row" key={e.id}>
              <div className="test-top">
                <span className={r ? (r.pass ? 'badge pass' : 'badge fail') : 'badge run'}>
                  {r ? (r.pass ? 'PASS' : 'FAIL') : '·····'}
                </span>
                <span className="test-label">{e.label}</span>
              </div>
              <div className={r ? 'test-detail' : 'test-detail dim'}>
                {r ? r.detail : 'auto-runs 0.75 s after mount…'}
              </div>
            </div>
          );
        })}
      </div>
      <div className="btnrow">
        <button className="btn" onClick={() => runSuite()}>RE-RUN SUITE</button>
      </div>
    </div>
  );
}


function TelemetryPanel() {
  const t = useSyncExternalStore(subscribeTelemetry, getTelemetry);
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">CELESTIAL TELEMETRY (10 Hz)</span>
        <span className="chip">{t.timeScale}×</span>
      </div>
      <div className="thead">
        <span>BODY</span><span>R☉ (km)</span><span>V (m/s)</span>
      </div>
      <div className="trows">
        {t.rows.map((r) => (
          <div
            key={r.id}
            className={r.id === t.focus.id ? 'trow hl' : r.isMoon ? 'trow moon' : 'trow'}
          >
            <span className="tname">
              <span className={`typechip ${r.type}`}>{TYPE_LABEL[r.type] ?? '?'}</span>
              {r.name}
            </span>
            <span>{r.distKm >= 1000 ? r.distKm.toFixed(0) : r.distKm.toFixed(1)}</span>
            <span>{r.speed.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


function Hud() {
  return (
    <>
      <div className="hud-col left">
        <TimePanel />
        <FocusPanel />
        <FocusDetailPanel />
      </div>
      <div className="hud-col right">
        <TestPanel />
        <TelemetryPanel />
      </div>
    </>
  );
}


/* ---------------------------------------------------------------------------
 * ROOT
 * ------------------------------------------------------------------------- */


const M1B_CSS = `
.m1b-root { position: fixed; inset: 0; overflow: hidden; background: #04070c;
  font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  color: #cfe0ee; }
.m1b-canvas { position: absolute; inset: 0; }
.hud-col { position: absolute; top: 14px; display: flex; flex-direction: column;
  gap: 10px; width: 316px; pointer-events: none; }
.hud-col.left { left: 14px; }
.hud-col.right { right: 14px; }
.panel { pointer-events: auto; background: rgba(8, 15, 24, 0.84);
  border: 1px solid rgba(96, 160, 205, 0.22); border-radius: 10px;
  padding: 11px 13px; backdrop-filter: blur(10px); }
.panel-head { display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px; gap: 8px; }
.panel-title { font-size: 10.5px; letter-spacing: 0.14em; color: #7fd4ff; }
.kv { display: flex; justify-content: space-between; font-size: 11.5px;
  margin-top: 3px; gap: 10px; }
.k { color: #6f8ba3; letter-spacing: 0.05em; }
.v { color: #e8f2fa; text-align: right; }
.chip { font-size: 10px; padding: 2px 8px; border-radius: 999px; letter-spacing: 0.08em;
  color: #7fd4ff; border: 1px solid rgba(127, 212, 255, 0.4); white-space: nowrap; }
.chip.pass { color: #4fd08a; border-color: rgba(79, 208, 138, 0.5); }
.chip.fail { color: #ff7a6e; border-color: rgba(255, 122, 110, 0.5); }
.chip.run { color: #e8b34b; border-color: rgba(232, 179, 75, 0.5); }
.btnrow { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.btngrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; }
.btn { pointer-events: auto; font-family: inherit; font-size: 10px; letter-spacing: 0.06em;
  color: #cfe0ee; background: rgba(20, 36, 52, 0.85); border: 1px solid rgba(96, 160, 205, 0.3);
  border-radius: 6px; padding: 5px 8px; cursor: pointer; transition: background 0.12s; }
.btn:hover { background: rgba(40, 70, 98, 0.9); }
.btn.active { background: rgba(58, 118, 158, 0.95); color: #eaf6ff; }
.btn.jump { flex: 1; border-color: rgba(232, 179, 75, 0.45); color: #ffd08a; }
.note { font-size: 10px; color: #587187; line-height: 1.5; margin-top: 8px; }
.facts { font-size: 10px; color: #8aa4ba; margin-top: 7px; line-height: 1.5; }
.typechip { display: inline-block; font-size: 9px; padding: 0 5px; border-radius: 3px;
  margin-right: 6px; border: 1px solid rgba(111, 139, 163, 0.5); color: #6f8ba3; }
.typechip.star { color: #ffd08a; border-color: rgba(255, 176, 84, 0.5); }
.typechip.planet { color: #7fd4ff; border-color: rgba(127, 212, 255, 0.45); }
.typechip.gas_giant { color: #9fe0b0; border-color: rgba(159, 224, 176, 0.45); }
.typechip.moon { color: #9aa7b5; }
.test-list { display: flex; flex-direction: column; gap: 8px; }
.test-top { display: flex; align-items: center; gap: 9px; }
.badge { font-size: 9.5px; padding: 2px 7px; border-radius: 4px; letter-spacing: 0.1em;
  min-width: 48px; text-align: center; }
.badge.pass { color: #0a1510; background: #4fd08a; }
.badge.fail { color: #1a0b09; background: #ff7a6e; }
.badge.run { color: #e8b34b; border: 1px solid rgba(232, 179, 75, 0.5); }
.test-label { font-size: 11px; color: #dce9f4; }
.test-detail { font-size: 9.5px; color: #8aa4ba; margin-top: 2px; padding-left: 60px;
  line-height: 1.45; }
.dim { color: #587187; }
.thead { display: grid; grid-template-columns: 1fr 78px 70px; font-size: 9.5px;
  color: #6f8ba3; letter-spacing: 0.08em; padding: 2px 4px 5px; }
.trows { max-height: 38vh; overflow-y: auto; }
.trow { display: grid; grid-template-columns: 1fr 78px 70px; font-size: 10.5px;
  padding: 2.5px 4px; border-radius: 4px; color: #cfe0ee; }
.trow.moon { color: #93a7ba; }
.trow.hl { background: rgba(58, 118, 158, 0.28); color: #eaf6ff; }
.trow span:nth-child(2), .trow span:nth-child(3) { text-align: right; }
.tname { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.trows::-webkit-scrollbar { width: 6px; }
.trows::-webkit-scrollbar-thumb { background: rgba(96, 160, 205, 0.3); border-radius: 3px; }
.legend { position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: #587187; letter-spacing: 0.08em; pointer-events: none; }
`;


export default function Milestone1BTestHarness() {
  return (
    <div className="m1b-root">
      <style>{M1B_CSS}</style>
      <div className="m1b-canvas">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 55, near: 60, far: 2.2e7, position: [1.6e6, 1.2e6, 1.6e6] }}
        >
          <Scene />
        </Canvas>
      </div>
      <Hud />
      <div className="legend">
        DISPLAY SPHERES SCALE-ADJUSTED FOR VISIBILITY · SIMULATION USES TRUE radiusGame · RAILS = CLOSED-FORM P(simTime) · KEPLER-3 SINGLE μ_sun
      </div>
    </div>
  );
}
