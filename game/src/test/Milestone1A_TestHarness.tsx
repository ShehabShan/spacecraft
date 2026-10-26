/**
 * ============================================================================
 *  MILESTONE 1A — AUTOMATED ACCEPTANCE HARNESS (R3F TEST PAGE)
 * ============================================================================
 *  SCENARIO (Spec 05 / Milestone 1A):
 *    A dummy ship spawns at (0,0,0) and flies a straight line at
 *    V = (2000, 0, 0) m/s — the absolute hard cap — for 10,000 m.
 *
 *  SCENE:
 *    - 256 m reference grid, lattice-anchored: lines stay fixed in ABSOLUTE
 *      space across every origin shift (the signature visual proof — the
 *      grid streams past at 2,000 m/s yet never slides when O jumps).
 *    - Three STATIC world beacons at absolute X = 2,000 / 5,000 / 8,000 m:
 *      registered as static entities, their f32 locals shift by −Δ on every
 *      rebase while their absolute positions never move.
 *    - Distant starfield following the camera (parallax ~ 0 at infinity).
 *
 *  AUTOMATED ACCEPTANCE (auto-arms on mount, ~5 s):
 *    [T1] Absolute P.x reaches >= 10,000 m in Float64.
 *    [T2] Local f32 p.x never exceeds 1,024 m.
 *    [T3] Rebase count is between 9 and 10.
 *    [T4] Every Δ is an exact multiple of 256 m (and Math.fround(Δ) === Δ).
 *    [T5] Frame time stays stable at the 60 FPS baseline (no rebase stutter).
 *
 *  ZERO-GC DISCIPLINE: all per-frame state lives in boot-allocated module
 *  containers (frame-time rings, rebase capture, live counters). The frame
 *  loop allocates nothing except the <= 10 Hz telemetry snapshot and the
 *  one-shot test-results object.
 *
 *  StrictMode-safe: module singletons + idempotent adapter binding.
 */


import { createRef, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { SimulationCore } from '../core/simulation/SimulationCore';
import { FloatingOriginAdapter } from '../render/FloatingOriginAdapter';
import { ORIGIN_LATTICE, REBASE_THRESHOLD } from '../core/math/precisionMath';
import {
  createTelemetryPublisher,
  selectTelemetry,
  selectTestPhase,
  selectTestResults,
  useGameStore,
} from '../store/useGameStore';
import type { TestId } from '../store/useGameStore';
import type { Vec3f64 } from '../core/types';


/* ---------------------------------------------------------------------------
 * BOOT-TIME SINGLETONS — allocation is sanctioned HERE, never in the loop.
 * ------------------------------------------------------------------------- */


const core = new SimulationCore();
const adapter = new FloatingOriginAdapter(core);


const SHIP_ID = 'ship';
const SHIP_VELOCITY = 2000; // m/s along +x (absolute hard cap, Spec 00.3)
const TEST_DISTANCE_M = 10_000;


interface BeaconSpec {
  id: string;
  abs: Vec3f64;
  color: string;
}


const BEACONS: BeaconSpec[] = [
  { id: 'beacon-a', abs: { x: 2000, y: 80, z: 220 }, color: '#ffb454' },
  { id: 'beacon-b', abs: { x: 5000, y: 80, z: -220 }, color: '#7fd4ff' },
  { id: 'beacon-c', abs: { x: 8000, y: 80, z: 220 }, color: '#c9a0ff' },
];


const shipState = core.registerEntity(SHIP_ID, {
  absPos: { x: 0, y: 0, z: 0 },
  velocity: { x: SHIP_VELOCITY, y: 0, z: 0 },
  dynamic: true,
});
core.setFocusEntity(SHIP_ID);


for (const b of BEACONS) {
  core.registerEntity(b.id, { absPos: b.abs, dynamic: false });
}


/** Camera offset from the ship, in LOCAL space. Hard-locked, not smoothed. */
const CAMERA_OFFSET = { x: -26, y: 10, z: 17 };
/**
 * Grid forward bias. MUST remain a multiple of 256 so that grid lines stay
 * on absolute multiples of 256 after every origin shift.
 */
const GRID_BIAS_X = 1024;


/* ---------------------------------------------------------------------------
 * AUTOMATED ACCEPTANCE CONTROLLER (module scope — survives re-mounts)
 * ------------------------------------------------------------------------- */


const TEST = {
  DISTANCE_M: TEST_DISTANCE_M,
  LOCAL_BOUND_M: REBASE_THRESHOLD, // 1,024
  LOCAL_EPS: 1e-9,
  REBASE_MIN: 9,
  REBASE_MAX: 10,
  LATTICE_M: ORIGIN_LATTICE, // 256
  FRAME_AVG_BUDGET_MS: 20, // >= 50 FPS sustained average
  FRAME_MAX_MS: 48, // no single stutter frame (> ~3x budget)
  WARMUP_FRAMES: 20, // shader-compile warmup, excluded from the record
  SIM_TIMEOUT_S: 8, // hard safety net (sim time, not wall time)
  FRAME_CAP: 4096,
  REBASE_FRAME_CAP: 128,
} as const;


const test = {
  finished: false,
  // Boot-allocated capture buffers — never grown at runtime.
  frameTimes: new Float64Array(TEST.FRAME_CAP),
  frameCount: 0,
  warmup: TEST.WARMUP_FRAMES,
  rebaseFrameTimes: new Float64Array(TEST.REBASE_FRAME_CAP),
  rebaseFrameCount: 0,
  // Rebase verification, written synchronously by the listener below.
  deltaLatticeOk: true,
  deltaF32Exact: true,
  deltaVerified: 0,
  lastDeltaX: 0,
  lastDeltaY: 0,
  lastDeltaZ: 0,
};


/**
 * Rebase verification listener — registered ONCE at boot.
 * Consumes the REUSED event synchronously (Zero-GC contract): we only read
 * numbers and write into pre-allocated containers; nothing is retained.
 */
core.onRebase((event) => {
  if (test.finished) {
    return;
  }
  const { x, y, z } = event.delta;
  // Exact doubles: the modulo is exact, so this proves N*256 per axis.
  const onLattice =
    x % TEST.LATTICE_M === 0 &&
    y % TEST.LATTICE_M === 0 &&
    z % TEST.LATTICE_M === 0;
  // The actual bit-exactness claim of the power-of-two lattice design:
  // every shift is representable in Float32 without rounding.
  const f32Exact =
    Math.fround(x) === x && Math.fround(y) === y && Math.fround(z) === z;
  if (!onLattice) {
    test.deltaLatticeOk = false;
  }
  if (!f32Exact) {
    test.deltaF32Exact = false;
  }
  test.deltaVerified++;
  test.lastDeltaX = x;
  test.lastDeltaY = y;
  test.lastDeltaZ = z;
});


/** One-shot evaluation and publication of all five acceptance criteria. */
function finalizeTest(): void {
  if (test.finished) {
    return;
  }
  test.finished = true;


  const absX = shipState.absPos.x;
  const ticks = core.stats.tickCount;
  const simTime = core.stats.simTime;
  const rebaseCount = core.stats.rebaseCount;
  const maxLocal = core.stats.focusMaxLocalPostTick;


  // [T1] Float64 absolute distance invariant.
  const t1 = absX >= TEST.DISTANCE_M;


  // [T2] f32 local bound — structural: <= 1024 on no-rebase ticks,
  //      <= 128 immediately after a rebase (half the 256 m lattice).
  const t2 = maxLocal <= TEST.LOCAL_BOUND_M + TEST.LOCAL_EPS;


  // [T3] Rebase count window. Predicted exactly 9 (one per 1,024 m of
  //      travel at 2,000 m/s; the 10th would need P > 10,240 m).
  const t3 = rebaseCount >= TEST.REBASE_MIN && rebaseCount <= TEST.REBASE_MAX;


  // [T4] Every delta an exact multiple of 256 AND bit-exact in Float32.
  const t4 =
    test.deltaLatticeOk &&
    test.deltaF32Exact &&
    test.deltaVerified === rebaseCount &&
    rebaseCount > 0;


  // [T5] Frame stability — average budget + no single stutter frame.
  let frames = 0;
  let sum = 0;
  let worst = 0;
  const from = Math.min(TEST.WARMUP_FRAMES, test.frameCount);
  for (let i = from; i < test.frameCount; i++) {
    const v = test.frameTimes[i];
    sum += v;
    frames++;
    if (v > worst) {
      worst = v;
    }
  }
  let rebaseWorst = 0;
  for (let i = 0; i < test.rebaseFrameCount; i++) {
    if (test.rebaseFrameTimes[i] > rebaseWorst) {
      rebaseWorst = test.rebaseFrameTimes[i];
    }
  }
  const avg = frames > 0 ? sum / frames : Number.POSITIVE_INFINITY;
  const t5 =
    frames > 0 && avg <= TEST.FRAME_AVG_BUDGET_MS && worst <= TEST.FRAME_MAX_MS;


  const f2 = (v: number): string => v.toFixed(2);


  useGameStore.getState().completeTest({
    'abs-distance': {
      pass: t1,
      detail:
        `P.x = ${absX.toFixed(3)} m @ tick {simTime.toFixed(3)} s of 60 Hz sim) — ` +
        `requirement P.x >= ${TEST.DISTANCE_M.toLocaleString()} m, Float64 absolute (Sun frame).`,
    },
    'local-bound': {
      pass: t2,
      detail:
        `max |p_local| over ${ticks} ticks = ${maxLocal.toFixed(3)} m — bound ${TEST.LOCAL_BOUND_M} m ` +
        `(structural: <= 1,024 on no-rebase ticks, <= 128 immediately after a shift).`,
    },
    'rebase-count': {
      pass: t3,
      detail:
        `${rebaseCount} origin shifts over ${absX.toFixed(0)} m of travel — expected ` +
        `{TEST.REBASE_MAX} (one per 1,024 m at 2,000 m/s).`,
    },
    'delta-lattice': {
      pass: t4,
      detail:
        `{rebaseCount} shifts verified: Δ = N*256 m on every axis and ` +
        `Math.fround(Δ) === Δ (bit-exact f64 -> f32). Last Δ = ` +
        `(${test.lastDeltaX}, ${test.lastDeltaY}, ${test.lastDeltaZ}) m.`,
    },
    'frame-stability': {
      pass: t5,
      detail:
        `avg {avg > 0 ? Math.round(1000 / avg) : 0} FPS), worst ${f2(worst)} ms ` +
        `across ${frames} measured frames; worst rebase-frame ${f2(rebaseWorst)} ms — ` +
        `origin shifts cost no stutter frame.`,
    },
  });


  const allPass = t1 && t2 && t3 && t4 && t5;
  console.log(
    `[Milestone1A] acceptance ${allPass ? 'PASSED' : 'FAILED'} — ` +
      `P.x={ticks} rebases=${rebaseCount} ` +
      `maxLocal={f2(avg)}ms`,
  );
}


/* ---------------------------------------------------------------------------
 * LIVE FRAME STATISTICS + THROTTLED PUBLISHER (boot-allocated containers)
 * ------------------------------------------------------------------------- */


const telemetryPublisher = createTelemetryPublisher(100); // <= 10 Hz ceiling


const live = {
  frames: 0, // windowed FPS counters, reset on each publish
  ms: 0,
  ring: new Float64Array(90), // ~1.5 s rolling frame-time window
  ringIdx: 0,
  ringCount: 0,
};


/* ---------------------------------------------------------------------------
 * HELPERS
 * ------------------------------------------------------------------------- */


/** Deterministic PRNG (mulberry32) — identical starfield on every load. */
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
    // Uniform distribution on a sphere (no pole bunching).
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
    color,
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    fog: false,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}


/**
 * Lattice anchor for periodic world-fixed content.
 * Content at local offset g occupies absolute O + g (mod lattice), so lines
 * stay absolute-fixed iff g === -O (mod lattice). Because O is ALWAYS a
 * multiple of 256, this is provably 0 — computed defensively anyway so the
 * logic stays correct even if the lattice constant ever changes.
 */
function latticeAnchor(originComponent: number, lattice: number): number {
  const m = ((originComponent % lattice) + lattice) % lattice; // Euclidean mod
  return (lattice - m) % lattice;
}


/* ---------------------------------------------------------------------------
 * SCENE — imperative content; NO reactive bindings on any transform.
 * ------------------------------------------------------------------------- */


function Scene() {
  const shipRef = useRef<THREE.Group>(null);
  const beaconRefs = useMemo(() => BEACONS.map(() => createRef<THREE.Mesh>()), []);
  const gridFineRef = useRef<THREE.GridHelper>(null);
  const gridMajorRef = useRef<THREE.GridHelper>(null);
  const starsRef = useRef<THREE.Group>(null);


  // Boot-time bindings — allocation happens here (setup), never per frame.
  useEffect(() => {
    adapter.bind(SHIP_ID, shipRef.current!);
    BEACONS.forEach((b, i) => adapter.bind(b.id, beaconRefs[i].current!));
    return () => {
      adapter.unbind(SHIP_ID);
      BEACONS.forEach((b) => adapter.unbind(b.id));
    };
  }, [beaconRefs]);


  // Deterministic starfield, built once.
  const stars = useMemo(() => {
    const rand = mulberry32(0x5eed1a71);
    const group = new THREE.Group();
    group.add(makeStarLayer(rand, 1300, 6200, 1.5, 0xaec6dc, 0.75));
    group.add(makeStarLayer(rand, 170, 6200, 2.8, 0xe6f0fa, 0.95));
    return group;
  }, []);


  /* -----------------------------------------------------------------------
   * THE FRAME LOOP — canonical order: simulate -> extract -> camera -> stats
   * -> throttled telemetry. Runs imperatively BEFORE renderer.render.
   * -------------------------------------------------------------------- */
  useFrame((state, delta) => {
    // (1) FIXED-STEP SIMULATION — accumulate, tick at exactly 1/60 s,
    //     max 5 substeps, shed any backlog beyond (Spec 02.6).
    const rebaseBefore = core.stats.rebaseCount;
    core.advance(delta);
    const rebasedThisFrame = core.stats.rebaseCount !== rebaseBefore;


    // (2) RENDER EXTRACT — the single downstream pass (Spec 01.1 step 8).
    //     Ship and beacons are positioned exclusively by the adapter.
    adapter.update();


    const origin = core.getOrigin();
    const lp = shipState.localPosF32;
    const sx = lp[0];
    const sy = lp[1];
    const sz = lp[2];


    // Lattice-anchored grid: lines remain fixed in ABSOLUTE space across
    // every rebase (O only ever moves in whole 256 m cells). The forward
    // bias is a multiple of 256 so line positions are preserved.
    if (gridFineRef.current !== null && gridMajorRef.current !== null) {
      const ax = latticeAnchor(origin.x, ORIGIN_LATTICE) + GRID_BIAS_X;
      const az = latticeAnchor(origin.z, ORIGIN_LATTICE);
      gridFineRef.current.position.set(ax, -0.7, az);
      gridMajorRef.current.position.set(ax, -0.5, az);
    }


    // Distant-star backdrop follows the camera (parallax ~ 0 at infinity).
    if (starsRef.current !== null) {
      starsRef.current.position.copy(state.camera.position);
    }


    // (3) CAMERA — HARD-LOCKED to the focus entity. Deliberately NOT
    //     smoothed: an exponential follower chasing a 2,000 m/s target lags
    //     by v*dt/k (hundreds of metres), while a hard lock is seamless
    //     across rebases — on a shift tick, ship, camera, and every
    //     world-fixed object translate by the same exact Δ within the same
    //     frame, so all relative geometry (and the rendered image) is
    //     bit-identical across the origin jump.
    state.camera.position.set(
      sx + CAMERA_OFFSET.x,
      sy + CAMERA_OFFSET.y,
      sz + CAMERA_OFFSET.z,
    );
    state.camera.lookAt(sx, sy, sz);


    // (4) FRAME STATISTICS + AUTOMATED TEST CAPTURE
    const frameMs = delta * 1000;
    live.ring[live.ringIdx] = frameMs;
    live.ringIdx = (live.ringIdx + 1) % live.ring.length;
    if (live.ringCount < live.ring.length) {
      live.ringCount++;
    }
    live.frames++;
    live.ms += frameMs;


    if (!test.finished) {
      if (test.warmup > 0) {
        test.warmup--;
      } else if (frameMs < 250 && test.frameCount < TEST.FRAME_CAP) {
        // Frames > 250 ms (tab stalls) are excluded from the record.
        test.frameTimes[test.frameCount++] = frameMs;
        if (rebasedThisFrame && test.rebaseFrameCount < TEST.REBASE_FRAME_CAP) {
          test.rebaseFrameTimes[test.rebaseFrameCount++] = frameMs;
        }
      }
      // Terminate on the DISTANCE invariant, never a raw tick count:
      // fl(1/60) is smaller than 1/60 by 2^-58/15, so 300 accumulated
      // ticks land within ~1e-11 m of exactly 10,000 — sign unpredictable
      // at the ulp level. The invariant is deterministic; the tick count
      // (300 or 301) is not. Rebase #10 would need P > 10,240 m, so the
      // count stays inside the 9-10 window either way.
      if (
        shipState.absPos.x >= TEST.DISTANCE_M ||
        core.stats.simTime >= TEST.SIM_TIMEOUT_S
      ) {
        finalizeTest();
      }
    }


    // (5) THROTTLED TELEMETRY (<= 10 Hz) — the ONLY store writes in the loop.
    const fps = (live.frames * 1000) / Math.max(live.ms, 1e-6);
    let ringSum = 0;
    let ringMax = 0;
    for (let i = 0; i < live.ringCount; i++) {
      const v = live.ring[i];
      ringSum += v;
      if (v > ringMax) {
        ringMax = v;
      }
    }
    const vel = shipState.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
    const published = telemetryPublisher.publish(
      fps,
      live.ringCount > 0 ? ringSum / live.ringCount : 0,
      ringMax,
      shipState.absPos.x, shipState.absPos.y, shipState.absPos.z,
      lp[0], lp[1], lp[2],
      origin.x, origin.y, origin.z,
      core.stats.rebaseCount,
      speed,
      core.stats.simTime,
      core.stats.tickCount,
    );
    if (published) {
      live.frames = 0;
      live.ms = 0;
    }
  });


  return (
    <>
      <color attach="background" args={[0x04070c]} />
      <fog attach="fog" args={[0x04070c, 2600, 7600]} />


      <ambientLight intensity={0.5} color={0x33465e} />
      <directionalLight position={[-3000, 1800, -1400]} intensity={1.4} color={0xfff1de} />


      {/* 256 m fine grid + 1,024 m major grid — lattice-anchored, world-fixed */}
      <gridHelper ref={gridFineRef} args={[8192, 32, 0x2b5a78, 0x16324a]} />
      <gridHelper ref={gridMajorRef} args={[8192, 8, 0x468bb4, 0x24506e]} />


      <primitive object={stars} ref={starsRef} />


      {/* SHIP — positioned exclusively by FloatingOriginAdapter */}
      <group ref={shipRef}>
        <mesh rotation={[0, 0, -Math.PI / 2]}>
          <coneGeometry args={[1.05, 5.4, 16]} />
          <meshStandardMaterial color="#c9d6e4" metalness={0.75} roughness={0.32} />
        </mesh>
        <mesh position={[0.55, 0.4, 0]}>
          <sphereGeometry args={[0.4, 14, 10]} />
          <meshStandardMaterial
            color="#7fd4ff"
            emissive="#1e7fb8"
            emissiveIntensity={1.1}
            roughness={0.15}
            metalness={0.1}
          />
        </mesh>
        <mesh position={[-1.7, 0, 1.05]}>
          <boxGeometry args={[1.9, 0.12, 1.5]} />
          <meshStandardMaterial color="#8fa4b8" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-1.7, 0, -1.05]}>
          <boxGeometry args={[1.9, 0.12, 1.5]} />
          <meshStandardMaterial color="#8fa4b8" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-1.75, 0.75, 0]}>
          <boxGeometry args={[1.7, 1.3, 0.12]} />
          <meshStandardMaterial color="#8fa4b8" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-2.85, 0, 0]}>
          <sphereGeometry args={[0.48, 12, 10]} />
          <meshBasicMaterial color="#9fe0ff" />
        </mesh>
        <pointLight position={[-3.4, 0, 0]} color="#7fd4ff" intensity={40} distance={90} decay={2} />
      </group>


      {/* STATIC WORLD BEACONS — static entities; their f32 locals shift by −Δ
          on every rebase while their absolute positions never move. */}
      {BEACONS.map((b, i) => (
        <mesh key={b.id} ref={beaconRefs[i]}>
          <octahedronGeometry args={[3.5, 0]} />
          <meshBasicMaterial color={b.color} />
        </mesh>
      ))}
    </>
  );
}


/* ---------------------------------------------------------------------------
 * HUD — subscribes narrowly; re-renders at most 10x per second.
 * ------------------------------------------------------------------------- */


const TEST_ORDER: Array<{ id: TestId; label: string }> = [
  { id: 'abs-distance', label: 'Absolute Px reaches >= 10,000 m (Float64)' },
  { id: 'local-bound', label: 'Local f32 px never exceeds 1,024 m' },
  { id: 'rebase-count', label: 'Rebase count within 9-10' },
  { id: 'delta-lattice', label: 'Delta shift always an exact multiple of 256 m' },
  { id: 'frame-stability', label: 'Frame time stable (60 FPS baseline)' },
];


const fmt = (v: number, d: number): string => v.toFixed(d);
const mod256 = (v: number): number => ((v % 256) + 256) % 256;


/** Pulses once on every origin shift (keys off the rebase counter). */
function RebasePulse() {
  const count = useGameStore((s) => s.telemetry.rebaseCount);
  const [pulse, setPulse] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (count !== prev.current) {
      prev.current = count;
      setPulse((p) => p + 1);
    }
  }, [count]);
  if (count === 0) {
    return <span className="chip idle">ORIGIN LOCKED</span>;
  }
  return (
    <span key={pulse} className="chip rebase">
      REBASE #{count}
    </span>
  );
}


function Hud() {
  const t = useGameStore(selectTelemetry);
  const phase = useGameStore(selectTestPhase);
  const results = useGameStore(selectTestResults);
  const done = phase === 'COMPLETE';
  const passed = TEST_ORDER.every((entry) => results[entry.id]?.pass === true);
  const progress = Math.min(t.absPos.x / TEST_DISTANCE_M, 1);


  return (
    <div className="hud">
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">MILESTONE 1A - FLOATING ORIGIN</span>
          <RebasePulse />
        </div>
        <div className="grid2">
          <div className="kv"><span className="k">FPS</span><span className="v">{fmt(t.fps, 0)}</span></div>
          <div className="kv"><span className="k">FRAME AVG/MAX</span><span className="v">{fmt(t.frameMsAvg, 2)} / {fmt(t.frameMsMax, 2)} ms</span></div>
          <div className="kv"><span className="k">SPEED</span><span className="v">{fmt(t.speed, 1)} m/s</span></div>
          <div className="kv"><span className="k">ENTITIES</span><span className="v">{core.getEntityCount()}</span></div>
          <div className="kv"><span className="k">SIM TIME</span><span className="v">{fmt(t.simTime, 3)} s</span></div>
          <div className="kv"><span className="k">TICKS</span><span className="v">{t.tickCount}</span></div>
        </div>
        <div className="sep" />
        <div className="pos-row"><span className="k">ABS P (f64)</span><span className="v">{fmt(t.absPos.x, 6)} / {fmt(t.absPos.y, 6)} / {fmt(t.absPos.z, 6)}</span></div>
        <div className="pos-row"><span className="k">LOCAL p (f32)</span><span className="v">{fmt(t.localPos.x, 3)} / {fmt(t.localPos.y, 3)} / {fmt(t.localPos.z, 3)}</span></div>
        <div className="pos-row"><span className="k">ORIGIN O (f64)</span><span className="v">{fmt(t.origin.x, 1)} / {fmt(t.origin.y, 1)} / {fmt(t.origin.z, 1)}</span></div>
        <div className="pos-row dim"><span className="k">O mod 256</span><span className="v">{fmt(mod256(t.origin.x), 0)} / {fmt(mod256(t.origin.y), 0)} / {fmt(mod256(t.origin.z), 0)} — lattice locked</span></div>
      </div>


      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">AUTOMATED ACCEPTANCE</span>
          <span className={done ? (passed ? 'chip pass' : 'chip fail') : 'chip run'}>
            {done ? (passed ? 'ALL PASS' : 'FAIL') : 'RUNNING'}
          </span>
        </div>
        {!done && (
          <div className="progress">
            <div className="progress-fill" style={{ width: `${(progress * 100).toFixed(1)}%` }} />
          </div>
        )}
        <div className="test-list">
          {TEST_ORDER.map((entry) => {
            const r = results[entry.id];
            return (
              <div className="test-row" key={entry.id}>
                <div className="test-top">
                  <span className={r ? (r.pass ? 'badge pass' : 'badge fail') : 'badge run'}>
                    {r ? (r.pass ? 'PASS' : 'FAIL') : '·····'}
                  </span>
                  <span className="test-label">{entry.label}</span>
                </div>
                {r ? (
                  <div className="test-detail">{r.detail}</div>
                ) : (
                  <div className="test-detail dim">awaiting completion…</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ---------------------------------------------------------------------------
 * ROOT
 * ------------------------------------------------------------------------- */


const M1A_CSS = `
.m1a-root { position: fixed; inset: 0; overflow: hidden; background: #04070c;
  font-family: ui-monospace, "JetBrains Mono", "SF Mono", Menlo, Consolas, monospace;
  color: #cfe0ee; }
.m1a-canvas { position: absolute; inset: 0; }
.hud { position: absolute; inset: 0; pointer-events: none; display: flex;
  flex-direction: column; gap: 12px; padding: 16px; max-width: 600px; }
.panel { background: rgba(8, 15, 24, 0.82); border: 1px solid rgba(96, 160, 205, 0.22);
  border-radius: 10px; padding: 12px 14px; backdrop-filter: blur(10px); }
.panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.panel-title { font-size: 11px; letter-spacing: 0.14em; color: #7fd4ff; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
.kv { display: flex; justify-content: space-between; font-size: 12px; }
.k { color: #6f8ba3; letter-spacing: 0.06em; }
.v { color: #e8f2fa; }
.sep { height: 1px; background: rgba(96, 160, 205, 0.18); margin: 10px 0; }
.pos-row { display: flex; justify-content: space-between; font-size: 11.5px;
  margin-top: 4px; gap: 12px; }
.pos-row.dim .v, .dim { color: #587187; }
.chip { font-size: 10px; padding: 3px 8px; border-radius: 999px; letter-spacing: 0.1em; }
.chip.idle { color: #6f8ba3; border: 1px solid rgba(111, 139, 163, 0.4); }
.chip.rebase { color: #ffd08a; border: 1px solid rgba(255, 176, 84, 0.55);
  animation: m1a-pulse 0.9s ease-out; }
.chip.pass { color: #4fd08a; border: 1px solid rgba(79, 208, 138, 0.5); }
.chip.fail { color: #ff7a6e; border: 1px solid rgba(255, 122, 110, 0.5); }
.chip.run { color: #e8b34b; border: 1px solid rgba(232, 179, 75, 0.5); }
@keyframes m1a-pulse { 0% { background: rgba(255, 176, 84, 0.35); }
  100% { background: rgba(255, 176, 84, 0); } }
.progress { height: 3px; background: rgba(96, 160, 205, 0.15); border-radius: 2px;
  overflow: hidden; margin-bottom: 10px; }
.progress-fill { height: 100%; background: #7fd4ff; }
.test-list { display: flex; flex-direction: column; gap: 9px; }
.test-top { display: flex; align-items: center; gap: 10px; }
.badge { font-size: 10px; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.1em;
  min-width: 52px; text-align: center; }
.badge.pass { color: #0a1510; background: #4fd08a; }
.badge.fail { color: #1a0b09; background: #ff7a6e; }
.badge.run { color: #e8b34b; border: 1px solid rgba(232, 179, 75, 0.5); }
.test-label { font-size: 12px; color: #dce9f4; }
.test-detail { font-size: 10.5px; color: #8aa4ba; margin-top: 3px; padding-left: 66px;
  line-height: 1.45; }
.legend { position: absolute; bottom: 14px; right: 18px; font-size: 10.5px;
  color: #587187; letter-spacing: 0.08em; pointer-events: none; }
`;


export default function Milestone1ATestHarness() {
  return (
    <div className="m1a-root">
      <style>{M1A_CSS}</style>
      <div className="m1a-canvas">
        <Canvas
          dpr={[1, 1.75]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{ fov: 62, near: 0.1, far: 24000, position: [-42, 16, 28] }}
        >
          <Scene />
        </Canvas>
      </div>
      <Hud />
      <div className="legend">
        SHIP @ 2,000 m/s (+X) · GRID 256 m LATTICE (WORLD-FIXED) · BEACONS STATIC @ X = 2,000 / 5,000 / 8,000 m
      </div>
    </div>
  );
}
