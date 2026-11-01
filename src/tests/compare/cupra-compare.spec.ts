import { test } from '../../fixtures/pagesFixture';

const COMPARE_URL = process.env.COMPARE_URL;

test.describe('@compare Car Configurator visual compare', () => {
  test.setTimeout(120_000);

  test.beforeAll(() => {
    if (!COMPARE_URL) {
      throw new Error('COMPARE_URL env var is required (full URL including query params).');
    }
  });

  test(
    'configures the default car end-to-end and reports visual + text diffs per step',
    async ({ modelPage, trimPage, configurationPage }, testInfo) => {
      await test.step('Model > open and capture', async () => {
        await modelPage.open(COMPARE_URL!);
        await modelPage.waitForReady();
        await modelPage.captureAll();
      });

      await test.step('Model > continue', async () => {
        await modelPage.continueToTrim();
      });

      await test.step('Trim > wait and capture', async () => {
        await trimPage.waitForReady();
        await trimPage.captureAll();
      });

      await test.step('Trim > start configuration', async () => {
        await trimPage.startConfiguration();
      });

      await test.step('Configuration > wait and capture', async () => {
        await configurationPage.waitForReady();
        await configurationPage.captureAll();
      });

      const visualDiffs = testInfo.annotations.filter((a) => a.type === 'visual-diff');
      const textDiffs = testInfo.annotations.filter((a) => a.type === 'text-diff');
      console.log(
        `\n==> ${visualDiffs.length} step(s) with visual diffs${
          visualDiffs.length ? `: ${visualDiffs.map((d) => d.description).join(', ')}` : ''
        }`,
      );
      console.log(
        `==> ${textDiffs.length} step(s) with text diffs${
          textDiffs.length ? `: ${textDiffs.map((d) => d.description).join(', ')}` : ''
        }`,
      );
    },
  );
});
