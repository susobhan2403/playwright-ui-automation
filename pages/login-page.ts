// "import type" gives TypeScript information without creating extra runtime objects.
import type { Locator, Page } from '@playwright/test';
// Shared browser operations live in core; application-specific element names live here.
import { BrowserActions } from '../core/browser-actions';
import { loginLocators } from './locators';

// An interface describes the shape of the value a caller must supply.
// "readonly" prevents this page object from changing the supplied credential properties.
interface LoginCredentials {
  readonly username: string;
  readonly password: string;
}

/**
 * A page object groups the application's locators and user actions in one place.
 * It performs actions; the test decides whether the resulting screen is correct.
 */
export class LoginPage {
  // A Locator is a reusable recipe for finding an element, not a stored DOM element.
  // Playwright resolves it again when an action/assertion runs, including after navigation.
  readonly username: Locator;
  readonly password: Locator;
  readonly loginButton: Locator;
  readonly otpPageMarker: Locator;
  readonly otpInput: Locator;
  readonly validateButton: Locator;
  readonly loggedInMarker: Locator;
  // "private" means callers use the page's named actions instead of this internal helper.
  private readonly actions: BrowserActions;

  // The fixture supplies the original application's Page (one browser tab).
  constructor(page: Page) {
    this.actions = new BrowserActions(page);
    // getByTestId('name') normally finds an element with data-testid="name".
    // The strings come from locators.ts, so replacing a test ID has one edit location.
    this.username = page.getByTestId(loginLocators.username);
    this.password = page.getByTestId(loginLocators.password);
    this.loginButton = page.getByTestId(loginLocators.loginButton);
    this.otpPageMarker = page.getByTestId(loginLocators.otpPageMarker);
    this.otpInput = page.getByTestId(loginLocators.otpInput);
    this.validateButton = page.getByTestId(loginLocators.validateButton);
    this.loggedInMarker = page.getByTestId(loginLocators.loggedInMarker);
  }

  // async returns a Promise; await waits for navigation before the next test action.
  // Promise<void> means completion is returned, without an additional result value.
  async open(url: string): Promise<void> {
    await this.actions.goto(url);
  }

  // Values are supplied at execution time, never embedded in locators or test titles.
  async submitCredentials(credentials: LoginCredentials): Promise<void> {
    await this.actions.enterSensitiveValue(this.username, credentials.username);
    await this.actions.enterSensitiveValue(this.password, credentials.password);
    await this.actions.click(this.loginButton);
  }

  // This Page is still the original tab even while another browser reads the OTP.
  // The test checks the logged-in screen after this action completes.
  async enterOtpAndValidate(otp: string): Promise<void> {
    await this.actions.enterSensitiveValue(this.otpInput, otp);
    await this.actions.click(this.validateButton);
  }
}
