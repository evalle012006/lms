import { apiHandler } from "@/services/api-handler";
import { logAudit } from "@/lib/audit";
import { findTransferClients } from '@/lib/graph.functions';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { TRANSFER_CLIENT_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';

const transferClientsType = createGraphType(
  "transferClients",
  TRANSFER_CLIENT_FIELDS
)();

const graph = new GraphProvider();

export default apiHandler({
  post: deleteTransfer,
});

async function deleteTransfer(req, res) {
  const { id } = req.body;
  let response = {};
  const transferClient = await findTransferClients({ _id: { _eq: id }});
  
  if (transferClient.length > 0) {
    if (transferClient[0].status === "pending") {
      await graph.mutation(
        deleteQl(transferClientsType, { _id: { _eq: transferClient[0]._id } })
      );

      response = { success: true };
      logAudit(req, {
        action: 'TRANSFER_DELETED',
        category: 'TRANSFER',
        entityType: 'transfer',
        entityId: transferClient[0]._id,
        clientId: transferClient[0].selectedClientId,
        description: 'Pending transfer request deleted',
        beforeData: { status: transferClient[0].status, sourceGroupId: transferClient[0].sourceGroupId, targetGroupId: transferClient[0].targetGroupId },
      });
    }
  } else {
    response = {
      error: true,
      message: `Selected data not exist`,
    };
  }

  res.send(response);
}
