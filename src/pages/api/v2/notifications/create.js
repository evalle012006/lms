// ============================================
// FILE: src/pages/api/v2/notifications/create.js
// ============================================

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { filterGraphFields } from '@/lib/graph.functions';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import moment from 'moment';
import { NOTIFICATION_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const NOTIFICATION_TYPE = createGraphType('notifications', NOTIFICATION_FIELDS);

export default apiHandler({
    post: create
});

/**
 * Create a new notification
 * 
 * Request body:
 * {
 *   type: string (required) - notification type
 *   title: string (required) - notification title
 *   message: string (required) - notification message
 *   data: object (optional) - additional data for deep linking
 *   division_id: string (optional)
 *   region_id: string (optional)
 *   area_id: string (optional)
 *   branch_id: string (optional)
 *   lo_id: string (optional)
 *   client_id: string (optional)
 *   loan_id: string (optional)
 *   group_id: string (optional)
 *   created_by: string (required) - user id who triggered the notification
 *   created_by_name: string (required) - user name who triggered the notification
 * }
 */
async function create(req, res) {
    const user_id = req?.auth?.sub;
    let statusCode = 200;
    let response = {};

    try {
        const {
            type,
            title,
            message,
            data = {},
            division_id = null,
            region_id = null,
            area_id = null,
            branch_id = null,
            lo_id = null,
            client_id = null,
            loan_id = null,
            group_id = null,
            created_by,
            created_by_name
        } = req.body;

        // Validate required fields
        if (!type || !title || !message || !created_by) {
            return res.status(400).json({
                success: false,
                error: true,
                message: 'Missing required fields: type, title, message, and created_by are required'
            });
        }

        const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ss');

        const notificationData = {
            _id: generateUUID(),
            type,
            title,
            message,
            data: JSON.stringify(data),
            division_id,
            region_id,
            area_id,
            branch_id,
            lo_id,
            client_id,
            loan_id,
            group_id,
            created_by,
            created_by_name,
            read_by: JSON.stringify([]),
            is_read: false,
            date_added: currentDateTime,
            date_modified: currentDateTime
        };

        logger.debug({
            user_id,
            page: 'Notifications Create',
            message: 'Creating notification',
            notificationType: type,
            notificationData
        });

        const result = await graph.mutation(
            insertQl(NOTIFICATION_TYPE('insertNotification'), {
                objects: [filterGraphFields(NOTIFICATION_FIELDS, notificationData)]
            })
        ).then(res => res.data?.insertNotification?.returning?.[0]);

        if (result) {
            response = {
                success: true,
                notification: result
            };
        } else {
            throw new Error('Failed to insert notification');
        }

    } catch (error) {
        logger.error({
            user_id,
            page: 'Notifications Create',
            message: 'Error creating notification',
            error: error.message
        });
        
        statusCode = 500;
        response = {
            success: false,
            error: true,
            message: 'Failed to create notification'
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}