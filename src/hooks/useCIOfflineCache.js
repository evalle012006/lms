// src/hooks/useCIOfflineCache.js
// Manages the localStorage cache for offline CI field investigations.
// Stores application metadata (no photos) for offline access.

import { useCallback } from 'react';

const CACHE_KEY     = 'ci_field_cache';
const CACHE_TTL_MS  = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Cached entry shape:
 * {
 *   applications: [...],  // metadata only — no photo blobs
 *   cachedAt: timestamp,
 *   cachedBy: userId,
 * }
 */
export function useCIOfflineCache() {

    // ── Save applications to cache ────────────────────────────────────────
    const saveCache = useCallback((applications, userId) => {
        try {
            const entry = {
                applications,
                cachedAt: Date.now(),
                cachedBy: userId,
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
            return true;
        } catch (err) {
            console.error('[CIOfflineCache] Failed to save cache:', err);
            return false;
        }
    }, []);

    // ── Read cached applications ──────────────────────────────────────────
    const getCache = useCallback(() => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;

            const entry = JSON.parse(raw);

            // Expire after 24 hours
            if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
                localStorage.removeItem(CACHE_KEY);
                return null;
            }

            return entry;
        } catch {
            return null;
        }
    }, []);

    // ── Clear cache ───────────────────────────────────────────────────────
    const clearCache = useCallback(() => {
        localStorage.removeItem(CACHE_KEY);
    }, []);

    // ── Get cache metadata (for banner display) ───────────────────────────
    const getCacheInfo = useCallback(() => {
        const entry = getCache();
        if (!entry) return null;
        return {
            count:    entry.applications?.length ?? 0,
            cachedAt: entry.cachedAt,
            cachedBy: entry.cachedBy,
        };
    }, [getCache]);

    // ── Check if cache is still valid ────────────────────────────────────
    const hasFreshCache = useCallback(() => {
        return getCache() !== null;
    }, [getCache]);

    return {
        saveCache,
        getCache,
        clearCache,
        getCacheInfo,
        hasFreshCache,
    };
}