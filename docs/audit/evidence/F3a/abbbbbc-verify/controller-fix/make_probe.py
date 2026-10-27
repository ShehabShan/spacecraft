import re
src = open("/workspace/wt-f3a/game/tools/test-play-controller.mjs").read()
old = "    gc(); const h0m = process.memoryUsage().heapUsed\n    for (let i = 0; i < 10000; i++) {"
assert src.count(old) == 1
loop = "{ ci.lookDX = 3; ci.lookDY = (i & 1) ? 2 : -2; r.cam.preStep(r.kcc, ci, r.ctrl); r.cam.poseInto(r.kcc, 1 / 60) }"
warm = f"    for (let i = 0; i < 2000; i++) {loop}\n"
# A: warm-up 2000 frames, then measure 10k (same threshold)
a = src.replace(old, warm + old)
open("/workspace/wt-f3a/game/tools/_probe-warm.mjs", "w").write(a)
# B: warm-up, measure 50k (leak scaling check: a real leak would be ~5x the 10k delta)
b = a.replace("for (let i = 0; i < 10000; i++) { ci.lookDX = 3", "for (let i = 0; i < 50000; i++) { ci.lookDX = 3")
assert b != a
open("/workspace/wt-f3a/game/tools/_probe-warm50k.mjs", "w").write(b)
# C: no warm-up, 50k (does the unwarmed delta scale?)
c = src.replace("for (let i = 0; i < 10000; i++) { ci.lookDX = 3", "for (let i = 0; i < 50000; i++) { ci.lookDX = 3")
open("/workspace/wt-f3a/game/tools/_probe-cold50k.mjs", "w").write(c)
print("probes written")