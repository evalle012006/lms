// src/pages/api/v2/transactions/loans/approval-context.js
// POST { loanIds: string[] } — approval gate flags + blockers for those loans.
// Read-only; used to disable checkboxes and show "why".
//
//   blockers       apply to every approval
//   finalBlockers  extra blockers for FINAL approval (tab "LDF approved"); only
//                  ever non-empty for supervisors (see finalApprovalBlockers)
//
// Who may call it, and for which branches, comes from the authenticated user
// (branch manager: own branch; supervisor: their area / region / division, or
// everything for admin) — never from the request. Loans outside that scope are
// simply absent from the result. Results may be up to ~5s old (display only);
// approval-rows.js, which the write path uses, always reads fresh.

import { apiHandler } from '@/services/api-handler';
import {
    collectBlockers,
    computeGates,
    finalApprovalBlockers,
    getManilaToday,
    loadApprovalRows,
    requireApprover,
} from '@/lib/api/loanApprovalGates';

const MAX_IDS = 500;

export default apiHandler({ post: getContext });

async function getContext(req, res) {
    try {
        const { mode, scope, error } = await requireApprover(req);
        if (error) return res.status(200).json({ success: false, message: error });

        const ids = Array.isArray(req.body?.loanIds)
            ? [...new Set(req.body.loanIds.filter((v) => typeof v === 'string' && v))].slice(0, MAX_IDS)
            : [];
        if (ids.length === 0) return res.status(200).json({ success: true, context: {} });

        const currentDate = await getManilaToday();
        const loaded = await loadApprovalRows(ids, { scope, currentDate });
        if (loaded.error) return res.status(200).json({ success: false, message: loaded.error });

        const context = {};
        loaded.rowById.forEach((row, id) => {
            const gates = computeGates(row);
            const branch = loaded.branchById.get(loaded.branchOfLoan.get(id));
            const strip = ({ code, label, message }) => ({ code, label, message });
            context[id] = {
                ...gates,
                blockers: collectBlockers(row, gates, { today: currentDate }).map(strip),
                finalBlockers: finalApprovalBlockers(row, branch, mode).map(strip),
            };
        });

        return res.status(200).json({ success: true, currentDate, context });
    } catch (e) {
        console.error('[loans/approval-context] failed', e);
        return res.status(200).json({ success: false, message: 'Failed to load approval status.' });
    }
}