// Playwright automatically finds this root file for CLI, IDE, and CI execution.
import { defineConfig } from '@playwright/test';
import { loadConfig } from './config/config';

// Read and validate browser/environment settings. Credentials are not part of this object.
const config = loadConfig();

// defineConfig supplies TypeScript checks and editor suggestions for runner options.
export default defineConfig({
  // Only matching files in tests/ are discovered; adding a *.spec.ts needs no runner edit.
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  // Maximum time for the whole test. This is not extra time added to each action/assertion.
  timeout: config.testTimeoutMs,
  // Retrying locator assertions normally wait up to 10 seconds; individual checks may override it.
  expect: { timeout: 10_000 },
  // A worker is a test-execution process. The JSON configuration defaults to one.
  workers: config.workers,
  // A failure is reported immediately; the runner does not automatically repeat failed tests.
  retries: 0,
  // A nonempty CI environment variable prevents accidentally committing test.only().
  forbidOnly: Boolean(process.env.CI),
  // Playwright stores per-test failure artifacts here. Later runs can replace previous output.
  outputDir: './test-results',
  reporter: [
    ['list'], // Show readable progress and results in the terminal.
    ['html', { outputFolder: 'playwright-report', open: 'never' }], // Open later with npm run report.
  ],
  // Reports may identify the target environment/browser, but must not contain credentials here.
  metadata: { environment: config.environment, browser: config.browser },
  // A project is a named execution profile. This framework runs the single selected profile.
  projects: [{ name: `${config.environment}-${config.browser}` }],
  // These defaults are used by Playwright's built-in primary browser/page fixtures.
  use: {
    browserName: config.browser,
    headless: config.headless, // true runs without a visible browser window.
    screenshot: 'only-on-failure',
    trace: config.trace, // Credential flows default to off; opt in only when appropriate.
    // An action timeout limits one action; the whole-test timeout still limits the total flow.
    actionTimeout: config.testTimeoutMs,
  },
});
