// src/hooks/useClientList.js
// Shared data-fetching hook for Active/Offset/Prospect client lists.
// All three layouts (card-grid mobile, dense-row desktop) and both list
// kinds share this hook so filtering/pagination/search behavior can never
// drift between them — only rendering differs downstream.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_LIMIT = 15;

const ENDPOINTS = {
    active:   'clients/list-active-paginated',
    offset:   'clients/list-offset-paginated',
    prospect: 'clients/list-prospect-paginated',
};

const EMPTY_PAGINATION = {
    page: 1, limit: DEFAULT_LIMIT, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

/**
 * @param {'active'|'offset'|'prospect'} status
 * @param {{ tab?: string, enabled?: boolean }} options
 *   tab     — only meaningful for 'prospect' ('new'|'duplicate'|'excluded')
 *   enabled — set false until the caller's router/status is actually ready;
 *             prevents fetching against a guessed/default status on first render
 */
export function useClientList(status, { tab, enabled = true } = {}) {
    const endpoint = ENDPOINTS[status];
    if (!endpoint) {
        throw new Error(`useClientList: unknown status "${status}"`);
    }

    const [clients, setClients]       = useState([]);
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);
    const [loading, setLoading]       = useState(false);
    const [error, setError]           = useState(null);

    // Resolved server-side once the role's branch scoping kicks in — the
    // page uses this to populate the branch switcher, not a client-side guess.
    // FIX: was reading from a nonexistent `initialFilters` param — both of
    // these now correctly start unresolved (null) and are filled in once the
    // first response comes back, same as allowedBranchIds always was.
    const [resolvedBranchId, setResolvedBranchId] = useState(null);
    const [allowedBranchIds, setAllowedBranchIds] = useState(null);

    // FIX: same issue — branchId/loId/groupId used to read from
    // `initialFilters`, which no longer exists as a param. There is currently
    // no caller passing initial branch/LO/group values in, so these start
    // null and get set via setFilter(). If you need the page to be able to
    // deep-link into a specific branch/LO/group on first load (e.g. from the
    // Group list page linkage mentioned earlier as "for later"), this hook
    // needs an explicit initialFilters option added back to its signature —
    // flagging that gap rather than silently reintroducing the old param
    // under a different name.
    const [filters, setFilters] = useState({
        branchId: null,
        loId:     null,
        groupId:  null,
        tab:      tab ?? 'new',
        search:   '',
    });

    const [page, setPage] = useState(1);

    // Guards against a slow earlier request clobbering a faster later one —
    // fetchWrapper has no built-in request cancellation, so this is a
    // sequence-number check instead of AbortController.
    const requestSeq = useRef(0);
    const debounceRef = useRef(null);

    const fetchPage = useCallback(async (targetPage, targetFilters) => {
        const seq = ++requestSeq.current;
        setLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                page: String(targetPage),
                limit: String(DEFAULT_LIMIT),
            });
            if (targetFilters.branchId) params.set('branchId', targetFilters.branchId);
            if (targetFilters.loId)     params.set('loId', targetFilters.loId);
            if (targetFilters.groupId)  params.set('groupId', targetFilters.groupId);
            if (targetFilters.tab)      params.set('tab', targetFilters.tab);
            if (targetFilters.search?.trim()) params.set('search', targetFilters.search.trim());

            const res = await fetchWrapper.get(`${getApiBaseUrl()}${endpoint}?${params}`);

            if (seq !== requestSeq.current) return; // stale response, drop it

            if (res.success) {
                if (res.pagination?.total === 0 && (res.clients ?? []).length > 0) {
                    console.warn('[useClientList] pagination.total is 0 but clients array is non-empty — count query is broken', res.pagination, res);
                }
                setClients(res.clients ?? []);
                setPagination(res.pagination ?? EMPTY_PAGINATION);
                if (res.resolvedBranchId !== undefined) setResolvedBranchId(res.resolvedBranchId);
                // FIX: API returns `allowedBranches` (full objects), not
                // `allowedBranchIds` — this was silently reading undefined
                // and leaving allowedBranchIds permanently null, which would
                // have broken the toolbar's branch selector once pagination
                // itself was working. Caught while doing a full pass rather
                // than only patching the reported line.
                if (res.allowedBranches !== undefined) setAllowedBranchIds(res.allowedBranches);
            } else {
                setError(res.message || 'Failed to load clients.');
                setClients([]);
                setPagination(EMPTY_PAGINATION);
            }
        } catch (e) {
            if (seq !== requestSeq.current) return;
            console.error('[useClientList] fetch failed', e);
            setError('Failed to load clients.');
            setClients([]);
            setPagination(EMPTY_PAGINATION);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, [endpoint]);

    useEffect(() => {
        if (!enabled) return; // router/status not confirmed yet — don't fetch on a guess
        fetchPage(page, filters);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, filters.branchId, filters.loId, filters.groupId, filters.tab, enabled]);

    const setSearch = useCallback((value) => {
        setFilters(prev => ({ ...prev, search: value }));
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setPage(1);
            fetchPage(1, { ...filters, search: value });
        }, SEARCH_DEBOUNCE_MS);
    }, [filters, fetchPage]);

    const setFilter = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }, []);

    // Dedicated tab-switch path — deterministic, doesn't rely on the generic
    // effect + a page-number coincidence (see prior fix history). Also
    // clears search: confirmed behavior, switching Prospect tabs should not
    // carry a search term from one tab into another.
    const setTab = useCallback((newTab) => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const nextFilters = { ...filters, tab: newTab, search: '' };
        setFilters(nextFilters);
        setPage(1);
        fetchPage(1, nextFilters);
    }, [filters, fetchPage]);

    const goToPage = useCallback((targetPage) => {
        if (targetPage < 1 || (pagination.totalPages && targetPage > pagination.totalPages)) return;
        setPage(targetPage);
    }, [pagination.totalPages]);

    const refresh = useCallback(() => fetchPage(page, filters), [fetchPage, page, filters]);

    // Optimistic local removal — used after delete/exclude succeeds server-side.
    // Avoids an unnecessary refetch for the common case. Only refetches if the
    // removal empties the current page while more data exists behind it (so you
    // don't get stranded looking at an empty page 3 of 4 after a delete).
    const removeClient = useCallback((clientId) => {
        setClients(prev => {
            const next = prev.filter(c => c._id !== clientId);
            setPagination(p => ({ ...p, total: Math.max(0, p.total - 1) }));
            if (next.length === 0 && page > 1) {
                // Page emptied out — step back a page rather than show nothing.
                setPage(p => p - 1);
            } else if (next.length === 0 && pagination.hasNext) {
                // Last item on page 1 removed but more pages exist — backfill.
                fetchPage(page, filters);
            }
            return next;
        });
    }, [page, pagination.hasNext, filters, fetchPage]);

    // Optimistic local patch — used after an update (e.g. exclude toggling
    // `archived`) succeeds server-side. If the change means this row no longer
    // belongs in the current tab/filter (e.g. excluding removes it from "New"),
    // pass `removeIfMatches` to also drop it from the visible list.
    const patchClient = useCallback((clientId, changes, { removeIfMatches } = {}) => {
        if (removeIfMatches?.(changes)) {
            removeClient(clientId);
            return;
        }
        setClients(prev => prev.map(c => c._id === clientId ? { ...c, ...changes } : c));
    }, [removeClient]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    return {
        clients,
        pagination,
        loading,
        error,
        filters,
        setFilter,
        setSearch,
        setTab,
        page,
        goToPage,
        resolvedBranchId,
        allowedBranchIds,
        refresh,
        removeClient,
        patchClient,
    };
}