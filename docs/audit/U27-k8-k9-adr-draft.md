# Draft audit-method ADR — K8/K9 measured geometry before implementation

Status: audit-method decision for U27b4bbbb, 2026-10-26.
Not an adopted production ADR. A1 permits drafts here, not writes to
`docs/decisions/`; later fix tasks promote their actual design decisions.

## Context
Existing numerical repros mostly reconstruct the intended geometry. They
can confirm a formula while overlooking the submitted matrices, articulated
parent rotations, or the actual footprint at the depth-comparison ray.

## Options
1. Repeat only the old repros and accept their prose/remedies.
2. Measure the real submitted matrices and real rig transforms against
   independent tangent-ray and world-contact conditions.
3. Begin production fixes and judge screenshots.

## Decision
Use option 2 plus repeatable old repros and responsive controls. Keep all
production code unchanged. Retain all four S1 findings, correcting the
scope/magnitudes and rejecting unsupported implications.

## Why
The checks demonstrate common-ray depth inversion, actual transformed boot
heights, and the normal mismatch through the telemetry producer. They also
show that a sign-only ankle fix is not an exact world-normal solution.
A GPU run is not required to establish these algebraic defects; it remains
required when validating the eventual rendering change.

## Consequences
- Couple silhouette and depth fixes; do not certify either from cached metadata.
- Preserve the distinction between angular radius and diameter, screen circles
  and projected sphere conics, and generic fixtures versus current play bodies.
- Foot fixes need a world-contact/normal target, not a restated sign convention.
- Add independent gates before retiring old gates; flat contact, slope orientation
  and real-terrain placement can be separate session-sized implementation units.
- No choice of renderer compositing method, IK architecture, RATIFIED threshold
  or library is adopted in A1. Findings and proposal sizes are in
  [the recheck report](U27-k8-k9-recheck.md).