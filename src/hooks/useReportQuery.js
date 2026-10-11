// src/hooks/useReportQuery.js
//
// One way to call a report endpoint. Replaces the per-view getList()/useEffect pairs and the
// Mispay-only useMispayReport hook (delete that file).
//
//   const { data, summary, scope, error, loading, refetch } =
//       useReportQuery({ endpoint: 'reports/get-all-mispays', params: { date, remarks, all: '1' }, enabled });
//
// What it guarantees:
//   - fires only when `enabled` is true (the caller waits for router + user), one request per
//     distinct params object (empty/undefined params are dropped, so identity changes don't refetch)
//   - never sends currentUserId — the server resolves identity and scope from the token
//   - late responses from superseded requests are dropped (last REQUEST wins, not last response)
//   - failures surface as `error` + `refetch()` instead of an endless spinner

import { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

// fetchWrapper surfaces a non-JSON body (a Next error page) as a JSON.parse message — say what it means.
const friendly = (err) => (/not valid JSON|Unexpected token/i.test(err?.message ?? '')
    ? 'The server sent an error page instead of data. Check the server log (the route may have failed to compile).'
    : (err?.message || 'Unable to load the report.'));

const INITIAL = { status: 'idle', data: [], summary: null, pagination: null, scope: null, error: null };

export function buildQuery(params = {}) {
    const q = new URLSearchParams();
    Object.keys(params).forEach((k) => {
        const v = params[k];
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    return q.toString();
}

export function useReportQuery({ endpoint, params, enabled = true }) {
    const [state, setState] = useState(INITIAL);
    const [nonce, setNonce] = useState(0);
    const latest = useRef(0);

    // A primitive key: the effect re-runs only when a real param (or the endpoint) changes.
    const queryString = buildQuery(params);

    useEffect(() => {
        if (!enabled) return undefined;

        const id = ++latest.current;
        setState(s => ({ ...s, status: 'loading', error: null }));

        (async () => {
            try {
                const res = await fetchWrapper.get(`${getApiBaseUrl()}${endpoint}?${queryString}`);
                if (id !== latest.current) return;   // superseded, or unmounted
                if (res?.success) {
                    setState({
                        status: 'success',
                        data: res.data ?? [],
                        summary: res.summary ?? null,
                        pagination: res.pagination ?? null,
                        scope: res.scope ?? null,
                        error: null,
                    });
                } else {
                    setState(s => ({ ...s, status: 'error', error: res?.message || 'Unable to load the report.' }));
                }
            } catch (err) {
                if (id !== latest.current) return;
                setState(s => ({ ...s, status: 'error', error: friendly(err) }));
            }
        })();

        return () => { latest.current += 1; };
    }, [enabled, endpoint, queryString, nonce]);

    return {
        data: state.data,
        summary: state.summary,
        pagination: state.pagination,
        scope: state.scope,
        error: state.error,
        loading: !enabled || state.status === 'loading',
        refetch: () => setNonce(n => n + 1),
    };
}