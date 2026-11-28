// src/pages/api/v2/support/reconcile.js
// GET ?loanId=  — compares a loan with what its saved cashCollections rows say it should be. Read-only: the page
// turns the rows support picks into a normal (validated + trailed) loan edit, or support skips them.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { requireSupportUser, loadRecord, fail } from '@/lib/support-edit-service';
import { computeLoanReconciliation } from '@/lib/support-loan-reconcile';

const graph = new GraphProvider();
const CC_TYPE = createGraphType('cashCollections',
    '_id dateAdded timeAdded status draft loanBalance mcbu csf noOfPayments advanceDays pastDue mcbuCol csfCollection')('rows');

export default apiHandler({ get: reconcile });

async function reconcile(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const loanId = String(req.query.loanId ?? '');
    if (!loanId) return fail(res, 'loanId is required.');

    const loan = await loadRecord('loans', loanId);
    if (!loan) return fail(res, 'Loan not found.');
    const rows = await graph.query(queryQl(CC_TYPE, {
        where: { loanId: { _eq: loanId } },
        order_by: [{ dateAdded: 'desc' }, { timeAdded: 'desc' }],
    })).then((r) => r.data?.rows ?? []);

    return res.status(200).json({ success: true, loanId, ...computeLoanReconciliation(loan, rows) });
}
