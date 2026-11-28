// src/pages/api/v2/support/search.js
// GET ?q=<name or id>  — find clients (all branches; support is a global role) with their loans.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { requireSupportUser } from '@/lib/support-edit-service';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', '_id fullName firstName lastName status branchId branchName groupName loId')('clients');
const LOAN_TYPE = createGraphType('loans', '_id clientId loanCycle status principalLoan amountRelease loanBalance mcbu csf dateGranted groupName groupId slotNo')('loans');

export default apiHandler({ get: search });

async function search(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const q = String(req.query.q ?? '').trim();
    if (q.length < 3) return res.status(200).json({ success: false, message: 'Type at least 3 characters.' });

    const like = `%${q.replace(/[%_]/g, '')}%`;
    const clients = await graph.query(queryQl(CLIENT_TYPE, {
        where: { _or: [{ _id: { _eq: q } }, { fullName: { _ilike: like } }, { firstName: { _ilike: like } }, { lastName: { _ilike: like } }] },
        order_by: [{ fullName: 'asc' }], limit: 20,
    })).then((r) => r.data?.clients ?? []);

    let loans = [];
    if (clients.length) {
        loans = await graph.query(queryQl(LOAN_TYPE, {
            where: { clientId: { _in: clients.map((c) => c._id) } }, order_by: [{ dateGranted: 'desc' }],
        })).then((r) => r.data?.loans ?? []);
    }
    const byClient = {};
    for (const l of loans) (byClient[l.clientId] ||= []).push(l);

    return res.status(200).json({
        success: true,
        clients: clients.map((c) => ({ ...c, loans: (byClient[c._id] ?? []).sort((a, b) => Number(b.loanCycle) - Number(a.loanCycle)) })),
    });
}
