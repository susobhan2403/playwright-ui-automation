import {
  loadConfig,
  loadCredentials,
  loadOtpSourceCredentials,
} from '../config/config';
import { expect, test } from '../hooks/test';
import type { AuthenticationState } from '../pages/login-page';

// Discovery reads only non-secret settings. Secrets are resolved during execution.
const config = loadConfig();

test('LOGIN-001: Dentist signs in with OTP only when required', {
  tag: ['@smoke', '@regression'],
}, async ({ loginPage, withOtpSource }) => {
  // Both username screens use the same execution-time account snapshot.
  const applicationAccount = loadCredentials(config.environment);
  await test.step('Open Delta Dental and choose Dentist sign-in', async () => {
    await loginPage.open(config.loginURL);
    await loginPage.openDentistSignIn();
    await expect(loginPage.initialUsername).toBeEditable();
  });

  await test.step('Enter the username and click Continue', async () => {
    await loginPage.submitInitialUsername(applicationAccount.username);
    await expect(loginPage.username).toBeEditable();
  });

  await test.step('Enter the username again and click Next', async () => {
    await loginPage.submitUsername(applicationAccount.username);
    await expect(loginPage.password).toBeEditable();
  });

  await test.step('Enter the password and click Sign In', async () => {
    await loginPage.submitPassword(applicationAccount.password);
  });

  const authenticationState = await test.step(
    'Wait for either the OTP challenge or successful authentication',
    async () => {
      // Keep the last observation that satisfies the retrying assertion, rather than
      // checking isVisible() once before a slow navigation has finished.
      const observed: { value: AuthenticationState } = { value: 'pending' };
      await expect.poll(async () => {
        observed.value = await loginPage.authenticationState();
        return observed.value;
      }, {
        message: 'Sign-in should show either the OTP challenge or the authenticated screen',
        timeout: config.testTimeoutMs,
      }).toMatch(/^(otp-required|authenticated)$/);
      return observed.value;
    },
  );

  if (authenticationState === 'otp-required') {
    // Resolve the separate inbox account only when the application requests an OTP.
    const inboxAccount = loadOtpSourceCredentials(config.environment);

    await test.step('Choose Email and generate the OTP', async () => {
      await loginPage.requestEmailOtp();
      //await expect(loginPage.otpInput).toBeEditable();
    });

    const otp = await test.step('Retrieve the emailed OTP in an independent browser', async () => {
      return withOtpSource(async (otpSource) => {
        await test.step('Sign in to the QA back-office inbox', async () => {
          await otpSource.open(config.otpURL);
          await otpSource.signIn(inboxAccount);
          await otpSource.openInbox();
        });

        await test.step('Filter the inbox to the configured recipient', async () => {
          await otpSource.filterByRecipient(inboxAccount.recipientEmail);
          // Return a boolean so the recipient is not exposed in assertion values.
          await expect.poll(
            () => otpSource.isFirstResultForRecipient(inboxAccount.recipientEmail),
            {
              message: 'The first inbox result should match the configured recipient',
              timeout: config.testTimeoutMs,
            },
          ).toBe(true);
        });

        await test.step('Open the first matching email and wait for its OTP', async () => {
          await otpSource.openFirstEmail();
          await expect(otpSource.emailBody).toBeVisible();
          await expect.poll(
            () => otpSource.hasOtp(config.otpPattern),
            {
              message: 'The opened email should contain the OTP instruction and code',
              timeout: config.testTimeoutMs,
            },
          ).toBe(true);
        });

        return otpSource.readOtp(config.otpPattern);
      });
    });

    await test.step('Enter the OTP in the original browser and click Login', async () => {
      await loginPage.enterOtpAndLogin(otp);
      await expect(loginPage.otpInput).toBeHidden();
    });
  }

  // Absence of an OTP challenge alone never counts as a successful login.
  const verificationStep = authenticationState === 'authenticated'
    ? 'Verify successful login without an OTP challenge'
    : 'Verify successful login after OTP validation';
  await test.step(verificationStep, async () => {
    await expect(loginPage.loggedInMarker).toBeVisible();
  });
});
