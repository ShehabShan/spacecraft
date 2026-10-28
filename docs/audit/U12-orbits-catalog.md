# A1-U12 — orbits + catalog (KeplerRail · celestialData · orbit types)

- Unit: A1 §5 Phase C, U12. Session 67 (2026-10-23), PromptQL bot, VM v2 2 vCPU/4 GB. READ-ONLY.
- Files read in full @ 5a3e0f1: `game/src/core/orbit/KeplerRail.ts` (254, blob 06a3376), `celestialData.ts` (261, blob 5d38329), `types.ts` (105, blob fbd43cf). Targeted greps: `pre-t4:Milestone/Milestone 1B.txt` (solver, retrograde, spin), `Milestone 1E/1F/1G.txt` (parented compose, spin), `pre-t4:Design_specs/00–02` (rotation), `pre-t4:Design_specs/03_DATA_AND_CELESTIALS.txt` parsed as JSON in full. Spin users: `astronautKCC.ts:85,121,258,453,960`, `moonConfig.ts:25–33`, `Milestone1F_TestHarness.tsx:127`.
- Probe: `pre-t4:game/tools/audit/u12-orbits-catalog.mjs` (REAL `KeplerRail` + `CELESTIAL_CONFIGS` via `tools/ts-resolve-loader.mjs`; spec 03 parsed as JSON; independent bisection Kepler root; G·mass/R² from the catalog's own mass facts and IAU/NASA mean radii). Run from `game/`: `node tools/audit/u12-orbits-catalog.mjs` → **PROBE_EXIT=0**, 42 lines, controls 3/3 OK.
- Not redone (U07 covered): periods = 2π√(a³/μ), |n|·T = 2π, perifocal basis handedness, orbit spin sense, vis-viva vs finite difference, period-table staleness, Moon at 0.71 Hill radius. U10 covered: radius laws, day > year, gravityRange ≠ SOI, atmospheres, moon `portalDist` (A1-U10-12).

## Claims written before reading the code
1. Goal (AGENT_BRIEF §13): every planet and moon **rotates** and orbits in real time → each body needs a sidereal spin rate (signed), a pole (obliquity / axis) and a prime-meridian phase W0, evaluated closed-form as θ(t) = W0 + ω·simTime like the orbit rail (Spec 01 step 3 "compose with the planet's rotation rail").
2. f(E) = E − e·sinE − M is strictly increasing for 0 ≤ e < 1, so a unique root exists in [−π, π]; Newton from E0 = π for large e converges monotonically; precision should hold to e → 1, possibly with more than 24 iterations near M ≈ 0.
3. Elements with e ≥ 1 or a ≤ 0 are not ellipses; a rail that accepts them must reject them at boot or the state goes NaN.
4. Catalog = spec 03 verbatim (header claim); surfaceGravity ≈ G·mass_fact / R² for each body.

## Findings

### A1-U12-1 — No body rotates: the engine has no spin rail, no pole, no prime meridian
- Severity: S1     Confidence: confirmed
- Category: engine + spec
- Location: `game/src/core/orbit/types.ts:57–105` (CelestialConfig / OrbitParams / CelestialState carry no spin field), `KeplerRail.ts:183–253`, `celestialData.ts:85–190` @ 5a3e0f1; the only spin is a KCC-private scalar: `astronautKCC.ts:85` (`spinOmega`), `:121` (default 0.0104), `:453` (`_theta = (_theta + spinOmega·dt) % 2π`); `moonConfig.ts:27` (`MOON_SPIN_OMEGA = 0`); `Milestone1F_TestHarness.tsx:127` (0.0005). Spec: `pre-t4:Design_specs/01_ARCHITECTURE.txt:11` ("compose … with the planet's rotation rail"), `:45` ("Rotation and orbit tracked in formulas only"); `Milestone 1B.txt:82` defers spin to "the parented-state compose of a later milestone" — 1E built that compose inside the KCC only.
- Claim: §13 goal — "every planet and moon rotates and orbits, computed in real time"; Spec 01 step 3 — a planet rotation rail.
- Evidence: probe `R_spin_like_keys=none` over every key of config, orbit and runtime state; `R_grep_SimulationCore.ts=0`, `R_grep_KeplerRail.ts=0`, `R_grep_types.ts=0` (spin|theta|rotation); no file under `src/render` reads `spinOmega`. The only rotation data in the catalog is the unused string `venus.facts.rotation = 'Retrograde'` (`R_spin_facts`). The KCC phase is **integrated** (`+= Ω·dt`), not a function of `simTime`, so it does not follow the time scale or a `+60 d` jump, and it is not deterministic against the rail. It spins about the world +Y axis only (`sphericalFrame.ts:22`). The m1f Moon spins at 0.0005 rad/s = **0.24×** its orbital rate n = 0.002045 (`R_m1f_spin_over_lock=0.2445`), so it is not tidally locked; the KCC default 0.0104 is 5.1×.
- Impact: planets and moons cannot rotate in the sky or under the player as the goal requires; no day/night, no tidal locking (Moon showing one face to Earth), no axial tilt or seasons, no Venus/Uranus retrograde spin. Every future surface (other bodies, vehicles) would need its own ad-hoc `spinOmega`, which can disagree with what the sky renders.
- Proposed fix: add spin elements to the catalog (signed sidereal period or ω, pole vector / obliquity, W0; tidally locked moons ω = n), evaluate θ(t) = W0 + ω·simTime closed-form in the rail (O(1), deterministic), expose a body rotation (quaternion or basis) in `CelestialState`, and make the KCC and the renderer read θ from the rail instead of a private accumulator. Touches no RATIFIED constant; it adds data and changes the 1E compose source (needs ADR + m1e regression).
- Fix task size: does not fit one session. Split: (a) catalog spin data + rail θ(t) + Node tests; (b) KCC reads rail θ (m1e/m1f regression); (c) render body rotation + sky.

### A1-U12-2 — The rail accepts non-elliptical elements and returns NaN or a degenerate line silently
- Severity: S2     Confidence: confirmed
- Category: engine
- Location: `KeplerRail.ts:125–167` (`_addBody`: no element validation; `semiMinor = a·√(1−e²)`), `:221–251`; doc `KeplerRail.ts:45` "e ∈ [0, ~0.95]", `types.ts:34` "[0, 1)" @ 5a3e0f1.
- Claim: elements outside an ellipse should be rejected at boot (hard error, like the hierarchy check at `:103–107`).
- Evidence: probe `V_*` (Earth's orbit with one element changed, `evaluate(1234.5)`): e = 1 → finite position x = −1,059,000, speed 156.2 (a degenerate line, no error); e = 1.5 → x NaN, speed NaN; a = −1e5 → x 22,340, speed NaN; e = NaN → NaN. None throws (`threw0` ×4). Control: valid Earth finite (OK).
- Impact: one bad element from a future data import would put NaN into `absPos` and from there into the floating origin, rebase and render with no error at the source. Catalog data today are all valid (e = 0).
- Proposed fix: in `_addBody`, throw unless `a > 0 && 0 <= e && e < 1` and all elements are finite. Test-free, no RATIFIED item.
- Fix task size: fits one session (with a unit test).

### A1-U12-3 — Every orbit is circular and in one plane, including the systems where that is visibly wrong
- Severity: S2     Confidence: confirmed
- Category: spec + engine (data)
- Location: `celestialData.ts:228–239` (`e: 0, i: 0, Omega: 0, omega: 0` for every body); `pre-t4:Design_specs/03` supplies one distance per body (`C_spec_keys`: no e, i, Ω, ω) @ 5a3e0f1.
- Claim: §13 "looks like a real solar system".
- Evidence: probe `R_circular_coplanar=16/16`. Real values (NASA fact sheets): Pluto e 0.249, i 17.2°; Mercury e 0.206, i 7.0°; Uranus's moons orbit in its equatorial plane, tilted 97.8° to its orbit; Triton i 157° to Neptune's equator. The rail already supports full elements (U07: basis and solver correct), so this is a data gap, not a solver gap.
- Impact: all 16 orbits lie in one flat disc; Pluto never crosses inside Neptune's distance; moon systems never tilt. Combined with A1-U12-1 (no poles), Uranus cannot look like Uranus.
- Proposed fix: extend the catalog with real e, i, Ω, ω (and moon planes relative to the parent's equator once A1-U12-1 adds poles). Distances stay game-scaled. Data + doc only; `celestialData` constants are RATIFIED → ADR.
- Fix task size: fits one session after A1-U12-1(a).

### A1-U12-4 — Newton exit is never met for e ≥ 0.9999 near M ≈ 0 (accuracy still fine)
- Severity: S3     Confidence: confirmed
- Category: engine
- Location: `KeplerRail.ts:49–61` @ 5a3e0f1.
- Claim: claim 2 above; doc domain "e ∈ [0, ~0.95]".
- Evidence: probe `S_e*` over 4,021 anomalies per e (uniform grid + M = ±1e-12…1e-2 and π ∓ the same), against an independent 200-step bisection: |E − E_ref| ≤ 1.5e-15 rad and Newton needs ≤ 18 iterations for every e ≤ 0.999. For e = 0.9999 / 0.99999 / 0.999999, 2 / 2 / 4 points never reach |ΔE| < 1e-15 (the step oscillates at the ulp) and run all 24 iterations; the result is still within 5.9e-15 / 4.6e-15 / 2.2e-14 rad. No non-finite output for any e < 1.
- Impact: none for the catalog (e = 0). The solver is good well beyond its documented 0.95 domain; only the exit test is too tight for e → 1. The doc domain understates it.
- Proposed fix: exit on a relative tolerance (|ΔE| < 4·ε·max(1, |E|)) and document e < 0.999 as tested. Optional.
- Fix task size: fits one session.

### A1-U12-5 — `wrapAngle` returns [−π, π), not (−π, π] as documented
- Severity: S3     Confidence: confirmed
- Category: doc
- Location: `KeplerRail.ts:28–36`, `:45` @ 5a3e0f1.
- Evidence: probe `W_pi=-3.142`, `W_negpi=-3.142`, `W_3pi=-3.142` (`Math.round` rounds the half-way case up, so π maps to −π).
- Impact: none for the solver (both ends are roots of the same equation); only the comments are wrong.
- Proposed fix: correct the two comments.
- Fix task size: trivial.

### A1-U12-6 — Triton's surface gravity disagrees with its own mass fact by 8 %
- Severity: S3     Confidence: confirmed
- Category: spec (data)
- Location: `celestialData.ts:173` (`surfaceGravity: 0.717`), spec 03 same value @ 5a3e0f1.
- Evidence: probe `G_*`: g = G·mass_fact/R_mean² is within 2 % for 12/16 bodies. Off: Triton 0.717 vs 0.781 (−8.2 %); Jupiter 24.79, Saturn 10.44, Uranus 8.69 differ from the mean-radius value but Jupiter and Saturn match the equatorial-radius convention (probe recomputation at the equatorial radius: Jupiter 24.785, Saturn 10.443). Uranus 8.69 does not match G·M/R_eq² (8.869); it matches the commonly published equatorial value that includes rotation (not re-derived here). So these three are source-consistent. Triton's published value is 0.779.
- Impact: Triton's gameplay μ = g·R² (Spec 02.3) and its moon period are 8 % off reality; minor.
- Proposed fix: Triton surfaceGravity 0.779 in the fix task that touches catalog data (RATIFIED → ADR).
- Fix task size: trivial (rides with A1-U12-3).

## Checked, no issue
- Catalog = spec 03 for all 17 bodies: type, radiusGame, surfaceGravity, gravityRange, atmosphereHeight, distance/orbit radius, parent and facts all identical (`C_diffs` = only the 7 moon `portalDist`, which spec 03 omits — already A1-U10-12). The header says "03_DATA_AND_CELESTIALS.json"; the file is `.txt` with JSON content (cosmetic).
- Parents precede children; retrograde orbit set = [Triton] (matches reality and spec 03 `"orbit": "Retrograde"`); Venus's retrograde is correctly not treated as an orbit.
- `solveKeplerE` agrees with an independent bisection root to ≤ 1.5e-15 rad for e ∈ [0, 0.999] including M within 1e-12 of 0 and ±π; ≤ 18 iterations (cap 24). Starter switch at e = 0.8 is fine on both sides (8 vs 9 iterations).
- Circular fast path `e < 1e-12 → E = M` is exact; vis-viva exact at e = 0 (U07).
- Gameplay μ = g·R² and host μ lookup (`hostMuFor`) match Spec 02.3; `SUN_ORBITAL_MU = 274·20000²` is the one derived constant and is documented as such.
- Zero allocation in `evaluate()` holds by reading (scalars and field writes only).

## Seeds for later units
- U13 (SimulationCore): there is no planet rotation step in the tick; check whether step 3 "parented compose" exists outside the KCC.
- U16/U17 (KCC): spin phase is integrated (`astronautKCC.ts:453`), not derived from simTime — check behaviour under `setTimeScale` and time jumps.
- U21+ (render): no body rotation is rendered (no `src/render` file reads `spinOmega`).