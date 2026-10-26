# A1 U27b4bbbb — K8/K9 sky geometry and foot-contact recheck

- Session 101 · 2026-10-26 · baseline `90e6f1af77a89439a005b490bea2fbfe6c1f7f21`.
- **Four S1 findings retained with qualifications. All 55 S0/S1 findings now have recheck evidence; this does not certify completion of the historical model-majority condition.**
- Read-only: new probe, audit documents/evidence and process updates only. No production fix adopted.
- Reviewer: `gpt-6-astra`, platform usage confirmed in `evidence/U27-k8-k9/model-and-budget.json`.
- Resume: clone/pull through GitHub integration; HEAD = origin, clean. Tracker's parent `7c4983e` agrees with the documented parent-hash convention; plan/NEXT agree. No drift repair needed.

## Method and coverage

Independent expectations were written before this session read the implementations:
[`claims-before-probe.md`](evidence/U27-k8-k9/claims-before-probe.md).
Full reads: `core/render/impostorMath.ts`, `render/SkyImpostorPool.ts`,
`play/character/*.ts`, `play/world/skyState.ts`, and the three original probes.
Targeted reads: animation gate rows 15/17c, T1 plan §8.3/§8.6/§8.7,
Milestone 1F §1.2 and matching projection/depth passages (not the entire milestone).

New probe: `game/tools/audit/u27-k8-k9-recheck.mjs`.
It imports unchanged modules through esbuild, using an ignored cache bundle.
It does **not** reuse the old probes' forward kinematics or placement formulas
as its measurement path:

- Inspect actual pool instance matrices and `aDisk` attributes. The shader's
  half-coverage boundary is `length(uvPlane) = disk.y / disk.x`.
  Compare its rays to the sphere tangent cone:
  `(ray·centre)^2 = |centre|² − R²`, with unit ray pointing toward the sphere.
- Trace a **common ray inside both submitted disks**, and independently solve
  the first positive ray/sphere intersections for disjoint true spheres.
- Run the live animator, transform actual boot-mesh bottom vertices through
  its hierarchy, and measure world-space sole heights on an ideal flat floor.
- Run the real terrain normal → telemetry sampler → animator → root/rig chain;
  compare transformed sole normals with the original terrain normal. Pitch,
  flat, sign-change and world-normal alignment controls respond.

These are CPU geometry/pose checks, not browser screenshots, GPU rasterization
or subjective game-feel tests. Probes include expected-defect assertions;
48/48 means the audit evidence/controls behaved as specified, **not** that the
game passed a correctness suite.

## A1-U15-3 — Off-axis projection: retain S1, correct the visual explanation

- Severity **S1** · Confidence **confirmed** · Category engine/render + spec.
- Location at baseline: `SkyImpostorPool.ts:263–285` (one camera quaternion for
  all instances and disk attribute writes); `impostorMath.ts:9–24`;
  Milestone 1F §1.2 asserts an exact off-axis tan-law projection.
- Claim: each submitted disk preserves the true sphere's angular silhouette.
- Evidence: 720 boundary samples for each half-angle `{1°, 3.68°, 7.39°}` and
  camera offset `{0°, 30°, 45°}`. Selected actual-matrix results:

| Half-angle | Camera offset | Submitted/reference screen width | Largest boundary angular error |
|---|---:|---:|---:|
| 3.68° | 0° | 1.00000001 | < 0.000001° |
| 3.68° | 30° | 0.864831 | 0.591064° |
| 3.68° | 45° | 0.704182 | 1.189184° |
| 7.39° | 45° | 0.695212 | 2.588017° |

Reorienting the **same matrix** perpendicular to the body's line of sight
makes all sampled angular errors < 0.000001°. On-axis is already correct.
This control validates silhouette geometry only, not lighting/shader normals.

**Corrections to U15:** the camera-facing disk remains a *screen-space circle*;
the projected sphere silhouette off-axis is a conic, elongated radially.
“Earth turns into an ellipse” was the wrong description of this defect.
The old `theta = 0.0642` example is a synthetic 3.68° **radius**, not the
current play Earth's radius. The old probe itself prints Earth about 7.39°
radius from the Moon centre (about 14.78° diameter). Moreover, play Earth is
a separate mesh: it is absent from `PLAY_BODIES`. Do not claim these tests
demonstrate a distorted Earth impostor in today's play page. Sun/planet slots
use the affected pool, but no fresh visual severity or pixel-size measurement
was made.

- Impact: the generic impostor silhouette is wrong away from the camera axis.
- Proposed fix: line-of-sight-oriented geometry or equivalent analytical
  projected-sphere silhouette, verified independently. Couple it to U15-4's
  depth solution; do not certify shading from this control. RATIFIED bands and
  hysteresis need not change.
- Size: one geometry/gate session, followed by a separately verified depth
  session if both cannot fit 50 OLU.

## A1-U15-4 — Mutual occlusion: retain S1, prove common-ray inversion

- Severity **S1** · Confidence **confirmed in controlled overlapping fixtures**.
- Category engine/render + spec.
- Location: `SkyImpostorPool.ts:160–168, 249–285`,
  `impostorMath.ts:20–24, 84–87`; Milestone 1F §1.2 depth-staggering claim.
- Claim: far-to-near rank spacing preserves the frontmost body's visibility.
- Evidence: near/far true centre distances 100,000 / 300,000 m and angular
  radii 3.68° / 1°. True spheres are disjoint. At offsets 30° / 31°, a 30.5°
  ray is comfortably inside both submitted disks (normalized disk radii
  0.15747 / 0.58023, away from AA). True first intersections are 93,637.40 /
  295,454.37 m, so the near body must win. Actual near/far submitted view
  depths are **8,274.873 / 8,228.806 m**: the far body wins with the material's
  enabled depth test/write. The 20° / 21° fixture also inverts.
- Controls: 0° / 1° and 30° / 29° shared-ray fixtures preserve ordering.

The direction-normal geometry control alone is insufficient for large disks:
with near radius 8°, centres 30° / 36° and a ray through the far centre, both
disks cover the ray, but near/far staged ray distances are
**9,607.632 / 9,600.000 m**. The critical near half-angle for these adjacent
ranks is `acos(9555/9600) = 5.549809°`. A 3.68° disk does **not** exceed this
threshold even at its limb; preserve the distinction between radius and diameter.

- Impact: generic overlapping impostors can occlude in the wrong order.
  No current frozen-sky conjunction was demonstrated, and this is **not**
  evidence of a planet showing through today's separately rendered Earth mesh.
- Proposed fix: explicitly preserve rank in depth, or use a separately ordered
  compositing pass, together with the silhouette correction. A painter-order
  alternative must verify actual instance/render ordering, AA, stars/glow and
  terrain composition. Do not simply promise that disabling depth testing is
  sufficient. These experiments choose no production strategy.
- Size: independent overlap gate + depth implementation in one 50-OLU session;
  keep shader/compositing verification separate if needed. No band/hysteresis
  change is required by the finding.

## A1-U24-1 — Stance height: retain S1 through the actual rig

- Severity **S1** · Confidence **confirmed on a controlled flat floor**.
- Category play/test.
- Location: `ProceduralAnimator.ts:70–112` (straight stance leg and independent
  pelvis bob); `AstronautRig.ts:40–45, 83–90`; `tools/test-play-anim.mjs:220–235`.
- Claim: a planted stance foot stays on the floor; §8.7's displacement wording
  is broader than the gate's horizontal-only ankle measurement.
- Evidence: live `update`, 240 Hz for six seconds, first two seconds excluded
  for blending; both feet; actual mesh bottom vertices. Parent body moves at
  the supplied steady speed, and its 2 cm clearance cancels the rig offset.

| Speed m/s | Minimum stance sole height m | Maximum m |
|---:|---:|---:|
| 0 | approximately 0 | approximately 0 |
| 1 | −0.016345 | −0.003466 |
| 3.2 | −0.009508 | 0.041678 |
| 5 | −0.002224 | 0.092170 |
| 6.5 | 0.004730 | 0.145239 |

Horizontal stance drift stays below `5.6e-8 m`, while the boot floats/sinks.
A control translates the actual root upward by 0.25 m: sole heights respond,
horizontal coordinates do not. Thus horizontal-only contact tests cannot
exclude even a large vertical fault. The unchanged animation suite passes
**115/115**, exit 0, alongside this evidence.

- Impact: the pose itself violates flat-ground contact; this is independent
  of K4's mesh/collision mismatch. Exact values are sampled ranges, not global
  bounds or measured gaps on the procedural Moon under live KCC movement.
- Proposed fix: define a world-space stance target and solve the leg/pelvis
  against it; place vertical, horizontal and swing-clearance tests before the
  implementation. Avoid adopting the original “minimum over both legs”
  pelvis prescription without double-support/swing/transition checks.
- Size: one flat-ground contact/gate session; slope/crouch/transition scope
  split if it cannot fit. Not RATIFIED.

## A1-U24-3 — Roll sign: retain S1, qualify the sign-only remedy

- Severity **S1** · Confidence **confirmed** · Category play/test/spec.
- Location: `ProceduralAnimator.ts:39–42, 119–123, 275–278`;
  telemetry convention is **`CharacterTelemetry.ts:48–58`**, not the original
  report's nonexistent line 252; gate row 17c around lines 319–332.
- Claim: the sole follows the ground normal in the character frame.
- Evidence: the real procedural terrain normal is sampled at a fixed point.
  Construct KCC orthonormal frames with ±10° relative side tilt, then call
  **unchanged `sampleTelemetry`**. Its ±10° outputs drive the live animator
  and actual rig under that KCC frame. Both soles are **19.748445°** away from
  the real normal. Flat and ±10° forward-tilt controls are within 0.000002°.

The original report's reference `normalize([-sin(side),1,sin(fwd)])` is not
the plane implied by signed slope angles (use tangent ratios). That explains
part of the difference from its 19.60° / 0.15° results; forward pitch is
essentially exact in this single-axis test.

Negating only the side telemetry at the test boundary (equivalent here to
correcting the roll sign) improves the error to **0.315085°**, not zero.
The bent idle shank conjugates the ankle's local roll. An independent
rotation derivation with `h = acos((0.8−0.02)/0.8)` predicts this residual
to < 0.0001°. A control solving the foot's local quaternion from a desired
world-normal rotation aligns both actual soles within 0.01°.

- Impact: both boots tilt the wrong way on the tested relative cross-slopes.
  This is an orientation finding, not a proof of all four boot corners
  contacting the terrain, nor of contact after normal-field errors are fixed.
- Proposed fix: correct the sign and derive ankle orientation in the parent
  frame from the desired terrain normal, rather than promising a one-sign
  edit solves all slope cases. Replace the tautological sign assertion with
  world-normal comparisons for both sides, combined slopes and bent poses.
  T1's documented `Rz(−slopeSide)` also needs correction in the later fix task.
- Size: one orientation/gate session; full terrain foot placement is separate.
  Not RATIFIED.

## Verification ledger

All commands below ran from `game/` unless noted. Logs:
[`evidence/U27-k8-k9/`](evidence/U27-k8-k9/). Exit status was captured directly,
not from a pipeline.

| Command | Observed result / exit |
|---|---|
| `npm ci` | exit 0; initial dependency installation |
| `node tools/audit/u15-frame-impostor.mjs` | original controls 5/5; exit 0 |
| `node tools/audit/u15b-occlusion-flip.mjs` | original numerical output; no assertion total; exit 0 |
| `node tools/audit/u24-character.mjs` | original controls 5/5; exit 0 |
| new probe, first version | 46/48; exit 1, retained as `independent-first.log` |
| `node tools/audit/u27-k8-k9-recheck.mjs` twice | 48/48 each; exit 0 both |
| same with `--self-test-failure` | 48/49; deliberate failure; exit 1 |
| `node --expose-gc tools/test-play-anim.mjs` | unchanged gate 115/115; exit 0 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; existing >500 kB chunk warning remains |
| repo-root `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | empty; exit 0 |
| repo-root `git diff --exit-code HEAD -- game/tools/audit` before staging | empty for existing tracked probes; exit 0 |
| repo-root `git diff --check` | exit 0 |

First-run failure was **our erroneous >1° lower bound on the sign-only
control's residual**. It was replaced by an independently derived rotation
prediction, not by loosening a production acceptance threshold. Production
was never modified. The final probe also exercises an actual root-height
perturbation rather than merely adding to reported numbers.

### Checked, no issue / not certified

- On-axis silhouettes, direction-normal silhouette control, correct-direction
  overlap controls, flat idle contact and forward slope orientation respond.
- Actual submitted depth flags and disk-interior coverage were checked; this
  is stronger than merely comparing centres, but not a fresh GPU verdict.
- Real root-facing/clearance transforms are included; no duplicated rig FK.
- Does not certify shading, transparency/MSAA, live sky conjunctions, live
  terrain foot contact, combined-slope gait, or animator allocation.
- Original probes also run unrelated checks; those are not a new re-signoff
  of other clusters.

## Provenance and next action

Platform usage confirms this session's `gpt-6-astra`. A bounded history check
also directly associates original **U05b**, commit `739f1e0`, with
`claude-opus-5-5` main-loop usage (completed event `50083455`).
The matched Sonnet usage was social-feed summarization, not the audit loop.
Sanitized attribution evidence is in `provenance-accessible.json`.

This corroborates the Lead's Opus 5.5 statement for **one** original unit;
it does not establish the historical majority. Keep that qualification visible
and do not label the entire cross-model requirement independently verified.

**Next: U27c**, size proposed fix tasks in dependency order and write the Lead
summary; carry/resolve the provenance prerequisite explicitly before any
unqualified cross-model-completion claim. Do not start fixes or redo K8/K9.