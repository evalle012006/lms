import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import { NOTIFICATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment-timezone';

const graph = new GraphProvider();
const NOTIFICATION_TYPE = createGraphType('notifications', NOTIFICATION_FIELDS);

const COMPLIANCE_TYPES = new Set([
    'successive_delinquent_transaction',
    'delinquent_client_as_reloaner',
]);

const TIMEZONE = 'Asia/Manila';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const user_id = req?.auth?.sub;
    let statusCode = 200;
    let response = {};

    try {
        const { 
            limit = 10, 
            offset = 0, 
            unreadOnly = false,
            types,
            date,
            branchId:  filterBranchId,
            loId:      filterLoId,
            groupId:   filterGroupId,
        } = req.query;

        const currentUser = await findUserById(user_id);
        if (!currentUser) {
            return res.status(200).json({ success: true, notifications: [], total: 0, unreadCount: 0 });
        }

        const role = currentUser.role;

        const requestedTypes = types ? types.split(',').map(t => t.trim()) : [];
        const allCompliance  = requestedTypes.length > 0 && requestedTypes.every(t => COMPLIANCE_TYPES.has(t));

        if (!allCompliance) {
            try {
                const settingsResult = await graph.query(
                    queryQl(createGraphType('settings', 'enableNotifications')('systemSettings'), { limit: 1 })
                );
                const settings = settingsResult?.data?.systemSettings?.[0];
                const enabled  = !settings || settings.enableNotifications === undefined || settings.enableNotifications === null
                    ? true
                    : settings.enableNotifications === true;

                if (!enabled) {
                    return res.status(200).json({ success: true, notifications: [], total: 0, unreadCount: 0 });
                }
            } catch (e) {
                logger.warn({ user_id, page: 'Notifications List', message: 'Could not check notification settings', error: e.message });
            }
        }

        const where = buildWhereClause({
            role,
            userId:     currentUser._id,
            branchId:   currentUser.designatedBranchId || currentUser.branchId,
            areaId:     currentUser.areaId,
            regionId:   currentUser.regionId,
            divisionId: currentUser.divisionId,
            unreadOnly: unreadOnly === 'true' || unreadOnly === true
        });

        if (requestedTypes.length > 0) {
            where.type = { _in: requestedTypes };
        }

        if (date) {
            const startOfDay = moment.tz(date, TIMEZONE).startOf('day').format('YYYY-MM-DD HH:mm:ss');
            const endOfDay   = moment.tz(date, TIMEZONE).endOf('day').format('YYYY-MM-DD HH:mm:ss');
            where.date_added = { _gte: startOfDay, _lte: endOfDay };
        }

        // ── Additional filters from modal (override/narrow role-based scope) ─
        // Only apply if within the user's allowed scope (they can't filter
        // outside what buildWhereClause already restricts them to)
        if (filterBranchId) where.branch_id = { _eq: filterBranchId };
        if (filterLoId)     where.lo_id     = { _eq: filterLoId };
        if (filterGroupId)  where.group_id  = { _eq: filterGroupId };

        logger.debug({ user_id, page: 'Notifications List', message: 'Fetching notifications', where, limit, offset });

        const [notifications, totalCountResult, unreadCountResult] = await Promise.all([
            graph.query(
                queryQl(NOTIFICATION_TYPE('notifications'), {
                    where,
                    order_by: [{ date_added: 'desc' }],
                    limit:  parseInt(limit),
                    offset: parseInt(offset)
                })
            ).then(res => res.data.notifications || []),

            graph.query(
                queryQl(createGraphType('notifications', '_id')('notificationsCount'), { where })
            ).then(res => res.data.notificationsCount || []),

            graph.query(
                queryQl(createGraphType('notifications', '_id')('notificationsUnread'), {
                    where: { ...where, is_read: { _eq: false } }
                })
            ).then(res => res.data.notificationsUnread || []),
        ]);

        response = {
            success: true,
            notifications,
            total:       totalCountResult.length,
            unreadCount: unreadCountResult.length,
            limit:  parseInt(limit),
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

function buildWhereClause({ role, userId, branchId, areaId, regionId, divisionId, unreadOnly }) {
    let where = {};

    if (!role) {
        return { _id: { _eq: '' } };
    }

    const rep       = role.rep;
    const shortCode = role.shortCode;

    if (rep === 1) {
        where = {};
    } else if (rep === 4) {
        where = { lo_id: { _eq: userId } };
    } else if (rep === 3) {
        where = { branch_id: { _eq: branchId } };
    } else if (shortCode === 'area_admin') {
        where = { area_id: { _eq: areaId } };
    } else if (shortCode === 'regional_manager') {
        where = { region_id: { _eq: regionId } };
    } else if (shortCode === 'deputy_director') {
        where = { division_id: { _eq: divisionId } };
    } else {
        where = { _id: { _eq: '' } };
    }

    if (unreadOnly) {
        where.is_read = { _eq: false };
    }

    return where;
}