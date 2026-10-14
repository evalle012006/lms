// src/pages/api/v2/transactions/loans/ldf-unapprove.js
// POST { loanIds: string[] } — take LDF approval back from pending loans, so they
// return to "LDF pending".
//
// Why a new endpoint: the classic "LDF Unapproved" button posted to approve-by-batch
// with ldfApproved=false, but that endpoint's `ldf` branch sets ldfApproved=true for
// every loan it receives. So the button re-approved the loans (and sent the "loan
// released" SMS again). This endpoint does what the button always said.
//
// ID-only: the browser sends loan ids and nothing else. Who may call it and which
// branches count come from the signed-in user (branch manager: own branch;
// supervisors: their scope). Only PENDING loans in that scope that are currently LDF
// approved are changed, and the update repeats those conditions in the WHERE clause
// so a loan that was final-approved a moment ago cannot be touched.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { requireApprover } from '@/lib/api/loanApprovalGates';

const graph = new GraphProvider();
const LOOKUP_TYPE = createGraphType('loans', '_id ldfApproved');
const LOAN_TYPE = createGraphType('loans', '_id ldfApproved ldfApprovedDate status')('loans');

const MAX_IDS = 500;

export default apiHandler({ post: ldfUnapprove });

async function ldfUnapprove(req, res) {
    try {
        const { scope, error } = await requireApprover(req);
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

        const and = [{ _id: { _in: ids } }, { status: { _eq: 'pending' } }];
        if (scope.branchIds) and.push({ branchId: { _in: scope.branchIds } });

        const found = await graph
            .query(queryQl(LOOKUP_TYPE('found'), { where: { _and: and } }))
            .then((r) => r.data?.found ?? []);

        const byId = new Map(found.map((l) => [l._id, l]));
        const toUpdate = [];
        const notApproved = [];
        const missing = [];
        ids.forEach((id) => {
            const loan = byId.get(id);
            if (!loan) missing.push(id); // not pending, not found, or outside the caller's scope
            else if (!loan.ldfApproved) notApproved.push(id);
            else toUpdate.push(id);
        });

        if (toUpdate.length > 0) {
            await graph.mutation(
                updateQl(LOAN_TYPE, {
                    set: { ldfApproved: false, ldfApprovedDate: null, modifiedBy: req.auth.sub },
                    where: {
                        _id: { _in: toUpdate },
                        status: { _eq: 'pending' },
                        ldfApproved: { _eq: true },
                    },
                })
            );
        }

        return res.status(200).json({ success: true, updated: toUpdate.length, notApproved, missing });
    } catch (e) {
        console.error('[loans/ldf-unapprove] failed', e);
        return res.status(200).json({ success: false, message: 'Failed to remove LDF approval.' });
    }
}