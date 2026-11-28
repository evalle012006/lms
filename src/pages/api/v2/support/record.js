// src/pages/api/v2/support/record.js
// GET ?entity=&id=   — one editable record + the config the page needs (fields, types, options).
// GET ?entity=cashCollections|badDebtCollections|mcbu_withdrawals&loanId=  — list a loan's rows (newest first).
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { ENTITIES, fetchFieldNames } from '@/lib/support-edit-config';
import { requireSupportUser, loadRecord, fail } from '@/lib/support-edit-service';

const graph = new GraphProvider();
const LIST_ORDER = { cashCollections: { dateAdded: 'desc' }, badDebtCollections: { dateAdded: 'desc' }, mcbu_withdrawals: { inserted_date: 'desc' } };
const LOAN_KEY = { cashCollections: 'loanId', badDebtCollections: 'loanId', mcbu_withdrawals: 'loan_id' };

export default apiHandler({ get: record });

async function record(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;

    const { entity, id, loanId, clientId } = req.query;
    const cfg = ENTITIES[entity];
    if (!cfg) return fail(res, 'Unknown record type.');
    const fields = Object.fromEntries(Object.entries(cfg.fields).map(([k, d]) => [k, d]));

    if (id) {
        const row = await loadRecord(entity, String(id));
        return row ? res.status(200).json({ success: true, entity, label: cfg.label, fields, record: row }) : fail(res, 'Record not found.');
    }

    if (entity === 'client' && clientId) {
        const row = await loadRecord('client', String(clientId));
        return row ? res.status(200).json({ success: true, entity, label: cfg.label, fields, record: row }) : fail(res, 'Client not found.');
    }

    if (loanId && LOAN_KEY[entity]) {
        const type = createGraphType(cfg.table, fetchFieldNames(entity).join(' '))('rows');
        // Optional date window (YYYY-MM-DD, inclusive) so old transactions can be found without scrolling.
        const dateCol = Object.keys(LIST_ORDER[entity])[0];
        const isDay = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
        const range = {};
        if (isDay(req.query.from)) range._gte = req.query.from;
        if (isDay(req.query.to)) range._lte = req.query.to;
        const where = { [LOAN_KEY[entity]]: { _eq: String(loanId) }, ...(Object.keys(range).length ? { [dateCol]: range } : {}) };
        const rows = await graph.query(queryQl(type, {
            where, order_by: [LIST_ORDER[entity]], limit: 200,
        })).then((r) => r.data?.rows ?? []);
        return res.status(200).json({ success: true, entity, label: cfg.label, fields, rows });
    }

    return fail(res, 'Provide an id, or a loanId for a list.');
}
