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
    
    // Insert the client
    const client = await graph.mutation(
      insertQl(CLIENT_TYPE, {
        objects: [{
          _id: clientId,
          ...clientData,
          dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
      })
    ).then(res => res.data?.clients?.returning?.[0]);

    const isNotificationEnabledFlag = await isNotificationEnabled();

    if (client && isNotificationEnabledFlag) {
      // ==========================================
      // CREATE NOTIFICATION: prospect_client_created
      // ==========================================
      try {
        // Get branch info for hierarchy IDs
        let branch = null;
        if (clientData.branchId) {
          const branches = await findBranches({ _id: { _eq: clientData.branchId } });
          branch = branches?.[0];
        }

        // Get group info
        let group = null;
        if (clientData.groupId) {
          const groups = await findGroups({ _id: { _eq: clientData.groupId } });
          group = groups?.[0];
        }

        // Get user info
        const user = await findUserById(user_id || clientData.insertedBy);

        if (branch) {
          await notifyProspectClientCreated({
            clientName: clientData.fullName || `${clientData.firstName} ${clientData.lastName}`,
            clientId: client._id,
            groupId: clientData.groupId,
            groupName: group?.name || clientData.groupName,
            branchId: clientData.branchId,
            areaId: branch.areaId,
            regionId: branch.regionId,
            divisionId: branch.divisionId,
            loId: clientData.loId,
            createdBy: user?._id || clientData.insertedBy,
            createdByName: user ? `${user.firstName} ${user.lastName}` : 'System'
          });

          logger.debug({
            user_id,
            page: 'Client Save',
            message: 'Notification created for new prospect client',
            clientId: client._id
          });
        }
      } catch (notifError) {
        // Log notification error but don't fail the main operation
        logger.error({
          user_id,
          page: 'Client Save',
          message: 'Failed to create notification',
          error: notifError.message
        });
      }
      // ==========================================
      // END NOTIFICATION
      // ==========================================

      response = {
        success: true,
        client: client
      };
    } else {
      response = {
        error: true,
        message: 'Failed to create client'
      };
    }
  } catch (error) {
    logger.error({
      user_id,
      page: 'Client Save',
      message: 'Error saving client',
      error: error.message
    });
    
    statusCode = 500;
    response = {
      error: true,
      message: 'Failed to save client: ' + error.message
    };
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}