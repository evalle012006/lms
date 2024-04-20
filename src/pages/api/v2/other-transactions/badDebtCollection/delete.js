import { apiHandler } from "@/services/api-handler";
import { deleteQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createBadDebtCollectionsType } from "@/pages/api/v2/other-transactions/badDebtCollection/common";

const graph = new GraphProvider();

export default apiHandler({
  post: deleteBranch,
});

async function deleteBranch(req, res) {
  const { _id } = req.body;
  await graph.mutation(deleteQl(createBadDebtCollectionsType(), { _id: { _eq: _id } }));
  res.send({ success: true });
}
