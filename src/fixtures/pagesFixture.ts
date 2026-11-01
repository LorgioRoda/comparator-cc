import { test as base } from '@playwright/test';
import { ModelPage } from '../pages/ModelPage';
import { TrimPage } from '../pages/TrimPage';
import { ConfigurationPage } from '../pages/ConfigurationPage';

interface Pages {
  modelPage: ModelPage;
  trimPage: TrimPage;
  configurationPage: ConfigurationPage;
}

export const test = base.extend<Pages>({
  modelPage: async ({ page }, use, testInfo) => {
    await use(new ModelPage(page, testInfo));
  },
  trimPage: async ({ page }, use, testInfo) => {
    await use(new TrimPage(page, testInfo));
  },
  configurationPage: async ({ page }, use, testInfo) => {
    await use(new ConfigurationPage(page, testInfo));
  },
});

export { expect } from '@playwright/test';
