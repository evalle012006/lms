// src/hooks/useCIDraftStorage.js
import { useCallback } from 'react';

const DRAFT_KEY = 'ci_investigation_drafts';

export function useCIDraftStorage() {
    const saveDraft = useCallback((draft) => {
        try {
            const existing = getDrafts();
            const updated = existing.filter(
                d => d.ciReferenceCode !== draft.ciReferenceCode
            );
            updated.push({ ...draft, savedAt: Date.now() });
            localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
        } catch {}
    }, []);

    const getDrafts = useCallback(() => {
        try {
            return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
        } catch { return []; }
    }, []);

    const removeDraft = useCallback((ciReferenceCode) => {
        try {
            const updated = getDrafts().filter(
                d => d.ciReferenceCode !== ciReferenceCode
            );
            localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
        } catch {}
    }, [getDrafts]);

    return { saveDraft, getDrafts, removeDraft };
}

// src/hooks/useOnlineStatus.js
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
    const [isOnline, setIsOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );
    useEffect(() => {
        const up   = () => setIsOnline(true);
        const down = () => setIsOnline(false);
        window.addEventListener('online',  up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online',  up);
            window.removeEventListener('offline', down);
        };
    }, []);
    return isOnline;
}