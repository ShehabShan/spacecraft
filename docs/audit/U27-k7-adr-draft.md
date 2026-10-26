# Draft ADR — K7 independent movement and render-data contracts

2026-10-26 · U27b4bbba · base `7c4983e`.
Status: audit method adopted; production recommendations only.
A1 allows `docs/audit/`, not `docs/decisions/`; a later fix task assigns the
canonical ADR number before adopting an implementation.

## Context
Original probes expose slope, contact-orientation and schedule defects, but
private predicates and copied clocks do not establish actual play effects.
Original landing/camera language overgeneralises the measured behavior.

## Options
1. Endorse the original claims and suggested one-line fixes verbatim.
2. Isolate geometry mathematically, then trace actual controller/render
   consumers with responsive controls; preserve and qualify old evidence.
3. Change the production controllers during the audit.

## Decision
Use option 2. Analytic prescribed slope/normal tests isolate distance semantics;
real-terrain drops and flat/zero-blend controls distinguish conditional snaps;
real playFrame timing compares extracted pose with f64 truth and separately
checks camera anchoring. A matched-count instance override is diagnostic only.

Recommend one authoritative tick schedule, separate physical and presentation
orientation responsibilities, and a written horizontal-travel contract for
slope tests. Do not adopt new slope values, up-blend values, easing durations,
interpolation methods, or production scheduler changes during A1.

## Why
A coordinate-frame choice must not silently alter a terrain-angle limit.
Airborne smoothness says nothing about the contact transition. Counting
disagreements is not measuring stale rendered frames, and reading KCC inside
a camera helper is not proof that the final driver uses a KCC position anchor.

## Consequences
- Keep old evidence and log the failed loader attempt; independent assertions
  and deliberate failure verify the new runner's exit behavior.
- Fix-task gates land before replacements, including camera/character consumer
  checks and boundary/multi-tick cases.
- Slope correction touches a RATIFIED item and needs its production ADR.
- Visual-up smoothing must not silently alter movement or collision semantics.
- Landing/steep-slope feel remains a Lead preference; technical design remains
  delegated. Carry existing questions into U27c, do not re-ask answered ones.
- K7 is complete; K8/K9 remain a separate unchecked continuation within A1.