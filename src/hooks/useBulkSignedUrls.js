import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

const BLOB_RE = /^blob:/i;

/**
 * Module-level cache — same pattern as useSignedUrl.
 * Shape: Map<storageKey, { url: string, expiresAt: number }>
 */
const _urlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000;

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

/**
 * Resolves an array of storage keys / legacy DO Spaces URLs to signed URLs
 * in a single POST to /api/signed-url-bulk.
 *
 * Results are cached per-key. On subsequent calls, only keys that are missing
 * or expired are fetched — already-valid URLs are served from cache immediately.
 *
 * @param {string[]} keys
 * @returns {{ urlMap: Record<string, string>, loading: boolean }}
 */
export function useBulkSignedUrls(keys = []) {
  const token = useSelector((state) => state.user?.data?.token);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(false);
  const prevFetchKey = useRef("");

  useEffect(() => {
    if (!keys || keys.length === 0) return;

    const immediateMap = {};
    const toFetch = [];

    keys.forEach((key) => {
      if (!key) return;

      // ✅ Blob URLs: use as-is, no cache needed
      if (BLOB_RE.test(key)) {
        immediateMap[key] = key;
        return;
      }

      // ✅ Cache hit — skip this key in the network request
      const cached = getCached(key);
      if (cached) {
        immediateMap[key] = cached;
        return;
      }

      toFetch.push(key);
    });

    const deduped = [...new Set(toFetch)];
    const fetchKey = deduped.slice().sort().join("|");

    // All keys were served from cache — update state and skip fetch
    if (deduped.length === 0) {
      setUrlMap(immediateMap);
      return;
    }

    // Same uncached keys as last time — avoid duplicate in-flight requests
    if (fetchKey === prevFetchKey.current) return;
    prevFetchKey.current = fetchKey;

    setLoading(true);
    fetch("/api/signed-url-bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ keys: deduped }),
    })
      .then((r) => r.json())
      .then((data) => {
        const fetchedMap = data.urlMap || {};
        const expiresIn = data.expiresIn ?? 3600;

        // ✅ Cache each returned URL individually
        Object.entries(fetchedMap).forEach(([key, url]) => {
          setCache(key, url, expiresIn);
        });

        setUrlMap({ ...immediateMap, ...fetchedMap });
      })
      .catch((err) => console.error("[useBulkSignedUrls]", err))
      .finally(() => setLoading(false));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys?.join("|"), token]);

  return { urlMap, loading };
}