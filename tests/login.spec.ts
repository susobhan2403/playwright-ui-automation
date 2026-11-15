// Configuration helpers load non-secret settings and validate application setup.
import { assertApplicationConfigured, loadConfig, loadCredentials } from '../config/config';
// Import this framework's extended test, so its loginPage/withOtpSource fixtures exist.
import { expect, test } from '../hooks/test';
import { assertLocatorsConfigured } from '../pages/locators';

// This runs during test discovery. The returned config contains no username/password.
const config = loadConfig();

// beforeAll runs before the test body and before its browser/page fixtures are requested.
// Discovery can list the test with placeholders; execution must have real application setup.
test.beforeAll(() => {
  assertApplicationConfigured(config);
  assertLocatorsConfigured();
  // Validate credentials now, then load them again only where the test actually uses them.
  loadCredentials(config.environment);
});

// A stable case ID makes this test easy to locate with --grep and in the HTML report.
// Tags are filter labels: both smoke/regression currently select this single test.
test('LOGIN-001: Log in with valid credentials and OTP', {
  tag: ['@smoke', '@regression'],
}, async ({ loginPage, withOtpSource }) => {
  // The braces above request named fixtures; Playwright supplies their prepared values.
  // test.step groups meaningful actions under readable labels in the report.
  await test.step('Open the application login page', async () => {
    await loginPage.open(config.loginURL);
  });

  await test.step('Enter valid credentials and click Login', async () => {
    // Resolve secrets during execution, and never place them in this step's title.
    await loginPage.submitCredentials(loadCredentials(config.environment));
  });

  await test.step('Verify navigation to the OTP page', async () => {
    // Locator assertions retry until the condition is met or the assertion timeout expires.
    // They are checks of expected behavior, so they stay in the test rather than page actions.
    await expect(loginPage.otpPageMarker).toBeVisible();
    await expect(loginPage.otpInput).toBeEditable();
  });

  // The step returns a string. It stays in memory; no operating-system clipboard is needed.
  const otp = await test.step('Read the OTP in a separate browser instance', async () => {
    // Calling this fixture function launches the second browser only at this point.
    // Its callback receives the source page and the fixture closes that browser afterward.
    return withOtpSource(async (otpSource) => {
      await otpSource.open(config.otpURL);
      await expect(otpSource.code).toBeVisible();
      // Poll repeatedly checks a boolean until a code appears, instead of using a fixed sleep.
      // Returning true/false avoids putting the OTP itself into assertion expected/actual values.
      await expect.poll(async () => {
        const text = (await otpSource.code.textContent()) ?? '';
        return new RegExp(config.otpPattern).test(text);
      }, {
        message: 'The OTP source should display an available code',
        timeout: config.testTimeoutMs,
      }).toBe(true);
      // Extraction rejects no matches, ambiguous multiple matches, and empty codes.
      return otpSource.readOtp(config.otpPattern);
    });
  });

  await test.step('Enter the OTP in the original browser and click Validate', async () => {
    // loginPage still refers to the first browser; no browser-window switching is required.
    await loginPage.enterOtpAndValidate(otp);
  });

  await test.step('Verify successful login', async () => {
    // Check positive evidence of login as well as departure from the OTP screen.
    await expect(loginPage.loggedInMarker).toBeVisible();
    await expect(loginPage.otpPageMarker).toBeHidden();
  });
});
