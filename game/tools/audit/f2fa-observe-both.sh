#!/bin/sh
# F2fa: observe the unedited m1f page at 3057899^ (c0ae8bf) and 3057899 with a
# long verdict wait (see f2fa-m1f-observe.mjs). Run from game/.
ROOT=$(cd .. && pwd); E=$ROOT/docs/audit/evidence/F2f/a
for c in c0ae8bf 3057899; do
  node tools/audit/f2fa-m1f-observe.mjs /workspace/wt-$c/game 4180 1200 > "$E/observe-$c.log" 2>&1
  echo "observe @$c EXIT=$?" >> "$E/exits.txt"
  grep -m1 '^verdict' "$E/observe-$c.log" | sed "s/^/  @$c /" >> "$E/exits.txt"
  grep -m1 '^badges' "$E/observe-$c.log" | sed "s/^/  @$c /" >> "$E/exits.txt"
done
echo OBSERVE-DONE >> "$E/exits.txt"