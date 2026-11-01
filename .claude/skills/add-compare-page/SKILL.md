---
name: add-compare-page
description: Add a new Page Object to the comparator-cc visual-compare suite following the Page Object Model architecture. Use when the user asks to add a new step, screen, or page to the compare flow (e.g. "añade la página de Summary", "add a Wheels page", "incluye el paso de Options en el compare"). Creates src/pages/<Name>Page.ts extending BasePage, registers the fixture in src/fixtures/pagesFixture.ts, and wires an orchestration step in the spec.
---

# add-compare-page

Add a new Page Object to the visual-compare suite without breaking the existing POM contract.

## Architecture reminder

```
src/
├── pages/
│   ├── BasePage.ts            ← abstract base: waitForReady, captureSoftSnapshot, captureTextDiff, captureAll
│   ├── ModelPage.ts           ← concrete pages extend BasePage
│   ├── TrimPage.ts
│   └── ConfigurationPage.ts
├── fixtures/
│   └── pagesFixture.ts        ← registers each page as a Playwright fixture
└── tests/compare/
    └── cupra-compare.spec.ts  ← orchestration only: injects pages, calls their methods
```

Rules:
- **Every page extends `BasePage`.** No duplicate screenshot or text-diff logic.
- **Every page defines `name`.** It becomes the snapshot filename (e.g. `04-summary`).
- **`readyLocator()` is optional.** Override it when there is a stable element whose visibility signals "safe to capture" (preferred). When no reliable anchor exists, skip it and override `waitForReady` to add an explicit `page.waitForTimeout(ms)` after the base `networkidle` wait (see `ConfigurationPage` for the pattern).
- **Navigation methods live on the page** (e.g. `continueToTrim`, `startConfiguration`). The spec never calls `page.getByRole(...)` directly.
- **Snapshots and text diffs come from the base** via `captureAll()` / `captureSoftSnapshot()` / `captureTextDiff()`. Do not re-implement them.
- **The spec is pure orchestration.** Steps are `test.step('…', async () => { await somePage.doThing(); })`.

## Steps to add a new page

### 1. Create `src/pages/<Name>Page.ts`

Template:

```ts
import { type Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class <Name>Page extends BasePage {
  readonly name = '<NN>-<slug>'; // e.g. '04-summary' — must be unique and ordered

  protected readyLocator(): Locator {
    return this.page.getByRole('…'); // or getByTestId, or any stable locator
  }

  // Add navigation / interaction methods here.
  // Example:
  // async continueToCheckout(): Promise<void> {
  //   await this.page.getByRole('button', { name: /checkout/i }).click({ force: true });
  // }
}
```

Pick `name` so the numeric prefix matches the step order (`01-model`, `02-trim`, `03-configuration`, `04-…`).

If the page needs extra waiting after `waitForReady` (lazy content, async paint), override:

```ts
async waitForReady(timeout = 45_000): Promise<void> {
  await super.waitForReady(timeout);
  await this.page.waitForTimeout(1500);
}
```

### 2. Register the fixture in `src/fixtures/pagesFixture.ts`

Add to the `Pages` interface:

```ts
interface Pages {
  // …existing…
  <camelName>Page: <Name>Page;
}
```

Add the fixture body:

```ts
export const test = base.extend<Pages>({
  // …existing…
  <camelName>Page: async ({ page }, use, testInfo) => {
    await use(new <Name>Page(page, testInfo));
  },
});
```

### 3. Wire it into the spec `src/tests/compare/cupra-compare.spec.ts`

Add it to the destructured fixtures and insert its steps after the previous page's advance step:

```ts
async ({ modelPage, trimPage, configurationPage, <camelName>Page }, testInfo) => {
  // …existing steps…

  await test.step('<Name> > wait and capture', async () => {
    await <camelName>Page.waitForReady();
    await <camelName>Page.captureAll();
  });

  // If this page advances to the next one:
  await test.step('<Name> > <advance action>', async () => {
    await <camelName>Page.<methodName>();
  });
}
```

### 4. Regenerate baseline

New snapshots don't exist yet — run baseline against the primary URL:

```bash
npm run compare:baseline
```

This writes `<NN>-<slug>.png` and `<NN>-<slug>.txt` into `src/tests/compare/cupra-compare.spec.ts-snapshots/`.

### 5. Run the compare

```bash
npm run compare
npm run report  # inspect attachments per step
```

## Checklist before finishing

- [ ] New file in `src/pages/<Name>Page.ts` extends `BasePage` and defines `name` + `readyLocator`.
- [ ] `pagesFixture.ts` lists the new page in `Pages` and provides the fixture body.
- [ ] Spec destructures the new fixture and adds `wait+capture` (and optionally `advance`) steps.
- [ ] `./node_modules/.bin/tsc --noEmit` passes.
- [ ] `npm run compare:baseline` regenerates snapshots including the new one.
- [ ] `npm run compare` runs end-to-end without navigation errors.

## What NOT to do

- Do **not** add `expect(page).toHaveScreenshot(...)` or `captureAndDiffText(...)` calls in the spec. Use `captureAll()` from the page.
- Do **not** keep raw `page.getByRole(...)` navigation inside the spec. Move it to a method on the page.
- Do **not** reuse an existing `name` across pages — baselines would clash.
- Do **not** change `BasePage`'s public API (`waitForReady`, `captureAll`, `captureSoftSnapshot`, `captureTextDiff`, `name`) without updating every subclass and the fixture.
