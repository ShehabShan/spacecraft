#!/bin/sh
# F3abbbbbb regression runner: writes logs + exits.txt into docs/audit/evidence/F3a/abbbbbb/ (run from game/).
E=../docs/audit/evidence/F3a/abbbbbb
mkdir -p $E
: > $E/exits.txt
run() { name="$1"; log="$2"; shift 2; "$@" > "$E/$log" 2>&1; echo "$name EXIT=$?" >> $E/exits.txt; }
run "spin-law run1" spin-gate-1.log node tools/test-spin-law.mjs
run "spin-law run2" spin-gate-2.log node tools/test-spin-law.mjs
run "spin-law --self-test" spin-self.log node tools/test-spin-law.mjs --self-test
run "spin-law --self-test --deliberate" spin-deliberate.log node tools/test-spin-law.mjs --self-test --deliberate
run "rail-validation run1" gate-1.log node tools/test-rail-validation.mjs
run "rail-validation run2" gate-2.log node tools/test-rail-validation.mjs
run "rail-validation --self-test run1" self-test-1.log node tools/test-rail-validation.mjs --self-test
run "rail-validation --self-test run2" self-test-2.log node tools/test-rail-validation.mjs --self-test
run "rail-validation --self-test --deliberate" deliberate.log node tools/test-rail-validation.mjs --self-test --deliberate
run "real-body-data" reg-real-body.log node tools/test-real-body-data.mjs
run "real-body-data --self-test" reg-real-body-self.log node tools/test-real-body-data.mjs --self-test
run "scale-law" reg-scale.log node tools/test-scale-law.mjs
run "scale-law --self-test" reg-scale-self.log node tools/test-scale-law.mjs --self-test
run "orbit-gate" reg-orbit.log node tools/test-orbit-gate.mjs
run "orbit-gate --self-test" reg-orbit-self.log node tools/test-orbit-gate.mjs --self-test
run "kcc-gate" reg-kcc.log node tools/test-kcc-gate.mjs
run "kcc-gate --self-test" reg-kcc-self.log node tools/test-kcc-gate.mjs --self-test
run "flight-gate" reg-flight.log node tools/test-flight-gate.mjs
run "flight-gate --self-test" reg-flight-self.log node tools/test-flight-gate.mjs --self-test
run "seam-gate" reg-seam.log node tools/test-seam-gate.mjs
run "seam-gate --self-test" reg-seam-self.log node tools/test-seam-gate.mjs --self-test
run "precision-gate" reg-precision.log node tools/test-precision-gate.mjs
run "precision-gate --self-test" reg-precision-self.log node tools/test-precision-gate.mjs --self-test
run "shape-probe" shape-probe.log node --expose-gc tools/audit/f3abbba-shape-probe.mjs
run "alloc-loops --self-test run1" reg-alloc-loops-self-1.log node --expose-gc tools/test-alloc-loops.mjs --self-test
run "alloc-loops --self-test run2" reg-alloc-loops-self-2.log node --expose-gc tools/test-alloc-loops.mjs --self-test
run "alloc-gate --self-test" reg-alloc-gate-self.log node --expose-gc tools/test-alloc-gate.mjs --self-test
for t in spawn world shell frame controller lod rig anim perf; do
  run "test-play-$t" reg-play-$t.log node --expose-gc tools/test-play-$t.mjs
done
run "typecheck" typecheck.log npm run typecheck
run "build" build.log npm run build
run "e2e-plumbing" reg-e2e-plumbing.log node tools/test-e2e-plumbing.mjs --out /tmp/f3abbbbbb-plumbing-$$
cp /tmp/f3abbbbbb-plumbing-$$/summary.json $E/plumbing-summary.json 2>/dev/null
run "playwright m1b" reg-playwright-m1b.log npx playwright test e2e/m1b.spec.ts --reporter=line
echo DONE >> $E/exits.txt