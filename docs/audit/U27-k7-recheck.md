# U27 K7 — slope, landing orientation and tick coordination recheck

2026-10-26 · session 100 · **U27b4bbba** (completed part of U27b4bbb).
Base `7c4983e`, branch `a1-engine-audit`; reviewer **gpt-6-astra**, confirmed
by platform `llm_usage` (`evidence/U27-k7/model-meter.json`). The Lead reports
Opus 5.5 original reviews; historical per-unit/majority attribution is still
not independently established. No overall cross-model completion claim.

## Result and scope
All three K7 findings retain **S1**, with corrected scope below. **51/55**
high-priority findings now reviewed; K8/K9's four findings remain unchecked as
U27b4bbbb. U27c synthesis has not started. No game code or old probe changed.

Before source review, expected properties were recorded in
[evidence/U27-k7/claims-before-source.md](evidence/U27-k7/claims-before-source.md).
Read fully: KCC, SimulationCore, PlayerController, playFrame, moonWorld,
ThirdPersonCamera, shellStages, moonConfig, CharacterTelemetry, three original
reports and their targeted probes. Milestone 1E was searched only for relevant
passages; no whole milestone file was read.

New reproducible probe (from `game/`):
```
node tools/audit/u27-k7-recheck.mjs
node tools/audit/u27-k7-recheck.mjs --self-test-fail
```
Uses real classes and actual playFrame; browser/DOM mounting and GPU rendering
are not exercised. A fake pool supplies no resident terrain; this is not a
streaming or visual regression verdict. Synthetic terrain is substituted
in memory only, and separately identified below. The loader uses actual React
exports, but no React hooks are invoked. Independent assertions fail closed.

## A1-U16-1 — slope acceptance uses the wrong distance
- **Disposition:** re-confirmed, S1 confirmed; engine, RATIFIED slope rule.
- **Location:** `game/src/core/physics/astronautKCC.ts:614–620, 715–739, 775–786`
  @ `7c4983e`. Milestone 1E lines 33–36 explicitly call the move tangent-plane
  and the ratio a terrain-angle limit of 50°.
- **Claim:** radial-height rise must be divided by horizontal surface travel,
  not the length of a tilted character-frame displacement.
- **Original evidence:** unchanged `u16-kcc-step-rule.mjs`, exit 0,
  controls 5/5. Same 3,000 real-Moon sample: accepted maxima
  58.66/58.78/59.01° at crouch/walk/sprint; zero-blend controls
  50.00/50.00/49.92°. These are sampled maxima, not global bounds.

**Independent check.** Prescribe `h = R m longitude`, with `m = tan(slope)`;
its analytic normal follows from the radial-surface gradient, without the
engine's finite-difference normal. From the north-pole start and eastward
motion, rise/horizontal arc is exactly `m`. Bundle the unedited KCC against
that in-memory service. Matrix: slopes 0/40/49/51/55/60°, blend 0/.65, speeds
1.5/3.2/6.5 m/s, 36 combinations:
- 0/40/49° accepted by both implementation and independent oracle.
- 51/55° accepted at .65 blend at all three speeds, rejected by the oracle.
- 60° rejected; zero-blend control rejects every tested >50° climb.
- Full `update(1/60)` at 55°, with slide disabled **only for isolation**,
  moves 0.04294 m horizontally and raises radial height about 0.06132 m.
  This verifies more than a private `_tryMove` invocation.

**Interpretation/impact.** The step predicate mixes an upright-height
numerator with a tilted-path denominator. Visual up blending therefore changes
climb acceptance. Real-normal errors can widen it further; the idealised
56.26° prediction is not a universal production threshold. The 1 mm
flat/downhill shortcut, finite step size, wall-slide retry, and slide forces
also prevent interpreting the title as a sharp cap on all movement.

**Proposed fix:** define horizontal travel and use it consistently for the
ratio, retaining independent analytic and real-terrain tests. Do not assume
a one-line denominator change settles grounded velocity, tiny moves,
wall-slide retries or slide/walk overlap. Split implementation/regression
work if required. A production ADR is required for the RATIFIED rule; no
threshold/blend change is adopted here. Candidate size: one gate unit,
then one bounded slope implementation/regression unit (U27c to schedule).

## A1-U17-3 — uneven-ground contact can snap the visible orientation
- **Disposition:** re-confirmed, S1 confirmed; engine/play. **Withdraw “every
  landing”.**
- **Location:** KCC `:856–865, 1019`; playFrame `:101–120`;
  ThirdPersonCamera `:102–173` @ `7c4983e`.
- **Claim:** airborne smoothing alone does not ensure continuity through
  contact. The source's “C0, no snaps” comment is local to airborne alignment,
  not an explicit global landing contract. Smooth contact is a quality
  judgement under the project goal, not a new physics requirement.
- **Original evidence:** unchanged `u17-kcc-part2.mjs`, exit 0, controls 5/5.
  120 standing jumps: landing up step median 18.84°, p90 33.09°, max 50.79°;
  85.83% >10°. Largest airborne step 0.2103°. This is not a population rate.

**Independent check.** Generate deterministic Fibonacci directions; select
32 real-Moon sites with initial blended-up tilt 12–25°. Drop radially from
1 m with 1 m/s downward velocity, spin 0. All land without NaN:
- Up step: min 13.2955°, median 20.7406°, max 24.2987°.
- Same sites with `upBlendWeight=0`: max step 2.44e-14°.
- Flat synthetic sphere + radial drop: zero snap. This is a direct
  counterexample to the universal original title.

**Play consumer verification.** A real `createMoonWorld` / `createPlayFrame` /
`ThirdPersonCamera` drop at the recorded witness direction gives one-frame
changes: KCC up 24.2987°, character-root quaternion 24.3617°, TP-camera
quaternion 24.3111°. The character root takes the KCC frame directly;
camera pivot-position lag does not smooth its orientation. This closes the
original “check play smoothing” gap at the render-data level, not with a
browser image or subjective feel test.

**Impact/fix proposal:** uneven-ground landings can abruptly rotate both
character and camera. Keep physical/contact normal distinct from visual up;
choose a bounded orientation transition and preserve grounded collision
correctness. Do not blindly smooth KCC.up: it also defines movement axes.
The Lead's unanswered landing-feel choice remains for U27c (suggested
smooth lean, not snap); no new question is needed to establish the defect.
Candidate: independent transition gate, then one orientation integration
unit after frame/terrain contracts; no production implementation adopted.

## A1-U13-2 — schedules disagree; stale extraction confirmed, camera story corrected
- **Disposition:** re-confirmed, S1 confirmed for timing and stale pose;
  **withdraw simple “character lags camera” assertion**.
- **Location:** PlayerController `:75–90` vs SimulationCore `:377–395`;
  playFrame `:94–124` @ `7c4983e`.
- **Claim:** one coordinated tick schedule should drive KCC, core and extraction.
- **Original evidence:** unchanged `u13b-lockstep-gc.mjs`, exit 0. Its copied
  controller schedule vs real core again gives 5,999/36,000 per-frame
  disagreements at 144 Hz, bounded cumulative lag one tick; quantised
  timestamps give 1,999/36,000. This is **bounded phase disagreement**, not
  unbounded accumulated drift. Unrelated GC output is not re-reviewed here.

**Independent real pipeline.** Real shell/controller/KCC/core/playFrame/camera;
10 seconds constant sprint on a zero-amplitude sphere via the genuine terrain
service, to isolate scheduling from roughness. First resume frame excluded;
boot tick excluded from measured tick counts.

| Rate/control | KCC/core ticks | Frames with unequal tick counts | Stale root frames >1 mm | Max root error vs current f64 position minus origin |
|---|---:|---:|---:|---:|
| 60 Hz | 600/600 | 0 | 0 | 0.000004185 m |
| 120 Hz | 600/600 | 0 | 0 | 0.000004185 m |
| 144 Hz | 600/599 | 239/1440 | 120/1440 | 0.108335315 m |
| 144 Hz, matched-count control | 600/600 | 0 | 0 | 0.000004185 m |

The control replaces only the live instance's `core.advance` in memory,
using the controller's count; it is a diagnostic, not the final scheduler
design. Entity write-through exactly equals KCC position throughout.
Matching frames show only f32 narrowing, not duplicate dynamic integration.
A disagreement can be the core's catch-up frame, so 239 disagreement frames
do **not** mean 239 stale-render frames.

**Camera correction.** `poseInto` does read current KCC position to calculate
pivot/lag/offset. But the final driver position is `alp + offset`, where
`alp` is the **same** stale extract used by characterRoot. Measured shared
anchor error is exactly zero in all four runs. Thus the old direct
“camera current, character old” argument is wrong; the camera has a mixed-time
offset on a shared stale anchor. No subjective jitter severity or pixel
displacement is claimed. Terrain-relative rendered position is still stale.

**Proposed fix:** one authoritative tick schedule, with KCC/core processing
paired per tick and consistent post-tick extraction. Merely copying an epsilon
into another accumulator leaves duplicate scheduling ownership. Preserve
pause/respawn semantics and test multi-tick, zero-tick, quantised and jittered
frames. Separate interpolation (U13-4) from this fix. Candidate: one independent
schedule gate, then one implementation/regression unit.

## Checked, no issue / limitations
- Shallow analytic slopes pass; 60° and radial-up over-limit controls reject.
- Flat landing is continuous; no NaNs in the selected 32 real drops.
- Both character/camera render-data orientations carry the sampled landing snap.
- 60/120 Hz schedules agree in the controlled actual pipeline.
- Entity write-through remains current; camera and character share the
  extraction anchor; matched scheduling removes stale errors.
- No source, original probe, milestone or design-spec edits; no optimisation,
  browser performance, streaming, GPU or complete gameplay regression claim.
- K8/K9, slope-feel decisions, and historical model-majority provenance remain open.

## Commands and observed unpiped exit codes
Logs under `docs/audit/evidence/U27-k7/`; `exits.txt` records exits.

| Command / run (from game unless stated) | Exit / result |
|---|---|
| `npm ci` | 0 |
| `node --expose-gc tools/audit/u16-kcc-step-rule.mjs` | 0; controls 5/5 |
| `node --expose-gc tools/audit/u17-kcc-part2.mjs` | 0; controls 5/5 |
| `node --expose-gc tools/audit/u13b-lockstep-gc.mjs` | 0; original copied-schedule metrics above |
| New probe initial run | 1; React-stub/default-export loader error, retained in independent-1.log |
| New probe final + repeat | 0 twice; 17/17 each |
| New probe `--self-test-fail` | 1 expected; 17/18, deliberate failure |
| `npm run typecheck` | 0 |
| `npm run build` | 0 (Vite chunk-size advisory retained) |
| repo root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0, empty |
| repo root: old three probe diff vs `7c4983e` | 0, empty |

Source hashes are recorded in `source-sha256.json`. Bootstrap clean/pulled at
`7c4983e`; tracker parent `029488c` was correct, no drift to repair.
Audit method decision: [draft ADR](U27-k7-adr-draft.md). Wrap scope was fixed
before expanding into K8/K9 to preserve the session budget and push reserve.