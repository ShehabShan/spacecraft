# U27b4bba — K6 flight re-check

Session 99 · 2026-10-26 · base `029488c` · A1 read-only.

## Claims before the independent probe
- With forward +X and up +Y, pilot-right is +Z. Positive yaw should move the
  nose toward +Z; positive roll should tilt up toward +Z. Pitch-up is +Y.
  Test both signs and a rotated initial frame, not only one identity pose.
- In gravity-free vacuum, full retro thrust below the fade band should reduce
  speed by 45 m/s². Removing prograde acceleration at the cap must not make
  braking unavailable. This is a proposed design constraint, not a claim that
  the existing fade violates its literal all-thrust formula.
- Drag cannot guarantee the same arrival speed for arbitrarily small density.
  For pure quadratic drag and no gravity, integrating dv/ds = −βρv gives
  v(h) = v0 exp[−βρ0 H(exp(−h/H) − exp(−h0/H))].
  Compare actual integration to this independently derived limiting case.
- Measure impact velocity immediately before contact resolution, not at the start
  of its tick. A radial impact is not equivalent to every oblique impact.
- A configurable atmosphere is not a per-body selection service. Distinguish a
  missing T2 integration from inability to supply a custom profile. Density-only
  swaps on the test planet are not simulations of Mars, Venus or Pluto.
- No browser visual verdict, genuine planetary profiles, or new gameplay ruling
  is claimed. Apply the existing 2026-10-23 soft/hard/crash ruling.

## Dispositions (five S1 findings retained with qualifications)

All locations refer to `game/src/` at `029488c`. New probe:
`game/tools/audit/u27-k6-recheck.mjs`; original U18/U19 probes also rerun unchanged.
Full controller, atmosphere and aerodynamics files were read; targeted Milestone
1D passages 35, 69, 75 and control-sign passages checked, not the whole milestone.

### A1-U18-1 — mirrored yaw/roll: confirmed S1, engine/spec
Locations: `core/physics/flightController.ts:74–78,153,416–417`;
`test/Milestone1D_TestHarness.tsx:460–461`.
Independent quaternion multiplication and a right-hand rotation calibration give
pilot-right = forward × up. Positive yaw moves the nose −0.123416 toward that
axis; positive roll tilts up −0.430838. Positive pitch correctly raises the nose
+0.220879. Negative-input and zero-input controls respond; the same result holds
with the initial frame rotated 0.7 radians.

The manual harness maps D to +yaw and right-arrow to +roll. There is no playable
ship page: only the M1D harness constructs FlightController (lines 110–111).
Impact is the manual harness and future callers, not current on-foot WASD.
Fix: invert the yaw/roll commands consistently with the documented body basis
and independent input-direction tests. Merely renaming +Z does not fix controls.
Size: one session; no ratified constant involved.

### A1-U18-2 — all-thrust cap removes braking: confirmed S1, engine/design
Locations: `core/physics/flightController.ts:443–459`.
In gravity-free vacuum, full retro deceleration is 45 m/s² at 1880, 22.5 at
1940, 0.009323 at 1999, and exactly 0 at 2000 m/s. Lateral thrust also vanishes
at 2000. From 1999, 60 seconds of full retro ends at **1997.738577 m/s**.
Below-band full-thrust controls and prograde controls respond.

Qualification: braking near (but below) the cap is **weak**, not literally zero;
gravity/drag can change the result. Attitude rotation remains available.
The code matches the literal all-thrust fade formula: the defect is its
fitness for piloted braking, not a misimplementation of that formula.
Original proposed dot-product scaling is not an adopted solution.
Recommend a signed-power-aware acceleration rule that retains retro authority,
with finite-step lateral-energy and frame tests; lateral thrust can still raise
speed over a finite step. This touches the RATIFIED cap: a later task needs a
production ADR and tests. Size: one session after frame/regime contracts exist.

### A1-U19-2 — density-only slow-arrival guarantee fails: confirmed S1, spec/T2
Locations: `core/physics/aerodynamics.ts:8–21`;
`core/physics/flightController.ts:398–434`.
The original same-test-planet density swaps reproduce. A new forwarding wrapper
captures velocity immediately before `_resolveContact`, after this tick's forces:

| Test profile rho0 kg/m³ | Pre-resolution speed m/s | First contact time |
|---:|---:|---:|
| 0.00008 | 2014.595 | 4.017 s |
| 0.020 | 1861.740 | 4.067 s |
| 1.225 | 51.456 | 16.900 s |
| 5.3 | 22.421 | 80.733 s |
| 65 | no contact within 100 s | still descending, altitude 3147.3 m, speed 14.04 m/s |

These are **density sensitivity experiments**, not actual Mars/Pluto/Venus:
radius, gravity, scale height, composition, temperature and ship remain the
Earth-scale fixture. The original numbers sampled tick-start velocity; e.g.
1865.290 becomes 1861.740 immediately before response. “Venus never lands” is
withdrawn: only a finite 100-second non-contact observation exists.
The old blanket assertion that every case exceeds a_struct is also unsupported
(the original thin 0.00008 profile peaks at about 0.106 g).

Independent physics control: no gravity, quadratic drag only, no lift, flat
sphere, dt=1/240. At the actual crossing near 1000 m, the integrated column
formula predicts 1934.428 m/s for rho0=.02 and 260.454 for rho0=1.225; controller
gives 1934.641 and 260.138 (relative error 0.011% / 0.121%). Vacuum stays exactly
2000. This confirms the density-column dependence, not an error in drag itself.

Fix: choose explicit near-body arrival/streaming limits and per-body profiles in
T2 rather than promise identical slowing from drag alone. Preserve the approved
thin-glowing-shell gameplay direction; technical profiles/regimes require an ADR.
Size: split profiles/selection and regime/streaming acceptance into separate
session-sized units. No real-world atmosphere table was independently certified.

### A1-U19-3 — fast radial impacts become LANDED: confirmed S1, engine/T2
Locations: `core/physics/flightController.ts:81–107,709–748`.
On a flat sphere with no gravity/air, actual pre-resolution inward speeds
5, 60 and 140 m/s all become LANDED at first contact with zero post-speed.
A forwarding wrapper reads the real velocity before the original method executes;
it neither replaces collision response nor changes the tracked source.
A 140 m/s inward + 20 m/s tangential control retains 19.846 m/s and is
**SUBSONIC, not LANDED** at first contact. Thus “any touchdown speed lands”
is too broad if interpreted as every oblique collision. The radial-impact
failure and absence of impact-outcome telemetry remain.

Use the already-approved soft/hard/crash outcomes (Lead 2026-10-23), not another
gameplay question. Record pre-response normal/tangential impact metrics and
classify outcomes before erasing velocity; exact numbers/normal contract belong
in the fix ADR. Size: one session for metrics/outcomes, presentation separately
if needed. Terrain-normal changes depend on K4.

### A1-U19-4 — missing per-body flight integration: confirmed S1, T2 gap
Locations: `core/physics/atmosphere.ts:27–57`;
`core/physics/flightController.ts:113–145,555–562`;
`core/orbit/celestialData.ts:252`; M1D harness constructors 110–111.
Only EARTHSCALE_ATMOSPHERE is exported as a profile and only EARTHSCALE_FLIGHT
as a flight default. The source has no catalog-body-to-flight profile selection
or separate cruise/boost speed regime; the fixed cap is unchanged at two vacuum
altitudes.

Qualification: FlightController **requires a supplied config**; it does not
automatically choose Earth air for arbitrary bodies. AtmosphereProfile already
provides a configurable foundation. A caller-supplied rho0=0 profile produces
zero density and unchanged horizontal velocity, independently verified.
The missing feature is body selection/integration and regime policy, not an
inability to represent vacuum or another profile. Catalog `atmosphereHeight`
is copied into orbital data; the similarly named physics field is a separate
profile field, not evidence of that catalog hookup.
Fix: build body-profile selection and regime handling atop the existing
interface; validate catalog changes rather than assume the original
real-world comparison was complete. Size: profiles/selection one session,
regime one more. Catalog/cap changes need ADRs.

## Checked, no issue / boundaries
- Pitch signs, neutral input and rotated-frame direction controls respond.
- Full retro below the cap band is 45 m/s²; the fade arithmetic matches its formula.
- Quadratic column law and vacuum controls agree with independent physics.
- Collision response is sensitive to tangential velocity; not all contact
  predicates are blind.
- Caller-provided vacuum configuration works.
- U18 spin finding belongs to already-reviewed K3 and is not counted again.
- No browser/manual fly-through, spacecraft damage implementation, actual
  per-body atmospheric validation or production fix is certified.

## Verification
From `game/`, unpiped commands with exits captured immediately; evidence files
are in `pre-t4:docs/audit/evidence/U27-k5/` (shared directory for this one K5/K6 batch):

| Command | Exit / observed result | Log |
|---|---|---|
| `node tools/audit/u18-flight-controller.mjs` | 0; original controls 5/5 | `original-u18.txt` |
| `node tools/audit/u19-aero-atmosphere.mjs` | 0; original controls 11/11 | `original-u19.txt` |
| `node tools/audit/u27-k6-recheck.mjs` twice | 0, 0; 23/23 each | `k6-independent-1.txt`, `k6-independent-2.txt` |
| same with `--self-test-fail` | 1; 23/24 deliberate failure only | `k6-self-test.txt` |
| `npm run typecheck` / `npm run build` | 0 / 0 (build chunk warning) | `typecheck.txt`, `build.txt` |

Protected diff from `256d77d` is empty, exit 0; final scope check in
`verification.txt`. Node 24.22.0, VM 2 vCPU / 4 GB. Model `gpt-6-astra`
platform-confirmed; historical per-unit provenance remains unresolved.
With K5, **48/55 findings reviewed**, K7–K9's seven left.
