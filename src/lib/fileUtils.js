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