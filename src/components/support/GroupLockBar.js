// Lock the loan's GROUP while support repairs it, so BMs / LOs cannot save over the same records (see migration 016).
// The lock lasts a few minutes and is renewed while this page is open; it also expires on its own.
import React, { useEffect, useState, useCallback } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { Btn } from '@/components/support/ui';

const api = (p) => getApiBaseUrl() + 'support/' + p;

export default function GroupLockBar({ groupId, onChange }) {
    const [state, setState] = useState({ lock: null, mine: false });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);

    const apply = useCallback((res) => { const s = { lock: res.lock ?? null, mine: !!res.mine }; setState(s); onChange?.(s.mine); }, [onChange]);
    const refresh = useCallback(async () => {
        if (!groupId) return;
        try { const res = await fetchWrapper.get(api('lock') + '?groupId=' + encodeURIComponent(groupId)); if (res.success) apply(res); } catch (e) { /* status only */ }
    }, [groupId, apply]);

    useEffect(() => { setMsg(null); setState({ lock: null, mine: false }); onChange?.(false); refresh(); }, [groupId]);
    // renew while held, re-check while someone else holds it
    useEffect(() => {
        if (!groupId) return undefined;
        const t = setInterval(async () => {
            if (state.mine) { try { apply(await fetchWrapper.post(api('lock'), { groupId, action: 'acquire' })); } catch (e) { /* retry next tick */ } }
            else refresh();
        }, state.mine ? 5 * 60 * 1000 : 60 * 1000);
        return () => clearInterval(t);
    }, [groupId, state.mine, apply, refresh]);

    async function act(action) {
        setBusy(true); setMsg(null);
        try {
            const res = await fetchWrapper.post(api('lock'), { groupId, action, reason: 'Support repair' });
            if (!res.success) { setMsg(res.message); await refresh(); } else apply(res);
        } catch (e) { setMsg(e?.message || 'Could not change the lock.'); } finally { setBusy(false); }
    }

    if (!groupId) return null;
    const { lock, mine } = state;
    return (
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-2.5 text-sm ${mine ? 'border-primary-3 bg-primary-4/40 text-primary-2' : lock ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-700'}`}>
            <span className="font-medium">
                {mine ? 'This group is locked for your repair. BMs and LOs cannot save to it.' : lock ? `Locked by ${lock.user_name || 'another support user'} until ${new Date(lock.expires_at).toLocaleTimeString()}.` : 'Group not locked. Lock it before repairing so BMs / LOs cannot save at the same time.'}
            </span>
            {!lock && <Btn onClick={() => act('acquire')} disabled={busy}>Lock group for repair</Btn>}
            {mine && <Btn variant="secondary" onClick={() => act('release')} disabled={busy}>Release lock</Btn>}
            {msg && <span className="text-red-600">{msg}</span>}
        </div>
    );
}
