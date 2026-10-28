# U27b4a — K3 reference-frame batch recheck

2026-10-26 · session 97 · base `d8f7b09` · `a1-engine-audit` · read-only.
**Seven findings reviewed; all retain S1, with the corrections below.**
Overall U27b: **37/55 reviewed, 18 pending**. K4–K9 remain unreviewed.
This is a recheck, not a game fix or browser acceptance run.

## Method and scope

The Lead asked for faster batches within the 50-OLU session budget. Reused seven
original repros, inspected their relevant source paths, and added one independent
probe covering the seven members with analytic and metamorphic controls.
Claims were recorded first in `U27-k3-evidence/claims-before-source.md`.

Independent expectations:
`P = C(t) + R(t)p`, `V = C'(t) + omega × R(t)p + R(t)v`;
coordinates compared or blended must share a frame; phases separated by `2π`
describe the same pose. Orbital speed per macro second is not speed per real
second, and a moon's parent-relative speed is not its Sun-frame speed.

Current reviewer model: platform usage reports `gpt-6-astra`
(`U27-k3-evidence/model-meter.json`). The Lead reports that the original checks
were by Opus 5.5. That is Lead-attested provenance, not independently established
per-unit historical attribution; no claim of a completed historical-ledger audit.
No unchanged cluster is signed off merely because its output appeared in a
shared original script.

## Dispositions

| Finding | Outcome | Recheck evidence and correction |
|---|---|---|
| A1-U10-5 | S1 retained; scope corrected | Independent finite differences agree with `30*a*abs(n)` in the parent frame (maximum relative discrepancy < 2e-8). Earth 12,821.856 m/s; Moon 2,383.583 m/s relative to Earth. Phobos 1,973.064 and Charon 535.070 are **below** 2,000 in their parent frames. At epoch 0, all 16 orbiting bodies have Sun-frame derivatives above 2,000 (including parent motion); this is an epoch sample, not an all-time theorem. |
| A1-U12-1 | Re-confirmed S1; terminology narrowed | All 17 real rail states have position/orbit-basis data but no body orientation; config/types/evaluator supply no body spin rail, pole or prime meridian. Orbit translation control moves Earth 4,273.943 m in ten macro seconds. Existing KCC-private spin and play `spinGroup` rotation **do exist**; “no body rotates” must mean the missing shared celestial rotation model, not absence of every rotation operation. |
| A1-U13-1 | Re-confirmed S1; play consequence corrected | A static core marker placed at Moon+offset stays at its original absolute position: after 60 ticks at scale 30, it is 11,144.248 m from the translated target; scale-zero control error 0. Core entity API has no parent. But play already has an **ad-hoc Moon-centred observer translation**: `moonAbs + O + cameraLocal`. It does not simply leave every sky observation at the Sun origin. Its Earth vector is cached at boot; after one real second at scale 30 that vector is stale by 2,383.209 m. |
| A1-U16-2 | Re-confirmed S1 | Original 1,971/3,000 wrapping false landings vs 0/3,000 at phase 1 reproduced. New paired test uses the **same** positions/velocities at equivalent phases `−ωdt/2` and `2π−ωdt/2`: 84/128 pairs disagree on landing. Non-wrapping counterpart/independent 65-point true-phase path samples remain ≥4.9969 m above terrain. Maximum resulting position difference 4.9776 m. Actual phase increment is −6.283011974, instead of +0.000173333 rad. |
| A1-U17-1 | Re-confirmed S1; isolating control added | Original jump maximum 43.94° and zero-G ten-second 92.8° mismatch reproduced. New zero-G fixture holds spin rate at zero but starts at phase ±π/2: a single tick wrongly tilts body-frame up by 0.47895°. It matches the world-radial blend algebra to <1e-12. Phase-zero and spin-axis controls remain aligned. Thus the defect is the coordinate comparison, not merely elapsed spin or terrain noise. |
| A1-U18-3 | Re-confirmed S1; measurement strengthened | Original 178.557 m motion across the **static collision field** reproduced. Independent body-fixed comparison at actual grounded ticks finds up to 226.795 m difference between `h(worldDirection)` and `h(R(−ωt)worldDirection)` (396 contact ticks). Final body-relative angular displacement corresponds to 341.443 m, not 178.557 m. Zero-spin control: 0 mismatch and 0 travel. Spherical-height control: 0 height mismatch, **not** proof of correct parking. |
| A1-U26-2 | Re-confirmed S1 as synthesis | Missing shared body orientation/actor parenting plus U16/U17/U18 witnesses establish the architectural gap. This is not a seventh independent root cause. One frame-tree design does not automatically repair sweeps, coordinate conversions, contact integration, time scaling and consumers. |

### Corrections that matter for later fixes

**U10 — speed and interception.** `orbitalSpeed` in the rail is unscaled and
parent-relative; it is not the real-time heliocentric velocity. The historical
argument that a slower ship can “never catch” a faster orbiting body is too
strong: interception at a future position can occur. The demonstrated issue is
consistent rendezvous/co-motion under a putative global cap and missing frame
semantics. Flight's actual `pos` is planet-centred, whereas core entities are
documented Sun-frame: treating the existing controller as a demonstrated
heliocentric end-to-end implementation would also overstate the evidence.
The Lead already ruled on 2026-10-22 that the sky should move slowly enough for
the ship to keep up; 2026-10-23 makes 2,000 m/s a deep-space regime. Do not re-ask.

**U12 — orientation vs orbit basis.** `basisP/Q` are fixed orbital-plane axes,
not a body rotation. KCC's phase is local integration, not a shared rail linked
to macro time. The original `0.2445` m1f spin/orbital-rate ratio compares with
unscaled `n`; the harness freezes macro orbits, so this is not an observed
physical tidal-lock ratio in that running fixture.

**U13 — actual play composition.** The local terrain/KCC are centred at zero;
`skyState` shifts the observer by the live Moon rail position for other bodies.
Earth's hero mesh instead uses the boot-cached Earth-minus-Moon vector.
Therefore unfreezing alone produces inconsistent consumers; the report's
simplified “Moon moves away from astronaut at origin” description is not an
accurate account of all existing play sky code. No live browser unfreeze was
run; the cached-vector displacement is calculated from actual rails and exact
source citations, not a claimed screenshot.

**U16 — bounded demonstration.** The 66% figure is a fixture sample rate, not
a probability for all gameplay. The new metamorphic check does not change
source or install a patch: equivalent initial phases isolate the wrap
discontinuity. Sampled path clearance is not a continuous global no-tunnelling
proof. In addition, the bisection's mutable spatial bracket and phase endpoints
deserve a regression in the fix task; do not assume changing only `dTheta`
certifies all sub-tick interpolation.

**U17 — latent is not absent.** Zero rate with phase zero hides the issue;
zero rate with a nonzero phase does not. Current play uses phase/rate zero,
so this recheck does not claim a present rotating-Moon gameplay failure.

**U18 — what the distance proves.** World travel alone is expected on a
spinning body, and does not prove skating. The new height comparison tests the
actual discrepancy against body-fixed terrain. Central radial gravity is
rotation-invariant; calling its inertial evaluation a defect solely because the
body spins is incorrect. Either inertial integration with consistent moving
surface queries, or a correctly transformed rotating-frame integrator, can be
valid. The flat-height control also travels incorrectly relative to an ideal
body-fixed point; its pass certifies **only** height rotation invariance, not
contact integration. No claim that every ship is permanently LANDED: the rough
fixture is grounded for 396/600 ticks.

## Source anchors at `d8f7b09`

- `game/src/core/orbit/types.ts:31–105`, `KeplerRail.ts:139–253`:
  state construction, fixed orbit basis and positional evaluation.
- `game/src/core/orbit/celestialData.ts:195–258`: host gravitational parameter
  and config construction. Sun-centred planets encode `parentId: null`, not
  `"sun"`; the independent probe handles that explicitly.
- `game/src/core/types.ts:39–72`,
  `game/src/core/simulation/SimulationCore.ts:63–67,400–461`:
  entity fields/API, rail evaluation, absolute integration and local extraction.
- `game/src/play/world/moonWorld.ts:65–91,125–144`:
  frozen macro clock, KCC write-through, cached Earth vector and live Moon position.
- `game/src/play/world/skyState.ts:69–100,101–102`:
  Moon-centred observer conversion versus cached Earth-mesh placement.
- `game/src/play/world/moonConfig.ts:23–33`,
  `game/src/play/frame/playFrame.ts:101–105`: zero play spin and KCC spin-group use.
- `game/src/core/physics/astronautKCC.ts:218–225,325–342,451–453,851–882,933–960`:
  frame declarations, teleport conversion, phase wrap, airborne blend and sweep.
- `game/src/core/physics/flightController.ts:393–403,446–457,487–501,525–535,690–745`:
  atmosphere-relative velocity versus raw-position cap, radial gravity,
  static terrain queries and LANDED velocity assignment.
- `pre-t4:Design_specs/00_VISION_AND_RULES.txt:14–15,22–23,41`;
  `pre-t4:Design_specs/01_ARCHITECTURE.txt:9–13,38–40`: macro/micro clocks, hard-cap
  wording, parented compose and transport. Specs were searched by relevant terms.
- `AGENT_BRIEF.md` §13 supplies the project goal; `notes/STATE.md` APPROVAL
  LEDGER contains the settled 2026-10-22/23 visual and speed-regime rulings.

Source hashes are in `U27-k3-evidence/source-sha256.json`. Protected source is
unchanged against audit base `256d77d`; original probes unchanged against
`d8f7b09`.

## Verification and reproducibility

All commands below run from `game/` except the two git comparisons. Exits were
captured directly from subprocesses, not from pipelines. Original scripts
mostly treat exit 0 as “ran”; their controls were inspected separately.

| Command | Observed result |
|---|---|
| `npm ci` | exit 0 |
| `node --expose-gc tools/audit/u10b-cross-spec.mjs` | exit 0; numerical table, no assertion summary |
| `node --expose-gc tools/audit/u12-orbits-catalog.mjs` | exit 0, controls 3/3 |
| `node --expose-gc tools/audit/u13-simulation-core.mjs` | exit 0, controls 4/4; U13-1 itself requires source/new marker check |
| `node --expose-gc tools/audit/u16b-kcc-wrap-nan-blocked.mjs` | exit 0, controls 2/2; 1,971/3,000 vs 0/3,000 |
| `node --expose-gc tools/audit/u17-kcc-part2.mjs` | exit 0, controls 5/5 |
| `node --expose-gc tools/audit/u18-flight-controller.mjs` | exit 0, controls 5/5 |
| `node --expose-gc tools/audit/u26-architecture-fitness.mjs` | exit 0, controls 2/2; synthesis verified through members/source, not incidental performance output |
| `node tools/audit/u27-k3-recheck.mjs` | final **29/29**, exit 0, twice |
| `node tools/audit/u27-k3-recheck.mjs --self-test-fail` | **29/30**, deliberate exit 1 |
| `npm run typecheck` | exit 0 |
| `npm run build` | exit 0; existing large-chunk warnings, no build failure |
| `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | empty, exit 0 |
| `git diff --exit-code d8f7b09 --` seven original probe paths | empty, exit 0 |

Raw logs and manifests: `U27-k3-evidence/` (typecheck log trailing blank lines trimmed after the staged whitespace check flagged them; no diagnostic content removed). Initial new-probe run exited 1:
it incorrectly indexed the Sun parent through `null`. Corrected to zero parent
velocity, matching the actual catalog; the failure log is retained.
Second run 28/28 exit 0; added the independent sampled-path check, yielding
final 29/29 twice. The deliberate failure only verifies assertion-to-process-exit
plumbing; physical oracle controls are the phase/axis/rate/spherical fixtures.

### Checked, no issue within this scope
- Actual rail motion responds to time and agrees with independent circular-orbit
  finite differences; no claim of a new orbit-position bug.
- Phase rotation/inverse and ±2π pose identities agree numerically.
- Static core entities remain stationary as their current API promises; the
  defect is missing body-parent capability, not failure of that API contract.
- Zero-phase/zero-spin and spin-axis KCC controls do not show the tested up error.
- Zero-spin parked ship does not move; spherical terrain height is invariant
  under rotation. Neither control certifies general contact behavior.
- No protected source, existing probe, dependency manifest or asset was changed.
  No browser, GPU, performance optimisation or unrelated-cluster verdict.

## Audit-method ADR-K3 — targeted batch with independent frame controls

**Context:** seven K3 findings share one coordinate/time boundary. Repeating full
audits consumes the budget; accepting prior model output untested risks carrying
over overly broad explanations.

**Options:** one session per finding; accept originals without checking; or batch
original repro reruns with a compact independent boundary/coordinate probe.

**Decision:** use the third option for this recheck, retaining per-member
dispositions and controls. Record the Lead's faster-batching instruction in the
active plan and approval ledger for all remaining rechecks.

**Why:** frame identities, equivalent-phase pairs and actual contact samples
test the common cause cheaply while detecting the specific narrative errors
above. Model identity is provenance, not physical evidence.

**Consequences:** the batch does not approve implementation. D-ADR-2/3 remain
proposals for later fix tasks; consumers and gates need separate implementation
steps. Draft stays in `docs/audit/`, because `docs/decisions/` is outside A1's
write boundary.

## Handoff and reconciliation

Bootstrap was clean at `d8f7b09 = origin/a1-engine-audit`; tracker's `e86a47b`
followed the documented parent-commit convention, not lost work.
Repair: current consolidation/plan called U10 look-and-feel questions unanswered,
but the 2026-10-22 approval ledger already settles them. Updated current guidance
to apply those rulings instead of re-asking; historical logs remain intact.

Next **U27b4b**: K4 first (U22-1, U14-1/-3, U05-8, U20-1), then K5–K9;
batch related findings within 50 OLU and reserve wrap-up time. U27c then sizes
fix tasks and presents the remaining genuine look-and-feel questions at the
Lead gate. T1 remains paused; no fix work started.