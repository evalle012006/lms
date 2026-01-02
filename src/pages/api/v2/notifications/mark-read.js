import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import moment from 'moment';
import { NOTIFICATION_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const NOTIFICATION_TYPE = createGraphType('notifications', NOTIFICATION_FIELDS);

export default apiHandler({
    post: markRead
});

/**
 * Mark notification(s) as read
 * 
 * Request body:
 * {
 *   notificationIds: string[] | string - single ID or array of IDs
 *   userId: string - user marking as read
 *   markAll: boolean - if true, mark all user's notifications as read
 *   userRole: object - user's role for filtering (required if markAll is true)
 *   branchId: string - user's branch (required if markAll is true)
 *   areaId: string - user's area (optional)
 *   regionId: string - user's region (optional)
 *   divisionId: string - user's division (optional)
 * }
 */
async function markRead(req, res) {
    const user_id = req?.auth?.sub;
    let statusCode = 200;
    let response = {};

    try {
        const {
            notificationIds,
            userId,
            markAll = false,
            userRole,
            branchId,
            areaId,
            regionId,
            divisionId
        } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'userId is required'
            });
        }

        const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ss');
        let where = {};

        if (markAll) {
            // Build where clause based on role for mark all
            where = buildWhereClauseForMarkAll({
                role: userRole,
                userId,
                branchId,
                areaId,
                regionId,
                divisionId
            });
            where.is_read = { _eq: false };
        } else {
            // Mark specific notifications
            if (!notificationIds) {
                return res.status(400).json({
                    success: false,
                    error: true,
                    message: 'notificationIds is required when markAll is false'
                });
            }

            const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
            where = { _id: { _in: ids } };
        }

        logger.debug({
            user_id,
            page: 'Notifications Mark Read',
            message: markAll ? 'Marking all as read' : 'Marking notifications as read',
            where
        });

        // Get current notifications to update read_by array
        const currentNotifications = await graph.query(
            queryQl(NOTIFICATION_TYPE('currentNotifications'), {
                where
            })
        ).then(res => res.data.currentNotifications || []);

        // Update each notification
        const updates = currentNotifications.map(async (notification) => {
            let readBy = [];
            try {
                readBy = JSON.parse(notification.read_by || '[]');
            } catch (e) {
                readBy = [];
            }

            if (!readBy.includes(userId)) {
                readBy.push(userId);
            }

            return graph.mutation(
                updateQl(NOTIFICATION_TYPE('updateNotification'), {
                    set: {
                        is_read: true,
                        read_by: JSON.stringify(readBy),
                        date_modified: currentDateTime
                    },
                    where: { _id: { _eq: notification._id } }
                })
            );
        });

        await Promise.all(updates);

        response = {
            success: true,
            message: `${currentNotifications.length} notification(s) marked as read`,
            count: currentNotifications.length
        };

    } catch (error) {
        logger.error({
            user_id,
            page: 'Notifications Mark Read',
            message: 'Error marking notifications as read',
            error: error.message
        });
        
        statusCode = 500;
        response = {
            success: false,
            error: true,
            message: 'Failed to mark notifications as read'
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

/**
 * Build where clause for marking all notifications as read based on user role
 */
function buildWhereClauseForMarkAll({ role, userId, branchId, areaId, regionId, divisionId }) {
    if (!role) {
        return { _id: { _eq: '' } };
    }

    const rep = role.rep;
    const shortCode = role.shortCode;

    // Admin - all notifications
    if (rep === 1) {
        return {};
    }
    // Loan Officer - their notifications
    if (rep === 4) {
        return { lo_id: { _eq: userId } };
    }
    // Branch Manager - branch notifications
    if (rep === 3) {
        return { branch_id: { _eq: branchId } };
    }
    // Area Admin
    if (shortCode === 'area_admin') {
        return { area_id: { _eq: areaId } };
    }
    // Regional Manager
    if (shortCode === 'regional_manager') {
        return { region_id: { _eq: regionId } };
    }
    // Deputy Director
    if (shortCode === 'deputy_director') {
        return { division_id: { _eq: divisionId } };
    }

    return { _id: { _eq: '' } };
}