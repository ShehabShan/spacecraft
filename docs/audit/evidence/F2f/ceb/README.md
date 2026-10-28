# F2fceb evidence — rebuilt m1f R5 gate, row R5b (session 141, ADR-025 amendment)

Page `?page=m1fR5` (`game/src/test/M1fR5Gate.tsx`) now has two rows.

R5b straddler part: Sat B (r 60 m, depth 2,400 m on the view axis) has d_n 2,340 and d_f 2,460. The production `layerMaskFor` returns 3 (NEAR|MID). A Near-only occluder sits in front of it and a Mid-only backdrop behind it. Rendered through `executePasses` at 1280×720:
- coverage (auto vs Sat-B-hidden): 655 px (ideal disc 705, floor 200);
- a 1 m shift changes 17 px (the instrument is not blind);
- auto vs forced-Near 0 B, auto vs forced-Mid 0 B, repeat 0 B of 3,686,400.

R5b Sun part: a real SimulationCore camera flies the R5a h 0 route (4,000 m at 50 m/s, 4,800 ticks). Every tick the far pass is rendered (160×90) with the Sun impostor staged from the f32 locals and checked against an origin-free f64 oracle. Result: 4,800 samples = 4,800 frames, 2 rebase frames (2 shifts, both clean), max direction error 3.44e-8 rad (tol 1e-5), Sun px min 87, max centroid error 0.06 px (tol 1).

Mutants (each turns only R5b red; R5a stays PASS):
- `offframe` (Sat B behind the camera, same depth range): 0 px, and the 1 m shift changes 0 px;
- `single` (Sat B forced to MID only): assigned mask 2 ≠ 3;
- `sunstale` (Sun local never rebased): direction error up to 3.14 rad and 0 px on 2,538 of 4,800 frames.

Files: `selftest-run1.txt`, `selftest-run2.txt` (7 cases each, AS EXPECTED, exit 0), `spec-run.txt` (badges PASS, PASS; exit 0). TSC exit 0.