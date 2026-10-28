# ADR-020: m1f R2(b) Sun occlusion is real; the rebuilt R2 must choose a clear-sightline pose

Date: 2026-10-27 · Task: F2f (unit F2fbbb, session 130) · Status: accepted

## Context
F2fbba (ADR-019) showed that at the correct render-local R2(b) pose the near-pass terrain covers a correctly drawn Sun. F2fbbb (`pre-t4:docs/audit/evidence/F2f/bbb/REPORT.md`) measured why, twice: the rendered terrain group matches the spin law and −O exactly; the camera is 0.6 m above the ground on a 2.51 m clamped boom; and in the Sun's azimuth the terrain horizon rises to 61° at 41 m, above the Sun's 33°. A hill hides the Sun.

## Options
1. Change the render (frames, layer assignment) so the Sun shows. Wrong: the render is correct.
2. Keep R2(b) at the end-of-sprint pose and read the far pass only (ADR-019). It measures the impostor scale, but never checks that the composite image is right.
3. Rebuilt R2: far-pass footprint (ADR-019) **plus** a composite check at a pose whose Sun sightline is verified clear by an analytic horizon test (terrain horizon in the Sun azimuth below the Sun by a margin). If the end-of-sprint pose fails the test, raise the camera along the radial up until it passes, and record the height used.

## Decision
Option 3. No render or production code changes. The rebuilt R2 gate (a new file, per U27c §2) performs the horizon test before reading back and fails loudly with "sightline not clear" rather than reporting 0 px.

## Why
The scale measurement and the "Sun is visible on screen" check are different claims. Each needs a pose where its premise holds, and the premise must be checked, not assumed. Option 3 keeps both claims without hiding a real occlusion.

## Consequences
- The 0-px R2 at `3057899` is explained in full; A1-U01-1 has no render defect behind it.
- The harness boom clamp tests the analytic heightfield only, while the rendered chunk surface can sit ~0.5 m above it. Gate rebuilds that use the harness camera must clamp against the mesh (raycast) or keep a larger margin.
- The R3 0-px silhouette flake is still carried into the R3 rebuild.
