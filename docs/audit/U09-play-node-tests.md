# A1-U09 — play-layer Node tests (DONE)

**Status: DONE (session 63, 2026-10-22).** Audited `game/tools/test-play-*.mjs` (9 scripts) and `game/tools/check-play-*.mjs` (5 scripts) @ f05fbf4 against `docs/T1-plan.md` §13 (lines 2546–2677, esp. §13.2 lines 2580–2596).

Plan question (`docs/A1-plan.md` U09): do the assertions match the §13 claims, and is each flaky heap row a real leak or a bad bound?

## Method

- Claims written down first from §13.2: every script prints `[test-play-<area>] PASS n/n` and exits non-zero on failure; "Heap ≈ 0" = `heapUsed` delta after a final `gc()` < 64 KiB **and** no monotonic growth across 10 equal chunks; the play layer allocates nothing per frame (AGENT_BRIEF §3 zero-GC, T1-plan §11).
- Baseline: each script run with `node --expose-gc tools/<f>` from `game/`, exit code recorded unpiped (`> log 2>&1; echo $?`), 4 runs for the controller and 1 + 3 reruns for the others; then once without `--expose-gc`.
- Probe: `pre-t4:game/tools/audit/u09-play-node-validity.mjs`. It copies `game/src` to `node_modules/.cache/u09/g0` (git-ignored), path-rewrites copies of the real test scripts onto that copy, injects ONE mutation per copy, and re-runs them as child processes (`--expose-gc`, optionally `--trace-gc`). A `PerformanceObserver('gc')` hook counts minor GCs (scavenges). The repo's `src/` and `tools/test-play-*.mjs` are only read. Result: `PROBE_EXIT=0`, `[u09] 11/11 as expected`.
- Environment: PromptQL VM v2, 2 vCPU / 4 GB, Node from `game/` `npm ci`.

## Baseline

| Script | `--expose-gc` exits | Without `--expose-gc` |
|---|---|---|
| test-play-anim | 115/115 · 0 0 0 0 | EXIT 1, FAIL 113/115 ("run with node --expose-gc" ×2) |
| test-play-controller | 56/57 on failure · **1 1 0 1** (probe: red 4/4) | EXIT 1 (camera row) — zero-GC row :226 passes vacuously |
| test-play-frame | 23/23 · 0 0 0 0 | EXIT 1, FAIL 20/21 |
| test-play-lod | 40/40 · 0 0 0 0 | EXIT 1, FAIL 38/39 |
| test-play-perf | 19/19 · 0 0 0 0 (Δ −7952 B, trend −17 B/1k) | EXIT 2 |
| test-play-rig | 97/97 · 0 0 0 0 | EXIT 1, FAIL 96/97 |
| test-play-shell | 101/101 · 0 0 0 0 | EXIT 1, prints "FAIL 1/100" |
| test-play-spawn | 70/70 · 0 0 0 0 | — |
| test-play-world | 27/27 · 0 0 0 0 | EXIT 1, FAIL 25/26 |
| check-play-b4/b5/b6/b7/b9 | **NOT RUN** — EXIT 1, Playwright's bundled chromium headless shell is not installed (environmental) | — |

Heap-row inventory (every row: "heapUsed after gc() delta < 64 KiB"): anim:194, anim:375, controller:226, controller:381, rig:152, shell:154 one-sided (`dh <`); frame:95, frame:156, lod:112, perf:103, shell:261, world:115 two-sided (`Math.abs`). Only perf:104 checks a trend (least-squares slope < 2048 B / 1k frames over 11 samples).

## Probe results

| Probe | What it injects | Result |
|---|---|---|
| P:perf-control | none | PASS 19/19, Δ −7984 B, trend −17 B/1k; 102 scavenges whole run |
| P:perf-transient | +8 objects + 2 arrays (~400 B) per frame, discarded | **PASS 19/19**, Δ −8832 B; 103 scavenges |
| P:perf-transient4k | +1 `Array(512)` of doubles (~4 KB, ~40 MB over the window) per frame, discarded | **PASS 19/19**, Δ −8080 B; 113 scavenges |
| P:perf-leak | +1 small object per frame, retained | FAIL 2/19, exit 1 (caught) |
| C:cold-row-red | unmodified controller camera row | red 4/4; first 10k window 105.8 / 99.1 / 91.1 / 104.4 KB |
| C:no-steady-leak | 5 further 10k chunks on the same rig | max 8064 B (most −312 … 624 B) |
| C:warm-row-green | camera loop run 10k frames before `h0` | −3.2 / −2.9 / 10.3 / −8.7 KB, green 4/4 |
| Z:vacuous-without-gc | controller without `--expose-gc` | zero-GC row :226 passes; script red only via the camera row's `ok(false,…)` |
| F:buffer-0.30 | `jumpBufferS` 0.12 → 0.30 | exit 1 (caught) |
| F:buffer-0.19 | `jumpBufferS` 0.12 → 0.19 | buffer rows **pass** (inside the test's [0.10, 0.20) bracket) |

Note: `Float64Array` backing stores above 64 B live off the V8 heap, so the transient mutants use on-heap objects/arrays; a typed-array allocation would be invisible to `heapUsed` altogether.

## Findings

### A1-U09-1 — The heap rows cannot detect per-frame allocation, so the zero-GC claim is untested
- **Severity:** S1 · **Confidence:** high (repro) · **Category:** test
- **Location:** all 12 heap rows listed above, e.g. `game/tools/test-play-perf.mjs:87-104` @ f05fbf4.
- **Claim (§13.2, T1-plan §11, AGENT_BRIEF §3 zero-GC):** the play layer allocates nothing per frame; "Heap ≈ 0" proves it.
- **Evidence:** a mutant allocating ~400 B per frame and one allocating ~4 KB per frame (≈40 MB of garbage over the 10k-frame window) both pass perf 19/19 with Δ −8.8 / −8.1 KB. Only a *retained* allocation (perf-leak) fails. Each row calls `gc()` before reading `heapUsed`, which collects exactly the transient garbage a zero-GC claim is about.
- **Impact:** the rows prove "no leak", not "no allocation". A per-frame allocation regression (GC pauses / frame hitches) ships green.
- **Proposed fix:** add an allocation-sensitive row: count minor GCs in the measured window via `PerformanceObserver({entryTypes:['gc']})` (kind 1 = scavenge) with a small young generation (`--max-semi-space-size=1`) and assert 0, or sample `heapUsed` *without* an intermediate `gc()` and bound the rise. The probe's whole-run counts (102 / 103 / 113) show an unrestricted count is too coarse; the fix task must restrict to the window and shrink the semi-space. Method choice belongs to the fix task.
- **Fix size:** S (one helper in a shared tools module, one row per script).

### A1-U09-2 — The controller camera heap row is red because it has no warm-up, not because of a leak
- **Severity:** S2 · **Confidence:** high (repro, 4 + 4 runs) · **Category:** test (bad method)
- **Location:** `game/tools/test-play-controller.mjs:376-382` @ f05fbf4.
- **Claim:** "Zero-GC: camera pre/post steps over 10k frames" (heap delta < 64 KiB).
- **Evidence:** `h0` is read cold, before the camera loop has ever run. The first window reads 91–106 KB (red 4/4 in the probe, 3/4 in the baseline); five further 10k chunks on the same rig stay ≤ 8064 B; a 10k-frame warm-up before `h0` gives −8.7 … 10.3 KB (green 4/4). The cold excess is one-off JIT/IC/feedback-vector memory, the same effect test-play-perf's WHY comment (lines 80–86, B10 decision: 20,000 warm-up frames) already documents. The zero-GC row at :218-227 in the same file warms up 2,000 frames and is green.
- **Impact:** the T1 suite is red on most runs with no defect, which trains people to ignore it.
- **Proposed fix:** run the camera loop ≥ 10k frames before `gc(); h0 = …` (as at :220).
- **Fix size:** XS (1 line).

### A1-U09-3 — Only test-play-perf checks the §13.2 "no monotonic growth" clause; six rows are one-sided
- **Severity:** S2 · **Confidence:** high (read) · **Category:** spec–test mismatch
- **Location:** heap rows above; perf:104 is the only trend check.
- **Claim (§13.2 lines 2595–2596):** delta < 64 KiB after a final gc() **and** no monotonic growth across 10 equal chunks.
- **Evidence:** 11 of 12 rows take a single start/end delta. A slow leak below 6.4 B/frame (64 KiB / 10k) passes them; perf's slope row is the only one sensitive to trend. anim:194/375, controller:226/381, rig:152 and shell:154 use `dh <` (any shrink passes), the rest `Math.abs`.
- **Impact:** the §13.2 definition of "Heap ≈ 0" is implemented in one script only.
- **Proposed fix:** a shared `heapFlat(fn, frames)` helper: warm-up, 10 chunks, two-sided delta + slope; use it in every script.
- **Fix size:** S.

### A1-U09-4 — The jump-buffer rows bracket the window at [0.10, 0.20) s, not 0.12 s
- **Severity:** S3 · **Confidence:** high (repro) · **Category:** test sensitivity
- **Location:** `game/tools/test-play-controller.mjs:138-141` @ f05fbf4; `PLAY_TUNING.jumpBufferS` 0.12.
- **Claim:** the jump buffer is 0.12 s.
- **Evidence:** `jumpBufferS` 0.30 fails (exit 1); 0.19 (+58 %) passes both rows.
- **Impact:** a tuning drift up to 0.19 s is invisible. Look-and-feel tuning, so low severity.
- **Proposed fix:** add presses at 0.11 s (fires) and 0.14 s (does not) at 60 Hz.
- **Fix size:** XS.

### A1-U09-5 — Without `--expose-gc` the controller zero-GC row passes vacuously
- **Severity:** S3 · **Confidence:** high (repro) · **Category:** test
- **Location:** `game/tools/test-play-controller.mjs:226` (`ok(!globalThis.gc || …)`).
- **Evidence:** every other heap row fails loudly without gc (`run with node --expose-gc`); this row passes and prints "(no --expose-gc: not asserted)". The script still exits 1 only because the camera row fails.
- **Proposed fix:** `ok(false, 'run with node --expose-gc')` like :383. **Fix size:** XS.

### A1-U09-6 — Output lines do not follow the §13.2 format
- **Severity:** S3 · **Confidence:** high (read) · **Category:** test / reporting
- **Location:** `test-play-perf.mjs:147`, `test-play-shell.mjs:265` print `FAIL <failures>/<n>` (others print `<passes>/<n>`); anim, controller, perf, rig, shell omit the `[test-play-<area>]` brackets.
- **Evidence:** shell without gc prints "FAIL 1/100" with 99 rows passing; anim prints "FAIL 113/115".
- **Impact:** a log scraper or reader misreads counts. **Proposed fix:** one shared summary function. **Fix size:** XS.

## Checked, no issue

- All nine test-play scripts exit 0 on 3 reruns with `--expose-gc`, except the controller (A1-U09-2).
- A retained per-frame allocation is caught (perf-leak FAIL 2/19); perf's slope row works.
- `jumpPressed` is consumed by the controller (`src/play/controller/PlayerController.ts:130` sets the buffer and clears it) and cleared at end of frame by `InputState` (`src/play/input/InputState.ts:124`), so the tests that set it once and never reset it are valid.
- A buffer window of 0.30 s is caught.
- No steady-state camera leak: later chunks ≤ 8 KB.
- Every script exits non-zero on failure.

## Not yet checked

- check-play-b4/b5/b6/b7/b9 (browser) — NOT RUN: `chromium.launch()` needs Playwright's bundled headless shell, absent here (`npx playwright install chromium` or a `channel: 'chrome'` variant; Chrome exists at `/opt/google/chrome/chrome`). Their B-step claims remain unaudited; carry to a later unit or a re-run on a machine with the browser.
- Functional sensitivity of the non-heap rows in anim, rig, shell, lod, world, spawn, frame (only the controller buffer row was mutated).