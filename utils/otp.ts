// This utility has no browser dependency: it receives text and returns a single code.
// A regular expression (regex) is a pattern used to find part of a string.
/** Extract one OTP using the first capture group, or the complete regex match. */
export function extractOtp(text: string, pattern: string): string {
  // Reject an empty pattern instead of accidentally accepting an empty OTP.
  if (pattern.trim().length === 0) {
    throw new Error('The OTP pattern must not be blank.');
  }

  let expression: RegExp;
  try {
    // "g" means global: collect every match so we can detect multiple possible OTPs.
    // Invalid regex syntax throws; the catch below converts it to a useful setup message.
    expression = new RegExp(pattern, 'g');
  } catch {
    throw new Error('The OTP pattern must be a valid regular expression.');
  }

  // matchAll produces matches one by one; [...] collects them into an array.
  const matches = [...text.matchAll(expression)];
  if (matches.length === 0) {
    throw new Error('No OTP matched the configured pattern in the OTP source.');
  }
  if (matches.length > 1) {
    // Do not guess when several codes appear. Narrow the page locator to the correct user's code.
    throw new Error('More than one OTP matched; narrow the OTP source locator or pattern.');
  }

  const match = matches[0];
  // match[0] is the full match; match[1] is the first parenthesized capture group, if present.
  // "?." safely handles a missing match; "??" chooses the next value only for null/undefined.
  // trim() removes surrounding spaces. Leading zeroes inside the code remain intact.
  const otp = (match?.[1] ?? match?.[0] ?? '').trim();
  if (otp.length === 0) {
    throw new Error('The configured OTP pattern produced an empty value.');
  }
  // Error messages deliberately omit the source text and actual code.
  return otp;
}
