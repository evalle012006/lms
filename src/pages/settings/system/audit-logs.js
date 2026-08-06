// src/pages/settings/system/audit-logs.js
// Audit Logs viewer — admin/area+ only.
// Added as a tab in src/pages/settings/system/index.js
// Searchable by: action, category, user, entity, date range, severity, success/fail

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import moment from 'moment';
import {
    Search, Filter, ChevronLeft, ChevronRight,
    CheckCircle, XCircle, AlertTriangle, Info,
    RefreshCw, Download,
} from 'lucide-react';

// ── Constants ─────────────────────────────────────────────────────────────
const CATEGORIES = ['', 'CI', 'LAF', 'BIOMETRIC', 'LOAN', 'QR', 'AUTH'];
const SEVERITIES  = ['', 'INFO', 'WARNING', 'CRITICAL'];

const CATEGORY_COLORS = {
    CI:        'bg-blue-100 text-blue-700',
    LAF:       'bg-purple-100 text-purple-700',
    BIOMETRIC: 'bg-teal-100 text-teal-700',
    LOAN:      'bg-green-100 text-green-700',
    QR:        'bg-indigo-100 text-indigo-700',
    AUTH:      'bg-gray-100 text-gray-700',
};

const SEVERITY_CONFIG = {
    INFO:     { icon: Info,          color: 'text-blue-500'  },
    WARNING:  { icon: AlertTriangle, color: 'text-amber-500' },
    CRITICAL: { icon: XCircle,       color: 'text-red-500'   },
};

// ── Subcomponents ─────────────────────────────────────────────────────────
const Badge = ({ text, colorClass }) => (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${colorClass}`}>
        {text}
    </span>
);

const SeverityIcon = ({ severity }) => {
    const cfg  = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.INFO;
    const Icon = cfg.icon;
    return <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />;
};

const LogDetailPanel = ({ log, onClose }) => {
    if (!log) return null;
    return (
        <div className="fixed inset-0 z-[500] flex justify-end">
            <div className="absolute inset-0 bg-black bg-opacity-30" onClick={onClose} />
            <div className="relative bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl">
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">Log Detail</h3>
                    <button type="button" onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-gray-100">
                        <XCircle className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
                <div className="px-5 py-4 space-y-4">
                    {/* Header info */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge text={log.category} colorClass={CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-700'} />
                            <Badge text={log.severity} colorClass={
                                log.severity === 'CRITICAL' ? 'bg-red-100 text-red-700'
                                : log.severity === 'WARNING' ? 'bg-amber-100 text-amber-700'
                                : 'bg-blue-100 text-blue-700'
                            } />
                            {log.success === false && (
                                <Badge text="FAILED" colorClass="bg-red-100 text-red-700" />
                            )}
                        </div>
                        <p className="text-base font-semibold text-gray-900">{log.action}</p>
                        <p className="text-xs text-gray-500">
                            {moment(log.timestamp).format('MMM D, YYYY h:mm:ss A')}
                        </p>
                    </div>

                    {/* Description */}
                    {log.description && (
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <p className="text-xs text-gray-600">{log.description}</p>
                        </div>
                    )}

                    {/* Key-value rows */}
                    {[
                        ['User',       log.userName  ? `${log.userName} (${log.userRole || ''})` : log.userId],
                        ['Branch',     log.branchName || log.branchId],
                        ['Entity',     log.entityId ? `${log.entityType}: ${log.entityId}` : null],
                        ['IP Address', log.ipAddress],
                        ['Fail Reason',log.failReason],
                    ].filter(([, v]) => v).map(([label, value]) => (
                        <div key={label} className="flex gap-3 text-xs">
                            <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
                            <span className="text-gray-800 font-medium break-all">{value}</span>
                        </div>
                    ))}

                    {/* Before/After data */}
                    {log.beforeData && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Before</p>
                            <pre className="text-xs bg-red-50 rounded-lg p-3 overflow-x-auto text-red-800 border border-red-100">
                                {JSON.stringify(log.beforeData, null, 2)}
                            </pre>
                        </div>
                    )}
                    {log.afterData && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">After</p>
                            <pre className="text-xs bg-green-50 rounded-lg p-3 overflow-x-auto text-green-800 border border-green-100">
                                {JSON.stringify(log.afterData, null, 2)}
                            </pre>
                        </div>
                    )}
                    {log.metadata && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">Metadata</p>
                            <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-700 border border-gray-100">
                                {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────
const AuditLogsPage = () => {
    const currentUser = useSelector(s => s.user.data);

    // ── Filters ───────────────────────────────────────────────────────────
    const [search,    setSearch]    = useState('');
    const [category,  setCategory]  = useState('');
    const [severity,  setSeverity]  = useState('');
    const [successF,  setSuccessF]  = useState('');
    const [dateFrom,  setDateFrom]  = useState('');
    const [dateTo,    setDateTo]    = useState('');
    const [entityId,  setEntityId]  = useState('');

    // ── Pagination ────────────────────────────────────────────────────────
    const [page,  setPage]  = useState(1);
    const [limit] = useState(50);

    // ── Data ──────────────────────────────────────────────────────────────
    const [logs,       setLogs]       = useState([]);
    const [pagination, setPagination] = useState(null);
    const [loading,    setLoading]    = useState(true);
    const [selectedLog,setSelectedLog]= useState(null);

    const fetchLogs = useCallback(async (pg = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: pg, limit });
            if (search)   params.set('search',   search);
            if (category) params.set('category', category);
            if (severity) params.set('severity', severity);
            if (successF) params.set('success',  successF);
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo)   params.set('dateTo',   dateTo);
            if (entityId) params.set('entityId', entityId);

            const res = await fetchWrapper.get(getApiBaseUrl() + `audit/logs?${params}`);
            if (res.success) {
                setLogs(res.logs);
                setPagination(res.pagination);
            }
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [search, category, severity, successF, dateFrom, dateTo, entityId, limit]);

    useEffect(() => { fetchLogs(1); setPage(1); }, [category, severity, successF, dateFrom, dateTo]);

    const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchLogs(1); };

    const handleExportCSV = () => {
        if (!logs.length) return;
        const headers = ['Timestamp', 'Action', 'Category', 'Severity', 'User', 'Branch', 'Entity', 'Description', 'Success', 'Fail Reason'];
        const rows = logs.map(l => [
            moment(l.timestamp).format('YYYY-MM-DD HH:mm:ss'),
            l.action, l.category, l.severity,
            l.userName || l.userId || '',
            l.branchName || l.branchId || '',
            l.entityId || '',
            (l.description || '').replace(/,/g, ';'),
            l.success === false ? 'No' : 'Yes',
            l.failReason || '',
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `audit-logs-${moment().format('YYYY-MM-DD')}.csv`;
        a.click();
    };

    return (
        <div className="space-y-4">
            {/* ── Search + Filter bar ─────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text" value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Action, user, entity ID..."
                                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <select value={category} onChange={e => setCategory(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {CATEGORIES.map(c => <option key={c} value={c}>{c || 'All'}</option>)}
                        </select>
                    </div>

                    {/* Severity */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Severity</label>
                        <select value={severity} onChange={e => setSeverity(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {SEVERITIES.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
                        </select>
                    </div>

                    {/* Success filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <select value={successF} onChange={e => setSuccessF(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">All</option>
                            <option value="true">Success</option>
                            <option value="false">Failed</option>
                        </select>
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    {/* Entity ID */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Entity ID</label>
                        <input type="text" value={entityId} onChange={e => setEntityId(e.target.value)}
                            placeholder="UUID..."
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-36
                                focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>

                    <button type="submit"
                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg
                            hover:bg-blue-700 transition-colors flex items-center gap-1.5">
                        <Search className="w-3.5 h-3.5" />
                        Search
                    </button>

                    <button type="button" onClick={() => fetchLogs(page)}
                        className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    <button type="button" onClick={handleExportCSV} disabled={!logs.length}
                        className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium
                            rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5
                            disabled:opacity-50">
                        <Download className="w-3.5 h-3.5" />
                        Export CSV
                    </button>
                </form>
            </div>

            {/* ── Stats strip ────────────────────────────────────────────── */}
            {pagination && (
                <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
                    <span className="font-semibold text-gray-800">{pagination.total.toLocaleString()}</span> total logs
                    {category && <span>· Category: <strong>{category}</strong></span>}
                    {severity && <span>· Severity: <strong>{severity}</strong></span>}
                </div>
            )}

            {/* ── Log table ───────────────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm">
                        No audit logs match your filters
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Entity</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {logs.map(log => (
                                    <tr key={log._id}
                                        onClick={() => setSelectedLog(log)}
                                        className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                                            log.success === false ? 'bg-red-50' : ''
                                        }`}
                                    >
                                        {/* Time */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="text-xs text-gray-800 font-medium">
                                                {moment(log.timestamp).format('MMM D, h:mm A')}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {moment(log.timestamp).fromNow()}
                                            </div>
                                        </td>

                                        {/* Action */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <SeverityIcon severity={log.severity} />
                                                <span className="text-xs font-mono font-medium text-gray-800">
                                                    {log.action}
                                                </span>
                                            </div>
                                            {log.description && (
                                                <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">
                                                    {log.description}
                                                </p>
                                            )}
                                        </td>

                                        {/* Category */}
                                        <td className="px-4 py-3">
                                            <Badge
                                                text={log.category}
                                                colorClass={CATEGORY_COLORS[log.category] || 'bg-gray-100 text-gray-700'}
                                            />
                                        </td>

                                        {/* User */}
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-medium text-gray-800">
                                                {log.userName || '—'}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {log.branchName || log.branchId || ''}
                                            </p>
                                        </td>

                                        {/* Entity */}
                                        <td className="px-4 py-3">
                                            {log.entityType && (
                                                <p className="text-xs text-gray-600 font-mono">
                                                    {log.entityType}
                                                </p>
                                            )}
                                            {log.entityId && (
                                                <p className="text-xs text-gray-400 font-mono truncate max-w-[120px]"
                                                    title={log.entityId}>
                                                    {log.entityId.slice(0, 12)}…
                                                </p>
                                            )}
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            {log.success === false ? (
                                                <div className="flex items-center gap-1 text-red-500">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-medium">Failed</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-green-500">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span className="text-xs font-medium">OK</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Pagination ──────────────────────────────────────────────── */}
            {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                        Page {pagination.page} of {pagination.pages}
                        {' · '}{pagination.total.toLocaleString()} records
                    </p>
                    <div className="flex gap-2">
                        <button type="button"
                            onClick={() => { const p = page - 1; setPage(p); fetchLogs(p); }}
                            disabled={page <= 1}
                            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50
                                disabled:opacity-40 transition-colors">
                            <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button type="button"
                            onClick={() => { const p = page + 1; setPage(p); fetchLogs(p); }}
                            disabled={page >= pagination.pages}
                            className="p-1.5 border border-gray-200 rounded-lg hover:bg-gray-50
                                disabled:opacity-40 transition-colors">
                            <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Detail slide-in panel ───────────────────────────────────── */}
            <LogDetailPanel log={selectedLog} onClose={() => setSelectedLog(null)} />
        </div>
    );
};

export default AuditLogsPage;