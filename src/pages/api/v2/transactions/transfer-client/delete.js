import { apiHandler } from "@/services/api-handler";
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
    }
  } else {
    response = {
      error: true,
      message: `Selected data not exist`,
    };
  }

  res.send(response);
}
