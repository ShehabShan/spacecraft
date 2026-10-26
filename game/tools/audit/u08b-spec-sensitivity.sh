#!/bin/sh
# A1-U08b probe: does each e2e/m1X.spec.ts FAIL on each injected defect?
# Parameterised successor of u08-spec-sensitivity.sh. Runs the REAL spec +
# REAL playwright.config.ts against a scratch copy in $LAB (repo untouched).
# PLAN="m1a:baseline,badgefail ..."  Exit code of each run recorded unpiped.
set -u
REPO_GAME=/workspace/spacecraft/game
LAB=${LAB:-/tmp/u08blab}
OUT=${OUT:-/tmp/u08bout}
PLAN=${PLAN:-"m1a:baseline,badgefail,badgeerr,pageerror,nolog m1c:baseline,badgefail,badgeerr,pageerror m1d:baseline,badgefail,badgeerr,pageerror m1e:baseline,badgefail,badgeerr,pageerror m1f:baseline,badgefail,badgeerr,pageerror"}
rm -rf "$LAB" "$OUT"; mkdir -p "$LAB" "$OUT"
(cd "$REPO_GAME" && tar --exclude=node_modules --exclude=dist --exclude=test-results -cf - .) | (cd "$LAB" && tar -xf -)
ln -s "$REPO_GAME/node_modules" "$LAB/node_modules"
for entry in $PLAN; do
  spec=${entry%%:*}; muts=$(echo "${entry#*:}" | tr ',' ' ')
  L=$(echo "$spec" | cut -c3 | tr 'a-f' 'A-F')
  H="$LAB/src/test/Milestone1${L}_TestHarness.tsx"
  cp "$H" "$OUT/$spec.orig.tsx"
  for m in $muts; do
    cp "$OUT/$spec.orig.tsx" "$H"
    log="$OUT/$spec.$m.log"
    node "$REPO_GAME/tools/audit/u08b-spec-mutate.mjs" "$H" "$m" > "$log" 2>&1 || { echo "$spec $m MUTATE_FAIL" >> "$OUT/summary.txt"; continue; }
    t0=$(date +%s)
    (cd "$LAB" && npx playwright test "e2e/$spec.spec.ts" --reporter=line >> "$log" 2>&1)
    rc=$?
    echo "$spec $m exit=$rc wall=$(( $(date +%s) - t0 ))s" >> "$OUT/summary.txt"
  done
  cp "$OUT/$spec.orig.tsx" "$H"
done
echo DONE >> "$OUT/summary.txt"