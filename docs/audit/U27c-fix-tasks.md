# A1-U27c — Fix tasks in dependency order (proposal for the Lead gate)

- Task: A1 (read-only) · Branch: `a1-engine-audit` · Base `31f4ebe` · 2026-10-26
- Inputs: `FINDINGS.md` §3 (55 S0/S1 in K1–K9, each with U27b recheck evidence), `U26-architecture-fitness.md`, draft ADRs `U26-adr-drafts.md` (D-ADR-1..8) and the U27 recheck ADR drafts (`U27-k4-adr-draft.md`, `U27-k5-k6-adr-draft.md`, `U27-k7-adr-draft.md`, `U27-k8-k9-adr-draft.md`).
- Checker: `python3 game/tools/audit/u27c-coverage-check.py` (repo root) — every S0/S1 ID maps to exactly one target, every task is one session, every dependency is listed earlier. `--self-test` drops one ID and must exit 1.
- Nothing here is built during A1. Fix tasks start only on the Lead's execute order (AGENT_BRIEF §4 LEAD GATE).

## 1. Ordering rules (session decisions under §13)

1. **Gates before engine (D-ADR-1).** Every engine fix is preceded by an independent Node gate for its claim plus a known-bad mutant that turns the gate red (§13 safeguard 3). F1–F2 build no game behaviour.
2. **Allocation is measured with a sampling heap profiler, not heap deltas.** U27b2 refuted forced-GC/post-GC retained heap as an allocation detector; F1b must reject the U09/U25 transient-churn mutants, not only leaks.
3. **Frames before the controllers that live in them.** K3 → K6, K7, T2 (FINDINGS §3 dependencies).
4. **One terrain height service before anything that queries terrain.** K4 → K5, K7 clearance, K9.
5. **Render (K1, K8) after frames**, because the handoff and impostor depth read composed body positions.
6. **RATIFIED items** (KCC slope rule, C¹ cap, impostor hysteresis, catalog constants) change only in the named task, with an ADR in `docs/decisions/` and before/after evidence, in the same commit.
7. **Session size.** Each row is one 50-OLU session. If a row does not fit, it splits `<id>a`/`<id>b` per §12, like the A1 units did. Recheck experience (U27b) is that one claim family + its gate + mutant fits one session; two engine changes do not.
8. **Branches.** On the Lead's acceptance A1 merges into `main` (it already contains the `t1-playable-moon` tip `256d77d` and `origin/main`). Each fix task cuts a branch from `main` and merges back when done, per §4.

## 2. Task list

| ID | Title | Closes | Depends on | Sessions | First commit lands |
|---|---|---|---|---|---|
| F1a | e2e plumbing: assert page/console errors, reject non-PASS badges, placeholders and dropped rows | K2b | — | 1 | the 9-fixture matrix of U27b3a as a regression; resolve or narrowly allow the baseline resource 404 first |
| F1b | allocation gate: V8 sampling-heap per-frame bytes for play frame + harness loops; boot-only counters retired | K2a | F1a | 1 | leak mutant AND ~400 B/frame churn mutant both red; current tree measured (expected red until F5a) |
| F2a | m1b orbit gate: independent raw-element oracle for mean motion, direction, period ratio | K2c (U07) | F1a | 1 | n×1.01, n×2, reversed-orbit mutants red |
| F2b | m1a precision/rebase/timing gate: exact origins, trigger/lattice boundaries, stall attribution | K2c (U08-5/-6), K2d (U08-7) | F1a | 1 | wrong threshold/lattice, early f32, stale locals, ≥250 ms stall mutants red |
| F2c | m1c seam gate: all 12 cube-face edges and 8 corners compared | K2c (U06-1) | F1a | 1 | U27b3b2b2b1 edge/corner fault fixtures red |
| F2d | m1d gate: atmosphere law/Mach/wind checks, interior sweep truth, tick-deadline (fps-independent) dive | K2c (U05-1/-7), K2d (U05-2) | F1a | 1 | density-step, endpoint-only sweep and 15 fps schedule mutants red |
| F2e | m1e KCC gate: inertial Coriolis truth, finite clearance telemetry, yaw-snap bound | K2c (U04) | F1a | 1 | tilt-artefact, sink and 4° snap mutants red |
| F2f | m1f gates R1–R5 rebuilt + bisect the R2 regression (U01-1) | K2c (U02, U03-2/-3), K2d (U03-5, U01-1) | F1a | 1 | needs a Lead directive naming 1F (§8 PARKED); new gates as new files; R5 waiver stays until the Lead lifts it |
| F3a | catalog: one scale law per quantity + spin period, pole, prime meridian, inclination, eccentricity; boot validation | K3 (U12-1) | F2a | 1 | applies ledger rulings 2026-10-22 (small Moon, big Earth, realistic day/year order); D-ADR-2 promoted |
| F3b | core frame tree: analytic body spin quaternion + compose step in `SimulationCore.tick()` | K3 (U26-2) | F3a | 1 | compose gate: actor at fixed body-local point stays fixed under spin; D-ADR-3 promoted |
| F3c | entity record: quat, frameId, kind, core-called `step(dt)`; write-through retired | (S2 U26-3) | F3b | 1 | bit-identical replay of the current play boot; D-ADR-5 promoted |
| F4a | one clock: single accumulator, render interpolation alpha, frame-rate look input, visible slow-down below 12 fps | K7 (U13-2) | F3b | 1 | 144 Hz stale-extract gate (U27b4bbba 0.1083 m) red before, 0 after; D-ADR-4 promoted |
| F5a | `TerrainField` per-body instance + allocation-free height/normal service | K5 (U25-1) | F1b, F2e | 1 | F1b per-frame bytes before/after (§13 safeguard 4); 2nd-body init no longer moves the Moon KCC |
| F5b | terrain normals (analytic or level-matched ε), params-derived height bound, DDA slope bound from measurement | K4 (U14-1, U14-3, U05-8) | F5a, F2d | 1 | converged-site normal error and STEEP bound mutants from U27b4ba |
| F5c | drawn vs collision terrain agree near the actor; lower lunar relief (ledger 2026-10-22) | K4 (U22-1) | F5b | 1 | L4 triangle-vs-analytic gate (U27b4ba median 0.458 m) |
| F5d | mesh pool ≤ worker sets, drop accounting, LOD leaf budget with coarser fallback | K4 (U20-1) | F5a, F2c | 1 | 144-on-96 drop mutant red; stale ownership removed |
| F3d | KCC on body-local state: drop private `spinOmega`, fix spin-phase wrap, planet-frame up | K3 (U16-2, U17-1) | F3c, F4a, F5b | 1 | wrap-tick false-landing gate and wrong-frame up gate red before |
| F6a | KCC slope rule (RATIFIED): one walk/slide angle measured on the true secant; jump direction | K7 (U16-1) | F3d | 1 | needs Lead answers Q1/Q2 (summary §4); w=0 control holds the chosen angle |
| F6b | landing orientation easing and slide slow-down | K7 (U17-3) | F3d | 1 | needs Lead answers Q3/Q4; no single-tick frame step above the chosen bound |
| F3e | flight in the current body's frame, explicit SOI switch, speed cap measured in that frame | K3 (U18-3, U10-5) | F3c, F4a | 1 | parked-ship drift gate (179 m/10 s) red before; cap frame ADR (ledger 2026-10-22) |
| F7a | flight controls: yaw/roll sign; retro thrust not faded by the C¹ cap (RATIFIED) | K6 (U18-1, U18-2) | F3e, F2d | 1 | mirrored-steer and 1,999 m/s braking gates red before |
| F3f | unfreeze the play sky clock: Moon spins and orbits while walkable | K3 (U13-1) | F3d, F3e, F5c | 1 | play replay with `setTimeScale(1)`; walker stays planted |
| F8a | mesh↔impostor handoff + hysteresis (RATIFIED) moved into `render/`; play uses it | K1 (U03-1, U21-3) | F2f, F3b | 1 | inbound probe hole (5,648 m) red before, 0 after |
| F8b | impostors as projected spheres with real-distance depth | K8 (U15-3, U15-4) | F8a | 1 | off-axis cone width and common-ray depth gates from U27b4bbbb |
| F9a | foot contact: stance height and slope roll from the same terrain service | K9 (U24-1, U24-3) | F5c, F3d | 1 | live-rig sole height and ±10° roll gates from U27b4bbbb |
| F10a | play scheduler: ordered system list, 1:1 port of the 11 stages | (S2 U26-4) | F3f | 1 | bit-identical replay check; D-ADR-8 promoted |
| F10b | `World` with N bodies and N actors | (S2 U26-4) | F10a, F5a | 1 | two-body walk + flight replay |

S2/S3 findings not named in the table ride with the task that touches the same file (FINDINGS §4 lists their locations); each fix task re-reads its cluster's S2/S3 rows before its first commit.

## 3. T1 and T2 placement

- **T1 (paused at B11).** Its blocker is the m1f R2 baseline (U01-1). Decision: T1 resumes after F2f, because F2f bisects R2 and gives B11 a trustworthy baseline; B11–B13 are small and then become the play baseline that F3c, F4a and F10a replay bit-identically. Doing T1 after F3 would rebuild the same play code twice.
- **T2 (not started, Lead order needed).** U19-2/-3/-4 are T2 prerequisites already listed in its definition; T2 plans after F3e and F7a so it builds on the body frame and fixed controls. The 2026-10-23 rulings (thin glowing shell; clean < ~5 m/s, hard 5–15 m/s, crash above) bind it.

## 4. Coverage of the 55 S0/S1 findings

| Finding | Cluster | Target |
|---|---|---|
| A1-U08-1 | K2b | F1a |
| A1-U08-2 | K2b | F1a |
| A1-U08-9 | K2b | F1a |
| A1-U03-4 | K2a | F1b |
| A1-U04-5 | K2a | F1b |
| A1-U05-3 | K2a | F1b |
| A1-U06-2 | K2a | F1b |
| A1-U07-3 | K2a | F1b |
| A1-U09-1 | K2a | F1b |
| A1-U07-1 | K2c | F2a |
| A1-U07-2 | K2c | F2a |
| A1-U08-5 | K2c | F2b |
| A1-U08-6 | K2c | F2b |
| A1-U08-7 | K2d | F2b |
| A1-U06-1 | K2c | F2c |
| A1-U05-1 | K2c | F2d |
| A1-U05-7 | K2c | F2d |
| A1-U05-2 | K2d | F2d |
| A1-U04-1 | K2c | F2e |
| A1-U04-3 | K2c | F2e |
| A1-U04-4 | K2c | F2e |
| A1-U02-1 | K2c | F2f |
| A1-U02-2 | K2c | F2f |
| A1-U02-3 | K2c | F2f |
| A1-U03-2 | K2c | F2f |
| A1-U03-3 | K2c | F2f |
| A1-U03-5 | K2d | F2f |
| A1-U01-1 | K2d | F2f |
| A1-U12-1 | K3 | F3a |
| A1-U26-2 | K3 | F3b |
| A1-U13-2 | K7 | F4a |
| A1-U25-1 | K5 | F5a |
| A1-U14-1 | K4 | F5b |
| A1-U14-3 | K4 | F5b |
| A1-U05-8 | K4 | F5b |
| A1-U22-1 | K4 | F5c |
| A1-U20-1 | K4 | F5d |
| A1-U16-2 | K3 | F3d |
| A1-U17-1 | K3 | F3d |
| A1-U16-1 | K7 | F6a |
| A1-U17-3 | K7 | F6b |
| A1-U18-3 | K3 | F3e |
| A1-U10-5 | K3 | F3e |
| A1-U18-1 | K6 | F7a |
| A1-U18-2 | K6 | F7a |
| A1-U13-1 | K3 | F3f |
| A1-U03-1 | K1 | F8a |
| A1-U21-3 | K1 | F8a |
| A1-U15-3 | K8 | F8b |
| A1-U15-4 | K8 | F8b |
| A1-U24-1 | K9 | F9a |
| A1-U24-3 | K9 | F9a |
| A1-U19-2 | K6 | T2 |
| A1-U19-3 | K6 | T2 |
| A1-U19-4 | K6 | T2 |

## 5. Model-provenance qualification (carried, not resolved)

The plan asked that U27b rechecks use a different model than most original audit units. What is verified: every U27b session ran on `gpt-6-astra` (platform usage records), and the original U05b session ran on Claude Opus 5.5 (platform event 50083455). The Lead reports the originals as Opus 5.5, but per-unit attribution of the majority of U01–U26 was not independently established from platform records. Therefore: **all 55 S0/S1 findings have independent recheck evidence (commands, exits, mutants and controls, per finding); the cross-model condition is recorded as QUALIFIED, not claimed complete.** This does not change any finding's severity, because each recheck stood on its own probes, not on the original conclusion. Fix tasks keep the rule that a gate must turn red on a known-bad mutant, which does not depend on which model wrote the gate.

## 6. Decisions taken here (to be promoted as ADRs by the fix tasks)

- **D-ADR-9 (draft) — fix order.** Context: 55 S0/S1 findings with cross-cluster dependencies. Options: (a) severity order (K1 first); (b) dependency order with gates first; (c) per-subsystem order. Decision: (b), table §2. Why: the S0 (K1) cannot be proven fixed until the m1f gates (F2f) and the frame tree (F3b) exist; severity order would ship fixes that no gate can confirm. Consequences: the S0 is fixed in the 23rd fix-task session of the list (F8a); until then the play page is unaffected because Earth is always a mesh there (U21-3).
- **D-ADR-10 (draft) — T1 resumes after F2f** (§3). Why: a trustworthy m1f baseline unblocks B11, and a finished T1 becomes the replay baseline for later refactors.