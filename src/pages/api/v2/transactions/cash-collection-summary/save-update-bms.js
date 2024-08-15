import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { LOS_TOTALS_FIELDS } from "@/lib/graph.fields";
import { gql } from "node_modules/apollo-boost/lib/index";

const graph = new GraphProvider();
const losTotalsType = createGraphType("losTotals", LOS_TOTALS_FIELDS)();

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { branchId, loIds, currentDate } = req.body;

    const query = gql`
      query find($loIds: [String!], $dateAdded: date) {
        users (where: { _id: { _in: $loIds} }) {
            firstName, lastName
            losTotal: losTotals(
                where: {
                  losType: { _eq: "daily" },
                  dateAdded: { _eq: $dateAdded },
                  userType: { _eq: "lo" }
                }
            ) {
              _id
            }
        }
      }
    `;

    const checkLos = await graph.apollo.query({ query, variables: { loIds, dateAdded: currentDate }})
      .then((res) => {
        if (res.errors) {
          console.error(res.errors);
          throw res.errors[0];
        }
        return res.data?.users ?? [];
      });

    let response = {};
    if (checkLos) {
        const noLOS = checkLos.filter(los => los.losTotal.length === 0);
        if (noLOS.length > 0) {
            let errorMsg = '';
            noLOS.map(lo => {
                errorMsg += `${lo.firstName} ${lo.lastName} have not submitted LOS yet. \n`;
            });

            response = { error: true, message: errorMsg };
        } else {
            const los = await graph.mutation(updateQl(losTotalsType, {
              where: {
                losType: { _eq: 'daily' },
                dateAdded: { _eq: currentDate },
                branchId: { _eq: branchId },
                userType: { _eq: 'lo' }
              },
              set: {
                status: 'approved',
                dateApproved: currentDate,
              }
            }));
        
            response = { success: true, data: los };
        }
    }

    res.send(response);
}