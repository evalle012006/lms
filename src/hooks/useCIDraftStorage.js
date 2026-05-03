// src/hooks/useCIDraftStorage.js
import { useCallback, useEffect, useRef } from 'react';

const DRAFT_KEY = 'ci_investigation_drafts';

/**
 * useCIDraftStorage
 *
 * Manages offline CI investigation drafts in localStorage.
 * onDraftChange is called after any save/remove so the parent
 * can update its draft count without polling.
 */
export function useCIDraftStorage({ onDraftChange } = {}) {
    const onChangeRef = useRef(onDraftChange);
    useEffect(() => { onChangeRef.current = onDraftChange; }, [onDraftChange]);

    const getDrafts = useCallback(() => {
        try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]'); }
        catch { return []; }
    }, []);

    const saveDraft = useCallback((draft) => {
        try {
            const existing = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
            const updated  = existing.filter(d => d.ciReferenceCode !== draft.ciReferenceCode);
            updated.push({ ...draft, savedAt: Date.now() });
            localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
            // Notify parent immediately — no polling needed
            onChangeRef.current?.(updated.length);
        } catch {}
    }, []);

    const removeDraft = useCallback((ciReferenceCode) => {
        try {
            const existing = JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]');
            const updated  = existing.filter(d => d.ciReferenceCode !== ciReferenceCode);
            localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
            onChangeRef.current?.(updated.length);
        } catch {}
    }, []);

    return { saveDraft, getDrafts, removeDraft };
}