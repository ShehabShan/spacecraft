# EVIDENCE INDEX — raw proof removed from the tree in T4 S2

The raw per-step proof (logs, Playwright JSON, screenshots, A1 probe output) was removed
from the tree in T4 S2 under the [ADR-030](../decisions/ADR-030-repo-layout-history-pointer.md)
evidence policy: 1,198 files, 6,868,445 bytes (1,196 deleted, 2 moved). Each row below names one evidence
directory (or loose file group), the commit that added it, a key line taken from its own
summary file, and its `pre-t4:` pointer. Read a file with `git show pre-t4:<path>`; list a
directory with `git ls-tree -r --name-only pre-t4 -- <dir>`.

Two files were moved, not deleted (a kept tool needs them):
- `pre-t4:docs/audit/evidence/T3/S2/basins-gen.mjs` → `game/tools/gen-moon-basins.mjs` (generates `MOON_PARAMS.moon` basins, ADR-028).
- `pre-t4:docs/audit/U01-evidence/gate-run1.log` → `game/tools/audit/u01-gate-run1.log` (read by the ADR-023 probes `u03-r3r4r5-validity.mjs` and `u27b3b2a-r3-recheck.mjs`).

Key lines are copied verbatim from the evidence (README, summary, exits); "—" means the
directory had no summary file, and the commit message is then the record.

| step | added by (commit · subject) | key line | files · size | pointer |
|---|---|---|---|---|
| F1a/current-run1 | a3533fd F1a: strict e2e acceptance contract for the six milestone specs | — | 5 · 332 KB | `pre-t4:docs/audit/evidence/F1a/current-run1/` |
| F1a/current-run2 | a3533fd F1a: strict e2e acceptance contract for the six milestone specs | — | 5 · 332 KB | `pre-t4:docs/audit/evidence/F1a/current-run2/` |
| F1a/pre-f1a-specs | a3533fd F1a: strict e2e acceptance contract for the six milestone specs | — | 5 · 185 KB | `pre-t4:docs/audit/evidence/F1a/pre-f1a-specs/` |
| F1a/real-harness | a3533fd F1a: strict e2e acceptance contract for the six milestone specs | m1c EXIT=0 | 6 · 10 KB | `pre-t4:docs/audit/evidence/F1a/real-harness/` |
| F1b | f06ca2e F1ba: allocation gate for the real play frame (sampled bytes + retained clause) | — | 6 · 7 KB | `pre-t4:docs/audit/evidence/F1b/` |
| F1b/e2e-plumbing | f06ca2e F1ba: allocation gate for the real play frame (sampled bytes + retained clause) | — | 5 · 332 KB | `pre-t4:docs/audit/evidence/F1b/e2e-plumbing/` |
| F1b/gate-tree | f06ca2e F1ba: allocation gate for the real play frame (sampled bytes + retained clause) | — | 1 · 1 KB | `pre-t4:docs/audit/evidence/F1b/gate-tree/` |
| F1b/idle-retained | e9dcf06 F1bca: settle the idle-retained item — retained clause counts the JS-object heap | — | 11 · 13 KB | `pre-t4:docs/audit/evidence/F1b/idle-retained/` |
| F1b/loops | c116784 F1bb: allocation gate for the headless harness loops (m1b/m1d/m1e) | — | 6 · 14 KB | `pre-t4:docs/audit/evidence/F1b/loops/` |
| F1b/retire | ae9acf7 F1bcb: retire blind heap-delta and boot-counter clauses; F1b done | build EXIT=0 | 15 · 345 KB | `pre-t4:docs/audit/evidence/F1b/retire/` |
| F1b/selftest-1 | f06ca2e F1ba: allocation gate for the real play frame (sampled bytes + retained clause) | — | 1 · 4 KB | `pre-t4:docs/audit/evidence/F1b/selftest-1/` |
| F1b/selftest-2 | f06ca2e F1ba: allocation gate for the real play frame (sampled bytes + retained clause) | — | 1 · 4 KB | `pre-t4:docs/audit/evidence/F1b/selftest-2/` |
| F2a | e56aa9c F2a: independent raw-element orbit gate for the m1b rail | exits: alloc-loops-selftest=0, build=0, deliberate=1, e2e-plumbing=0, gate-1=0, gate-2=0, playwright-m1b=0, self-test-1=0, self-test-2=0, typecheck | 20 · 9 KB | `pre-t4:docs/audit/evidence/F2a/` |
| F2a/e2e-plumbing | e56aa9c F2a: independent raw-element orbit gate for the m1b rail | — | 5 · 332 KB | `pre-t4:docs/audit/evidence/F2a/e2e-plumbing/` |
| F2b | bcdc980 F2b: independent m1a precision/rebase/timing gate | gate-1.log, gate-2.log / `node tools/test-precision-gate.mjs` / 0, 0 (7/7) | 14 · 13 KB | `pre-t4:docs/audit/evidence/F2b/` |
| F2c | 61fae86 F2c: independent m1c cross-face seam gate (12 edges + 8 corners) | `gate-1.log`, `gate-2.log` / `node tools/test-seam-gate.mjs`: 14/14, exit 0 on both runs | 22 · 369 KB | `pre-t4:docs/audit/evidence/F2c/` |
| F2d | b8cfe20 F2d: independent m1d flight gate + tick-time dive deadline | `gate-1.log`, `gate-2.log`, `gate-3.log` / `node tools/test-flight-gate.mjs`: 12/12 exit 0. Run 3 was after the harness fix. | 26 · 372 KB | `pre-t4:docs/audit/evidence/F2d/` |
| F2e | 8e82819 F2e: independent m1e KCC gate (Coriolis truth, finite clearance, yaw residual) | `gate-1.log`, `gate-2.log` / `node tools/test-kcc-gate.mjs`: 13/13, exit 0 | 23 · 49 KB | `pre-t4:docs/audit/evidence/F2e/` |
| F2f/a | d06d026 F2fa (session 127): bisect the m1f R2 regression, first bad commit is 3057899 (confirmed) | m1f gate @c0ae8bf run1 EXIT=1 | 8 · 19 KB | `pre-t4:docs/audit/evidence/F2f/a/` |
| F2f/b | 2ed360e F2fba (session 128): R2 regression is the F-12 Sun-pose position change inside 3057899 | observe F12sun run2 EXIT=0 | 8 · 28 KB | `pre-t4:docs/audit/evidence/F2f/b/` |
| F2f/bb | ae795f8 F2fbba (session 129): m1f R2 0-px Sun is near-pass terrain overdraw; render-local pose is correct (ADR-019) | F12diag run1 observer EXIT=0 (verdict FAILED, badges P F P P F) | 4 · 16 KB | `pre-t4:docs/audit/evidence/F2f/bb/` |
| F2f/bbb | 3a2d629 F2fbbb (session 130): m1f R2(b) Sun occlusion is real terrain, not a frame bug (ADR-020) | f2fb-make-variant.py /workspace/wt-ray F12ray  -> MK_EXIT=0 | 4 · 17 KB | `pre-t4:docs/audit/evidence/F2f/bbb/` |
| F2f/ca | dd26b0b F2fcaa (session 131): design the rebuilt m1f R2 gate; split per §12 (ADR-021) | — | 1 · 0 KB | `pre-t4:docs/audit/evidence/F2f/ca/` |
| F2f/cab | 8339a6e F2fcaba: rebuilt m1f R2 gate rows R2a + R2b (?page=m1fR2) | `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r2-gate.mjs` from `game/`, exit 0 both times (unpiped). The unmutated page PA | 5 · 6 KB | `pre-t4:docs/audit/evidence/F2f/cab/` |
| F2f/cabb | 0ae81e6 F2fcabb (session 132): rebuilt m1f R2 gate row R2c + horizon/noray mutants | `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r2-gate.mjs` from `game/`, exit 0 both times (unpiped), identical rows. Unmut | 5 · 10 KB | `pre-t4:docs/audit/evidence/F2f/cabb/` |
| F2f/cb | 980dd07 F2fcb (session 133): rebuilt m1f R1 depth-compositing gate (?page=m1fR1, ADR-022) | `selftest-run1.log`, `selftest-run2.log`: `node tools/test-m1f-r1-gate.mjs`. The result was `SELFTEST_EXIT=0` both times. | 4 · 12 KB | `pre-t4:docs/audit/evidence/F2f/cb/` |
| F2f/cca | 305761e F2fcca (session 134): design the rebuilt m1f R3 handoff gate; split per §12 (ADR-023) | — | 3 · 4 KB | `pre-t4:docs/audit/evidence/F2f/cca/` |
| F2f/ccb | 1c02c1b F2fccba (session 135): rebuilt m1f R3 gate row R3a + verbatim controller extraction (ADR-023) | `m1f-r3-spec.run1.txt`, `.run2.txt` — `npx playwright test e2e/m1f-r3.spec.ts`, EXIT=0 both. Pinned badges `["FAIL"]`. | 6 · 6 KB | `pre-t4:docs/audit/evidence/F2f/ccb/` |
| F2f/ccbb | 3c33381 F2fccbba (session 136): rebuilt m1f R3 gate row R3b + mutants meshhide/noimp (ADR-023) | `tsc.txt`: `npx tsc --noEmit -p .`, TSC_EXIT=0. | 6 · 13 KB | `pre-t4:docs/audit/evidence/F2f/ccbb/` |
| F2f/ccbbb | 209fb3c F2fccbbb (session 137): rebuilt m1f R3 gate row R3c + mutants shift/scale/bright (ADR-023) | `tsc.txt`: `npx tsc --noEmit -p .`, TSC_EXIT=0. | 7 · 38 KB | `pre-t4:docs/audit/evidence/F2f/ccbbb/` |
| F2f/cda | 0de2ffc F2fcda (session 138): rebuilt m1f R4 gate row R4a boot identity (ADR-024) | Unmutated: R4a PASS. It compared 75 references with `===` and found 0 changed. GPU counts held | 5 · 4 KB | `pre-t4:docs/audit/evidence/F2f/cda/` |
| F2f/cdb | 0d9735c F2fcdb (session 139): rebuilt m1f R4 gate rows R4b allocation + R4c retention (ADR-024) | `selftest-run1.log`, `selftest-run2.log` / `node tools/test-m1f-r4-gate.mjs`: 6 cases each, all AS EXPECTED, exit 0 both times. | 9 · 23 KB | `pre-t4:docs/audit/evidence/F2f/cdb/` |
| F2f/cea | 66e0178 F2fcea (session 140): rebuilt m1f R5 gate row R5a — rebase lattice on a continuous route (ADR-025) | — | 10 · 15 KB | `pre-t4:docs/audit/evidence/F2f/cea/` |
| F2f/ceb | f0f85e7 F2fceb (session 141): rebuilt m1f R5 gate row R5b — straddler A/B + Sun on every frame (ADR-025) | Mutants (each turns only R5b red; R5a stays PASS): | 7 · 46 KB | `pre-t4:docs/audit/evidence/F2f/ceb/` |
| F2f/close | 0c4b2d3 F2f close-out (session 142): retire shipped m1f rows R1–R5; F2f DONE (ADR-026) | `plumbing-run1.txt` + `plumbing-run1/`: `node tools/test-e2e-plumbing.mjs --out …` → 80/80 expected dispositions (8 clean PASS, 72 defects r | 21 · 1051 KB | `pre-t4:docs/audit/evidence/F2f/close/` |
| F3a | c8b5c47 F3aa: sourced real body data (spin, pole, orbital elements) + independent gate | test-real-body-data: GATE_EXIT=0 (63/63), GATE2_EXIT=0, SELF_EXIT=0 (10/10 mutants red) | 3 · 2 KB | `pre-t4:docs/audit/evidence/F3a/` |
| F3a/aba | 2a528ba F3aba: KeplerRail boot validation of orbit elements + independent gate | rail-validation run1 EXIT=0 | 36 · 52 KB | `pre-t4:docs/audit/evidence/F3a/aba/` |
| F3a/abba | d74c7e1 F3abba: per-body spin, pole and prime meridian + spin/time law + independent gate | spin-law run1 EXIT=0 | 41 · 56 KB | `pre-t4:docs/audit/evidence/F3a/abba/` |
| F3a/abbba | 35a6485 F3abbba: allocation-gate calibration control on instrument-private keys (alloc-loops blocker fixed) | spin-law run1 EXIT=0 | 40 · 57 KB | `pre-t4:docs/audit/evidence/F3a/abbba/` |
| F3a/abbbba | de02c4f F3abbbba: catalog scale laws chosen (one radius, one distance, one time law; ADR-015) | laws run1 EXIT=0 | 4 · 8 KB | `pre-t4:docs/audit/evidence/F3a/abbbba/` |
| F3a/abbbbba | b6bb22e F3abbbbba: ADR-015 scale-law module + independent gate (catalog not wired yet) | scale-law run1 EXIT=0 | 14 · 16 KB | `pre-t4:docs/audit/evidence/F3a/abbbbba/` |
| F3a/abbbbbb | e728d37 catalog: F3abbbbbb wire ADR-015 scale laws into celestialData at 1x | spin-law run1 EXIT=0 | 42 · 59 KB | `pre-t4:docs/audit/evidence/F3a/abbbbbb/` |
| F3a/abbbbbc | 764f839 F3abbbbbc: real orbit elements (e, i, Omega, omega, M0) in the catalog + elliptic/inclined oracle (ADR-016) | spin-law run1 EXIT=0 | 48 · 69 KB | `pre-t4:docs/audit/evidence/F3a/abbbbbc/` |
| F3a/abbbbbc-verify | 650dbcf F3a-verify: independent re-run of the f3abbbbbc regress on 764f839 and main 8e82819 | spin-law run1 EXIT=0 | 214 · 253 KB | `pre-t4:docs/audit/evidence/F3a/abbbbbc-verify/` |
| F3a/fu2 | f3b9d02 F3a-fu2: spawn and respawn camera frame the Earth near the view centre (ADR-017) | spin-law run1 EXIT=0 | 42 · 60 KB | `pre-t4:docs/audit/evidence/F3a/fu2/` |
| T1/B11 | 9c4ee90 T1 B11 baseline (session 143): Lead resumed T1; baseline green, edit not started | — | 13 · 30 KB | `pre-t4:docs/audit/evidence/T1/B11/` |
| T1/B12 | c6c47b2 T1 B12 (session 145): Playwright smoke e2e/play.spec.ts + ?autoplay=1 test mode | MUT noauto PW_EXIT=1 | 12 · 14 KB | `pre-t4:docs/audit/evidence/T1/B12/` |
| T1/B13 | aa1a7d2 T1 B13 (session 146): close-out — full §13 verification matrix green; T1 DONE pending Lead acceptance | — | 36 · 32 KB | `pre-t4:docs/audit/evidence/T1/B13/` |
| T3/P0 | 685b743 T3 P0 quality (session 147): feasibility probe, S1 candidate, default-path pins | — | 3 · 11 KB | `pre-t4:docs/audit/evidence/T3/P0/` |
| T3/S2 | b6d3a0e T3 S2 (session 148): wire the Moon profile into play, spawn on mare (ADR-028 am. 1) | — | 4 · 15 KB | `pre-t4:docs/audit/evidence/T3/S2/` |
| T3/S3 | 25c419d T3 S3: shader-injected mare albedo, test-moon-material gate, frame-time A/B (rim 1.052, open for the Lead) | tsc exit 0 | 24 · 779 KB | `pre-t4:docs/audit/evidence/T3/S3/` |
| T3/S4 | 18472e9 T3 S4 matrix (session 150b): full §13 matrix green; awaiting the Lead's play acceptance | tsc exit 0 | 21 · 18 KB | `pre-t4:docs/audit/evidence/T3/S4/` |
| U27-k5 | 7c4983e A1-K5K6: recheck allocations and five flight findings with scoped controls | CHECKS 23/24; FAILURES 1 | 15 · 54 KB | `pre-t4:docs/audit/evidence/U27-k5/` |
| U27-k7 | 90e6f1a A1-K7: recheck slope, landing and tick coordination with real play consumers | — | 20 · 27 KB | `pre-t4:docs/audit/evidence/U27-k7/` |
| U27-k8-k9 | 31f4ebe A1-K8K9: recheck sky geometry and foot contact with real transforms | — | 18 · 42 KB | `pre-t4:docs/audit/evidence/U27-k8-k9/` |
| U27b3b2b2b2b2a | e86a47b A1-U27b3b2b2b2b2a: recheck timing gate stall and attribution blind spots | original EXIT=0 | 12 · 73 KB | `pre-t4:docs/audit/evidence/U27b3b2b2b2b2a/` |
| U01-evidence | 29905e1 A1-U01: m1f baseline diagnosis — R2 red is a real regression (3057899), not env | — | 3 · 5 KB | `pre-t4:docs/audit/U01-evidence/` |
| U20-probe-output.txt | 39a8ad2 A1-U20: mesh pool drops requests when meshes > worker sets; LOD keeps dead pendingRecs; worker 0 does ~all generation | — | 1 · 4 KB | `pre-t4:docs/audit/U20-probe-output.txt` |
| U21-probe-output.txt | fe2b6f4 A1-U21: handoff lives only in the 1F harness; Near pass paints over Mid-only objects at 2.4-3 km; meshes past 300 km undrawn; impostor fade shrinks an opaque disk | — | 1 · 3 KB | `pre-t4:docs/audit/U21-probe-output.txt` |
| U22-probe-output.txt | 1443228 A1-U22: drawn terrain is not the collision terrain (metre-scale at L4); LOD selects 125 leaves for 96 meshes; brad 2x; spawn early exit unreachable | — | 1 · 1 KB | `pre-t4:docs/audit/U22-probe-output.txt` |
| U23-probe-output.txt | 5f0257e A1-U23: <12 fps slow motion; FP yaw at 60 Hz tick cadence; camera clears analytic not drawn terrain; boom cut misses ridges | — | 1 · 1 KB | `pre-t4:docs/audit/U23-probe-output.txt` |
| U24-probe-output.txt | 82c5906 A1-U24: stance foot floats 9-14 cm at run; slope roll inverted (19.6 deg at 10); crouch slide 5 cm; landing inside JumpLaunch lost | — | 1 · 1 KB | `pre-t4:docs/audit/U24-probe-output.txt` |
| U25-probe-output.txt | 6496d01 A1-U25: play frame allocates ~10.5 KB/frame (72-78% core terrain height path, zero-GC gate blind); HUD lat/lon from tilted up; core purity/page rule/Euler clean | — | 1 · 4 KB | `pre-t4:docs/audit/U25-probe-output.txt` |
| U26-probe-output.txt | 49e6c32 A1-U26: architecture method sound (keep rails/f64 core/origin/analytic KCC/bands/workers); no frame model (S1); terrain singleton re-points live actors (S2) | — | 1 · 0 KB | `pre-t4:docs/audit/U26-probe-output.txt` |
| U26b-probe-output.txt | 49e6c32 A1-U26: architecture method sound (keep rails/f64 core/origin/analytic KCC/bands/workers); no frame model (S1); terrain singleton re-points live actors (S2) | — | 1 · 0 KB | `pre-t4:docs/audit/U26b-probe-output.txt` |
| U27-k2d-evidence | d8f7b09 A1-K2d: batch three gate rechecks and qualify fixture and Sun claims | — | 17 · 34 KB | `pre-t4:docs/audit/U27-k2d-evidence/` |
| U27-k3-evidence | 099ce5b A1-K3: batch seven frame rechecks and qualify movement claims | — | 25 · 56 KB | `pre-t4:docs/audit/U27-k3-evidence/` |
| U27-k4-evidence | 029488c A1-K4: recheck five terrain findings with independent geometry and ownership controls | — | 21 · 31 KB | `pre-t4:docs/audit/U27-k4-evidence/` |
| U27b1-evidence | 36106c8 A1-U27b1: reconfirm K1 handoff gap with independent draw-state checks | — | 7 · 15 KB | `pre-t4:docs/audit/U27b1-evidence/` |
| U27b2-evidence | af725c1 A1-U27b2: recheck allocation gates and correct canary and GC remedies | — | 17 · 37 KB | `pre-t4:docs/audit/U27b2-evidence/` |
| U27b3a-evidence | 3081cd6 A1-U27b3a: reconfirm false-positive e2e gates with independent browser controls | m1a baseline exit=0 wall=11s | 49 · 385 KB | `pre-t4:docs/audit/U27b3a-evidence/` |
| U27b3b1-evidence | 0826c26 A1-U27b3b1: recheck R1/R2 gate blind spots with independent controls | — | 13 · 15 KB | `pre-t4:docs/audit/U27b3b1-evidence/` |
| U27b3b2a-evidence | 6823d42 A1-U27b3b2a: recheck R3 coverage blind spots with independent controls | — | 14 · 19 KB | `pre-t4:docs/audit/U27b3b2a-evidence/` |
| U27b3b2b1-evidence | 184dc6e A1-U27b3b2b1: recheck m1e drift, clearance and yaw gate blind spots | exits: independent-run1=1, independent-run2=0, independent-run3=0, original-u04=1 | 21 · 42 KB | `pre-t4:docs/audit/U27b3b2b1-evidence/` |
| U27b3b2b2a-evidence | 6632762 A1-U27b3b2b2a: recheck m1d atmosphere and grazing-collision gate blind spots | original-u05 EXIT=0 | 12 · 25 KB | `pre-t4:docs/audit/U27b3b2b2a-evidence/` |
| U27b3b2b2b1-evidence | daed833 A1-U27b3b2b2b1: recheck cube-face seam gate with independent topology | — | 10 · 84 KB | `pre-t4:docs/audit/U27b3b2b2b1-evidence/` |
| U27b3b2b2b2a-evidence | 4d0692b A1-U27b3b2b2b2a: recheck orbital rate and direction gate blind spots | exits: build=0, independent-1=0, independent-2=0, npm-ci=0, original=0, protected-diff=0, self-test=1, typecheck=0 | 17 · 87 KB | `pre-t4:docs/audit/U27b3b2b2b2a-evidence/` |
| U27b3b2b2b2b1-evidence | 9add690 A1-U27b3b2b2b2b1: recheck precision and rebase gate blind spots | — | 12 · 59 KB | `pre-t4:docs/audit/U27b3b2b2b2b1-evidence/` |

## Tools

T4 S3a kept 18 files of `game/tools/audit/` and the phase-1 `game/tools/diag-*` / `r4-cdp-driver.mjs` set: those named in a kept doc (FINDINGS, U27c-fix-tasks, U26-adr-drafts, an ADR) or a kept gate/tool, plus the files they import or read. The other 75 (every `*-regress.sh` and `f2fa-*.sh` runner, the uncited A1 probes, all `diag-*`) were deleted; read them with `git show pre-t4:game/tools/<path>` (the runners write to `pre-t4:docs/audit/evidence/<step>`, see the table above).

| kept file | reason |
|---|---|
| `game/tools/audit/f2fa-m1f-observe.mjs` | named in ADR-018-r2-bisect-method.md |
| `game/tools/audit/f2fb-make-variant.py` | named in ADR-021-r2-gate-design.md |
| `game/tools/audit/f3abbba-shape-probe.mjs` | named in ADR-014-alloc-calibration-private-shape.md |
| `game/tools/audit/f3abbbba-scale-laws.mjs` | named in ADR-015-catalog-scale-laws.md |
| `game/tools/audit/u01-gate-run1.log` | named in u03-r3r4r5-validity.mjs, u27b3b2a-r3-recheck.mjs |
| `game/tools/audit/u03-r3r4r5-validity.mjs` | named in ADR-023-r3-gate-design.md |
| `game/tools/audit/u27-findings-index.py` | named in FINDINGS.md |
| `game/tools/audit/u27-k2d-recheck.mjs` | named in FINDINGS.md |
| `game/tools/audit/u27-k4-recheck.mjs` | named in FINDINGS.md |
| `game/tools/audit/u27b1-k1-recheck.mjs` | named in ADR-023-r3-gate-design.md |
| `game/tools/audit/u27b1-ts-loader.mjs` | named in u27b1-k1-recheck.mjs |
| `game/tools/audit/u27b2-k2a-recheck.mjs` | named in FINDINGS.md |
| `game/tools/audit/u27b3a-k2b-recheck.mjs` | named in test-e2e-plumbing.mjs |
| `game/tools/audit/u27b3b2a-r3-recheck.mjs` | named in ADR-023-r3-gate-design.md |
| `game/tools/audit/u27b3b2b2b2b1-m1a-recheck.mjs` | named in FINDINGS.md |
| `game/tools/audit/u27b3b2b2b2b2a-m1a-timing-recheck.mjs` | named in FINDINGS.md |
| `game/tools/audit/u27c-coverage-check.py` | named in U27c-fix-tasks.md |
| `game/tools/r4-cdp-driver.mjs` | named in ADR-024-r4-gate-design.md, m1f-r4.spec.ts, M1fR4Gate.tsx |

### S3b probe runs (session 152c)

Each kept probe run from `game/` (the two `.py` tools from the repo root) on 7b3950e. The four exit-1 probes were re-run at the `pre-t4` tag in a worktree and fail the same way there, so the T4 cleanup did not cause them. They are rechecks pinned to older code or specs (drift), and are kept as citations.

| probe | exit | result |
|---|---|---|
| `f3abbba-shape-probe.mjs` | 0 | `ok=true` |
| `f3abbbba-scale-laws.mjs` | 0 | LAWS 8/8 |
| `u03-r3r4r5-validity.mjs` | 0 | CONFIRMED 22/22 |
| `u27-findings-index.py` | 0 | no-severity: [] |
| `u27c-coverage-check.py` | 0 | 55/55 findings covered, RESULT PASS |
| `u27b1-k1-recheck.mjs` | 0 | PASS 11/11 |
| `u27b3b2a-r3-recheck.mjs` | 0 | PASS 26/26 |
| `u27b3b2b2b2b1-m1a-recheck.mjs` | 0 | SUMMARY 50/50 |
| `u27b3b2b2b2b2a-m1a-timing-recheck.mjs` | 0 | SUMMARY 27/27 |
| `u27-k2d-recheck.mjs` | 1 | 13/14 (U27-k2d report recorded 14/14 exit 0); same at `pre-t4` |
| `u27-k4-recheck.mjs` | 1 | SUMMARY 14/19; same at `pre-t4` |
| `u27b2-k2a-recheck.mjs` (`--expose-gc`) | 1 | `Error: heap clauses large`; same at `pre-t4` |
| `u27b3a-k2b-recheck.mjs` | 1 | ENOENT `102a5b8:game/e2e/m1f.spec.ts` (spec retired by ADR-026); same at `pre-t4` |

Not run standalone: `f2fa-m1f-observe.mjs` (needs a worktree and port), `f2fb-make-variant.py` (builds a worktree variant), `r4-cdp-driver.mjs` (driven by the m1f-r4 spec), `u27b1-ts-loader.mjs` and `u01-gate-run1.log` (inputs to other probes).
