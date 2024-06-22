import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { findCashCollections, findGroups } from "@/lib/graph.functions";
import { createGraphType, deleteQl } from "@/lib/graph/graph.util";

const graph = new GraphProvider();
const ccGraphType = createGraphType('cashCollections', '_id')();

export default apiHandler({
    post: autoHealLoans
});

async function autoHealLoans(req, res) {
    const { loId, currentDate } = req.body;

    const groups = await findGroups({
      loanOfficerId: { _eq: loId },
      noOfClients: { _gt: 0 }
    });

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(groups.map(async (group) => {
            const groupIdStr = group._id + '';
            await removedDoubleCC(groupIdStr, currentDate);
        }));

        resolve(response);
    });

    const response = promise ? { success: true } : null;
    res.send(response);
}

async function removedDoubleCC(groupId, currentDate) {   
    const cashCollections = await findCashCollections({
      groupId: { _eq: groupId },
      dateAdded: { _eq: currentDate },
    });

    const uniqueCC = [];
    cashCollections.map(async cc => {
        const existing = uniqueCC.filter(c => {
            if (c.clientId === cc.clientId && c.paymentCollection === c.paymentCollection && c.loanId === cc.loanId && c.loanBalance === cc.loanBalance) {
                return c;
            }
        });

        if (existing.length === 0) {
            uniqueCC.push(cc);
        } else {
            await graph.mutation(deleteQl(ccGraphType, { _id: { _eq: cc._id } }));
        }
    });
}
