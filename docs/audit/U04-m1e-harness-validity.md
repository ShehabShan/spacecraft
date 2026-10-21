# A1-U04 — m1e harness validity

- Unit: A1-U04 (`docs/A1-plan.md` §5) · Commit audited: `ce94279` (game/src identical to 256d77d) · Session: 53 (2026-10-22)
- Question: can each m1e row (R1 face-walk, R2 slope-step, R3 state machine, R4 zero-gc, R5 Coriolis jump, R6 live trek) **fail** when the property it claims is broken?
- Files read:
  - `game/src/test/Milestone1E_TestHarness.tsx`: lines 18–60 (row claims), 93–232 (setup + site scans), 553–1165 (all rows + `finishTrek`), 1168–1240 (phase machine).
  - `game/e2e/m1e.spec.ts` (all).
  - `game/src/core/physics/astronautKCC.ts`: config :115–140, teleport :325–360, jump :585–610, airborne sweep :930–950.
  - `game/src/core/physics/sphericalFrame.ts`: :205–240.
  - `Milestone/` 1E grep: the Coriolis derivation (":54") and the row table (":2990").
- Probe: `game/tools/audit/u04-m1e-validity.mjs`.
  - It slices the harness setup (:112–227) and the row block (:576–1092) **verbatim from the source text**, strips the types with esbuild, and runs them on the real core under Node.
  - Around that it adds mutations, an independent RK4 inertial integration, a spin-off control, a per-tick clearance probe, and a `process.memoryUsage` heap shim.
  - Command: `cd game && node tools/audit/u04-m1e-validity.mjs` → `[u04] CONFIRMED 21/21`, `PROBE_EXIT=0` (unpiped).
  - Two suspicions were refuted on the way and are recorded as such: continuous yaw drift IS caught, and a leak is NOT reliably missed. The verdicts depend on GC timing (see below).
- Method note: the expected behaviour was written first.
  - A 5 m/s vertical jump on the 52 m/s equator lands about (4/3)Ωu³/g² west.
  - A frame-transport gate must see a yaw snap.
  - A "penetration-free" clause must measure clearance on every tick.
  - A zero-alloc row must fail on allocation.

## Verdict
| Row | Can it fail on its claim? | Evidence |
|---|---|---|
| R1 face-walk: ≥ 2 faces, corner pass, quaternion norm, fwd ⊥ up | Yes | Base: 13.60 km, 2 faces, corner 0.82° |
| R1 "no yaw snaps" | **No for snaps ≤ 5°.** | M-SNAP (87 × 4° snaps) still passes. Continuous drift (M-DRIFT) is caught. |
| R1 "penetration-free" (minAGL) | **No.** It is vacuous. | `integrity.minAGL = Infinity`; it is only written by the airborne sweep. |
| R1 "holonomy 2π ≡ identity" | **Not tested** (printed only). | The walk covers 156° of the circle. |
| R2 slope / slide / block | Yes (values plausible) | Climb 4.9 m vs 4.4 m expected; slide at tick 5; uphill 0.11 m |
| R2(c) cliff "penetration-free" | **No.** It is vacuous. | Same `minAGL = Infinity` |
| R3 RCS / yaw / vehicle | Yes for Δv and yaw | Δv 2.3999 = 1.2·2; yaw 0.5002 |
| R3 ZERO-G entry / landing | Weak | See A1-U04-5 |
| R4 identity canary | **No.** | Fields are `readonly`, assigned once |
| R4 heap guard | **Unreliable.** It is skipped with no `performance.memory`, and the verdict flips with GC timing. | M-GARBAGE P/F/P; M-LEAK F/P/F |
| R5 Coriolis | **It passes on a wrong measurement.** | Reports 0.75 cm; the truth is 1.88 cm; −0.97 cm of tilt artefact |
| R6 live trek | Not probed (browser row) | Read only; see "checked" |

## Findings

### A1-U04-1 — R5 "spec-canonical" Coriolis row passes on a mis-measured drift (0.75 cm vs ≈1.9 cm true); `predicted` is never compared
- Severity: S1 (a gate that under-tests its claim; the printed detail misreports agreement with theory)     Confidence: confirmed
- Category: test
- Location: `Milestone1E_TestHarness.tsx:698-703` (tilt correction), `:730-735` (pass window) @ ce94279. KCC jump direction is at `astronautKCC.ts:591-594` (`n.* u`, the terrain normal). Spec: Milestone 1E ":54" (≈1.8 cm), row table ":2990" (window 0.6–6 cm).
- Claim: "Landed X cm WEST (theory (4/3)Ωu³/g² = … cm — pure inertial integration)". The row validates the Coriolis drift.
- Evidence (probe):
  - Verbatim R5 reports `west 0.754 cm`, against a formula value of `1.692 cm` (ratio 0.445).
  - An independent inertial RK4 from the same launch radius (r0 = 4922.34 m) gives `west 1.883 cm`.
  - Control with spin OFF (Ω = 0), same site and the same verbatim correction: `residual west −0.974 cm`. That is pure artefact.
    - Why it happens: the KCC jumps along the terrain **normal** (site slope 0.33°, normal-tilt west component −5.7e-3). The gate subtracts the tilt of the **blended up** (`upBlendWeight` 0.65) instead, so about a third of the tilt is left in.
    - measured − formula = −0.938 cm, which matches the artefact.
  - With the artefact removed, the KCC drift is 1.73 cm vs RK4 1.88 cm (−8.3%). **The KCC physics is fine; the gate's measurement is wrong.**
  - `C.predicted` is printed only and never enters `pass`. The window [0.6, 6] cm spans 10×.
  - With 2× the Coriolis effect, west = 3.91 cm is **inside** the window. The row fails only through the cross-track clause (7.5 cm > 1.2 cm). The base cross-track is 1.183 cm vs a 1.2 cm bound, a margin of 1.4%, so that clause is near its edge on the real physics.
- Impact:
  - The "approved" 1E ledger figure (0.75 cm) is an artefact presented as agreement with theory.
  - A factor-2 Coriolis error would be caught only by accident (cross-track), and a small terrain change at FLAT_SITE could fail the row through a 1.4% margin.
- Proposed fix (test only, no ratified item touched):
  - Subtract the tilt of the actual launch direction (the terrain normal at launch), or better, compare against a spin-off control jump from the same site.
  - Compare with the inertial truth at ±15%.
  - Base the cross-track bound on the control residual.
- Fix task size: fits one session (≈40 lines in one row, plus a Node replica check).

### A1-U04-2 — The spec's (4/3)Ωu³/g² uses g = 9.81 and ignores the rotating frame; the true drift here is 11% larger
- Severity: S3     Confidence: confirmed
- Category: spec / doc
- Location: Milestone 1E ":54" ("g = 9.81 … 1.8 cm"); harness `:707` (`g = μ/r²` at the site).
- Evidence:
  - At the site g = 10.122 (the terrain is 78 m below R) and g − ω²r = 9.590.
  - The formula with g − ω²r gives 1.885 cm, which equals RK4's 1.883 cm.
  - The flat formula with μ/r² gives 1.692 cm (−11%).
- Impact: a tightened R5 (the U04-1 fix) must use the effective gravity of the rotating frame, or a direct inertial integration, or it will fail on correct physics.
- Proposed fix: state the expected value as an inertial integration, or as (4/3)Ωu³/(g−ω²r)². Fix size: part of the U04-1 fix.

### A1-U04-3 — "Penetration-free" clauses in R1 and R2(c) are vacuous: `integrity.minAGL` is never written while grounded
- Severity: S1 (a gate that under-tests its claim)     Confidence: confirmed
- Category: test (plus KCC integrity semantics)
- Location: `astronautKCC.ts:945` is the only writer of `minAGL`, inside the airborne sweep. Harness `:658` (R1 `F.minAGL > -0.05`) and `:1075` (R2 cliff `kcc.integrity.minAGL > -0.05`) @ ce94279. Detail strings print "min AGL n/a (never airborne)" and still say "penetration-free".
- Evidence:
  - The R1 walk (87,792 ticks, 0 airborne) and the R2 rows (0 airborne) both end with `integrity.minAGL = Infinity`, so `Infinity > −0.05` is always true.
  - The independent per-tick clearance probe gives min 0.020 m in both rows (= `groundClearance`). **No actual penetration; the clause just cannot see one.**
- Impact: a grounded-path regression that sinks the character into terrain (step-up or snap-down, cliff pushes) would pass both rows.
- Proposed fix (test only): compute clearance per tick in the harness, as the probe does (`|pLocal| − (R + h(dir))`). Alternatively, in a later KCC fix task, have the grounded path also update `minAGL`; that changes core telemetry semantics, so it needs an ADR.
- Fix task size: fits one session.

### A1-U04-4 — R1 "no yaw snaps" bounds admit 4° snaps; the holonomy claim is printed but untested
- Severity: S1     Confidence: confirmed
- Category: test
- Location: `Milestone1E_TestHarness.tsx:651-660` (bounds `cos(0.06)` = 3.44° up, `cos(0.09)` = 5.2° fwd per tick), detail `:668-671` @ ce94279.
- Evidence:
  - M-SNAP adds a 4° yaw snap every 1,000 ticks (87 snaps). R1 still passes.
  - On the unedited walk, the per-tick fwd change is already 2.39°. That is the steering command: turnRate clamp 2.5 rad/s × 1/60 s. So the fwd bound measures steering, not transport.
  - The per-tick up change reaches 2.15°. That is the 0.65-weighted terrain-normal blend following bumps.
  - M-DRIFT (a continuous 0.05°/tick yaw error) **does** fail (the suspicion is refuted).
  - The walk covers 156° of the circle, so "holonomy of a great circle = 2π ≡ identity" is a statement in the text, not a measurement.
- Impact: a frame-transport bug that snaps yaw at face boundaries (the exact failure a cube-sphere frame invites) passes. The 2.15° per-tick up rotation is a possible visible camera wobble in play (camera "surface-normal aligned"); U23 should check whether the play camera inherits it.
- Proposed fix (test only):
  - Measure transport error directly: compare fwd with the parallel transport of the previous fwd plus the commanded yaw (turnRate·dt). The bound should be about 1e-6 rad, not 5°.
  - Either walk the full circle and assert holonomy, or delete the claim.
- Fix task size: fits one session.

### A1-U04-5 — R4 zero-gc: identity canary cannot fail; heap guard is optional and GC-timing dependent
- Severity: S1     Confidence: confirmed (Node shim); likely in Chromium
- Category: test
- Location: `Milestone1E_TestHarness.tsx:869-872` (canary), `:924-933` (`identityOk`, `heapOk = Δ < 0 || Δ ≤ 1 MB`), `:569` (`heapApi` null when `performance.memory` is absent) @ ce94279.
- Evidence:
  - Canary: every field is a `readonly` class member assigned once (`astronautKCC.ts:219-247`), so `identityOk` is true by construction.
  - With no heap API, R4 passes on identity + NaN only (`r4-noheap-pass`).
  - With a heap shim, single snapshot deltas across a 30,000-tick burn swing by ±3 MB from GC timing alone:
    - M-GARBAGE (~200 B/tick, ~6 MB churn): `P(301608) F(2423736) P(163888)`.
    - M-LEAK (30,000 retained boxed doubles): `F P F`.
    - M-LEAK/3: `F F F` at ~1.07 MB, but only just over the bound.
  - A negative delta passes outright (`Δ < 0`). Same pattern as m1f R4 (A1-U03).
- Impact: the "zero-alloc" claim for the KCC is not established by this row. A per-tick allocation in `integrateTick` would pass most runs.
- Proposed fix (test only):
  - Measure allocation, not heap level. Either force GC before and after (`--js-flags=--expose-gc` in the Playwright launch, or a Node replica with `--expose-gc`, as the T1 play tests already do), or use allocation sampling.
  - Fail when no measurement is available.
  - Drop the canary or make it meaningful.
- Fix task size: fits one session (shared with the m1f R4 fix; the two should be one fix task).

### A1-U04-6 — R3 state-machine sub-checks weaker than worded
- Severity: S2     Confidence: confirmed (first two); suspected (third)
- Category: test
- Location: `Milestone1E_TestHarness.tsx:760-762`, `:788-794`, `:849-852` @ ce94279; `astronautKCC.ts:342`.
- Evidence:
  - "ZERO-G entered 1 tick beyond the 30 km gravity range": `teleportAbs` itself sets `_mode` from the gravity magnitude (`:342`), so the check tests the teleport. It does not test a mode transition during flight.
  - "landed analytically": `landed = kcc.grounded`, with no check on landing position, landing tick (vs the ≈22,400-tick free fall) or impact velocity.
  - `vehicleErr` is exactly 0 and `detachDv` exactly 0. The independent compose uses the same parent-frame offset and quaternion arithmetic as the KCC. *Suspected* to be a mirror of the implementation, not an independent check. To confirm, read `_vehicleTick` (`astronautKCC.ts:1028`) in U17.
- Impact: a broken flight-time mode transition (SURFACE↔ZERO-G at 30 km while moving) would not be seen.
- Proposed fix: assert the transition tick while flying out through 30 km, and check the landing tick and position against an inertial prediction. Fix size: small; bundle with U04-1.

## Checked, no issue
- Verbatim extraction: the harness rows run under Node unchanged and pass as in the browser ledger (R1 2 faces / 0.82° corner; R3 Δv 2.400; R2 values as above). The probe is a faithful replica.
- R1 catches continuous yaw drift (M-DRIFT fails). The quaternion-norm (1e-12) and fwd⊥up (1e-9) clauses are real per-tick measurements.
- R5 does fail at 0.5×, 2× and 3× the spin. The air-time (61 ticks ≈ 1.02 s) and settle (1 tick) clauses behave as stated.
- R2: the moderate climb (4.9 m vs 4.4 m), the steep slide (initiated at tick 5, downhill-aligned 1.00) and the uphill block (0.11 m vs 12 m unimpeded) are real outcome measurements on the engineered field. The field swap and restore happen inside one synchronous block (`initTerrainField(TEST_PLANET)` at the end).
- R3: the RCS Δv and propellant (2.3999 / 2.4000 = 1.2 m/s² × 2 s) and the yaw (0.5002 rad) are real measurements.
- R6 (live trek, read only, not run): the pass needs ≥ 3 rebases, ≥ 3 chunks, geometries min === max, locals ≤ 1,032 m, a lattice-exact Δ (`onRebase` modulo-256 check) and an offset error ≤ 1e-9. These are outcome checks. Whether it can fail is left to U08 and the U11 floating-origin unit.
- `e2e/m1e.spec.ts` asserts PASSED, ≥ 1 badge and no FAIL badge. `pageerror` is logged but not asserted; that is left to U08 (all-spec plumbing).