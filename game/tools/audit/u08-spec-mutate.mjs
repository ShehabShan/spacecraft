// A1-U08 probe helper: apply ONE named mutation to a scratch copy of the
// M1B harness. Never touches the repo tree; operates on the path given.
// usage: node u08-spec-mutate.mjs <harness.tsx> <mutation>
import { readFileSync, writeFileSync } from 'node:fs';

const [, , file, name] = process.argv;
let src = readFileSync(file, 'utf8');

function sub(from, to) {
  if (!src.includes(from)) throw new Error(`[${name}] anchor not found: ${from}`);
  src = src.replace(from, to);
}
const PUBLISH = '  publishSuite({ started: true, results, done: true });';
const VERDICT = "${allPass ? 'PASSED' : 'FAILED'}";

const M = {
  baseline: () => {},
  // uncaught page error right after the suite publishes its verdict
  pageerror: () =>
    sub(PUBLISH, PUBLISH + "\n  setTimeout(() => { throw new Error('U08-injected pageerror'); }, 0);"),
  // console.error during the suite
  consoleerror: () =>
    sub('  console.log(\n    `[Milestone1B] acceptance', "  console.error('U08-injected console.error');\n  console.log(\n    `[Milestone1B] acceptance"),
  // suite never runs -> no verdict line
  timeout: () => sub('state.clock.elapsedTime > 0.75', 'state.clock.elapsedTime > 1e9'),
  // a row FAILS but the verdict line still says PASSED (tests the badge check alone)
  badgefail: () => {
    sub("results['m1a-regression'] = {\n    pass: t5pass,", "results['m1a-regression'] = {\n    pass: false,");
    sub(VERDICT, "${'PASSED'}");
  },
  // verdict PASSED, but no results published -> rows keep placeholder badges
  norows: () => {
    sub(VERDICT, "${'PASSED'}");
    sub(PUBLISH, '  publishSuite({ started: true, results: {}, done: true });');
  },
  // one row removed from the panel entirely (badge missing from the DOM)
  droprow: () => sub("  { id: 'm1a-regression', label: 'M1A regression: floating origin intact' },\n", ''),
  // TypeScript type error: does the gate's `npm run build` catch it?
  typeerror: () =>
    sub('function runSuite(): void {', "const __u08TypeError: number = 'not a number';\nconsole.log(__u08TypeError);\nfunction runSuite(): void {"),
};

if (!M[name]) throw new Error(`unknown mutation ${name}`);
M[name]();
writeFileSync(file, src);
console.log(`[u08-mutate] applied ${name}`);