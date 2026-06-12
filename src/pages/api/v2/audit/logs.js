// src/pages/api/v2/audit/logs.js
// GET — admin only (rep <= 2)
// Searchable, filterable, paginated audit log viewer.
// Query params: category, action, userId, branchId, entityId,
//               severity, success, dateFrom, dateTo, search, page, limit

import { apiHandler }                   from '@/services/api-handler';
import { GraphProvider }                from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }     from '@/lib/graph/graph.util';
import { _gql as gql }                  from '@/lib/graph/apollo';
import { findUserById }                 from '@/lib/graph.functions';

const graph = new GraphProvider();

const AUDIT_TYPE = createGraphType('audit_logs', `
    _id timestamp userId userName userRole
    branchId branchName action category severity
    entityType entityId description
    beforeData afterData metadata
    success failReason ipAddress userAgent
`)('audit_logs');

export default apiHandler({ get: getLogs });

async function getLogs(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    // Admin or area+ only
    if (currentUser.role.rep > 2) {
        return res.status(200).json({ success: false, message: 'Access denied.' });
    }

    const {
        category, action, userId, branchId, entityId,
        severity, success: successFilter,
        dateFrom, dateTo, search,
        page = 1, limit = 50,
    } = req.query;

    // Build where clause
    const where = {};

    if (category)  where.category = { _eq: category };
    if (action)    where.action   = { _ilike: `%${action}%` };
    if (userId)    where.userId   = { _eq: userId };
    if (branchId)  where.branchId = { _eq: branchId };
    if (entityId)  where.entityId = { _eq: entityId };
    if (severity)  where.severity = { _eq: severity };
    if (successFilter !== undefined) {
        where.success = { _eq: successFilter === 'true' };
    }
    if (dateFrom) where.timestamp = { ...(where.timestamp || {}), _gte: dateFrom };
    if (dateTo)   where.timestamp = { ...(where.timestamp || {}), _lte: dateTo };
    if (search) {
        where._or = [
            { description: { _ilike: `%${search}%` } },
            { userName:    { _ilike: `%${search}%` } },
            { action:      { _ilike: `%${search}%` } },
            { entityId:    { _ilike: `%${search}%` } },
        ];
    }

    const pageNum  = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(10, parseInt(limit)));
    const offset   = (pageNum - 1) * pageSize;

    // Fetch paginated logs
    const logs = await graph.query(
        queryQl(AUDIT_TYPE, {
            where,
            order_by: [{ timestamp: 'desc' }],
            limit:    pageSize,
            offset,
        })
    ).then(r => r.data?.audit_logs ?? []);

    // Fetch total count — use graph.apollo directly with explicit variable typing
    // to avoid the 'audit_logs_aggregate_bool_exp vs audit_logs_bool_exp' mismatch
    // that occurs when passing through queryQl with createGraphType on the aggregate root.
    const total = await graph.apollo.query({
        query: gql`
            query GetAuditLogsCount($where: audit_logs_bool_exp) {
                audit_logs_aggregate(where: $where) {
                    aggregate { count }
                }
            }
        `,
        variables: { where },
    }).then(r => r.data?.audit_logs_aggregate?.aggregate?.count ?? 0);

    return res.status(200).json({
        success: true,
        logs,
        pagination: {
            page:  pageNum,
            limit: pageSize,
            total,
            pages: Math.ceil(total / pageSize),
        },
    });
}