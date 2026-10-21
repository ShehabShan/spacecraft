// A1-U01 probe (read-only): run the UNEDITED m1f harness on the Vite dev
// server and read state at R2's Sun ground-truth readback through a CDP
// LOGPOINT. A logpoint is a breakpoint whose condition logs a value and returns
// false, so it never pauses and changes no game state. No harness edit is made.
// The probe logs:
//   - the Sun elevation above the geometric horizon at the R2 Sun pose (radial
//     up = normalize(drv), the same up the harness cull and the pose use);
//   - the Sun's angular radius θ and whether the Sun impostor is active;
//   - whole-frame readback stats: non-black pixels, Sun-coloured pixels and max
//     R. These separate "blank readback" from "scene rendered, Sun absent".
// Usage: node tools/audit/u01-m1f-probe.mjs   (exit 0 = probe line captured)
import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const PORT = 5179
const URL = `http://localhost:${PORT}/?page=m1f`
const dev = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  cwd: new globalThis.URL('../..', import.meta.url).pathname, detached: true, stdio: 'ignore',
})
const stopDev = () => { try { process.kill(-dev.pid, 'SIGTERM') } catch {} }

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try { const r = await fetch(`http://localhost:${PORT}/`); if (r.ok) return } catch {}
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('dev server did not start')
}

const COND = `(()=>{try{
const up=Math.hypot(drv.x,drv.y,drv.z)||1;
const dot=(sunGeom.dirX*drv.x+sunGeom.dirY*drv.y+sunGeom.dirZ*drv.z)/up;
const el=Math.asin(Math.max(-1,Math.min(1,dot)))*180/Math.PI;
let hit=0,nz=0,maxR=0;
for(let i=0;i<sunPx.length;i+=4){const r=sunPx[i];if(r>maxR)maxR=r;if(r|sunPx[i+1]|sunPx[i+2])nz++;if(r>165&&sunPx[i+1]>120)hit++;}
const sb=sky.bodies[0];
const o=core.getOrigin();
const px=(x,y)=>{const i=(y*1280+x)*4;return [sunPx[i],sunPx[i+1],sunPx[i+2],sunPx[i+3]]};
const rowMean=(y)=>{let r=0,g=0,b=0;for(let x=0;x<1280;x++){const i=(y*1280+x)*4;r+=sunPx[i];g+=sunPx[i+1];b+=sunPx[i+2]}return [r/1280|0,g/1280|0,b/1280|0]};
let hist={};for(let i=0;i<sunPx.length;i+=4*97){const k=sunPx[i]+','+sunPx[i+1]+','+sunPx[i+2];hist[k]=(hist[k]||0)+1}
const top=Object.entries(hist).sort((a,b)=>b[1]-a[1]).slice(0,6);
const cpx=Math.round(_proj.px),cpy=Math.round(_proj.py);
let clr=null;try{const c=new THREE.Color();gl.getClearColor(c);clr=[c.r,c.g,c.b,gl.getClearAlpha()]}catch(e){clr=String(e)}
console.log('U01PIX '+JSON.stringify({proj:{px:_proj.px,py:_proj.py},centre:px(Math.min(1279,Math.max(0,cpx)),Math.min(719,Math.max(0,cpy))),
row0:rowMean(0),row180:rowMean(180),row360:rowMean(360),row540:rowMean(540),row719:rowMean(719),topColours:top,clear:clr,
sunStageD:sb.stageD,sunHalfSize:sb.halfSize,skyCount:sky.mesh.count,skyVisible:sky.mesh.visible,skyLayers:sky.mesh.layers.mask,
camLocal:{x:sunPose.x,y:sunPose.y,z:sunPose.z},rig:RIG.stats}));
console.log('U01PROBE '+JSON.stringify({sunElevDeg:el,sunThetaDeg:sunGeom.theta*180/Math.PI,
cullBelowDeg:-(sunGeom.theta+0.03)*180/Math.PI,sunSlotId:sb.id,sunActive:sb.active,
hitFullFrame:hit,nonBlackPx:nz,maxR,drv:{x:drv.x,y:drv.y,z:drv.z},origin:{x:o.x,y:o.y,z:o.z},
rebases:core.stats.rebaseCount,liveWallS:script.live,hudFps:tele.fps}));
}catch(e){console.log('U01PROBE_ERR '+e)}})(), false`

let exitCode = 1
try {
  await waitUp()
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  const page = await browser.newPage()
  const cdp = await page.context().newCDPSession(page)
  let bpSet = false
  const lines = []
  let resolveDone
  const done = new Promise((r) => { resolveDone = r })
  page.on('console', (m) => {
    const t = m.text()
    if (t.startsWith("U01PROBE") || t.startsWith("U01PIX")) { console.log(t); lines.push(t) }
    if (/\[Milestone1F\] acceptance (PASSED|FAILED)/.test(t)) { console.log(t); resolveDone() }
  })
  page.on('pageerror', (e) => console.log('pageerror: ' + e.message))
  cdp.on('Debugger.scriptParsed', async (ev) => {
    if (bpSet || !ev.url.includes('Milestone1F_TestHarness.tsx')) return
    bpSet = true
    const { scriptSource } = await cdp.send('Debugger.getScriptSource', { scriptId: ev.scriptId })
    const src = scriptSource.split('\n')
    const a = src.findIndex((l) => l.includes('const sunPx = abRender('))
    let b = -1
    // Vite/esbuild reformats calls across lines, so match the call head only.
    // Logpoint just after projectDirectionInto, so _proj holds the Sun's projected centre.
    for (let i = a + 1; i < src.length; i++) if (src[i].trim().startsWith('const pxPerRad')) { b = i; break }
    console.log(`logpoint: sunPx line ${a}, target line ${b} (transformed source)`)
    try {
      const res = await cdp.send('Debugger.setBreakpoint', {
        location: { scriptId: ev.scriptId, lineNumber: b, columnNumber: 0 }, condition: COND,
      })
      console.log('logpoint set at ' + JSON.stringify(res.actualLocation))
    } catch (e) { console.log('logpoint failed: ' + e) }
  })
  await cdp.send('Debugger.enable')
  await page.goto(URL)
  await Promise.race([done, new Promise((r) => setTimeout(r, 360_000))])
  const details = await page.locator('.test-detail').allTextContents()
  const badges = await page.locator('.badge').allTextContents()
  console.log('badges ' + JSON.stringify(badges))
  console.log('R2 detail: ' + (details[1] ?? '(none)'))
  await browser.close()
  exitCode = lines.some((l) => l.startsWith('U01PROBE {')) ? 0 : 1
} catch (e) {
  console.log('probe error: ' + e)
} finally {
  stopDev()
}
process.exit(exitCode)