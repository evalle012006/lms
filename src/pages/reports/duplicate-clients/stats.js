// src/pages/reports/duplicate-clients/stats.js
// Reports > Duplicate Clients > Statistics. Admin: everything; branch manager..division head: own branches only (the API scopes it).
// Statistics: how many duplicate clients each Group / LO / Branch / Area / Region / Division has.
// Data comes from the stored scan (clients/duplicates/stats); definitions are in lib/duplicate-stats.js.

import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import Link from 'next/link';
import moment from 'moment';
import { toast } from 'react-toastify';
import { Download } from 'lucide-react';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import HierarchyFilters from '@/components/settings/duplicate-clients/HierarchyFilters';
import { duplicateAccess, statsLevelsFor } from '@/lib/duplicate-access';

const LEVELS = [
    { value: 'division', label: 'Division', filter: 'divisionId' },
    { value: 'region', label: 'Region', filter: 'regionId' },
    { value: 'area', label: 'Area', filter: 'areaId' },
    { value: 'branch', label: 'Branch', filter: 'branchId' },
    { value: 'lo', label: 'Loan officer', filter: 'loId' },
    { value: 'group', label: 'Group', filter: 'groupId' },
];

const hasAccess = (u) => !!duplicateAccess(u);

const Stat = ({ label, value, tone = 'text-gray-900', hint }) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4" title={hint}>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-2xl font-bold ${tone}`}>{Number(value ?? 0).toLocaleString()}</p>
    </div>
);

const num = (n) => Number(n ?? 0).toLocaleString();

const StatsPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const allowed = statsLevelsFor(currentUser);
    const [level, setLevel] = useState('branch');
    useEffect(() => {
        if (allowed.length && !allowed.includes(level)) setLevel(allowed.includes('branch') ? 'branch' : allowed[0]);
    }, [allowed.join(','), level]); // eslint-disable-line react-hooks/exhaustive-deps
    const [includeClosed, setIncludeClosed] = useState(false);
    const [hf, setHf] = useState({ divisionId: '', regionId: '', areaId: '', branchId: '' });
    const [data, setData] = useState(null);
    const [hierarchy, setHierarchy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (currentUser && !hasAccess(currentUser)) router.replace('/');
    }, [currentUser, router]);

    const params = useCallback((extra = {}) => {
        const p = new URLSearchParams({ level, ...extra });
        if (includeClosed) p.set('includeClosed', 'true');
        Object.entries(hf).forEach(([k, v]) => v && p.set(k, v));
        return p;
    }, [level, includeClosed, hf]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/duplicates/stats?' + params().toString());
            if (!res?.success) { toast.error(res?.message || 'Failed to load statistics.'); return; }
            setData(res);
            setHierarchy(res.hierarchy);
        } catch (e) {
            toast.error(e.message || 'Failed to load statistics.');
        } finally {
            setLoading(false);
        }
    }, [params]);

    useEffect(() => { if (hasAccess(currentUser)) load(); }, [load, currentUser]);

    const levelInfo = LEVELS.find(l => l.value === level);

    const listHref = (row) => {
        if (row.key == null) return null;
        const q = new URLSearchParams({ view: 'active', [levelInfo.filter]: row.key });
        // Keep the hierarchy filters that are not the level being drilled into.
        Object.entries(hf).forEach(([k, v]) => v && k !== levelInfo.filter && q.set(k, v));
        return `/reports/duplicate-clients?${q.toString()}`;
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/duplicates/stats?' + params({ all: 'true' }).toString());
            if (!res?.success) { toast.error(res?.message || 'Export failed.'); return; }
            const ExcelJS = (await import('exceljs')).default;
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Duplicate statistics');
            ws.addRow([`Duplicate clients by ${levelInfo.label.toLowerCase()} — ${includeClosed ? 'all groups (incl. closed/offset)' : 'groups with an active loan'}`]).font = { bold: true };
            ws.addRow([`Generated ${moment().format('YYYY-MM-DD HH:mm')}; scan finished ${res.scanFinishedAt ? moment(res.scanFinishedAt).format('YYYY-MM-DD HH:mm') : 'n/a'}`]);
            ws.addRow([]);
            const header = ws.addRow([levelInfo.label, 'Branch', 'Duplicate clients', 'With active loan', 'Involved records', 'Groups', 'Exact groups', 'Multiple-active groups']);
            header.font = { bold: true };
            res.rows.forEach(r => ws.addRow([r.label, r.sub ?? '', r.duplicateClients, r.activeDuplicates, r.involvedRecords, r.groups, r.exactGroups, r.bothActiveGroups]));
            ws.addRow(['TOTAL', '', res.totals.duplicateClients, res.totals.activeDuplicates, res.totals.involvedRecords, res.totals.groups]).font = { bold: true };
            ws.columns.forEach((c, i) => { c.width = i < 2 ? 32 : 18; });
            const buffer = await wb.xlsx.writeBuffer();
            const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `duplicate-stats-${level}-${moment().format('YYYYMMDD-HHmm')}.xlsx`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch (e) {
            toast.error('Export failed.');
        } finally {
            setExporting(false);
        }
    };

    if (!hasAccess(currentUser)) return null;

    return (
        <Layout>
            <div className="w-full">
                <div className="flex items-start justify-between mb-4 gap-4">
                    <div>
                        <Link href="/reports/duplicate-clients" className="text-sm text-blue-600 hover:text-blue-800">← Duplicate Clients</Link>
                        <h1 className="text-2xl font-bold text-gray-900 mt-1">Duplicate Client Statistics</h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
                            In every duplicate group the oldest record is the original; each other record is a <b>duplicate client</b>,
                            counted under the group, LO, branch, area, region and division it belongs to today.
                            {data?.scanFinishedAt && <span className="ml-1">As of the scan finished {moment(data.scanFinishedAt).fromNow()}.</span>}
                        </p>
                    </div>
                    <button type="button" onClick={exportExcel} disabled={exporting || loading}
                        className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                        <Download className="w-4 h-4" /> {exporting ? 'Exporting…' : 'Export Excel'}
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <Stat label="Duplicate clients" value={data?.totals.duplicateClients} tone="text-red-600" hint="Records that are not the oldest in their group" />
                    <Stat label="…with an active loan" value={data?.totals.activeDuplicates} tone="text-orange-600" />
                    <Stat label="Records in duplicate groups" value={data?.totals.involvedRecords} hint="Originals + duplicates" />
                    <Stat label="Duplicate groups" value={data?.totals.groups} />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <HierarchyFilters hierarchy={hierarchy} value={hf} onChange={setHf} />
                    <label className="lg:col-span-4 flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
                        Include Closed / Offset-only groups
                        <span className="text-xs text-gray-400">(about 90% of all groups; slower to load, and mostly historical)</span>
                    </label>
                </div>

                <div className="flex gap-1 mb-2 border-b border-gray-200">
                    {LEVELS.filter(l => allowed.includes(l.value)).map(l => (
                        <button key={l.value} type="button" onClick={() => setLevel(l.value)}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${level === l.value
                                ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                            {l.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    {loading ? <div className="p-10 flex justify-center"><Spinner /></div> : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 text-left border-b border-gray-100">
                                    <th className="px-4 py-2">{levelInfo.label}</th>
                                    <th className="px-2 text-right">Duplicate clients</th>
                                    <th className="px-2 text-right">With active loan</th>
                                    <th className="px-2 text-right">Involved records</th>
                                    <th className="px-2 text-right">Groups</th>
                                    <th className="px-2 text-right">Exact</th>
                                    <th className="px-2 text-right">Multiple active</th>
                                    <th className="px-4" />
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.rows ?? []).map((r, i) => {
                                    const href = listHref(r);
                                    return (
                                        <tr key={r.key ?? `u${i}`} className="border-t border-gray-100">
                                            <td className="px-4 py-2">
                                                {r.label}{r.sub && <span className="text-gray-400"> · {r.sub}</span>}
                                            </td>
                                            <td className="px-2 text-right font-semibold text-red-600">{num(r.duplicateClients)}</td>
                                            <td className="px-2 text-right text-orange-600">{num(r.activeDuplicates)}</td>
                                            <td className="px-2 text-right">{num(r.involvedRecords)}</td>
                                            <td className="px-2 text-right">{num(r.groups)}</td>
                                            <td className="px-2 text-right">{num(r.exactGroups)}</td>
                                            <td className="px-2 text-right">{num(r.bothActiveGroups)}</td>
                                            <td className="px-4 text-right">
                                                {href && <Link href={href} className="text-blue-600 hover:text-blue-800 whitespace-nowrap">View groups →</Link>}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {(data?.rows ?? []).length === 0 && (
                                    <tr><td colSpan={8} className="px-4 py-6 text-gray-400">No duplicates for these filters.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
                {data?.truncated && (
                    <p className="text-xs text-gray-500 mt-2">Showing the top {data.rows.length} of {num(data.rowCount)} rows. Export to Excel for all of them.</p>
                )}
                <p className="text-xs text-gray-400 mt-3">
                    “Unassigned” = records with no {levelInfo.label.toLowerCase()} on file. “Groups” counts a group once for every {levelInfo.label.toLowerCase()} it touches,
                    so group counts can add up to more than the total. Duplicate clients always add up exactly.
                </p>
            </div>
        </Layout>
    );
};

export default StatsPage;
