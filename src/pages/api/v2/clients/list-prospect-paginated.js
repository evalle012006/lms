// src/pages/api/v2/clients/list-prospect-paginated.js
// GET — paginated, server-side-filtered prospect clients, replacing the
// unpaginated clients/list.js + client-side tab-splitting in ViewClientsByGroup.js.
//
// tab: 'new' | 'duplicate' | 'excluded' — mirrors the boolean-flag split that
// used to happen in the browser (!archived && !duplicate / duplicate / archived).

import { CLIENT_FIELDS, GROUP_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';
import { resolveClientBranchScope } from '@/lib/api/resolveClientBranchScope';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    lo { ${USER_FIELDS} }
    group { ${GROUP_FIELDS} }
`)('clients');

const CLIENT_COUNT_TYPE = createGraphType('client', '_id')('clientsCount');

const TAB_FILTERS = {
    new:       { archived: { _neq: true }, duplicate: { _neq: true } },
    duplicate: { duplicate: { _eq: true } },
    excluded:  { archived:  { _eq: true } },
};

export default apiHandler({ get: listProspectPaginated });

async function listProspectPaginated(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) {
        return res.status(200).json({ success: false, message: 'User not found.' });
    }

    const {
        branchId = null,
        loId     = null,
        groupId  = null,
        search   = '',
        tab      = 'new',
        page     = '1',
        limit    = '15',
    } = req.query;

    if (!TAB_FILTERS[tab]) {
        return res.status(200).json({ success: false, message: `Invalid tab "${tab}".` });
    }

    const { branchIds: allowedBranchIds, branches: allowedBranches } = await resolveClientBranchScope(currentUser);

    let effectiveBranchId = null;
    if (allowedBranchIds === null) {
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

    const where = { status: { _eq: 'pending' }, ...TAB_FILTERS[tab] };

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
        allowedBranches,
        tab,
    });
}