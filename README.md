# comparator-cc

Visual + text diff tool for two car-configurator URLs, powered by Playwright.

Walks the full flow (Model → Trim → Configuration) against a URL, taking a screenshot and extracting visible text at each step, then compares those artifacts against a previously captured baseline.

- **Navigation failures** (click, waitFor) → the test fails. The configurator flow must complete.
- **Visual / text diffs** → the test still passes, but diffs are attached to the HTML report and dropped as files in `test-results/`.

## Install

```bash
npm install
npx playwright install --with-deps chromium
```

## How the comparison works

The tool runs the same configurator flow twice against two different URLs and compares what it sees at each step:

1. **Baseline run** (`npm run compare:baseline`)
   - Opens the configurator at `COMPARE_URL`.
   - Walks through Model → Trim → Configuration.
   - At every step, saves a screenshot (`.png`) and the visible text (`.txt`) into `src/tests/compare/*.spec.ts-snapshots/`.
   - These files become the **reference** that future runs compare against.

2. **Target run** (`npm run compare`)
   - Opens the configurator at a different `COMPARE_URL` (the one you want to validate).
   - Walks the exact same flow and captures the same artifacts.
   - For each step, compares the new screenshot and text against the baseline:
     - **Image diff** → generates `*-actual.png`, `*-expected.png`, `*-diff.png`.
     - **Text diff** → generates `*.text-diff.html` (side-by-side `Baseline | Target` table) and `*.text-diff.txt`.

3. **Report** (`npm run report`)
   - Opens the Playwright HTML report with every step's screenshots and text diffs attached.

### Example

Imagine you want to compare the English version of the configurator against the Spanish one.

```bash
# 1) Capture the baseline from the English URL (reference).
COMPARE_URL='<english-configurator-url>' npm run compare:baseline

# 2) Compare the Spanish URL against the baseline.
BASELINE_LABEL='en' TARGET_LABEL='es' \
  COMPARE_URL='<spanish-configurator-url>' \
  npm run compare

# 3) Inspect the per-step visual + text diffs.
npm run report
```

The report will show, step by step, where the Spanish flow renders or reads differently than the English one.

## Configuration

The URLs are passed through the `COMPARE_URL` environment variable. You can either:

- Override it inline (as in the example above), or
- Edit the `compare:baseline` and `compare` scripts in `package.json` to hard-code your defaults.

Optional labels for the diff tables:

- `BASELINE_LABEL` → header shown on the left column of the text diff.
- `TARGET_LABEL` → header shown on the right column.

## Where to find the diffs

- **HTML report** (recommended): `npm run report` → open the test → scroll to **Attachments** → click each `*.text-diff.html` for a side-by-side `Baseline | Target` table.
- **Raw files**: `test-results/compare-*/<step>.text-diff.html` and `.text-diff.txt`.
- **Visual diffs**: Playwright writes `<step>-actual.png`, `<step>-expected.png`, `<step>-diff.png` next to the text diffs when the pixel comparison fails.

## UI mode (watch the browser live)

```bash
COMPARE_URL='<url>' npm run ui
```

## Architecture (Page Object Model)

```
src/
├── pages/
│   ├── BasePage.ts            # abstract: waitForReady, captureSoftSnapshot, captureTextDiff, captureAll
│   ├── ModelPage.ts           # concrete pages extend BasePage
│   ├── TrimPage.ts
│   └── ConfigurationPage.ts
├── fixtures/
│   └── pagesFixture.ts        # exposes each page as a Playwright fixture
├── helpers/
│   └── textDiff.ts            # captures/diffs visible text, renders HTML tables
└── tests/compare/
    └── cupra-compare.spec.ts  # orchestration only — no raw selectors
```

Each page defines a stable `readyLocator()` and a `name` used as the snapshot filename (`01-model`, `02-trim`, …). Navigation methods (e.g. `continueToTrim`, `startConfiguration`) live on the page, so the spec is pure orchestration.

## Adding a new page / step

Use the `add-compare-page` skill (in `.claude/skills/`), or follow the manual steps:

1. Create `src/pages/<Name>Page.ts` extending `BasePage` (define `name` + `readyLocator()`).
2. Register it in `src/fixtures/pagesFixture.ts`.
3. Add `wait+capture` (and optionally `advance`) steps to `src/tests/compare/cupra-compare.spec.ts`.
4. Run `npm run compare:baseline` to generate the new snapshot files.

## Tweaks

- Visual tolerance → `SCREENSHOT_OPTS` in `src/pages/BasePage.ts`.
- Entry test-id (`cupra-diagonal-model-selector-next`) → `src/pages/ModelPage.ts`.
- Primary CTA regex across languages → `START_CONFIG_CTA` in `src/pages/TrimPage.ts`.
