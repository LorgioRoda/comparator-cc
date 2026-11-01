import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class ModelPage extends BasePage {
  readonly name = '01-model';

  protected readyLocator(): Locator {
    return this.page.getByTestId('cupra-diagonal-model-selector-next');
  }

  /** Opens the configurator URL. Expected to be called before `waitForReady`. */
  async open(url: string): Promise<void> {
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
  }

  /** Advances to the Trim page using the pre-selected model. */
  async continueToTrim(): Promise<void> {
    await this.page.getByTestId('cupra-diagonal-model-selector-next').click({ force: true });
  }
}
