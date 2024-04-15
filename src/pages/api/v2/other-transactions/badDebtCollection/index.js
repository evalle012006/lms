import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl, updateQl } from "@/lib/graph/graph.util";
import {
  createBadDebtCollectionsType,
  fieldsForList, toDto
} from '@/pages/api/v2/other-transactions/badDebtCollection/common'

const graph = new GraphProvider();

export default apiHandler({
  get: getData,
  post: updateData,
});

async function getData(req, res) {
  const { _id } = req.query;
  const { data: graphData } = await graph.query(
    queryQl(createBadDebtCollectionsType(fieldsForList), {
      where: { _id: { _eq: _id } },
    })
  );

  res.send({ success: true, data: toDto(graphData.badDebtCollections?.[0]) });
}

async function updateData(req, res) {
  const { _id, ...payload } = req.body;
  const { data } = await graph.mutation(
    updateQl(createBadDebtCollectionsType(), {
      set: payload,
      where: { _id: { _eq: _id } },
    })
  );
  res.send({ success: true, data: data?.returning?.badDebtCollections?.[0] });
}
