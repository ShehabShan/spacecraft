// F3abbba blocker probe: does a boot-time {x,y,z} object with DOUBLE fields (spinLaw axis)
// turn the shared {x,y,z} hidden class to Double representation, so the instrument's
// integer {x,y,z} calibration control boxes 3 HeapNumbers (+48 B)? Each mode runs in a
// FRESH process (shape state is per isolate). Run: node --expose-gc tools/audit/f3abbb-shape-probe.mjs
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'
const here = path.dirname(fileURLToPath(import.meta.url))
const lib = pathToFileURL(path.resolve(here, '..', 'alloc-lib.mjs')).href
const mode = process.argv[2]
if (!mode) {
  let bad = 0
  for (const m of ['fresh', 'pollute-int', 'pollute-double']) {
    const r = spawnSync(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), m], { encoding: 'utf8' })
    process.stdout.write(r.stdout); if (r.status !== 0) { bad++; process.stdout.write(r.stderr) }
  }
  process.exit(bad ? 1 : 0)
}
const keep = []
if (mode === 'pollute-int') keep.push({ x: 1, y: 2, z: 3 })
if (mode.startsWith('pollute-double')) keep.push({ x: 0.3977771559319, y: -0.0, z: 0.9174820620691 })
const { createInstrument } = await import(lib)
const I = await createInstrument({ bundleUrl: lib, modOf: () => '?' })
const cal = await I.calibrate()
console.log(`${mode}: cal.obj3=${cal.obj3.toFixed(1)} B/iter ok=${cal.ok}`)