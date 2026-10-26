# A1-U07 — m1b harness validity (orbits · catalog · Kepler rails)

- Unit: A1-U07 (`docs/A1-plan.md` §5 Phase A) · audited at `5a11dc6` · session 59 (2026-10-22)
- Files read in full: `game/src/test/Milestone1B_TestHarness.tsx` suite region (:1–110 header + singletons, :300–662 reference + `runSuite`), `game/src/core/orbit/KeplerRail.ts` (254), `game/src/core/orbit/celestialData.ts` (:1–62 banner, :190–261 derivation), `SimulationCore.ts` (:160–200 time API, :396–476 tick), `e2e/m1b.spec.ts`. `Milestone/Milestone 1B.txt`: targeted grep only (period, vis-viva, Kepler-3, retrograde, reversibility).
- Probe: `game/tools/audit/u07-m1b-validity.mjs`. It runs the REAL `SimulationCore` + `KeplerRail` in Node and the harness's `referencePosition … runSuite` sliced VERBATIM (harness lines 316–661, esbuild type-strip; only `publishSuite`/`suiteState` stubbed). It then runs 3 controls that must fail, 7 mutations, and independent physics truth.
- Command: `cd game && node tools/audit/u07-m1b-validity.mjs` → **PROBE_EXIT=0** (run 1: 22/23 confirmed; run 2: 23/23 confirmed; controls OK in both). The one line that differs between runs is the GC-dependent heap verdict, which is itself finding A1-U07-3.

## Expected behaviour, derived before reading the code
- Circular orbit, host μ = g·R² (spec 02.3), Sun μ = 274·20,000² = 1.096e11 m³/s²: T = 2π√(a³/μ), |n| = 2π/T, speed √(μ/a). Earth: T = 2π√(6e5³/1.096e11) = 8,821 s.
- Prograde = counter-clockwise seen from +Y (the rail's stated convention); Triton is the only retrograde orbit.
- T5: 2,000 m/s from 0 to ≥ 10,000 m with a 1,024 m rebase threshold on a 256 m lattice → shifts at 1,024, 2,048 … 9,216 m = 9 shifts of exactly 1,024 m.

## Row-by-row verdict
| Row | Can it fail when its claim breaks? | Mutation evidence |
|---|---|---|
| T1 closed-form | **Only for positions off the rail's own ellipse.** It re-uses the rail's `n`, `basisP/Q` and `semiMinor`; Kepler-3 and vis-viva clauses are identities. | n×1.01 P · n×2 P · reversed handedness P · moon radius +0.1 % P · planets b = 0.8a P; +1 m after evaluate F |
| T2 reversibility | **Yes, for impurity** (history-dependent evaluate). The exact-restore clause adds nothing beyond that. | stateful evaluate F |
| T3 parenting | **Partly.** Radius and host chord are real checks; phase uses the config `n`, so time-scale errors pass. | moon radius +0.1 % F · planets b = 0.8a F; n×2 P · reversed handedness P |
| T4 zero-gc | **Not reliably.** Identity canary only; heap clause passes N/A and negative Δ. | 1.3 GB churn: P (no API); F F F (run 1) vs F P P (run 2); retained 160 MB leak F |
| T5 m1a-regression | Yes for count/bound; the "4×256 exact" Δ in its detail is never checked (it holds). | — |

## Findings

### A1-U07-1 — No m1b row checks the orbital time scale; Kepler-3 is a tautology
- Severity: S1     Confidence: confirmed
- Category: test
- Location: `game/src/test/Milestone1B_TestHarness.tsx:332` (reference uses config `o.n`), `:436-450` (Kepler-3 loop over config `o.T`), `:539-541` (T3 phase vs `wrapAngle(o.M0 + o.n·D)`) @ 5a11dc6; engine `game/src/core/orbit/KeplerRail.ts:207` (`M = wrapAngle(o.M0 + o.n·t)` — the rail uses `n`, never `T`); `celestialData.ts:226-227`.
- Claim: header :18-21 — "+60 d: all 17 bodies match an INDEPENDENT closed-form reference … Kepler-3 ratio (T_p/T_e)² = (a_p/a_e)³ ≤ 1e-12"; Milestone 1B §1.4 "A single μ_sun means Kepler's Third Law holds exactly … asserted in the acceptance suite".
- Evidence: probe mutations `M-N1` (Earth `n` ×1.01, `T` unchanged) and `M-N2` (every `n` ×2): **all 5 rows PASS** (`blind-mean-motion-one`, `blind-mean-motion-all`). The reference and T3 read the same `n` the rail reads, and the Kepler-3 clause checks `T`, a field the rail never consumes. The ratio (T_p/T_e)²/(a_p/a_e)³ equals 1 for ANY single μ, because both `T`s come from the same formula — the clause cannot detect a wrong μ_sun either. The engine itself is right today: independent T = 2π√(a³/μ) matches config `T` (rel 0) and |n|·T − 2π ≤ 1.8e-15 (`truth-periods`).
- Impact: if a later change breaks `meanMotion`, μ, or the time-scale plumbing, every body orbits at the wrong rate (wrong year length, wrong moon phases) and the gate stays green. This is the one quantity the rails exist to get right.
- Proposed fix: compute the expected position at t from an independent `T_ref = 2π√(a³/(g_host·R_host²))` (from the RAW catalog values), i.e. θ(t) = M0 + sign·2π·t/T_ref, and compare; replace the Kepler-3 ratio with |n|·T_ref = 2π and with a check of μ_sun against the spec value. Test-only; touches no RATIFIED item.
- Fix task size: one session (one harness block + a mutation re-run with this probe).

### A1-U07-2 — The "independent" reference re-uses the rail's geometry; orbit direction is never checked
- Severity: S1     Confidence: confirmed
- Category: test
- Location: `Milestone1B_TestHarness.tsx:305-341` (reference reads `state.basisP`, `state.basisQ`, `state.semiMinor` — values computed by `KeplerRail._addBody`, `KeplerRail.ts:150-166`) @ 5a11dc6.
- Claim: :305-314 "Independence is in the code path"; T3 detail :562 "(incl. retrograde Triton, n < 0)".
- Evidence: `M-RETRO` (negate `basisQ` on every body → every planet and moon retrograde, Triton prograde): **all 5 rows PASS** (`blind-handedness`). `CONTROL moon basisP ×1.001` (Moon orbit radius +38.9 m): closed-form PASSES, only T3 fails. `M-SHAPE` (planets squashed to b = 0.8a): closed-form PASSES, only the T3 host-chord clause fails. The true spin sense is correct today: (r×v)·ŷ > 0 for all 15 prograde bodies and < 0 for Triton (`truth-spin-sense`), finite-difference speed matches vis-viva to 5.0e-6 rel (`truth-fd-speed`).
- Impact: T1 only proves the rail evaluates its own boot-computed basis consistently; a wrong basis, flattened orbit, or flipped orbit direction is invisible to T1, and direction is invisible to every row. The "bit-exact" pass is bought by mirroring the code under test.
- Proposed fix: build the reference basis from the elements (i, Ω, ω = 0 → p̂ = (1,0,0), q̂ = (0,0,−1), b = a·√(1−e²)) without reading `CelestialState`; add a direction clause: sign((r×v)·ŷ) = sign(n) per body via a finite difference. Accept a tolerance (e.g. 1e-6 m) instead of bit-exactness. Test-only.
- Fix task size: one session; can be merged with A1-U07-1 into one "m1b T1/T3 independent truth" fix task.

### A1-U07-3 — Zero-GC row: heap clause passes on missing API and on GC; verdict flips between runs
- Severity: S1     Confidence: confirmed
- Category: test
- Location: `Milestone1B_TestHarness.tsx:573-610` — canary :576-581 (identity of state / `absPos` / `localPosF32` only), `:599-600` (`heapDelta = heapBefore >= 0 ? after − before : −1`; `heapOk = heapBefore < 0 || heapDelta ≤ 1 MB`), `:606` (prints a negative Δ as "N/A") @ 5a11dc6.
- Claim: header :28-30 "Zero-GC: 20,000 synchronous ticks — identity canary (hard fail on any reallocation) + heap guard (≤ 1 MB)".
- Evidence: `M-ALLOC` (64 KB garbage per `evaluate`, ≈ 1.3 GB over the burn) passes with no `performance.memory` (`blind-alloc-na`). With a live heap API, the same churn gave F F F in run 1 and F P P in run 2 (the passing runs printed "heap Δ N/A" — a negative delta mislabelled as unavailable). A retained 160 MB leak does fail (`heap-catches-retained`), so the clause catches leaks, not allocation. Same pattern as A1-U03 (m1f R4) and A1-U04 (m1e R4). `playwright.config.ts` adds no `--enable-precise-memory-info` (U03-5).
- Impact: the "zero allocation in the tick loop" invariant (AGENT_BRIEF §3) has no working gate on the orbit path; a regression may pass or fail depending on when GC runs.
- Proposed fix: same fix as U03/U04 — sampling-based allocation check (CDP `HeapProfiler.startSampling` on the burn, or `--js-flags=--expose-gc` + `gc()` before/after and fail on negative or missing data); print the real delta. Best done once for all harnesses (U25 cross-cutting).
- Fix task size: one session for a shared helper used by m1b/m1e/m1f.

### A1-U07-4 — Vis-viva clause is an identity and skips all moons
- Severity: S2     Confidence: confirmed
- Category: test
- Location: `Milestone1B_TestHarness.tsx:440-458` (`continue` for `parentId !== null`; compares `orbitalSpeed = √(μ(2/r − 1/a))` with `√(μ/a)` using the same `o.muHost`) @ 5a11dc6.
- Claim: header :21 "vis-viva speeds consistent".
- Evidence: `M-SPEED` (moon `orbitalSpeed` ×1.1 after every evaluate): all rows PASS (`blind-moon-speed`). For e = 0 with r = a, the two expressions are algebraically equal, so the planet clause tests IEEE rounding only.
- Impact: the telemetry speeds the HUD shows are unverified for moons and only self-consistent for planets.
- Proposed fix: compare `orbitalSpeed` to a finite-difference |Δr/Δt| relative to the host (this probe's method, rel dev 5e-6) for all 16 orbiters.
- Fix task size: small; fold into the A1-U07-1/2 fix task.

### A1-U07-5 — Acceptance console line and T3 detail print literal `{…}` instead of values
- Severity: S2     Confidence: confirmed
- Category: test
- Location: `Milestone1B_TestHarness.tsx:656-658` (`maxPosErr={errRoundTrip…}`, `restore={identityOk…}`, `heapDelta={rebaseDelta}` — missing `$`, and `heapDelta` would print the rebase count), `:516` (`moonNames += \`{s.config.name}\``), `:560` (`\`{moonNames}) verified…\``) @ 5a11dc6.
- Evidence: baseline console line in Node: `[Milestone1B] acceptance PASSED in 56.8 ms — maxPosErr={errRoundTrip.toExponential(1)}m restore={identityOk ? 'OK' : 'FAIL'} heapDelta={rebaseDelta}`; T3 detail starts `{moonNames}) verified…` (`log-labels-wrong`, `moon-names-literal`). `e2e/m1b.spec.ts:26-28` checks only `PASSED` and no `FAIL` badge, so the gate never sees numbers.
- Impact: the CI transcript — the only evidence a reviewer gets — contains no measured values; the T3 moon list is missing.
- Proposed fix: add the `$`s, log `heapDelta` as the heap delta and `rebaseDelta` under its own name. Test-only.
- Fix task size: trivial; fold into any m1b fix task.

### A1-U07-6 — Documented period table is stale by up to 11 s
- Severity: S2     Confidence: confirmed
- Category: doc
- Location: `game/src/core/orbit/celestialData.ts:38-43` (banner table) @ 5a11dc6; the same table appears in `Milestone/Milestone 1B.txt` (≈ :545-550).
- Claim: "Derived period table (documented values; code computes exactly)".
- Evidence: independent T = 2π√(a³/μ) vs the table (`doc-table-stale`): Mercury 4,379.3 vs 4,381 · Venus 6,961.3 vs 6,963 · Jupiter 30,387.1 vs 30,392 · Saturn 48,144.2 vs 48,139 · Uranus 81,133.1 vs 81,144 · Neptune 113,257.9 vs 113,254. Earth, Mars, Pluto and all 7 moons agree to ±1 s. The code is right; the table is wrong.
- Impact: a later session that checks the code against this table will "find" non-existent errors or "fix" correct code.
- Proposed fix: regenerate the table from the code (or delete it and point to a one-line print). Comment-only change in a fix task.
- Fix task size: trivial.

### A1-U07-7 — Earth's Moon sits at 0.71 of Earth's Hill radius
- Severity: S3     Confidence: confirmed (math), impact suspected
- Category: spec
- Location: `celestialData.ts:113` (Moon `orbitRadiusGame: 38850`, Earth R 5,000 m, g 9.81) with `SUN_ORBITAL_MU` (:47).
- Evidence: r_H = a_E·(μ_E/3μ_sun)^(1/3) = 54.4 km; a_Moon/r_H = 0.71 (`note-hill`). Real Moon ≈ 0.26; prograde orbits are stable to roughly 0.5 r_H. Other moons: Phobos 0.19, Titan 0.19, Io 0.11, Titania 0.11, Charon 0.12, Triton 0.08.
- Impact: none on analytic rails. It matters for any future gravity that sums Sun + planet near the Moon (ship trajectories, patched conics, a later n-body option): the Sun's pull there is comparable to Earth's, so ship physics near the Moon would not look real. To be confirmed in U12 (orbits + catalog) against the gameplay gravity model.
- Proposed fix: decide in U12/U26 whether gameplay gravity is single-body (then this is harmless) or multi-body (then raise μ_Earth or lower a_Moon).
- Fix task size: n/a (note).

## Checked, no issue
- Baseline: all 5 rows PASS on the unmodified engine in Node (`baseline-all-pass`).
- Controls caught: +1 m position error → closed-form F; history-dependent evaluate → reversibility F; Moon radius +0.1 % → parenting F; retained 160 MB leak → zero-gc F (with a heap API).
- Periods and mean motions: config `T` = independent 2π√(a³/μ) (rel 0), |n|·T = 2π to 1.8e-15, μ = g·R² per spec 02.3, μ_sun = 1.096e11 as documented.
- Retrograde set = [Triton] (matches reality); spin sense correct for all 16 orbiters (finite difference).
- Vis-viva speed vs finite-difference speed: max rel 5.0e-6 (all 16 orbiters).
- `solveKeplerE`: residual ≤ 6.7e-16 over a 96 × 4,001 grid, e ∈ [0, 0.95], M ∈ (−π, π] (the harness probes 44 points). No catalog body uses it (all e = 0), so this is future-proofing.
- Perifocal basis `Rz(Ω)Rx(i)Rz(ω)` with the Z-up → Y-up relabel (x, y, z) → (x, z, −y): right-handed (det +1); identity elements give p̂ = (1,0,0), q̂ = (0,0,−1), CCW from +Y (by hand + spin probe).
- T2 round trip from 0 is bit-exact by IEEE (0 + D − D = 0); the exact-restore clause is a re-evaluation of the same double (pure function), true by construction and harmless.
- T5: 9 origin shifts of exactly 1,024 m (= 4 × 256) during the 2,000 m/s flight (`truth-t5-deltas`); celestial `localPosF32` = f32(abs − origin) on every tick through all 9 rebases (max err 0, `truth-celestial-locals`).
- Golden-angle epoch spread `M0 = index·2.39996… mod 2π`: deterministic, no clustering issue for the gate.
- `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs`: empty (read-only held).