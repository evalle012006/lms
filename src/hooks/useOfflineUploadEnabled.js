// src/hooks/useOfflineUploadEnabled.js
//
// Is the LOR offline upload switched on (System Settings > Feature Enablement)?
// Reads the redux copy of the settings row; if the store has not loaded it (or the column is missing),
// asks settings/system once. Anything other than an explicit true means OFF.
//
// UX only: offline-upload/commit.js checks the same setting on the server.

import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

export function useOfflineUploadEnabled() {
    const fromStore = useSelector(state => state.systemSettings?.data?.allowOfflineUpload);
    const [fetched, setFetched] = useState(null);
    const inStore = fromStore !== undefined && fromStore !== null;

    useEffect(() => {
        if (inStore) return undefined;
        let cancelled = false;
        fetchWrapper.get(`${getApiBaseUrl()}settings/system`)
            .then(res => { if (!cancelled) setFetched(res?.system?.allowOfflineUpload === true); })
            .catch(() => { if (!cancelled) setFetched(false); });
        return () => { cancelled = true; };
    }, [inStore]);

    return inStore ? fromStore === true : fetched === true;
}