#!/bin/sh
# A1-U08 probe: does e2e/m1b.spec.ts FAIL on each injected defect?
# Runs the REAL spec + REAL playwright.config.ts against a scratch copy in
# $LAB (repo tree untouched). Exit code of each run recorded unpiped.
set -u
REPO_GAME=/workspace/spacecraft/game
LAB=${LAB:-/tmp/u08lab}
OUT=${OUT:-/tmp/u08out}
MUTS=${MUTS:-"baseline pageerror consoleerror timeout badgefail norows droprow typeerror"}
rm -rf "$LAB" "$OUT"; mkdir -p "$LAB" "$OUT"
(cd "$REPO_GAME" && tar --exclude=node_modules --exclude=dist --exclude=test-results -cf - .) | (cd "$LAB" && tar -xf -)
ln -s "$REPO_GAME/node_modules" "$LAB/node_modules"
H="$LAB/src/test/Milestone1B_TestHarness.tsx"
cp "$H" "$OUT/orig.tsx"
for m in $MUTS; do
  cp "$OUT/orig.tsx" "$H"
  node "$REPO_GAME/tools/audit/u08-spec-mutate.mjs" "$H" "$m" > "$OUT/$m.log" 2>&1 || { echo "MUTATE_FAIL" > "$OUT/$m.exit"; continue; }
  (cd "$LAB" && npx playwright test e2e/m1b.spec.ts --reporter=line >> "$OUT/$m.log" 2>&1)
  echo $? > "$OUT/$m.exit"
  echo "$m exit=$(cat "$OUT/$m.exit")" >> "$OUT/summary.txt"
done
echo DONE >> "$OUT/summary.txt"