// A1 U27b3a: unchanged e2e specs, deterministic browser fixtures, independent oracle.
// Run from game/: node tools/audit/u27b3a-k2b-recheck.mjs <NEW output directory>
// No production writes. Real-harness repros remain a separate evidence layer.
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const self = fileURLToPath(import.meta.url);
const game = resolve(dirname(self), '../..');
const counts = { m1a:5, m1b:5, m1c:4, m1d:5, m1e:6, m1f:5 };
const cases = ['baseline','failbadge','failedverdict','zerorows','pageerror','consoleerror','placeholders','missingrow','errbadge'];
const rejectedByShipped = new Set(['failbadge','failedverdict','zerorows']);
const sha = text => createHash('sha256').update(text).digest('hex');

function fixture(spec, mode) {
  let badges = Array(counts[spec]).fill('PASS');
  if (mode === 'failbadge') badges[0] = 'FAIL';
  if (mode === 'zerorows') badges = [];
  if (mode === 'placeholders') badges.fill('·····');
  if (mode === 'missingrow') badges.pop();
  if (mode === 'errbadge') badges.fill('ERR');
  const tag = `Milestone1${spec.at(-1).toUpperCase()}`;
  // Error in one script does not prevent the separate completion script.
  // This guarantees the uncaught error occurs before the acceptance event.
  const injection = mode === 'pageerror' ? `<script>throw new Error('U27b3a pageerror')</script>` :
    mode === 'consoleerror' ? `<script>console.error('U27b3a consoleerror')</script>` : '';
  return `<!doctype html><meta charset="UTF-8"><title>K2b fixture only</title>
${badges.map(t => `<span class="badge">${t}</span>`).join('\n')}
${injection}
<script>setTimeout(() => {
  console.log('[${tag}] acceptance ${mode === 'failedverdict' ? 'FAILED' : 'PASSED'}');
  window.fixtureDone = true;
}, 50);</script>`;
}

if (process.argv[2] === '--serve') {
  const server = createServer((req,res) => {
    const spec = new URL(req.url,'http://localhost').searchParams.get('page');
    const mode = req.headers['x-audit-case'];
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if (!counts[spec] || !cases.includes(mode)) { res.end('fixture server'); return; }
    res.end(fixture(spec,mode));
  });
  server.listen(0,'127.0.0.1',() => console.log(server.address().port));
} else {
  const out = resolve(process.argv[2] || join(mkdtempSync(join(tmpdir(),'u27b3a-evidence-')),'independent'));
  mkdirSync(out); // Refuse to overwrite earlier evidence.
  const lab = mkdtempSync(join(tmpdir(),'u27b3a-fixture-'));
  mkdirSync(join(lab,'e2e'));
  symlinkSync(join(game,'node_modules'),join(lab,'node_modules'),'dir');
  const hashes = {};
  for (const spec of Object.keys(counts)) {
    const source = readFileSync(join(game,`e2e/${spec}.spec.ts`));
    copyFileSync(join(game,`e2e/${spec}.spec.ts`),join(lab,`e2e/${spec}.spec.ts`));
    hashes[spec] = sha(source);
    assert.equal(sha(readFileSync(join(lab,`e2e/${spec}.spec.ts`))),hashes[spec]);
  }
  const server = spawn(process.execPath,[self,'--serve'],{stdio:['ignore','pipe','inherit']});
  let browser;
  try {
    const port = await new Promise((yes,no) => {
      server.once('error',no);
      server.once('exit',code => no(Error(`fixture server exited ${code}`)));
      server.stdout.once('data',b => yes(Number(b.toString().trim())));
    });
    assert(Number.isInteger(port) && port > 0);
    const baseURL = `http://127.0.0.1:${port}`;
    const config = {
      testDir:'./e2e',timeout:30000,workers:1,retries:0,
      outputDir:join(lab,'results'),
      use:{channel:'chrome',headless:true,baseURL},
      projects:cases.map(name=>({name,use:{extraHTTPHeaders:{'x-audit-case':name}}})),
    };
    writeFileSync(join(lab,'playwright.config.cjs'),`module.exports = ${JSON.stringify(config,null,2)};\n`);
    writeFileSync(join(out,'fixture-config.json'),JSON.stringify(config,null,2)+'\n');
    // Independent observer: actual DOM + pre-completion browser errors, not
    // source constants or copied production assertions. Counts are fixed above.
    browser = await chromium.launch({channel:'chrome',headless:true});
    const observations = [];
    for (const mode of cases) for (const spec of Object.keys(counts)) {
      const page = await browser.newPage({extraHTTPHeaders:{'x-audit-case':mode}});
      const errors=[], lines=[];
      page.on('pageerror',e=>errors.push(`pageerror: ${e.message}`));
      page.on('console',m=>{
        if (m.type()==='error') errors.push(`error: ${m.text()}`);
        if (m.text().startsWith('[Milestone')) lines.push(m.text());
      });
      await page.goto(`${baseURL}/?page=${spec}`);
      await page.waitForFunction(()=>window.fixtureDone===true);
      const badges = await page.locator('.badge').allTextContents();
      const strictPass = errors.length===0 && lines.length===1 &&
        lines[0]===`[Milestone1${spec.at(-1).toUpperCase()}] acceptance PASSED` &&
        badges.length===counts[spec] && badges.every(b=>b==='PASS');
      assert.equal(strictPass,mode==='baseline',`${mode}/${spec}: independent control`);
      observations.push({mode,spec,badges,errors,lines,strictPass});
      await page.close();
    }
    await browser.close(); browser = undefined;
    writeFileSync(join(out,'observations.json'),JSON.stringify(observations,null,2)+'\n');
    const command=[join(game,'node_modules/playwright/cli.js'),'test','--config',join(lab,'playwright.config.cjs'),'--reporter=json'];
    const run=spawnSync(process.execPath,command,{cwd:lab,encoding:'utf8',timeout:180000,maxBuffer:20*1024*1024,env:{...process.env,FORCE_COLOR:'0'}});
    writeFileSync(join(out,'playwright.json'),run.stdout||'');
    writeFileSync(join(out,'playwright.stderr.log'),run.stderr||'');
    writeFileSync(join(out,'process.json'),JSON.stringify({command:[process.execPath,...command],exit:run.status,signal:run.signal,error:run.error?.message,hashes},null,2)+'\n');
    assert.equal(run.status,1,'mixed matrix must return 1 from intentional failing controls');
    const report=JSON.parse(run.stdout);
    const results=[];
    function walk(suites) {
      for(const suite of suites) {
        for(const s of suite.specs||[]) for(const t of s.tests||[]) {
          const result=t.results.at(-1);
          const spec=s.file.split('/').at(-1).replace('.spec.ts','');
          const mode=t.projectName;
          const expected=rejectedByShipped.has(mode)?'failed':'passed';
          const stdout=result.stdout.map(x=>x.text||'').join('');
          const obs=observations.find(x=>x.mode===mode&&x.spec===spec);
          assert(obs,`unknown ${mode}/${spec}`);
          assert.equal(result.status,expected,`${mode}/${spec}: gate disposition`);
          assert(stdout.includes(JSON.stringify(obs.badges)),`${mode}/${spec}: observed badges must match`);
          for(const error of obs.errors) assert(stdout.includes(error),`${mode}/${spec}: error must reach transcript`);
          if (expected==='failed') {
            const label={failbadge:'no FAIL badge may remain',failedverdict:'acceptance console line',zerorows:'badge rows scraped'}[mode];
            assert(result.errors.some(e=>e.message?.includes(label)),`${mode}/${spec}: correct assertion failure`);
          }
          results.push({mode,spec,strictPass:obs.strictPass,shippedStatus:result.status,expectedStatus:expected});
        }
        walk(suite.suites||[]);
      }
    }
    walk(report.suites);
    assert.equal(results.length,54);
    assert.equal(new Set(results.map(x=>`${x.mode}/${x.spec}`)).size,54);
    for (const [spec,hash] of Object.entries(hashes)) {
      assert.equal(sha(readFileSync(join(game,`e2e/${spec}.spec.ts`))),hash);
      assert.equal(sha(readFileSync(join(lab,`e2e/${spec}.spec.ts`))),hash);
    }
    const summary={cases:results.length,positiveControls:6,negativeControls:18,falsePasses:30,sourceSpecsUnchanged:true,results};
    writeFileSync(join(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');
    console.log('54/54 expected dispositions: 6 clean PASS, 18 correctly rejected controls, 30 false passes. Independent oracle rejects all 48 defective fixtures. Spec hashes unchanged.');
    console.log(`Evidence: ${out}`);
  } finally {
    if(browser) await browser.close();
    server.kill('SIGTERM');
  }
}