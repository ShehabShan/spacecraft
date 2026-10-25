#!/usr/bin/env python3
"""A1-U27 read-only extractor: index every `### A1-Uxx-n` finding in docs/audit/U*.md.

Usage (from repo root):
  python3 game/tools/audit/u27-findings-index.py --stats      # counts only
  python3 game/tools/audit/u27-findings-index.py --s01        # S0/S1 list (id, conf, cat, title)
  python3 game/tools/audit/u27-findings-index.py --md         # full markdown index table
Exit 0 on success; exit 3 if any finding lacks a parseable severity.
"""
import glob, re, sys, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
HDR = re.compile(r"^### (A1-U\d+[a-z]?-\d+)\s*[—-]\s*(.*)$")
SEV = re.compile(r"Severity:?\**:?\s*\**\s*(S[0-3])")
CONF = re.compile(r"Confidence:?\**:?\s*\**\s*([a-z]+)")
CAT = re.compile(r"Category:?\**:?\s*\**\s*(.+)$")


def parse():
    out = []
    for path in sorted(glob.glob(os.path.join(ROOT, "docs/audit/U*.md"))):
        rep = os.path.basename(path)
        lines = open(path, encoding="utf-8").read().splitlines()
        cur = None
        for ln in lines:
            m = HDR.match(ln)
            if m:
                cur = {"id": m.group(1), "title": m.group(2).strip(), "report": rep,
                       "sev": None, "sev_raw": "", "conf": None, "cat": None}
                out.append(cur)
                continue
            if cur is None:
                continue
            if ln.startswith("### ") or ln.startswith("## "):
                cur = None
                continue
            if cur["sev"] is None and "Severity" in ln:
                s = SEV.search(ln)
                if s:
                    cur["sev"] = s.group(1)
                    cur["sev_raw"] = ln.strip()
                c = CONF.search(ln)
                if c:
                    cur["conf"] = c.group(1)
            if cur["conf"] is None and "Confidence" in ln:
                c = CONF.search(ln)
                if c:
                    cur["conf"] = c.group(1)
            if cur["cat"] is None and "Category" in ln:
                c = CAT.search(ln)
                if c:
                    cur["cat"] = c.group(1).replace("*", "").strip()
    return out


def key(f):
    m = re.match(r"A1-U(\d+)[a-z]?-(\d+)", f["id"])
    return (int(m.group(1)), int(m.group(2)))


def main():
    fs = sorted(parse(), key=key)
    # Deduplicate identical ids (e.g. U05a reading notes repeating U05 ids).
    seen, uniq, dups = set(), [], []
    for f in fs:
        if f["id"] in seen:
            dups.append(f)
            continue
        seen.add(f["id"])
        uniq.append(f)
    bad = [f for f in uniq if f["sev"] is None]
    arg = sys.argv[1] if len(sys.argv) > 1 else "--stats"
    if arg == "--stats":
        from collections import Counter
        print("headers:", len(fs), "unique ids:", len(uniq), "duplicate ids:", len(dups))
        for d in dups:
            print("  dup:", d["id"], d["report"])
        print("severity:", dict(sorted(Counter(f["sev"] for f in uniq).items(), key=lambda x: str(x[0]))))
        print("confidence:", dict(Counter(f["conf"] for f in uniq)))
        print("no-severity:", [f["id"] + " " + f["report"] for f in bad])
    elif arg == "--s01":
        for f in uniq:
            if f["sev"] in ("S0", "S1"):
                print(f"{f['id']}\t{f['sev']}\t{f['conf']}\t{f['cat']}\t{f['title'][:150]}")
    elif arg == "--md":
        print("| ID | Sev | Conf | Category | Title | Report |")
        print("|---|---|---|---|---|---|")
        for f in uniq:
            t = f["title"].replace("|", "\\|")
            c = (f["cat"] or "").replace("|", "/")
            print(f"| {f['id']} | {f['sev']} | {f['conf']} | {c} | {t} | `{f['report']}` |")
    sys.exit(3 if bad else 0)


if __name__ == "__main__":
    main()