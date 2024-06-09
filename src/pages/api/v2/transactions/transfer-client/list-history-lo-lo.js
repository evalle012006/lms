import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { gql } from "apollo-boost";

const graph = new GraphProvider();

export default apiHandler({
  get: list,
});

async function list(req, res) {
  const { branchId, loId, startDate, endDate, occurence } = req.query;

  let transfers;

  if (loId) {
  } else {
    const query = gql`
      query get_data(
        $args: get_transfer_client_list_history_lo_to_lo_arguments!
      ) {
        transfers: get_transfer_client_list_history_lo_to_lo(args: $args) {
          _id
          data
        }
      }
    `;

    const args = {
      startDate,
      endDate,
      occurrence: occurence,
      designatedBranchId: branchId,
    };

    transfers = await graph.apollo
      .query({ query, variables: { args } })
      .then((res) => {
        if (res.errors) {
          console.error(res.errors);
          throw res.errors[0];
        }
        return res.data?.transfers ?? [];
      })
      .then((transfers) => transfers.map(({ data }) => ({
        ...data,
        giverDetails: data.giverDetails ?? [],
        receiverDetails: data.receiverDetails ?? [],
      })));
  }

  res.send({
    success: true,
    data: transfers,
  });
}
