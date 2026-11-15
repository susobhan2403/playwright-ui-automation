/**
 * These are eight deliberately unfinished application test IDs, not working selectors.
 * Replace each value with the actual data-testid attribute from your application's HTML.
 * Example of the relationship: data-testid="login-user" is found by getByTestId('login-user').
 * The test ID should identify one intended element on the relevant page.
 *
 * Keep the OTP source scoped to the current user's latest code, not all rows in an inbox.
 * For role/label locators, change the corresponding page-object locator and also update
 * this readiness check so unused placeholder definitions do not keep blocking execution.
 */
export const loginLocators = {
  // Login form input fields and its submit button.
  username: 'REPLACE_WITH_USERNAME_TEST_ID',
  password: 'REPLACE_WITH_PASSWORD_TEST_ID',
  loginButton: 'REPLACE_WITH_LOGIN_BUTTON_TEST_ID',
  // A page marker is a stable element that proves the expected screen is displayed.
  otpPageMarker: 'REPLACE_WITH_OTP_PAGE_MARKER_TEST_ID',
  otpInput: 'REPLACE_WITH_OTP_INPUT_TEST_ID',
  validateButton: 'REPLACE_WITH_VALIDATE_BUTTON_TEST_ID',
  // Choose an element that appears only after authentication has succeeded.
  loggedInMarker: 'REPLACE_WITH_LOGGED_IN_MARKER_TEST_ID',
  // This element is on the separately opened OTP source, not the application's OTP form.
  otpSourceCode: 'REPLACE_WITH_OTP_SOURCE_CODE_TEST_ID',
} as const; // Keep the strings as fixed TypeScript values rather than mutable properties.

// Called before the test requests browser/page fixtures, so missing setup fails clearly.
export function assertLocatorsConfigured(): void {
  // Object.entries converts the object to [name, value] pairs.
  // filter keeps unfinished definitions; map keeps their friendly names for the error.
  const missing = Object.entries(loginLocators)
    .filter(([, value]) => !value.trim() || value.startsWith('REPLACE_WITH_'))
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(
      `Configure the application's locators in pages/locators.ts before running the login test: ${missing.join(', ')}.`,
    );
  }
}
