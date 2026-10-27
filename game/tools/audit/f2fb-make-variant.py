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
# F2fbb diagnostic (unedited 3057899 + extra A/B renders AFTER the R2 verdict is
# computed, so R2's own numbers are untouched). Why: to find WHAT hides the Sun
# at the render-local pose: re-render the same pose with the near/mid cameras'
# layer masks zeroed (far/background pass only), then the absolute pose, and
# report the Sun elevation and which near/mid meshes are visible.
DIAG_IMPORT_NEW = "import { executePasses as RIGexecutePasses } from '../render/MultiCameraRig';\n"
DIAG_IMPORT_OLD = DIAG_IMPORT_NEW + "import { rigCamNear as DGnear, rigCamMid as DGmid } from '../render/MultiCameraRig';\n"
DIAG_ANCHOR = "`from θ = ${(sunGeom.theta * 180 / Math.PI).toFixed(3)}°.`,\n    };\n"
DIAG_CODE = DIAG_ANCHOR + """    {
      const dgCount = (buf: Uint8Array): number => {
        let n = 0;
        for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
          const i = (y * AB_W + x) * 4; if (buf[i] > 165 && buf[i + 1] > 120) n++;
        }
        return n;
      };
      const dgLocal = () => { RIG.poseOverride = sunPose; applyRenderState(sunPose.x, sunPose.y, sunPose.z, sunPose.qx, sunPose.qy, sunPose.qz, sunPose.qw); };
      const nm = DGnear.layers.mask, mm = DGmid.layers.mask;
      const dgBase = dgCount(abRender(gl, scene, dgLocal));
      const sunActive = sky.bodies[0].active;
      const upn = Math.hypot(drv.x, drv.y, drv.z) || 1;
      const sunEl = elevationAngle(sunGeom.dirX, sunGeom.dirY, sunGeom.dirZ, drv.x / upn, drv.y / upn, drv.z / upn) * 180 / Math.PI;
      const nearVis: string[] = [], midVis: string[] = [];
      scene.traverse((ob) => {
        if (!(ob as THREE.Mesh).isMesh || !ob.visible) return;
        const nmx = `${ob.name || ob.type}@${ob.position.x.toFixed(0)},${ob.position.y.toFixed(0)},${ob.position.z.toFixed(0)}`;
        if (DGnear.layers.test(ob.layers)) nearVis.push(nmx);
        if (DGmid.layers.test(ob.layers)) midVis.push(nmx);
      });
      DGnear.layers.mask = 0; DGmid.layers.mask = 0;
      const dgFarOnly = dgCount(abRender(gl, scene, dgLocal));
      DGnear.layers.mask = 0; DGmid.layers.mask = mm;
      const dgNoNear = dgCount(abRender(gl, scene, dgLocal));
      DGnear.layers.mask = nm; DGmid.layers.mask = 0;
      const dgNoMid = dgCount(abRender(gl, scene, dgLocal));
      DGnear.layers.mask = nm; DGmid.layers.mask = mm;
      astroMesh.visible = false;
      const dgNoAstro = dgCount(abRender(gl, scene, dgLocal));
      astroMesh.visible = true; spinGroup.visible = false;
      const dgNoSpin = dgCount(abRender(gl, scene, dgLocal));
      spinGroup.visible = true;
      console.log(`[F2fbb-diag2] noAstro=${dgNoAstro} noSpinGroup(terrain)=${dgNoSpin}`);
      const dgAbs = dgCount(abRender(gl, scene, () => {
        RIG.poseOverride = { x: drv.x, y: drv.y, z: drv.z, qx: sunPose.qx, qy: sunPose.qy, qz: sunPose.qz, qw: sunPose.qw };
        applyRenderState(drv.x, drv.y, drv.z, sunPose.qx, sunPose.qy, sunPose.qz, sunPose.qw);
      }));
      dgLocal(); RIG.poseOverride = null;
      const oD = core.getOrigin();
      console.log(`[F2fbb-diag] O=(${oD.x.toFixed(1)},${oD.y.toFixed(1)},${oD.z.toFixed(1)}) |drv|=${upn.toFixed(1)} local=(${sunPose.x.toFixed(1)},${sunPose.y.toFixed(1)},${sunPose.z.toFixed(1)}) ` +
        `sunEl=${sunEl.toFixed(3)}deg sunActive=${sunActive} theta=${sunGeom.theta.toExponential(3)} proj=(${_proj.px.toFixed(1)},${_proj.py.toFixed(1)}) expectR=${expectR.toFixed(1)} ` +
        `counts: R2=${count} base=${dgBase} farOnly=${dgFarOnly} noNear=${dgNoNear} noMid=${dgNoMid} absPose=${dgAbs} ` +
        `masks near=${nm} mid=${mm} | nearVis=[${nearVis.join(' ')}] | midVis=[${midVis.join(' ')}]`);
    }
"""
VARIANTS = {'F12sun': [(F12SUN_NEW, F12SUN_OLD)], 'F01': [(F01_NEW, F01_OLD)],
            'F12sunUp': [(F12SUN_NEW, F12SUN_UPONLY)], 'F12sunPos': [(F12SUN_NEW, F12SUN_POSONLY)],
            'F07': [(F07_NEW, F07_OLD)], 'NONE': [],
            'F12diag': [(DIAG_IMPORT_NEW, DIAG_IMPORT_OLD), (DIAG_ANCHOR, DIAG_CODE)]}

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