import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { LOAN_FIELDS } from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";

const loansType = createGraphType("loans", LOAN_FIELDS)();
const graph = new GraphProvider();

export default apiHandler({
  get: getComaker,
});

async function getComaker(req, res) {
  const { groupId } = req.query;
  const data = (
    await graph.query(
      queryQl(loansType, {
        where: {
          groupId: { _eq: groupId },
          status: { _nin: ["closed", "reject"] },
        },
      })
    )
  )?.data?.loans;

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
