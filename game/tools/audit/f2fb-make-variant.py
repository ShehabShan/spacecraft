#!/usr/bin/env python3
# F2fb (read-only on the real tree): build a scratch worktree at 3057899 with
# ONE hunk of the F-01..F-12 batch reverted to its c0ae8bf text, so R2 can be
# attributed hunk by hunk. Why exact-text replacement and not `git revert -p`:
# each variant must be reproducible from the repo alone and must fail loudly if
# the hunk text is not found (exit 3), never silently produce an unedited tree.
# Usage: python3 tools/audit/f2fb-make-variant.py <worktree-dir> <variant>
#   variants: F12sun (Sun suite pose only), F01 (sky observer +O only),
#             F07 (LIVE fixed-step accumulator only), NONE (unedited 3057899)
import subprocess, sys, pathlib

REPO = pathlib.Path(__file__).resolve().parents[3]
HARNESS = 'game/src/test/Milestone1F_TestHarness.tsx'

F12SUN_NEW = """    // (b) sun pixel ground truth: pose looking at the sun, read back (F-12: drvLocal = drv - O, radial up)
    const oS = core.getOrigin();
    const sLx = drv.x - oS.x, sLy = drv.y - oS.y, sLz = drv.z - oS.z;
    const sUpL = Math.hypot(drv.x, drv.y, drv.z) || 1;
    lookAtQuatInto(sLx, sLy, sLz,
      sLx + sunGeom.dirX, sLy + sunGeom.dirY, sLz + sunGeom.dirZ,
      drv.x / sUpL, drv.y / sUpL, drv.z / sUpL, drvQuat);
    const sunPose = { x: sLx, y: sLy, z: sLz, qx: drvQuat.x, qy: drvQuat.y, qz: drvQuat.z, qw: drvQuat.w };
"""
F12SUN_OLD = """    // (b) sun pixel ground truth: pose looking at the sun, read back
    lookAtQuatInto(drv.x, drv.y, drv.z,
      drv.x + sunGeom.dirX, drv.y + sunGeom.dirY, drv.z + sunGeom.dirZ,
      0, 1, 0, drvQuat);
    const sunPose = { x: drv.x, y: drv.y, z: drv.z, qx: drvQuat.x, qy: drvQuat.y, qz: drvQuat.z, qw: drvQuat.w };
"""
F01_NEW = """  const obsX = moonState!.absPos.x + o.x + px;    // f64: local bubble + rail offset (+O: F-01)
  const obsY = moonState!.absPos.y + o.y + py;
  const obsZ = moonState!.absPos.z + o.z + pz;
"""
F01_OLD = """  const obsX = moonState!.absPos.x + px;    // f64: local bubble + rail offset
  const obsY = moonState!.absPos.y + py;
  const obsZ = moonState!.absPos.z + pz;
"""
F07_NEW = """      if (script.phase === 'LIVE') {
        liveAcc += dt;
        const step = 1 / 60, ts = 6;
        while (liveAcc >= step) {
          kcc.update((step * ts), 5);
          core.advance(step * ts);
          updateProbes(step * ts);
          liveAcc -= step;
        }
        // Cap accumulator to avoid spiral on long stalls (also bounds wall-time stretch below 10 fps)
        if (liveAcc > 0.1) liveAcc = 0.1;
      } else {
        kcc.update(dt, 5);
        core.advance(dt);
        updateProbes(dt);
      }
"""
F07_OLD = """      const ts = script.phase === 'LIVE' ? 6 : 1;
      kcc.update(dt * ts, 5);
      core.advance(dt * ts);
      updateProbes(dt * ts);
"""
# Sub-variants of F12sun: revert ONE of the hunk's two changes (up vector or
# pose position), so the R2 cause is pinned to a single expression.
F12SUN_UPONLY = F12SUN_NEW.replace(
    "      drv.x / sUpL, drv.y / sUpL, drv.z / sUpL, drvQuat);\n",
    "      0, 1, 0, drvQuat); void sUpL;\n")
F12SUN_POSONLY = F12SUN_NEW.replace(
    "    lookAtQuatInto(sLx, sLy, sLz,\n      sLx + sunGeom.dirX, sLy + sunGeom.dirY, sLz + sunGeom.dirZ,\n",
    "    lookAtQuatInto(drv.x, drv.y, drv.z,\n      drv.x + sunGeom.dirX, drv.y + sunGeom.dirY, drv.z + sunGeom.dirZ,\n").replace(
    "    const sunPose = { x: sLx, y: sLy, z: sLz,",
    "    void sLx; void sLy; void sLz;\n    const sunPose = { x: drv.x, y: drv.y, z: drv.z,")
assert F12SUN_UPONLY != F12SUN_NEW and F12SUN_POSONLY.count('drv.x, drv.y, drv.z') == 2
VARIANTS = {'F12sun': [(F12SUN_NEW, F12SUN_OLD)], 'F01': [(F01_NEW, F01_OLD)],
            'F12sunUp': [(F12SUN_NEW, F12SUN_UPONLY)], 'F12sunPos': [(F12SUN_NEW, F12SUN_POSONLY)],
            'F07': [(F07_NEW, F07_OLD)], 'NONE': []}

def main():
    if len(sys.argv) != 3 or sys.argv[2] not in VARIANTS:
        print(__doc__ or 'usage: <worktree-dir> <variant>'); sys.exit(2)
    wt, var = pathlib.Path(sys.argv[1]), sys.argv[2]
    if not wt.exists():
        subprocess.run(['git', '-C', str(REPO), 'worktree', 'add', '--detach', str(wt), '3057899'], check=True)
    head = subprocess.run(['git', '-C', str(wt), 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True, check=True).stdout.strip()
    if head != '3057899':
        print(f'worktree HEAD is {head}, expected 3057899'); sys.exit(3)
    f = wt / HARNESS
    src = f.read_text()
    for new, old in VARIANTS[var]:
        if src.count(new) != 1:
            print(f'{var}: hunk text found {src.count(new)} times (expected 1)'); sys.exit(3)
        src = src.replace(new, old)
    f.write_text(src)
    print(f'variant {var} written at {wt} (HEAD {head})')

main()