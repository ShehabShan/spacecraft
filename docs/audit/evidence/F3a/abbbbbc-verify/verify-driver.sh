#!/bin/sh
# Verification driver for 764f839 (runs sequentially so timing-sensitive tests don't contend for 2 vCPU).
export GIT_CONFIG_GLOBAL=/dev/null
L=/tmp/verify-driver.log
: > $L
echo "playwright install f3a start $(date +%T)" >> $L
(cd /workspace/wt-f3a/game && npx playwright install --with-deps chromium > /tmp/pw-f3a.log 2>&1); echo "pw-f3a EXIT=$?" >> $L
(cd /workspace/wt-main/game && npx playwright install --with-deps chromium > /tmp/pw-main.log 2>&1); echo "pw-main EXIT=$?" >> $L
for w in f3a main; do
  sed "s#^E=.*#E=/tmp/verify-$w#" /workspace/wt-f3a/game/tools/audit/f3abbbbbc-regress.sh > /tmp/regress-$w.sh
  echo "regress $w start $(date +%T)" >> $L
  (cd /workspace/wt-$w/game && sh /tmp/regress-$w.sh); echo "regress $w done $(date +%T)" >> $L
done
F=/tmp/flaky-f3a; mkdir -p $F; : > $F/exits.txt
cd /workspace/wt-f3a/game
for i in 1 2 3; do
  for t in controller spawn world frame; do
    node --expose-gc tools/test-play-$t.mjs > $F/play-$t-$i.log 2>&1; echo "test-play-$t run$i EXIT=$?" >> $F/exits.txt
  done
  node --expose-gc tools/test-alloc-gate.mjs --self-test > $F/alloc-gate-self-$i.log 2>&1; echo "alloc-gate --self-test run$i EXIT=$?" >> $F/exits.txt
done
M=/tmp/flaky-main; mkdir -p $M; : > $M/exits.txt
cd /workspace/wt-main/game
for i in 1 2 3; do
  node --expose-gc tools/test-play-controller.mjs > $M/play-controller-$i.log 2>&1; echo "test-play-controller run$i EXIT=$?" >> $M/exits.txt
done
echo "ALL DONE $(date +%T)" >> $L