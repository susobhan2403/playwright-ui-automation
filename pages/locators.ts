/**
 * Stable application attributes supplied for the real Dentist sign-in journey.
 * Exact IDs and hrefs are preferable to long DOM-position XPath expressions.
 * HeaderSignInButton uses data-test-id (with two hyphens), so it is deliberately
 * selected with CSS instead of Playwright's default data-testid convention.
 */
export const loginSelectors = {
  dentistLink: 'a[href="/dentist"]',
  headerSignIn: '[data-test-id="HeaderSignInButton"]',
  initialUsername: '#lblUserName',
  continueButton: '#checkUsernameButton',
  username: '#usernameInput',
  nextButton: '#verify-user',
  password: '#passwordInput',
  signInButton: '#verify-pass',
  // Replace with the actual radio input/role=radio element, not its decorative wrapper.
  emailRadio: 'REPLACE_WITH_EMAIL_RADIO_SELECTOR',
  generateOtpButton: 'REPLACE_WITH_GENERATE_OTP_BUTTON_SELECTOR',
  // The OTP field and successful-login marker were not supplied; do not guess their IDs.
  otpInput: 'REPLACE_WITH_OTP_INPUT_SELECTOR',
  otpLoginButton: 'REPLACE_WITH_OTP_LOGIN_BUTTON_SELECTOR',
  loggedInMarker: 'REPLACE_WITH_LOGGED_IN_MARKER_SELECTOR',
} as const;

/**
 * Stable selectors and visible navigation text for the independent back-office browser.
 * Keep authentication values and the recipient email in private configuration, not here.
 */
export const otpSourceSelectors = {
  signInButton: '.sign-in-btn',
  username: 'input[name="username"]',
  password: 'input[name="password"]',
  loginButton: '.btn-success',
  authServiceText: 'Auth Service',
  inboxText: 'Inbox',
  recipientSearchPlaceholder: 'Search by To email',
  // Scope message reading to the stable modal component instead of a changing cdk-dialog ID.
  messageContainer: 'dxc-modal-container',
} as const;

// Anchor OTP extraction to the email's instruction, rather than unrelated numbers in the body.
export const OTP_EMAIL_PREFIX = 'Please enter the following code on your screen:';
