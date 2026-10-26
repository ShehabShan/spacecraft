# Draft ADR — K4 evidence and conservative terrain contracts

Status: audit recommendation only · 2026-10-26 · U27b4ba · base 099ce5b.
Kept under `docs/audit/` because A1 forbids writes to `docs/decisions/`.
A later authorised fix task must assign a canonical ADR number and adopt its
production design explicitly.

## Context
K4's five S1 findings reproduce, but several original remedies promise more than
the evidence supports: empirical extrema are not certified bounds, bilinear
height is not the indexed mesh, and total worker capacity is not available
capacity on the next selected worker.

## Options
1. Retune ε, mesh density, height limits and pool sizes from sampled maxima.
2. Add independent geometry/ownership gates, then establish explicit terrain
   error/bound contracts and a worker completion/ownership contract.
3. Replace the whole terrain/physics pipeline before establishing independent gates.

## Decision
Recommend option 2. In this read-only unit adopt only its **review method**:
convergence-qualified radial gradients, actual worker triangles, direct geodesic
counterexamples, controlled real sweep detection, and independent owned-request
accounting. Preserve failed premises separately from unproven visible effects.
Do not implement or mark a production fix approved during A1.

## Why
Independent responsive controls distinguish real faults from oracle/fixture
errors. Arbitrary extra samples or capacity may conceal a defect without making
a conservative guarantee. A shared terrain service can address geometry and
bounds, but cannot alone repair stale asynchronous request ownership.

## Consequences
- Add the independent gates before replacing existing gates.
- Derive conservative height/derivative bounds or conservative segment exclusion;
  do not label measured maxima as mathematical bounds.
- Choose triangle-accurate collision or an explicit bounded representation
  mismatch; retain a defined normal policy at nonsmooth crests.
- Make worker set reservations, completion/retry and owner identity explicit.
- Split implementation into session-sized units and rerun relevant regressions.
  Performance changes require measured before/after evidence; none is claimed here.