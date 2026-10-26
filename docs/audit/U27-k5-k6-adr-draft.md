# Draft ADR — K5/K6 measurement contracts and flight review scope

Status: audit method adopted; production recommendations only.
2026-10-26 · U27b4bba · base `029488c`.
Stored under `docs/audit/`: A1 forbids `docs/decisions/` writes.
A later authorised fix task assigns its canonical ADR number.

## Context
The allocation invariant fails in a warmed Node fixture while its retention
test passes. Flight findings reproduce, but original language overgeneralises
density-only experiments and radial contacts. The cap follows its written
formula while impairing braking.

## Options
1. Accept old numbers/headlines and implement their suggested fixes directly.
2. Separate independent measurement from design judgement, retain responsive
   controls, and qualify the scope before defining production fixes.
3. Replace the physics/rendering systems during the audit.

## Decision
Adopt option 2 for this recheck. Separate allocation from retention; observe GC
rather than infer it from delta signs; use independent force/axis/drag controls;
capture velocity before collision response and preserve non-landing controls.
Do not implement production changes during A1.

Recommend independent allocation/retention gates before optimisation; a cap
contract that preserves braking and defines its speed frame; pre-response
impact metrics and approved landing outcomes; explicit body-profile selection
and near-body regimes. Do not yet adopt a cache, a universal bytes/frame budget,
a specific signed-thrust formula, or new per-body numerical constants.

## Why
A passing retained-heap check is useful for bounded growth but says little
about transient churn. Density swaps do not simulate other planets; a finite
timeout cannot prove “never”; collision semantics depend on tangential velocity.
Controls prevent those fixture limitations from becoming production assumptions.

## Consequences
- Existing gates remain; replacements first land with independent controls.
- Optimisations require before/after browser frame-time and heap evidence in
  addition to a repeatable Node fixture; no optimisation is claimed here.
- Braking/cap changes require a production ADR because the cap is RATIFIED.
  Check signed power and finite-step lateral energy, not just a dot-product switch.
- Apply the existing soft/hard/crash and thin-atmosphere rulings, without re-asking.
- Keep fixes session-sized and dependent on frame/terrain contracts as appropriate.
- This batch reviews six findings, not all remaining clusters or model provenance.