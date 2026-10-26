# F2b evidence (session 111, 2026-10-26)

Run from `game/` on the PromptQL VM v2 (2 vCPU / 4 GB), Node from `npm ci`.

| Log | Command | Exit |
|---|---|---|
| gate-1.log, gate-2.log | `node tools/test-precision-gate.mjs` | 0, 0 (7/7) |
| self-test-1.log, self-test-2.log | `node tools/test-precision-gate.mjs --self-test` | 0, 0 (17/17) |
| deliberate.log | `node tools/test-precision-gate.mjs --self-test --deliberate` | 1 (17/18; identity mutant correctly not red) |
| regression.txt + reg-*.log | the NEXT ACTION regression set | see regression.txt |

Baseline values: 9 rebases at ticks 31…277 with Δ (1024, 0, 0); 21 off-axis shifts, all equal to the oracle; far-origin ship local error 0.0305 mm at 1.496e11 m; worst `advance()` 0.001 ms.
Mutants the old m1a rows passed and this gate rejects: thresholds 900/1023/1025, lattices 128/300/512, f32-before-subtract, stale static locals, a 300 ms stall per rebase, three 1 s freezes, and a 40 ms hitch on the frame after a rebase.
