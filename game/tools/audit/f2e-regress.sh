#!/bin/sh
# F2e regression runner: writes logs + exits.txt into docs/audit/evidence/F2e/ (run from game/).
E=../docs/audit/evidence/F2e
mkdir -p $E
: > $E/exits.txt
run() { name="$1"; log="$2"; shift 2; "$@" > "$E/$log" 2>&1; echo "$name EXIT=$?" >> $E/exits.txt; }
run "kcc-gate run1" gate-1.log node tools/test-kcc-gate.mjs
run "kcc-gate --self-test run1" self-test-1.log node tools/test-kcc-gate.mjs --self-test
run "kcc-gate run2" gate-2.log node tools/test-kcc-gate.mjs
run "kcc-gate --self-test run2" self-test-2.log node tools/test-kcc-gate.mjs --self-test
run "kcc-gate --self-test --deliberate" deliberate.log node tools/test-kcc-gate.mjs --self-test --deliberate
run "flight-gate" reg-flight.log node tools/test-flight-gate.mjs
run "flight-gate --self-test" reg-flight-self.log node tools/test-flight-gate.mjs --self-test
run "seam-gate" reg-seam.log node tools/test-seam-gate.mjs
run "seam-gate --self-test" reg-seam-self.log node tools/test-seam-gate.mjs --self-test
run "precision-gate" reg-precision.log node tools/test-precision-gate.mjs
run "precision-gate --self-test" reg-precision-self.log node tools/test-precision-gate.mjs --self-test
run "orbit-gate" reg-orbit.log node tools/test-orbit-gate.mjs
run "orbit-gate --self-test" reg-orbit-self.log node tools/test-orbit-gate.mjs --self-test
run "alloc-loops --self-test" reg-alloc-loops-self.log node --expose-gc tools/test-alloc-loops.mjs --self-test
run "typecheck" typecheck.log npm run typecheck
run "build" build.log npm run build
run "e2e-plumbing" reg-e2e-plumbing.log node tools/test-e2e-plumbing.mjs --out /tmp/f2e-plumbing-$$
cp /tmp/f2e-plumbing-$$/summary.json $E/plumbing-summary.json 2>/dev/null
run "playwright m1e" reg-playwright-m1e.log npx playwright test e2e/m1e.spec.ts --reporter=line
run "playwright m1d" reg-playwright-m1d.log npx playwright test e2e/m1d.spec.ts --reporter=line
echo DONE >> $E/exits.txt