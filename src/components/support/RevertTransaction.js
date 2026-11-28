// Revert a collection like the LOR revert does (restores the loan from its history snapshot and removes the row).
// Support is not subject to the branch-manager one-time limit and does not change bmRevertCount.
import React, { useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { Btn } from '@/components/support/ui';

export default function RevertTransaction({ record, onReverted }) {
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [ticketRef, setTicketRef] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const [needsConfirm, setNeedsConfirm] = useState(null);
    const day = String(record?.dateAdded ?? '').slice(0, 10);

    async function submit(confirmed = false) {
        setBusy(true); setMsg(null);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'support/revert-transaction', { cashCollectionId: record._id, reason: reason.trim(), ticketRef: ticketRef.trim() || undefined, confirmed });
            if (res.requiresConfirmation) { setNeedsConfirm(res.message); return; }
            if (!res.success) { setMsg(res.message || 'Revert failed.'); setNeedsConfirm(null); return; }
            setOpen(false); setNeedsConfirm(null); onReverted?.();
        } catch (e) { setMsg(e?.message || 'Revert failed.'); } finally { setBusy(false); }
    }

    if (!open) return <button onClick={() => setOpen(true)} className="mt-6 text-sm text-red-700 hover:underline">Revert this transaction…</button>;
    return (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-gray-800">
            <p className="font-semibold text-red-700">Revert the {day} transaction</p>
            <p className="text-xs text-gray-700 mb-3">Same as the LOR revert: the loan goes back to how it was before this row was saved, and the row is deleted. It only works on the loan's latest saved row. The group status is ignored, so it also works on a closed group. It does not use up the branch manager's one-time revert.</p>
            <div className="grid gap-3 md:grid-cols-3">
                <label className="block md:col-span-2">Reason (min 10 characters)<input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" /></label>
                <label className="block">Ticket ref (optional)<input value={ticketRef} maxLength={100} onChange={(e) => setTicketRef(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" /></label>
            </div>
            {needsConfirm && <p className="mt-2 text-amber-800">{needsConfirm}</p>}
            {msg && <p className="mt-2 text-red-700">{msg}</p>}
            <div className="mt-3 flex gap-2">
                <Btn onClick={() => submit(!!needsConfirm)} disabled={busy || reason.trim().length < 10}>{busy ? 'Reverting…' : needsConfirm ? 'Confirm revert' : 'Revert transaction'}</Btn>
                <Btn variant="secondary" onClick={() => { setOpen(false); setNeedsConfirm(null); }}>Cancel</Btn>
            </div>
        </div>
    );
}
