# Expectations written before this session reads the R3 implementation
Scope: U03-2/-3 only; base 0826c26, 2026-10-25.
- A no-hole/no-double-full check must observe independently submitted mesh and
  impostor contributions, including visibility/state, not infer one from the other.
- For complementary scalars m=1-i, simultaneous m,i <=0.01 is impossible
  (their sum would be <=0.02, contradicting 1); simultaneous >=0.99 is
  likewise impossible. This does not imply every other R3 term cannot fail.
- A silhouette comparison must reject empty/all-background masks and a missing
  representation; matching coverage alone is not evidence of matching objects.
- At distance 232000 and radius 1800, an on-axis sphere projects to
  r=f*tan(asin(R/d)); f=720/(2*tan(62deg/2)), independent of engine helpers.
  A 160-square all-foreground mask cannot measure this small disk.
- Controls: isolated identical disk should pass; missing/shifted disk should fail;
  equal empty masks and uniform bright backgrounds must not be accepted by an
  adequate observer. Compare these expectations with extracted actual predicates.
- Historical pixel evidence is not a fresh GPU measurement. Do not claim all
  possible poses saturate, that background identity is known, or that a full
  browser suite passed from Node controls.
