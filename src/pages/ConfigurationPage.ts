import { BasePage } from './BasePage';

export class ConfigurationPage extends BasePage {
  readonly name = '03-configuration';

  // No stable readyLocator — the configurator varies heavily across workflows.
  // We rely on networkidle + an extra paint delay instead.

  async waitForReady(timeout = 45_000): Promise<void> {
    await super.waitForReady(timeout);
    await this.page.waitForTimeout(2000);
  }
}
