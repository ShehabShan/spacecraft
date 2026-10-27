# ADR-014 — Allocation-gate calibration control uses an instrument-private object shape (F3a, part bbba)

**Status:** accepted (session 118, 2026-10-27) · **Task:** F3a → F3abbb split per §12 into F3abbba (this ADR) + F3abbbb · **Gates:** ADR-002 (`tools/test-alloc-gate.mjs`), ADR-003 (`tools/alloc-lib.mjs`, `tools/test-alloc-loops.mjs`)

## Context
Both allocation gates calibrate the V8 sampling heap profiler before they measure anything. One control, `ctlObj`, writes `{ x: i, y: i, z: i }` into a 16-slot ring and must read 16–64 B per iteration; outside that window the gate exits 2 ("instrument calibration failed").

After F3abba added `CelestialConfig.spin.axis` (a boot-time `{x, y, z}` object of doubles, `spinLaw.ts`), `test-alloc-loops.mjs --self-test` exited 2: `cal.obj3` = 96.1 B/iter instead of 48.3. The game code did not get worse; the measurement control did.

**Cause (verified, session 118):** V8 keeps one hidden class (map) per object-literal shape and tracks a field representation for each property. Once any `{x, y, z}` literal in the isolate holds a non-Smi double, that shared map's fields become `Double`, and from then on every `{x, y, z}` object stores its fields as boxed HeapNumbers — including the control's small integers. Three boxes × 16 B = +48 B per object. Probe `game/tools/audit/f3abbba-shape-probe.mjs` (fresh process per mode, the unchanged pre-fix control) read: fresh 48.4, integer-polluted 48.3, double-polluted **96.1** B/iter. With the fix, all three modes read 48.3–48.4.

The game's own `{x, y, z}` objects (vectors, quaternions-with-w are a different shape) mostly hold doubles anyway, so any future data file can trigger this again. The control must not depend on what the game allocates at boot.

## Options
1. **Store the spin axis in another shape** (e.g. a `Float64Array(3)` or `{ ax, ay, az }`). Fixes today's trigger only; the next double `{x,y,z}` anywhere in the bundle breaks calibration again, and the game's data model would bend to suit a test instrument. Rejected.
2. **Widen the window to 16–112 B.** Hides the fault and weakens the control (a 2× sampler error would pass). Rejected.
3. **Use instrument-private keys** `{ calX, calY, calZ }` in the control. No game object shares that map, so its fields stay Smi and the control measures one 3-field object (48 B on this Node 24 build, no pointer compression) regardless of the game. Window unchanged.

## Decision
Option 3, in both `tools/alloc-lib.mjs` (`calibrate`) and `tools/test-alloc-gate.mjs` (inline calibration), each with a `// WHY:` comment. Budgets, windows, mutants and the measured loops are unchanged. The churn mutant in `withMutant` still uses `{x,y,z}`; it is asserted as a delta against its own baseline, so its larger per-object size only makes it easier to detect.

## Consequences
- `test-alloc-loops.mjs --self-test` and `test-alloc-gate.mjs --self-test` exit 0 on the F3abba tree again; unfixed `test-alloc-gate --self-test` on `d74c7e1` exits 2 (same 96.1 B), so the fix is exercised, not incidental.
- Gate numbers for the real frame/loops are untouched by this change (still red as recorded in ADR-002/003 until F5a/F7a).
- Lesson for future instrument controls: calibration objects must use shapes the measured code cannot share.
- The orbit-gate oracle extension that NEXT ACTION had reserved as ADR-014 moves to **ADR-015** (F3abbbb).