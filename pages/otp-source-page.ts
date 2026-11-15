// Page represents one tab; Locator describes how an element should be found.
import type { Locator, Page } from '@playwright/test';
import { BrowserActions } from '../core/browser-actions';
// Extraction is a reusable text operation, so it belongs in utils rather than this page.
import { extractOtp } from '../utils/otp';
import { loginLocators } from './locators';

/**
 * The OTP source is opened in a separate browser with its own fresh context.
 * It shares no login cookies with the primary application browser.
 */
export class OtpSourcePage {
  readonly code: Locator;
  private readonly actions: BrowserActions;

  constructor(page: Page) {
    this.actions = new BrowserActions(page);
    // Select one text element containing the intended user's latest OTP.
    // A broad locator matching multiple users/codes is unsafe and will not work reliably.
    this.code = page.getByTestId(loginLocators.otpSourceCode);
  }

  // If the source needs its own authentication, add those application actions here.
  async open(url: string): Promise<void> {
    await this.actions.goto(url);
  }

  // Promise<string> tells the caller that awaiting this method returns the extracted code.
  async readOtp(pattern: string): Promise<string> {
    // Built-in waiting is tied to an element's state; no fixed sleep is required.
    await this.code.waitFor({ state: 'visible' });
    // textContent can return null; ?? supplies an empty string only for null/undefined.
    // This reads the element's text, not an input element's value.
    return extractOtp((await this.code.textContent()) ?? '', pattern);
  }
}
