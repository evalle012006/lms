import { CLIENT_FIELDS, LOAN_FIELDS, USER_FIELDS, GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const COMPLETED_LOANS = `
loans (where: { status: { _eq: "completed" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
    ${LOAN_FIELDS}
}
`;

const CLIENT_TYPE = createGraphType('client', `
    ${CLIENT_FIELDS}
    lo {
        ${USER_FIELDS}
    }
    group {
        ${GROUP_FIELDS}
    }
    ${COMPLETED_LOANS}
`)('clients');

const CLIENT_COUNT_TYPE = createGraphType('client', '_id')('clients');

export default apiHandler({
    get: listOffsetPaginated,
});

async function listOffsetPaginated(req, res) {
    const {
        branchId = null,
        loId     = null,
        groupId  = null,
        search   = '',
        page     = '1',
        limit    = '15',
    } = req.query;

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10)));
    const offset   = (pageNum - 1) * limitNum;

    const where = {
        status:     { _eq: 'offset' },
        branchId:   branchId ? { _eq: branchId } : { _is_null: false },
        oldLoId:    loId     ? { _eq: loId }     : { _is_null: false },
        oldGroupId: groupId  ? { _eq: groupId }  : { _is_null: false },
    };

    if (search?.trim()) {
        const s = search.trim().toUpperCase();
        where._or = [
            { firstName: { _ilike: `%${s}%` } },
            { lastName:  { _ilike: `%${s}%` } },
        ];
    }

    const [clients, countResult] = await Promise.all([
        graph.query(
            queryQl(CLIENT_TYPE, {
                where,
                order_by: [{ lastName: 'asc' }, { firstName: 'asc' }],
                limit:  limitNum,
                offset,
            })
        ).then(r => r.data.clients ?? []),

        graph.query(
            queryQl(CLIENT_COUNT_TYPE, { where })
        ).then(r => r.data.clients ?? []),
    ]);

    const total      = countResult.length;
    const totalPages = Math.ceil(total / limitNum);

    return res.status(200).json({
        success: true,
        clients: clients.map(c => ({
            ...c,
            lo:    c.lo    ? [c.lo]    : [],
            group: c.group ? [c.group] : [],
        })),
        pagination: {
            page:       pageNum,
            limit:      limitNum,
            total,
            totalPages,
            hasNext:    pageNum < totalPages,
            hasPrev:    pageNum > 1,
        },
    });
}