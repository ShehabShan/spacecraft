// T1 play page. B4c: the static moon on screen. B5c: the game shell —
// InputState + shell runtime on the canvas, overlays via PlayShell, the frame
// loop gated by the store phase. One world per page load (main.tsx full-load
// rule); nothing under src/play may import the harness tree (§4.1) — the K10
// leakage grep in §15.3 enforces it.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { MultiCameraRig } from '../render/MultiCameraRig';
import { createMoonWorld, type MoonWorld } from './world/moonWorld';
import { parseSpawnOverride } from './world/spawn';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { createPlayFrame } from './frame/playFrame';
import { InputState } from './input/InputState';
import { attachShellRuntime } from './ui/shellRuntime';
import { usePlayStore } from './ui/playStore';
import { PlayShell } from './ui/PlayShell';

function Scene({ world, input, onFrame }: { world: MoonWorld; input: InputState; onFrame: (delta: number) => void }) {
  const { scene, gl } = useThree();
  const primed = useRef(2);
  // WHY: harness Scene() 1568–1581 line by line — attach the pool meshes to
  // the moon-fixed group, prime every geometry for two rendered frames so
  // WebGLGeometries registers them all at boot (frozen geometry count), then
  // unprime. No adapter.bind: playFrame (stage 6) writes characterRoot itself.
  useEffect(() => {
    world.pool.attach(world.spinGroup as unknown as THREE.Scene);
    world.pool.primeAll();
    primed.current = 2;
  }, [scene, gl, world]);
  useEffect(() => {
    // WHY (B5c decision): no worker-error hook — TerrainMeshPool keeps its
    // workers private and already logs worker errors; exposing them means a
    // shared render-module edit (+ m1X regression) for a V1 edge case. Context
    // loss, lock, visibility are wired; worker → ERROR is deferred (plan §10.2).
    const canvas = gl.domElement;
    input.attach(canvas);
    const detachShell = attachShellRuntime({ canvas, doc: document }, input, usePlayStore);
    return () => { detachShell(); input.detach(); };
  }, [gl, input]);
  useFrame(() => {
    if (primed.current > 0) {
      primed.current--;
      if (primed.current === 0) world.pool.unprimeAll();
    }
  }, 0);
  return (
    <>
      <primitive object={world.sceneRoot} />
      <MultiCameraRig onFrame={onFrame} />
    </>
  );
}

export default function PlayPage(): JSX.Element {
  const { world, input, onFrame } = useMemo(() => {
    const w = createMoonWorld({ spawnOverride: parseSpawnOverride(window.location.search) });
    const cam = new ThirdPersonCamera();
    cam.frameToward(w.kcc, w.earthDir, w.earthDist);
    const inp = new InputState();
    const frame = createPlayFrame(w, cam, { input: inp, store: usePlayStore });
    // WHY (B7c decision): read-only test probe for tools/check-play-b7.mjs,
    // opt-in via ?probe=1 only — absent by default, no behaviour change.
    if (new URLSearchParams(window.location.search).get('probe') === '1') {
      (window as unknown as { __playProbe?: unknown }).__playProbe = { kcc: w.kcc, core: w.core, world: w, frame, cam };
    }
    return { world: w, input: inp, onFrame: frame };
  }, []);
  useEffect(() => () => world.dispose(), [world]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      {/* WHY: Canvas props copied from the M1F harness (1763–1767); the rig
          owns the per-band cameras, this camera is only R3F's default. */}
      <Canvas
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ fov: 62, near: 0.1, far: 3000, position: [0, 50, 200] }}
      >
        <Scene world={world} input={input} onFrame={onFrame} />
      </Canvas>
      <PlayShell input={input} />
    </div>
  );
}