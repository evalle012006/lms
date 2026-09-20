// src/pages/api/v2/clients/list-active-paginated.js
import { CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS, USER_FIELDS, BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const ACTIVE_LOAN = `
loans (where: { status: { _eq: "active" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
    ${LOAN_FIELDS}
}
`;

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    lo { ${USER_FIELDS} }
    group { ${GROUP_FIELDS} }
    ${ACTIVE_LOAN}
`)('clients');

const CLIENT_COUNT_TYPE = createGraphType('client', '_id')('clientsCount');

const BRANCH_TYPE = createGraphType('branches', BRANCH_FIELDS)('branches');

export default apiHandler({
    get: listActivePaginated,
});

// Returns { branchIds, branches } consistently in ALL cases — including root —
// so the caller never has to special-case destructuring a null vs an array.
// branchIds = null means "unrestricted" (root). branches = [] means the object
// list for the branch selector UI; branchIds mirrors it as bare ids for _in queries.
async function resolveAllowedBranches(currentUser) {
    if (currentUser.root) {
        return { branchIds: null, branches: null };
    }

    const { role } = currentUser;

    if (role.rep === 3 || role.rep === 4) {
        if (!currentUser.designatedBranchId) {
            return { branchIds: [], branches: [] };
        }
        const [branch] = await graph.query(
            queryQl(BRANCH_TYPE, { where: { _id: { _eq: currentUser.designatedBranchId } } })
        ).then(r => r.data?.branches ?? []);
        return branch
            ? { branchIds: [branch._id], branches: [branch] }
            : { branchIds: [], branches: [] };
    }

    // Supervisor tier (rep=2): scoped by whichever hierarchy field is set.
    const _and = [];
    if (currentUser.divisionId) _and.push({ divisionId: { _eq: currentUser.divisionId } });
    if (currentUser.regionId)   _and.push({ regionId:   { _eq: currentUser.regionId } });
    if (currentUser.areaId)     _and.push({ areaId:     { _eq: currentUser.areaId } });

    if (!_and.length) return { branchIds: [], branches: [] };

    const branches = await graph.query(
        queryQl(BRANCH_TYPE, { where: { _and }, order_by: [{ code: 'asc' }] })
    ).then(r => r.data?.branches ?? []);

    return { branchIds: branches.map(b => b._id), branches };
}

async function listActivePaginated(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    const {
        branchId = null,
        loId     = null,
        groupId  = null,
        search   = '',
        page     = '1',
        limit    = '15',
    } = req.query;

    const { branchIds: allowedBranchIds, branches: allowedBranches } = await resolveAllowedBranches(currentUser);

    // Resolve the effective branch: validate the requested one is in-scope,
    // or fall back to the user's first allowed branch.
    let effectiveBranchId = null;
    if (allowedBranchIds === null) {
        // root — branchId param is optional; omitting it means "all branches"
        effectiveBranchId = branchId || null;
    } else {
        if (!allowedBranchIds.length) {
            return res.status(200).json({
                success: true,
                clients: [],
                pagination: { page: 1, limit: parseInt(limit, 10), total: 0, totalPages: 0, hasNext: false, hasPrev: false },
                resolvedBranchId: null,
                allowedBranches: [],
            });
        }
        effectiveBranchId = (branchId && allowedBranchIds.includes(branchId))
            ? branchId
            : allowedBranchIds[0];
    }

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const where = { status: { _eq: 'active' } };

    if (effectiveBranchId) {
        where.branchId = { _eq: effectiveBranchId };
    } else if (allowedBranchIds) {
        where.branchId = { _in: allowedBranchIds };
    }

    if (currentUser.role.rep === 4) {
        where.loId = { _eq: currentUser._id };
    } else if (loId) {
        where.loId = { _eq: loId };
    }

    if (groupId) {
        where.groupId = { _eq: groupId };
    }

    if (search?.trim()) {
        const s = search.trim().toUpperCase();
        where._or = [
            { firstName: { _ilike: `%${s}%` } },
            { lastName:  { _ilike: `%${s}%` } },
        ];
    }

    const { clients, clientsCount } = await graph.query(
        queryQl(CLIENT_TYPE, {
            where,
            order_by: [{ dateAdded: 'desc' }],
            limit: limitNum,
            offset,
        }),
        aggregateQl(CLIENT_COUNT_TYPE, `aggregate { count }`, where)
    ).then(r => r.data);

    const total = clientsCount?.aggregate?.count ?? 0;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
        success: true,
        clients: (clients ?? []).map(c => ({
            ...c,
            lo:    c.lo    ? [c.lo]    : [],
            group: c.group ? [c.group] : [],
        })),
        pagination: {
            page: pageNum, limit: limitNum, total, totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1,
        },
        resolvedBranchId: effectiveBranchId,
        allowedBranches, // full {_id, name, code, ...} objects, or null for root — feeds the toolbar's branch selector directly, no second round trip
    });
}