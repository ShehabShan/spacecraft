# A1-U10a — Design_specs physics + scale sanity (part a: spec 02 + catalog/play scale)

- Unit: U10a (session 64, PromptQL bot, VM v2 2 vCPU/4 GB) · base commit 2a99c82
- Scope done: `Design_specs/02_PHYSICS_AND_SCALE.txt` (read in full, 63 lines), the
  catalog radii, orbit radii and surface gravities in `game/src/core/orbit/celestialData.ts`,
  and the play-moon config `game/src/play/world/moonConfig.ts`.
- Scope left (U10b): specs 00, 01, 03, 04 and 05 read in full; cross-spec contradictions;
  the floating-origin lattice against the body scale; the 30× time scale against the orbit
  periods; gravity range against SOI/Hill; atmosphere heights; the artistic Sun and portal
  distances.
- Probe: `game/tools/audit/u10a-scale-sanity.mjs` reads the spec and catalog text only
  and compares them with real mean radii and semi-major axes from the IAU/NASA fact sheets.
  Run it from `game/` with `node tools/audit/u10a-scale-sanity.mjs`. **PROBE_EXIT=0**.

Expected behaviour, written before reading the code:
- Spec 02 should state one compression law each for radius, distance, moon orbit and
  gravity range.
- The catalog should follow those laws.
- g(R) = μ/R² should equal the real surface g.
- The play moon should equal the catalog moon.

### A1-U10-1 — Spec 02 has lost every formula: 9 empty value/formula slots
- Severity: S2     Confidence: confirmed
- Category: spec
- Location: `Design_specs/02_PHYSICS_AND_SCALE.txt` lines 7, 9, 17–25, 29, 32–34, 44–46, 55–57, 62
- Claim: §1–§6 define the tick length, Earth's game radius, the four §2 "Celestial Scaling
  Formulas" (radius, planet distance, moon orbit distance, gravity range), the §3 μ formula
  and its Earth example, the atmosphere height, density curve and drag map, the portal
  placement, and the logic tick rate.
- Evidence: the probe lists these lines with an empty slot. Examples: `1 tick =  game-seconds`,
  `Earth's game radius is exactly .`, `fixed  logic tick`, and `atmosphere is  high`. All four
  §2 formula bodies are blank lines. `od -c` shows two spaces where each value was, so the
  formulas were stripped from the text. Only the LaTeX `k = …` drag line survives. PROBE_EXIT=0.
- Impact: no catalog value can be checked against the spec's own laws. The scale design is
  unverifiable, and A1-U10-2 cannot say which law is intended.
- Proposed fix: restore the formulas from the original source (the Lead's design doc) into a
  new spec revision. If that source is gone, reverse-derive the laws from the catalog and mark
  them as derived. `Design_specs/` is never edited in place, so this means a superseding file
  plus an ADR.
- Fix task size: one session.

### A1-U10-2 — Catalog radii follow two different compression laws; Mars is smaller than Mercury, Charon and Titania larger than the Moon
- Severity: S2     Confidence: confirmed
- Category: spec (data)
- Location: `game/src/core/orbit/celestialData.ts` radiusGame (lines ~85–190) @ 2a99c82; `Design_specs/03_DATA_AND_CELESTIALS.txt` lines 11–173 (same values)
- Claim: there is one radius-compression law (spec 02 §2.1, now blank) that keeps proportional relationships.
- Evidence (probe table): with p defined by R_game ∝ R_real^p relative to Earth (5,000 m):
  - **√-law (p ≈ 0.50)**: 10 bodies fit R = 5000·√(R/R_E) within 3.6 %. These are Mercury,
    Venus, Phobos, Jupiter, Io, Saturn, Titan, Uranus, Neptune and Pluto.
  - **Linear (p ≈ 1.00)**: the Moon (1,364.5 m, scale 1:1,273) and Mars (2,649.3 m, 1:1,279)
    use Earth's own linear scale of 1:1,274. They are 48 % and 27 % below the √-law value.
  - **Neither law**: Titania (p 0.40, +24 % vs √), Charon (p 0.46, +10 %) and Triton (p 0.47, +4 %).
  - Visible size orderings come out wrong. Mars at 2,649 m is smaller than Mercury at 3,106 m,
    though real Mars is 1.39× Mercury. Charon (1,690 m) and Titania (2,182 m) are larger than
    the Moon, though the real Moon is 2.9× Charon and 2.2× Titania.
- Impact: relative body sizes, and so their angular sizes in the sky (`play/world/skyState.ts`
  copies these radii), do not look like a real solar system (§13 goal).
- Proposed fix: choose one law in an ADR and regenerate the radii. Changing the play Moon's
  radius ripples into terrain, KCC and harness fixtures, so the Moon may stay linear as an
  explicitly documented exception. This touches the **RATIFIED** `celestialData` constants and
  needs §13 ADR + evidence.
- Fix task size: one session for catalog + ADR. A Moon-radius change would be its own task.

### A1-U10-3 — Earth fills 14.7° of the play Moon's sky (real 1.9°); moon orbits have no common compression law
- Severity: S2     Confidence: confirmed
- Category: spec (data) / play
- Location: `celestialData.ts` orbitRadiusGame (Moon 38,850 m; Earth radiusGame 5,000 m) @ 2a99c82
- Claim: spec 02 §2.3 gives a moon-orbit law that keeps proportional relationships.
- Evidence (probe): a/R_parent in the game vs real gives the Moon 7.77 vs 60.34 (×0.129),
  Phobos ×0.821, Io ×0.410, Titan ×0.219, Titania ×0.242, Triton ×0.265 and Charon ×0.255.
  No single law fits these. Earth's angular diameter from the Moon is 2·atan(5000/38850) =
  14.7°, against a real 2·atan(6371/384400) = 1.90°, so it is **7.7× wider** than real. The
  Moon seen from Earth is wider by the same factor. Probe exit 0.
- Impact: Earth is a constant, oversized fixture in the T1 play sky (spin 0, Q8). Whether
  that is wanted is a look-and-feel choice, so it is put to the Lead.
- Proposed fix: settle the orbit law together with A1-U10-2. U07 already noted the Moon at
  0.71 Earth Hill radius (A1-U07, S3). Widening a would also fix that.
- Fix task size: same session as A1-U10-2.

### A1-U10-4 — The play Moon is a 1:1,273 world with real g: horizon 66 m, mountains 26 % of the radius
- Severity: S2     Confidence: confirmed (arithmetic from the constants)
- Category: spec / play
- Location: `game/src/play/world/moonConfig.ts`:12–20 (R 1364.5, μ = 1.62·R², amps 95/230/16, MAX_TERRAIN_H 360) @ 2a99c82
- Claim: spec 02 §3 keeps real surface gravity on a compressed radius "so gravity feels
  correct". The §13 goal is a real-looking solar system.
- Evidence (probe):
  - g(R) is 1.6200, as intended, and the jump apex is 5.44 m (the real-Moon value for 4.2 m/s).
  - The horizon from the 1.62 m eye is 66.5 m (real Moon 2,373 m).
  - The curvature drop is 3.66 m per 100 m (real 2.9 mm).
  - v_circ is 47 m/s and v_esc 66.5 m/s (real 1,680 / 2,380 m/s). Sprinting at 6.5 m/s is
    13.8 % of orbital speed.
  - Terrain relief: the summed amplitudes 95 + 230 + 16 = 341 m and MAX_TERRAIN_H 360 m are
    25–26 % of R. The real lunar total relief is ≈ 20 km, about 1.1 % of R.
- Impact: the Moon reads as a small asteroid, with a close horizon and mountains a quarter of
  the radius tall. Nothing is wrong in the physics. This is a scale/look consequence that the
  spec never states.
- Proposed fix: this is a look-and-feel decision for the Lead (question below). If "real-looking"
  wins, scale terrain relief to a few % of R. Raising R is the alternative, with its
  terrain/KCC/fixture cost.
- Fix task size: decision first; a relief change fits one session plus regression.

### Checked, no issue
- μ = g·R² (spec 02 §3 text) matches the catalog and play: g(R) = 1.6200 exactly; play `MOON_R`
  = catalog Moon radiusGame = 1364.5; `gravityRange` 8187 is identical in both.
- μ_moon/μ_earth in game = 0.01230 = the real mass ratio. This follows because the Moon and
  Earth share the linear scale with real g, so it is consistent.
- The Earth–Moon period from game μ_earth and a = 38,850 m is 3,072 s, matching the catalog
  comment.

### Look-and-feel question for the Lead (plain words, §13)
On the Moon you can see only about 66 m to the horizon, mountains are about a quarter of the
Moon's size, and Earth looks about 8 times bigger in the sky than it really does. Should the
Moon feel like a **small, dramatic world** (as now) or **look like the real Moon** (far horizon,
gentle hills, a small Earth)? Suggested default: keep the small Moon for performance, but lower
the mountains to look more lunar and keep the big Earth as an artistic choice.

**Lead ruling (2026-10-22, APPROVAL LEDGER):** the suggested default is accepted. Keep the small Moon, lower the mountains in a later fix task (A1-U10-4) so it looks more lunar, and keep the big Earth as an artistic choice (A1-U10-3 is no longer a defect to fix; it stays documented as intended).

---

## U10b — Cross-spec sanity (specs 00, 01, 03, 04, 05 vs each other and spec 02)

Session 65 (2026-10-22) · @ 0a2ff11 · probe `game/tools/audit/u10b-cross-spec.mjs` (reads spec + engine text only; run from `game/`: `node tools/audit/u10b-cross-spec.mjs` → PROBE_EXIT=0, 88 lines). All numbers below come from that probe. Read in full: specs 00 (41 lines), 01 (56), 02 (63), 03 (179), 04 (40), 05 (38).

### A1-U10-5 — The speed limits have no reference frame, and every planet and moon outruns them
- Severity: S1     Confidence: confirmed
- Category: spec
- Location: spec 00 §3 "Speed Limits" (400 / 1,600 / 2,000 m/s hard cap), spec 01 §3, spec 03 `system.maxSpeed`; `flightController.ts:142` `hardCapSpeed: 2000`; rails at `SimulationCore.ts:410` (`simTime += FIXED_DT·30`)
- Claim: 2,000 m/s is an "absolute hard cap"; the ship can fly to any body and land.
- Evidence: probe [1]. At the 30× macro clock the rails move bodies, in real seconds, at Earth 12,822 m/s, Mercury 16,193, Io 12,245 about Jupiter, Moon 2,384 about Earth, Phobos 1,973 about Mars. Their centripetal accelerations are 27.9× (Earth) to 113,452× (Phobos) their own surface g. No spec says in which frame the cap is measured.
- Impact: if the cap is heliocentric, the ship can never catch any planet, and of the 7 moons only Phobos and Charon. If it is relative to the nearest body, the specs must say how the frame hands over between bodies (and the rails' huge accelerations must be carried by the frame, not felt by the ship).
- Proposed fix: define the cap (and the drag governor's v_rel) in the frame of the dominant body, with an explicit handover rule; or slow the macro clock (see A1-U10-6). Decide by ADR in a fix task; `hardCapSpeed` is part of the RATIFIED C¹ cap.
- Fix task size: ADR + spec erratum fits one session; engine frame handover is a multi-session fix task.

### A1-U10-6 — A day is longer than a year: spin runs on real time, orbits on the 30× clock
- Severity: S2     Confidence: confirmed
- Category: spec
- Location: spec 00 §2 (Two-Tier Time) and §5 (52 m/s rotation); `astronautKCC.ts:121` `spinOmega: 0.0104`, `:453` `theta += spinOmega·dt` (real dt); spec 03 `timeScale: 30`
- Claim: spec 00 puts orbits on `simTime` (30×) and the 2 km bubble on 1×; it does not say which clock drives planet spin.
- Evidence: probe [2]. Earth day 604 s of play, Earth year 294 s, Moon month 102 s → 0.49 days per year (real 365.25), 0.17 days per month (real 29.5). Driving spin on `simTime` instead gives a 1,560 m/s equator speed and still only 14.6 days per year.
- Impact: the sky does not behave like a solar system (the Sun circles faster than the ground turns); no choice of clock makes both the 52 m/s equator and the catalog periods look real.
- Proposed fix: one time model chosen by ADR (spin rate and orbital clock set together); depends on the Lead's answer to the question below.
- Fix task size: ADR + constant change fits one session; re-verify m1b/m1e afterwards.

### A1-U10-7 — Spec 05 1B asks for "exact real-world relative positions"; the catalog cannot produce them, and spec 00 rules them out of scope
- Severity: S2     Confidence: confirmed
- Category: spec
- Location: spec 05 Milestone 1B acceptance test; spec 00 §4 ("real-date starting arrangements" out of scope); `celestialData.ts` `M0 = index·GOLDEN_ANGLE`
- Claim: after a 60-day fast-forward "planets must snap to their exact real-world relative positions".
- Evidence: probe [5]. Kepler on the catalog distances gives period ratios T/T_earth of 0.06× (Pluto) to 2.06× (Mercury) the real ones; phases start at a golden-angle spread, not an ephemeris; 60 days of `simTime` = 587.7 game Earth years.
- Impact: the 1B gate cannot test this claim as written (U07 already found the gate does not test the time scale at all); the two specs contradict each other.
- Proposed fix: spec erratum — replace "real-world positions" with "the rail state is a pure function of simTime (forward/back exact)", which is what the engine does.
- Fix task size: doc-only, part of the spec-erratum task.

### A1-U10-8 — `gravityRange` is called a sphere of influence but matches neither Hill nor Laplace SOI; the Sun has no range yet drives every rail
- Severity: S2     Confidence: confirmed
- Category: spec
- Location: spec 02 §2.4 ("Gravity Range (Sphere of Influence)"), spec 02 §3 (sum overlapping vectors), spec 03 `gravityRange` (= 6 R for 15 bodies, Earth 10.1 R) and Sun `surfaceGravity: 0, gravityRange: 0`; `celestialData.ts` header (μ_sun = 274·20,000² derived)
- Claim: each range is the body's sphere of influence.
- Evidence: probe [3] with the game's own μ = g·R². range/Hill: Phobos 13.96, Io 4.50, Titania 3.56, Triton 3.53, Charon 2.44, Titan 2.22, Moon 1.32 — but Neptune 0.12, Uranus 0.16, Pluto 0.17, Saturn 0.25, Jupiter 0.26. Probe [9]: Charon's range contains Pluto's centre (its pull is 2.76 % of Pluto's g at Pluto's near surface). In spec 02/03 the Sun exerts no gravity at all, while the rails (spec 01/05) need μ_sun — the one value the engine had to invent.
- Impact: moons pull the ship well outside the region where they dominate, outer planets stop pulling far inside it; a ship coasting between bodies feels a gravity field that does not match the rails it sees.
- Proposed fix: one stated law (e.g. range = k·Hill with μ = g·R², Sun included) chosen by ADR; or document that ranges are gameplay bubbles, not SOIs.
- Fix task size: ADR + catalog constants (RATIFIED `celestialData` values) in one session; regression m1b/m1d/m1e afterwards.

### A1-U10-9 — Atmospheres are called "shallow" but most are as tall as the planet
- Severity: S2     Confidence: confirmed
- Category: spec
- Location: spec 02 §4 ("Atmospheres are shallow"); spec 03 `atmosphereHeight`; `atmosphere.ts:8–18` (height is only a mode boundary; density is exp(−alt/H))
- Claim: shallow atmospheres.
- Evidence: probe [4]. h/R: Earth 160 %, Venus 123 %, Saturn 99 %, Neptune 81 %, Uranus 80 %, Mars 76 %, Jupiter 72 %, Titan 63 %, Sun 15 %, Triton 4 % (real Earth ≈ 1.6 %). No common law.
- Impact: the catalog contradicts its own spec; a later visual atmosphere (scattering shell) sized from `atmosphereHeight` would wrap each planet in a halo larger than the planet.
- Proposed fix: state what `atmosphereHeight` means (governor mode boundary vs visual shell) and give the visual shell its own height; settle together with the lower-relief fix (A1-U10-4).
- Fix task size: one session (doc + a separate visual constant).

### A1-U10-10 — Specs 00/01/05 are built on Rapier; the engine and the brief defer it
- Severity: S2     Confidence: confirmed
- Category: spec / doc
- Location: spec 00 §2–§3 (Rapier bubble, 1× at 60 Hz, stack), spec 01 §1 steps 4–6 and §5 state 4 (heightfield colliders in a 2 km bubble), spec 01 §6 + spec 05 1G (`intersectionsWithShape == EMPTY` gate); AGENT_BRIEF §3 ("Rapier stays deferred: the analytic KCC + sweeps ARE the design")
- Evidence: the tick order runs analytic KCC + DDA sweeps; no Rapier body exists. Probe [6]: the "local 2 km bubble" covers 53.7 % of the Moon's surface, 35 % of Charon's and all of Phobos.
- Impact: the canonical tick order (spec 01 §1) and the 1G hydration gate cannot be implemented as written; a reader of the specs gets a different engine than the code.
- Proposed fix: spec erratum mapping each Rapier step to its analytic replacement; restate the 1G gate as an analytic clearance test.
- Fix task size: doc-only, part of the spec-erratum task.

### A1-U10-11 — Spec 01 says rebase on crossing a 256 m boundary; spec 05 and the code rebase past 1,024 m
- Severity: S3     Confidence: confirmed
- Category: spec
- Location: spec 01 §1 step 2; `precisionMath.ts:30` `REBASE_THRESHOLD = 1024`, `:169` (`max|local| > 1024`); spec 05 1A (local "never exceed ~3,000 m")
- Evidence: code shifts in 256 m lattice steps but only when the 1,024 m threshold is exceeded; spec 01's wording would rebase every 256 m. Spec 05's bound and the code agree.
- Proposed fix: spec erratum (wording only).

### A1-U10-12 — Spec 03 gives no moon a portal distance; the code invents 80,000 m
- Severity: S3     Confidence: confirmed
- Category: spec / engine
- Location: spec 03 (0/7 moons have `portalDist`); `celestialData.ts` moons `portalDist: 80000`; the header claims every value is "transcribed EXACTLY"
- Evidence: probe [8]. For planets, portalDist = max(80,000, 1.5·range) holds exactly.
- Proposed fix: either drop moon portals (spec 02 §5 places portals around planets) or record the 80,000 m default as a decision; fix the header claim.

### A1-U10-13 — Two different zero-GC bars
- Severity: S3     Confidence: confirmed
- Category: spec
- Location: spec 00 §1 ("Absolute Zero-GC") vs spec 05 1C ("<1 KB of allocation per frame")
- Proposed fix: state one bar (U09 showed the play heap rows cannot measure either).

### A1-U10-14 — The artistic Sun is 3.8° wide from Earth and only 1.2× Jupiter
- Severity: S3     Confidence: confirmed
- Category: spec (look and feel)
- Location: spec 02 §2.1 exception (Sun 20,000 m), spec 03 Sun
- Evidence: probe [10]: 3.82° from Earth (real 0.53°); Sun/Jupiter radius 1.20 (real 9.95).
- Proposed fix: none required — artistic, like the big Earth (A1-U10-3 ruling); listed so it is a known choice.

### Checked, no issue (U10b)
- Camera bands (spec 04): Near 0.1 m–3 km, Mid 2–300 km, Far 200–10,000 km; the 2.4 km and 250 km thresholds of spec 05 1F both sit inside an overlap; the farthest body separation (7,540 km) fits the Far band.
- Speed tiers 400 / 1,600 / 2,000 m/s agree across spec 00, spec 03 `system` and `flightController.ts`.
- Spec 03 `timeScale: 30` = `SimulationCore` `_macroTimeScale = 30`.
- Floating-origin lattice vs body size: Moon diameter = 2.67 rebase thresholds; rebasing is independent of body size — no conflict.
- Moon ranges never reach their host's surface except Charon (A1-U10-8); Earth–Moon overlap is far from both surfaces.
- Planet portal formula max(80,000, 1.5·range) holds for all 9 planets.
- Spec 04 render loop / layer rules / pool rules have no cross-spec conflict (implementation audited in U20 and U21).

### Look-and-feel question for the Lead (U10b, plain words, §13)
Right now the planets race around the Sun: an Earth year lasts about 5 minutes of play, the Moon circles Earth in under 2 minutes, but one Earth day takes 10 minutes — so a day is longer than a year. **Should the sky move like the real solar system (days much shorter than years, planets drifting slowly so your ship can fly to them), or fast so you can watch orbits happen?** Suggested default: realistic order — days much shorter than years, and planets slow enough that the ship can keep up with them.

**Lead ruling (2026-10-22, APPROVAL LEDGER):** the suggested default is accepted. The sky follows the real order: days much shorter than years, and planets slow enough that the ship can reach them. A later fix task re-chooses the orbit speed-up, the speed-cap frame and the spin rates under an ADR (A1-U10-5, A1-U10-6). A1 records this only.
