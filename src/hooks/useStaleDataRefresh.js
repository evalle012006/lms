// src/hooks/useStaleDataRefresh.js — full corrected file

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const POLL_INTERVAL_MS = 30000;

export function useStaleDataRefresh(groupId, date, idleThresholdSeconds, onRefresh) {
    const [isStale, setIsStale] = useState(false);
    const baselineRef = useRef(null);
    const lastActivityRef = useRef(Date.now());
    const idleCheckRef = useRef(null);
    const hasRefreshedRef = useRef(false);

    const fetchCheck = useCallback(async () => {
        if (!groupId || !date) return null;
        const res = await fetchWrapper.get(
            `${getApiBaseUrl()}qr-cash-collection/check-updates?${new URLSearchParams({ groupId, date })}`
        );
        return res?.success ? res : null;
    }, [groupId, date]);

    // Pulls a fresh snapshot and makes it the new baseline — used both on
    // initial mount and after every refresh (auto or manual), so the next
    // poll compares against current reality, not a stale pre-refresh state.
    const resetBaseline = useCallback(async () => {
        const res = await fetchCheck();
        if (res) baselineRef.current = res;
        return res;
    }, [fetchCheck]);

    useEffect(() => {
        let mounted = true;
        setIsStale(false);
        hasRefreshedRef.current = false;
        baselineRef.current = null;
        resetBaseline().then(res => {
            if (!mounted) return;
            // resetBaseline already set baselineRef; nothing else needed here.
        });
        return () => { mounted = false; };
    }, [groupId, date, resetBaseline]);

    useEffect(() => {
        if (!groupId || !date) return;
        const interval = setInterval(async () => {
            if (hasRefreshedRef.current) return;
            const res = await fetchCheck();
            if (!res || !baselineRef.current) return;

            const changed =
                res.latestCashCollectionModified !== baselineRef.current.latestCashCollectionModified ||
                res.latestPendingQrEntry !== baselineRef.current.latestPendingQrEntry ||
                res.cashCollectionCount !== baselineRef.current.cashCollectionCount ||
                res.pendingQrCount !== baselineRef.current.pendingQrCount;

            if (changed) setIsStale(true);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [groupId, date, fetchCheck]);

    useEffect(() => {
        const markActive = () => { lastActivityRef.current = Date.now(); };
        const events = ['mousedown', 'keydown', 'input', 'touchstart'];
        events.forEach(e => window.addEventListener(e, markActive, { passive: true }));
        return () => events.forEach(e => window.removeEventListener(e, markActive));
    }, []);

    useEffect(() => {
        if (!isStale || hasRefreshedRef.current) return;
        const staleDetectedAt = Date.now();

        idleCheckRef.current = setInterval(async () => {
            const idleFor = Date.now() - lastActivityRef.current;
            const sinceStale = Date.now() - staleDetectedAt;
            const thresholdMs = idleThresholdSeconds * 1000;

            if (sinceStale >= thresholdMs && idleFor >= 2000) {
                hasRefreshedRef.current = true;
                clearInterval(idleCheckRef.current);
                onRefresh?.();
                // FIX: these two lines were missing entirely. Without them,
                // the banner never hides after an automatic refresh, and the
                // stale baseline would immediately re-trigger isStale on the
                // very next poll even though nothing new has actually happened.
                setIsStale(false);
                await resetBaseline();
                hasRefreshedRef.current = false;
            }
        }, 1000);

        return () => clearInterval(idleCheckRef.current);
    }, [isStale, idleThresholdSeconds, onRefresh, resetBaseline]);

    const refreshNow = useCallback(async () => {
        hasRefreshedRef.current = true;
        setIsStale(false);
        onRefresh?.();
        // Same fix applied to the manual path — it previously reset isStale
        // but never refreshed the baseline either, so a manual click had the
        // same false-positive-loop risk as the auto path.
        await resetBaseline();
        hasRefreshedRef.current = false;
    }, [onRefresh, resetBaseline]);

    return { isStale, refreshNow };
}