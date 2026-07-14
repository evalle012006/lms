// PATCH: src/pages/api/v2/dashboard/status.js
// Adds staleBranches count + list to the existing response, using the same
// query pattern already used for closedBranches. This is the correct home
// for the "closed — needs re-check" signal — NOT BranchNotCloseTool.js,
// which only lists branches that are not yet closed (mutually exclusive
// with stale, which only applies to already-closed branches).

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const USER_TYPE        = createGraphType('users', `_id areaId divisionId designatedBranchId regionId root`)('users');
const BRANCH_TYPE      = createGraphType('branches', `_id code`)('branches');
const BRANCH_APPR_TYPE = createGraphType(
    'branchApprovals',
    `_id branchId documentsStale staleReason staleAt`,
)('branchApprovals');
const ACTIVE_USER_TYPE = createGraphType('users', `_id`)('users');

export default apiHandler({
    get: getDashboardStatus,
});

const findUserByID = async (id) => {
    const [user] = await graph
        .query(queryQl(USER_TYPE, { where: { _id: { _eq: id } } }))
        .then((res) =>
            res.data.users.map((u) => ({
                ...u,
                areaId:             u.root ? null : u.areaId,
                divisionId:         u.root ? null : u.divisionId,
                designatedBranchId: u.root ? null : u.designatedBranchId,
                regionId:           u.root ? null : u.regionId,
            }))
        );
    return user;
};

async function getDashboardStatus(req, res) {
    const { date } = req.query;
    const user_id = req.auth.sub;
    const user = await findUserByID(user_id);

    // ── Branch scope (exclude B000) ──────────────────────────────
    const branchAnd = [{ code: { _neq: 'B000' } }];
    if (user.areaId)             branchAnd.push({ areaId:     { _eq: user.areaId } });
    if (user.regionId)           branchAnd.push({ regionId:   { _eq: user.regionId } });
    if (user.divisionId)         branchAnd.push({ divisionId: { _eq: user.divisionId } });
    if (user.designatedBranchId) branchAnd.push({ _id:        { _eq: user.designatedBranchId } });

    const branches = await graph
        .query(queryQl(BRANCH_TYPE, { where: { _and: branchAnd } }))
        .then((res) => res.data.branches ?? []);

    const branchIds     = branches.map((b) => b._id);
    const totalBranches = branchIds.length;

    // ── Closed branches count for the given date ─────────────────
    let closedBranches = 0;
    // ADDED
    let staleBranches = [];
    if (branchIds.length > 0 && date) {
        const closedList = await graph
            .query(
                queryQl(BRANCH_APPR_TYPE, {
                    where: {
                        branchId: { _in: branchIds },
                        dateFor:  { _eq: date },
                        status:   { _eq: 'closed' },
                    },
                })
            )
            .then((res) => res.data.branchApprovals ?? []);
        closedBranches = closedList.length;

        // ADDED: filter the same result set for stale ones — no second
        // query needed, documentsStale/staleReason/staleAt were already
        // fetched above alongside status/branchId.
        staleBranches = closedList.filter((b) => b.documentsStale);
    }

    // ── Active users in scope ────────────────────────────────────
    const userAnd = [{ status: { _neq: 'inactive' } }];
    if (user.areaId)     userAnd.push({ areaId:     { _eq: user.areaId } });
    if (user.regionId)   userAnd.push({ regionId:   { _eq: user.regionId } });
    if (user.divisionId) userAnd.push({ divisionId: { _eq: user.divisionId } });

    const activeUsers = await graph
        .query(queryQl(ACTIVE_USER_TYPE, { where: { _and: userAnd } }))
        .then((res) => (res.data.users ?? []).length);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(
            JSON.stringify({
                success: true,
                data: {
                    closedBranches,
                    totalBranches,
                    activeUsers,
                    // ADDED
                    staleBranchesCount: staleBranches.length,
                    staleBranches: staleBranches.map(b => ({
                        branchId: b.branchId,
                        staleReason: b.staleReason,
                        staleAt: b.staleAt,
                    })),
                    cashOnHand:         0,
                    bankBalance:        0,
                    managementExpenses: 0,
                },
            })
        );
}