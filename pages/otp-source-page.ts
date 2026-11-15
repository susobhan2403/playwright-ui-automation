// A Page is one browser tab; Locator describes how to find a current element.
import type { Locator, Page } from '@playwright/test';
import type { Credentials } from '../config/config';
import { BrowserActions } from '../core/browser-actions';
import { extractOtp } from '../utils/otp';
import { OTP_EMAIL_PREFIX, otpSourceSelectors } from './locators';

/**
 * Authenticates the independent back-office browser and reads one filtered email.
 * It shares no cookies with the original Delta Dental login browser.
 */
export class OtpSourcePage {
  readonly resultsTable: Locator;
  readonly emailBody: Locator;

  private readonly actions: BrowserActions;
  private readonly signInButton: Locator;
  private readonly username: Locator;
  private readonly password: Locator;
  private readonly loginButton: Locator;
  private readonly authServiceMenu: Locator;
  private readonly inboxMenu: Locator;
  private readonly recipientSearch: Locator;
  private readonly firstResultRow: Locator;

  constructor(private readonly page: Page) {
    this.actions = new BrowserActions(page);
    // Stable classes/named inputs are supplied by the actual authentication page.
    this.signInButton = page.locator(otpSourceSelectors.signInButton);
    this.username = page.locator(otpSourceSelectors.username);
    this.password = page.locator(otpSourceSelectors.password);
    this.loginButton = page.locator(otpSourceSelectors.loginButton);
    // Exact text avoids matching a longer menu label containing the same words.
    this.authServiceMenu = page.getByText(otpSourceSelectors.authServiceText, { exact: true });
    this.inboxMenu = page.getByText(otpSourceSelectors.inboxText, { exact: true });
    this.recipientSearch = page.getByPlaceholder(
      otpSourceSelectors.recipientSearchPlaceholder,
      { exact: true },
    );
    // Native HTML tables have the table role. Do not silently select an arbitrary table.
    this.resultsTable = page.getByRole('table');
    // The requested workflow deliberately chooses the first data row, not the header row.
    this.firstResultRow = this.resultsTable.locator('tbody > tr').first();
    // CDK dialog IDs are generated dynamically. The stable modal component and fixed
    // email instruction scope the email body without depending on nested table positions.
    this.emailBody = page.locator(otpSourceSelectors.messageContainer)
      .filter({ hasText: OTP_EMAIL_PREFIX });
  }

  async open(url: string): Promise<void> {
    await this.actions.goto(url);
  }

  // The OTP service has its own account; do not assume application credentials work here.
  async signIn(credentials: Credentials): Promise<void> {
    await this.actions.click(this.signInButton);
    await this.actions.fill(this.username, credentials.username);
    await this.actions.fill(this.password, credentials.password);
    await this.actions.click(this.loginButton);
  }

  async openInbox(): Promise<void> {
    await this.authServiceMenu.waitFor({ state: 'visible' });
    // A deep link or saved menu state can already have this section expanded.
    // Avoid toggling an open section closed before attempting to click Inbox.
    if (!(await this.inboxMenu.isVisible())) {
      await this.actions.click(this.authServiceMenu);
    }
    await this.actions.click(this.inboxMenu);
    await this.resultsTable.waitFor({ state: 'visible' });
    await this.recipientSearch.waitFor({ state: 'visible' });
  }

  async filterByRecipient(recipientEmail: string): Promise<void> {
    // Standard fill replaces the search text and emits the input event for filtering.
    await this.actions.fill(this.recipientSearch, recipientEmail);
    // Some Angular inputs bind filtering to keyup instead of input/change. End emits
    // a harmless key event without putting the recipient address into a key action title.
    await this.recipientSearch.press('End');
  }

  // The spec polls this boolean before opening the first email. Returning a boolean
  // keeps actual inbox addresses out of assertion expected/received values.
  async isFirstResultForRecipient(recipientEmail: string): Promise<boolean> {
    const expectedRecipient = recipientEmail.trim().toLowerCase();
    if (!expectedRecipient || !(await this.firstResultRow.isVisible())) return false;

    const activeFilter = (await this.recipientSearch.inputValue()).trim().toLowerCase();
    if (activeFilter !== expectedRecipient) return false;

    // Resolve the recipient column from its header rather than guessing its position.
    // A target address in From or Subject must not make an unrelated To row eligible.
    const recipientColumn = await this.recipientColumnIndex();
    const recipientCell = this.firstResultRow.locator(':scope > td').nth(recipientColumn);
    if (await recipientCell.count() !== 1) return false;
    const recipientText = (await recipientCell.textContent()) ?? '';
    // Split only address separators/wrappers, not dots, hyphens, or plus-address suffixes.
    // An exact token comparison rejects similar recipients such as a prefixed address.
    const addressTokens = recipientText.split(/[\s<>,;:()[\]"]+/);
    return addressTokens.some((token) => {
      // Apostrophes are valid inside an email's local part, such as o'connor.
      // Remove only a pair of presentation quotes around the entire address.
      const address = token.startsWith("'") && token.endsWith("'")
        ? token.slice(1, -1)
        : token;
      return address.toLowerCase() === expectedRecipient;
    });
  }

  private async recipientColumnIndex(): Promise<number> {
    // CSS includes hidden headers, unlike a default visible-only role lookup. Their
    // positions must remain aligned with the row's direct td cells.
    const headers = await this.resultsTable.locator('thead > tr').last()
      .locator(':scope > th, :scope > td')
      .evaluateAll((elements) => elements.map((element) => ({
        label: element.textContent ?? '',
        columnSpan: element instanceof HTMLTableCellElement ? element.colSpan : 1,
      })));
    const aliases = new Set([
      'to', 'toemail', 'toemailaddress',
      'recipient', 'recipientemail', 'recipientemailaddress',
    ]);
    const matches = headers
      .map((header, index) => ({ ...header, index }))
      .filter((header) => aliases.has(header.label.toLowerCase().replace(/[^a-z]/g, '')));

    // Do not silently inspect a different column if labels are missing/ambiguous,
    // or if grouped headers make physical column positions uncertain.
    if (matches.length !== 1 || headers.some((header) => header.columnSpan !== 1)) {
      throw new Error(
        'Cannot identify one unambiguous To/recipient email column in the inbox table. '
        + 'Update its header aliases or provide an explicit recipient-cell locator.',
      );
    }
    const match = matches[0];
    if (match === undefined) {
      throw new Error('The inbox recipient header could not be resolved.');
    }
    return match.index;
  }

  async openFirstEmail(): Promise<void> {
    // The fourth data cell is explicitly supplied by the workflow. Scope the action
    // to that cell so another row's Eye icon cannot be clicked accidentally.
    const actionCell = this.firstResultRow.locator(':scope > td').nth(3);
    await actionCell.waitFor({ state: 'visible' });
    await actionCell.locator('svg').waitFor({ state: 'visible' });

    // Prefer an accessible interactive control wrapping the SVG, when the app provides one.
    const svg = this.page.locator('svg');
    const viewControl = actionCell.getByRole('button').filter({ has: svg })
      .or(actionCell.getByRole('link').filter({ has: svg }));
    const controlCount = await viewControl.count();
    if (controlCount > 1) {
      throw new Error('The email action cell contains multiple view controls; narrow its locator.');
    }
    if (controlCount === 1) {
      await this.actions.click(viewControl);
    } else {
      // CSS svg works for SVG elements without XPath namespace/local-name workarounds.
      // A normal click bubbles to the application's dxc-icon/fa-icon click handler.
      await this.actions.click(actionCell.locator('svg'));
    }
    // This is an HTML/CDK modal in the inbox page, not another browser window.
    await this.emailBody.waitFor({ state: 'visible' });
  }

  async hasOtp(pattern: string): Promise<boolean> {
    if (!(await this.emailBody.isVisible())) return false;
    return new RegExp(pattern).test(await this.emailBody.innerText());
  }

  async readOtp(pattern: string): Promise<string> {
    await this.emailBody.waitFor({ state: 'visible' });
    // innerText reads the displayed email/table text. The context-specific pattern
    // captures only the code after the fixed instruction, not phone numbers or dates.
    return extractOtp(await this.emailBody.innerText(), pattern);
  }
}
