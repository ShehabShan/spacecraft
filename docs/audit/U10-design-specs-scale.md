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
