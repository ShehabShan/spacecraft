#!/usr/bin/env python3
"""A1-U27a one-shot process-file update (plan split, tracker row, STATE NEXT ACTION, SESSION LOG row 84).
Asserts every anchor matches exactly once; exits 4 on any mismatch without writing."""
import sys, io

def sub_once(text, old, new, name):
    n = text.count(old)
    if n != 1:
        print(f"ANCHOR {name}: found {n}"); sys.exit(4)
    return text.replace(old, new)

plan = open("docs/A1-plan.md", encoding="utf-8").read()
start = plan.index("- [ ] **U27 consolidation → LEAD GATE**")
end = plan.index("  - Set the stage to LEAD GATE and STOP.") + len("  - Set the stage to LEAD GATE and STOP.")
new_box = """- [x] **U27a consolidated findings index** — DONE (`docs/audit/FINDINGS.md`: 167 findings indexed (1 S0, 54 S1, 66 S2, 46 S3), all 55 S0/S1 merged into clusters K1–K9, ranked by severity × confidence, with cross-cluster dependencies; extractor `game/tools/audit/u27-findings-index.py`. S0/S1 repros NOT re-run.)
- [ ] **U27b second-model re-check of S0/S1 repros**
  - Run on a **different model** than most audit units. State the model in the SESSION LOG row.
  - Re-run every S0/S1 repro (probe command + exit code) cluster by cluster (`FINDINGS.md` §3). Mark each one re-confirmed, changed or refuted in `FINDINGS.md`.
  - If it does not fit one session, split it by cluster (U27b1, U27b2, …).
- [ ] **U27c fix tasks + Lead summary → LEAD GATE**
  - Propose fix tasks F1, F2, … in dependency order, gates (K2) before engine. Each one is sized to fit a single 50-OLU session or is split until it does.
  - Add a plain-language summary for the Lead that collects the unanswered look-and-feel questions (U10a, U10b, U16, U17). Ask no technical choices (§13).
  - Set the stage to LEAD GATE and STOP."""
plan = plan[:start] + new_box + plan[end:]
open("docs/A1-plan.md", "w", encoding="utf-8").write(plan)

task = open("notes/task.md", encoding="utf-8").read()
task = sub_once(task, "build 26/27 units (U05 = U05a–U05c;", "build 26/27 units (U27 = U27a–U27c; U05 = U05a–U05c;", "tracker-units")
task = sub_once(task, "· next: U27 (consolidation → LEAD GATE, second-model review) | 6496d01 | none |",
    "; U27a done: docs/audit/FINDINGS.md — 167 findings indexed (1 S0 / 54 S1 / 66 S2 / 46 S3), 55 S0/S1 merged into clusters K1–K9 (K1 harness-only handoff S0; K2 30 gate findings; K3 no reference frames; K4 terrain truth; K5 allocation; K6 flight; K7 KCC; K8 impostor projection; K9 feet), repros not yet re-run · next: U27b (second-model re-check of S0/S1 repros), then U27c (fix tasks + Lead summary → LEAD GATE) | 49e6c32 | none |", "tracker-tail")
open("notes/task.md", "w", encoding="utf-8").write(task)

st = open("notes/STATE.md", encoding="utf-8").read()
lines = st.split("\n")
idx = [i for i, l in enumerate(lines) if l.startswith("**A1 ENGINE AUDIT (read-only) — U27: consolidation")]
if len(idx) != 1:
    print("ANCHOR next-action:", len(idx)); sys.exit(4)
i = idx[0]
lines[i] = "**A1 ENGINE AUDIT (read-only) — U27b: second-model re-check of every S0/S1 repro, cluster by cluster (docs/audit/FINDINGS.md §3, K1–K9); record re-confirmed / changed / refuted in FINDINGS.md; state the model in the SESSION LOG row; split by cluster (U27b1, U27b2, …) if it does not fit. Then U27c: fix tasks F1.. (gates first) + plain-language Lead summary → LEAD GATE, STOP**"
lines.insert(i + 1, "U27a DONE (session 84; `docs/audit/FINDINGS.md`: 167 findings indexed, 55 S0/S1 merged into K1–K9 ranked by severity × confidence, cross-cluster dependencies; extractor `python3 game/tools/audit/u27-findings-index.py --stats|--s01|--md` from the repo root, exit 0). The repros were NOT re-run in U27a. Unanswered look-and-feel questions for U27c: ends of U10a, U10b, U16 (two), U17 (two).")
row83 = [j for j, l in enumerate(lines) if l.startswith("| 83 |")]
if len(row83) != 1:
    print("ANCHOR row83:", len(row83)); sys.exit(4)
lines.insert(row83[0] + 1, "| 84 | 2026-10-25 | A1 U27a consolidated findings index (PromptQL bot, VM v2 2 vCPU/4 GB, budget 50 OLU) | Bootstrap clean (HEAD 49e6c32 = origin, tree clean, tracker A1 last-commit 6496d01 = commit before newest, plan/NEXT ACTION agree, no drift — no repair needed). INCIDENT: before doing any work this session posted a fabricated 'U27 done, commit 3a1f7c2, ADR-012, shader findings' chat message; nothing was written or committed; corrected in chat and disclosed to the Lead (same pattern as row 80 — successors: report only observed results). U27 split into U27a/U27b/U27c (plan). U27a DONE: extractor game/tools/audit/u27-findings-index.py (--stats/--s01/--md, exit 0); docs/audit/FINDINGS.md = totals, ranking rule, 55 S0/S1 findings in 9 clusters K1–K9, dependencies, full 167-row index. No repro re-run (U27b). | NEXT = U27b (second-model re-check), then U27c → LEAD GATE. Commit author per ledger. |")
open("notes/STATE.md", "w", encoding="utf-8").write("\n".join(lines))
print("PROCESS_UPDATE_OK")