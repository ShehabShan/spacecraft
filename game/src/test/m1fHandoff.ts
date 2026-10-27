/**
 * m1f mesh↔impostor handoff controller (F2fccba, ADR-023).
 * WHY: moved VERBATIM from Milestone1F_TestHarness.tsx §5 so the rebuilt R3 gate
 * (`?page=m1fR3`) tests the shipped controller, not a copy, without importing the
 * harness (page rule: the harness has boot-time side effects). Pure: no three/react.
 * The harness re-exports these names unchanged. F8a owns the fix (A1-U03-1) and the
 * later move into render/.
 */
export const HANDOFF_D_HARD = 240000;   // MESH -> IMPOSTOR
export const HANDOFF_D_SOFT = 220000;   // IMPOSTOR -> MESH
export const HANDOFF_FADE_LO = 225000;
export const HANDOFF_FADE_HI = 236000;


export function handoffFade(d: number): number {
  if (d <= HANDOFF_FADE_LO) return 0;
  if (d >= HANDOFF_FADE_HI) return 1;
  const t = (d - HANDOFF_FADE_LO) / (HANDOFF_FADE_HI - HANDOFF_FADE_LO);
  return t * t * (3 - 2 * t);
}
export function handoffNextState(d: number, mesh: boolean): boolean {
  if (mesh && d > HANDOFF_D_HARD) return false;   // now IMPOSTOR
  if (!mesh && d < HANDOFF_D_SOFT) return true;   // now MESH
  return mesh;
}
