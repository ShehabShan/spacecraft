// T1 play world constants (plan §5.2, B2). Constants ONLY — no module-scope
// side effects (no initTerrainField, no workers): the world is built lazily by
// createMoonWorld() (B4). Values are copied BY VALUE from the M1F harness
// (Milestone1F_TestHarness.tsx §2 "BOOT SINGLETONS", ~lines 100–137) so the
// play moon is the same moon; the harness itself is never imported (K10).
import type { TerrainParams } from '../../core/terrain/terrainField';
import type { AstronautConfig } from '../../core/physics/astronautKCC';
import type { TerrainMeshPoolOptions } from '../../render/TerrainMeshPool';

// WHY: harness MOON (~100) values except the name (plan §6.2 port map) and, since
// T3 S2 (ADR-028 amendment), the opt-in `moon` profile: mare basins, two crater
// layers and the ridged term softened (mountainAmp 230×0.12, detailAmp 16×0.35),
// the S1 gate candidate "G-prune". The harness keeps its own MOON literal.
export const MOON_PARAMS: TerrainParams = {
  name: 'Play Moon', radius: 1364.5, seed: 20240119,
  continentFreq: 2.3, continentAmp: 95, maskFreq: 3.7,
  mountainFreq: 6.5, mountainAmp: 27.6, detailFreq: 22, detailAmp: 5.6,
  moon: {
    // WHY: the S1 makeBasins set (mulberry32(0x7a3e), radii ×1.15) rigidly rotated so
    // basin 0 is centred on the spawn base direction (Earth rotated 75° about E×S,
    // spawn.ts), giving a mare-floor spawn; pairwise basin angles are unchanged.
    // Generator: game/tools/gen-moon-basins.mjs. [dx, dy, dz, radius rad]
    basins: [
      0.84068, -0.077412, 0.535971, 0.713,
      -0.311829, -0.42262, -0.850973, 0.598,
      0.033073, -0.99859, -0.041535, 0.5175,
      -0.98542, 0.104232, 0.134471, 0.46,
      0.603086, 0.34976, -0.716907, 0.414,
      -0.148562, -0.655397, 0.74053, 0.368,
      -0.395219, 0.879273, 0.26586, 0.322,
    ],
    shoreWidth: 0.08, rimSigma: 0.05, rimOffset: 0.024,
    rimAmp0: 25, rimAmpPerRad: 45 / 0.62, floorHeight: -25, floorFreq: 8, floorAmp: 1.2,
    mareCraterDamp: 0.9,
    craters: [9, 0.55, 18, 60, 0.18, 0.05, 0x51a7, 32, 0.45, 8, 16, 0.18, 0.05, 0x3c91],
  },
};
export const MOON_R = MOON_PARAMS.radius;
// WHY: harness MOON_MU (~106) — surface g = 1.62 m/s² (Spec 02.3), 3,016,214.
export const MOON_MU = 1.62 * MOON_R * MOON_R;
// WHY: harness MAX_TERRAIN_H / HEIGHT_SLACK (~107–108).
export const MAX_TERRAIN_H = 360;
export const HEIGHT_SLACK = 420;

// WHY: Q8 ruling (Lead 2026-10-20, delegated): the harness spins at 0.0005
// rad/s (~123), which turns the spawn Sun-dark 21 min after load for ~105 min
// (plan §6.1). Play uses 0 — Earth fixed in the sky, as on the tidally locked
// Moon. Harness and KCC defaults are untouched; test-play-spawn pins this.
export const MOON_SPIN_OMEGA = 0;

// WHY: harness KCC config (~121–129) verbatim (A2) except spinOmega (Q8).
// Tuning happens here, never through KCC defaults.
export const MOON_ASTRONAUT: AstronautConfig = {
  planetRadius: MOON_R, planetMu: MOON_MU, gravityRange: 8187,
  spinOmega: MOON_SPIN_OMEGA,
  maxTerrainHeight: MAX_TERRAIN_H,
  walkSpeed: 3.2, sprintSpeed: 6.5, crouchSpeed: 1.5, jumpSpeed: 4.2,
  accelTau: 0.15, stepHeight: 0.5, snapDistance: 0.4, groundClearance: 0.02,
  maxWalkSlopeDeg: 50, slideAngleDeg: 45, kineticFriction: 0.6, slideGripTau: 0.06,
  eyeHeight: 1.62, crouchEyeHeight: 0.95, upBlendWeight: 0.65, airborneUpTau: 2.0,
  autoTurnRate: 6, rcsAccel: 1.2, rcsBudgetMax: 20, rcsRegen: 0.5, sweepGap: 0.25,
  // WHY (B11, ADR-027): the opt-in KCC fields, ruled Q2a/Q3 (2026-10-20). Literals,
  // not PLAY_TUNING refs (declared below); test-play-controller pins them equal.
  coyoteTime: 0.10, airControl: 0.3,
};

// WHY: harness TerrainMeshPool options (~116–118); params are supplied at
// construction (B4) as MOON_PARAMS, material by the world.
export const PLAY_POOL_OPTS: Omit<TerrainMeshPoolOptions, 'material' | 'params'> = {
  meshCount: 96, workerCount: 2, workerPoolSets: 96, maxBatch: 6, inFlightPerWorker: 12,
};

// Play-layer feel tuning (plan §5.2 / §9 / §10). Additive, play-only.
export const PLAY_TUNING = {
  lookSens: 0.0022,          // rad/px — harness SENS (~654)
  camDistance: 7, camDistMin: 1.2, camDistMax: 12,       // harness cam.dist 7 (§9.4)
  camPitchMin: -1.2, camPitchMax: 1.2, camPitchDefault: 0.35, // harness cam.pitch 0.35
  // WHY (ADR-017, Lead 2026-10-27): spawn/respawn frame the Earth this far
  // above the view axis (13°): near the centre, its disc (~7.3° half-angle)
  // clear of the helmet (~3.8° above the axis at a 7 m boom).
  camSpawnAimAbove: (13 * Math.PI) / 180,
  camClearance: 0.4,         // m above terrain (harness 4-sample clearance)
  camPosTau: 0.08, camRotTau: 0, // §9.4: pivot lag; look is raw (0 reserved)
  pivotHeight: 1.4,          // m look-at height above the feet (§9.4)
  jumpBufferS: 0.12,         // play-layer jump buffer (Q5 ruling)
  coyoteS: 0.10,             // KCC coyoteTime (Q2a ruling, B11)
  airControl: 0.3,           // KCC airControl (Q3 ruling, B11)
  camBoomTau: 0.30,          // s boom regrowth after terrain compression (§9.4)
  camZoomSens: 0.001,        // per wheel deltaY unit, multiplicative zoom (B7b decision)
  hardLandingSpeed: 4.5, landRecoverScale: 0.5, // §9.3 landing recovery
  jumpDelayS: 0,             // §9.3 decision: no launch delay
  readyRadiusM: 300, loadTimeoutS: 15, // §10.3 loading gate
} as const;