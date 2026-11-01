import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

/** Primary CTA of the trim card across common languages (EN, ES, DE, FR). */
const START_CONFIG_CTA = /^(start configuration|iniciar configuraci|configurar|konfiguration starten|commencer la configuration)$/i;

export class TrimPage extends BasePage {
  readonly name = '02-trim';

  protected readyLocator(): Locator {
    return this.page.getByRole('listbox', { name: 'Trim' });
  }

  /** Advances to the Configuration page by clicking the CTA on the pre-selected trim. */
  async startConfiguration(timeout = 15_000): Promise<void> {
    const selected = this.readyLocator().getByRole('option', { selected: true });
    const cta = selected.getByRole('button', { name: START_CONFIG_CTA });
    await cta.waitFor({ state: 'visible', timeout });
    await cta.click({ force: true });
  }
}
