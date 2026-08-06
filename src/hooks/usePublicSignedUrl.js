// src/hooks/usePublicSignedUrl.js
// Same caching pattern as useSignedUrl, but uses the public LAF signed-url API.
// Does NOT require a JWT token — uses x-laf-api-key header instead.
// Use this on public pages (LAF form, biometric register) where user is not logged in.

import { useState, useEffect, useRef } from 'react';

const _cache = new Map();
const EXPIRY_BUFFER_MS = 60_000;

function getCached(key) {
    const entry = _cache.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt - EXPIRY_BUFFER_MS) { _cache.delete(key); return null; }
    return entry.url;
}

function setCache(key, url, expiresInSeconds) {
    _cache.set(key, { url, expiresAt: Date.now() + expiresInSeconds * 1000 });
}

export function usePublicSignedUrl(key) {
    const [signedUrl, setSignedUrl] = useState(null);
    const [loading,   setLoading]   = useState(false);
    const abortRef                  = useRef(null);

    useEffect(() => {
        if (!key) { setSignedUrl(null); return; }

        // Blob/data URLs are local previews — use as-is
        if (key.startsWith('blob:') || key.startsWith('data:')) {
            setSignedUrl(key);
            return;
        }

        // Cache hit
        const cached = getCached(key);
        if (cached) { setSignedUrl(cached); return; }

        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        fetch(`/api/public/laf/signed-url?key=${encodeURIComponent(key)}`, {
            signal:  controller.signal,
            headers: { 'x-laf-api-key': process.env.NEXT_PUBLIC_LAF_API_KEY || '' },
        })
            .then(r => r.json())
            .then(data => {
                if (data.success && data.url) {
                    setCache(key, data.url, data.expiresIn ?? 900);
                    setSignedUrl(data.url);
                }
            })
            .catch(err => { if (err.name !== 'AbortError') console.error('[usePublicSignedUrl]', err); })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [key]);

    return { signedUrl, loading };
}