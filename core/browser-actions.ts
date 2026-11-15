// "import type" supplies TypeScript names for checking the code. It does not create a browser.
// BrowserType is an engine launcher (Chromium/Firefox/WebKit); Browser is a running instance.
// A BrowserContext is an isolated session with its own cookies; a Page is a tab in that session.
// A Locator describes how Playwright should find an element when an action is performed.
import type { Browser, BrowserType, Locator, Page } from '@playwright/test';
import { enterSensitiveValue } from '../utils/sensitive-input';

/** Shared browser actions; page objects keep application-specific locators. */
export class BrowserActions {
  // This short constructor both accepts the Page and stores it as this.page.
  // "readonly" prevents this class from replacing that Page reference after construction.
  constructor(readonly page: Page) {}

  // "async" means this method returns a Promise (an operation that completes later).
  // "await" waits for navigation before the next action. Promise<void> returns no result.
  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  // Use a Locator rather than a fixed element handle so Playwright finds the current element.
  // click() automatically checks that the element is ready to receive a click.
  async click(locator: Locator): Promise<void> {
    await locator.click();
  }

  // Credential and OTP entry share one utility. They are not printed in custom action titles.
  // Core contains browser operations; utils contains the reusable input implementation.
  async enterSensitiveValue(locator: Locator, value: string): Promise<void> {
    await enterSensitiveValue(locator, value);
  }
}

// An interface describes the required shape of an options object, not executable browser code.
export interface IndependentBrowserOptions {
  // true runs without a visible browser window; false lets a person see the browser.
  readonly headless: boolean;
  // Timeouts use milliseconds: 1,000 milliseconds = 1 second.
  readonly timeoutMs: number;
  // "?" makes this callback optional. A callback is a function passed in for us to call later.
  // The fixture uses it to register the new browser for cleanup if the outer test times out.
  readonly onBrowserCreated?: (browser: Browser) => void;
}

/** Run an action in a separate browser process and close it on every exit path. */
// <T> is a generic result type. If action returns an OTP string, this helper returns that string.
// The action receives the new Page; callers do not have to duplicate launch/cleanup code.
export async function withIndependentBrowserPage<T>(
  browserType: BrowserType,
  options: IndependentBrowserOptions,
  action: (page: Page) => Promise<T>,
): Promise<T> {
  // This launches a genuinely separate browser instance, not another tab in the login browser.
  // If launch itself fails, there is no successfully created Browser here to close.
  const browser = await browserType.launch({
    headless: options.headless,
    timeout: options.timeoutMs,
  });
  let actionFailed = false;
  try {
    // "?." calls the registration callback only when one was supplied.
    // Keep it inside try so a callback error still reaches the cleanup in finally.
    options.onBrowserCreated?.(browser);
    // The OTP source starts with a fresh session; it does not inherit application login cookies.
    const context = await browser.newContext();
    context.setDefaultTimeout(options.timeoutMs);
    context.setDefaultNavigationTimeout(options.timeoutMs);
    const page = await context.newPage();
    // Return the caller's result, while still running finally before this method completes.
    return await action(page);
  } catch (error) {
    // Remember the original failure and rethrow it so the test report keeps its real cause.
    actionFailed = true;
    throw error;
  } finally {
    // finally runs after success, return, or error: cleanup is not limited to passing tests.
    try {
      // Closing the browser also closes its context and pages.
      await browser.close();
    } catch (error) {
      // Cleanup must not replace the original navigation, locator, or assertion error.
      // A close error is reported only when there was no earlier action failure.
      if (!actionFailed) throw error;
    }
  }
}
