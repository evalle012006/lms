// "Analyze" a transaction (read-only) and hand selected fixes to the normal editor ("Repair").
// Nothing is saved here: Repair pre-fills the editor, where validation, reason, review and the audit trail still apply.
import React, { useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { Btn, Chip } from '@/components/support/ui';

const api = (p) => getApiBaseUrl() + 'support/' + p;
const ENTITY_LABEL = { cashCollections: 'Cash collection', loans: 'Loan', client: 'Client' };
const SEV = { error: 'text-red-700 bg-red-50 border-red-200', warning: 'text-amber-800 bg-amber-50 border-amber-200', info: 'text-gray-700 bg-gray-50 border-gray-200' };
const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const keyOf = (i) => `${i.entity}:${i.id}:${i.field}`;

export default function AnalyzePanel({ loanId, rowId, locked, onRepair }) {
    const [data, setData] = useState(null);
    const [picked, setPicked] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);

    async function run() {
        setBusy(true); setErr(null);
        try {
            const res = await fetchWrapper.get(api('analyze') + '?loanId=' + encodeURIComponent(loanId) + (rowId ? '&rowId=' + encodeURIComponent(rowId) : ''));
            if (!res.success) { setErr(res.message); setData(null); return; }
            setData(res);
            setPicked(Object.fromEntries(res.issues.filter((i) => i.repairable && !i.review).map((i) => [keyOf(i), true])));
        } catch (e) { setErr(e?.message || 'Analyze failed.'); } finally { setBusy(false); }
    }

    const byEntity = (entity) => (data?.issues ?? []).filter((i) => i.entity === entity && i.repairable && picked[keyOf(i)] && i.expected !== null && i.expected !== undefined);
    function repair(entity) {
        const fixes = byEntity(entity);
        if (!fixes.length) return;
        const target = fixes[0];
        onRepair({
            entity, id: target.id,
            draft: Object.fromEntries(fixes.map((f) => [f.field, f.expected])),
            reason: `Repair from Analyze (${data.row ? String(data.row.dateAdded).slice(0, 10) : 'loan'}): ${fixes.map((f) => f.field).join(', ')}.`,
        });
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-3">
                <p className="font-semibold text-gray-900">Analyze this transaction</p>
                <span className="text-xs text-gray-500">{rowId ? 'The selected collection row' : 'The collection on the system date (or the newest row)'} compared with its loan, group and client. Read-only.</span>
                <Btn className="ml-auto" onClick={run} disabled={busy || !loanId}>{busy ? 'Analyzing…' : data ? 'Analyze again' : 'Analyze'}</Btn>
            </div>
            {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
            {data && (
                <div className="mt-4">
                    <p className="text-sm text-gray-700 mb-2">
                        {data.row ? <>Checked the row of <b>{String(data.row.dateAdded).slice(0, 10)}</b>{data.row.draft ? ' (draft)' : ''}.</> : 'This loan has no collection rows.'}
                        {data.noRowToday && <> There is no collection for the system date ({data.today}) — use “Restore a missing collection” on the Cash collections tab if one was deleted.</>}
                        {' '}<b>{data.counts.error}</b> error(s), <b>{data.counts.warning}</b> warning(s), <b>{data.counts.info}</b> note(s).
                    </p>
                    {data.issues.length === 0 ? <p className="text-sm text-green-700">No problems found.</p> : (
                        <ul className="space-y-2">
                            {data.issues.map((i) => (
                                <li key={keyOf(i)} className={`rounded-lg border px-3 py-2 text-sm ${SEV[i.severity]}`}>
                                    <div className="flex items-start gap-3">
                                        {i.repairable && i.expected !== null && i.expected !== undefined
                                            ? <input type="checkbox" className="mt-1" checked={!!picked[keyOf(i)]} onChange={(e) => setPicked({ ...picked, [keyOf(i)]: e.target.checked })} />
                                            : <span className="w-4" />}
                                        <div className="flex-1">
                                            <div className="flex flex-wrap items-center gap-2"><Chip>{ENTITY_LABEL[i.entity] ?? i.entity}</Chip><b>{i.field}</b>{i.review && <span className="text-xs">(review first)</span>}</div>
                                            <p>{i.message}</p>
                                            {(i.repairable || i.current !== null) && <p className="text-xs mt-0.5 opacity-80">Now: <b>{show(i.current)}</b>{i.expected !== null && i.expected !== undefined && <> → Expected: <b>{show(i.expected)}</b></>}</p>}
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                    {Object.keys(ENTITY_LABEL).some((e) => byEntity(e).length > 0) && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            {Object.keys(ENTITY_LABEL).filter((e) => byEntity(e).length > 0).map((e) => (
                                <Btn key={e} onClick={() => repair(e)} disabled={!locked}>Repair {byEntity(e).length} on {ENTITY_LABEL[e].toLowerCase()}…</Btn>
                            ))}
                            {!locked && <span className="text-xs text-amber-800">Lock the group first to repair.</span>}
                            <span className="text-xs text-gray-500 w-full">Repair opens the editor with these values filled in. You review, give a reason and confirm there; then use the loan sync “next step”.</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
