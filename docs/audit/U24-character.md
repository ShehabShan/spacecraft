# A1-U24 — Character (`play/character/*`) — audit report

- Unit: A1 U24 (Phase E, play layer) · Session 81 · 2026-10-25 · base `5f0257e`
- Files read in full: `AstronautRig.ts` 131, `CharacterAnimator.ts` 41,
  `CharacterTelemetry.ts` 59, `ProceduralAnimator.ts` 323, `animStateMachine.ts`
  162 (716 lines). Read as claims: `tools/test-play-anim.mjs` (rows 15, 17c, setup),
  `docs/T1-plan.md` §5.2 / §8.2 / §8.6, `PlayerController.ts` 125–150,
  `moonWorld.ts` 130–150, `playFrame.ts` 108–117.
- Probe: `game/tools/audit/u24-character.mjs`. It drives the real
  `ProceduralAnimator`, `AnimStateMachine` and `AstronautRig` through an esbuild
  bundle, the same pattern as `test-play-anim`. Forward kinematics is the probe's
  own f64 code, built from the §7.2 joint offsets (hip ±0.11/−0.06, legs 0.40 + 0.40,
  sole −0.06, toe −0.19, heel +0.09). Output: `pre-t4:docs/audit/U24-probe-output.txt`.
  `node tools/audit/u24-character.mjs` → **EXIT=0, controls 5/5** (idle sole on
  y = 0; the horizontal foot-slide result of test 15 reproduced at v = 1; slope pitch
  matches the ground; a landing after the launch window is seen; the rig root faces +X).

## Claims written before the probe
1. Stance foot (§8.3, §8.7): a stance foot stays planted. That means no horizontal
   slide AND a sole that stays on the ground plane (rig y = 0) through stance, at
   every gait speed, including crouch-walk.
2. Slope ankle (§8.6): on a slope of angle α relative to `kcc.up`, the stance sole
   normal equals the ground normal. Pitch follows `slopeFwdDeg`, and roll follows
   `slopeSideDeg` (+ = uphill to the right).
3. State machine (§8.2): every hard landing (`landingSpeed` > 1 m/s) shows Land,
   whatever the current state is.
4. GLB seam (§5.2, K13): any `CharacterAnimator` that honours the interface
   comment ("feet contact = origin, +Y up, −Z facing") drops into
   `characterRoot` and looks correct.

## Findings

### A1-U24-1 — The "planted" stance foot floats up to 14 cm at run/sprint and sinks 1.6 cm at a crawl; no gate checks foot height
- Severity: S1     Confidence: confirmed
- Category: play + test
- Location: `game/src/play/character/ProceduralAnimator.ts:77` (stance `kn = 0`, straight leg) and `:109` (`hipsY` bob) @ 5f0257e; gate `game/tools/test-play-anim.mjs` row 15
- Claim: §8.3/§8.7 say the stance foot is planted. Row 15 asserts "foot slide < 1 cm" at v ∈ {1, 2, 4, 8}.
- Evidence: probe section A measures the lowest point of the stance sole (heel/toe, rig y, ground = 0) over one cycle:

  | v (m/s) | stance sole y range | rise during stance | swing sole min |
  |---|---|---|---|
  | 1.0 | −1.63 … −0.29 cm | 1.35 cm | **−1.81 cm** (scrapes through the ground) |
  | 3.2 walk | −0.95 … +4.17 cm | 5.12 cm | +0.03 cm (no clearance) |
  | 5.0 run | −0.22 … +9.29 cm | 9.51 cm | +2.15 cm |
  | 6.5 sprint | +0.47 … +14.57 cm | 14.10 cm | +4.21 cm |

  The horizontal slide is 0.000 cm in every case, so row 15 passes. But row 15
  measures only the horizontal extent, so it cannot see the foot leaving the
  ground. The cause has two parts. First, the stance leg is straight (`kn = 0`),
  so the sole height is `hipsY − 0.06 − 0.80·cos θ`. Second, the hips follow a
  separate bob, `hipsY − 0.02 + 0.04·k·|sin 2πp|`. Nothing ties the bob to the
  straight-leg geometry, so the pelvis lifts the planted foot.
- Impact: at run and sprint (the most common play speeds), the stance foot visibly
  hovers 9–14 cm above the ground in third person. At a slow walk the feet sink
  into the ground. A Walk/Run gate row that cannot fail on foot height carries the
  "planted" claim.
- Proposed fix: compute `hipsY` per frame from the stance leg (the minimum over
  both legs of the sole height under the straight or legDrop leg), so the stance
  sole is exactly y = 0. Then apply the bob as a stance-knee bend instead of as a
  pelvis offset. Add a gate row: stance sole y ∈ [−0.5, +0.5] cm and swing min
  ≥ 0 at v ∈ {1, 3.2, 5, 6.5} (an FK probe like this one). Not RATIFIED.
- Fix task size: fits one session (pose math + one test row).

### A1-U24-2 — Crouch-walk breaks the no-slide stride: the stance foot slides 5 cm per step
- Severity: S2     Confidence: confirmed
- Category: play + test
- Location: `ProceduralAnimator.ts:65-68` (`gaitBeta`, S = 2·d0·sin A) and `:91` (additive legDrop on the stance leg) @ 5f0257e
- Claim: β = S·f/v plants the stance foot (§8.3). Row 15 only tests `addD = 0`.
- Evidence: probe `gait.crouch_walk` (v = 1.5 = `crouchSpeed`, addD = 0.12 = `crouchDrop`·w_c): the stance slide is **5.05 cm** (it is 0.000 cm at addD = 0). The crouch legDrop bends the knee, which shortens the hip→ankle distance below d0 = 0.80. The stride S, however, is still computed from d0.
- Impact: when crouched and moving, the feet visibly skate. The soft-landing dip (`softDipD`, 3 cm) adds a smaller, transient slide.
- Proposed fix: compute S from the effective leg length `d0 − addD` (or the legDrop solver's hip→ankle distance). Extend row 15 to addD ∈ {0, 0.12}.
- Fix task size: fits one session (can be merged with A1-U24-1).

### A1-U24-3 — Slope-foot roll is inverted: on a 10° cross-slope the sole is tilted 19.6° against the terrain
- Severity: S1     Confidence: confirmed
- Category: play + test
- Location: `ProceduralAnimator.ts:278` (`slopeR = −slopeSideDeg`) with `:39` (`setZX`, Rz(+) tips +Y toward −X) @ 5f0257e; telemetry convention `CharacterTelemetry.ts:252-261`; gate `test-play-anim.mjs` row 17c
- Claim: §8.6 says "the roll follows the terrain". Telemetry defines `slopeSideDeg` as + = uphill to the right (right = fwd×up = characterRoot +Z = rig +X).
- Evidence: probe section B runs 60 real `update`s in Idle (both feet in stance, weight 1) and measures the angle between the sole normal (own FK) and the ground normal. The ground normal is derived from the same telemetry convention, and that convention is validated by the pitch case.
  - Pitch, `slopeFwdDeg = 10`: error **0.15°**, so pitch is correct.
  - Roll, `slopeSideDeg = ±10`: error **19.60°**. The sole normal is (+0.169, 0.986, 0.003), tilted toward +X, i.e. downhill. The ground normal for uphill-right tilts toward −X.

  So the roll has the wrong sign: the foot doubles the mismatch instead of
  removing it. Row 17c asserts `slopeR = −slopeSide` and "same sign both feet".
  Both are restatements of the code, not a comparison with the ground, so they
  cannot fail on this.
- Impact: on any cross-slope, both boots tilt the wrong way, with a gap at the
  boot edge of about 0.16 m · sin(2α) (≈ 5.5 cm at α = 10°, up to the ±20° clamp).
  This is visible in third person whenever the player stands or walks across a
  hillside, which is common on the Moon terrain.
- Proposed fix: `slopeR = +slopeSideDeg·RAD` (one sign). Replace row 17c's sign
  assertion with an FK comparison of the sole normal against the ground normal for
  pitch and roll (this probe's section B). Not RATIFIED. Note that A1-U14-1
  (ε-normal error of degrees) feeds the same input, so the magnitude stays noisy
  until that is fixed.
- Fix task size: fits one session (one sign + one test row).

### A1-U24-4 — A landing within 0.12 s of a launch is lost: JumpLaunch → Walk with no Land, even at 3–4 m/s
- Severity: S2     Confidence: confirmed
- Category: play
- Location: `animStateMachine.ts:129-131` (JumpLaunch returns itself until `tLaunch`, then `onGround(t, Idle)` reads `landed`, which is a one-frame edge that is already false) @ 5f0257e
- Claim: Land is priority 2 from any state (§8.2). A landing edge with speed > `landSoft` must show Land.
- Evidence: probe section C. A Walk → jump → landing at 0.05 s (3 m/s) or 0.10 s (4 m/s) gives `JumpLaunch>Walk`. A landing at 0.20 s (control) gives `JumpLaunch>JumpRise>Land>Walk`. The B8 dwell comment ("edges override the dwell or the edge would be lost") protects edges against the dwell only, not against the timed JumpLaunch.
- Impact: hops that hit a step or a rising slope right after launch play no landing reaction. The controller still runs landing recovery (`recoverT`, `PlayerController.ts:146`), so the animation and the movement disagree for up to 0.40 s.
- Proposed fix: latch `landed` while in JumpLaunch (a "pending land" flag consumed at the JumpLaunch exit), or let a landing edge cut JumpLaunch short. Add a scripted row to `test-play-anim`.
- Fix task size: fits one session (small; can be merged with A1-U24-1–3 as one "character pose correctness" fix task).

### A1-U24-5 — The GLB seam documents a facing that `characterRoot` does not use; the yaw fix and ground clearance are rig-private
- Severity: S3     Confidence: confirmed (code citation)
- Category: play + doc
- Location: `CharacterAnimator.ts:9` ("feet contact = origin, +Y up, −Z facing"); `AstronautRig.ts:85-90` (root Ry(−π/2), y −groundClearance); `moonWorld.ts:137` @ 5f0257e
- Claim: K13 says the seam is honest: a future `GltfAnimator` implements the same members and nothing outside `play/character` needs to know rig internals.
- Evidence: `characterRoot` is +X = fwd (frame quat columns X = fwd, Y = up, Z = right). The procedural rig's `root` carries the conversion (probe `seam.root_quat` = Ry(−90°), rootY −0.02). A GLB animator whose `root` follows the documented contract (identity, −Z facing) would face characterRoot −Z, which is the player's LEFT, and float 2 cm. The conversion and the clearance come from `buildAstronautRig(groundClearance)`, not from the seam.
- Impact: the first GLB swap will face sideways unless its author reads `AstronautRig.ts`. The seam also exposes no attachment points (hand / back sockets), which a later combat or vehicle feature (§13 goal) will need.
- Proposed fix: move the Ry(−π/2) and the clearance offset to a wrapper owned by `moonWorld` (or state them in the interface: "root is placed under characterRoot +X = fwd; implementers apply the yaw fix and −groundClearance"). Consider an optional `socket(name)` member. Not RATIFIED.
- Fix task size: fits one session.

### A1-U24-6 — `jumpedThisFrame` fires on any launch with vertical speed > 0.5 m/s, so the "crest launch → Fall" decision may never be taken
- Severity: S3     Confidence: suspected
- Category: play
- Location: `PlayerController.ts:138-139` (launch detection does not look at whether a jump was requested); `animStateMachine.ts:150-153` (B8 crest-launch rule) @ 5f0257e
- Claim: an un-jumped airborne body past the 0.15 s grace is Fall (B8 decision; `test-play-anim` row 7 scripts `jumped = false`).
- Evidence (code only): `postSimulate` sets `jumpedThisFrame` when `wasGrounded && !grounded && vertSpeed > 0.5`, with no check that a jump was requested. A sprint (6.5 m/s) over a crest whose slope changes by ≥ 4.4° launches at > 0.5 m/s vertical. That reports `jumped`, plays JumpLaunch/JumpRise, and also zeroes the jump buffer.
- What would confirm it: a real KCC + controller run over a crest field at sprint, logging `jumpedThisFrame` without `jumpPressed`.
- Proposed fix: set `jumpedThisFrame` only when `ki.jump` was true on the launching tick.
- Fix task size: fits one session (with the probe).

## Checked, no issue
- `legDrop` two-bone solver: idle sole at y = 0.0000 cm, normal up (probe control). Knee = 2·hip, ankle = hip keeps the sole flat.
- Horizontal stance slide 0.000 cm at v = 1, 3.2, 5, 6.5 with addD = 0 (the claim of test 15 holds for what it measures).
- Slope pitch sign and magnitude (0.15° error at 10°).
- Interrupt: `interrupted` reads the blend left by the previous step, which is the pose on screen. `snap` copies `out` before re-evaluation, as §8.2 says.
- `blendPose`: shortest-path sign flip, near-identity lerp + normalise, hips lerp — correct.
- Rig: 17 joints in JOINTS order, NEAR_BIT on every object, shared geometries/materials disposed, Ry(−π/2) is a proper rotation (rig −Z → +X, rig +X → +Z = right; probe control), not a mirror.
- First person hides the rig with `setVisible` every frame (`playFrame.ts:116`) — fine.
- `landedThisFrame` OR-ed over the frame's ticks: two landings inside one 16 ms frame are physically impossible at Moon g; no issue.
- Animation coyote (0.15 s gait hold) is visual only; the jump buffer (controller) still waits for `grounded`, so no input is lost.
- `sprint` telemetry is unused by the machine (Run is speed-driven) — harmless.
- `update` allocates nothing per frame (boot buffers only; read, not measured — `test-play-anim` measures heap after gc, see A1-U09-1).
- Not probed: `speed = telemetry.relSpeed` vs realised ground velocity (A1-U16-3 seed). The foot-slide math is consistent with whatever `speed` it is given; a commanded-vs-realised mismatch would show as slide on slopes or against walls. Left for U26 / the fix task.