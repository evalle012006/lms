// src/pages/api/v2/support/history.js
// GET ?entity=&id=  or  ?loanId=  or  ?clientId=  [&page=&limit=]  — the edit trail, newest first.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { requireSupportUser, EDIT_TYPE, fail } from '@/lib/support-edit-service';
import { createGraphType } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const AGG_TYPE = createGraphType('support_edits', '_id')('edits_agg');

export default apiHandler({ get: history });

async function history(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const { entity, id, loanId, clientId } = req.query;
    const and = [];
    if (entity && id) and.push({ entity_type: { _eq: String(entity) } }, { entity_id: { _eq: String(id) } });
    if (loanId) and.push({ loan_id: { _eq: String(loanId) } });
    if (clientId) and.push({ client_id: { _eq: String(clientId) } });
    if (!and.length) return fail(res, 'Provide entity+id, loanId or clientId.');

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const where = { _and: and };
    const { support_edits, edits_agg } = await graph.query(
        queryQl(EDIT_TYPE, { where, order_by: [{ edited_at: 'desc' }], limit, offset: (page - 1) * limit }),
        aggregateQl(AGG_TYPE, 'aggregate { count }', where)
    ).then((r) => r.data ?? {});

    return res.status(200).json({ success: true, edits: support_edits ?? [], total: edits_agg?.aggregate?.count ?? 0 });
}
