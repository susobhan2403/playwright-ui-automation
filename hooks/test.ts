// Rename Playwright's original test to "base" so we can export our extended version as "test".
// Browser is a TypeScript type only; this import does not start a browser.
import { test as base, type Browser } from '@playwright/test';
import { loadConfig } from '../config/config';
import { withIndependentBrowserPage } from '../core/browser-actions';
import { LoginPage } from '../pages/login-page';
import { OtpSourcePage } from '../pages/otp-source-page';

// This describes a function that runs an action with an OTP-source page and returns its result.
// <T> keeps the result type: an action returning a string produces a Promise<string>.
type WithOtpSource = <T>(action: (source: OtpSourcePage) => Promise<T>) => Promise<T>;

// Fixtures are named objects/functions that Playwright supplies to a test when it asks for them.
interface ApplicationFixtures {
  loginPage: LoginPage;
  withOtpSource: WithOtpSource;
}

// extend() adds our fixtures to Playwright's built-in ones. It does not replace the test runner.
// Specs import this exported test so they can request { loginPage, withOtpSource } by name.
export const test = base.extend<ApplicationFixtures>({
  // { page } asks Playwright for a fresh tab in this test's isolated browser context.
  // The fixture wraps that tab in the application-specific LoginPage class.
  loginPage: async ({ page }, use) => {
    // Playwright owns the primary browser and isolated test context.
    // use(value) supplies the value to the test, then waits until the test has finished.
    await use(new LoginPage(page));
  },
  // These built-in fixtures provide engine launchers and the effective browser/headless options.
  withOtpSource: async ({ playwright, browserName, headless }, use) => {
    const config = loadConfig();
    // A Set stores each created browser reference once, ready for a final cleanup check.
    const browsers = new Set<Browser>();
    // Once teardown begins, a slow launch must not hand a new browser to an already ended test.
    let disposed = false;
    try {
      // Supply a function to the test rather than launching an OTP browser immediately.
      // The separate instance starts only when the test calls withOtpSource(action).
      // Launch on demand, after the application has reached its OTP page.
      await use(async (action) => withIndependentBrowserPage(
        // Bracket notation selects the Chromium, Firefox, or WebKit launcher by its name.
        playwright[browserName],
        {
          headless,
          timeoutMs: config.testTimeoutMs,
          onBrowserCreated: (browser) => {
            if (disposed) throw new Error('The OTP browser fixture has already finished.');
            browsers.add(browser);
          },
        },
        // Wrap the new tab in its own page object, then run the action requested by the test.
        async (page) => action(new OtpSourcePage(page)),
      ));
    } finally {
      // Code after await use(...) is fixture teardown: it runs after the test finishes or fails.
      disposed = true;
      // The core helper normally closes each OTP browser after its callback returns.
      // This second cleanup also closes a browser whose callback is pending at a test timeout.
      // Spread (...) turns the Set into an array; filter keeps only connected browsers.
      // map starts a close for each one, and Promise.all waits for every close operation.
      await Promise.all([...browsers]
        .filter((browser) => browser.isConnected())
        .map((browser) => browser.close()));
    }
  },
});

// Re-export Playwright's assertion helper so specs can import test and expect from this one file.
export { expect } from '@playwright/test';
