# U27b3b2b2b2a — m1b orbital-gate re-check

- Base: `daed833`; session 93; 2026-10-25.
- Scope: **A1-U07-1/-2 only**, split from U27b3b2b2b2 before execution.
- Reviewer: platform-reported `gpt-6-astra` ([ledger snapshot](U27b3b2b2b2a-evidence/platform-usage.json)).
  Historical-majority model provenance remains unresolved; this is not certification
  of the overall cross-model condition.
- Disposition: **both S1 re-confirmed, with qualifications**. Total reviewed:
  **24/55 S0/S1; 31 pending**. No game code or existing probe changed.

## 1. Expected claims — recorded before source re-reading

For a circular orbit, radial acceleration v²/a = μ/a² implies angular rate
|n| = sqrt(μ/a³), period 2π/|n|. Use independently specified Sun μ =
274 × 20000² and host surface gravity × radius²; do not use the rail's
derived n, T, μHost, cached basis or semiMinor as the oracle.

For zero inclination/node/periapsis in the documented Y-up convention,
a prograde orbit has position (a cos θ, 0, −a sin θ), so (r×v).y > 0;
Triton is the sole retrograde orbit **in this catalog**. Parent-relative
motion is required for moons. An independent gate should reject wrong rates
and reversed directions, while passing the unmodified engine and responding
to direct position faults. This tests gate sensitivity, not new production
defects or browser rendering.

Specification: targeted `pre-t4:Milestone/Milestone 1B.txt:35–82`
(§1.3 basis, §1.4 host μ and retrograde convention); :97 explicitly requires
bit-matched reference expressions. That bit-matching requirement is itself
the suspect design, not a reason to accept correlated errors.

## 2. Method and evidence boundaries

New probe: `pre-t4:game/tools/audit/u27b3b2b2b2a-m1b-recheck.mjs`.

- Executes the **unchanged** harness `referencePosition` through `runSuite`
  (:316–661) after esbuild type stripping. Supplies only dependencies,
  suite publication/state stubs and real core instances; predicates and
  thresholds are not edited.
- Every scenario gets cloned configuration and a new real `KeplerRail` /
  `SimulationCore`. A separate fresh instance is used for its physical oracle.
  No mutation leaks into production `CELESTIAL_CONFIGS`; checked at the end.
- Oracle inputs are literal raw catalog distances, host g/R, documented
  golden-angle epoch phases and the explicit Triton exception. They are
  independent of imported derived n/T/μHost and cached geometry. A domain
  check verifies all 16 mappings and zero eccentricity/inclination/node/periapsis.
  This is not an independent astronomical validation of the raw game catalog.
- Sample parent-relative positions at nine epochs per body, including negative
  time and +60 days. Use direct trig, not the production wrap function.
  Finite-difference velocity at 0.173 period with h = period/100000 measures
  speed and `(r×v).y`. Expected speed is sqrt(μ/a), sign is from the
  **raw orbit convention**, not from the potentially corrupted `n`.
- Position tolerance 0.1 mm allows different argument reduction at +60 days.
  Relative speed tolerance 1e-7 exceeds central-difference truncation
  `(2π/100000)²/6 ≈ 6.6e-10`. No tolerance was tuned after running.
- Probe exits nonzero for **any** failed assertion; deliberate self-test
  verifies propagation. Original U07 exits only on broken controls, so its
  printed result count is recorded separately.
- Node v24.22.0, `performance.memory` absent. “Five rows pass” below refers to
  the extracted synchronous suite in that environment. **No browser/GPU,
  rendering, heap or full live-clock certification.**

Full reads: m1b harness, original U07 probe/report, KeplerRail, celestialData,
orbit types, m1b e2e spec, TS loader/package; targeted reads of core
constructor/time API/tick and the milestone passages above.

## 3. Results

Original repro: **23/23 confirmed, controls OK, exit 0**.
Independent probe: **32/32 twice, both exit 0**.
Intentional self-test: **32/33, exit 1 as required**.

| Scenario | Actual suite T1/T2/T3/T4/T5 | Independent result |
|---|---|---|
| Unmodified baseline | P/P/P/P/P | 16/16 bodies pass; max sampled error 1.0214e-7 m; max relative speed error 7.023e-10 |
| Earth n ×1.01, T unchanged | P/P/P/P/P | Earth rejected; sampled error up to 451,874.94 m; speed 1% high |
| Every n ×2, T unchanged | P/P/P/P/P | All 16 rejected; up to 7,540,000 m; speed 100% high |
| Every basisQ negated | P/P/P/P/P | All 16 directions wrong and rejected |
| Triton n sign flipped | P/P/P/P/P | Triton alone rejected; direction wrong, sampled error 75,200 m |
| Every μHost ×4, n ×2, T ÷2 | P/P/P/P/P | All 16 rejected; common erroneous scale remains invisible |
| Earth output x +1 m | F/P/F/P/P | Earth and Moon parent-relative position checks reject |
| fastForward argument ×2 | F/F/F/P/P | Suite catches day-conversion fault; setSimTime oracle remains green, outside its scope |
| Earth T metadata ×2 only | F/P/P/P/P | Paths remain correct; suite catches inconsistent period ratios |
| Moon basisP ×1.001 | P/P/F/P/P | Moon rejected, max sampled error 38.26 m |
| Planet semiMinor ×0.8 | P/P/F/P/P | Nine planets rejected, max sampled error 747,747.93 m |

“Max sampled error” is over the declared epochs, not a proven global maximum.
All per-body measurements and row dispositions are in the raw `CASE` records.

### A1-U07-1 — orbital-rate claim re-confirmed, not universal clock blindness

- Severity: **S1** · Confidence: **confirmed** · Category: **test**.
- Location at `daed833`: `Milestone1B_TestHarness.tsx:332`
  (reference reads n), :436–450 (ratios use T), :539–550 (phase/chord use n);
  `KeplerRail.ts:207` consumes n, not T.
- Claim: independent orbital positions and Kepler-third-law consistency.
- Evidence: the five-row suite accepts a 1% rate error, every rate doubled,
  and a coherent μHost×4/n×2/T÷2 change. Independent physical checks reject.
  See §3 and commands/exits in §6.
- Qualification: the ratio is an identity **under coherent common scaling**,
  not an always-true predicate for arbitrary inputs. Earth T×2 alone fails T1.
  A doubled `fastForward` day argument fails T1/T2/T3; do not retain the
  original report's broad implication that every time-plumbing error passes.
- Impact: orbital pace can be wrong while the gate reports success.
- Proposed fix: independent rate/position checks using raw distances and
  host g/R, including a pinned Sun orbital μ contract; retain responsive
  jump/restore assertions. No ratified physics constant needs changing.
- Fix-task size: one session for independent T1/T3 rate/reference checks;
  land the new gate before retiring any old assertion.

### A1-U07-2 — geometry/reference correlation re-confirmed, partly bounded by T3

- Severity: **S1** · Confidence: **confirmed** · Category: **test**.
- Location at `daed833`: `Milestone1B_TestHarness.tsx:305–341`
  (cached basis/semiMinor reference), :531–541 (phase projected onto the same
  basis); `KeplerRail.ts:150–166` derives that geometry.
- Claim: independent reference; moving hosts including retrograde Triton.
- Evidence: all basisQ vectors negated and Triton n sign flipped each pass
  every row, but the independent direction tests reject. Geometry scale
  controls pass T1 and fail T3. See §3/§6.
- Qualification: not every geometry fault escapes the whole suite.
  T3 detects the tested radius/flattening faults. This is orbital
  handedness, **not body spin**.
- Impact: planets/moons can orbit the wrong way without a failed gate.
- Proposed fix: derive reference geometry from the elements without reading
  `CelestialState` caches; for this circular zero-inclination fixture, assert
  direction using the independently declared Triton exception. Comparing
  sign((r×v).y) to sign(n), as the old remedy suggested, is insufficient:
  the Triton-sign mutant changes both together and would pass that comparison.
  Arbitrarily inclined orbits need an independently oriented orbital normal,
  not a universal +Y test.
- Fix-task size: one session, potentially shared with U07-1; no ratified
  engine change. Validate scope/budget when authoring the fix task.

## 4. Checked, no issue in this scope

- All 16 unmodified circular trajectories match the independent rate,
  position and direction checks at the sampled epochs.
- Direct position faults fail T1; wrong day jumps fail T1/T2/T3; relative
  period-table inconsistency fails T1.
- Moon radius and planet flattening faults fail T3 despite T1's blind spot.
- Fresh-instance/config isolation and failing probe-exit propagation work.
- Protected trees remain byte-identical to `256d77d`.
- No new finding about arbitrary elliptical/inclined elements, actual
  rendering, allocation, body spin or the rest of U27b is claimed.

## 5. Draft ADR — independent orbital oracle for this audit

**Status:** audit-method decision only; future test remedy proposed, not applied.
Kept under `docs/audit/` because A1 forbids `docs/decisions/` writes.

**Context:** original evidence uses shared derived inputs; the audit must
demonstrate actual wrong motion, not merely repeat a passing mutation script.

**Options:** rerun only the old probe; construct a second reference from the
same n/basis; or derive circular truth from raw literals and motion samples.

**Decision:** exact unchanged row execution plus an independent raw-input
circular-motion/finite-difference oracle, responsive controls, separate fresh
instances and a nonzero-exit self-test.

**Why:** both false acceptance and oracle sensitivity are observed directly;
day-jump and geometry controls delimit the claim instead of overgeneralizing it.

**Consequences:** raw fixture duplication is intentional and domain-checked.
Sampling certifies these cases only. A future generic orbit gate must cover
nonzero elements and clocks separately. No engine architecture decision or
replacement of existing gates is enacted during A1.

## 6. Reproduction and verification

Run from repo root except where `cd game` is specified. Commands were run
**un-piped**, stdout/stderr redirected to the named logs; `$?` captured immediately
in matching `.exit` files under `pre-t4:docs/audit/U27b3b2b2b2a-evidence/`.

| Command | Log prefix | Observed exit / result |
|---|---|---|
| `cd game && npm ci` | `npm-ci` | 0 |
| `cd game && node tools/audit/u07-m1b-validity.mjs` | `original` | 0; 23/23, controls OK |
| `cd game && node tools/audit/u27b3b2b2b2a-m1b-recheck.mjs` | `independent-1`, `independent-2` | 0 each; 32/32 each |
| Same new probe with `--self-test-fault` | `self-test` | 1 intentionally; 32/33 |
| `cd game && npm run typecheck` | `typecheck` | 0 |
| `cd game && npm run build` | `build` | 0; existing >500 kB bundle warning |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | `protected-diff` | 0; empty |

Harness SHA-256: `37208c97589bbeb59ce9144363adc55e7e94543d7a9e195ec17f50b93c92f07c`.
Extracted slice SHA-256: `63c2888cee7ac95e5cd5ee41ab4107ee13d5dd72caad3796c0e8e87eb9d4bcca`.
No e2e/browser run was attempted; Node scope is explicit.

## 7. Resume

Next **U27b3b2b2b2b**: remaining K2c U08-5/-6 and four K2d;
split starting m1a U08-5/-6. Then K3–K9, U27c and the Lead gate.
No technical question needs the Lead's decision in this unit.