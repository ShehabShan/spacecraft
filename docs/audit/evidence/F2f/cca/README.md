# F2fcca evidence — R3 gate design (ADR-023)

This was a design-only unit; no game code changed.

- `handoff-analytic.mjs` copies the controller verbatim from the harness §5 and sweeps it with the RENDERED visibility rules. It also prints:
  - the expected probe disk radius and area at each distance;
  - the predicted R3b coverage at each sample distance.

  Run it from this directory with `node handoff-analytic.mjs`. It exited 0 in session 134.
- `handoff-analytic.out.txt` holds that run's output:
  - Descending, there is a hole over [220000, 225647] m (5,647 m) at 1 m steps.
  - Ascending, there are 0 holes. There are 0 doubles in either direction.
  - At 232 km the disk has r = 4.65 px and an area of 67.9 px².
  - The predicted R3b failures are the descending samples at 222, 224, 228 and 232 km.