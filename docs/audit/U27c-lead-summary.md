# A1 engine audit — summary for the Lead (plain language)

- 2026-10-26 · branch `a1-engine-audit` · the full task list is in `docs/audit/U27c-fix-tasks.md`, the evidence in `docs/audit/FINDINGS.md`.

## 1. What the audit found

The audit checked the game's specs, code and tests and found 167 problems: 1 critical, 54 serious, 66 medium and 46 minor. Every one of the 55 critical and serious problems was checked a second time with new, independent tests, and all of them held up (some with corrected wording or narrower scope).

In plain words:

1. **Many tests cannot fail.** About half of the serious problems are tests that would still say "PASS" even if the thing they check were broken. Example: the orbit test still passes if every planet goes twice as fast or backwards. So the earlier milestone approvals do not prove what they claim.
2. **Nothing in the sky actually spins.** Planets and moons orbit but do not rotate, and the walking/flying code has no shared idea of "standing on a moving planet". The play Moon only works because the sky is frozen while you walk.
3. **The ground you see is not quite the ground you stand on.** The drawn terrain differs from the collision terrain by up to several metres, slope directions are off by degrees, and the terrain streaming can leave holes.
4. **The game creates garbage every frame** (about 10 KB), which the design forbids because garbage collection can cause stutter (measured in Node; not yet measured in a browser).
5. **Flight:** left/right steering is mirrored, the ship can hardly brake near top speed, and any landing speed counts as a soft landing.
6. **Walking:** the "too steep" angle is really about 56–59°, not the intended 50°; landings on uneven ground can snap the astronaut's tilt in one frame.
7. **Looks:** big planets near the edge of the screen are squashed, a far body can be drawn in front of a near one, and the astronaut's feet float or tilt the wrong way on slopes.
8. **The one critical problem:** when flying down toward a planet, there is a stretch of about 5.6 km where the planet is not drawn at all. It only lives in a test page today, so the play Moon does not show it.

The overall engine design is sound and should be kept (orbit rails, high-precision positions, the layered cameras, the analytic walking physics). The problems are fixable in place, in small steps.

## 2. What happens next (if you accept)

27 small fix tasks, each sized for one session, in this order:

1. **Make the tests honest first** (8 sessions). Each new test must turn red on a deliberately broken copy before it is trusted.
2. **Give planets real rotation and a shared "frame" for anything standing on them**, and one game clock (4 sessions).
3. **One terrain service** that the drawn ground, collisions, camera and feet all use (4 sessions).
4. **Walking and flying fixes on the new frames** (6 sessions), then unfreeze the sky so the Moon spins and orbits while you walk.
5. **Rendering fixes**, including the critical 5.6 km gap (2 sessions), then feet (1) and an engine structure that makes adding vehicles, enemies and more planets easy (2).

T1 (the playable Moon) picks up again right after the tests are fixed. T2 (atmospheres and manual landing) starts after the flight fixes, on your order. Your earlier choices (small Moon with lower hills, big Earth in the sky, realistic day/year order, thin glowing atmospheres, soft/hard/crash landings) are already built into the plan.

One honest caveat: the plan asked that the second check be done by a different AI model than most of the first checks. The second checks were all done by GPT-6 Astra; one original session is confirmed as Claude Opus 5.5, but the platform records do not prove which model did most of the originals. Every second check stands on its own new tests, so this does not weaken the findings, but I am not claiming that condition as fully met.

## 3. What I need from you

- **To start the fixes:** say "accept A1 and execute F1a" (or change the order). Nothing changes in the game until you do.
- **For the m1f tests (task F2f):** that milestone is parked, so I need you to say that F2f may rebuild the 1F tests. Until then, F2f is skipped and T1 waits.

## 4. Four look-and-feel questions (a suggested answer for each)

1. **Jumping on a hillside:** straight up, or pushed away from the hill? *Suggested: straight up, with a small push away only on very steep ground.*
2. **Too-steep slopes:** one clear angle where you slide and cannot walk up? *Suggested: yes, about 45° on the Moon — below it you walk normally, above it you slide down.*
3. **Landing on a hillside:** should the astronaut lean into the hill smoothly, or stay upright? *Suggested: lean smoothly over about a quarter of a second, never snap.*
4. **End of a slide:** slow down gradually like sliding on dust, or stop almost at once? *Suggested: slow down gradually over about one second.*

**Answered 2026-10-26:** the Lead accepted all four suggested answers (recorded in the `notes/STATE.md` APPROVAL LEDGER).