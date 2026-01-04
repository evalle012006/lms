// ============================================
// FILE: src/pages/api/v2/notifications/list.js
// ============================================

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import { NOTIFICATION_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const NOTIFICATION_TYPE = createGraphType('notifications', NOTIFICATION_FIELDS);

export default apiHandler({
    get: list
});

/**
 * Get notifications based on user role
 * 
 * Role-based access:
 * - rep = 1: Everything (admin)
 * - rep = 4: Own notifications within their clients/loans
 * - rep = 3: All notifications within the branch
 * - shortCode = area_admin: Within their area
 * - shortCode = regional_manager: Within their region
 * - shortCode = deputy_director: Within their division
 */
async function list(req, res) {
    const user_id = req?.auth?.sub;
    let statusCode = 200;
    let response = {};

    try {
        const { 
            limit = 10, 
            offset = 0, 
            unreadOnly = false,
            // User context from query
            userRole,
            userId,
            branchId,
            areaId,
            regionId,
            divisionId
        } = req.query;

        // Parse role from JSON if passed as string
        const role = typeof userRole === 'string' ? JSON.parse(userRole) : userRole;
        
        // Build where clause based on role
        const where = buildWhereClause({
            role,
            userId,
            branchId,
            areaId,
            regionId,
            divisionId,
            unreadOnly: unreadOnly === 'true' || unreadOnly === true
        });

        logger.debug({
            user_id,
            page: 'Notifications List',
            message: 'Fetching notifications',
            where,
            limit,
            offset
        });

        const notifications = await graph.query(
            queryQl(NOTIFICATION_TYPE('notifications'), {
                where,
                order_by: [{ date_added: 'desc' }],
                limit: parseInt(limit),
                offset: parseInt(offset)
            })
        ).then(res => res.data.notifications || []);

        // Get total count for pagination
        const totalCountResult = await graph.query(
            queryQl(createGraphType('notifications', '_id')('notificationsCount'), {
                where
            })
        ).then(res => res.data.notificationsCount || []);

        // Get unread count
        const unreadWhere = { ...where, is_read: { _eq: false } };
        const unreadCountResult = await graph.query(
            queryQl(createGraphType('notifications', '_id')('notificationsUnread'), {
                where: unreadWhere
            })
        ).then(res => res.data.notificationsUnread || []);

        response = {
            success: true,
            notifications,
            total: totalCountResult.length,
            unreadCount: unreadCountResult.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
        };

    } catch (error) {
        logger.error({
            user_id,
            page: 'Notifications List',
            message: 'Error fetching notifications',
            error: error.message
        });
        
        statusCode = 500;
        response = {
            success: false,
            error: true,
            message: 'Failed to fetch notifications'
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

/**
 * Build GraphQL where clause based on user role
 */
function buildWhereClause({ role, userId, branchId, areaId, regionId, divisionId, unreadOnly }) {
    let where = {};

    if (!role) {
        return { _id: { _eq: '' } }; // Return empty result if no role
    }

    const rep = role.rep;
    const shortCode = role.shortCode;

    // Admin - see everything
    if (rep === 1) {
        where = {};
    }
    // Loan Officer (rep = 4) - see only their own notifications
    else if (rep === 4) {
        where = {
            lo_id: { _eq: userId }
        };
    }
    // Branch Manager (rep = 3) - see all notifications within their branch
    else if (rep === 3) {
        where = {
            branch_id: { _eq: branchId }
        };
    }
    // Area Admin - see notifications within their area
    else if (shortCode === 'area_admin') {
        where = {
            area_id: { _eq: areaId }
        };
    }
    // Regional Manager - see notifications within their region
    else if (shortCode === 'regional_manager') {
        where = {
            region_id: { _eq: regionId }
        };
    }
    // Deputy Director - see notifications within their division
    else if (shortCode === 'deputy_director') {
        where = {
            division_id: { _eq: divisionId }
        };
    }
    // Default - no access
    else {
        where = { _id: { _eq: '' } };
    }

    // Filter by unread if requested
    if (unreadOnly) {
        where.is_read = { _eq: false };
    }

    return where;
}