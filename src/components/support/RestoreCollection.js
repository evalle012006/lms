// Restore a missing cashCollections row as a draft (support only). The row is created with 0 amounts and never touches the loan;
// support then opens it and fills it in through the normal editor (validation + audit trail).
import React, { useState } from 'react';
import moment from 'moment';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { Btn } from '@/components/support/ui';

export default function RestoreCollection({ loanId, onRestored }) {
    const [open, setOpen] = useState(false);
    const [date, setDate] = useState('');
    const [reason, setReason] = useState('');
    const [ticketRef, setTicketRef] = useState('');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    const ok = date && reason.trim().length >= 10 && !busy;

    async function submit() {
        setBusy(true); setMsg(null);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'support/restore-collection', { loanId, date, reason: reason.trim(), ticketRef: ticketRef.trim() || undefined });
            if (!res.success) { setMsg({ error: true, text: res.message }); if (res.existingId) onRestored?.(res.existingId); return; }
            setOpen(false); setDate(''); setReason(''); setTicketRef('');
            onRestored?.(res.id);
        } catch (e) { setMsg({ error: true, text: e?.message || 'Could not restore.' }); }
        finally { setBusy(false); }
    }

    if (!open) return <button onClick={() => setOpen(true)} className="mb-3 text-sm text-primary-2 hover:underline">+ Restore a missing collection (as draft)</button>;
    return (
        <div className="mb-4 rounded-lg border border-primary-3 bg-primary-4/30 p-4 text-sm text-gray-800">
            <p className="font-semibold text-primary-2">Restore a missing collection</p>
            <p className="text-xs text-gray-600 mb-3">Creates a row with 0 amounts for the date below. It does not change the loan. For the system date it is the same row pre-save would create, so the LOR page can use it; for an earlier date it is a draft. Open it afterwards and enter the real amounts.</p>
            <div className="grid gap-3 md:grid-cols-3">
                <label className="block">Date<input type="date" max={moment().format('YYYY-MM-DD')} value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" /></label>
                <label className="block md:col-span-2">Reason (min 10 characters)<input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" /></label>
                <label className="block">Ticket ref (optional)<input value={ticketRef} maxLength={100} onChange={(e) => setTicketRef(e.target.value)} className="mt-1 w-full border border-gray-300 rounded-lg px-2 py-1.5 text-gray-900" /></label>
            </div>
            {msg && <p className={`mt-2 ${msg.error ? 'text-red-600' : 'text-green-700'}`}>{msg.text}</p>}
            <div className="mt-3 flex gap-2">
                <Btn onClick={submit} disabled={!ok}>{busy ? 'Restoring…' : 'Restore as draft'}</Btn>
                <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
            </div>
        </div>
    );
}
