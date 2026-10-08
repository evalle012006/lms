// src/hooks/useOnlineStatus.js
// Detects real-time online/offline status.
// Uses navigator.onLine as initial value, then listens for browser events.
// FIX: the original one-shot check on 'online' could fail transiently right
// at reconnect (interface reports online before routing/DNS is actually
// ready), permanently sticking isOnline=false with nothing to recover it.
// Now retries with backoff, and polls periodically as a safety net while
// believed offline, so a missed check gets corrected within a few seconds
// instead of requiring a manual page reload.

import { checkRealConnectivity } from '@/lib/check-online';
import { useState, useEffect, useRef } from 'react';

const RETRY_DELAYS_MS = [500, 1500, 3000]; // a few quick retries right after 'online' fires
const POLL_INTERVAL_MS = 8000;             // background safety-net poll while offline

export function useOnlineStatus() {
    const [isOnline,   setIsOnline]   = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [wasOffline, setWasOffline] = useState(false);
    const isOnlineRef = useRef(isOnline);
    isOnlineRef.current = isOnline;

    useEffect(() => {
        let cancelled = false;

        const confirmOnlineWithRetries = async () => {
            for (const delay of [0, ...RETRY_DELAYS_MS]) {
                if (delay) await new Promise(r => setTimeout(r, delay));
                if (cancelled) return;
                const confirmed = await checkRealConnectivity(2000);
                if (confirmed) {
                    setIsOnline(true);
                    return;
                }
            }
            // All retries failed — leave as offline; the poll loop below
            // and the next 'online' event will keep trying.
            setIsOnline(false);
        };

        const handleOnline = () => { confirmOnlineWithRetries(); };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        window.addEventListener('online',  handleOnline);
        window.addEventListener('offline', handleOffline);

        // Probe on mount — navigator.onLine is unreliable as initial state
        if (navigator.onLine) {
            confirmOnlineWithRetries();
        } else {
            setIsOnline(false);
            setWasOffline(true);
        }

        // Safety-net poll: if we currently believe we're offline, keep
        // checking periodically. Covers cases where the browser never
        // fires 'online' at all (some OS/router combos are unreliable
        // about this), or where the retries above ran out before the
        // network was actually ready.
        const pollId = setInterval(() => {
            if (!isOnlineRef.current) {
                checkRealConnectivity(2000).then(confirmed => {
                    if (confirmed && !cancelled) setIsOnline(true);
                });
            }
        }, POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            clearInterval(pollId);
            window.removeEventListener('online',  handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, wasOffline };
}