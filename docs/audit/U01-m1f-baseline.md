# A1-U01 — m1f baseline diagnosis

- Unit: U01 (Phase A, gate health) · Branch `a1-engine-audit` @ cd743e8. The game tree is identical to 256d77d (§6.4 diff is empty).
- Environment: PromptQL VM v2, 4 vCPU / 8 GB, no GPU, system Chrome headless (`channel: 'chrome'`), `npm ci` exit 0.
- Runs: 3 harness runs, the unit's cap.
  - **Run 1** was the gate itself: `npx playwright test e2e/m1f.spec.ts --reporter=line` (preview build, HUD 6 FPS).
  - **Runs 2 and 3** were the read-only probe `node tools/audit/u01-m1f-probe.mjs` (Vite dev build, HUD ≈ 11 FPS).
- Probe method: it attaches a CDP *logpoint* to the unedited harness. A logpoint is a breakpoint condition that logs and returns `false`, so it never pauses and changes no state. The logpoint reads the R2 Sun pose and the Sun readback buffer in place. No harness edit was made.
- Evidence logs: `docs/audit/U01-evidence/`.

## Verdict (the plan's question)

**R2 is red because of a real defect, not the environment.** The plan's three candidate causes, each with its evidence:

| Candidate | Result | Evidence |
|---|---|---|
| (i) Sun culled / below the horizon at the suite pose | **Refuted** | At the R2 Sun pose the Sun is **+32.96° above the geometric horizon**. The impostor is `active: true`, the cull threshold is −3.73°, and `sky.mesh.count` is 8. |
| (ii) blank MSAA readback under SwiftShader | **Refuted** | 921,418 of 921,600 readback pixels are non-black. The R3 readback, through the same `abRender`/8× MSAA target in the same run, has real content (`R3DUMP meshR=90.27 impR=90.27`) and R3 PASSes. |
| (iii) real defect | **Confirmed (cause localised; exact occluder not yet identified)** | The Sun projects to the frame centre (639.96, 358.79). The pixel there is **[90, 80, 66]**, which is not Sun-coloured. The impostor's own shader puts every Sun pixel at R ≥ 230 and G ≥ 216, well inside the test's R > 165 && G > 120. So something renders over the Sun at that pose. |

The result reproduced in **3/3 runs** at two different frame rates (6 and 11 FPS) and on two builds (preview and dev): "disk footprint 0 px … center offset 999.00 px". The wall-clock-dependent walk therefore does not decide the outcome.

**T1-B11 blocker answer: NO, the baseline is not red because of the environment.** See A1-U01-1: R2 went red in a single commit.

## Findings

### A1-U01-1 — R2 regressed in commit 3057899 (F-12 suite-pose change), which shipped without a gate run
- Severity: S1     Confidence: likely (commit and the symptom confirmed; exact occluder not yet named)
- Category: test
- Location: `game/src/test/Milestone1F_TestHarness.tsx:1121-1131` @ cd743e8 (Sun pose); commit 3057899 "F-01..F-12 batch".
- Claim: R2's Sun ground truth renders the Sun disk at the projected centre: coverage 85–115%, centre within 1.5 px.
- Evidence:
  - **Before 3057899.** The last recorded 1F gate state is round-6b/round-7: badges `[P,P,P,P,F]`, R2 PASS (`notes/STATE.md` IN-FLIGHT; `notes/reports/M1F.md`).
  - **What 3057899 changed.** F-12 rewrote the Sun pose. Before, it was absolute `drv` with up (0,1,0). After, it is `drv − O` with radial up `normalize(drv)`.
  - **No gate run on that commit.** Its VERIFIED line is only `TSC_EXIT=0 BUILD_EXIT=0; diag r7 W base smoke`.
  - **After 3057899.** Every recorded run is R2 FAIL: session 46, plus this unit's 3/3 runs.
  - **At the failing pose (probe run 3).** The camera sits at render-local (−5.25, 36.68, −29.34). The Sun is active at +32.97° elevation. The pixel at the projected centre is [90,80,66]. Sun-coloured pixels: 0 in the ±2r window, 0–1 in the full frame.
  - **The other suite rows pass**, which tells us the `drv − O` local convention renders the scene. R1 determinism is 0 B. R3 is centred at (640,360).
  - **What remains.** Only the *content* at the Sun's screen position is wrong: an opaque nearer-pass surface, probably terrain or the astronaut, covers the Sun. Because Near and Mid each clear depth and draw after Far (`MultiCameraRig.executePasses`), any near or mid geometry in that direction wins regardless of distance.
- Impact:
  - The 1F gate cannot go green.
  - T1-B11 has been blocked on this since session 46, and it was misread as possibly environmental.
  - R2's Sun-footprint check has measured nothing since 3057899.
- Proposed fix (fix task, not A1):
  1. Bisect with two gate runs, at 3057899^ and 3057899.
  2. Render the R2 pose with the Near and Mid layers off, then with Far off, to name the occluder.
  3. Then choose one of two fixes:
     - give the Sun ground truth an occlusion-free pose (Far pass only, which is what R2 claims to test: impostor angular scale); or
     - correct the F-12 pose (frame or up mismatch).

  Not a RATIFIED item; it touches only the harness R2 block.
- Fix task size: fits one 50-OLU session (≤3 m1f runs plus one harness edit plus a regression run).

### A1-U01-2 — R2 fails silently: the detail string cannot distinguish "occluded" from "culled" or "blank"
- Severity: S2     Confidence: confirmed
- Category: test
- Location: `Milestone1F_TestHarness.tsx:1137-1158` @ cd743e8
- Claim: the badge detail lets a reader diagnose a FAIL.
- Evidence: the string reports only footprint, coverage and centre offset. On 0 px it prints a sentinel offset of `999.00`. It never reports the Sun's elevation, whether the impostor is active, or the centre pixel colour. Session 46 could not classify the FAIL from it, which is why this unit needed a CDP probe.
- Impact: every future R2 FAIL costs a probe session.
- Proposed fix: append the Sun's elevation, `active`, and the RGB at the projected centre to the detail string. This is detail-only, but it is a harness edit, so it belongs in the same fix task as A1-U01-1.
- Fix task size: fold into A1-U01-1.

## Leads handed to U02 (observed in run 1, not audited here)
- **R1's "Earth vs horizon terrain" term is a sentinel.** It printed `30.0 km gap, ratio 1,000,000,000`, which is the `minRatio === Infinity` fallback at harness ~1053: no chunk qualified, so the term tested nothing this run.
- **R2(a)'s audit loop re-audits one body.** It breaks at the first active body on every `rank`, so "8 live instances" counts `mesh.count` iterations of the same body. This is in addition to the known `alpha = 1` tautology.

## Checked, no issue
- Sun cull rule: `fullyBelowHorizon(el, θ, 0.03)` (impostorMath.ts:122) culls only below −(θ + 1.72°). The Sun was far above that, and the cull is not involved in this FAIL.
- The 8× MSAA `WebGLRenderTarget` readback works under this headless Chrome. It returns a full frame (clear colour ≈ (0.0012, 0.0021, 0.0037)), and R1 determinism is 0 differing bytes.
- `projectDirectionInto` and the pose agree: the Sun projects 1.2 px from the frame centre, as a look-at pose must.
- FPS independence of R2's outcome: identical at 6 and 11 FPS. Wall time does not decide it, so the M1F.md §15.4 wall-clock concern does not apply to this R2 FAIL.
- R4 PASS; R5 FAIL = WAIVED (counts as PASS per the 2026-10-20 ruling); R3 PASS on 1/1 gate run (its flakiness is not re-assessed here; that is U03).

## Commands and exit codes (unpiped)
- `npm ci` → CI_EXIT=0
- `npx playwright test e2e/m1f.spec.ts --reporter=line` → RUN1_EXIT=1. Expected with any FAIL badge: R2 FAIL plus R5 (waived).
- `node tools/audit/u01-m1f-probe.mjs` → PROBE_EXIT=0 (run 2: elevation + whole-frame stats). Its first attempt raised "Could not resolve breakpoint" before the page ran; the tool was fixed and that attempt is not counted as a harness run.
- `node tools/audit/u01-m1f-probe.mjs` (with the centre-pixel and colour stats added) → PROBE2_EXIT=0 (run 3).

## U27 recheck qualification — 2026-10-25, session 96
A1-U01-1 retains S1: unchanged browser repro again captures zero Sun-footprint pixels with active Sun and nonblank readback. Commit 3057899 and F-12 remain candidates, not bisected causes. Nonblank pixels alone do not establish an opaque occluder; the original categorical occlusion explanation is unproven. Its commit record lacks a gate run, but cannot prove no unrecorded run occurred.
Evidence and authoritative recheck disposition: [K2d batch](U27-k2d-recheck.md).

Follow-up visibility controls localize suppression to spinGroup (terrain/core shell/satellites): hiding it restores 1371 pixels / 99.129% coverage, while hiding the astronaut does not. Exact occluding draw remains unidentified; centroid error still 1.993 px > 1.5, so this is not a fixed/passing R2. See the linked batch report.
