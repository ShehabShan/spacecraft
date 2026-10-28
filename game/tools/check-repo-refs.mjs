#!/usr/bin/env node
// check-repo-refs — dangling repo-path gate (T4 S0, ADR-030).
// Scans tracked text files for repo-path tokens (docs/, notes/, game/, Milestone/, Design_specs/,
// incl. ../-relative forms) and fails on any that resolves to nothing. A path written as
// `pre-t4:<path>` or `<hash>:<path>` is a history pointer and is accepted (git show pre-t4:<path>).
// WHY: T4 deletes ~8 MB of history; this lands first (§13 safeguard 3) so no live reference dangles.
// Usage (from game/): node tools/check-repo-refs.mjs [--self-test] [--summary] [--max N] [prefix ...]
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const EXT = /\.(md|ts|tsx|mjs|js|sh|json|py)$/
// WHY: the lockfile has no repo paths; this file's self-test fixtures are fake paths on purpose.
const SKIP = new Set(['game/package-lock.json', 'game/tools/check-repo-refs.mjs'])
// WHY: the lookbehind drops URL/absolute-path tails (…/x/docs/…) and words like "mydocs/".
const TOKEN = /(?<![A-Za-z0-9_\-.\/])((?:\.\.?\/)*)(docs|notes|game|Milestone|Design_specs)\/([A-Za-z0-9_.\-\/]*)/g
const PLACEHOLDER = /^[<*{$\[]/ // char right after the token: `docs/<task>-plan.md`, `docs/audit/*.md`
const POINTER = /(?:pre-t4|\b[0-9a-f]{7,40}):$/

export function makeExists(files, useFs) {
  const fileSet = new Set(files), dirSet = new Set(), byDir = new Map()
  for (const f of files) {
    const k = f.lastIndexOf('/')
    const d = k < 0 ? '' : f.slice(0, k)
    if (!byDir.has(d)) byDir.set(d, [])
    byDir.get(d).push(f.slice(k + 1))
    for (let i = f.indexOf('/'); i >= 0; i = f.indexOf('/', i + 1)) dirSet.add(f.slice(0, i))
  }
  return (p) => {
    if (fileSet.has(p) || dirSet.has(p)) return true
    if (useFs && existsSync(join(ROOT, p))) return true
    // WHY: a token may name a file by its prefix: a space ends it (`Milestone/Milestone 1A.txt`),
    // and docs cite stems (`docs/decisions/ADR-015`, `game/e2e/m1a` = m1a*.spec.ts).
    const k = p.lastIndexOf('/'), base = p.slice(k + 1)
    return base.length > 0 && (byDir.get(p.slice(0, k)) || []).some((b) => b.startsWith(base))
  }
}

export function scanText(text, exists) {
  const out = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    TOKEN.lastIndex = 0
    let m
    while ((m = TOKEN.exec(line))) {
      const after = line[m.index + m[0].length] ?? ''
      if (PLACEHOLDER.test(after)) continue
      if (POINTER.test(line.slice(Math.max(0, m.index - 41), m.index))) continue
      const p = (m[2] + '/' + m[3]).replace(/[.,:;)]+$/, '').replace(/\/+$/, '')
      if (!exists(p)) out.push({ line: i + 1, path: p })
    }
  }
  return out
}

function selfTest() {
  const ex = makeExists(['docs/a.md', 'notes/STATE.md', 'Milestone/Milestone 1A.txt', 'game/src/x.ts'], false)
  const cases = [
    ['existing file passes', 'see docs/a.md.', 0],
    ['missing file fails', 'see docs/missing.md', 1],
    ['pre-t4 pointer to missing passes', 'see pre-t4:docs/missing.md', 0],
    ['hash pointer to missing passes', 'see 7018e56:docs/missing.md', 0],
    ['placeholder <..> ignored', 'plan file docs/<Tn>-plan.md', 0],
    ['glob ignored', 'all of docs/audit/*.md', 0],
    ['existing dir passes', 'under game/src/ and notes/', 0],
    ['relative existing passes', "readFileSync('../docs/a.md')", 0],
    ['relative missing fails', "readFileSync('../../../docs/gone.log')", 1],
    ['space-name prefix passes', '`Milestone/Milestone 1A.txt`', 0],
    ['stem prefix passes', 'see docs/a and game/src/x', 0],
    ['missing dir entry fails', 'Milestone/Gone.txt and Design_specs/x.txt', 2],
    ['URL tail ignored', 'https://github.com/o/r/blob/main/docs/missing.md', 0],
    ['word prefix ignored', 'mydocs/missing and abc/notes/zz', 0],
    ['line number reported', 'ok\nok\nnotes/gone.md', 1, 3],
  ]
  let fail = 0
  for (const [name, text, want, wantLine] of cases) {
    const got = scanText(text, ex)
    const ok = got.length === want && (wantLine === undefined || got[0]?.line === wantLine)
    if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: dangling ${got.length} (want ${want})`)
  }
  console.log(`self-test ${cases.length - fail}/${cases.length}`)
  process.exit(fail ? 1 : 0)
}

function main() {
  const args = process.argv.slice(2)
  if (args.includes('--self-test')) return selfTest()
  const summary = args.includes('--summary')
  const mi = args.indexOf('--max')
  const max = mi >= 0 ? Number(args[mi + 1]) : 200
  const prefixes = args.filter((a, i) => !a.startsWith('--') && !(mi >= 0 && i === mi + 1))
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean)
  const exists = makeExists(files, true)
  const scan = files.filter((f) => EXT.test(f) && !SKIP.has(f) && (!prefixes.length || prefixes.some((p) => f.startsWith(p))))
  let total = 0, printed = 0
  const perFile = [], perArea = new Map()
  for (const f of scan) {
    const d = scanText(readFileSync(join(ROOT, f), 'utf8'), exists)
    if (!d.length) continue
    total += d.length
    perFile.push([f, d])
    const area = f.split('/').slice(0, f.startsWith('docs/audit/') ? 3 : 2).join('/')
    perArea.set(area, (perArea.get(area) || 0) + d.length)
  }
  if (summary) for (const [a, n] of [...perArea].sort((x, y) => y[1] - x[1])) console.log(`${String(n).padStart(6)} ${a}`)
  else for (const [f, d] of perFile) for (const x of d) if (printed++ < max) console.log(`${f}:${x.line}: ${x.path}`)
  console.log(`scanned ${scan.length} files; dangling ${total} in ${perFile.length} files`)
  process.exit(total ? 1 : 0)
}

main()