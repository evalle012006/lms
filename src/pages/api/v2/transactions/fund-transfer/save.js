
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl, updateQl } from "@/lib/graph/graph.util";
import { generateUUID } from "@/lib/utils";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: saveFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');


async function saveFundTransfer(req, res) {
    const user = await findUserById(req.auth.sub);
    const fundTransfer = req.body;

    // todo: add logic validation here

    const [data] = await graph.mutation(
        insertQl(FUND_TRANSFER_TYPE, {
            objects: [{
                _id: generateUUID(),
                account: fundTransfer.account,
                amount: fundTransfer.amount,
                description: fundTransfer.description,
                giverBranchId: fundTransfer.giverBranchId,
                receiverBranchId: fundTransfer.receiverBranchId,
                giverApprovalId: fundTransfer.giverApprovalId,
                receiverApprovalId: fundTransfer.receiverApprovalId,
                status: 'pending',
                insertedById: user._id,
                insertedDate: 'now()'
            }]
        })
    ).then(res => res.data.results.returning)

    res.send({
        success: true,
        data,
    });
}

