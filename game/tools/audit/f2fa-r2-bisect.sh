#!/bin/sh
# F2fa: bisect A1-U01-1 (m1f R2 regression). Runs the UNEDITED m1f e2e gate N
# times at 3057899^ (= c0ae8bf) and at 3057899, interleaved A,B,A,B so machine
# drift hits both sides alike. Each commit runs in its own git worktree with that
# commit's own spec, playwright config and harness; node_modules is shared via a
# symlink (package-lock.json is byte-identical at both commits and on main).
# Writes logs + exits.txt to docs/audit/evidence/F2f/a/. Run from game/.
# Usage: sh tools/audit/f2fa-r2-bisect.sh [N=2]
N=${1:-2}
ROOT=$(cd .. && pwd)
E=$ROOT/docs/audit/evidence/F2f/a
NM=$(pwd)/node_modules
mkdir -p "$E"; : > "$E/exits.txt"
for c in c0ae8bf 3057899; do
  W=/workspace/wt-$c
  [ -d "$W" ] || git worktree add -f "$W" $c
  [ -e "$W/game/node_modules" ] || ln -s "$NM" "$W/game/node_modules"
done
i=1
while [ $i -le $N ]; do
  for c in c0ae8bf 3057899; do
    L=$E/gate-$c-run$i.log
    (cd /workspace/wt-$c/game && npx playwright test m1f --reporter=line) > "$L" 2>&1
    echo "m1f gate @$c run$i EXIT=$?" >> "$E/exits.txt"
    grep -o 'badges: .*' "$L" | head -1 | sed "s/^/  @$c run$i /" >> "$E/exits.txt"
  done
  i=$((i+1))
done
echo DONE >> "$E/exits.txt"