# Independent expectations — U27b4bbbb, 2026-10-26
Before reading the implementations this session:
1. A sphere's visible silhouette is the set of camera rays tangent to it:
   (ray·centre)^2 = |centre|² - R² for unit rays, with ray·centre > 0.
   Compare submitted impostor geometry to that cone, not its cached angular metadata.
   On-axis and direction-normal disks should be controls.
2. For two disjoint spheres along overlapping rays, the first positive ray/sphere
   intersection determines the visible surface. A staged billboard's camera-z
   must not reverse that order. Check a ray inside both submitted disks, not
   merely their centres. Separate depth geometry from any GPU/painter-order claim.
3. In stance a foot intended to stay planted must have both its horizontal and
   vertical world-space position held at contact; test the actual articulated rig,
   not only the animator's target. Flat/idle controls should establish reference.
4. A sole aligned to an inclined plane has a world normal parallel to that plane's
   upward normal. Opposite signed cross-slopes must yield opposite sole tilts;
   measure transformed sole normals rather than trusting Euler-angle names.
Scope: U15-3/-4 and U24-1/-3 only. No production design adopted.
