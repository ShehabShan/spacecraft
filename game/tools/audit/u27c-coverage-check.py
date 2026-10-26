#!/usr/bin/env python3
"""A1-U27c coverage checker (read-only audit tool).

Checks docs/audit/U27c-fix-tasks.md against the S0/S1 list printed by
u27-findings-index.py --s01:
  1. every S0/S1 finding maps to exactly one target, and no unknown IDs appear;
  2. every target is a task listed in §2 or 'T2';
  3. every task is sized at one session;
  4. every dependency is a task listed EARLIER in §2 (dependency order).
--self-test drops one S0/S1 ID from the coverage table and must FAIL (exit 1).
Run from the repo root. Exit 0 = all checks pass.
"""
import re, subprocess, sys

DOC = "docs/audit/U27c-fix-tasks.md"
self_test = "--self-test" in sys.argv

out = subprocess.run([sys.executable, "game/tools/audit/u27-findings-index.py", "--s01"],
                     capture_output=True, text=True)
if out.returncode != 0:
    print("index script failed", out.returncode); sys.exit(2)
s01 = [l.split("\t")[0] for l in out.stdout.splitlines() if l.startswith("A1-")]

text = open(DOC, encoding="utf-8").read()
sec2 = text.split("## 2. Task list")[1].split("## 3.")[0]
sec4 = text.split("## 4. Coverage")[1].split("## 5.")[0]

tasks, fails = [], []
for line in sec2.splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) < 6 or not re.fullmatch(r"F\d+[a-z]", cells[0]):
        continue
    tid, deps, sessions = cells[0], cells[3], cells[4]
    if sessions != "1":
        fails.append(f"{tid}: sessions={sessions!r}, must be 1")
    for d in [x.strip() for x in deps.split(",") if x.strip() not in ("", "—")]:
        if d not in tasks:
            fails.append(f"{tid}: dependency {d} not listed earlier")
    if tid in tasks:
        fails.append(f"{tid}: duplicate task")
    tasks.append(tid)

cover = {}
for line in sec4.splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) == 3 and cells[0].startswith("A1-"):
        cover.setdefault(cells[0], []).append(cells[2])
if self_test:
    cover.pop(s01[0], None)

for fid in s01:
    t = cover.get(fid, [])
    if len(t) != 1:
        fails.append(f"{fid}: mapped {len(t)} times")
    elif t[0] not in tasks and t[0] != "T2":
        fails.append(f"{fid}: unknown target {t[0]}")
for fid in cover:
    if fid not in s01:
        fails.append(f"{fid}: not an S0/S1 finding")

print(f"S0/S1 findings: {len(s01)}; covered: {sum(1 for f in s01 if len(cover.get(f, [])) == 1)}; "
      f"tasks: {len(tasks)}; self-test: {self_test}")
for f in fails:
    print("FAIL", f)
print("RESULT", "FAIL" if fails else "PASS")
sys.exit(1 if fails else 0)