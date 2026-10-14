#!/usr/bin/env node
/**
 * tools/extract.mjs — verbatim canon extraction (assembly brief §4).
 *
 * Usage: node tools/extract.mjs <1A|1B|1C|1D|1E|1F|1G>   (one milestone per run)
 *
 * Reads `Milestone/Milestone <X>.txt` at the repo root, finds every
 * `### N. `src/…`` heading, captures the NEXT fenced code block, and writes
 * it VERBATIM to game/<path>. The only document-level normalization is the
 * BOM strip + CRLF→LF pass (brief §4.1); block content is never retyped,
 * reformatted, or "improved".
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_BLOCKS = { '1A': 6, '1B': 5, '1C': 6, '1D': 4, '1E': 3, '1F': 4, '1G': 4 }

const GAME_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPO_ROOT = resolve(GAME_ROOT, '..')

const milestone = process.argv[2]
if (!Object.prototype.hasOwnProperty.call(EXPECTED_BLOCKS, milestone)) {
  console.error(`usage: node tools/extract.mjs <${Object.keys(EXPECTED_BLOCKS).join('|')}>`)
  process.exit(1)
}

const canonPath = join(REPO_ROOT, 'Milestone', `Milestone ${milestone}.txt`)
let text = readFileSync(canonPath, 'utf8')
if (text.charCodeAt(0) === 0xfeff) text = text.slice(1) // strip BOM
text = text.replace(/\r\n/g, '\n') // CRLF → LF
const lines = text.split('\n')

// §4.2 heading match. The OPTIONAL trailing parenthetical is Lead-approved:
// 1B's SimulationCore heading is `### 4. `…SimulationCore.ts` (updated for M1B)`.
// INVARIANT (Lead): the parenthetical branch may match exactly ONE heading in
// the whole canon — 1B's SimulationCore. Any other parenthetical match aborts
// the run BEFORE anything is written.
const HEADING = /^###\s+\d+\.\s+`([^`]+)`(?:\s+\(([^)]*)\))?\s*$/
const SRC_PATH = /^src\/.+\.(ts|tsx)$/
const DEFENSIVE_DISCARD = 'src/render/layeredCameras.ts'

function fail(msg) {
  console.error(`[extract ${milestone}] ABORT: ${msg}`)
  console.error(`[extract ${milestone}] NOTHING was written.`)
  process.exit(1)
}

/* ---- parse ---------------------------------------------------------------- */

const findings = []
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(HEADING)
  if (!m) continue
  const path = m[1]
  if (!SRC_PATH.test(path)) continue // not a code-file heading (analysis sections etc.)
  const viaParen = m[2] !== undefined
  let open = -1
  for (let j = i + 1; j < lines.length; j++) {
    if (/^```/.test(lines[j])) { open = j; break }
  }
  if (open === -1) fail(`heading at line ${i + 1} (${path}) has NO fenced block after it`)
  let close = -1
  for (let j = open + 1; j < lines.length; j++) {
    if (/^```/.test(lines[j])) { close = j; break }
  }
  if (close === -1) {
    fail(`unbalanced fences: block for ${path} opens at line ${open + 1} and never closes (truncation?)`)
  }
  const body = lines.slice(open + 1, close).join('\n') + '\n'
  findings.push({ headingLine: i + 1, path, viaParen, body, lineCount: close - open - 1 })
  i = close // resume after this block; block interiors are never heading-scanned
}

// 1G staged patch (brief §4.4): the fenced block after the "### 3.5 … Appendix"
// heading is NOT a standalone file — it is staged for hand-application.
let patch = null
if (milestone === '1G') {
  let idx = -1
  for (let j = 0; j < lines.length; j++) {
    const l = lines[j]
    if (l.startsWith('###') && l.includes('3.5') && l.includes('Appendix')) { idx = j; break }
  }
  if (idx === -1) fail('1G requires the §3.5 Appendix patch heading — not found')
  let open = -1
  for (let j = idx + 1; j < lines.length; j++) {
    if (/^```/.test(lines[j])) { open = j; break }
  }
  let close = -1
  if (open !== -1) {
    for (let j = open + 1; j < lines.length; j++) {
      if (/^```/.test(lines[j])) { close = j; break }
    }
  }
  if (open === -1 || close === -1) fail('unbalanced fences around the §3.5 Appendix patch block')
  patch = {
    headingLine: idx + 1,
    body: lines.slice(open + 1, close).join('\n') + '\n',
    lineCount: close - open - 1,
  }
}

/* ---- validate — EVERY check passes before anything is written -------------- */

const discarded = findings.filter((f) => f.path === DEFENSIVE_DISCARD)
const kept = findings.filter((f) => f.path !== DEFENSIVE_DISCARD)
if (discarded.length > 0) {
  console.log(`[extract ${milestone}] DEFENSIVE DISCARD (${discarded.length} layeredCameras.ts block(s), brief §4.4):`)
  for (const d of discarded) console.log(`  - line ${d.headingLine}, ${d.lineCount} lines`)
}

if (kept.length !== EXPECTED_BLOCKS[milestone]) {
  fail(
    `expected ${EXPECTED_BLOCKS[milestone]} code blocks, found ${kept.length}\n` +
    kept.map((f) => `  line ${f.headingLine}: ${f.path} (${f.lineCount} lines)`).join('\n'),
  )
}

const parenMatches = kept.filter((f) => f.viaParen)
for (const f of parenMatches) {
  console.log(`[extract ${milestone}] parenthetical-branch match: line ${f.headingLine} → ${f.path}`)
}
const parenAllowed =
  milestone === '1B' &&
  parenMatches.length === 1 &&
  parenMatches[0].path === 'src/core/simulation/SimulationCore.ts'
if (parenMatches.length > 0 && !parenAllowed) {
  fail(
    'parenthetical-branch invariant violated: the ONLY sanctioned match is 1B ' +
    `src/core/simulation/SimulationCore.ts (Lead approval); found ${parenMatches.length} in ${milestone}`,
  )
}

/* ---- write ---------------------------------------------------------------- */

console.log(`[extract ${milestone}] canon: ${canonPath}`)
for (const f of kept) {
  const target = join(GAME_ROOT, f.path)
  const overlay = existsSync(target)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, f.body)
  console.log(`  ${f.path} — ${f.lineCount} lines${overlay ? '  [OVERLAY: replaced previous extraction]' : ''}`)
}
if (patch) {
  const patchPath = join(GAME_ROOT, 'tools/patches/kcc-m1g-patch.txt')
  mkdirSync(dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, patch.body)
  console.log(`  tools/patches/kcc-m1g-patch.txt — ${patch.lineCount} lines  [STAGED: hand-apply during 1G per §4.4]`)
}
const totalLines = kept.reduce((s, f) => s + f.lineCount, 0)
console.log(`[extract ${milestone}] ${kept.length}${patch ? ' +1 patch' : ''} block(s) written verbatim (${totalLines} code lines).`)
