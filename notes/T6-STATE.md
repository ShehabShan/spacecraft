# T6 STATE — look-and-feel overhaul, parallel tracks (T6 line only)

This file is the STATE.md for the T6 line. T6 sessions read it right after `AGENT_BRIEF.md`
and update it instead of `notes/STATE.md`, `notes/task.md` and `notes/CHANGES.md`, which
stay with T5 until T5 merges into `main`. Each track keeps its own notes in
notes/T6-<track>.md (created by the track's first session).

**NEXT ACTION (T6 planning, branch `t6-look-and-feel`):** continue docs/T6-plan.md at its FIRST
UNCHECKED BOX (sections 1–4 done, session 160). Plan only, no build; commit and push a few
sections per commit (brief §4, §12). At READY, STOP for the Lead's order. The plan must contain:
1. The six tracks below, each with its goal, steps sized to one 50-OLU session, and gates.
2. File ownership: which files and directories each track may edit. Shared files such as
   `game/src/play/frame/playFrame.ts` and the scene setup get named hooks or registration points,
   built in a first "T6-core" step on `t6-look-and-feel`, so tracks add files instead of
   editing the same lines.
3. The integration procedure (below) and per-track verification (matrix M from
   `88c51b8:docs/evidence/T5/S1a.txt` plus the track's own gates).
4. Dependencies. Audio and Character can build before T5 merges. Light, Surface, Objects
   and World build after T5 is merged into `main` and `main` is merged into
   `t6-look-and-feel`, because T5 changes the radius, terrain and LOD.
5. Asset policy: CC0 only, with the source URL recorded per file (Lead, 2026-10-28). Keep
   the repo-size budget from ADR-030 in mind; large binaries need a plan.
6. The open questions in `docs/T5-T6-ideas.md` §5 (Earth size, faster travel, Sun height),
   asked in plain language with their defaults.

## Lead directive and rulings, 2026-10-29 (session 159, bot 964bf319)

- T6 covers animation, sound, textures and environmental objects for the Moon and the
  astronaut: houses, boulders, large trees inspired by *Moon Fairy Tale*, small lakes or
  ponds, and other world-building. The Lead hands the design to the sessions ("You are an
  expert, I let you handle what to add").
- Goal: the awe and atmosphere of *Elden Ring*, *Red Dead Redemption 2*, *Crimson Desert*
  and *Where Winds Meet*, and one of the best, most immersive browser games. Awe comes
  mostly from light, scale, sky, silence followed by sound, and far landmarks that can be
  reached. Our strengths are the black sky, the huge Earth and long shadows at a low sun.
- Ruling 1 (style): keep the open Moon stark and real (neutral grey, sharp black shadows,
  as ruled 2026-10-28). Put the fairy-tale warmth in a few set pieces: a lunar outpost with
  houses, a greenhouse dome with large trees and a pond, and a glowing crystal cave.
- Ruling 2 (process): T6 runs as parallel tracks on separate branches and bots, with the
  guardrails below. This amends brief §4 "one branch per task" for T6 (brief §10).
- Ruling 3 (timing): plan T6 now, in parallel with T5. Audio and Character start once the
  plan is READY; the other tracks start after T5 merges.
- The Lead can run 5 to 10 sessions at once, each limited to 50 OLU.

## Tracks (each its own branch, cut from `t6-look-and-feel` when the plan is READY)

| Track | Branch | Work |
|---|---|---|
| Light | t6-light | colour, black shadows, sun shadow maps, low sun, lunar BRDF, bloom and exposure |
| Surface | t6-surface | close-up regolith textures, footprints, ballistic dust, ray craters |
| Character | t6-character | suit model and materials, visor reflection, low-g lope, jump and landing |
| Objects | t6-objects | boulder fields, glowing crystals, crashed lander, KCC obstacle support |
| Audio | t6-audio | helmet breathing, muffled footsteps, radio chatter, ambient score |
| World | t6-world | set pieces: outpost houses, greenhouse dome with trees and pond, crystal cave, landmarks |

Inputs: `docs/T5-T6-ideas.md` §2–§6 and the T6 definition in `notes/task.md`.

## Guardrails (parallel work)

- A track session edits only its own files (plan's file-ownership table), its own notes
  file notes/T6-<track>.md, and its plan boxes. It never edits `notes/STATE.md`,
  `notes/task.md` or `notes/CHANGES.md`; the integration session folds track notes into
  them.
- Only the Objects track may edit the physics core (KCC obstacles), with an ADR and the
  kcc-default-trace gate. ADR numbers per track come from ranges set in the plan, so
  parallel sessions never pick the same number.
- Integration: track branches merge into `t6-look-and-feel` (never into `main` directly).
  An integration session merges a finished track, resolves conflicts, runs the full matrix
  and pushes. `main` gets T6 only when T6 is DONE (brief §13, no-mess safeguard 5).
- Each session's starter prompt names its branch. That beats the "several branches ahead
  of main → ask" check, since parallel branches are expected.
- When `main` moves (T5 merge), the integration session merges `main` into
  `t6-look-and-feel`; tracks then merge `t6-look-and-feel` into their branch.

## T6 SESSION LOG

| Session | Date | Unit | Done | Next |
|---|---|---|---|---|
| 159 | 2026-10-29 | T6 directive recorded (bot 964bf319, while on T5 S1ba) | Cut `t6-look-and-feel` from `main`; this file; brief §10 amendment; LEDGER entry. No plan yet. | T6 planning session on `t6-look-and-feel` (NEXT ACTION above). |