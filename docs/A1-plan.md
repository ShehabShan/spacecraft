# A1 — ENGINE AUDIT (read-only) — PLAN

- Task: **A1** · Branch: `a1-engine-audit` (cut from `t1-playable-moon` @ 256d77d)
- Stage: **BUILDING** (plan READY 7/7; Lead execute order 2026-10-21, APPROVAL LEDGER)
- Last updated: 2026-10-21
- **Resume at the FIRST UNCHECKED BOX** (§5). One unit = one session = one commit.
- Binding rules for this task: AGENT_BRIEF.md §11 AUDIT MODE.

## PLANNING CHECKLIST
- [x] Goal · [x] Scope IN · [x] Scope OUT · [x] Affected modules · [x] Steps ·
  [x] Verification per step · [x] Risks & open decisions

## 1. Goal
Find out, with evidence, what is wrong in the SOLARIS specs, engine, play layer and
test gates. The specs were written by GLM 5.3 and the engine by GLM 5.3 Flash
(Lead, 2026-10-21). Deliver `docs/audit/FINDINGS.md`: ranked findings, each with a
repro and a proposed fix task sized to fit one 50-OLU session. The Lead triages
the findings at the LEAD GATE.

Yardstick (AGENT_BRIEF §13): judge everything against the project goal — a
real-looking solar system where every planet and moon rotates and orbits in real
time, on an optimised, flexible engine that can take future features (e.g. alien
combat) without a rewrite. Recommending a major rework is acceptable when it is
clearly better.

## 2. Scope IN
- Test gates first, so later fixes can be trusted: `game/src/test/*`,
  `game/e2e/*`, `game/playwright.config.ts`, `game/tools/test-play-*.mjs`.
  - Question for every row: can it fail when the property it claims is broken?
- Specs: `Design_specs/*.txt` and `Milestone/*.txt`.
  - Check physics and math against first principles, and against real data where
    the spec claims real data.
- Engine: `game/src/core/**`, `game/src/render/**`, `game/src/workers/**`.
- Play layer: `game/src/play/**`, `game/src/store/**`, routing (`main.tsx`,
  `App.tsx`).
- Cross-cutting invariants (AGENT_BRIEF §3). Audit whether each one holds AND
  whether it is a good rule.
- New, independent probes written from the spec or physics, never from the code
  under test. They live in `game/tools/audit/`.

## 3. Scope OUT
- Any edit to `game/src/**`, `game/e2e/**`, `game/playwright.config.ts`,
  `Milestone/**`, `Design_specs/**`. Fixes happen in later tasks F1, F2, … after the
  Lead triages.
- Re-litigating T1's design. Audit the T1 play code as code; T1's Q1–Q8 rulings
  stand unless a finding shows they rest on a defect.
- MS 1G (deferred). Performance tuning beyond flagging a measured problem.

## 4. Affected modules
Written: `docs/A1-plan.md`, `docs/audit/**`, `game/tools/audit/**` (new files only),
`notes/task.md`, `notes/STATE.md`. Read: everything listed in §2.

## 5. Steps (audit units — in order; one per session)
Every unit writes `docs/audit/Uxx-<slug>.md` per §6.3. Each unit's **Verification**
is §6.4 plus the unit's own evidence line. Line counts are given so a session can
see that the unit fits its budget.

### Phase A — Gate health (do these first)
- [ ] **U01 m1f baseline diagnosis** (needs an 8 GB VM; at most 3 m1f runs)
  - Run `npx playwright test e2e/m1f.spec.ts` on the unedited tree and capture
    **R2's full detail string**. Session 46 recorded R3's detail but not R2's.
  - Classify the cause:
    - (i) the Sun was culled at the suite pose. `LIVE_SECONDS = 120` is wall
      time (harness ~1394), so the end pose may depend on machine speed (see
      `notes/reports/M1F.md` §15.4);
    - (ii) the MSAA render target readback was blank under SwiftShader;
    - (iii) a real defect.
  - Evidence: badges plus the R2/R3 detail strings from each run, and the
    Sun elevation at the suite pose (logged by a probe page or a console
    read, not by a harness edit).
  - Also answer T1-B11's blocker: is the baseline red because of the
    environment, yes or no?
- [ ] **U02 m1f R1 + R2 validity** (`Milestone1F_TestHarness.tsx` R1/R2 blocks, ~981–1180; Milestone 1F grep)
  - Seeds:
    - The R2 θ audit compares `diskTheta(alpha=1)` with θ, so it can never
      fail.
    - The doc comment says ±12% / 1 px, but the code checks ±15% / 1.5 px.
    - `abRender` returns its last buffer after 6 retries without flagging it.
    - Can R1's single-camera counterfactual distinguish a broken layering?
- [ ] **U03 m1f R3 + R4 + R5 validity** (harness ~1180–1300, R4/R5 blocks; `m1fStraddle.ts`; M1F.md §12–§15 as claims)
  - Seeds:
    - R3's threshold went from 45 to 8 (round 6b). Is it now testing the
      fixture instead of the handoff?
    - R4's heap rows got longer warm-ups.
    - R5: independently verify the claim that its spawn corridor is
      "unmeetable" (§15.3). Is the gate wrong, or the terrain, or the KCC?
- [ ] **U04 m1e harness validity** (`Milestone1E_TestHarness.tsx` 1,570; `e2e/m1e.spec.ts`; Milestone 1E grep)
- [ ] **U05 m1d harness validity** (`Milestone1D_TestHarness.tsx` 1,182; Milestone 1D grep)
- [ ] **U06 m1c harness validity** (`Milestone1C_TestHarness.tsx` 1,006; Milestone 1C grep)
- [ ] **U07 m1b harness validity** (`Milestone1B_TestHarness.tsx` 1,286; Milestone 1B grep)
- [ ] **U08 m1a harness + e2e plumbing** (`Milestone1A_TestHarness.tsx` 766; all `e2e/*.spec.ts`; `playwright.config.ts`)
  - Do the specs fail on a wrong badge, a missing badge, a timeout and a page
    error?
- [ ] **U09 play-layer Node tests** (`game/tools/test-play-*.mjs`, `check-play-*.mjs`)
  - Assertions vs the claims in `docs/T1-plan.md` §13.
  - Flaky heap rows: is each one a real leak or a bad bound?

### Phase B — Specs
- [ ] **U10 Design_specs physics + scale sanity** (6 files, ~420 lines)
  - Are the units consistent across the moon radius, `g`, the orbit periods and
    the floating-origin lattice? The play config uses R = 1364.5 with
    g = 1.62 m/s²; check what scale that implies.
  - Do the specs contradict each other?

### Phase C — Engine core (spec grep per module: see the table in §6.2)
- [ ] **U11 precision + floating origin** (`core/math/precisionMath.ts` 170, `core/types.ts` 123, `render/FloatingOriginAdapter.ts` 118; Milestone 1A)
- [ ] **U12 orbits + catalog** (`core/orbit/celestialData.ts` 261, `KeplerRail.ts` 254, `types.ts` 105; Milestone 1B)
  - Check Kepler solver convergence and edge cases (e → 1, M near π).
  - Check that catalog values match their stated sources.
  - Does every body also ROTATE (sidereal period, obliquity, prime meridian),
    not just orbit? The goal requires both.
- [ ] **U13 SimulationCore** (`core/simulation/SimulationCore.ts` 486)
  - Is the tick order correct? Check fixed-step accumulation, the
    spiral-of-death guard and time-scale handling.
- [ ] **U14 terrain field** (`core/terrain/noise.ts` 134, `spherify.ts` 112, `terrainField.ts` 232; Milestone 1C)
  - Check determinism, seams, the max-height bound and the spherify
    distortion.
- [ ] **U15 spherical frame + impostor math** (`core/physics/sphericalFrame.ts` 249, `core/render/impostorMath.ts` 171)
  - Is parallel transport correct? Does drift accumulate? Is the projection
    correct?
- [ ] **U16 astronautKCC part 1** (`core/physics/astronautKCC.ts` lines 1–560)
  - Covers config, ground probe, step/slope rule (ratified) and sweeps.
- [ ] **U17 astronautKCC part 2** (lines 560–1114)
  - Covers jump/landing, sliding, airborne flight, the C¹ speed cap
    (ratified) and integrity.
- [ ] **U18 flightController** (`core/physics/flightController.ts` 750; Milestone 1D)
- [ ] **U19 aerodynamics + atmosphere** (`aerodynamics.ts` 136, `atmosphere.ts` 120; Milestone 1B/1D)

### Phase D — Render + workers
- [ ] **U20 terrain meshing + worker** (`render/TerrainMeshPool.ts` 447, `workers/terrainWorker.ts` 256)
  - Check LOD cracks, pool exhaustion and worker message races.
- [ ] **U21 camera rig + sky impostors** (`render/MultiCameraRig.tsx` 217, `render/SkyImpostorPool.ts` 326; Milestone 1F)
  - Are the layered bands (ratified) right? Check the depth handoff and the
    hysteresis.

### Phase E — Play layer
- [ ] **U22 play world** (`play/world/*` ~720)
  - Check the boot, LOD, spawn and sky state.
- [ ] **U23 controller, camera, input, frame** (`play/controller`, `play/camera`, `play/input`, `play/frame` ~750)
- [ ] **U24 character** (`play/character/*` ~716)
  - Check the rig pivots, the animation state machine, blending and the
    GLB-swap interface.

### Phase F — Cross-cutting + consolidation
- [ ] **U25 invariants + UI sweep**
  - Grep audit: does `src/core` import nothing from three, react or physics
    libraries?
  - Find per-frame allocations in tick paths, Euler accumulators, and
    violations of the page rule.
  - Skim `play/ui/*`, `store/*`, `main.tsx`, `App.tsx`.
- [ ] **U26 architecture fitness vs the goal** (AGENT_BRIEF §13)
  - Can this architecture deliver a real-looking, real-time solar system at good
    fps AND extend to new features (combat, AI entities, vehicles)?
  - Check the entity/state model, render pipeline, scale/precision strategy,
    worker use and extension points, using U01–U25's findings.
  - Verdict per area: keep / refactor / rework, each with a draft ADR.
- [ ] **U27 consolidation → LEAD GATE**
  - Write `docs/audit/FINDINGS.md`. Merge duplicate findings and rank them by
    severity × confidence.
  - Propose fix tasks F1, F2, … in dependency order, gates before engine. Each
    one is sized to fit a single 50-OLU session or is split until it does.
  - Run U27 on a **different model** than most audit units, as a second-model
    review: re-check every S0/S1 finding's repro.
  - Add a plain-language summary for the Lead (no technical choices asked;
    only look-and-feel questions, per §13).
  - Set the stage to LEAD GATE and STOP.

## 6. Method (binds every unit)

### 6.1 Session procedure
1. Run AGENT_BRIEF §5 (read, reconcile, report in ≤5 sentences). Then read only
   §6 here and your unit.
2. Read the unit's files fully. For specs, grep the module name and read only
   the matching passages. **Never read a whole `Milestone/*.txt` file**; each is
   1.9k–3.0k lines.
3. Derive the expected behaviour from physics, math or the spec **before** reading
   how the code does it. Write the claim down first.
4. Confirm or refute each suspicion with a probe in `game/tools/audit/`. Copy the
   loading pattern of the existing `game/tools/test-play-*.mjs` files. Record each
   command and its UNPIPED exit code.
5. Write `docs/audit/Uxx-<slug>.md`. Include a **"checked, no issue"** list so no
   later session redoes that coverage.
6. Check the box, update the tracker row and repoint STATE.md NEXT ACTION. Add a
   SESSION LOG row. Commit and push (AGENT_BRIEF §6).

### 6.2 Where each module is specified (grep hit counts per Milestone file)
| Module | 1A | 1B | 1C | 1D | 1E | 1F | 1G |
|---|---|---|---|---|---|---|---|
| precisionMath / FloatingOrigin | 7 / 7 | 1 / 4 | – / – | – / 2 | – / 3 | – / 3 | – / 2 |
| KeplerRail / celestialData / atmosphere | – | 18 / 5 / 22 | – | – / – / 37 | – | – | – |
| noise / spherify / terrainField / TerrainMeshPool | – | – | 15 / 15 / 7 / 9 | 5 / 3 / 2 / 3 | 3 / 2 / 3 / 3 | 4 / 2 / 3 / 2 | 1 / 3 / 3 / 2 |
| SimulationCore | 15 | 10 | – | 2 | 3 | 2 | 7 |
| sphericalFrame / astronautKCC | – | – | – | – | 3 / 2 | 2 / 1 | 2 / 5 |
| flightController / aerodynamics | – | – | – | 3 / 2 | – | – | – |
| impostorMath / MultiCameraRig / SkyImpostorPool | – | – | – | – | – | 4 / 7 / 7 | – |

### 6.3 Finding template (one block per finding in `docs/audit/Uxx-*.md`)
```
### A1-Uxx-n — <one-line title>
- Severity: S0 | S1 | S2 | S3     Confidence: confirmed | likely | suspected
- Category: spec | engine | play | test | doc
- Location: <file>:<line> @ <commit>   (and spec file + passage if relevant)
- Claim: what the spec/comment/test says should hold
- Evidence: what actually holds — probe command, output, exit code
- Impact: what goes wrong for the game or for the gate
- Proposed fix: smallest correct change + whether it touches a RATIFIED item
- Fix task size: fits one 50-OLU session? (if not: how to split)
```

Severity scale:
- **S0**: wrong physics or math that corrupts state, a crash, or a gate that cannot
  fail while it hides a defect.
- **S1**: wrong behaviour visible in play, a broken invariant, or a gate that
  under-tests its claim.
- **S2**: an edge case, a fragility or a misleading doc/comment.
- **S3**: a note or improvement.

A finding marked `suspected` must say what evidence would confirm it.

### 6.4 Verification (every unit)
- `git diff 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` is
  empty. This proves the unit stayed read-only.
- The unit file exists. Every S0/S1 finding carries a runnable repro or an exact
  code citation, and every probe's exit code is recorded.

### 6.5 Budget rule (Lead, 2026-10-21: 50 OLU per session; quality over quantity)
- Do one unit per session and start wrapping up at about 40 OLU.
- If a unit will not finish, commit what is done as `Uxxa`. Add an unchecked
  `Uxxb` box directly below it, with the remaining scope written out, and repoint
  NEXT ACTION to it. Never leave work uncommitted.
- Fewer, solid findings beat many weak ones. Do not pad. A unit with zero
  findings and a thorough "checked, no issue" list is a valid outcome.

## 7. Risks & open decisions
- **Auditor bias.** One model can share another's blind spots. The cross-model
  review at U27 mitigates this; the Lead may order more.
- **Findings may invalidate the 1A–1F approvals.** That is expected. Record it as a
  finding; do not reopen milestones in A1.
- **RATIFIED items** (KCC step/slope, C¹ cap, camera bands, impostor hysteresis,
  `celestialData` constants) may be flagged. Changing them happens in a
  fix task under AGENT_BRIEF §13 (ADR + evidence).
- **Environment.** m1f/m1e need an 8 GB VM and run one at a time; SwiftShader may
  differ from hardware WebGL. U01 decides how much that matters.
- **T1 resume point.** B11 waits on U01's verdict and on the Lead.