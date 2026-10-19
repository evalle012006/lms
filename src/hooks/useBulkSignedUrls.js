import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

const BLOB_RE = /^blob:/i;

/**
 * Module-level cache — same pattern as useSignedUrl.
 * Shape: Map<storageKey, { url: string, expiresAt: number }>
 */
const _urlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000;

// One automatic retry after a failed request (flaky connection on first load).
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1500;

function getCached(key) {
  const entry = _urlCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - EXPIRY_BUFFER_MS) {
    _urlCache.delete(key);
    return null;
  }
  return entry.url;
}

function setCache(key, url, expiresInSeconds) {
  _urlCache.set(key, {
    url,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  });
}

// Everything we can show right now for these keys: blob previews as-is, plus
// whatever is already cached. Rebuilt from the cache each time, so a late answer
// for an earlier set of keys can never leave the map describing the wrong rows.
function buildMap(keys) {
  const map = {};
  keys.forEach((key) => {
    if (!key) return;
    if (BLOB_RE.test(key)) {
      map[key] = key;
      return;
    }
    const cached = getCached(key);
    if (cached) map[key] = cached;
  });
  return map;
}

/**
 * Resolves an array of storage keys / legacy DO Spaces URLs to signed URLs
 * in a single POST to /api/signed-url-bulk.
 *
 * Results are cached per-key. On subsequent calls, only keys that are missing
 * or expired are fetched — already-valid URLs are served from cache immediately.
 *
 * Behaviour that matters on first page load:
 *  - The API needs the session token. If it is not in the store yet nothing is
 *    requested (a request without it can only come back 401); the effect runs
 *    again the moment the token arrives.
 *  - The "same request already running" guard is released when the request ENDS,
 *    whether it succeeded or not. Before, it stayed set after a failure, so the
 *    identical request was refused forever and photos stayed as initials until
 *    the page or filter changed.
 *  - An answer for an earlier set of keys (fast paging) is cached but does not
 *    replace what is showing.
 *
 * @param {string[]} keys
 * @returns {{ urlMap: Record<string, string>, loading: boolean }}
 */
export function useBulkSignedUrls(keys = []) {
  const token = useSelector((state) => state.user?.data?.token);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const inFlightKey = useRef("");
  const latestKeys = useRef("");
  const attempts = useRef({ key: "", count: 0 });

  const keysKey = keys?.join("|") ?? "";

  useEffect(() => {
    latestKeys.current = keysKey;
    if (!keys || keys.length === 0) return;

    const deduped = [
      ...new Set(keys.filter((key) => key && !BLOB_RE.test(key) && !getCached(key))),
    ];

    // Everything is cached or a local preview — serve it now
    if (deduped.length === 0) {
      setUrlMap(buildMap(keys));
      return;
    }

    // Show what we already have while the rest is fetched
    setUrlMap(buildMap(keys));

    // Wait for the session token; this effect re-runs when it arrives
    if (!token) return;

    const fetchKey = deduped.slice().sort().join("|");

    // The same request is already running
    if (fetchKey === inFlightKey.current) return;
    inFlightKey.current = fetchKey;

    if (attempts.current.key !== fetchKey) attempts.current = { key: fetchKey, count: 0 };
    attempts.current.count += 1;

    setLoading(true);
    fetch("/api/signed-url-bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ keys: deduped }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const fetchedMap = data.urlMap || {};
        const expiresIn = data.expiresIn ?? 3600;

        // ✅ Cache each returned URL individually
        Object.entries(fetchedMap).forEach(([key, url]) => {
          setCache(key, url, expiresIn);
        });

        // Only update what is on screen if these are still the keys on screen
        if (latestKeys.current === keysKey) setUrlMap(buildMap(keys));
      })
      .catch((err) => {
        console.error("[useBulkSignedUrls]", err);
        if (attempts.current.key === fetchKey && attempts.current.count < MAX_ATTEMPTS) {
          setTimeout(() => setRetryTick((n) => n + 1), RETRY_DELAY_MS);
        }
      })
      .finally(() => {
        if (inFlightKey.current === fetchKey) {
          inFlightKey.current = "";
          setLoading(false);
        }
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysKey, token, retryTick]);

  return { urlMap, loading };
}