#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';

const USAGE = `Usage:
  npm run compare:full -- <baseline-url> <target-url> [options]

Options:
  --label-base <text>    Column label for baseline (default: wf param of baseline URL)
  --label-target <text>  Column label for target   (default: wf param of target URL)
  --skip-baseline        Reuse existing snapshots, only run the target
  --no-report            Do not open the HTML report when finished (default: open it)

Example:
  npm run compare:full -- \\
    https://.../model?wf=cupra-gb-en \\
    https://.../model?wf=cupra-gb-example
`;

const { values, positionals } = parseArgs({
  options: {
    'label-base': { type: 'string' },
    'label-target': { type: 'string' },
    'skip-baseline': { type: 'boolean', default: false },
    'no-report': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false },
  },
  allowPositionals: true,
});

if (values.help || positionals.length < 2) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

const [baseUrl, targetUrl] = positionals;

const labelFromUrl = (url, fallback) => {
  try {
    return new URL(url).searchParams.get('wf') ?? fallback;
  } catch {
    return fallback;
  }
};

const labelBase = values['label-base'] ?? labelFromUrl(baseUrl, 'Baseline');
const labelTarget = values['label-target'] ?? labelFromUrl(targetUrl, 'Target');

const runPlaywright = (env, extraArgs = []) => {
  const result = spawnSync(
    'npx',
    ['playwright', 'test', 'src/tests/compare', '--project=chrome', '--grep', '@compare', ...extraArgs],
    { stdio: 'inherit', env: { ...process.env, ...env } },
  );
  return result.status === 0;
};

if (!values['skip-baseline']) {
  console.log(`\n▶  Capturing baseline (${labelBase})\n   URL: ${baseUrl}\n`);
  const ok = runPlaywright({ COMPARE_URL: baseUrl }, ['--update-snapshots']);
  if (!ok) {
    console.error('\n✘ Baseline capture failed — flow could not complete. Aborting.');
    process.exit(1);
  }
}

console.log(`\n▶  Comparing target (${labelTarget}) against baseline (${labelBase})\n   URL: ${targetUrl}\n`);
const okTarget = runPlaywright({
  COMPARE_URL: targetUrl,
  BASELINE_LABEL: labelBase,
  TARGET_LABEL: labelTarget,
});

if (!okTarget) {
  console.error('\n✘ Target run failed — flow could not complete.');
}

if (!values['no-report']) {
  spawnSync('npx', ['playwright', 'show-report'], { stdio: 'inherit' });
}

process.exit(okTarget ? 0 : 1);
