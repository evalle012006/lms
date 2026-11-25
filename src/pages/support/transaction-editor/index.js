// src/pages/support/transaction-editor/index.js
// Support Transaction Editor: find a client -> pick a loan -> edit the loan / cash collections / bad debt / withdrawals / client.
// Every save is validated server-side and written to support_edits (+ audit_logs).
import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/router';
import moment from 'moment';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import RecordEditor from '@/components/support/RecordEditor';
import EditTrail from '@/components/support/EditTrail';
import BrowsePanel from '@/components/support/BrowsePanel';
import RestoreCollection from '@/components/support/RestoreCollection';
import AnalyzePanel from '@/components/support/AnalyzePanel';
import GroupLockBar from '@/components/support/GroupLockBar';
import { StatusChip, Btn, IdTag } from '@/components/support/ui';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { canUseSupportEditor } from '@/lib/support-edit-config';

const api = (p) => getApiBaseUrl() + 'support/' + p;
const TABS = [
    { key: 'client', label: 'Client' },
    { key: 'loans', label: 'Loan' },
    { key: 'cashCollections', label: 'Cash collections' },
    { key: 'badDebtCollections', label: 'Bad debt' },
    { key: 'mcbu_withdrawals', label: 'Withdrawals' },
];
const peso = (n) => Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });

const rowLabel = (entity, r) => {
    if (entity === 'cashCollections') return `${String(r.dateAdded ?? '').slice(0, 10)} · pay ${peso(r.paymentCollection)} · mcbu ${peso(r.mcbuCol)} · ${r.status}${r.remarks ? ` · ${r.remarks}` : ''}`;
    if (entity === 'badDebtCollections') return `${String(r.dateAdded ?? '').slice(0, 10)} · pay ${peso(r.paymentCollection)}`;
    return `${String(r.inserted_date ?? '').slice(0, 10)} · MCBU ${peso(r.mcbu_withdrawal_amount)} · CSF ${peso(r.csf_withdrawal_amount)} · ${r.status}`;
};

const SupportTransactionEditorPage = () => {
    const currentUser = useSelector((s) => s.user.data);
    const router = useRouter();

    const [q, setQ] = useState('');
    const [searching, setSearching] = useState(false);
    const [clients, setClients] = useState(null);
    const [client, setClient] = useState(null);
    const [loan, setLoan] = useState(null);
    const [tab, setTab] = useState('loans');
    const [rows, setRows] = useState([]);
    const [rowId, setRowId] = useState(null);
    const [mode, setMode] = useState('browse'); // 'browse' (branch > LO > group) | 'client'
    const [from, setFrom] = useState('');     // date window for the row list (old transactions)
    const [to, setTo] = useState('');
    const [loaded, setLoaded] = useState(null);   // { record, fields, entity }
    const [restoring, setRestoring] = useState(true); // true until the URL state (refresh) has been applied
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [recon, setRecon] = useState(null);     // { loanId, items, latest } — loan vs its collection rows
    const [prefill, setPrefill] = useState(null); // { entity, draft, reason } handed to an editor (loan sync / Analyze > Repair)
    const [lockMine, setLockMine] = useState(false);

    useEffect(() => {
        if (currentUser && !canUseSupportEditor(currentUser)) router.replace('/');
    }, [currentUser, router]);

    async function search(e) {
        e?.preventDefault();
        setSearching(true); setError(null);
        try {
            const res = await fetchWrapper.get(api('search') + '?q=' + encodeURIComponent(q.trim()));
            if (!res.success) { setError(res.message); setClients(null); return; }
            setClients(res.clients);
        } finally { setSearching(false); }
    }

    // load whatever the current tab needs
    const loadTab = useCallback(async () => {
        if (!client) return;
        setLoading(true); setError(null); setLoaded(null);
        try {
            if (tab === 'client') {
                const res = await fetchWrapper.get(api('record') + `?entity=client&id=${encodeURIComponent(client._id)}`);
                res.success ? setLoaded({ ...res }) : setError(res.message);
            } else if (tab === 'loans') {
                if (!loan) return;
                const res = await fetchWrapper.get(api('record') + `?entity=loans&id=${encodeURIComponent(loan._id)}`);
                res.success ? setLoaded({ ...res }) : setError(res.message);
            } else {
                if (!loan) return;
                if (!rowId) {
                    const res = await fetchWrapper.get(api('record') + `?entity=${tab}&loanId=${encodeURIComponent(loan._id)}${from ? `&from=${from}` : ''}${to ? `&to=${to}` : ''}`);
                    res.success ? setRows(res.rows) : setError(res.message);
                } else {
                    const res = await fetchWrapper.get(api('record') + `?entity=${tab}&id=${encodeURIComponent(rowId)}`);
                    res.success ? setLoaded({ ...res }) : setError(res.message);
                }
            }
        } finally { setLoading(false); }
    }, [client, loan, tab, rowId, from, to]);

    useEffect(() => { loadTab(); }, [loadTab]);

    async function checkLoan(loanId = loan?._id, afterEdit = false) {
        if (!loanId) return;
        const res = await fetchWrapper.get(api('reconcile') + '?loanId=' + encodeURIComponent(loanId));
        if (res.success) setRecon({ ...res, afterEdit, picked: Object.fromEntries(res.items.map((i) => [i.field, i.confidence === 'high'])) });
        else setError(res.message);
    }
    // Analyze > Repair: open the right editor with the proposed values filled in (nothing is saved yet)
    function startRepair({ entity, id, draft, reason }) {
        setPrefill({ entity, draft, reason });
        setTab(entity); setRows([]); setLoaded(null); setError(null);
        setRowId(entity === 'cashCollections' ? id : null);
    }
    function applyToLoan() {
        const draft = Object.fromEntries(recon.items.filter((i) => recon.picked[i.field]).map((i) => [i.field, i.suggested]));
        if (!Object.keys(draft).length) return;
        setPrefill({ entity: 'loans', draft, reason: `Sync loan with its cash collection rows after a support correction (latest row ${String(recon.latest?.dateAdded ?? '').slice(0, 10)}).` });
        setRecon(null);
        changeTab('loans');
    }

    const pickClient = (c) => { setClient(c); setLoan(c.loans?.[0] ?? null); setTab(c.loans?.length ? 'loans' : 'client'); setRowId(null); setRows([]); setLoaded(null); };
    // A loan picked from the Branch > LO > Group browser: load its client (with every loan) and select that loan.
    const pickBrowsedLoan = async (l) => {
        setError(null);
        try {
            const res = await fetchWrapper.get(api('search') + '?q=' + encodeURIComponent(l.clientId));
            const c = res?.clients?.find((x) => x._id === l.clientId);
            if (!c) { setError('Could not load this loan\'s client.'); return; }
            pickClient(c);
            const chosen = c.loans.find((x) => x._id === l._id);
            if (chosen) setLoan(chosen);
        } catch (e) { setError(e?.message || 'Could not load the client.'); }
    };
    // ---- keep the screen across a browser refresh: client / loan / tab / row live in the URL ----
    useEffect(() => {
        if (!router.isReady) return;
        const { client: cid, loan: lid, tab: t, row, mode: m } = router.query;
        if (m === 'client' || m === 'browse') setMode(m);
        if (!cid) { setRestoring(false); return; }
        (async () => {
            try {
                const res = await fetchWrapper.get(api('search') + '?q=' + encodeURIComponent(String(cid)));
                const c = res?.clients?.find((x) => x._id === cid);
                if (c) {
                    setClient(c);
                    setLoan(c.loans.find((l) => l._id === lid) ?? c.loans[0] ?? null);
                    if (TABS.some((x) => x.key === t)) setTab(t);
                    if (row) setRowId(String(row));
                }
            } finally { setRestoring(false); }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    useEffect(() => {
        if (!router.isReady || restoring) return;
        const query = {};
        if (mode !== 'browse') query.mode = mode;
        if (client) { query.client = client._id; if (loan) query.loan = loan._id; query.tab = tab; if (rowId) query.row = rowId; }
        // history.replaceState, not router.replace: a Next route change fires the app's global route-loading
        // indicator and remounts the page on every keystroke-sized state change (that was the endless spinner / flicker).
        const qs = new URLSearchParams(query).toString();
        const url = window.location.pathname + (qs ? `?${qs}` : '');
        if (url !== window.location.pathname + window.location.search) window.history.replaceState(window.history.state, '', url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client, loan, tab, rowId, mode, restoring]);

    const changeTab = (t) => { if (prefill && prefill.entity !== t) setPrefill(null); setTab(t); setRowId(null); setRows([]); setLoaded(null); setError(null); };

    if (currentUser && !canUseSupportEditor(currentUser)) return null;

    const resetClient = () => { setClient(null); setLoan(null); setLoaded(null); setRecon(null); setRows([]); setRowId(null); };
    const isRowTab = ['cashCollections', 'badDebtCollections', 'mcbu_withdrawals'].includes(tab);
    const stat = (label, value) => (
        <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 min-w-[110px]">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
            <p className="text-sm font-semibold text-gray-900 tabular-nums">{value}</p>
        </div>
    );

    return (
        <Layout>
            <div className="w-full max-w-[1700px] mx-auto">
                <div className="mb-5">
                    <h1 className="text-2xl font-semibold text-gray-900">Support Transaction Editor</h1>
                    <p className="text-sm text-gray-600">Every correction is validated, applied immediately and recorded: who, what, before / after and why.</p>
                </div>

                {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

                {restoring && <Spinner />}

                {!restoring && !client && (
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                        <div className="flex gap-1 border-b border-gray-200 px-4 pt-3">
                            {[['browse', 'Browse by branch / loan officer'], ['client', 'Find a client']].map(([k, label]) => (
                                <button key={k} onClick={() => setMode(k)}
                                    className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${mode === k ? 'border-primary-1 text-primary-2' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{label}</button>
                            ))}
                        </div>
                        <div className="p-4">
                            {mode === 'browse' ? <BrowsePanel onPickLoan={pickBrowsedLoan} /> : (
                                <>
                                    <form onSubmit={search} className="flex gap-2 mb-4">
                                        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Client name or client ID (min. 3 characters)"
                                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40 focus:border-primary-1" />
                                        <Btn type="submit" disabled={q.trim().length < 3 || searching}>Search</Btn>
                                    </form>
                                    {searching ? <Spinner /> : clients && (
                                        clients.length === 0 ? <p className="text-sm text-gray-500">No clients found.</p> : (
                                            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                {clients.map((c) => (
                                                    <button key={c._id} onClick={() => pickClient(c)} className="text-left border border-gray-200 rounded-lg p-3 hover:border-primary-1 hover:bg-primary-4/20">
                                                        <span className="block font-medium text-gray-900">{c.fullName}</span>
                                                        <span className="block text-xs text-gray-600">{c.branchName} · {c.groupName} · {c.loans.length} loan(s)</span>
                                                        <span className="block text-[11px] font-mono text-gray-400">{c._id}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {!restoring && client && (
                    <div className="space-y-4">
                        {/* who + which loan */}
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <p className="text-lg font-semibold text-gray-900">{client.fullName}</p>
                                    <p className="text-sm text-gray-600">{client.branchName} · {client.groupName}</p>
                                    <IdTag label="Client ID" value={client._id} />
                                </div>
                                <Btn variant="outline" onClick={resetClient}>← Back to search</Btn>
                            </div>

                            {client.loans.length > 0 && (
                                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] items-end">
                                    <label className="block text-sm">
                                        <span className="text-gray-700 font-medium">Loan</span>
                                        <select value={loan?._id ?? ''} onChange={(e) => { setLoan(client.loans.find((l) => l._id === e.target.value)); setRowId(null); setRows([]); setRecon(null); }}
                                            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40 focus:border-primary-1">
                                            {client.loans.map((l) => (
                                                <option key={l._id} value={l._id}>
                                                    Cycle {l.loanCycle} · {l.status} · principal {peso(l.principalLoan)} · balance {peso(l.loanBalance)} · {String(l.dateGranted ?? '').slice(0, 10)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {loan && (
                                        <div className="flex flex-col items-start lg:items-end">
                                            <Btn variant="outline" onClick={() => checkLoan(loan._id, false)}>Check balance against payments</Btn>
                                            <span className="mt-1 text-[11px] text-gray-500">Compares this loan's balance, MCBU and CSF with its saved collection rows.</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {loan && (
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <StatusChip status={loan.status} />
                                    {stat('Principal', peso(loan.principalLoan))}
                                    {stat('Released', peso(loan.amountRelease))}
                                    {stat('Balance', peso(loan.loanBalance))}
                                    {stat('MCBU', peso(loan.mcbu))}
                                    {stat('CSF', peso(loan.csf))}
                                    {stat('Granted', String(loan.dateGranted ?? '').slice(0, 10) || '—')}
                                    <span className="ml-auto"><IdTag label="Loan ID" value={loan._id} /></span>
                                </div>
                            )}
                        </div>

                        {recon && (
                            <div className="rounded-xl border border-primary-3 bg-primary-4/30 p-4 text-sm">
                                <p className="font-semibold text-primary-2">{recon.afterEdit ? 'Next step: does the loan need updating?' : 'Loan vs. its collection rows'}</p>
                                {recon.items.length === 0 ? (
                                    <p className="mt-1 text-gray-700">The loan already matches its saved collection rows{recon.latest ? ` (latest ${String(recon.latest.dateAdded).slice(0, 10)})` : ''}. Nothing to update.</p>
                                ) : (
                                    <>
                                        <p className="mt-1 text-gray-700">The loan differs from what its saved rows say. Tick what should be updated and review it in the loan editor, or skip.</p>
                                        <div className="mt-2 overflow-x-auto rounded-lg bg-white border border-gray-200">
                                            <table className="w-full text-xs"><thead className="bg-gray-50 text-gray-500 text-left"><tr><th className="p-2 w-8" /><th className="p-2">Field</th><th className="p-2">Loan now</th><th className="p-2">Rows say</th><th className="p-2">Basis</th></tr></thead><tbody>
                                                {recon.items.map((i) => (
                                                    <tr key={i.field} className="border-t border-gray-100">
                                                        <td className="p-2"><input type="checkbox" checked={!!recon.picked[i.field]} onChange={(e) => setRecon((r) => ({ ...r, picked: { ...r.picked, [i.field]: e.target.checked } }))} /></td>
                                                        <td className="p-2 font-medium text-gray-900">{i.field}</td>
                                                        <td className="p-2 text-red-600 line-through tabular-nums">{String(i.current ?? '—')}</td>
                                                        <td className="p-2 text-green-700 font-medium tabular-nums">{String(i.suggested)}</td>
                                                        <td className="p-2 text-gray-600">{i.basis}{i.confidence === 'review' ? ' · verify first' : ''}</td>
                                                    </tr>
                                                ))}
                                            </tbody></table>
                                        </div>
                                        <Btn className="mt-3 mr-2" onClick={applyToLoan}>Review selected in loan editor</Btn>
                                    </>
                                )}
                                <Btn variant="secondary" className="mt-3" onClick={() => setRecon(null)}>{recon.items.length ? 'Skip' : 'Close'}</Btn>
                            </div>
                        )}

                        {loan && <GroupLockBar groupId={loan.groupId} onChange={setLockMine} />}
                        {loan && <AnalyzePanel loanId={loan._id} rowId={tab === 'cashCollections' ? rowId : null} locked={lockMine} onRepair={startRepair} />}

                        {/* editor */}
                        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
                            <div className="flex gap-1 border-b border-gray-200 px-4 pt-2 overflow-x-auto">
                                {TABS.map((t) => (
                                    <button key={t.key} onClick={() => changeTab(t.key)}
                                        className={`px-4 py-2 text-sm whitespace-nowrap -mb-px border-b-2 ${tab === t.key ? 'border-primary-1 text-primary-2 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{t.label}</button>
                                ))}
                            </div>
                            <div className="p-4 lg:p-6">
                                {loading ? <Spinner /> : (
                                    <>
                                        {tab === 'cashCollections' && !rowId && loan && <RestoreCollection loanId={loan._id} onRestored={(id) => { setFrom(''); setTo(''); setRowId(id); }} />}
                                        {isRowTab && !rowId && (
                                            <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-gray-700">
                                                <span className="font-medium">Date</span>
                                                <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" />
                                                <span>to</span>
                                                <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" />
                                                {(from || to) && <button onClick={() => { setFrom(''); setTo(''); }} className="text-primary-2 hover:underline">Clear</button>}
                                                <span className="ml-auto text-xs text-gray-500">{rows.length} row(s) — pick one to edit</span>
                                            </div>
                                        )}
                                        {isRowTab && !rowId && (
                                            rows.length === 0 ? <p className="text-sm text-gray-500">No rows for this loan{from || to ? ' in this date range' : ''}.</p> : (
                                                <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                                                    {rows.map((r) => (
                                                        <li key={r._id}>
                                                            <button onClick={() => setRowId(r._id)} className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-primary-4/30 tabular-nums">{rowLabel(tab, r)}</button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )
                                        )}
                                        {rowId && <button onClick={() => { setRowId(null); setLoaded(null); }} className="mb-4 text-sm text-primary-2 hover:underline">← Back to the list</button>}
                                        {loaded && loaded.entity === (tab) && (
                                            <RecordEditor key={loaded.record._id} entity={loaded.entity} record={loaded.record} fields={loaded.fields} onSaved={() => { loadTab(); if (tab === 'cashCollections' && loan) checkLoan(loan._id, true); }}
                                                initialDraft={prefill?.entity === tab ? prefill.draft : undefined} initialReason={prefill?.entity === tab ? prefill.reason : undefined} />
                                        )}
                                        {tab === 'loans' && !loan && <p className="text-sm text-gray-500">This client has no loans.</p>}
                                    </>
                                )}
                            </div>
                        </div>

                        {loan && <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 lg:px-6 pb-4"><EditTrail query={{ loanId: loan._id }} title="All support edits on this loan" /></div>}
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default SupportTransactionEditorPage;
