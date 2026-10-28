# ADR-012 — KeplerRail boot validation of orbit elements (F3a, part ba)

**Status:** accepted (session 116, 2026-10-26) · **Task:** F3a → F3ab split per §12 into F3aba (this ADR) + F3abb · **Finding:** A1-U12-2 (S2) · **Promotes:** D-ADR-2 (`docs/audit/U26-adr-drafts.md`), validation clause only

## Context
A1-U12-2: `KeplerRail` accepted any orbit element. With e ≥ 1, a ≤ 0 or a non-finite element, `semiMinor = a·√(1−e²)` and the elliptic Kepler solver produce NaN. That NaN reached every tick, with no error. F3abb will replace the hand-typed catalog with values derived from real data by scale laws, and will add e, i, Ω and ω. A bad law or a typo must fail at boot and name the body. It must not show up later as a NaN frame.

## Options
1. Validate in `celestialData.ts` only. The rail would stay open to any other config source: test harnesses, the self-tests of the gates, and future bodies.
2. Validate in `KeplerRail._addBody`, the single entry point every config passes through. This is a boot-only exported function, `validateOrbit(id, orbit)`, that throws with the body id.
3. Clamp invalid values, for example e → 0.9999. This hides the bug. Rejected.

## Decision
Option 2. `validateOrbit` requires the following, and throws `[KeplerRail] body '<id>': …` otherwise:
- a, e, i, Ω, ω, M0, T, n and μ_host are finite;
- a > 0;
- 0 ≤ e < 1;
- μ_host > 0;
- T > 0.

It runs on the boot path only. It allocates the error message only when it throws, and nothing per tick, so the zero-GC tick is unchanged. Hyperbolic and parabolic rails are out of scope. The rail is elliptic by design.

**Gate:** `game/tools/test-rail-validation.mjs` bundles the real rail and the real catalog. It has 35 checks:
- **Production:** the production catalog boots all 17 bodies, finite at t = 0, 1e6 and −3e7.
- **Rejections:** 15 invalid-element cases on the Moon and on Triton (the retrograde orbit) all throw, and each message names the body.
- **Accepted boundaries:** four valid boundary cases must still boot finite: e = 0, e = 0.9999, i = π, and an unwrapped M0 = −10.

**Self-test:** six source-rewrite mutants must turn the gate red:
- the validation call removed;
- e ≤ 1 accepted;
- e > −1 accepted;
- a ≥ 0 accepted;
- the finite check skipped;
- the μ check removed.

The self-test also prints the original defect: with the call removed and Moon e = 1.5, the state is non-finite. `--deliberate` adds an identity mutant and must exit 1.

## Why
The rail is the single place every orbit config passes through. Failing loudly at boot with the body id is cheap. It is also exactly the check F3abb's derived catalog needs.

## Consequences
- Any config with an invalid orbit now throws at `new KeplerRail(...)` and does not run with NaN. No production body was affected: all gates are unchanged and green.
- F3abb (scale laws, new spin/pole/elements fields, orbit-gate pin update) takes **ADR-013**. The F3ab NEXT ACTION previously reserved ADR-012 for the orbit-gate pins.
- Evidence: `pre-t4:docs/audit/evidence/F3a/aba/` (`exits.txt`).