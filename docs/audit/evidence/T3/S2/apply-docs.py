# T3 S2 process-file updates (one-shot; kept as evidence of what was edited).
import re, pathlib
R = pathlib.Path('/workspace/spacecraft')

adr = R / 'docs/decisions/ADR-028-moon-terrain-profile.md'
adr.write_text(adr.read_text().rstrip('\n') + '''

## Amendment 1 — S2: the profile wired into play (session 148, 2026-10-28)
**Decision.** `MOON_PARAMS` (play only) now carries the S1 candidate "G-prune": `mountainAmp` 230 → 27.6,
`detailAmp` 16 → 5.6, plus the `moon` profile as literals. The S1 basin set (mulberry32(0x7a3e), radii ×1.15)
is rigidly rotated so basin 0 is centred on the spawn search base (Earth direction rotated 75° about E×S,
`spawn.ts`). A rotation keeps every pairwise basin angle and radius, so the non-overlap and coverage of S1
are unchanged. The spawn search is unchanged, and it now lands on mare floor. The harness MOON and
TEST_PLANET are untouched. Generator: `docs/audit/evidence/T3/S2/basins-gen.mjs`.

**Why.** Playability first: the player starts on flat mare ground, with basin-rim mountains in view.
Rotating the set instead of re-searching for basin placements keeps S1's measured coverage valid.

**Gate change.** `tools/test-moon-profile.mjs` now evaluates the real `MOON_PARAMS` (mutants perturb a
structured clone of it). The S1 check "`MOON_PARAMS.moon` unset" became: profile set, amplitudes = the
candidate, basins = a rigid rotation of the S1 set (max angle/radius error < 1e-5).

**Evidence (before → after).**

| Check | Before S2 | After S2 |
|---|---|---|
| Spawn dir | (0.834975, −0.072799, 0.545451) | (0.844316, −0.128624, 0.520178) |
| Spawn slope / height / mare mask | < 1° / — / — | 0.01° / −24.36 m / 1.0 |
| Max slope within 60 m of spawn | — | 3.24° (832 samples; limit 15°) |
| Earth / Sun elevation at spawn | 14.35° / 46.21° | 16.06° / 44.41° |
| Play slope <5° · <45° · ≥50° | 0.9% · — · 40.9% (P0 baseline) | 32.5% · 92.1% · 4.0% |
| Mare · max h · cost | — | 33.0% · 170.2 m · 1.92× |
| kcc-default-trace `play` | `8c39022f…` | `db41fe5a…` |
| kcc-default-trace `harness` | `caebaab8…` | `caebaab8…` (unchanged) |
| TEST_PLANET / harness MOON hashes | `412ed993…` / `b7403bae…` | unchanged |

The play trace has 0 walk-offs after S2 (1 before); the harness trace keeps 4, so the coyote site stays
covered. The flat synthetic patches in test-play-controller now also set `moon: undefined`.

**Consequences.** Re-pinned: test-play-spawn (field count 11, spawn, Earth/Sun elevations, new 60 m ring
check), test-play-world (spawn pin), kcc-default-trace `play`. The worker build cost per vertex rises about
1.9× on the play Moon only. S3 adds the darker mare albedo.
''')

plan = R / 'docs/T3-plan.md'
t = plan.read_text()
old = '- [ ] **S2** Wire `MOON_PARAMS.moon` into play.'
assert old in t
t = t.replace(old, '- [x] **S2** (session 148: spawn on mare, slope 0.01°, max 3.24° within 60 m; gate 16/16 on the real `MOON_PARAMS`; ADR-028 amendment 1) Wire `MOON_PARAMS.moon` into play.')
plan.write_text(t)

task = R / 'notes/task.md'
lines = task.read_text().split('\n')
i = next(k for k, l in enumerate(lines) if l.startswith('| T3 '))
lines[i] = ('| T3 better Moon (playable terrain) | `t3-better-moon` | READY — `docs/T3-plan.md` (7/7, session 147; Lead order = execute order) '
            '| IN PROGRESS | 3/5 (P0, S1, S2 done) · next: S3 darker mare albedo + crater-rim readability (check-play-b4…b9, test-play-perf) '
            '| — (this commit) | S2 play Moon: <5° 32.5%, ≥50° 4.0%, mare 33.0%, cost 1.92×; spawn on mare, 3.24° max within 60 m |')
task.write_text('\n'.join(lines))

st = R / 'notes/STATE.md'
t = st.read_text()
old = '**NEXT ACTION (session 147b, supersedes the text below):**'
assert old in t
new = ('**NEXT ACTION (session 148, supersedes the text below):** T3 is IN PROGRESS on `t3-better-moon` (NOT merged into `main`). '
       'P0, S1 and S2 are DONE. Play now uses the Moon profile: `MOON_PARAMS` carries the S1 candidate with basin 0 rotated under the '
       'spawn search base (ADR-028 amendment 1), and the spawn is on mare floor (slope 0.01°, max 3.24° within 60 m). '
       'test-moon-profile checks the real `MOON_PARAMS` (16/16, self-test 4/4). Next: T3 **S3** (plan §7). Give the mare a darker albedo from '
       'the basin mask (`moonMareMask`, as a vertex attribute or in the shader), then check that crater rims read well. Store screenshots from '
       'check-play-b4/b5/b6/b7/b9 under `docs/audit/evidence/T3/`, and run test-play-perf: frame time must not be worse than the T1 baseline. '
       'Fresh VMs need `npm ci` in `game/` and `npx playwright install chromium` for the check-play scripts. R5 waiver: only the Lead lifts it.\n\n'
       '**NEXT ACTION (session 147b, superseded):**')
t = t.replace(old, new, 1)
t = t.rstrip('\n') + '\n' + ('| 148 | 2026-10-28 | T3 S2: Moon profile wired into play (budget 50 OLU; VM v2 2vCPU/4GB) | '
     'Bootstrap: `t3-better-moon` (ba5ee3d) was the only branch ahead of `main`; no drift; `__github` connected by the Lead this session. '
     '`MOON_PARAMS` gains the S1 candidate (mountainAmp 27.6, detailAmp 5.6, `moon` profile); basin set rotated so basin 0 is on the spawn base. '
     'Spawn (0.844316, −0.128624, 0.520178) on mare, slope 0.01°, Earth 16.06°, Sun 44.41°. Gate 16/16 on real params, self-test 4/4; '
     're-pinned test-play-spawn (74/74), test-play-world (27/27), kcc-default-trace play (db41fe5a…, harness unchanged); flat test patches drop `moon`. '
     'Nine play Node tests, kcc-gate 13/13, tsc, build and e2e/play.spec.ts (2 passed) exit 0. ADR-028 amendment 1. | '
     'NEXT: S3. Flat synthetic test fields built by spreading MOON_PARAMS must also set `moon: undefined`. |\n')
st.write_text(t)

ch = R / 'notes/CHANGES.md'
ch.write_text(ch.read_text().rstrip('\n') + '''

- 2026-10-28 · T3 (S2, session 148) · `game/src/play/world/moonConfig.ts` · `MOON_PARAMS` gains the Moon profile (mountainAmp 230→27.6, detailAmp 16→5.6, `moon` basins rotated so basin 0 is under the spawn base, two crater layers) · why: plan §7 S2, playable flat mare ground at spawn · evidence `docs/audit/evidence/T3/S2/s2-verify.log` · source: ADR-028 amendment 1
- 2026-10-28 · T3 (S2, session 148) · `game/tools/test-moon-profile.mjs`, `test-play-spawn.mjs`, `test-play-world.mjs`, `test-kcc-default-trace.mjs`, `test-play-controller.mjs` · gate reads the real `MOON_PARAMS`; spawn/world/play-trace pins re-pinned (harness pins unchanged); spawn 60 m ring slope check added; flat patches set `moon: undefined` · why: S2 moves the play terrain on purpose · evidence `docs/audit/evidence/T3/S2/s2-verify.log` · source: ADR-028 amendment 1
''')
print('docs updated')