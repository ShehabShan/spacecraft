// A1-U08b probe helper: apply ONE generic mutation to a scratch copy of any
// M1x harness. Never touches the repo tree; operates on the path given.
// usage: node u08b-spec-mutate.mjs <harness.tsx> <mutation>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , file, name] = process.argv;
let src = readFileSync(file, 'utf8');

function sub(re, to, label) {
  const n = (src.match(new RegExp(re.source, 'g')) || []).length;
  if (n === 0) throw new Error(`[${name}] anchor not found: ${label}`);
  src = src.replace(new RegExp(re.source, 'g'), to);
  return n;
}
const VERDICT = /\$\{(\w+) \? 'PASSED' : 'FAILED'\}/;          // verdict ternary in the console line
const BADGE = /r\.pass \? 'PASS' : 'FAIL'/;                      // per-row badge text
const LOGLINE = /console\.log\(\s*`\[Milestone1([A-F])\] acceptance /;

const M = {
  baseline: () => {},
  // control: verdict forced PASSED, every row badge reads FAIL -> badge check alone must fail the spec
  badgefail: () => { sub(VERDICT, "${'PASSED'}", 'verdict'); sub(BADGE, "'FAIL'", 'badge'); },
  // verdict forced PASSED, every row badge reads ERR (a failing row spelled differently)
  badgeerr: () => { sub(VERDICT, "${'PASSED'}", 'verdict'); sub(BADGE, "'ERR'", 'badge'); },
  // uncaught page error scheduled just before the verdict line is logged
  pageerror: () => sub(LOGLINE, (m) => "setTimeout(() => { throw new Error('U08-injected pageerror'); }, 0);\n  " + m, 'logline'),
  // verdict line never emitted in recognisable form -> spec must time out and fail
  nolog: () => sub(/\] acceptance \$\{/, '] acceptanc3 ${', 'verdict tag'),
};

if (!M[name]) throw new Error(`unknown mutation ${name}`);
const n = M[name]();
writeFileSync(file, src);
console.log(`[u08b-mutate] applied ${name}${typeof n === 'number' ? ` (${n} site(s))` : ''}`);