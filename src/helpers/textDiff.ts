import path from 'node:path';
import { promises as fs } from 'node:fs';
import { type Page, type TestInfo } from '@playwright/test';

const getBaselineDir = (testInfo: TestInfo): string => `${testInfo.file}-snapshots`;
const getBaselinePath = (testInfo: TestInfo, name: string): string =>
  path.join(getBaselineDir(testInfo), `${name}.txt`);

const extractVisibleText = async (page: Page): Promise<string[]> => {
  const raw = await page.locator('body').innerText();
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
};

const isUpdateMode = (testInfo: TestInfo): boolean => {
  const mode = testInfo.config.updateSnapshots;
  return mode === 'all' || mode === 'changed';
};

/**
 * Captures visible text from the page.
 * - Baseline mode (--update-snapshots): writes `<name>.txt` next to the PNG snapshot.
 * - Compare mode: diffs current text vs. baseline, logs added/removed lines, attaches a `.text-diff.html`.
 * Never throws — text diffs are reported, not asserted.
 */
export const captureAndDiffText = async (page: Page, testInfo: TestInfo, name: string): Promise<void> => {
  const currentLines = await extractVisibleText(page);
  const baselinePath = getBaselinePath(testInfo, name);

  if (isUpdateMode(testInfo)) {
    await fs.mkdir(getBaselineDir(testInfo), { recursive: true });
    await fs.writeFile(baselinePath, currentLines.join('\n'), 'utf-8');
    return;
  }

  let baselineLines: string[];
  try {
    const content = await fs.readFile(baselinePath, 'utf-8');
    baselineLines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  } catch {
    console.log(`  WARN ${name}: no text baseline found at ${baselinePath}`);
    return;
  }

  const baselineSet = new Set(baselineLines);
  const currentSet = new Set(currentLines);
  const removed = baselineLines.filter((l) => !currentSet.has(l));
  const added = currentLines.filter((l) => !baselineSet.has(l));

  if (removed.length === 0 && added.length === 0) {
    console.log(`  OK  ${name}: no text diff`);
    return;
  }

  console.log(`\n=== TEXT DIFF ${name} (-${removed.length} / +${added.length}) ===`);
  removed.forEach((l) => console.log(`  - ${l}`));
  added.forEach((l) => console.log(`  + ${l}`));
  console.log('');

  testInfo.annotations.push({
    type: 'text-diff',
    description: `${name}: removed=${removed.length} added=${added.length}`,
  });

  await fs.mkdir(testInfo.outputDir, { recursive: true });

  const txtPath = path.join(testInfo.outputDir, `${name}.text-diff.txt`);
  const txtBody = [
    `# Text diff for ${name}`,
    `# Removed (in baseline, missing in current): ${removed.length}`,
    `# Added (in current, missing in baseline): ${added.length}`,
    '',
    ...removed.map((l) => `- ${l}`),
    ...added.map((l) => `+ ${l}`),
  ].join('\n');
  await fs.writeFile(txtPath, txtBody, 'utf-8');
  await testInfo.attach(`${name}-text-diff.txt`, { path: txtPath, contentType: 'text/plain' });

  const htmlPath = path.join(testInfo.outputDir, `${name}.text-diff.html`);
  await fs.writeFile(htmlPath, renderHtmlDiff(name, removed, added), 'utf-8');
  await testInfo.attach(`${name}-text-diff.html`, { path: htmlPath, contentType: 'text/html' });
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

interface Pair {
  left?: string;
  right?: string;
}

const commonPrefixLength = (a: string, b: string): number => {
  const max = Math.min(a.length, b.length);
  let i = 0;
  while (i < max && a[i] === b[i]) i++;
  return i;
};

/**
 * Pair removed/added lines in two passes:
 *   1. Longest common prefix (min 8 chars) — pairs semantically related lines.
 *   2. Fallback: if equal count of unpaired on each side, pair positionally.
 * Anything still unmatched becomes a one-sided row.
 */
const pairLines = (removed: string[], added: string[]): Pair[] => {
  const paired: Pair[] = [];
  const leftOrphans: string[] = [];
  const rightUsed = new Set<number>();

  for (const left of removed) {
    let bestIdx = -1;
    let bestLen = 7;
    for (let i = 0; i < added.length; i++) {
      if (rightUsed.has(i)) continue;
      const len = commonPrefixLength(left, added[i]);
      if (len > bestLen) {
        bestLen = len;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      paired.push({ left, right: added[bestIdx] });
      rightUsed.add(bestIdx);
    } else {
      leftOrphans.push(left);
    }
  }

  const rightOrphans = added.filter((_, i) => !rightUsed.has(i));

  // Fallback: positional pairing when both sides have the same orphan count.
  const result = [...paired];
  if (leftOrphans.length === rightOrphans.length) {
    leftOrphans.forEach((left, i) => result.push({ left, right: rightOrphans[i] }));
  } else {
    leftOrphans.forEach((left) => result.push({ left }));
    rightOrphans.forEach((right) => result.push({ right }));
  }
  return result;
};

const renderHtmlDiff = (name: string, removed: string[], added: string[]): string => {
  const baselineLabel = process.env.BASELINE_LABEL ?? 'Baseline';
  const targetLabel = process.env.TARGET_LABEL ?? 'Target';
  const pairs = pairLines(removed, added);

  const rows = pairs
    .map(
      ({ left, right }) => `<tr>
  <td class="${left ? 'removed' : 'empty'}">${left ? escapeHtml(left) : '—'}</td>
  <td class="${right ? 'added' : 'empty'}">${right ? escapeHtml(right) : '—'}</td>
</tr>`,
    )
    .join('\n');
  const rowCount = pairs.length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Text diff: ${escapeHtml(name)}</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; background:#0d1117; color:#c9d1d9; padding:24px; margin:0; }
  h1 { font-size:16px; margin:0 0 4px; color:#f0f6fc; }
  .summary { font-size:12px; color:#8b949e; margin-bottom:16px; }
  .count-removed { color:#ff7b72; }
  .count-added { color:#3fb950; }
  table { width:100%; border-collapse:separate; border-spacing:0; font-size:13px; }
  thead th { position:sticky; top:0; background:#161b22; color:#f0f6fc; text-align:left; padding:10px 12px; border-bottom:1px solid #30363d; font-size:12px; text-transform:uppercase; letter-spacing:0.08em; }
  thead th:first-child { border-right:1px solid #30363d; }
  td { padding:8px 12px; vertical-align:top; line-height:1.5; white-space:pre-wrap; word-break:break-word; width:50%; border-bottom:1px solid #21262d; }
  td:first-child { border-right:1px solid #30363d; }
  td.removed { background:#3b1f22; color:#ffdcd7; }
  td.added { background:#13311f; color:#aff5b4; }
  td.empty { color:#484f58; font-style:italic; }
  .no-diff { padding:40px; text-align:center; color:#3fb950; font-size:14px; }
</style>
</head>
<body>
  <h1>Text diff — ${escapeHtml(name)}</h1>
  <div class="summary">
    <span class="count-removed">− ${removed.length} removed</span>
    &nbsp;·&nbsp;
    <span class="count-added">+ ${added.length} added</span>
  </div>
  ${
    rowCount === 0
      ? '<div class="no-diff">✓ No differences</div>'
      : `<table>
    <thead>
      <tr>
        <th>${escapeHtml(baselineLabel)}</th>
        <th>${escapeHtml(targetLabel)}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`
  }
</body>
</html>`;
};
