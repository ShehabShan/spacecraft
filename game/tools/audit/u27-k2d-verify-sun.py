"""Validate logged diagnostic controls, not the complete m1f gate.
Run from repo root: python3 game/tools/audit/u27-k2d-verify-sun.py
"""
import json
import sys
from pathlib import Path

path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sun-controls.log")  # T4 S2: extract with git show pre-t4:docs/audit/U27-k2d-evidence/sun-controls.log
text = path.read_text()
rows = {r["name"]: r for r in (
    json.loads(line.removeprefix("U27CONTROL "))
    for line in text.splitlines() if line.startswith("U27CONTROL ")
)}
base = rows["repeat-baseline"]
no_world = rows["without-terrain-and-satellites"]
no_actor = rows["without-astronaut"]
sky = rows["sky-only"]
hidden = rows["sky-only-impostors-hidden"]
checks = {
    "five complete controls, no logpoint error": len(rows) == 5 and "U01PROBE_ERR" not in text,
    "baseline and no-astronaut both miss Sun": base["count"] == no_actor["count"] == 0,
    "hide spinGroup restores footprint coverage": 0.85 < no_world["coverage"] < 1.15,
    "sky-only agrees with hide spinGroup": sky["count"] == no_world["count"],
    "hidden impostors reduce footprint below bound": hidden["coverage"] < 0.85,
    "centroid remains outside complete R2 tolerance": sky["offset"] >= 1.5,
}
print(json.dumps(checks, indent=2))
print(f"CHECKS={sum(checks.values())}/{len(checks)}")
raise SystemExit(0 if all(checks.values()) else 1)