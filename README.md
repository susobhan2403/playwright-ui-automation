# UI automation framework

For a complete beginner walkthrough, read the [PDF user guide](output/pdf/playwright-framework-user-guide.pdf). It explains setup, every framework component, the OTP flow, troubleshooting, and how to add tests.

TypeScript, Node.js, npm, and Playwright Test. The suite contains one application login test with locator placeholders. Requires Node.js 22+.

## Files to edit

| File | What to put here |
| --- | --- |
| `config/framework.json` | Selected environment, browser settings, and login/OTP URLs for each environment |
| `config/credentials.local.json` | Your real username/password under the matching environment key; ignored by Git |
| `config/credentials.example.json` | Placeholder credential template; keep it in the repository and do not put real secrets here |
| `pages/locators.ts` | Your application's test IDs for login, OTP, and successful login |

Keep both credential files: edit the `.local.json` file for execution and keep the `.example.json` file as the template for another checkout or teammate. `APP_USERNAME` and `APP_PASSWORD`, when set, override the stored values.

## Configure your application

1. In `config/framework.json`, set the top-level `"environment"` to `"local"` (the default) or `"qa"`. Fill `loginURL` and `otpURL` inside the matching `environments.local` or `environments.qa` section. Choose `browser`, `headless`, worker count, and timeout in the same file. Configure `otpPattern` if the OTP is not six digits.
2. Edit `config/credentials.local.json` (a placeholder copy is present in this checkout). For a fresh clone, create it from the template if it is absent:

   PowerShell:
   ```powershell
   if (-not (Test-Path config/credentials.local.json)) {
     Copy-Item config/credentials.example.json config/credentials.local.json
   }
   ```

   Bash:
   ```bash
   test -e config/credentials.local.json || cp config/credentials.example.json config/credentials.local.json
   ```

   Enter the valid username and password under the matching environment key (`local` or `qa`) in `config/credentials.local.json`. This file is ignored by Git. Commit only the placeholder template.
3. Replace the eight test IDs in `pages/locators.ts`: username, password, Login button, OTP page marker, OTP input, Validate button, logged-in marker, and OTP-source code.
4. Scope the OTP-source locator to one element containing the current user's latest OTP. The OTP URL must be accessible in a fresh browser with no application session. If the source requires additional navigation or authentication, add those application-specific actions to `pages/otp-source-page.ts`.

The test fails with an actionable setup error until URLs, locators, and credentials are configured. Discovery and type checking work with placeholders; unconfigured execution is never reported as a passing login.

## Login flow

`tests/login.spec.ts` registers only `LOGIN-001`:

1. Playwright launches the primary browser and gives the test an isolated page/context.
2. Open the login URL, enter valid credentials, and click Login.
3. Assert that the OTP page and editable OTP input are visible.
4. Launch a second, independent browser process, open the OTP URL, wait for a code, and extract it.
5. Close the second browser and enter the code in the original login page.
6. Click Validate and assert the logged-in marker is visible and the OTP page marker is hidden.

No clipboard access is needed. The OTP is transferred directly in memory. The second browser uses the selected browser engine and headless setting. It closes after the lookup, on errors, and during fixture teardown. Playwright owns the primary browser's lifecycle.

## Run

These commands work in PowerShell and Bash:

```text
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run test:smoke
npm run test:regression
npm run report
```

The single login test carries both `@smoke` and `@regression`. Install additional engines with `npx playwright install firefox webkit`. Linux CI can use `npx playwright install --with-deps chromium`.

Discovery or selection by case ID:

```powershell
npm.cmd test -- --list
npm.cmd test -- --grep LOGIN-001
```

```bash
npm test -- --list
npm test -- --grep LOGIN-001
```

Use `npm.cmd` when forwarding flags in PowerShell; this avoids Windows npm.ps1 shim argument handling.

## Configuration and overrides

`config/framework.json` stores browser/environment settings and URLs. Its top-level `environment` selects which environment section to use; `TEST_ENV` overrides that selection for a run. `config/credentials.local.json` stores private credentials under the same environment keys. Add an environment key to both files to support another environment without editing the runner.

Optional environment variables override files, including CI secret injection:

| Variable | Setting |
| --- | --- |
| `TEST_ENV` | Selected environment key |
| `BASE_URL` | Login URL |
| `OTP_URL` | OTP source URL |
| `BROWSER` | `chromium`, `firefox`, or `webkit` |
| `HEADLESS` | Exactly `true` or `false` |
| `TEST_TIMEOUT_MS` | Positive integer milliseconds |
| `APP_USERNAME`, `APP_PASSWORD` | Override stored credentials |
| `QA_TRACE` | Exactly `true` or `false`; override trace setting |

PowerShell:

```powershell
$env:TEST_ENV = 'qa'
$env:BROWSER = 'firefox'
$env:HEADLESS = 'false'
npm test
Remove-Item Env:TEST_ENV, Env:BROWSER, Env:HEADLESS
```

Bash:

```bash
TEST_ENV=qa BROWSER=firefox HEADLESS=false npm test
```

For CI, inject both credential variables through the CI secret store. Credentials and OTPs are resolved during execution, never added to test titles or report metadata. Input helpers avoid value-bearing fill titles. Do not put secrets in URL query strings, fragments, locator names, or logged-in marker text. `.env` files are not loaded automatically.

## Structure

- `config/`: JSON settings, credential template, and typed loading/validation.
- `core/browser-actions.ts`: common browser actions and independent-browser lifecycle.
- `utils/`: sensitive input and OTP extraction utilities.
- `hooks/test.ts`: typed page fixtures and lazy second-browser fixture.
- `pages/`: application locators and page actions.
- `tests/login.spec.ts`: the one login flow and its assertions.
- `playwright.config.ts`: single CLI/IDE/CI entry point.

Add common browser operations to `core/`, reusable utility functions to `utils/`, and application actions to `pages/`.

The built-in HTML reporter writes to `playwright-report/`; open it with `npm run report`. The project name and metadata identify the environment and browser. Failure screenshots and optional traces for the primary application browser are captured by Playwright. Traces default to off for credential/OTP flows; opt in through the config file or `QA_TRACE=true`. Trace data and screenshots can include application-rendered sensitive data.

Generated reports and test artifacts are written to `playwright-report/` and `test-results/`; both are ignored by Git.
