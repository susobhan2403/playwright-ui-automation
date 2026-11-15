// Type-only imports describe Playwright objects; importing them does not launch a browser.
import type { Locator, Page } from '@playwright/test';
import { BrowserActions } from '../core/browser-actions';
import { loginSelectors } from './locators';

// The application decides whether its existing authentication session still needs OTP.
// pending/ambiguous are temporary states that the spec must keep polling, not skip as success.
export type AuthenticationState = 'pending' | 'otp-required' | 'authenticated' | 'ambiguous';

/**
 * Actions for Delta Dental's multi-page Dentist sign-in flow.
 * Each named method performs one phase; expected outcomes stay in the test.
 * The same Page reference survives navigation through the successive login screens.
 */
export class LoginPage {
  readonly dentistLink: Locator;
  readonly headerSignIn: Locator;
  readonly initialUsername: Locator;
  readonly continueButton: Locator;
  readonly username: Locator;
  readonly nextButton: Locator;
  readonly password: Locator;
  readonly signInButton: Locator;
  readonly emailRadio: Locator;
  readonly generateOtpButton: Locator;
  readonly otpInput: Locator;
  readonly otpLoginButton: Locator;
  readonly loggedInMarker: Locator;
  private readonly actions: BrowserActions;

  constructor(page: Page) {
    this.actions = new BrowserActions(page);
    // IDs and the supplied href/test attribute identify elements without positional selectors.
    // Locators are resolved again on each action, so navigation does not require element handles.
    this.dentistLink = page.locator(loginSelectors.dentistLink).first();
    this.headerSignIn = page.locator(loginSelectors.headerSignIn);
    this.initialUsername = page.locator(loginSelectors.initialUsername);
    this.continueButton = page.locator(loginSelectors.continueButton);
    this.username = page.locator(loginSelectors.username);
    this.nextButton = page.locator(loginSelectors.nextButton);
    this.password = page.locator(loginSelectors.password);
    this.signInButton = page.locator(loginSelectors.signInButton);
    this.emailRadio = page.locator(loginSelectors.emailRadio);
    this.generateOtpButton = page.locator(loginSelectors.generateOtpButton);
    this.otpInput = page.locator(loginSelectors.otpInput);
    this.otpLoginButton = page.locator(loginSelectors.otpLoginButton);
    this.loggedInMarker = page.locator(loginSelectors.loggedInMarker);
  }

  async open(url: string): Promise<void> {
    await this.actions.goto(url);
  }

  // The public home page precedes the application authentication screens.
  async openDentistSignIn(): Promise<void> {
    await this.actions.click(this.dentistLink);
    await this.actions.click(this.headerSignIn);
  }

  async submitInitialUsername(username: string): Promise<void> {
    // Standard fill waits for an editable field and replaces its current value.
    await this.actions.fill(this.initialUsername, username);
    await this.actions.click(this.continueButton);
  }

  // The identity-provider screen asks for the same username again after Continue.
  async submitUsername(username: string): Promise<void> {
    await this.actions.fill(this.username, username);
    await this.actions.click(this.nextButton);
  }

  async submitPassword(password: string): Promise<void> {
    await this.actions.fill(this.password, password);
    await this.actions.click(this.signInButton);
  }

  async authenticationState(): Promise<AuthenticationState> {
    // These are immediate observations. The spec retries them until exactly one outcome appears.
    // Do not cache a local 30-minute timer: the application's current screen is authoritative. // Wait for a short period to allow the page to update OTP and authentication states
    const [otpVisible, authenticatedVisible] = await Promise.all([
      this.emailRadio.isVisible(),
      this.loggedInMarker.isVisible(),
    ]);

    if (otpVisible && authenticatedVisible) return 'ambiguous';
    if (otpVisible) return 'otp-required';
    if (authenticatedVisible) return 'authenticated';
    return 'pending';
  }

  async requestEmailOtp(): Promise<void> {
    // check() chooses the radio's checked state and uses Playwright's built-in waiting.
    // Configure emailRadio to identify the actual radio control before using this action.
    await this.actions.click(this.emailRadio);
    await this.actions.click(this.generateOtpButton);
  }

  async enterOtpAndLogin(otp: string): Promise<void> {
    // This is still the original application browser after the separate inbox browser closes.
    await this.actions.fill(this.otpInput, otp);
    await this.actions.click(this.otpLoginButton);
  }
}
