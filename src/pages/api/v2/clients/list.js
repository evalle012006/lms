// src/pages/api/v2/clients/list.js
import { CLIENT_FIELDS, GROUP_FIELDS, LOAN_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const COMPLETED_LOANS = `
loans (where: { status: { _eq: "completed" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
    ${LOAN_FIELDS}
}
`;

const DEFAULT_LOANS = `
loans (where: { status: { _in: ["completed", "active", "pending"] } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
    ${LOAN_FIELDS}
}
`

const RELOAN_CLIENT_LOANS = `
loans (where: { status: { _eq: "active" } }, order_by: [{ insertedDateTime: desc, loanCycle: desc }], limit: 1) {
    ${LOAN_FIELDS}
}
`;

const CLIENT_TYPE = (... additionalFields) => {
    return createGraphType('client', `
        ${CLIENT_FIELDS}
        lo {
            ${USER_FIELDS}
        }
        group {
            ${GROUP_FIELDS}
        }
        ${additionalFields.join('\n')}
    `)('clients');
}

// Add aggregate type for total count
const CLIENT_AGGREGATE_TYPE = createGraphType('client_aggregate', `
    aggregate {
        count
    }
`)('clients_aggregate');

export default apiHandler({
    get: list
});

async function list(req, res) {
    const {
        mode = null, 
        groupId = null, 
        branchId = null, 
        loId = null, 
        status = null, 
        branchCodes = null, 
        currentDate = null,
        // Pagination parameters
        page = 1,
        size = 50, // Default page size reduced from potential large number
        sortBy = 'insertedDateTime',
        sortOrder = 'desc'
    } = req.query;

    let statusCode = 200;
    let response = {};
    let clients;
    let totalCount = 0;

    // Calculate pagination offset
    const pageNum = parseInt(page);
    const pageSize = parseInt(size);
    const offset = (pageNum - 1) * pageSize;
    const limit = pageSize;

    // Common order_by configuration
    const getOrderBy = () => {
        const orderField = sortBy || 'insertedDateTime';
        const orderDirection = sortOrder || 'desc';
        return [{ [orderField]: orderDirection }];
    };

    if (mode === 'view_offset' && status === 'offset') {
        const where = {
            status: { _eq: status },
            branchId: { _eq: branchId ?? '' },
            oldLoId: { _eq: loId ?? '' },
            oldGroupId: { _eq: groupId ?? '' },
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(COMPLETED_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients.map(o => ({
            ... o,
            lo: o.lo ?? [],
        })));

    } else if (mode === 'view_active_by_group' && groupId) {
        const where = {
            status: { _eq: 'active' },
            loans: {
                status: { _eq: status },
                branchId: { _eq: branchId },
            }
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_by_group' && groupId) {
        const where = {
            loans: {
                status: { _in: ['completed', 'active', 'pending'] }
            },
            groupId: { _eq: groupId }
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_by_lo' && loId) {
        const where = {
            loId: { _eq: loId },
            status: { _eq: status }
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_all_by_branch' && branchId) {
        const where = {
            branchId: { _eq: branchId },
            status: { _eq: status }
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_all_by_branch_codes' && branchCodes) {
        // THIS IS THE KEY FIX FOR YOUR ISSUE
        const codes = branchCodes?.trim()?.split(",");
        const where = {
            branch: {
                code: { _in: codes }
            },
            status: status ? { _eq: status } : { _neq: 'null' }
        };

        // Get total count first
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        // Then get paginated results
        clients = await graph.query(
            queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);

    } else if (mode === 'view_only_no_exist_loan') {
        if (status === 'active') {
            const where = {
                groupId: { _eq: groupId },
                loans: {
                    status: {
                        _eq: 'completed'
                    }
                },
                loans_aggregate: {
                    count: {
                        predicate: { _eq: 0 },
                        filter: {
                            status: {
                                _in: ["pending"]
                            }
                        }
                    }
                },
                status: {
                    _eq: status
                }
            };

            // Get total count
            const countResult = await graph.query(
                queryQl(CLIENT_AGGREGATE_TYPE, { where })
            );
            totalCount = countResult.data.clients_aggregate.aggregate.count;

            clients = await graph.query(
                queryQl(CLIENT_TYPE(COMPLETED_LOANS), {
                    where,
                    order_by: getOrderBy(),
                    limit,
                    offset
                })
            ).then(res => res.data.clients.map(c => ({
                ... c.loans?.[0],
                client: c,
            })));
        } else {
            const where = {
                loId: loId ? { _eq: loId } : { _neq: 'null' },
                branchId: branchId ? { _eq: branchId } : { _neq: 'null' },
                status: { _eq: status }
            };

            // Get total count
            const countResult = await graph.query(
                queryQl(CLIENT_AGGREGATE_TYPE, { where })
            );
            totalCount = countResult.data.clients_aggregate.aggregate.count;

            clients = await graph.query(
                queryQl(CLIENT_TYPE(DEFAULT_LOANS), {
                    where,
                    order_by: getOrderBy(),
                    limit,
                    offset
                })
            ).then(res => res.data.clients);
        }

    } else if (mode === 'view_for_reloan' && groupId) {
        const where = {
            groupId: { _eq: groupId },
            loans: {
                status: { _eq: 'active' }
            }
        };

        // Get total count
        const countResult = await graph.query(
            queryQl(CLIENT_AGGREGATE_TYPE, { where })
        );
        totalCount = countResult.data.clients_aggregate.aggregate.count;

        clients = await graph.query(
            queryQl(CLIENT_TYPE(RELOAN_CLIENT_LOANS), {
                where,
                order_by: getOrderBy(),
                limit,
                offset
            })
        ).then(res => res.data.clients);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    response = {
        success: true,
        clients: clients || [],
        pagination: {
            currentPage: pageNum,
            pageSize: pageSize,
            totalCount: totalCount,
            totalPages: totalPages,
            hasNextPage: hasNextPage,
            hasPrevPage: hasPrevPage,
            startIndex: offset + 1,
            endIndex: Math.min(offset + pageSize, totalCount)
        }
    };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}