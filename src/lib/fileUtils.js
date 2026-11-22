/**
 * fileUtils.js
 *
 * Shared utilities for handling the transition from stored full public URLs
 * to stored private object keys (paths only).
 *
 * LEGACY format:  https://ambercashph.sgp1.digitaloceanspaces.com/lms/clients/uuid/filename.png
 * NEW format:     lms/clients/uuid/filename.png
 */

const SPACES_BASE_URL = `https://${process.env.NEXT_PUBLIC_SPACES_BUCKET}.sgp1.digitaloceanspaces.com/`;

/**
 * Given either a full legacy URL or a storage key, always return the object key.
 * Returns null if the value is falsy or cannot be parsed.
 *
 * @param {string} urlOrKey
 * @returns {string|null}
 */
export function extractKeyFromValue(urlOrKey) {
  if (!urlOrKey || typeof urlOrKey !== 'string') return null;

  // Legacy full URL — strip the base to get the key
  if (urlOrKey.startsWith('https://') || urlOrKey.startsWith('http://')) {
    try {
      const url = new URL(urlOrKey);
      // Remove leading slash from pathname
      return url.pathname.replace(/^\//, '');
    } catch {
      return null;
    }
  }

  // Already a key
  return urlOrKey;
}

/**
 * Returns true if the stored value is a legacy full public URL.
 * Useful for migration scripts.
 *
 * @param {string} value
 * @returns {boolean}
 */
export function isLegacyUrl(value) {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('https://') || value.startsWith('http://');
}

/**
 * Build the internal API URL for fetching a signed URL.
 * Safe to call on both client and server (uses relative path on client).
 *
 * @param {string} keyOrUrl  - storage key or legacy full URL
 * @param {string} [baseUrl] - optional absolute base (for server-side usage)
 * @returns {string}
 */
export function buildSignedUrlEndpoint(keyOrUrl, baseUrl = '') {
  const key = extractKeyFromValue(keyOrUrl);
  if (!key) return '';
  return `${baseUrl}/api/signed-url?key=${encodeURIComponent(key)}`;
}

/**
 * Documents attached to a record may be a single key (legacy / one file) or
 * several keys. Multiple keys are stored as a JSON array string in the same
 * text column, so no schema change is needed and existing single-key rows
 * keep working untouched.
 *
 * @param {string|null|undefined} value - stored column value
 * @returns {string[]} list of keys / legacy URLs (empty when nothing stored)
 */
export function parseDocumentKeys(value) {
  if (!value || typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      if (Array.isArray(arr)) return arr.filter((k) => typeof k === 'string' && k);
    } catch {
      // not JSON — fall through and treat as a plain key
    }
  }
  return [value];
}

/**
 * Inverse of parseDocumentKeys. One key stays a plain string (backward
 * compatible); two or more become a JSON array string.
 *
 * @param {string[]} keys
 * @returns {string|null}
 */
export function serializeDocumentKeys(keys) {
  const clean = (keys || []).filter((k) => typeof k === 'string' && k);
  if (clean.length === 0) return null;
  return clean.length === 1 ? clean[0] : JSON.stringify(clean);
}
