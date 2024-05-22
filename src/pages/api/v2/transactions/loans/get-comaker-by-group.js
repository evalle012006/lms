import { apiHandler } from "@/services/api-handler";
import { findLoans } from "@/lib/graph.functions";

export default apiHandler({
  get: getComaker,
});

async function getComaker(req, res) {
  const { groupId } = req.query;
  const data = await findLoans({
    groupId: { _eq: groupId },
    status: { _nin: ["closed", "reject"] },
  });

  const slotNumbers = data.map(async (d) => {
    if (d.coMaker) {
      if (typeof d.coMaker === "number") {
        return d.coMaker;
      } else if (typeof d.coMaker === "string") {
        const client = await db
          .collection("client")
          .find({ _id: new ObjectId(d.coMaker) })
          .toArray();
        if (client) {
        }
      }
    }
  });

  const response = { success: true, data: slotNumbers };
  res.send(response);
}
