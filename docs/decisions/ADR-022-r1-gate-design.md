# ADR-022 — rebuilt m1f R1 depth-compositing gate (F2fcb)

Status: accepted (session 133, 2026-10-27). Task: F2f (U27c §2), unit F2fcb.

## Context
The shipped m1f R1 row claims "z-fighting eliminated" but no clause can fail:
- A1-U02-2 (S1): pairs (a) and (c) are literal gaps and depths, checked against literal planes that are never read from the rig cameras or from any object's layer mask.
- A1-U02-3 (S1): pair (b), Earth vs horizon terrain, is measured in the moon-centred frame, so its gap is always negative and the row prints the 1e9 sentinel.
- A1-U02-4 (S2): the frozen-frame diff compares two identical renders, which shows determinism, not the absence of z-fighting.
The shipped harness rows are never edited (U27c §2). The rebuilt R1 therefore needs a new page on the R2 pattern (ADR-021).

## Options
1. Rebuild R1 inside the full M1F scene (moon, terrain, Earth, probes). This adds the harness's own code, which is under audit, to the trust base, and its depth relations depend on terrain loading.
2. A pinned-fixture page that keeps the shipped pairs as cases, but makes each one a real mesh in front of the rig camera, and renders the verdict through `executePasses`.
3. Analytic only, with planes read from the rig. This catches plane edits, but not a wrong pass assignment or a broken pass sequence.

## Decision
Option 2. Page `?page=m1fR1` (`game/src/test/M1fR1Gate.tsx`), spec `game/e2e/m1f-r1.spec.ts`, self-test `game/tools/test-m1f-r1-gate.mjs`.
- **Fixture.** Three pairs are placed side by side at 1280×720, FOV 62°. Each pair has a front object that must win and a back object behind it:
  - the probe pair, 2.5 km gap at 233 km (Mid);
  - boots/ground, 20 mm gap at 1.7 m (Near);
  - a horizon hill, a 400 m deep box at 2.3–2.7 km that straddles Near and Mid, against an Earth sphere (R 5 km) at 45–55 km (Mid).
- **Pass assignment.** Each object's layers come from production `layerMaskFor(dn, df)`, using its view-depth range.
- **R1a (analytic, from scene state).** Each pair must pass every check below, or the row fails with an explicit reason:
  - the two objects must overlap on screen; otherwise the pair is reported "n/a" and FAILS, so there is no silent sentinel;
  - each object must lie inside the planes of a pass it is assigned to, using the planes read from the rig cameras at run time;
  - in every pass the two objects share, gap / δ(z) must exceed 10, where δ = z²(f−n)/(f·n·2²⁴) for the 24-bit depth renderbuffer;
  - if the two objects share no pass, the front object's last pass must render after the back object's.
- **R1b (rendered).** `executePasses` is run at 5 camera poses: centred, and ±0.25 px in yaw and pitch (the A1-U02-4 sub-pixel jitter).
  - A 60×60 px window around each front object must show the front colour on 100% of its pixels at every pose.
  - Two identical renders must differ by 0 bytes. This is the determinism check, now labelled as such.
  - The counterfactual is rendered with a single camera (n 0.01, f 1e7, all layers, back object drawn last). It must fuse the probe pair (front share < 50%), which proves the probe pair can discriminate a broken layering.
- **Mutants** are URL flags:
  - `?mut=planes` gives the Mid camera the single-camera planes;
  - `?mut=assign` forces the probe pair onto the Near layer only.
  Each mutant must turn both rows red.

## Why
The verdict now depends on the three things R1 claims to protect: the rig's live planes, the production assignment rule, and the rendered pass sequence with its depth clears. A depth relation that fuses, or an object put in the wrong pass, now shows up as wrong pixels. Pinned literals keep the gate deterministic and independent of the harness and of terrain loading. Real-terrain occlusion of the Sun is already covered by R2c (ADR-021).

## Consequences
- Measured: the probe pair's gap/δ is 1,523, boots/ground 11,342, and hill/Earth 705,619. The rendered front share is 100% at all 5 poses, the determinism diff is 0 bytes, and the counterfactual fuses the probe pair (0.00%).
- Both mutants turn R1a and R1b red. The self-test exits 0 on two separate runs.
- Not covered: the shipped `abRender` quiesce guard (A1-U02-6, S3). It lives in the shipped harness, which is not edited, and the new page does not use it.
- The 24-bit depth assumption is pinned. If a render target ever uses `DEPTH_COMPONENT32F`, `DEPTH_BITS` must be updated together with that change.