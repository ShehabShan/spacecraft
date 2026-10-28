// T1 B11 (plan §9.6 / §13, risk K8): default-path integrity trace for the KCC.
// WHY: B11 adds opt-in coyoteTime/airControl to astronautKCC.ts. With both at 0
// (or absent) the KCC must be BIT-identical to the pre-B11 core. This tool drives a
// deterministic scripted session (walk / sprint / crouch / turn / jumps, incl.
// walk-offs) on the harness config (spin on, M1C test planet) and the play config
// (Moon field, fields forced to 0), hashes every tick's f64 state, and compares
// with hashes pinned from the UNEDITED core (commit 9c4ee90). Re-pin only with an
// ADR that deliberately changes the default path.
// Usage: node tools/test-kcc-default-trace.mjs [--print]
import { build } from 'esbuild'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const game = path.resolve(here, '..')
const out = path.join(game, 'node_modules', '.cache', 'test-kcc-default-trace.bundle.mjs')
await build({
  stdin: {
    contents: `export * as K from './core/physics/astronautKCC'; export * as TF from './core/terrain/terrainField';
      export * as MC from './play/world/moonConfig';`,
    resolveDir: path.join(game, 'src'), loader: 'ts',
  },
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  external: ['three', 'react', 'react-dom', '@react-three/fiber', 'zustand'],
})
const M = await import(pathToFileURL(out).href)

// Pinned from the unedited core (9c4ee90). sha256 over every tick's state.
// WHY (T3 S2, ADR-028 amendment): `play` re-pinned because MOON_PARAMS gained the
// Moon profile (new terrain under the same KCC); the KCC code is unchanged and the
// harness pin (TEST_PLANET) did not move. Pre-S2 play pin: 8c39022f6dc3e8be…74ae6.
const PIN = {
  harness: 'caebaab87639085742f543e46e8274f03323e44cb402cbe451e4415a1450b64a',
  play: 'db41fe5aabd7e21e7d4c42f2dac57c7b53a998a6dd7eb4de042caef9f40ead1f',
}

function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296) }

function run(cfg, starts, ticks, seed) {
  const h = createHash('sha256'), rnd = lcg(seed), buf = new Float64Array(19)
  let walkOffs = 0, jumps = 0, landings = 0
  for (let s = 0; s < starts; s++) {
    const k = new M.K.AstronautKCC(cfg)
    const a = rnd() * Math.PI * 2, z = rnd() * 2 - 1, q = Math.sqrt(1 - z * z)
    k.teleportSurface(q * Math.cos(a), z, q * Math.sin(a))
    let forceJump = 0
    for (let t = 0; t < ticks; t++) {
      if (t % 40 === 0) {
        k.input.moveF = rnd() * 2 - 1; k.input.moveR = rnd() * 2 - 1
        k.input.sprint = rnd() < 0.6; k.input.crouch = rnd() < 0.08
        k.input.turnRate = rnd() < 0.3 ? (rnd() - 0.5) * 2 : 0
      }
      // WHY: hold jump for 8 ticks after every walk-off, so an opened coyote window
      // is always probed (the old core ignores airborne presses: F14 clears them).
      const rj = rnd() < 1 / 90, jump = forceJump > 0 || rj
      if (forceJump > 0) forceJump--
      k.input.jump = jump
      const g0 = k.grounded
      k.integrateTick(1 / 60)
      if (g0 && !k.grounded) { if (jump && !k.input.crouch) jumps++; else { walkOffs++; forceJump = 8 } }
      const p = k.absPos, v = k.absVel, l = k.pLocal, u = k.up, f = k.fwd
      buf[0] = p.x; buf[1] = p.y; buf[2] = p.z; buf[3] = v.x; buf[4] = v.y; buf[5] = v.z
      buf[6] = l.x; buf[7] = l.y; buf[8] = l.z; buf[9] = u.x; buf[10] = u.y; buf[11] = u.z
      buf[12] = f.x; buf[13] = f.y; buf[14] = f.z; buf[15] = k.grounded ? 1 : 0
      buf[16] = k.mode === 'SURFACE' ? 0 : k.mode === 'ZERO-G' ? 1 : 2
      buf[17] = k.integrity.landings; buf[18] = k.integrity.lastLandingRelSpeed
      h.update(new Uint8Array(buf.buffer))
    }
    landings += k.integrity.landings
  }
  return { hash: h.digest('hex'), walkOffs, jumps, landings }
}

const fails = []
M.TF.initTerrainField(M.TF.TEST_PLANET)
const H = run({ ...M.K.EARTHSCALE_ASTRONAUT }, 96, 1800, 7)
const H0 = run({ ...M.K.EARTHSCALE_ASTRONAUT, coyoteTime: 0, airControl: 0 }, 96, 1800, 7)
M.TF.initTerrainField(M.MC.MOON_PARAMS)
const P0 = run({ ...M.MC.MOON_ASTRONAUT, coyoteTime: 0, airControl: 0 }, 96, 1800, 11)
console.log(`[kcc-default-trace] harness ${H.hash} (walk-offs ${H.walkOffs}, jumps ${H.jumps}, landings ${H.landings})`)
console.log(`[kcc-default-trace] harness fields=0 ${H0.hash}`)
console.log(`[kcc-default-trace] play fields=0 ${P0.hash} (walk-offs ${P0.walkOffs}, jumps ${P0.jumps}, landings ${P0.landings})`)
if (process.argv.includes('--print')) process.exit(0)
if (H.hash !== PIN.harness) fails.push(`harness trace ${H.hash} != pin ${PIN.harness}`)
if (H0.hash !== PIN.harness) fails.push(`harness fields=0 trace ${H0.hash} != pin ${PIN.harness}`)
if (P0.hash !== PIN.play) fails.push(`play fields=0 trace ${P0.hash} != pin ${PIN.play}`)
if (H.walkOffs + P0.walkOffs === 0) fails.push('no walk-off exercised (the coyote site is not covered)')
if (fails.length) { console.error('kcc-default-trace FAIL'); for (const f of fails) console.error('  - ' + f); process.exit(1) }
console.log('kcc-default-trace PASS')