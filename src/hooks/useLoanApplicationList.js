// src/hooks/useLoanApplicationList.js
// Data hook for the v2 Loan Application page (modeled on useClientList).
//
// Fetch paths are imperative (updateFilters / goToPage / refresh) instead of
// dependency-driven effects, so one user action is always exactly one request:
//   - filter / search change  -> page 1, tab counts refreshed
//   - tab change              -> page 1, counts NOT re-queried (counts depend
//                                only on filters, not on the active tab)
//   - page change             -> that page only, no counts
// A stale-response guard (sequence number) drops slow earlier requests.

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const DEBOUNCE_MS = 300;
export const PAGE_LIMIT = 25;

const EMPTY_PAGINATION = {
    page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
};

export const DEFAULT_FILTERS = {
    tab: 'ldf',
    branchId: null,
    loId: null,
    groupId: null,
    loanCycle: 'all',     // all | new_member | reloaner
    occurence: 'all',     // all | daily | weekly_standard | weekly_accelerated
    loType: 'all',        // all | main | ext
    coMakerPending: false,
    search: '',           // client name
    ciReference: '',
    month: null,          // history tab only, 'MM'
    year: null,           // history tab only, 'YYYY'
};

function buildParams(page, f, withCounts) {
    const params = new URLSearchParams({
        tab: f.tab,
        page: String(page),
        limit: String(PAGE_LIMIT),
        withCounts: withCounts ? '1' : '0',
    });
    if (f.branchId) params.set('branchId', f.branchId);
    if (f.loId) params.set('loId', f.loId);
    if (f.groupId) params.set('groupId', f.groupId);
    if (f.loanCycle !== 'all') params.set('loanCycle', f.loanCycle);
    if (f.occurence !== 'all') params.set('occurence', f.occurence);
    if (f.loType !== 'all') params.set('loType', f.loType);
    if (f.coMakerPending) params.set('coMakerPending', '1');
    if (f.search.trim()) params.set('search', f.search.trim());
    if (f.ciReference.trim()) params.set('ciReference', f.ciReference.trim());
    if (f.tab === 'history') {
        if (f.month) params.set('month', f.month);
        if (f.year) params.set('year', String(f.year));
    }
    return params;
}

/** @param {{ enabled?: boolean }} options  enabled=false until the caller knows the user is eligible */
export function useLoanApplicationList({ enabled = true } = {}) {
    const [loans, setLoans] = useState([]);
    const [pagination, setPagination] = useState(EMPTY_PAGINATION);
    const [tabCounts, setTabCounts] = useState({});
    const [activeTotals, setActiveTotals] = useState({ count: 0, amount: 0 });
    // How many loans on the active tab (under the other filters) have a pending
    // co-maker. null on the History tab, where it does not apply.
    const [coMakerPendingCount, setCoMakerPendingCount] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentDate, setCurrentDate] = useState(null);
    // undefined = not loaded yet, null = all branches (root/admin), array = restricted list
    const [allowedBranches, setAllowedBranches] = useState(undefined);
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [page, setPage] = useState(1);

    const filtersRef = useRef(DEFAULT_FILTERS);
    const pageRef = useRef(1);
    const requestSeq = useRef(0);
    const debounceRef = useRef(null);
    const startedRef = useRef(false);
    // True until a response carrying tabCounts has landed for the current
    // filters. Survives a cancelled debounce / failed request so counts can
    // never be left stale relative to the filters on screen.
    const countsDirtyRef = useRef(true);

    const fetchPage = useCallback(async (targetPage, f) => {
        const seq = ++requestSeq.current;
        const withCounts = countsDirtyRef.current;
        setLoading(true);
        setError(null);

        try {
            const res = await fetchWrapper.get(
                `${getApiBaseUrl()}transactions/loans/list-paginated?${buildParams(targetPage, f, withCounts)}`
            );
            if (seq !== requestSeq.current) return; // stale response

            if (res.success) {
                setLoans(res.loans ?? []);
                setPagination(res.pagination ?? EMPTY_PAGINATION);
                setActiveTotals(res.activeTotals ?? { count: res.pagination?.total ?? 0, amount: 0 });
                setCoMakerPendingCount(res.coMakerPendingCount ?? null);
                if (res.allowedBranches !== undefined) setAllowedBranches(res.allowedBranches);
                if (res.currentDate) setCurrentDate(res.currentDate);
                if (withCounts && res.tabCounts) {
                    setTabCounts(res.tabCounts);
                    countsDirtyRef.current = false;
                }
                pageRef.current = targetPage;
                setPage(targetPage);
            } else {
                setError(res.message || 'Failed to load loan applications.');
                setLoans([]);
                setPagination(EMPTY_PAGINATION);
            }
        } catch (e) {
            if (seq !== requestSeq.current) return;
            console.error('[useLoanApplicationList] fetch failed', e);
            setError('Failed to load loan applications.');
            setLoans([]);
            setPagination(EMPTY_PAGINATION);
        } finally {
            if (seq === requestSeq.current) setLoading(false);
        }
    }, []);

    // First load, once the caller says the user is eligible.
    useEffect(() => {
        if (!enabled || startedRef.current) return;
        startedRef.current = true;
        fetchPage(1, filtersRef.current);
    }, [enabled, fetchPage]);

    useEffect(() => () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    /**
     * patch      partial filters; callers cascade-reset children themselves
     *            (e.g. { branchId, loId: null, groupId: null })
     * debounce   true for free-text inputs
     * tabOnly    true when only the tab/month/year changed (skips count refresh)
     */
    const updateFilters = useCallback((patch, { debounce = false, tabOnly = false } = {}) => {
        const next = { ...filtersRef.current, ...patch };
        filtersRef.current = next;
        setFilters(next);
        if (!tabOnly) countsDirtyRef.current = true;

        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (debounce) {
            debounceRef.current = setTimeout(() => fetchPage(1, filtersRef.current), DEBOUNCE_MS);
        } else {
            fetchPage(1, next);
        }
    }, [fetchPage]);

    const resetFilters = useCallback(() => {
        const next = { ...DEFAULT_FILTERS, tab: filtersRef.current.tab, month: filtersRef.current.month, year: filtersRef.current.year };
        filtersRef.current = next;
        setFilters(next);
        countsDirtyRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        fetchPage(1, next);
    }, [fetchPage]);

    const goToPage = useCallback((target) => {
        if (target < 1 || (pagination.totalPages && target > pagination.totalPages)) return;
        fetchPage(target, filtersRef.current);
    }, [fetchPage, pagination.totalPages]);

    const refresh = useCallback(() => {
        countsDirtyRef.current = true;
        fetchPage(pageRef.current, filtersRef.current);
    }, [fetchPage]);

    // Ids matching the active tab + current filters (server-capped), for
    // "select all" across pages without loading those pages.
    const fetchAllIds = useCallback(async () => {
        const params = buildParams(1, filtersRef.current, false);
        params.set('idsOnly', '1');
        const res = await fetchWrapper.get(`${getApiBaseUrl()}transactions/loans/list-paginated?${params}`);
        return res.success ? { ids: res.ids ?? [], capped: !!res.capped, cap: res.cap } : { ids: [], capped: false };
    }, []);

    // Every row for the active tab + current filters, for Excel export. Pulled in
    // server-sized chunks (2000) so no single request has to carry the lot, with a
    // hard stop so a runaway export cannot loop forever.
    const fetchExportRows = useCallback(async () => {
        const MAX_CHUNKS = 15;
        const rows = [];
        let capped = false;
        for (let chunk = 1; chunk <= MAX_CHUNKS; chunk += 1) {
            const params = buildParams(chunk, filtersRef.current, false);
            params.set('export', '1');
            params.set('limit', '2000');
            const res = await fetchWrapper.get(`${getApiBaseUrl()}transactions/loans/list-paginated?${params}`);
            if (!res.success) throw new Error(res.message || 'Export failed.');
            rows.push(...(res.loans ?? []));
            if (!res.pagination?.hasNext) return { rows, capped };
            if (chunk === MAX_CHUNKS) capped = true;
        }
        return { rows, capped };
    }, []);

    return {
        loans, pagination, tabCounts, activeTotals, coMakerPendingCount, loading, error,
        currentDate, allowedBranches, filters, page,
        updateFilters, resetFilters, goToPage, refresh, fetchAllIds, fetchExportRows,
    };
}