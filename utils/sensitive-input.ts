// Locator is a TypeScript description of a Playwright element finder, not an element itself.
import type { Locator } from '@playwright/test';

/** Enter secrets without value-bearing fill titles in the built-in HTML report. */
// Use this helper for usernames, passwords, and OTPs instead of putting them in custom step names.
// Promise<void> means the asynchronous action finishes without returning a result.
export async function enterSensitiveValue(locator: Locator, value: string): Promise<void> {
  // An ordinary fill(secret) may include the filled value in the HTML report's action title.
  // An empty fill first waits for a visible, enabled, editable field and clears its current value.
  await locator.fill('');
  // evaluate runs this function in the web page. Its second argument carries the value separately.
  // The secret is not written as a literal in this function's source or in a custom report title.
  await locator.evaluate((element, secret) => {
    // The native value setter below is valid only for text inputs and text areas.
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLTextAreaElement)) {
      throw new Error('A sensitive-input locator must identify an input or textarea.');
    }
    // A prototype contains the standard browser behavior shared by all elements of that type.
    const prototype = element instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
    const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    if (setValue === undefined) {
      throw new Error('Unable to set the sensitive input value.');
    }
    // Set the field through the browser's native setter, then notify application event listeners.
    // This also supports many applications whose framework keeps its own input state.
    setValue.call(element, secret);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  // This reduces report-title exposure; it is not complete redaction of screenshots or traces.
  // Opt-in traces and application-rendered data may still contain sensitive information.
}
