// src/hooks/useOnlineStatus.js
// Detects real-time online/offline status.
// Uses navigator.onLine as initial value, then listens for browser events.
// Same pattern as CI offline mode but no manual override.

import { useState, useEffect } from 'react';

/**
 * useOnlineStatus
 * Returns { isOnline, wasOffline }
 *   isOnline   — current connection status
 *   wasOffline — true if the connection was lost at least once this session
 *                (used to show "connection restored" messaging)
 */
export function useOnlineStatus() {
    const [isOnline,   setIsOnline]   = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    const [wasOffline, setWasOffline] = useState(false);

    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setWasOffline(true);
        };

        window.addEventListener('online',  handleOnline);
        window.addEventListener('offline', handleOffline);

        // Sync with current state on mount (handles race between
        // SSR-rendered false and actual browser state)
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online',  handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return { isOnline, wasOffline };
}