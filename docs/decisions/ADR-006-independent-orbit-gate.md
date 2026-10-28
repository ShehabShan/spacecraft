# ADR-006 — Independent raw-element orbit gate (F2a)

- Status: ACCEPTED (session decision, AGENT_BRIEF §13) · Task: F2a (U27c §2) · Date: 2026-10-26
- Closes K2c orbital findings A1-U07-1 (rate) and A1-U07-2 (geometry/direction). Promotes the A1 audit-method draft in `pre-t4:docs/audit/U27b3b2b2b2a-m1b-recheck.md` §5 to a regression gate.

## Context
All five m1b rows build their reference from the rail's own derived values (`orbit.n`, `orbit.T`, cached `basisP/basisQ`, `semiMinor`). An error in those values therefore moves the engine and the reference together, and the rows still pass. The A1 recheck showed that the full suite accepts Earth n×1.01, every n×2, a coherent μ×4/n×2/T÷2 change, all `basisQ` negated, and Triton's sign flipped.

## Options
1. Patch the m1b harness rows so they read raw inputs. This would change a browser spec, and the oracle would stay inside the code it checks.
2. Compare sign((r×v)·ŷ) with sign(n). The recheck showed this is blind: a sign bug flips n and the motion together.
3. Add a new Node gate whose truth uses only raw catalog inputs plus pinned independent facts, and measure the real `KeplerRail`/`SimulationCore` by sampling positions.

## Decision
Option 3: `game/tools/test-orbit-gate.mjs` (new file).
- **Truth inputs.** The oracle reads only a, e, i, Ω, ω, M0, the parent's surfaceGravity·radiusGame², and three pinned facts:
  - Sun orbital μ = 274·20,000²;
  - the retrograde set {triton};
  - 86,400 s per day.
  It never reads n, T, muHost, retrograde, basis or semiMinor.
- **Nine checks** on the production catalog:
  1. oracle domain (circular, i=Ω=ω=0);
  2. exact position (a cosθ, 0, −a sinθ) at nine times, within 0.1 mm;
  3. measured mean motion |r×v|/r² within 1e-7;
  4. direction, sign(h·ŷ) against the pinned retrograde fact;
  5. period: return after one oracle period;
  6. first return: no return before that, 720 samples;
  7. derived tables n/T/muHost/retrograde equal the physics within 1e-12;
  8. period ratio, Kepler III on measured rates for all 36 sibling pairs (μ-independent);
  9. day clock: fastForward(60) = setSimTime(t+60·86400).
- **Truth comes from the production catalog, never from the mutant**, so a mutated config cannot move its own reference.
- **`--self-test`** builds ten mutants and requires each to turn its named checks red. Six are false-accepts found by A1 (n×1.01, n×2, reversed via n, reversed via basisQ, Triton sign, common μ×4). The others are Jupiter n×1.001, Earth T×2, Earth +1 m and fastForward×2. `--deliberate` adds an identity mutant that must make the self-test exit 1.
- The m1b browser rows are unchanged. Row counts (A5 B5 C4 D5 E6 F5) and ADR-001 stay as written.

## Why
- Each claim now has a check whose reference cannot move with the defect.
- The direction check depends on a fact from outside the engine (Triton is the catalog's only retrograde orbit). It does not depend on n.
- The period-ratio check uses measured rates of siblings, so a wrong μ_host cannot hide it. It is the only check that is sensitive to a 0.1 % single-body rate error and still independent of the absolute μ.
- A new file follows safeguard 3 of §13 ("the new independent check lands first"), and touches no ratified constant.

## Consequences
- The position and rate oracles cover only circular, zero-inclination orbits. `oracle-domain` turns red as soon as F3a adds eccentricity or inclination, which forces the oracle to be extended (independent orbital normal; Kepler solve from raw elements) in the same task. Direction (h·ŷ) and period ratio already work for any prograde i < 90°.
- The derived-tables check deliberately reads n/T/muHost, but only to compare them with the independent truth. The oracle never uses them.
- The m1b T1/T3 rows still use the shared reference. They are now redundant, not trusted, for rate and direction. Retiring them is a later choice and is not required.
- Run `node tools/test-orbit-gate.mjs` and `--self-test` in every task that touches `src/core/orbit/**`, `SimulationCore` time, or the catalog.