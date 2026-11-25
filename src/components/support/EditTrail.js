// src/components/support/EditTrail.js — the support edit trail (who changed what, before -> after, why).
import React, { useEffect, useState, useCallback } from 'react';
import moment from 'moment';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v));

export default function EditTrail({ query, refreshKey = 0, title = 'Edit trail' }) {
    const [edits, setEdits] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const limit = 10;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ ...query, page, limit });
            const res = await fetchWrapper.get(getApiBaseUrl() + 'support/history?' + params.toString());
            if (res.success) { setEdits(res.edits); setTotal(res.total); }
        } finally { setLoading(false); }
    }, [query, page]);

    useEffect(() => { setPage(1); }, [query]);
    useEffect(() => { load(); }, [load, refreshKey]);

    const pages = Math.max(1, Math.ceil(total / limit));
    return (
        <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{title} <span className="text-gray-400 font-normal">({total})</span></h3>
            {loading && !edits.length ? <p className="text-sm text-gray-400">Loading…</p>
                : !edits.length ? <p className="text-sm text-gray-400">No support edits recorded.</p>
                : (
                    <ul className="space-y-3">
                        {edits.map((e) => (
                            <li key={e._id} className="border border-gray-200 rounded-lg bg-white p-3 text-sm">
                                <div className="flex flex-wrap justify-between gap-2 text-xs text-gray-500">
                                    <span><b className="text-gray-800">{e.user_name || e.user_id}</b> edited {e.entity_type} <span className="font-mono">{e.entity_id.slice(0, 8)}</span></span>
                                    <span>{moment(e.edited_at).format('MMM D, YYYY h:mm A')}{e.ticket_ref ? ` · ${e.ticket_ref}` : ''}</span>
                                </div>
                                <table className="mt-2 w-full text-xs">
                                    <tbody>
                                        {(e.changes ?? []).map((c) => (
                                            <tr key={c.field} className="border-t border-gray-100">
                                                <td className="py-1 pr-3 font-medium text-gray-700 w-1/3">{c.field}</td>
                                                <td className="py-1 pr-3 text-red-600 line-through tabular-nums">{show(c.before)}</td>
                                                <td className="py-1 text-green-700 font-medium tabular-nums">{show(c.after)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <p className="mt-2 text-xs text-gray-600"><b>Reason:</b> {e.reason}</p>
                                {e.warnings?.length > 0 && (
                                    <p className="mt-1 text-xs text-amber-700">Acknowledged warnings: {e.warnings.map((w) => w.message).join(' · ')}</p>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            {pages > 1 && (
                <div className="flex gap-2 mt-3 text-sm">
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Previous</button>
                    <span className="py-1 text-gray-500">Page {page} of {pages}</span>
                    <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded-lg disabled:opacity-40">Next</button>
                </div>
            )}
        </div>
    );
}
