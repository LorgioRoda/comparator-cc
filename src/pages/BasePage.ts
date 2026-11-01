import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { captureAndDiffText } from '../helpers/textDiff';

const SCREENSHOT_OPTS = {
  fullPage: true,
  animations: 'disabled' as const,
  maxDiffPixelRatio: 0.001,
  threshold: 0.05,
};

/**
 * Base for every page object in the visual-compare suite.
 * Subclasses must define `name` (used for snapshot/text filenames). `readyLocator()`
 * is optional — return null when there is no reliable element to anchor the wait on;
 * `waitForReady` will then fall back to `networkidle` + any extra wait the subclass adds.
 */
export abstract class BasePage {
  abstract readonly name: string;
  protected readyLocator(): Locator | null {
    return null;
  }

  constructor(
    protected readonly page: Page,
    protected readonly testInfo: TestInfo,
  ) {}

  /** Waits until the page is stable, then settles network before any capture. */
  async waitForReady(timeout = 45_000): Promise<void> {
    const locator = this.readyLocator();
    if (locator) await locator.waitFor({ state: 'visible', timeout });
    await this.page.waitForLoadState('networkidle');
  }

  /** Pixel diff vs. baseline — reports but does not throw. */
  async captureSoftSnapshot(): Promise<void> {
    try {
      await expect(this.page).toHaveScreenshot(`${this.name}.png`, SCREENSHOT_OPTS);
      console.log(`  OK  ${this.name}.png: no visual diff`);
    } catch {
      console.log(`  DIFF ${this.name}.png: visual diff detected`);
      this.testInfo.annotations.push({ type: 'visual-diff', description: `${this.name}.png` });
    }
  }

  /** Text diff vs. baseline — reports but does not throw. */
  async captureTextDiff(): Promise<void> {
    await captureAndDiffText(this.page, this.testInfo, this.name);
  }

  /** Convenience: snapshot + text diff in one call. */
  async captureAll(): Promise<void> {
    await this.captureSoftSnapshot();
    await this.captureTextDiff();
  }
}
