import { CLIENT_FIELDS } from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl } from "@/lib/graph/graph.util";
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { findUserById, findBranches, findGroups } from '@/lib/graph.functions';
import { isNotificationEnabled, notifyProspectClientCreated } from '@/lib/notification-service';
import { apiHandler } from "@/services/api-handler";
import moment from 'moment';
import logger from '@/logger';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
${CLIENT_FIELDS}
`)('clients');

export default apiHandler({
    post: save,
});

async function save(req, res) {
    const user_id = req?.auth?.sub;
    const clientData = req.body;

    let response = {};
    let statusCode = 200;

    try {
        const clientId = generateUUID();

        // ── Insert the client ─────────────────────────────────────────────
        const mutationResult = await graph.mutation(
            insertQl(CLIENT_TYPE, {
                objects: [{
                    _id: clientId,
                    ...clientData,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD'),
                }]
            })
        );

        // ── Surface any GraphQL-level errors ──────────────────────────────
        if (mutationResult.errors?.length) {
            logger.error({
                user_id,
                page: 'Client Save',
                message: 'GraphQL mutation errors',
                errors: mutationResult.errors,
            });
            return res.status(200).json({
                error: true,
                message: mutationResult.errors[0]?.message || 'Failed to create client',
            });
        }

        const client = mutationResult.data?.clients?.returning?.[0];

        // ── Guard: mutation returned no record ────────────────────────────
        if (!client) {
            logger.error({
                user_id,
                page: 'Client Save',
                message: 'Mutation succeeded but returned no client record',
                clientData,
            });
            return res.status(200).json({
                error: true,
                message: 'Failed to create client — no record returned.',
            });
        }

        // ── Client saved — set success response immediately ───────────────
        // This must happen BEFORE the notification block so a notification
        // failure never causes a false "Failed to create client" error.
        response = {
            success: true,
            client,
        };

        // ── Notifications (non-blocking) ──────────────────────────────────
        try {
            const isNotificationEnabledFlag = await isNotificationEnabled();

            if (isNotificationEnabledFlag) {
                let branch = null;
                if (clientData.branchId) {
                    const branches = await findBranches({ _id: { _eq: clientData.branchId } });
                    branch = branches?.[0];
                }

                let group = null;
                if (clientData.groupId) {
                    const groups = await findGroups({ _id: { _eq: clientData.groupId } });
                    group = groups?.[0];
                }

                const user = await findUserById(user_id || clientData.insertedBy);

                if (branch) {
                    await notifyProspectClientCreated({
                        clientName:     clientData.fullName || `${clientData.firstName} ${clientData.lastName}`,
                        clientId:       client._id,
                        groupId:        clientData.groupId,
                        groupName:      group?.name || clientData.groupName,
                        branchId:       clientData.branchId,
                        areaId:         branch.areaId,
                        regionId:       branch.regionId,
                        divisionId:     branch.divisionId,
                        loId:           clientData.loId,
                        createdBy:      user?._id || clientData.insertedBy,
                        createdByName:  user ? `${user.firstName} ${user.lastName}` : 'System',
                    });

                    logger.debug({
                        user_id,
                        page: 'Client Save',
                        message: 'Notification created for new prospect client',
                        clientId: client._id,
                    });
                }
            }
        } catch (notifError) {
            // Never fail the save because of a notification error
            logger.error({
                user_id,
                page: 'Client Save',
                message: 'Failed to create notification (client was saved successfully)',
                error: notifError.message,
            });
        }

    } catch (error) {
        logger.error({
            user_id,
            page: 'Client Save',
            message: 'Error saving client',
            error: error.message,
        });

        statusCode = 500;
        response = {
            error: true,
            message: 'Failed to save client: ' + error.message,
        };
    }

    res
        .status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}