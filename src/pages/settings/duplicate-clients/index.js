// src/pages/settings/duplicate-clients/index.js
// Admin-only (rep=1 / root) review page for possible & confirmed duplicate clients.
// Read-only: list, filter, select, export to Excel, jump to the client record.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import { toast } from 'react-toastify';
import { Download, RefreshCw, ExternalLink, ChevronDown } from 'lucide-react';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import {
    exportDuplicateClientsExcel, SCENARIO_LABELS, CONFIDENCE_LABELS, SEVERITY_LABELS,
} from '@/components/settings/duplicate-clients/exportDuplicateClientsExcel';

const PAGE_SIZE = 20;

const TABS = [
    { value: 'active', label: 'Active loans', hint: 'Duplicate records where at least one client has an active loan' },
    { value: 'closed', label: 'Closed / Offset', hint: 'Closed or offset records matching an active client, or each other' },
    { value: 'same_client', label: 'Same client, multiple loans', hint: 'One client ID that owns more than one active loan' },
];

const CONFIDENCE_STYLE = {
    exact: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    possible: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const REVIEW_LABELS = {
    pending: 'Needs review',
    confirmed: 'Confirmed duplicates',
    not_duplicate: 'Marked not duplicate',
    all: 'All',
};

const isAdmin = (u) => !!u && (u.root === true || u.role?.rep === 1);

// Fields compared across members; a differing value is highlighted so the
// reviewer sees at a glance *what* is different between the two records.
const DIFF_FIELDS = ['birthdate', 'contactNumber', 'branchId', 'effLoId', 'effGroupId'];

const DuplicateClientsPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const [view, setView] = useState('active');
    const [clusters, setClusters] = useState([]);
    const [summary, setSummary] = useState(null);
    const [branches, setBranches] = useState([]);
    const [lastRun, setLastRun] = useState(null);
    const [reviewCounts, setReviewCounts] = useState({ pending: 0, confirmed: 0, not_duplicate: 0 });
    const [reviewTarget, setReviewTarget] = useState(null);   // { cluster, decision }
    const [mergeTarget, setMergeTarget] = useState(null);     // cluster
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [exportOpen, setExportOpen] = useState(false);
    const [metrics, setMetrics] = useState(null);          // { groups, byLo, byBranch } — loaded on demand
    const [metricsOpen, setMetricsOpen] = useState(false);
    const [metricsLoading, setMetricsLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState({ confidence: '', scenario: '', severity: '', branchId: '', review: 'pending' });

    // Selection is by cluster and survives paging/filtering; keep the cluster
    // objects so "export selected" works for rows that are no longer on screen.
    const [selected, setSelected] = useState(() => new Map());

    useEffect(() => {
        if (currentUser && !isAdmin(currentUser)) router.replace('/');
    }, [currentUser, router]);

    useEffect(() => {
        const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const buildParams = useCallback((extra = {}) => {
        const p = new URLSearchParams({ view, ...extra });
        if (search) p.set('search', search);
        Object.entries(filters).forEach(([k, v]) => v && p.set(k, v));
        return p;
    }, [view, search, filters]);

    const toggleMetrics = async () => {
        const next = !metricsOpen;
        setMetricsOpen(next);
        if (!next || metrics) return;
        setMetricsLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/duplicates/metrics');
            if (res?.success) setMetrics(res); else toast.error(res?.message || 'Could not load metrics.');
        } catch (e) {
            toast.error(e.message || 'Could not load metrics.');
        } finally {
            setMetricsLoading(false);
        }
    };

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!silent) setLoading(true);
        try {
            const params = buildParams({ page, limit: PAGE_SIZE });
            const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/duplicates/list?' + params.toString());
            if (!res?.success) {
                toast.error(res?.message || 'Failed to load duplicate clients.');
                return;
            }
            setClusters(res.clusters);
            setPagination(res.pagination);
            setSummary(res.summary);
            setBranches(res.branches);
            setLastRun(res.lastRun);
            setReviewCounts(res.reviewCounts);
        } catch (e) {
            toast.error('Failed to load duplicate clients.');
        } finally {
            setLoading(false);
        }
    }, [buildParams, page]);

    useEffect(() => { if (isAdmin(currentUser)) load(); }, [load, currentUser]);

    // While a scan is running, poll quietly; reload the list once it finishes.
    const scanning = !!lastRun?.running;
    useEffect(() => {
        if (!scanning) return undefined;
        const t = setInterval(() => load({ silent: true }), 5000);
        return () => clearInterval(t);
    }, [scanning, load]);

    const startRescan = async () => {
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/duplicates/rescan', {});
            if (!res?.success) { toast.error(res?.message || 'Could not start the scan.'); return; }
            toast.info(res.started ? 'Scan started. Results refresh automatically when it finishes.' : 'A scan is already running.');
            load({ silent: true });
        } catch (e) {
            toast.error('Could not start the scan.');
        }
    };

    const changeFilter = (key, value) => { setPage(1); setFilters(f => ({ ...f, [key]: value })); };
    const changeView = (v) => { setView(v); setPage(1); setSelected(new Map()); };

    const toggle = (cluster) => setSelected(prev => {
        const next = new Map(prev);
        next.has(cluster.clusterId) ? next.delete(cluster.clusterId) : next.set(cluster.clusterId, cluster);
        return next;
    });

    const pageAllSelected = clusters.length > 0 && clusters.every(c => selected.has(c.clusterId));
    const togglePage = () => setSelected(prev => {
        const next = new Map(prev);
        pageAllSelected ? clusters.forEach(c => next.delete(c.clusterId)) : clusters.forEach(c => next.set(c.clusterId, c));
        return next;
    });

    const filtersNote = useMemo(() => {
        const parts = [`View: ${TABS.find(t => t.value === view)?.label}`];
        if (search) parts.push(`Search: ${search}`);
        parts.push(`Review: ${REVIEW_LABELS[filters.review]}`);
        if (filters.confidence) parts.push(`Confidence: ${CONFIDENCE_LABELS[filters.confidence]}`);
        if (filters.scenario) parts.push(`Scenario: ${SCENARIO_LABELS[filters.scenario]}`);
        if (filters.severity) parts.push(`Severity: ${SEVERITY_LABELS[filters.severity]}`);
        if (filters.branchId) parts.push(`Branch: ${branches.find(b => b._id === filters.branchId)?.name ?? filters.branchId}`);
        return parts.join(' | ');
    }, [view, search, filters, branches]);

    const runExport = async (mode) => {
        setExportOpen(false);
        setExporting(true);
        try {
            let rows;
            if (mode === 'selected') rows = [...selected.values()];
            else if (mode === 'page') rows = clusters;
            else {
                const res = await fetchWrapper.get(
                    getApiBaseUrl() + 'clients/duplicates/list?' + buildParams({ all: 'true' }).toString());
                if (!res?.success) { toast.error(res?.message || 'Export failed.'); return; }
                rows = res.clusters;
            }
            if (!rows.length) { toast.info('Nothing to export.'); return; }
            await exportDuplicateClientsExcel(rows, {
                sheetName: { active: 'Active duplicates', closed: 'Closed-Offset duplicates', same_client: 'Same client multi-loan' }[view],
                filtersNote: mode === 'selected' ? `Selected groups (${rows.length})` : filtersNote,
                fileName: `duplicate-clients-${view}-${mode}-${moment().format('YYYYMMDD-HHmm')}.xlsx`,
            });
            toast.success(`Exported ${rows.length} group(s).`);
        } catch (e) {
            toast.error('Export failed.');
        } finally {
            setExporting(false);
        }
    };

    if (!isAdmin(currentUser)) return null;

    return (
        <Layout>
            <div className="max-w-7xl mx-auto">
                <div className="flex items-start justify-between mb-4 gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Duplicate Clients</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Possible and confirmed duplicate client records across branches, LOs and groups.
                            <span className="ml-1">
                                {scanning
                                    ? `Scan running — ${lastRun?.progress?.label ?? 'starting'}${lastRun?.progress?.count != null ? ` (${Number(lastRun.progress.count).toLocaleString()}${lastRun.progress.total ? ` / ${Number(lastRun.progress.total).toLocaleString()}` : ''})` : ''}…`
                                    : lastRun?.status === 'failed'
                                        ? `Last scan failed${lastRun?.error ? ` — ${lastRun.error}` : ''}. Showing results from the previous successful scan.`
                                        : lastRun?.finishedAt
                                            ? `Last scan ${moment(lastRun.finishedAt).format('MMM D, h:mm A')}.`
                                            : 'No scan has run yet — click Re-scan.'}
                            </span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button type="button" onClick={startRescan} disabled={scanning}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 bg-white rounded-lg hover:bg-gray-50 disabled:opacity-50">
                            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} /> {scanning ? 'Scanning…' : 'Re-scan'}
                        </button>
                        <div className="relative">
                            <button type="button" onClick={() => setExportOpen(o => !o)} disabled={exporting}
                                className="flex items-center gap-1.5 px-3 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                                <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'} <ChevronDown className="w-4 h-4" />
                            </button>
                            {exportOpen && (
                                <div className="absolute right-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-20 text-sm">
                                    <button type="button" disabled={!selected.size} onClick={() => runExport('selected')}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 disabled:text-gray-300 disabled:hover:bg-white">
                                        Selected groups ({selected.size})
                                    </button>
                                    <button type="button" onClick={() => runExport('page')}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50">
                                        This page ({clusters.length})
                                    </button>
                                    <button type="button" onClick={() => runExport('all')}
                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-t border-gray-100">
                                        All filtered results ({pagination.total})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-1 mb-4 border-b border-gray-200">
                    {TABS.map(t => (
                        <button key={t.value} type="button" title={t.hint} onClick={() => changeView(t.value)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${view === t.value
                                ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {summary && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
                        <Stat label="Groups" value={summary.clusters} />
                        <Stat label="Client records" value={summary.clients} />
                        <Stat label="Exact" value={summary.exact} tone="text-red-600" />
                        <Stat label="High" value={summary.high} tone="text-orange-600" />
                        {view === 'active'
                            ? <Stat label="Multiple active loans" value={summary.bothActive} tone="text-red-600" />
                            : <Stat label="Possible" value={summary.possible} tone="text-yellow-600" />}
                    </div>
                )}

                <div className="mb-4">
                    <button type="button" onClick={toggleMetrics} className="text-sm text-blue-600 hover:text-blue-800">
                        {metricsOpen ? 'Hide' : 'Show'} who is creating duplicates (by LO / branch)
                    </button>
                    {metricsOpen && (
                        <div className="mt-2 bg-white rounded-xl border border-gray-200 p-4">
                            {metricsLoading || !metrics ? <p className="text-sm text-gray-400">Loading…</p> : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[['Loan officers', metrics.byLo, r => `${r.loName}${r.branchName ? ' · ' + r.branchName : ''}`],
                                      ['Branches', metrics.byBranch, r => r.branchName]].map(([title, rows, label]) => (
                                        <div key={title}>
                                            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">{title} — newer record of each open group</p>
                                            <table className="w-full text-sm">
                                                <thead><tr className="text-xs text-gray-500 text-left">
                                                    <th className="py-1">Name</th><th className="text-right">Groups</th><th className="text-right">Both active</th><th className="text-right">Exact/High</th>
                                                </tr></thead>
                                                <tbody>
                                                    {rows.map((r, i) => (
                                                        <tr key={i} className="border-t border-gray-100">
                                                            <td className="py-1">{label(r)}</td>
                                                            <td className="text-right">{r.groups}</td>
                                                            <td className="text-right text-red-600">{r.bothActive}</td>
                                                            <td className="text-right">{r.exactOrHigh}</td>
                                                        </tr>
                                                    ))}
                                                    {rows.length === 0 && <tr><td colSpan={4} className="py-2 text-gray-400">No data.</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-7 gap-3">
                    <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Name, client ID or contact no."
                        className="md:col-span-2 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {view !== 'same_client' && (
                        <>
                            <Select value={filters.confidence} onChange={(v) => changeFilter('confidence', v)}
                                placeholder="All confidence" options={Object.entries(CONFIDENCE_LABELS)} />
                            <Select value={filters.scenario} onChange={(v) => changeFilter('scenario', v)}
                                placeholder="All scenarios" options={Object.entries(SCENARIO_LABELS)} />
                        </>
                    )}
                    {view === 'active' && (
                        <Select value={filters.severity} onChange={(v) => changeFilter('severity', v)}
                            placeholder="All severity" options={Object.entries(SEVERITY_LABELS).filter(([k]) => k !== 'no_active')} />
                    )}
                    <Select value={filters.branchId} onChange={(v) => changeFilter('branchId', v)}
                        placeholder="All branches" options={branches.map(b => [b._id, b.name])} />
                    <select value={filters.review} onChange={(e) => changeFilter('review', e.target.value)}
                        className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white">
                        <option value="pending">Needs review ({reviewCounts.pending})</option>
                        <option value="confirmed">Confirmed ({reviewCounts.confirmed})</option>
                        <option value="not_duplicate">Not duplicate ({reviewCounts.not_duplicate})</option>
                        <option value="all">All</option>
                    </select>
                </div>

                <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
                    <label className="flex items-center gap-2">
                        <input type="checkbox" checked={pageAllSelected} onChange={togglePage} disabled={!clusters.length} />
                        Select page
                    </label>
                    <span>{selected.size > 0 && <>{selected.size} selected · </>}{pagination.total} group(s)</span>
                </div>

                {loading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : clusters.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
                        No duplicates found for these filters.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {clusters.map(c => (
                            <ClusterCard key={c.clusterId} cluster={c} checked={selected.has(c.clusterId)}
                                onToggle={() => toggle(c)}
                                onReview={(decision) => setReviewTarget({ cluster: c, decision })}
                                onMerge={() => setMergeTarget(c)} />
                        ))}
                    </div>
                )}

                {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
                        <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                            className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40">Prev</button>
                        <span>Page {page} of {pagination.totalPages}</span>
                        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}
                            className="px-3 py-1.5 border border-gray-200 bg-white rounded-lg disabled:opacity-40">Next</button>
                    </div>
                )}
            </div>
            {reviewTarget && (
                <ReviewModal target={reviewTarget} onClose={() => setReviewTarget(null)}
                    onDone={() => { setReviewTarget(null); load({ silent: true }); }} />
            )}
            {mergeTarget && (
                <MergeModal cluster={mergeTarget} onClose={() => setMergeTarget(null)}
                    onDone={() => { setMergeTarget(null); setSelected(new Map()); load(); }} />
            )}
        </Layout>
    );
};

const Stat = ({ label, value, tone = 'text-gray-900' }) => (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold ${tone}`}>{value?.toLocaleString?.() ?? value}</p>
    </div>
);

const Select = ({ value, onChange, placeholder, options }) => (
    <select value={value} onChange={(e) => onChange(e.target.value)}
        className="border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white">
        <option value="">{placeholder}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
);

const ClusterCard = ({ cluster, checked, onToggle, onReview, onMerge }) => {
    const differs = (field) => new Set(cluster.members.map(m => m[field] ?? '')).size > 1;
    const diff = Object.fromEntries(DIFF_FIELDS.map(f => [f, differs(f)]));
    const cell = (f) => (diff[f] ? 'bg-amber-50 text-amber-800 font-medium' : '');

    return (
        <div className={`bg-white rounded-xl border overflow-hidden ${checked ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'}`}>
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                <input type="checkbox" checked={checked} onChange={onToggle} />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${CONFIDENCE_STYLE[cluster.confidence]}`}>
                    {CONFIDENCE_LABELS[cluster.confidence]}
                </span>
                {cluster.reviewStatus && (
                    <span title={`${cluster.reviewedByName ?? ''} · ${cluster.reviewedAt ? moment(cluster.reviewedAt).format('MMM D, YYYY h:mm A') : ''}${cluster.reviewNote ? ` · ${cluster.reviewNote}` : ''}`}
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cluster.reviewStatus === 'confirmed'
                            ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                        {cluster.reviewStatus === 'confirmed' ? 'Confirmed duplicate' : 'Not a duplicate'}
                    </span>
                )}
                {cluster.severity === 'both_active' && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-600 text-white">
                        {cluster.activeCount} active loans
                    </span>
                )}
                {cluster.exactClosedVsActive && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                        Closed record identical to active client
                    </span>
                )}
                {cluster.scenarios.map(s => (
                    <span key={s} className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">{SCENARIO_LABELS[s]}</span>
                ))}
                <span className="text-xs text-gray-500 ml-auto">{cluster.reasons.join(' · ')}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-gray-500 uppercase">
                            {['Client', 'Birthdate', 'Contact', 'Status / Loan', 'Branch', 'LO', 'Group', 'Added', ''].map(h => (
                                <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {cluster.members.map(m => (
                            <tr key={m._id}>
                                <td className="px-3 py-2">
                                    <p className="font-medium text-gray-900">
                                        {m.lastName}, {m.firstName} {m.middleName ?? ''}
                                    </p>
                                    <p className="text-xs text-gray-400">{m._id}</p>
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap ${cell('birthdate')}`}>
                                    {m.birthdate ? moment(m.birthdate).format('MMM DD, YYYY') : '—'}
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap ${cell('contactNumber')}`}>{m.contactNumber || '—'}</td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    <span className="capitalize">{m.status}</span>
                                    {m.hasActiveLoan
                                        ? <span className="ml-1 text-xs font-semibold text-red-600">
                                            · Active C{m.activeLoan?.loanCycle ?? '?'}
                                            {m.activeLoan?.loanBalance != null && ` · ₱${Number(m.activeLoan.loanBalance).toLocaleString()}`}
                                        </span>
                                        : <span className="ml-1 text-xs text-gray-400">· {m.loanCount ?? 0} loan(s)</span>}
                                    {m.delinquent && <span className="ml-1 text-xs text-orange-600">· Delinquent</span>}
                                </td>
                                <td className={`px-3 py-2 whitespace-nowrap ${cell('branchId')}`}>{m.branchName || '—'}</td>
                                <td className={`px-3 py-2 whitespace-nowrap ${cell('effLoId')}`}>{m.loName || '—'}</td>
                                <td className={`px-3 py-2 whitespace-nowrap ${cell('effGroupId')}`}>
                                    {m.groupName || '—'}{m.activeLoan?.slotNo ? ` · #${m.activeLoan.slotNo}` : ''}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                    {m.dateAdded ? moment(m.dateAdded).format('YYYY-MM-DD') : '—'}
                                </td>
                                <td className="px-3 py-2">
                                    <a href={`/clients/edit/${m._id}`} target="_blank" rel="noreferrer"
                                        className="text-blue-600 hover:text-blue-800" title="Open client">
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {cluster.view === 'same_client' && (
                <div className="px-4 py-2 border-t border-gray-100 bg-red-50 text-xs text-red-800">
                    {cluster.members[0].activeLoans?.map(l => (
                        <p key={l._id}>
                            Loan {l._id} · cycle {l.loanCycle} · slot {l.slotNo ?? '—'} · ₱{Number(l.principalLoan ?? 0).toLocaleString()} principal ·
                            ₱{Number(l.loanBalance ?? 0).toLocaleString()} balance · granted {l.dateGranted ? moment(l.dateGranted).format('YYYY-MM-DD') : '—'}
                        </p>
                    ))}
                </div>
            )}
            <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50">
                {cluster.view !== 'same_client' && cluster.memberCount >= 2 && (
                    <button type="button" onClick={onMerge}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                        Merge…
                    </button>
                )}
                {cluster.reviewStatus !== 'confirmed' && (
                    <button type="button" onClick={() => onReview('confirmed')}
                        className="px-3 py-1 text-xs font-medium border border-red-200 text-red-700 bg-white rounded-lg hover:bg-red-50">
                        Confirm duplicate
                    </button>
                )}
                {cluster.reviewStatus !== 'not_duplicate' && (
                    <button type="button" onClick={() => onReview('not_duplicate')}
                        className="px-3 py-1 text-xs font-medium border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-100">
                        Not a duplicate
                    </button>
                )}
                {cluster.reviewStatus && (
                    <button type="button" onClick={() => onReview('clear')}
                        className="px-3 py-1 text-xs text-gray-500 hover:text-gray-800 underline">
                        Clear review
                    </button>
                )}
                {cluster.reviewNote && <span className="text-xs text-gray-500 ml-auto truncate max-w-md">Note: {cluster.reviewNote}</span>}
            </div>
        </div>
    );
};

const ModalShell = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-3">{title}</h2>
            {children}
        </div>
    </div>
);

const REVIEW_TITLES = {
    confirmed: 'Confirm as duplicate',
    not_duplicate: 'Mark as not a duplicate',
    clear: 'Clear review',
};

const ReviewModal = ({ target, onClose, onDone }) => {
    const { cluster, decision } = target;
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const needsNote = decision === 'not_duplicate';

    const submit = async () => {
        setSaving(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/duplicates/review',
                { clusterId: cluster.clusterId, decision, note });
            if (!res?.success) { toast.error(res?.message || 'Could not save the review.'); return; }
            toast.success('Review saved.');
            onDone();
        } catch (e) {
            toast.error('Could not save the review.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title={REVIEW_TITLES[decision]} onClose={onClose}>
            <p className="text-sm text-gray-600 mb-3">
                {decision === 'not_duplicate'
                    ? 'This group will be hidden from "Needs review". It comes back automatically if a new matching record joins it.'
                    : decision === 'confirmed'
                        ? 'Marks these records as the same person so they can be merged or followed up. It does not change any client data.'
                        : 'Removes the earlier decision and puts the group back under "Needs review".'}
            </p>
            {decision !== 'clear' && (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500}
                    placeholder={needsNote ? 'Why is this not a duplicate? (required)' : 'Note (optional)'}
                    className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            )}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                <button type="button" onClick={submit} disabled={saving || (needsNote && !note.trim())}
                    className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50">
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </ModalShell>
    );
};

const memberLabel = (m) => `${m.lastName}, ${m.firstName} ${m.middleName ?? ''} · ${m.branchName ?? '—'} · ${m.hasActiveLoan ? 'active loan' : m.status}`;

const MergeModal = ({ cluster, onClose, onDone }) => {
    const members = cluster.members;
    // Default master: the record with an active loan, else the oldest (members are already sorted that way).
    const [masterId, setMasterId] = useState(members[0]._id);
    const others = members.filter(m => m._id !== masterId);
    const [duplicateId, setDuplicateId] = useState(others[0]?._id);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!others.find(m => m._id === duplicateId)) setDuplicateId(others[0]?._id);
    }, [masterId]); // eslint-disable-line react-hooks/exhaustive-deps

    const master = members.find(m => m._id === masterId);
    const dup = members.find(m => m._id === duplicateId);
    const bothActive = !!master?.hasActiveLoan && !!dup?.hasActiveLoan;

    const submit = async () => {
        setSaving(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'clients/merge', { masterId, duplicateId });
            if (!res?.success) { toast.error(res?.message || 'Merge failed.'); return; }
            toast.success(res.message || 'Merged.');
            onDone();
        } catch (e) {
            toast.error('Merge failed.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell title="Merge client records" onClose={onClose}>
            <p className="text-sm text-gray-600 mb-3">
                All loans, collections, MCBU withdrawals, transfers and bad-debt records of the duplicate move to the
                master. The duplicate is archived. <strong>This cannot be undone.</strong>
            </p>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Keep (master)</p>
            <div className="space-y-1 mb-3">
                {members.map(m => (
                    <label key={m._id} className="flex items-start gap-2 text-sm">
                        <input type="radio" name="master" checked={masterId === m._id} onChange={() => setMasterId(m._id)} className="mt-1" />
                        <span>{memberLabel(m)}<span className="block text-xs text-gray-400">{m._id}</span></span>
                    </label>
                ))}
            </div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Merge into master (archived)</p>
            <select value={duplicateId ?? ''} onChange={(e) => setDuplicateId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 bg-white mb-3">
                {others.map(m => <option key={m._id} value={m._id}>{memberLabel(m)}</option>)}
            </select>
            {bothActive && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                    Both records have an active loan. Offset or close one loan first — merging now would leave one client with two active loans.
                </p>
            )}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">Cancel</button>
                <button type="button" onClick={submit} disabled={saving || bothActive || !duplicateId}
                    className="px-3 py-2 text-sm text-white bg-red-600 rounded-lg disabled:opacity-50">
                    {saving ? 'Merging…' : 'Merge'}
                </button>
            </div>
        </ModalShell>
    );
};

export default DuplicateClientsPage;
