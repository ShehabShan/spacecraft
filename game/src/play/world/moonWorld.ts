// T1 play world bootstrap (plan §6.3 steps 1–9, §6.4 teardown, B4a). Called
// once per page load from PlayPage's useMemo; nothing runs at import. Values
// and scene setup port the M1F harness (~109–154, 435–513, 569–572) by value
// — the harness is never imported (K10).
import * as THREE from 'three';
import { SimulationCore } from '../../core/simulation/SimulationCore';
import { FloatingOriginAdapter } from '../../render/FloatingOriginAdapter';
import { initTerrainField } from '../../core/terrain/terrainField';
import { AstronautKCC } from '../../core/physics/astronautKCC';
import type { Vec3 } from '../../core/physics/sphericalFrame';
import { TerrainMeshPool, type ChunkRecord } from '../../render/TerrainMeshPool';
import { SkyImpostorPool } from '../../render/SkyImpostorPool';
import { NEAR_BIT } from '../../render/MultiCameraRig';
import {
  MAX_TERRAIN_H, MOON_ASTRONAUT, MOON_PARAMS, MOON_R, PLAY_POOL_OPTS,
} from './moonConfig';
import { findEarthriseSpawn } from './spawn';
import { createMoonTerrainMaterial, type MoonTerrainMaterial } from './moonMaterial';
import { MoonLod, type LodPool } from './MoonLod';
import { EARTH_R, PLAY_BODIES, type SkyCtx } from './skyState';
import type { CharacterAnimator } from '../character/CharacterAnimator';
import { ProceduralAnimator } from '../character/ProceduralAnimator';
import { buildAstronautRig } from '../character/AstronautRig';

/** The pool surface the play world uses: the LOD subset + frame/teardown. */
// WHY (B4c): attach/primeAll/unprimeAll join the surface because PlayPage
// mounts and primes the pool exactly as the harness Scene() does (1568–1581).
export type PlayPool = LodPool
  & Pick<TerrainMeshPool, 'pump' | 'disposeAll' | 'attach' | 'primeAll' | 'unprimeAll'> & {
  readonly records: ChunkRecord[];
};

export interface MoonWorldOptions {
  /** Moon-fixed spawn direction (e.g. parseSpawnOverride); null → search. */
  spawnOverride: Vec3 | null;
  /** WHY: TerrainMeshPool spawns Web Workers in its constructor, so Node
   *  tests inject a fake (B4a split decision). Default = the real pool. */
  makePool?: () => PlayPool;
}

export const PLAY_ENTITY_ID = 'play-astronaut';

export interface MoonWorld extends SkyCtx {
  adapter: FloatingOriginAdapter;
  /** The KCC's core entity (render-local `localPosF32` after adapter.update). */
  astroState: ReturnType<SimulationCore['registerEntity']>;
  pool: PlayPool;
  /** T3 S3 terrain material (mare albedo); stage 6 calls setFrame. */
  terrainMaterial: MoonTerrainMaterial;
  lod: MoonLod;
  sceneRoot: THREE.Group;
  spinGroup: THREE.Group;
  skyGroup: THREE.Group;
  earthDir: Vec3;
  sunDir: Vec3;
  spawnDir: Vec3;
  /** Character animator; its root hangs under characterRoot (§7.4). */
  animator: CharacterAnimator;
  /** Teleport the KCC back to the spawn site (R key, §10). */
  respawnPlayer(): void;
  /** §6.4 teardown — workers, meshes, GPU resources, the entity. */
  dispose(): void;
}

export function createMoonWorld(opts: MoonWorldOptions): MoonWorld {
  // 1. terrain field singleton (one world per page load — main.tsx rule)
  initTerrainField(MOON_PARAMS);
  // 2–3. frozen rails + floating origin
  const core = new SimulationCore();
  core.setTimeScale(0);
  const adapter = new FloatingOriginAdapter(core);
  // 4–5. terrain pool (workers spawn here) + sky impostors
  // WHY (T3 S3, ADR-029): the pool owns and disposes the material.
  const terrainMaterial = createMoonTerrainMaterial(MOON_PARAMS.moon);
  const pool: PlayPool = opts.makePool !== undefined
    ? opts.makePool()
    : new TerrainMeshPool({ ...PLAY_POOL_OPTS, params: MOON_PARAMS, material: terrainMaterial.material });
  const sky = new SkyImpostorPool();
  // 6. astronaut KCC + entity write-through
  const kcc = new AstronautKCC(MOON_ASTRONAUT);
  const astroState = core.registerEntity(PLAY_ENTITY_ID, { absPos: { x: 0, y: 0, z: 0 }, dynamic: false });
  core.setFocusEntity(PLAY_ENTITY_ID);
  kcc.attachWriteThrough(astroState.absPos, astroState.velocity);
  // 7. f64 sky geometry from the frozen rails (harness 141–154)
  const earthState = core.getCelestialState('earth');
  const moonState = core.getCelestialState('moon');
  if (earthState === null || moonState === null) throw new Error('rail states missing');
  const earthVec = {
    x: earthState.absPos.x - moonState.absPos.x,
    y: earthState.absPos.y - moonState.absPos.y,
    z: earthState.absPos.z - moonState.absPos.z,
  };
  const earthDist = Math.hypot(earthVec.x, earthVec.y, earthVec.z);
  const earthDir = { x: earthVec.x / earthDist, y: earthVec.y / earthDist, z: earthVec.z / earthDist };
  const sunL = Math.hypot(moonState.absPos.x, moonState.absPos.y, moonState.absPos.z);
  const sunDir = { x: -moonState.absPos.x / sunL, y: -moonState.absPos.y / sunL, z: -moonState.absPos.z / sunL };
  // 8. spawn (~160 ms search unless overridden)
  const sd = opts.spawnOverride ?? findEarthriseSpawn(earthDir, sunDir).dir;
  const spawnDir = { x: sd.x, y: sd.y, z: sd.z };
  kcc.teleportSurface(spawnDir.x, spawnDir.y, spawnDir.z);
  // WHY (B4c fix): the KCC write-through into the entity only runs inside
  // kcc.update(), and nothing ticks before B5's controller stage — so the
  // entity stayed at (0,0,0) and the origin never rebased (camera inside the
  // moon). Seed the entity from the KCC and tick once: the tick (time scale 0)
  // rebases to the spawn's 256 m lattice and extracts localPosF32 (§3 order kept).
  const syncEntity = (): void => {
    const a = astroState.absPos, v = astroState.velocity;
    a.x = kcc.absPos.x; a.y = kcc.absPos.y; a.z = kcc.absPos.z;
    v.x = kcc.absVel.x; v.y = kcc.absVel.y; v.z = kcc.absVel.z;
    core.tick();
  };
  syncEntity();

  // 9. scene graph (harness 435–453, 471–513, 569–572) — boot-only allocation
  const sceneRoot = new THREE.Group();
  const spinGroup = new THREE.Group();   // moon-fixed: terrain, shell
  const skyGroup = new THREE.Group();    // moon-centred inertial: Earth, glow, stars
  sceneRoot.add(spinGroup, skyGroup);
  const sunLight = new THREE.DirectionalLight(0xfff1de, 2.2);
  sunLight.position.set(sunDir.x * 8000, sunDir.y * 8000, sunDir.z * 8000);
  const earthLight = new THREE.DirectionalLight(0x8fb4e8, 0.28);
  earthLight.position.set(earthDir.x * 8000, earthDir.y * 8000, earthDir.z * 8000);
  sceneRoot.add(sunLight, sunLight.target, earthLight, earthLight.target,
    new THREE.AmbientLight(0x2a3850, 0.5));
  const shell = new THREE.Mesh(                 // core shell (no see-through)
    new THREE.SphereGeometry(MOON_R - MAX_TERRAIN_H - 40, 40, 28),
    new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 1 }),
  );
  spinGroup.add(shell);
  const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), makeEarthMaterial(sunDir));
  skyGroup.add(earthMesh);
  const glow = SkyImpostorPool.makeGlowQuad(1);
  skyGroup.add(glow, sky.stars, sky.mesh);
  // WHY: render-local character anchor; the AstronautRig (§7, B6) mounts here.
  const characterRoot = new THREE.Group();
  characterRoot.name = 'characterRoot';
  characterRoot.layers.mask = NEAR_BIT;
  sceneRoot.add(characterRoot);
  // WHY (B9c): the animator is built here, not in PlayPage, so the page, the
  // Node tests and any future GLB animator share one mount point behind the
  // K13 seam (CharacterAnimator). Stage 6 places characterRoot.
  const animator: CharacterAnimator = new ProceduralAnimator(buildAstronautRig(MOON_ASTRONAUT.groundClearance));
  characterRoot.add(animator.root);
  // MoonLod samples terrainHeight at construction → after step 1.
  const lod = new MoonLod(pool, MOON_R);

  const world: MoonWorld = {
    core, adapter, astroState, kcc, sky, pool, terrainMaterial, lod, moonAbs: moonState.absPos, earthVec, earthDist,
    earthMesh, glow, characterRoot, sceneRoot, spinGroup, skyGroup, earthDir, sunDir, spawnDir, animator,
    respawnPlayer() { kcc.teleportSurface(spawnDir.x, spawnDir.y, spawnDir.z); syncEntity(); },
    dispose() {
      pool.disposeAll();
      disposeMesh(sky.mesh); disposeMesh(sky.stars);
      disposeMesh(shell); disposeMesh(earthMesh); disposeMesh(glow);
      animator.dispose();
      core.unregisterEntity(PLAY_ENTITY_ID);
    },
  };
  return world;
}

function disposeMesh(m: THREE.Mesh | THREE.Points | THREE.InstancedMesh): void {
  m.geometry.dispose();
  const mat = m.material;
  if (Array.isArray(mat)) for (const x of mat) x.dispose(); else mat.dispose();
}

// WHY: harness Earth hero ShaderMaterial (~474–511) verbatim (Lambert + rim,
// value-noise land); uSun is the frozen Sun direction.
function makeEarthMaterial(sunDir: Vec3): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSun: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z) },
      uOcean: { value: new THREE.Color(0x1b4d8f) },
      uLand: { value: new THREE.Color(0x5d7a4a) },
    },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uSun; uniform vec3 uOcean; uniform vec3 uLand;
      varying vec3 vN; varying vec3 vV;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float vnoise(vec3 p){
        vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        float a = hash(i), b = hash(i+vec3(1,0,0)), c = hash(i+vec3(0,1,0)), d = hash(i+vec3(1,1,0));
        float e = hash(i+vec3(0,0,1)), g = hash(i+vec3(1,0,1)), h = hash(i+vec3(0,1,1)), k = hash(i+vec3(1,1,1));
        return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z);
      }
      void main() {
        vec3 n = normalize(vN);
        float m = 0.6*vnoise(n*3.1) + 0.3*vnoise(n*7.7) + 0.1*vnoise(n*19.3);
        vec3 col = mix(uOcean, uLand, smoothstep(0.52, 0.57, m));
        col = mix(col, vec3(0.93), smoothstep(0.70, 0.88, abs(n.y)));
        float lam = clamp(dot(n, uSun), 0.0, 1.0);
        float rim = pow(1.0 - clamp(dot(n, normalize(vV)), 0.0, 1.0), 2.5);
        col = col * (0.03 + 0.97 * lam) + vec3(0.30, 0.44, 0.66) * rim * (0.15 + 0.85 * lam) * 0.85;
        gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.0);
      }`,
  });
}