# U27b3b2b2b2b2b — remaining K2d gate recheck
Base: `e86a47b`. Session 96. Read-only audit.

## Expectations recorded before the targeted implementation read
- U03-5: a target above a sphere attracts a tangent walker toward its radial nadir, not toward 2400 m of surface arc. A finite sampled walk cannot prove that two rebases are universally impossible; test both original fixture and a longer surface-path control.
- U05-2: a deadline measured in requested simulation seconds can expire before physics completes if fixed-step backlog is shed. Compare identical physical initial conditions at different frame rates and a tick-count deadline control.
- U01-1: a lit, active Sun and nonblank readback can establish a reproducible wrong image but cannot alone identify its occluder or first bad commit. Preserve likely attribution unless directly demonstrated.

## Audit-method ADR draft — bounded recheck batching
Context: Lead requests fewer sessions for the remaining 55-finding review.
Options: repeat exhaustive independent investigations per finding; or reuse runnable evidence and add targeted discriminating controls.
Decision: one batch for the three remaining K2d findings, with separate dispositions and explicit residual uncertainty.
Why: shares setup cost without treating prior model confidence as proof.
Consequences: no automatic certification of unrelated outputs; no gameplay or engine edits; defer genuinely unresolved causality. This audit-only draft stays under docs/audit per §11.

## Environment and scope
PromptQL VM v2, 4 vCPU / 8 GB, Node via repository dependencies, system Google Chrome. Reviewer model: `gpt-6-astra` from this bot's platform `llm_usage` record. Prior audit-majority provenance remains unverified; this batch does not close that separate condition. Git clone, checkout and `git pull --ff-only` succeeded through the GitHub integration. Bootstrap clean at `e86a47b`; tracker parent `9add690` follows the documented convention, not drift.

## A1-U03-5 — changed: fixture limitation confirmed, universal impossibility withdrawn
**Retain S1; confirmed target-placement problem, not a proof that every permitted real walk is incapable of two rebases.**
- Exact source: `Milestone1F_TestHarness.tsx:269` places SAT_B at spawn + 2400 m tangent + 400 m radial; `:1416–1426` continually steers toward it; `:1355` requires two rebases. `pre-t4:Milestone/Milestone 1F.txt:2566` is the historical three-rebase requirement, not the shipped two-rebase rule.
- Original repro rerun: **22/22, exit 0**. Its ideal-walker Monte Carlo still yields 511 zero / 1489 one / zero two-plus crossings.
- Independent sphere geometry: the tangent component of the target direction vanishes at its nadir (residual ≤1.14e-13 m). At surface heights 0/180/360 m, target radius is 2978.835/3088.864/3205.230 m, and arc measured on the walking sphere is **1278.304/1374.391/1459.296 m**, not 2400 m. The old report's 1155–1278 m used the base radius, not the elevated walking radius.
- Independent deterministic latitude/longitude/heading grid: **1440 cases**, heights 0/180/360 m, 728 s, spin 0.0005 rad/s, 6.5 m/s, 0.5 s samples; all short paths yield zero or one shift. Replacing only the stop distance with a 4000 m surface path yields **two or more in all 1440 cases**. Selected long path produces three shifts at 195.5/379/564 s; actual `SimulationCore` agrees with the separate lattice counter.
- Qualification: an ideal, nadir-stopping spherical walker is NOT a bound on a terrain-dependent steering loop, lattice crossings, overshoot or warmup displacement. Original tool itself says its geometric excursion bound does not forbid two crossings, and its success assertion only requires fewer than 25% two-plus cases. Sampling cannot establish that all 2425 round-7 candidate sites were mathematically doomed. The 1650 m range plateau is consistent with an overhead target, not proof of its unique cause.
- Remedy: an independently checked, continuous surface route (or scripted nonteleporting position path) with known crossings; retain the existing R5 waiver. Do not claim that simply replacing SAT_B guarantees the whole rendered R5 gate passes, or that terrain/KCC are globally cleared. No production change made.

## A1-U05-2 — re-confirmed with a scheduling correction
**Retain S1 confirmed.** The rendered harness advances its requested-time deadline before checking completion (`Milestone1D_TestHarness.tsx:834–836`), then calls `flight.update` (`:857`). The controller caps input at 0.25 s and sheds backlog after six substeps (`flightController.ts:355–370`). T2's actual predicate is extracted from `:685–691`; initializer and observer are extracted unchanged too.

| Frame rate / deadline | Counted seconds at decision | Physics seconds | Result | Altitude AGL |
|---|---:|---:|---|---:|
| 60 fps / requested | 18.0667 | 18.0 | PASS, grounded | 3.000 m |
| 30 fps / requested | 24.1333 | 18.0 | PASS, grounded | 3.000 m |
| 15 fps / requested | 45.0667 | 16.8 | FAIL, airborne | 62.607 m |
| 10 fps / requested | 45.2000 | 11.2 | FAIL, airborne | 419.012 m |
| 15 fps / tick time control | 48.2667 | 18.0 | PASS, grounded | 3.000 m |
| 10 fps / tick time control | 72.4000 | 18.0 | PASS, grounded | 3.000 m |

The successful runs have **identical 1076 precontact altitude/speed samples**, including 264.749394 m/s at 1000 m. Failed traces are exact prefixes of that same trajectory. This separates deadline loss from different flight physics. A negative-clearance mutation rejects on the restored controls. The original replay checks its deadline after updating, giving one extra six-tick frame at 15 fps (16.9 s / 57.293 m); the new probe preserves the real harness order and corrects those numbers. Original repro exits 0 with 10/11 checks: its unrelated T3-2 assertion fails, so exit 0 is not whole-probe certification.
Remedy remains fixed-tick headless acceptance with tick-count deadlines; the rendered demonstration is separate. No claim that arbitrary 40 fps schedules are guaranteed equivalent (floating-point accumulators and frame jitter are not exhaustively tested).

## A1-U01-1 — failure re-confirmed; obstruction localized to spinGroup, first bad commit unbisected
**Retain S1; confirmed R2 failure, likely historical attribution only.**
Original `u01-m1f-probe.mjs` was rerun unchanged on the unedited harness: exit 0 means it captured the logpoint, NOT a passing gate. Badges were `[PASS, FAIL, PASS, PASS, FAIL]` (R5 waiver unchanged).
- R2: **zero Sun-footprint pixels**, coverage 0%, centre error sentinel 999 px, expected radius 21.0 px.
- Sun active at **+32.9566°**, cull threshold −3.7254°; eight sky instances.
- **921600/921600 nonblack pixels**; only one pixel in the entire image passes the Sun colour threshold. Projected centre [0,0,1,255], unlike historical [90,80,66,255].
- Thus the original wrong-image symptom reproduces at ≈11 fps, without a blank readback or horizon cull. A nonblank background alone does NOT prove an opaque object occludes the Sun: a missing/mispositioned Sun draw, shader/material or depth fault can also leave nonblank pixels. No universal hardware/environment exclusion follows from one Chrome/SwiftShader configuration.
- `git diff --exit-code cd743e8 HEAD -- game/src` is empty (exit 0): original evidence applies to unchanged production code. `3057899` changed observer composition, object distance/layers, suite pose, and LIVE timing together; its commit message records typecheck/build + diagnostic smoke but no acceptance run. Absence from the commit record is not proof no unrecorded run occurred. No parent/child bisect was done; **3057899/F-12 remains a candidate, not an established first bad commit or cause**.
- Preserve the T1 baseline blocker; fix task should use a controlled Sun-only render and historical comparison rather than alter physics or blame the environment from the badge alone.

### Targeted Sun visibility controls (second diagnostic run)
`node tools/audit/u27-k2d-sun-controls.mjs` uses an in-memory CDP logpoint to hide object groups, rerender, then restore visibility and the original readback bytes. It writes no production files and is **not an unmodified acceptance run**. One initial attempt was stopped before any result so visibility changes could be applied after production assignment; its partial log is retained.

| Runtime control | Sun-coloured pixels in expected window | Coverage | Centroid error |
|---|---:|---:|---:|
| Repeat baseline | 0 | 0% | 999 px sentinel |
| Hide spinGroup (terrain, core shell, satellites) | 1371 | 99.129% | 1.993 px |
| Hide astronaut only | 0 | 0% | 999 px sentinel |
| Sky-only (hide all listed world objects) | 1371 | 99.129% | 1.993 px |
| Sky-only, impostor mesh hidden too | 153 | 11.063% | 1.928 px |

This **localizes the suppression to content under spinGroup in this run**, not the astronaut. It does not identify which terrain/shell/satellite draw, prove a first bad commit, or vindicate every rendering environment. The remaining glow/background still supplies 153 threshold pixels when impostors are hidden, so the colour mask is not exclusive to the Sun disk. **Hiding the group does not make the full R2 pass:** centroid error remains above 1.5 px. A fix must address/diagnose both coverage and projection, not simply hide geometry or weaken the gate. Independent log validation **6/6, exit0** (`python3 game/tools/audit/u27-k2d-verify-sun.py`, repo root); controlled-browser tool exit0 means captured logpoint.

## Checked, no issue / limits
- Actual core rebase count agrees with the selected independent continuous path; no origin algorithm defect demonstrated by this batch.
- Identical dive physical trajectory at the same ticks; deadline accounting, not divergent flight dynamics, explains these FPS-dependent outcomes.
- Negative-clearance and deliberate-failure controls respond. Independent Node probe: 14/14 twice exit 0; deliberate self-test 14/15 exit 1.
- No source, test, milestone, design-spec, old probe or package-lock changes. No changes to ratified thresholds or the R5 waiver.
- Not checked: every real R5 terrain/KCC walk, arbitrary FPS/jitter, historical first bad render commit, GPU portability, unrelated original-probe findings.

## Reproduction / commands
From `game/`, unless specified. Full stdout/stderr under `docs/audit/U27-k2d-evidence/`.
| Command | Observed exit / result |
|---|---|
| `npm ci` | 0 |
| `node tools/audit/u03-r3r4r5-validity.mjs` | 0; 22/22 |
| `node --expose-gc tools/audit/u05-m1d-validity.mjs` | 0; 10/11 (unrelated T3-2 nonconfirmation preserved) |
| `node tools/audit/u27-k2d-recheck.mjs` ×2 | 0, 0; 14/14 each |
| `node tools/audit/u27-k2d-recheck.mjs --self-test-failure` | 1 deliberately; 14/15 |
| `node tools/audit/u01-m1f-probe.mjs` | 0; captured failed R2 |
| `node tools/audit/u27-k2d-sun-controls.mjs` | 0; controlled diagnostic, not gate PASS |
| root: `python3 game/tools/audit/u27-k2d-verify-sun.py` | 0; 6/6 |
| `npm run typecheck` | 0 |
| `npm run build` | 0; existing bundle-size warnings |
| root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0, empty |
| root: `git diff --exit-code cd743e8 HEAD -- game/src` | 0, empty |

## Handoff
Three findings reviewed in this single batch; **30/55 reviewed, 25 remain (K3–K9)**.
Next: U27b4, split by cluster starting K3's seven reference-frame findings, batching within the Lead's 50-OLU limit. Then U27c fix tasks + plain-language summary → Lead gate. Historical-majority model provenance remains open; do not label the entire cross-model review complete.

Evidence formatting: captured historical commit message/diff have trailing whitespace normalized for repository hygiene. Initial staged `git diff --check` exited 2 on those copied historical spaces; normalized copies passed before commit. Reproduce originals with `git show 3057899`.
