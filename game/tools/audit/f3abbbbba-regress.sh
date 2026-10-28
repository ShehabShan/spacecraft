#!/bin/sh
# F3abbbbba regression runner: writes logs + exits.txt into ${EVID:-/tmp/evidence/F3a/abbbbba} (history: pre-t4:docs/audit/evidence/F3a/abbbbba) (run from game/).
# Scope: scaleLaw.ts is a new module imported by nothing yet, so only typecheck/build and the
# orbit-data gates that share its inputs are re-run; the full runner (f3abbba-regress.sh) is for the wiring step.
E=${EVID:-/tmp/evidence/F3a/abbbbba}; mkdir -p "$E"
mkdir -p $E
: > $E/exits.txt
run() { name="$1"; log="$2"; shift 2; "$@" > "$E/$log" 2>&1; echo "$name EXIT=$?" >> $E/exits.txt; }
run "scale-law run1" gate-1.log node tools/test-scale-law.mjs
run "scale-law run2" gate-2.log node tools/test-scale-law.mjs
run "scale-law --self-test run1" self-test-1.log node tools/test-scale-law.mjs --self-test
run "scale-law --self-test run2" self-test-2.log node tools/test-scale-law.mjs --self-test
run "scale-law --self-test --deliberate" deliberate.log node tools/test-scale-law.mjs --self-test --deliberate
run "law probe (ADR-015)" probe.log node tools/audit/f3abbbba-scale-laws.mjs
run "real-body-data" reg-real-body.log node tools/test-real-body-data.mjs
run "spin-law" reg-spin.log node tools/test-spin-law.mjs
run "rail-validation" reg-rail.log node tools/test-rail-validation.mjs
run "orbit-gate" reg-orbit.log node tools/test-orbit-gate.mjs
run "orbit-gate --self-test" reg-orbit-self.log node tools/test-orbit-gate.mjs --self-test
run "typecheck" typecheck.log npm run typecheck
run "build" build.log npm run build
echo DONE >> $E/exits.txt