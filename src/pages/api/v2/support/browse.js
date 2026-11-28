// src/pages/api/v2/support/browse.js
// GET — drill-down for the Support Transaction Editor: Branch -> Loan Officer -> Group -> Loans.
//   ?q=<text>                       search branches (name/code) and loan officers (name/email)
//   ?level=branch&branchId=…        loan officers of a branch, with loan counts
//   ?level=lo&loId=…                groups of a loan officer, with loan counts
//   ?level=group&groupId=…&status=  loans of a group (status: active | completed | closed | all; default active)
// Read-only. Every level loads one step at a time; nothing here returns a whole branch's loans.
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { requireSupportUser } from '@/lib/support-edit-service';
import { getSupportBranchScope } from '@/lib/support-edit-config';
import { orderGroups } from '@/lib/support-group-order';

const graph = new GraphProvider();
const MAX_ROWS = 60;

const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
const LO_TYPE = (alias) => createGraphType('users', '_id firstName lastName email loNo designatedBranchId designatedBranch transactionType weeklyScheduleType')(alias);
const GROUP_TYPE = createGraphType('groups', '_id name groupNo day branchId loanOfficerId loanOfficerName noOfClients capacity occurence weeklyScheduleType time status dayNo')('groups');
const LOAN_TYPE = createGraphType('loans', '_id clientId fullName ciReferenceCode loanCycle status principalLoan amountRelease loanBalance mcbu csf dateGranted groupName slotNo branchName')('loans');
const COUNT_TYPE = (alias) => createGraphType('loans', '_id')(alias);

export default apiHandler({ get: browse });

const STATUSES = ['active', 'completed', 'closed'];


// Optional per-user branch restriction (see getSupportBranchScope). null = every branch.
const branchGuard = (scope, branchId) => !scope || scope.includes(branchId);

async function countsFor(items, keyField, whereFor) {
    if (!items.length) return {};
    const statements = [];
    items.forEach((it, i) => {
        statements.push(aggregateQl(COUNT_TYPE(`t${i}`), 'aggregate { count }', whereFor(it)));
        statements.push(aggregateQl(COUNT_TYPE(`a${i}`), 'aggregate { count }', { ...whereFor(it), status: { _eq: 'active' } }));
    });
    const data = await graph.query(...statements).then((r) => r.data ?? {});
    const out = {};
    items.forEach((it, i) => { out[it[keyField]] = { total: data[`t${i}`]?.aggregate?.count ?? 0, active: data[`a${i}`]?.aggregate?.count ?? 0 }; });
    return out;
}

async function browse(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const scope = getSupportBranchScope(user);
    const { q, level, branchId, loId, groupId } = req.query;

    // ---- search ---------------------------------------------------------------------------------
    if (q !== undefined) {
        const term = String(q).trim();
        if (term.length < 2) return res.status(200).json({ success: false, message: 'Type at least 2 characters.' });
        const like = `%${term.replace(/[%_]/g, '')}%`;
        const branchWhere = { _or: [{ name: { _ilike: like } }, { code: { _ilike: like } }] };
        if (scope) branchWhere._and = [{ _id: { _in: scope } }];
        const loWhere = { _and: [
            { loNo: { _is_null: false } },
            { _or: [{ email: { _ilike: like } }, { firstName: { _ilike: like } }, { lastName: { _ilike: like } }] },
            ...(scope ? [{ designatedBranchId: { _in: scope } }] : []),
        ] };
        const data = await graph.query(
            queryQl(BRANCH_TYPE, { where: branchWhere, order_by: [{ name: 'asc' }], limit: 15 }),
            queryQl(LO_TYPE('los'), { where: loWhere, order_by: [{ lastName: 'asc' }], limit: 15 }),
        ).then((r) => r.data ?? {});
        return res.status(200).json({ success: true, branches: data.branches ?? [], loanOfficers: data.los ?? [] });
    }

    // ---- branch -> loan officers ----------------------------------------------------------------
    if (level === 'branch') {
        if (!branchId || !branchGuard(scope, branchId)) return res.status(200).json({ success: false, message: 'Branch not available.' });
        const los = await graph.query(queryQl(LO_TYPE('los'), {
            where: { designatedBranchId: { _eq: branchId }, loNo: { _is_null: false } },
            order_by: [{ loNo: 'asc' }], limit: MAX_ROWS,
        })).then((r) => r.data?.los ?? []);
        const counts = await countsFor(los, '_id', (lo) => ({ loId: { _eq: lo._id } }));
        return res.status(200).json({ success: true, items: los.map((lo) => ({ ...lo, ...(counts[lo._id] ?? { total: 0, active: 0 }) })) });
    }

    // ---- loan officer -> groups -------------------------------------------------------------------
    if (level === 'lo') {
        if (!loId) return res.status(200).json({ success: false, message: 'loId is required.' });
        const data = await graph.query(
            queryQl(GROUP_TYPE, { where: { loanOfficerId: { _eq: loId }, ...(scope ? { branchId: { _in: scope } } : {}) }, order_by: [{ groupNo: 'asc' }], limit: MAX_ROWS * 2 }),
            queryQl(LO_TYPE('lo_one'), { where: { _id: { _eq: loId } }, limit: 1 }),
        ).then((r) => r.data ?? {});
        const groups = data.groups ?? [];
        const loType = data.lo_one?.[0]?.transactionType ?? null;
        const counts = await countsFor(groups, '_id', (g) => ({ groupId: { _eq: g._id } }));
        const items = orderGroups(groups.map((g) => ({ ...g, ...(counts[g._id] ?? { total: 0, active: 0 }) })), loType);
        return res.status(200).json({ success: true, loTransactionType: loType, items });
    }

    // ---- group -> loans ---------------------------------------------------------------------------
    if (level === 'group') {
        if (!groupId) return res.status(200).json({ success: false, message: 'groupId is required.' });
        const status = String(req.query.status ?? 'active');
        const where = { groupId: { _eq: groupId }, ...(scope ? { branchId: { _in: scope } } : {}) };
        if (status !== 'all') {
            if (!STATUSES.includes(status)) return res.status(200).json({ success: false, message: 'Unknown status filter.' });
            where.status = { _eq: status };
        }
        const loans = await graph.query(queryQl(LOAN_TYPE, { where, order_by: [{ slotNo: 'asc' }, { loanCycle: 'desc' }], limit: 300 }))
            .then((r) => r.data?.loans ?? []);
        return res.status(200).json({ success: true, items: loans });
    }

    return res.status(200).json({ success: false, message: 'Unknown request.' });
}
