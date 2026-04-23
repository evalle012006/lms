import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import {
    X, ShieldAlert, CheckCircle2, ChevronLeft, ChevronRight,
    Download, Printer, Filter, Search,
} from 'lucide-react';
import moment from 'moment';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

// ─── Tab definitions ────────────────────────────────────────────────────────
const ALERT_TABS = [
    { key: 'successive_delinquent_transaction', label: 'Successive Delinquent', icon: '⚠️', color: 'orange' },
    { key: 'delinquent_client_as_reloaner',     label: 'Delinquent as Reloaner', icon: '🚨', color: 'red'    },
];

// ─── Tiny select wrapper (no react-select dep needed here) ──────────────────
const NativeSelect = ({ value, onChange, options, placeholder, className = '' }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-400 ${className}`}
    >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
        ))}
    </select>
);

// ─── Main component ──────────────────────────────────────────────────────────
const DelinquentAlertsModal = ({ onClose, onNavigate }) => {
    const currentUser  = useSelector(state => state.user.data);
    const currentDate  = useSelector(state => state.systemSettings.currentDate);

    const rep       = currentUser?.role?.rep;
    const branchId  = currentUser?.designatedBranchId || currentUser?.branchId;

    // ── State ──────────────────────────────────────────────────────────────
    const [activeTab,    setActiveTab]    = useState(ALERT_TABS[0].key);
    const [alerts,       setAlerts]       = useState([]);
    const [loading,      setLoading]      = useState(false);
    const [dateFilter,   setDateFilter]   = useState(moment(currentDate).format('YYYY-MM-DD'));

    // Filters — role-dependent
    const [branchList,   setBranchList]   = useState([]);
    const [loList,       setLoList]       = useState([]);
    const [groupList,    setGroupList]    = useState([]);
    const [selBranch,    setSelBranch]    = useState('');
    const [selLo,        setSelLo]        = useState('');
    const [selGroup,     setSelGroup]     = useState('');

    const printRef = useRef(null);

    // ── Fetch filter options ───────────────────────────────────────────────

    const fetchBranches = useCallback(async () => {
        if (rep > 2) return;
        try {
            const r = await fetchWrapper.get(getApiBaseUrl() + 'branches/list');
            if (r.success) {
                setBranchList(r.branches.map(b => ({ value: b._id, label: `${b.code} ${b.name}`.trim() })));
            }
        } catch (e) { console.error('fetchBranches', e); }
    }, [rep]);

    const fetchLoanOfficers = useCallback(async (bid) => {
        try {
            const targetBranch = bid || (rep === 3 ? branchId : '');
            if (!targetBranch) return;
            const r = await fetchWrapper.get(
                getApiBaseUrl() + 'users/list?' + new URLSearchParams({ branchId: targetBranch })
            );
            if (r.success) {
                setLoList(
                    (r.users || [])
                        .filter(u => u.role?.rep === 4)
                        .map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}`.trim() }))
                );
            }
        } catch (e) { console.error('fetchLoanOfficers', e); }
    }, [rep, branchId]);

    const fetchGroups = useCallback(async (loId) => {
        try {
            const params = new URLSearchParams({ mode: 'all' });
            if (loId)     params.append('loId', loId);
            else if (rep === 3) params.append('branchId', branchId);
            const r = await fetchWrapper.get(getApiBaseUrl() + 'groups/list?' + params.toString());
            if (r.success) {
                setGroupList((r.groups || []).map(g => ({ value: g._id, label: g.name })));
            }
        } catch (e) { console.error('fetchGroups', e); }
    }, [rep, branchId]);

    useEffect(() => { fetchBranches(); }, [fetchBranches]);

    useEffect(() => {
        // BM auto-loads their own LOs on mount
        if (rep === 3) { fetchLoanOfficers(); fetchGroups(); }
    }, [rep, fetchLoanOfficers, fetchGroups]);

    // When branch changes (for rep <= 2), reload LOs + clear downstream
    useEffect(() => {
        if (!selBranch) return;
        setSelLo(''); setSelGroup(''); setLoList([]); setGroupList([]);
        fetchLoanOfficers(selBranch);
    }, [selBranch]);

    // When LO changes, reload groups
    useEffect(() => {
        setSelGroup('');
        setGroupList([]);
        fetchGroups(selLo || undefined);
    }, [selLo]);

    // ── Fetch alerts ───────────────────────────────────────────────────────

    const fetchAlerts = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit:  '100',
                offset: '0',
                types:  'successive_delinquent_transaction,delinquent_client_as_reloaner',
            });
            if (dateFilter) params.append('date', dateFilter);
            if (selBranch)  params.append('branchId', selBranch);
            if (selLo)      params.append('loId', selLo);
            if (selGroup)   params.append('groupId', selGroup);

            const r = await fetchWrapper.get(getApiBaseUrl() + 'notifications/list?' + params.toString());
            if (r.success) setAlerts(r.notifications || []);
        } catch (e) {
            console.error('fetchAlerts', e);
        } finally {
            setLoading(false);
        }
    }, [dateFilter, selBranch, selLo, selGroup]);

    useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

    // ── Date navigation ────────────────────────────────────────────────────
    const goDate = (delta) => {
        setDateFilter(prev => moment(prev).add(delta, 'days').format('YYYY-MM-DD'));
    };

    // ── Derived ────────────────────────────────────────────────────────────
    const filtered    = alerts.filter(a => a.type === activeTab);
    const totalUnread = alerts.filter(a => !a.is_read).length;

    const parseData = (a) =>
        typeof a.data === 'string' ? JSON.parse(a.data || '{}') : (a.data || {});

    // ── Export to Excel ────────────────────────────────────────────────────
    const handleExport = async () => {
        try {
            // Use ExcelJS which is already in the project
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Delinquent Alerts');

            const tabLabel = ALERT_TABS.find(t => t.key === activeTab)?.label || 'Alerts';

            // Title rows
            ws.mergeCells('A1:G1');
            ws.getCell('A1').value    = `${tabLabel} — ${moment(dateFilter).format('MMMM D, YYYY')}`;
            ws.getCell('A1').font     = { bold: true, size: 13 };
            ws.getCell('A1').alignment = { horizontal: 'center' };

            ws.addRow([]); // spacer

            // Header row
            const isSuc = activeTab === 'successive_delinquent_transaction';
            const headers = isSuc
                ? ['Client', 'Group', 'Branch', 'Transacted By', 'Mispay #', 'Date', 'Status']
                : ['Client', 'Group', 'Branch', 'Transacted By', 'Date', 'Status'];

            const headerRow = ws.addRow(headers);
            headerRow.eachCell(cell => {
                cell.font    = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            headerRow.height = 20;

            // Data rows
            filtered.forEach((alert, i) => {
                const d    = parseData(alert);
                const row  = isSuc
                    ? [
                        d.clientName || '—',
                        d.groupName  || '—',
                        d.branchName || '—',
                        d.loName || alert.created_by_name || '—',
                        d.mispaymentCount || '—',
                        alert.date_added ? moment(alert.date_added).format('MMM D, YYYY h:mm A') : '—',
                        alert.is_read ? 'Read' : 'Unread',
                    ]
                    : [
                        d.clientName || '—',
                        d.groupName  || '—',
                        d.branchName || '—',
                        d.loName || alert.created_by_name || '—',
                        alert.date_added ? moment(alert.date_added).format('MMM D, YYYY h:mm A') : '—',
                        alert.is_read ? 'Read' : 'Unread',
                    ];
                const dataRow = ws.addRow(row);
                if (i % 2 === 0) {
                    dataRow.eachCell(cell => {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF5F5' } };
                    });
                }
            });

            // Column widths
            ws.columns = isSuc
                ? [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 12 }, { width: 24 }, { width: 10 }]
                : [{ width: 28 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 24 }, { width: 10 }];

            const buf = await wb.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `delinquent-alerts-${dateFilter}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed', e);
        }
    };

    // ── Print ──────────────────────────────────────────────────────────────
    const handlePrint = () => {
        const isSuc      = activeTab === 'successive_delinquent_transaction';
        const tabLabel   = ALERT_TABS.find(t => t.key === activeTab)?.label || 'Alerts';
        const dateLabel  = moment(dateFilter).format('MMMM D, YYYY');

        const headerCells = isSuc
            ? `<th>Client</th><th>Group</th><th>Branch</th><th>Transacted By</th><th>Mispay #</th><th>Date</th>`
            : `<th>Client</th><th>Group</th><th>Branch</th><th>Transacted By</th><th>Date</th>`;

        const rows = filtered.map(alert => {
            const d = parseData(alert);
            const cells = isSuc
                ? `<td>${d.clientName || '—'}</td><td>${d.groupName || '—'}</td><td>${d.branchName || '—'}</td><td>${d.loName || alert.created_by_name || '—'}</td><td style="text-align:center">${d.mispaymentCount || '—'}</td><td>${alert.date_added ? moment(alert.date_added).format('MMM D, YYYY h:mm A') : '—'}</td>`
                : `<td>${d.clientName || '—'}</td><td>${d.groupName || '—'}</td><td>${d.branchName || '—'}</td><td>${d.loName || alert.created_by_name || '—'}</td><td>${alert.date_added ? moment(alert.date_added).format('MMM D, YYYY h:mm A') : '—'}</td>`;
            return `<tr>${cells}</tr>`;
        }).join('');

        const html = `
            <html><head><title>Delinquent Alerts</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; }
                h2 { font-size: 14px; margin-bottom: 4px; }
                p  { font-size: 11px; color: #555; margin: 0 0 12px; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #dc2626; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
                td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 11px; }
                tr:nth-child(even) td { background: #fff5f5; }
            </style></head>
            <body>
                <h2>${tabLabel}</h2>
                <p>Date: ${dateLabel} &nbsp;|&nbsp; Total: ${filtered.length} alert${filtered.length !== 1 ? 's' : ''}</p>
                <table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>
            </body></html>`;

        const win = window.open('', '_blank', 'width=900,height=600');
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); win.close(); }, 400);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    const tab = ALERT_TABS.find(t => t.key === activeTab);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black bg-opacity-40" onClick={onClose} />

            {/* Modal — wider + taller */}
            <div className="relative bg-white rounded-xl shadow-2xl flex flex-col"
                 style={{ width: '90vw', maxWidth: '1100px', height: '88vh', maxHeight: '88vh' }}>

                {/* ── Header ───────────────────────────────────────────── */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-red-500" />
                        <h2 className="text-base font-bold text-gray-800">Delinquent Alerts</h2>
                        {totalUnread > 0 && (
                            <span className="px-2 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full">
                                {totalUnread} new
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Export */}
                        <button
                            onClick={handleExport}
                            title="Export to Excel"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 border border-green-200 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export
                        </button>
                        {/* Print */}
                        <button
                            onClick={handlePrint}
                            title="Print"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            Print
                        </button>
                        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* ── Tabs ─────────────────────────────────────────────── */}
                <div className="flex border-b border-gray-200 px-6 bg-gray-50 shrink-0">
                    {ALERT_TABS.map(t => {
                        const count  = alerts.filter(a => a.type === t.key).length;
                        const unread = alerts.filter(a => a.type === t.key && !a.is_read).length;
                        const active = activeTab === t.key;
                        return (
                            <button
                                key={t.key}
                                onClick={() => setActiveTab(t.key)}
                                className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap
                                    ${active
                                        ? t.color === 'red'
                                            ? 'border-red-500 text-red-600'
                                            : 'border-orange-500 text-orange-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <span>{t.icon}</span>
                                {t.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold
                                    ${active
                                        ? t.color === 'red' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                        : 'bg-gray-200 text-gray-600'}`}>
                                    {count}
                                </span>
                                {unread > 0 && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
                            </button>
                        );
                    })}
                </div>

                {/* ── Filter bar ───────────────────────────────────────── */}
                <div className="px-6 py-3 border-b border-gray-100 bg-white shrink-0">
                    <div className="flex flex-wrap items-center gap-3">

                        {/* Date navigation */}
                        <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                            <button
                                onClick={() => goDate(-1)}
                                className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <input
                                type="date"
                                value={dateFilter}
                                max={moment(currentDate).format('YYYY-MM-DD')}
                                onChange={e => setDateFilter(e.target.value)}
                                className="text-xs border-0 bg-transparent text-gray-700 focus:outline-none w-32 text-center"
                            />
                            <button
                                onClick={() => goDate(1)}
                                disabled={dateFilter >= moment(currentDate).format('YYYY-MM-DD')}
                                className="p-1 rounded hover:bg-gray-200 text-gray-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* "Today" shortcut */}
                        <button
                            onClick={() => setDateFilter(moment(currentDate).format('YYYY-MM-DD'))}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors
                                ${dateFilter === moment(currentDate).format('YYYY-MM-DD')
                                    ? 'bg-red-500 text-white border-red-500'
                                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
                        >
                            Today
                        </button>

                        {/* Branch filter — rep <= 2 only */}
                        {rep <= 2 && (
                            <NativeSelect
                                value={selBranch}
                                onChange={setSelBranch}
                                options={branchList}
                                placeholder="All Branches"
                                className="min-w-[140px]"
                            />
                        )}

                        {/* LO filter — rep <= 3 */}
                        {rep <= 3 && (
                            <NativeSelect
                                value={selLo}
                                onChange={setSelLo}
                                options={loList}
                                placeholder="All Loan Officers"
                                className="min-w-[160px]"
                            />
                        )}

                        {/* Group filter — rep <= 3 */}
                        {rep <= 3 && (
                            <NativeSelect
                                value={selGroup}
                                onChange={setSelGroup}
                                options={groupList}
                                placeholder="All Groups"
                                className="min-w-[140px]"
                            />
                        )}

                        {/* Clear filters */}
                        {(selBranch || selLo || selGroup) && (
                            <button
                                onClick={() => { setSelBranch(''); setSelLo(''); setSelGroup(''); }}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                            >
                                Clear filters
                            </button>
                        )}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin ml-auto" />
                        )}
                    </div>
                </div>

                {/* ── Context banner ───────────────────────────────────── */}
                <div className={`px-6 py-2 text-xs shrink-0
                    ${activeTab === 'delinquent_client_as_reloaner'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-orange-50 text-orange-700'}`}>
                    {activeTab === 'successive_delinquent_transaction'
                        ? 'Clients who have been marked delinquent multiple times — potential bad debt risk.'
                        : 'Clients flagged as delinquent who are being processed for a new loan cycle — requires immediate review.'}
                    <span className="ml-2 font-semibold">{moment(dateFilter).format('MMMM D, YYYY')}</span>
                </div>

                {/* ── Table ────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto" ref={printRef}>
                    {loading && filtered.length === 0 ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="w-7 h-7 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mb-3 text-green-300" />
                            <p className="text-sm font-medium">No alerts for this date and filter.</p>
                        </div>
                    ) : (
                        <table className="w-full text-xs">
                            <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600 w-5"></th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Group</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Branch</th>
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Transacted By</th>
                                    {activeTab === 'successive_delinquent_transaction' && (
                                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Mispay #</th>
                                    )}
                                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Date & Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map((alert, i) => {
                                    const d       = parseData(alert);
                                    const isUnread = !alert.is_read;
                                    const count   = d.mispaymentCount || 0;
                                    return (
                                        <tr
                                            key={alert._id}
                                            onClick={() => onNavigate && onNavigate(alert)}
                                            className={`cursor-pointer transition-colors hover:bg-gray-50
                                                ${isUnread
                                                    ? activeTab === 'delinquent_client_as_reloaner'
                                                        ? 'bg-red-50'
                                                        : 'bg-orange-50'
                                                    : 'bg-white'}`}
                                        >
                                            <td className="px-4 py-3">
                                                {isUnread && <span className="block w-2 h-2 rounded-full bg-red-500" />}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {d.clientName || '—'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">{d.groupName  || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{d.branchName || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {d.loName || alert.created_by_name || '—'}
                                            </td>
                                            {activeTab === 'successive_delinquent_transaction' && (
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-xs
                                                        ${count >= 5 ? 'bg-red-100 text-red-700'
                                                        : count >= 3 ? 'bg-orange-100 text-orange-700'
                                                        :              'bg-yellow-100 text-yellow-700'}`}>
                                                        {count || '—'}
                                                    </span>
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                                                {alert.date_added
                                                    ? moment(alert.date_added).format('MMM D, YYYY h:mm A')
                                                    : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* ── Footer ───────────────────────────────────────────── */}
                <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center bg-gray-50 rounded-b-xl shrink-0">
                    <p className="text-xs text-gray-400">
                        {filtered.length} alert{filtered.length !== 1 ? 's' : ''} on {moment(dateFilter).format('MMM D, YYYY')}
                        {filtered.filter(a => !a.is_read).length > 0 && (
                            <span className="ml-2 text-red-500 font-semibold">
                                ({filtered.filter(a => !a.is_read).length} unread)
                            </span>
                        )}
                    </p>
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DelinquentAlertsModal;