// src/pages/settings/spaces-cleanup/index.js
// Root-only. Manual orphan-file cleanup for DigitalOcean Spaces:
//   Scan -> review orphans -> Quarantine (reversible) -> Purge after the retention window.
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import { toast } from 'react-toastify';
import { RefreshCw, ShieldAlert, Undo2, Trash2, Archive, EyeOff, Eye } from 'lucide-react';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const PAGE_SIZE = 25;
const API = () => getApiBaseUrl() + 'spaces-cleanup/';

const TABS = [
    { value: 'orphan', label: 'Orphans' },
    { value: 'quarantined', label: 'Quarantined' },
    { value: 'excluded', label: 'Excluded' },
];

const fmtBytes = (n = 0) => {
    if (n < 1024) return `${n} B`;
    const u = ['KB', 'MB', 'GB', 'TB'];
    let i = -1;
    do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return `${n.toFixed(n >= 100 ? 0 : 1)} ${u[i]}`;
};
const fmtNum = (n = 0) => Number(n).toLocaleString();
const isImage = (key = '') => /\.(jpe?g|png|webp|gif|bmp)$/i.test(key);

const SpacesCleanupPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const [overview, setOverview] = useState(null);
    const [tab, setTab] = useState('orphan');
    const [prefix, setPrefix] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(new Set());
    const [busy, setBusy] = useState(null);       // { label, done } while a batch loop runs
    const [confirm, setConfirm] = useState(null); // { title, body, danger, run }
    const wasRunning = useRef(false);

    useEffect(() => {
        if (currentUser && !currentUser.root) router.replace('/');
    }, [currentUser, router]);

    const loadOverview = useCallback(async () => {
        const res = await fetchWrapper.get(API() + 'overview');
        if (res?.success) setOverview(res);
        return res;
    }, []);

    const loadRows = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: tab, page, limit: PAGE_SIZE });
            if (prefix) params.set('prefix', prefix);
            const res = await fetchWrapper.get(API() + 'candidates?' + params.toString());
            if (res?.success) { setRows(res.rows); setTotal(res.total); }
        } finally {
            setLoading(false);
        }
    }, [tab, page, prefix]);

    useEffect(() => { loadOverview(); }, [loadOverview]);
    useEffect(() => { loadRows(); setSelected(new Set()); }, [loadRows]);

    const running = overview?.lastRun?.status === 'running';

    // Poll while a scan runs; refresh the list once it finishes.
    useEffect(() => {
        if (!running) {
            if (wasRunning.current) { wasRunning.current = false; loadRows(); }
            return;
        }
        wasRunning.current = true;
        const t = setInterval(loadOverview, 4000);
        return () => clearInterval(t);
    }, [running, loadOverview, loadRows]);

    if (!currentUser?.root) return null;

    const startScan = async () => {
        const res = await fetchWrapper.post(API() + 'scan', {});
        if (!res?.success) return toast.error(res?.message || 'Could not start the scan.');
        toast.success('Scan started. This can take several minutes on a large bucket.');
        loadOverview();
    };

    // One request = one batch; keep going while rows are still changing state.
    const runBatches = async (action, payload, label) => {
        let done = 0, failed = 0, skipped = 0;
        setBusy({ label, done });
        try {
            for (;;) {
                const res = await fetchWrapper.post(API() + 'action', { action, ...payload });
                if (!res?.success) { toast.error(res?.message || 'Action failed.'); break; }
                done += res.processed; failed += res.failed; skipped += res.skipped;
                setBusy({ label, done });
                if (res.remaining <= 0 || res.changed <= 0) break;
            }
            const parts = [`${fmtNum(done)} done`];
            if (skipped) parts.push(`${fmtNum(skipped)} skipped`);
            if (failed) parts.push(`${fmtNum(failed)} failed`);
            (failed ? toast.warn : toast.success)(`${label}: ${parts.join(', ')}.`);
        } finally {
            setBusy(null);
            setSelected(new Set());
            await Promise.all([loadOverview(), loadRows()]);
        }
    };

    const ask = (cfg) => setConfirm(cfg);
    const ids = [...selected];
    const counts = overview?.counts ?? {};
    const prefixes = overview?.prefixes?.[tab === 'quarantined' ? 'quarantined' : 'orphan'] ?? [];
    const stats = overview?.lastRun?.stats ?? {};
    const progress = stats.progress;
    const cfg = overview?.config ?? {};
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const allOnPage = rows.length > 0 && rows.every(r => selected.has(r._id));

    const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(rows.map(r => r._id)));

    return (
        <Layout>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Spaces Cleanup</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Finds files in Spaces that no database record points to. Nothing is deleted by a scan; quarantined files can be restored until purged.
                        </p>
                    </div>
                    <button
                        onClick={startScan}
                        disabled={running || !!busy}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
                        {running ? 'Scanning…' : 'Start scan'}
                    </button>
                </div>

                {/* Scan status */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 text-sm">
                    {!overview ? <Spinner /> : !overview.lastRun ? (
                        <p className="text-gray-500">No scan has been run yet.</p>
                    ) : running ? (
                        <div>
                            <p className="font-medium text-gray-900">
                                {progress?.phase === 'listing' ? 'Listing bucket' : 'Reading database references'}
                                {progress?.label ? <span className="font-normal text-gray-500"> — {progress.label}</span> : null}
                            </p>
                            {progress?.phase === 'listing' && (
                                <p className="text-gray-500 mt-1">
                                    {fmtNum(progress.listed)} objects listed · {fmtNum(progress.matched)} referenced · {fmtNum(progress.orphans)} orphans so far
                                </p>
                            )}
                            <p className="text-xs text-gray-400 mt-1">Started {moment.utc(overview.lastRun.started_at).local().fromNow()}. You can leave this page; the scan keeps running.</p>
                        </div>
                    ) : overview.lastRun.status === 'failed' ? (
                        <p className="text-red-600">
                            Last scan failed ({moment.utc(overview.lastRun.started_at).local().format('MMM D, h:mm A')}): {overview.lastRun.error}
                        </p>
                    ) : (
                        <div>
                            <p className="text-gray-700">
                                Last scan {moment.utc(overview.lastRun.finished_at).local().format('MMM D, YYYY h:mm A')} ·{' '}
                                {fmtNum(stats.listed)} objects listed · {fmtNum(stats.matched)} referenced ·{' '}
                                <b>{fmtNum(stats.orphans)} orphans ({fmtBytes(stats.orphanBytes)})</b> ·{' '}
                                {fmtNum(stats.tooNew)} skipped as too recent · {fmtNum(stats.protectedSkipped)} protected
                            </p>
                            {stats.warning && (
                                <p className="mt-2 flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />{stats.warning}
                                </p>
                            )}
                        </div>
                    )}
                    {cfg.minAgeHours && (
                        <p className="text-xs text-gray-400 mt-2">
                            Scope: {cfg.prefixes?.join(', ')} · files newer than {cfg.minAgeHours / 24} days are never flagged (temp/: 24 h) · protected: {cfg.protectedPrefixes?.join(', ')} · purge allowed {cfg.retentionDays} days after quarantine
                        </p>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
                    {TABS.map(t => (
                        <button
                            key={t.value}
                            onClick={() => { setTab(t.value); setPrefix(''); setPage(1); }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.value ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {t.label} <span className="text-gray-400">({fmtNum(counts[t.value]?.count)} · {fmtBytes(counts[t.value]?.bytes)})</span>
                        </button>
                    ))}
                </div>

                {/* Prefix groups + group actions */}
                {tab !== 'excluded' && prefixes.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        <button onClick={() => { setPrefix(''); setPage(1); }} className={`px-3 py-1 rounded-full text-xs border ${!prefix ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>All</button>
                        {prefixes.map(p => (
                            <button key={p.prefix} onClick={() => { setPrefix(p.prefix); setPage(1); }}
                                className={`px-3 py-1 rounded-full text-xs border ${prefix === p.prefix ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600'}`}>
                                {p.prefix} · {fmtNum(p.count)} · {fmtBytes(p.bytes)}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                    {tab === 'orphan' && (<>
                        <button disabled={!ids.length || !!busy} onClick={() => ask({
                            title: `Quarantine ${ids.length} selected file(s)?`,
                            body: 'They are moved to to-delete/ and can be restored. The database is re-checked first; anything still referenced is skipped.',
                            run: () => runBatches('quarantine', { ids }, 'Quarantine'),
                        })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white disabled:opacity-40"><Archive className="w-4 h-4" />Quarantine selected ({ids.length})</button>
                        <button disabled={!prefix || !!busy} title={prefix ? '' : 'Pick a prefix group above first'} onClick={() => ask({
                            title: `Quarantine ALL orphans in ${prefix}?`,
                            body: `${fmtNum(prefixes.find(p => p.prefix === prefix)?.count)} files. Preview a few first. They are moved to to-delete/ and can be restored until purged.`,
                            run: () => runBatches('quarantine', { prefix }, 'Quarantine'),
                        })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-600 text-amber-700 disabled:opacity-40"><Archive className="w-4 h-4" />Quarantine all in group</button>
                        <button disabled={!ids.length || !!busy} onClick={() => runBatches('exclude', { ids }, 'Exclude')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"><EyeOff className="w-4 h-4" />Exclude selected</button>
                    </>)}
                    {tab === 'quarantined' && (<>
                        <button disabled={!ids.length || !!busy} onClick={() => runBatches('restore', { ids }, 'Restore')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white disabled:opacity-40"><Undo2 className="w-4 h-4" />Restore selected ({ids.length})</button>
                        <button disabled={!prefix || !!busy} title={prefix ? '' : 'Pick a prefix group above first'} onClick={() => runBatches('restore', { prefix }, 'Restore')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 disabled:opacity-40"><Undo2 className="w-4 h-4" />Restore all in group</button>
                        <button disabled={!overview?.purgeable?.count || !!busy} onClick={() => ask({
                            danger: true,
                            title: `Permanently delete ${fmtNum(overview?.purgeable?.count)} file(s)?`,
                            body: `${fmtBytes(overview?.purgeable?.bytes)} quarantined more than ${cfg.retentionDays} days ago. This cannot be undone.`,
                            run: async () => {
                                // purge has no "all" shortcut on the server: it needs a group. Loop over the groups.
                                for (const p of (overview?.prefixes?.quarantined ?? [])) await runBatches('purge', { prefix: p.prefix }, `Purge ${p.prefix}`);
                            },
                        })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white disabled:opacity-40"><Trash2 className="w-4 h-4" />Purge expired ({fmtNum(overview?.purgeable?.count)})</button>
                    </>)}
                    {tab === 'excluded' && (
                        <button disabled={!ids.length || !!busy} onClick={() => runBatches('include', { ids }, 'Include')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"><Eye className="w-4 h-4" />Move back to orphans</button>
                    )}
                    {busy && <span className="text-gray-500 flex items-center gap-2"><Spinner />{busy.label}… {fmtNum(busy.done)} done</span>}
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : rows.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">Nothing here.</div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
                        <label className="flex items-center gap-3 px-4 py-2 bg-gray-50 text-xs text-gray-500">
                            <input type="checkbox" checked={allOnPage} onChange={toggleAll} /> Select this page
                        </label>
                        {rows.map(r => (
                            <div key={r._id} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                                <input type="checkbox" checked={selected.has(r._id)} onChange={() => toggle(r._id)} />
                                <div className="w-14 h-14 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden flex items-center justify-center text-[10px] text-gray-400">
                                    {r.previewUrl && isImage(r.object_key)
                                        // eslint-disable-next-line @next/next/no-img-element
                                        ? <img src={r.previewUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                                        : 'no preview'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-mono text-gray-800 truncate" title={r.object_key}>{r.object_key}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {fmtBytes(r.size_bytes)} · modified {moment.utc(r.last_modified).local().format('MMM D, YYYY')}
                                        {r.acted_at && tab !== 'orphan' ? ` · ${r.status} ${moment.utc(r.acted_at).local().format('MMM D, YYYY')}` : ''}
                                    </p>
                                    {r.note && <p className="text-xs text-amber-600 mt-0.5">{r.note}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
                    <span>{fmtNum(total)} files</span>
                    <div className="flex items-center gap-2">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Prev</button>
                        <span>Page {page} / {totalPages}</span>
                        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-gray-200 disabled:opacity-40">Next</button>
                    </div>
                </div>
            </div>

            {confirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <h2 className={`text-lg font-semibold ${confirm.danger ? 'text-red-700' : 'text-gray-900'}`}>{confirm.title}</h2>
                        <p className="text-sm text-gray-600 mt-2">{confirm.body}</p>
                        <div className="flex justify-end gap-2 mt-5">
                            <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">Cancel</button>
                            <button onClick={() => { const c = confirm; setConfirm(null); c.run(); }}
                                className={`px-4 py-2 rounded-lg text-sm text-white ${confirm.danger ? 'bg-red-600' : 'bg-amber-600'}`}>Confirm</button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default SpacesCleanupPage;
