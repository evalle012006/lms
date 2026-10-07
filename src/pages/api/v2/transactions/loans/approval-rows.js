// src/pages/api/v2/transactions/loans/approval-rows.js
// POST { loanIds: string[], origin?: 'ldf' | 'application', detailsOnly?: boolean } — FRESH rows for the
// selected pending loans, in the shape the classic page held in memory (what
// get_loan_data_for_pending_loans_page returns, `branch` wrapped in an array),
// plus server-computed gates and blockers.
//
// The new page needs these at action time because the existing write endpoints
// (approve-by-batch, reject) expect that row shape. Because the rows are read
// here, inside the caller's own scope, the browser no longer supplies the loan
// state the approval is based on — it supplies only ids.
//
// detailsOnly: true is the read-only path (the "approval details" modal and the
// LDF print); it is also open to loan officers, for their own pending loans
// only. Anything else (the rows an approval is built from) is approvers only.
//
// With origin 'application' (final approval) the supervisor-only final blockers
// are included in `blockers`. Never cached: this feeds a write. Ids that are not
// pending loans in the caller's scope come back in `missing`.

import { apiHandler } from '@/services/api-handler';
import {
    collectBlockers,
    computeGates,
    finalApprovalBlockers,
    getManilaToday,
    loadApprovalRows,
    requireApprover,
    requireDetailsAccess,
} from '@/lib/api/loanApprovalGates';

const MAX_IDS = 500;

export default apiHandler({ post: getRows });

async function getRows(req, res) {
    try {
        const detailsOnly = req.body?.detailsOnly === true;
        const { mode, scope, loId, error } = detailsOnly
            ? await requireDetailsAccess(req)
            : await requireApprover(req);
        if (error) return res.status(200).json({ success: false, message: error });

        const ids = Array.isArray(req.body?.loanIds)
            ? [...new Set(req.body.loanIds.filter((v) => typeof v === 'string' && v))]
            : [];
        if (ids.length === 0) {
            return res.status(200).json({ success: false, message: 'loanIds is required.' });
        }
        if (ids.length > MAX_IDS) {
            return res.status(200).json({ success: false, message: `Select at most ${MAX_IDS} loans at a time.` });
        }
        const origin = req.body?.origin === 'application' ? 'application' : 'ldf';

        const currentDate = await getManilaToday();
        const loaded = await loadApprovalRows(ids, { scope, currentDate, fresh: true, loId });
        if (loaded.error) return res.status(200).json({ success: false, message: loaded.error });

        const rows = [];
        const gates = {};
        const blockers = {};
        const missing = [];

        ids.forEach((id) => {
            const row = loaded.rowById.get(id);
            if (!row) { missing.push(id); return; }
            const g = computeGates(row);
            rows.push(row);
            gates[id] = g;
            blockers[id] = [
                ...collectBlockers(row, g, { today: currentDate }),
                ...(origin === 'application'
                    ? finalApprovalBlockers(row, loaded.branchById.get(loaded.branchOfLoan.get(id)), mode)
                    : []),
            ];
        });

        return res.status(200).json({ success: true, currentDate, rows, gates, blockers, missing });
    } catch (e) {
        console.error('[loans/approval-rows] failed', e);
        return res.status(200).json({ success: false, message: 'Failed to load the selected loans.' });
    }
}