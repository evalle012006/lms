// Drill-down for the Support Transaction Editor: Branch -> Loan Officer -> Group -> Loans.
// Search a branch or an LO (name / email); each level loads only its own children. Picking a loan hands it to onPickLoan.
import React, { useState, useCallback, useEffect } from 'react';
import Spinner from '@/components/Spinner';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { StatusChip, Btn, Chip } from './ui';

const api = (qs) => getApiBaseUrl() + 'support/browse?' + qs;
const peso = (n) => Number(n ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const STATUS_FILTERS = ['active', 'completed', 'closed', 'all'];
const STORE = 'supportBrowseState';
const scheduleChips = (o) => (
    <span className="flex flex-wrap gap-1 mt-1">
        {(o.occurence || o.transactionType) && <Chip tone="teal">{o.occurence || o.transactionType}</Chip>}
        {o.day && <Chip>{o.day}</Chip>}
        {o.weeklyScheduleType && <Chip tone="amber">{o.weeklyScheduleType}</Chip>}
        {o.time && <Chip>{o.time}</Chip>}
    </span>
);

const BrowsePanel = ({ onPickLoan }) => {
    const [q, setQ] = useState('');
    const [found, setFound] = useState(null);      // { branches, loanOfficers }
    const [trail, setTrail] = useState([]);        // [{ level, id, label }]
    const [items, setItems] = useState(null);
    const [status, setStatus] = useState('active');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const call = useCallback(async (qs) => {
        setLoading(true); setError(null);
        try {
            const res = await fetchWrapper.get(api(qs));
            if (!res?.success) { setError(res?.message || 'Request failed.'); return null; }
            return res;
        } catch (e) { setError(e?.message || 'Request failed.'); return null; }
        finally { setLoading(false); }
    }, []);

    const search = async (e) => {
        e.preventDefault();
        const res = await call('q=' + encodeURIComponent(q.trim()));
        if (res) { setFound(res); setTrail([]); setItems(null); }
    };

    // Open a level. `next` is the full trail up to and including the level being opened.
    const open = async (next, st = status) => {
        const last = next[next.length - 1];
        const qs = last.level === 'branch' ? `level=branch&branchId=${encodeURIComponent(last.id)}`
            : last.level === 'lo' ? `level=lo&loId=${encodeURIComponent(last.id)}`
            : `level=group&groupId=${encodeURIComponent(last.id)}&status=${st}`;
        const res = await call(qs);
        if (res) {
            setTrail(next); setItems(res.items); setFound(null);
            try { sessionStorage.setItem(STORE, JSON.stringify({ trail: next, status: st })); } catch (e) { /* storage blocked */ }
        } else { try { sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ } }
    };

    // Refresh / coming back from a loan: reopen where the user was.
    useEffect(() => {
        try {
            const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
            if (saved?.trail?.length) { setStatus(saved.status || 'active'); open(saved.trail, saved.status || 'active'); }
        } catch (e) { /* ignore */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const crumb = (i) => open(trail.slice(0, i + 1));
    const reset = () => { setTrail([]); setItems(null); setFound(null); setError(null); try { sessionStorage.removeItem(STORE); } catch (e) { /* ignore */ } };
    const lastLevel = trail[trail.length - 1]?.level;
    const loName = (u) => `${u.lastName ?? ''}, ${u.firstName ?? ''}`.replace(/^, |, $/g, '');

    const card = 'text-left border border-gray-200 rounded-lg p-3 hover:border-primary-1 hover:bg-primary-4/20 transition-colors';
    const count = (x) => <span className="block text-xs text-gray-600 mt-0.5">{x.active} active · {x.total} total loans</span>;

    return (
        <div>
            <form onSubmit={search} className="flex gap-2 mb-3">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Branch name / code, or loan officer name / email (min. 2 characters)"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40 focus:border-primary-1" />
                <Btn type="submit" disabled={q.trim().length < 2 || loading}>Find</Btn>
            </form>
            {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            {trail.length > 0 && (
                <nav className="flex flex-wrap items-center gap-1 text-sm mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <button onClick={reset} className="text-primary-2 hover:underline">Search</button>
                    {trail.map((t, i) => (
                        <span key={t.level + t.id} className="flex items-center gap-1 text-gray-400">›
                            {i === trail.length - 1 ? <span className="font-medium text-gray-900">{t.label}</span>
                                : <button onClick={() => crumb(i)} className="text-primary-2 hover:underline">{t.label}</button>}
                        </span>
                    ))}
                </nav>
            )}

            {loading && <Spinner />}

            {!loading && !found && !items && <p className="text-sm text-gray-500">Search for a branch or a loan officer, then open a group to see its loans.</p>}

            {found && !loading && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {found.branches.length === 0 && found.loanOfficers.length === 0 && <p className="text-sm text-gray-500">No branch or loan officer found.</p>}
                    {found.branches.map((b) => (
                        <button key={b._id} onClick={() => open([{ level: 'branch', id: b._id, label: b.name }])} className={card}>
                            <span className="text-[11px] uppercase tracking-wide text-primary-2 font-semibold">Branch</span>
                            <span className="block font-medium text-gray-900">{b.name}</span>
                            <span className="block text-xs text-gray-600">{b.code}</span>
                        </button>
                    ))}
                    {found.loanOfficers.map((u) => (
                        <button key={u._id} onClick={() => open([{ level: 'lo', id: u._id, label: loName(u) }])} className={card}>
                            <span className="text-[11px] uppercase tracking-wide text-primary-2 font-semibold">Loan officer</span>
                            <span className="block font-medium text-gray-900">{loName(u)}</span>
                            <span className="block text-xs text-gray-600">{u.email} · {u.designatedBranch}</span>
                            {scheduleChips(u)}
                        </button>
                    ))}
                </div>
            )}

            {items && !loading && lastLevel === 'branch' && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {items.length === 0 && <p className="text-sm text-gray-500">No loan officers in this branch.</p>}
                    {items.map((u) => (
                        <button key={u._id} onClick={() => open([...trail, { level: 'lo', id: u._id, label: loName(u) }])} className={card}>
                            <span className="block font-medium text-gray-900">LO {u.loNo} · {loName(u)}</span>
                            <span className="block text-xs text-gray-600">{u.email}</span>
                            {scheduleChips(u)}
                            {count(u)}
                        </button>
                    ))}
                </div>
            )}

            {items && !loading && lastLevel === 'lo' && (
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {items.length === 0 && <p className="text-sm text-gray-500">No groups for this loan officer.</p>}
                    {items.map((g) => (
                        <button key={g._id} onClick={() => open([...trail, { level: 'group', id: g._id, label: g.name || `Group ${g.groupNo}` }])} className={card}>
                            <span className="block font-medium text-gray-900">{g.name || `Group ${g.groupNo}`}</span>
                            {scheduleChips(g)}
                            <span className="block text-xs text-gray-600 mt-1">{g.noOfClients ?? 0} / {g.capacity ?? '-'} clients</span>
                            {count(g)}
                        </button>
                    ))}
                </div>
            )}

            {items && !loading && lastLevel === 'group' && (
                <div>
                    <div className="flex flex-wrap items-center gap-1 mb-3">
                        <span className="text-sm text-gray-700 mr-1">Show</span>
                        {STATUS_FILTERS.map((s) => (
                            <button key={s} onClick={() => { setStatus(s); open(trail, s); }}
                                className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${status === s ? 'bg-primary-1 text-white border-primary-1' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{s}</button>
                        ))}
                        <span className="ml-auto text-xs text-gray-500">{items.length} loan(s) — click a row to edit</span>
                    </div>
                    {items.length === 0 ? <p className="text-sm text-gray-500">No {status === 'all' ? '' : status} loans in this group.</p> : (
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                                    <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Client</th><th className="px-3 py-2">CI reference</th><th className="px-3 py-2">Cycle</th><th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Released</th><th className="px-3 py-2 text-right">Balance</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((l) => (
                                        <tr key={l._id} onClick={() => onPickLoan(l)} className="cursor-pointer hover:bg-primary-4/30">
                                            <td className="px-3 py-2 text-gray-500">{l.slotNo ?? '-'}</td>
                                            <td className="px-3 py-2 font-medium text-gray-900">{l.fullName}</td>
                                            <td className="px-3 py-2 font-mono text-xs text-gray-600">{l.ciReferenceCode || <span className="text-gray-400">no CI ref</span>}</td>
                                            <td className="px-3 py-2 text-gray-800">{l.loanCycle}</td>
                                            <td className="px-3 py-2"><StatusChip status={l.status} /></td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-800">{peso(l.amountRelease)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-medium text-gray-900">{peso(l.loanBalance)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default BrowsePanel;
