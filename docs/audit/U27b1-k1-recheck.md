# A1-U27b1 — K1 handoff re-check

- Scope: K1 only: A1-U03-1 and A1-U21-3. Other clusters remain unchecked.
- Base: `341ba65`, `a1-engine-audit`; session 85, 2026-10-25.
- Read-only audit: no production implementation or ratified threshold changes.

## Expected behaviour written before inspecting implementation

For an otherwise visible, in-frustum body on either approach or departure, a
representation transition must never disable both its mesh and its impostor.
A gate claiming to test that invariant must evaluate actual draw eligibility,
including state, rather than just two complementary alpha numbers.
An engine-wide handoff claim requires a shared controller used by production
callers; a demonstration confined to a harness is not that feature.

Check both directions, exact switching boundaries, and history dependence.
Distinguish logical draw eligibility from GPU pixel coverage; a Node probe
cannot claim to have observed the rendered image. Preserve the original reports
and record any corrected wording in the consolidated review.

## Verdict

| Finding | Disposition | Severity / confidence | Evidence |
|---|---|---|---|
| A1-U03-1 | **Re-confirmed, with scope qualifications below** | S0 / confirmed: a blind gate hides a real missing representation | Real harness update/apply functions omit the inbound probe in a 5,647.934 m interval while the actual R3(a) block reports zero holes. |
| A1-U21-3 | **Re-confirmed** | S1 / confirmed: specified engine feature absent | Handoff functions and callers confined to the harness; real play `applySkyState` supplies alpha 1 on all 72 sampled calls and has no Earth/Moon impostor slots. |

**2 of 55 S0/S1 findings reviewed; 53 remain.** No severity, ID, or original
finding count changed. Ancillary output from the old probes is not sign-off on
K2 or other clusters.

## Model provenance

The platform's actual `llm_usage` records identify this review's model as
`gpt-6-astra` (OpenAI); its selected display label is **GPT-6 Astra**.
For the accessible previous SOLARIS bot
`37629ae1-8ba8-420b-97b7-d99046b85d86`, the same ledger returned 41
`claude-opus-5-5` calls and 5 `claude-sonnet-5-5` calls. This is evidence of
a different model from that prior work, not proof of the model used for each
historical audit unit. The repository's U03/U21/session records do not name their
models, and the accessible usage records do not attribute most U01–U26 units.
**The plan's historical-majority model condition therefore remains unverified.**
Do not close U27b's cross-model requirement solely on this report; retain that
qualification until provenance is supplied or otherwise established. No model
identity was guessed from writing style.

## Sources inspected

- Original U03 and U21 reports and their complete repro scripts, including
  `u21-tsx-loader.mjs`.
- Full `game/src/play/world/skyState.ts`, `game/src/render/SkyImpostorPool.ts`,
  and `game/src/render/MultiCameraRig.tsx`.
- Harness handoff block 604–645; `applyRenderState` 810–914 and
  `assignObject` 915–920; R3(a/b) 1163–1187; targeted references throughout.
- Targeted `Milestone/*1F*` lines 70–110: its “no hole” proof omits the mesh-state
  condition even though the immediately preceding pseudocode includes it.
- All `game/src` pool instantiation, `setBody`, and handoff callers:
  [`U27b1-evidence/callers.log`](U27b1-evidence/callers.log).

Citations below are against `341ba65`; the protected source remains identical
to the audit baseline `256d77d`.

## Independent reproduction

`game/tools/audit/u27b1-k1-recheck.mjs` extracts the harness's declarations using
the TypeScript AST, transpiles and executes its actual `updateProbes`,
`applyRenderState`, and `assignObject`. It uses the real `SkyImpostorPool`,
Three objects, and layer assignment function. It does **not** reconstruct the
visibility predicates by hand.

The fixture places the camera at the bubble origin, points probes down −Z, and
omits catalog bodies, terrain and satellite work. The oracle is independent of
the defective gate: **a mesh eligible for a pass OR an active impostor instance**.
The real pool's instance count is checked against both probe active flags.
This tests draw-state composition, not a full scene, browser, or pixel capture.

Observed results (`U27b1-evidence/independent.log`, exit 0, 11/11 checks):

- Inbound, 300–200 km in 100 m steps: **57 missing samples**, d = 220,000…225,600 m.
  Outbound, same interval: **0** missing samples.
- Smoothstep's 0.01 cutoff is at **225,647.93449356014 m**. Upper boundary
  bracketed at ±1 mm; exactly 220,000 m still has no representation, while
  219,999.999 m restores the mesh (`d < SOFT`, not `<=`).
- At dA = 222,000 m, both probe meshes are hidden and the real pool has
  **zero instances** (dB = dA + 2,500 m).
- At the same d = 223,000 m, departure history has a mesh; arrival history
  does not. Thus this is a state-dependent hole, not just a bad fade value.
- Actual R3(a) block, source-extracted: **0 holes, 0 doubles, 21 flips**,
  max slope **0.0001359879789631857** — all its acceptance terms pass.
- In-memory sensitivity control: removing only the state conjunction from mesh
  eligibility makes the missing-sample count **0** on descent. This is an
  oracle control, **not** a production fix or proof of a correct cross-fade.
- Real production `applySkyState`, eight distances × nine catalog slots:
  **72 calls, all alpha = 1**, no Earth/Moon slot; Earth stays assigned as a mesh.

### Exact code evidence

- `Milestone1F_TestHarness.tsx:604–645`: state switches at >240 km / <220 km,
  independently of fade 225–236 km.
- `:843–846,851–854`: impostor active only when its alpha > 0.01.
- `:875–889`: mesh requires state AND alpha > 0.01, otherwise layer mask = 0.
- `:1174–1176,1183–1184,1515`: unit/live hole tests inspect complementary
  alphas, not actual mesh visibility or state.
- `SkyImpostorPool.ts:249–251,290`: only active slots contribute instances.
- `skyState.ts:24–35,82–83,100–101`: fixed catalog impostors, alpha 1,
  separate Earth mesh. `moonWorld.ts:73,125–126` constructs the pool and mesh.
- `callers.log`: only harness functions implement the handoff; production has
  no caller of those functions.

## Qualifications to the original wording

1. “Renders nothing” means **neither representation of the affected probe**,
   not the whole scene. It is not a demonstrated disappearance in today's
   playable Moon scene: play does not use this controller.
2. The 5,647.934 m interval is in the harness's **moon-centred sweep parameter
   dA/dB**, not necessarily the camera-to-body distance when the driver is offset.
3. The defect is also in Milestone 1F's stated no-hole argument, not merely a
   divergence of code from a correct spec.
4. Partial impostor alpha shrinks its disk radius (`SkyImpostorPool.ts:285`);
   describing it simply as “dims” is inaccurate. Silhouette/fade quality is
   A1-U21-4 and is not newly certified here.
5. Rerunning U03 reads the **old U01 pixel log**. It does not produce a fresh
   screenshot or validate the complete R3/browser suite. No browser suite was
   run in this unit. U21's control exit likewise is not an all-claims-pass result.
6. K1 groups related work, not a demonstrated single sufficient patch: moving a
   controller into production alone does not correct its logic, fade shader,
   or all body-slot coverage.

## Checked, no issue in this scope

- Smoothstep is monotone and crosses the expected 0.01 cutoff.
- Outbound draw eligibility has no holes in the tested range.
- The real pool removes inactive instances correctly; stale instances do not
  rescue the missing inbound probes.
- The oracle distinguishes the shipped defect from its coverage control.
- No evidence requires changing the numerical hysteresis thresholds to prove
  or isolate this defect.
- `npm run typecheck` and `npm run build` exit 0.

## Audit decision record — coverage oracle before controller integration (draft)

**Context:** A1 is read-only; K1's proposed production controller must not simply
copy the defective harness state machine. Existing U26 render ADR drafts remain
proposals, not approvals.

**Options:** trust complementary alphas; count composed draw eligibility; or
require a full GPU suite for every logical state test.

**Decision:** use composed draw eligibility with boundary/history controls as the
independent logical gate, then add isolated pixel/silhouette verification in the
future fix task before replacing an existing gate. Do not promote the in-memory
control to production in A1.

**Why:** alpha complement cannot detect a state-disabled mesh; logical omission
is decisively testable without renderer/scene noise. It does not establish
pixel continuity.

**Consequences:** the fix task must separately verify visual continuity and wire
a shared controller into production. Any ratified-band change needs its own
implementation ADR. This draft stays under `docs/audit/` because
`docs/decisions/` is outside A1's write allowlist.

## Commands and observed unpiped exits

Commands run from `game/` unless noted. Logs are under `U27b1-evidence/`.
The shell captured `$?` immediately after each command; no pipeline hid its exit.

| Command | Exit | Observed result |
|---|---:|---|
| `npm ci` | 0 | 93 packages; npm reported 1 moderate and 1 high vulnerability; dependencies not changed. |
| `node tools/audit/u03-r3r4r5-validity.mjs` | 0 | 22/22 checks; K1 interval reproduced. Other rows not re-reviewed. |
| `node --expose-gc tools/audit/u21-camera-sky.mjs` | 0 | 4/4 controls. Runtime GC count 41 vs historical 40; not a new allocation verdict. |
| `node tools/audit/u27b1-k1-recheck.mjs` — first attempt | 1 | Existing U21 loader could not resolve extensionless `.tsx` from skyState; preserved `independent-attempt1.log`. |
| Same command, new audit-only TS/TSX loader | 0 | 11/11; existing loader and production code unchanged. |
| `npm run typecheck` | 0 | No diagnostics. |
| `npm run build` | 0 | 112 modules; existing >500 kB chunk warning. |
| Root: `rg -n 'setBody\(|new SkyImpostorPool|HANDOFF_D|handoffNextState|handoffFade' game/src` | 0 | Caller inventory in `callers.log`. |
| Root: `git diff --exit-code 256d77d -- game/src game/e2e game/playwright.config.ts Milestone Design_specs` | 0 | Empty protected-source diff. |

## Handoff

Next: U27b2, K2a (six zero-GC/heap gate findings), with the same independent
recheck discipline. Then the remaining K2 subclusters and K3–K9; split as needed.
Resolve historical model provenance before calling the overall U27b
“second-model review” complete. U27c/fix planning and the Lead gate remain ahead.