/**
 * Canonical phone format for this system: E.164 with a leading `+` and no
 * other punctuation (no spaces, dashes, or WhatsApp suffixes like `@c.us`).
 *
 * Examples:
 *   +919566831192   (valid)
 *   919566831192    (invalid — missing +)
 *   919566831192@c.us (invalid — WhatsApp JID suffix must be stripped before storage)
 *
 * Normalization (stripping the `@c.us`/`@g.us` suffix, adding the `+`) is
 * the responsibility of the integration layer that receives WhatsApp
 * payloads (n8n, in a later phase) before calling the backend API — the
 * database and entity validation only ever accept the canonical form.
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
