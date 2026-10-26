# K3 recheck claims — written before this session's source inspection
Base d8f7b09. Seven findings, one related recheck batch.
- A body orientation needs an explicit time-dependent rotation separate from its orbital position.
- A point fixed on a body has world position C(t)+R(t)p and velocity C'(t)+omega×R(t)p; translation/spin alone must not change body-relative clearance.
- Up stored in body coordinates must be compared to a radial vector in those same coordinates. A zero-spin control must remove a frame mismatch.
- Equivalent spin phases separated by 2π must not create a full-circle collision sweep in one small tick.
- A local speed limit must identify its frame. Orbital speed a*n*timeScale can exceed a global limit without prohibiting low body-relative speed; distinguish configured orbital velocity from rate of position change on the scaled clock.
- A synthesis adds no independent defect count or proof beyond its members. A state model alone does not automatically fix all controllers.
Method: reuse original repros, inspect relevant unchanged sources, add a compact independent metamorphic/analytic check with controls; no exhaustive repeat of completed audits.
