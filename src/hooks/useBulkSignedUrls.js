import { useState, useEffect, useRef } from "react";
import { useSelector } from "react-redux";

const BLOB_RE = /^blob:/i;

/**
 * Resolves an array of storage keys / legacy DO Spaces URLs to signed URLs
 * in a single POST to /api/signed-url-bulk.
 *
 * @param {string[]} keys
 * @returns {{ urlMap: Record<string, string>, loading: boolean }}
 */
export function useBulkSignedUrls(keys = []) {
  const token = useSelector((state) => state.user?.data?.token);
  const [urlMap, setUrlMap] = useState({});
  const [loading, setLoading] = useState(false);
  const prevCacheKey = useRef("");

  useEffect(() => {
    if (!keys || keys.length === 0) return;

    const immediateMap = {};
    const toFetch = [];

    keys.forEach((key) => {
      if (!key) return;
      if (BLOB_RE.test(key)) {
        immediateMap[key] = key; // blob URLs: use as-is
        return;
      }
      toFetch.push(key);
    });

    const deduped = [...new Set(toFetch)];
    const cacheKey = deduped.slice().sort().join("|");

    if (cacheKey === prevCacheKey.current) return;
    prevCacheKey.current = cacheKey;

    if (deduped.length === 0) {
      setUrlMap(immediateMap);
      return;
    }

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
        setUrlMap({ ...immediateMap, ...(data.urlMap || {}) });
      })
      .catch((err) => console.error("[useBulkSignedUrls]", err))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys?.join("|"), token]);

  return { urlMap, loading };
}