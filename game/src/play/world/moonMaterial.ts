// T3 S3: play terrain material — a darker basalt mare from the basin mask.
// WHY (ADR-029): shader injection into MeshStandardMaterial, no new vertex
// attribute. The worker chunk format, TerrainMeshPool and the core stay
// untouched; the mask is recomputed per vertex from the moon-fixed direction
// with the same smoothstep as terrainField `basinsInto` (test-moon-material
// pins the mirror against `moonMareMask`).
import * as THREE from 'three';
import type { MoonProfile } from '../../core/terrain/terrainField';

/** Mare albedo as a fraction of the highland albedo (real mare ≈ 0.07 vs
 *  highland ≈ 0.12 normal albedo → ≈ 0.6). */
export const MOON_MARE_ALBEDO = 0.6;
/** Shader basin slots (uniform array size). MOON_PARAMS uses 7. */
export const MOON_MAX_BASINS = 8;
/** Highland colour: the TerrainMeshPool default, so highlands look as before S3. */
export const MOON_TERRAIN_COLOR = 0x7d8a6f;

export interface MoonTerrainMaterial {
  material: THREE.MeshStandardMaterial;
  /** Packed unit basin dirs + angular radius (rad), MOON_MAX_BASINS slots. */
  basins: THREE.Vector4[];
  /** Per basin (cos r, cos(r − shore)): the acos-free cull bounds. */
  basinCos: THREE.Vector2[];
  basinCount: number;
  /** Per-frame: spinGroup = T(−o)·R(qS) (playFrame stage 6). Allocation-free. */
  setFrame(ox: number, oy: number, oz: number, qx: number, qy: number, qz: number, qw: number): void;
}

const VERT_DECL = /* glsl */`
uniform vec4 uMoonBasins[${MOON_MAX_BASINS}];
uniform vec2 uMoonBasinCos[${MOON_MAX_BASINS}];
uniform int uMoonBasinCount;
uniform float uMoonShore;
uniform vec3 uMoonOrigin;
uniform vec4 uMoonSpinConj;
varying float vMoonMare;
`;

// WHY: world = R(qS)·m − o, so moon-fixed m = conj(qS)·(world + o). The sum is
// f32 at ≤ ~2 km magnitude (≈ 1e-4 m), far below the 109 m shore band.
const VERT_BODY = /* glsl */`
#include <begin_vertex>
{
  vec3 mWp = (modelMatrix * vec4(transformed, 1.0)).xyz + uMoonOrigin;
  vec3 mT = 2.0 * cross(uMoonSpinConj.xyz, mWp);
  vec3 mD = normalize(mWp + uMoonSpinConj.w * mT + cross(uMoonSpinConj.xyz, mT));
  float mMask = 0.0;
  for (int i = 0; i < ${MOON_MAX_BASINS}; i++) {
    if (i >= uMoonBasinCount) break;
    vec4 b = uMoonBasins[i];
    // WHY (S3 frame-time A/B): cos culls skip acos outside the shore band —
    // the plain acos-per-basin loop cost one vsync step at the rim site.
    vec2 cb = uMoonBasinCos[i];   // (cos r, cos(r − shore))
    float c = dot(mD, b.xyz);
    if (c <= cb.x) continue;
    if (c >= cb.y) { mMask = 1.0; break; }
    float a = acos(min(c, 1.0));
    float s = clamp((a - (b.w - uMoonShore)) / uMoonShore, 0.0, 1.0);
    mMask = max(mMask, 1.0 - s * s * (3.0 - 2.0 * s));
  }
  vMoonMare = mMask;
}
`;

const FRAG_DECL = /* glsl */`
uniform float uMoonMareAlbedo;
varying float vMoonMare;
`;
const FRAG_BODY = /* glsl */`
#include <color_fragment>
diffuseColor.rgb *= mix(1.0, uMoonMareAlbedo, vMoonMare);
`;

/** Inject the mare mask into a three ShaderLib standard shader (exported for the test). */
export function injectMoonShader(shader: { vertexShader: string; fragmentShader: string }): void {
  if (!shader.vertexShader.includes('#include <begin_vertex>')
    || !shader.fragmentShader.includes('#include <color_fragment>')) {
    // WHY: a three upgrade that renames the chunks must fail loudly, not draw unshaded.
    throw new Error('moonMaterial: shader include markers not found');
  }
  shader.vertexShader = VERT_DECL + shader.vertexShader.replace('#include <begin_vertex>', VERT_BODY);
  shader.fragmentShader = FRAG_DECL + shader.fragmentShader.replace('#include <color_fragment>', FRAG_BODY);
}

export function createMoonTerrainMaterial(m: MoonProfile | undefined,
  mareAlbedo: number = MOON_MARE_ALBEDO): MoonTerrainMaterial {
  const basins: THREE.Vector4[] = [];
  for (let i = 0; i < MOON_MAX_BASINS; i++) basins.push(new THREE.Vector4(0, 0, 1, 0));
  const n = m === undefined ? 0 : m.basins.length / 4;
  if (n > MOON_MAX_BASINS) throw new Error(`moonMaterial: ${n} basins > ${MOON_MAX_BASINS} slots`);
  for (let i = 0; i < n; i++) {
    const b = (m as MoonProfile).basins;
    const x = b[i * 4], y = b[i * 4 + 1], z = b[i * 4 + 2];
    const inv = 1 / Math.sqrt(x * x + y * y + z * z);   // same normalisation as _bas
    basins[i].set(x * inv, y * inv, z * inv, b[i * 4 + 3]);
  }
  const shore = m === undefined ? 1 : m.shoreWidth;
  const basinCos: THREE.Vector2[] = [];
  for (let i = 0; i < MOON_MAX_BASINS; i++) {
    basinCos.push(i < n ? new THREE.Vector2(Math.cos(basins[i].w), Math.cos(basins[i].w - shore))
      : new THREE.Vector2(2, 3));   // unused slot: never inside
  }
  const uniforms = {
    uMoonBasins: { value: basins },
    uMoonBasinCos: { value: basinCos },
    uMoonBasinCount: { value: n },
    uMoonShore: { value: shore },
    uMoonOrigin: { value: new THREE.Vector3() },
    uMoonSpinConj: { value: new THREE.Vector4(0, 0, 0, 1) },
    uMoonMareAlbedo: { value: mareAlbedo },
  };
  const material = new THREE.MeshStandardMaterial({
    color: MOON_TERRAIN_COLOR, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    injectMoonShader(shader);
  };
  material.customProgramCacheKey = () => 'solaris-moon-mare-v1';
  return {
    material, basins, basinCos, basinCount: n,
    setFrame(ox, oy, oz, qx, qy, qz, qw) {
      uniforms.uMoonOrigin.value.set(ox, oy, oz);
      uniforms.uMoonSpinConj.value.set(-qx, -qy, -qz, qw);
    },
  };
}