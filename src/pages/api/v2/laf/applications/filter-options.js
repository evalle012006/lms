// src/pages/api/v2/laf/applications/filter-options.js
// GET ?branchId=&loId= — dropdown options for the CI page filters, already scoped
// to the caller (same scope as laf/applications/list):
//   branches : every branch in the caller's scope
//   los      : loan officers of the branch (branch manager and above only)
//   groups   : groups of the selected branch / LO; a loan officer only gets their own
// Groups are only returned once the result is narrow enough to be useful
// (a single branch, or an LO), so an admin never pulls every group in the system.

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById }  from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { canViewCI, canDecideCI, isLoanOfficer } from '@/lib/ci-scope';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
const USER_TYPE   = createGraphType('users', '_id firstName lastName loNo designatedBranchId')('users');
const GROUP_TYPE  = createGraphType('groups', '_id name groupNo day dayNo occurence branchId loanOfficerId')('groups');
const LO_THEME_TYPE = createGraphType('users', '_id transactionType weeklyScheduleType acceleratedCategory')('loTheme');

export default apiHandler({ get: getFilterOptions });

async function getFilterOptions(req, res) {
    const user = await findUserById(req.auth.sub);
    if (!user) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!canViewCI(user)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const first = v => (Array.isArray(v) ? v[0] : v) || null;
    const branchId = first(req.query.branchId);
    const loId     = first(req.query.loId);

    const { branchIds, branches: scoped } = await resolveLoanBranchScope(user);
    if (branchIds && branchIds.length === 0) {
        return res.status(200).json({ success: true, branches: [], los: [], groups: [] });
    }

    const branches = scoped ?? await graph
        .query(queryQl(BRANCH_TYPE, { order_by: [{ code: 'asc' }] }))
        .then(r => r.data?.branches ?? []);

    // Effective branch: the selected one (must be in scope) or the only one in scope
    let effective = null;
    if (branchId) effective = branches.some(b => b._id === branchId) ? branchId : null;
    else if (branches.length === 1) effective = branches[0]._id;

    let los = [];
    if (effective && canDecideCI(user)) {
        los = await graph.query(queryQl(USER_TYPE, {
            where: { role: { _contains: { rep: 4 } }, designatedBranchId: { _eq: effective } },
        })).then(r => r.data?.users ?? []);
    }

    let groups = [];
    const lo = isLoanOfficer(user) ? user._id : loId;
    if (effective || isLoanOfficer(user)) {
        const where = {};
        if (effective) where.branchId = { _eq: effective };
        if (lo) {
            where.loanOfficerId = { _eq: lo };
            // Only the groups that match the LO's own schedule: occurence = the LO's
            // transactionType; weekly also matches weeklyScheduleType (and the
            // accelerated category), same rule as groups/list-by-group-occurence.
            const [theme] = await graph
                .query(queryQl(LO_THEME_TYPE, { where: { _id: { _eq: lo } }, limit: 1 }))
                .then(r => r.data?.loTheme ?? []);
            if (theme?.transactionType) {
                where.occurence = { _eq: theme.transactionType };
                if (theme.transactionType === 'weekly') {
                    const sched = theme.weeklyScheduleType || 'standard';
                    where.weeklyScheduleType = { _eq: sched };
                    if (sched === 'accelerated' && theme.acceleratedCategory) {
                        where.acceleratedCategory = { _eq: theme.acceleratedCategory };
                    }
                }
            }
        }
        groups = await graph.query(queryQl(GROUP_TYPE, { where })).then(r => r.data?.groups ?? []);
    }

    // Order: branch by code; LO by loNo; group by groupNo (daily) or groupNo then
    // weekday (weekly). All numeric-aware so 2 comes before 10.
    const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER; };
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const dayRank = g => {
        const i = DAYS.indexOf(String(g.day || '').toLowerCase());
        return i >= 0 ? i : num(g.dayNo);
    };
    const cap = v => (v ? String(v).charAt(0).toUpperCase() + String(v).slice(1).toLowerCase() : '');
    const natural = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });

    const groupLabel = g => {
        const parts = [g.groupNo != null && g.groupNo !== '' ? `${g.groupNo}` : null, g.name].filter(Boolean);
        const base = parts.join(' - ');
        return g.occurence === 'weekly' && g.day ? `${base} (${cap(g.day)})` : base;
    };

    res.status(200).json({
        success: true,
        branches: [...branches].sort((a, b) => natural(a.code, b.code))
            .map(b => ({ value: b._id, label: `${b.code ? `${b.code} - ` : ''}${b.name}` })),
        los: [...los].sort((a, b) => num(a.loNo) - num(b.loNo) || natural(a.firstName, b.firstName))
            .map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}`.trim() })),
        groups: [...groups].sort((a, b) => num(a.groupNo) - num(b.groupNo) || dayRank(a) - dayRank(b) || natural(a.name, b.name))
            .map(g => ({ value: g._id, label: groupLabel(g) })),
    });
}
