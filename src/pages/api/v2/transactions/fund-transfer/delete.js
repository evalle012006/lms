
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, deleteQl, queryQl, updateQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    post: deleteFundTransfer,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');


async function deleteFundTransfer(req, res) {
    const user = await findUserById(req.auth.sub);
    const fundTransfer = req.body;

    const [data] = await graph.query(
        queryQl(FUND_TRANSFER_TYPE, {
            where: {
                _id: { _eq: fundTransfer._id ?? null },
                status: { _eq: 'pending' },
                deletedDate: { _is_null: true },
                insertedById: { _eq: user._id ?? null },
            }
        })
    ).then(res => res.data.results);

    if(!data) {
        res.status(500)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({
            message: 'Unable to delete fund transfer'
        }));
        return;
    }

    const [result] = await graph.mutation(
        updateQl(FUND_TRANSFER_TYPE, {
            set: {
                deletedDate: 'now()',
                deleted: true,
                deletedById: user._id
            },
            where: {
                _id: { _eq: data._id }
            }
        })
    ).then(res => res.data.results.returning);

    res.send({
        success: true,
        data: result,
    });
}

