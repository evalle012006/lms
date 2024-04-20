import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const losTotalsType = createGraphType("losTotals", "_id")("losTotals");

export default apiHandler({
  post: updateLosData,
});

async function updateLosData(req, res) {
  const { userId, date, newLos } = req.body;

  const { data } = await graph.query(
    queryQl(losTotalsType, {
      where: {
        userId: { _eq: userId },
        userType: { _eq: "lo" },
        dateAdded: { _eq: date },
      },
    })
  );

  const losData = data?.losTotals;

  if (losData.length > 0) {
    await graph.mutation(
      updateQl(losTotalsType, {
        where: { _id: { _eq: losData[0]._id } },
        set: { ...newLos },
      })
    );
  }

  res.send({});
}
