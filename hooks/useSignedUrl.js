import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { extractKeyFromValue } from '@/lib/fileUtils';

/**
 * Module-level cache — survives component remounts within the same browser session.
 * Shape: Map<storageKey, { url: string, expiresAt: number }>
 */
const _urlCache = new Map();
const EXPIRY_BUFFER_MS = 60_000; // refresh 1 min before actual expiry

function getCached(key) {
  const entry = _urlCache.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt - EXPIRY_BUFFER_MS) {
    _urlCache.delete(key); // evict if expired or nearly expired
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
 * useSignedUrl
 *
 * Fetches a temporary pre-signed URL for a private DigitalOcean Spaces object.
 * Results are cached in memory for the duration of the signed URL's validity,
 * so repeated calls for the same key (e.g. header avatar on every route change)
 * do not trigger redundant API requests.
 *
 * Accepts:
 *   - Storage key (new format):    "lms/clients/uuid/filename.png"
 *   - Legacy full URL:             "https://ambercashph.sgp1.digitaloceanspaces.com/lms/..."
 *   - Blob/object URL:             "blob:http://..."  → returned as-is (local upload preview)
 *   - Data URL:                    "data:image/..."   → returned as-is
 *   - null / undefined             → returns null
 */
export function useSignedUrl(keyOrUrl) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  // Token lives in Redux state — same place all other API calls read it from
  const token = useSelector((state) => state.user?.data?.token);

  useEffect(() => {
    if (!keyOrUrl) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    // ✅ Blob/data URLs are local previews — use directly, no API needed
    if (keyOrUrl.startsWith('blob:') || keyOrUrl.startsWith('data:')) {
      setSignedUrl(keyOrUrl);
      setLoading(false);
      setError(null);
      return;
    }

    // Wait until token is available (user state may not be hydrated yet)
    if (!token) return;

    const key = extractKeyFromValue(keyOrUrl);
    if (!key) {
      setSignedUrl(null);
      setError('Invalid file key');
      return;
    }

    // ✅ Cache hit — use existing signed URL without a network call
    const cached = getCached(key);
    if (cached) {
      setSignedUrl(cached);
      setLoading(false);
      setError(null);
      return;
    }

    // Cancel any in-flight request for a previous key
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/api/signed-url?key=${encodeURIComponent(key)}`, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // ✅ Cache the result using the server-reported expiry (default 3600s)
        setCache(key, data.url, data.expiresIn ?? 3600);
        setSignedUrl(data.url);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        console.error('useSignedUrl error:', err);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [keyOrUrl, token]); // re-run if token changes (e.g. after login)

  return { signedUrl, loading, error };
}