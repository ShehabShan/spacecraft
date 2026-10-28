// F1a (ADR-001): regression gate for the e2e acceptance plumbing.
// Runs the REAL spec files (copied byte-for-byte into a scratch lab) against
// deterministic browser fixtures and requires: the clean fixture passes in all
// contract specs, and every defect fixture is rejected AT ITS INTENDED ASSERTION.
// Derived from the A1 probe game/tools/audit/u27b3a-k2b-recheck.mjs (9-case
// matrix) plus one new case (resource404) for the error class F1a removed.
//
// Run from game/:
//   node tools/test-e2e-plumbing.mjs --out <NEW dir>                 → exit 0 expected
//   node tools/test-e2e-plumbing.mjs --specs-from <rev> --out <NEW dir>
//     mutant control: specs (and gate.ts if present) taken from git <rev>;
//     the pre-F1a specs (6ce1d08) must make this exit 1.
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const self = fileURLToPath(import.meta.url);
const game = resolve(dirname(self), '..');
// WHY: expected row counts are fixed here (TEST_ORDER lengths of each page),
// not read from the specs under test. F2f close-out (ADR-026): the shipped m1f
// spec is archived; the rebuilt m1f gates on the runAcceptanceGate contract
// (R1, R2, R5) replace it. R3/R4 pin known-red vectors with their own
// assertions, so they are not contract specs and are not in this matrix.
const specs = {
  m1a: { page: 'm1a', tag: 'Milestone1A', rows: 5 },
  m1b: { page: 'm1b', tag: 'Milestone1B', rows: 5 },
  m1c: { page: 'm1c', tag: 'Milestone1C', rows: 4 },
  m1d: { page: 'm1d', tag: 'Milestone1D', rows: 5 },
  m1e: { page: 'm1e', tag: 'Milestone1E', rows: 6 },
  'm1f-r1': { page: 'm1fR1', tag: 'M1fR1Gate', rows: 2 },
  'm1f-r2': { page: 'm1fR2', tag: 'M1fR2Gate', rows: 3 },
  'm1f-r5': { page: 'm1fR5', tag: 'M1fR5Gate', rows: 2 },
};
const counts = Object.fromEntries(Object.entries(specs).map(([k, v]) => [k, v.rows]));
const byPage = Object.fromEntries(Object.entries(specs).map(([k, v]) => [v.page, k]));
// case → assertion label that must reject it (null = must pass).
const intended = {
  baseline: null,
  failbadge: 'no FAIL badge may remain',
  failedverdict: 'acceptance console line',
  zerorows: 'badge rows scraped',
  pageerror: 'no page or console error',
  consoleerror: 'no page or console error',
  resource404: 'no page or console error',
  placeholders: 'every badge is exactly PASS',
  missingrow: 'badge row count',
  errbadge: 'every badge is exactly PASS',
};
const cases = Object.keys(intended);
const sha = (b) => createHash('sha256').update(b).digest('hex');

function fixture(spec, mode) {
  let badges = Array(counts[spec]).fill('PASS');
  if (mode === 'failbadge') badges[0] = 'FAIL';
  if (mode === 'zerorows') badges = [];
  if (mode === 'placeholders') badges.fill('·····');
  if (mode === 'missingrow') badges.pop();
  if (mode === 'errbadge') badges.fill('ERR');
  const tag = specs[spec].tag;
  // Errors are raised BEFORE the verdict line (no timing race with the gate).
  const injection =
    mode === 'pageerror' ? `<script>throw new Error('F1a pageerror')</script>` :
    mode === 'consoleerror' ? `<script>console.error('F1a consoleerror')</script>` :
    mode === 'resource404' ? `<img src="/f1a-missing.png" onerror="window.imgFailed=true">` : '';
  const ready = mode === 'resource404' ? 'window.imgFailed===true' : 'true';
  return `<!doctype html><meta charset="UTF-8"><link rel="icon" href="data:,"><title>F1a fixture only</title>
${badges.map((t) => `<span class="badge">${t}</span>`).join('\n')}
${injection}
<script>(function wait(){ if (!(${ready})) return setTimeout(wait, 10); setTimeout(() => {
  console.log('[${tag}] acceptance ${mode === 'failedverdict' ? 'FAILED' : 'PASSED'}');
  window.fixtureDone = true;
}, 50); })();</script>`;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[2] === '--serve') {
  const server = createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/f1a-missing.png') { res.statusCode = 404; res.end('not found'); return; }
    const spec = byPage[url.searchParams.get('page')];
    const mode = req.headers['x-audit-case'];
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (!counts[spec] || !cases.includes(mode)) { res.end('fixture server'); return; }
    res.end(fixture(spec, mode));
  });
  server.listen(0, '127.0.0.1', () => console.log(server.address().port));
} else {
  const outArg = arg('--out');
  assert(outArg, 'usage: --out <NEW directory> [--specs-from <git rev>]');
  const rev = arg('--specs-from');
  const out = resolve(outArg);
  mkdirSync(dirname(out), { recursive: true });
  mkdirSync(out); // Refuse to overwrite earlier evidence.
  const lab = mkdtempSync(join(tmpdir(), 'f1a-e2e-'));
  mkdirSync(join(lab, 'e2e'));
  symlinkSync(join(game, 'node_modules'), join(lab, 'node_modules'), 'dir');
  const files = [...Object.keys(counts).map((s) => `${s}.spec.ts`), 'gate.ts'];
  const hashes = {};
  for (const f of files) {
    let buf;
    if (rev) {
      const r = spawnSync('git', ['show', `${rev}:game/e2e/${f}`], { cwd: game });
      if (r.status !== 0) continue; // gate.ts does not exist before F1a
      buf = r.stdout;
    } else {
      if (!existsSync(join(game, 'e2e', f))) continue;
      buf = readFileSync(join(game, 'e2e', f));
    }
    writeFileSync(join(lab, 'e2e', f), buf);
    hashes[f] = sha(buf);
  }
  const server = spawn(process.execPath, [self, '--serve'], { stdio: ['ignore', 'pipe', 'inherit'] });
  let browser;
  let failures = 0;
  try {
    const port = await new Promise((yes, no) => {
      server.once('error', no);
      server.once('exit', (code) => no(Error(`fixture server exited ${code}`)));
      server.stdout.once('data', (b) => yes(Number(b.toString().trim())));
    });
    const baseURL = `http://127.0.0.1:${port}`;
    const config = {
      testDir: './e2e', timeout: 30000, workers: 1, retries: 0,
      outputDir: join(lab, 'results'),
      use: { channel: 'chrome', headless: true, baseURL },
      projects: cases.map((name) => ({ name, use: { extraHTTPHeaders: { 'x-audit-case': name } } })),
    };
    writeFileSync(join(lab, 'playwright.config.cjs'), `module.exports = ${JSON.stringify(config, null, 2)};\n`);
    writeFileSync(join(out, 'fixture-config.json'), JSON.stringify({ config, rev: rev ?? 'working tree', hashes }, null, 2) + '\n');

    // Independent observer: proves each fixture really is clean/defective as
    // named, using the browser directly (no spec code involved).
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const observations = [];
    for (const mode of cases) for (const spec of Object.keys(counts)) {
      const page = await browser.newPage({ extraHTTPHeaders: { 'x-audit-case': mode } });
      const errors = [], lines = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`error: ${m.text()}`);
        if (/^\[\w+\] acceptance /.test(m.text())) lines.push(m.text());
      });
      await page.goto(`${baseURL}/?page=${specs[spec].page}`);
      await page.waitForFunction(() => window.fixtureDone === true);
      const badges = await page.locator('.badge').allTextContents();
      const clean = errors.length === 0 && lines.length === 1 &&
        lines[0] === `[${specs[spec].tag}] acceptance PASSED` &&
        badges.length === counts[spec] && badges.every((b) => b === 'PASS');
      assert.equal(clean, mode === 'baseline', `${mode}/${spec}: fixture is not what its name says`);
      observations.push({ mode, spec, badges, errors, lines, clean });
      await page.close();
    }
    await browser.close(); browser = undefined;
    writeFileSync(join(out, 'observations.json'), JSON.stringify(observations, null, 2) + '\n');

    const command = [join(game, 'node_modules/playwright/cli.js'), 'test', '--config', join(lab, 'playwright.config.cjs'), '--reporter=json'];
    const run = spawnSync(process.execPath, command, { cwd: lab, encoding: 'utf8', timeout: 300000, maxBuffer: 20 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: '0' } });
    writeFileSync(join(out, 'playwright.json'), run.stdout || '');
    writeFileSync(join(out, 'playwright.stderr.log'), run.stderr || '');
    // Raw exit 1 is expected: the matrix contains intentional failing fixtures.
    const report = JSON.parse(run.stdout);
    const results = [];
    (function walk(suites) {
      for (const suite of suites) {
        for (const s of suite.specs || []) for (const t of s.tests || []) {
          const r = t.results.at(-1);
          const spec = s.file.split('/').at(-1).replace('.spec.ts', '');
          const mode = t.projectName;
          const want = intended[mode];
          const messages = (r.errors || []).map((e) => e.message || '').join('\n');
          let ok;
          if (want === null) ok = r.status === 'passed';
          else ok = r.status === 'failed' && messages.includes(want) && !/Error: page\.goto|net::ERR|Cannot find/.test(messages);
          if (!ok) {
            failures++;
            console.log(`MISMATCH ${mode}/${spec}: status=${r.status} want=${want ?? 'passed'} :: ${messages.split('\n')[0]}`);
          }
          results.push({ mode, spec, status: r.status, wantLabel: want, ok });
        }
        walk(suite.suites || []);
      }
    })(report.suites);
    const total = cases.length * Object.keys(counts).length;
    if (results.length !== total) { failures++; console.log(`MISMATCH: ${results.length} results, expected ${total}`); }
    const summary = { rev: rev ?? 'working tree', total, rawPlaywrightExit: run.status, mismatches: failures, results };
    writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    const passes = results.filter((r) => r.wantLabel === null && r.ok).length;
    const rejects = results.filter((r) => r.wantLabel !== null && r.ok).length;
    console.log(`${results.length - failures >= 0 ? results.filter((r) => r.ok).length : 0}/${total} expected dispositions (${passes} clean PASS, ${rejects} defects rejected at the intended assertion); mismatches=${failures}; raw playwright exit=${run.status}`);
    console.log(`Evidence: ${out}`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
  }
  process.exit(failures === 0 ? 0 : 1);
}