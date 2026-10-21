// T1 character telemetry (plan §5.2, §8.6). B6 ships the record type and its
// boot factory only — the CharacterAnimator seam (B6) is typed against it.
// WHY (B6 decision): sampleTelemetry(kcc, ctrl, inp, dt, out) needs the
// PlayerController, which lands in B7; it is added there, unchanged in shape.

export interface CharacterTelemetry {
  grounded: boolean; speed: number; vertSpeed: number; slopeDeg: number;
  sliding: boolean; sprint: boolean; crouch: boolean; inputMag: number;
  jumped: boolean; landed: boolean; landingSpeed: number; airTime: number; dt: number;
  slopeFwdDeg: number; slopeSideDeg: number; // §8.6 additive amendment
}

/** Boot-only: one record per world, refilled in place every frame (zero-GC). */
export function createTelemetry(): CharacterTelemetry {
  return {
    grounded: true, speed: 0, vertSpeed: 0, slopeDeg: 0,
    sliding: false, sprint: false, crouch: false, inputMag: 0,
    jumped: false, landed: false, landingSpeed: 0, airTime: 0, dt: 0,
    slopeFwdDeg: 0, slopeSideDeg: 0,
  };
}