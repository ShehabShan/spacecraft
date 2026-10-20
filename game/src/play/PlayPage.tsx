// T1 play page, B4c: the static moon on screen. One world per page load
// (main.tsx full-load rule); nothing under src/play may import the harness
// tree (§4.1) — the K10 leakage grep in §15.3 enforces it.
// Game shell (loading, click-to-play, pause, error) arrives in B5.
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { MultiCameraRig } from '../render/MultiCameraRig';
import { createMoonWorld, type MoonWorld } from './world/moonWorld';
import { parseSpawnOverride } from './world/spawn';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera';
import { createPlayFrame } from './frame/playFrame';

function Scene({ world, onFrame }: { world: MoonWorld; onFrame: (delta: number) => void }) {
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
  const { world, onFrame } = useMemo(() => {
    const w = createMoonWorld({ spawnOverride: parseSpawnOverride(window.location.search) });
    const cam = new ThirdPersonCamera();
    cam.reset(w.kcc, w.earthDir);
    return { world: w, onFrame: createPlayFrame(w, cam) };
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
        <Scene world={world} onFrame={onFrame} />
      </Canvas>
      <a href="/" style={{ position: 'absolute', top: 12, left: 12, color: '#aec6dc',
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 }}>← menu</a>
    </div>
  );
}