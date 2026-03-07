import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { extractKeyFromValue } from '@/lib/fileUtils';

/**
 * useSignedUrl
 *
 * Fetches a temporary pre-signed URL for a private DigitalOcean Spaces object.
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