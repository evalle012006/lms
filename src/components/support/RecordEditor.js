// src/components/support/RecordEditor.js
// Edits ONE record. Flow: change fields -> "Check changes" (server dry run) -> review diff/errors/warnings
// -> reason (+ acknowledge warnings) -> Save. The server re-validates everything on save.
import React, { useEffect, useMemo, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { MIN_REASON_LENGTH, sameValue, remarkValue, remarkOptions } from '@/lib/support-edit-config';
const disp = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'object' ? (v.label ?? JSON.stringify(v)) : String(v));
import EditTrail from './EditTrail';
import SearchSelect from './SearchSelect';
import { Btn } from './ui';

const api = (p) => getApiBaseUrl() + 'support/' + p;
const inputType = { money: 'number', int: 'number', date: 'date', text: 'text' };

const toInput = (def, v) => (v === null || v === undefined ? '' : def.type === 'date' ? String(v).slice(0, 10) : v);

export default function RecordEditor({ entity, record, fields, onSaved, initialDraft, initialReason }) {
    const [draft, setDraft] = useState(initialDraft ?? {});
    const [check, setCheck] = useState(null);       // { changes, errors, warnings }
    const [reason, setReason] = useState(initialReason ?? '');
    const [ticketRef, setTicketRef] = useState('');
    const [ack, setAck] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);           // { type: 'error'|'ok', text }
    const [trailKey, setTrailKey] = useState(0);

    useEffect(() => { setDraft(initialDraft ?? {}); setCheck(null); setReason(initialReason ?? ''); setTicketRef(''); setAck(false); setMsg(null); }, [record?._id, entity]);

    const changedFields = useMemo(() => {
        const out = {};
        for (const [f, v] of Object.entries(draft)) {
            const def = fields[f];
            const value = v === '' ? null : v;
            if (!sameValue(def, record[f], value)) out[f] = value;
        }
        return out;
    }, [draft, fields, record]);
    const dirty = Object.keys(changedFields).length > 0;

    const expected = useMemo(() => Object.fromEntries(Object.keys(changedFields).map((f) => [f, record[f] ?? null])), [changedFields, record]);
    const revertField = (f) => { setDraft((d) => { const n = { ...d }; delete n[f]; return n; }); setCheck(null); setAck(false); setMsg(null); };
    const setField = (f, v) => { setDraft((d) => ({ ...d, [f]: v })); setCheck(null); setAck(false); setMsg(null); };

    async function runCheck() {
        setBusy(true); setMsg(null);
        try {
            const res = await fetchWrapper.post(api('validate'), { entity, id: record._id, changes: changedFields, expected });
            if (!res.success) { setCheck(null); setMsg({ type: 'error', text: res.message }); return; }
            setCheck(res);
        } finally { setBusy(false); }
    }

    async function save() {
        setBusy(true); setMsg(null);
        try {
            const res = await fetchWrapper.post(api('update'), {
                entity, id: record._id, changes: changedFields, expected, reason, ticketRef: ticketRef || undefined, acknowledgeWarnings: ack,
            });
            if (!res.success) {
                if (res.errors || res.warnings) setCheck({ changes: check?.changes ?? [], errors: res.errors ?? [], warnings: res.warnings ?? [] });
                setMsg({ type: 'error', text: res.message });
                return;
            }
            setMsg({ type: 'ok', text: `Saved ${res.changes.length} change(s). Edit ${res.editId.slice(0, 8)} recorded in the trail.` });
            setDraft({}); setCheck(null); setReason(''); setTicketRef(''); setAck(false); setTrailKey((k) => k + 1);
            onSaved?.();
        } finally { setBusy(false); }
    }

    const hasErrors = check?.errors?.length > 0;
    const hasWarnings = check?.warnings?.length > 0;
    const canSave = check && !hasErrors && check.changes.length > 0 && reason.trim().length >= MIN_REASON_LENGTH && (!hasWarnings || ack) && !busy;
    const fieldMsgs = (f, list) => (list ?? []).filter((m) => m.field === f);

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-5 gap-y-4">
                {Object.entries(fields).filter(([, d]) => !d.hidden).map(([f, def]) => {
                    const val = f in draft ? draft[f] : toInput(def, record[f]);
                    const isChanged = f in changedFields;
                    const errs = fieldMsgs(f, check?.errors); const warns = fieldMsgs(f, check?.warnings);
                    return (
                        <label key={f} className="block text-sm">
                            <span className="flex items-center justify-between">
                                <span className="text-gray-700 font-medium">{def.label}</span>
                                <span className="flex gap-2 text-xs">
                                    {def.nullable === true && !['enum', 'bool'].includes(def.type) && val !== '' && val !== null && val !== undefined && (
                                        <button type="button" onClick={() => setField(f, '')} className="text-gray-500 hover:text-red-600 hover:underline">Clear</button>
                                    )}
                                    {isChanged && (
                                        <button type="button" onClick={() => revertField(f)} className="text-primary-2 hover:underline">↺ Revert</button>
                                    )}
                                </span>
                            </span>
                            {def.type === 'remarks' ? (() => {
                                const cur = remarkValue(f in draft ? draft[f] : record[f]);
                                const opts = remarkOptions(record.occurence);
                                return (
                                    <SearchSelect value={cur} changed={isChanged} onChange={(v) => setField(f, v)}
                                        options={[
                                            { value: '', label: '— no remark —' },
                                            ...(cur && !opts.some((o) => o.value === cur) ? [{ value: cur, label: `${disp(record[f])} (not on the ${record.occurence ?? 'daily'} list)` }] : []),
                                            ...opts,
                                        ]} />
                                );
                            })() : def.type === 'enum' ? (
                                <SearchSelect value={val ?? ''} changed={isChanged} onChange={(v) => setField(f, v)}
                                    options={[
                                        ...(!def.options.includes(String(val)) ? [{ value: val ?? '', label: String(val ?? '—') }] : []),
                                        ...def.options.map((o) => ({ value: o, label: o })),
                                    ]} />
                            ) : def.type === 'bool' ? (
                                <select value={String(val === true || val === 'true')} onChange={(e) => setField(f, e.target.value === 'true')}
                                    className={`mt-1 w-full border rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40 focus:border-primary-1 ${isChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`}>
                                    <option value="false">No</option><option value="true">Yes</option>
                                </select>
                            ) : (
                                <input type={inputType[def.type] ?? 'text'} step={def.type === 'money' ? '0.01' : def.type === 'int' ? '1' : undefined}
                                    value={val ?? ''} onChange={(e) => setField(f, e.target.value)}
                                    className={`mt-1 w-full border rounded-lg px-3 py-2 tabular-nums text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40 focus:border-primary-1 ${errs.length ? 'border-red-400 bg-red-50' : isChanged ? 'border-amber-400 bg-amber-50' : 'border-gray-300 bg-white'}`} />
                            )}
                            {isChanged && <span className="block text-xs text-gray-500">was: {disp(record[f])}</span>}
                            {errs.map((m, i) => <span key={i} className="block text-xs text-red-600">{m.message}</span>)}
                            {warns.map((m, i) => <span key={i} className="block text-xs text-amber-700">{m.message}</span>)}
                        </label>
                    );
                })}
            </div>

            <div className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-4">
                <Btn disabled={!dirty || busy} onClick={runCheck}>Check changes</Btn>
                {dirty && <Btn variant="secondary" onClick={() => { setDraft({}); setCheck(null); setMsg(null); }}>Discard</Btn>}
                <span className="text-xs text-gray-500">{dirty ? `${Object.keys(changedFields).length} field(s) changed` : 'Change a field to enable the check.'}</span>
            </div>

            {check && (
                <div className="mt-4 border border-primary-3 rounded-xl bg-primary-4/20 p-4 text-sm">
                    <h4 className="font-semibold text-primary-2 mb-2">Review before saving</h4>
                    <table className="w-full text-sm mb-3 bg-white rounded-lg overflow-hidden"><tbody>
                        {check.changes.map((c) => (
                            <tr key={c.field} className="border-t border-gray-100">
                                <td className="py-1.5 px-2 pr-3 font-medium text-gray-900">{fields[c.field]?.label ?? c.field}</td>
                                <td className="py-1.5 pr-3 text-red-600 line-through tabular-nums">{disp(c.before)}</td>
                                <td className="py-1.5 text-green-700 font-medium tabular-nums">{disp(c.after)}</td>
                            </tr>
                        ))}
                    </tbody></table>
                    {check.errors.length > 0 && <ul className="mb-2 rounded-lg border border-red-200 bg-red-50 p-3 pl-8 text-red-700 list-disc">{check.errors.map((m, i) => <li key={i}>{m.message}</li>)}</ul>}
                    {hasWarnings && (
                        <>
                            <ul className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 pl-8 text-amber-800 list-disc">{check.warnings.map((m, i) => <li key={i}>{m.message}</li>)}</ul>
                            <label className="flex items-center gap-2 mb-3"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} /> I reviewed these warnings and the values are correct.</label>
                        </>
                    )}
                    {!hasErrors && (
                        <>
                            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={`Reason for this change (min ${MIN_REASON_LENGTH} characters) — required`}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40" />
                            <input value={ticketRef} onChange={(e) => setTicketRef(e.target.value)} placeholder="Ticket / reference (optional)" maxLength={100}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-1/40" />
                            <div className="flex flex-wrap items-center gap-3">
                                <Btn disabled={!canSave} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</Btn>
                                {!canSave && !busy && (
                                    <span className="text-xs text-amber-700">
                                        {reason.trim().length < MIN_REASON_LENGTH ? `Add a reason of at least ${MIN_REASON_LENGTH} characters to save (${reason.trim().length}/${MIN_REASON_LENGTH}).`
                                            : hasWarnings && !ack ? 'Tick the box above to confirm you reviewed the warnings.' : ''}
                                    </span>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>{msg.text}</p>}

            <EditTrail query={{ entity, id: record._id }} refreshKey={trailKey} title="Edit trail for this record" />
        </div>
    );
}
