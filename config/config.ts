// Node.js provides these file/path helpers; no extra npm package is needed to read JSON.
// Imports make functions declared in another module available in this file.
import { existsSync, readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

// A type describes allowed values for TypeScript. The | symbol means "or".
// This catches a misspelled browser name while developing; loadConfig also checks it at runtime.
export type BrowserName = 'chromium' | 'firefox' | 'webkit';

// An interface describes the shape of an object passed between framework components.
// readonly prevents accidental reassignment in TypeScript; it does not lock the JSON file.
// This object deliberately contains no username or password, so the runner can use it safely.
export interface FrameworkConfig {
  readonly environment: string; // The selected key under framework.json's environments object.
  readonly browser: BrowserName; // The browser engine: Chromium, Firefox, or WebKit.
  readonly headless: boolean; // true hides the browser window; false displays it.
  readonly workers: number; // How many test workers Playwright may run at the same time.
  readonly testTimeoutMs: number; // Milliseconds: 1000 milliseconds equals one second.
  readonly trace: 'retain-on-failure' | 'off'; // Keep failed-run traces only when explicitly enabled.
  readonly loginURL: string; // The application login address for the selected environment.
  readonly otpURL: string; // The separate web page from which the current OTP will be read.
  readonly otpPattern: string; // A regular-expression pattern used to recognize the OTP text.
}

// Credentials have a separate type and loader so secrets are not mixed into report settings.
export interface Credentials {
  readonly username: string;
  readonly password: string;
}

// The inbox is a separate application with its own account. The recipient identifies
// which user's email to open; it is not assumed to be the dentist application's username.
export interface OtpSourceCredentials extends Credentials {
  readonly recipientEmail: string;
}

// Helpers without export are used only inside this file. A return type of never means
// this function always throws an error instead of returning a normal value.
// Errors name the setting to fix without printing its potentially sensitive value.
function invalid(message: string): never {
  throw new Error(`Invalid framework configuration: ${message}`);
}

// JSON can contain arrays, strings, numbers, or objects. This "type guard" confirms that
// a value is an object before code reads named properties such as environment or username.
// Record<string, unknown> means "an object with string keys whose values need checking".
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Read a small configuration file synchronously, then convert its JSON text to an object.
// unknown keeps unvalidated JSON from being treated as trusted TypeScript configuration.
// JSON.parse checks JSON syntax; the helpers below check the meaning and types of its fields.
function readObject(filename: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(filename, 'utf8')) as unknown;
  } catch {
    // basename reports only the filename, never the file's credential contents.
    return invalid(`${basename(filename)} must exist and contain valid JSON.`);
  }
  if (!isObject(data)) return invalid(`${basename(filename)} must contain a JSON object.`);
  return data;
}

// Required text must really be a string and contain something other than spaces.
// trim is used only to check emptiness; the original value is returned unchanged.
function nonblank(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    return invalid(`${name} must be a nonblank string.`);
  }
  return value;
}

// JSON uses boolean values, but environment variables are strings. Accept the explicit
// true/false forms of each. Do not use Boolean('false'): that would incorrectly mean true.
function booleanSetting(value: unknown, name: string): boolean {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return invalid(`${name} must be true or false.`);
}

// Validate worker counts/timeouts rather than silently accepting zero, negative values,
// decimals, or text. The upper limit also stays within the supported timer range.
function positiveInteger(value: unknown, name: string): number {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) {
    return invalid(`${name} must be a positive integer.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > 2_147_483_647) {
    return invalid(`${name} must be between 1 and 2147483647.`);
  }
  return number;
}

// REPLACE_ values are instructions for the person configuring this checkout, not real data.
function isPlaceholder(value: string): boolean {
  return value.startsWith('REPLACE_');
}

// Discovery must be able to list tests before application details are filled in.
// allowPlaceholder=true permits that; the execution readiness check uses false instead.
// A real address must be an absolute HTTP(S) URL, and credentials must not be embedded in it.
function applicationURL(value: unknown, name: string, allowPlaceholder: boolean): string {
  const text = nonblank(value, name);
  if (isPlaceholder(text)) {
    if (allowPlaceholder) return text;
    return invalid(`Set ${name} in config/framework.json before running the login test.`);
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return invalid(`${name} must be an absolute HTTP(S) URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return invalid(`${name} must be an HTTP(S) URL without embedded credentials.`);
  }
  return url.href;
}

/**
 * Load non-secret settings for the runner and tests. This does not read credential files.
 * export lets another file import this function. The default parameter reads the current
 * process environment; a caller can provide an alternative object when checking the loader.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): FrameworkConfig {
  // __dirname is this file's directory, so loading works independently of the shell location.
  const source = readObject(resolve(__dirname, 'framework.json'));
  // ?? means "use the right-hand value only if the left-hand value is null or undefined".
  // Environment variables override JSON. An explicitly blank override is rejected, not ignored.
  const environment = nonblank(env.TEST_ENV ?? source.environment, 'environment / TEST_ENV');
  if (!isObject(source.environments)) return invalid('framework.json requires environments.');
  // Use the selected environment name as a key, such as environments['qa'].
  const profile = source.environments[environment];
  if (!isObject(profile)) return invalid('TEST_ENV must identify an environment in config/framework.json.');

  const browser = env.BROWSER ?? source.browser;
  if (browser !== 'chromium' && browser !== 'firefox' && browser !== 'webkit') {
    return invalid('browser / BROWSER must be chromium, firefox, or webkit.');
  }
  // Constructing RegExp checks the pattern's syntax now; it does not read an OTP yet.
  const otpPattern = nonblank(source.otpPattern, 'otpPattern');
  try {
    new RegExp(otpPattern);
  } catch {
    return invalid('otpPattern must be a valid regular expression.');
  }

  // Return one validated settings object. Each override is checked before Playwright uses it.
  // The profile supplies the selected environment's URLs; shared settings come from the top level.
  return {
    environment,
    browser,
    headless: booleanSetting(env.HEADLESS ?? source.headless, 'headless / HEADLESS'),
    workers: positiveInteger(source.workers, 'workers'),
    testTimeoutMs: positiveInteger(env.TEST_TIMEOUT_MS ?? source.testTimeoutMs, 'testTimeoutMs / TEST_TIMEOUT_MS'),
    trace: booleanSetting(env.QA_TRACE ?? source.trace, 'trace / QA_TRACE') ? 'retain-on-failure' : 'off',
    loginURL: applicationURL(env.BASE_URL ?? profile.loginURL, 'loginURL / BASE_URL', true),
    otpURL: applicationURL(env.OTP_URL ?? profile.otpURL, 'otpURL / OTP_URL', true),
    otpPattern,
  };
}

/**
 * Validate application addresses during execution, not discovery. A password-only
 * login needs only the primary URL; defer the inbox URL check until OTP is requested.
 * Existing callers still validate both URLs when they omit the options argument.
 */
export function assertApplicationConfigured(
  config: FrameworkConfig,
  options: { requireOtpSource?: boolean } = {},
): void {
  applicationURL(config.loginURL, 'loginURL / BASE_URL', false);
  if (options.requireOtpSource ?? true) {
    applicationURL(config.otpURL, 'otpURL / OTP_URL', false);
  }
}

// Both applications use the same environment key, but separate credential fields.
// This helper reads the private file only when an execution-time loader needs it.
function readCredentialProfile(environment: string): Record<string, unknown> {
  const localFile = resolve(__dirname, 'credentials.local.json');
  const filename = existsSync(localFile) ? localFile : resolve(__dirname, 'credentials.example.json');
  const source = readObject(filename);
  const profile = source[environment];
  if (!isObject(profile)) {
    return invalid('The selected environment requires credentials in config/credentials.local.json.');
  }
  return profile;
}

/**
 * Resolve the username/password during test execution, not during test discovery.
 * The private .local.json file may contain both local and qa sections: "local" in its
 * filename means a machine-local private copy, not a restriction to the local environment.
 * CI means continuous integration, such as an automated run on a build server.
 */
export function loadCredentials(
  environment: string,
  env: NodeJS.ProcessEnv = process.env,
): Credentials {
  let stored: Record<string, unknown> = {};
  // If both secret environment variables exist, no credential file is needed.
  // With only one override, the missing value is taken from the selected file section.
  if (env.APP_USERNAME === undefined || env.APP_PASSWORD === undefined) {
    stored = readCredentialProfile(environment);
  }
  // The selected JSON key must match TEST_ENV/framework.json's environment value.
  // Never print these variables, put them in test names, or add them to report metadata.
  const username = nonblank(env.APP_USERNAME ?? stored.username, 'credentials.username / APP_USERNAME');
  const password = nonblank(env.APP_PASSWORD ?? stored.password, 'credentials.password / APP_PASSWORD');
  if (isPlaceholder(username) || isPlaceholder(password)) {
    return invalid('Copy config/credentials.example.json to config/credentials.local.json and replace its placeholders, or set APP_USERNAME and APP_PASSWORD.');
  }
  return { username, password };
}

/** Resolve the back-office account and intended email recipient during execution. */
export function loadOtpSourceCredentials(
  environment: string,
  env: NodeJS.ProcessEnv = process.env,
): OtpSourceCredentials {
  let stored: Record<string, unknown> = {};
  // CI may provide all three values. Partial overrides use the matching private-file fields.
  if (
    env.OTP_SOURCE_USERNAME === undefined ||
    env.OTP_SOURCE_PASSWORD === undefined ||
    env.OTP_RECIPIENT_EMAIL === undefined
  ) {
    const profile = readCredentialProfile(environment);
    if (!isObject(profile.otpSource)) {
      return invalid('Add otpSource.username, otpSource.password, and otpSource.recipientEmail under the selected environment in config/credentials.local.json.');
    }
    stored = profile.otpSource;
  }

  const username = nonblank(env.OTP_SOURCE_USERNAME ?? stored.username, 'otpSource.username / OTP_SOURCE_USERNAME');
  const password = nonblank(env.OTP_SOURCE_PASSWORD ?? stored.password, 'otpSource.password / OTP_SOURCE_PASSWORD');
  const recipientEmail = nonblank(env.OTP_RECIPIENT_EMAIL ?? stored.recipientEmail, 'otpSource.recipientEmail / OTP_RECIPIENT_EMAIL');
  if ([username, password, recipientEmail].some(isPlaceholder)) {
    return invalid('Replace the otpSource placeholders in config/credentials.local.json, or set OTP_SOURCE_USERNAME, OTP_SOURCE_PASSWORD, and OTP_RECIPIENT_EMAIL.');
  }
  // Validate the address without including it in an exception, test title, or locator string.
  if (recipientEmail !== recipientEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    return invalid('otpSource.recipientEmail / OTP_RECIPIENT_EMAIL must be a valid email address without surrounding spaces.');
  }
  return { username, password, recipientEmail };
}
