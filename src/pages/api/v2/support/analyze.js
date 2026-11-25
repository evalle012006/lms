// src/pages/api/v2/support/analyze.js
// GET ?loanId=&rowId=  (rowId optional: defaults to the row on the system date, else the newest row)
// Read-only. Compares the transaction with its loan, group and client and lists what looks wrong.
import { apiHandler } from '@/services/api-handler';
import moment from 'moment-timezone';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findGroups } from '@/lib/graph.functions';
import { getSystemDate } from '@/lib/date-utils';
import { fetchFieldNames } from '@/lib/support-edit-config';
import { requireSupportUser, loadRecord, fail } from '@/lib/support-edit-service';
import { analyzeTransaction } from '@/lib/support-analyze';

const graph = new GraphProvider();
const ROWS_TYPE = createGraphType('cashCollections', [...new Set([...fetchFieldNames('cashCollections'), 'timeAdded'])].join(' '))('rows');

export default apiHandler({ get: analyze });

async function analyze(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const loanId = String(req.query.loanId ?? '');
    const rowId = req.query.rowId ? String(req.query.rowId) : null;
    if (!loanId) return fail(res, 'loanId is required.');

    const loan = await loadRecord('loans', loanId);
    if (!loan) return fail(res, 'Loan not found.');
    const today = moment(getSystemDate()).tz('Asia/Manila').format('YYYY-MM-DD');

    const [group, client, rows] = await Promise.all([
        findGroups({ _id: { _eq: loan.groupId } }).then((g) => g?.[0] ?? null),
        loadRecord('client', loan.clientId),
        graph.query(queryQl(ROWS_TYPE, { where: { loanId: { _eq: loanId } }, order_by: [{ dateAdded: 'desc' }, { timeAdded: 'desc' }] })).then((r) => r.data?.rows ?? []),
    ]);

    const row = rowId ? rows.find((r) => r._id === rowId) : (rows.find((r) => String(r.dateAdded).slice(0, 10) === today) ?? rows[0] ?? null);
    if (rowId && !row) return fail(res, 'That collection row does not belong to this loan.');
    const idx = row ? rows.indexOf(row) : -1;
    const prevRow = idx >= 0 ? (rows.slice(idx + 1).find((r) => r.draft !== true && ['active', 'completed', 'closed'].includes(r.status)) ?? null) : null;

    const result = analyzeTransaction({ row, prevRow, loan, group, client, rows, today });
    return res.status(200).json({
        success: true, today, row: row ? { _id: row._id, dateAdded: row.dateAdded, status: row.status, draft: row.draft } : null,
        noRowToday: !rows.some((r) => String(r.dateAdded).slice(0, 10) === today),
        group: group ? { _id: group._id, name: group.name, branchId: group.branchId, loanOfficerId: group.loanOfficerId } : null,
        ...result,
    });
}
